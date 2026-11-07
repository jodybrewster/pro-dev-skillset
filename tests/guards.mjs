#!/usr/bin/env node
// Behaviour test for the shared guard helper of pro-core, `scripts/guardlib.py`,
// and for the guards built on the same mode rule: pro-security's
// `key-literal.py`, pro-core's `delete-outside.py`, pro-core's secret-read guard
// `scripts/secret-read.py` and its helper `scripts/env-check.py`.
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
// The sr/* cases drive secret-read.py the way Claude Code does: one process per
// case, the PreToolUse payload on stdin, a throwaway guard folder and a working
// folder that holds a planted `.env` with a sentinel value. A JSON
// `permissionDecision: deny` is deny; a `secret-read` `would-deny` line in
// warn.log is warn; anything else is allow. Every case also asserts that the
// sentinel never reaches stdout, stderr or warn.log.
//
// The env-check/* cases run env-check.py against fixture dotenv files that hold the
// sentinel and assert each output line, the exit code and that the sentinel
// is absent from stdout and stderr in every outcome.
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
import { randomBytes } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-core", "scripts");
const LIB = join(SCRIPTS, "guardlib.py");
const KEY_LITERAL = join(ROOT, "plugins", "pro-security", "scripts", "key-literal.py");
const DELETE_OUTSIDE = join(SCRIPTS, "delete-outside.py");
const SECRET_READ = join(SCRIPTS, "secret-read.py");
const ENV_CHECK = join(SCRIPTS, "env-check.py");

// Built at runtime so no copy of it sits in this file or the repo.
const SENTINEL = `sentinel${randomBytes(8).toString("hex")}`;

const PROBE = [
  "import sys",
  "sys.dont_write_bytecode = True",
  "sys.path.insert(0, sys.argv[1])",
  "import guardlib",
  "print(guardlib.own_mode(sys.argv[2]))",
].join("\n");

const MODE_CASES = [
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
  { id: "mode/secret-read-own-file-enforce", key: "secret-read", files: { "mode.secret-read": "enforce\n" }, expect: "enforce" },
];

// ── secret-read ─────────────────────────────────────────────────────────────
const WARN = "warn";
const DENY = "deny";
const ALLOW = "allow";
const ENFORCE = { "mode.secret-read": "enforce\n" };

const srRead = (file_path) => ({ tool: "Read", input: { file_path } });
const srGrep = (input) => ({ tool: "Grep", input: { pattern: "KEY", ...input } });
const srBash = (command) => ({ tool: "Bash", input: { command } });

// AC1: every R2 kind on Read, plus the R2 kinds the AC does not list.
const READ_SECRETS = [
  ["sr-read/dotenv", ".env", "a dotenv file"],
  ["sr-read/dotenv-local", ".env.local", "a dotenv file"],
  ["sr-read/dotenv-production-nested", "config/.env.production", "a dotenv file"],
  ["sr-read/ssh-key", "~/.ssh/id_ed25519", "a private SSH key"],
  ["sr-read/ssh-key-rsa-absolute", "/home/someone/.ssh/id_rsa", "a private SSH key"],
  ["sr-read/pem", "certs/server.pem", "a PEM file"],
  ["sr-read/npmrc", ".npmrc", "an .npmrc file"],
  ["sr-read/npmrc-home", "~/.npmrc", "an .npmrc file"],
  ["sr-read/credentials-json", "credentials.json", "a credentials file"],
  ["sr-read/credentials-bare", "~/.aws/credentials", "a credentials file"],
  ["sr-read/credentials-yml", "config/credentials.yml", "a credentials file"],
  ["sr-read/service-account", "gcp-service-account.json", "a service-account file"],
  ["sr-read/dev-vars", ".dev.vars", "a dev vars file"],
  ["sr-read/dev-vars-staging", "worker/.dev.vars.staging", "a dev vars file"],
];

// AC2 and AC4a: names that look close and hold no secret.
const READ_ALLOWS = [
  ["sr-read-allow/env-example", ".env.example"],
  ["sr-read-allow/env-sample", ".env.sample"],
  ["sr-read-allow/env-template", "config/.env.template"],
  ["sr-read-allow/ssh-pub", "~/.ssh/id_ed25519.pub"],
  ["sr-read-allow/src-env-ts", "src/env.ts"],
  ["sr-read-allow/credentials-ts", "src/auth/credentials.ts"],
  ["sr-read-allow/id-helpers-py", "scripts/id_helpers.py"],
  ["sr-read-allow/npmrc-lookalike", "docs/npmrc.md"],
  ["sr-read-allow/envrc", ".envrc"],
  ["sr-read-allow/package-json", "package.json"],
];

// AC3, AC4a, AC7 and R6 to R10 on Bash. [id, command, expect]
const BASH_CASES = [
  ["sr-bash/cat-env", "cat .env", WARN],
  ["sr-bash/head-env-local", "head -5 .env.local", WARN],
  ["sr-bash/grep-key-env", "grep KEY .env", WARN],
  ["sr-bash/sed-npmrc", "sed -n 1p .npmrc", WARN],
  ["sr-bash/redirect-spaced", "python3 x.py < .env", WARN],
  ["sr-bash/redirect-attached", "python3 x.py <.env.local", WARN],
  ["sr-bash/redirect-fd0", "wc -l 0< .env", WARN],
  ["sr-bash/xargs-cat", "echo .env | xargs cat", WARN],
  ["sr-bash/xargs-flags-grep", "find . -name .npmrc | xargs -0 grep token", WARN],
  ["sr-bash/tail-ssh-key", "tail ~/.ssh/id_rsa", WARN],
  ["sr-bash/less-credentials", "less ~/.aws/credentials", WARN],
  ["sr-bash/more-service-account", "more keys/ci-service-account.json", WARN],
  ["sr-bash/rg-env", "rg API_KEY .env.production", WARN],
  ["sr-bash/egrep-env", "egrep -i 'key|token' .env", WARN],
  ["sr-bash/fgrep-env", "fgrep KEY .dev.vars", WARN],
  ["sr-bash/grep-e-pattern-then-file", "grep -e KEY .env", WARN],
  ["sr-bash/grep-e-names-env-pattern-no-file", "grep -e .env src/config.ts", ALLOW],
  ["sr-bash/sed-e-script-then-file", "sed -e 's/a/b/' .env", WARN],
  ["sr-bash/cat-absolute-bin", "/bin/cat .env", WARN],
  ["sr-bash/env-assign-prefix", "LC_ALL=C cat .env", WARN],
  ["sr-bash/after-and", "cd app && cat .env.local", WARN],
  ["sr-bash/in-pipeline", "cat .env | grep KEY", WARN],
  ["sr-bash/second-line", "echo start\ncat .npmrc", WARN],
  ["sr-bash/double-quoted", 'cat ".env"', WARN],
  ["sr-bash/cat-ssh-glob", "cat ~/.ssh/id_*", WARN],
  ["sr-bash/cat-pem-glob", "cat certs/*.pem", WARN],
  ["sr-bash/head-pem-glob", "head *.pem", WARN],
  ["sr-bash/cat-env-glob", "cat .env*", WARN],
  ["sr-bash/cat-credentials-glob", "cat credentials*", WARN],
  // Review of #193: a glob in a folder part leaves the last component to R2; braces expand.
  ["sr-bash/folder-glob-env", "cat apps/*/.env", WARN],
  ["sr-bash/folder-glob-env-local", "cat */.env.local", WARN],
  ["sr-bash/brace-env", "cat {.env,.env.local}", WARN],
  ["sr-bash/brace-suffix-env", "cat .env{,.local}", WARN],
  ["sr-bash-allow/folder-glob-readme", "cat apps/*/README.md", ALLOW],
  ["sr-bash-allow/brace-ts", "cat src/*.{ts,tsx}", ALLOW],
  // grep options whose value is a file glob, and options that take a number.
  ["sr-bash/grep-include-eq", "grep -rn KEY --include='.env*' .", WARN],
  ["sr-bash/grep-include-spaced", "grep -rn KEY --include .env .", WARN],
  ["sr-bash/rg-g-glob", "rg KEY -g '.env*'", WARN],
  ["sr-bash/rg-glob-long", "rg KEY --glob=.npmrc", WARN],
  ["sr-bash-allow/grep-include-ts", "grep -rn KEY --include='*.ts' .", ALLOW],
  ["sr-bash-allow/grep-context-then-pattern", "grep -A 3 .env src/", ALLOW],
  ["sr-bash-allow/grep-max-count-then-pattern", "grep -m 1 .env.local docs", ALLOW],
  ["sr-bash-allow/grep-long-max-count-then-pattern", "grep --max-count 2 .npmrc README.md", ALLOW],
  // Command substitutions run, quoted or not; heredoc bodies are text.
  ["sr-bash/subst-in-double-quotes", 'echo "$(cat .env)"', WARN],
  ["sr-bash/subst-bare", "export X=$(head -1 .env.local)", WARN],
  ["sr-bash/backtick-in-double-quotes", 'echo "`cat .npmrc`"', WARN],
  ["sr-bash/backtick-bare", "echo `cat .env`", WARN],
  ["sr-bash-allow/subst-in-single-quotes", "echo '$(cat .env)'", ALLOW],
  ["sr-bash-allow/heredoc-doc-line", "cat > notes.md <<'EOF'\ncat .env prints values\nEOF\necho done", ALLOW],
  ["sr-bash-allow/heredoc-dash-doc-line", "cat > notes.md <<-EOF\n\tgrep KEY .env\n\tEOF", ALLOW],
  ["sr-bash/after-heredoc-ends", "cat > notes.md <<'EOF'\ntext\nEOF\ncat .env", WARN],
  ["sr-bash/heredoc-to-shell", "bash <<'EOF'\ncat .env\nEOF", WARN],
  ["sr-bash/herestring-is-not-heredoc", "grep KEY <<<EOF\ncat .env\nEOF", WARN],
  ["sr-bash/grep-T-takes-no-value", "grep -T KEY .env", WARN],
  // Review round 2 of #193: a heredoc body is kept whenever any stage of its line runs a shell.
  ["sr-bash/heredoc-piped-to-bash", "cat <<'EOF' | bash\ncat .env\nEOF", WARN],
  ["sr-bash/heredoc-after-cd-bash", "cd app && bash <<'EOF'\ncat .env\nEOF", WARN],
  ["sr-bash/heredoc-env-assign-bash", "FOO=1 bash <<'EOF'\ncat .env\nEOF", WARN],
  ["sr-bash/heredoc-sudo-sh", "sudo sh <<EOF\ncat .env\nEOF", WARN],
  ["sr-bash/heredoc-env-runner-zsh", "env -i FOO=1 zsh <<EOF\nhead .npmrc\nEOF", WARN],
  // An apostrophe in a quoted heredoc body must not hide a later substitution.
  ["sr-bash/apostrophe-in-heredoc-then-subst", "cat > notes.md <<'EOF'\nfix: don't log keys\nEOF\necho \"$(cat .env)\"", WARN],
  // Brace lists that hold a slash expand before the basename is taken.
  ["sr-bash/brace-with-slash", "cat apps/{web/.env,api/.env}", WARN],
  ["sr-bash/brace-mixed-with-slash", "cat {README.md,apps/.env}", WARN],
  ["sr-bash-allow/brace-with-slash-readme", "cat apps/{web/README.md,api/README.md}", ALLOW],
  // Review round 3 of #193: a brace group with no comma does not end expansion,
  // the cap keeps the first alternatives and runner flags consume their value.
  ["sr-bash/brace-after-var", "cat ${APP_DIR}/.env{,.local}", WARN],
  ["sr-bash/xargs-brace-after-placeholder", "ls | xargs -I{} cat {}/.env{,.local}", WARN],
  ["sr-bash/brace-cap-keeps-first", "cat {.env,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15,a16,a17,a18,a19,a20,a21,a22,a23,a24,a25,a26,a27,a28,a29,a30,a31,a32,a33,a34,a35,a36,a37,a38,a39,a40,a41,a42,a43,a44,a45,a46,a47,a48,a49,a50,a51,a52,a53,a54,a55,a56,a57,a58,a59,a60,a61,a62,a63,a64,a65,a66,a67,a68,a69,a70}", WARN],
  ["sr-bash/sudo-u-value", "sudo -u deploy cat /srv/app/.env", WARN],
  ["sr-bash/sudo-long-user-value", "sudo --user deploy cat /srv/app/.env", WARN],
  ["sr-bash/nice-n-value", "nice -n 10 cat .env", WARN],
  ["sr-bash/env-u-value", "env -u FOO cat .env", WARN],
  ["sr-bash/env-C-value", "env -C app cat .env", WARN],
  ["sr-bash/heredoc-piped-to-sudo-u-bash", "cat <<'EOF' | sudo -u deploy bash\ncat .env\nEOF", WARN],
  ["sr-bash-allow/sudo-u-value-no-secret", "sudo -u deploy cat README.md", ALLOW],
  ["sr-bash/env-check-plain", "python3 @@ENV_CHECK@@ OPENAI_API_KEY", ALLOW],
  ["sr-bash/env-check-plain-file-flag", "python3 @@ENV_CHECK@@ --file .env OPENAI_API_KEY", ALLOW],
  ["sr-bash/env-check-no-python", "@@ENV_CHECK@@ KEY", ALLOW],
  ["sr-bash/env-check-piped-to-cat-env", "python3 @@ENV_CHECK@@ KEY | cat .env", WARN],
  ["sr-bash/env-check-then-cat-env", "python3 @@ENV_CHECK@@ KEY; cat .env", WARN],
  ["sr-bash-allow/grep-pattern-names-env", 'grep -r ".env" src/', ALLOW],
  ["sr-bash-allow/rg-pattern-names-env", "rg -n '.env.local' docs", ALLOW],
  ["sr-bash-allow/sed-script-names-npmrc", "sed -n '/.npmrc/p' README.md", ALLOW],
  ["sr-bash-allow/cp-example", "cp .env.example .env", ALLOW],
  ["sr-bash-allow/source", "source .env", ALLOW],
  ["sr-bash-allow/dot-source", ". .env.local && npm run dev", ALLOW],
  ["sr-bash-allow/ls", "ls -la .env", ALLOW],
  ["sr-bash-allow/check-ignore", "git check-ignore .env", ALLOW],
  ["sr-bash-allow/cat-example", "cat .env.example", ALLOW],
  ["sr-bash-allow/cat-star", "cat *", ALLOW],
  ["sr-bash-allow/cat-json-glob", "cat *.json", ALLOW],
  ["sr-bash-allow/cat-ssh-pub-glob", "cat ~/.ssh/id_*.pub", ALLOW],
  ["sr-bash-allow/cat-credentials-ts-glob", "cat src/auth/credentials*.ts", ALLOW],
  ["sr-bash-allow/cat-pub-key", "cat ~/.ssh/id_ed25519.pub", ALLOW],
  ["sr-bash-allow/heredoc-in", "cat <<EOF\n.env\nEOF", ALLOW],
  ["sr-bash-allow/xargs-no-secret", "ls | xargs cat", ALLOW],
  ["sr-bash-allow/xargs-not-reader", "echo .env | xargs ls -la", ALLOW],
  ["sr-bash-allow/echo-name", "echo 'copy .env.example to .env'", ALLOW],
  ["sr-bash-allow/no-secret-at-all", "npm test", ALLOW],
];

// Five brace groups of thirty options (about 300 characters): 24 million
// expansions if a guard expanded them all. The guard must cap and return fast.
const BRACE_GROUP = `{${Array.from({ length: 30 }, (_, i) => String.fromCharCode(97 + (i % 26)) + (i >= 26 ? "x" : "")).join(",")}}`;
const BRACE_BOMB = BRACE_GROUP.repeat(5);
const FAST_MS = 3000;

const SR_CASES = [
  ...READ_SECRETS.map(([id, p, kind]) => ({ id, ...srRead(p), expect: WARN, has: kind })),
  ...READ_ALLOWS.map(([id, p]) => ({ id, ...srRead(p), expect: ALLOW })),

  // AC4, AC4a: Grep path and glob.
  { id: "sr-grep/path-env", ...srGrep({ path: ".env" }), expect: WARN },
  { id: "sr-grep/glob-env-star", ...srGrep({ glob: ".env*" }), expect: WARN },
  { id: "sr-grep/glob-id-star", ...srGrep({ glob: "id_*" }), expect: WARN },
  { id: "sr-grep/glob-pem", ...srGrep({ path: "certs", glob: "*.pem" }), expect: WARN },
  { id: "sr-grep/path-npmrc", ...srGrep({ path: "~/.npmrc" }), expect: WARN },
  { id: "sr-grep/path-credentials", ...srGrep({ path: "~/.aws/credentials" }), expect: WARN },
  { id: "sr-grep/glob-credentials", ...srGrep({ glob: "credentials*" }), expect: WARN },
  { id: "sr-grep/path-service-account", ...srGrep({ path: "keys/ci-service-account.json" }), expect: WARN },
  { id: "sr-grep/path-dev-vars", ...srGrep({ path: "worker/.dev.vars" }), expect: WARN },
  { id: "sr-grep/glob-folder-env", ...srGrep({ glob: "**/.env" }), expect: WARN },
  { id: "sr-grep/glob-brace-env", ...srGrep({ glob: "{.env,.env.local}" }), expect: WARN },
  { id: "sr-grep/path-folder-glob-env", ...srGrep({ path: "apps/*/.env" }), expect: WARN },
  { id: "sr-read/folder-glob-env", ...srRead("apps/*/.env.production"), expect: WARN },
  { id: "sr-grep-allow/glob-ts", ...srGrep({ glob: "*.ts" }), expect: ALLOW },
  { id: "sr-grep-allow/glob-json", ...srGrep({ glob: "*.json" }), expect: ALLOW },
  { id: "sr-grep-allow/path-src", ...srGrep({ path: "src", glob: "*.{ts,tsx}" }), expect: ALLOW },
  { id: "sr-grep-allow/path-env-example", ...srGrep({ path: ".env.example" }), expect: ALLOW },
  { id: "sr-grep-allow/glob-folder-readme", ...srGrep({ glob: "**/README.md" }), expect: ALLOW },
  { id: "sr-grep-allow/glob-brace-example", ...srGrep({ glob: "{.env.example,.env.sample}" }), expect: ALLOW },

  ...BASH_CASES.map(([id, command, expect]) => ({ id, ...srBash(command), expect })),

  // The message names the kind, the basename and the way forward, never the value.
  { id: "sr-msg/warn-names-kind-and-way-forward", ...srBash("cat .env"), expect: WARN, has: "env-check.py" },
  { id: "sr-msg/warn-names-example", ...srRead(".env.local"), expect: WARN, has: ".env.example" },
  { id: "sr-msg/warn-summary", ...srRead(".env"), expect: WARN, has: "would deny reading a dotenv file (.env)" },

  // AC5: enforce only under its own mode file.
  ...READ_SECRETS.slice(0, 8).map(([id, p]) => ({ id: id.replace("sr-read/", "sr-enforce/read-"), ...srRead(p), expect: DENY, modes: ENFORCE })),
  ...BASH_CASES.filter(([, , e]) => e === WARN).slice(0, 8).map(([id, command]) => ({
    id: id.replace("sr-bash/", "sr-enforce/bash-"), ...srBash(command), expect: DENY, modes: ENFORCE,
  })),
  { id: "sr-enforce/deny-names-env-check", ...srBash("cat .env"), expect: DENY, modes: ENFORCE, has: "env-check.py" },
  { id: "sr-enforce/allow-stays-allow", ...srRead(".env.example"), expect: ALLOW, modes: ENFORCE },
  { id: "sr-enforce/env-check-stays-allow", ...srBash("python3 @@ENV_CHECK@@ KEY"), expect: ALLOW, modes: ENFORCE },
  { id: "sr-global-mode/read-env-stays-warn", ...srRead(".env"), expect: WARN, modes: { mode: "enforce\n" } },
  { id: "sr-global-mode/cat-env-stays-warn", ...srBash("cat .env"), expect: WARN, modes: { mode: "enforce\n" } },
  { id: "sr-global-mode/env-var-stays-warn", ...srBash("cat .env"), expect: WARN, env: { CLAUDE_GUARD_MODE: "enforce" } },
  { id: "sr-global-mode/other-key-ignored", ...srRead(".env"), expect: WARN, modes: { "mode.protected-push": "enforce\n" } },

  // Review round 2 of #193: brace expansion is capped while it runs.
  { id: "sr-brace-bomb/bash-allow", ...srBash(`cat ${BRACE_BOMB}`), expect: ALLOW, maxMs: FAST_MS },
  { id: "sr-brace-bomb/bash-folder-env", ...srBash(`cat ${BRACE_BOMB}/.env`), expect: WARN, maxMs: FAST_MS },
  { id: "sr-brace-bomb/grep-glob", ...srGrep({ glob: BRACE_BOMB }), expect: ALLOW, maxMs: FAST_MS },
  { id: "sr-brace-bomb/read", ...srRead(`${BRACE_BOMB}.txt`), expect: ALLOW, maxMs: FAST_MS },

  // AC8: malformed payloads exit 0 with no output.
  { id: "sr-malformed/not-json", raw: "not json", expect: ALLOW, silent: true },
  { id: "sr-malformed/empty-object", raw: "{}", expect: ALLOW, silent: true },
  { id: "sr-malformed/empty-stdin", raw: "", expect: ALLOW, silent: true },
  { id: "sr-malformed/array", raw: "[]", expect: ALLOW, silent: true },
  { id: "sr-malformed/read-no-file-path", raw: JSON.stringify({ tool_name: "Read", tool_input: {} }), expect: ALLOW, silent: true },
  { id: "sr-malformed/read-number-path", raw: JSON.stringify({ tool_name: "Read", tool_input: { file_path: 7 } }), expect: ALLOW, silent: true },
  { id: "sr-malformed/bash-list-command", raw: JSON.stringify({ tool_name: "Bash", tool_input: { command: ["cat", ".env"] } }), expect: ALLOW, silent: true },
  { id: "sr-malformed/grep-input-string", raw: JSON.stringify({ tool_name: "Grep", tool_input: ".env" }), expect: ALLOW, silent: true },
  { id: "sr-malformed/other-tool", raw: JSON.stringify({ tool_name: "Write", tool_input: { file_path: ".env" } }), expect: ALLOW, silent: true },
  { id: "sr-malformed/unclosed-quote", ...srBash("cat '.env"), expect: WARN },
];

// ── env-check ───────────────────────────────────────────────────────────────
const S = SENTINEL;
const FIXTURE = [
  `SET=${S}`,
  "EMPTY=",
  `export QUOTED="${S}"`,
  "# MISSING=x",
  `  SPACED = '${S}'`,
  "BLANKQ=''",
  `TWICE=${S}`,
  "TWICE=",
  "COMMENTED= # a note",
  "",
].join("\n");

const EC_CASES = [
  { id: "env-check/set-empty-missing", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "SET", "EMPTY", "MISSING"], exit: 1, stdout: "SET present\nEMPTY empty\nMISSING missing\n" },
  { id: "env-check/all-present-exit-0", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "SET", "QUOTED", "SPACED"], exit: 0, stdout: "SET present\nQUOTED present\nSPACED present\n" },
  { id: "env-check/export-quoted", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "QUOTED"], exit: 0, stdout: "QUOTED present\n" },
  { id: "env-check/quoted-blank-is-empty", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "BLANKQ"], exit: 1, stdout: "BLANKQ empty\n" },
  { id: "env-check/last-assignment-wins", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "TWICE"], exit: 1, stdout: "TWICE empty\n" },
  { id: "env-check/commented-line-is-missing", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "MISSING"], exit: 1, stdout: "MISSING missing\n" },
  { id: "env-check/inline-comment-is-empty", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "COMMENTED"], exit: 1, stdout: "COMMENTED empty\n" },
  { id: "env-check/default-env-local-first", files: { ".env.local": `SET=${S}\n`, ".env": "OTHER=1\n" }, args: ["SET", "OTHER"], exit: 1, stdout: "SET present\nOTHER missing\n" },
  { id: "env-check/default-env", files: { ".env": `SET=${S}\n` }, args: ["SET"], exit: 0, stdout: "SET present\n" },
  { id: "env-check/no-file-all-missing", files: {}, args: ["SET", "EMPTY"], exit: 1, stdout: "SET missing\nEMPTY missing\n" },
  { id: "env-check/unreadable-file", files: { "f.env": FIXTURE }, dirs: ["adir"], args: ["--file", "adir", "SET"], exit: 1, stdout: "SET missing\n", stderr: "adir" },
  { id: "env-check/nonexistent-file", files: {}, args: ["--file", "nope.env", "SET"], exit: 1, stdout: "SET missing\n", stderr: "nope.env" },
  { id: "env-check/bad-key-exit-64", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "BAD-KEY"], exit: 64, stdout: "", stderr: "BAD-KEY" },
  { id: "env-check/bad-key-default-file-exit-64", files: { ".env": FIXTURE }, args: ["BAD-KEY"], exit: 64, stdout: "", stderr: "BAD-KEY" },
  { id: "env-check/bad-key-after-good-exit-64", files: { "f.env": FIXTURE }, args: ["--file", "f.env", "SET", "1BAD"], exit: 64, stdout: "" },
  { id: "env-check/file-flag-without-value-exit-64", files: { ".env": FIXTURE }, args: ["SET", "--file"], exit: 64, stdout: "" },
  { id: "env-check/no-keys-exit-64", files: { ".env": FIXTURE }, args: [], exit: 64, stdout: "" },
  { id: "env-check/unknown-option-exit-64", files: { ".env": FIXTURE }, args: ["--show", "SET"], exit: 64, stdout: "" },
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
  { id: "delete-outside/warn/after-then-keyword", payload: bash("if [ -d ../old ]; then rm -rf ../old; fi"), expect: "warn", text: ["/srv/fixture-project/old"] },
  { id: "delete-outside/warn/after-brace-and-bang", payload: bash("{ rm -rf ../old; }"), expect: "warn", text: ["/srv/fixture-project/old"] },
  { id: "delete-outside/allow/popd-restores", payload: bash("pushd ../other && make && popd && rm -rf build"), expect: "allow" },
  { id: "delete-outside/warn/popd-then-up", payload: bash("pushd sub && popd && rm -rf ../x"), expect: "warn", text: ["/srv/fixture-project/x"] },
  { id: "delete-outside/warn/time-p", payload: bash("time -p rm -rf ../x"), expect: "warn", text: ["/srv/fixture-project/x"] },
  { id: "delete-outside/warn/env-u", payload: bash("env -u FOO rm -rf ../x"), expect: "warn", text: ["/srv/fixture-project/x"] },
  { id: "delete-outside/warn/nice-n", payload: bash("nice -n 5 rm -rf ../x"), expect: "warn", text: ["/srv/fixture-project/x"] },
  { id: "delete-outside/warn/pwd-tracks-cd", payload: bash("cd .. && rm -rf $PWD/other"), expect: "warn", text: ["/srv/fixture-project/other"] },
  { id: "delete-outside/allow/pwd-inside", payload: bash("rm -rf $PWD/build"), expect: "allow" },
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
  for (const k of ["CLAUDE_GUARD_MODE", "CLAUDE_GUARD_DIR", "CLAUDE_PROJECT_DIR", "PRO_DEV_STATE_DIR"]) delete env[k];
  return env;
}

function readLog(dir) {
  try {
    return readFileSync(join(dir, "warn.log"), "utf8");
  } catch {
    return "";
  }
}

function decide(stdout, logText) {
  let out = null;
  try {
    out = JSON.parse((stdout || "").trim() || "null");
  } catch {
    out = null;
  }
  if (out && out.hookSpecificOutput && out.hookSpecificOutput.permissionDecision === "deny") return DENY;
  if (/\tsecret-read\twould-deny\t/.test(logText)) return WARN;
  return ALLOW;
}

function runSecretReadCase(c) {
  const root = mkdtempSync(join(tmpdir(), "guards-sr-"));
  try {
    const guardDir = join(root, "guard");
    const cwd = join(root, "work");
    mkdirSync(guardDir);
    mkdirSync(cwd);
    // A planted secret beside the call: the guard must never read or echo it.
    writeFileSync(join(cwd, ".env"), `OPENAI_API_KEY=${SENTINEL}\nKEY=${SENTINEL}\n`);
    for (const [name, body] of Object.entries(c.modes || {})) writeFileSync(join(guardDir, name), body);
    let payload = c.raw;
    if (payload === undefined) {
      const input = { ...c.input };
      if (typeof input.command === "string") input.command = input.command.split("@@ENV_CHECK@@").join(ENV_CHECK);
      payload = JSON.stringify({ tool_name: c.tool, cwd, tool_input: input });
    }
    if (!existsSync(SECRET_READ)) return { ...c, actual: "missing", ok: false, reason: "secret-read.py not found" };
    const env = { ...baseEnv(), ...(c.env || {}), CLAUDE_GUARD_DIR: guardDir };
    const started = Date.now();
    const res = spawnSync("python3", [SECRET_READ], { input: payload, encoding: "utf8", env, cwd, timeout: c.maxMs || 20_000 });
    const tookMs = Date.now() - started;
    const logText = readLog(guardDir);
    const said = `${res.stdout || ""}${res.stderr || ""}`;
    const actual = res.status === 0 ? decide(res.stdout, logText) : `exit ${res.status}`;
    const problems = [];
    if (actual !== c.expect) problems.push(`got ${actual}`);
    if (c.maxMs && (res.error || tookMs > c.maxMs)) problems.push(`took ${tookMs} ms, budget ${c.maxMs} ms`);
    if (res.status !== 0) problems.push(`exit ${res.status}: ${(res.stderr || "").trim().split("\n").pop()}`);
    if ((said + logText).includes(SENTINEL)) problems.push("output or warn.log holds the planted value");
    if (c.has && !said.includes(c.has)) problems.push(`output does not name "${c.has}"`);
    if (c.silent && said.trim()) problems.push("printed output on a malformed payload");
    if (c.expect === ALLOW && logText.includes("\tsecret-read\t")) problems.push("wrote a secret-read warn.log line");
    if (c.expect === WARN && !/systemMessage/.test(res.stdout || "")) problems.push("warn printed no systemMessage");
    if (c.expect === DENY && !/\tsecret-read\tdeny\t/.test(logText)) problems.push("denied without a secret-read deny line in warn.log");
    return { ...c, actual, ok: problems.length === 0, reason: problems.join("; ") };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runEnvCheckCase(c) {
  const cwd = mkdtempSync(join(tmpdir(), "guards-ec-"));
  try {
    for (const [name, body] of Object.entries(c.files)) writeFileSync(join(cwd, name), body);
    for (const d of c.dirs || []) mkdirSync(join(cwd, d));
    if (!existsSync(ENV_CHECK)) return { ...c, expect: `exit ${c.exit}`, actual: "missing", ok: false, reason: "env-check.py not found" };
    const res = spawnSync("python3", [ENV_CHECK, ...c.args], { encoding: "utf8", env: baseEnv(), cwd, timeout: 20_000 });
    const expect = `exit ${c.exit}`;
    const actual = `exit ${res.status}`;
    const problems = [];
    if (actual !== expect) problems.push(`got ${actual}`);
    if (c.stdout !== undefined && res.stdout !== c.stdout) problems.push(`stdout ${JSON.stringify(res.stdout)}`);
    if (c.stderr && !(res.stderr || "").includes(c.stderr)) problems.push(`stderr does not name "${c.stderr}"`);
    if (`${res.stdout || ""}${res.stderr || ""}`.includes(SENTINEL)) problems.push("stdout or stderr holds the fixture value");
    return { ...c, expect, actual, ok: problems.length === 0, reason: problems.join("; ") };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

export function runGuardCases({ only = null } = {}) {
  const pick = (list) => (only ? list.filter((c) => c.id.includes(only)) : list);
  const modes = pick([...MODE_CASES, ...KEY_CASES, ...DEL_CASES]);
  const srs = pick(SR_CASES);
  const ecs = pick(EC_CASES);
  const selected = [...modes, ...srs, ...ecs];
  const out = { skipped: null, selected, results: [] };
  const py = spawnSync("python3", ["--version"], { stdio: "ignore" });
  if (py.error) return { ...out, skipped: "python3 not found on PATH" };

  for (const c of modes) {
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
  for (const c of srs) out.results.push(runSecretReadCase(c));
  for (const c of ecs) out.results.push(runEnvCheckCase(c));
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
  const count = (p) => results.filter((r) => r.id.startsWith(p)).length;
  console.log(
    `\n${failed ? "✗" : "✓"} ${results.length} cases (${count("mode/")} mode, ${count("key-literal")} key-literal, ${count("delete-outside")} delete-outside, ${count("sr")} secret-read, ${count("env-check/")} env-check) · ${failed} failures`
  );
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
