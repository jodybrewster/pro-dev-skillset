#!/usr/bin/env node
/**
 * openspdd-ts: Node.js (ESM) port of the openspdd CLI.
 * Copies SPDD prompt templates into whichever AI editor is in use.
 * Zero npm dependencies — requires Node 20+.
 */

import { parseArgs } from 'node:util';
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, '..');
const COMMANDS_DIR = join(PLUGIN_ROOT, 'commands');
const PLUGIN_JSON = join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');

// ── Core template IDs (mirrors open-spdd data/core/) ─────────────────────────
const CORE_IDS = new Set([
  'spdd-analysis',
  'spdd-generate',
  'spdd-prompt-update',
  'spdd-reasons-canvas',
  'spdd-sync',
]);

// ── Tool registry (detection order mirrors Go internal/detector/types.go) ─────
const TOOL_ORDER = ['cursor', 'claude-code', 'antigravity', 'github-copilot', 'opencode', 'codex'];

const TOOLS = {
  'cursor':         { name: 'Cursor',         configDir: '.cursor/commands',         signatures: ['.cursor', '.cursorrules'] },
  'claude-code':    { name: 'Claude Code',    configDir: '.claude/commands',         signatures: ['.claude', 'CLAUDE.md'] },
  'antigravity':    { name: 'Antigravity',    configDir: '.antigravity/commands',    signatures: ['.antigravity'] },
  'github-copilot': { name: 'GitHub Copilot', configDir: '.github/copilot-prompts',  signatures: ['.github/copilot-instructions.md', '.github/copilot-prompts'] },
  'opencode':       { name: 'OpenCode',       configDir: '.opencode/commands',       signatures: ['.opencode', 'opencode.json'] },
  'codex':          { name: 'Codex',          configDir: '.agents/skills',           signatures: ['.codex', '.codex/config.toml'] },
};

// ── String helpers ────────────────────────────────────────────────────────────

// Split str on sep at most n times (mirrors Go strings.SplitN).
function splitN(str, sep, n) {
  const result = [];
  let start = 0;
  for (let i = 0; i < n - 1; i++) {
    const idx = str.indexOf(sep, start);
    if (idx === -1) break;
    result.push(str.slice(start, idx));
    start = idx + sep.length;
  }
  result.push(str.slice(start));
  return result;
}

function parseFrontmatter(content) {
  const empty = { name: '', id: '', category: '', description: '' };
  if (!content.startsWith('---')) return empty;
  const parts = splitN(content, '---', 3);
  if (parts.length < 3) return empty;
  const meta = { ...empty };
  for (const line of parts[1].split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const colon = t.indexOf(':');
    if (colon === -1) continue;
    const k = t.slice(0, colon).trim();
    const v = t.slice(colon + 1).trim();
    if (k === 'name')        meta.name        = v;
    else if (k === 'id')     meta.id          = v;
    else if (k === 'category') meta.category  = v;
    else if (k === 'description') meta.description = v;
  }
  return meta;
}

// Strips YAML frontmatter, returns body only (mirrors Go stripFrontmatter).
function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const parts = splitN(content, '---', 3);
  if (parts.length < 3) return content;
  return parts[2].replace(/^\n+/, '');
}

// OpenCode adapter: removes name: from frontmatter (mirrors opencode_adapter.go).
function normalizeForOpenCode(content) {
  if (!content.startsWith('---')) return content;
  const parts = splitN(content, '---', 3);
  if (parts.length < 3) return content;
  const lines = parts[1].split('\n').filter(l => !l.trim().startsWith('name:'));
  return '---' + lines.join('\n') + '---' + parts[2];
}

function escapeYAMLScalar(s) {
  if (!s) return '""';
  if (s.includes(':') || s.includes('#') || s.includes('"') || s !== s.trimStart()) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
}

// ── Template loader ───────────────────────────────────────────────────────────
async function loadTemplates() {
  const files = (await readdir(COMMANDS_DIR)).filter(f => f.endsWith('.md'));
  const templates = [];
  for (const file of files) {
    const content = await readFile(join(COMMANDS_DIR, file), 'utf8');
    const meta = parseFrontmatter(content);
    if (!meta.id) meta.id = file.slice(0, -3);
    templates.push({ ...meta, content, isCore: CORE_IDS.has(meta.id) });
  }
  templates.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  return templates;
}

async function findTemplate(nameOrId) {
  const key = nameOrId.toLowerCase();
  for (const tmpl of await loadTemplates()) {
    if (
      tmpl.id === key ||
      tmpl.name === key ||
      tmpl.name === '/' + key ||
      (tmpl.name || '').toLowerCase() === key ||
      (tmpl.name || '').toLowerCase() === '/' + key
    ) return tmpl;
  }
  return null;
}

// ── Auto-detection ────────────────────────────────────────────────────────────
async function detectTool(cwd) {
  for (const id of TOOL_ORDER) {
    for (const sig of TOOLS[id].signatures) {
      try { await stat(join(cwd, sig)); return id; } catch {}
    }
  }
  return null;
}

// ── Manifest ──────────────────────────────────────────────────────────────────
const MANIFEST = '.openspdd-manifest.json';

async function readManifest(dir) {
  try { return JSON.parse(await readFile(join(dir, MANIFEST), 'utf8')); }
  catch { return { files: [] }; }
}

async function updateManifest(dir, toolId, newFiles) {
  const existing = await readManifest(dir);
  const merged = [...new Set([...(existing.files || []), ...newFiles])];
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, MANIFEST),
    JSON.stringify({ tool: toolId, files: merged, updatedAt: new Date().toISOString() }, null, 2) + '\n',
    'utf8',
  );
}

// ── Safe write ────────────────────────────────────────────────────────────────
async function writeFileSafe(filePath, content, force) {
  try {
    await stat(filePath);
    if (!force) return { success: false, path: filePath, message: 'already exists, pass --force to overwrite' };
  } catch {}
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
    return { success: true, path: filePath, message: 'written' };
  } catch (err) {
    return { success: false, path: filePath, message: err.message };
  }
}

// ── Strategy: flatMarkdown ────────────────────────────────────────────────────
async function strategyFlat(toolId, cwd, templates, force) {
  const configDir = join(cwd, TOOLS[toolId].configDir);
  await mkdir(configDir, { recursive: true });
  const written = [];
  const results = [];

  for (const tmpl of templates) {
    const content = toolId === 'opencode' ? normalizeForOpenCode(tmpl.content) : tmpl.content;
    const r = await writeFileSafe(join(configDir, tmpl.id + '.md'), content, force);
    results.push(r);
    if (r.success) written.push(r.path);
  }

  if (written.length) await updateManifest(configDir, toolId, written);
  return results;
}

// ── Strategy: copilotInstructions ─────────────────────────────────────────────
const spddBegin = id => `<!-- spdd:begin:${id} -->`;
const spddEnd   = id => `<!-- spdd:end:${id} -->`;

async function strategyCopilot(cwd, templates, force) {
  const promptsDir = join(cwd, '.github', 'copilot-prompts');
  const instrPath  = join(cwd, '.github', 'copilot-instructions.md');
  await mkdir(promptsDir, { recursive: true });

  const written = [];
  const results = [];

  for (const tmpl of templates) {
    // Individual prompt file
    const promptPath = join(promptsDir, tmpl.id + '.md');
    const r = await writeFileSafe(promptPath, tmpl.content, force);
    results.push(r);
    if (r.success) written.push(promptPath);

    // Merge marker section into copilot-instructions.md (idempotent)
    const body = stripFrontmatter(tmpl.content);
    const bs = spddBegin(tmpl.id), be = spddEnd(tmpl.id);
    const section = `${bs}\n${body}\n${be}`;

    let text = '';
    try { text = await readFile(instrPath, 'utf8'); } catch {}

    if (text.includes(bs) && text.includes(be)) {
      const s = text.indexOf(bs), e = text.indexOf(be) + be.length;
      text = text.slice(0, s) + section + text.slice(e);
    } else {
      text = text ? text.trimEnd() + '\n\n' + section + '\n' : section + '\n';
    }
    await writeFile(instrPath, text, 'utf8');
  }

  if (written.length) await updateManifest(promptsDir, 'github-copilot', [...written, instrPath]);
  return results;
}

// ── Strategy: codexSkills ─────────────────────────────────────────────────────
async function strategyCodex(cwd, templates, force, allowImplicit) {
  const skillsBase = join(cwd, '.agents', 'skills');
  const written = [];
  const results = [];

  for (const tmpl of templates) {
    const skillDir  = join(skillsBase, tmpl.id);
    const agentsDir = join(skillDir, 'agents');
    await mkdir(agentsDir, { recursive: true });

    const skillName = (tmpl.name || tmpl.id).replace(/^\//, '');
    const desc = tmpl.description || 'SPDD command — see SKILL body for details';
    const body = stripFrontmatter(tmpl.content);
    const skillMd = `---\nname: ${escapeYAMLScalar(skillName)}\ndescription: ${escapeYAMLScalar(desc)}\n---\n\n${body}`;
    const yamlContent = `policy:\n  allow_implicit_invocation: ${allowImplicit ? 'true' : 'false'}\n`;

    for (const [fp, content] of [
      [join(skillDir, 'SKILL.md'), skillMd],
      [join(agentsDir, 'openai.yaml'), yamlContent],
    ]) {
      const r = await writeFileSafe(fp, content, force);
      results.push({ ...r, templateId: tmpl.id });
      if (r.success) written.push(r.path);
    }
  }

  if (written.length) await updateManifest(skillsBase, 'codex', written);
  return results;
}

// ── Generate dispatcher ───────────────────────────────────────────────────────
async function runGenerate({ toolId, cwd, all, coreOnly, templateName, force, allowImplicit }) {
  let templates;
  if (all) {
    templates = await loadTemplates();
  } else if (coreOnly) {
    templates = (await loadTemplates()).filter(t => t.isCore);
  } else if (templateName) {
    const tmpl = await findTemplate(templateName);
    if (!tmpl) { console.error(`Template not found: ${templateName}`); process.exit(1); }
    templates = [tmpl];
  } else {
    console.error('Specify a template name, or pass --all');
    process.exit(1);
  }

  let results;
  if (toolId === 'github-copilot') {
    results = await strategyCopilot(cwd, templates, force);
  } else if (toolId === 'codex') {
    results = await strategyCodex(cwd, templates, force, allowImplicit);
  } else {
    results = await strategyFlat(toolId, cwd, templates, force);
  }

  let ok = 0, skip = 0;
  for (const r of results) {
    if (r.success) { console.log(`  ✓  ${r.path}`); ok++; }
    else           { console.log(`  -  ${r.path || ''}: ${r.message}`); skip++; }
  }
  if (results.length > 1) console.log(`\n${ok} written, ${skip} skipped/failed`);
}

// ── Interactive helpers ───────────────────────────────────────────────────────
async function pickTool() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nSelect your AI coding tool:');
  TOOL_ORDER.forEach((id, i) => console.log(`  ${i + 1}. ${TOOLS[id].name} (${id})`));
  const ans = await rl.question('\nEnter number or tool ID: ');
  rl.close();
  const n = parseInt(ans.trim(), 10);
  if (!isNaN(n) && n >= 1 && n <= TOOL_ORDER.length) return TOOL_ORDER[n - 1];
  const key = ans.trim().toLowerCase();
  const aliased = { claude: 'claude-code', copilot: 'github-copilot', 'gh-copilot': 'github-copilot' }[key] || key;
  return TOOLS[aliased] ? aliased : null;
}

async function confirmPrompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`${question} [y/N] `);
  rl.close();
  return ans.trim().toLowerCase() === 'y';
}

// ── Tool resolution ───────────────────────────────────────────────────────────
const TOOL_ALIASES = { claude: 'claude-code', copilot: 'github-copilot', 'gh-copilot': 'github-copilot' };

async function resolveTool(toolFlag, cwd, allowInteractive) {
  if (toolFlag) {
    const id = TOOL_ALIASES[toolFlag.toLowerCase()] || toolFlag.toLowerCase();
    if (!TOOLS[id]) {
      console.error(`Unknown tool: ${toolFlag}\nValid IDs: ${TOOL_ORDER.join(', ')}`);
      process.exit(1);
    }
    return id;
  }
  const detected = await detectTool(cwd);
  if (detected) return detected;
  if (allowInteractive) {
    const picked = await pickTool();
    if (!picked) { console.error('No tool selected.'); process.exit(1); }
    return picked;
  }
  return null;
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdVersion() {
  const pkg = JSON.parse(await readFile(PLUGIN_JSON, 'utf8'));
  console.log(`openspdd-ts v${pkg.version} (from pro-spdd plugin)`);
}

async function cmdList({ toolFlag, cwd, category, quiet, optionalOnly, all }) {
  let templates = await loadTemplates();
  if (!all && optionalOnly) templates = templates.filter(t => !t.isCore);

  const detected = toolFlag
    ? await resolveTool(toolFlag, cwd, false)
    : await detectTool(cwd);
  if (!detected && !toolFlag) console.warn('Warning: no tool detected in current directory\n');

  if (category) {
    templates = templates.filter(t => t.category.toLowerCase() === category.toLowerCase());
    if (!templates.length) { console.warn(`No templates in category: ${category}`); return; }
  }

  if (quiet) { templates.forEach(t => console.log(t.id)); return; }

  const groups = {};
  for (const t of templates) {
    const cat = t.category || 'Uncategorized';
    (groups[cat] ??= []).push(t);
  }
  for (const [cat, list] of Object.entries(groups)) {
    console.log(`\n${cat}:`);
    for (const t of list) {
      const tag = t.isCore ? '[core]    ' : '[optional]';
      console.log(`  ${(t.name || t.id).padEnd(32)} ${tag}  ${t.description || ''}`);
    }
  }
}

async function cmdPathcheck({ toolFlag, cwd }) {
  const toolId = await resolveTool(toolFlag, cwd, false);
  if (!toolId) { console.log('No tool detected in current directory.'); return; }
  const tool = TOOLS[toolId];
  console.log(`Detected: ${tool.name} (${toolId})`);
  console.log(`Config dir: ${join(cwd, tool.configDir)}`);
}

async function cmdInit({ toolFlag, cwd, all, force }) {
  const toolId = await resolveTool(toolFlag, cwd, true);
  console.log(`\nInitializing ${TOOLS[toolId].name} (${toolId})...\n`);
  // Without --all, install only the 5 core templates (mirrors Go init behaviour).
  await runGenerate({ toolId, cwd, all, coreOnly: !all, templateName: null, force, allowImplicit: false });
  console.log(`\n✓ Done. Run /spdd-story to start the SPDD workflow.`);
}

async function cmdUninstall({ toolFlag, cwd, force, dryRun }) {
  const toolId = await resolveTool(toolFlag, cwd, false);
  if (!toolId) { console.error('No tool detected. Specify --tool <id>.'); process.exit(1); }

  const configDir = join(cwd, TOOLS[toolId].configDir);
  const manifest = await readManifest(configDir);

  if (!manifest.files?.length) {
    console.log('No openspdd-installed files found (manifest absent or empty).');
    return;
  }

  console.log(`\nFiles to remove for ${TOOLS[toolId].name}:`);
  manifest.files.forEach(f => console.log(`  ${f}`));

  if (dryRun) { console.log('\n(dry run — no changes made)'); return; }
  if (!force && !(await confirmPrompt('\nProceed with uninstall?'))) { console.log('Cancelled.'); return; }

  for (const f of manifest.files) {
    if (f.endsWith('copilot-instructions.md')) {
      // Strip SPDD marker sections rather than deleting the file.
      try {
        let content = await readFile(f, 'utf8');
        content = content.replace(/<!-- spdd:begin:[\w-]+ -->\n[\s\S]*?<!-- spdd:end:[\w-]+ -->\n?/g, '');
        await writeFile(f, content, 'utf8');
        console.log(`  ✓ stripped SPDD markers from ${f}`);
      } catch (err) { console.warn(`  ! ${f}: ${err.message}`); }
      continue;
    }
    try {
      await rm(f, { force: true });
      console.log(`  ✓ removed ${f}`);
    } catch (err) { console.warn(`  ! ${f}: ${err.message}`); }
  }

  try { await rm(join(configDir, MANIFEST), { force: true }); } catch {}
  console.log('\nUninstall complete.');
}

// ── Argv helpers ──────────────────────────────────────────────────────────────
function parseCmd(argv, options) {
  return parseArgs({ args: argv, options, allowPositionals: true, strict: false });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const [sub, ...rest] = process.argv.slice(2);

  if (!sub || sub === '--help' || sub === '-h') { printHelp(); return; }

  const cwd = process.cwd();

  switch (sub) {
    case 'version': {
      await cmdVersion();
      break;
    }

    case 'list':
    case 'ls': {
      const { values } = parseCmd(rest, {
        tool:     { type: 'string',  short: 't' },
        category: { type: 'string',  short: 'c' },
        quiet:    { type: 'boolean', short: 'q' },
        optional: { type: 'boolean' },
        all:      { type: 'boolean' },
      });
      await cmdList({
        toolFlag: values.tool, cwd,
        category: values.category,
        quiet:    !!values.quiet,
        optionalOnly: !!values.optional,
        all:      !!values.all,
      });
      break;
    }

    case 'pathcheck': {
      const { values } = parseCmd(rest, { tool: { type: 'string', short: 't' } });
      await cmdPathcheck({ toolFlag: values.tool, cwd });
      break;
    }

    case 'generate':
    case 'gen':
    case 'g': {
      const { values, positionals } = parseCmd(rest, {
        tool:             { type: 'string',  short: 't' },
        all:              { type: 'boolean', short: 'a' },
        force:            { type: 'boolean', short: 'f' },
        output:           { type: 'string',  short: 'o' },
        'allow-implicit': { type: 'boolean' },
      });
      const targetCwd = values.output ? resolve(values.output) : cwd;
      const toolId = await resolveTool(values.tool, targetCwd, !values.all && !positionals[0]);
      if (!toolId) { console.error('No tool detected. Use --tool <id>.'); process.exit(1); }
      await runGenerate({
        toolId,
        cwd:          targetCwd,
        all:          !!values.all,
        coreOnly:     false,
        templateName: positionals[0] || null,
        force:        !!values.force,
        allowImplicit: !!values['allow-implicit'],
      });
      break;
    }

    case 'init': {
      const { values } = parseCmd(rest, {
        tool:  { type: 'string',  short: 't' },
        all:   { type: 'boolean', short: 'a' },
        force: { type: 'boolean', short: 'f' },
      });
      await cmdInit({ toolFlag: values.tool, cwd, all: !!values.all, force: !!values.force });
      break;
    }

    case 'uninstall': {
      const { values } = parseCmd(rest, {
        tool:      { type: 'string',  short: 't' },
        force:     { type: 'boolean', short: 'f' },
        'dry-run': { type: 'boolean' },
      });
      await cmdUninstall({
        toolFlag: values.tool, cwd,
        force:   !!values.force,
        dryRun:  !!values['dry-run'],
      });
      break;
    }

    default:
      console.error(`Unknown subcommand: ${sub}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
openspdd-ts — SPDD template installer for AI editors
Zero-dependency Node 20+ CLI. Mirrors gszhangwei/open-spdd in TypeScript.

Usage:
  node openspdd.mjs <command> [options]

Commands:
  version                                    Print version
  init   [--tool <id>] [--all] [--force]     Install core templates (--all for all)
  generate [<name>] [--all] [--tool <id>]
           [--force] [--output <dir>]
           [--allow-implicit]                Copy template(s) to editor config dir
  list   [--tool <id>] [--category <c>]
         [--optional] [--all] [--quiet]      List available templates
  uninstall [--tool <id>] [--force]
            [--dry-run]                      Remove installed templates
  pathcheck [--tool <id>]                    Show detected tool and config paths

Tool IDs: ${TOOL_ORDER.join(', ')}

Examples:
  node openspdd.mjs init --tool cursor
  node openspdd.mjs generate --all --tool github-copilot
  node openspdd.mjs generate spdd-story --tool claude-code --force
  node openspdd.mjs list
  node openspdd.mjs uninstall --tool codex --force
`);
}

main().catch(err => { console.error(err.message || String(err)); process.exit(1); });
