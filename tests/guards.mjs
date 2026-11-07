#!/usr/bin/env node
// Behaviour test for the shared guard helper of pro-core, `scripts/guardlib.py`.
//
// The pro-core guards (the protected-push findings of git-safe.py first) read
// their mode through guardlib. A new guard enforces only when its own
// `mode.<key>` file says `enforce`: the global `mode` file and
// CLAUDE_GUARD_MODE leave it in warn so it cannot enforce before its evidence
// period (ADR-0016, the `stale-done` precedent). A lookup that read the global
// file would turn every new guard on at once. Each direction is a case.
//
//   node tests/guards.mjs
//   node tests/guards.mjs --only=mode     # substring filter on case id
//
// tests/check.mjs imports `runGuardCases()` and reports the results as its
// `guards` check. Zero dependencies, no network. Skips cleanly when python3 is
// not on PATH.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-core", "scripts");
const LIB = join(SCRIPTS, "guardlib.py");

const PROBE = [
  "import sys",
  "sys.dont_write_bytecode = True",
  "sys.path.insert(0, sys.argv[1])",
  "import guardlib",
  "print(guardlib.own_mode(sys.argv[2]))",
].join("\n");

const CASES = [
  { id: "mode/no-file-reads-warn", key: "protected-push", files: {}, expect: "warn" },
  { id: "mode/own-file-enforce", key: "protected-push", files: { "mode.protected-push": "enforce\n" }, expect: "enforce" },
  { id: "mode/own-file-warn", key: "protected-push", files: { "mode.protected-push": "warn\n" }, expect: "warn" },
  { id: "mode/own-file-junk-reads-warn", key: "protected-push", files: { "mode.protected-push": "yes please\n" }, expect: "warn" },
  { id: "mode/global-file-enforce-stays-warn", key: "protected-push", files: { mode: "enforce\n" }, expect: "warn" },
  { id: "mode/env-enforce-stays-warn", key: "protected-push", files: {}, env: { CLAUDE_GUARD_MODE: "enforce" }, expect: "warn" },
  {
    id: "mode/own-file-wins-over-global-warn",
    key: "protected-push",
    files: { mode: "warn\n", "mode.protected-push": "enforce\n" },
    expect: "enforce",
  },
  { id: "mode/other-key-file-ignored", key: "protected-push", files: { "mode.floor-guard": "enforce\n" }, expect: "warn" },
];

function baseEnv() {
  const env = { ...process.env };
  delete env.CLAUDE_GUARD_MODE;
  return env;
}

export function runGuardCases({ only = null } = {}) {
  const selected = only ? CASES.filter((c) => c.id.includes(only)) : CASES;
  const out = { skipped: null, selected, results: [] };
  const py = spawnSync("python3", ["--version"], { stdio: "ignore" });
  if (py.error) return { ...out, skipped: "python3 not found on PATH" };

  for (const c of selected) {
    const dir = mkdtempSync(join(tmpdir(), "guards-"));
    try {
      for (const [name, body] of Object.entries(c.files)) writeFileSync(join(dir, name), body);
      const env = { ...baseEnv(), ...(c.env || {}), CLAUDE_GUARD_DIR: dir };
      const res = existsSync(LIB)
        ? spawnSync("python3", ["-c", PROBE, SCRIPTS, c.key], { encoding: "utf8", env, timeout: 20_000 })
        : { status: 1, stdout: "", stderr: "guardlib.py not found" };
      const actual = res.status === 0 ? res.stdout.trim() : `error: ${(res.stderr || "").trim().split("\n").pop()}`;
      out.results.push({ ...c, actual, ok: actual === c.expect, reason: actual === c.expect ? "" : `got ${actual}` });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return out;
}

function main() {
  const onlyArg = process.argv.slice(2).find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length) : null;
  const { skipped, selected, results } = runGuardCases({ only });
  if (skipped) {
    console.log(`⚬ guard helper test skipped - ${skipped}`);
    process.exit(0);
  }
  if (selected.length === 0) {
    console.error(`no cases match --only=${only}`);
    process.exit(2);
  }
  const width = Math.max(...results.map((r) => r.id.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(width)}  expect=${r.expect.padEnd(7)} got=${r.actual}`);
  }
  console.log(`\n${failed ? "✗" : "✓"} ${results.length} cases · ${failed} failures`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
