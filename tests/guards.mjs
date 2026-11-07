#!/usr/bin/env node
// Behaviour test for the shared guard helper of pro-core, `scripts/guardlib.py`,
// and for the guards built on the same mode rule: pro-security's
// `key-literal.py` and pro-core's `delete-outside.py`.
//
// The pro-core guards (the protected-push findings of git-safe.py first) read
// their mode through guardlib. A new guard enforces only when its own
// `mode.<key>` file says `enforce`: the global `mode` file and
// CLAUDE_GUARD_MODE leave it in warn so it cannot enforce before its evidence
// period (ADR-0016, the `stale-done` precedent). A lookup that read the global
// file would turn every new guard on at once. Each direction is a case.
//
// The hook cases feed a payload on stdin and read the outcome: `allow` (no
// output, no warn.log line), `warn` (a would-deny line and a warn message),
// `block` (a deny line and permissionDecision deny) or `found` (a PostToolUse
// found-on-disk line and context, never a deny). Every key fixture is built
// from parts at run time so no tracked file holds a key-shaped literal, and
// every key-literal case asserts the planted key appears in no output and no
// warn.log line.
//
//   node tests/guards.mjs
//   node tests/guards.mjs --only=mode     # substring filter on case id
//   node tests/guards.mjs --only=key-literal
//   node tests/guards.mjs --only=delete-outside
//
// tests/check.mjs imports `runGuardCases()` and reports the results as its
// `guards` check. Zero dependencies, no network. Skips cleanly when python3 is
// not on PATH.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-core", "scripts");
const LIB = join(SCRIPTS, "guardlib.py");
const KEY_LITERAL = join(ROOT, "plugins", "pro-security", "scripts", "key-literal.py");
const DELETE_OUTSIDE = join(SCRIPTS, "delete-outside.py");

const PROBE = [
  "import sys",
  "sys.dont_write_bytecode = True",
  "sys.path.insert(0, sys.argv[1])",
  "import guardlib",
  "print(guardlib.own_mode(sys.argv[2]))",
].join("\n");

const CASES = [
  { id: "mode/no-file-reads-warn", key: "protected-push", files: {}, expect: "warn" },
  { id: "mode/own-file-enforce", key: "protected-push", files: { "mode.protected-push": "enforce\n" }, expect: "enforce" },
  { id: "mode/own-file-warn", key: "protected-push", files: { "mode.protected-push": "warn\n" }, expect: "warn" },
  { id: "mode/own-file-junk-reads-warn", key: "protected-push", files: { "mode.protected-push": "yes please\n" }, expect: "warn" },
  { id: "mode/global-file-enforce-stays-warn", key: "protected-push", files: { mode: "enforce\n" }, expect: "warn" },
  { id: "mode/env-enforce-stays-warn", key: "protected-push", files: {}, env: { CLAUDE_GUARD_MODE: "enforce" }, expect: "warn" },
  {
    id: "mode/own-file-wins-over-global-warn",
    key: "protected-push",
    files: { mode: "warn\n", "mode.protected-push": "enforce\n" },
    expect: "enforce",
  },
  { id: "mode/other-key-file-ignored", key: "protected-push", files: { "mode.floor-guard": "enforce\n" }, expect: "warn" },
];

// ---------------------------------------------------------------------------
// key-literal (pro-security). Fixture keys are joined from parts here so the
// repo never holds one; FILL has no stand-in word in it.

const FILL = "Q7RT2MXP4LN8VB3KZ9HW6JD5GC";
const fill = (n) => Array.from({ length: n }, (_, i) => FILL[i % FILL.length]).join("");
const P = (...parts) => parts.join("");

const KEYS = {
  "aws-akia": { key: P("AK", "IA", fill(16)), kind: "AWS key id" },
  "aws-asia": { key: P("AS", "IA", fill(16)), kind: "AWS key id" },
  anthropic: { key: P("sk", "-ant-", "api03-", fill(40)), kind: "Anthropic key" },
  ghp: { key: P("gh", "p_", fill(36)), kind: "GitHub token" },
  gho: { key: P("gh", "o_", fill(36)), kind: "GitHub token" },
  ghu: { key: P("gh", "u_", fill(36)), kind: "GitHub token" },
  ghs: { key: P("gh", "s_", fill(36)), kind: "GitHub token" },
  ghr: { key: P("gh", "r_", fill(36)), kind: "GitHub token" },
  "github-pat": { key: P("github", "_pat_", fill(40)), kind: "GitHub token" },
  "slack-xoxb": { key: P("xo", "xb-", fill(30)), kind: "Slack token" },
  "slack-xoxp": { key: P("xo", "xp-", fill(30)), kind: "Slack token" },
  "slack-xoxa": { key: P("xo", "xa-", fill(30)), kind: "Slack token" },
  "slack-xapp": { key: P("xa", "pp-", fill(30)), kind: "Slack token" },
  "private-key": { key: P("-----BEGIN ", "RSA PRI", "VATE KEY-----"), kind: "private key" },
};
const ANT = KEYS.anthropic.key;
const AWS = KEYS["aws-akia"].key;
const SRC = "/srv/fixture-project/app/src/config.ts";
const ENFORCE_KL = { "mode.key-literal": "enforce\n" };

const write = (file_path, content) => ({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path, content } });
const at3 = (k) => `// settings\n\nconst value = "${k}";\n`;

const KEY_CASES = [];
for (const [name, { key, kind }] of Object.entries(KEYS)) {
  KEY_CASES.push({ id: `key-literal/write/${name}`, payload: write(SRC, at3(key)), secret: key, expect: "warn", text: [kind, "line 3", "config.ts"] });
  KEY_CASES.push({ id: `key-literal/enforce/${name}`, payload: write(SRC, at3(key)), secret: key, files: ENFORCE_KL, expect: "block", text: [kind, "line 3"] });
}
KEY_CASES.push(
  // AC2: environment reads and stand-in words
  { id: "key-literal/allow/env-read", payload: write(SRC, "const k = process.env.ANTHROPIC_API_KEY;\n"), expect: "allow" },
  { id: "key-literal/write/env-fallback", payload: write(SRC, `const k = process.env.KEY || "${ANT}";\n`), secret: ANT, expect: "warn" },
  { id: "key-literal/write/env-assignment", payload: write("/srv/fixture-project/app/run.py", `os.environ["ANTHROPIC_API_KEY"] = "${ANT}"\n`), secret: ANT, expect: "warn" },
  { id: "key-literal/allow/aws-example-prefix", payload: write(SRC, `aws = "${P("AK", "IA")}EXAMPLE..."\n`), expect: "allow" },
  { id: "key-literal/allow/example-word-on-line", payload: write(SRC, `aws = "${AWS}" # example\n`), secret: AWS, expect: "allow" },
  { id: "key-literal/allow/prefix-in-prose", payload: write(SRC, `Anthropic keys start with ${P("sk", "-ant-")} and Slack ones with ${P("xo", "xb-")}.\n`), expect: "allow" },
  // AC2: templates are checked, value files are not
  { id: "key-literal/write/env-example", payload: write("/srv/fixture-project/app/.env.example", `ANTHROPIC_API_KEY=${ANT}\n`), secret: ANT, expect: "warn", text: [".env.example"] },
  { id: "key-literal/write/env-production", payload: write("/srv/fixture-project/app/.env.production", `ANTHROPIC_API_KEY=${ANT}\n`), secret: ANT, expect: "warn" },
  { id: "key-literal/write/dev-vars-example", payload: write("/srv/fixture-project/app/.dev.vars.example", `ANTHROPIC_API_KEY=${ANT}\n`), secret: ANT, expect: "warn" },
  { id: "key-literal/allow/env-local", payload: write("/srv/fixture-project/app/.env.local", `ANTHROPIC_API_KEY=${ANT}\n`), secret: ANT, expect: "allow" },
  { id: "key-literal/allow/env", payload: write("/srv/fixture-project/app/.env", `ANTHROPIC_API_KEY=${ANT}\n`), secret: ANT, expect: "allow" },
  { id: "key-literal/allow/env-development-local", payload: write("/srv/fixture-project/app/.env.development.local", `ANTHROPIC_API_KEY=${ANT}\n`), secret: ANT, expect: "allow" },
  { id: "key-literal/allow/dev-vars", payload: write("/srv/fixture-project/app/.dev.vars", `ANTHROPIC_API_KEY=${ANT}\n`), secret: ANT, expect: "allow" },
  { id: "key-literal/allow/dev-vars-staging", payload: write("/srv/fixture-project/app/.dev.vars.staging", `ANTHROPIC_API_KEY=${ANT}\n`), secret: ANT, expect: "allow" },
  // AC2a: stand-ins inside the key's word pass; markup and ellipses elsewhere do not
  { id: "key-literal/allow/stand-in-angle-x", payload: write(SRC, `const k = "${P("sk", "-ant-", "api03-", fill(20), "<x>", fill(20))}";\n`), expect: "allow" },
  { id: "key-literal/allow/stand-in-your-key", payload: write(SRC, `const k = "${P("sk", "-ant-", "api03-", fill(20), "<your-key>", fill(4))}";\n`), expect: "allow" },
  { id: "key-literal/allow/stand-in-ellipsis", payload: write(SRC, `const k = "${P("sk", "-ant-", "api03-", fill(20), "...", fill(4))}";\n`), expect: "allow" },
  { id: "key-literal/write/inside-code-tags", payload: write("/srv/fixture-project/app/docs/setup.md", `Set it to <code>${ANT}</code> first.\n`), secret: ANT, expect: "warn" },
  { id: "key-literal/write/jsx-line", payload: write("/srv/fixture-project/app/src/App.tsx", `return <div>{call("${ANT}")}</div>;\n`), secret: ANT, expect: "warn" },
  { id: "key-literal/write/ellipsis-elsewhere", payload: write(SRC, `const k = "${ANT}"; // more to come...\n`), secret: ANT, expect: "warn" },
  // R5: Edit and MultiEdit text, the first five lines
  {
    id: "key-literal/edit/new-string",
    payload: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: SRC, old_string: "a", new_string: `x\nconst k = "${ANT}";` } },
    secret: ANT, expect: "warn", text: ["line 2"],
  },
  {
    id: "key-literal/multiedit/second-edit",
    payload: {
      hook_event_name: "PreToolUse", tool_name: "MultiEdit",
      tool_input: { file_path: SRC, edits: [{ old_string: "a", new_string: "fine" }, { old_string: "b", new_string: `const k = "${AWS}";` }] },
    },
    secret: AWS, expect: "warn", text: ["edit 2 line 1"],
  },
  {
    id: "key-literal/write/first-five-lines",
    payload: write(SRC, Array.from({ length: 7 }, () => `k = "${AWS}"`).join("\n")),
    secret: AWS, expect: "warn", text: ["1, 2, 3, 4, 5"], notText: ["6"],
  },
  // AC4 / R19: the named no-leak case
  { id: "key-literal/no-leak/full-length-key", payload: write(SRC, `const k = "${ANT}";\n`), secret: ANT, files: ENFORCE_KL, expect: "block" },
  // AC7: the global mode file leaves the guard in warn
  { id: "key-literal/global-enforce-file-stays-warn", payload: write(SRC, at3(AWS)), secret: AWS, files: { mode: "enforce\n" }, expect: "warn" },
  // AC3: PostToolUse reads the written file, informs, never denies
  { id: "key-literal/post/line-7", post: { name: "config.ts", body: `${"// x\n".repeat(6)}const k = "${ANT}";\n` }, secret: ANT, expect: "found", text: ["line 7", "Anthropic key"] },
  { id: "key-literal/post/line-7-enforce", post: { name: "config.ts", body: `${"// x\n".repeat(6)}const k = "${ANT}";\n` }, secret: ANT, files: ENFORCE_KL, expect: "found", text: ["line 7"] },
  { id: "key-literal/post/value-file-skipped", post: { name: ".env.local", body: `KEY=${ANT}\n` }, secret: ANT, expect: "allow" },
  { id: "key-literal/post/nul-byte-skipped", post: { name: "blob.bin", body: `\u0000KEY=${ANT}\n` }, secret: ANT, expect: "allow" },
  { id: "key-literal/post/over-1mb-skipped", post: { name: "big.txt", body: `KEY=${ANT}\n${"a".repeat(1_100_000)}` }, secret: ANT, expect: "allow" },
  { id: "key-literal/post/missing-file", payload: { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: "/srv/fixture-project/nope.ts" } }, expect: "allow" },
  // AC8: malformed payloads
  { id: "key-literal/malformed/not-json", raw: "not json", expect: "allow" },
  { id: "key-literal/malformed/array", raw: "[]", expect: "allow" },
  { id: "key-literal/malformed/tool-input-string", payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: "x" }, expect: "allow" },
  { id: "key-literal/malformed/content-number", payload: { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: SRC, content: 12 } }, expect: "allow" },
  { id: "key-literal/malformed/edits-junk", payload: { hook_event_name: "PreToolUse", tool_name: "MultiEdit", tool_input: { file_path: SRC, edits: [1, null, "s"] } }, expect: "allow" },
  { id: "key-literal/malformed/empty", raw: "", expect: "allow" },
);
for (const c of KEY_CASES) c.script = KEY_LITERAL;

// ---------------------------------------------------------------------------
// delete-outside (pro-core). The project root, HOME and TMPDIR are paths that
// need not exist: the guard resolves words, it never touches the files.

const ROOT_DIR = "/srv/fixture-project/app";
const HOME_DIR = "/srv/fixture-home";
const TMP_DIR = "/srv/fixture-tmp/";
const ENFORCE_DO = { "mode.delete-outside": "enforce\n" };
const bash = (command) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd: ROOT_DIR });

const OUTSIDE = [
  ["rm-rf-sibling", "rm -rf ../other", "/srv/fixture-project/other"],
  ["rm-home-file", "rm ~/notes.txt", `${HOME_DIR}/notes.txt`],
  ["find-delete", "find /var/lib/x -delete", "/var/lib/x"],
  ["find-exec-rm", "find ../y -exec rm {} \;", "/srv/fixture-project/y"],
  ["git-c-clean", "git -C ../other clean -fd", "/srv/fixture-project/other"],
  ["cd-then-rm", "cd .. && rm -rf other", "/srv/fixture-project/other"],
];
const DEL_CASES = [];
for (const [name, command, resolved] of OUTSIDE) {
  DEL_CASES.push({ id: `delete-outside/warn/${name}`, payload: bash(command), expect: "warn", text: [resolved, ROOT_DIR] });
  DEL_CASES.push({ id: `delete-outside/enforce/${name}`, payload: bash(command), files: ENFORCE_DO, expect: "block", text: [resolved, ROOT_DIR] });
}
DEL_CASES.push(
  // AC6: inside the root, the temp roots, the state folder and unknown words
  { id: "delete-outside/allow/rm-build", payload: bash("rm -rf build"), expect: "allow" },
  { id: "delete-outside/allow/tmp-child", payload: bash("rm -rf /tmp/x"), expect: "allow" },
  { id: "delete-outside/allow/tmpdir-child", payload: bash('rm -rf "$TMPDIR/x"'), expect: "allow" },
  { id: "delete-outside/allow/state-dir-child", payload: bash("rm -rf ~/.claude/pro-dev/x"), expect: "allow" },
  { id: "delete-outside/allow/state-dir-env", payload: bash("rm -rf /srv/fixture-state/x"), env: { PRO_DEV_STATE_DIR: "/srv/fixture-state" }, expect: "allow" },
  { id: "delete-outside/allow/mktemp", payload: bash("rm -rf $(mktemp -d)"), expect: "allow" },
  { id: "delete-outside/allow/git-clean-inside", payload: bash("git clean -fd"), expect: "allow" },
  { id: "delete-outside/allow/up-and-back-in", payload: bash("rm -rf ../app/dist"), expect: "allow" },
  { id: "delete-outside/allow/redirect-target", payload: bash("rm -rf ./x 2> /dev/null"), expect: "allow" },
  { id: "delete-outside/allow/local-variable", payload: bash("X=../other; rm -rf $X"), expect: "allow" },
  { id: "delete-outside/allow/other-variable-not-expanded", payload: bash("rm -rf ../cache-$GUARDS_FIXTURE_TOKEN"), env: { GUARDS_FIXTURE_TOKEN: P("plant", "ed-", fill(24)) }, secret: P("plant", "ed-", fill(24)), expect: "allow" },
  { id: "delete-outside/allow/unset-variable", payload: bash("rm -rf $GUARDS_FIXTURE_UNSET/x"), expect: "allow" },
  { id: "delete-outside/allow/find-no-delete", payload: bash("find ../y -name '*.log'"), expect: "allow" },
  { id: "delete-outside/allow/echo-only", payload: bash("echo rm -rf ../other"), expect: "allow" },
  { id: "delete-outside/allow/ls", payload: bash("ls ../other"), expect: "allow" },
  // AC6 findings: a temp root itself and the guard folder
  { id: "delete-outside/warn/tmp-root-itself", payload: bash("rm -rf /tmp"), expect: "warn", text: ["/tmp"] },
  { id: "delete-outside/warn/guard-folder-mode-file", payload: bash("rm ~/.claude/hooks/mode.floor-guard"), expect: "warn", text: [`${HOME_DIR}/.claude/hooks/mode.floor-guard`] },
  // R11: the other forms
  { id: "delete-outside/warn/rmdir", payload: bash("rmdir ../a"), expect: "warn" },
  { id: "delete-outside/warn/unlink", payload: bash("unlink ../b"), expect: "warn" },
  { id: "delete-outside/warn/after-double-dash", payload: bash("rm -- -odd ../c"), expect: "warn", text: ["/srv/fixture-project/c"] },
  { id: "delete-outside/warn/find-execdir-rmdir", payload: bash("find ../z -execdir rmdir {} +"), expect: "warn" },
  { id: "delete-outside/warn/cd-absolute", payload: bash("cd /srv/elsewhere && rm -rf x"), expect: "warn", text: ["/srv/elsewhere/x"] },
  { id: "delete-outside/warn/project-dir-env", payload: { ...bash("rm -rf ../other"), cwd: "/srv/fixture-project/app/sub" }, env: { CLAUDE_PROJECT_DIR: "/srv/fixture-project/app/sub" }, expect: "warn" },
  { id: "delete-outside/warn/sudo-with-user", payload: bash("sudo -u someone rm -rf ../z"), expect: "warn", text: ["/srv/fixture-project/z"] },
  { id: "delete-outside/warn/pushd", payload: bash("pushd .. && rm -rf other"), expect: "warn", text: ["/srv/fixture-project/other"] },
  { id: "delete-outside/warn/symlink-out-of-root", payload: bash("rm -rf link/local/sub"), linkRoot: "/usr", expect: "warn", text: ["/usr/local/sub"] },
  { id: "delete-outside/allow/symlink-itself", payload: bash("rm link"), linkRoot: "/usr", expect: "allow" },
  // AC7: the global mode file leaves the guard in warn
  { id: "delete-outside/global-enforce-file-stays-warn", payload: bash("rm -rf ../other"), files: { mode: "enforce\n" }, expect: "warn" },
  // AC8: malformed payloads
  { id: "delete-outside/malformed/not-json", raw: "not json", expect: "allow" },
  { id: "delete-outside/malformed/array", raw: "[]", expect: "allow" },
  { id: "delete-outside/malformed/command-number", payload: { tool_name: "Bash", tool_input: { command: 7 }, cwd: ROOT_DIR }, expect: "allow" },
  { id: "delete-outside/malformed/tool-input-string", payload: { tool_name: "Bash", tool_input: "rm -rf ../x", cwd: ROOT_DIR }, expect: "allow" },
  { id: "delete-outside/malformed/empty", raw: "", expect: "allow" },
);
for (const c of DEL_CASES) {
  c.script = DELETE_OUTSIDE;
  c.env = { CLAUDE_PROJECT_DIR: ROOT_DIR, HOME: HOME_DIR, TMPDIR: TMP_DIR, ...(c.env || {}) };
}

const LOG_ACTION = { warn: "would-deny", block: "deny", found: "found-on-disk" };

function outcome(res, log) {
  if (res.status !== 0) return `exit ${res.status}`;
  const out = (res.stdout || "").trim();
  if (!out) return log ? "log-only" : "allow";
  let j;
  try {
    j = JSON.parse(out);
  } catch {
    return "non-json output";
  }
  const h = j.hookSpecificOutput || {};
  if (h.permissionDecision === "deny") return "block";
  if (h.hookEventName === "PostToolUse" && h.additionalContext) return "found";
  if (j.systemMessage && /warn mode/.test(j.systemMessage) && h.additionalContext) return "warn";
  return "other output";
}

function runHookCase(c, env, dir) {
  if (!existsSync(c.script)) return { actual: "script missing", reason: `${c.script} not found` };
  let payload = c.raw;
  if (c.post) {
    const work = join(dir, "work");
    mkdirSync(work, { recursive: true });
    const file = join(work, c.post.name);
    writeFileSync(file, c.post.body);
    payload = JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: file, content: "" } });
  } else if (c.linkRoot) {
    // A real project folder holding `link` -> linkRoot: the guard decides on the real path.
    const proj = join(dir, "proj");
    mkdirSync(proj, { recursive: true });
    symlinkSync(c.linkRoot, join(proj, "link"));
    env.CLAUDE_PROJECT_DIR = proj;
    payload = JSON.stringify({ ...c.payload, cwd: proj });
  } else if (payload === undefined) {
    payload = JSON.stringify(c.payload);
  }
  const res = spawnSync("python3", [c.script], { input: payload, encoding: "utf8", env, timeout: 20_000 });
  const logPath = join(dir, "warn.log");
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  const actual = outcome(res, log);
  const all = `${res.stdout || ""}\n${res.stderr || ""}\n${log}`;
  const problems = [];
  if (actual !== c.expect) problems.push(`got ${actual}${res.stderr ? ` (stderr: ${res.stderr.trim().split("\n").pop()})` : ""}`);
  if (c.secret && all.includes(c.secret)) problems.push("the planted key appears in the output or warn.log");
  const want = LOG_ACTION[c.expect];
  if (want && !log.split("\n").some((l) => l.split("\t")[2] === want)) problems.push(`no ${want} line in warn.log`);
  if (c.expect === "allow" && log) problems.push("allow wrote a warn.log line");
  for (const t of c.text || []) if (!all.includes(t)) problems.push(`output lacks ${JSON.stringify(t)}`);
  for (const t of c.notText || []) if ((res.stdout || "").includes(`, ${t}`)) problems.push(`output names ${JSON.stringify(t)}`);
  return { actual, reason: problems.join("; ") };
}

function baseEnv() {
  const env = { ...process.env };
  for (const k of ["CLAUDE_GUARD_MODE", "CLAUDE_PROJECT_DIR", "PRO_DEV_STATE_DIR"]) delete env[k];
  return env;
}

export function runGuardCases({ only = null } = {}) {
  const all = [...CASES, ...KEY_CASES, ...DEL_CASES];
  const selected = only ? all.filter((c) => c.id.includes(only)) : all;
  const out = { skipped: null, selected, results: [] };
  const py = spawnSync("python3", ["--version"], { stdio: "ignore" });
  if (py.error) return { ...out, skipped: "python3 not found on PATH" };

  for (const c of selected) {
    const dir = mkdtempSync(join(tmpdir(), "guards-"));
    try {
      for (const [name, body] of Object.entries(c.files || {})) writeFileSync(join(dir, name), body);
      const env = { ...baseEnv(), ...(c.env || {}), CLAUDE_GUARD_DIR: dir, PYTHONDONTWRITEBYTECODE: "1" };
      if (c.script) {
        const { actual, reason } = runHookCase(c, env, dir);
        out.results.push({ ...c, actual, ok: !reason, reason });
        continue;
      }
      const res = existsSync(LIB)
        ? spawnSync("python3", ["-c", PROBE, SCRIPTS, c.key], { encoding: "utf8", env, timeout: 20_000 })
        : { status: 1, stdout: "", stderr: "guardlib.py not found" };
      const actual = res.status === 0 ? res.stdout.trim() : `error: ${(res.stderr || "").trim().split("\n").pop()}`;
      out.results.push({ ...c, actual, ok: actual === c.expect, reason: actual === c.expect ? "" : `got ${actual}` });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return out;
}

function main() {
  const onlyArg = process.argv.slice(2).find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length) : null;
  const { skipped, selected, results } = runGuardCases({ only });
  if (skipped) {
    console.log(`⚬ guard helper test skipped - ${skipped}`);
    process.exit(0);
  }
  if (selected.length === 0) {
    console.error(`no cases match --only=${only}`);
    process.exit(2);
  }
  const width = Math.max(...results.map((r) => r.id.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(width)}  expect=${r.expect.padEnd(7)} got=${r.actual}${r.ok ? "" : `  ${r.reason}`}`);
  }
  console.log(`\n${failed ? "✗" : "✓"} ${results.length} cases · ${failed} failures`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
