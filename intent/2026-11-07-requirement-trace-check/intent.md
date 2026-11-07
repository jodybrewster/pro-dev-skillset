---
id: PDS-54
source: idea
kind: change
breaking: false
status: draft
risk: low
level: 2
created: 2026-11-07T14:31:00-0500
author: the maintainer
---

# Intent: check that every requirement reaches a plan step and every criterion has proof

Author: the maintainer.
Source: idea.
Status: draft.
Created: 2026-11-07.

## Problem

The templates number a spec's requirements `R1, R2` and its acceptance criteria `AC1, AC2`, and each plan step names the ids it serves, as in `(R1, AC1)`.
`## Done` lists each criterion with what was observed.
Nothing checks the chain: a requirement with no plan step, a plan step citing an id the spec does not have, or a criterion missing from `## Done` all pass.
An unattended build can therefore merge with a requirement silently dropped.

## Proposed outcome

A deterministic check reads `spec.md` and `plan.md` and reports:

- a requirement or criterion that no plan step names;
- a plan step that names an id the spec does not define;
- once the build is done, a criterion with no line under `## Done`, or one marked fail.

`/plan` runs it before the plan is committed and `pr-check` runs it on the pull request; a gap is a finding.

## Affected users and systems

`pro-ai-sdlc` (`/plan`, `/execute`, the spec and plan templates) and `pro-ship`'s `pr-check`; mieruka's autorun, which merges on the stamp.

## Constraints

No model call: it is a script that parses the two files.
It complements `traceable-ids` (#176), which gives the whole change an id; this one checks the ids inside a change.

## Out of scope

Linking tests or commits to requirement ids.

## Success looks like

A plan that leaves `R3` without a step fails `/plan` with a message naming `R3`; a `## Done` missing `AC2` is a pr-check finding.

## Open questions

None.

## Evidence

None.
