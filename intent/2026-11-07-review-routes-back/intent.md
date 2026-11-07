---
id: PDS-48
source: idea
kind: change
breaking: false
status: proposed
risk: medium
level: 2
created: 2026-11-07T11:20:00-0500
author: the maintainer
---

# Intent: a failed review routes back to build, plan or spec

Source: idea, from the retest of 2026-11-04 and the m1 plan discussion of 2026-11-07.
Status: proposed.
Created: 2026-11-07.
Related: [p2-batch](../2026-11-07-p2-batch/intent.md) (step 5 of its m1 plan is the safety net this intent makes rarely needed), [sdlc-happy-path-run](../2026-11-04-sdlc-happy-path-run/intent.md), [ADR-0011](../../docs/decisions/0011-review-convergence.md), [ADR-0024](../../docs/decisions/0024-escalation-levels.md).

## Problem

When a review finds something Important, the loop fixes it in place.
`/pr-babysit` commits onto the branch, pushes and re-reviews, up to three rounds.
`/execute` is never re-entered, so the plan's `## Done` section keeps describing the first attempt.
`/plan` is never re-opened, so a plan that sent the build the wrong way stays approved as written.
`/spec` is never questioned, so a requirement the reviewer showed to be wrong or missing stays in the accepted spec.
On the retest this showed as a `## Done` that no longer matched the diff and as a fixed finding coming back as Important, because nothing recorded where the fix had landed.
The board has no column move for it: a card in Review that fails has nowhere to go but Review again.

## Proposed outcome

Each Important finding says where it routes; the loop takes the card there:

- Code is wrong: back to build. `/execute` re-enters for the named step, records the departure and rewrites `## Done` at the new head.
- The plan was wrong (a step missing, the wrong file, the wrong order): back to plan. The plan is amended and re-approved, then build.
- The requirement was wrong or missing: back to spec. The spec is amended, then plan, then build.
- The finding is architectural or security-related, or shows the change is bigger than the intent said: back to spec or plan with the level raised. A reviewer may raise the card's escalation level in its finding; the level is only ever raised (ADR-0024), a raised level ends any unattended run and a person reviews the amended spec before the card moves again. A level 1 build that turns out to touch auth, data or a public interface ends in a human's hands, not in another automated round.
- A nit: fixed in place, as today.

The review record carries the route for each finding, so mieruka can move the card back the matching number of columns.
Convergence still holds: every route counts toward ADR-0011's three rounds.

## Affected users and systems

- `pro-ai-sdlc`: `/review`, `reviewer.md` (a `route:` field per finding), `/pr-babysit` (route instead of patch for Important findings), `/execute` (re-entry for a named step), `/plan` and `/spec` (amending an accepted file keeps its history).
- `pro-quality`: `code-reviewer.md` gains the same field.
- `pro-ship`: `/ship` reads the route when it lists findings.
- `docs/loop-records.md`: the review record format.
- mieruka: a card moves back a column on a routed finding, through its own intent.
- `docs/decisions/`: an ADR, since this sets a rule every review follows; ADR-0024 gains the review as a place a level is raised.
- `factory.py`: a run stops when a review raises the level, as it does today when the level computes above 1.

## Constraints

- A route is a recommendation to a person at level 2 and above; only a level 1 factory run takes it unattended; never when the finding raised the level.
- The `reviewer`, `code-reviewer`, `security-architect` and, once built, `architect` agents may all raise the level; none may lower it.
- Amending an accepted spec or plan never rewrites history: the amendment is a dated section and the file's status goes back to `proposed` or `draft` until re-accepted.
- The round cap of ADR-0011 is unchanged.
- The stale-Done check from p2-batch m1 stays as the safety net for a fix that bypasses the route.

## Out of scope

- Changing what counts as Important (REVIEW.md owns that).
- Automatic re-runs of the whole plan.
- mieruka's column logic, beyond the record it reads.

## Risk

Medium.
It changes the shape of a record mieruka reads and the behavior of `/pr-babysit` in every repo with the plugin.
A wrong route costs a trip through plan or spec, which a person can override.

## Check

`spec.md` for this intent lists the record field, the three routes and the re-entry rule as testable statements; the e2e scenario adds a failed review that lands back in build and reaches Done.
