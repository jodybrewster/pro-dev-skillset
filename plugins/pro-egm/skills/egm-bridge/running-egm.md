# Running an EGM skill through pro-egm

Every `/pro-egm:<step>` command follows these rules.
They apply in Codex too, where the person names the step and the agent follows this file by hand.

## Find the engine

Run `python3 "<pro-egm root>/scripts/goldfish.py" egm`.
It prints `egmRoot` and `skills`, a map from each EGM skill name to its `SKILL.md` or null.
The engine is always the installed `egm@egm` plugin it reports.
Never read EGM from a source checkout, another installed copy or a guessed cache folder.

- `egmRoot` is null: print `pro-egm needs egm@egm: run /pro-core:pro-dev install` and stop.
- `egmRoot` is set but the skill you need is null: the install is older than the skill.
  Print `pro-egm needs a newer egm@egm: update egm@egm (claude plugin marketplace update egm, then claude plugin update egm@egm) or run /pro-core:pro-dev update` and stop.

## Follow the skill

Every EGM skill sets `disable-model-invocation`, so the Skill tool refuses it.
Read the skill's `SKILL.md` and follow it in this session, as EGM's own Claude guide says.
Never call an EGM skill through the Skill tool.

The skill was not loaded as a plugin skill, so `${CLAUDE_PLUGIN_ROOT}` inside it was not filled in.
Read it as `egmRoot`.
A path the skill gives under `agents/`, `resources/` or `docs/` is under `egmRoot`; a path under `references/` is under the skill's own folder.
Read `<egmRoot>/docs/claude.md` first, as the skill asks.
When the skill hands off to another EGM skill (for example `egm-review` to `egm-review-loop` or `egm-resolve`), read that skill's `SKILL.md` from the same `skills` map and follow it the same way.

## Subagents

A goldfish is a fresh-context subagent.
If this session cannot spawn subagents, stop and say so: a review in the same context is not a goldfish review.
An EGM reviewer given by shortname spawns its registered type, for example `egm:egm-zoom-out`.
A reviewer given as a path spawns `pro-egm:goldfish-reviewer` with the persona path and the standard path.
Never spawn a general-purpose agent for a reviewer.
Pass each reviewer only the task, the target, its persona and standard paths and the reading list; never the conversation.
Prefer direct dispatch from this session over the synthesizer when a stage has path reviewers.

## Artifacts

EGM writes its artifacts to the working directory unless `CLAUDE.md` or `AGENTS.md` has a line `EGM artifact directory: <path>`.
Follow that rule as EGM states it.

| Artifact | Where | Committed |
|---|---|---|
| `concepts_brief.md` | working directory, then `docs/designs/<feature>-brief.md` once the person accepts it | yes, the published copy |
| `design_draft.md` | working directory | no |
| the finished design doc | `docs/designs/<feature>.md` (EGM's default) | yes |
| review reports (`*_report.md`) | working directory | no |
| `<YYYY-MM-DD>_DRIFT_REPORT.md` | working directory | no |
| `egm_lite_checklist.md`, `egm_lite_alternatives.md` | working directory | no |
| README contracts from bootstrap | beside the code they describe | yes, after the person reviews them |

pro-egm never commits, pushes or opens a pull request.
It names what it wrote and which files are meant to be committed.

## Names

EGM fills an `Author` line in the brief and the design doc from `git config user.name`.
Do not read the git config for it.
Write `Author: the maintainer` unless the person gives the name or handle to use in this session.
Name no client, customer or other person in an artifact unless the person asks for it.

## Design before code

When EGM is the method for a piece of work, its design doc under `docs/designs/` is the design document.
`spec.md` and `plan.md` are not written for that work.
No code is written before that design doc is approved, except a read-only script that measures an existing system.
`/pro-egm:lite` is the exception for small changes: its own checklist and approval gate come before any edit.
