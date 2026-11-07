---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T14:00:00-0500
author: the maintainer
module: m1
---

# Spec m1: review memory and findings checked against the code

Built from `intent.md` in this folder, committed with it, module m1 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0011, ADR-0012, ADR-0019, ADR-0022, ADR-0023, `docs/loop-records.md`, `docs/licenses.md`, `plugins/pro-ai-sdlc/agents/reviewer.md`, `plugins/pro-ai-sdlc/commands/review.md`, `plugins/pro-ai-sdlc/scripts/lessons.py`, `plugins/pro-ai-sdlc/skills/doubt-driven-development/`, `plugins/pro-quality/agents/code-reviewer.md`, `plugins/pro-ship/skills/ship/SKILL.md`.
Sources adapted, read as data: super-board's `skills/super-review/SKILL.md` ("Review remembers") and step 3b of `skills/super-board/references/run.md` (MIT); agent-skills commits `353ae84` and `c55b842` (MIT).

## Summary

A review now remembers what it found.
Each finding gets a stable id in a table under `.pro-dev/review/`.
Round 1 of every later review grades each earlier finding at the new head before a fresh, blind pass runs.
`/review` and `/ship` hand their reviewers `merge-base..head`; a covered fix is then inside the range and a fixed finding is graded `fixed` instead of raised again.
Both reviewers check every finding against the callers, guards and tests that reach the changed code before reporting it, accept zero findings and keep defects of the base apart.
The doubt step keeps a contradicting caller or test inside its review unit.
Everyone who runs `/review`, `/ship` or `/execute` gets this on the next plugin update.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. The findings table lives at `.pro-dev/review/<branch>.json`, one file per branch, keyed by finding id.
2. The review record gains `model` and `findings`; this module adds the record with `findings` and m2 adds `model`.
3. `.pro-dev/` is already listed in the git exclude file by the writers, which keeps the table out of the tree.
4. `lessons.py` already owns `.pro-dev/review/`, reads claims on stdin and has the ref rule (`pr-<number>` for a branch name outside `A-Z`, `a-z`, `0-9`, `.`, `_`, `/` and `-`); the table reuses all three.
5. `/ship` dispatches `pro-quality:code-reviewer` today with the first and last uncovered commit as `range` (`plugins/pro-ship/skills/ship/SKILL.md`, the specialists section).
6. A grading dispatch is a separate subagent run from the fresh pass; the fresh pass keeps ADR-0012's four fields with no table.

## Requirements

### Functional

The findings table (intent: "a persisted findings table under `.pro-dev/` with stable ids, file:line and status"):

- R1. `lessons.py` keeps one findings table per ref at `.pro-dev/review/<key>.json`, where `<key>` is the ref from `/review` step 6 with every `/` written as `--`.
- R2. The table is a JSON object `{schema: 1, ref, base, head, round, findings}`; `findings` is an object keyed by finding id.
- R3. A row holds `id` (`F1`, `F2` and so on, never reused), `file`, `line`, `pass`, `class`, `severity` (`important`, `nit` or `pre-existing`), `claim` (one sentence of at most 300 characters), `status` (`open`, `fixed`, `not fixed` or `no longer applies`), `raised_at` (40-hex sha), `graded_at` (40-hex sha or null), `evidence` (`path:line` or null) and `reopened_from` (the id of a `fixed` row this one reopens, or null).
- R4. No row holds a failure scenario, reasoning, a quote of the diff or text from a PR thread.
- R5. `lessons.py raise --ref <ref> --base <40 hex> --head <40 hex> --pass <pass> --severity <severity> --class <slug> --file <path> --line <n>` reads the claim on stdin, adds a row with the next free id and prints the id.
- R6. Precedence for a `raise` that names a file and class already in the table: when any `open` or `not fixed` row matches, `raise` adds no row and prints that row's id.
  Otherwise, when a `fixed` or `no longer applies` row matches, it adds a new row with `reopened_from` set to the newest matching row's id.
  Dedupe applies only to `open` and `not fixed` rows; `raise` never refuses a finding for matching a graded row.
- R7. `lessons.py grade --ref <ref> --head <40 hex> <id> fixed|not-fixed|no-longer-applies --evidence <path:line>` sets `status`, `graded_at` and `evidence` on one row and refuses an unknown id, a missing `--evidence`, an `--evidence` that is not `path:line` (a repo-relative path, a colon and a positive line number) or a head that is not 40 hex.
- R8. `lessons.py table --ref <ref>` prints the rows as JSON in id order; with no table it prints `{"findings": {}}`.
- R9. A table that cannot be parsed is renamed to `<key>.json.bad`, a warning names it and the round runs as a first review.

Round 1 grades (intent: "round 1 grades each earlier finding fixed, not fixed or no longer applies at the new head before the fresh pass"):

- R10. `reviewer.md` and `reviewer.toml` gain a grade mode: a diff spec that ends with `grade <table path>` makes the agent read the table, open the code at HEAD for each `open` or `not fixed` row and mark it.
- R11. In grade mode `fixed` cites the `path:line` that shows the fix, `not fixed` means the claim is still true of the code at HEAD and `no longer applies` means the code it named is gone or the brief changed.
  A reply, a commit message or a resolved thread is never evidence.
- R12. Grade mode runs no passes and raises no new finding.
  Its report opens with the summary line `important: <n>  nits: <n>  pre-existing: <n>  skipped: 0`, where each count is the rows of that severity graded `not fixed`, then `fixed: <n>  not fixed: <n>  no longer applies: <n>` as the second line, then one line per row: id, grade, `path:line`.
  A round with an unfixed Important row therefore never reads as clean.
- R13. `/review` runs grade mode first on every round whose ref has a table with an `open` or `not fixed` row, then writes each grade with `lessons.py grade`.
- R14. When any Important row is `not fixed` after grading, `/review` reports those rows first under their original ids, skips the fresh pass, says `fresh pass skipped: <n> not fixed` and counts the round toward ADR-0011's cap.
- R15. Otherwise the fresh pass runs with ADR-0012's four fields and no table; each new Important or nit finding is written with `lessons.py raise`.
- R16. The fresh pass follows R6's precedence: a finding whose file and class match an `open` or `not fixed` row is dropped and counted as already raised.
  Otherwise a finding that matches a `fixed` or `no longer applies` row is kept with a new id and `reopened_from` naming that row, which keeps a regression visible.

The range (intent: "`/ship` and `/review` review merge-base..head instead of the first and last uncovered commit"):

- R17. `/review` hands the reviewer `<merge base>..<head>` on every round; `--since <sha>` still narrows the fresh pass when the person passes it and never narrows grade mode.
- R18. `/ship` hands its code and security reviewers `<git merge-base base head>..<head>` whenever any commit in the range is uncovered; when every commit is covered no reviewer runs, as today.
- R19. `/ship` keeps its table under the ref `ship-<first 12 of the merge base>` and runs grade mode through `pro-ai-sdlc:reviewer` when pro-ai-sdlc is installed.
  It calls `lessons.py grade`, `raise` and `round` against that table exactly as `/review` does (R13 to R16, R21).
  A `not fixed` Important row is a Blocker; `fixed` and `no longer applies` rows are never Blockers.
- R20. Without pro-ai-sdlc, `/ship` says `grading skipped: pro-ai-sdlc not installed` and runs the fresh pass alone.

The review record (intent: "mieruka reads the review record"):

- R21. `lessons.py round --ref <ref> --base <40 hex> --head <40 hex> --round <n> --fresh ran|skipped` writes one review record per round, after the grades and the raises.
- R22. The record is a manifest with `kind` `review`, `artifact_kind` `review-round`, `artifact_key` the ref, `evidence_key` `review-round-<first 12 of head>-<round>`, `status` `fail` when any Important row is `open` or `not fixed` and `pass` otherwise.
- R23. Its `detail_json` holds `ref`, `base`, `head`, `round`, `range`, `fresh`, the counts by status and `findings`, a list of `{id, file, line, class, severity, status}` with no claim text.
- R24. The record lands at `.pro-dev/review/rounds/<evidence_key>.json` and in `.mieruka/evidence/<evidence_key>/` by the shared drop rule; `docs/loop-records.md` gains its section and `tests/mieruka-sync.mjs` loads one.

Findings checked against the code (intent: item 39):

- R25. `code-reviewer.md`, `reviewer.md` and both Codex twins say: before reporting a finding, find the callers, guards and tests that reach the changed code and drop the finding when one of them rules it out, listing it under skipped with that `path:line`.
- R26. Both agents say zero findings is a valid result and never invent one; the `Nothing to fix.` line is unchanged.
  In grade mode `Nothing to fix.` follows the summary line only when its tally is all zero after grading.
- R27. Both agents tag a finding Pre-existing when its failure also occurs with the base version of the code, even on a line the change touched; they list it apart from regressions the change brings.
- R28. `doubt-driven-development/SKILL.md` says in Extract to strip reasoning and keep evidence: when the session knows a caller, guard or test that contradicts its own claim, that file's path goes in `brief` after the plan, spec and intent paths, as a path only.
- R29. `doubt-instructions.md` tells the reviewer to read the callers, guards and tests that reach the range before raising a finding.
- R30. `evals/fixtures/review-evidence/` (`CONTRACT.md`, `before.py`, `after.py`, `clean.py`) and three cases in `evals/cases/requesting-code-review.json` are adapted from agent-skills `353ae84`: a new regression beside an old defect, a clean change with zero new findings and four candidate claims of which one a caller's guard disproves.

### Non-functional

- N1. The table and the record are written atomically with the standard library; `lessons.py` makes no network call.
- N2. A first review costs what it costs today; a later round costs one extra dispatch for grade mode when the table has an `open` or `not fixed` row and none otherwise.
- N3. Each plugin change bumps its version in both manifests and its marketplace entry, plus `metadata.version`, in the same commit.
- N4. Adapted content keeps a footer naming its upstream and a row in `docs/licenses.md`.

### Policy constraints applied

- ADR-0011: the three-round cap and the summary line are unchanged; the line "later rounds review only the new commits" and the in-session dedupe list are replaced by the table, as ADR-0027 records (R14, R16, R17).
- ADR-0012: the fresh pass keeps exactly four fields and no earlier findings; grade mode is a separate dispatch that carries one table path and no reasoning (R4, R10, R15).
- ADR-0019: the doubt handoff keeps its four fields; R28 adds paths to `brief`, never prose.
- ADR-0023: the review record follows the shared rules of `docs/loop-records.md`; only mieruka's kinds and statuses are used (R22).
- ADR-0002, ADR-0003, ADR-0004: bumps in the same commit, no new hook, both Codex twins change with their agents (N3, R10, R25).
- REVIEW.md pass 2: claims reach the table on stdin only, as `lessons.py add` does today (R5).

### Boundaries

Always: edit the files named here, add behavior cases to `tests/lessons.mjs`, keep the fresh pass blind, bump versions.
Ask first: running the live behavioral evals for the new cases, changing the round cap, sending the table to a fresh pass.
Never: put a failure scenario or a PR-thread quote in the table, drop a fresh finding for matching a graded row, let a `fixed` grade stand without a `path:line`.

## Design

### User experience

A first `/review` reads as it does today and ends with the ids it assigned.
A second round opens with the grade line and one line per earlier finding, then either the unfixed rows with `fresh pass skipped` or the fresh pass.
`/ship` reports graded rows under their ids: a finding fixed in a covered PR shows as `F3 fixed at path:line` and never as a Blocker.
A reviewer that drops a finding because a guard rules it out lists it under skipped with the guard's location.

### System

- `plugins/pro-ai-sdlc/scripts/lessons.py`: `raise`, `grade`, `table` and `round` subcommands beside `add`, `classes`, `repeats` and `mark`.
- `plugins/pro-ai-sdlc/agents/reviewer.md` and `.codex-plugin/agents/reviewer.toml`: grade mode and the validation rules.
- `plugins/pro-ai-sdlc/commands/review.md`: steps 1, 3, 5 and 6 for grade mode, the range and the table.
- `plugins/pro-ai-sdlc/skills/doubt-driven-development/SKILL.md` and `doubt-instructions.md`: evidence stays in the unit.
- `plugins/pro-quality/agents/code-reviewer.md` and `.codex-plugin/agents/code-reviewer.toml`: the validation rules.
- `plugins/pro-ship/skills/ship/SKILL.md`: the range, the table ref, the grade step and the `lessons.py` calls in the specialists section.
- `plugins/pro-ai-sdlc/templates/REVIEW.md` (the `## Rounds` section, line 46): later rounds grade the table and read `merge-base..head` instead of only the new commits.
- `docs/loop-records.md`, `docs/licenses.md`, `docs/decisions/0027-review-memory.md` and its index row.
- Tests: `tests/lessons.mjs`, `tests/mieruka-sync.mjs`, the `sdlc-contract` and `doubt` checks in `tests/check.mjs`.

### Alternatives considered

- Hand the table to the fresh pass: it anchors the reviewer on the last round, which is what ADR-0012 forbids.
- Keep the dedupe list in the session: it is lost between sessions, which is how a second-session `--since` run reports a finding again.
- Keep `/ship`'s first-and-last-uncovered range and add the covered fixes: a sub-range of a release is not contiguous, which makes any range short of the merge base drop some fix.
- Post the table as a PR comment as super-board does: it needs a GitHub write on every round plus a PR, while `/review` also runs on branches.
- A new script for the table: `lessons.py` already owns the folder, the ref rule and the stdin rule.

## Flagged concerns

ADR needed: yes, review memory changes what every review round does and amends ADR-0011 and ADR-0012: [ADR-0027](../../docs/decisions/0027-review-memory.md) (proposed).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | ADR-0011 and ADR-0012 say the reviewer is never handed earlier findings | ADR-0011, ADR-0012 | resolved on 2026-11-07: only the grade-mode dispatch sees the table and it raises no new finding; the fresh pass stays blind with four fields; ADR-0027 records the amendment |
| 2 | ADR-0011 says later rounds review only the new commits | ADR-0011 | resolved on 2026-11-07: every round reads `merge-base..head` and the table does the deduping; `--since` stays as an option the person passes |
| 3 | `/ship` reviewing the whole range costs more than reviewing the uncovered commits | `plugins/pro-ship/skills/ship/SKILL.md` | resolved on 2026-11-07: no reviewer runs when every commit is covered, as today; when any commit is uncovered the range starts at the merge base because a partial range drops covered fixes |
| 4 | `/ship` in pro-ship would call grade mode and `lessons.py` from pro-ai-sdlc while plugins do not import each other | ADR-0003 | resolved on 2026-11-07: `/ship` finds `lessons.py` through `pr-check.py find` as it finds the security classifier; without pro-ai-sdlc it runs the fresh pass alone (R20) |
| 5 | R28 puts more paths in the doubt handoff's `brief` field | ADR-0012, ADR-0019 | resolved on 2026-11-07: paths only, never prose; the four field names are unchanged and the `doubt` check still holds them |
| 6 | A claim in the table comes from text a reviewed diff can shape | REVIEW.md pass 2 | resolved on 2026-11-07: claims arrive on stdin, are capped at 300 characters, are written in the reviewer's own words and never reach the review record or mieruka |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. `tests/lessons.mjs` shows `raise` assigning `F1`, `F2` and refusing a duplicate open row with the same file and class; `raise` on a match with a `fixed` row adding `F3` with `reopened_from` `F1`; `grade` refusing an unknown id and a missing `--evidence`; `table` on a missing file printing an empty object; a damaged table renamed to `.bad`.
- AC2. A table never holds a key outside R3, checked by a case that reads the JSON back.
- AC3. A demo branch reviewed twice, with a fix committed between rounds, shows the earlier Important finding graded `fixed` at a cited `path:line` and not raised again by the fresh pass.
- AC4. The same with no fix shows the row `not fixed`, the line `fresh pass skipped: 1 not fixed` and no fresh pass.
- AC5. `/ship` on a range with a fix in a covered PR hands `range` from the merge base and reports the earlier finding as fixed, not as a Blocker.
  Afterwards `lessons.py table --ref ship-<first 12 of the merge base>` shows the grade and `.pro-dev/review/rounds/` holds a `review-round` record for that ref.
- AC6. `lessons.py round` writes a `review-round` manifest that `tests/mieruka-sync.mjs` loads with mieruka's own sync.
- AC7. The validation, zero-findings and base-defect lines are present in both agents and both Codex twins, checked by `tests/check.mjs`.
- AC8. `doubt-driven-development/SKILL.md` holds "strip reasoning, not evidence" and the `doubt` check passes.
- AC9. `node tests/check.mjs`, `node tests/eval.mjs --dry` and `claude plugin validate . --strict` pass.
- AC10. `lessons.py grade` refuses `--evidence` that is not `path:line` (R7); `raise` on a match with a `no longer applies` row and no open match adds a row with `reopened_from` (R6); a grade-mode report with one Important row `not fixed` opens with `important: 1` (R12); `sdlc-contract` asserts the sentence in `reviewer.md` that a reply, a commit message or a resolved thread is never evidence (R11).
- AC11. On the AC3 branch the second round's diff spec starts at the merge base; with `--since <sha>` the fresh pass starts at that sha while grade mode still covers every `open` or `not fixed` row (R17).
- AC12. `/ship` with pro-ai-sdlc disabled prints `grading skipped: pro-ai-sdlc not installed` and still dispatches the fresh pass (R20).
- AC13. The `doubt` check asserts that `doubt-instructions.md` tells the reviewer to read the callers, guards and tests that reach the range (R29).
- AC14. `node tests/behavioral.mjs --dry-run` lists the three `requesting-code-review` cases with their fixture files (R30).

## Out of scope

- The reviewer's model on the record (m2).
- Grade mode in pr-check, which reviews one HEAD once.
- Routing a finding back to the plan or the spec (the review-routes-back intent).
- Running the new behavioral cases, which happens only on the maintainer's yes.
