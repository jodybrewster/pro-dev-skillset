---
description: "Set a repo up for the SDLC loop: inspect it, draft the 'How work flows here' block for its agent file, create intent/ and add REVIEW.md from the template if missing. Leaves every change uncommitted for you to review. Usage: /sdlc-init"
argument-hint: ""
allowed-tools: Bash(git rev-parse:*), Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(git ls-files:*), Bash(ls:*), Bash(mkdir:*), Read, Glob, Grep, Write, Edit
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Working tree: !`git status --short --branch`
- Top level: !`ls -1 "$(git rev-parse --show-toplevel)" 2>/dev/null | head -60`
- Agent files and policies: !`cd "$(git rev-parse --show-toplevel)" && ls -1 CLAUDE.md AGENTS.md REVIEW.md DESIGN.md SECURITY.md intent plans specs 2>/dev/null`

This command prepares a repo for the loop that `/intent`, `/spec`, `/plan`, `/review` and `/pr-babysit` run.
It writes files and stops.
It never commits, stages, pushes or opens a PR; the person reviews the changes and commits them.

## Your task

### 1. Inspect the repo

Find the stack, the verify command (from the agent file, then `package.json` scripts `check`, `verify`, `validate`, `test`, then Makefile targets, then the language default), the test directories and the generated or protected paths.
Read the agent file if there is one.
Do not read `.env` files.

### 2. Draft the agent file

The target shape is the reference architecture at `ai-sdlc-kit-sample-repo`, a checkout kept beside this one if present, with one departure: `intent/<date>-<slug>/{intent,spec,plan}.md` in one folder instead of flat `specs/` and `plans/`.
If that checkout is not present, use the shape described here.

Write into `CLAUDE.md`, or `AGENTS.md` if that is the repo's file.
If neither exists, create `CLAUDE.md` with the sections below, filled from step 1 and kept under one page.
If the file exists, add only the sections that are missing, change nothing already there and report what differs.

Sections, in this order: Commands (build, test, lint, a single test, e2e if any, each with its healthy output), Verifying your work (run build, test and lint before reporting done and paste the output; fix the code, not the test), Conventions, Architecture (including "Lifecycle artifacts: intent, then spec, then plan, then PR, see REVIEW.md"), How work flows here and Things Claude gets wrong.
Leave a placeholder in angle brackets for anything step 1 could not find.

The "How work flows here" section says, in short sentences, one per line:

The section says, in short sentences, one per line:

- Work enters through `intent/<date>-<slug>/intent.md`, written by `/intent`.
- `/spec` writes spec.md beside it, `/plan` writes plan.md, and plan.md is committed before the first change and kept true afterwards.
- The verify command, named exactly, runs before anything is called done.
- For a bug, the failing test is committed before the fix and tests are not edited during the fix.
- `/review` checks the diff against REVIEW.md; findings go to the person and are never a verdict.
- The person merges.
  Agents work up to the gate (branch, PR, green checks, addressed findings) and stop there.
- A "Things Claude gets wrong" list, empty to start, that a mistake flagged twice is added to.

### 3. Create the folders and the review policy

- Create `intent/` with a short `README.md` that says what an intent folder holds (intent.md, spec.md, plan.md), unless `intent/` exists.
- If the repo has no `REVIEW.md`, write one from `${CLAUDE_PLUGIN_ROOT}/templates/REVIEW.md`, replacing the generated-files placeholder with the paths you found in step 1.
  If it has one, leave it alone.
- If `.claude/settings.json` does not exist, write team settings: `permissions.allow` for the read-only git commands and the repo's build, test and lint commands, and `permissions.deny` for reading `.env`, `.env.*` and `secrets/` and for forced git pushes.
  If it exists, show the entries to merge and do not edit it.
  The guard hooks are not written here; the plugin supplies them.
- Make sure `.gitignore` ignores `.claude/settings.local.json`, `.claude/worktrees/` and `.claude/.fix-task`; append only the missing lines.

### 4. Report

List each file created or changed with its path, and each thing you left alone because it existed.
Give the verify command you found, or say none was found and ask for it.
Remind the person that nothing is committed.
