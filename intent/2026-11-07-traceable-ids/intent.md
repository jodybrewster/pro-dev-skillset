---
source: idea
kind: change
breaking: false
status: proposed
risk: medium
level: 3
created: 2026-11-07T13:05:00-0500
author: the maintainer
---

# Intent: every change carries a project shortcode and a number

Source: idea.
Status: proposed.
Created: 2026-11-07.
Related: [review-routes-back](../2026-11-07-review-routes-back/intent.md), [p2-batch](../2026-11-07-p2-batch/intent.md), [ADR-0023](../../docs/decisions/0023-loop-records.md).

## Problem

A change in the loop is known by a folder name, `intent/<date>-<slug>/`; nothing else names it.
Its branch, its commits, its pull requests, its pr-check stamp, its factory and deploy records and its card in mieruka each name it differently or not at all.
Tracing one change from an idea to a deploy means matching slugs by eye across a dozen places.
On the retest of 2026-11-04 four pull requests, two intents and a release had to be lined up by hand to see what had reached Done.
Today's m1 build opened three pull requests for one plan; the only thing tying them together was prose in their bodies.
Two sessions in one checkout landed spec commits on each other's branches; nothing in a commit subject said which change it belonged to.

## Proposed outcome

Each repo declares a shortcode once, in a tracked `intent/project.json` (`{"shortcode": "PDS"}` for this one).
Every change has an id, `<shortcode>-<n>`, allocated when its intent is written and never reused.
The id appears in every artifact of the change:

- the intent folder for a new change, `intent/PDS-50-slug/`, plus an `id:` line in the frontmatter of `intent.md`, `spec.md` and `plan.md`;
- the branch for each stage, `PDS-50/spec`, `PDS-50/plan`, `PDS-50/build-m1`;
- the first words of every commit subject, `PDS-50: ...`, plus every pull request title;
- the pr-check stamp, the factory record and the deploy record, as `change_id`, which mieruka reads to put a card and its evidence together;
- every review finding; a finding can then be traced to the change it was raised on and to the round that closed it;
- the roadmap row and any ADR the change produced.

`/intent` allocates the next number from the ids committed on `origin/main` and on any local or remote branch; an intent left uncommitted or unpushed in another clone is caught by the duplicate check on the second pull request; a `check.mjs` check fails on a duplicate or missing id.
The 49 existing intent folders keep their names and gain an `id:` line in creation order, PDS-1 to PDS-49; no link in the docs, the roadmap or the ADRs breaks.
A hook warns when a commit on a change branch lacks the id, in warn mode first.

## Affected users and systems

- `pro-ai-sdlc`: `/intent`, `/spec`, `/plan`, `/execute`, `/review`, `/auto`, the templates, `factory.py`, `plan-sync.py`, `evidence.py` and a commit-subject hook.
- `pro-ship`: `pr-check` and the stamp, `ship.py` records, `/deployed`.
- `pro-core`: `/pro-dev install` writes `intent/project.json` when the person gives a shortcode; the `git-safe` guard is unchanged.
- `docs/loop-records.md`: a `change_id` field on every record kind.
- `tests/check.mjs`: the id check.
- mieruka: reads `change_id` through its own intent; until then it keeps matching by folder.
- Every repo that installs the starter: a one-time shortcode question.

## Constraints

- Existing folder names and links stay as they are; only new changes use the id in the folder name.
- An id is never reused or renumbered, even when the change is dropped.
- The hook starts in warn mode and gets its row in `docs/enforce-mode.md`.
- A commit on `main` made by a squash merge carries the id because the pull request title does.
- A repo with no `intent/project.json` behaves as today, with a one-line reminder from `/intent`.
- No person's name in any of it; the id is about the change, not the author.

## Out of scope

- Renaming the 49 existing folders.
- A hosted counter or a ticket system; the id is allocated from git.
- mieruka's column and card changes, beyond the field it reads.
- Numbering ADRs, which already have their own sequence.

## Risk

Medium.
It touches every command in the loop and the record format mieruka reads; a slip shows up everywhere at once.
Each piece is additive and a missing id degrades to today's behavior with a warning.

## Check

`spec.md` for this intent lists the id format, the allocation rule, each place the id appears and the backfill as testable statements; `node tests/check.mjs` gains the id check and passes with all 49 intents backfilled.
