---
description: "Write plan.md beside a spec: files that change, order of work, tests that prove it, risks, options not taken, proof of done. Interrogates the plan before it is committed. Usage: /plan [path to spec.md]"
argument-hint: "[path to spec.md]  (default: the newest spec without a plan.md)"
allowed-tools: Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git config:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(date:*), Bash(ls:*), Read, Glob, Grep, Write
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- Author: !`git config user.name`
- Now: !`date '+%Y-%m-%dT%H:%M:%S%z'`
- Specs without a plan: !`cd "$(git rev-parse --show-toplevel)" && for d in $(ls -1d intent/*/ 2>/dev/null | sort -r); do [ -f "$d/spec.md" ] && [ ! -f "$d/plan.md" ] && echo "$d"; done`

Requested spec: $ARGUMENTS

This is the third stage of the SDLC loop.
`/spec` said what will be built; the plan says how, in an order an engineer who never saw the conversation could follow.
Run it in plan mode when you can: read, do not change code.

## Your task

### 1. Pick the spec

Use the path in the arguments if given.
Otherwise take the first entry under "Specs without a plan" (the newest).
If there is none, stop and suggest `/spec`.
Read the spec, the intent beside it, the repo's agent file (`CLAUDE.md` or `AGENTS.md`) and the template at `${CLAUDE_PLUGIN_ROOT}/templates/plan.md`.
Explore the code the spec names.
Use a read-only subagent for breadth when the spec touches many files.

### 2. Draft the plan

Write `<intent dir>/plan.md` with the template's sections in its order, one sentence per line:

- Files that change: each path as new, modified or deleted, and why.
- Order of work: steps small enough to verify on their own.
- Tests that prove it: the test file and the cases it covers, or the e2e or screenshot check, for each step.
- Risks: what could break, the riskiest step, the blast radius, migrations.
- Options not taken: each alternative and why not.
- Proof of done: the exact commands and the expected output.
- Departures from plan: empty at first.

### 3. Interrogate it

Ask yourself these and write the answers into Risks, Options not taken or the order of work.

- What could this change break?
- Which step is riskiest?
- What did you choose not to do, and why?
- Which steps are file-disjoint and could run in parallel worktrees?

Architecture, security, data-model, public-API and deploy changes name an approver (a lead or architect) in the header.
Routine, small-blast-radius, well-tested work is a candidate for auto mode; say so in the plan.

### 4. Show it and commit after confirmation

Print the plan and iterate until the engineer confirms.
Then commit that one file: `git add <intent dir>/plan.md` and `git commit -m "plan: <slug>"`.
Never stage other files, never pass `--no-verify` and do not push.
Implement only after the plan is committed.
If the build departs from the plan, update Departures from plan in the same commit as the departure.

### 5. Report

The path, the commit hash, the riskiest step and the approver if one is needed.
