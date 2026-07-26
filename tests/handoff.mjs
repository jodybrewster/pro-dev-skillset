#!/usr/bin/env node
// Handoff evals for the pro-dev-skillset marketplace - the REAL trigger path.
//
// tests/eval.mjs feeds every skill's name+description to Claude playing the
// role of a synthetic router. That never proves the real session actually
// reaches for a bridge skill. This harness drives real headless Claude Code
// sessions inside demo/app (the fixture ./demo/setup.sh builds) and checks
// whether the session itself routes to a bridge's install path - instead of
// half-doing the work inline - for prompts that should hand off to an
// external engine (Leonxlnx taste-skill via taste-skills-bridge, the
// standalone impeccable skill via impeccable-bridge).
//
// Opt-in. Spends real API tokens. Not part of tests/check.mjs or the PR gate.
//
//   ./demo/setup.sh                  # one-time: install the plugin stack into demo/app
//   node tests/handoff.mjs           # run every case in tests/cases/handoff.jsonl
//   node tests/handoff.mjs --only=1  # run just case 1 (1-indexed) - a cheap sanity check
//   node tests/handoff.mjs --only=1,3
//
// Design notes (checked against the installed CLI - `claude --version` was
// 2.1.212 when this was written):
//
//   - Output format: --output-format stream-json (with --verbose so tool
//     inputs aren't truncated). stream-json gives the full transcript - every
//     assistant text block, every tool_use call (name + input), every
//     tool_result - not just the single rolled-up answer --output-format
//     json returns. A session can reach for a bridge (invoke the Skill tool,
//     Read the bridge's SKILL.md, shell out to check the external engine's
//     install state) without necessarily restating that in its final
//     message, so stream-json is the more reliable signal here.
//   - Matching happens against the raw stdout text, not a parsed structure.
//     Regex/substring matches survive JSON string-escaping fine (hyphenated
//     names like "taste-skills-bridge" need no escaping to appear literally
//     in a JSON string), and it tolerates a truncated final line if the
//     process gets killed at the per-case timeout. stderr is captured too
//     but only surfaced for failure diagnostics - it's CLI-level logging,
//     not part of what the session itself said or tried.
//   - No --max-turns flag exists in this CLI version (confirmed directly via
//     `claude -p --help` - every documented flag was enumerated and it isn't
//     one of them), so it isn't used here even though it would be the
//     obvious knob. Runaway turns/spend are bounded instead by
//     --max-budget-usd per case (override with HANDOFF_MAX_BUDGET_USD) plus
//     a hard wall-clock timeout that SIGKILLs the child process.
//   - No permission-skipping flag is passed (no --dangerously-skip-permissions,
//     no --permission-mode bypassBoundaries). Sessions run with default
//     non-interactive permissions - headless has no TTY to prompt on, so any
//     tool-use request that isn't pre-approved is auto-denied. That's fine:
//     these cases assert on what the session SAYS or TRIES (bridge-routing
//     language, a Skill/Read/Bash tool call naming the bridge or its install
//     command), never on completed work product.
//   - Cases run sequentially, not in parallel like eval.mjs's synthetic
//     router calls - each case here is a full Claude Code session sharing
//     demo/app's working tree and plugin cache, and running several at once
//     would risk them stepping on each other's project state.
//
// Graceful skips (exit 0, not a failure) when the harness can't run at all:
//   - `claude` CLI not on PATH
//   - demo/app missing, or present with no installed plugin state
// Both conditions transitively cover "never break keyless/pluginless CI":
// a CI runner without the `claude` CLI installed hits the first skip, and
// one without a built + plugin-installed demo/app hits the second. Missing
// API-key/auth is deliberately NOT a third auto-skip - if `claude` is on
// PATH and demo/app is provisioned, an unauthenticated run surfaces as a
// per-case failure (the CLI's own auth error lands in the failure
// diagnostics), since at that point the harness has everything it needs
// except credentials, which is what running it should tell you.
//
// Case schema (tests/cases/handoff.jsonl, one JSON object per line):
//   { "prompt": "...", "mustMatch": ["regex", ...], "mustNotMatch": ["regex", ...], "note": "..." }
//   mustMatch    - every regex (case-insensitive) must match somewhere in stdout
//   mustNotMatch - no regex may match anywhere in stdout (optional, defaults to [])

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "demo", "app");
const CASES_PATH = join(ROOT, "tests", "cases", "handoff.jsonl");

const TIMEOUT_MS = 5 * 60 * 1000; // ~300s per case, per the spec
const MAX_BUDGET_USD = process.env.HANDOFF_MAX_BUDGET_USD || "1.00";
const MODEL = process.env.HANDOFF_MODEL || ""; // optional override; unset = CLI default

const rel = (p) => relative(ROOT, p);

function skip(reason) {
  console.log(`⚬ handoff eval skipped - ${reason}`);
  process.exit(0);
}

// ── graceful skip 1: `claude` CLI not on PATH ───────────────────────────────
const versionCheck = spawnSync("claude", ["--version"], { stdio: "ignore" });
if (versionCheck.error) {
  if (versionCheck.error.code === "ENOENT") skip("`claude` CLI not found on PATH");
  skip(`could not run \`claude --version\` (${versionCheck.error.message})`);
}

// ── graceful skip 2: demo/app missing, or with no installed plugin state ───
const settingsPath = join(APP, ".claude", "settings.json");
if (!existsSync(APP) || !existsSync(settingsPath)) {
  skip(`demo/app has no installed plugin state (expected ${rel(settingsPath)}) - run ./demo/setup.sh first`);
}
let enabledPlugins = {};
try {
  enabledPlugins = JSON.parse(readFileSync(settingsPath, "utf8")).enabledPlugins || {};
} catch (err) {
  skip(`${rel(settingsPath)} is not valid JSON (${err.message}) - run ./demo/setup.sh first`);
}
if (Object.keys(enabledPlugins).length === 0) {
  skip(`${rel(settingsPath)} has no enabledPlugins - run ./demo/setup.sh first`);
}

// ── load cases, apply --only ─────────────────────────────────────────────
function loadCases() {
  return readFileSync(CASES_PATH, "utf8")
    .split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}
const allCases = loadCases();

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlySet = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((n) => parseInt(n.trim(), 10)))
  : null;
const cases = onlySet
  ? allCases.map((c, i) => ({ c, num: i + 1 })).filter(({ num }) => onlySet.has(num))
  : allCases.map((c, i) => ({ c, num: i + 1 }));

if (onlySet && cases.length === 0) {
  console.error(`--only matched no cases (have ${allCases.length})`);
  process.exit(2);
}

const asArr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

// ── run one case as a real headless session in demo/app ────────────────────
function runCase(prompt) {
  const args = [
    "-p", prompt,
    "--output-format", "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--max-budget-usd", String(MAX_BUDGET_USD),
  ];
  if (MODEL) args.push("--model", MODEL);

  const res = spawnSync("claude", args, {
    cwd: APP,
    encoding: "utf8",
    timeout: TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
  });

  const timedOut = res.signal === "SIGKILL" || res.signal === "SIGTERM";
  return {
    text: res.stdout || "",
    stderr: res.stderr || "",
    timedOut,
    error: res.error || null,
    status: res.status,
  };
}

// ── run ──────────────────────────────────────────────────────────────────
console.log(
  `Running ${cases.length} handoff case(s) against a live headless \`claude -p\` session in ${rel(APP)}…\n`
);

let failed = 0;
for (const { c, num } of cases) {
  const { text, stderr, timedOut, error } = runCase(c.prompt);

  const mustMatch = asArr(c.mustMatch);
  const mustNotMatch = asArr(c.mustNotMatch);
  const missing = mustMatch.filter((p) => !new RegExp(p, "i").test(text));
  const forbidden = mustNotMatch.filter((p) => new RegExp(p, "i").test(text));
  const hardFail = Boolean(error) || timedOut;
  const pass = !hardFail && missing.length === 0 && forbidden.length === 0;
  if (!pass) failed++;

  const label = c.prompt.length > 60 ? `${c.prompt.slice(0, 60)}…` : c.prompt;
  console.log(`${pass ? "✓" : "✗"} case ${num}  ${label}`);
  if (c.note) console.log(`    note: ${c.note}`);
  for (const p of missing) console.log(`    ✗ missing required match: /${p}/i`);
  for (const p of forbidden) console.log(`    ✗ matched forbidden pattern: /${p}/i`);
  if (timedOut) console.log(`    ✗ case exceeded ${TIMEOUT_MS / 1000}s timeout - process killed`);
  if (error) console.log(`    ✗ failed to run claude: ${error.message}`);
  if (!pass && stderr.trim()) {
    console.log("    stderr (tail):");
    console.log(stderr.trim().split("\n").slice(-10).map((l) => `      ${l}`).join("\n"));
  }
}

console.log(`\n${failed ? "✗" : "✓"} ${cases.length} case(s) · ${failed} failure(s)`);
process.exit(failed ? 1 : 0);
