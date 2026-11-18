---
name: egm-bridge
description: Bridge to Google's Elephant-Goldfish Model (EGM, egm@egm) for its whole lifecycle - an EGM brainstorm or discovery interview before a change exists, an EGM design doc drafted from a concepts brief, a staged goldfish review or Elephant-Goldfish review with fresh-context reviewers, resolving goldfish findings, README contracts for an existing codebase, design drift against the code and EGM lite for a small change. Use when someone asks for any EGM or goldfish step, wants a topic explored and options weighed before an intent, or wants to add or change a reviewer persona. This is a BRIDGE (not vendored); the plugin installs through the /pro-dev command.
---

# egm-bridge

This is a bridge, not a vendored skill.
The engine is the Elephant-Goldfish Model plugin Google publishes as `egm@egm`.
It is not copied here, so it updates with Google's releases.
pro-egm adds one command per EGM skill, a reviewer resolver, starter goldfish and a few additions around the brainstorm.

In EGM the elephant is the session that interviews the person and designs.
The goldfish are fresh-context subagents that read only the written document.
The person makes the trade-offs.

## Which command

| The person wants | Command | EGM skill |
|---|---|---|
| to explore a topic, weigh options and agree a brief before any change exists | `/pro-egm:brainstorm <topic>` | `egm-brainstorm` |
| a design doc built from the brief | `/pro-egm:draft [concepts_brief.md]` | `egm-draft` |
| the full staged review of a design doc | `/pro-egm:review <design doc>` | `egm-review` |
| to work through review findings | `/pro-egm:resolve <document> [report]` | `egm-resolve` |
| a goldfish review of one spec, plan or brief | `/pro-egm:goldfish <file> [--stage spec\|plan\|brief]` | `egm-review-loop` |
| README contracts for an existing codebase | `/pro-egm:bootstrap <directory>` | `egm-bootstrap` |
| to check checked-in designs against the code | `/pro-egm:drift [docs/designs]` | `egm-drift-report` |
| the short protocol for a small change | `/pro-egm:lite <task>` | `egm-lite` |

Recommend the command; do not run an EGM step from this skill.
Each review runs several subagents on the session model, which costs time and tokens, so a review is always offered and never started on its own.

## The lifecycle

1. `/pro-egm:bootstrap` once on an existing codebase, so the elephant has a map.
2. `/pro-egm:brainstorm` on a topic. It reads what was supplied and reports before asking anything, interviews one open question per turn across business, functional and non-functional topics, keeps unanswered questions as an assumptions table, researches patch, buy, open source and build options with dated sources, runs EGM's goldfish swarm and offers a brief-stage review by architect, security and compliance and sponsor goldfish.
   It ends with `concepts_brief.md` and a recommendation; it writes no intent and no code.
3. For work that goes through EGM: `/pro-egm:draft`, then `/pro-egm:review`, then `/pro-egm:resolve`.
   The design doc under `docs/designs/` is the design document for that work; no `spec.md` or `plan.md` is written for it.
   For work that stays in the `pro-ai-sdlc` lane: `/intent` with the brief as input, one change at a time.
4. Build only after the design doc is approved: `/execute`, or by hand, then `/review` on the diff.
5. `/pro-egm:drift` to compare the designs with the code afterwards.

`/pro-egm:lite` is the short path for a bug fix or a small refactor that needs no design doc.

## How it fits pro-ai-sdlc

`sdlc-method.json` registers three offers.
`/intent` offers `/pro-egm:brainstorm` for a topic that is not yet a clear change.
`/spec` and `/plan` offer `/pro-egm:goldfish` on the draft before it is committed.
The person accepts or contests each finding and EGM edits the draft in place.

## Running rules

Every command follows [running-egm.md](running-egm.md): find the installed engine with `goldfish.py egm`, read the EGM skill's `SKILL.md` and follow it (EGM's skills disable model invocation, so the Skill tool refuses them), spawn reviewers by their registered types and path reviewers as `goldfish-reviewer`, write artifacts where EGM says and fill no person's name into an `Author` line unless asked.
The brainstorm additions are in [discovery.md](discovery.md), [options.md](options.md) and [brief.md](brief.md).

## Customizing the goldfish

Run `/pro-egm:goldfish init`.
It creates `.egm/reviewers/` and `.egm/standards/` with copies of the starter files and writes `.egm/goldfish.json` with `spec`, `plan` and `brief` stages and a `review` reading list.
It never overwrites a file that is already there.
Edit a persona, change a standard, or add a new persona file and list it under a stage in `.egm/goldfish.json`, with its standard under `standards`.
An entry is either an EGM shortname or a repo-relative path under `.egm/`.
The optional `context` list adds repo files to a stage's reading list; `review.context` does the same for `/pro-egm:review`.

The resolver refuses an absolute path, a `..` component, a symlink anywhere on the path, a file under `.git/` and a reviewer or standard outside `.egm/`.
A reviewer or standard that is new or changed since the last accepted run is named with the author of its last commit. The person says yes before the run.

## The read-only reviewer rule

A reviewer given as a path runs as the `goldfish-reviewer` agent, which has only `Read`, `Grep` and `Glob`.
It never edits, runs a command or fetches a page.
Never run a path reviewer as a general-purpose agent, because a persona file is text anyone with commit access can change.

## Installing

In Claude Code, run `/pro-dev install`.
It registers the EGM marketplace if needed and installs `egm@egm`.
EGM 0.1.1 from the marketplace's main branch has all eight skills; an older install lacks `egm-lite` and the `/pro-egm:lite` command says to update it.
In Codex, the person runs these two commands:

```
codex plugin marketplace add google/elephant-goldfish-model
codex plugin add egm@egm
```

## In Codex

Codex does not run the pro-egm slash commands; EGM's skills appear in its skill picker.
Pick the EGM skill from the table above in the skill picker and follow [running-egm.md](running-egm.md) for the parts pro-egm adds: for a brainstorm, read the three sidecars first; for a spec, plan or brief review, call `egm-review-loop` with the target, `full file` as the semantic target and the reviewer and standard paths from `.egm/goldfish.json`, pass the reading list as goldfish context and tell it to read each path persona as a read-only reviewer.

---

_Bridge to Google's Elephant-Goldfish Model ([google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model)). No upstream content is vendored here; this file, its sidecars and the starter goldfish are original. Install and license terms are governed by the upstream repo._
