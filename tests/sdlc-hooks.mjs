#!/usr/bin/env node
// Behaviour test for the pro-ai-sdlc hooks: protect-tests, plan-sync and
// production-gate. Drives each script the way Claude Code does (one process per
// case, the JSON payload on stdin) against a disposable sandbox, with
// CLAUDE_GUARD_DIR pointing at a throwaway mode directory so the real
// ~/.claude/hooks log and mode files are never touched.
//
//   node tests/sdlc-hooks.mjs
//
// Also exported as runSdlcHookCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const S = (f) => join(ROOT, "plugins", "pro-ai-sdlc", "scripts", f);

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
}

function run(script, payload, { mode = null, env = {}, raw = null } = {}) {
  const guardDir = mkdtempSync(join(tmpdir(), "sdlc-guard-"));
  if (mode) writeFileSync(join(guardDir, "mode"), mode + "\n");
  const input = raw !== null ? raw : JSON.stringify(payload);
  const r = spawnSync("python3", [S(script)], {
    input, encoding: "utf8", timeout: 30_000,
    env: { ...process.env, CLAUDE_GUARD_DIR: guardDir, RELEASE_APPROVAL: "", ...env },
  });
  rmSync(guardDir, { recursive: true, force: true });
  let json = null;
  try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* not json */ }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

export function runSdlcHookCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "sdlc-sandbox-")));
  try {
    const fix = join(sandbox, "fix");
    mkdirSync(join(fix, ".claude"), { recursive: true });
    writeFileSync(join(fix, ".claude", "fix-mode"), "");
    const free = join(sandbox, "free");
    mkdirSync(free, { recursive: true });

    const repo = join(sandbox, "repo");
    mkdirSync(join(repo, "intent", "2026-01-01-x"), { recursive: true });
    writeFileSync(join(repo, "intent", "2026-01-01-x", "plan.md"), "# Plan\n");
    writeFileSync(join(repo, "app.js"), "1\n");
    git(repo, "init", "-q", "-b", "main");
    git(repo, "add", "-A");
    git(repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "init");

    const add = (id, expect, r, ok) => out.results.push({ id, expect, actual: ok ? expect : "other", ok, reason: ok ? "" : `status ${r.status} stdout ${r.stdout.slice(0, 120)} stderr ${r.stderr.slice(0, 120)}` });
    const edit = (cwd, file) => ({ cwd, tool_name: "Edit", tool_input: { file_path: file } });
    const bash = (cwd, command) => ({ cwd, tool_name: "Bash", tool_input: { command } });
    const warned = (r) => r.status === 0 && r.json?.systemMessage?.includes("warn mode");

    // protect-tests
    let r = run("protect-tests.py", edit(fix, join(fix, "src", "a.test.ts")));
    add("pt1 warn mode flags a test edit in fix mode and allows", "warn", r, warned(r));
    r = run("protect-tests.py", edit(fix, join(fix, "src", "a.test.ts")), { mode: "enforce" });
    add("pt2 enforce mode blocks a test edit in fix mode", "block", r, r.status === 2);
    r = run("protect-tests.py", edit(fix, join(fix, "tests", "x.py")), { mode: "enforce" });
    add("pt3 enforce mode blocks a file under tests/", "block", r, r.status === 2);
    r = run("protect-tests.py", edit(fix, join(fix, "src", "a.ts")), { mode: "enforce" });
    add("pt4 a source edit is allowed in fix mode", "allow", r, r.status === 0 && !r.stdout);
    r = run("protect-tests.py", edit(free, join(free, "a.test.ts")), { mode: "enforce" });
    add("pt5 no marker, a test edit is allowed", "allow", r, r.status === 0 && !r.stdout);
    r = run("protect-tests.py", edit(free, join(free, "a_test.go")), { mode: "enforce", env: { SDLC_TASK_KIND: "fix" } });
    add("pt8 SDLC_TASK_KIND=fix locks a Go test file", "block", r, r.status === 2);
    r = run("protect-tests.py", null, { raw: "not json", mode: "enforce" });
    add("pt6 a malformed payload is allowed", "allow", r, r.status === 0);
    r = run("protect-tests.py", null, { raw: "" , mode: "enforce" });
    add("pt7 an empty payload is allowed", "allow", r, r.status === 0);

    // production-gate
    const gate = (cmd, opts) => run("production-gate.py", bash(repo, cmd), opts);
    r = gate("git push origin main");
    add("pg1 warn mode flags a push to main and allows", "warn", r, warned(r));
    r = gate("git push origin main", { mode: "enforce" });
    add("pg2 enforce mode asks for a push to main", "ask", r, r.json?.hookSpecificOutput?.permissionDecision === "ask");
    r = gate("git push origin main", { mode: "enforce", env: { RELEASE_APPROVAL: "1" } });
    add("pg3 RELEASE_APPROVAL=1 lets it through", "allow", r, r.status === 0 && !r.stdout);
    r = gate("git push", { mode: "enforce" });
    add("pg4 a bare push while on main asks", "ask", r, r.json?.hookSpecificOutput?.permissionDecision === "ask");
    r = gate("git push -u origin feature-x", { mode: "enforce" });
    add("pg5 a push to a feature branch is allowed", "allow", r, r.status === 0 && !r.stdout);
    r = gate("git push --dry-run origin main", { mode: "enforce" });
    add("pg6 a dry run is allowed", "allow", r, r.status === 0 && !r.stdout);
    r = gate("git commit -m 'never git push origin main'", { mode: "enforce" });
    add("pg7 text inside a quoted message is not a push", "allow", r, r.status === 0 && !r.stdout);
    for (const [i, c] of [["pg8", "vercel --prod"], ["pg9", "npm publish"], ["pg10", "gh pr merge 12 --squash"], ["pg11", "gh release create v1"], ["pg12", "cd x && pnpm publish --access public"]]) {
      r = gate(c, { mode: "enforce" });
      add(`${i} enforce mode asks for ${c}`, "ask", r, r.json?.hookSpecificOutput?.permissionDecision === "ask");
    }
    r = gate("npm publish --dry-run", { mode: "enforce" });
    add("pg13 npm publish --dry-run is allowed", "allow", r, r.status === 0 && !r.stdout);
    r = gate("ls -la", { mode: "enforce" });
    add("pg14 an ordinary command is allowed", "allow", r, r.status === 0 && !r.stdout);
    r = run("production-gate.py", null, { raw: "{", mode: "enforce" });
    add("pg15 a malformed payload is allowed", "allow", r, r.status === 0);

    // plan-sync
    const stop = (cwd, extra = {}) => ({ cwd, hook_event_name: "Stop", ...extra });
    r = run("plan-sync.py", stop(repo), { mode: "enforce" });
    add("ps1 a clean tree passes", "allow", r, r.status === 0 && !r.stdout);
    writeFileSync(join(repo, "app.js"), "2\n");
    r = run("plan-sync.py", stop(repo));
    add("ps2 warn mode flags code changed without plan.md and does not block", "warn", r, warned(r) && !r.json?.decision);
    const keys = r.json ? Object.keys(r.json).sort().join(",") : "";
    add("ps2b warn output for Stop is a user message only, never model feedback", "systemMessage only", r, keys === "systemMessage" && !r.stdout.includes("additionalContext") && !r.stdout.includes("hookSpecificOutput") && !r.stdout.includes("reason") && !r.stdout.includes("continue"));
    r = run("plan-sync.py", stop(repo), { mode: "enforce" });
    add("ps3 enforce mode blocks once", "block", r, r.json?.decision === "block");
    r = run("plan-sync.py", stop(repo, { stop_hook_active: true }), { mode: "enforce" });
    add("ps4 a second stop (stop_hook_active) passes", "allow", r, r.status === 0 && !r.stdout);
    writeFileSync(join(repo, "intent", "2026-01-01-x", "plan.md"), "# Plan\n\nDeparture noted.\n");
    r = run("plan-sync.py", stop(repo), { mode: "enforce" });
    add("ps5 plan.md changed with the code passes", "allow", r, r.status === 0 && !r.stdout);
    r = run("plan-sync.py", null, { raw: "garbage", mode: "enforce" });
    add("ps6 a malformed payload passes", "allow", r, r.status === 0 && !r.stdout);
    r = run("plan-sync.py", stop(free), { mode: "enforce" });
    add("ps7 a directory that is not a git repo passes", "allow", r, r.status === 0 && !r.stdout);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runSdlcHookCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} sdlc hook cases passed`);
  process.exit(bad ? 1 : 0);
}
