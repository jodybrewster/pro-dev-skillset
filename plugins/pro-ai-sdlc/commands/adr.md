---
description: "Record an architecture decision that has no change behind it: interview one question at a time, write the ADR from the template as accepted and commit it with its index row. Usage: /adr <the decision, in a sentence>"
argument-hint: "<the decision, in a sentence>"
allowed-tools: Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git config:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(date:*), Bash(ls:*), Bash(mkdir:*), Read, Glob, Grep, Write, Edit
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- Author: !`git config user.name`
- Now: !`date '+%Y-%m-%dT%H:%M:%S%z'`
- ADR folders present: !`cd "$(git rev-parse --show-toplevel)" && ls -1d docs/adr docs/decisions doc/adr adr docs/architecture/decisions decisions 2>/dev/null; true`
- Existing ADRs: !`cd "$(git rev-parse --show-toplevel)" && ls -1 docs/adr docs/decisions doc/adr adr docs/architecture/decisions decisions 2>/dev/null | tail -30`

The decision: $ARGUMENTS

This command records a decision that has no change behind it.
When a change is being built, `/spec` drafts the ADR instead and the Done sign-off accepts it.

## Your task

### 1. Interview

Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/adr.md`.
Its sections are the questions.

Rules for the interview:

- Ask one question at a time and wait for the answer.
  Skip any the decision already answers.
- Cover, in this order: the context, the options weighed, the decision, the consequences and what would reverse it.
- Quote the person where the wording matters.
  Never invent options, dates or consequences; anything unknown is left out or marked as unknown.
- Ask whether the decision replaces or retires an earlier ADR.
  If so, note its number.

If the decision is empty, ask for it first.

### 2. Find the folder and the number

Before picking a folder, look for existing ADRs in `docs/adr`, `docs/decisions`, `doc/adr`, `adr`, `docs/architecture/decisions` and `decisions`.
Match the folder, the number format (width and any prefix), the file extension and the heading and status style of the newest one.
Only when none exist, use `docs/adr/`.
Number the new ADR one above the highest existing number, or 0001 when there are none.
Name the file `<NNNN>-<slug>.md` in that format, where the slug is two to five lowercase words joined by hyphens.

### 3. Write the ADR

Write it from the template with Status `accepted`, once the person confirms the content.
Fill Date from Context, Decided by with the person's name and Source with "conversation" or the link they give.
One sentence per line.
Follow the user's writing rules if they have any: by default no em dashes, no Oxford comma and straight quotes.

Print the file and ask what is wrong.
Apply corrections and show it again until the person is satisfied.

### 4. Update the index

If the folder has a `README.md` with an index table, add a row for the new ADR in the same column layout as the existing rows.

If the ADR replaces an earlier one, change the old ADR's status line to `superseded by <NNNN>` and update its row in the index.
If the decision retires an earlier ADR with no replacement, set that ADR's status to `deprecated` with the date and update its row in the index.
Never delete an old ADR; mark it superseded or deprecated.

### 5. Commit

Commit only the new ADR, the index and, when it was replaced, the old ADR:

- `git add <the files above>`
- `git commit -m "adr: <NNNN> <slug>"`

Never stage other files, never pass `--no-verify` and do not push.
If the current branch is `main` or `master`, say so before committing, since a branch may be wanted first.

### 6. Report

The path, the commit hash and the one-line decision.

Convention check and deprecated status adapted from addyosmani/agent-skills (skills/documentation-and-adrs/SKILL.md), MIT, Copyright (c) 2025 Addy Osmani.
