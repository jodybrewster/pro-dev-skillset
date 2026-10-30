#!/usr/bin/env node
// Behaviour test for the pro-ship PreToolUse hook, pr-gate.py. Drives the script the
// way Claude Code does (one process per case, the JSON payload on stdin) against a
// throwaway git repo, with CLAUDE_GUARD_DIR, HOME and PRO_DEV_STATE_DIR in temp folders
// so the real ~/.claude state is never touched.
//
//   node tests/ship-hooks.mjs
//
// Also exported as runShipHookCases() for tests/check.mjs. Every case that denies has a
// partner that allows (AC5). The stamp cases loop over tests/fixtures/pr-check-stamp/
// expect.json, the same fixtures the push-gate tests read (AC7).
//
//   area              blocks / acted on          allows / quiet
//   matching          m10, m11, m12              m1-m9, m13-m20
//   no stamp          v1 (enforce deny)          v2 (warn), v3 (draft)
//   fixtures          x:<file> (invalid ones)    x:<file> (valid ones)
//   once per HEAD     v10 (first deny)           v11 (retry), v12 (new commit denies)
//   mode              v20 (mode.pr-gate wins)    v21 (override to warn), v22 (default)
//   warn              v30 (message + one line)   v31 (second call silent)
//   could not run     none                       e1-e5
//   timing            none                       t1, t2

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(ROOT, "plugins", "pro-ship", "scripts", "pr-gate.py");
const FIX = join(ROOT, "tests", "fixtures", "pr-check-stamp");

export function runShipHookCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "ship-sandbox-")));
  try {
    const home = join(sandbox, "home");
    mkdirSync(home, { recursive: true });
    const env0 = { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
    delete env0.CLAUDE_GUARD_DIR;
    delete env0.PRO_DEV_STATE_DIR;
    let n = 0;
    const sh = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env: env0 });
    const sha = (repo) => sh(repo, "rev-parse", "HEAD").stdout.trim();
    const commit = (repo, name) => {
      writeFileSync(join(repo, name), name + "\n");
      sh(repo, "add", "-A");
      sh(repo, "commit", "-q", "-m", name);
    };
    const newRepo = () => {
      const repo = join(sandbox, `r${++n}`);
      mkdirSync(repo, { recursive: true });
      sh(repo, "init", "-q", "-b", "main");
      sh(repo, "config", "user.name", "t");
      sh(repo, "config", "user.email", "t@example.com");
      commit(repo, "a.txt");
      return repo;
    };
    const writeStamp = (repo, text) => {
      mkdirSync(join(repo, ".pro-dev", "ship"), { recursive: true });
      writeFileSync(join(repo, ".pro-dev", "ship", "pr-check.json"), text);
    };
    const fixture = (repo, file) => writeStamp(repo, readFileSync(join(FIX, file), "utf8").replaceAll("HEAD", sha(repo)));

    // An env keeps its guard and state folders between calls so "once per HEAD" can be
    // tested; a fresh env is a fresh session.
    const newEnv = ({ mode, modePr } = {}) => {
      const gdir = join(sandbox, `g${++n}`);
      const sdir = join(sandbox, `s${n}`);
      mkdirSync(gdir, { recursive: true });
      if (mode) writeFileSync(join(gdir, "mode"), mode + "\n");
      if (modePr) writeFileSync(join(gdir, "mode.pr-gate"), modePr + "\n");
      return { gdir, sdir };
    };
    const run = (command, { cwd, env = newEnv(), raw = null, session = "s1", mode, payload = null } = {}) => {
      if (mode && !env.modeSet) { writeFileSync(join(env.gdir, "mode"), mode + "\n"); }
      const input = raw !== null ? raw : JSON.stringify(payload || { tool_name: "Bash", session_id: session, cwd, tool_input: { command } });
      const t0 = Date.now();
      const r = spawnSync("python3", [GATE], { input, encoding: "utf8", timeout: 30_000, env: { ...env0, CLAUDE_GUARD_DIR: env.gdir, PRO_DEV_STATE_DIR: env.sdir } });
      let json = null;
      try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* not json */ }
      let log = "";
      try { log = readFileSync(join(env.gdir, "warn.log"), "utf8"); } catch { /* none */ }
      const h = json?.hookSpecificOutput || {};
      const text = json?.systemMessage ?? h.permissionDecisionReason ?? "";
      return { status: r.status, json, stdout: r.stdout, stderr: r.stderr, log, text, deny: h.permissionDecision === "deny", ms: Date.now() - t0 };
    };
    const quiet = (r) => r.status === 0 && !r.stdout.trim();
    const warned = (r) => r.status === 0 && !r.deny && !!r.json?.systemMessage;
    const add = (id, expect, r, ok) => out.results.push({ id, expect, actual: ok ? expect : "other", ok, reason: ok ? "" : `status ${r.status} stdout ${String(r.stdout).slice(0, 300)} stderr ${String(r.stderr).slice(0, 200)} log ${String(r.log).slice(0, 200)}` });
    const enforce = () => newEnv({ mode: "enforce" });
    const PR = "gh pr create --title T --body B";

    // ---- step 7: matching. No stamp and enforce mode, so a hit would deny. --------
    const repo = newRepo();
    const quietCase = (id, command, extra = {}) => {
      const r = run(command, { cwd: repo, env: enforce(), ...extra });
      add(id, "silent", r, quiet(r));
    };
    quietCase("m1 git push", "git push origin main");
    quietCase("m2 commit message with the words", 'git commit -m "gh pr create"');
    quietCase("m3 echo of the words", "echo gh pr create");
    quietCase("m4 --help", "gh pr create --help");
    quietCase("m5 --draft", "gh pr create --draft");
    quietCase("m6 -d", "gh pr create -d");
    quietCase("m7 heredoc body", "git commit -F - <<'EOF'\nthen gh pr create\nEOF");
    quietCase("m8 other gh command", "gh pr view 3");
    quietCase("m9 ls", "ls -la");
    quietCase("m13 -h", "gh pr create -h");
    quietCase("m14 --draft with other flags", "gh pr create --title T --draft --body B");
    quietCase("m15 --draft=true", "gh pr create --draft=true");
    quietCase("m16 quoted string", "echo 'x && gh pr create'");
    quietCase("m17 gh pr list", "gh pr list --state open");
    quietCase("m18 gh pr create inside a draft pipeline segment", "git status && gh pr create --draft --fill");
    quietCase("m19 gh pr checkout", "gh pr checkout 5");
    quietCase("m20 commit heredoc with a quoted delimiter", "git commit -m \"$(cat <<'EOF'\nrun gh pr create now\nEOF\n)\"");

    let r = run(`cd ${repo} && GH_TOKEN=x gh pr create --fill`, { cwd: sandbox, env: enforce() });
    add("m10 cd and env prefix are acted on", "deny", r, r.deny);
    r = run("gh pr create -R owner/repo --fill", { cwd: repo, env: enforce() });
    add("m11 -R is acted on", "deny", r, r.deny);
    r = run(`${PR}`, { cwd: repo, env: enforce() });
    add("m12 plain create is acted on", "deny", r, r.deny);
    r = run("gh pr create --draft=false", { cwd: repo, env: enforce() });
    add("m12b --draft=false is acted on", "deny", r, r.deny);
    r = run(`bash -c 'gh pr create --fill'`, { cwd: repo, env: enforce() });
    add("m12c bash -c is acted on", "deny", r, r.deny);
    r = run(`git status && gh pr create --fill`, { cwd: repo, env: enforce() });
    add("m12d second segment is acted on", "deny", r, r.deny);

    // ---- could not run: allow with exit 0 ----------------------------------------
    const nogit = join(sandbox, "nogit");
    mkdirSync(nogit, { recursive: true });
    r = run(PR, { cwd: nogit, env: enforce() });
    add("e1 a non-git cwd allows", "allow", r, r.status === 0 && !r.deny && /could-not-run/.test(r.log));
    r = run("", { raw: "{not json", env: enforce() });
    add("e2 a malformed payload exits 0", "allow", r, r.status === 0 && !r.deny);
    r = run("", { cwd: repo, env: enforce() });
    add("e3 an empty command exits 0", "silent", r, quiet(r));
    r = run("", { raw: "", env: enforce() });
    add("e4 an empty payload exits 0", "silent", r, quiet(r));
    r = run("", { raw: "[1,2]", env: enforce() });
    add("e5 a non-object payload exits 0", "allow", r, r.status === 0 && !r.deny);
    r = run("", { payload: { tool_name: "Bash", cwd: repo, tool_input: {} }, env: enforce() });
    add("e6 a payload with no command exits 0", "silent", r, quiet(r));
    r = run(`cd '$SOMEWHERE' && ${PR}`, { cwd: repo, env: enforce() });
    add("e7 an unresolvable cd allows", "allow", r, r.status === 0 && !r.deny);
    r = run(`cd ${nogit} && ${PR}`, { cwd: repo, env: enforce() });
    add("e8 cd into a non-repo allows", "allow", r, r.status === 0 && !r.deny);

    // ---- step 8: verdicts ---------------------------------------------------------
    let rp = newRepo();
    r = run(PR, { cwd: rp, env: enforce() });
    add("v1 no stamp denies in enforce, names missing", "deny", r, r.deny && /missing/.test(r.text) && /\/pro-ship:pr-check/.test(r.text));
    rp = newRepo();
    r = run(PR, { cwd: rp, env: newEnv({ mode: "warn" }) });
    add("v2 no stamp warns in warn, allows", "warn", r, warned(r) && /missing/.test(r.text) && !r.deny);
    r = run("gh pr create --draft --fill", { cwd: rp, env: enforce() });
    add("v3 draft passes without a stamp", "silent", r, quiet(r));
    rp = newRepo();
    r = run(PR, { cwd: rp, env: newEnv() });
    add("v22 default mode is warn", "warn", r, warned(r) && !r.deny);

    // Fixtures: one case per file, enforce mode, a fresh repo each.
    const expectJson = JSON.parse(readFileSync(join(FIX, "expect.json"), "utf8"));
    const files = readdirSync(FIX).filter((f) => f.endsWith(".json") && f !== "expect.json");
    for (const f of files) {
      const want = expectJson[f]?.pr_gate;
      if (!want) { out.results.push({ id: `x:${f}`, expect: "listed in expect.json", actual: "missing", ok: false, reason: "fixture not in expect.json" }); continue; }
      const fr = newRepo();
      fixture(fr, f);
      const rr = run(PR, { cwd: fr, env: enforce() });
      const ok = want.valid ? quiet(rr) : rr.deny && rr.text.includes(want.cause) && /\/pro-ship:pr-check/.test(rr.text);
      add(`x:${f}`, want.valid ? "silent" : `deny ${want.cause}`, rr, ok);
    }

    // Once per HEAD per session.
    rp = newRepo();
    let env = enforce();
    r = run(PR, { cwd: rp, env });
    add("v10 first create on a HEAD denies", "deny", r, r.deny);
    r = run(PR, { cwd: rp, env });
    add("v11 the identical retry passes", "silent", r, quiet(r));
    commit(rp, "b.txt");
    r = run(PR, { cwd: rp, env });
    add("v12 a new commit is denied again", "deny", r, r.deny);
    r = run(PR, { cwd: rp, env, session: "other" });
    add("v13 another session is denied", "deny", r, r.deny);
    r = run(PR, { cwd: rp, env: enforce() });
    add("v14 a fresh state dir is denied", "deny", r, r.deny);
    fixture(rp, "valid-pass.json");
    r = run(PR, { cwd: rp, env: enforce() });
    add("v15 a valid stamp passes with no output", "silent", r, quiet(r));

    // Mode lookup.
    rp = newRepo();
    r = run(PR, { cwd: rp, env: newEnv({ mode: "warn", modePr: "enforce" }) });
    add("v20 mode.pr-gate enforce beats mode warn", "deny", r, r.deny);
    r = run(PR, { cwd: rp, env: newEnv({ mode: "enforce", modePr: "warn" }) });
    add("v21 mode.pr-gate warn beats mode enforce", "warn", r, warned(r) && !r.deny);
    r = run(PR, { cwd: rp, env: newEnv({ mode: "enforce", modePr: "bogus" }) });
    add("v23 an unknown mode value is warn", "warn", r, warned(r) && !r.deny);

    // Warn: one log line, the message once per HEAD.
    rp = newRepo();
    env = newEnv({ mode: "warn" });
    r = run(PR, { cwd: rp, env });
    const lines = r.log.trim().split("\n").filter(Boolean);
    add("v30 warn shows the message and logs one line", "warn", r, warned(r) && lines.length === 1 && lines[0].split("\t")[1] === "pr-gate");
    r = run(PR, { cwd: rp, env });
    add("v31 the second call on that HEAD is silent and logs nothing more", "silent", r, quiet(r) && r.log.trim().split("\n").length === 1);
    commit(rp, "c.txt");
    r = run(PR, { cwd: rp, env });
    add("v32 a new HEAD warns again", "warn", r, warned(r));

    // N2: the hook leaves the repo alone.
    rp = newRepo();
    run(PR, { cwd: rp, env: enforce() });
    add("v40 the repo tree is untouched", "clean", r, sh(rp, "status", "--porcelain").stdout.trim() === "");

    // ---- step 9: timing (N1) ------------------------------------------------------
    const ci = !!process.env.CI;
    rp = newRepo();
    const times = [];
    for (let i = 0; i < 50; i++) times.push(run(i % 2 ? "git status" : `ls -la /tmp && echo ${i}`, { cwd: rp, env: enforce() }).ms);
    times.sort((a, b) => a - b);
    const med = times[25];
    add(`t1 median of 50 non-PR commands is ${med} ms (limit ${ci ? 400 : 100})`, `under ${ci ? 400 : 100}`, { status: 0, stdout: "", stderr: "", log: "" }, med < (ci ? 400 : 100));
    r = run(PR, { cwd: rp, env: enforce() });
    add(`t2 one gh pr create took ${r.ms} ms (limit ${ci ? 3000 : 1000})`, `under ${ci ? 3000 : 1000}`, r, r.ms < (ci ? 3000 : 1000));
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runShipHookCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} ship hook cases passed`);
  process.exit(bad ? 1 : 0);
}
