# Plan m1: protected push and the staged-secret line

Built from `spec-m1.md` (written in the same commit) and `intent.md` in this folder.
Status: approved (pre-approved on 2026-11-07).
Approver: the maintainer, as the security lead for a guard that every starter install runs.
Dated: 2026-11-07.

One pull request, built in its own worktree off `origin/main`.
It bumps pro-core from 0.25.0 to 0.26.0 and pro-ship from 0.16.1 to 0.16.2 (a patch, for a one-line doc fix) in both manifests and their marketplace entries.
`metadata.version` moves once, from 1.92.0 to 1.93.0 or to the next minor when another PR moved it first.

## Files that change

- `plugins/pro-core/scripts/guardlib.py` (new): `guard_dir()`, `own_mode(key)`, `log()`, `warn()`, `deny()` and `segments()`, copied from `plugins/pro-ai-sdlc/scripts/guard.py` with the own-key rule of `stale-done` and a keep-in-step comment.
- `plugins/pro-core/scripts/git-safe.py` (modified): a refspec parser on `guardlib.segments()` runs after the regex push rules, which stay byte-for-byte and keep their exit 2; new `protected-push` findings go through `own_mode("protected-push")`; an attribution footer for super-board.
- `plugins/pro-core/hooks/hooks.json` (modified): `"timeout": 10` on the `git-safe.py` entry.
- `plugins/pro-core/LICENSE` (modified): the super-board upstream and its copyright line; the hook-scripts sentence names the adapted file.
- `plugins/pro-core/.claude-plugin/plugin.json`, `plugins/pro-core/.codex-plugin/plugin.json` (modified): 0.25.0 to 0.26.0 and the description names the protected-push warn mode.
- `plugins/pro-ship/skills/ship/references/security-checklist.md` (modified): line 32.
- `plugins/pro-ship/.claude-plugin/plugin.json`, `plugins/pro-ship/.codex-plugin/plugin.json` (modified): 0.16.1 to 0.16.2.
- `.claude-plugin/marketplace.json` (modified): both plugin versions, the pro-core description and `metadata.version`.
- `tests/git-safe.mjs` (modified): the runner reads a JSON deny as block, sets `CLAUDE_GUARD_DIR` per case, builds fixture repos and checks `warn.log`; the new cases.
- `tests/guards.mjs` (new): `runGuardCases()` and the mode-lookup cases for `guardlib.py`.
- `tests/check.mjs` (modified): a `guards` check that runs `runGuardCases()`.
- `docs/enforce-mode.md` (modified): a `protected-push` row and its accepted limits.
- `docs/hook-loading.md` (modified): a "Registered by pro-core" line for `git-safe.py` and its mode key.
- `docs/licenses.md` (modified): an adapted row for `git-safe.py` from super-board and the line on hooks and scripts names the exception.
- `docs/roadmap.md` (modified): items 32 and 40 ticked with the PR.

## Order of work

1. Write `tests/guards.mjs` with `runGuardCases()`, an `--only=` filter on case ids like `tests/git-safe.mjs` has and failing cases for `guardlib.own_mode()`: no file reads warn, `mode.protected-push` holding `enforce` reads enforce, a global `mode` holding `enforce` reads warn, `CLAUDE_GUARD_MODE=enforce` reads warn; add the `guards` check to `tests/check.mjs` (size S; R9, R16, AC4)
2. Write `guardlib.py`: `guard_dir()`, `own_mode()`, `log()` with the tab-separated line and the 300-character cap, `warn()` and `deny()` that print the PreToolUse JSON and `segments()` adapted from super-board's tokenizer (size S; R1a, R9, R10, R11, N3)
   Checkpoint: `node tests/guards.mjs` passes; `/usr/bin/python3 -m py_compile plugins/pro-core/scripts/guardlib.py` is clean.
3. Upgrade the runner in `tests/git-safe.mjs`: a JSON `permissionDecision: deny` reads as block; a case may set `expect: "warn"` (exit 0 and a `protected-push` `would-deny` line), `repo` (a fixture with `main` checked out or one whose `origin/HEAD` points at `trunk`), `modes` and `protected`; every case runs with a throwaway `CLAUDE_GUARD_DIR` (size S; R15)
4. Add the failing cases: each AC1 command as `warn` in the `main` fixture and as `block` under `mode.protected-push` enforce; `git push origin trunk` in the `trunk` fixture; `git push origin release` with `release` in `protected-branches`; the AC4 global-mode case; each AC5 form (`main:feature`, `bash -c`, `sh -c`, `eval`, `ssh host`, the heredoc, `main-fix`) as `block`, pinning today's behavior; `git push --dry-run origin HEAD:refs/heads/main` and a bare push on a feature branch as `allow`; the AC7 malformed payloads as `allow` (size S; AC1 to AC7)
   Checkpoint: `node tests/git-safe.mjs` shows the new cases failing for the right reason (the push passes with no warn line) and every old case and every AC5 pin passing before any code changes.
5. Add `parse_pushes(command, cwd)` to `git-safe.py` on `guardlib.segments()`, called only after `evaluate()` returned no block: wrappers, `NAME=value`, `cd`, `git -C`, the push value options, remote and refspecs, destination with `+`, `src:` and `refs/heads/` dropped; leave `_GIT_PUSH_FORCE`, `_GIT_PUSH_PROTECTED`, `_GIT_PUSH_DELETE`, their check functions and `SEGMENT_RULES` byte-for-byte; the parser never exits 2 (size M; R1, R1a, R2 to R5, R14, AC5)
6. Add `protected_set(dir)` (built-ins, `origin/HEAD` through `git symbolic-ref`, the `protected-branches` file) and `protected_findings()` for a destination spelled `main` or `master` the regex missed, a parsed force onto a protected branch, delete, `:<name>`, `refs/heads/<name>`, `+` refspec, `HEAD` or `@`, a bare push on a protected branch, `--all`, `--mirror` and `--branches`, skipping `--dry-run`; git calls are local with a 5 second timeout and the `GIT_*` environment stripped; route findings through `own_mode("protected-push")` to `warn()` or `deny()`; wrap this part in its own `try` so an error exits 0 after the hard rules ran (size M; R6 to R14, N1, N2, AC1 to AC4, AC7)
   Checkpoint: `node tests/git-safe.mjs` all green; `node tests/guards.mjs` green; `/usr/bin/python3 -m py_compile plugins/pro-core/scripts/git-safe.py` is clean.
7. Add `"timeout": 10` to the `git-safe.py` entry in `plugins/pro-core/hooks/hooks.json`; replace line 32 of `security-checklist.md` with the `--name-only` command and its note (size XS; N2, R17, AC8)
8. Docs and versions: the `protected-push` row in `docs/enforce-mode.md` (mode file `mode.protected-push`, blocker "the warn-mode week in two repos", accepted: only its own mode file enforces it, unknown git state never flags, `production-gate.py` may add a second message, the regex false positives on `main-fix` and `master.bak` stay), the `docs/hook-loading.md` line, the `docs/licenses.md` row and sentence, `plugins/pro-core/LICENSE`, the footer in `git-safe.py`, both bumps in both manifests and the marketplace with `metadata.version`, the roadmap ticks for 32 and 40 (size S; N4, AC9)
   Checkpoint: the proof of done below passes; the PR opens.

No step is irreversible.
Steps 1 and 2 and step 7 touch separate files and could run in parallel worktrees; steps 3 to 6 are one chain on `git-safe.py` and its test.

## Tests that prove it

- `tests/guards.mjs` covers the own-key mode rule (R9, AC4).
- `tests/git-safe.mjs` covers every AC1 form in warn and enforce, the declared branches (AC3), today's hard blocks including `bash -c`, `ssh`, the heredoc, `main:feature` and `main-fix` (AC5), the allows (AC6) and malformed payloads (AC7).
- `git grep -n 'diff --cached | grep' -- plugins/` returning nothing proves AC8.
- A mutation run proves the cases bite: drop the `--delete` branch from `protected_findings()` and the delete cases fail; make `own_mode()` read the global `mode` file and the AC4 case fails; drop `_check_git_push_protected` from `SEGMENT_RULES` and the AC5 `bash -c`, heredoc and `main:feature` pins fail; restore all three.

## Risks

Step 5 is the most likely to go wrong: `git-safe.py` runs on every Bash call in every starter install.
Because the parser runs only after the untouched regex rules and never exits 2, a parser bug can add a wrong warn line but cannot stop a block or add one; the AC5 pins prove it.
The old cases in `tests/git-safe.mjs` run before and after and the hard rules run before the protected-push code so an exception there cannot skip them.
Step 6 adds the first git subprocess to `git-safe.py`; a slow repo could hit the 10 second hook timeout, which Claude Code treats as allow.
The guard runs git only on a `git push` segment so other commands pay nothing.
Damage reach: every Bash call in every repo with pro-core, bounded by fail-open and the warn start.

Stop-list categories: secrets, step 7; the checklist line decides how staged secrets are reported so the plan names it here as consent under the approver above.
The push guard touches no auth, migration, payment or deploy code.

## Options not taken

- A separate `protected-push.py` beside `git-safe.py`: two hooks would parse the same push and could both deny it.
- Making the old hard blocks warn so every push rule shares one mode: weakens what blocks today.
- Reading the protected list from a repo file: the agent the guard watches can edit it.
- One PR per plugin: pro-ship's change is one line and its bump rides with pro-core's.

## Proof of done

```
node tests/guards.mjs                       # all cases pass
node tests/git-safe.mjs                     # all cases pass, old and new
node tests/check.mjs                        # 0 failures, the guards check listed
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict           # Validation passed
claude plugin validate plugins/pro-core --strict
claude plugin validate plugins/pro-ship --strict
/usr/bin/python3 -m py_compile plugins/pro-core/scripts/guardlib.py plugins/pro-core/scripts/git-safe.py
git grep -n 'diff --cached | grep' -- plugins/   # no output
# mutation: comment out the --delete branch in protected_findings(), run node tests/git-safe.mjs --only=delete, see the delete cases fail, restore
# mutation: drop _check_git_push_protected from SEGMENT_RULES, run node tests/git-safe.mjs, see the AC5 bash -c, heredoc and main:feature pins fail, restore
```

## Done

Done as of b58fe7cedb5b

- Build commit: b58fe7cedb5b on `build/guard-hardening-m1`, five commits over `origin/main` at 8924c54.
- Checks run: `node tests/git-safe.mjs` 145 cases (83 must block, 34 must warn, 28 must pass), 0 failures; `node tests/guards.mjs` 8 cases, 0 failures; `node tests/check.mjs` 49 checks, 0 failures, 13 warnings (all from agents and evals this change does not touch), `guards` and `git-safe` listed as pass; `node tests/eval.mjs --dry` 99 cases reference real skills; `node tests/route-lexical.mjs --min-rank1 70` rank-1 80/98 (81.6%); `node --test tests/unit/*.test.mjs` pass 198, fail 0; `claude plugin validate . --strict`, `plugins/pro-core --strict` and `plugins/pro-ship --strict` each Validation passed; `/usr/bin/python3 -m py_compile` (3.9.6) on both scripts clean; `git grep -n 'diff --cached | grep' -- plugins/` no output.
- Mutations: with `deleting = False` in `protected_findings()`, `--only=delete` shows 6 failures of 17 (the delete cases name a direct push instead of a delete); with `own_mode()` falling back to the global `mode` file, `tests/guards.mjs` fails `mode/global-file-enforce-stays-warn` and all 10 `pp-global-mode` cases fail; with `_check_git_push_protected` out of `SEGMENT_RULES`, 38 of 145 fail including the `bash -c`, heredoc, `main:feature` and `feat:main` pins. All three restored and green.
- Definition of done: (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more) tests written first and seen failing (45 new cases failed with the push passing and no warn line, every old case and pin passing), laws checked by `tests/check.mjs`, attribution footer and rows added.
- Visual: none
- Doubt: none; no step is hard to undo and the regex rules are untouched (the only changed line above the parser is the `typing` import).
- AC1: `pp-warn/*` 10 forms in the `main` fixture exit 0 with a `protected-push` `would-deny` line, for example `[protected-push] warn mode: would deny delete of main (logged to warn.log, allowed)`.
- AC2: `pp-enforce/*` 10 forms print `permissionDecision: deny` with a `deny` line in warn.log.
- AC3: `pp-warn/default-branch-trunk` (origin/HEAD at trunk) and `pp-warn/declared-release` (`release` in `protected-branches`) warn; `pp-allow/undeclared-release` passes.
- AC4: `pp-global-mode/*` 10 forms and two `pp-env-mode` cases stay in warn.
- AC5: every old case passes; `pin/*` 14 forms exit 2 in three settings each (no repo, the `main` fixture, `mode.protected-push` enforce), and the same 14 commands exit 2 on the `origin/main` script.
- AC6: `pp-allow/feature-from-main`, `pp-allow/dry-run-refs-heads` and `pp-allow/bare-push-on-feature` pass with no warn.log line, with seven more allows.
- AC7: `pp-malformed/*` (`not json`, `{}`, `[]`, a number as command, empty stdin) exit 0 with no output.
- AC8: line 32 of `security-checklist.md` holds the `--name-only` command; the grep finds nothing.
- AC9: see Checks run.
- Sign-off: pending, the maintainer on the PR.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 4: `git push -d origin main` exits 2 today because `_GIT_PUSH_DELETE` exempts only `--delete`. It is pinned as a block (`pin/delete-short-flag-main`) and `-d` is tested as a `protected-push` finding on a declared branch (`git push -d origin release`).
- Step 5: `git-safe.py` imports `guardlib` only after the command is seen to hold the word `push`: a Bash command with no push reads no extra file (N1); an import error is caught after the regex rules ran.
- Step 4: the runner gives each case its own throwaway guard folder, strips `GIT_*`, `CLAUDE_GUARD_MODE` and `CLAUDE_GUARD_DIR` from the environment and runs the cases with no `repo` in an empty temp folder outside any git repo. A machine's own mode files or checked-out branch never change a result.

## Noticed but not touched
