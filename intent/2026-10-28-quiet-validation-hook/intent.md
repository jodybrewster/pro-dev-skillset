---
source: idea
kind: change
status: accepted
risk: low
created: 2026-10-28T06:45:00-0400
author: Jody Brewster
---

# Intent: quiet validation hook

Author: Jody Brewster (pro-dev-skillset).
Source: idea, item 6 and intent A of [the pro-dev simplify umbrella](../2026-10-27-pro-dev-simplify/intent.md).
Status: accepted.
Created: 2026-10-28.

## Problem

pro-quality's validation Stop hook blocks the end of a turn and makes the session write a full handoff whenever the session used Write or Edit and the working tree is dirty.
It fires on writes outside the repo, such as Claude memory notes, and it reports uncommitted work the session never touched.
In one session on 2026-10-27 it blocked three times though no plugin content changed.
Jody: "the validation stop hook is too much, we need to tone it down somehow. I keep getting stop hook errors like above".

## Proposed outcome

The hook only reacts to files the session changed inside the repo.
By default it no longer blocks; it prints one line pointing at `/validate`.
A person can turn it off, or back to blocking, without editing the plugin.

## Affected users and systems

Every site with pro-quality installed: the Stop hook script, the `user-validation` skill and `/validate` command text, the plugin README and a new behavior test.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
The loop guards in `docs/hook-loading.md` stay: `stop_hook_active` and per-session progress.

## Out of scope

The other Stop hook in pro-ai-sdlc (`plan-sync.py`) and the content of the handoff itself.

## Success looks like

A session that only talks, reads or writes outside the repo ends with no hook output.
A session that edits repo files ends with one line suggesting `/validate` and no forced handoff.

## Open questions

- Should the default be the one-line nudge or fully off?
