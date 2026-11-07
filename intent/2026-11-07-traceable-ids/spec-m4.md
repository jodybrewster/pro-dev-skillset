---
id: PDS-50
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T13:56:55-0500
author: the maintainer
module: m4
---

# Spec m4: the id in docs

Built from `intent.md` in this folder (commit 1242860), module m4 of [capability-map.md](./capability-map.md).
Status: draft.
Depends on m1: the ids come from the backfill mapping in [spec-m1.md](./spec-m1.md).
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `docs/decisions/README.md`, ADR-0002, ADR-0005, ADR-0026 (proposed), `docs/roadmap.md`, `intent/README.md`, `plugins/pro-ai-sdlc/commands/adr.md`, `plugins/pro-ai-sdlc/templates/adr.md`.

## Summary

The roadmap and the decision log name a change by its id as well as its folder.
Every roadmap row that links an intent and every ADR whose Source is an intent folder carry the id; a new ADR from `/adr` or `/spec` writes it.
The convention is written once in the roadmap, `intent/README.md` and the agent files; the `change-ids` check keeps it true.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. The ids are the ones m1's backfill wrote; no id is assigned here.
2. Folder names and every existing link stay; the id is added beside the link, never in place of it.
3. ADRs keep their own numbering; the id appears only on the Source line.

## Requirements

### Functional

- R1. `docs/roadmap.md` states the convention under its opening lines: an intent named in a table row or a "Now" item carries its id before its link, for example `PDS-30 [sdlc-loop-upgrades](../intent/2026-10-30-sdlc-loop-upgrades/intent.md)` (intent: "the roadmap row and any ADR the change produced").
- R2. Every table row in `docs/roadmap.md` that links `../intent/<folder>/intent.md` for a folder with an `id:` names that id in the same cell.
- R3. Every ADR under `docs/decisions/` whose `Source:` line names an intent folder with an `id:` names the id first: `Source: PDS-41, intent/2026-11-03-software-factory/.`; the rest of the line is kept.
- R4. `plugins/pro-ai-sdlc/templates/adr.md` reads `Source: <change id and intent folder when a change produced it, else the commit or conversation>`.
- R5. `/adr` fills Source with the change id and intent folder when the person names a change that has an id; otherwise it fills the commit or "conversation" as today.
- R6. `/spec` step 5 writes the drafted ADR's Source as the intent's id and folder when the intent has an id.
- R7. `checks["change-ids"]` also fails when an ADR's Source names an intent folder whose `intent.md` has an `id:` that the line does not name; it also fails when a roadmap table row links such a folder without naming its id; each failure names the file and line.
- R8. `intent/README.md`, `CLAUDE.md` and `AGENTS.md` say that a change has an id from `intent/project.json`, that new folders are `<id>-<slug>/` and that older folders keep `<date>-<slug>/` with an `id:` line.
- R9. The `/adr` and `/spec` edits stay harness-neutral for Codex.

### Non-functional

- N1. Every `../intent/<folder>/` link in `docs/roadmap.md` and `docs/decisions/` resolves after this module; `change-ids` checks it, since `tests/check.mjs` has no link check today.
- N2. The pro-ai-sdlc change bumps its version in both manifests and the marketplace entry, plus `metadata.version`, in the same commit.

### Policy constraints applied

- Version-bump law (ADR-0002): `templates/adr.md`, `commands/adr.md` and `commands/spec.md` are plugin content (N2); the docs are not.
- ADR-0005: ADRs still flow through the loop; only the Source line gains the id.
- CLAUDE.md: a file is cleared of quotes and attributions when it is next edited.

### Boundaries

Always: add ids beside links, keep every link, update the convention text.
Ask first: renumbering an ADR, changing an ADR's Decision or Status.
Never: rewrite an ADR's body, rename a folder, drop a link.

## Design

### User experience

A reader of the roadmap or an ADR sees `PDS-41` and can find the branch, the pull requests and the records of that change by the same id.

### System

- `docs/roadmap.md`: the convention and the ids in every intent cell.
- `docs/decisions/0005` to `0026`: the Source lines that name an intent folder.
- `plugins/pro-ai-sdlc/templates/adr.md`, `commands/adr.md`, `commands/spec.md`.
- `intent/README.md`, `CLAUDE.md`, `AGENTS.md`.
- `tests/check.mjs`: two more rules in `change-ids`, with fixtures in `tests/ids.mjs`.

### Alternatives considered

- An id column in each roadmap table: the tables have different shapes and a new column would touch every header; an id in the intent cell works in every table and in prose.
- Numbering ADRs by change id: the intent rules it out and ADRs outlive the change.

## Flagged concerns

ADR needed: no, this module applies ADR-0026 to the docs.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | Editing 19 ADR Source lines counts as editing each ADR; CLAUDE.md asks that quotes and attributions be removed from a file when it is next edited | `CLAUDE.md`, `docs/decisions/README.md` | resolved on 2026-11-07: the build greps each edited ADR for a quote or attribution and removes any it finds in the same commit; no Decision, Status or Date changes |
| 2 | The template and two commands are pro-ai-sdlc content | version-bump law, ADR-0002 | resolved on 2026-11-07: one pro-ai-sdlc PR with its bump and `metadata.version`; the docs ride with it |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. Every table row of `docs/roadmap.md` that holds `](../intent/` also holds a `PDS-` id and the `change-ids` check passes.
- AC2. `grep "^Source: intent/" docs/decisions/*.md` prints nothing; `grep -c "^Source: PDS-" docs/decisions/*.md` counts every ADR that had an intent Source.
- AC3. A fixture ADR whose Source names an id-bearing folder without the id fails `change-ids` with the file and line; the same with the id passes.
- AC4. `/adr` on a decision from a change with id `TST-1` writes `Source: TST-1, intent/<folder>/`.
- AC5. `node tests/check.mjs` and `claude plugin validate . --strict` pass.

## Out of scope

- Numbering ADRs by change.
- Renaming folders or links.
