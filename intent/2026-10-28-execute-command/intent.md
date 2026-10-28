---
source: idea
kind: change
status: proposed
risk: medium
created: 2026-10-28T08:10:00-0400
author: Jody Brewster
---

# Intent: /execute builds an approved plan in its own worktree

Author: Jody Brewster (pro-dev-skillset).
Source: idea, intent F of the [pro-dev simplify umbrella](../2026-10-27-pro-dev-simplify/intent.md), from planning intent A on 2026-10-28.
Status: proposed.
Created: 2026-10-28.

## Problem

pro-ai-sdlc's loop has a command for every stage except the build.
After `/plan` is committed, the person has to make a worktree, copy the env files the app needs, install dependencies and then tell a session to build from the plan.
Each step is easy to get wrong: a worktree off a stale `main`, a missing `.env` that makes the baseline tests fail, or a build that drifts from the plan.
Jody: "can we create a slash command called execute in ai-sdlc that can take a plan, create a new worktree, copy the env files if there are any and based on a plan file when you pass the path in an argument."

## Proposed outcome

`/execute <path to plan.md>` in pro-ai-sdlc:

1. Checks the plan is committed and approved, and stops if it is not.
2. Fetches and creates a worktree on a new branch named from the intent's slug, based on the current `origin/main`.
3. Copies the env files the main checkout has that git ignores (`.env`, `.env.local`, `.env.*` and the same in subfolders), never tracked files such as `.env.example`, and never prints their contents.
4. Installs dependencies and runs the baseline tests, and stops if the baseline is red before any change.
5. Builds the plan's steps in order, test-first, recording any departure in the plan's Departures section with the change that departs.
6. Runs the plan's proof-of-done commands and the `verifier` agent, fills in the plan's Done section and opens a pull request that links the intent folder.
7. Stops at the pull request; it never merges, and `/pr-babysit` takes it from there.

## Affected users and systems

Anyone using pro-ai-sdlc: a new `commands/execute.md`, the plugin README, the loop description in `intent/README.md` and routing cases.
pro-execution's `using-git-worktrees` and `subagent-driven-development` skills, which `/execute` should reuse when installed rather than duplicate.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`; the command prose stays harness-neutral.
pro-ai-sdlc's existing hooks stay in force inside the worktree: `protect-tests`, `production-gate` and `plan-sync`.
Env files hold secrets: they are copied only into a worktree of the same repo on the same machine, they must stay ignored there, and no command, log, commit or PR body may contain their values.

## Out of scope

Merging, release and deploy.
Running `/execute` from CI or a `build` label (a later intent if wanted).
Chaining `/spec`, `/plan` and `/execute` into one command (the `/ship` idea), which can build on this.

## Success looks like

Running `/execute intent/2026-10-28-quiet-validation-hook/plan.md` in this repo produces a worktree with the right branch, a green baseline, the built change with its tests, a filled-in Done section and an open pull request, with no manual steps between the command and the PR.
In an app repo with a `.env.local`, the worktree's dev server and tests run without the person copying anything.

## Open questions

- Worktree location: a sibling folder such as `../<repo>.<slug>` (this repo's habit) or the harness's own worktree tool, which `using-git-worktrees` prefers so the session can follow the worktree.
- Which env file names count beyond `.env*`, for example `.dev.vars` or `config/*.local.*`.
- Should it pause for approval after the baseline and before building, or only stop on failure?
- Whether it builds in the current session or dispatches subagents per step when pro-execution is installed.
- Security challenge for the spec: copying secrets into a new working tree, and making sure the worktree's ignore rules still cover them.
