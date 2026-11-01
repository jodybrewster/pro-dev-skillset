# ADR-0022: The ship preflight record is a mieruka evidence manifest bound to a commit

Date: 2026-10-31

## Status

proposed

Decided by: Jody Brewster.
Source: intent/2026-10-31-ship-preflight/ (decisions 2, 3 and 5; spec R25 to R37).

## Context

`/pro-ship:ship` ends in GO or NO-GO.
Four readers need that verdict without importing pro-ship code: the merge gate, the new `ship-gate.py`, pro-legal's release gate and mieruka's Ship page.
mieruka already loads file-dropped evidence from `.mieruka/evidence/<evidence_key>/evidence.json`.
Its table accepts only six `kind` values through a `CHECK` constraint.
Its sync does not catch a failed insert, so one manifest with an unknown kind stops every manifest after it from loading.
Its `detail_json` is bound straight into a text column, so an object there fails the same way.
The pr-check stamp (ADR-0014) already set the pattern for a local record that gates read.

## Decision

`/pro-ship:ship` writes one record, `.pro-dev/ship/preflight.json`, through `ship.py record`.
Every other component only reads it.
The record is a mieruka evidence manifest as it is: `evidence_key`, `kind`, `artifact_kind`, `artifact_key`, `status`, `summary`, `detail_json` and `produced_by`.
`kind` is `review` and `artifact_kind` is `ship-preflight`, so mieruka loads it today with no change.
`status` is `pass` for GO, `partial` for GO with risks the person accepted and `fail` for NO-GO.
`detail_json` is a JSON-encoded string.
Two top-level fields mieruka ignores, `schema` (1) and `head` (the full sha), are what the gates read.
A record is a fresh GO for a commit only when `schema` is 1, `produced_by` starts with `pro-ship:ship`, `head` equals that commit and `status` is `pass` or `partial`.
When `.mieruka/` exists and its evidence folder is ignored by git, the same manifest is also written there.
pro-legal's release gate skips its own review when a fresh record holds a legal review of the same range that is not `Hold`.
A gate without a fresh GO warns, or in enforce mode denies once per commit per session; it never asks.
The fields, the freshness rule and the causes are written once in `docs/ship-preflight.md`.

## Consequences

The merge gate, the ship gate, the legal gate and mieruka read one file with one rule.
mieruka needs no change to show the record; its Ship page can filter by `artifact_kind`.
A new field goes inside `detail_json` or as an optional top-level field and does not change `schema`.
Changing `kind`, the status mapping or the freshness rule breaks readers in two repos and needs a new ADR.
The record is a plain file, so a person can write one by hand; that is accepted for a local guardrail, as with the stamp.
Reverse this if mieruka gains its own `ship` kind with a sync that skips bad manifests, or if a CI check replaces the local record as the release gate.
What must stay true: no manifest pro-ship writes ever uses a `kind` outside mieruka's list.
`detail_json` is always a string.

## Alternatives considered

- A new `ship` kind in mieruka: rejected by its `CHECK` constraint and fatal to the rest of the sync until mieruka changes.
- A pro-ship format with a converter for mieruka: two formats to keep in step.
- The gates reading `head` and the verdict from inside `detail_json`: every reader parses a nested string.
- An `ask` from the ship gate: a second prompt beside `production-gate` on the same release.

## Where it is enforced

`plugins/pro-ship/scripts/ship.py` (`record` and `check`), `plugins/pro-ship/scripts/ship-gate.py`, the preflight line in `plugins/pro-ship/scripts/merge-gate.py`, the record reader in `plugins/pro-legal/scripts/release-gate.py`, `tests/fixtures/ship-preflight/` with its `expect.json` and the `preflight-contract` check in `tests/check.mjs`.
Not enforced yet: none of these exist until the build lands.
