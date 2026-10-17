---
source: planning-session
kind: change
status: accepted
risk: low
created: 2026-10-17
author: Jody Brewster
---

# Intent: /intent, /spec and /plan ship from pro-core, and agents declare their model

Brief: `~/Projects/hq/initiatives/2026-10-17-one-click-intent/intent.md`, slice PR B.

## Problem

`/intent` and `/spec` live only in one user's `~/.claude/commands`, so no other repo or session gets them and mieruka cannot read the template they use.
They also write a shorter intent than the AI-native SDLC kit's template.
There is no `/plan` command, so plan.md has no shared shape.
Agents in the plugins do not say which model their role needs, so each runs on whatever the session uses.

## Proposed outcome

`/intent`, `/spec` and `/plan` ship from pro-core like `/kaizen` did.
The intent template is one file inside pro-core that the command reads and that mieruka can read later.
Every agent definition declares `model:` for its role: readers and explorers on haiku, builders on sonnet, reviewers on opus.

## Affected users and systems

Anyone who installs pro-core; mieruka's intake chat in a later slice; the nine agents in pro-quality, pro-research, pro-security and pro-legal.

## Constraints

Version-bump law, Codex parity and the writing rules apply.
The kit is downloaded material: read only, nothing from it runs.
Effort fields do not change.

## Out of scope

Deleting the user-scope files (Jody does that after the merge).
Mieruka changes (PR A, C, D, E).
Codex `.toml` model fields, which use a different model namespace.

## Open questions

None.
