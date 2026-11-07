---
source: idea
kind: change
breaking: false
status: proposed
risk: medium
level: 3
created: 2026-11-07T14:00:00-0500
author: the maintainer
---

# Intent: reaching Done

Author: the maintainer.
Source: idea, from the retest of 2026-11-04 and roadmap items 35 to 39 ([docs/roadmap.md](../../docs/roadmap.md)).
Status: proposed.
Created: 2026-11-07.
Related: [p2-batch](../2026-11-07-p2-batch/intent.md), [sdlc-happy-path-run](../2026-11-04-sdlc-happy-path-run/intent.md), [review-routes-back](../2026-11-07-review-routes-back/intent.md).

## Problem

The retest of 2026-11-04 reached no Done.
A fresh demo ran every role and a release went out.
No card reached Done because the rollback check never passed and the deploy record stayed `partial`.
Six of its findings stand between the loop and Done and none has an intent yet:

- A finding that a covered commit had fixed came back as Important in `/ship`: a fixed bug was reported again as if it were open.
- `/ship` hands its reviewers the first and last uncovered commit as the range, which pulls in covered commits and stops before a covered fix.
- A demo session overrode the reviewers from Opus to Sonnet.
  Opus found an Important finding and two high test gaps the Sonnet runs missed.
  No gate caught the override.
- A release check left at `confirm` has no way to be cleared, which keeps the deploy record `partial` however carefully a person looked.
- The demo's rollback steps were prose, found only when the run reached the rollback dry run and failed there.
- Reviewers raise findings that a caller, a guard or a test already rules out, because nothing asks them to check before reporting.

Every person who runs `/review`, `/ship` or the factory meets these on every PR that takes more than one review round or ships a release.

## Proposed outcome

Five roadmap items land, in this order of modules:

1. Item 35, reviewer memory.
   A findings table persists under `.pro-dev/` with a stable id, a `file:line` and a status per finding.
   Round 1 of a later review grades each earlier finding `fixed`, `not fixed` or `no longer applies` at the new head before the fresh pass runs.
   `/ship` and `/review` review `merge-base..head` instead of the first and last uncovered commit.
   The reviewer stays blind to earlier reasoning as ADR-0012 requires: it sees the table and never the arguments behind it.
2. Item 39, findings validated against the code.
   Reviewers check each finding against the callers, guards and tests that reach the changed code before reporting it.
   Zero findings is a valid result.
   Defects that already exist on the base are listed apart from regressions the change brings.
   The doubt step keeps a caller or test that contradicts the claim inside its review unit.
3. Item 36, the reviewer's model on the record.
   The review record and the pr-check stamp carry the model each review ran on.
   `/ship` and `factory.py verify` refuse a stamp whose review did not run on the model `REVIEW.md` names, which is Opus in this repo.
4. Item 37, a human confirmation bound to the PR head.
   The ship flow posts a request bound to the repo, the head sha and a scope: the PR when one exists, the tagged commit otherwise.
   Only a later reply from a user with write access clears it and a label never does.
   The merge gate reads it again before merging.
   A confirmation also clears a release check left at `confirm`.
5. Item 38, a readiness check in the `/ship` preflight.
   It rejects a rollback or verify step that is not a runnable command and halts before any reviewer runs, with every earlier record left as it was.

## Affected users and systems

- `pro-ai-sdlc`: the `reviewer` agent and its Codex twin, `/review`, `lessons.py`, the doubt-driven-development skill and `factory.py verify`.
- `pro-ship`: the ship skill, `ship.py`, `pr-check.py` and its stamp, `merge-gate.py` and `ship-gate.py`.
- `pro-quality`: the `code-reviewer` agent and its Codex twin.
- This repo: `docs/loop-records.md`, `docs/pr-check-stamp.md`, `docs/ship-preflight.md`, `docs/enforce-mode.md`, `REVIEW.md`, the Ship block in `CLAUDE.md` and a new ADR.
- mieruka reads the review record; its reader is its own intent in its own repo.

## Constraints

- ADR-0011's round cap stays three rounds and every round still counts.
- ADR-0012's four handoff fields stay as they are; the only addition is the findings table, which goes to the grading step alone.
- Records change only by adding optional fields; `schema` stays 1 and no reader breaks.
- Every new gate starts in warn mode with its own row in `docs/enforce-mode.md`.
- Each PR follows the version-bump law, the hook-loading law and Codex parity.
- Adapted super-board and agent-skills content keeps an attribution footer and a row in `docs/licenses.md`; both upstreams are MIT.
- The review-routes-back intent (`intent/2026-11-07-review-routes-back`) is separate and comes after this one.

## Out of scope

- Routing a finding back to the plan or the spec; that is the review-routes-back intent.
- A GitHub identity of its own for the factory.
- Items 40 to 43, which have their own place in the P1 list.
- mieruka's reader for the review record.

## Success looks like

The next board rerun takes one demo intent through a second review round with no fixed finding reported again.
A Sonnet review is refused by `/ship` and `factory.py verify`.
A `confirm` check is cleared by a reply on the PR and the deploy record reaches `pass`.
A prose rollback step stops `/ship` before any reviewer is dispatched.

## Open questions

- None that block the spec; the module specs record the assumptions the maintainer confirmed on 2026-11-07.

## Evidence

The retest of 2026-11-04 is recorded under "Done: the retest of 2026-11-04" in [docs/roadmap.md](../../docs/roadmap.md).
The detail for items 35 to 39 is under "Items 32 to 54" on the same page.
