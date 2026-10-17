---
source: planning-session
kind: change
status: accepted
risk: medium
created: 2026-10-17
author: Jody Brewster
---

# Intent: the SDLC ships as one plugin, pro-ai-sdlc

Brief: `~/Projects/hq/initiatives/2026-10-17-one-click-intent/intent.md`, slice PR B.
Scope changed on 2026-10-17: the commands, templates, agents and hooks live in a new plugin, not in pro-core.

## Problem

`/intent`, `/spec`, `/pr-babysit`, the `verifier` and `simplifier` agents and the guard hooks live only in one user's `~/.claude`, so no other repo or session gets them and mieruka cannot read the templates they use.
`/intent` writes a shorter file than the AI-native SDLC kit's template.
There is no `/plan`, no `/review` and no way to set up a repo for the loop.
Agents in the other plugins do not say which model their role needs.

## Proposed outcome

One plugin, pro-ai-sdlc, carries the SDLC stage by stage and stays stack-agnostic.
It ships commands (`/intent`, `/spec`, `/plan`, `/review`, `/babysit-pr`, `/sdlc-init`), templates the commands read (`intent`, `spec`, `plan`, `REVIEW`), agents (`researcher`, `verifier`, `simplifier`, `reviewer`) and three hooks in warn mode (`protect-tests`, `plan-sync`, `production-gate`).
pro-starter installs it.
Every agent in the other plugins declares `model:` for its role.

## Affected users and systems

Anyone who installs pro-starter or pro-ai-sdlc; mieruka's intake chat in a later slice, which reads `templates/intent.md`; the agents in pro-quality, pro-research, pro-security and pro-legal.

## Constraints

Version-bump law, hook-loading law, Codex parity and the writing rules apply.
The kit is downloaded material: read only, nothing from it runs.
Hooks ship in warn mode behind the mode files already in use.
Nothing is removed from pro-core.
Effort fields do not change.

## Out of scope

Deleting the user-scope files (Jody does that after the merge and `claude plugin update`).
`/incident`.
Mieruka changes.
Codex `.toml` model fields.

## Open questions

None.
