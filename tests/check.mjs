#!/usr/bin/env node
// Static checks for the pro-dev-skillset marketplace.
// Zero dependencies — runs on any Node >= 18. Deterministic, no API key.
//
//   node tests/check.mjs            # run all checks
//   node tests/check.mjs versions   # run one check by name
//
// Exit 0 = all checks pass (warnings allowed). Exit 1 = at least one failure.
// This is the same gate CI runs; it also ships (in spirit) as /pro-dev-doctor
// for the installed marketplace. See tests/README.md.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS_DIR = join(ROOT, "plugins");

// ── allowlists for the router-resolve check ────────────────────────────────
// Skills the router intentionally names but that are NOT installed yet
// (roadmap / integration-doc phases). Listed so router drift fails loudly
// while planned references stay green. Trim as each lands.
const PLANNED = new Set([
  "api-and-interface-design", "source-driven-development",
  "context-engineering", "doubt-driven-development",
  "frontend-ui-engineering", "code-simplification",
  "performance-optimization", "security-and-hardening",
  "ci-cd-and-automation", "shipping-and-launch",
  "documentation-and-adrs", "deprecation-and-migration",
]);
// Engines/skills that live OUTSIDE this marketplace, reached via a bridge.
const EXTERNAL = new Set([
  "qa-do", "qa-start", "playwright-automation", "visual-testing", "impeccable",
  "lavish-axi",
]);
// Built-in or shipped slash commands the router references with a leading /.
const COMMANDS = new Set(["code-review", "simplify", "qa-engine", "design-engine", "lavish-engine"]);
// Wikilink targets that resolve outside the skill set (bridged routers).
const EXTERNAL_WIKILINKS = new Set(["qa-do", "qa-start"]);
// Frontmatter keys that break Codex / Agent Skills parity.
const FORBIDDEN_FM_KEYS = new Set(["harness", "claude_code", "claude-code"]);

// ── tiny helpers ────────────────────────────────────────────────────────────
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const listDirs = (p) => (isDir(p) ? readdirSync(p).filter((d) => isDir(join(p, d))) : []);
const rel = (p) => relative(ROOT, p);

function parseFrontmatter(text) {
  // Minimal YAML frontmatter: a leading `---` block of `key: value` lines.
  if (!text.startsWith("---")) return { keys: [], data: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { keys: [], data: {}, body: text };
  const block = text.slice(3, end).replace(/^\n/, "");
  const body = text.slice(end + 4);
  const data = {};
  const keys = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (m) {
      const val = m[2].replace(/^["']|["']$/g, ""); // strip surrounding quotes
      keys.push(m[1]); data[m[1]] = val;
    }
  }
  return { keys, data, body };
}

function readJSON(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

// caret-only semver satisfaction (the only operator used in plugin.json deps)
function satisfiesCaret(version, range) {
  const want = range.replace(/^[\^~]/, "").split(".").map(Number);
  const have = version.split(".").map(Number);
  if (range.startsWith("^")) {
    if (want[0] > 0) return have[0] === want[0] && cmp(have, want) >= 0;
    if (want[1] > 0) return have[0] === 0 && have[1] === want[1] && cmp(have, want) >= 0;
    return have[0] === 0 && have[1] === 0 && have[2] === (want[2] | 0);
  }
  return cmp(have, want) >= 0;
}
const cmp = (a, b) => {
  for (let i = 0; i < 3; i++) { if ((a[i] | 0) !== (b[i] | 0)) return (a[i] | 0) - (b[i] | 0); }
  return 0;
};

// ── shared repo model, built once ───────────────────────────────────────────
function loadModel() {
  const marketplace = readJSON(join(ROOT, ".claude-plugin", "marketplace.json"));
  const mpByName = new Map(marketplace.plugins.map((p) => [p.name, p]));
  const plugins = [];
  const skillSlugs = new Set();
  for (const name of listDirs(PLUGINS_DIR)) {
    const dir = join(PLUGINS_DIR, name);
    const manifestPath = join(dir, ".claude-plugin", "plugin.json");
    const manifest = existsSync(manifestPath) ? readJSON(manifestPath) : null;
    const skills = [];
    for (const slug of listDirs(join(dir, "skills"))) {
      const skillMd = join(dir, "skills", slug, "SKILL.md");
      if (existsSync(skillMd)) {
        skills.push({ slug, plugin: name, path: skillMd });
        skillSlugs.add(slug);
      }
    }
    plugins.push({ name, dir, manifestPath, manifest, skills });
  }
  return { marketplace, mpByName, plugins, skillSlugs };
}

// ── checks ──────────────────────────────────────────────────────────────────
// Each check(model) -> { failures: string[], warnings: string[] }
const checks = {};

// version-bump law, mechanized: plugin.json == marketplace entry, deps satisfiable
checks.versions = (m) => {
  const failures = [], warnings = [];
  if (!m.marketplace.metadata?.version) failures.push("marketplace.json missing metadata.version");
  const versionByName = new Map();
  for (const p of m.plugins) {
    if (!p.manifest) { failures.push(`${p.name}: missing .claude-plugin/plugin.json`); continue; }
    versionByName.set(p.name, p.manifest.version);
    if (p.manifest.name !== p.name)
      failures.push(`${p.name}: plugin.json name "${p.manifest.name}" != dir name`);
    const entry = m.mpByName.get(p.name);
    if (!entry) { failures.push(`${p.name}: absent from marketplace.json plugins[]`); continue; }
    if (entry.version !== p.manifest.version)
      failures.push(`${p.name}: marketplace.json says ${entry.version} but plugin.json says ${p.manifest.version} (version-bump law)`);
  }
  // dependency constraints within this marketplace
  for (const p of m.plugins) {
    for (const dep of p.manifest?.dependencies ?? []) {
      if (typeof dep !== "string") continue; // object-form = cross-marketplace, skip
      const mt = dep.match(/^([^@]+)@([^@]+)@(.+)$/);
      if (!mt) { warnings.push(`${p.name}: unparseable dependency "${dep}"`); continue; }
      const [, depName, mkt, range] = mt;
      if (mkt !== "pro-dev-skillset") continue;
      const have = versionByName.get(depName);
      if (!have) { failures.push(`${p.name}: depends on ${depName} which is not in this marketplace`); continue; }
      if (!satisfiesCaret(have, range))
        failures.push(`${p.name}: dependency ${depName}@${range} not satisfied by installed ${have}`);
    }
  }
  return { failures, warnings };
};

// every SKILL.md has name+description, no forbidden keys, name matches dir
checks.frontmatter = (m) => {
  const failures = [], warnings = [];
  for (const p of m.plugins) for (const s of p.skills) {
    const { keys, data } = parseFrontmatter(readFileSync(s.path, "utf8"));
    if (!data.name) failures.push(`${rel(s.path)}: frontmatter missing 'name'`);
    if (!data.description) failures.push(`${rel(s.path)}: frontmatter missing 'description'`);
    if (data.name && data.name !== s.slug)
      warnings.push(`${rel(s.path)}: frontmatter name "${data.name}" != dir "${s.slug}"`);
    for (const k of keys)
      if (FORBIDDEN_FM_KEYS.has(k))
        failures.push(`${rel(s.path)}: forbidden frontmatter key '${k}' (breaks Codex parity)`);
  }
  return { failures, warnings };
};

// Codex parity: flag Claude-Code-only tool names hard-coded in skill bodies
checks["codex-parity"] = (m) => {
  const failures = [], warnings = [];
  // Unambiguous Claude-Code-only tool names. `Task tool` is intentionally
  // omitted: skills correctly say "dispatch a subagent (in Claude Code, the
  // Task tool; in <other>, …)", which is the harness-neutral phrasing we want.
  const patterns = [/\bTodoWrite\b/, /\bTaskCreate\b/, /\bTaskUpdate\b/];
  for (const p of m.plugins) for (const s of p.skills) {
    const { body } = parseFrontmatter(readFileSync(s.path, "utf8"));
    body.split("\n").forEach((line, i) => {
      for (const re of patterns)
        if (re.test(line))
          warnings.push(`${rel(s.path)}:${i + 1}: harness-specific term — ${line.trim().slice(0, 70)}`);
    });
  }
  return { failures, warnings };
};

// every @sidecar / relative .md link referenced by a SKILL.md exists on disk
checks.references = (m) => {
  const failures = [], warnings = [];
  for (const p of m.plugins) for (const s of p.skills) {
    const body = readFileSync(s.path, "utf8");
    const skillDir = dirname(s.path);
    const refs = new Set();
    for (const mt of body.matchAll(/@([\w./-]+\.md)\b/g)) refs.add(mt[1]);
    for (const mt of body.matchAll(/\]\((\.{0,2}\/?[\w./-]+\.md)(?:#[\w-]+)?\)/g)) {
      if (!/^https?:/.test(mt[1])) refs.add(mt[1]);
    }
    for (const r of refs) {
      if (existsSync(resolve(skillDir, r))) continue;
      if (existsSync(resolve(ROOT, r))) continue; // repo-root relative
      failures.push(`${rel(s.path)}: references missing file '${r}'`);
    }
  }
  return { failures, warnings };
};

// [[wikilinks]] resolve to a real skill slug or a known external bridge target
checks.wikilinks = (m) => {
  const failures = [], warnings = [];
  for (const p of m.plugins) for (const s of p.skills) {
    const body = readFileSync(s.path, "utf8");
    for (const mt of body.matchAll(/\[\[([a-z0-9-]+)\]\]/g)) {
      const target = mt[1];
      if (m.skillSlugs.has(target) || EXTERNAL_WIKILINKS.has(target)) continue;
      failures.push(`${rel(s.path)}: wikilink [[${target}]] resolves to no skill`);
    }
  }
  return { failures, warnings };
};

// router drift: every hyphenated slug in using-pro-dev's fenced router block
// resolves to a real skill, a planned/external/command allowlist, or a -lead alias
checks.router = (m) => {
  const failures = [], warnings = [];
  const router = m.plugins.flatMap((p) => p.skills).find((s) => s.slug === "using-pro-dev");
  if (!router) { failures.push("using-pro-dev skill not found"); return { failures, warnings }; }
  const text = readFileSync(router.path, "utf8");
  const fence = text.match(/```([\s\S]*?)```/);
  if (!fence) { failures.push("using-pro-dev has no fenced router block"); return { failures, warnings }; }
  // route targets are the first slug after each → arrow (ignore prose to the
  // left of arrows and pipeline abbreviations inside parentheticals)
  const tokens = new Set();
  // drop (parenthetical) tags first — they hold plugin names and the SPDD
  // pipeline abbreviations (story→…→sync), not route targets
  const routerBody = fence[1].replace(/\([^)]*\)/g, "");
  for (const mt of routerBody.matchAll(/→\s*\/?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g)) tokens.add(mt[1]);
  for (const t of tokens) {
    if (t.startsWith("pro-")) continue;                  // plugin names
    if (!t.includes("-") && !m.skillSlugs.has(t)) continue; // bare prose word (pure/open)
    if (m.skillSlugs.has(t)) continue;                   // real skill
    if (m.skillSlugs.has(`${t}-lead`)) continue;         // spdd-* family alias
    if (PLANNED.has(t) || EXTERNAL.has(t) || COMMANDS.has(t)) continue;
    failures.push(`router references "${t}" — not a skill, planned, external, or command (drift?)`);
  }
  // inverse drift: shipped non-gstack skills that the router never mentions
  for (const p of m.plugins) {
    // skip plugins the router references by family/abbreviation, not exact slug
    if (["pro-gstack", "pro-mieruka", "pro-starter", "pro-nextjs",
         "pro-data", "pro-design", "pro-spdd", "pro-research"].includes(p.name)) continue;
    for (const s of p.skills) {
      if (s.slug === "using-pro-dev") continue;
      if (!text.includes(s.slug)) warnings.push(`router never mentions shipped skill ${p.name}/${s.slug}`);
    }
  }
  return { failures, warnings };
};

// bridge skills name an install command that must exist as a command file
checks.bridges = (m) => {
  const failures = [], warnings = [];
  const commandFiles = new Set();
  for (const p of m.plugins)
    for (const f of (isDir(join(p.dir, "commands")) ? readdirSync(join(p.dir, "commands")) : []))
      if (f.endsWith(".md")) commandFiles.add(f.replace(/\.md$/, ""));
  const bridges = ["qa-suite", "ui-ux-pro-max", "lavish"];
  for (const p of m.plugins) for (const s of p.skills) {
    if (!bridges.includes(s.slug)) continue;
    const body = readFileSync(s.path, "utf8");
    const cmds = [...body.matchAll(/\/([a-z][a-z0-9-]+)\b/g)].map((x) => x[1]);
    const named = cmds.find((c) => commandFiles.has(c));
    if (!named) warnings.push(`bridge ${p.name}/${s.slug}: no install command found among ${[...new Set(cmds)].join(", ") || "(none)"}`);
  }
  return { failures, warnings };
};

// ── runner ──────────────────────────────────────────────────────────────────
const only = process.argv[2];
const model = loadModel();
const names = only ? [only] : Object.keys(checks);
let failed = 0, warned = 0;

for (const name of names) {
  const check = checks[name];
  if (!check) { console.error(`unknown check '${name}'. available: ${Object.keys(checks).join(", ")}`); process.exit(2); }
  const { failures, warnings } = check(model);
  failed += failures.length; warned += warnings.length;
  const status = failures.length ? "FAIL" : "pass";
  const icon = failures.length ? "✗" : "✓";
  console.log(`${icon} ${name.padEnd(14)} ${status}${warnings.length ? `  (${warnings.length} warn)` : ""}`);
  for (const f of failures) console.log(`    ✗ ${f}`);
  for (const w of warnings) console.log(`    ! ${w}`);
}

console.log(`\n${failed ? "✗" : "✓"} ${names.length} checks · ${failed} failures · ${warned} warnings`);
process.exit(failed ? 1 : 0);
