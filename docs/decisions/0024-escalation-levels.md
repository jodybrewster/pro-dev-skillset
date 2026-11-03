# ADR-0024: An intent gets an escalation level at intake from a script, only ever raised, with roles named in REVIEW.md

Date: 2026-11-03

## Status

proposed

Decided by: the maintainer.
Source: intent/2026-11-03-software-factory/.

## Context

Every change went through the same intent, spec and plan gates; the risk tiers (ADR-0015) decide only at merge.
A small bug waited on a person three times.
The loop named only "the engineer" and "a lead", so an author could accept their own intent and an engineer could close a security concern in their own spec.

## Decision

Each intent carries `level: 1 | 2 | 3`, computed by `factory.py level` with no model call from the intent's source, author, declared risk, stop-list words and new dependencies, reading policy from the default branch tip.
A level is only ever raised; `risk-classify.py` on the real diff before merge raises it again when the tier is medium or high.
Level 1 runs headless through `/pro-ai-sdlc:auto` and merges only at the low tier with `--match-head-commit`.
Level 2 needs the engineer at the plan and merge; level 3 adds the policy owner on flagged concerns and the lead on the plan and merge.
Roles are a `## Roles` block in `REVIEW.md`: product owner, engineer, lead, policy owner and platform owner, each a list of names.
Deploy stays a person's step at every level.
An unattended run uses its own guard folder in enforce, so warnings nobody reads become blocks.

## Consequences

Small changes reach a merged pull request without a person; the record names the deploy as the person's.
`author:` is a git name anyone can set: acceptable in a solo repo where push rights are the check, not in a team repo until signed commits are required.
`production-gate.py` hands merges to `merge-gate.py` when pro-ship is installed, so one gate owns the merge decision.
Mieruka reads the same role map and level.

## What would reverse it

A level 1 merge that a person would have stopped, traced to a rule in `factory.py level`, tightens that rule or removes level 1.
A team adopting the factory without signed commits moves `author:` checks to the pull request author on GitHub.

## Where it is enforced

- `plugins/pro-ai-sdlc/scripts/factory.py`
- `plugins/pro-ai-sdlc/commands/auto.md`
- `plugins/pro-ship/scripts/merge-gate.py` and `risk-classify.py`
