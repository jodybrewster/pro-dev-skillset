---
id: PDS-50
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T13:56:55-0500
author: the maintainer
module: m3
---

# Spec m3: the id in records

Built from `intent.md` in this folder (commit 1242860), module m3 of [capability-map.md](./capability-map.md).
Status: draft.
Depends on m1: the `id:` line it writes is what every writer reads.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0011, ADR-0014, ADR-0022, ADR-0023, ADR-0024, `docs/loop-records.md`, `docs/pr-check-stamp.md`, `docs/ship-preflight.md`, `pro-security:security-architect` (diff mode, read for pass 2).

## Summary

Every record the loop writes about one change carries an optional `change_id`: the pr-check stamp, the factory run record, the deploy record, the incident record and the visual check, plus each row of the review finding ledger and each change a review lesson lists.
mieruka can then put a card and its evidence together by id instead of by folder name.
The field is optional everywhere; a record with no id is read as today and `schema` stays 1.
`docs/loop-records.md` and `docs/pr-check-stamp.md` describe it and `tests/mieruka-sync.mjs` proves mieruka still loads a record that holds it.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. `change_id` is optional on every record and on the stamp; a writer that cannot find an id leaves the field out.
2. `evidence_key` is unchanged for every record.
3. mieruka's own reading of `change_id` is its own intent (mieruka PR 221); this module guarantees the field and the sync fixture only.
4. The id a writer reads comes from an intent's `id:` line, a branch name or a commit subject, all text a diff can shape; it is checked against the id pattern before it is written.

## Requirements

### Functional

- R1. `docs/loop-records.md` adds `change_id` to the Shared rules table as an optional top-level string matching `^[A-Z]{2,6}-[1-9][0-9]*$`, the change the record is about and absent when unknown; the page says adding it keeps `schema` at 1 (intent: "the pr-check stamp, the factory record and the deploy record, as `change_id`, which mieruka reads").
- R2. Every writer validates a candidate id against that pattern and leaves the field out when it does not match; no writer ever writes a value that fails it.
- R3. `pr-check.py stamp` writes a top-level `change_id` taken from the branch name when it starts with `<id>/`, else from the `id:` of the only intent folder the `base..head` diff touches, else not at all.
- R4. `docs/pr-check-stamp.md` lists `change_id` as an optional field that no gate reads; the validity rule, the result rule and both reader copies are unchanged.
- R5. `tests/fixtures/pr-check-stamp/` gains `valid-pass-change-id.json`, a copy of `valid-pass.json` with `change_id`; `expect.json` gives it the same verdict.
- R6. `factory.py write_record` writes a top-level `change_id` from the `id:` of the intent it runs, read from the working tree first and from the default tip only when the working tree has no `intent.md` for it.
- R7. `ship.py deployed` writes a top-level `change_id` when the subject of the deployed commit starts with `<id>: `; a release commit with no id leaves it out.
- R8. `incident.py record` writes a top-level `change_id` from the `id:` of the `intent.md` beside `incident.md`; the `id:` of `incident.md` stays the folder name.
- R9. `visual.py record` writes a top-level `change_id` from the `id:` of the intent it records.
- R10. `lessons.py add` accepts `--change-id <id>`, refuses a value that fails the pattern and stores `change_id` on the ledger row; `lessons.py mark` copies each row's `change_id` into its `seen` entry (intent: "every review finding, so a finding can be traced to the change it was raised on").
- R11. `/review` passes `--change-id` when the reviewed branch starts with an id or the change's intent has one and names the id in the first line of its report.
- R12. A finding is traced to the round that raised it by the `head` already on its ledger row and to the round that closed it by the first later row for the same `change_id` and `ref` whose review no longer lists it; `docs/loop-records.md` says so (intent: "and to the round that closed it").
- R13. `tests/mieruka-sync.mjs` gives its fixture intent `id: TST-1` and makes the deployed commit's subject start `TST-1: `, asserts that the factory, deploy, incident and visual records it writes hold `"change_id": "TST-1"` and still loads every record with mieruka's `syncFromFilesystem` with no error.
- R14. No `evidence_key` changes: `tests/factory.mjs`, `tests/ship-deploy.mjs`, `tests/incident.mjs`, `tests/visual.mjs` and `tests/lessons.mjs` keep every existing key assertion.

### Non-functional

- N1. A writer that finds no id behaves exactly as today, byte for byte apart from `created` and `updated` times.
- N2. Each plugin change bumps its version in both manifests and the marketplace entry, plus `metadata.version`, in the same commit.

### Policy constraints applied

- ADR-0023: one contract page, the writer and `tests/mieruka-sync.mjs` change together (R1, R13).
- ADR-0014: the stamp page and its fixtures change in one commit; the rule copies in `pr-gate.py` and `push-gate.py` are untouched because no gate reads the field (R4, R5).
- ADR-0022: the preflight record is unchanged; a release spans many changes.
- REVIEW.md pass 2: every id is pattern-checked before it is written (R2).

### Boundaries

Always: write `change_id` when an id is found, validate it, keep keys.
Ask first: making `change_id` required, changing `schema`, adding the field to the preflight record.
Never: change an `evidence_key`, write an id that fails the pattern, make a gate read the field.

## Design

### User experience

Nothing changes for a person at the terminal.
mieruka, once its own intent lands, shows a card's stamp, factory run, deploy, incident, visual checks and findings under one id.

### System

- `docs/loop-records.md`, `docs/pr-check-stamp.md`: the field.
- `plugins/pro-ship/scripts/pr-check.py`, `ship.py`: the stamp and the deploy record.
- `plugins/pro-ai-sdlc/scripts/factory.py`, `incident.py`, `visual.py`, `lessons.py`: the other records and the ledger.
- `plugins/pro-ai-sdlc/commands/review.md`: `--change-id` and the report line.
- One `ID_RE` and `change_id_of(intent_dir)` in pro-ai-sdlc's `evidence.py`, which its writers already import, plus one `ID_RE` in each pro-ship script, since plugins do not import each other (ADR-0003).
- Tests: `tests/ship-check.mjs` and the stamp fixtures (R3 to R5), `tests/ship-deploy.mjs` (R7), `tests/factory.mjs` (R6), `tests/incident.mjs` (R8), `tests/visual.mjs` (R9), `tests/lessons.mjs` (R10), `tests/mieruka-sync.mjs` (R13).

### Alternatives considered

- `change_id` inside `detail_json`: mieruka would have to decode the string to match a card; a top-level field is read with the rest of the manifest.
- A required field with `schema` 2: every older record would fail a reader that expects it; a repo with no shortcode has no id to give.
- A list of every change in a deploy: a release spans many intents and `ship.py version` already lists them; it can follow in mieruka's own intent.

## Flagged concerns

ADR needed: no, this module adds an optional field under ADR-0023 and ADR-0014 and follows ADR-0026.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | ADR-0023 makes `docs/loop-records.md`, each writer and `tests/mieruka-sync.mjs` change together when a field changes | ADR-0023 | resolved on 2026-11-07: the field is optional and top-level and `schema` stays 1; the page, the writers and the sync fixture land in this module (R1, R13) |
| 2 | ADR-0014 says a stamp change moves the page, both rule copies and the fixtures in one commit | ADR-0014, `docs/pr-check-stamp.md` | resolved on 2026-11-07: no gate reads `change_id` and the rule copies stay as they are; the page row and the new fixture land in the same commit as `pr-check.py` |
| 3 | A branch name, a commit subject and an `id:` line are text a diff can shape; they reach records mieruka renders | REVIEW.md pass 2 | resolved on 2026-11-07: R2 writes only a value that matches the id pattern |
| 4 | The module edits pro-ai-sdlc and pro-ship | version-bump law, ADR-0002 | resolved on 2026-11-07: two PRs, each with its bump and `metadata.version`; the docs and the sync fixture ride with the pro-ship PR |
| 5 | A deploy of many changes names one `change_id` at most | ADR-0023, mieruka | resolved on 2026-11-07: the field names the deployed commit's change and is optional; a list per release is left to mieruka's own intent |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. On a branch `TST-2/build`, `pr-check.py stamp` writes `"change_id": "TST-2"`; on `feature/x` touching only `intent/TST-3-demo/`, it writes `TST-3`; on `feature/x` touching no intent, the field is absent.
- AC2. The `stamp-contract` check gives `valid-pass-change-id.json` the verdict of `valid-pass.json`.
- AC3. `factory.py record` for a fixture intent with `id: TST-1` writes `"change_id": "TST-1"` and the key `factory-<folder>` as before.
- AC4. `ship.py deployed` for a commit with subject `TST-1: feat: x` writes `"change_id": "TST-1"`; for `release v1.2.0` the field is absent.
- AC5. `incident.py record` and `visual.py record` write `change_id` from the intent; an intent with `id: lower-1` writes none.
- AC6. `lessons.py add --change-id TST-1` stores it; `--change-id 'x; rm'` exits non-zero and writes no row; `mark` copies it into `seen`.
- AC7. `MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs` passes with every record holding `change_id`.
- AC8. `node tests/check.mjs` and `claude plugin validate . --strict` pass after each PR.

## Out of scope

- The preflight record, which spans a release.
- mieruka's reading of the field and its cards.
- Making `change_id` required.
