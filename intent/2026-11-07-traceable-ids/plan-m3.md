# Plan m3: the id in records

Built from `spec-m3.md` (commit of this PR) and `intent.md` in this folder.
Status: approved.
Approver: the engineer; the maintainer pre-approved on 2026-11-07. The record contract mieruka reads changes; the sync check runs before PR B opens.
Dated: 2026-11-07.

Starts after m1 is merged; it does not need m2.
Two pull requests: A (pro-ai-sdlc, steps 1 to 5), then B (pro-ship plus the contract pages and the sync fixture, steps 6 to 10), because the sync fixture asserts records from both plugins.
Each bumps its plugin in both manifests and the marketplace entry plus `metadata.version` in `.claude-plugin/marketplace.json`; B rebases after A.
Each build takes the next minor above its base for pro-ai-sdlc and pro-ship.

## Files that change

- `plugins/pro-ai-sdlc/scripts/evidence.py` (modified): `ID_RE` and `change_id_of(intent_dir)`.
- `plugins/pro-ai-sdlc/scripts/factory.py`, `incident.py`, `visual.py` (modified): a top-level `change_id`.
- `plugins/pro-ai-sdlc/scripts/lessons.py` (modified): `--change-id`, the ledger field and the `seen` field.
- `plugins/pro-ai-sdlc/commands/review.md` (modified): passes `--change-id` and names the id in the report.
- `tests/factory.mjs`, `tests/incident.mjs`, `tests/visual.mjs`, `tests/lessons.mjs` (modified): the field present, absent and refused.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`, `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` (modified): the bump.
- `plugins/pro-ship/scripts/pr-check.py` (modified): `change_id` on the stamp.
- `plugins/pro-ship/scripts/ship.py` (modified): `change_id` on the deploy record.
- `tests/ship-check.mjs`, `tests/ship-deploy.mjs` (modified): the field present and absent.
- `tests/fixtures/pr-check-stamp/valid-pass-change-id.json` (new), `tests/fixtures/pr-check-stamp/expect.json` (modified): the stamp with the field.
- `docs/pr-check-stamp.md`, `docs/loop-records.md` (modified): the field and the finding trace.
- `tests/mieruka-sync.mjs` (modified): the fixture id and the assertions.
- `plugins/pro-ship/.claude-plugin/plugin.json`, `plugins/pro-ship/.codex-plugin/plugin.json` (modified): the bump.
- `.claude-plugin/marketplace.json` (modified): the versions and `metadata.version`, once per PR.

## Order of work

1. Failing cases in `tests/factory.mjs`, `tests/incident.mjs` and `tests/visual.mjs`: a fixture intent with `id: TST-1` makes each record hold `"change_id": "TST-1"`; `id: lower-1` and no `id:` leave the field out; each key stays as asserted today (size S; R2, R6, R8, R9, R14, AC3, AC5)
2. `evidence.py` gains `ID_RE` and `change_id_of(intent_dir)`, which reads `id:` from the working tree first and from the default tip only when the working tree has no `intent.md`, returning it only on a full match; `factory.py write_record`, `incident.py cmd_record` and `visual.py` set the top-level field from it (size S; R2, R6, R8, R9, N1)
   Checkpoint: `node tests/factory.mjs`, `node tests/incident.mjs` and `node tests/visual.mjs` pass, every key assertion unchanged.
3. `lessons.py add --change-id`: refuse a value that fails `ID_RE` with no row written, store it on the row, copy it into each `seen` entry in `mark`; cases in `tests/lessons.mjs` (size S; R10, AC6)
4. `commands/review.md` passes `--change-id` from the branch prefix or the intent's `id:` and names the id in the first line of its report (size XS; R11)
5. Bump pro-ai-sdlc in both manifests and the marketplace plus `metadata.version` (size XS; N2)
   Checkpoint: `node tests/lessons.mjs`, `node tests/check.mjs` and `claude plugin validate plugins/pro-ai-sdlc --strict` pass; PR A opens and merges.
6. Failing cases in `tests/ship-check.mjs` for the stamp: branch `TST-2/build` gives `TST-2`; `feature/x` touching only `intent/TST-3-demo/` gives `TST-3`; `feature/x` touching no intent leaves it out; then `pr-check.py stamp` sets the field; in the same commit `docs/pr-check-stamp.md` gains the optional row and `tests/fixtures/pr-check-stamp/valid-pass-change-id.json` with its `expect.json` verdict (size S; R2, R3, R4, R5, AC1, AC2)
7. Failing cases in `tests/ship-deploy.mjs`, then `ship.py deployed` sets `change_id` from a deployed commit subject that starts with an id and leaves it out for `release v1.2.0` (size S; R2, R7, AC4)
   Checkpoint: `node tests/ship-check.mjs` and `node tests/ship-deploy.mjs` pass; `node tests/check.mjs` passes `stamp-contract`.
8. `docs/loop-records.md` adds the `change_id` row to Shared rules and a paragraph under the review lesson on tracing a finding to the round that raised it and the round that closed it (size XS; R1, R12)
9. `tests/mieruka-sync.mjs` gives the fixture intent `id: TST-1`, makes the deployed commit's subject start `TST-1: `, asserts the four records hold the field and loads them with mieruka's sync (size S; R13, AC7)
10. Bump pro-ship in both manifests and the marketplace plus `metadata.version` (size XS; N2, AC8)
    Checkpoint: `MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs` passes; the full proof-of-done block passes; PR B opens.

No step is irreversible.
Steps 1 to 3 and steps 6 and 7 touch separate files and can run in parallel worktrees.

## Tests that prove it

- `tests/factory.mjs`, `tests/incident.mjs` and `tests/visual.mjs` cover the field present, absent and malformed; they keep every key.
- `tests/lessons.mjs` covers `--change-id` stored, refused and copied into `seen`.
- `tests/ship-check.mjs` and the `stamp-contract` fixtures cover the stamp field from a branch, from an intent folder and absent.
- `tests/ship-deploy.mjs` covers the deploy field from a subject and absent.
- `tests/mieruka-sync.mjs` proves mieruka loads every record holding the field.

## Risks

Step 9 is the one most likely to go wrong: it runs only with a mieruka checkout; a mieruka that rejects an unknown top-level field would fail the sync.
`docs/loop-records.md` already promises that readers ignore unknown fields; if the sync fails, the field moves into `detail_json` and the departure is recorded.
Step 6 changes the stamp; ADR-0014 keeps the rule copies untouched because no gate reads the field, which the unchanged `expect.json` verdicts show.
A value from a branch or subject reaches a record mieruka renders; `ID_RE` is the guard and every writer has a refused case.

Stop-list categories: deploys, in step 7 only: `ship.py deployed` records a deploy and runs none; the change adds one optional field.

## Options not taken

- The field inside `detail_json`: mieruka would decode a string to match a card.
- One PR for both plugins: two bumps in one commit and the sync fixture would hide which plugin broke it.
- A field on the preflight record: a release spans many changes.

## Proof of done

```
node tests/check.mjs                       # stamp-contract and change-ids pass, 0 failures
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/factory.mjs && node tests/incident.mjs && node tests/visual.mjs && node tests/lessons.mjs
node tests/ship-check.mjs && node tests/ship-deploy.mjs
MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs   # mieruka sync check passed
claude plugin validate . --strict          # Validation passed
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

## Done

Done as of 43bf5498524f

- Build commit: 43bf5498524f on `PDS-50/build-m3`, one commit rebased onto origin/main 3af9bdd (after m4 in PR 195 and reaching-done m1 in PR 192); pro-ai-sdlc 0.20.0, pro-ship 0.19.0, marketplace 1.98.0, one minor above main for each.
- Checks run:
  - `node tests/check.mjs`: 50 checks, 0 failures, 13 warnings (stamp-contract and change-ids pass).
  - `node tests/eval.mjs --dry`: 99 cases reference real skills, 107 skills in catalog + 7 distractors; live routing skipped (no key).
  - `node tests/route-lexical.mjs --min-rank1 70`: rank-1 80/98 (81.6%), top-k 93/98 (94.9%), notOneOf failures 3.
  - `node --test tests/unit/*.test.mjs`: 200 tests, 200 pass, 0 fail.
  - `node tests/factory.mjs`: 178/178; `node tests/incident.mjs`: 46/46; `node tests/visual.mjs`: 35/35; `node tests/lessons.mjs`: 108/108.
  - `node tests/ship-check.mjs`: 252/252; `node tests/ship-deploy.mjs`: 151/151.
  - `MIERUKA_ROOT=<mieruka checkout at d17b5ca> node tests/mieruka-sync.mjs`: passed, the preflight plus deploy, incident, review-lesson, review-round, ui-step and factory-run loaded, each record holding change_id TST-1.
  - `claude plugin validate . --strict`: Validation passed; each of the 21 plugin folders passed strict.
- Definition of done: met (the verifier ran: every test green and each changed writer checked by hand; its verdict was incomplete only because it was told to skip check.mjs and the sync check, both run here).
- Visual: none
- Doubt: none
- AC1: a branch `TST-2/build` stamps `TST-2`, `feature/x` touching only `intent/TST-3-demo/` stamps `TST-3`, `feature/x` with no intent leaves it out (ship-check `stamp/c1` to `c7`).
- AC2: `valid-pass-change-id.json` gets the verdict of `valid-pass.json` from both gates (stamp-contract pass).
- AC3: `factory.py record` with `id: TST-1` writes `"change_id": "TST-1"` and the key `factory-2026-01-02-greeting` (factory `c1` to `c4`, `r1` asserts it absent with no id).
- AC4: subject `TST-1: feat: x` writes `TST-1`; `release v1.2.0` writes none; `PDS-50 title` writes `PDS-50` only when the shortcode is PDS; `UTF-8 decoding fix`, `SHA-256 checksums` and `ABC-1 title` write none (ship-deploy `change_id` cases).
- AC5: incident and visual write `change_id` from the intent; `id: lower-1` and no intent.md write none.
- AC6: `lessons.py add --change-id TST-1` stores it, `'x; rm'` exits 1 with no row, `mark` copies it into `seen`; `raise` and `round` take it onto the findings table row and the review-round record and refuse a bad one.
- AC7: the mieruka sync check passed with every record holding `change_id`.
- AC8: check.mjs and strict validation pass on this one PR.
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- One pull request instead of two (A and B): the build was asked for a single PR, so pro-ai-sdlc and pro-ship each bump in both manifests and the marketplace entry in the same commit and `metadata.version` moves once.
- `evidence.py` imports `ID_RE` and `id_of` from `ids.py`, which m1 put beside it, instead of defining a second pattern and frontmatter reader in the same plugin; `valid_change_id`, `default_tip` and `change_id_of` are new there.
- `evidence.write_record` also drops a `change_id` that fails the pattern, a second guard behind each writer (R2).
- `ship.py deployed` reads the id when the subject starts with `<id>: ` and also with `<id> ` when the prefix is the shortcode in `intent/project.json` at the deployed commit, because a squash merge takes its subject from the PR title, which starts `PDS-50 `; `UTF-8 decoding fix`, `SHA-256 checksums` and `ABC-1 title` under shortcode PDS give none and AC4's two cases hold.
- R11 restated: `/review` opens with the summary line as ADR-0011 requires, then the grade line ADR-0027 added, then `change: <id>`, not on the first line; this resolves R11 against ADR-0011. The id comes from the reviewed PR's head branch, else the current branch, else the brief's `id:`.
- R12 through the review round: reaching-done m1 (PR 192) landed the findings table and the review-round record while this branch was open, so `lessons.py raise` and `lessons.py round` take `--change-id` too and `/review` passes it to both. `docs/loop-records.md` traces a finding to the round that closed it by its table row's `graded_at` and the review-round record at that head, which carries the same `change_id`; it points to ADR-0027. `tests/lessons.mjs` covers both and `tests/mieruka-sync.mjs` asserts the review-round record holds the id.
- `tests/ship-deploy.mjs` and `tests/ship-check.mjs` add a refused case each beyond AC1 and AC4 (a lowercase prefix, an `id:` with a `;`, two intent folders); `tests/mieruka-sync.mjs` also asserts the lesson's `seen` entries carry the id, since the lesson spans changes and has no top-level `change_id`.

## Noticed but not touched

- PR 192 (reaching-done m1) adds a review-round record through `lessons.py round`; once it lands, that record and its findings table rows should carry `change_id` too; `tests/mieruka-sync.mjs` and `docs/loop-records.md` will conflict with this branch.
- `evidence.default_tip` is a copy of `factory.default_tip`; factory could call the shared one.
- `ids.py`'s own `ID_RE` uses `match` with `$`, which accepts a trailing newline; every writer here uses `fullmatch`.
