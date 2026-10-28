#!/usr/bin/env node
// Behaviour test for the pro-quality Stop hook, user-validation.py. Drives the
// script the way Claude Code does (one process per case, the JSON payload on
// stdin) against a throwaway git repo and a throwaway JSONL transcript, with
// HOME pointed at a temp dir so the real ~/.claude state is never touched.
//
//   node tests/quality-hooks.mjs
//
// Also exported as runQualityHookCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "plugins", "pro-quality", "scripts", "user-validation.py");

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
}

export function runQualityHookCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "quality-sandbox-")));
  try {
    const home = join(sandbox, "home");
    const repo = join(sandbox, "repo");
    const elsewhere = join(sandbox, "elsewhere");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(repo, "src"), { recursive: true });
    mkdirSync(elsewhere, { recursive: true });
    writeFileSync(join(repo, "app.js"), "1\n");
    writeFileSync(join(repo, "dirty.txt"), "1\n");
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.name", "t");
    git(repo, "config", "user.email", "t@example.com");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "init");
    // A dirty file the session never touches: block mode must not list it.
    writeFileSync(join(repo, "dirty.txt"), "2\n");

    let n = 0;
    const fresh = () => {
      const id = `s${++n}`;
      const transcript = join(sandbox, `${id}.jsonl`);
      writeFileSync(transcript, "");
      return { id, transcript };
    };
    const tool = (name, input) => JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name, input }] } }) + "\n";
    const say = () => JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hello" }] } }) + "\n";
    const write = (s, name, file) => appendFileSync(s.transcript, tool(name, { file_path: file }));
    const touch = (file) => writeFileSync(file, `${Date.now()}${Math.random()}\n`);

    const stop = (s, extra = {}) => ({ cwd: repo, session_id: s.id, transcript_path: s.transcript, hook_event_name: "Stop", ...extra });
    const run = (payload, { env = {}, raw = null } = {}) => {
      const r = spawnSync("python3", [SCRIPT], {
        input: raw !== null ? raw : JSON.stringify(payload), encoding: "utf8", timeout: 30_000,
        env: { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: "/dev/null", PRO_DEV_VALIDATION: "", ...env },
      });
      let json = null;
      try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* not json */ }
      return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
    };
    const add = (id, expect, r, ok) => out.results.push({ id, expect, actual: ok ? expect : "other", ok, reason: ok ? "" : `status ${r.status} stdout ${r.stdout.slice(0, 160)} stderr ${r.stderr.slice(0, 120)}` });
    const silent = (r) => r.status === 0 && !r.stdout.trim();
    const nudged = (r) => r.status === 0 && typeof r.json?.systemMessage === "string" && !("decision" in r.json) && /\/validate/.test(r.json.systemMessage);

    // R3: nothing counted
    let s = fresh();
    appendFileSync(s.transcript, say());
    let r = run(stop(s));
    add("q1 a conversation-only transcript is silent", "silent", r, silent(r));

    // R1: path filter
    s = fresh();
    write(s, "Write", join(elsewhere, "note.md"));
    r = run(stop(s));
    add("q2 a write outside the repo is silent", "silent", r, silent(r));

    s = fresh();
    write(s, "Write", join(repo, ".pro-dev", "validation", "latest.md"));
    r = run(stop(s));
    add("q3 a write inside .pro-dev/ is silent", "silent", r, silent(r));

    // R4: nudge
    s = fresh();
    touch(join(repo, "app.js"));
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s));
    add("q4 an edit inside the repo nudges with a systemMessage and no decision", "nudge", r, nudged(r) && /repo/.test(r.json.systemMessage) && /1 file/.test(r.json.systemMessage));

    // R5: once per distinct change set
    r = run(stop(s));
    add("q5 a second stop with no new writes is silent", "silent", r, silent(r));
    touch(join(repo, "src", "b.js"));
    write(s, "Write", join(repo, "src", "b.js"));
    r = run(stop(s));
    add("q6 a second stop after a new repo write nudges again", "nudge", r, nudged(r) && /2 files/.test(r.json.systemMessage));

    // R1: relative paths and a cwd inside a subdirectory resolve against the repo
    s = fresh();
    appendFileSync(s.transcript, tool("Edit", { file_path: "../app.js" }));
    r = run(stop(s, { cwd: join(repo, "src") }));
    add("q7 a relative path from a subdirectory cwd counts", "nudge", r, nudged(r));

    // R1: a symlinked temp alias of the repo still matches the real root
    s = fresh();
    const alias = join(sandbox, "alias");
    spawnSync("ln", ["-s", repo, alias]);
    write(s, "Edit", join(alias, "app.js"));
    r = run(stop(s));
    add("q8 a path through a symlink to the repo counts", "nudge", r, nudged(r));

    // R1: apply_patch is not a counted tool
    s = fresh();
    appendFileSync(s.transcript, tool("apply_patch", { file_path: join(repo, "app.js") }));
    r = run(stop(s));
    add("q9 apply_patch is not counted", "silent", r, silent(r));

    // R2: git commit
    s = fresh();
    appendFileSync(s.transcript, tool("Bash", { command: "git commit -m x" }));
    r = run(stop(s));
    add("q10 a Bash git commit with no file writes nudges", "nudge", r, nudged(r));

    // R6: off
    s = fresh();
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s), { env: { PRO_DEV_VALIDATION: "off" } });
    add("q11 PRO_DEV_VALIDATION=off is silent", "silent", r, silent(r));

    // R7, R8: block
    s = fresh();
    touch(join(repo, "app.js"));
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s), { env: { PRO_DEV_VALIDATION: "block" } });
    const reason = r.json?.reason ?? "";
    add("q12 block mode blocks with a reason that lists the written file and not an unrelated dirty one", "block", r,
      r.status === 0 && r.json?.decision === "block" && reason.includes("app.js") && !reason.includes("dirty.txt"));

    // R8: a commit with no written paths must not fall back to the whole tree
    s = fresh();
    appendFileSync(s.transcript, tool("Bash", { command: "git commit -am x" }));
    r = run(stop(s), { env: { PRO_DEV_VALIDATION: "block" } });
    add("q12b block mode with only a Bash git commit does not report unrelated dirty files", "no dirty file", r,
      r.status === 0 && !r.stdout.includes("dirty.txt"));

    // ignored files do not count
    s = fresh();
    writeFileSync(join(repo, ".gitignore"), "ignored.log\n");
    touch(join(repo, "ignored.log"));
    write(s, "Write", join(repo, "ignored.log"));
    r = run(stop(s));
    add("q12c a write to a gitignored file in the repo is silent", "silent", r, silent(r));

    s = fresh();
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s, { stop_hook_active: true }), { env: { PRO_DEV_VALIDATION: "block" } });
    add("q13 block mode with stop_hook_active passes", "silent", r, silent(r));

    // R9: unknown value is nudge
    s = fresh();
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s), { env: { PRO_DEV_VALIDATION: "bogus" } });
    add("q14 an unknown PRO_DEV_VALIDATION value behaves as nudge", "nudge", r, nudged(r));

    // R10: bad payloads
    r = run(null, { raw: "not json" });
    add("q15 a non-JSON payload exits 0 with no output", "silent", r, silent(r));
    r = run({});
    add("q16 an empty object exits 0 with no output", "silent", r, silent(r));
    r = run(null, { raw: "" });
    add("q17 an empty payload exits 0 with no output", "silent", r, silent(r));
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runQualityHookCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} quality hook cases passed`);
  process.exit(bad ? 1 : 0);
}
