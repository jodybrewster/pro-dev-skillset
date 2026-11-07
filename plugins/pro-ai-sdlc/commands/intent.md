---
description: "Brainstorm an idea or bug until it is concrete, then write and commit intent/<date>-<slug>/intent.md from the shared intent template. Usage: /intent <idea or bug, in a sentence or two>"
argument-hint: "<idea or bug, in a sentence or two>"
allowed-tools: Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git config:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(date:*), Bash(ls:*), Bash(mkdir:*), Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py":*), Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/factory.py" level:*), Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/ids.py" next), Read, Write
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1`
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- Author: !`git config user.name`
- Now: !`date '+%Y-%m-%dT%H:%M:%S%z'`
- Existing intents: !`ls -1 "$(git rev-parse --show-toplevel)/intent" 2>/dev/null | tail -20`
- Spec methods: !`python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py" --stage intent; true`

The idea: $ARGUMENTS

This is the first stage of the SDLC loop.
The intent file is the artifact `/spec` reads next.
It says what and why, never how.

## Your task

### 0. Offer spec methods

If "Spec methods" in Context lists lines, offer each one once as a yes or no question.
A line reads `<method>: <when> -> <offer>`; a line `<method> needs <plugin>: run /pro-dev install` means that method is not installed, so say so and move on.
On yes, run the offer and stop; on no, carry on.
With nothing listed, skip this step.

### 1. Interview like an analyst

Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/intent.md`.
Its sections are the questions.

Rules for the interview:

- Let the person describe the problem in their own words.
  Do not reframe it into solution language.
- Ask one question at a time and wait for the answer.
  Skip any the idea already answers.
- Keep going until each section is concrete: problem, proposed outcome, affected users and systems, constraints, out of scope, success looks like, open questions and evidence.
- Do not design the solution.
  Record approaches only as open questions or constraints.
- Kind (bug, idea or change) and risk (low, medium or high) go in the frontmatter; ask if they are not clear.
- Breaking goes in the frontmatter too.
  For `idea` or `change`, ask once whether anyone relying on today's behaviour would have to change; the size of the change does not matter.
  For `bug`, write `breaking: false` unless the person says otherwise.
- For a ticket or an incident, record the source ID in Source and link the evidence under Evidence.
- Anything still unknown goes under Open questions rather than being guessed.
  Never invent numbers or users.
- Watch for an idea that is large or spans more than one shippable change.
  Offer once to split it into separate intents, and when the person agrees write one folder each.
- When the idea sets a rule other work must follow or would be expensive to reverse, record `Likely needs an ADR: <the decision at stake>` under Open questions.
  Do not write the ADR here; `/spec` drafts it once the options are weighed.

If the idea is empty, ask for it first.

### 2. Write the file

Pick a slug of two to five lowercase words joined by hyphens.
Then name the folder, called `<folder>` below:

- When `intent/project.json` exists at the repo root, run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/ids.py" next`.
  It prints the change id (for example `PDS-51`) and one line on stderr saying where the number came from or that it was allocated offline from the last fetch; repeat that line to the person.
  `<folder>` is `<id>-<slug>` and the file gets `id: <id>` as its first frontmatter key.
  If it exits 1, show its message and stop: the shortcode in `intent/project.json` is fixed before any id is allocated.
- Otherwise `<folder>` is `<YYYY-MM-DD>-<slug>` with today's date and the template's `id:` line is deleted.
  Tell the person in one line that `/pro-dev install` sets a shortcode so new changes get an id.

Write `<repo root>/intent/<folder>/intent.md` (with no shortcode that is `<repo root>/intent/<YYYY-MM-DD>-<slug>/intent.md`) with the template's frontmatter and sections, one sentence per line.
If that directory already exists, choose another slug and keep the id it was given; an id is never reused.
Fill Author and Created from Context and set Status to draft.
Quote the person where the wording matters.
Keep the template's section names and order exactly, so tools that read the file find each field.
Follow the user's writing rules if they have any: by default no em dashes, no Oxford comma and straight quotes.

### Level (before the commit)

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/factory.py" level <dir> --write`, where `<dir>` is the intent folder.
Report the level and its reasons in one line.
If it exits 3 the level was raised in the file: the commit below includes that file.
The level is only ever raised; never edit it down by hand.

### 3. Read it back and commit

Print the whole file and ask what is wrong.
Apply corrections and show it again until the person is satisfied.

Then commit that one file on the current branch:

- `git add intent/<folder>/intent.md`
- `git commit -m "intent: <slug>"`

The person accepts the intent in person, so no PR is opened for acceptance.
Never stage other files, never pass `--no-verify` and do not push.
If the current branch is `main` or `master`, say so before committing, since a branch may be wanted first.

### 4. Report

The path, the commit hash and one line suggesting `/spec intent/<folder>/intent.md` as the next step.
