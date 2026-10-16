---
source: planning-session
kind: idea
status: accepted
risk: medium
outcome: O6
opportunity: pro-dev-skillset ships hooks, agents and commands into six repos and does not itself have REVIEW.md, an intent folder, a decision log, a branch ruleset or a one-page agent file
created: 2026-10-17T13:00:00-04:00
author: Jody Brewster
---

# Intent: the channel passes its own bar before the install widens

## Problem

pro-dev-skillset is the plugin marketplace that carries the SDLC into every other repo, so a defect there has the widest blast radius of anything Jody owns.
Today it has no REVIEW.md, no `intent/`, no decision log, no main ruleset, a 167-line agent file, and the licenses of its forked skills are not recorded in one place.
Jody asked whether to install it everywhere first or make it follow the SDLC first.

## Proposed outcome

pro-dev-skillset follows the AI-native SDLC itself, through its own gate, before the user-scope install widens from pro-core to pro-starter.
`/kaizen` ships from pro-core, judged against the channel's own profile, and its first run targets the channel.

## Solutions, in order

1. Jody merges https://github.com/jodybrewster/pro-dev-skillset/pull/50; the session updates pro-core, retires the user-scope `/kaizen` copy and removes the worktree.
2. Jody adds the main ruleset (PR required, no direct push, no force push, linear history, zero approvals, no bypass).
3. The planning session runs `/kaizen pro-dev-skillset` and leaves the ledger, the report and the brief for the basics.
4. One Opus execution session lands the basics as a PR under RELEASING.md's version-bump law: REVIEW.md, `intent/`, `docs/decisions/` with the first ADRs (the skills-only history, the version-bump law, the hook mode convention), the agent file to a page with the rest in docs, a NOTICE or license table for every forked skill.
5. After that merge: widen the install to pro-starter, confirm every repo's verify command still passes with the new hooks in warn mode, update `coverage.md`.

## Affected users and systems

Jody; pro-dev-skillset; every repo that installs from it; `~/.claude/settings.json`.

## Constraints

Nothing merged, deployed or published by anyone but Jody.
No you-isms enter the plugin; the channel is for anyone Jody shares it with.
The version-bump law applies to every content change.

## Open questions

Which plugins beyond pro-starter's default set should be on at user scope, and which stay per repo?
