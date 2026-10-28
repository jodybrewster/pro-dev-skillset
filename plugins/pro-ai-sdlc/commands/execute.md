---
description: "Build an approved plan in its own worktree: gate the plan, branch off the default branch, copy the git-ignored env files, prove a green baseline, build test-first, fill in Done and open a pull request. Never merges. Usage: /execute <path to plan.md>"
argument-hint: "<path to plan.md>"
model: opus
allowed-tools: Bash(git fetch:*), Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git show:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(npm install:*), Bash(npm ci:*), Bash(npm run:*), Bash(npm test:*), Bash(pnpm install:*), Bash(pnpm run:*), Bash(pnpm test:*), Bash(yarn install:*), Bash(yarn run:*), Bash(yarn test:*), Bash(bun install:*), Bash(bun run:*), Bash(bun test:*), Bash(make:*), Bash(date:*), Bash(ls:*), Read, Edit, Write, Glob, Grep, Agent, EnterWorktree
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- Origin default branch: !`git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo "unknown (the gate works it out)"`
- Now: !`date '+%Y-%m-%dT%H:%M:%S%z'`

Requested plan: $ARGUMENTS

This is the build stage of the SDLC loop, between `/plan` and `/pr-babysit`.
The committed, approved plan is the gate; from there the run goes to an open pull request with no pause unless something fails.
You are the builder: build the plan in this session and dispatch subagents only when a step benefits from one.
Print one short line as each stage finishes (gate passed, worktree made, env files copied, baseline green, step N of M built, proof of done, verifier, PR opened).
Name any stage that was skipped and why.
On a stop, print the stage, the reason and what the person can do next.
pro-execution's `using-git-worktrees` and `subagent-driven-development` skills are used when installed, never required; this plugin declares no dependency on pro-execution.

## Secrets

Env files hold secrets.
`copy-env.py` copies them; you never open, read, print, echo, grep, diff, hash, stage or quote them, in the main checkout or the worktree.
Only their relative paths may appear in output, a commit message, a log line or the PR body.
If a failure looks like a missing or wrong env value, say which variable name the error mentions and stop; do not inspect the file to find out.
Command output can echo a value from an env file, such as a connection string in a database error.
Record each check in plan.md, a commit or the PR body as the command, pass or fail and its counts, never as pasted output.
Copy this section into the prompt of every subagent you dispatch.
`python3` and `node` are not pre-approved, so a one-off interpreter call asks the person first.

## Your task

### 1. Gate the plan

If no path was given, stop and ask for one; `/execute` never guesses which plan to build.
From the repo root run `git fetch origin`, then `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/execute-gate.py" <plan path>`.
On exit 1 print its reason and stop; nothing has changed yet.
On success it prints `slug`, `branch`, `intent_dir` and `default_branch`; use them below.
Read the plan in full, then the spec and intent beside it.

### 2. Make the worktree

Run `git worktree add ../<repo>.<slug> -b <branch> origin/<default_branch>`, where `<repo>` is the repo root's folder name.
The branch always starts from `origin/<default_branch>`, never from the current `HEAD`.
Then move this session into it with Claude Code's worktree tool, passing that path.
When `using-git-worktrees` is installed, follow its checks for an existing worktree first, but keep this path, branch and base.
Every later step runs in the worktree; the main checkout is never switched, stashed or written to.

### 3. Copy the env files

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/copy-env.py" <main checkout> <worktree>` and print its output as it is.
On exit 2 a copy would not be ignored in the worktree or could not be made; every copy has been removed, so print the paths it names, keep the worktree and stop.
On exit 1 the arguments were wrong: check the two paths and run it once more, then stop if it fails again.

### 4. Prove the baseline

Install dependencies with the package manager the lockfile names (`package-lock.json` npm, `pnpm-lock.yaml` pnpm, `yarn.lock` yarn, `bun.lockb` or `bun.lock` bun); with no lockfile, say so and skip.
Find the verify command: the repo's `CLAUDE.md` or `AGENTS.md`, else the `package.json` scripts `check`, `verify`, `validate` and `test`, else the Makefile targets `verify`, `check` and `test`.
Run it.
If it fails, stop before any change: print the command and the last lines of its output, keep the worktree and make no commit.

### 5. Build the plan

Follow the plan's `## Order of work` in order.
For each step write or extend the test first, see it fail, then write the code until it passes.
Commit each step, or a small group of steps, with a message that names the step.
When the build has to stray from the plan, add a line under `## Departures from plan` in plan.md in the same commit as the change that departs.
Steps the plan marks as independent may go to builder subagents in parallel when the pro-execution `subagent-driven-development` skill is available; give each a self-contained prompt and name its model and effort.
Broad code search may go to the `researcher` agent.

### 6. Prove it is done

Run every command under the plan's `## Proof of done` and keep each real result.
Dispatch the `verifier` agent in a fresh context with the plan path and name its model and effort.
Fix what it finds.
Fill in the plan's `## Done` section: the build commit, each check with its real result and one line per acceptance criterion with what was observed.
Leave Sign-off empty; it belongs to the person.
Commit plan.md.

### 7. Open the pull request

Push with `git push -u origin <branch>`.
Open the pull request with `gh pr create` against `<default_branch>`.
Its body links the intent folder, lists each acceptance criterion with its proof and names any departures.
If `gh` fails, give the compare URL for the branch instead.

### 8. Report

The PR URL, the worktree path, the checks that ran with their results and any departures.
Suggest `/pr-babysit` as the next step.

Never merge, never push to the default branch, never force-push and never pass `--no-verify`.
