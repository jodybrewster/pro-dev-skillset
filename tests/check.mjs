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
import { spawnSync } from "node:child_process";

import { runGitSafeCases } from "./git-safe.mjs";
import { runMemoryHookCases } from "./memory-hooks.mjs";

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
const COMMANDS = new Set(["code-review", "simplify", "qa-engine", "design-engine", "lavish-engine", "validate", "document", "api-docs", "design-skills", "critique-screen", "taste-skills"]);
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
      if (p.name === "pro-starter") continue; // Claude dependency aggregator; Codex installs concrete plugins.
      const entry = entries.get(p.name);
      if (!entry) failures.push(`${p.name}: missing from .agents/plugins/marketplace.json`);
      else if (entry.source?.path !== `./plugins/${p.name}`)
        failures.push(`${p.name}: Codex marketplace path should be ./plugins/${p.name}`);
    }
  }

  for (const p of m.plugins) {
    if (p.name === "pro-starter") continue;
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
  // inverse drift: shipped non-gstack skills that the router never mentions
  for (const p of m.plugins) {
    // skip plugins the router references by family/abbreviation, not exact slug
    if (["pro-gstack", "pro-starter", "pro-nextjs",
         "pro-data", "pro-design", "pro-spdd", "pro-research"].includes(p.name)) continue;
    for (const s of p.skills) {
      if (s.slug === "using-pro-dev") continue;
      if (!text.includes(s.slug)) warnings.push(`router never mentions shipped skill ${p.name}/${s.slug}`);
    }
  }
  return { failures, warnings };
};

// pro-starter dependency integrity: all same-marketplace deps resolve, all
// default-stack plugins are covered (opt-in plugins are explicitly excluded)
checks["pro-starter"] = (m) => {
  const failures = [], warnings = [];
  const starter = m.plugins.find((p) => p.name === "pro-starter");
  if (!starter?.manifest) {
    failures.push("pro-starter: missing .claude-plugin/plugin.json");
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
      failures.push(`pro-starter: dependency "${name}" not found in marketplace`);
  }
  // opt-in plugins are intentionally excluded from the default stack
  const OPT_IN = new Set(["pro-spdd", "pro-gstack", "pro-starter"]);
  for (const p of m.plugins) {
    if (OPT_IN.has(p.name)) continue;
    if (!sameMktDeps.has(p.name))
      warnings.push(`pro-starter: "${p.name}" is in the marketplace but not in pro-starter dependencies`);
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

// eval coverage: a shipped skill or subagent with no routing case is untested
// routing. Twice now, a feature landed with a green board because nothing
// asserted it was reachable. Warning-level — not every skill earns a case —
// but the gap should be visible rather than silent.
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
  // gstack is its own upstream suite and is excluded from the eval catalog
  for (const p of m.plugins) {
    if (p.name === "pro-gstack") continue;
    for (const s of p.skills)
      if (!covered.has(s.slug)) warnings.push(`no routing eval case expects skill ${p.name}/${s.slug}`);
    for (const a of p.agents ?? [])
      if (!covered.has(a.slug)) warnings.push(`no routing eval case expects subagent ${p.name}/${a.slug}`);
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
  const bridges = [
    "qa-suite", "impeccable-bridge", "lavish", "taste-skills-bridge",
    "web-design-engineer-bridge", "tastemaker-bridge", "mengto-skills-bridge",
  ];
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
