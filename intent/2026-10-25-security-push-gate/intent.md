---
source: idea
kind: change
status: accepted
risk: medium
created: 2026-10-25T10:15:00-04:00
author: Jody Brewster
---

# Intent: one security gate, on push, scoped to the diff

## Problem

pro-security registers four hooks and together they make the plugin too loud to leave on.
State files under `~/.claude/pro-dev/security` cover 1223 sessions: the per-prompt `ideation-nudge` fired 1416 times (56 in one session), `commit-gate` denied 98 commits, `plan-doc-gate` blocked 13 writes and `plan-gate` never fired.
The developer disabled most of the marketplace on his machine to escape the noise, which took pro-design, pro-execution and pro-testing offline with it.

Two things are wrong with the shape, not just the volume.
The gate fires on `git commit`, so every local commit on a branch gets a review that the push would have covered anyway.
And the `security-architect` agent's diff mode tells it to read every changed file in full plus the callers and middleware that reach them, with `Glob` and `Grep` in hand, so a review of a modest diff walks a good part of the repo and costs an Opus run each time.

The developer's words: "I just need a security review before something gets pushed to github. It also seems like its doing a full scan against the whole repo every time. It just needs to check the diff."

## Proposed outcome

pro-security has one hook.
It runs when a Bash command would push a branch (`git push`) or open a pull request (`gh pr create`), diffs what would leave the machine against its upstream, and holds the command once per distinct diff per session when that diff touches security surface.
The identical retry passes.
`git commit` is never gated.
No hook runs on prompts, on file writes or on leaving plan mode.

The `security-architect` agent, in diff mode, reviews the diff: the hunks, the changed files and the direct callers of a changed symbol, found by grepping that symbol's name.
It does not walk the tree.
A whole-repo posture review stays with `security-audit` and `/security-audit`, run on request.

`/threat-model` and `/security-audit` stay as they are.

## Affected users and systems

pro-security (0.1.1 to 0.2.0), its hooks, three of its four scripts, the `security-architect` agent and its Codex counterpart, `tests/security-hooks.mjs`, README and `docs/releases.md`.
pro-legal copies the planning hooks rather than importing them, so it is untouched.

## Constraints

Version-bump law: both pro-security manifests, the marketplace entry and `metadata.version` bump in this change.
Hook-loading law: the one hook lives in `hooks/hooks.json`; the removed scripts leave no dangling reference.
The hook fails open on any error and never exits 2, like the hooks it replaces.
The `security-architect` agent stays on Opus (decision of 2026-10-17); this change narrows what it reads, not what runs it.

## Out of scope

Re-enabling the disabled plugins on the developer's machine; by hand after merge.
Changing what counts as security surface in `security_surface.py`.
pro-legal's planning hooks, which have the same shape and the same noise profile; separate intent if wanted.

## Success looks like

`spec.md` in this folder holds the checks.
