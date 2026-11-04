---
source: idea
kind: change
breaking: false
status: proposed
risk: medium
level: 3
created: 2026-11-04T14:05:00-0500
author: the maintainer
---

# Intent: an automated happy path run shows the whole SDLC with its evidence

Source: idea.
Status: proposed.
Created: 2026-11-04.
Related: [factory-demo-kit](../2026-11-03-factory-demo-kit/intent.md), [factory-session-capture](../2026-11-04-factory-session-capture/intent.md), [rollback-path](../2026-11-04-rollback-path/intent.md).

## Problem

The SDLC cannot yet be watched from intent to Done, so it is hard to learn or to trust.
The 2026-11-04 retest was walked by hand across two windows for most of a day and it did not finish: the release went out but no card reached Done.

Three things stopped it from being a clean run:

- The demo fixture's rollback steps are prose, so the rollback check can never pass and the deploy record stays `partial`.
- A `partial` record keeps a card in Ship with no way to clear it: the board says it is waiting on the owner and offers no action.
- Commands typed into the wrong window, roles left on the wrong person and a bare `/review` reaching the wrong reviewer all cost time and none of them are what the run was testing.

The evidence of what happened lives in chat and terminal scrollback, which nobody else can read.

## Proposed outcome

One command runs the happy path unattended on a fresh demo, from intent through spec, plan, build, review, merge, release and deploy, until each card shows Done on mieruka's board.
Each stage leaves a screenshot in that card's trace panel, next to its agent timeline and session trace.
The run changes roles on the way through, so the board and the gates are seen acting for each person in the role map.
Afterwards someone who was not there can open the board and follow what happened.

## Affected users and systems

- `tests/e2e-sdlc.mjs` and its scenarios, or a new runner beside them.
- `demo/factory/new-demo.sh` and its fixture, which need rollback steps that can pass.
- `pro-ship`'s `/deployed`, for a way to clear a check left at `confirm`.
- mieruka's board and trace panel, driven as a browser would.

## Constraints

- The live run spends real money, so it runs only on the maintainer's yes and states its cost first; the existing e2e is about $18 to $30.
- The happy path only: failure paths stay in their own scenarios.
- Fictional people only, with no real credentials or personal data in a screenshot.
- Roles are fictional people on one GitHub account, so they are git authors and mieruka's identity. The run must say this and must not present them as separate reviewers on GitHub.
- A check is never marked passed to reach Done; if the run cannot get there honestly, it stops and says why.

## Out of scope

- Rollbacks, which are [rollback-path](../2026-11-04-rollback-path/intent.md).
- Capturing session logs, which is [factory-session-capture](../2026-11-04-factory-session-capture/intent.md).
- The trace page itself and showing screenshots as images, which are mieruka's own intents.

## Success looks like

The maintainer runs one command, reads nothing in a terminal and then opens mieruka: every card is on Done, each stage shows a screenshot, the agent timeline and session trace are filled in and the role changes are visible.

## Open questions

- Extend `tests/e2e-sdlc.mjs`, whose scenario 3 already walks roles, gates, a tag and an incident, or build on the demo kit.
- Whether the rollback check should demand steps that were run or steps that read as commands: the check's wording allowed two readings in the retest.
- The cost of the longer run, to be stated once it is designed.
- The record field and file location for a screenshot, which mieruka's screenshot intent names.

## Evidence

From the retest on 2026-11-04, on the demo repo `factory-demo-3`:

- v1.1.0 was tagged and pushed at `7ee95f9`, tests and documented use passed and the deploy record stayed `partial` on the rollback check.
- `apps/web/src/service/change-progress.ts` in mieruka keeps a card in Ship until a deploy record with status `pass` covers its merge.
- `ship.py deployed` records `partial` when any check is `confirm` or `finding`.
- A rerun for the same tag overwrites the earlier record.
