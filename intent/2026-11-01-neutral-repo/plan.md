# Plan: a neutral repo

Built from `spec.md` and `intent.md` in this folder.
Status: approved.
Approver: the maintainer.
Docs, manifests and comments only, plus one JSON value in `risk-classify.py`; every change is covered by the existing checks, so it suits auto mode.
Dated: 2026-11-01.

## Files that change

- `intent/**` (modified): R3 and R4, every folder except this one.
- `docs/**`, `README.md`, `REVIEW.md`, `RELEASING.md`, `CLAUDE.md`, `LICENSE`, `templates/**`, `demo/**` (modified): R3, R4, R6 and R7.
- `plugins/**` and `.claude-plugin/marketplace.json` (modified): R3, R5, R6, R7 and R8, with a patch bump for every plugin whose files change and one `metadata.version` bump.
- `tests/unit/risk-classifier.test.mjs` and `tests/fixtures/risk/**` (modified): R8, in the plugins PR so its tests stay green.
- `tests/**` other than those (modified): R3 and R7.
- `tests/check.mjs` (modified): the `names` check (R9).

## Order of work

1. This plan, as its own PR.
2. Four sweeps in parallel worktrees, each its own PR merged when its checks pass:
   - intents dated before 2026-10-30;
   - intents dated 2026-10-30 and later;
   - docs and the root files;
   - plugins with their bumps and R8.
   The intent folders split in two because 98 files is too much for one careful pass.
3. Tests plus the `names` check, rebased on `main` after the four sweeps merge, so the check passes on a clean tree.

Each sweep rewrites a sentence to state the decision on its own rather than deleting the name, and ends with the area's greps from R1, R2 and R7 returning only allowed matches.

## Tests that prove it

- The R1, R2 and R7 greps over the whole tree after step 3.
- `node tests/check.mjs` with the `names` check, plus a negative run where a scratch doc holding the first name makes it fail.
- `node --test tests/unit/*.test.mjs` for R8.

## Risks

Most likely to go wrong: a rewrite that drops a decision's subject or date along with the name, which leaves an intent unreadable.
Each sweep is read as a diff before merge, looking for that.
A sweep that touches the same file as another (the roadmap, `docs/licenses.md`) conflicts; the areas above do not overlap.
The version bumps in the plugins PR can race with other merges; it rebases and re-reads the numbers before pushing.
Nothing is irreversible.

## Options not taken

- One PR: about 200 files is too much for one review.
- A scripted replace of the name: it would leave sentences like "asked for it" with no subject.
- Landing the `names` check first: it would fail every PR until the sweep ends.

## Proof of done

```bash
git grep -I -n -i jody -- . ':!CHANGELOG.md' ':!intent/2026-11-01-neutral-repo' ':!tests/check.mjs' | grep -v 'jodybrewster/pro-dev-skillset'
git grep -I -n -i -e addyosmani -e osmani -- . ':!intent/2026-11-01-neutral-repo' ':!tests/check.mjs' | grep -v -e 'Copyright (c) 2025 Addy Osmani' -e 'github.com/addyosmani/agent-skills'
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

The two greps print nothing (the second may print `docs/licenses.md` copyright cells, which R7 allows) and every check passes.

## Done

- Build commits:
- Checks run:
- AC1 to AC4:
- Sign-off:

## Departures from plan

None yet.
