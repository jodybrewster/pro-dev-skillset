---
source: idea
kind: idea
status: done
risk: medium
created: 2026-10-30T09:20:44-0400
author: the maintainer
---

# Intent: required documents per project

Author: the maintainer.
Source: idea, item 14 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md) and pro-ship features 14 to 16 in the [pro-ship brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md), "Every project has its required documents".
Status: done; shipped in #103.
Created: 2026-10-30.

## Problem

Every project should have its required documentation: REVIEW.md, ARCHITECTURE.md, CLAUDE.md, README.md, PRODUCT.md, DESIGN.md and the like.
Nothing in the marketplace says which documents a project must have.
`/pro-dev install` drafts `CLAUDE.md` or `AGENTS.md` and writes `REVIEW.md` when it is missing.
That is all it does.
pro-ai-sdlc has templates for intent, spec, plan, ADR and REVIEW only, so there is none for README, ARCHITECTURE or PRODUCT.
`docs-before-push.py` in pro-quality blocks a push when code changed but an existing key document did not.
It never asks for a missing one.
`pr-check` looks for `REVIEW.md` alone and says so once.
This repo has no `ARCHITECTURE.md` or `PRODUCT.md`; `docs/overview.md` plays part of both.
The documents matter more now because machines read them.
The code-reviewer handoff carries them in its policy field, the risk classifier reads the policy block in `REVIEW.md` and `pr-check` reads them to stamp a PR.
A reviewer given an empty or stale policy reviews against nothing.
This happens in every repo that installs the starter, at install time and on every PR after it.

## Proposed outcome

Every repo with the plugins has the documents its kind of project needs, written from its code.
A PR says which are missing.
The set depends on the project.
README.md, CLAUDE.md, AGENTS.md, REVIEW.md and a `docs/decisions/` folder for ADRs are always required (the folder may start empty).
ARCHITECTURE.md is required when the project has more than one module, service or deployable.
PRODUCT.md is required when it has users.
DESIGN.md is required when it has a UI.
The marketplace has templates for the three that lack one (README, ARCHITECTURE and PRODUCT).
PRODUCT.md and DESIGN.md follow the shapes impeccable reads and writes, so the two never disagree.
`/pro-dev install` works out which rows apply from its inspection of the repo and drafts the missing documents from the code, with an angle-bracket placeholder only where the code cannot say.
`pr-check` lists the missing required documents in its deterministic stage.
The reviewer also flags a line in `CLAUDE.md` or `ARCHITECTURE.md` that the diff makes untrue.

## Affected users and systems

The maintainer and any agent session in a repo that installs the starter.
pro-core: `/pro-dev install` and its inspection.
pro-ai-sdlc: new README, ARCHITECTURE and PRODUCT templates beside `REVIEW.md` and `adr.md`.
pro-quality: `documentation-engineer`, which reads the repo to draft content.
Also `docs-before-push.py`, which sits in the same plugin.
pro-ship: `pr-check`, which reports what is missing.
The risk classifier is touched too if the required set moves into the `REVIEW.md` block.
pro-design: the impeccable bridge, whose `PRODUCT.md` and `DESIGN.md` formats the templates must match.
`code-reviewer`, which reads the documents through its policy field.
Codex parity files, manifests, the marketplace entry, routing cases and `tests/check.mjs` for each plugin touched.
Ranked item 17, the architecture review with twelve-factor, which writes into `ARCHITECTURE.md` (see Open questions).

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
Content comes from the code and never from placeholder prose.
`/pro-dev install` follows the model of `/constraints`: draft from what it can detect, ask at most four questions each with a default and never commit.
It never overwrites a document that exists; a present document is only checked.
The dependency direction in [ADR-0013](../../docs/decisions/0013-plugin-layering.md) (proposed): `pr-check` only consumes the required-set check and the templates live with the method (pro-ai-sdlc) or in the domain, not in `pro-ship`.
No pro-core dependency on a plugin that owns registry rows; the installer checks for the plugin instead.
The required set must work in a repo that has only some plugins installed, so a missing template degrades to a named gap, never a crash.
"Could not run" must never read as "nothing missing".
A missing document is Should-fix at the solo setting; a team may make it Blocking through the `REVIEW.md` block (brainstorm proposal).
The `pr-check` stamp contract in `docs/pr-check-stamp.md` changes only if a new field is needed.
Forked or adapted text keeps its footer and a row in `docs/licenses.md`.

## Out of scope

`SECURITY.md`, `CONTRIBUTING.md` and `CODEOWNERS`; those belong to `repo-hygiene` (ranked item 21).
The architecture review itself, its agent and the twelve-factor checklist (ranked item 17), except where it writes into `ARCHITECTURE.md`.
Keeping documents fresh beyond the existing `docs-before-push.py` and the reviewer flag.
Writing documents into the maintainer's other repos as part of this change; each repo gets them later by running `/pro-dev install` itself.
Making any missing-document check block in enforce mode.
A `/pro-dev update` step that refreshes existing documents, which echoes the ADR-0011 decision for `REVIEW.md`.

## Success looks like

A repo that runs `/pro-dev install` ends with every required document for its kind of project, each one filled from facts a reader can check against the code.
A PR opened in a repo that lacks one names it in the `pr-check` output with its rule.
The reviewer's policy field points at documents that exist.
The documents are short enough that a reviewer reads them whole.
Over a couple of weeks in the maintainer's repos, a drafted document needs only light edits and the "applies" test picks the right rows without correction.

## Open questions

- Whether PRODUCT.md applies to libraries and plugin repos like this one (recommendation: yes, as a short "who uses this and why", required only when the repo has users or an install base; a tool repo with none skips it).
- Whether AGENTS.md stays a full copy of `CLAUDE.md`, becomes a pointer or is a symlink (recommendation: a symlink or a pointer where the platform allows it; where a copy is kept, `pr-check` verifies the two match). The constraint-floor spec already allowed a symlink.
- How `/pro-dev install` decides ARCHITECTURE.md applies (recommendation: more than one top-level module, package or deployable found in the inspection; one question to override).
- How it decides a project has a UI or users (recommendation: a UI framework in the dependencies or a `DESIGN.md` already present; the question is skipped when the code answers).
- Where the required set lives (recommendation: a block in `REVIEW.md` beside the other dials so teams can add or remove rows, with a built-in default when the block is absent, as the classifier does for its policy).
- Who drafts the content (recommendation: `documentation-engineer` in pro-quality, called by `/pro-dev install`; with pro-quality absent, install writes the bare template and lists the sections left to fill).
- Which plugin owns the templates (recommendation: pro-ai-sdlc, beside `REVIEW.md` and `adr.md`, per the brainstorm; revisit when ADR-0013 moves the dev domain together).
- Whether the new templates are installed into the repo's own `docs/` or read in place from the plugin path, as `REVIEW.md` is (recommendation: read in place; only the drafted document lands in the repo).
- Severity of a missing document in `pr-check` before the `REVIEW.md` dials exist (recommendation: Should-fix everywhere, never a block, until ranked item 21 ships the scaling block).
- Whether this and ranked item 17 stay one intent, as the roadmap groups them as "Intent C" (recommendation: split; the architecture review is an agent, a skill and a classifier signal of its own; documents can ship first with `ARCHITECTURE.md` carrying an empty twelve-factor section header).
- Likely needs an ADR: which documents a project must have and where that set lives (`REVIEW.md` block or a separate file), since every gate and reviewer will read it and it is expensive to reverse.

## Evidence

None; this is an idea.
Sources: the "Every project has its required documents" and "The doc set (proposal)" sections of the pro-ship brainstorm.
Today's gap: `plugins/pro-ship/skills/pr-check/SKILL.md` step 3 checks `REVIEW.md` only; `plugins/pro-core/commands/pro-dev.md` drafts `CLAUDE.md` and `REVIEW.md` only; `plugins/pro-ai-sdlc/templates/` holds `adr.md`, `intent.md`, `plan.md`, `REVIEW.md` and `spec.md`; `plugins/pro-quality/templates/` holds `CONSTRAINTS.md`.
The model to copy: `plugins/pro-quality/commands/constraints.md`, which writes a document from the repo with at most four questions.
