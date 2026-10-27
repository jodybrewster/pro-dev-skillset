---
description: "Write spec.md beside an intent, check it against the repo's design, review and security policies and commit it. Usage: /spec [path to intent.md]"
argument-hint: "[path to intent.md]  (default: the newest intent without a spec.md)"
allowed-tools: Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git config:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(date:*), Bash(ls:*), Read, Glob, Grep, Write, Edit
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- Author: !`git config user.name`
- Now: !`date '+%Y-%m-%dT%H:%M:%S%z'`
- Intents without a spec: !`cd "$(git rev-parse --show-toplevel)" && for d in $(ls -1d intent/*/ 2>/dev/null | sort -r); do [ -f "$d/intent.md" ] && [ ! -f "$d/spec.md" ] && echo "$d"; done`
- Policy files present: !`cd "$(git rev-parse --show-toplevel)" && ls -1 DESIGN.md REVIEW.md CLAUDE.md AGENTS.md SECURITY.md docs/adr docs/decisions .claude/skills 2>/dev/null`

Requested intent: $ARGUMENTS

This is the second stage of the SDLC loop.
`/intent` wrote what and why; the spec says what will be built, checked against the repo's own rules before any code exists.

## Your task

### 1. Pick the intent

Use the path in the arguments if given.
Otherwise take the first entry under "Intents without a spec" (the newest).
If there is none, stop and suggest `/intent`.
Read the intent in full.
If its `status` is still `draft`, say so and carry on; the spec records the status it was written against.

### 2. Load the policy sources

Read whichever of these exist:

- `DESIGN.md` and any design-system docs it links.
- `REVIEW.md`.
- `CLAUDE.md` and `AGENTS.md` at the root, plus any nested ones in directories the intent touches.
- `SECURITY.md` and ADRs under `docs/adr/` or `docs/decisions/`.
- Skills under `.claude/skills/` whose name or description mentions compliance, security, privacy or design.
- Any installed security plugin skill such as `pro-security`.

Read enough of the code the intent touches to ground the design in what exists.

### 3. Write spec.md beside the intent

Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/spec.md` and write `<intent dir>/spec.md` from it, one sentence per line.
List the policy files and skills you loaded under "Skills and policies in force".
Every requirement is testable and traces to a line of the intent.
Flagged concerns is mandatory: write one row per conflict between the intent or design and a policy, or "None found" with the sources checked.
Never settle a flagged concern on your own; show it to the person.
Bring each open question from the intent across, answered or still open.
Follow the user's writing rules if they have any: by default no em dashes, no Oxford comma and straight quotes.

### 4. Draft the ADR when one is needed

The spec's Flagged concerns section ends with an `ADR needed:` line, `yes` or `no` with a one-line reason.
It is `yes` when the change sets a rule other work must follow or would be expensive to reverse.
A `Likely needs an ADR` line in the intent's Open questions carries into this decision.

When the answer is no, skip to the commit.
When it is yes:

- Ask only what the ADR still lacks beyond the spec: at most what would make the person reverse the decision and what must stay true afterwards.
  One question at a time.
- Find the folder: `docs/adr/` if it exists, else `docs/decisions/` if it exists, else create `docs/adr/`.
- Number the ADR one above the highest existing number in that folder, zero-padded to four digits, or 0001 when there are none.
- Write `<NNNN>-<slug>.md` from `${CLAUDE_PLUGIN_ROOT}/templates/adr.md` with Status `proposed` and Source set to the intent folder.
  Follow the folder's existing ADRs for style when they differ from the template.
- If the folder has a `README.md` with an index table, add a row for it.
- Link the ADR from the spec's Flagged concerns section.

The Done sign-off in plan.md moves the ADR from `proposed` to `accepted`.

### 5. Commit

- `git add <intent dir>/spec.md`, and when step 4 wrote an ADR, that file and the index too, so they land in the same commit.
- `git commit -m "spec: <slug>"`, where the slug is the intent directory name without its date prefix.

Never stage other files, never pass `--no-verify` and do not push.

### 6. Report

The path, the commit hash, the number of requirements, the ADR path when one was drafted, each flagged concern in one line and the open questions that block planning.
Suggest `/plan <intent dir>/spec.md` as the next step.
