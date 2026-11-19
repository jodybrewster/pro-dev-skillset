# ADR-0029: An experimental loop with one design file per feature, in its own plugin

Status: proposed
Date: 2026-11-18
Decided by: the maintainer

## Context

`pro-ai-sdlc` records a change as `intent.md`, `spec.md` and `plan.md` in one folder.
`pro-egm` bridges Google's Elephant-Goldfish Model, whose strength is the conversation that gets to a design and the fresh-context reviewers that check it.
EGM keeps one design file per feature under `docs/designs/` and stops when the design is approved: approval is a sentence in chat, nothing records who agreed and it builds no code.
The two meet only where `/spec` and `/plan` offer a goldfish review once.

People outside engineering found the loop hard to follow: three documents per change, two of them engineering documents and no one place where product, design and engineering agree on the same text.
Changing the shape of `pro-ai-sdlc` to try a different one would put the factory, Mieruka and every repo on the loop at risk.

## Decision

A new plugin, `pro-ai-sdlc-egm`, holds the experiment.
It starts as a copy of `pro-ai-sdlc` and a repo enables one of the two, never both.
`pro-egm` stays its own plugin and Google's skills run unchanged.

The loop has three steps:

1. `/intent` records what a person wants.
   A person always creates an intent and a person always accepts it.
   A brainstorm is a depth of `/intent` and it reads a brief, a PRD or notes.
2. `/design` writes or updates the one design file of the feature through EGM's draft, has fresh-context reviewers read it with the repo's product, design, architecture and security files and records approvals.
3. `/execute` writes the build ticket (`plan.md`) from the approved design and builds it.

The strictness comes from scripts that read files in git, never from trusting that a step was followed:

- An intent with a `brief:` or `design:` line is level 2 or higher.
- Reviews and approvals live in `design-record.json` beside the intent and are bound to the sha256 of the design file.
  An edit to the design voids them.
- Level 2 needs the product owner and the engineer; level 3 also needs the lead.
- `execute-gate.py` refuses a change whose design is not reviewed and approved for the version on disk or has an open flagged concern.
- A level 1 build whose review leaves an Important finding open goes to an engineer and is not merged.

The record sits beside the intent, not in the design file, so EGM's file stays EGM's and two changes to one feature keep separate records.

## Consequences

- Two copies of the loop exist until the experiment ends.
  The plugin's README lists what it changed, so the changes can be merged back or dropped as a known set.
- Mieruka's board reads `spec.md` and `plan.md` and does not show a design file.
- `/pro-dev install` and pro-ship look the loop plugin up by the name `pro-ai-sdlc`, so loop setup and the verifier lookup do not find the experiment.
- EGM's draft writes a new design file and has no step for a later change, so `/design` proposes those edits itself and only the review and resolve steps are EGM's.
- An approver is a git user name checked against the role map, which is routing and not authentication.
- Two changes in flight on one design file void each other: an edit for the second sends the first back for review and approval unless it is already built.
  That is strict on purpose for now and is the first thing to revisit.
- A person may approve a design whose review left findings open; the count is in the record and the decision is theirs.
- The factory's level 1 brief still writes a short `spec.md`, because a level 1 change has no design.
- The open findings line is written by the session that is being checked; the runner reads it and does not run the review itself.

## What would reverse this

The experiment ends one of two ways: the shape replaces `pro-ai-sdlc`, or the parts that worked move into it and this plugin is removed.
Keeping both loops for good is the outcome to avoid.
