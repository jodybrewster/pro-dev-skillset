---
id: PDS-54
source: idea
kind: change
breaking: false
status: draft
risk: medium
level: 2
created: 2026-11-07T14:31:00-0500
author: the maintainer
---

# Intent: pr-check runs every check and review on every risk tier

Author: the maintainer.
Source: idea.
Status: draft.
Created: 2026-11-07.

## Problem

A low-tier change gets less checking than a medium one.
`pr-check` skips the mutation check when the tier is low (`plugins/pro-ship/skills/pr-check/SKILL.md`, step 5).
`risk-classify.py` demands no reviewers for low (`DEMANDS["low"]`), so the merge gate accepts a low PR whose code review never ran.
The security review only runs when a path-based surface check matches, so an auth check in a file named `utils.ts` is never reviewed for security.
The test-engineer review, adapted from agent-skills, only runs at `/ship` time and never on a pull request.
Low is exactly the tier that now merges with nobody watching: mieruka's autorun and the factory merge a level 1 change on a low tier alone.

## Proposed outcome

Every pull request gets the same checks and reviews whatever its tier: build, lint, typecheck, tests, the floor guard, the mutation check, the code review, the test-engineer review, the security review and the verifier.
The tier decides only who approves the merge: low needs no person, medium and high need the maintainer, high also carries the `risk:high` label.
The merge gate refuses any merge whose stamp lacks a clean code review, whatever the tier.

## Affected users and systems

`pro-ship` (`pr-check`, `risk-classify.py`, `merge-gate.py`), `pro-quality`'s `code-reviewer` and `test-engineer` agents, `pro-security`'s `security-architect`, `/execute` and the factory in `pro-ai-sdlc`, and mieruka's autorun, which reads the same stamp.

## Constraints

Reviews run locally inside `pr-check` and never in CI: no model call may run on a pull request in CI, to keep costs down.
Every review spends subscription usage, so each one runs once per head commit and a stamp for that head is reused, never repeated.
Keep the risk tiers and their thresholds as they are.

## Out of scope

New reviewers beyond the ones already adapted.
CI gates, covered by `p2-batch` item 16.

## Success looks like

A low-tier pull request's stamp records the mutation check, the code review, the test-engineer review and the security review.
`merge-gate.py` refuses a low-tier merge whose stamp has no clean code review.

## Open questions

Whether to keep a cheaper path for very small low-tier diffs, such as skipping the test-engineer review under a line count, if the usage turns out too high; the maintainer decides after a week of runs.

## Evidence

None.
