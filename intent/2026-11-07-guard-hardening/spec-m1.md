---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T14:00:00-0500
author: the maintainer
module: m1
---

# Spec m1: protected push and the staged-secret line

Built from `intent.md` in this folder (written in the same commit), module m1 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, `intent/README.md`, ADR-0002, ADR-0003, ADR-0016, ADR-0017, `docs/enforce-mode.md`, `docs/hook-loading.md`, `docs/licenses.md`, `plugins/pro-core/scripts/git-safe.py`, `tests/git-safe.mjs`, `plugins/pro-ai-sdlc/scripts/guard.py`, `plugins/pro-ai-sdlc/scripts/production-gate.py`, `plugins/pro-ai-sdlc/scripts/plan-sync.py` (the `stale-done` mode rule), `plugins/pro-quality/scripts/floor-guard.py`, super-board `hooks/guard-protected-push.py` and agent-skills 30187c1.

## Summary

`git-safe.py` reads each `git push` as flags and refspecs and asks git which branch is checked out and which branch is the default.
The parser runs beside today's whole-segment regex rules, which stay byte-for-byte so everything that blocks today keeps exit 2.
Every other push that would update or delete a protected branch is flagged under a new `protected-push` mode key that starts in warn.
`/ship`'s security checklist names the files whose staged diff mentions a secret word and never prints the matching line.
Everyone with pro-core (every `pro-dev-starter` install) gets the push guard on the next update; everyone with pro-ship gets the checklist line.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. `git-safe.py` exits 2 with `BLOCKED: <reason>` on stderr for a block and has no warn mode; `tests/git-safe.mjs` reads exit 2 as block.
2. The forms that block today are whatever `_GIT_PUSH_FORCE` and `_GIT_PUSH_PROTECTED` match on a whole segment, minus what `_GIT_PUSH_DELETE` exempts.
   The segment text includes pushes inside `bash -c "..."`, `sh -c`, `eval`, `ssh host "..."` and heredoc bodies, which `git-safe.py` keeps in scope on purpose (lines 135 to 138).
   That covers `git push origin main`, `+main`, `feat:main`, `main:feature`, `-u origin main`, `--force` or `-f` without a lease and the false positives `main-fix` and `master.bak`.
3. Plugins cannot import each other (ADR-0003) so the mode lookup and `warn.log` writer are copied from `plugins/pro-ai-sdlc/scripts/guard.py` into a pro-core helper, the way `floor-guard.py` does it.
4. The `stale-done` rule in `plan-sync.py` is the precedent for a new guard: only its own `mode.<key>` file turns it to enforce.
5. A hook may run local `git` commands that read refs; it runs no network call (REVIEW.md pass 2).
6. Hooks run with `python3`, which is 3.9.6 on macOS; the scripts use the standard library only.
7. The printing grep is on line 32 of `plugins/pro-ship/skills/ship/references/security-checklist.md` and nowhere else under `plugins/` (`git grep 'diff --cached | grep' -- plugins/`); the intent folder quotes it on purpose.

## Requirements

### Functional

- R1. The parser is added beside the regex push rules, never in place of them: `_GIT_PUSH_FORCE`, `_GIT_PUSH_PROTECTED`, `_GIT_PUSH_DELETE` and their two check functions stay byte-for-byte and run first on every segment as today.
- R1a. The parser splits the command into simple commands with a quote-aware tokenizer, strips leading `NAME=value` assignments and the wrappers `sudo`, `env` and `command`, follows `cd <dir>` for later segments and reads `git -C <dir>`, `-c`, `--git-dir` and `--work-tree` before the subcommand (intent: "parses each `git push` into its flags and refspecs").
- R2. For each `git push` it separates flags from positional words, skipping the values of `--repo`, `--receive-pack`, `--exec`, `-o` and `--push-option`; the first positional word is the remote and the rest are refspecs.
- R3. A refspec's destination is the part after `:` or the whole refspec, with a leading `+` dropped and a leading `refs/heads/` dropped; `HEAD` or `@` resolves to the branch checked out in the push's directory.
- R4. The parser never exits 2: only the regex rules of R1 hard-block, with today's `BLOCKED:` reasons so every form that blocks today keeps blocking and no new plain deny is added.
- R5. A push the regex rules already block is not reported again by the parser.
- R6. The protected set is `main`, `master`, the default branch from `git symbolic-ref --short refs/remotes/<remote>/HEAD` with the remote prefix dropped and each name in a `protected-branches` file in the guard folder, one per line, with blank lines and `#` lines ignored.
- R7. A push the regex rules let through is a `protected-push` finding when it would update or delete a protected branch, including a destination spelled `main` or `master` and a force push that the regex misses (such as `git -C <dir> push origin main` and `git -C <dir> push --force origin main`): `--delete` or `-d` with a protected name, a refspec `:<protected>`, a destination `refs/heads/<protected>`, a `+` refspec onto a protected branch, a destination that resolves to a protected branch through `HEAD`, `@` or the protected list, a push with no refspec while a protected branch is checked out (unless `--tags` is given) and `--all`, `--mirror` or `--branches`.
- R8. `-n` or `--dry-run` is never a `protected-push` finding; the regex rules still read the command as they do today.
- R9. The `protected-push` mode is `warn` unless `mode.protected-push` in the guard folder holds `enforce`; the global `mode` file and `CLAUDE_GUARD_MODE` leave it in warn.
  The guard folder is `CLAUDE_GUARD_DIR` when set and `~/.claude/hooks` otherwise.
- R10. In warn mode a finding appends one `warn.log` line (time, `protected-push`, `would-deny`, the kind and branch, the working directory), prints a JSON `systemMessage` and `additionalContext` that names the kind and the branch and exits 0.
- R11. In enforce mode a finding appends a `deny` line and prints a PreToolUse `permissionDecision: deny` whose reason names the kind (delete, direct push, force push, every branch), the branch, the protected set and the way forward: push a feature branch and open a PR or ask the person to run the push.
- R12. Every git call the guard makes is local (`symbolic-ref`, `branch --show-current`), has a 5 second timeout and runs with the `GIT_*` environment stripped; a failed or timed-out call reads as unknown.
  Unknown never makes a finding.
- R13. The guard runs a git command only when a segment is a `git push`.
- R14. A malformed, empty or non-object payload or any exception in the protected-push code exits 0 with no output; the regex rules run first and are not skipped by an error in the protected-push code.
- R15. `tests/git-safe.mjs` reads a JSON `permissionDecision: deny` as block, runs each case with `CLAUDE_GUARD_DIR` set to a throwaway folder and can set the case's working directory to a fixture repo, its mode files and its `protected-branches` file.
- R16. `tests/guards.mjs` exists, exports `runGuardCases()` and is run by a `guards` check in `tests/check.mjs`; in m1 it holds the mode-lookup cases for the pro-core guard helper.
- R17. Line 32 of `security-checklist.md` reads `git diff --cached -i -G'password|secret|api_key|token' --name-only`, says it lists only the names of files whose staged diff matches and says any output means reviewing those files before committing (intent item 40).

### Non-functional

- N1. A Bash command with no `git push` costs no subprocess and no file read.
- N2. A push the guard checks adds under 200 ms on a local repo; `hooks.json` gives `git-safe.py` a 10 second timeout.
- N3. No `warn.log` line, message or reason holds more of the command than the push segment.
- N4. pro-core bumps a minor version and pro-ship a patch version in both manifests and the marketplace entry, with `metadata.version` bumped once per PR.

### Policy constraints applied

- Hook-loading law (ADR-0003): `git-safe.py` is already in pro-core's one `hooks/hooks.json`; the helper is imported, not registered.
- Version-bump law (ADR-0002): N4.
- Gate enforce rule (ADR-0016): the new findings start in warn under their own key (R9) and get a row in `docs/enforce-mode.md`.
- REVIEW.md pass 2: fail open (R14), local git only (R12), writes only `warn.log`.
- Forked content (REVIEW.md pass 3): the tokenizer and refspec reading are adapted from super-board's `guard-protected-push.py`; the script keeps a footer, `plugins/pro-core/LICENSE` gains the Eric Tech line and `docs/licenses.md` gains an adapted row.
- The definition of done (ADR-0017): the plan cites it.

### Boundaries

Always: keep every case that blocks today blocking, add a case for each new form, bump versions.
Ask first: changing a hard block into a warn, adding a branch to the built-in set, making `protected-push` enforce by default.
Never: run `git fetch` or any network call from the hook, print a secret, block on the guard's own error.

## Design

### User experience

A person or agent who pushes a protected branch through one of the new forms sees one warn line: `[protected-push] warn mode: would deny delete of main (logged to warn.log, allowed)`.
Under `mode.protected-push` holding `enforce` the push is denied with the reason in R11.
`git push origin main` reads as today.
`/ship` lists file names where it used to print lines.

### System

- `plugins/pro-core/scripts/guardlib.py` (new): `guard_dir()`, `own_mode(key)`, `log()`, `warn()`, `deny()` and `segments()`; copied from `guard.py` with the `stale-done` own-key rule and a comment to keep the two in step.
- `plugins/pro-core/scripts/git-safe.py`: a parser built on `guardlib.segments()` is added after the regex rules; every existing rule stays as it is.
- `plugins/pro-core/hooks/hooks.json`: `"timeout": 10` on the `git-safe.py` entry.
- `plugins/pro-ship/skills/ship/references/security-checklist.md`: line 32.
- `tests/git-safe.mjs`, `tests/guards.mjs` (new), `tests/check.mjs`.
- Docs: `docs/enforce-mode.md` (row `protected-push`), `docs/hook-loading.md` (a "Registered by pro-core" line for `git-safe.py`), `docs/licenses.md`, `docs/roadmap.md` (32 and 40 ticked), `plugins/pro-core/LICENSE` and the pro-core description in both manifests and the marketplace.

### Alternatives considered

- Port super-board's guard as a separate script beside `git-safe.py`: two hooks would read the same push and could both deny it.
- Turn every protected-branch rule into a warn: weakens `git push origin main`, which blocks today.
- Replace the regex rules with the parser: a quote-aware split stops seeing pushes inside `bash -c`, `sh -c`, `eval`, `ssh` and heredoc bodies; `main:feature` would also pass, though all of these block today.
- Extend `production-gate.py` instead: it is in pro-ai-sdlc, which is opt-in and not in the starter; it also asks rather than denies.
- Read the protected list from the repo: a repo file can be edited by the agent the guard watches; the guard folder is per machine, like the mode files.

## Flagged concerns

ADR needed: no, ADR-0016 already sets how a guard starts in warn and moves to enforce and ADR-0017 sets the definition of done; this module applies them to one more guard.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent asks for no plain deny but `git-safe.py` plain-denies today and those blocks must not weaken | ADR-0016, intent | resolved on 2026-11-07: the forms that block today keep exit 2 (R4); every newly caught form goes through `protected-push`, which starts in warn |
| 2 | `git -C <dir> push origin main` and force pushes behind `-C` pass the regex today | ADR-0016, intent | resolved on 2026-11-07: the parser catches them as `protected-push` findings in warn like every newly caught form (R7); no new plain deny and the force rule is unchanged |
| 3 | A global `mode` file or `CLAUDE_GUARD_MODE` set to `enforce` would turn the new findings on before their evidence period | ADR-0016, `docs/enforce-mode.md` | resolved on 2026-11-07: only `mode.protected-push` enforces it, as `stale-done` does (R9) |
| 4 | With pro-ai-sdlc installed, `production-gate.py` also flags a push to `main` so one push can carry two messages | `docs/enforce-mode.md` | resolved on 2026-11-07: accepted; each names its own gate, a deny wins over an ask and the deny reason tells the person to run the push themselves |
| 5 | `--all`, `--mirror` and `--branches` are not in the roadmap item but update every branch | intent | resolved on 2026-11-07: included in R7, since the parser sees them at no cost and `production-gate.py` already treats them as a push to the default branch |
| 6 | Keeping the regex keeps its false positives: `git push origin main-fix` and `git push origin master.bak` still exit 2 | REVIEW.md pass 1 | resolved on 2026-11-07: accepted and written in the `protected-push` row of `docs/enforce-mode.md`; loosening a hard block needs its own change and a case pins today's behavior |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. In a fixture repo with `main` checked out and the default mode, `git push origin --delete main`, `git push --delete origin main`, `git push origin :main`, `git push origin HEAD:refs/heads/main`, `git push origin refs/heads/main`, a bare `git push`, `git push origin HEAD`, `git push --all`, `git -C . push origin main` and `git -C . push --force origin main` each exit 0 and write a `protected-push` `would-deny` line to `warn.log`.
- AC2. The same commands with `mode.protected-push` holding `enforce` each print a `permissionDecision: deny`.
- AC3. In a fixture repo whose `origin/HEAD` points at `trunk`, `git push origin trunk` is a finding; with `release` in `protected-branches`, `git push origin release` is a finding.
- AC4. With a global `mode` file holding `enforce` and no `mode.protected-push`, the AC1 commands stay in warn.
- AC5. Every existing case in `tests/git-safe.mjs` passes unchanged; `git push origin main`, `git push origin +main`, `git push origin feat:main`, `git push origin main:feature`, `bash -c "git push origin main"`, `sh -c "git push origin main"`, `eval "git push origin main"`, `ssh host "git push --force origin main"`, a `bash <<EOF` heredoc whose body is `git push origin main` and `git push origin main-fix` exit 2 as they do today.
- AC6. `git push origin feat/thing`, `git push --dry-run origin HEAD:refs/heads/main` and a bare `git push` on a feature branch pass with no `warn.log` line.
- AC7. A payload of `not json`, `{}`, `[]` and a command that is not a string each exit 0 with no output.
- AC8. Line 32 of `security-checklist.md` holds the `--name-only` command and `git grep -n 'diff --cached | grep' -- plugins/` finds nothing.
- AC9. `node tests/git-safe.mjs`, `node tests/guards.mjs`, `node tests/check.mjs`, `claude plugin validate plugins/pro-core --strict` and `claude plugin validate plugins/pro-ship --strict` pass.

## Out of scope

- The secret-read, key-literal and delete-outside guards (modules m2 and m3).
- Any change to `push-gate.py` or `production-gate.py`.
- Reading branch protection from GitHub.
