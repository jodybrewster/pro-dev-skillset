#!/usr/bin/env node
// Network-dependent smoke test for the taste-skills-bridge install path.
//
// The taste-skills-bridge skill is a router, not vendored content: the real
// engine is the external Leonxlnx/taste-skill library, installed on demand
// with `npx skills add` (the vercel-labs/agent-skills CLI). check.mjs proves
// the bridge names a command that exists; it can't prove the command's
// install actually works. This test does: it runs the real install into a
// fresh temp dir and asserts every documented skill lands with valid
// frontmatter.
//
// Opt-in. Needs network + npx. Not part of tests/check.mjs or the PR gate -
// it runs on demand (workflow_dispatch) and on a weekly schedule via
// .github/workflows/bridge-install-smoke.yml.
//
//   node tests/bridge-install-smoke.mjs
//
// Graceful skips (exit 0, not a failure) when the harness can't run at all:
//   - `npx` not on PATH
//   - the install can't reach the network (surfaced as a skip, not a failure,
//     so offline/keyless CI never goes red on a network hiccup)

import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const REPO = "https://github.com/Leonxlnx/taste-skill";

// The 13 install names the taste-skills-bridge skill documents. Keep in sync
// with the catalog table in skills/taste-skills-bridge/SKILL.md.
const EXPECTED = [
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
];

function skip(reason) {
  console.log(`⚬ bridge install smoke skipped - ${reason}`);
  process.exit(0);
}

// ── graceful skip: `npx` not on PATH ────────────────────────────────────────
const npxCheck = spawnSync("npx", ["--version"], { stdio: "ignore" });
if (npxCheck.error) {
  if (npxCheck.error.code === "ENOENT") skip("`npx` not found on PATH");
  skip(`could not run \`npx --version\` (${npxCheck.error.message})`);
}

// ── install into a throwaway dir ────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), "taste-skill-smoke-"));
console.log(`Installing ${REPO} into ${dir} …\n`);

const res = spawnSync("npx", ["-y", "skills", "add", REPO], {
  cwd: dir,
  encoding: "utf8",
  timeout: 5 * 60 * 1000,
  maxBuffer: 64 * 1024 * 1024,
});

if (res.error) {
  rmSync(dir, { recursive: true, force: true });
  if (res.error.code === "ETIMEDOUT") skip("install timed out (network too slow / unreachable)");
  skip(`could not run \`npx skills add\` (${res.error.message})`);
}
// A non-zero exit with a network-y error message is a skip, not a failure:
// this test asserts the install SHAPE, not the runner's connectivity.
const out = `${res.stdout || ""}${res.stderr || ""}`;
if (res.status !== 0 && /ENOTFOUND|ETIMEDOUT|ECONNRESET|network|getaddrinfo|EAI_AGAIN/i.test(out)) {
  rmSync(dir, { recursive: true, force: true });
  skip("install could not reach the network");
}

// ── collect what landed ─────────────────────────────────────────────────────
// `skills add` writes to <cwd>/.claude/skills/<install-name>/SKILL.md.
const skillsRoot = join(dir, ".claude", "skills");
const installed = new Map(); // install-name -> { hasName }
if (existsSync(skillsRoot)) {
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = join(skillsRoot, entry.name, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    const body = readFileSync(skillMd, "utf8");
    const nameMatch = body.match(/^name:\s*(.+)$/m);
    installed.set(nameMatch ? nameMatch[1].trim() : entry.name, {
      hasName: Boolean(nameMatch),
    });
  }
}

rmSync(dir, { recursive: true, force: true });

if (installed.size === 0) {
  console.log("✗ install produced no skills under .claude/skills/");
  if (res.status !== 0) console.log(res.stderr?.trim()?.split("\n").slice(-10).join("\n"));
  process.exit(1);
}

// ── assert every documented skill landed with valid frontmatter ─────────────
let failed = 0;
for (const name of EXPECTED) {
  const rec = installed.get(name);
  if (!rec) {
    console.log(`✗ ${name}  - not installed`);
    failed++;
  } else if (!rec.hasName) {
    console.log(`✗ ${name}  - installed but missing \`name:\` frontmatter`);
    failed++;
  } else {
    console.log(`✓ ${name}`);
  }
}

const extra = [...installed.keys()].filter((n) => !EXPECTED.includes(n));
for (const name of extra) {
  console.log(`⚠ ${name}  - installed but not in the bridge catalog (upstream added a skill?)`);
}

console.log(
  `\n${failed ? "✗" : "✓"} ${EXPECTED.length} documented skill(s) · ${failed} missing/invalid · ${extra.length} extra`
);
process.exit(failed ? 1 : 0);
