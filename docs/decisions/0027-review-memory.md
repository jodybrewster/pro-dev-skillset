# ADR-0027: A review remembers its findings and grades them before a fresh pass

Date: 2026-11-07

## Status

proposed

Decided by: the maintainer.
Source: PDS-52, intent/2026-11-07-reaching-done/ (spec-m1, R1 to R24).

## Context

The retest of 2026-11-04 reached no Done.
In `/ship` a finding that a covered commit had fixed came back as Important.
Two things caused it.
`/ship` handed its reviewers the first and last uncovered commit, a range that stopped before the covered fix.
The list of findings already raised lived only in the calling session, as ADR-0011 set it.
A later session started with no memory and a blind reviewer raised the old claim again.
ADR-0011 and ADR-0012 keep earlier findings away from the reviewer so its read stays fresh.
That rule is right for finding new problems and wrong for checking whether old ones were fixed.
super-board's "Review remembers" rule grades every earlier finding at the new head before anything else.

## Decision

Every review keeps a findings table per ref at `.pro-dev/review/<key>.json`, written only by `lessons.py`.
A row holds an id that is never reused, a `file:line`, the class, the severity, a one-sentence claim and a status: `open`, `fixed`, `not fixed` or `no longer applies`.
A row never holds a failure scenario, reasoning or a quote of the diff.
Round 1 of every later review is a grading dispatch of `pro-ai-sdlc:reviewer` in grade mode, handed the table path and the diff spec.
It cites a `path:line` for every grade and raises no new finding.
Its report keeps the summary line first and puts the grade counts second.
That summary line counts `not fixed` Important rows as important and `not fixed` nits as nits.
The round's report opens with the round's total, computed after the fresh pass: the graded rows still unfixed plus the fresh findings.
The grade line `graded: fixed <n> not fixed <n> no longer applies <n>` is second and `Nothing to fix.` is third, only when the total's important and nits are both zero.
When an Important row is `not fixed`, the round reports it under its id and skips the fresh pass.
Otherwise the fresh pass runs blind, with ADR-0012's four fields and no table.
The caller hands every fresh finding to `lessons.py raise`, which matches it by file and class against the live table and returns the id of a matching `open` or `not fixed` row; this replaces ADR-0011's in-session list.
Otherwise a fresh finding that matches a `fixed` or `no longer applies` row gets a new id with `reopened_from` naming that row, which keeps a regression visible.
Dedupe applies only to `open` and `not fixed` rows.
Every round reviews `merge-base..head`; `/ship` does the same whenever any commit is uncovered.
`--since <sha>` remains an option a person can pass; it never narrows grading.
Each round writes a review record, `review` / `review-round`, under the rules of `docs/loop-records.md`.

This amends ADR-0011: "later rounds review only the new commits" and "the calling session keeps the list" are replaced by the table and the merge-base range.
The round cap, the Pre-existing rule and the summary line are unchanged.
It amends ADR-0012: a grading dispatch is a second contract with one extra input, the table path; the fresh-pass handoff keeps exactly four fields.

## Consequences

A finding fixed anywhere in the range is graded `fixed` with evidence and stops being reported.
An unfixed finding keeps its id across rounds, sessions and `/review` or `/ship`.
A later round costs one extra dispatch when the table has an open row and none otherwise.
A review of the whole merge-base range costs more on a long branch or a large release than a review of new commits alone.
The table is a local file under `.pro-dev/`.
A second machine starts with no memory and anyone with a shell can edit it; it informs and does not prove, like the stamp.

What must stay true:

- The fresh pass never sees the table.
- A session that has read the table never runs the passes itself.
- Grade mode never raises a new finding.
- A `fixed` or `no longer applies` grade always cites a `path:line`.
- The table never holds a failure scenario or text from a PR thread.

Revisit if grading proves no cheaper than a full fresh review, if the merge-base range makes rounds too slow on large PRs or if the table needs to travel between machines.

## Alternatives considered

- Hand earlier findings to the fresh reviewer: it anchors the read, which is the leak ADR-0012 closes.
- Keep the list in the session: it is lost between sessions, which is the failure the retest showed.
- Post the table as a PR comment, as super-board does: a GitHub write every round, while `/review` also runs on branches with no PR.
- Keep reviewing only new commits and add the covered fixes to the range: a release's uncovered commits are not contiguous, which makes any partial range drop some fix.

## Where it is enforced

- `plugins/pro-ai-sdlc/scripts/lessons.py` (`raise`, `grade`, `table`, `round`) and `tests/lessons.mjs`.
- `plugins/pro-ai-sdlc/agents/reviewer.md` and its Codex twin (grade mode).
- `plugins/pro-ai-sdlc/commands/review.md` and `plugins/pro-ship/skills/ship/SKILL.md` (the grade step and the range).
- `plugins/pro-ai-sdlc/templates/REVIEW.md` (the `## Rounds` section).
- `docs/loop-records.md` (the review record) and `tests/mieruka-sync.mjs`.
- The `sdlc-contract` check in `tests/check.mjs`.
In force from pro-ai-sdlc 0.17.0, pro-quality 0.21.0 and pro-ship 0.17.0.

Adapted in part from super-board (skills/super-review/SKILL.md, "Review remembers"), MIT.
