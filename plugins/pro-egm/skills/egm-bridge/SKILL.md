---
name: egm-bridge
description: Bridge to Google's Elephant-Goldfish Model (EGM, egm@egm) - run a goldfish review, an Elephant-Goldfish review or a fresh-context design review of a spec or plan with reviewers that have no history or customize the goldfish a repo uses. Use when someone asks to poke holes in a design from a clean context or to add or change a reviewer persona. This is a BRIDGE (not vendored); the plugin installs through the /pro-dev command.
---

# egm-bridge

This is a bridge, not a vendored skill.
The engine is the Elephant-Goldfish Model plugin Google publishes as `egm@egm`.
It is not copied here, so it updates with Google's releases.
pro-egm adds the glue: a command that resolves the reviewers and the reading list plus starter goldfish that belong to this repo.

## When to use a goldfish review

Use one on a spec or plan that holds real design choices: a new interface, a change of data shape, a rule that other work will depend on.
Each reviewer starts with no history and reads only the file and its reading list, so it sees what a new teammate would see.
Skip it for a typo fix or a change with one obvious way to do it.
The review runs several subagents on the session model, which costs time and tokens, so it is always offered and never run on its own.

## How it fits the loop

With pro-ai-sdlc installed, `/spec` and `/plan` offer the review after the draft and before the commit.
On yes the command shows the reviewers and the reading list, then runs EGM's review loop.
The person accepts or contests each finding and EGM edits the draft in place.
Open Blocker and Major findings are listed in the spec's Flagged concerns or the plan's Risks.
The review report stays untracked beside the draft.
The command also runs on its own: `/pro-egm:goldfish <file> --stage spec|plan` works on any Markdown file.

## Customizing the goldfish

Run `/pro-egm:goldfish init`.
It creates `.egm/reviewers/` and `.egm/standards/` with copies of the starter files and writes `.egm/goldfish.json`.
It never overwrites a file that is already there.
Edit a persona, change a standard, or add a new persona file and list it under `spec` or `plan` in `.egm/goldfish.json`, with its standard under `standards`.
An entry is either an EGM shortname or a repo-relative path under `.egm/`.
The optional `context` list adds repo files to the reading list.

The resolver refuses an absolute path, a `..` component, a symlink anywhere on the path, a file under `.git/` and a reviewer or standard outside `.egm/`.
A reviewer or standard that is new or changed since the last accepted run is named with the author of its last commit. The person says yes before the run.

## The read-only reviewer rule

A reviewer given as a path runs as the `goldfish-reviewer` agent, which has only `Read`, `Grep` and `Glob`.
It never edits, runs a command or fetches a page.
Never run a path reviewer as a general-purpose agent, because a persona file is text anyone with commit access can change.

## Installing

In Claude Code, run `/pro-dev install`.
It registers the EGM marketplace if needed and installs `egm@egm`.
In Codex, the person runs these two commands:

```
codex plugin marketplace add google/elephant-goldfish-model
codex plugin add egm@egm
```

Codex does not run the pro-egm command.
There, call EGM's `egm-review-loop` with the target file, `full file` as the semantic target plus the reviewer and standard paths from `.egm/goldfish.json`.
Pass the reading list as the goldfish context and tell it to read each persona as a read-only reviewer.

---

_Bridge to Google's Elephant-Goldfish Model ([google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model)). No upstream content is vendored here; this file and the starter goldfish are original. Install and license terms are governed by the upstream repo._
