# Plan m1: review memory and findings checked against the code

Built from `spec-m1.md` and `intent.md` in this folder, committed with them.
Status: approved (pre-approved on 2026-11-07).
Approver: the engineer plus the maintainer as architect, because the change amends ADR-0011 and ADR-0012 and alters every review round.
Dated: 2026-11-07.

One pull request on its own worktree, branch `build/reaching-done-m1`, since `/ship` calls the `lessons.py` subcommands this PR adds.
It bumps three plugins to their next minor version from main at build time: pro-ai-sdlc (0.16.0 today, which makes 0.17.0), pro-quality (0.20.0, which makes 0.21.0) and pro-ship (0.16.1, which makes 0.17.0), plus one minor bump of `metadata.version` (1.92.0, which makes 1.93.0), all in each commit that changes plugin content.
When another PR lands a bump first, rebase and take the next free minor.

## Files that change

- `plugins/pro-ai-sdlc/scripts/lessons.py` (modified): the `raise`, `grade`, `table` and `round` subcommands.
- `plugins/pro-ai-sdlc/agents/reviewer.md` and `plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml` (modified): grade mode and the validation rules.
- `plugins/pro-ai-sdlc/commands/review.md` (modified): grade first, the skip rule, the merge-base range, the table and the round record.
- `plugins/pro-ai-sdlc/skills/doubt-driven-development/SKILL.md` and `doubt-instructions.md` (modified): evidence stays in the unit.
- `plugins/pro-quality/agents/code-reviewer.md` and `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` (modified): the validation rules.
- `plugins/pro-ship/skills/ship/SKILL.md` (modified): the reviewers' range, the ship table ref, the grade step and the `lessons.py` calls.
- `plugins/pro-ai-sdlc/templates/REVIEW.md` (modified): the `## Rounds` section at line 46 says later rounds grade the table and read `merge-base..head`, matching ADR-0027.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`, `plugins/pro-ai-sdlc/.codex-plugin/plugin.json`, the same pair for pro-quality and pro-ship and `.claude-plugin/marketplace.json` (modified): the bumps.
- `evals/fixtures/review-evidence/CONTRACT.md`, `before.py`, `after.py`, `clean.py` and `evals/cases/requesting-code-review.json` (new): the three behavioral cases.
- `tests/lessons.mjs` (modified): cases for the table and the round record.
- `tests/mieruka-sync.mjs` (modified): loads one `review-round` record.
- `tests/check.mjs` (modified): the `sdlc-contract` check asserts grade mode and the validation lines in both agents and both twins.
- `docs/loop-records.md` (modified): the review round section.
- `docs/licenses.md` (modified): a super-board row and an agent-skills row.
- `docs/decisions/0027-review-memory.md` (modified only if the build departs from it).
- `docs/roadmap.md` (modified): items 35 and 39 ticked with the PR.

## Order of work

1. Failing cases in `tests/lessons.mjs`: `raise` gives `F1` then `F2`, a second `raise` with the same file and class on an open row prints `F1` and adds nothing, a `raise` matching only a `fixed` row adds a row with `reopened_from`, a `raise` matching a `no longer applies` row with no open match adds a row with `reopened_from`, `grade` refuses evidence that is not `path:line`, `grade` refuses an unknown id, a missing `--evidence` and a short head, `table` with no file prints `{"findings": {}}`, a damaged file is renamed to `.bad`, a row read back has only the R3 keys (size S; R1 to R9, AC1, AC2, AC10)
2. `lessons.py`: `table_path(root, ref)` with `/` as `--`, `read_table` that sets a damaged file aside, atomic `write_table`, then `cmd_raise` with the claim on stdin under the existing 300-character cap, `cmd_grade` and `cmd_table` (size M; R1 to R9, N1)
   Checkpoint: `node tests/lessons.mjs` passes the new cases and the old ones; `python3 plugins/pro-ai-sdlc/scripts/lessons.py table --ref demo` prints the empty object.
3. Failing case, then `cmd_round` writing the `review` / `review-round` manifest through `evidence.py` with the drop rule; the review round section in `docs/loop-records.md`; one record loaded in `tests/mieruka-sync.mjs` (size M; R21 to R24, AC6)
   Checkpoint: `node tests/lessons.mjs` and `MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs` pass.
4. `reviewer.md` and `reviewer.toml`: a `## Grade mode` section for a diff spec ending `grade <table path>`, the three grades with their evidence rule, no passes, no new findings, the usual summary line first with `not fixed` Important rows counted as important and `not fixed` nits as nits, `Nothing to fix.` only when that tally is all zero and `fixed: <n>  not fixed: <n>  no longer applies: <n>` second (size S; R10, R11, R12, R26, AC10)
5. `review.md`: step 1 always takes the merge base and keeps `--since` for the fresh pass only; a new step before the passes runs grade mode when `lessons.py table` shows an `open` or `not fixed` row and writes each grade; the skip rule with `fresh pass skipped: <n> not fixed`; step 5 drops a finding that matches an `open` or `not fixed` row by file and class, otherwise keeps one that matches a `fixed` or `no longer applies` row as a new row with `reopened_from`; the grade step's report keeps the agent's tally, in which an unfixed Important row counts as important; step 6 writes Important and nit findings with `lessons.py raise` beside `add` and ends with `lessons.py round` (size M; R13 to R17, AC11)
   Checkpoint: `node tests/check.mjs` passes with the new `sdlc-contract` assertions; on a demo branch, `/review` twice with a fix between shows the row `fixed` at a `path:line` (AC3); twice with no fix it shows `fresh pass skipped: 1 not fixed` (AC4).
6. The validation rules in `code-reviewer.md`, `code-reviewer.toml`, `reviewer.md` and `reviewer.toml`: check each finding against the callers, guards and tests that reach the changed code and list a ruled-out one under skipped with that `path:line`; zero findings is valid; a failure that also occurs on the base version is Pre-existing; `sdlc-contract` asserts the three lines in all four files (size S; R25, R26, R27, AC7)
7. `doubt-driven-development/SKILL.md` Extract gains "Strip reasoning, not evidence" with the path-only rule for `brief`; `doubt-instructions.md` tells the reviewer to read the callers, guards and tests that reach the range first, with no braces or angle brackets so the `doubt` check holds (size XS; R28, R29, AC8, AC13)
8. `evals/fixtures/review-evidence/` and `evals/cases/requesting-code-review.json` with the three cases adapted from agent-skills `353ae84`, each with its footer line in the fixture's `CONTRACT.md`; the live run waits for the maintainer's yes (size S; R30, AC14)
   Checkpoint: `node tests/check.mjs`, `node tests/eval.mjs --dry` and `node tests/behavioral.mjs --dry-run` pass; the dry run lists the three new cases.
9. `ship/SKILL.md` specialists section: `range` is `<git merge-base base head>..<head>` when any commit is uncovered; the table ref `ship-<first 12 of the merge base>`; `lessons.py` found by `pr-check.py find pro-ai-sdlc lessons.py`; grade mode through `pro-ai-sdlc:reviewer` with each grade written by `lessons.py grade`, each fresh Important or nit finding by `lessons.py raise` and the round closed by `lessons.py round`, the same calls `/review` makes; a `not fixed` Important row is a Blocker; without pro-ai-sdlc it says `grading skipped: pro-ai-sdlc not installed`; the template `REVIEW.md` `## Rounds` section changes to match (size S; R18, R19, R20, AC5, AC12)
10. Bumps in both manifests of each plugin and the marketplace plus `metadata.version`; the super-board and agent-skills rows in `docs/licenses.md`; the roadmap ticks for 35 and 39 (size S; N3, N4)
    Checkpoint: the full proof of done below; then a `/ship` dry run on a demo range with a covered fix shows `range` from the merge base and the old finding graded `fixed` (AC5, AC9).

No step is irreversible.

## Tests that prove it

- `tests/lessons.mjs` covers `raise`, the duplicate rule, `grade` refusals, `table` with no file, the damaged file and the record shape.
- `tests/mieruka-sync.mjs` loads a `review-round` record with mieruka's own sync.
- `tests/check.mjs` (`sdlc-contract`, `doubt`, `handoff`) holds grade mode, the validation lines and the four handoff fields.
- Hand runs on a demo branch prove AC3 and AC4; a hand run of `/ship` on a demo range proves AC5.
- The three behavioral cases run only on the maintainer's yes: `node tests/behavioral.mjs requesting-code-review --baseline`, about one to two dollars.

## Risks

Step 5 is the most likely to go wrong: `/review` is prose that an agent follows; a missed instruction could pass the table to the fresh pass or skip grading.
The guard is the `sdlc-contract` assertions and the two demo rounds; the damage is a review that is anchored or forgets, never a wrong merge, since `/review` only informs.
Step 9 makes `/ship` review the whole range when anything is uncovered, which costs more on a long release; the spec's concern 3 accepts that.
Step 7 can trip the `doubt` check if a placeholder in angle brackets slips into `doubt-instructions.md`.
Nothing here is irreversible.

Stop-list categories: none; the plan edits review prose, a local ledger script and docs, with no auth, migration, payment, deploy or secret handling.

## Options not taken

- Three PRs, one per plugin: `/ship`'s grade step needs `lessons.py` from the same release and splitting them leaves a window where `/ship` calls a missing subcommand.
- A separate grader agent: `pro-ai-sdlc:reviewer` already has the tools and the policy reading; a mode keeps one agent and one Codex twin.
- Grade mode in `code-reviewer`: its handoff check forbids any field beyond the four while grade mode needs the table path.

## Proof of done

```
node tests/check.mjs                         # 0 failures
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70
node --test tests/unit/*.test.mjs
node tests/lessons.mjs                       # all cases pass, including the table and round cases
node tests/behavioral.mjs --dry-run          # the three review-evidence cases validate with no key
MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs
claude plugin validate . --strict            # Validation passed
claude plugin validate plugins/pro-ai-sdlc --strict
claude plugin validate plugins/pro-quality --strict
claude plugin validate plugins/pro-ship --strict
```

## Done

Done as of e726a031099b

- Build commit: e726a031099b on `build/reaching-done-m1`, rebased onto origin/main at c22f221.
- Checks run: `node tests/check.mjs` 49 checks, 0 failures, 13 warnings; `node tests/lessons.mjs` 86/86; `node tests/eval.mjs --dry` 99 cases reference real skills; `node tests/route-lexical.mjs --min-rank1 70` rank-1 80/98 (81.6%), 3 notOneOf warnings; `node --test tests/unit/*.test.mjs` 198 pass, 0 fail; `node tests/behavioral.mjs --dry-run` 7 case files, 11 runs planned; `MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs` passed with review-round loaded; `claude plugin validate . --strict` and the three touched plugins each print Validation passed; `tests/lessons.mjs` also passes under Python 3.9.6.
- Definition of done: met, apart from the hand runs of `/review` and `/ship` end to end noted under AC3 to AC5 and AC11 to AC12.
- Visual: none
- Doubt: none; no step was marked irreversible.
- AC1: `tests/lessons.mjs` shows `raise` giving F1 then F2, a duplicate open row printing F1 with nothing added, a match with a `fixed` row adding F4 with `reopened_from` F1, `grade` refusing an unknown id and a missing `--evidence`, `table` on a missing file printing `{"findings": {}}` and a damaged table renamed to `.bad`.
- AC2: a case reads the table back and finds only the twelve R3 keys on every row.
- AC3: on a demo branch a grade-mode dispatch of the new reviewer text graded F1 `fixed` at `pay.py:9` after a fix commit, with the summary line all zero; `lessons.py grade` and `round` wrote it and the round record is `pass`. The fresh pass was not run in the demo; the duplicate rule that stops it raising F1 again is covered by `tests/lessons.mjs`.
- AC4: the same with no fix graded F1 `not fixed` at `pay.py:9`, the agent and `table --tally` both opened with `important: 1`, the round was closed `--fresh skipped` and its record is `fail`.
- AC5: scripted part only: the ship table `ship-7ab5a947f2f8` shows F1 `fixed` at `pay.py:9` and `.pro-dev/review/rounds/` holds its `review-round` record; `pr-check.py find pro-ai-sdlc lessons.py` resolves the script. A full `/ship` hand run waits for the board rerun.
- AC6: `tests/mieruka-sync.mjs` loads a `review-round` record with mieruka's own sync.
- AC7: `sdlc-contract` asserts the validation, zero-findings and base-version lines in both agents and both Codex twins; `agent-twins` holds the code-reviewer twin identical.
- AC8: `SKILL.md` holds "Strip reasoning, not evidence" and the `doubt` check passes.
- AC9: `node tests/check.mjs`, `node tests/eval.mjs --dry` and `claude plugin validate . --strict` pass.
- AC10: `grade` refuses evidence with no line, line 0, an absolute path and `..`; a `no longer applies` match adds a row with `reopened_from` F3; `table --tally` opens with `important: 1` for one unfixed Important row; `sdlc-contract` asserts the never-evidence sentence in `reviewer.md` and its twin.
- AC11: `review.md` step 1 sets every round to `<merge base>..<head>` and says `--since` never narrows grade mode, asserted by `sdlc-contract`; not hand-run.
- AC12: `pr-check.py find` prints `not-installed` for a missing plugin and `ship/SKILL.md` then says `grading skipped: pro-ai-sdlc not installed`, asserted by `sdlc-contract`; not hand-run.
- AC13: the `doubt` check asserts the callers, guards and tests line in `doubt-instructions.md`.
- AC14: `node tests/behavioral.mjs --dry-run` lists `requesting-code-review` #1 to #3 with their `review-evidence` fixture files.
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted` and ADR-0027 from `proposed` to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 2: `lessons.py table --ref <ref> --tally` prints the summary line and the grade line from the table, so `tests/lessons.mjs` proves R12's `important: 1` without a model (AC10).
  After the PR review its first line counts every row still `open` or `not fixed` by severity, which after the fresh pass's raises is the round's total.
- Step 2: a table whose stored `ref` differs from the one asked for is refused, because `a/b` and `a--b` share a key once `/` is written as `--`; the message says to use `pr-<number>`.
- Step 3: the round record's `detail_json` also holds `created`, as every other loop record does.
  Its `counts` uses the keys `open`, `fixed`, `not_fixed` and `no_longer_applies`.
- Step 3: `tests/mieruka-sync.mjs` now expects seven records from the sync, one more for the review round.
- Step 3, found in the hand run: R22's key `review-round-<first 12 of head>-<round>` let a second ref at the same head and round overwrite the first record, which a branch `/review` and a `/ship` on the same head both reach.
  The key gains `-<first 8 hex of the SHA-1 of the ref>`; `tests/lessons.mjs` holds two refs at one head and round apart.
- Step 4: in grade mode the grade line stays second (R12) and `Nothing to fix.` comes third when the tally is all zero.
  After the PR review the grade line reads `graded: fixed <n> not fixed <n> no longer applies <n>` and a round's report opens with the round's total, computed after the fresh pass; R12, R26 and ADR-0027 now say so, which settles how the summary line of ADR-0011 reads across grading and the fresh pass.
- Step 4: grade mode ignores a `since` in the diff spec, which is R17's rule stated inside the agent.
- Step 5: when `lessons.py table` printed any row, the session has read the table and never runs the passes itself; the fresh pass always goes to the `reviewer` subagent (ADR-0012), in `/review` and in `/ship`.
  A first review with no table still chooses as before (N2).
- Step 5, after the PR review: the caller never dedupes against its copy of the table from before grading.
  Every fresh finding goes to `lessons.py raise`, which applies R6 against the live table; `/review` now raises in step 5 before writing the report so the total counts after dedupe.
- Step 2, after the PR review: R6 gains severity; an Important finding that matches a live nit row raises that row to Important and `raise` reports `severity_raised`.
  A table that is not UTF-8 or holds a row whose `id` is missing or differs from its key is set aside as `.bad`.
- Step 5: the ref is worked out in step 1 (by the rule that stays in step 6), since step 3 needs it to read the table.
- Step 7: the doubt skill's own `handoff.md` also names the contradicting paths in its `brief` line, so the template the session fills agrees with R28; the field names are unchanged.
- Step 8: the fixtures are listed file by file, so the runner copies each to the repo root and the prompts name `before.py`, `after.py`, `clean.py` and `CONTRACT.md` without the folder; expectations that joined two checks are split into one check each.
- Step 9: `/ship` grades before its one turn of specialists, since an unfixed Important row skips the code reviewer's fresh pass; the security review and the test engineer still run that round.
- Step 9, after the PR review: `/ship` finds `lessons.py` with `pr-check.py find --enabled`, which counts an install only when the plugin settings do not disable it and never counts the repo's own `plugins/` folder (the rule of `verifier_state`, now `plugin_state`).
  It prints `not-installed` for a disabled install, so `/ship` says `grading skipped: pro-ai-sdlc not installed`.
- Pre-existing, fixed after the PR review: the pro-ship description in `ship/SKILL.md` and both manifests now says `/ship` reviews from the merge base when pr-check missed a commit; `node tests/route-lexical.mjs --min-rank1 70` stays at rank-1 80/98.
- Step 9: `/ship` also raises the security review's blocking and should-fix findings (as `important` and `nit` with `--pass security`), so a fixed security finding is graded rather than reported again.
- Step 9: when the base is the empty tree (a first release of the whole history), the review range starts at the empty tree, since `git merge-base` has no answer there.
- Step 10: after the rebase onto main the bumps are pro-ai-sdlc 0.17.0, pro-quality 0.21.0, pro-ship 0.17.0 (main had 0.16.2) and `metadata.version` 1.94.0 (main had 1.93.0); the first commit's message still names 1.93.0.
- Step 10: ADR-0027's enforcement line now names the versions it is in force from.

## Noticed but not touched
