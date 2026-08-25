#!/usr/bin/env node
// Network-dependent smoke test for the external-skill install paths that
// pro-design's bridge skills route to.
//
// A bridge skill is a router, not vendored content: the real engine lives in
// an external repo and is installed on demand with `npx skills add` (the
// vercel-labs/agent-skills CLI). check.mjs proves a bridge names a command
// that exists; it can't prove the command's install actually works. This test
// does: it runs each real install into a fresh temp dir and asserts every
// documented skill lands with valid frontmatter (and, where the skill is
// useless without them, that its sidecar folders came across too).
//
// Targets, one per bridge:
//   Leonxlnx/taste-skill      -> taste-skills-bridge          (13 skills)
//   ConardLi/garden-skills    -> web-design-engineer-bridge   (1 skill)
//   MengTo/Skills             -> mengto-skills-bridge          (1 of 130)
//   codeswithroh/tastemaker   -> tastemaker-bridge             (1 skill + tree)
//
// Opt-in. Needs network + npx. Not part of tests/check.mjs or the PR gate -
// it runs on demand (workflow_dispatch) and on a weekly schedule via
// .github/workflows/bridge-install-smoke.yml.
//
//   node tests/bridge-install-smoke.mjs
//
// Graceful skips (never a failure) when the harness can't run:
//   - `npx` not on PATH                     -> whole run skips, exit 0
//   - a target's install can't reach the    -> that target skips; the run
//     network                                  fails only on real mismatches

import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// ── target table ────────────────────────────────────────────────────────────
// `repo`      - what to hand `skills add` (owner/name or a full URL)
// `args`      - extra flags, typically the -s <name> skill filter
// `expected`  - install names (SKILL.md `name:` frontmatter) that must land as
//               top-level skills under .claude/skills/
// `contents`  - optional per-skill list of paths that must exist inside the
//               installed folder, for skills that are useless without them
const TARGETS = [
  {
    bridge: "taste-skills-bridge",
    repo: "https://github.com/Leonxlnx/taste-skill",
    args: [],
    // The 13 install names the taste-skills-bridge skill documents. Keep in
    // sync with the catalog table in skills/taste-skills-bridge/SKILL.md.
    expected: [
      "design-taste-frontend",
      "design-taste-frontend-v1",
      "gpt-taste",
      "image-to-code",
      "redesign-existing-projects",
      "high-end-visual-design",
      "minimalist-ui",
      "industrial-brutalist-ui",
      "stitch-design-taste",
      "full-output-enforcement",
      "imagegen-frontend-web",
      "imagegen-frontend-mobile",
      "brandkit",
    ],
  },
  {
    bridge: "web-design-engineer-bridge",
    repo: "ConardLi/garden-skills",
    args: ["-s", "web-design-engineer"],
    expected: ["web-design-engineer"],
    contents: {
      "web-design-engineer": ["references", "references/style-recipes", "manifest.json"],
    },
  },
  {
    bridge: "mengto-skills-bridge",
    repo: "MengTo/Skills",
    // MengTo/Skills has no top-level skills/ dir - skills live at
    // agent-skills/<group>/<name>/. The CLI discovers that nested layout
    // without --full-depth, and -s filters on the frontmatter name.
    args: ["-s", "video-to-superprompt"],
    expected: ["video-to-superprompt"],
  },
  {
    bridge: "tastemaker-bridge",
    repo: "codeswithroh/tastemaker",
    // No -s filter and no --full-depth on purpose. At default depth the CLI
    // finds exactly one skill, `tastemaker`, and copies its folder whole -
    // scripts, references, assets, and the nested `ideagram` sub-skill all
    // ride along. `ideagram` therefore does NOT appear as a second top-level
    // install name; --full-depth would split it out, which is not how the
    // upstream expects it to be loaded. Assert the folder contents instead.
    args: [],
    expected: ["tastemaker"],
    contents: {
      tastemaker: [
        "references",
        "scripts",
        "assets",
        "ideagram",
        "ideagram/SKILL.md",
        "scripts/extract_palette.py",
      ],
    },
  },
];

const NETWORK_RE = /ENOTFOUND|ETIMEDOUT|ECONNRESET|network|getaddrinfo|EAI_AGAIN/i;

function skipAll(reason) {
  console.log(`⚬ bridge install smoke skipped - ${reason}`);
  process.exit(0);
}

// ── graceful skip: `npx` not on PATH ────────────────────────────────────────
const npxCheck = spawnSync("npx", ["--version"], { stdio: "ignore" });
if (npxCheck.error) {
  if (npxCheck.error.code === "ENOENT") skipAll("`npx` not found on PATH");
  skipAll(`could not run \`npx --version\` (${npxCheck.error.message})`);
}

// ── run one target in its own throwaway dir ─────────────────────────────────
function runTarget(t) {
  const dir = mkdtempSync(join(tmpdir(), "bridge-install-smoke-"));
  const argv = ["-y", "skills", "add", t.repo, "-a", "claude-code", "-y", ...t.args];
  console.log(`\n── ${t.bridge}\n   npx ${argv.join(" ")}\n   -> ${dir}`);

  const res = spawnSync("npx", argv, {
    cwd: dir,
    encoding: "utf8",
    timeout: 10 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (res.error) {
    rmSync(dir, { recursive: true, force: true });
    if (res.error.code === "ETIMEDOUT")
      return { status: "skip", reason: "install timed out (network too slow / unreachable)" };
    return { status: "skip", reason: `could not run \`npx skills add\` (${res.error.message})` };
  }

  // A non-zero exit with a network-y error message is a skip, not a failure:
  // this test asserts the install SHAPE, not the runner's connectivity.
  const out = `${res.stdout || ""}${res.stderr || ""}`;
  if (res.status !== 0 && NETWORK_RE.test(out)) {
    rmSync(dir, { recursive: true, force: true });
    return { status: "skip", reason: "install could not reach the network" };
  }

  // `skills add` writes to <cwd>/.claude/skills/<install-name>/SKILL.md.
  const skillsRoot = join(dir, ".claude", "skills");
  const installed = new Map(); // install-name -> { hasName, dir }
  if (existsSync(skillsRoot)) {
    for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillDir = join(skillsRoot, entry.name);
      const skillMd = join(skillDir, "SKILL.md");
      if (!existsSync(skillMd)) continue;
      const body = readFileSync(skillMd, "utf8");
      const nameMatch = body.match(/^name:\s*(.+)$/m);
      installed.set(nameMatch ? nameMatch[1].trim() : entry.name, {
        hasName: Boolean(nameMatch),
        dir: skillDir,
      });
    }
  }

  if (installed.size === 0) {
    const tail = (res.stderr || res.stdout || "").trim().split("\n").slice(-10).join("\n");
    rmSync(dir, { recursive: true, force: true });
    console.log("   ✗ install produced no skills under .claude/skills/");
    if (tail) console.log(tail.replace(/^/gm, "     "));
    return { status: "fail", failed: t.expected.length };
  }

  let failed = 0;
  for (const name of t.expected) {
    const rec = installed.get(name);
    if (!rec) {
      console.log(`   ✗ ${name}  - not installed`);
      failed++;
      continue;
    }
    if (!rec.hasName) {
      console.log(`   ✗ ${name}  - installed but missing \`name:\` frontmatter`);
      failed++;
      continue;
    }
    const required = t.contents?.[name] ?? [];
    const missing = required.filter((p) => !existsSync(join(rec.dir, p)));
    if (missing.length) {
      console.log(`   ✗ ${name}  - installed but missing ${missing.join(", ")}`);
      failed++;
      continue;
    }
    console.log(`   ✓ ${name}${required.length ? `  (+ ${required.length} required path(s))` : ""}`);
  }

  const extra = [...installed.keys()].filter((n) => !t.expected.includes(n));
  for (const name of extra)
    console.log(`   ⚠ ${name}  - installed but not in the bridge catalog (upstream added a skill?)`);

  rmSync(dir, { recursive: true, force: true });
  return { status: failed ? "fail" : "pass", failed, extra: extra.length };
}

// ── run every target, summarise, exit ───────────────────────────────────────
const results = [];
for (const t of TARGETS) results.push({ t, r: runTarget(t) });

console.log("\n── summary");
let failedTargets = 0;
for (const { t, r } of results) {
  if (r.status === "skip") {
    console.log(`⚬ ${t.bridge.padEnd(28)} skipped - ${r.reason}`);
    continue;
  }
  if (r.status === "fail") failedTargets++;
  const icon = r.status === "fail" ? "✗" : "✓";
  const extra = r.extra ? ` · ${r.extra} extra` : "";
  console.log(
    `${icon} ${t.bridge.padEnd(28)} ${t.expected.length} documented skill(s) · ${r.failed} missing/invalid${extra}`
  );
}

const skipped = results.filter(({ r }) => r.status === "skip").length;
if (skipped === results.length) skipAll("every target skipped (no network?)");

console.log(
  `\n${failedTargets ? "✗" : "✓"} ${results.length - skipped} target(s) checked · ${failedTargets} failed · ${skipped} skipped`
);
process.exit(failedTargets ? 1 : 0);
