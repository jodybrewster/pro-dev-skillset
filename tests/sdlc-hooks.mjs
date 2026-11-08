#!/usr/bin/env node
// Behaviour test for the pro-ai-sdlc hooks: protect-tests, plan-sync,
// production-gate and change-id. Drives each script the way Claude Code does (one process per
// case, the JSON payload on stdin) against a disposable sandbox, with
// CLAUDE_GUARD_DIR pointing at a throwaway mode directory so the real
// ~/.claude/hooks log and mode files are never touched.
//
//   node tests/sdlc-hooks.mjs
//
// Also exported as runSdlcHookCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const S = (f) => join(ROOT, "plugins", "pro-ai-sdlc", "scripts", f);

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
}

function run(script, payload, { mode = null, env = {}, raw = null, modes = {} } = {}) {
  const guardDir = mkdtempSync(join(tmpdir(), "sdlc-guard-"));
  if (mode) writeFileSync(join(guardDir, "mode"), mode + "\n");
  for (const [name, value] of Object.entries(modes)) writeFileSync(join(guardDir, `mode.${name}`), value + "\n");
  const input = raw !== null ? raw : JSON.stringify(payload);
  const r = spawnSync("python3", [S(script)], {
    input, encoding: "utf8", timeout: 30_000,
    env: { ...process.env, CLAUDE_GUARD_DIR: guardDir, RELEASE_APPROVAL: "", ...env },
  });
  const logPath = join(guardDir, "warn.log");
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  rmSync(guardDir, { recursive: true, force: true });
  let json = null;
  try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* not json */ }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr, log };
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
    // test lock written by /execute: listed files frozen, new test files free
    const lock = join(sandbox, "lock");
    mkdirSync(join(lock, ".claude"), { recursive: true });
    mkdirSync(join(lock, "tests"), { recursive: true });
    writeFileSync(join(lock, ".claude", "test-lock"), "tests/a.js\nsrc/b.test.js\n");
    r = run("protect-tests.py", edit(lock, join(lock, "tests", "a.js")));
    add("pt9 warn mode flags an edit to a locked test and allows", "warn", r, warned(r));
    r = run("protect-tests.py", edit(lock, join(lock, "src", "b.test.js")), { mode: "enforce" });
    add("pt10 enforce mode blocks an edit to a locked test", "block", r, r.status === 2);
    r = run("protect-tests.py", edit(lock, join(lock, "tests", "new.js")), { mode: "enforce" });
    add("pt11 a test file not in the lock stays free", "allow", r, r.status === 0 && !r.stdout);
    r = run("protect-tests.py", edit(lock, join(lock, "src", "c.js")), { mode: "enforce" });
    add("pt12 a source file stays free under a test lock", "allow", r, r.status === 0 && !r.stdout);
    // CLAUDE_GUARD_MODE beats a mode file
    r = run("protect-tests.py", edit(lock, join(lock, "tests", "a.js")), { mode: "warn", env: { CLAUDE_GUARD_MODE: "enforce" } });
    add("pt13 env enforce beats a warn mode file", "block", r, r.status === 2);
    r = run("protect-tests.py", edit(lock, join(lock, "tests", "a.js")), { mode: "enforce", env: { CLAUDE_GUARD_MODE: "warn" } });
    add("pt14 env warn beats an enforce mode file", "warn", r, warned(r));
    r = run("protect-tests.py", edit(lock, join(lock, "tests", "a.js")), { mode: "enforce", env: { CLAUDE_GUARD_MODE: "bogus" } });
    add("pt15 an invalid env value falls back to the mode file", "block", r, r.status === 2);
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

    // plan-sync: a ## Done written at one head goes stale when code changes after it
    const commit = (cwd, msg) => git(cwd, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-q", "-am", msg);
    const head = (cwd) => git(cwd, "rev-parse", "HEAD").stdout.trim();
    const stale = join(sandbox, "stale");
    const planPath = join(stale, "intent", "2026-01-01-x", "plan.md");
    mkdirSync(dirname(planPath), { recursive: true });
    writeFileSync(planPath, "# Plan\n\n## Done\n\nFilled in when the build is finished.\n");
    writeFileSync(join(stale, "app.js"), "1\n");
    git(stale, "init", "-q", "-b", "main");
    git(stale, "add", "-A");
    commit(stale, "init");
    git(stale, "checkout", "-q", "-b", "build");
    writeFileSync(join(stale, "app.js"), "2\n");
    commit(stale, "build");
    r = run("plan-sync.py", stop(stale), { mode: "enforce" });
    add("sd1 a plan with no Done as of line behaves as today on a branch with code commits", "allow", r, r.status === 0 && !r.stdout);
    const built = head(stale);
    writeFileSync(planPath, `# Plan\n\n## Done\n\nDone as of ${built.slice(0, 12)}\n\n- Build commit: ${built.slice(0, 12)}\n`);
    r = run("plan-sync.py", stop(stale), { mode: "enforce" });
    add("sd2 Done as of the current head is not stale", "allow", r, r.status === 0 && !r.stdout);
    commit(stale, "plan: done");
    r = run("plan-sync.py", stop(stale), { mode: "enforce" });
    add("sd3 committing the plan alone after Done does not make it stale", "allow", r, r.status === 0 && !r.stdout);
    writeFileSync(join(stale, "app.js"), "3\n");
    commit(stale, "fix after done");
    const later = head(stale);
    const want = `## Done is stale (written at ${built.slice(0, 12)}, head is ${later.slice(0, 12)})`;
    r = run("plan-sync.py", stop(stale));
    add("sd4 warn mode reports a stale Done after a later code commit and does not block", "warn", r, warned(r) && !r.json?.decision && r.json.systemMessage.includes(want));
    add("sd5 warn mode logs the stale Done to warn.log", "logged", r, r.log.includes("would-block") && r.log.includes(want));
    r = run("plan-sync.py", stop(stale), { modes: { "stale-done": "enforce" } });
    add("sd6 mode.stale-done enforce blocks once on a stale Done", "block", r, r.json?.decision === "block" && r.json.reason.includes(want));
    r = run("plan-sync.py", stop(stale), { mode: "enforce", modes: { "plan-sync": "enforce" }, env: { CLAUDE_GUARD_MODE: "enforce" } });
    add("sd10 enforce in mode, mode.plan-sync and CLAUDE_GUARD_MODE with no mode.stale-done only warns", "warn", r, warned(r) && !r.json?.decision && r.json.systemMessage.includes(want));
    r = run("plan-sync.py", stop(stale, { stop_hook_active: true }), { modes: { "stale-done": "enforce" } });
    add("sd7 the second stop passes", "allow", r, r.status === 0 && !r.stdout);
    writeFileSync(join(stale, "intent", "2026-01-01-x", "notes.md"), "x\n");
    git(stale, "add", "-A");
    writeFileSync(planPath, `# Plan\n\n## Done\n\nDone as of ${later.slice(0, 12)}\n`);
    commit(stale, "plan: done again");
    r = run("plan-sync.py", stop(stale), { mode: "enforce" });
    add("sd8 Done rewritten at the new head clears it", "allow", r, r.status === 0 && !r.stdout);
    writeFileSync(join(stale, "app.js"), "4\n");
    commit(stale, "another fix");
    writeFileSync(planPath, `# Plan\n\n## Done\n\nFilled in when the build is finished, before sign-off.\n\n- Done as of \`${later.slice(0, 12)}\`\n- Build commit: x\n\n## Departures from plan\n`);
    commit(stale, "plan: lead sentence and a bullet");
    r = run("plan-sync.py", stop(stale), { modes: { "stale-done": "enforce" } });
    add("sd11 a bulleted, backticked Done as of under the lead sentence is still read", "block", r, r.json?.decision === "block" && r.json.reason.includes(`written at ${later.slice(0, 12)}`));
    const mod = join(stale, "intent", "2026-01-02-y", "plan-m1.md");
    mkdirSync(dirname(mod), { recursive: true });
    writeFileSync(planPath, "# Plan\n\n## Done\n\nNot yet.\n");
    writeFileSync(mod, `# Plan m1\n\n## Done\n\nDone as of ${later.slice(0, 12)}\n`);
    git(stale, "add", "-A");
    commit(stale, "plan-m1: done");
    r = run("plan-sync.py", stop(stale), { modes: { "stale-done": "enforce" } });
    add("sd12 a plan-m1.md beside plan.md is read for a stale Done", "block", r, r.json?.decision === "block" && r.json.reason.includes("plan-m1.md"));
    writeFileSync(join(stale, "app.js"), "5\n");
    writeFileSync(mod, `# Plan m1\n\n## Done\n\nDone as of ${head(stale).slice(0, 12)}\n\nDeparture noted.\n`);
    r = run("plan-sync.py", stop(stale), { mode: "enforce" });
    add("sd13 a changed plan-m1.md counts as the plan touched", "allow", r, r.status === 0 && !r.stdout);
    writeFileSync(planPath, "# Plan\n\n## Done\n\nDone as of 0123456789ab\n");
    writeFileSync(mod, "# Plan m1\n");
    commit(stale, "plan: unknown sha");
    r = run("plan-sync.py", stop(stale), { mode: "enforce", modes: { "stale-done": "enforce" } });
    add("sd9 a Done sha the repo does not have passes", "allow", r, r.status === 0 && !r.stdout);

    // change-id (traceable-ids m2, R11 to R14): a commit subject on an id branch starts with the id.
    const branchRepo = (name, branch) => {
      const dir = join(sandbox, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "a.txt"), "1\n");
      git(dir, "init", "-q", "-b", "main");
      git(dir, "add", "-A");
      git(dir, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "init");
      if (branch !== "main") git(dir, "checkout", "-q", "-b", branch);
      return dir;
    };
    const idRepo = branchRepo("ids", "TST-4/build");
    const featRepo = branchRepo("feat", "feature/x");
    const ci = (cwd, cmd, opts) => run("change-id.py", bash(cwd, cmd), opts);
    const ENF = { modes: { "change-id": "enforce" } };
    const silent = (r) => r.status === 0 && !r.stdout && !r.log;
    const denied = (r) => r.json?.hookSpecificOutput?.permissionDecision === "deny"
      && r.json.hookSpecificOutput.permissionDecisionReason.includes('commit subject must start with "TST-4: " on branch TST-4/build');
    const ciWarned = (r) => warned(r) && !r.json?.hookSpecificOutput?.permissionDecision && /\tchange-id\twould-deny\t/.test(r.log);
    r = ci(idRepo, 'git commit -m "no id"');
    add("ci1 warn mode (no mode.change-id) logs change-id and allows a subject with no id", "warn", r, ciWarned(r) && r.json.systemMessage.includes("TST-4: "));
    r = ci(idRepo, 'git commit -m "no id"', ENF);
    add("ci2 mode.change-id enforce denies with the reason", "deny", r, denied(r));
    r = ci(idRepo, 'git commit -m "TST-4: ok"', ENF);
    add("ci3 a subject that starts with the id allows silently", "allow", r, silent(r));
    r = ci(idRepo, "git add -A && git commit -m \"$(cat <<'EOF'\nTST-4: ok\n\nA body line.\nEOF\n)\"", ENF);
    add("ci4 a quoted heredoc message that starts with the id allows", "allow", r, silent(r));
    r = ci(idRepo, 'git commit -m "$(cat <<EOF\n\nno id here\n\nTST-4: later line\nEOF\n)"', ENF);
    add("ci5 an unquoted heredoc is read from its first non-empty line", "deny", r, denied(r));
    // Review of PR 200: the hook steps back when the command moves branch first or the message is a shell expansion.
    r = ci(idRepo, 'git switch -c feature/x && git commit -m "wip"', ENF);
    add("ci18 a git switch earlier in the command allows, since the commit lands on another branch", "allow", r, silent(r));
    r = ci(idRepo, 'git checkout feature/x && git commit -m "wip"', ENF);
    add("ci19 a git checkout of a branch earlier in the command allows", "allow", r, silent(r));
    r = ci(idRepo, 'git commit -m "$MSG"', ENF);
    add("ci20 a message that is a shell variable allows, since its value is not known here", "allow", r, silent(r));
    r = ci(idRepo, 'git checkout -- src/a.py && git commit -m "no id"', ENF);
    add("ci21 a git checkout of a path is not a branch move and the commit is still judged", "deny", r, denied(r));
    r = ci(idRepo, 'git checkout -b TST-9/fix-1.2 && git commit -m "TST-9: x"', ENF);
    add("ci22 a checkout -b of a dotted branch name is a move and the commit is not judged here", "allow", r, silent(r));
    r = ci(idRepo, 'git switch - && git commit -m "chore: x"', ENF);
    add("ci23 git switch - is a move", "allow", r, silent(r));
    r = ci(idRepo, 'git -C . switch -c TST-9/build && git -C . commit -m "TST-9: x"', ENF);
    add("ci24 git -C dir switch is a move", "allow", r, silent(r));
    r = ci(idRepo, '/usr/bin/git switch feature/x && git commit -m "x"', ENF);
    add("ci25 a full path to git is still git", "allow", r, silent(r));
    for (const [id, cmd] of [["ci6", "git commit"], ["ci7", "git commit -F msg.txt"], ["ci8", "git commit --amend --no-edit"], ["ci9", "git commit -C HEAD"], ["ci10", "git commit -F - <<'EOF'\nno id\nEOF"]]) {
      r = ci(idRepo, cmd, ENF);
      add(`${id} ${cmd.split("\n")[0]} has no message to read and allows silently`, "allow", r, silent(r));
    }
    r = ci(repo, 'git commit -m "no id"', { ...ENF, mode: "enforce" });
    add("ci11 on main nothing is logged", "allow", r, silent(r));
    r = ci(featRepo, 'git commit -m "no id"', ENF);
    add("ci12 on feature/x nothing is logged", "allow", r, silent(r));
    r = run("change-id.py", null, { raw: "{", ...ENF });
    add("ci13 a payload of { exits 0 and logs could-not-parse", "allow", r, r.status === 0 && !r.stdout && /\tchange-id\tcould-not-parse\t/.test(r.log));
    r = run("change-id.py", null, { raw: "", ...ENF });
    add("ci14 an empty payload exits 0", "allow", r, r.status === 0 && !r.stdout);
    r = ci(idRepo, 'git commit -m "no id"', { mode: "enforce" });
    add("ci15 a global mode file of enforce with no mode.change-id only warns", "warn", r, ciWarned(r));
    r = ci(idRepo, 'git commit -m "no id"', { env: { CLAUDE_GUARD_MODE: "enforce" } });
    add("ci16 CLAUDE_GUARD_MODE=enforce with no mode.change-id only warns", "warn", r, ciWarned(r));
    r = ci(idRepo, 'git commit -m "no id"', { mode: "enforce", modes: { "change-id": "warn" }, env: { CLAUDE_GUARD_MODE: "enforce" } });
    add("ci17 mode.change-id holding warn stays in warn under every other enforce", "warn", r, ciWarned(r));
    r = ci(free, `git -C ${idRepo} commit -m "no id"`, ENF);
    add("ci18 git -C reads the branch of the directory it names", "deny", r, denied(r));
    r = ci(free, `cd ${idRepo} && git commit -m "no id"`, ENF);
    add("ci19 a cd earlier in the command moves where the branch is read", "deny", r, denied(r));
    r = ci(idRepo, 'git commit -am "no id"', ENF);
    add("ci20 -am reads the message after the cluster", "deny", r, denied(r));
    r = ci(idRepo, 'git commit --message="TST-4: ok" -m "second paragraph"', ENF);
    add("ci21 --message= is read and the first message is the subject", "allow", r, silent(r));
    r = ci(idRepo, 'git commit -m "TST-5: other"', ENF);
    add("ci22 another change's id is not this branch's id", "deny", r, denied(r));
    r = ci(idRepo, 'echo "git commit -m no id"', ENF);
    add("ci23 git commit inside quoted text is not a commit", "allow", r, silent(r));
    r = ci(idRepo, "ls -la", ENF);
    add("ci24 an ordinary command allows silently", "allow", r, silent(r));
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
