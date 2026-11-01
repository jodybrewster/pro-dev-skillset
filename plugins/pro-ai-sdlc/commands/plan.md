---
description: "Write plan.md beside a spec: the files touched, the order of work, the tests that prove it, risks, rejected options and proof of done. Interrogates the plan before it is committed. Usage: /plan [path to spec.md]"
argument-hint: "[path to spec.md]  (default: the newest spec without a plan.md)"
allowed-tools: Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git config:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(date:*), Bash(ls:*), Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py":*), Read, Glob, Grep, Write
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- Author: !`git config user.name`
- Now: !`date '+%Y-%m-%dT%H:%M:%S%z'`
- Specs without a plan: !`cd "$(git rev-parse --show-toplevel)" && for d in $(ls -1d intent/*/ 2>/dev/null | sort -r); do [ -f "$d/spec.md" ] && [ ! -f "$d/plan.md" ] && echo "$d"; done; true`

Requested spec: $ARGUMENTS

This is the third stage of the SDLC loop.
`/spec` said what will be built; the plan says how, in an order that someone who missed the discussion could still follow.
Run it in plan mode when you can: read, do not change code.

## Your task

### 1. Pick the spec

Use the path in the arguments if given.
Otherwise take the first entry under "Specs without a plan" (the newest).
If there is none, stop and suggest `/spec`.
A path to `spec-<module-id>.md` writes `plan-<module-id>.md` beside it.
When the target plan file already exists, never overwrite it: stop, name the file and suggest editing it or recording a departure.
Read the spec, the intent beside it, the repo's agent file (`CLAUDE.md` or `AGENTS.md`), the template at `${CLAUDE_PLUGIN_ROOT}/templates/plan.md` and the standing definition of done at `${CLAUDE_PLUGIN_ROOT}/references/definition-of-done.md`.
Look through the code the spec points at.
Use a read-only subagent for breadth when the spec touches many files.

### 2. Draft the plan

Write `<intent dir>/plan.md` from the template, sections in its order, one sentence per line.
Cover the files touched (new, modified or deleted, with a reason), the sequence of work in separately checkable steps, the test or visual check behind each step, the risks (with the template's `Stop-list categories:` line filled in), the alternatives you rejected, the exact commands that show it is done and an empty departures section.
Size every step XS, S, M or L: XS is one file and under 30 minutes, S is one or two files and under an hour, M is up to two hours and L is more.
Aim for XS to S.
Split a step that is over two hours, carries more than three acceptance criteria, has "and" in its title or touches two or more subsystems.
These are prompts, not hard rules; a step left at L states its reason in the plan.
Mark a step `irreversible` (in its parentheses beside the size, with a few words on what cannot be undone) when it changes a data migration, a public API, an auth rule or a deploy or infrastructure config, or deletes a file other code depends on.
Name each marked step under Risks.
`/execute` doubts marked steps with a fresh-context reviewer before going on.
Put a `Checkpoint:` line after every two or three steps with the commands to run and what to confirm.
Order the riskiest steps early, after any failing test they need.
Leave the `- Definition of done:` line in `## Done` for the build to fill.

### 3. Question it

Before showing it, answer these and fold the answers into the plan.

- What might this break?
- Which step is the most likely to go wrong?
- What was left out on purpose, and what is the reason?
- Which steps touch separate files and could run in parallel worktrees?

Then run three checks before the plan is shown.

- Coverage: every requirement and acceptance criterion in the spec maps to at least one step; an unmapped one gets a step or a stated reason.
- Placeholders: no angle-bracket field, TBD, TODO or "fill in" is left outside `## Done` and `## Departures from plan`.
- Names: each file, function, flag and heading is spelled the same in every step that uses it.

A change to architecture, security, data, a public API or a deploy names an approver (a lead or architect) in the header.
Routine work with a small blast radius and good test coverage can say it suits auto mode.

### 4. Offer spec methods

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py" --stage plan --target <plan.md path>`.
Offer each printed line once as a yes or no question.
A line reads `<method>: <when> -> <offer>`; a line with `needs <plugin>` means that method is not installed, so say so and move on.
On no, or with nothing printed, go straight to the next step, so the command runs as it always has.

After a goldfish review, keep the fixes EGM applied to the draft.
For each Blocker or Major finding still open, write one line of your own under Risks in your words with no quoted file content; show those lines before committing.
The review writes `goldfish_review_report.md` in the working directory; leave it untracked and name its path in the report.

### 5. Show it and commit after confirmation

Print the plan and iterate until the engineer confirms.
Then commit that one file: `git add <intent dir>/plan.md` and `git commit -m "plan: <slug>"`.
Never stage other files, never pass `--no-verify` and do not push.
Check `git status` that nothing else got staged.
Implement only after the plan is committed.
When the build strays from the plan, record that under Departures in the same commit as the change.

### 6. Report

The path, the commit hash, the riskiest step and the approver if one is needed.

Sizes, split triggers, checkpoints and self-review adapted from agent-skills (skills/planning-and-task-breakdown/SKILL.md), MIT, Copyright (c) 2025 Addy Osmani.
