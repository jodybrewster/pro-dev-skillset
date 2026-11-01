---
source: idea
kind: change
status: proposed
risk: medium
created: 2026-10-28T07:35:00-0400
author: the maintainer
---

# Intent: swappable spec methods, starting with Elephant-Goldfish

Author: the maintainer.
Source: idea, intent C of the [pro-dev simplify umbrella](../2026-10-27-pro-dev-simplify/intent.md), item 7 apart from spec-kit (intent E).
Status: proposed.
Created: 2026-10-28.

## Problem

The maintainer wants to try several spec-driven methods side by side: pro-ai-sdlc (intent, spec, plan), pro-spdd, GitHub spec-kit and Google's [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) (EGM, Apache-2.0).
Having four different spec-driven methods means each can be tried easily by installing and uninstalling its plugin, while the plugins still control how they work together.
Today nothing says how the methods relate, so with two installed a session can start the same feature in two places.
EGM is already a Claude Code plugin in its own marketplace (`egm@egm`): a context-rich "elephant" session drafts a design, and "goldfish" subagents with no conversation history review it before any code is written.
It writes `concepts_brief.md` and `design_draft.md` and saves approved designs under `docs/designs/`.

## Proposed outcome

Each method is its own opt-in plugin, so installing or uninstalling one is how the maintainer tries it.
pro-ai-sdlc stays the default loop and becomes the coordinator: it checks which methods are installed and routes to them at defined points, with no edits needed when one is added or removed.
A new `pro-egm` bridge plugin carries a thin skill on when to use EGM and how it fits the loop, and a registry row so `/pro-dev install` installs `egm@egm` when asked.
The proposed hand-offs:
- `/intent` for a feature with real design decisions offers EGM's brainstorm when pro-egm is installed.
- `/spec` offers EGM's goldfish review of the draft when pro-egm is installed.
- An approved EGM design or spec-kit spec can stand in for `spec.md`, linked from the intent, so `/plan` and `/review` still work.
- pro-spdd keeps its own flow and is reachable from the same routing table.

## Affected users and systems

Sites that install pro-egm, pro-speckit or pro-spdd.
pro-ai-sdlc's `intent`, `spec`, `plan` and `review` commands and its routing; a new `pro-egm` plugin; the engine registry from intent B; routing cases; `docs/licenses.md`.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`; EGM also ships for Codex.
No hard dependency on `egm@egm` (PR 44); it installs through `/pro-dev`.
Bridges over vendoring: no EGM text in this repo.
pro-ai-sdlc must work unchanged when no other method is installed.

## Out of scope

The spec-kit plugin itself (intent E).
Changing pro-spdd's own commands.
Choosing one method over the others.

## Success looks like

With only pro-ai-sdlc installed, the loop behaves as today.
Install pro-egm and run `/pro-dev install`: `/spec` now offers an EGM review, and the review's findings land beside the spec.
Uninstall pro-egm: the offer disappears with no other change.

## Open questions

- Needs intent B's registry; does C wait for B?
- The exact hand-off points; the list above is a first proposal to settle in the spec.
- Where an EGM design doc lives relative to `intent/<date>-<slug>/`: copied in, linked or written there directly.
- Likely needs an ADR: it sets how every future method plugs into the loop.
