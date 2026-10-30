#!/usr/bin/env node
// Behaviour test for the pro-security push gate (push-gate.py) and the shared
// diff classifier (security_surface.py).
//
// check.mjs proves the hook is wired and the scripts exist. This drives the
// real scripts the way Claude Code does - one process per case, the hook payload
// on stdin - and asserts what they emit. Every case must exit 0 (the hook fails
// open and never uses exit 2); the decision lives in the JSON on stdout.
//
//   node tests/security-hooks.mjs
//   node tests/security-hooks.mjs --only=push-gate     # substring filter on case id
//
// Cases within a group share per-session state on purpose (a deny followed by
// the identical retry), so --only is meant for whole groups, not single cases.
// tests/check.mjs can import `runSecurityHookCases()`; its result shape matches
// runGitSafeCases() in tests/git-safe.mjs.
//
// State files live in a temp dir (PRO_DEV_STATE_DIR), git repos are throwaway
// and push cases get a bare repo as `origin`. Zero dependencies, no network.
// Skips cleanly when python3 or git is not on PATH.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-security", "scripts");
const S = (n) => join(SCRIPTS, n);

const NONE = "none";
const DENY = "deny";

function run(script, payload, env) {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  const res = spawnSync("python3", [S(script)], { input, encoding: "utf8", timeout: 30_000, env: { ...process.env, ...env } });
  return res;
}

function classifyOutput(res) {
  if (res.error) return { actual: `error:${res.error.message}`, detail: "" };
  if (res.status !== 0) return { actual: `exit${res.status}`, detail: res.stderr || "" };
  const out = (res.stdout || "").trim();
  if (!out) return { actual: NONE, detail: "" };
  try {
    const j = JSON.parse(out);
    if (j.hookSpecificOutput?.permissionDecision === "deny") return { actual: DENY, detail: j.hookSpecificOutput.permissionDecisionReason, json: j };
    return { actual: "unknown-json", detail: out };
  } catch {
    return { actual: "bad-json", detail: out };
  }
}

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout;
}

function makeRepo(base) {
  const dir = realpathSync(mkdtempSync(join(base, "repo-")));
  sh("git", ["init", "-q", "-b", "main"], dir);
  sh("git", ["config", "user.email", "t@example.com"], dir);
  sh("git", ["config", "user.name", "T"], dir);
  sh("git", ["config", "commit.gpgsign", "false"], dir);
  writeFileSync(join(dir, "README.txt"), "base\n");
  writeFileSync(join(dir, "style.css"), "a { color: red; }\n");
  sh("git", ["add", "."], dir);
  sh("git", ["commit", "-q", "-m", "base"], dir);
  return dir;
}

// A repo whose `origin` is a bare repo in the temp dir, with main pushed and set as upstream.
function makeRepoWithOrigin(base) {
  const dir = makeRepo(base);
  const bare = realpathSync(mkdtempSync(join(base, "origin-")));
  sh("git", ["init", "-q", "--bare", "-b", "main"], bare);
  sh("git", ["remote", "add", "origin", bare], dir);
  sh("git", ["push", "-q", "-u", "origin", "main"], dir);
  return dir;
}

function write(dir, rel, body) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
  return p;
}

const JWT_CODE = 'import jwt from "jsonwebtoken";\nexport function POST(req) { return jwt.sign({ id: 1 }, process.env.JWT_SECRET); }\n';

export function runSecurityHookCases({ only = null } = {}) {
  const out = { skipped: null, selected: [], results: [] };
  for (const bin of ["python3", "git"]) {
    if (spawnSync(bin, ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: `${bin} not found on PATH` };
  }
  for (const f of ["security_surface.py", "push-gate.py"]) {
    if (!existsSync(S(f))) return { ...out, skipped: `${S(f)} not found` };
  }

  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "sec-hooks-")));
  const stateDir = join(tmp, "state");
  const env = { PRO_DEV_STATE_DIR: stateDir };
  const cases = [];
  const add = (id, expect, fn) => cases.push({ id, expect, fn });

  // ── classifier ─────────────────────────────────────────────────────────
  const classify = (text, flag) => {
    const r = spawnSync("python3", [S("security_surface.py"), ...(flag ? [flag] : [])], { input: text, encoding: "utf8" });
    return { status: r.status, actual: (r.stdout || "").trim().split("\n").filter(Boolean).join("+") || NONE, detail: r.stderr };
  };
  const dcls = (id, diff, expect) => add(`classifier/diff-${id}`, expect, () => classify(diff, "--diff"));
  dcls("empty", "", NONE);
  dcls("version-bump", 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -1,3 +1,3 @@\n {\n-  "version": "1.0.0",\n+  "version": "1.0.1",\n   "name": "x"\n', NONE);
  dcls("new-dep", 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -5,3 +5,4 @@\n   "dependencies": {\n+    "left-pad": "^1.3.0",\n     "react": "^18.0.0"\n', "dependencies");
  dcls("dep-bump", 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -5,3 +5,3 @@\n-    "react": "^18.0.0"\n+    "react": "^18.2.0"\n', NONE);
  dcls("md-with-jwt", "diff --git a/docs/auth.md b/docs/auth.md\n--- a/docs/auth.md\n+++ b/docs/auth.md\n@@ -1 +1,2 @@\n+We verify the JWT and bcrypt the password with eval(\n", NONE);
  dcls("workflow", "diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml\n--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@ -1 +1,2 @@\n+name: ci\n", "ci-infra");
  dcls("env-example", "diff --git a/.env.example b/.env.example\n--- a/.env.example\n+++ b/.env.example\n@@ -1 +1,2 @@\n+FOO=bar\n", NONE);
  dcls("sql-interpolation", 'diff --git a/src/db.ts b/src/db.ts\n--- a/src/db.ts\n+++ b/src/db.ts\n@@ -1 +1,2 @@\n+const q = `SELECT * FROM users WHERE id = ${id}`;\n', "injection");

  // ── push-gate ──────────────────────────────────────────────────────────
  const pg = (sid, cwd, command) => run("push-gate.py", { session_id: sid, cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } }, env);
  const PUSH = "git push -u origin feat";
  const branch = (repo, name = "feat") => sh("git", ["checkout", "-q", "-b", name], repo);
  const commitAll = (repo, msg = "change") => { sh("git", ["add", "."], repo); sh("git", ["commit", "-q", "-m", msg], repo); };

  const r1 = makeRepoWithOrigin(tmp);
  branch(r1);
  write(r1, "style.css", "a { color: blue; }\nb { margin: 0; }\n");
  commitAll(r1);
  add("push-gate/css-only-push-passes", NONE, () => pg("pg1", r1, PUSH));

  const r2 = makeRepoWithOrigin(tmp);
  branch(r2);
  write(r2, "notes.md", "# Auth\n\nWe hash passwords with bcrypt and sign a JWT. Beware eval( and dangerouslySetInnerHTML.\n");
  write(r2, "docs/security.md", "Stripe webhook signature verification and OAuth.\n");
  commitAll(r2);
  add("push-gate/markdown-about-security-passes", NONE, () => pg("pg2", r2, PUSH));

  const r3 = makeRepoWithOrigin(tmp);
  branch(r3);
  write(r3, "src/app/api/login/route.ts", JWT_CODE);
  commitAll(r3, "login");
  add("push-gate/auth-push-denied", DENY, () => {
    const r = pg("pg3", r3, PUSH);
    const c = classifyOutput(r);
    const ok = /auth/.test(c.detail) && /src\/app\/api\/login\/route\.ts/.test(c.detail) && /security-architect/.test(c.detail)
      && /diff mode on this diff and nothing else/.test(c.detail) && /git -C .* diff origin\/main\.\.\.HEAD/.test(c.detail);
    return ok ? r : { status: r.status, stdout: "", stderr: `reason missing pieces: ${c.detail}` };
  });
  add("push-gate/identical-retry-passes", NONE, () => pg("pg3", r3, PUSH));
  add("push-gate/other-session-denied-again", DENY, () => pg("pg3-other", r3, PUSH));
  add("push-gate/chain-with-env-and-C-denied", DENY, () => pg("pg3c", tmp, `cd /nonexistent; FOO=1 git -C ${r3} push --force-with-lease origin feat && echo done`));
  add("push-gate/bare-push-denied", DENY, () => pg("pg3d", r3, "git push"));
  add("push-gate/dry-run-passes", NONE, () => pg("pg3e", r3, "git push --dry-run origin feat"));
  add("push-gate/new-commit-is-a-new-diff", DENY, () => {
    write(r3, "src/app/api/logout/route.ts", JWT_CODE);
    commitAll(r3, "logout");
    return pg("pg3", r3, PUSH);
  });

  // An existing upstream wins over origin/main: only commits not yet on it are judged.
  const rU = makeRepoWithOrigin(tmp);
  branch(rU);
  write(rU, "src/app/api/login/route.ts", JWT_CODE);
  commitAll(rU, "login");
  sh("git", ["push", "-q", "-u", "origin", "feat"], rU);
  write(rU, "style.css", "a { color: teal; }\n");
  commitAll(rU, "css");
  add("push-gate/upstream-diff-only-new-commits-passes", NONE, () => pg("pgU", rU, "git push"));

  // git commit is never gated, staged or not.
  const r4 = makeRepoWithOrigin(tmp);
  branch(r4);
  write(r4, "src/app/api/login/route.ts", JWT_CODE);
  sh("git", ["add", "."], r4);
  add("push-gate/commit-with-staged-auth-passes", NONE, () => pg("pg4", r4, 'git commit -m "wip"'));
  add("push-gate/commit-am-passes", NONE, () => pg("pg4b", r4, 'git commit -am "wip"'));
  add("push-gate/commit-amend-passes", NONE, () => pg("pg4c", r4, "git commit --amend --no-edit"));

  const r5 = makeRepoWithOrigin(tmp);
  branch(r5, "feat/login");
  write(r5, "src/auth/login.ts", JWT_CODE);
  commitAll(r5, "login");
  const PR = 'gh pr create --title "Login" --body "x"';
  add("push-gate/pr-create-with-auth-change-denied", DENY, () => pg("pg5", r5, PR));
  add("push-gate/pr-create-retry-passes", NONE, () => pg("pg5", r5, PR));
  add("push-gate/pr-create-on-main-passes", NONE, () => {
    sh("git", ["checkout", "-q", "main"], r5);
    return pg("pg5b", r5, "gh pr create --fill");
  });

  // No upstream and no origin/main: nothing to diff against. The local `main` ref is
  // also a fallback base, so the fixture renames the only branch away from main.
  const rN = makeRepo(tmp);
  branch(rN);
  write(rN, "src/app/api/login/route.ts", JWT_CODE);
  commitAll(rN, "login");
  sh("git", ["branch", "-q", "-D", "main"], rN);
  add("push-gate/no-upstream-and-no-origin-main-passes", NONE, () => pg("pgN", rN, PUSH));

  const rM = makeRepo(tmp);
  write(rM, "src/app/api/login/route.ts", JWT_CODE);
  commitAll(rM, "login");
  add("push-gate/no-remote-on-main-passes", NONE, () => pg("pgM", rM, "git push"));

  const nonGit = realpathSync(mkdtempSync(join(tmp, "nongit-")));
  add("push-gate/non-git-cwd-passes", NONE, () => pg("pg7", nonGit, PUSH));
  add("push-gate/git-status-passes", NONE, () => pg("pg8", r3, "git status"));
  add("push-gate/git-log-with-push-word-passes", NONE, () => pg("pg9", r3, 'git log --grep="push"'));
  add("push-gate/malformed-stdin-passes", NONE, () => run("push-gate.py", "{", env));
  add("push-gate/empty-command-passes", NONE, () => pg("pg10", r3, ""));

  // pr-check stamp (docs/pr-check-stamp.md): a valid stamp whose security reviewer ran is accepted
  const FIX = join(ROOT, "tests", "fixtures", "pr-check-stamp");
  const sha = (repo) => sh("git", ["rev-parse", "HEAD"], repo).trim();
  const stampRepo = (text) => {
    const r = makeRepoWithOrigin(tmp);
    branch(r);
    write(r, "src/app/api/login/route.ts", JWT_CODE);
    commitAll(r, "login");
    if (text !== null) write(r, ".pro-dev/ship/pr-check.json", text.split("HEAD").join(sha(r)));
    return r;
  };
  add("push-gate/stamp-missing-denied", DENY, () => pg("pgS0", stampRepo(null), PUSH));
  const expectFile = join(FIX, "expect.json");
  if (existsSync(expectFile)) {
    const expected = JSON.parse(readFileSync(expectFile, "utf8"));
    for (const name of Object.keys(expected).sort()) {
      const want = expected[name].push_gate === "accept" ? NONE : DENY;
      add(`push-gate/stamp-fixture-${name.replace(/\.json$/, "")}`, want, () => pg(`pgF-${name}`, stampRepo(readFileSync(join(FIX, name), "utf8")), PUSH));
    }
    const variant = (id, edit, want) => {
      const o = JSON.parse(readFileSync(join(FIX, "valid-pass.json"), "utf8"));
      edit(o);
      add(`push-gate/stamp-${id}`, want, () => pg(`pgV-${id}`, stampRepo(JSON.stringify(o)), PUSH));
    };
    variant("security-inline-denied", (o) => { o.reviewers.security.status = "inline"; }, DENY);
    variant("security-not-installed-denied", (o) => { o.reviewers.security.status = "not-installed"; }, DENY);
    variant("security-blocking-with-pass-denied", (o) => { o.reviewers.security.blocking = 1; }, DENY);
    variant("security-missing-denied", (o) => { delete o.reviewers.security; }, DENY);
    variant("security-blocking-string-denied", (o) => { o.reviewers.security.blocking = "0"; }, DENY);
    variant("unknown-field-accepted", (o) => { o.extra = { a: 1 }; }, NONE);
  }

  const selected = only ? cases.filter((c) => c.id.includes(only)) : cases;
  out.selected = selected;
  for (const c of selected) {
    const r = c.fn();
    let status, actual, detail;
    if (r.actual !== undefined) ({ status, actual, detail } = r);
    else {
      status = r.error ? -1 : r.status;
      ({ actual, detail } = classifyOutput(r));
      if (r.stderr && !detail) detail = r.stderr.trim();
    }
    out.results.push({ id: c.id, expect: c.expect, status, actual, reason: (detail || "").replace(/\s+/g, " ").slice(0, 200), ok: actual === c.expect && status === 0 });
  }
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  return out;
}

function main() {
  const onlyArg = process.argv.slice(2).find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length) : null;
  const { skipped, selected, results } = runSecurityHookCases({ only });
  if (skipped) {
    console.log(`⚬ security hooks test skipped - ${skipped}`);
    process.exit(0);
  }
  if (selected.length === 0) {
    console.error(`no cases match --only=${only}`);
    process.exit(2);
  }
  const width = Math.max(...results.map((c) => c.id.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(width)}  expect=${r.expect.padEnd(7)} got=${String(r.actual).padEnd(7)} exit=${r.status}  ${r.ok ? "" : r.reason || "-"}`);
  }
  const mustAct = results.filter((c) => c.expect !== NONE).length;
  console.log(`\n${failed ? "✗" : "✓"} ${results.length} cases (${mustAct} must act, ${results.length - mustAct} must stay quiet) · ${failed} failures`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
