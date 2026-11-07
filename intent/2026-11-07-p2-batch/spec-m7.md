---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T10:40:00-0500
author: the maintainer
module: m7
---

# Spec m7: runnable checks, the scaling block and pipeline

Built from `intent.md` in this folder (commit 5041d4a), module m7 of [capability-map.md](./capability-map.md).
Status: draft, to be completed after m1 to m6 land.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, `docs/roadmap.md` items 16, 20 and 21, the pro-ship brainstorm features 11, 13, 19 and 20.

## Summary

Three items that pay off past one person or once CI holds the gate: a plugin declares the checks `pr-check` runs for it (20), a scaling block in `REVIEW.md` drives rulesets, CODEOWNERS and Dependabot through `repo-hygiene` (21) and `pipeline` turns the gate into required CI checks (16).
Each may park with a reason written here once m1 to m6 are in.

## Assumptions

Unconfirmed, to be confirmed when this module is planned:

1. The repos that install the starter are still mostly one-person; 21 and 16 wait for the first repo with two.
2. `pr-check` runs the repo's own build, lint, typecheck and test commands and has no way to ask an installed plugin for more.
3. `ci-cd-and-automation` from agent-skills is the sidecar for 16, forked with attribution.

## Requirements

### Functional

- R1. A plugin may ship `checks.json` naming commands `pr-check` runs when that plugin is installed in the target repo; `pr-check` lists each with its exit code in the stamp (item 20).
- R2. `REVIEW.md` may carry a `## Scaling` block with approvals per tier, who approves, review depth and where it is enforced; `repo-hygiene` writes a GitHub ruleset, `CODEOWNERS` and a Dependabot config from it and shows the diff before writing (item 21).
- R3. `pipeline` generates or audits a GitHub Actions workflow that runs the same checks and reviewers as `pr-check` as required status checks, from the Scaling block when present (item 16).
- R4. Each of R1 to R3 may instead be parked: this spec then records the reason and the roadmap ticks the item as parked.

### Non-functional

- N1. Nothing here runs without a person's yes; all three write files into the target repo.

### Policy constraints applied

- Version-bump law and hook-loading law as for every plugin change.
- ADR-0014: the stamp format change in R1 is additive.

### Boundaries

Always: show the diff before writing into a target repo.
Ask first: writing rulesets or workflows.
Never: push a workflow or ruleset without the person's yes.

## Design

To be written when m1 to m6 have landed; the requirements above are the scope, not the design.

## Flagged concerns

ADR needed: yes if R2 or R3 ships, because required CI checks and rulesets set a rule other work follows; drafted at plan time.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | All three pay off only past one person, so they may never be worth the plugin surface | `docs/roadmap.md` "How it is ranked" | open: decide park or build after m6 |

## Open questions

- Park or build, per item, after m6.

## Acceptance criteria

- AC1. Each of items 16, 20 and 21 is ticked built or parked in `docs/roadmap.md` with a link here.

## Out of scope

- Anything the Later tier lists (item 31).
