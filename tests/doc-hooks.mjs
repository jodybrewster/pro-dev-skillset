#!/usr/bin/env node
// Behaviour test for the pro-quality doc hook docs-to-project.py (PreToolUse
// Write|Edit). Doc freshness on push moved to pr-check (ADR-0021).
//
// check.mjs proves the hooks are wired and the scripts exist. This drives the
// real scripts the way Claude Code does - one process per case, the payload on
// stdin - and asserts the exit code (2 = blocked, anything else = allowed).
//
//   node tests/doc-hooks.mjs
//   node tests/doc-hooks.mjs --only=project/     # substring filter on case id
//
// tests/check.mjs imports `runDocHookCases()`; its result shape matches
// runMemoryHookCases(). Git repos, HOME and TMPDIR are throwaway, so nothing
// reads the real ~/.claude or the repo under test. Zero dependencies, no
// network. Skips cleanly when python3 or git is not on PATH.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-quality", "scripts");
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

// One extra repo, "hq", so a write into a repo other than the session's has a target.
function buildFixtures(root) {
  const hq = join(root, "hq");
  git(root, "init", "-q", "-b", "main", hq);
  commitFiles(hq, { "AGENTS.md": "# hq\n" }, "init");
  return { hq };
}

function runHook(script, payload, { cwd, env }) {
  // CLAUDE_PROJECT_DIR is blanked unless a case sets it, so a run inside Claude Code cannot leak in.
  const res = spawnSync("python3", [script], { input: JSON.stringify(payload), encoding: "utf8", timeout: 30_000, cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: "", ...env } });
  return res;
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
  if (!existsSync(PROJECT_HOOK)) return { ...out, skipped: "hook script not found" };
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

    const cases = projectCases(env, fx).filter((c) => !only || c.id.includes(only));
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
