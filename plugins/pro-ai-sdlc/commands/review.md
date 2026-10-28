---
description: "Review the current diff or a PR against the repo's REVIEW.md: a bugs pass, a security pass and a compliance pass against the intent, spec and plan. Findings inform a human and never approve or block. Usage: /review [pr-number | url | branch]"
argument-hint: "[pr-number | url | branch]  (default: the current branch against its base)"
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(git diff:*), Bash(git merge-base:*), Bash(git rev-parse:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(ls:*), Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py":*), Read, Glob, Grep
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- Review policy present: !`cd "$(git rev-parse --show-toplevel)" && ls -1 REVIEW.md CLAUDE.md AGENTS.md DESIGN.md 2>/dev/null`
- Intents: !`ls -1 "$(git rev-parse --show-toplevel)/intent" 2>/dev/null | tail -10`
- Spec methods: !`python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py" --stage review`

Target: $ARGUMENTS

This is the review stage of the SDLC loop.
It reads; it changes nothing.

## Your task

### 1. Get the diff

With a PR number or URL, use `gh pr view` and `gh pr diff`.
With a branch name, diff it against its merge base with the default branch.
With no argument, diff the current branch against its merge base and add uncommitted changes.

### 2. Load the policy

Read the repo's `REVIEW.md`.
If it has none, read `${CLAUDE_PLUGIN_ROOT}/templates/REVIEW.md` and say the repo has no review policy of its own; `/pro-dev install` can add one.
Read the repo's agent file (`CLAUDE.md` or `AGENTS.md`) and `DESIGN.md` if present.
Find the brief: the `intent.md`, `spec.md` and `plan.md` the PR or branch names, else the newest folder under `intent/` the diff relates to.

### 3. Run the passes in REVIEW.md's order

Normally bugs, then security, then compliance.
Compliance compares the diff with the spec and plan and flags a departure that plan.md does not record.
For a large or risky diff, hand the passes to the `reviewer` subagent with the diff spec and the policy paths and nothing else, so its read is not anchored on yours.

### 4. Offer spec methods

If "Spec methods" in Context lists lines, offer each one once as a yes or no question.
A line reads `<method>: <when> -> <offer>`; a line with `needs <plugin>` means that method is not installed, so say so and move on.
On yes, run the offer; on no, carry on.
With nothing listed, skip this step.

### 5. Report

Rank findings most severe first.
Each one names its pass, severity (Important or nit), file and line, a one-sentence claim and a concrete failure scenario.
Respect the policy's cap on nits and its "do not report" list.
End with the tally line from the policy, for example `important: 0  nits: 2  skipped: 0`.
Do not post comments, approve, request changes or edit files.
