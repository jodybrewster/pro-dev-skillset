---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T14:00:00-0500
author: the maintainer
module: m3
---

# Spec m3: key literals and delete outside

Built from `intent.md` in this folder (written in the same commit), module m3 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0013, ADR-0016, ADR-0017, `docs/enforce-mode.md`, `docs/hook-loading.md`, `docs/licenses.md`, `plugins/pro-security/hooks/hooks.json`, `plugins/pro-security/scripts/push-gate.py`, `plugins/pro-ai-sdlc/scripts/incident.py` (the `CREDENTIALS` list), `plugins/pro-ai-sdlc/scripts/guard.py`, `plugins/pro-quality/scripts/floor-guard.py`, the m1 helper `plugins/pro-core/scripts/guardlib.py`, super-board `hooks/guard-key-literals.py` and `hooks/guard-delete-outside.py`.

## Summary

Two guards land, each in warn under its own mode key.
pro-security's `key-literal.py` reads the text of an Edit, Write or MultiEdit before it reaches disk and the file after it is written.
It flags a live-looking credential by kind and line number, never by value.
pro-core's `delete-outside.py` flags `rm`, `rmdir`, `unlink`, `find -delete`, `find -exec rm` and `git clean` whose target resolves outside the project root, leaving the temp folders and the pro-dev state folder alone.
pro-security users get the first and every `pro-dev-starter` install gets the second on the next update.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. pro-security registers one hook today, `push-gate.py` on Bash, with no warn mode and no Edit or Write matcher.
2. `incident.py` keeps the credential patterns in `CREDENTIALS`; pro-security cannot import it (ADR-0003, ADR-0013) so the subset is copied with a comment to keep the two in step, as `floor-guard.py` already does for its redaction list.
3. The Edit payload carries `tool_input.file_path` and `new_string`; Write carries `file_path` and `content`; MultiEdit carries `file_path` and `edits`, each with `new_string`.
4. Claude Code sets `CLAUDE_PROJECT_DIR` for hooks and the payload carries `cwd`.
5. `git-safe.py` already blocks `rm -rf` of `/`, `~` and `$HOME` with exit 2 and `git clean -x`; those rules stay.
6. m1 has landed: `guardlib.py` and `tests/guards.mjs` exist.
7. No tracked file in this repo holds a key-shaped literal today (`git grep -E "AKIA[A-Z0-9]{12}|ghp_[A-Za-z0-9]{20}|sk-ant-[A-Za-z0-9_-]{20}"` finds nothing).

## Requirements

### Functional

Key literals (item 34):

- R1. `plugins/pro-security/scripts/key-literal.py` is registered in pro-security's `hooks/hooks.json` as a PreToolUse hook and a PostToolUse hook, each with matcher `Edit|Write|MultiEdit` and a 5 second timeout; it has no Bash matcher.
- R2. The patterns are the `incident.py` entries for AWS key ids (`AKIA`, `ASIA`), Anthropic keys (`sk-ant-`), GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), Slack tokens (`xox[bpa]-`, `xapp-`) and private key blocks, with `xox[a-z]` narrowed to `xox[bpa]` and at least 20 characters after the `sk-ant-`, `xox?-` and `xapp-` prefixes.
- R3. A line is not a finding when it reads from the environment (`process.env`, `import.meta.env`, `os.environ`, `getenv`, `Deno.env`, `System.getenv`, `ENV[`, `${{ secrets.`) or holds an obvious stand-in (`your_`, `your-`, `xxxx`, `<` followed by a letter, `...`, `placeholder`, `example`, `changeme`, `dummy`, `fake`, `redacted`).
- R4. A file whose name is `.env.example`, `.env.sample` or `.env.template` is never checked.
- R5. PreToolUse reads `content` for Write, `new_string` for Edit and each `edits[].new_string` for MultiEdit and finds the first five matching lines, numbered within the text (for MultiEdit, as edit and line).
- R6. PreToolUse mode is `warn` unless `mode.key-literal` in the guard folder holds `enforce`; the global `mode` file and `CLAUDE_GUARD_MODE` leave it in warn.
  Warn mode logs `would-deny`, prints `systemMessage` and `additionalContext` and allows; enforce mode logs `deny` and prints `permissionDecision: deny`.
- R7. PostToolUse reads the one file at `tool_input.file_path`, skips it when it is over 1 MB, unreadable or holds a NUL byte.
  On a match it logs `found-on-disk` and prints `systemMessage` and `additionalContext` in either mode; it never blocks.
- R8. Every message and `warn.log` line names the kind of credential, the file's basename and the line numbers, never the value or any part of the matched line; the message says to move the value to the local dotenv file, read it from the environment and add only the key name to `.env.example`.
- R9. A malformed payload, a missing field or any exception exits 0 with no output.

Delete outside (item 43):

- R10. `plugins/pro-core/scripts/delete-outside.py` is registered in pro-core's `hooks/hooks.json` as a PreToolUse hook on `Bash` with a 5 second timeout.
- R11. It reads `rm`, `rmdir` and `unlink` operands (words after `--` included, flags skipped), the starting paths of a `find` that has `-delete` or `-exec` or `-execdir` followed by `rm`, `rmdir` or `unlink` plus the directory of a `git clean`, taken from `git -C <dir>` or the current directory.
- R12. It tracks the directory through `cd <dir>` segments, starting from the payload `cwd`; it expands `~`, `$HOME`, `${HOME}` and other variables set in the hook's environment; a word with `$(`, a backtick or a variable assigned earlier in the same command is unknown and skipped.
- R13. The project root is `CLAUDE_PROJECT_DIR` when set and the payload `cwd` otherwise; a target is inside when its normalized path or its real path is the root or under it.
- R14. Targets below (never equal to) `/tmp`, `/private/tmp`, `/var/folders`, `/private/var/folders`, `$TMPDIR` or the pro-dev state folder (`PRO_DEV_STATE_DIR` when set and `~/.claude/pro-dev` otherwise) are exempt; the guard folder is not exempt.
- R15. A target outside the root that is not exempt is a `delete-outside` finding; the mode is `warn` unless `mode.delete-outside` holds `enforce`, with the same warn and enforce output as R6.
- R16. The message names the command, the word as written, the resolved path and the project root.
  It says to delete inside the repo or a temp folder or ask the person to run it.
- R17. A malformed payload or any exception exits 0 with no output; the guard reads no file and runs no subprocess.

Tests:

- R18. `tests/guards.mjs` gains cases for R2 to R9 and R11 to R17, in both modes, with every key-shaped fixture built at run time from parts so no tracked file holds a literal key.
- R19. A key-literal case plants a full-length fake key and asserts the key text appears in neither stdout, stderr nor `warn.log`.

### Non-functional

- N1. PreToolUse key-literal and delete-outside checks return in under 50 ms for a typical edit or command.
- N2. pro-security and pro-core each bump a minor version in both manifests and the marketplace entry, with `metadata.version` bumped once per PR.

### Policy constraints applied

- Hook-loading law (ADR-0003): each new entry joins its plugin's one `hooks/hooks.json`.
- Version-bump law (ADR-0002): N2.
- Layering (ADR-0013): the credential list is copied, not imported; a comment names `incident.py`, `floor-guard.py` and `pr-check.py` as the copies to keep in step.
- Gate enforce rule (ADR-0016): both guards start in warn under their own key and get a row in `docs/enforce-mode.md`.
- No double denial with `push-gate.py`: the key-literal guard has no Bash matcher (R1) so it never sees a push.
- REVIEW.md pass 2: fail open (R9, R17); `key-literal.py` reads only the file the tool just wrote.
- Adapted content: both scripts come from super-board and carry a footer; `plugins/pro-security/LICENSE` and `plugins/pro-core/LICENSE` name the upstream and `docs/licenses.md` gains the rows.

### Boundaries

Always: report kinds and line numbers, build fixtures from parts, keep the temp roots deletable.
Ask first: adding a pattern, adding Bash to the key-literal matcher, exempting another folder, enforcing either guard by default.
Never: print or log a matched value, scan files other than the one written, block from PostToolUse.

## Design

### User experience

An agent that writes `AWS_KEY = "AKIA..."` (a full key) into `src/config.ts` sees `[key-literal] warn mode: would deny an AWS key id at line 3 of config.ts (logged to warn.log, allowed)` and the way forward.
An agent that runs `rm -rf ../other-project` sees `[delete-outside] warn mode: would deny rm of ../other-project, which resolves to <path> outside <root>`.

### System

- `plugins/pro-security/scripts/key-literal.py` (new), with its own copy of the mode lookup and `warn.log` writer from `guard.py`, since pro-security cannot import pro-core.
- `plugins/pro-security/hooks/hooks.json`: a PreToolUse and a PostToolUse entry.
- `plugins/pro-core/scripts/delete-outside.py` (new), on `guardlib.py`.
- `plugins/pro-core/hooks/hooks.json`: a PreToolUse Bash entry.
- `tests/guards.mjs`: the R18 and R19 cases.
- Docs: `docs/enforce-mode.md` (rows `key-literal` and `delete-outside`), `docs/hook-loading.md`, `docs/licenses.md`, `docs/roadmap.md` (34 and 43 ticked), both `LICENSE` files and both plugin descriptions in their manifests and the marketplace.

### Alternatives considered

- Watch Bash in the key-literal guard, as super-board does: it would see every `git push` and `gh pr create` that `push-gate.py` gates and would flag heredocs that only quote a key pattern.
- Block from PostToolUse: the file is already written so a block only adds noise; the context message asks the agent to fix it.
- Exempt the guard folder from delete-outside: deleting a `mode.<gate>` file loosens a gate so it should show in the log.
- Put the key-literal guard in pro-core: the credential knowledge already lives in the security and incident plugins and pro-security is the plugin a person installs for it.

## Flagged concerns

ADR needed: no, ADR-0016 governs how a guard starts and moves to enforce, ADR-0017 the definition of done and ADR-0013 where shared knowledge is copied; both guards apply them.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | Copying `incident.py`'s patterns makes a fourth copy of the credential list | ADR-0013, REVIEW.md pass 1 | resolved on 2026-11-07: the copy carries the same keep-in-step comment as the others and a `tests/check.mjs` assertion is left to a later item |
| 2 | `incident.py`'s `sk-ant-` and Slack patterns match a bare prefix plus one character, which docs that name the prefix would trip | REVIEW.md pass 1 | resolved on 2026-11-07: R2 requires 20 characters after those prefixes, as super-board does; real keys are longer |
| 3 | `delete-outside` and `git-safe.py` can both deny `rm -rf ~` in enforce | `docs/enforce-mode.md` | resolved on 2026-11-07: accepted; both reasons name the same fix and `git-safe.py` keeps its hard block |
| 4 | `/execute` worktrees live beside the checkout so `rm -rf ../<repo>-<slug>` is flagged | `plugins/pro-ai-sdlc/commands/execute.md` | resolved on 2026-11-07: accepted in warn; worktrees are removed with `git worktree remove`, which the guard does not read |
| 5 | The stand-in filter (R3) lets a real key through when its line also says `example` | REVIEW.md pass 2 | resolved on 2026-11-07: accepted limit written in the `docs/enforce-mode.md` row; the floor guard and the push gate still see the diff before it leaves |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. In the default mode, a Write whose content holds a fake key of each R2 kind exits 0 and logs a `key-literal` `would-deny` line naming the kind and line; with `mode.key-literal` holding `enforce`, the same payload prints `permissionDecision: deny`.
- AC2. A Write of `const k = process.env.ANTHROPIC_API_KEY`, of `AKIAEXAMPLE...` with `example` on the line and of any key into `.env.example` passes with no line.
- AC3. A PostToolUse payload for a file that holds a fake key on line 7 prints `additionalContext` naming line 7 and never denies, in both modes.
- AC4. The R19 case passes: the planted key appears in no output and no `warn.log` line.
- AC5. With the project root set to a fixture folder, `rm -rf ../other`, `rm ~/notes.txt`, `find /var/lib/x -delete`, `find ../y -exec rm {} \;`, `git -C ../other clean -fd` and `cd .. && rm -rf other` are `delete-outside` findings; with `mode.delete-outside` holding `enforce` they print `permissionDecision: deny`.
- AC6. `rm -rf build`, `rm -rf /tmp/x`, `rm -rf "$TMPDIR/x"`, `rm -rf ~/.claude/pro-dev/x` (with `PRO_DEV_STATE_DIR` unset), `rm -rf $(mktemp -d)` and `git clean -fd` inside the root pass with no line; `rm -rf /tmp` itself and `rm ~/.claude/hooks/mode.floor-guard` are findings.
- AC7. With only a global `mode` file holding `enforce`, both guards stay in warn.
- AC8. Malformed payloads exit 0 with no output for both scripts.
- AC9. `node tests/guards.mjs`, `node tests/git-safe.mjs`, `node tests/check.mjs`, `claude plugin validate plugins/pro-security --strict` and `claude plugin validate plugins/pro-core --strict` pass.

## Out of scope

- Scanning the whole repo or the staged diff for keys.
- Installing gitleaks, trufflehog or any other scanner.
- Watching `NotebookEdit` or Bash for key literals.
- `trash`, `shred` and moves with `mv` out of the project.
