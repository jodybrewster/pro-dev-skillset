---
source: idea
kind: change
status: accepted
risk: low
created: 2026-10-27T07:30:00-0400
author: the maintainer
---

# Intent: ADRs in the SDLC loop

Author: the maintainer.
Source: idea, from the first end-to-end runs of pro-ai-sdlc in job-search-2026 on 2026-10-27.
Status: accepted.
Created: 2026-10-27.

## Problem

pro-ai-sdlc records each change well in its intent folder, but it has no step for a decision that outlives the change.
The intent folders can serve as ADRs: when an intent is going to expand into multiple changes or seems large, the ADR is created from there.
The loop also has no record of when a plan is finished; in job-search-2026 the evidence lived only in chat until a Done note was added by hand.

## Proposed outcome

`/intent` notices when an idea is large or spans several changes, offers to split it into separate intents and records that it likely needs an ADR.
`/spec` says whether an ADR is needed and, when it is, drafts one as proposed from the alternatives it already weighed, asking only what the ADR still lacks.
A finished build records a Done section in its plan, and the person's sign-off moves the intent, the spec and any proposed ADR to accepted.
A standalone `/adr` command records a decision that has no change behind it.

## Affected users and systems

Anyone using pro-ai-sdlc: the `intent`, `spec` and new `adr` commands, the spec and plan templates, a new ADR template, the plugin README.
pro-starter, which depends on pro-ai-sdlc.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
The change goes into pro-dev-skillset and its plugins rather than into one repo.
ADRs live where the repo already keeps them (`docs/adr/` or `docs/decisions/`), not in a new place.

## Out of scope

`/review`, `/pr-babysit` and `/sdlc-init`.
Mieruka's UI over these files.

## Success looks like

In job-search-2026, after `claude plugin update`, a large `/intent` offers a split, a `/spec` with a lasting decision writes a proposed ADR next to the existing ones and `/adr` records a standalone decision.

## Open questions

None.

## Evidence

job-search-2026 commits 8acab63 and 43a0e4e (Done notes added by hand) and 4ce46e7 (docs/adr backfilled by hand).
