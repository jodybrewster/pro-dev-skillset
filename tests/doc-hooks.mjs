#!/usr/bin/env node
// Behaviour test for the pro-quality doc hooks: docs-before-push.py (PreToolUse
// Bash) and docs-to-project.py (PreToolUse Write|Edit).
//
// check.mjs proves the hooks are wired and the scripts exist. This drives the
// real scripts the way Claude Code does - one process per case, the payload on
// stdin - and asserts the exit code (2 = blocked, anything else = allowed).
//
//   node tests/doc-hooks.mjs
//   node tests/doc-hooks.mjs --only=push/        # substring filter on case id
//
// tests/check.mjs imports `runDocHookCases()`; its result shape matches
// runMemoryHookCases(). Git repos, HOME and TMPDIR are throwaway, so nothing
// reads the real ~/.claude or the repo under test. Zero dependencies, no
// network. Skips cleanly when python3 or git is not on PATH.
//
// The push cases reproduce a real wrong-repo block: a session rooted in a repo
// with no remote (whose last commit touched STATUS.md) pushed a branch of a
// different repo, and the hook judged the session repo's history instead.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-quality", "scripts");
const PUSH_HOOK = join(SCRIPTS, "docs-before-push.py");
const PROJECT_HOOK = join(SCRIPTS, "docs-to-project.py");

const ALLOW = "allow";
const BLOCK = "block";

function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}

function commitFiles(repo, files, message) {
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, name)), { recursive: true });
    writeFileSync(join(repo, name), body);
  }
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", message);
}

// A bare origin with main, a session repo "hq" with no remote, and one linked
// worktree per scenario, each on its own branch cut from origin/main.
function buildFixtures(root) {
  const origin = join(root, "origin.git");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  const seed = join(root, "seed");
  git(root, "clone", "-q", origin, seed);
  git(seed, "checkout", "-q", "-b", "main");
  commitFiles(seed, { "README.md": "# app\n", "src/a.ts": "export const a = 1;\n" }, "seed");
  git(seed, "push", "-q", "-u", "origin", "main");
  git(seed, "remote", "set-head", "origin", "main");

  const hq = join(root, "hq");
  git(root, "init", "-q", "-b", "main", hq);
  commitFiles(hq, { "AGENTS.md": "# hq\n", "README.md": "# hq\n", "notes.txt": "x\n" }, "init");
  commitFiles(hq, { "STATUS.md": "streams\n" }, "status: update");

  const wt = (name, files, { pushFirst = false } = {}) => {
    const dir = join(root, `wt-${name}`);
    git(seed, "worktree", "add", "-q", "-b", name, dir, "origin/main");
    if (files) commitFiles(dir, files, name);
    if (pushFirst) git(dir, "push", "-q", "-u", "origin", name);
    return dir;
  };
  const fx = { origin, hq };
  fx.docsUpdated = wt("docs-updated", { "src/b.ts": "export const b = 1;\n", "README.md": "# app\nb\n" });
  fx.codeOnly = wt("code-only", { "src/c.ts": "export const c = 1;\n" });
  fx.mdOnly = wt("md-only", { "intent/2026-x/intent.md": "# intent\n", "notes.md": "n\n" });
  fx.codeAndIntent = wt("code-and-intent", { "intent/2026-y/intent.md": "# intent\n", "src/e.ts": "export const e = 1;\n" });
  fx.skillOnly = wt("skill-only", { "plugins/p/skills/s/SKILL.md": "# skill\n" });
  fx.commandOnly = wt("command-only", { "plugins/p/commands/c.md": "# command\n" });
  fx.agentOnly = wt("agent-only", { "plugins/p/agents/a.md": "# agent\n" });
  fx.docsDirOnly = wt("docs-dir-only", { "docs/guide.md": "# guide\n", "docs/notes.txt": "n\n" });
  fx.upstream = wt("upstream", { "src/d.ts": "export const d = 1;\n", "README.md": "# app\nd\n" }, { pushFirst: true });
  commitFiles(fx.upstream, { "src/d2.ts": "export const d2 = 1;\n" }, "more code");
  fx.upstreamClean = wt("upstream-clean", { "src/f.ts": "export const f = 1;\n", "README.md": "# app\nf\n" }, { pushFirst: true });
  return fx;
}

function runHook(script, payload, { cwd, env }) {
  // CLAUDE_PROJECT_DIR is blanked unless a case sets it, so a run inside Claude Code cannot leak in.
  const res = spawnSync("python3", [script], { input: JSON.stringify(payload), encoding: "utf8", timeout: 30_000, cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: "", ...env } });
  return res;
}

function pushCases(fx) {
  const bash = (command) => ({ tool_name: "Bash", tool_input: { command }, cwd: fx.hq });
  const c = (id, expect, command, mustSay = null, mustNotSay = null, session = fx.hq) => ({
    id: `push/${id}`, expect, script: PUSH_HOOK, payload: { ...bash(command), cwd: session }, cwd: session, mustSay, mustNotSay,
  });
  const P = "pu" + "sh"; // the subcommand, split so this file's own shell commands never spell it out
  const heredoc = (dir, tag) => [
    `cd ${dir} && git commit --allow-empty -m "$(cat <<${tag}`,
    "subject",
    "",
    `cd ${fx.docsUpdated}`,
    tag.replace(/['"]/g, ""),
    `)" && git ${P}`,
  ].join("\n");
  return [
    c("git-C-judges-the-pushed-repo", ALLOW, `git -C ${fx.docsUpdated} push`),
    c("cd-and-push-judges-the-pushed-repo", ALLOW, `cd ${fx.docsUpdated} && git push`),
    c("git-C-new-branch-code-without-docs-blocks", BLOCK, `git -C ${fx.codeOnly} push -u origin code-only`, "src/c.ts", "STATUS.md"),
    c("cd-and-push-new-branch-code-without-docs-blocks", BLOCK, `cd ${fx.codeOnly} && git push -u origin code-only`, "src/c.ts", "STATUS.md"),
    c("new-branch-no-upstream-with-docs-allows", ALLOW, `cd ${fx.docsUpdated} && git push -u origin docs-updated`),
    c("markdown-and-intent-only-allows", ALLOW, `git -C ${fx.mdOnly} push -u origin md-only`),
    c("intent-does-not-hide-real-code", BLOCK, `git -C ${fx.codeAndIntent} push -u origin code-and-intent`, "src/e.ts", "intent.md"),
    c("upstream-range-code-without-docs-blocks", BLOCK, `git -C ${fx.upstream} push`, "src/d2.ts"),
    c("upstream-range-ignores-already-pushed-commits", ALLOW, `git -C ${fx.upstreamClean} push`),
    c("session-repo-without-remote-allows", ALLOW, "git push"),
    c("non-push-command-allows", ALLOW, `git -C ${fx.codeOnly} status`),
    // docs-only rule: root *.md, docs/** and intent/** only
    c("skill-md-is-code", BLOCK, `git -C ${fx.skillOnly} ${P} -u origin skill-only`, "plugins/p/skills/s/SKILL.md"),
    c("command-md-is-code", BLOCK, `git -C ${fx.commandOnly} ${P} -u origin command-only`, "plugins/p/commands/c.md"),
    c("agent-md-is-code", BLOCK, `git -C ${fx.agentOnly} ${P} -u origin agent-only`, "plugins/p/agents/a.md"),
    c("docs-dir-allows", ALLOW, `git -C ${fx.docsDirOnly} ${P} -u origin docs-dir-only`),
    // the message names the repo it judged
    c("block-message-names-the-judged-repo", BLOCK, `git -C ${fx.codeOnly} ${P}`, fx.codeOnly),
    // heredoc bodies are data, not commands
    c("heredoc-cd-line-is-not-a-cd-quoted", BLOCK, heredoc(fx.codeOnly, "'EOF'"), "src/c.ts"),
    c("heredoc-cd-line-is-not-a-cd-bare", BLOCK, heredoc(fx.codeOnly, "EOF"), "src/c.ts"),
    c("heredoc-body-mentioning-a-push-allows", ALLOW, `cat <<'EOF'\ngit -C ${fx.codeOnly} ${P}\nEOF`, null, null, fx.codeOnly),
    // wrappers
    c("env-wrapper", BLOCK, `env GIT_TERMINAL_PROMPT=0 git -C ${fx.codeOnly} ${P}`, "src/c.ts"),
    c("command-wrapper", BLOCK, `command git -C ${fx.codeOnly} ${P}`, "src/c.ts"),
    c("timeout-wrapper", BLOCK, `timeout 30 git -C ${fx.codeOnly} ${P}`, "src/c.ts"),
    c("bash-c-wrapper", BLOCK, `bash -c 'cd ${fx.codeOnly} && git ${P}'`, "src/c.ts"),
    c("sh-c-wrapper", BLOCK, `sh -c "git -C ${fx.codeOnly} ${P}"`, "src/c.ts"),
    // unresolvable targets stay fail-open (the session repo is the blocking one, so a fallback to it would block)
    c("variable-cd-is-fail-open", ALLOW, `cd $WT && git ${P}`, null, null, fx.codeOnly),
    c("variable-git-C-is-fail-open", ALLOW, `git -C "$WT" ${P}`, null, null, fx.codeOnly),
    c("pushd-is-fail-open", ALLOW, `pushd ${fx.docsUpdated} && git ${P}`, null, null, fx.codeOnly),
    c("path-outside-any-repo-allows", ALLOW, `git -C ${tmpdir()} push`),
  ];
}

function projectCases(env, fx) {
  const { HOME: home, TMPDIR: tmp, PROJECT: project } = env;
  const w = (id, expect, file_path, { cwd = project, hookEnv = {}, extra = {} } = {}) => ({
    id: `project/${id}`,
    expect,
    script: PROJECT_HOOK,
    payload: { tool_name: "Write", tool_input: { file_path }, ...extra },
    cwd,
    hookEnv,
  });
  return [
    w("user-level-CLAUDE.md-allows", ALLOW, join(home, ".claude", "CLAUDE.md")),
    w("user-level-AGENTS.md-allows", ALLOW, join(home, ".claude", "AGENTS.md")),
    w("CLAUDE.local.md-allows", ALLOW, join(home, ".claude", "CLAUDE.local.md")),
    w("agent-file-in-session-repo-allows", ALLOW, join(project, "CLAUDE.md")),
    w("agent-file-in-session-repo-subdir-allows", ALLOW, join(project, "sub", "AGENTS.md")),
    w("agent-file-via-CLAUDE_PROJECT_DIR-allows", ALLOW, join(project, "AGENTS.md"), { cwd: home, hookEnv: { CLAUDE_PROJECT_DIR: project } }),
    w("agent-file-in-another-repo-blocks", BLOCK, join(fx.hq, "AGENTS.md")),
    w("agent-file-outside-any-repo-blocks", BLOCK, join(home, "Elsewhere", "AGENTS.md")),
    w("agent-file-in-claude-plans-blocks", BLOCK, join(home, ".claude", "plans", "CLAUDE.md")),
    w("agent-file-in-claude-subfolder-blocks", BLOCK, join(home, ".claude", "notes", "AGENTS.md")),
    w("session-scratchpad-allows", ALLOW, "/private/tmp/claude-501/proj/session/scratchpad/security-challenge.md"),
    w("tmp-claude-dir-allows", ALLOW, "/tmp/claude-501/proj/session/scratchpad/notes.md"),
    w("TMPDIR-claude-segment-allows", ALLOW, join(tmp, "claude-501", "proj", "scratchpad", "notes.md")),
    w("TMPDIR-without-claude-segment-blocks", BLOCK, join(tmp, "notes.md")),
    w("tmp-without-claude-dir-blocks", BLOCK, "/tmp/other-tool/plan.md"),
    w("tmp-nested-claude-segment-blocks", BLOCK, "/tmp/other-tool/claude-501/plan.md"),
    w("auto-memory-still-allows", ALLOW, join(home, ".claude", "projects", "p", "memory", "MEMORY.md")),
    w("plan-in-claude-dir-blocks", BLOCK, join(home, ".claude", "analysis.md")),
    w("plans-dir-outside-plan-mode-blocks", BLOCK, join(home, ".claude", "plans", "x.md")),
    w("random-claude-dir-file-blocks", BLOCK, join(home, ".claude", "notes", "findings.md")),
    w("markdown-outside-project-blocks", BLOCK, join(home, "Documents", "plan.md")),
    w("markdown-in-other-tmp-dir-blocks", BLOCK, "/private/tmp/other-tool/plan.md"),
    w("markdown-in-project-allows", ALLOW, join(project, "docs", "plan.md")),
  ];
}

export function runDocHookCases({ only = null } = {}) {
  const out = { skipped: null, results: [] };
  if (!existsSync(PUSH_HOOK) || !existsSync(PROJECT_HOOK)) return { ...out, skipped: "hook scripts not found" };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const root = realpathSync(mkdtempSync(join(tmpdir(), "doc-hooks-")));
  try {
    const home = join(root, "home");
    const tmp = join(root, "tmpdir");
    const project = join(root, "project");
    for (const d of [join(home, ".claude"), tmp, project]) mkdirSync(d, { recursive: true });
    git(project, "init", "-q", "-b", "main");
    const env = { HOME: home, TMPDIR: tmp, PROJECT: project };
    const fx = buildFixtures(root);

    const cases = [...pushCases(fx), ...projectCases(env, fx)].filter((c) => !only || c.id.includes(only));
    for (const c of cases) {
      const res = runHook(c.script, c.payload, { cwd: c.cwd, env: { HOME: home, TMPDIR: tmp, ...(c.hookEnv || {}) } });
      if (res.error) return { ...out, skipped: `could not run the hook (${res.error.message})` };
      const actual = res.status === 2 ? BLOCK : ALLOW;
      const stderr = (res.stderr || "").trim();
      let ok = actual === c.expect;
      let detail = `expected ${c.expect}, hook ${actual === BLOCK ? "blocked" : "allowed"} (exit ${res.status}) ${stderr.split("\n")[0]}`;
      if (ok && c.mustSay && !stderr.includes(c.mustSay)) { ok = false; detail = `block message lacks "${c.mustSay}": ${stderr.split("\n")[0]}`; }
      if (ok && c.mustNotSay && stderr.includes(c.mustNotSay)) { ok = false; detail = `block message names "${c.mustNotSay}", the wrong repo's file: ${stderr.split("\n")[0]}`; }
      out.results.push({ id: c.id, expect: c.expect, actual, status: res.status, ok, detail });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  return out;
}

function main() {
  const onlyArg = process.argv.slice(2).find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length) : null;
  const { skipped, results } = runDocHookCases({ only });
  if (skipped) {
    console.log(`skipped doc-hooks test - ${skipped}`);
    process.exit(0);
  }
  if (!results.length) {
    console.error(`no cases match --only=${only}`);
    process.exit(2);
  }
  const width = Math.max(...results.map((r) => r.id.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(width)}  expect=${r.expect.padEnd(5)} got=${r.actual.padEnd(5)} exit=${r.status}${r.ok ? "" : `  ${r.detail}`}`);
  }
  console.log(`\n${failed ? "✗" : "✓"} ${results.length} cases · ${failed} failures`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
