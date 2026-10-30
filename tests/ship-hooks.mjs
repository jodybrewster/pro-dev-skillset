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
const MERGE_GATE = join(ROOT, "plugins", "pro-ship", "scripts", "merge-gate.py");
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

    // Substitutions, groups and prefixes that still run the command (gh pr new is gh's alias).
    for (const [id, cmd] of [
      ["m21 gh pr new alias", "gh pr new --fill"],
      ["m22 assignment from a command substitution", "PR_URL=$(gh pr create --fill)"],
      ["m23 substitution inside double quotes", 'echo "$(gh pr create --fill)"'],
      ["m24 brace group", "{ gh pr create --fill; }"],
      ["m25 time prefix", "time gh pr create --fill"],
      ["m26 backticks", "url=`gh pr create --fill`"],
      ["m27 nohup and sudo -E prefixes", "sudo -E nohup gh pr create --fill"],
      ["m28 command and env prefixes", "env FOO=1 command gh pr create --fill"],
      ["m29 substitution after a separator", "echo hi; x=$(git status; gh pr create --fill)"],
      ["m30 subshell group", "(gh pr create --fill)"],
      ["m40 exec prefix", "exec gh pr create --fill"],
      ["m41 nice prefix", "nice gh pr create --fill"],
      ["m42 nice -n N prefix", "nice -n 5 gh pr create --fill"],
      ["m43 nohup prefix", "nohup gh pr create --fill"],
      ["m44 nohup nice exec chain with new", "nohup nice -n 10 exec gh pr new --fill"],
      ["m31 if then", "if true; then gh pr create --fill; fi"],
    ]) {
      const rr = run(cmd, { cwd: repo, env: enforce() });
      add(id, "deny", rr, rr.deny);
    }
    quietCase("m32 echo of the quoted words", 'echo "gh pr create"');
    quietCase("m33 single-quoted substitution text", "echo '$(gh pr create --fill)'");
    quietCase("m34 gh pr new draft", "gh pr new --draft");
    quietCase("m35 combined short flags with d", 'gh pr create -dt "x"');
    quietCase("m36 combined short flags d and f", "gh pr create -fd");
    quietCase("m37 draft substitution", "x=$(gh pr create --draft --fill)");
    r = run('gh pr create -td', { cwd: repo, env: enforce() });
    add("m39 -td means title d, not draft", "deny", r, r.deny);

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

    // ======================================================================================
    // Merge gate (merge-gate.py, risk-tiers steps 10 and 11). Cases m:* below. Every decision
    // that can block has one case that blocks and one that allows.
    // ======================================================================================
    {
      const mrun = (command, { cwd, env = newEnv(), raw = null, pm, extraEnv = {} } = {}) => {
        const body = { tool_name: "Bash", session_id: "ms", cwd, tool_input: { command } };
        if (pm) body.permission_mode = pm;
        const input = raw !== null ? raw : JSON.stringify(body);
        const t0 = Date.now();
        const r = spawnSync("python3", [MERGE_GATE], { input, encoding: "utf8", timeout: 30_000, env: { ...env0, CLAUDE_GUARD_DIR: env.gdir, PRO_DEV_STATE_DIR: env.sdir, ...extraEnv } });
        let json = null;
        try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* not json */ }
        let log = "";
        try { log = readFileSync(join(env.gdir, "warn.log"), "utf8"); } catch { /* none */ }
        const h = json?.hookSpecificOutput || {};
        const decision = h.permissionDecision || "";
        const text = json?.systemMessage ?? h.permissionDecisionReason ?? "";
        return { status: r.status, json, stdout: r.stdout, stderr: r.stderr, log, text, decision, ms: Date.now() - t0 };
      };
      const menv = (mode, modeMg) => {
        const e = newEnv({ mode });
        if (modeMg) writeFileSync(join(e.gdir, "mode.merge-gate"), modeMg + "\n");
        return e;
      };
      const MENF = () => menv("enforce");
      const MWARN = () => menv("warn");
      // A repo on branch feat that changes the given files against main.
      const featRepo = (files) => {
        const repo = newRepo();
        writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "x", dependencies: { a: "1.0.0" } }, null, 2) + "\n");
        writeFileSync(join(repo, "README.md"), "hi\n");
        sh(repo, "add", "-A");
        sh(repo, "commit", "-q", "-m", "base");
        sh(repo, "checkout", "-q", "-b", "feat");
        for (const [name, content] of Object.entries(files)) {
          mkdirSync(dirname(join(repo, name)), { recursive: true });
          writeFileSync(join(repo, name), content);
        }
        sh(repo, "add", "-A");
        sh(repo, "commit", "-q", "-m", "change");
        return repo;
      };
      const lowR = featRepo({ "README.md": "hi there\n" });
      const medR = featRepo({ "package.json": JSON.stringify({ name: "x", dependencies: { a: "1.0.0", "left-pad": "1.0.0" } }, null, 2) + "\n" });
      const highR = featRepo({ ".github/workflows/ci.yml": "name: ci\non: push\n" });
      const lowH = sha(lowR), medH = sha(medR), highH = sha(highR);
      const MERGE = "gh pr merge 42 --squash";
      const asks = (r) => r.status === 0 && r.decision === "ask";
      const denies = (r) => r.status === 0 && r.decision === "deny";
      const allowsQuiet = (r) => r.status === 0 && !r.stdout.trim();
      const allowsMsg = (r) => r.status === 0 && !r.decision && !!r.json?.systemMessage;

      // ---- step 10: matching ---------------------------------------------------------
      const mq = (id, command) => { const r = mrun(command, { cwd: highR, env: MENF() }); add(id, "silent", r, allowsQuiet(r)); };
      mq("mg1 gh pr view", "gh pr view 42");
      mq("mg2 git push", "git push origin feat");
      mq("mg3 echo of the words", "echo gh pr merge");
      mq("mg4 heredoc body", "git commit -F - <<'EOF'\nthen gh pr merge 42\nEOF");
      mq("mg5 commit message", 'git commit -m "gh pr merge"');
      mq("mg6 gh pr merge --help", "gh pr merge --help");
      mq("mg7 quoted string", "echo 'x && gh pr merge 42'");
      mq("mg8 gh pr list", "gh pr list");
      let r = mrun(MERGE, { cwd: highR, env: MENF() });
      add("mg10 gh pr merge <n> acts", "deny", r, denies(r));
      r = mrun(`cd ${highR} && gh pr merge 42 --squash`, { cwd: sandbox, env: MENF() });
      add("mg11 cd then merge acts", "deny", r, denies(r));
      r = mrun(`bash -c "gh pr merge 42"`, { cwd: highR, env: MENF() });
      add("mg12 bash -c acts", "deny", r, denies(r));
      r = mrun(`echo $(gh pr merge 42)`, { cwd: highR, env: MENF() });
      add("mg13 command substitution acts", "deny", r, denies(r));
      r = mrun(`GH_TOKEN=x gh pr merge --squash`, { cwd: highR, env: MENF() });
      add("mg14 env prefix and no number acts", "deny", r, denies(r));
      r = mrun(`cd ${medR} && gh pr merge 42 --match-head-commit ${medH}`, { cwd: highR, env: MENF() });
      add("mg15 the cd target is classified, not the session cwd", "ask medium", r, asks(r) && /medium/.test(r.text) && !/workflows/.test(r.text));

      // ---- step 10: low ---------------------------------------------------------------
      r = mrun(MERGE, { cwd: lowR, env: MENF() });
      add("mg20 low allows silently in enforce", "silent", r, allowsQuiet(r));
      r = mrun(MERGE, { cwd: lowR, env: MWARN() });
      add("mg21 low allows silently in warn", "silent", r, allowsQuiet(r));
      r = mrun(`${MERGE} --match-head-commit ${"0".repeat(40)}`, { cwd: lowR, env: MENF() });
      add("mg22 low ignores the pin", "silent", r, allowsQuiet(r));

      // ---- step 10: medium and high with a matching pin -------------------------------
      r = mrun(`${MERGE} --match-head-commit ${medH}`, { cwd: medR, env: MENF() });
      add("mg30 medium asks in enforce with tier, signals, sha and the commit-only line", "ask", r,
        asks(r) && /medium/.test(r.text) && /dependencies/.test(r.text) && r.text.includes(medH) && /this approval covers this commit only/i.test(r.text));
      r = mrun(`${MERGE} --match-head-commit ${highH}`, { cwd: highR, env: MENF() });
      add("mg31 high asks in enforce", "ask", r, asks(r) && /high/.test(r.text) && /workflows/.test(r.text) && r.text.includes(highH));
      let e = MWARN();
      r = mrun(`${MERGE} --match-head-commit ${highH}`, { cwd: highR, env: e });
      add("mg32 high in warn allows with the same text as a systemMessage", "message", r,
        allowsMsg(r) && /high/.test(r.text) && /workflows/.test(r.text) && /this approval covers this commit only/i.test(r.text) && /warn/.test(r.log));
      r = mrun(`${MERGE} --match-head-commit ${medH}`, { cwd: medR, env: MWARN() });
      add("mg33 medium in warn allows with a message", "message", r, allowsMsg(r) && /medium/.test(r.text));
      r = mrun(`${MERGE} --match-head-commit=${highH}`, { cwd: highR, env: MENF() });
      add("mg34 the --flag=sha form is read", "ask", r, asks(r));
      r = mrun(`${MERGE}`, { cwd: highR, env: menv("warn", "enforce") });
      add("mg35 mode.merge-gate overrides mode (enforce over warn)", "deny", r, denies(r));
      r = mrun(`${MERGE}`, { cwd: highR, env: menv("enforce", "warn") });
      add("mg36 mode.merge-gate overrides mode (warn over enforce)", "message", r, allowsMsg(r));
      r = mrun(`${MERGE}`, { cwd: highR, env: newEnv() });
      add("mg37 the default mode is warn", "message", r, allowsMsg(r));

      // ---- R23: nothing turns an ask into an allow ------------------------------------
      mkdirSync(join(highR, ".pro-dev", "ship"), { recursive: true });
      writeFileSync(join(highR, ".pro-dev", "ship", "pr-check.json"), JSON.stringify({ schema: 1, head: highH, result: "pass", tier: "low" }));
      r = mrun(`RELEASE_APPROVAL=1 ${MERGE} --match-head-commit ${highH} --label risk:low`, { cwd: highR, env: MENF(), extraEnv: { RELEASE_APPROVAL: "1", PRO_SHIP_APPROVED: "1", CLAUDE_GUARD_MODE: "warn" } });
      add("mg40 env, passing stamp and a risk:low label still ask", "ask", r, asks(r));
      sh(highR, "checkout", "-q", "--", ".");
      rmSync(join(highR, ".pro-dev"), { recursive: true, force: true });

      // ---- malformed payloads ---------------------------------------------------------
      for (const [id, raw] of [["mg50 empty payload", ""], ["mg51 not json", "{nope"], ["mg52 json array", "[1]"], ["mg53 no tool_input", JSON.stringify({ tool_name: "Bash" })], ["mg54 command not a string", JSON.stringify({ tool_input: { command: 7 } })]]) {
        r = mrun("", { raw, cwd: highR, env: MENF() });
        add(id, "exit 0 silent", r, allowsQuiet(r));
      }

      // ---- step 11: the commit pin ----------------------------------------------------
      for (const [label, repo, head] of [["medium", medR, medH], ["high", highR, highH]]) {
        r = mrun(MERGE, { cwd: repo, env: MENF() });
        add(`mg60 ${label} with no pin denies and names the flag`, "deny", r, denies(r) && r.text.includes(`--match-head-commit ${head}`));
        r = mrun(`${MERGE} --match-head-commit ${head.slice(0, 7)}`, { cwd: repo, env: MENF() });
        add(`mg61 ${label} with a 7 character prefix asks`, "ask", r, asks(r));
        r = mrun(`${MERGE} --match-head-commit ${head}`, { cwd: repo, env: MENF() });
        add(`mg62 ${label} with the full sha asks`, "ask", r, asks(r));
        r = mrun(`${MERGE} --match-head-commit ${head.slice(0, 6)}`, { cwd: repo, env: MENF() });
        add(`mg63 ${label} with a 6 character prefix denies`, "deny", r, denies(r) && r.text.includes(`--match-head-commit ${head}`));
        r = mrun(`${MERGE} --match-head-commit ${lowH}`, { cwd: repo, env: MENF() });
        add(`mg64 ${label} with another commit denies`, "deny", r, denies(r) && r.text.includes(head));
        r = mrun(`${MERGE} --match-head-commit ${head.slice(0, 7).toUpperCase()}`, { cwd: repo, env: MENF() });
        add(`mg65 ${label} with an upper case prefix of HEAD asks`, "ask", r, asks(r));
        r = mrun(`${MERGE} --match-head-commit zzzzzzz`, { cwd: repo, env: MENF() });
        add(`mg66 ${label} with a non-hex value denies`, "deny", r, denies(r));
        r = mrun(`${MERGE} --match-head-commit`, { cwd: repo, env: MENF() });
        add(`mg67 ${label} with the flag and no value denies`, "deny", r, denies(r));
      }
      r = mrun(MERGE, { cwd: highR, env: MWARN() });
      add("mg68 a missing pin in warn allows with the flag in the message", "message", r, allowsMsg(r) && r.text.includes(`--match-head-commit ${highH}`));

      // ---- step 11: could not run -----------------------------------------------------
      const mainRepo = newRepo();
      const noBase = join(sandbox, `nb${++n}`);
      mkdirSync(noBase, { recursive: true });
      sh(noBase, "init", "-q", "-b", "main");
      sh(noBase, "config", "user.name", "t");
      sh(noBase, "config", "user.email", "t@example.com");
      commit(noBase, "a.txt");
      sh(noBase, "checkout", "-q", "--orphan", "other");
      commit(noBase, "b.txt");
      const plain = join(sandbox, `plain${++n}`);
      mkdirSync(plain, { recursive: true });
      for (const [label, dir] of [["an empty range on main", mainRepo], ["no merge base", noBase], ["a non-git target", plain]]) {
        r = mrun(MERGE, { cwd: dir, env: MENF() });
        add(`mg70 ${label} asks as high in enforce`, "ask", r, asks(r) && /high/.test(r.text) && /could-not-run/.test(r.log));
        r = mrun(MERGE, { cwd: dir, env: MWARN() });
        add(`mg71 ${label} in warn says the tier is unknown`, "message", r, allowsMsg(r) && /unknown/i.test(r.text) && /could-not-run/.test(r.log));
      }
      r = mrun(`cd ${plain}/nowhere-such && ${MERGE}`, { cwd: highR, env: MENF() });
      add("mg72 an unresolvable directory asks as high", "ask", r, asks(r) && /could-not-run/.test(r.log));
      r = mrun(`cd $SOMEWHERE && ${MERGE}`, { cwd: highR, env: MENF() });
      add("mg73 a variable directory asks as high", "ask", r, asks(r) && /could-not-run/.test(r.log));

      // ---- step 11: bypass ------------------------------------------------------------
      for (const [label, repo, head] of [["medium", medR, medH], ["high", highR, highH]]) {
        for (const pm of ["bypassPermissions", "dontAsk", "auto"]) {
          r = mrun(`${MERGE} --match-head-commit ${head}`, { cwd: repo, env: MENF(), pm });
          add(`mg80 ${label} under ${pm} in enforce denies`, "deny", r,
            denies(r) && /approval needs a prompt and this session cannot show one/.test(r.text) && new RegExp(label).test(r.text) && /default mode/.test(r.text) && /by hand after review/.test(r.text));
        }
        for (const pm of ["default", "plan", "acceptEdits", undefined]) {
          r = mrun(`${MERGE} --match-head-commit ${head}`, { cwd: repo, env: MENF(), pm });
          add(`mg81 ${label} under ${pm ?? "no permission_mode"} asks`, "ask", r, asks(r));
        }
      }
      r = mrun(MERGE, { cwd: lowR, env: MENF(), pm: "dontAsk" });
      add("mg82b low under dontAsk still allows", "silent", r, allowsQuiet(r));
      r = mrun(`${MERGE} --match-head-commit ${highH}`, { cwd: highR, env: MWARN(), pm: "auto" });
      add("mg83b auto in warn allows with a message", "message", r, allowsMsg(r));
      r = mrun(MERGE, { cwd: lowR, env: MENF(), pm: "bypassPermissions" });
      add("mg82 low under bypassPermissions still allows", "silent", r, allowsQuiet(r));
      r = mrun(`${MERGE} --match-head-commit ${highH}`, { cwd: highR, env: MWARN(), pm: "bypassPermissions" });
      add("mg83 bypass in warn allows with a message", "message", r, allowsMsg(r));
      r = mrun(MERGE, { cwd: mainRepo, env: MENF(), pm: "bypassPermissions" });
      add("mg84 could not run under bypass denies as high", "deny", r, denies(r));

      // ---- a merge run from another branch --------------------------------------------
      sh(highR, "checkout", "-q", "main");
      r = mrun(`${MERGE} --match-head-commit ${highH}`, { cwd: highR, env: MENF() });
      add("mg90 gh pr merge <n> from main (empty range) asks as high", "ask", r, asks(r) && /could-not-run/.test(r.log));
      sh(highR, "checkout", "-q", "feat");
      sh(medR, "checkout", "-q", "-b", "other-branch");
      r = mrun("gh pr merge 42", { cwd: medR, env: MENF() });
      add("mg91 gh pr merge <n> from a branch that is not the PR's still pins to the local HEAD", "deny", r, denies(r) && r.text.includes(medH));
      r = mrun(`gh pr merge 42 --match-head-commit ${highH}`, { cwd: medR, env: MENF() });
      add("mg92 a pin for another PR's head is refused", "deny", r, denies(r));
      sh(medR, "checkout", "-q", "feat");
    }
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
