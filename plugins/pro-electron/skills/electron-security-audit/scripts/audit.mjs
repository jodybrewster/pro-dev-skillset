#!/usr/bin/env node
// Static security audit for Electron apps. Heuristic: line-oriented regex plus
// simple brace matching. Reads files as text only and never imports or runs them.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', '.vite', 'build', 'release', '.git']);
const CODE_EXT = /\.(js|ts|mjs|cjs|jsx|tsx)$/;
const CONFIG_NAME = /^(forge\.config|electron-builder|electron\.vite\.config)\.\w+$/;
const PACKAGING_NAME = /^(forge\.config|electron-builder)\.\w+$/;
const MAX_BYTES = 1024 * 1024;

const RULES = {
  'node-integration': ['high', 'nodeIntegration is true, so renderer code can reach Node.js.', 'Set nodeIntegration: false and expose a narrow API through contextBridge in a preload script.'],
  'context-isolation-off': ['high', 'contextIsolation is false, so page scripts share a world with the preload script.', 'Remove the override. contextIsolation is true by default.'],
  'sandbox-off': ['high', 'sandbox is false, which drops the Chromium renderer sandbox.', 'Remove the override or set sandbox: true. Keep Node access in the main process.'],
  'web-security-off': ['high', 'webSecurity is false, which disables the same-origin policy.', 'Remove the override and serve local content from a custom protocol or the file origin.'],
  'insecure-content': ['high', 'allowRunningInsecureContent is true, so https pages can load http resources.', 'Remove the option and load every resource over https.'],
  'remote-module': ['high', 'The remote module is enabled or imported, which exposes main-process objects to the renderer.', 'Replace remote calls with explicit ipcMain.handle and ipcRenderer.invoke channels.'],
  'no-window-open-handler': ['medium', 'The app creates windows but never calls setWindowOpenHandler.', 'Call webContents.setWindowOpenHandler and return { action: "deny" } for anything not on an allowlist.'],
  'no-will-navigate': ['medium', 'The app creates windows but has no will-navigate handler.', 'Listen for will-navigate on webContents and call event.preventDefault() for unexpected origins.'],
  'open-external-unchecked': ['high', 'shell.openExternal is called on a value with no URL check in the same function.', 'Parse with new URL() and allow only https: (and known hosts) before calling shell.openExternal.'],
  'no-csp': ['medium', 'No Content-Security-Policy found in HTML or session headers.', 'Add a CSP meta tag or set the header in session.defaultSession.webRequest.onHeadersReceived.'],
  'no-fuses': ['medium', 'No @electron/fuses usage (flipFuses or FusesPlugin) found in the packaging config.', 'Flip fuses at package time: RunAsNode off, EnableNodeCliInspectArguments off, EnableNodeOptionsEnvironmentVariable off, EnableEmbeddedAsarIntegrityValidation and OnlyLoadAppFromAsar on.'],
  'inspect-fuse-on': ['medium', 'EnableNodeCliInspectArguments is true, so packaged builds accept --inspect.', 'Set the EnableNodeCliInspectArguments fuse to false.'],
};

function finding(rule, file, line, severity) {
  const [sev, message, fix] = RULES[rule];
  return { rule, severity: severity || sev, file, line, message, fix };
}

function walk(root) {
  const out = [];
  const st = statSync(root);
  if (st.isFile()) return [{ abs: root, rel: basename(root) }];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(abs);
      } else if (e.isFile()) {
        const n = e.name;
        if (n.endsWith('.min.js')) continue;
        if (CODE_EXT.test(n) || n.endsWith('.html') || n === 'package.json' || CONFIG_NAME.test(n)) {
          out.push({ abs, rel: relative(root, abs).split('\\').join('/') });
        }
      }
    }
  }
  return out.sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function lineOf(starts, idx) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= idx) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

// Returns matched { start, end } index pairs for every { } block, skipping strings and comments.
function braceBlocks(text) {
  const blocks = [];
  const stack = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? text.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < text.length && text[i] !== c) { if (text[i] === '\\') i++; if (c !== '`' && text[i] === '\n') break; i++; }
      i++;
      continue;
    }
    if (c === '{') stack.push(i);
    else if (c === '}' && stack.length) blocks.push({ start: stack.pop(), end: i });
    i++;
  }
  return blocks;
}

const CONTROL = /^\s*(\}\s*)?(else\s+)?(if|for|while|switch|catch|try|do|else)\b/;

function isFunctionHeader(text, starts, openIdx) {
  const ln = lineOf(starts, openIdx);
  const from = starts[Math.max(0, ln - 2)];
  const head = text.slice(from, openIdx);
  const last = text.slice(starts[ln - 1], openIdx);
  if (CONTROL.test(last)) return false;
  if (/=>|\bfunction\b/.test(head)) return true;
  return /^\s*(async\s+)?(static\s+)?[\w$]+\s*\([^)]*\)\s*$/.test(last) && !/^\s*(async\s+)?(if|for|while|switch|catch)\b/.test(last);
}

const URL_CHECK = /new URL\(|URL\.canParse|\.protocol\b|\.hostname\b|\.host\b|\.origin\b|startsWith\(\s*['"`]https?:|\/\^https\?|isSafe\w*Url|isAllowed\w*Url/;

function enclosingFunctionText(text, starts, blocks, idx) {
  let best = null;
  for (const b of blocks) {
    if (b.start < idx && idx < b.end && (!best || b.start > best.start) && isFunctionHeader(text, starts, b.start)) best = b;
  }
  if (!best) return text;
  // Include the header line so parameter checks and arrow bodies are covered.
  const ln = lineOf(starts, best.start);
  return text.slice(starts[ln - 1], best.end + 1);
}

function isCommentLine(l) {
  const t = l.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

export function audit(root) {
  const files = walk(root).map((f) => {
    let text = '';
    try { if (statSync(f.abs).size <= MAX_BYTES) text = readFileSync(f.abs, 'utf8'); } catch { /* unreadable */ }
    return { ...f, text, code: CODE_EXT.test(f.rel), html: f.rel.endsWith('.html') };
  });

  const isElectron = files.some((f) =>
    /require\(\s*['"]electron['"]\s*\)|from\s+['"]electron['"]/.test(f.text) ||
    (basename(f.rel) === 'package.json' && /"electron"\s*:/.test(f.text)));
  if (!isElectron) return { findings: [], electron: false };

  const out = [];
  let firstWindow = null;
  let hasOpenHandler = false;
  let hasWillNavigate = false;
  let hasCsp = false;
  let hasFuses = false;

  for (const f of files) {
    if (/Content-Security-Policy/i.test(f.text)) hasCsp = true;
    if (/flipFuses|FusesPlugin|@electron\/fuses/.test(f.text)) hasFuses = true;
    if (!f.code && !PACKAGING_NAME.test(basename(f.rel))) continue;
    const lines = f.text.split('\n');
    let starts = null;
    let blocks = null;
    lines.forEach((l, i) => {
      if (isCommentLine(l)) return;
      const ln = i + 1;
      if (/nodeIntegration\s*:\s*true/.test(l)) out.push(finding('node-integration', f.rel, ln));
      if (/contextIsolation\s*:\s*false/.test(l)) out.push(finding('context-isolation-off', f.rel, ln));
      if (/\bsandbox\s*:\s*false/.test(l)) out.push(finding('sandbox-off', f.rel, ln));
      if (/webSecurity\s*:\s*false/.test(l)) out.push(finding('web-security-off', f.rel, ln));
      if (/allowRunningInsecureContent\s*:\s*true/.test(l)) out.push(finding('insecure-content', f.rel, ln));
      if (/enableRemoteModule\s*:\s*true/.test(l)) out.push(finding('remote-module', f.rel, ln));
      else if (/@electron\/remote|require\(\s*['"]electron['"]\s*\)\.remote\b/.test(l) && /require\(|import /.test(l)) out.push(finding('remote-module', f.rel, ln, 'low'));
      if (/EnableNodeCliInspectArguments\]?\s*:\s*true/.test(l)) out.push(finding('inspect-fuse-on', f.rel, ln));
      if (/new\s+BrowserWindow\s*\(/.test(l) && !firstWindow) firstWindow = { file: f.rel, line: ln };
      if (/setWindowOpenHandler/.test(l)) hasOpenHandler = true;
      if (/['"`]will-navigate['"`]|willNavigate/.test(l)) hasWillNavigate = true;
      if (/shell\.openExternal\s*\(/.test(l) && !/openExternal\(\s*(['"`])https?:\/\/[^'"`$]*\1\s*\)/.test(l)) {
        if (!starts) { starts = lineStarts(f.text); blocks = braceBlocks(f.text); }
        const idx = starts[i] + l.indexOf('shell.openExternal');
        const fn = enclosingFunctionText(f.text, starts, blocks, idx);
        if (!URL_CHECK.test(fn)) out.push(finding('open-external-unchecked', f.rel, ln));
      }
    });
  }

  if (firstWindow) {
    if (!hasOpenHandler) out.push(finding('no-window-open-handler', firstWindow.file, firstWindow.line));
    if (!hasWillNavigate) out.push(finding('no-will-navigate', firstWindow.file, firstWindow.line));
  }
  if (!hasCsp) {
    const html = files.find((f) => f.html);
    const where = html ? { file: html.rel, line: 1 } : firstWindow;
    if (where) out.push(finding('no-csp', where.file, where.line));
  }
  if (!hasFuses) {
    const pkg = files.find((f) => PACKAGING_NAME.test(basename(f.rel))) || files.find((f) => basename(f.rel) === 'package.json');
    if (pkg) out.push(finding('no-fuses', pkg.rel, 1));
  }
  return { findings: out, electron: true };
}

function main(argv) {
  const json = argv.includes('--json');
  const target = argv.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('Usage: node audit.mjs <path> [--json]');
    return 2;
  }
  try { statSync(target); } catch {
    console.error(`Path not found: ${target}`);
    return 2;
  }
  const { findings, electron } = audit(target);
  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  const summary = { total: findings.length, high: 0, medium: 0, low: 0 };
  for (const f of findings) summary[f.severity]++;
  if (json) {
    console.log(JSON.stringify({ path: target, electron, findings, summary }, null, 2));
  } else if (!electron) {
    console.log('No Electron project detected. Nothing to audit.');
  } else if (!findings.length) {
    console.log('No findings.');
  } else {
    for (const sev of ['high', 'medium', 'low']) {
      const group = findings.filter((f) => f.severity === sev);
      if (!group.length) continue;
      console.log(`${sev.toUpperCase()} (${group.length})`);
      for (const f of group) {
        console.log(`  [${f.rule}] ${f.file}:${f.line}`);
        console.log(`    ${f.message}`);
        console.log(`    Fix: ${f.fix}`);
      }
      console.log('');
    }
    console.log(`${summary.total} findings: ${summary.high} high, ${summary.medium} medium, ${summary.low} low`);
  }
  return findings.length ? 1 : 0;
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
