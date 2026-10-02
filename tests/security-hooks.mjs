#!/usr/bin/env node
// Behaviour test for the pro-security hooks: plan-gate, plan-doc-gate,
// ideation-nudge, commit-gate and the shared classifier (security_surface.py).
//
// check.mjs proves the hooks are wired and the scripts exist. This drives the
// real scripts the way Claude Code does - one process per case, the hook payload
// on stdin - and asserts what they emit. Every case must exit 0 (the hooks fail
// open and never use exit 2); the decision lives in the JSON on stdout.
//
//   node tests/security-hooks.mjs
//   node tests/security-hooks.mjs --only=commit-gate     # substring filter on case id
//
// Cases within a group share per-session state on purpose (a deny followed by
// the identical retry), so --only is meant for whole groups, not single cases.
// tests/check.mjs can import `runSecurityHookCases()`; its result shape matches
// runGitSafeCases() in tests/git-safe.mjs.
//
// State and plan files live in a temp dir (PRO_DEV_STATE_DIR / PRO_DEV_PLANS_DIR),
// git repos are throwaway. Zero dependencies, no network. Skips cleanly when
// python3 or git is not on PATH.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-security", "scripts");
const S = (n) => join(SCRIPTS, n);

const NONE = "none";
const DENY = "deny";
const BLOCK = "block";
const CONTEXT = "context";

const AUTH_PLAN = "# Plan\n\nAdd magic-link login with session cookies and a password reset flow.\n";
const BENIGN_PLAN = "# Plan\n\nRework the footer layout and update the design tokens.\n";

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
    if (j.decision === "block") return { actual: BLOCK, detail: j.reason, json: j };
    if (j.hookSpecificOutput?.additionalContext) return { actual: CONTEXT, detail: j.hookSpecificOutput.additionalContext, json: j };
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
  for (const f of ["security_surface.py", "plan-gate.py", "plan-doc-gate.py", "ideation-nudge.py", "commit-gate.py"]) {
    if (!existsSync(S(f))) return { ...out, skipped: `${S(f)} not found` };
  }

  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "sec-hooks-")));
  const stateDir = join(tmp, "state");
  const plansDir = join(tmp, "plans");
  mkdirSync(plansDir, { recursive: true });
  const env = { PRO_DEV_STATE_DIR: stateDir, PRO_DEV_PLANS_DIR: plansDir };
  const cases = [];
  const add = (id, expect, fn) => cases.push({ id, expect, fn });

  // ── classifier ─────────────────────────────────────────────────────────
  const classify = (text, flag) => {
    const r = spawnSync("python3", [S("security_surface.py"), ...(flag ? [flag] : [])], { input: text, encoding: "utf8" });
    return { status: r.status, actual: (r.stdout || "").trim().split("\n").filter(Boolean).join("+") || NONE, detail: r.stderr };
  };
  const text = (id, input, expect) => add(`classifier/${id}`, expect, () => classify(input));
  text("footer-and-design-tokens", "plan the footer layout and design tokens", NONE);
  text("llm-token-budget", "token budget for the context window", NONE);
  text("llm-input-tokens", "reduce input tokens and the token count per request", NONE);
  text("git-hash-session-ledger", "git hash of the session ledger", NONE);
  text("secretary", "ask the secretary about the meeting", NONE);
  text("bare-api-endpoint", "add an API endpoint and a content hash", NONE);
  text("bare-prompt", "tweak the prompt wording", NONE);
  text("magic-link-login", "add magic-link login with session cookies", "auth");
  text("avatar-uploads", "users upload avatars to S3", "uploads");
  text("stripe-webhook", "stripe webhook handler", "payments+webhooks");
  text("system-prompt", "rewrite the system prompt for the agent", "llm");
  text("new-dependency", "add a new dependency for date parsing", "dependencies");
  text("password-hashing", "hash passwords with bcrypt", "auth+crypto");
  const dcls = (id, diff, expect) => add(`classifier/diff-${id}`, expect, () => classify(diff, "--diff"));
  dcls("empty", "", NONE);
  dcls("version-bump", 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -1,3 +1,3 @@\n {\n-  "version": "1.0.0",\n+  "version": "1.0.1",\n   "name": "x"\n', NONE);
  dcls("new-dep", 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -5,3 +5,4 @@\n   "dependencies": {\n+    "left-pad": "^1.3.0",\n     "react": "^18.0.0"\n', "dependencies");
  dcls("dep-bump", 'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -5,3 +5,3 @@\n-    "react": "^18.0.0"\n+    "react": "^18.2.0"\n', NONE);
  dcls("md-with-jwt", "diff --git a/docs/auth.md b/docs/auth.md\n--- a/docs/auth.md\n+++ b/docs/auth.md\n@@ -1 +1,2 @@\n+We verify the JWT and bcrypt the password with eval(\n", NONE);
  dcls("workflow", "diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml\n--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@ -1 +1,2 @@\n+name: ci\n", "ci-infra");
  dcls("env-example", "diff --git a/.env.example b/.env.example\n--- a/.env.example\n+++ b/.env.example\n@@ -1 +1,2 @@\n+FOO=bar\n", NONE);
  dcls("sql-interpolation", 'diff --git a/src/db.ts b/src/db.ts\n--- a/src/db.ts\n+++ b/src/db.ts\n@@ -1 +1,2 @@\n+const q = `SELECT * FROM users WHERE id = ${id}`;\n', "injection");

  // ── plan-gate ──────────────────────────────────────────────────────────
  const planPayload = (sid, toolInput) => ({ session_id: sid, cwd: tmp, hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: toolInput });
  const pg = (sid, toolInput) => run("plan-gate.py", planPayload(sid, toolInput), env);
  add("plan-gate/benign-plan-passes", NONE, () => pg("pg1", { plan: BENIGN_PLAN }));
  add("plan-gate/auth-plan-denied", DENY, () => pg("pg2", { plan: AUTH_PLAN }));
  add("plan-gate/reason-names-categories-and-agent", DENY, () => {
    const r = pg("pg2b", { plan: AUTH_PLAN });
    const c = classifyOutput(r);
    const ok = /auth/.test(c.detail) && /security-architect/.test(c.detail) && /## Security challenge/.test(c.detail);
    return ok ? r : { status: r.status, stdout: "", stderr: `reason missing pieces: ${c.detail}` };
  });
  add("plan-gate/plan-with-section-passes", NONE, () => pg("pg3", { plan: `${AUTH_PLAN}\n## Security challenge\n\nBlocking: none.\n` }));
  add("plan-gate/third-attempt-passes", DENY, () => pg("pg4", { plan: AUTH_PLAN }));
  add("plan-gate/third-attempt-passes#2", DENY, () => pg("pg4", { plan: AUTH_PLAN }));
  add("plan-gate/third-attempt-passes#3", NONE, () => pg("pg4", { plan: AUTH_PLAN }));
  const planFile = write(tmp, "elsewhere/my-plan.md", AUTH_PLAN);
  add("plan-gate/reads-planFilePath", DENY, () => pg("pg5", { planFilePath: planFile }));
  add("plan-gate/planFilePath-with-section-passes", NONE, () => {
    const p = write(tmp, "elsewhere/ok-plan.md", `${AUTH_PLAN}\n## Security challenge\nfine\n`);
    return pg("pg5b", { planFilePath: p });
  });
  add("plan-gate/no-plan-anywhere-passes", NONE, () => pg("pg6", {}));
  // ExitPlanMode reaches PreToolUse with an empty tool_input (confirmed against
  // Claude Code 2.1.287), so the gate must find the plan through this session's
  // transcript. These payloads mirror that: no plan, only transcript_path.
  const transcript = (name, entries) => write(tmp, `transcripts/${name}.jsonl`, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  const attachment = (planPath) => ({ type: "attachment", attachment: { type: "plan_mode", planFilePath: planPath } });
  const writeUse = (fp, content) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Write", input: { file_path: fp, content } }] } });
  const pgT = (sid, tPath) => run("plan-gate.py", { ...planPayload(sid, {}), transcript_path: tPath }, env);
  add("plan-gate/transcript-attachment-plan-on-disk", DENY, () => {
    const plan = write(tmp, ".claude/plans/session-plan.md", AUTH_PLAN);
    return pgT("pg7", transcript("t7", [attachment(plan)]));
  });
  add("plan-gate/transcript-benign-plan-passes", NONE, () => {
    const plan = write(tmp, ".claude/plans/benign-plan.md", BENIGN_PLAN);
    return pgT("pg7b", transcript("t7b", [attachment(plan), writeUse(plan, BENIGN_PLAN)]));
  });
  add("plan-gate/transcript-blocked-write-uses-content", DENY, () => {
    const missing = join(tmp, ".claude/plans/never-written.md");
    return pgT("pg7c", transcript("t7c", [attachment(missing), writeUse(missing, AUTH_PLAN)]));
  });
  add("plan-gate/transcript-project-plan-doc", DENY, () => {
    const plan = write(tmp, "docs/plans/2026-10-02-reset.md", AUTH_PLAN);
    return pgT("pg7d", transcript("t7d", [writeUse(plan, AUTH_PLAN)]));
  });
  // A section the author wrote does not count: the gate wants evidence in the
  // transcript that an independent security-architect pass actually ran.
  const SECTION_PLAN = `${AUTH_PLAN}\n## Security challenge\n\nVerdict: proceed\n`;
  const agentUse = (type) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: type, prompt: "challenge mode" } }] } });
  const skillUse = (skill) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] } });
  add("plan-gate/self-written-section-denied", DENY, () => {
    const plan = write(tmp, ".claude/plans/self-review.md", SECTION_PLAN);
    const r = pgT("pg9", transcript("t9", [attachment(plan), writeUse(plan, SECTION_PLAN)]));
    const c = classifyOutput(r);
    return /does not count/.test(c.detail) ? r : { status: r.status, stdout: "", stderr: `self-review not named: ${c.detail}` };
  });
  add("plan-gate/section-after-architect-agent-passes", NONE, () => {
    const plan = write(tmp, ".claude/plans/agent-review.md", SECTION_PLAN);
    return pgT("pg10", transcript("t10", [attachment(plan), agentUse("pro-security:security-architect"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/section-after-architect-skill-passes", NONE, () => {
    const plan = write(tmp, ".claude/plans/skill-review.md", SECTION_PLAN);
    return pgT("pg11", transcript("t11", [attachment(plan), skillUse("pro-security:security-architect"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/unrelated-agent-does-not-count", DENY, () => {
    const plan = write(tmp, ".claude/plans/explore-review.md", SECTION_PLAN);
    return pgT("pg12", transcript("t12", [attachment(plan), agentUse("Explore"), writeUse(plan, SECTION_PLAN)]));
  });
  add("plan-gate/other-sessions-plan-files-ignored", NONE, () => {
    // Regression: an earlier fallback judged the newest file in ~/.claude/plans,
    // which belonged to a different session and produced a wrong verdict.
    write(plansDir, "someone-elses-plan.md", AUTH_PLAN);
    return pgT("pg8", transcript("t8", [{ type: "user", message: { content: [{ type: "text", text: "plan the footer" }] } }]));
  });
  add("plan-gate/malformed-stdin-passes", NONE, () => run("plan-gate.py", "{not json", env));
  add("plan-gate/non-object-payload-passes", NONE, () => run("plan-gate.py", "[1,2]", env));

  // ── plan-doc-gate ──────────────────────────────────────────────────────
  const docRepo = makeRepo(tmp);
  const docPayload = (sid, file) => ({ session_id: sid, cwd: docRepo, hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: file } });
  const pd = (sid, file) => run("plan-doc-gate.py", docPayload(sid, file), env);
  const planDoc = write(docRepo, "docs/plans/x.md", AUTH_PLAN);
  add("plan-doc-gate/auth-plan-blocks", BLOCK, () => pd("pd1", planDoc));
  add("plan-doc-gate/second-time-passes", NONE, () => pd("pd1", planDoc));
  add("plan-doc-gate/different-file-blocks-again", BLOCK, () => pd("pd1", write(docRepo, "docs/superpowers/specs/y.md", AUTH_PLAN)));
  add("plan-doc-gate/spdd-prompt-blocks", BLOCK, () => pd("pd1b", write(docRepo, "spdd/prompt/z.md", AUTH_PLAN)));
  add("plan-doc-gate/non-plan-path-passes", NONE, () => pd("pd2", write(docRepo, "docs/notes.md", AUTH_PLAN)));
  add("plan-doc-gate/plan-with-section-passes", NONE, () => pd("pd3", write(docRepo, "docs/plans/ok.md", `${AUTH_PLAN}\n## Security challenge\nfine\n`)));
  const pdT = (sid, file, tPath) => run("plan-doc-gate.py", { ...docPayload(sid, file), transcript_path: tPath }, env);
  add("plan-doc-gate/self-written-section-blocks", BLOCK, () => {
    const f = write(docRepo, "docs/plans/self.md", SECTION_PLAN);
    return pdT("pd7", f, transcript("t13", [writeUse(f, SECTION_PLAN)]));
  });
  add("plan-doc-gate/section-after-architect-passes", NONE, () => {
    const f = write(docRepo, "docs/plans/reviewed.md", SECTION_PLAN);
    return pdT("pd8", f, transcript("t14", [agentUse("pro-security:security-architect"), writeUse(f, SECTION_PLAN)]));
  });
  add("plan-doc-gate/benign-plan-passes", NONE, () => pd("pd4", write(docRepo, "docs/plans/benign.md", BENIGN_PLAN)));
  add("plan-doc-gate/claude-plans-dir-blocks", BLOCK, () => pd("pd5", write(plansDir, "fresh.md", AUTH_PLAN)));
  add("plan-doc-gate/missing-file-passes", NONE, () => pd("pd6", join(docRepo, "docs/plans/missing.md")));
  add("plan-doc-gate/malformed-stdin-passes", NONE, () => run("plan-doc-gate.py", "", env));

  // ── ideation-nudge ─────────────────────────────────────────────────────
  const nudge = (sid, prompt) => run("ideation-nudge.py", { session_id: sid, cwd: tmp, hook_event_name: "UserPromptSubmit", prompt }, env);
  add("ideation-nudge/magic-link-plan-nudges", CONTEXT, () => nudge("in1", "let's plan a magic-link login flow"));
  add("ideation-nudge/same-topic-silent-second-time", NONE, () => nudge("in1", "let's plan a magic-link login flow"));
  add("ideation-nudge/new-topic-nudges-again", CONTEXT, () => nudge("in1", "how should we design the stripe checkout flow"));
  add("ideation-nudge/benign-plan-silent", NONE, () => nudge("in2", "plan the footer layout"));
  add("ideation-nudge/not-planning-silent", NONE, () => nudge("in3", "fix the login button color"));
  add("ideation-nudge/slash-command-silent", NONE, () => nudge("in4", "/commit the magic-link login plan"));
  add("ideation-nudge/slash-plan-nudges", CONTEXT, () => nudge("in5", "/plan magic-link login"));
  add("ideation-nudge/llm-token-design-silent", NONE, () => nudge("in6", "design a token budget for the context window"));
  add("ideation-nudge/malformed-stdin-passes", NONE, () => run("ideation-nudge.py", "garbage", env));

  // ── commit-gate ────────────────────────────────────────────────────────
  const cg = (sid, cwd, command) => run("commit-gate.py", { session_id: sid, cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } }, env);
  const COMMIT = 'git commit -m "wip"';

  const r1 = makeRepo(tmp);
  write(r1, "style.css", "a { color: blue; }\nb { margin: 0; }\n");
  sh("git", ["add", "."], r1);
  add("commit-gate/css-only-passes", NONE, () => cg("cg1", r1, COMMIT));

  const r2 = makeRepo(tmp);
  write(r2, "notes.md", "# Auth\n\nWe hash passwords with bcrypt and sign a JWT. Beware eval( and dangerouslySetInnerHTML.\n");
  write(r2, "docs/security.md", "Stripe webhook signature verification and OAuth.\n");
  sh("git", ["add", "."], r2);
  add("commit-gate/markdown-about-security-passes", NONE, () => cg("cg2", r2, COMMIT));

  const r3 = makeRepo(tmp);
  write(r3, "app/api/login/route.ts", JWT_CODE);
  sh("git", ["add", "."], r3);
  add("commit-gate/staged-jwt-route-denied", DENY, () => {
    const r = cg("cg3", r3, COMMIT);
    const c = classifyOutput(r);
    const ok = /auth/.test(c.detail) && /app\/api\/login\/route\.ts/.test(c.detail) && /security-architect/.test(c.detail) && /git -C .* diff --cached/.test(c.detail);
    return ok ? r : { status: r.status, stdout: "", stderr: `reason missing pieces: ${c.detail}` };
  });
  add("commit-gate/identical-retry-passes", NONE, () => cg("cg3", r3, COMMIT));
  add("commit-gate/other-session-denied-again", DENY, () => cg("cg3-other", r3, COMMIT));
  add("commit-gate/chain-with-env-and-C-denied", DENY, () => cg("cg3c", tmp, `cd /nonexistent; FOO=1 git -C ${r3} commit -m "x" && echo done`));
  add("commit-gate/quoted-ampersands-in-message", DENY, () => cg("cg3d", r3, 'git commit -m "a && b; c | d"'));
  add("commit-gate/amend-denied", DENY, () => cg("cg3e", r3, "git commit --amend --no-edit"));

  const r4 = makeRepo(tmp);
  write(r4, "style.css", "a { color: green; }\n");
  sh("git", ["add", "."], r4);
  write(r4, "app/api/login/route.ts", "export const x = 1;\n");
  sh("git", ["add", "app/api/login/route.ts"], r4);
  sh("git", ["commit", "-q", "-m", "add route"], r4);
  write(r4, "app/api/login/route.ts", JWT_CODE);
  add("commit-gate/commit-without-a-ignores-unstaged", NONE, () => cg("cg4", r4, COMMIT));
  add("commit-gate/commit-am-uses-unstaged", DENY, () => cg("cg4b", r4, 'git commit -am "wip"'));
  add("commit-gate/commit-all-flag-uses-unstaged", DENY, () => cg("cg4c", r4, 'git commit --all -m "wip"'));
  add("commit-gate/message-text-with-a-is-not-all", NONE, () => cg("cg4d", r4, 'git commit -m "-a"'));

  const r5 = makeRepo(tmp);
  sh("git", ["checkout", "-q", "-b", "feat/login"], r5);
  write(r5, "src/auth/login.ts", JWT_CODE);
  sh("git", ["add", "."], r5);
  sh("git", ["commit", "-q", "-m", "login"], r5);
  add("commit-gate/pr-create-with-auth-change-denied", DENY, () => cg("cg5", r5, 'gh pr create --title "Login" --body "x"'));
  add("commit-gate/pr-create-retry-passes", NONE, () => cg("cg5", r5, 'gh pr create --title "Login" --body "x"'));
  add("commit-gate/pr-create-on-main-passes", NONE, () => {
    sh("git", ["checkout", "-q", "main"], r5);
    return cg("cg5b", r5, "gh pr create --fill");
  });
  const r6 = makeRepo(tmp);
  sh("git", ["checkout", "-q", "-b", "feat/css"], r6);
  write(r6, "style.css", "a { color: pink; }\n");
  sh("git", ["commit", "-q", "-am", "css"], r6);
  add("commit-gate/pr-create-css-only-passes", NONE, () => cg("cg6", r6, "gh pr create --fill"));

  const nonGit = realpathSync(mkdtempSync(join(tmp, "nongit-")));
  add("commit-gate/non-git-cwd-passes", NONE, () => cg("cg7", nonGit, COMMIT));
  add("commit-gate/git-status-passes", NONE, () => cg("cg8", r3, "git status"));
  add("commit-gate/git-log-with-commit-word-passes", NONE, () => cg("cg9", r3, 'git log --grep="commit"'));
  add("commit-gate/malformed-stdin-passes", NONE, () => run("commit-gate.py", "{", env));
  add("commit-gate/empty-command-passes", NONE, () => cg("cg10", r3, ""));

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
    out.results.push({ id: c.id, expect: c.expect, status, actual, reason: (detail || "").replace(/\s+/g, " ").slice(0, 200), ok: actual === c.expect && (c.id.startsWith("classifier/") ? status === 0 : status === 0) });
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
