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

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync, cpSync, symlinkSync } from "node:fs";
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
    for (const [id, cmd] of [["m30 a single & before gh pr create", "git status & gh pr create --fill"],
      ["m31 |& before gh pr create", "echo x |& gh pr create --fill"],
      ["m32 eval of gh pr create", `eval "gh pr create --fill"`],
      ["m33 eval with bare words", "eval gh pr create --fill"],
      ["m34 xargs gh pr create", "echo x | xargs -n1 gh pr create --fill"]]) {
      r = run(cmd, { cwd: repo, env: enforce() });
      add(id, "deny", r, r.deny);
    }
    quietCase("m35 2>&1 is not a separator", "git status 2>&1 && gh pr create --draft");
    quietCase("m36 &> is not a separator", "git status &>/dev/null; echo gh pr create");
    quietCase("m37 >&2 is not a separator", "echo x >&2; gh pr create --draft");
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
    //
    //   area (p0-hardening)       blocks / acted on             allows / quiet
    //   PR resolution             mg200, mg201                  mg202, mg203
    //   repo and selector         mg210-mg217                   mg203
    //   pin against PR head       mg240                         mg241
    //   fetch of the PR head      mg220                         mg221 (could not run)
    //   gh failures               mg230-mg235 (ask or message)  none, never silent
    //   gh api and graphql        mg250, mg252b, mg255, mg256   mg251, mg252-mg254, mg257, mg258
    //   --auto                    mg260                         mg261, mg262
    // ======================================================================================
    {
      // A stub gh first on PATH so no case reaches the network or the real gh. It records its
      // arguments in GH_STUB_ARGS, sleeps GH_STUB_SLEEP seconds, exits GH_STUB_EXIT with a line on
      // stderr, prints the file GH_STUB_OUT, else answers for PR 42 with the HEAD of its directory.
      const stubBin = join(sandbox, "stubbin");
      mkdirSync(stubBin, { recursive: true });
      writeFileSync(join(stubBin, "gh"), [
        "#!/bin/sh",
        'if [ -n "$GH_STUB_ARGS" ]; then echo "$*" >> "$GH_STUB_ARGS"; fi',
        'if [ -n "$GH_STUB_SLEEP" ]; then sleep "$GH_STUB_SLEEP"; fi',
        'if [ -n "$GH_STUB_EXIT" ]; then echo "stub gh failed" >&2; exit "$GH_STUB_EXIT"; fi',
        'if [ -n "$GH_STUB_OUT" ]; then cat "$GH_STUB_OUT"; exit 0; fi',
        `printf '{"number":42,"headRefOid":"%s","baseRefName":"main","headRepository":{"name":"r"}}\\n' "$(git rev-parse HEAD)"`,
        "",
      ].join("\n"), { mode: 0o755 });
      const mrun = (command, { cwd, env = newEnv(), raw = null, pm, extraEnv = {}, gate = MERGE_GATE, py = "python3" } = {}) => {
        const body = { tool_name: "Bash", session_id: "ms", cwd, tool_input: { command } };
        if (pm) body.permission_mode = pm;
        const input = raw !== null ? raw : JSON.stringify(body);
        const t0 = Date.now();
        const r = spawnSync(py, [gate], { input, encoding: "utf8", timeout: 30_000, env: { ...env0, PATH: `${stubBin}:${env0.PATH}`, CLAUDE_GUARD_DIR: env.gdir, PRO_DEV_STATE_DIR: env.sdir, ...extraEnv } });
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
        // NO_PROMPT_MODES fails closed: these three deny until an interactive ask check clears them.
        for (const pm of ["bypassPermissions", "dontAsk", "auto", "default", "plan", "acceptEdits", undefined]) {
          const noPrompt = ["bypassPermissions", "dontAsk", "auto"].includes(pm);
          r = mrun(`${MERGE} --match-head-commit ${head}`, { cwd: repo, env: MENF(), pm });
          add(`mg81 ${label} under ${pm ?? "no permission_mode"} ${noPrompt ? "denies" : "asks"}`, noPrompt ? "deny" : "ask", r, noPrompt ? denies(r) && /cannot show one/.test(r.text) : asks(r));
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
      add("mg84 could not run under bypass denies as high", "deny", r, denies(r) && /could-not-run/.test(r.log));

      // ---- review fixes: separators, eval, xargs, the pin, the deadline, the base --------
      for (const [id, cmd] of [["mg100 a single & before the merge", `git status & ${MERGE}`],
        ["mg101 |& before the merge", `echo x |& ${MERGE}`],
        ["mg102 eval of the merge", `eval "${MERGE}"`],
        ["mg103 eval with bare words", `eval ${MERGE}`],
        ["mg104 xargs with options", `echo 42 | xargs -n1 gh pr merge --squash`]]) {
        r = mrun(cmd, { cwd: highR, env: MENF() });
        add(id, "deny", r, denies(r));
      }
      for (const [id, cmd] of [["mg105 2>&1 is not a separator", "git status 2>&1; echo gh pr merge"],
        ["mg106 &> is not a separator", "git status &>/dev/null; echo gh pr merge"],
        ["mg107 xargs of something else", "echo x | xargs echo gh pr merge"]]) {
        r = mrun(cmd, { cwd: highR, env: MENF() });
        add(id, "silent", r, allowsQuiet(r));
      }
      r = mrun(`${MERGE} --match-head-commit ${lowH} --match-head-commit ${highH}`, { cwd: highR, env: MENF() });
      add("mg110 two different pins deny with a reason", "deny", r, denies(r) && /more than one|several|different/i.test(r.text) && /several pins PR \d+ [0-9a-f]{8}/.test(r.log));
      r = mrun(`${MERGE} --match-head-commit ${highH} --match-head-commit ${highH}`, { cwd: highR, env: MENF() });
      add("mg111 two identical pins that match HEAD ask", "ask", r, asks(r));
      r = mrun(`${MERGE} --match-head-commit ${highH} --match-head-commit=${lowH}`, { cwd: highR, env: MENF() });
      add("mg112 a last pin that is not HEAD denies", "deny", r, denies(r));

      {
        // a slow surface module under a short deadline is could-not-run, never a quiet allow
        const box = realpathSync(mkdtempSync(join(tmpdir(), "mg-slow-")));
        try {
          mkdirSync(join(box, "pro-ship"), { recursive: true });
          cpSync(join(ROOT, "plugins", "pro-ship", "scripts"), join(box, "pro-ship", "scripts"), { recursive: true });
          mkdirSync(join(box, "surf"));
          writeFileSync(join(box, "surf", "security_surface.py"), "import time\ndef diff_files(patch, repo=None):\n    time.sleep(8)\n    return {}\n");
          mkdirSync(join(box, "home"));
          const slow = { HOME: join(box, "home"), PRO_SHIP_SURFACE_DIR: join(box, "surf"), PRO_SHIP_MERGE_GATE_DEADLINE: "1" };
          r = mrun(MERGE, { cwd: lowR, env: MENF(), gate: join(box, "pro-ship", "scripts", "merge-gate.py"), extraEnv: slow });
          add("mg120 a deadline during classification asks as high", "ask, could-not-run logged", r, asks(r) && /could-not-run/.test(r.log) && r.ms < 6000);
          r = mrun(MERGE, { cwd: lowR, env: MENF(), pm: "bypassPermissions", gate: join(box, "pro-ship", "scripts", "merge-gate.py"), extraEnv: slow });
          add("mg120b a deadline under bypassPermissions denies", "deny, could-not-run logged", r, denies(r) && /could-not-run/.test(r.log) && r.ms < 6000);
        } finally { rmSync(box, { recursive: true, force: true }); }
      }

      {
        // a pushed feature branch: the base is the target branch, never the branch's own remote copy
        const remote = join(sandbox, `remote${++n}.git`);
        sh(sandbox, "init", "-q", "--bare", "-b", "main", remote);
        const pushed = newRepo();
        sh(pushed, "remote", "add", "origin", remote);
        sh(pushed, "push", "-q", "-u", "origin", "main");
        sh(pushed, "checkout", "-q", "-b", "feat");
        mkdirSync(join(pushed, ".github", "workflows"), { recursive: true });
        writeFileSync(join(pushed, ".github", "workflows", "ci.yml"), "name: ci\n");
        sh(pushed, "add", "-A");
        sh(pushed, "commit", "-q", "-m", "ci");
        sh(pushed, "push", "-q", "-u", "origin", "feat");
        r = mrun(MERGE, { cwd: pushed, env: MENF() });
        add("mg130 a fully pushed branch is classified, not could-not-run", "deny high workflows", r, denies(r) && /workflows/.test(r.text) && !/could-not-run/.test(r.log));
        writeFileSync(join(pushed, "README.md"), "docs\n");
        sh(pushed, "add", "-A");
        sh(pushed, "commit", "-q", "-m", "readme");
        r = mrun(MERGE, { cwd: pushed, env: MENF() });
        add("mg131 an unpushed docs commit on top of a pushed workflow change is still high", "deny high workflows", r, denies(r) && /workflows/.test(r.text));
      }

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

      // ---- the gate classifies the PR it is given (p0-hardening steps 2 to 5) ---------
      const prJson = (head, extra = {}) => JSON.stringify({ number: 42, headRefOid: head, baseRefName: "main", headRepository: { name: "r" }, ...extra });
      const fileOf = (content) => {
        const f = join(sandbox, `f${++n}`);
        writeFileSync(f, content);
        return f;
      };
      const readArgs = (f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
      // a high PR (workflow change) whose repo sits on main, so the local HEAD is not the PR head
      const prR = featRepo({ ".github/workflows/ci.yml": "name: ci\non: push\n" });
      const prH = sha(prR);
      const prLowR = featRepo({ "README.md": "hi there\n" });
      const prLowH = sha(prLowR);
      sh(prR, "checkout", "-q", "main");
      sh(prLowR, "checkout", "-q", "main");
      const mainH = sha(prR);
      const prOut = fileOf(prJson(prH));
      const prLowOut = fileOf(prJson(prLowH));
      const stub = (out, extra = {}) => ({ GH_STUB_OUT: out, ...extra });

      r = mrun(MERGE, { cwd: prR, env: MWARN(), extraEnv: stub(prOut) });
      add("mg200 a merge from main reports the PR's tier, number and head", "message", r,
        allowsMsg(r) && /high/.test(r.text) && r.text.includes("42") && r.text.includes(prH) && !/could-not-run/.test(r.log) && r.log.includes("PR 42"));
      r = mrun(`${MERGE} --match-head-commit ${prH}`, { cwd: prR, env: MENF(), extraEnv: stub(prOut) });
      add("mg201 the same in enforce with the pin asks", "ask", r, asks(r) && r.text.includes(prH) && r.log.includes(`PR 42 ${prH.slice(0, 8)}`));
      r = mrun(MERGE, { cwd: prLowR, env: MENF(), extraEnv: stub(prLowOut) });
      add("mg202 a README-only PR head from main allows silently", "silent", r, allowsQuiet(r));

      {
        const af = join(sandbox, `args${++n}`);
        for (const [id, cmd] of [["mg203a gh pr view is not a merge", "gh pr view 42"], ["mg203b git push is not a merge", "git push"], ["mg203c an echo of a merge", "echo gh pr merge 42"]]) {
          r = mrun(cmd, { cwd: prR, env: MENF(), extraEnv: stub(prOut, { GH_STUB_ARGS: af }) });
          add(id, "silent, gh never called", r, allowsQuiet(r) && readArgs(af) === "");
        }
      }

      for (const [id, cmd, extraEnv, wantR, sel] of [
        ["mg210 -R before pr", "gh -R o/r pr merge 42 --squash", {}, "-R o/r", "42"],
        ["mg211 -R after merge", "gh pr merge 42 -R o/r --squash", {}, "-R o/r", "42"],
        ["mg212 --repo= after merge", "gh pr merge 42 --repo=o/r --squash", {}, "-R o/r", "42"],
        ["mg213 a PR URL needs no -R", "gh pr merge https://github.com/o/r/pull/42 --squash", {}, null, "https://github.com/o/r/pull/42"],
        ["mg214 GH_REPO prefixing the command", "GH_REPO=o/r gh pr merge 42 --squash", {}, "-R o/r", "42"],
        ["mg215 GH_REPO in the hook's environment", "gh pr merge 42 --squash", { GH_REPO: "o/r" }, "-R o/r", "42"],
        ["mg216 a flag value is not the selector", "gh pr merge -t subject -b body --match-head-commit abc1234 7 --squash", {}, null, "7"],
        ["mg218 export GH_REPO carries to the next segment", "export GH_REPO=o/r && gh pr merge 42 --squash", {}, "-R o/r", "42"],
        ["mg219 --repo= before pr", "gh --repo=o/r pr merge 42 --squash", {}, "-R o/r", "42"],
        ["mg217 no selector reads the current branch", "gh pr merge --squash", {}, null, ""],
      ]) {
        const af = join(sandbox, `args${++n}`);
        r = mrun(cmd, { cwd: prR, env: MWARN(), extraEnv: stub(prOut, { GH_STUB_ARGS: af, ...extraEnv }) });
        const got = readArgs(af).trim();
        const okR = wantR ? got.includes(wantR) : !/ -R /.test(got);
        const okSel = got.startsWith(`pr view ${sel}${sel ? " " : ""}--json`);
        add(id, "stub got pr view with the selector and repo", r, allowsMsg(r) && okR && okSel);
      }

      // the pin is compared with the PR head, never the local HEAD
      r = mrun(`${MERGE} --match-head-commit ${mainH}`, { cwd: prR, env: MENF(), extraEnv: stub(prOut) });
      add("mg240 a pin of the local main sha denies and names the PR head", "deny", r, denies(r) && r.text.includes(`--match-head-commit ${prH}`));
      r = mrun(`${MERGE} --match-head-commit ${prH}`, { cwd: prR, env: MENF(), extraEnv: stub(prOut) });
      add("mg241 a pin of the PR head asks", "ask", r, asks(r));

      // ---- gh api merges (step 4) -------------------------------------------------------
      {
        const af = join(sandbox, `args${++n}`);
        const hi = (extra = {}) => stub(prOut, { GH_STUB_ARGS: af, ...extra });
        r = mrun("gh api -X PUT repos/o/r/pulls/42/merge", { cwd: prR, env: MENF(), extraEnv: hi() });
        add("mg250 an api merge with no sha denies and names sha", "deny", r, denies(r) && /sha/.test(r.text) && r.text.includes(prH));
        r = mrun(`gh api -X PUT repos/o/r/pulls/42/merge -f sha=${prH}`, { cwd: prR, env: MENF(), extraEnv: hi() });
        add("mg251 an api merge with the head as sha asks", "ask", r, asks(r));
        r = mrun(`gh api --method PUT /repos/{owner}/{repo}/pulls/42/merge -F sha=${prH}`, { cwd: prR, env: MENF(), extraEnv: hi() });
        add("mg252 placeholders and a leading slash ask with no -R sent", "ask, no -R", r, asks(r) && !/ -R /.test(readArgs(af).split("\n").at(-2) || ""));
        r = mrun(`gh api -X PUT repos/o/r/pulls/42/merge -f sha=${mainH}`, { cwd: prR, env: MENF(), extraEnv: hi() });
        add("mg252b an api merge with a sha that is not the head denies", "deny", r, denies(r));
        for (const [id, cmd, want] of [
          ["mg250b a full URL with no sha", "gh api -X PUT https://api.github.com/repos/o/r/pulls/42/merge", "deny"],
          ["mg250c a query string with no sha", "gh api -X PUT repos/o/r/pulls/42/merge?x=1", "deny"],
          ["mg250d -XPUT with no sha", "gh api -XPUT repos/o/r/pulls/42/merge", "deny"],
          ["mg250e --method=PUT with no sha", "gh api --method=PUT repos/o/r/pulls/42/merge", "deny"],
          ["mg251b -XPUT with the head asks", `gh api -XPUT repos/o/r/pulls/42/merge -f sha=${prH}`, "ask"],
          ["mg251c --method=PUT and --field=sha= with the head asks", `gh api --method=PUT repos/o/r/pulls/42/merge --field=sha=${prH}`, "ask"],
          ["mg251d a full URL with the head asks", `gh api -X PUT https://api.github.com/repos/o/r/pulls/42/merge -f sha=${prH}`, "ask"],
          ["mg251e two different shas deny", `gh api -X PUT repos/o/r/pulls/42/merge -f sha=${prH} -f sha=${mainH}`, "deny"],
        ]) {
          r = mrun(cmd, { cwd: prR, env: MENF(), extraEnv: hi() });
          add(id, want, r, want === "deny" ? denies(r) : asks(r));
        }
        const af2 = join(sandbox, `args${++n}`);
        r = mrun("gh api -X GET repos/o/r/pulls/42/merge", { cwd: prR, env: MENF(), extraEnv: hi({ GH_STUB_ARGS: af2 }) });
        add("mg253 an explicit GET is silent", "silent", r, allowsQuiet(r) && readArgs(af2) === "");
        r = mrun("gh api repos/o/r/pulls/42", { cwd: prR, env: MENF(), extraEnv: hi({ GH_STUB_ARGS: af2 }) });
        add("mg254 another api path is silent", "silent", r, allowsQuiet(r) && readArgs(af2) === "");
        r = mrun("gh api graphql -f query='mutation { mergePullRequest(input: {}) { clientMutationId } }'", { cwd: prR, env: MENF(), extraEnv: hi() });
        add("mg255 a graphql merge asks as high", "ask, could-not-run logged", r, asks(r) && /could-not-run/.test(r.log));
        r = mrun("gh api graphql -f query='mutation { enablePullRequestAutoMerge(input: {}) { clientMutationId } }'", { cwd: prR, env: MENF(), extraEnv: hi() });
        add("mg256 a graphql auto-merge asks as high", "ask, could-not-run logged", r, asks(r) && /could-not-run/.test(r.log));
        r = mrun("gh api graphql -f query='query { viewer { login } }'", { cwd: prR, env: MENF(), extraEnv: hi({ GH_STUB_ARGS: af2 }) });
        add("mg257 a graphql query is silent", "silent", r, allowsQuiet(r) && readArgs(af2) === "");
        r = mrun(`gh api -X PUT repos/o/r/pulls/42/merge -f sha=${prLowH}`, { cwd: prLowR, env: MENF(), extraEnv: stub(prLowOut) });
        add("mg258 an api merge of a low PR allows silently", "silent", r, allowsQuiet(r));
      }

      // ---- ask per permission mode (step 11, probed headless on Claude Code 2.1.314) ------
      // The headless probe denied an ask in every mode, but it is a proxy: the set fails closed and
      // shrinks only after an interactive ask check per mode (Jody, 2026-10-30).
      const PROBED_NO_PROMPT = ["bypassPermissions", "dontAsk", "auto"];
      for (const [i, pm] of ["auto", "default", "acceptEdits", "plan", "dontAsk", "bypassPermissions"].entries()) {
        r = mrun(`${MERGE} --match-head-commit ${prH}`, { cwd: prR, env: MENF(), pm, extraEnv: stub(prOut) });
        const want = PROBED_NO_PROMPT.includes(pm) ? "deny" : "ask";
        add(`mg27${i} a high PR with the pin under ${pm} in enforce: ${want}`, want, r, want === "deny" ? denies(r) : asks(r));
      }

      // ---- --auto (step 5) ---------------------------------------------------------------
      r = mrun("gh pr merge 42 --auto --squash", { cwd: prR, env: MENF(), extraEnv: stub(prOut) });
      add("mg260 --auto at high with no pin denies and says GitHub refuses a moved head", "deny", r, denies(r) && /With --auto, GitHub refuses the merge if a later push changes the head/.test(r.text));
      r = mrun(`gh pr merge 42 --auto --squash --match-head-commit ${prH}`, { cwd: prR, env: MENF(), extraEnv: stub(prOut) });
      add("mg261 --auto with the pin asks", "ask", r, asks(r));
      r = mrun(MERGE, { cwd: prR, env: MENF(), extraEnv: stub(prOut) });
      add("mg262 a direct merge with no pin does not carry the --auto sentence", "deny", r, denies(r) && !/--auto/.test(r.text));

      // ---- the PR head is fetched when it is not local, and every failure is could-not-run ----
      // A work repo with a bare origin: the PR head is pushed as refs/pull/42/head only, then the
      // local branch, reflog and loose objects are removed so the commit is gone from the clone.
      const originRepo = ({ pushRef }) => {
        const bare = join(sandbox, `origin${++n}.git`);
        sh(sandbox, "init", "-q", "--bare", "-b", "main", bare);
        const work = newRepo();
        sh(work, "remote", "add", "origin", bare);
        sh(work, "push", "-q", "-u", "origin", "main");
        sh(work, "checkout", "-q", "-b", "feat");
        mkdirSync(join(work, ".github", "workflows"), { recursive: true });
        writeFileSync(join(work, ".github", "workflows", "ci.yml"), "name: ci\non: push\n");
        sh(work, "add", "-A");
        sh(work, "commit", "-q", "-m", "ci");
        const head = sha(work);
        if (pushRef) sh(work, "push", "-q", "origin", "feat:refs/pull/42/head");
        sh(work, "checkout", "-q", "main");
        sh(work, "branch", "-q", "-D", "feat");
        sh(work, "reflog", "expire", "--expire=now", "--all");
        sh(work, "gc", "-q", "--prune=now");
        return { work, head, gone: sh(work, "cat-file", "-e", `${head}^{commit}`).status !== 0 };
      };
      {
        const o = originRepo({ pushRef: true });
        const out = fileOf(prJson(o.head));
        const before = sh(o.work, "rev-parse", "--abbrev-ref", "HEAD").stdout + sh(o.work, "status", "--porcelain").stdout;
        r = mrun(MERGE, { cwd: o.work, env: MWARN(), extraEnv: stub(out) });
        const after = sh(o.work, "rev-parse", "--abbrev-ref", "HEAD").stdout + sh(o.work, "status", "--porcelain").stdout;
        add("mg220 a head missing locally is fetched from origin and classified, the tree untouched", "message high, no could-not-run", r,
          o.gone && allowsMsg(r) && /high/.test(r.text) && r.text.includes(o.head) && !/could-not-run/.test(r.log) && before === after);
        const o2 = originRepo({ pushRef: false });
        r = mrun(MERGE, { cwd: o2.work, env: MWARN(), extraEnv: stub(fileOf(prJson(o2.head))) });
        add("mg221 no refs/pull/42/head on origin is could-not-run", "message unknown", r,
          o2.gone && allowsMsg(r) && /unknown/.test(r.text) && /could-not-run/.test(r.log) && /fetch failed/.test(r.log));
      }

      {
        // a fetch that hangs is could-not-run (the gate's own fetch timeout is 8 seconds)
        const o3 = originRepo({ pushRef: true });
        const slowGit = join(sandbox, `slowgit${++n}`);
        mkdirSync(slowGit, { recursive: true });
        const realGit = spawnSync("which", ["git"], { encoding: "utf8", env: env0 }).stdout.trim();
        writeFileSync(join(slowGit, "git"), `#!/bin/sh\nif [ "$3" = fetch ]; then sleep 12; exit 1; fi\nexec ${realGit} "$@"\n`, { mode: 0o755 });
        r = mrun(MERGE, { cwd: o3.work, env: MENF(), extraEnv: { ...stub(fileOf(prJson(o3.head))), PATH: `${slowGit}:${stubBin}:${env0.PATH}` } });
        add("mg222 a fetch that times out is could-not-run and asks as high", "ask, could-not-run logged", r,
          o3.gone && asks(r) && /fetch failed/.test(r.log) && /could-not-run/.test(r.log) && r.ms < 20_000);
      }

      {
        // a stale local base: main moved on origin (a workflow change merged), the local copy did not
        const bare = join(sandbox, `origin${++n}.git`);
        sh(sandbox, "init", "-q", "--bare", "-b", "main", bare);
        const work = newRepo();
        sh(work, "remote", "add", "origin", bare);
        sh(work, "push", "-q", "-u", "origin", "main");
        const old = sha(work);
        mkdirSync(join(work, ".github", "workflows"), { recursive: true });
        writeFileSync(join(work, ".github", "workflows", "ci.yml"), "name: ci\non: push\n");
        sh(work, "add", "-A");
        sh(work, "commit", "-q", "-m", "ci on main");
        const tip = sha(work);
        sh(work, "checkout", "-q", "-b", "feat");
        writeFileSync(join(work, "README.md"), "docs\n");
        sh(work, "add", "-A");
        sh(work, "commit", "-q", "-m", "readme");
        const head = sha(work);
        sh(work, "update-ref", "refs/remotes/origin/main", old);
        sh(work, "branch", "-q", "-f", "main", old);
        const withBase = fileOf(prJson(head, { baseRefOid: tip }));
        r = mrun(MERGE, { cwd: work, env: MENF(), extraEnv: stub(withBase) });
        add("mg223 the PR is classified against the base tip GitHub reports, not a stale local base", "silent (low)", r, allowsQuiet(r));
        r = mrun(MERGE, { cwd: work, env: MENF(), extraEnv: stub(fileOf(prJson(head))) });
        add("mg224 without baseRefOid the stale local base still reads high (the gap the field closes)", "deny high", r, denies(r) && /workflows/.test(r.text));
      }

      {
        const gitOnly = join(sandbox, `gitonly${++n}`);
        mkdirSync(gitOnly, { recursive: true });
        const gitPath = spawnSync("which", ["git"], { encoding: "utf8", env: env0 }).stdout.trim();
        symlinkSync(gitPath, join(gitOnly, "git"));
        const py = spawnSync("which", ["python3"], { encoding: "utf8", env: env0 }).stdout.trim();
        const noJson = fileOf("not json");
        const noOid = fileOf(JSON.stringify({ number: 42, baseRefName: "main" }));
        const badBase = fileOf(prJson(prH, { baseRefName: "no-such-branch" }));
        for (const [id, why, opts] of [
          ["mg230 gh missing", /gh not found/, { py, extraEnv: { PATH: gitOnly } }],
          ["mg231 gh exits 1", /gh exited 1/, { extraEnv: stub(prOut, { GH_STUB_EXIT: "1" }) }],
          ["mg232 gh prints text that is not JSON", /gh output not JSON/, { extraEnv: stub(noJson) }],
          ["mg233 gh sleeps past the timeout", /gh timed out/, { extraEnv: stub(prOut, { GH_STUB_SLEEP: "8" }) }],
          ["mg234 JSON with no headRefOid", /PR head missing/, { extraEnv: stub(noOid) }],
          ["mg235 a base that resolves nowhere", /base no-such-branch not found/, { extraEnv: stub(badBase) }],
        ]) {
          r = mrun(MERGE, { cwd: prR, env: MENF(), ...opts });
          add(`${id} asks in enforce`, "ask, could-not-run logged", r, asks(r) && why.test(r.log) && /could-not-run/.test(r.log) && r.ms < 20_000);
          r = mrun(MERGE, { cwd: prR, env: MWARN(), ...opts });
          add(`${id} says unknown in warn`, "message unknown", r, allowsMsg(r) && /unknown/.test(r.text) && /could-not-run/.test(r.log));
        }
      }
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
