---
source: idea
kind: change
breaking: false
status: proposed
risk: medium
level: 3
created: 2026-11-04T14:00:00-0500
author: the maintainer
---

# Intent: every factory session leaves a trace mieruka can show

Source: idea.
Status: proposed.
Created: 2026-11-04.
Related: [software-factory](../2026-11-03-software-factory/intent.md), [sdlc-happy-path-run](../2026-11-04-sdlc-happy-path-run/intent.md).

## Problem

A factory run cannot be inspected once it ends.
`factory/session.sh` prints the session as `--output-format stream-json`, `factory.py` reads the cost from it and the rest is lost with the container.
A session started in a terminal is not linked to any card.
So nobody can see which agents ran, in what order, on which model or at what cost.

That cost was real in the 2026-11-04 retest.
The demo session ran its reviewers on Sonnet where the agents declare Opus and nothing showed it until the reports were compared by hand.
On the due-date card, mieruka's trace API answered `card_has_no_session`.

## Proposed outcome

Each factory and terminal session of the SDLC loop leaves a log tied to its card, in the format mieruka reads.
Opening that card's trace in mieruka shows the agent timeline, the session events, the model of each agent, tokens and cost.
A session whose log could not be captured says so on the card, instead of looking like a session that never ran.

## Affected users and systems

- `pro-ai-sdlc`: `factory/session.sh`, `scripts/factory.py` and the terminal commands of the loop.
- mieruka, which reads the log through its own intent.
- Anyone reviewing what an unattended run did.

## Constraints

- A session log can hold secrets, personal data and repo text: it is scrubbed before it leaves the container, stays out of git and is never sent anywhere else.
- Capturing must not change what a session may do.
- A failed capture must not fail the build.
- mieruka remains a reader: the loop works from Claude Code alone with no mieruka installed.
- The format is one documented contract between the two repos, with one writer here and one reader there.

## Out of scope

- The trace reader and the trace page, which are mieruka's own intent.
- Screenshots, which belong to [sdlc-happy-path-run](../2026-11-04-sdlc-happy-path-run/intent.md).
- Sending traces to an outside tracing service.

## Success looks like

After a level 1 run and one terminal stage on a fresh demo, both cards open a trace in mieruka with the agent tree filled in and the model of each agent readable.
Removing the container afterwards changes nothing on the page.

## Open questions

- The log's file format and location: mieruka's trace intent defines them, so this intent's spec waits for that.
- How a terminal session learns which card it belongs to, whether from the intent folder or something else.
- How long logs are kept and whether they are copied into the repo's git-ignored `.mieruka/` folder.

## Evidence

- `apps/web/src/service/session-trace/session-trace-store.ts` in mieruka refuses a card with no `worktree_ref`, which change cards do not set.
- `plugins/pro-ai-sdlc/factory/session.sh:84` prints the stream only.
- The follow-up in `docs/roadmap.md`: a captured session trace per run so anyone can see the right agents were called.
