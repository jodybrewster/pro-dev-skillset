---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T14:00:00-0500
author: the maintainer
module: m2
---

# Spec m2: secret read

Built from `intent.md` in this folder (written in the same commit), module m2 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0016, ADR-0017, `docs/enforce-mode.md`, `docs/hook-loading.md`, `docs/licenses.md`, `plugins/pro-core/scripts/git-safe.py`, `plugins/pro-ai-sdlc/scripts/copy-env.py`, `plugins/pro-ai-sdlc/scripts/guard.py`, the m1 helper `plugins/pro-core/scripts/guardlib.py`, super-board `hooks/guard-secrets.py` and `scripts/super-board-env-check.sh`.

## Summary

A new pro-core guard, `secret-read.py`, watches the Read, Grep and Bash tools for a read of a dotenv file, a private SSH key, a `.pem` file, `.npmrc`, a credentials file or a service-account JSON.
It starts in warn under the `secret-read` mode key and tells the agent to read `.env.example` for key names or to ask `env-check.py`.
`env-check.py` answers `present`, `empty` or `missing` for each key name and never prints a value.
Every `pro-dev-starter` install gets both on the next pro-core update.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. No plugin registers a PreToolUse hook on `Read` or `Grep` today; `git-safe.py` blocks only a write redirect into `.env`.
2. The Read tool's payload carries `tool_input.file_path`; the Grep tool's carries `tool_input.path` and `tool_input.glob`.
3. `copy-env.py` copies env files for `/execute` with a Python call whose command line names no env file so the guard never sees it.
4. m1 has landed: `guardlib.py` (mode lookup, `warn.log`, `segments()`) and `tests/guards.mjs` exist in pro-core and this repo.
5. Grep and ripgrep skip git-ignored files by default so a recursive search of the repo does not usually reach `.env`.

## Requirements

### Functional

- R1. `plugins/pro-core/scripts/secret-read.py` is registered in pro-core's `hooks/hooks.json` as a PreToolUse hook with matcher `Read|Grep|Bash` and a 5 second timeout (intent: "a secret-read guard on `Read`, `Grep` and `Bash`").
- R2. A path is secret when its last component is `.env` or starts with `.env.`, other than `.env.example`, `.env.sample` and `.env.template`; is `.dev.vars` or starts with `.dev.vars.`; starts with `id_` and has no extension (so `id_rsa` and `id_ed25519` are secret; `id_ed25519.pub` and any other extension are not); ends in `.pem`; is `.npmrc`; starts with `credentials` and has no extension or one of `.json`, `.yml`, `.yaml`, `.ini`, `.toml` or `.txt` (so `src/auth/credentials.ts` is not secret); or contains `service-account` and ends in `.json`.
  R2 applies to concrete paths only: a word holding `*`, `?` or `[` is never matched against it.
- R3. A glob word (`*`, `?` or `[`) is secret only when its last path component has a literal secret prefix or suffix: the text before the first glob character is `.env`, starts with `.env.`, starts with `.dev.vars`, starts with `id_` or starts with `credentials`, or the text after the last glob character ends in `.pem`.
  So `.env*`, `~/.ssh/id_*`, `credentials*` and `certs/*.pem` are findings; no glob is ever expanded or matched against file names so broad globs such as `*`, `*.json` and `cat *` are not.
- R4. Read: a finding when `file_path` is secret.
- R5. Grep: a finding when `path` is secret or `glob` is secret by R3.
- R6. Bash: a finding when a simple command is `cat`, `less`, `more`, `head`, `tail`, `sed`, `grep`, `egrep`, `fgrep` or `rg` and one of its file words is secret; for `grep`, `egrep`, `fgrep`, `rg` and `sed` the first non-flag word is the pattern or script and is not a file word, unless `-e`, `-f` or `--regexp` supplied it.
- R7. Bash: a finding when any simple command has an input redirect (`<`, `0<`) from a secret path.
- R8. Bash: a finding when a pipeline runs `xargs` with one of the R6 commands after it and any word in that pipeline is secret.
- R9. Bash: a plain call to `env-check.py` (optionally after `python3`) whose command has no pipe, `;`, `&&`, `||`, redirect, backtick or `$(` is never a finding.
- R10. `source` and `.` of a dotenv file are not findings; they load values into the shell without printing them.
- R11. The mode is `warn` unless `mode.secret-read` in the guard folder holds `enforce`; the global `mode` file and `CLAUDE_GUARD_MODE` leave it in warn.
- R12. Warn mode logs `would-deny` with the tool, the kind of file and its basename, prints the `systemMessage` and `additionalContext` and allows.
  Enforce mode logs `deny` and prints `permissionDecision: deny`.
- R13. Both messages say which kind of file was touched and never its content.
  They give the way forward: read `.env.example` for key names, run `python3 <absolute path of env-check.py> KEY [KEY ...]` or ask the person to run the command.
- R14. The guard reads no file other than its own mode file, writes nothing but its `warn.log` line, runs no subprocess and makes no network call; a malformed payload or any exception exits 0 with no output (intent: "fails open on its own errors").
- R15. `plugins/pro-core/scripts/env-check.py [--file <path>] KEY [KEY ...]` prints one line per key, `KEY present`, `KEY empty` or `KEY missing`, with nothing else on stdout.
- R16. With no `--file`, `env-check.py` reads the first of `.env.local` and `.env` that exists in the working directory; with none, every key is `missing`.
- R17. `env-check.py` reads `KEY=value` and `export KEY=value` lines, ignores lines whose first non-blank character is `#` and treats a value that is empty after trimming quotes and blanks as `empty`; the last assignment of a key wins.
- R18. A key name that is not `[A-Za-z_][A-Za-z0-9_]*` exits 64 with a usage line that names the bad key and nothing from the file; a missing `--file` value exits 64.
- R19. `env-check.py` exits 0 when every key is present and 1 otherwise; an unreadable file reads as every key `missing` with exit 1 and an error line on stderr that names the path only.
- R20. `tests/guards.mjs` gains cases for each R2 kind on each tool, for the R6 pattern exception, for R7 to R10, for both modes and for malformed payloads; and `env-check.py` cases that plant a sentinel value and assert it is absent from stdout and stderr in every outcome.

### Non-functional

- N1. A Read, Grep or Bash call with no secret name in it returns in under 50 ms; the guard does only string work.
- N2. No `warn.log` line, message or test output holds a value read from a secret file.
- N3. pro-core bumps a minor version in both manifests and the marketplace entry, with `metadata.version` bumped once.

### Policy constraints applied

- Hook-loading law (ADR-0003): the new entry joins pro-core's one `hooks/hooks.json`; both scripts are tracked.
- Version-bump law (ADR-0002): N3.
- Gate enforce rule (ADR-0016): warn start under `secret-read` (R11) and a row in `docs/enforce-mode.md`.
- REVIEW.md pass 2: the guard fails open (R14) and writes only `warn.log`.
- Adapted content: the path set and the env-check contract come from super-board's `guard-secrets.py` and `super-board-env-check.sh`; both scripts carry a footer, `plugins/pro-core/LICENSE` names them and `docs/licenses.md` gains the rows.

### Boundaries

Always: allow `.env.example`, allow the plain `env-check.py` call, log only basenames.
Ask first: adding a file kind, adding a Bash command to R6, turning `secret-read` to enforce by default.
Never: print or log a value, read a secret file from the guard, block on the guard's own error.

## Design

### User experience

An agent that runs `cat .env` sees `[secret-read] warn mode: would deny reading a dotenv file (.env) (logged to warn.log, allowed)` followed by the way forward.
An agent that needs to know whether a key is set runs `python3 <path>/env-check.py OPENAI_API_KEY` and reads `OPENAI_API_KEY present`.

### System

- `plugins/pro-core/scripts/secret-read.py` (new): `is_secret(path)`, `glob_is_secret(word)`, `findings(payload)`; uses `guardlib.segments()`, `own_mode()`, `warn()` and `deny()`.
- `plugins/pro-core/scripts/env-check.py` (new): a Python port of `super-board-env-check.sh`, standard library only.
- `plugins/pro-core/hooks/hooks.json`: one PreToolUse entry.
- `tests/guards.mjs`: the R20 cases.
- Docs: `docs/enforce-mode.md` (row `secret-read`), `docs/hook-loading.md`, `docs/licenses.md`, `docs/roadmap.md` (33 ticked), `plugins/pro-core/LICENSE` and the pro-core description in both manifests and the marketplace.

### Alternatives considered

- Deny any command that mentions a secret name, as super-board does: it flags `cp .env.example .env`, `ls -la .env` and `git check-ignore .env`, which read nothing.
- A shell port of `env-check`: the hooks are Python and Python 3.9 is the one runtime every install already needs.
- Put the guard in `git-safe.py`: it would need a second matcher on Read and Grep and mix two mode keys in one script.

## Flagged concerns

ADR needed: no, ADR-0016 already governs how a new guard starts and ADR-0017 the definition of done; the guard applies them.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent names only `.env.example` as readable but `.env.sample` and `.env.template` play the same role | intent, out of scope | resolved on 2026-11-07: all three stay readable (R2); none holds a real value by convention and blocking them would push agents to guess key names |
| 2 | `.dev.vars` is not in the roadmap item but holds Cloudflare secrets and `copy-env.py` already treats it as an env file | intent | resolved on 2026-11-07: included in R2 to match `copy-env.py` |
| 3 | `grep -r KEY .` and `cat *` can still reach a secret file through a directory or a broad glob | REVIEW.md pass 1 | resolved on 2026-11-07: accepted limit written in the `docs/enforce-mode.md` row; R2 matches concrete paths and R3 only globs with a literal secret prefix or `.pem` suffix, never a broad glob, since the guard is a guard rail, not a sandbox |
| 4 | `source .env && echo $KEY` prints a value and passes | REVIEW.md pass 1 | resolved on 2026-11-07: accepted limit in the same row; R10 keeps `source` working because dev servers and scripts need it |
| 5 | A machine with a user-level env guard sees two warnings for one `cat .env` | `docs/enforce-mode.md` | resolved on 2026-11-07: accepted; the plugin guard is the one this repo ships and a user-level hook is the person's own choice |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. In the default mode, Read of `.env`, `.env.local`, `config/.env.production`, `~/.ssh/id_ed25519`, `certs/server.pem`, `.npmrc`, `credentials.json` and `gcp-service-account.json` each exit 0 with a `secret-read` `would-deny` line in `warn.log`.
- AC2. Read of `.env.example`, `.env.sample`, `id_ed25519.pub` and `src/env.ts` exit 0 with no line.
- AC3. Bash `cat .env`, `head -5 .env.local`, `grep KEY .env`, `sed -n 1p .npmrc`, `python3 x.py < .env` and `echo .env | xargs cat` are findings; `grep -r ".env" src/`, `cp .env.example .env`, `source .env` and `ls -la .env` are not.
- AC4. Grep with `path: ".env"` and with `glob: ".env*"` are findings; Grep with `glob: "*.ts"` or `glob: "*.json"` is not.
- AC4a. Bash `cat *` and Grep `glob: "*.json"` are not findings; Bash `cat ~/.ssh/id_*`, `cat certs/*.pem`, `head *.pem` and Grep `glob: "id_*"` are findings; Read of `src/auth/credentials.ts` and of `scripts/id_helpers.py` is not a finding; Read of `config/credentials.yml` is.
- AC5. With `mode.secret-read` holding `enforce`, the AC1 and AC3 findings print `permissionDecision: deny`; with only a global `mode` holding `enforce`, they stay in warn.
- AC6. `python3 env-check.py --file <fixture> SET EMPTY MISSING` prints `SET present`, `EMPTY empty` and `MISSING missing` and exits 1; the fixture's sentinel value appears in neither stdout nor stderr; `env-check.py 'BAD-KEY'` exits 64.
- AC7. `python3 <path>/env-check.py KEY` is not a finding; `python3 <path>/env-check.py KEY | cat .env` is.
- AC8. Payloads of `not json`, `{}` and a Read with no `file_path` exit 0 with no output.
- AC9. `node tests/guards.mjs`, `node tests/git-safe.mjs`, `node tests/check.mjs` and `claude plugin validate plugins/pro-core --strict` pass.

## Out of scope

- Blocking reads of `.env.example`, `.env.sample` or `.env.template`.
- Watching `NotebookEdit`, `WebFetch` or MCP tools.
- Redacting secrets from a command's output after it ran.
