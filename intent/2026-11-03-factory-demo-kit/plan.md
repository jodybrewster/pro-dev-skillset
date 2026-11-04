# Plan: one command builds a fresh factory demo

Built from `spec.md` and `intent.md` in this folder.
Status: approved.
Approver: the maintainer.
Dated: 2026-11-03.

## Order of work

1. `demo/factory/new-demo.sh` (R1 to R6, R9, R10): validate, check GitHub and disk, run `scaffold.sh` into the new folder, then layer the demo files on top, commit, create the repo, tag, protect, install.
2. `demo/factory/remove-demo.sh` (R7 to R10): the cleanup steps in the doc's order, ending with the printed validations.
3. `tests/demo-kit.mjs` (R11) and its wiring in `tests/check.mjs`.
4. `docs/factory-demo.md` (R12).

## Files touched

- `demo/factory/new-demo.sh`, `demo/factory/remove-demo.sh`
- `tests/demo-kit.mjs`, `tests/check.mjs`
- `docs/factory-demo.md`

No plugin changes, so no version bump.

## Tests

`tests/demo-kit.mjs` puts stub `gh`, `claude` and `docker` first on PATH and logs every call.
Cases: a bad name, an existing GitHub repo, an existing folder, the ordered gh calls of a full create, a remove with a mismatched origin and a remove that never calls `gh repo delete`.

## Risks

- The fixture scaffold sets its own git user; the script resets the repo-local user after it.
- A real run creates a GitHub repo; the tests use stubs only and nothing here runs the scripts for real.

## Rejected options

- Copying the fixture into `demo/`: it would drift from `scaffold.sh`.
- Deleting the repo in `remove-demo.sh`: deletion is permanent and stays the person's call.

## Proof of done

The commands in the spec's acceptance criteria pass.
