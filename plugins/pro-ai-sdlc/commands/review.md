---
description: "Review the current diff or a PR against the repo's REVIEW.md: a bugs pass, a security pass and a compliance pass against the intent, spec and plan. Findings inform a human and never approve or block. Usage: /review [pr-number | url | branch] [--since <sha>]"
argument-hint: "[pr-number | url | branch] [--since <sha>]  (default: the current branch against its base)"
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(git diff:*), Bash(git merge-base:*), Bash(git rev-parse:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(ls:*), Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py":*), Read, Glob, Grep
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- Review policy present: !`cd "$(git rev-parse --show-toplevel)" && ls -1 REVIEW.md CONSTRAINTS.md CLAUDE.md AGENTS.md DESIGN.md 2>/dev/null; true`
- Intents: !`ls -1 "$(git rev-parse --show-toplevel)/intent" 2>/dev/null | tail -10`
- Spec methods: !`python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py" --stage review; true`

Target: $ARGUMENTS

This is the review stage of the SDLC loop.
It reads; it changes nothing.

## Your task

### 1. Get the diff

With a PR number or URL, use `gh pr view` and `gh pr diff`.
With a branch name, diff it against its merge base with the default branch.
With no argument, diff the current branch against its merge base and add uncommitted changes.
With `--since <sha>`, review only the range from that sha to the head, which is a second round on the same PR.
The diff spec you pass to the reviewer carries the sha.
If a second round is wanted and no earlier sha was recorded, say "no earlier sha recorded, running a full review" and review the whole diff.
Record the head sha you reviewed so the next round can pass it.

### 2. Load the policy

Read the repo's `REVIEW.md`.
If it has none, read `${CLAUDE_PLUGIN_ROOT}/templates/REVIEW.md` and say the repo has no review policy of its own; `/pro-dev install` can add one.
Read `CONSTRAINTS.md` at the repo root when "Review policy present" lists it, beside `REVIEW.md`.
Read the repo's agent file (`CLAUDE.md` or `AGENTS.md`) and `DESIGN.md` if present.
Find the brief: the `intent.md`, `spec.md` and `plan.md` the PR or branch names, else the newest folder under `intent/` the diff relates to.

### 3. Run the passes in REVIEW.md's order

Normally bugs, then security, then compliance.
Compliance compares the diff with the spec and plan and flags a departure that plan.md does not record.
For a large or risky diff, hand the passes to the `reviewer` subagent with the diff spec and the policy paths (`CONSTRAINTS.md` included when present) and nothing else, so its read is not anchored on yours.
Keep in this session the list of findings already shown for this PR or branch, each as pass, file and class or claim.
A review of a different PR or branch starts with an empty list.
A `--since` run in a new session has no list, so nothing is dropped.
Never pass that list to the reviewer.

### 4. Offer spec methods

If "Spec methods" in Context lists lines, offer each one once as a yes or no question.
A line reads `<method>: <when> -> <offer>`; a line `<method> needs <plugin>: run /pro-dev install` means that method is not installed, so say so and move on.
On yes, run the offer; on no, carry on.
With nothing listed, skip this step.

### 5. Report

Drop any new finding that matches an entry in the already-shown list and say how many you dropped, for example "2 findings dropped as already raised".
A finding matches when it names the same file and the same class or claim; when in doubt keep it.
Count the summary line after the drop.
Open with the summary line, exactly in this form:

```
important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>
```

When important and nits are both zero, follow it with "Nothing to fix."
Otherwise rank findings most severe first, under Important and then Nits.
Each one names its pass, severity (Important or nit), file and line, a one-sentence claim and a concrete failure scenario.
Group several instances of one class under a single "Class:" heading with every location.
Put Pre-existing findings in their own group, headed "Pre-existing (not blocking)", then the skipped list last.
When the reviewer subagent wrote the passes, regroup its findings under these headings.
Never count them as Important.
Respect the policy's cap on nits and its "do not report" list.
Do not post comments, approve, request changes or edit files.
