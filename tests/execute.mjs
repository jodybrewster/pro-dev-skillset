#!/usr/bin/env node
// Behaviour test for the two scripts behind pro-ai-sdlc's /execute:
// execute-gate.py (is this plan committed, approved and unbuilt, is its branch
// free) and copy-env.py (copy the git-ignored env files into the worktree, check
// they stay ignored there, print names only). Each case runs against disposable
// git repos with a bare origin, with GIT_CONFIG_GLOBAL=/dev/null so the real
// user config and global excludes never leak in.
//
//   node tests/execute.mjs
//
// Also exported as runExecuteCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, lstatSync, readlinkSync, symlinkSync, chmodSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const S = (f) => join(ROOT, "plugins", "pro-ai-sdlc", "scripts", f);
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const MARKER = "SECRET-MARKER-7f3a";

function git(cwd, ...args) {
  return spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8", env: ENV });
}

function run(script, args, cwd) {
  const r = spawnSync("python3", [S(script), ...args], { cwd, encoding: "utf8", timeout: 30_000, env: ENV });
  let json = null;
  try { json = r.stdout.trim() ? JSON.parse(r.stdout.trim().split("\n").pop()) : null; } catch { /* not json */ }
  return { status: r.status, json, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function write(path, text, mode) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  if (mode) chmodSync(path, mode);
}

// a checkout on main with a bare origin it has pushed to
function repoWithOrigin(sandbox, name, files) {
  const origin = join(sandbox, `${name}-origin.git`);
  const repo = join(sandbox, name);
  git(sandbox, "init", "-q", "--bare", "-b", "main", origin);
  mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  for (const [p, t] of Object.entries(files)) write(join(repo, p), t);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-q", "-u", "origin", "main");
  return repo;
}

const PLAN = (status, build) => `# Plan: demo

Status: ${status}.

## Done

- Build commit: ${build}
- Sign-off: <the person's words and the date>
`;

export function runExecuteCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "execute-sandbox-")));
  const add = (id, expect, r, ok) => out.results.push({ id, expect, ok, reason: ok ? "" : `status ${r.status} stdout ${r.stdout.slice(0, 160)} stderr ${r.stderr.slice(0, 160)}` });
  try {
    // ── execute-gate.py ──
    const planRel = "intent/2026-01-01-demo/plan.md";
    const g = repoWithOrigin(sandbox, "gate", { [planRel]: PLAN("approved", "<sha>"), "app.js": "1\n" });
    const plan = join(g, planRel);

    let r = run("execute-gate.py", [plan], g);
    add("g1 an approved, committed, unbuilt plan passes with its slug", "pass", r,
      r.status === 0 && r.json?.slug === "demo" && r.json?.branch === "demo" && r.json?.intent_dir === "intent/2026-01-01-demo" && r.json?.default_branch === "main");

    r = run("execute-gate.py", [planRel], g);
    add("g2 a path relative to the repo works too", "pass", r, r.status === 0 && r.json?.slug === "demo");

    git(g, "branch", "demo");
    r = run("execute-gate.py", [plan], g);
    add("g3 a local branch with the slug's name stops", "stop", r, r.status === 1 && /branch/i.test(r.stderr));
    git(g, "branch", "-D", "demo");

    git(g, "push", "-q", "origin", "HEAD:refs/heads/demo");
    r = run("execute-gate.py", [plan], g);
    add("g4 a branch with the slug's name on origin stops", "stop", r, r.status === 1 && /origin/i.test(r.stderr));
    git(g, "push", "-q", "origin", "--delete", "demo");

    writeFileSync(plan, PLAN("approved", "<sha>") + "\nedited\n");
    r = run("execute-gate.py", [plan], g);
    add("g5 a plan with uncommitted edits stops", "stop", r, r.status === 1 && /uncommitted/i.test(r.stderr));
    git(g, "checkout", "-q", "--", planRel);

    writeFileSync(plan, PLAN("draft", "<sha>"));
    git(g, "commit", "-q", "-am", "draft");
    r = run("execute-gate.py", [plan], g);
    add("g6 a draft plan stops", "stop", r, r.status === 1 && /approved/i.test(r.stderr));

    writeFileSync(plan, PLAN("approved", "abc1234"));
    git(g, "commit", "-q", "-am", "built");
    r = run("execute-gate.py", [plan], g);
    add("g7 an approved plan whose Done section has a build commit stops", "stop", r, r.status === 1 && /built/i.test(r.stderr));

    write(join(g, "intent", "2026-01-02-new", "plan.md"), PLAN("approved", "<sha>"));
    r = run("execute-gate.py", [join(g, "intent", "2026-01-02-new", "plan.md")], g);
    add("g8 an untracked plan stops", "stop", r, r.status === 1 && /tracked|commit/i.test(r.stderr));

    r = run("execute-gate.py", [join(g, "intent", "nope", "plan.md")], g);
    add("g9 a missing plan stops", "stop", r, r.status === 1);

    r = run("execute-gate.py", [], g);
    add("g10 no argument stops with usage", "stop", r, r.status === 1 && /usage/i.test(r.stderr));

    // ── copy-env.py ──
    const m = repoWithOrigin(sandbox, "app", {
      ".gitignore": ".env\n.env.*\n!.env.example\n.dev.vars\nnode_modules/\n",
      ".env.example": "EXAMPLE=1\n",
      "apps/web/index.js": "1\n",
    });
    const wt = join(sandbox, "app.feature");
    git(m, "worktree", "add", "-q", wt, "-b", "feature", "origin/main");
    write(join(m, ".env.local"), `TOKEN=${MARKER}\n`, 0o600);
    write(join(m, "apps", "web", ".env"), `DB=${MARKER}\n`);
    write(join(m, ".dev.vars"), `KEY=${MARKER}\n`);
    write(join(m, "node_modules", "pkg", ".env"), `X=${MARKER}\n`);
    write(join(m, ".env.example"), `EXAMPLE=${MARKER}\n`); // a local edit to a tracked file is never copied

    r = run("copy-env.py", [m, wt], m);
    const leaked = (x) => x.stdout.includes(MARKER) || x.stderr.includes(MARKER);
    add("c1 ignored env files are copied to the same paths", "copy", r,
      r.status === 0 && existsSync(join(wt, ".env.local")) && existsSync(join(wt, "apps", "web", ".env")) && existsSync(join(wt, ".dev.vars")));
    add("c2 file modes are kept", "copy", r, existsSync(join(wt, ".env.local")) && (statSync(join(wt, ".env.local")).mode & 0o777) === 0o600);
    add("c3 node_modules is skipped", "skip", r, !existsSync(join(wt, "node_modules", "pkg", ".env")));
    add("c4 a tracked .env.example keeps the tracked copy", "skip", r, readFileSync(join(wt, ".env.example"), "utf8") === "EXAMPLE=1\n");
    add("c5 no file contents in the output", "quiet", r, !leaked(r));
    add("c6 the output names the copied paths", "names", r, [".env.local", "apps/web/.env", ".dev.vars"].every((p) => r.stdout.includes(p)));
    const st = git(wt, "status", "--porcelain");
    add("c7 the worktree shows no env file in git status", "clean", r, st.stdout.trim() === "");

    writeFileSync(join(wt, ".env.local"), "KEEP\n");
    r = run("copy-env.py", [m, wt], m);
    add("c8 a file the worktree already has is not overwritten", "skip", r, r.status === 0 && readFileSync(join(wt, ".env.local"), "utf8") === "KEEP\n" && !leaked(r));

    // origin's .gitignore covers .env but not .env.local; only the main checkout's uncommitted edit ignores it
    const d = repoWithOrigin(sandbox, "drift", { ".gitignore": ".env\n", "a.js": "1\n" });
    const dwt = join(sandbox, "drift.feature");
    git(d, "worktree", "add", "-q", dwt, "-b", "feature", "origin/main");
    writeFileSync(join(d, ".gitignore"), ".env\n.env.local\n");
    write(join(d, ".env"), `A=${MARKER}\n`);
    write(join(d, ".env.local"), `B=${MARKER}\n`);
    r = run("copy-env.py", [d, dwt], d);
    add("c9 a copy the worktree would not ignore stops the run", "stop", r, r.status === 2 && /\.env\.local/.test(r.stdout + r.stderr));
    add("c10 every copy is removed when one is not ignored", "rollback", r, !existsSync(join(dwt, ".env.local")) && !existsSync(join(dwt, ".env")));
    add("c11 no file contents in the output on a stop", "quiet", r, !leaked(r));

    const e = repoWithOrigin(sandbox, "empty", { "a.js": "1\n" });
    const ewt = join(sandbox, "empty.feature");
    git(e, "worktree", "add", "-q", ewt, "-b", "feature", "origin/main");
    r = run("copy-env.py", [e, ewt], e);
    add("c12 no env files prints none", "none", r, r.status === 0 && r.stdout.trim() === "none");

    r = run("copy-env.py", [e], e);
    add("c13 a missing argument stops with usage", "stop", r, r.status === 1 && /usage/i.test(r.stderr));

    // symlinks stay symlinks: a link to a file outside the repo is not copied as its contents
    const outside = join(sandbox, "shared.env");
    write(outside, `S=${MARKER}\n`);
    const l = repoWithOrigin(sandbox, "links", { ".gitignore": ".env*\n", "a.js": "1\n" });
    const lwt = join(sandbox, "links.feature");
    git(l, "worktree", "add", "-q", lwt, "-b", "feature", "origin/main");
    symlinkSync(outside, join(l, ".env"));
    symlinkSync(join(sandbox, "missing.env"), join(l, ".env.dangling"));
    write(join(l, ".env.local"), `L=${MARKER}\n`);
    r = run("copy-env.py", [l, lwt], l);
    add("c14 a symlinked env file is recreated as the same link", "link", r,
      r.status === 0 && lstatSync(join(lwt, ".env")).isSymbolicLink() && readlinkSync(join(lwt, ".env")) === outside);
    add("c15 a dangling env symlink does not crash the run", "link", r,
      r.status === 0 && lstatSync(join(lwt, ".env.dangling"), { throwIfNoEntry: false })?.isSymbolicLink() === true && existsSync(join(lwt, ".env.local")));
    add("c16 no file contents in the output with links", "quiet", r, !leaked(r));

    // ── gate details ──
    const b = repoWithOrigin(sandbox, "bold", { [planRel]: PLAN("approved", "<sha>").replace("- Build commit: <sha>", "- **Build commit:** abc1234") });
    r = run("execute-gate.py", [join(b, planRel)], b);
    add("g11 a bold Build commit line counts as built", "stop", r, r.status === 1 && /built/i.test(r.stderr));

    const n = join(sandbox, "noorigin");
    mkdirSync(n);
    git(n, "init", "-q", "-b", "main");
    write(join(n, planRel), PLAN("approved", "<sha>"));
    git(n, "add", "-A");
    git(n, "commit", "-q", "-m", "init");
    r = run("execute-gate.py", [join(n, planRel)], n);
    add("g12 a repo with no origin remote stops and says so", "stop", r, r.status === 1 && /no origin remote/i.test(r.stderr));
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runExecuteCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} execute cases passed`);
  process.exit(bad ? 1 : 0);
}
