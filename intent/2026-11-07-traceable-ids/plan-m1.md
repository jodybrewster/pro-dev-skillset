# Plan m1: the id itself

Built from `spec-m1.md` (commit of this PR) and `intent.md` in this folder.
Status: approved.
Approver: the engineer; the maintainer pre-approved on 2026-11-07. No lead beyond that: the blast radius is one new script, three folder patterns, prose in four commands and one `id:` line per intent, each with cases.
Dated: 2026-11-07.

Three pull requests, one per plugin: B (pro-ship, step 10) merges first so `ship.py` reads id-named folders before any exist, then A (pro-ai-sdlc and this repo, steps 1 to 9), then C (pro-core, step 11).
Each bumps its plugin in both manifests and the marketplace entry plus `metadata.version` in `.claude-plugin/marketplace.json`; the later ones rebase.
Versions at the time of writing: pro-ai-sdlc 0.16.0 to 0.17.0, pro-ship 0.16.1 to 0.17.0, pro-core 0.25.0 to 0.26.0; each build takes the next minor above its base.

## Files that change

- `plugins/pro-ai-sdlc/scripts/ids.py` (new): `next`, `backfill` and `backfill --write`.
- `tests/ids.mjs` (new): the case table for `ids.py` and the `change-ids` fixtures.
- `plugins/pro-ai-sdlc/scripts/factory.py` (modified): `FOLDER_RE` takes both forms, `slug_of(folder)`, a lowercased key in `write_record`.
- `plugins/pro-ai-sdlc/scripts/execute-gate.py` (modified): `slug_of` strips either prefix.
- `plugins/pro-ai-sdlc/factory/session.sh` (modified): the folder glob and the character guard take both forms, capitals only in the id prefix.
- `plugins/pro-ai-sdlc/commands/auto.md` (modified): the folder shape names both forms.
- `tests/e2e-sdlc/checks.mjs` (modified): `intentDirs` and the `incident-intent` filter take both forms.
- `plugins/pro-ai-sdlc/scripts/visual.py`, `plugins/pro-ai-sdlc/scripts/incident.py` (modified): the lowercased key.
- `plugins/pro-ai-sdlc/commands/intent.md`, `incident.md`, `spec.md`, `plan.md` (modified): allocation, the id-named folder and copying `id:`; `ids.py` added to `allowed-tools` of `/intent` and `/incident`.
- `plugins/pro-ai-sdlc/templates/intent.md`, `spec.md`, `plan.md` (modified): the `id:` line.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`, `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` (modified): the bump.
- `plugins/pro-ai-sdlc/README.md`, `docs/factory.md` (modified): `ids.py` and the two folder forms.
- `tests/check.mjs` (modified): `checks["change-ids"]`.
- `tests/factory.mjs`, `tests/execute.mjs`, `tests/visual.mjs`, `tests/incident.mjs` (modified): cases for `TST-1-demo`.
- `intent/project.json` (new): `{"shortcode": "PDS"}`.
- `intent/*/intent.md` (modified, 50 files): one `id:` line each.
- `plugins/pro-ship/scripts/ship.py` (modified): `INTENT_FOLDER`.
- `tests/ship-version.mjs` (modified): an id-named folder counted.
- `plugins/pro-ship/.claude-plugin/plugin.json`, `plugins/pro-ship/.codex-plugin/plugin.json` (modified): the bump.
- `plugins/pro-core/commands/pro-dev.md` (modified): the shortcode question.
- `plugins/pro-core/.claude-plugin/plugin.json`, `plugins/pro-core/.codex-plugin/plugin.json` (modified): the bump.
- `.claude-plugin/marketplace.json` (modified): each plugin's version and `metadata.version`, once per PR.
- `docs/roadmap.md` (modified): the intent moves stage, in PR A.

## Order of work

1. Failing cases in `tests/ids.mjs` for `ids.py next`: a fixture repo whose `origin/main` holds `TST-3` and whose `origin/other` holds `TST-7` gives `TST-8`; a local branch never pushed that holds `TST-9` gives `TST-10`; an unreachable `origin` gives the id, exit 0 and stderr starting `ids: offline`; no `intent/project.json` exits 1; a `dropped` intent still counts (size S; R2, R3, R4, R5, R19, AC2, AC3, AC4)
2. `ids.py` with `id_of(text)`, `shortcode(root)` and `next`: fetch with a 10 second timeout, `git for-each-ref refs/remotes/origin refs/heads`, `git ls-tree` and `git show` per ref plus the working tree, highest number plus one; stdlib only (size M; R2, R3, R4, R5, R19, N1, N2)
   Checkpoint: `node tests/ids.mjs` passes the `next` cases; `/usr/bin/python3 -m py_compile plugins/pro-ai-sdlc/scripts/ids.py` is clean under Python 3.9.
3. `ids.py backfill`: collect intents with no `id:`, sort by `created:` in UTC with a date-only value read as 00:00 UTC and the folder name as the tiebreak, number from the highest existing id plus one, print `| id | folder | created |` rows; `--write` inserts `id: <id>` as the first frontmatter line and nothing else; cases for the order, the tiebreak, a date-only value and a second run that writes nothing (size S; R17)
   Checkpoint: `node tests/ids.mjs` green; in a scratch copy of this repo with `intent/project.json` added, `ids.py backfill` prints the 50 rows of spec-m1's table in order.
4. Failing cases in `tests/factory.mjs` and `tests/execute.mjs` for a fixture folder `intent/TST-1-demo/`, then `factory.py` `FOLDER_RE` as `^(?:\d{4}-\d{2}-\d{2}|[A-Z]{2,6}-[1-9][0-9]*)-[a-z0-9-]{1,60}$`, a `slug_of(folder)` used by `binding_reasons` and `execute-gate.py` plus `factory-` with the lowercased folder in `write_record`; `factory/session.sh` accepts `intent/<YYYY-MM-DD>-<slug>` and `intent/<ID>-<slug>` with `[A-Z]` allowed only in the id prefix, with a case in `tests/factory.mjs` that runs its argument checks on `intent/TST-1-demo` (exit not 64) and on `intent/TST-1-Demo` (exit 64); `tests/e2e-sdlc/checks.mjs` `intentDirs` and the `incident-intent` filter take both forms, with a unit case on a listing that holds both; `session.sh` strips a date or an id prefix `[A-Z]{2,6}-[0-9]+-` in its `slug` line so `want` is `demo-brief` for `intent/TST-1-demo`, with an s1-harness case in `tests/factory.mjs` asserting the `--head` value passed to the stubbed `gh`; `commands/auto.md` names both folder shapes and the branch as the folder name without its date or id prefix, with a grep in the `change-ids` check (size M, three small readers beside the two scripts; R9, R10, R12, AC7)
5. `visual.py` and `incident.py` lowercase the folder into their keys; cases in `tests/visual.mjs` and `tests/incident.mjs` for `TST-1-demo` and an unchanged date-folder key (size S; R12)
   Checkpoint: `node tests/factory.mjs`, `node tests/execute.mjs`, `node tests/visual.mjs` and `node tests/incident.mjs` pass, every existing key assertion unchanged; `node --test tests/unit/*.test.mjs` passes the `intentDirs` case.
6. `commands/intent.md` and `commands/incident.md`: with `intent/project.json`, run `ids.py next`, write `intent/<id>-<slug>/` with `id:` first and say where the number came from; without it, the date path as today plus one reminder line; `commands/spec.md` and `commands/plan.md` copy `id:` into every file they write; the three templates gain the line, `templates/plan.md` as a frontmatter block above `# Plan:`; a case in `tests/execute.mjs` for a plan with that block (size S; R5, R6, R7, R8)
7. `checks["change-ids"]` in `tests/check.mjs`: read `intent/project.json`; without it pass with one warning; with it, fail on a missing or malformed `id:`, a duplicate, a folder prefix that disagrees with its `id:` and a `spec*.md`, `plan*.md` or `capability-map.md` id that disagrees with its intent, each failure naming the file and the id; it also runs the case table of `tests/ids.mjs` and its fixtures for a duplicate and a missing id (size S; R13, R14, R15, R16, AC5)
   Checkpoint: `node tests/check.mjs` fails `change-ids` on this repo with 50 missing ids, which proves the check before the backfill.
8. `intent/project.json` with `{"shortcode": "PDS"}`, then `python3 plugins/pro-ai-sdlc/scripts/ids.py backfill` compared row by row with spec-m1's table, then `--write` (size S; irreversible: once merged an id is never renumbered; R1, R18, AC1, AC6)
9. Bump pro-ai-sdlc in both manifests and the marketplace entry plus `metadata.version`; `plugins/pro-ai-sdlc/README.md` and `docs/factory.md` name `ids.py` and the two folder forms; `docs/roadmap.md` moves the intent; the `names` check confirms no person's name entered an id or record (size XS; N3, N4, AC10)
   Checkpoint: `git diff --stat origin/main -- 'intent/*/intent.md'` shows 50 files, 50 insertions, 0 deletions; `python3 plugins/pro-ai-sdlc/scripts/ids.py next` prints `PDS-51`; the full verify block passes; PR A opens after PR B merges.
10. `ship.py` `INTENT_FOLDER` takes both forms; a case in `tests/ship-version.mjs` where `intent/TST-1-demo/` with `kind: bug` makes a patch; bump pro-ship in both manifests and the marketplace plus `metadata.version` (size S; R11, N3, AC8)
    Checkpoint: `node tests/ship-version.mjs` and `node tests/check.mjs` pass; `claude plugin validate plugins/pro-ship --strict` passes; PR B opens and merges first.
11. `pro-dev.md` under "Create the folders and the review policy": when `aiSdlcInstallPath` is set and `intent/project.json` is missing, ask once for a shortcode, proposing a default (initials for two to six words, the first three letters for one word, the first six initials for more than six) only when it matches `^[A-Z]{2,6}$` and asking with no default otherwise (`x`, `3d-viewer`, `my_app`), accept only `^[A-Z]{2,6}$`, write the file on an answer, nothing on a skip, never overwrite; bump pro-core in both manifests and the marketplace plus `metadata.version` (size S; R20, N3, AC9)
    Checkpoint: `claude plugin validate plugins/pro-core --strict` and `node tests/check.mjs` pass; `/pro-dev install` by hand in a scratch repo named `demo-app` offers `DA` and writes the file, `mieruka` is offered `MIE` and `one-two-three-four-five-six-seven` is offered `OTTFFS`; PR C opens.

Step 8 is the only irreversible step: once the 50 ids merge, R19 forbids renumbering them.
Steps 4 and 5, step 10 and step 11 touch separate files and can run in parallel worktrees.

## Tests that prove it

- `tests/ids.mjs` covers allocation across `origin/main`, a remote branch and a local unpushed branch, the offline path, no `intent/project.json`, a dropped intent, the backfill order, tiebreak, date-only value and a second idempotent run.
- `tests/check.mjs` `change-ids` covers a duplicate, a missing id, a folder that disagrees with its `id:` and a spec that disagrees with its intent, then this repo.
- `tests/factory.mjs`, `tests/execute.mjs`, `tests/visual.mjs` and `tests/incident.mjs` cover an id-named folder and keep every date-folder key.
- `tests/ship-version.mjs` covers an intent in an id-named folder.
- A hand run of `/pro-dev install` proves R20; the command is prose and has no unit test.

## Risks

Step 8 is the one most likely to go wrong: a wrong order in the backfill would publish ids that can never be renumbered.
The guard is the row-by-row comparison with spec-m1's table before `--write` and the 0-deletions diff stat.
Step 4 widens `FOLDER_RE`, which `next_folder` and `eligible` use to pick what the factory runs; a regex that matches too much would let the factory run a folder it should skip.
The cases keep every refusal for a malformed name.
A second session that writes a date-named intent after step 8 and before PR A merges leaves one intent with no id; `change-ids` fails on that PR and `ids.py backfill --write` fixes it.
mieruka may not show an id-named folder until its own intent lands; no such folder exists until a person runs the new `/intent`.

Stop-list categories: none; no auth, migration, payment, deploy or secret handling is touched.

## Options not taken

- One PR for all three plugins: three bumps in one commit and one revert would undo unrelated parts.
- Writing the backfill by hand: 50 edits by hand are where an order slip happens; a script prints the table first.
- A JavaScript allocator in `tests/`: users' repos do not have `tests/check.mjs` and allocation has to ship in the plugin.

## Proof of done

```
node tests/check.mjs                       # change-ids passes, 0 failures
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/ids.mjs                         # all cases pass
node tests/factory.mjs && node tests/execute.mjs && node tests/visual.mjs && node tests/incident.mjs
node tests/ship-version.mjs
claude plugin validate . --strict          # Validation passed
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
python3 plugins/pro-ai-sdlc/scripts/ids.py next          # PDS-51
python3 plugins/pro-ai-sdlc/scripts/ids.py backfill      # prints nothing to do
git grep -c "^id: PDS-" -- 'intent/*/intent.md' | wc -l  # 50
```

## Done

Filled in when the build is finished, before sign-off.

- Build commit:
- Checks run:
- Definition of done: (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more)
- Visual: none
- Doubt:
- AC1 to AC10:
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0026 from `proposed` to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- One pull request instead of three: the build was asked for a single PR, so pro-ship (step 10) and pro-core (step 11) ride beside pro-ai-sdlc, each with its own bump in both manifests and the marketplace entry and `metadata.version` once.
- The backfill numbered 56 intents, not 50: six intents reached `origin/main` after the table was computed at 20c5666 (`2026-11-07-guard-hardening` and `2026-11-07-reaching-done` at 14:00 and four at 14:31 on 2026-11-07, all after traceable-ids at 13:05).
  The first 50 rows match spec-m1's table exactly; the six follow by the same rule as PDS-51 to PDS-56.
  `ids.py next` prints `PDS-57` and the diff against main is 56 files, 56 insertions and 0 deletions.
  spec-m1's table, AC1 and AC6 carry the six rows and the new counts.
- reaching-done merged while this branch was open; its `created:` ties guard-hardening and sorts after it by folder name.
  `ids.py backfill --write` numbers from the highest id on any ref and this branch already held PDS-55; the five ids after PDS-51 were set by hand in created order before anything merged (R19 forbids it only once merged) and checked by an independent recomputation in Node: 56 intents, 0 mismatches.
- `tests/e2e-sdlc.mjs` (not in the file list) reads the factory record by its lowercased name, as `tests/e2e-sdlc/checks.mjs` does.
- `pro-dev.py status --json` gains a `shortcode` field (`projectFile` and `default`) that `/pro-dev install` reads; the default rule of R20 is then code with a case in `tests/pro-dev.mjs` (`status/shortcode-default`) rather than prose proved by hand; the question and the write stay in `pro-dev.md`.
- `docs/roadmap.md` is left alone: it lists no traceable-ids item to move.
- Three review nits folded in: R10 says `execute-gate.py` names the build branch only, AC9 gains the repos that fall through to the question (`x`, `3d-viewer`, `my_app`) and ADR-0026's allocation and window lines match R3.
- The `change-ids` rule lives in `tests/ids.mjs` as `changeIdProblems(root)` so its fixtures and this repo run the same code; `tests/check.mjs` imports it.

## Noticed but not touched
