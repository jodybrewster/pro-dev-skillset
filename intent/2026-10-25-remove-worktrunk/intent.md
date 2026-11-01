---
source: idea
kind: change
status: accepted
risk: low
created: 2026-10-25T09:30:00-04:00
author: the maintainer
---

# Intent: remove worktrunk from the stack

## Problem

Worktrunk (`wt`) was the stack's tool for creating a worktree per task and spawning a tmux-backed agent in each.
Herdr now does both: `/intent` already calls `herdr worktree create`, `herdr agent start` launches the agent and the sidebar shows its state, which `wt` never did.
Inside a session, `using-git-worktrees` tells Claude to prefer the harness's native worktree tool.
`wt` does not appear in the shell history on the one machine that uses this stack.

What is left of worktrunk is cost without use: a `/worktrunk` command in pro-execution that assumes tmux, a `wt` route in the using-pro-dev router, a prerequisite and two table rows in README, a `worktrunk` entry in the marketplace's cross-marketplace allowlist and an install block in `templates/install-companions.sh` that skips worktrunk unless its marketplace is already registered, which `brew install worktrunk` never does.
That last one is a known silent failure on a fresh machine.

## Proposed outcome

The marketplace has no reference to worktrunk as a tool to install or a skill to route to.
Parallel work routes to `using-git-worktrees` alone.
`install-companions.sh` installs the three `claude-plugins-official` companions and nothing else.
Historical mentions (CLAUDE.md's "things Claude gets wrong", `docs/troubleshooting.md`, the comment in `tests/check.mjs`, past intents) stay, because they record why the `*` cross-marketplace check exists.

## Affected users and systems

pro-execution (command removed, minor bump to 0.4.0), pro-core (router edit, patch bump to 0.15.3), the marketplace manifest, README and the companions script.
Anyone who ran `/worktrunk`; nobody does.

## Constraints

Version-bump law: both pro-execution manifests, both pro-core manifests, the marketplace entries and `metadata.version` bump in this change.
Keep the `using-git-worktrees` skill; it is harness-neutral.

## Out of scope

Uninstalling the `worktrunk@worktrunk` plugin, its marketplace and the Homebrew formula from the developer's machine; that happens by hand after merge.
Trimming pro-starter's dependency list to a stack-agnostic set; separate intent.

## Success looks like

`grep -rn -iE 'worktrunk|\bwt\b' plugins templates README.md .claude-plugin` returns nothing.
`node tests/check.mjs && node tests/eval.mjs --dry` pass.
`claude plugin validate . --strict` and the per-plugin loop pass.
