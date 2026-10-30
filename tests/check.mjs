#!/usr/bin/env node
// Static checks for the pro-dev-skillset marketplace.
// Zero dependencies — runs on any Node >= 18. Deterministic, no API key.
//
//   node tests/check.mjs            # run all checks
//   node tests/check.mjs versions   # run one check by name
//
// Exit 0 = all checks pass (warnings allowed). Exit 1 = at least one failure.
// This is the same gate CI runs; it also ships (in spirit) as /pro-dev check
// for the installed marketplace. See tests/README.md.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { runGitSafeCases } from "./git-safe.mjs";
import { runSecurityHookCases } from "./security-hooks.mjs";
import { runSdlcHookCases } from "./sdlc-hooks.mjs";
import { runExecuteCases } from "./execute.mjs";
import { runQualityHookCases } from "./quality-hooks.mjs";
import { runLegalHookCases } from "./legal-hooks.mjs";
import { runMemoryHookCases } from "./memory-hooks.mjs";
import { runDocHookCases } from "./doc-hooks.mjs";
import { runProDevCases } from "./pro-dev.mjs";
import { runGoldfishCases } from "./goldfish.mjs";
import { spawnSync } from "node:child_process";
import { coverageProblems } from "./lib/coverage.mjs";
import { WORKFLOW_PLUGINS, listComponents, listCaseTags, coverageDiff } from "./lib/components.mjs";

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
  "web-design-engineer", "tastemaker", "ideagram", "video-to-superprompt",
]);
// Built-in or shipped slash commands the router references with a leading /.
// Claude-only dependency aggregators: pro-dev-starter, and the one-release pro-starter shim that depends on it.
// Bridge skills: each routes to an engine installed outside the marketplace.
const BRIDGES = [
  "qa-suite", "impeccable-bridge", "lavish", "taste-skills-bridge",
  "web-design-engineer-bridge", "tastemaker-bridge", "mengto-skills-bridge",
  "next-skills-bridge", "egm-bridge", "spec-kit-bridge",
  "vercel-skills-bridge", "vercel-deploy-bridge", "react-patterns-bridge",
];
const CLAUDE_ONLY_AGGREGATORS = new Set(["pro-starter", "pro-dev-starter"]);
const COMMANDS = new Set(["code-review", "simplify", "pro-dev", "validate", "document", "api-docs", "critique-screen", "security-audit", "security-review", "threat-model"]);
// Wikilink targets that resolve outside the skill set (bridged routers).
const EXTERNAL_WIKILINKS = new Set(["qa-do", "qa-start"]);
// Frontmatter keys guaranteed portable by Codex / Agent Skills.
const PORTABLE_SKILL_FM_KEYS = new Set(["name", "description", "tags", "tools", "model"]);

// ── tiny helpers ────────────────────────────────────────────────────────────
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const listDirs = (p) => (isDir(p) ? readdirSync(p).filter((d) => isDir(join(p, d))) : []);
const rel = (p) => relative(ROOT, p);

function walkFiles(dir, predicate = () => true, acc = []) {
  if (!isDir(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const r = rel(p);
    if (r.includes("/upstream/") || r.includes("/__pycache__/")) continue;
    if (statSync(p).isDirectory()) walkFiles(p, predicate, acc);
    else if (predicate(p)) acc.push(p);
  }
  return acc;
}

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
  const agentSlugs = new Set();
  for (const name of listDirs(PLUGINS_DIR)) {
    const dir = join(PLUGINS_DIR, name);
    const manifestPath = join(dir, ".claude-plugin", "plugin.json");
    const codexManifestPath = join(dir, ".codex-plugin", "plugin.json");
    const manifest = existsSync(manifestPath) ? readJSON(manifestPath) : null;
    const codexManifest = existsSync(codexManifestPath) ? readJSON(codexManifestPath) : null;
    const skills = [];
    for (const slug of listDirs(join(dir, "skills"))) {
      const skillMd = join(dir, "skills", slug, "SKILL.md");
      if (existsSync(skillMd)) {
        skills.push({ slug, plugin: name, path: skillMd });
        skillSlugs.add(slug);
      }
    }
    const agents = [];
    const agentsDir = join(dir, "agents");
    if (isDir(agentsDir)) {
      for (const f of readdirSync(agentsDir)) {
        if (!f.endsWith(".md")) continue;
        const slug = f.replace(/\.md$/, "");
        agents.push({ slug, plugin: name, path: join(agentsDir, f) });
        agentSlugs.add(slug);
      }
    }
    plugins.push({ name, dir, manifestPath, manifest, codexManifestPath, codexManifest, skills, agents });
  }
  return { marketplace, mpByName, plugins, skillSlugs, agentSlugs };
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
  // Cross-marketplace deps must not use a "*" constraint.
  //
  // When an upstream plugin.json omits `version`, Claude Code falls back to the
  // marketplace's git commit SHA as the plugin's version string. The dependency
  // resolver cannot match a SHA against any range - "*" included - so the
  // dependent plugin fails to load with "Requires <dep> *, installed version
  // unknown" even though the dependency is installed and enabled. This bit
  // pro-execution and pro-starter via worktrunk@worktrunk.
  //
  // Install cross-marketplace companions explicitly from
  // templates/install-companions.sh instead of declaring a hard dependency.
  for (const p of m.plugins) {
    for (const dep of p.manifest?.dependencies ?? []) {
      if (typeof dep !== "object" || !dep.marketplace) continue;
      if (dep.marketplace === "pro-dev-skillset") continue;
      if (dep.version === "*" || dep.version == null)
        failures.push(
          `${p.name}: cross-marketplace dependency ${dep.name}@${dep.marketplace} uses a "*" constraint - ` +
          `it resolves to "unknown" and blocks plugin load. Install it via templates/install-companions.sh instead.`
        );
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
      if (!PORTABLE_SKILL_FM_KEYS.has(k))
        failures.push(`${rel(s.path)}: non-portable frontmatter key '${k}' (Codex skill frontmatter should stay portable)`);
  }
  return { failures, warnings };
};

// Codex parity: flag Claude-Code-only terms across the plugin surface, not just SKILL.md bodies.
checks["codex-parity"] = (m) => {
  const failures = [], warnings = [];
  const hardPatterns = [/\bTodoWrite\b/, /\bTaskCreate\b/, /\bTaskUpdate\b/];
  const softPatterns = [
    { re: /\bTask tool\b/, note: "mention Codex/fresh-agent fallback when naming Claude Code's Task tool" },
    { re: /\bmcp__[A-Za-z0-9_]+\b/, note: "keep MCP tool names in adapter/fallback prose, never as a required path" },
  ];
  const files = m.plugins.flatMap((p) =>
    walkFiles(p.dir, (f) => /\.md$/.test(f))
  );
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    text.split("\n").forEach((line, i) => {
      for (const re of hardPatterns)
        if (re.test(line))
          failures.push(`${rel(file)}:${i + 1}: Claude-Code-only tool name — ${line.trim().slice(0, 90)}`);
      for (const { re, note } of softPatterns) {
        if (!re.test(line)) continue;
        const hasFallback =
          /Codex|harness|fallback|adapter|unavailable|optional|if .*available|when .*available/i.test(line);
        if (!hasFallback)
          warnings.push(`${rel(file)}:${i + 1}: harness-specific surface (${note}) — ${line.trim().slice(0, 90)}`);
      }
    });
  }
  return { failures, warnings };
};

checks["codex-manifests"] = (m) => {
  const failures = [], warnings = [];
  const codexMarketplacePath = join(ROOT, ".agents", "plugins", "marketplace.json");
  if (!existsSync(codexMarketplacePath)) {
    failures.push(".agents/plugins/marketplace.json missing (Codex marketplace)");
  } else {
    const codexMarketplace = readJSON(codexMarketplacePath);
    const entries = new Map((codexMarketplace.plugins ?? []).map((p) => [p.name, p]));
    for (const p of m.plugins) {
      if (CLAUDE_ONLY_AGGREGATORS.has(p.name)) continue; // Claude dependency aggregators; Codex installs concrete plugins.
      const entry = entries.get(p.name);
      if (!entry) failures.push(`${p.name}: missing from .agents/plugins/marketplace.json`);
      else if (entry.source?.path !== `./plugins/${p.name}`)
        failures.push(`${p.name}: Codex marketplace path should be ./plugins/${p.name}`);
    }
  }

  for (const p of m.plugins) {
    if (CLAUDE_ONLY_AGGREGATORS.has(p.name)) continue;
    if (!p.codexManifest) {
      failures.push(`${p.name}: missing .codex-plugin/plugin.json`);
      continue;
    }
    if (p.codexManifest.name !== p.manifest?.name)
      failures.push(`${p.name}: Codex manifest name differs from Claude manifest`);
    if (p.codexManifest.version !== p.manifest?.version)
      failures.push(`${p.name}: Codex manifest version ${p.codexManifest.version} differs from Claude manifest ${p.manifest?.version}`);
    if (!p.codexManifest.skills && p.skills.length)
      failures.push(`${p.name}: Codex manifest missing skills path`);
    if (p.codexManifest.skills && p.codexManifest.skills !== "./skills/")
      warnings.push(`${p.name}: Codex manifest skills path is ${p.codexManifest.skills}, expected ./skills/`);
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
    if (m.agentSlugs.has(t)) continue;                   // real subagent
    if (m.skillSlugs.has(`${t}-lead`)) continue;         // spdd-* family alias
    if (PLANNED.has(t) || EXTERNAL.has(t) || COMMANDS.has(t)) continue;
    failures.push(`router references "${t}" — not a skill, planned, external, or command (drift?)`);
  }
  // inverse drift: shipped skills that the router never mentions
  for (const p of m.plugins) {
    // skip plugins the router references by family/abbreviation, not exact slug
    if (["pro-starter", "pro-dev-starter", "pro-nextjs", "pro-astro",
         "pro-data", "pro-design", "pro-spdd", "pro-research"].includes(p.name)) continue;
    for (const s of p.skills) {
      if (s.slug === "using-pro-dev") continue;
      if (!text.includes(s.slug)) warnings.push(`router never mentions shipped skill ${p.name}/${s.slug}`);
    }
  }
  return { failures, warnings };
};

// pro-dev-starter dependency integrity: all same-marketplace deps resolve, all
// default-stack plugins are covered. Stack and method plugins (pro-nextjs,
// pro-astro, pro-spdd, pro-legal) are opt-in; the pro-starter shim and
// pro-dev-starter itself are never listed as their own dependency.
checks["pro-dev-starter"] = (m) => {
  const failures = [], warnings = [];
  const starter = m.plugins.find((p) => p.name === "pro-dev-starter");
  if (!starter?.manifest) {
    failures.push("pro-dev-starter: missing .claude-plugin/plugin.json");
    return { failures, warnings };
  }
  const deps = starter.manifest.dependencies ?? [];
  // same-marketplace deps: object form without a `marketplace` key
  const sameMktDeps = new Set(
    deps.filter((d) => typeof d === "object" && !d.marketplace).map((d) => d.name)
  );
  // every same-marketplace dep must resolve to a real plugin
  for (const name of sameMktDeps) {
    if (!m.mpByName.has(name))
      failures.push(`pro-dev-starter: dependency "${name}" not found in marketplace`);
  }
  // opt-in plugins are intentionally excluded from the default stack
  const OPT_IN = new Set(["pro-nextjs", "pro-astro", "pro-ai-sdlc", "pro-spdd", "pro-egm", "pro-speckit", "pro-ship", "pro-legal", "pro-starter", "pro-dev-starter"]);
  for (const p of m.plugins) {
    if (OPT_IN.has(p.name)) continue;
    if (!sameMktDeps.has(p.name))
      warnings.push(`pro-dev-starter: "${p.name}" is in the marketplace but not in pro-dev-starter dependencies`);
  }
  return { failures, warnings };
};

// Ask git which of these repo-relative paths are tracked, in one batched call.
// `git ls-files -z -- <paths>` prints cwd-relative, NUL-separated, never-quoted
// paths for exactly the tracked subset, so its output compares directly against
// what we pass in. Returns `{ reason }` instead of an answer when git cannot
// answer at all - no git binary, not a repository, or a hung call - so the
// caller can degrade to a warning rather than crash the gate on a question
// nothing in the environment can settle.
function gitTrackedPaths(relPaths) {
  if (!relPaths.length) return { tracked: new Set() };
  const res = spawnSync("git", ["ls-files", "-z", "--", ...relPaths], {
    cwd: ROOT, encoding: "utf8", timeout: 10_000, maxBuffer: 8 << 20,
  });
  if (res.error) {
    const code = res.error.code;
    if (code === "ENOENT") return { reason: "git is not on PATH" };
    if (code === "ETIMEDOUT") return { reason: "git ls-files did not answer within 10s" };
    return { reason: `git ls-files failed (${code ?? res.error.message})` };
  }
  if (res.signal) return { reason: `git ls-files was killed (${res.signal}) after 10s` };
  if (res.status !== 0) {
    const why = String(res.stderr ?? "").split("\n").find((l) => l.trim()) ?? "no stderr";
    return { reason: `git ls-files exited ${res.status}: ${why.trim()}` };
  }
  return { tracked: new Set(res.stdout.split("\0").filter(Boolean)) };
}

// An existing-but-untracked hook script is a normal transient state on a working
// branch - the script was just written and has not been staged yet - so failing
// on it would make this gate red for every in-progress branch. In CI the working
// tree is a fresh checkout that contains tracked files and nothing else, so the
// same finding there means the reference is genuinely unshippable. Hence: warn
// locally, fail in CI. `CI` is set by GitHub Actions (which is what runs this
// gate) and by every other mainstream provider; unset/empty/0/false = local.
const CI_ENV = String(process.env.CI ?? "").trim().toLowerCase();
const IN_CI = CI_ENV !== "" && CI_ENV !== "0" && CI_ENV !== "false";

// hook wiring: Claude Code auto-loads ONLY hooks/hooks.json. Extra hook files
// must be declared in plugin.json "hooks" or they are silently never loaded —
// which is exactly how eight hooks in this repo sat dead. Also verifies every
// ${CLAUDE_PLUGIN_ROOT} script a hook shells out to actually exists *and* is
// tracked by git, because "exists" is only true of the tree you are standing in.
checks.hooks = (m) => {
  const failures = [], warnings = [];
  const referenced = [];   // { cfgPath, script, repoPath } per hook script on disk
  const VALID_EVENTS = new Set([
    "PreToolUse", "PostToolUse", "UserPromptSubmit", "Notification",
    "Stop", "SubagentStop", "SessionStart", "SessionEnd", "PreCompact",
  ]);
  for (const p of m.plugins) {
    const hooksDir = join(p.dir, "hooks");
    const jsonFiles = isDir(hooksDir)
      ? readdirSync(hooksDir).filter((f) => f.endsWith(".json"))
      : [];
    if (!jsonFiles.length) continue;

    // which files does Claude Code actually load?
    const raw = p.manifest?.hooks;
    const declared = new Set(
      (Array.isArray(raw) ? raw : raw ? [raw] : [])
        .filter((h) => typeof h === "string")
        .map((h) => h.replace(/^\.\//, ""))
    );
    const loaded = new Set([...declared]);
    if (jsonFiles.includes("hooks.json")) loaded.add("hooks/hooks.json");

    if (!loaded.size)
      failures.push(`${p.name}: hooks/ has ${jsonFiles.length} config(s) but no hooks/hooks.json and no plugin.json "hooks" entry — none of them ever fire`);

    for (const f of jsonFiles) {
      if (loaded.has(`hooks/${f}`)) continue;
      failures.push(`${p.name}: hooks/${f} is never loaded (only hooks/hooks.json is auto-discovered; declare extras in plugin.json "hooks")`);
    }

    for (const f of jsonFiles) {
      const cfgPath = join(hooksDir, f);
      let cfg;
      try { cfg = readJSON(cfgPath); }
      catch { failures.push(`${rel(cfgPath)}: invalid JSON`); continue; }
      const events = cfg.hooks ?? {};
      if (!Object.keys(events).length)
        failures.push(`${rel(cfgPath)}: no hook events defined under "hooks"`);
      for (const event of Object.keys(events)) {
        if (!VALID_EVENTS.has(event))
          failures.push(`${rel(cfgPath)}: unknown hook event "${event}" (case-sensitive)`);
      }
      // scripts referenced via ${CLAUDE_PLUGIN_ROOT} must be on disk
      for (const mt of JSON.stringify(cfg).matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+\.(?:py|sh|mjs|js))/g)) {
        if (!existsSync(join(p.dir, mt[1]))) {
          failures.push(`${rel(cfgPath)}: references missing script '${mt[1]}'`);
          continue;
        }
        referenced.push({ cfgPath, script: mt[1], repoPath: rel(join(p.dir, mt[1])) });
      }
    }
  }

  // ...and being on disk is not the same as being in the repository. An install
  // resolves ${CLAUDE_PLUGIN_ROOT} against a clone of this marketplace, so a
  // script that only ever lived in someone's working tree is simply absent
  // there: the hook command dies with a Python "can't open file" and exit 2 -
  // which on Stop is Claude Code's *block* code, so every turn-end would loop
  // with that error injected as the instruction.
  const unique = [...new Map(referenced.map((r) => [`${r.cfgPath}::${r.script}`, r])).values()];
  const { tracked, reason } = gitTrackedPaths([...new Set(unique.map((r) => r.repoPath))]);
  if (reason) {
    warnings.push(`hook scripts not checked for git tracking - ${reason}`);
  } else {
    for (const r of unique) {
      if (tracked.has(r.repoPath)) continue;
      const msg = `${rel(r.cfgPath)}: references untracked script '${r.script}' - ${r.repoPath} exists here but is not in git, so an installed copy of this plugin has a hook command with no script to run${IN_CI ? "" : " (git add it before pushing)"}`;
      (IN_CI ? failures : warnings).push(msg);
    }
  }
  return { failures, warnings };
};

// git-safe hook behaviour. The `hooks` check above proves the PreToolUse hook is
// wired into hooks/hooks.json and points at a script that exists; it says nothing
// about whether the script decides correctly. This runs the real git-safe.py once
// per case - the PreToolUse payload on stdin, exit code read back - and asserts
// the block/allow call. Both directions are real defects, so both FAIL: a false
// negative lets an irreversible command through, a false positive wedges the
// session on safe work.
//
// The case table lives in tests/git-safe.mjs (also runnable standalone, with
// --only=<substring>); this imports its runner so the cases exist in one place.
// No python3 / no hook script is a warning-level skip, so a runner without a
// Python interpreter never turns the gate red over a missing dependency.
checks["git-safe"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runGitSafeCases();
  if (skipped) {
    warnings.push(`git-safe hook cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) {
    failures.push("tests/git-safe.mjs produced no cases to run");
    return { failures, warnings };
  }
  for (const r of results) {
    if (r.ok) continue;
    const verb = r.actual === "block" ? "blocked" : "allowed";
    failures.push(
      `git-safe.py ${r.id}: expected ${r.expect}, hook ${verb} it (exit ${r.status}) - command: ${JSON.stringify(r.command)}`
    );
  }
  return { failures, warnings };
};

// pro-security hook behaviour. One push gate (git push, gh pr create) keys off a
// diff classifier, and a gate that fires on benign work gets turned off, so both
// directions FAIL: a miss lets a security-sensitive diff leave the machine
// unreviewed, a false positive nags on benign work or on `git commit`. The case
// table lives in tests/security-hooks.mjs.
checks["security-hooks"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runSecurityHookCases();
  if (skipped) {
    warnings.push(`security hook cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) {
    failures.push("tests/security-hooks.mjs produced no cases to run");
    return { failures, warnings };
  }
  for (const r of results) {
    if (r.ok) continue;
    failures.push(`security hook ${r.id}: expected ${r.expect}, got ${r.actual}${r.reason ? ` - ${r.reason}` : ""}`);
  }
  return { failures, warnings };
};

// pro-legal hook behaviour. Same shape as security-hooks above: the planning
// gates, the ideation nudge and the release gate (tag, release, publish, deploy,
// PR, dependency-manifest commits) key off one classifier, and both directions
// FAIL. A miss ships a license or privacy problem unreviewed, a false positive
// nags on ordinary LLM, hook and subagent work until the hook gets turned off.
// The case table, including the false-positive corpus, lives in tests/legal-hooks.mjs.
checks["legal-hooks"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runLegalHookCases();
  if (skipped) {
    warnings.push(`legal hook cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) {
    failures.push("tests/legal-hooks.mjs produced no cases to run");
    return { failures, warnings };
  }
  for (const r of results) {
    if (r.ok) continue;
    failures.push(`legal hook ${r.id}: expected ${r.expect}, got ${r.actual}${r.reason ? ` - ${r.reason}` : ""}`);
  }
  return { failures, warnings };
};

// pro-legal's legal-landscape.md carries law and platform-policy facts that go
// stale. It must declare `Last verified: YYYY-MM-DD` on a line of its own; a
// missing file, a missing line or a future date fails, and a date more than 90
// days old warns. PRO_LEGAL_LANDSCAPE_FILE points the check at a fixture.
const LANDSCAPE_MAX_AGE_DAYS = 90;
checks["legal-landscape"] = () => {
  const failures = [], warnings = [];
  const file = process.env.PRO_LEGAL_LANDSCAPE_FILE || join(ROOT, "plugins", "pro-legal", "skills", "software-counsel", "legal-landscape.md");
  const shown = process.env.PRO_LEGAL_LANDSCAPE_FILE ? file : rel(file);
  if (!existsSync(file)) {
    failures.push(`${shown}: missing - software-counsel needs a dated legal landscape reference`);
    return { failures, warnings };
  }
  const m = readFileSync(file, "utf8").match(/^Last verified: (\d{4}-\d{2}-\d{2})$/m);
  if (!m) {
    failures.push(`${shown}: no line matching "Last verified: YYYY-MM-DD"`);
    return { failures, warnings };
  }
  const verified = new Date(`${m[1]}T00:00:00Z`);
  if (Number.isNaN(verified.getTime()) || verified.toISOString().slice(0, 10) !== m[1]) {
    failures.push(`${shown}: "Last verified: ${m[1]}" is not a real date`);
    return { failures, warnings };
  }
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const age = Math.floor((today - verified) / 86_400_000);
  if (age < 0) failures.push(`${shown}: "Last verified: ${m[1]}" is in the future`);
  else if (age > LANDSCAPE_MAX_AGE_DAYS) warnings.push(`${shown}: last verified ${m[1]}, ${age} days ago (over ${LANDSCAPE_MAX_AGE_DAYS}) - re-check the laws and platform terms it cites, then bump the date`);
  return { failures, warnings };
};

// memory hook behaviour (pro-core's dream/session-ledger hooks). The `hooks`
// check above proves these hooks are wired into hooks/hooks.json and point at
// scripts that exist on disk; it says nothing about whether those scripts
// decide correctly. This runs the real case table against the actual hook
// scripts - the same payload-in / exit-code-out shape as git-safe above - and
// asserts each expected outcome. It locks down one regression that was
// invisible to every existing check: the daily session ledger lives inside
// the memory directory itself, so if dream-timer.has_memory_content() counted
// the ledger file as memory content, every project would fall due at every
// interval and nudge forever with nothing ever eligible to promote - a
// permanently-firing false positive that no check on file wiring could catch,
// because the ledger file genuinely exists and the hook genuinely runs.
//
// The case table lives in tests/memory-hooks.mjs (also runnable standalone);
// this imports its runner so the cases exist in one place. No python3 / no
// hook scripts is a warning-level skip, so a runner without a Python
// interpreter never turns the gate red over a missing dependency.
checks["memory-hooks"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runMemoryHookCases();
  if (skipped) {
    warnings.push(`memory hook cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) {
    failures.push("tests/memory-hooks.mjs produced no cases to run");
    return { failures, warnings };
  }
  for (const r of results) {
    if (r.ok) continue;
    failures.push(`memory-hooks ${r.id}: ${r.detail}`);
  }
  return { failures, warnings };
};

// pro-quality doc hooks (docs-before-push, docs-to-project): the case table lives
// in tests/doc-hooks.mjs. A missing python3 or git is a warning-level skip.
checks["doc-hooks"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runDocHookCases();
  if (skipped) {
    warnings.push(`doc hook cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) {
    failures.push("tests/doc-hooks.mjs produced no cases to run");
    return { failures, warnings };
  }
  for (const r of results) if (!r.ok) failures.push(`doc-hooks ${r.id}: ${r.detail}`);
  return { failures, warnings };
};

// subagents: frontmatter sanity, name/file agreement, and Codex parity. Claude
// auto-discovers agents/*.md; Codex needs a hand-installed .toml, so a Claude-only
// doc agent silently halves the marketplace's cross-tool promise.
checks.agents = (m) => {
  const failures = [], warnings = [];
  for (const p of m.plugins) {
    for (const a of p.agents ?? []) {
      const { data } = parseFrontmatter(readFileSync(a.path, "utf8"));
      if (!data.name) failures.push(`${rel(a.path)}: frontmatter missing 'name'`);
      if (!data.description) failures.push(`${rel(a.path)}: frontmatter missing 'description'`);
      if (data.name && data.name !== a.slug)
        failures.push(`${rel(a.path)}: frontmatter name "${data.name}" != file "${a.slug}"`);

      const toml = join(p.dir, ".codex-plugin", "agents", `${a.slug}.toml`);
      if (!existsSync(toml)) {
        warnings.push(`${p.name}/${a.slug}: no Codex counterpart at .codex-plugin/agents/${a.slug}.toml`);
        continue;
      }
      const t = readFileSync(toml, "utf8");
      const nameLine = t.match(/^name\s*=\s*"([^"]+)"/m);
      if (!nameLine) failures.push(`${rel(toml)}: missing top-level name = "..."`);
      else if (nameLine[1] !== a.slug)
        failures.push(`${rel(toml)}: name "${nameLine[1]}" != file "${a.slug}"`);
      if (!/^description\s*=/m.test(t)) failures.push(`${rel(toml)}: missing description`);
      if (!/^developer_instructions\s*=/m.test(t))
        failures.push(`${rel(toml)}: missing developer_instructions body`);
    }
  }
  return { failures, warnings };
};

// eval coverage: a shipped skill with no routing case is untested routing. Twice
// now, a feature landed with a green board because nothing asserted it was
// reachable. Skills fail unless listed in tests/cases/uncovered.json, a ratchet
// that can only shrink (a listed skill that gained a case, or vanished, is stale).
// Subagents stay warnings.
checks["eval-coverage"] = (m) => {
  const failures = [], warnings = [];
  const casesPath = join(ROOT, "tests", "cases", "routing.jsonl");
  if (!existsSync(casesPath)) {
    failures.push("tests/cases/routing.jsonl missing");
    return { failures, warnings };
  }
  const covered = new Set();
  for (const line of readFileSync(casesPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let c;
    try { c = JSON.parse(t); }
    catch { failures.push(`routing.jsonl: unparseable case — ${t.slice(0, 70)}`); continue; }
    for (const s of [].concat(c.expect ?? [])) covered.add(s);
  }
  const listPath = join(ROOT, "tests", "cases", "uncovered.json");
  let listed = [];
  if (!existsSync(listPath)) failures.push("tests/cases/uncovered.json missing");
  else {
    try { listed = JSON.parse(readFileSync(listPath, "utf8")); }
    catch (e) { failures.push(`tests/cases/uncovered.json: ${e.message}`); }
  }
  const skills = m.plugins.flatMap((p) => p.skills.map((s) => `${p.name}/${s.slug}`));
  failures.push(...coverageProblems(skills, covered, listed));
  for (const p of m.plugins)
    for (const a of p.agents ?? [])
      if (!covered.has(a.slug)) warnings.push(`no routing eval case expects subagent ${p.name}/${a.slug}`);
  return { failures, warnings };
};

// bridge skills send the person to /pro-dev, which installs their engine from
// the registry in plugins/pro-core/registry/engines.json
checks.bridges = (m) => {
  const failures = [], warnings = [];
  for (const p of m.plugins) for (const s of p.skills) {
    if (!BRIDGES.includes(s.slug)) continue;
    const body = readFileSync(s.path, "utf8");
    if (!/\/pro-dev\b/.test(body))
      failures.push(`bridge ${p.name}/${s.slug}: does not name /pro-dev`);
    if (s.slug === "vercel-deploy-bridge") {
      // this bridge owns its deploy rules; the other bridges do defer to upstream for the work
      if (body.includes("Defer to the upstream skill"))
        failures.push(`bridge ${p.name}/${s.slug}: contains "Defer to the upstream skill"; this bridge owns its rules and must not hand control to upstream`);
      body.split("\n").forEach((line, i) => {
        if (!line.includes("deploy-to-vercel")) return;
        const ok = /skills add\b/.test(line) || /^For `vercel inspect`.*follow the installed `deploy-to-vercel` skill/.test(line) || /^Do not commit `\.claude\/skills\/deploy-to-vercel\/`/.test(line);
        if (!ok) failures.push(`bridge ${p.name}/${s.slug}: line ${i + 1} names deploy-to-vercel outside the result hand-off, an install command or the do-not-commit line`);
      });
    }
  }
  return { failures, warnings };
};

// engine registry: every bridge has a row, every row is well formed and owned by a real plugin
checks.registry = (m) => {
  const failures = [], warnings = [];
  const regPath = join(ROOT, "plugins", "pro-core", "registry", "engines.json");
  if (!existsSync(regPath)) {
    failures.push("plugins/pro-core/registry/engines.json missing");
    return { failures, warnings };
  }
  let reg;
  try { reg = readJSON(regPath); }
  catch (e) { failures.push(`engines.json: unparseable - ${e.message}`); return { failures, warnings }; }
  if (!Number.isInteger(reg.version)) failures.push("engines.json: version must be an integer");
  if (!Array.isArray(reg.engines)) { failures.push("engines.json: engines must be an array"); return { failures, warnings }; }
  const pluginNames = new Set(m.plugins.map((p) => p.name));
  const seen = new Set();
  const covered = new Set();
  const argvOk = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => typeof x === "string");
  for (const row of reg.engines) {
    const id = row?.id;
    if (typeof id !== "string" || !id) { failures.push("engines.json: a row has no string id"); continue; }
    if (seen.has(id)) failures.push(`engines.json: duplicate id "${id}"`);
    seen.add(id);
    if (!pluginNames.has(row.owner)) failures.push(`engines.json ${id}: owner "${row.owner}" is not a plugin in this marketplace`);
    if (!["skills-cli", "npx", "claude-plugin", "uv-tool"].includes(row.kind)) failures.push(`engines.json ${id}: kind "${row.kind}" is not skills-cli, npx, claude-plugin or uv-tool`);
    if (row.kind === "uv-tool") {
      // a uv-tool row is pinned: argv that starts with uv carries --exclude-newer and a --from ending in @<40 hex>
      const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
      for (const k of ["install", "update"]) {
        const a = row[k];
        if (!argvOk(a) || a[0] !== "uv") continue;
        const after = (flag) => { const i = a.indexOf(flag); return i >= 0 ? a[i + 1] : undefined; };
        if (!ISO.test(after("--exclude-newer") ?? "")) failures.push(`engines.json ${id}: ${k} needs --exclude-newer with an ISO timestamp`);
        if (!/@[0-9a-f]{40}$/.test(after("--from") ?? "")) failures.push(`engines.json ${id}: ${k} needs --from ending in @<40 hex commit>`);
      }
      // a row that runs something other than uv writes into the repo and must opt in to the clean-tree gate
      for (const k of ["install", "update"])
        if (argvOk(row[k]) && row[k][0] !== "uv" && row.writesRepo !== true)
          failures.push(`engines.json ${id}: ${k} runs "${row[k][0]}" not uv, so the row needs writesRepo: true`);
    }
    if (row.writesRepo !== undefined && typeof row.writesRepo !== "boolean") failures.push(`engines.json ${id}: writesRepo must be true or false`);
    if (row.pinnedFiles !== undefined) {
      const pf = row.pinnedFiles;
      const goodKey = (x) => typeof x === "string" && !x.startsWith("/") && !x.split("/").includes("..") && !/[\\\x00-\x1f\x7f]/.test(x)
        && ([".claude/skills/speckit-", ".specify/scripts/", ".specify/templates/"].some((g) => x.startsWith(g)) || x === ".specify/workflows/speckit/workflow.yml");
      if (!pf || typeof pf !== "object" || Array.isArray(pf)) failures.push(`engines.json ${id}: pinnedFiles must be an object`);
      else for (const [key, v] of Object.entries(pf)) {
        if (!goodKey(key)) failures.push(`engines.json ${id}: pinnedFiles key "${key}" must be a relative path under .claude/skills/speckit-*, .specify/scripts/ or .specify/templates/, or .specify/workflows/speckit/workflow.yml`);
        if (typeof v !== "string" || !/^[0-9a-f]{64}$/.test(v)) failures.push(`engines.json ${id}: pinnedFiles["${key}"] must be 64 lowercase hex characters`);
      }
    }
    if (row.knownUnpinned !== undefined) {
      const ku = row.knownUnpinned;
      if (!Array.isArray(ku)) failures.push(`engines.json ${id}: knownUnpinned must be an array of repo-relative paths`);
      else for (const x of ku) {
        if (typeof x !== "string" || x.startsWith("/") || x.split("/").includes("..") || /[\\\x00-\x1f\x7f]/.test(x) || !x.startsWith(".specify/"))
          failures.push(`engines.json ${id}: knownUnpinned entry ${JSON.stringify(x)} must be a relative path under .specify/ with no ..`);
        else if (row.pinnedFiles && Object.hasOwn(row.pinnedFiles, x)) failures.push(`engines.json ${id}: knownUnpinned entry "${x}" is also in pinnedFiles`);
      }
    }
    if (row.needs !== undefined) {
      const earlier = reg.engines.slice(0, reg.engines.indexOf(row)).find((r) => r?.id === row.needs);
      if (typeof row.needs !== "string" || !earlier) failures.push(`engines.json ${id}: needs "${row.needs}" must name an earlier row`);
      else if (earlier.owner !== row.owner) failures.push(`engines.json ${id}: needs "${row.needs}" must be a row with the same owner`);
    }
    if (typeof row.default !== "boolean") failures.push(`engines.json ${id}: default must be true or false`);
    if (!row.detect || typeof row.detect !== "object") failures.push(`engines.json ${id}: detect is missing`);
    for (const k of ["install", "update"])
      if (!argvOk(row[k])) failures.push(`engines.json ${id}: ${k} must be an array of strings (no shell string)`);
    if (row.marketplace !== undefined) {
      const mk = row.marketplace;
      if (!mk || typeof mk !== "object" || Array.isArray(mk)) failures.push(`engines.json ${id}: marketplace must be an object`);
      else {
        if (typeof mk.name !== "string" || !mk.name) failures.push(`engines.json ${id}: marketplace.name must be a string`);
        if (typeof mk.source !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(mk.source))
          failures.push(`engines.json ${id}: marketplace.source must look like owner/repo`);
      }
    }
    if (row.gitExclude !== undefined) {
      const ge = row.gitExclude;
      const goodPath = (x) => typeof x === "string" && x.startsWith(".claude/skills/") && x.split("/").slice(2).some(Boolean)
        && !x.split("/").includes("..") && !/[\\\x00-\x1f\x7f]/.test(x);
      if (!Array.isArray(ge) || ge.length === 0 || ge.some((x) => !goodPath(x)))
        failures.push(`engines.json ${id}: gitExclude must be a non-empty array of relative paths under .claude/skills/ (no leading /, no .., no backslash)`);
    }
    if (row.surface !== undefined) {
      const sf = row.surface;
      if (!sf || typeof sf !== "object" || Array.isArray(sf)) failures.push(`engines.json ${id}: surface must be an object`);
      else {
        for (const k of ["agents", "skills"])
          if (!Number.isInteger(sf[k]) || sf[k] < 0) failures.push(`engines.json ${id}: surface.${k} must be a non-negative integer`);
        if (!sf.tools || typeof sf.tools !== "object" || Array.isArray(sf.tools)
          || Object.values(sf.tools).some((v) => !Array.isArray(v) || v.some((t) => typeof t !== "string")))
          failures.push(`engines.json ${id}: surface.tools must map each agent, skill and command path to an array of strings`);
        if (typeof sf.hooksMcpSha256 !== "string" || !/^[0-9a-f]{64}$/.test(sf.hooksMcpSha256))
          failures.push(`engines.json ${id}: surface.hooksMcpSha256 must be 64 hex characters`);
      }
    }
    if (!Array.isArray(row.bridges) || row.bridges.some((b) => typeof b !== "string")) {
      failures.push(`engines.json ${id}: bridges must be an array of skill slugs`);
      continue;
    }
    for (const b of row.bridges) {
      if (!m.skillSlugs.has(b)) failures.push(`engines.json ${id}: bridge "${b}" is not a skill in this marketplace`);
      covered.add(b);
    }
  }
  for (const b of BRIDGES)
    if (m.skillSlugs.has(b) && !covered.has(b)) failures.push(`bridge ${b} has no row in engines.json`);
  return { failures, warnings };
};

// installers: every registry owner ships /<plugin>:install and its own copy of
// scripts/pro-dev-owner.py, and the command stays inside the owner script
const INSTALL_RELAY_SENTENCE = "If that line is not `pro-core <version> at <path>` followed by status JSON, relay the output exactly as printed and stop; never run the fix line, `claude plugin` or any other pro-core script yourself.";
checks.installers = (m) => {
  const failures = [], warnings = [];
  const regPath = join(ROOT, "plugins", "pro-core", "registry", "engines.json");
  let reg;
  try { reg = readJSON(regPath); } catch { return { failures: ["engines.json missing or unparseable (see the registry check)"], warnings }; }
  const rows = Array.isArray(reg.engines) ? reg.engines.filter((r) => r && typeof r.id === "string") : [];
  const owners = [...new Set(rows.map((r) => r.owner).filter((o) => typeof o === "string"))];
  const rowOwner = new Map(rows.map((r) => [r.id, r.owner]));
  const byName = new Map(m.plugins.map((p) => [p.name, p]));
  const allowed = ["status", "answer"].flatMap((verb) => [
    `Bash(python3 \${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev-owner.py ${verb}*)`,
    `Bash(python3 "\${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev-owner.py" ${verb}*)`,
  ]);
  const scripts = [];
  for (const p of m.plugins) {
    const sp = join(p.dir, "scripts", "pro-dev-owner.py");
    if (existsSync(sp)) scripts.push({ plugin: p.name, path: sp, bytes: readFileSync(sp) });
  }
  for (const owner of owners) {
    const p = byName.get(owner);
    if (!p) continue; // the registry check reports an owner that is not a plugin
    const missing = [];
    const cmdPath = join(p.dir, "commands", "install.md");
    if (!existsSync(cmdPath)) missing.push("commands/install.md");
    if (!existsSync(join(p.dir, "scripts", "pro-dev-owner.py"))) missing.push("scripts/pro-dev-owner.py");
    const deps = Array.isArray(p.manifest?.dependencies) ? p.manifest.dependencies : [];
    // a pro-core dependency would re-enable a pro-core the person disabled (Jody, 2026-10-28)
    if (deps.some((d) => d && (d === "pro-core" || d.name === "pro-core")))
      failures.push(`installer ${owner}: declares a pro-core dependency, which re-enables a pro-core the person disabled; the installer checks for pro-core instead`);
    if (missing.length) failures.push(`installer ${owner}: owns registry rows but is missing ${missing.join(", ")}`);
    if (!existsSync(cmdPath)) continue;
    const text = readFileSync(cmdPath, "utf8");
    const head = text.startsWith("---\n") ? text.slice(4).split("\n---\n")[0] : "";
    const body = text.startsWith("---\n") ? text.slice(4).split("\n---\n").slice(1).join("\n---\n") : text;
    const lines = head.split("\n");
    const at = lines.findIndex((l) => /^allowed-tools:\s*$/.test(l));
    const got = [];
    if (at >= 0) {
      for (const l of lines.slice(at + 1)) {
        const mm = l.match(/^\s+-\s+(.*)$/);
        if (!mm) break;
        let v = mm[1].trim();
        if (v.startsWith('"')) { try { v = JSON.parse(v); } catch { /* keep raw */ } }
        else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
        got.push(v);
      }
    }
    if (at < 0 || got.length !== allowed.length || allowed.some((a) => !got.includes(a)))
      failures.push(`installer ${owner}: commands/install.md allowed-tools must be exactly ${allowed.join(" | ")}${got.length ? `; found ${got.join(" | ")}` : ""}`);
    if (/pro-dev\.py/.test(body)) failures.push(`installer ${owner}: commands/install.md names pro-dev.py; it runs only scripts/pro-dev-owner.py`);
    if (/--owner/.test(body)) failures.push(`installer ${owner}: commands/install.md passes --owner; the owner script adds it`);
    if (!body.includes(INSTALL_RELAY_SENTENCE)) failures.push(`installer ${owner}: commands/install.md lacks the relay-and-stop sentence: ${INSTALL_RELAY_SENTENCE}`);
    for (const mm of body.matchAll(/\brun ([A-Za-z0-9][A-Za-z0-9._-]*)/g)) {
      const o = rowOwner.get(mm[1]);
      if (o && o !== owner) failures.push(`installer ${owner}: commands/install.md names "run ${mm[1]}", a row owned by ${o}`);
    }
  }
  const ownerSet = new Set(owners);
  for (const s of scripts)
    if (!ownerSet.has(s.plugin)) failures.push(`installer ${s.plugin}: ships scripts/pro-dev-owner.py but owns no registry row`);
  const ref = scripts.find((s) => s.plugin === "pro-nextjs") ?? scripts[0];
  for (const s of scripts)
    if (s !== ref && !s.bytes.equals(ref.bytes)) failures.push(`installer ${s.plugin}: scripts/pro-dev-owner.py differs from ${ref.plugin}'s copy`);
  return { failures, warnings };
};

// spec-method files: every plugins/*/sdlc-method.json is valid JSON of the shape methods.py reads
checks.methods = () => {
  const failures = [], warnings = [];
  for (const d of readdirSync(PLUGINS_DIR)) {
    const f = join(PLUGINS_DIR, d, "sdlc-method.json");
    if (!existsSync(f)) continue;
    const tag = `${d}/sdlc-method.json`;
    let j;
    try { j = readJSON(f); }
    catch (e) { failures.push(`${tag}: unparseable - ${e.message}`); continue; }
    if (!j || typeof j !== "object" || Array.isArray(j)) { failures.push(`${tag}: must be an object`); continue; }
    if (typeof j.method !== "string" || !j.method) failures.push(`${tag}: method must be a string`);
    if (j.requires !== null && !(typeof j.requires === "string" && /^[^@\s]+@[^@\s]+$/.test(j.requires)))
      failures.push(`${tag}: requires must be null or a name@marketplace string`);
    if (!Array.isArray(j.handoffs)) { failures.push(`${tag}: handoffs must be an array`); continue; }
    j.handoffs.forEach((h, i) => {
      if (!h || typeof h !== "object") { failures.push(`${tag}: handoffs[${i}] must be an object`); return; }
      if (!["intent", "spec", "plan", "review"].includes(h.stage)) failures.push(`${tag}: handoffs[${i}].stage must be intent, spec, plan or review`);
      if (typeof h.when !== "string") failures.push(`${tag}: handoffs[${i}].when must be a string`);
      if (typeof h.offer !== "string" || !h.offer.startsWith("/")) failures.push(`${tag}: handoffs[${i}].offer must be a string starting with /`);
    });
  }
  // behaviour: tests/methods.mjs is a standalone script (non-zero exit on a failed case),
  // so it runs as a child process and its FAIL lines are surfaced.
  const r = spawnSync(process.execPath, [join(ROOT, "tests", "methods.mjs")], { encoding: "utf8" });
  const out = r.stdout ?? "";
  if (/^skipped:/m.test(out)) { warnings.push(`methods cases skipped - ${out.trim()}`); return { failures, warnings }; }
  if (r.status !== 0) {
    const bad = out.split("\n").filter((l) => /FAIL/.test(l));
    if (bad.length) for (const l of bad) failures.push(`methods ${l.trim()}`);
    else failures.push(`tests/methods.mjs exited ${r.status}: ${(r.stderr ?? "").trim().slice(0, 200)}`);
  }
  return { failures, warnings };
};

// pro-egm's scripts/goldfish.py: case table in tests/goldfish.mjs
checks.goldfish = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runGoldfishCases();
  if (skipped) {
    warnings.push(`goldfish cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) {
    failures.push("tests/goldfish.mjs produced no cases to run");
    return { failures, warnings };
  }
  for (const r of results) if (!r.ok) failures.push(`goldfish ${r.id}: ${r.detail}`);
  return { failures, warnings };
};

// Plugin evals (plugins/<p>/evals): the cases `claude plugin eval` runs. Static shape only;
// running them spends tokens and is left to the eval workflow.
checks["evals"] = (m) => {
  const failures = [], warnings = [];
  const unq = (v) => String(v).trim().replace(/^(["'])(.*)\1$/, "$2");
  for (const p of m.plugins) {
    const declared = p.manifest && p.manifest.experimental && p.manifest.experimental.evals;
    const defaultDir = join(p.dir, "evals");
    if (!declared) {
      const cases = isDir(defaultDir) ? listDirs(defaultDir).filter((c) => c !== "results") : [];
      if (cases.length) failures.push(`${p.name}: has evals/ cases but no experimental.evals in .claude-plugin/plugin.json`);
      continue;
    }
    const evalsDir = join(p.dir, String(declared));
    if (!isDir(evalsDir)) { failures.push(`${p.name}: experimental.evals "${declared}" is not a directory`); continue; }
    const cases = listDirs(evalsDir).filter((c) => c !== "results");
    if (!cases.length) warnings.push(`${p.name}: evals directory has no cases`);
    for (const c of cases) {
      const tag = `${p.name}/evals/${c}`;
      const promptPath = join(evalsDir, c, "prompt.md");
      if (!existsSync(promptPath)) { failures.push(`${tag}: missing prompt.md`); continue; }
      const text = readFileSync(promptPath, "utf8");
      const { keys, body } = parseFrontmatter(text);
      if (!keys.length) failures.push(`${tag}: prompt.md has no frontmatter`);
      if (!body.trim()) failures.push(`${tag}: prompt.md has no body`);
      const gdir = join(evalsDir, c, "graders");
      const graders = isDir(gdir) ? readdirSync(gdir).filter((f) => f.endsWith(".md")) : [];
      if (!graders.length) failures.push(`${tag}: no graders/*.md`);
      for (const g of graders) {
        const { data } = parseFrontmatter(readFileSync(join(gdir, g), "utf8"));
        const gt = `${tag}/graders/${g}`;
        const type = data.type && unq(data.type);
        if (!["tool_used", "regex", "llm"].includes(type)) { failures.push(`${gt}: type "${type}" is not tool_used, regex or llm`); continue; }
        const pat = type === "regex" ? data.pattern : type === "tool_used" ? data.input_match : undefined;
        if (type === "regex" && !pat) failures.push(`${gt}: regex grader has no pattern`);
        if (pat) {
          try { new RegExp(unq(pat)); } catch (e) { failures.push(`${gt}: ${type === "regex" ? "pattern" : "input_match"} does not compile (${e.message})`); }
        }
        if (type === "tool_used" && !data.tool) failures.push(`${gt}: tool_used grader has no tool`);
      }
    }
  }
  return { failures, warnings };
};

// Component coverage: every skill, command, agent and hook in the workflow plugins needs
// an eval case tagged for it (prompt.md `tags: [<kind>:<name>]`), unless it is listed with
// a reason in tests/cases/components-uncovered.json. A listed entry that is now covered or
// gone fails, so the list only shrinks.
checks["component-coverage"] = (m) => {
  const failures = [], warnings = [];
  const listPath = join(ROOT, "tests", "cases", "components-uncovered.json");
  let listed = [];
  if (!existsSync(listPath)) failures.push("tests/cases/components-uncovered.json missing");
  else {
    try { listed = JSON.parse(readFileSync(listPath, "utf8")); }
    catch (e) { failures.push(`tests/cases/components-uncovered.json: ${e.message}`); }
  }
  for (const e of listed)
    if (!e || typeof e.id !== "string" || !e.reason) failures.push(`components-uncovered.json: entry needs id and reason - ${JSON.stringify(e)}`);
  const byPlugin = new Map();
  for (const e of listed) {
    const i = String(e && e.id).indexOf("/");
    if (i < 0) { failures.push(`components-uncovered.json: id "${e && e.id}" is not <plugin>/<kind>:<name>`); continue; }
    const pl = e.id.slice(0, i);
    if (!byPlugin.has(pl)) byPlugin.set(pl, []);
    byPlugin.get(pl).push(e.id.slice(i + 1));
  }
  for (const pl of byPlugin.keys())
    if (!WORKFLOW_PLUGINS.includes(pl)) failures.push(`components-uncovered.json: ${pl} is not a workflow plugin`);
  for (const name of WORKFLOW_PLUGINS) {
    const p = m.plugins.find((x) => x.name === name);
    if (!p) { failures.push(`workflow plugin ${name} not found`); continue; }
    const declared = p.manifest && p.manifest.experimental && p.manifest.experimental.evals;
    const { missing, stale } = coverageDiff(
      listComponents(p.dir),
      listCaseTags(p.dir, declared ? String(declared) : "evals"),
      byPlugin.get(name) || []
    );
    for (const c of missing) failures.push(`${name}/${c} has no eval case tagged for it; add a case with tags: [${c}] or list it in tests/cases/components-uncovered.json`);
    for (const c of stale) failures.push(`tests/cases/components-uncovered.json lists ${name}/${c} but it is now covered or no longer exists; remove the stale entry`);
  }
  return { failures, warnings };
};

// pro-core's /pro-dev script and nudge hook: case table in tests/pro-dev.mjs, run
// with a fake claude and npx on PATH and a temp HOME. A missing python3 or git is a
// warning-level skip.
checks["pro-dev"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runProDevCases();
  if (skipped) {
    warnings.push(`pro-dev cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) {
    failures.push("tests/pro-dev.mjs produced no cases to run");
    return { failures, warnings };
  }
  for (const r of results) if (!r.ok) failures.push(`pro-dev ${r.id}: ${r.detail}`);
  return { failures, warnings };
};

// pro-ai-sdlc hook behaviour. protect-tests, plan-sync and production-gate ship in
// warn mode, so a hook that crashes or blocks on a bad payload is the failure to
// catch. The case table lives in tests/sdlc-hooks.mjs.
checks["sdlc-hooks"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runSdlcHookCases();
  if (skipped) {
    warnings.push(`sdlc hook cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) failures.push("tests/sdlc-hooks.mjs produced no cases to run");
  for (const r of results) if (!r.ok) failures.push(`sdlc hook ${r.id}: expected ${r.expect}${r.reason ? ` - ${r.reason}` : ""}`);
  return { failures, warnings };
};

// pro-ai-sdlc /execute scripts. execute-gate.py decides whether a plan may be built
// and copy-env.py moves secrets between checkouts, so a gate that lets a draft
// through or a copy that leaks a value or lands unignored is the failure to catch.
// The case table lives in tests/execute.mjs.
checks["execute-scripts"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runExecuteCases();
  if (skipped) {
    warnings.push(`execute script cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) failures.push("tests/execute.mjs produced no cases to run");
  for (const r of results) if (!r.ok) failures.push(`execute ${r.id}: expected ${r.expect}${r.reason ? ` - ${r.reason}` : ""}`);
  return { failures, warnings };
};

// pro-quality Stop hook behaviour. user-validation.py nudges by default and blocks
// only on request, so a hook that fires outside the repo or crashes on a bad
// payload is the failure to catch. The case table lives in tests/quality-hooks.mjs.
checks["quality-hooks"] = () => {
  const failures = [], warnings = [];
  const { skipped, results } = runQualityHookCases();
  if (skipped) {
    warnings.push(`quality hook cases skipped - ${skipped}`);
    return { failures, warnings };
  }
  if (!results.length) failures.push("tests/quality-hooks.mjs produced no cases to run");
  for (const r of results) if (!r.ok) failures.push(`quality hook ${r.id}: expected ${r.expect}${r.reason ? ` - ${r.reason}` : ""}`);
  return { failures, warnings };
};

// pro-ai-sdlc contract: the whole SDLC works from Claude Code alone, and mieruka
// only reads the plugin. So the templates are plain files at stable paths, each
// stage command reads its template from ${CLAUDE_PLUGIN_ROOT}/templates, and the
// /intent command names every section of the intent template, so a fresh repo with
// only the plugin produces intent/<date>-<slug>/intent.md with all of them.
// (A live run of /intent needs a model; this proves the file contract it follows.)
checks["sdlc-contract"] = () => {
  const failures = [], warnings = [];
  const dir = join(ROOT, "plugins", "pro-ai-sdlc");
  if (!isDir(dir)) return { failures, warnings };
  const read = (p) => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), "utf8") : null);
  for (const t of ["intent.md", "spec.md", "plan.md", "REVIEW.md"])
    if (read(`templates/${t}`) === null) failures.push(`pro-ai-sdlc: templates/${t} missing`);
  const intentT = read("templates/intent.md") ?? "";
  const sections = [...intentT.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  const want = ["Problem", "Proposed outcome", "Affected users and systems", "Constraints", "Out of scope", "Success looks like", "Open questions", "Evidence"];
  for (const w of want) if (!sections.includes(w)) failures.push(`pro-ai-sdlc: templates/intent.md lacks section "${w}"`);
  const fm = intentT.split("---")[1] ?? "";
  for (const k of ["kind:", "risk:", "status:", "source:"]) if (!fm.includes(k)) failures.push(`pro-ai-sdlc: templates/intent.md frontmatter lacks ${k}`);
  const intentC = read("commands/intent.md") ?? "";
  if (!intentC.includes("${CLAUDE_PLUGIN_ROOT}/templates/intent.md")) failures.push("pro-ai-sdlc: /intent does not read templates/intent.md");
  if (!/intent\/<YYYY-MM-DD>-<slug>\/intent\.md/.test(intentC)) failures.push("pro-ai-sdlc: /intent does not name intent/<date>-<slug>/intent.md");
  for (const w of want) if (!intentC.toLowerCase().includes(w.toLowerCase())) failures.push(`pro-ai-sdlc: /intent does not mention section "${w}"`);
  // mieruka parses these anchors out of commands/intent.md; a reword must fail here.
  for (const a of ["Rules for the interview:", "If the idea is empty, ask for it first.", "### 3. Read it back and commit"])
    if (!intentC.split("\n").includes(a)) failures.push(`pro-ai-sdlc: commands/intent.md lost the anchor line "${a}"`);
  const ruleBlock = intentC.split("Rules for the interview:")[1]?.split("If the idea is empty")[0] ?? "";
  if (!ruleBlock.includes("Let the person describe the problem in their own words.")) failures.push("pro-ai-sdlc: commands/intent.md interview rules lost their first rule");
  const wantHeadings = ["## Problem", "## Proposed outcome", "## Affected users and systems", "## Constraints", "## Out of scope", "## Success looks like", "## Open questions", "## Evidence"];
  for (const h of wantHeadings) if (!intentT.split("\n").includes(h)) failures.push(`pro-ai-sdlc: templates/intent.md lost the exact heading line "${h}"`);
  for (const [c, t] of [["spec", "spec.md"], ["plan", "plan.md"], ["review", "REVIEW.md"]])
    if (!(read(`commands/${c}.md`) ?? "").includes(`\${CLAUDE_PLUGIN_ROOT}/templates/${t}`)) failures.push(`pro-ai-sdlc: /${c} does not read templates/${t}`);
  // /execute: the gate and the env copy are scripts, Opus builds, and it never merges.
  const execC = read("commands/execute.md");
  if (execC === null) failures.push("pro-ai-sdlc: commands/execute.md missing");
  else {
    for (const s of ["execute-gate.py", "copy-env.py"]) {
      if (!execC.includes(`\${CLAUDE_PLUGIN_ROOT}/scripts/${s}`)) failures.push(`pro-ai-sdlc: /execute does not run scripts/${s}`);
      if (read(`scripts/${s}`) === null) failures.push(`pro-ai-sdlc: scripts/${s} missing`);
    }
    if (!/^model: opus$/m.test(execC.split("---")[1] ?? "")) failures.push("pro-ai-sdlc: /execute frontmatter lacks model: opus");
    for (const h of ["## Done", "## Departures from plan", "## Order of work", "## Proof of done"])
      if (!execC.includes(h)) failures.push(`pro-ai-sdlc: /execute does not name the plan's ${h} section`);
    if (!execC.split("\n").includes("Never merge, never push to the default branch, never force-push and never pass `--no-verify`."))
      failures.push("pro-ai-sdlc: /execute lost its never-merge line");
  }
  // review policy (R21): the template, the reviewer and its Codex twin, and /pr-babysit carry the convergence rules.
  const revT = read("templates/REVIEW.md") ?? "";
  for (const h of ["What failure looks like here", "Evidence", "Pre-existing", "Rounds"])
    if (!new RegExp(`^#{1,6} ${h}\\s*$`, "m").test(revT)) failures.push(`pro-ai-sdlc: templates/REVIEW.md lacks the heading "${h}"`);
  for (const f of ["agents/reviewer.md", ".codex-plugin/agents/reviewer.toml"]) {
    const body = read(f) ?? "";
    for (const w of ["Pre-existing", "since"]) if (!body.includes(w)) failures.push(`pro-ai-sdlc: ${f} does not name "${w}"`);
  }
  const babyC = read("commands/pr-babysit.md") ?? "";
  if (!babyC.includes("three rounds")) failures.push('pro-ai-sdlc: commands/pr-babysit.md does not say "three rounds"');
  if (/\bfive\b/i.test(babyC)) failures.push('pro-ai-sdlc: commands/pr-babysit.md still says "five"');
  return { failures, warnings };
};

// Review handoff contract (R21, R22): the one template the reviewer is dispatched with
// carries exactly four fields; no field is a place for an author description,
// a summary or earlier findings. The reviewer agent must name the same four fields.
checks["handoff"] = () => {
  const failures = [], warnings = [];
  const want = ["range", "brief", "policy", "risk"];
  const main = "plugins/pro-quality/skills/requesting-code-review/handoff.md";
  if (!existsSync(join(ROOT, main))) failures.push(`${main} missing`);
  const files = new Set(walkFiles(PLUGINS_DIR, (f) => f.endsWith("/handoff.md")).map((f) => relative(ROOT, f)));
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), "utf8");
    const block = text.split(/^## Fields\s*$/m)[1]?.split(/^## /m)[0];
    if (block === undefined) { failures.push(`${f}: no "## Fields" section`); continue; }
    const names = [...block.matchAll(/^- `([^`]+)`:/gm)].map((m) => m[1]);
    if (names.join(",") !== want.join(","))
      failures.push(`${f}: fields are [${names.join(", ")}], expected exactly [${want.join(", ")}]`);
    for (const m of text.matchAll(/\{\s*([A-Za-z_ -]+?)\s*\}/g))
      if (/^(description|summary|findings)$/i.test(m[1])) failures.push(`${f}: placeholder {${m[1]}} is barred`);
  }
  const agent = "plugins/pro-quality/agents/code-reviewer.md";
  if (!existsSync(join(ROOT, agent))) failures.push(`${agent} missing`);
  else {
    const body = readFileSync(join(ROOT, agent), "utf8");
    for (const w of want) if (!body.includes(w)) failures.push(`${agent} does not name the field "${w}"`);
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
