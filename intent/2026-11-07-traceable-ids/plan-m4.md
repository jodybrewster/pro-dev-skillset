# Plan m4: the id in docs

Built from `spec-m4.md` (commit of this PR) and `intent.md` in this folder.
Status: approved.
Approver: the engineer; the maintainer pre-approved on 2026-11-07. Docs and one template; suits auto mode once m1 is merged.
Dated: 2026-11-07.

Starts after m1 is merged; it does not need m2 or m3.
One pull request: pro-ai-sdlc plus the docs, with the pro-ai-sdlc bump in both manifests and the marketplace entry plus `metadata.version` in `.claude-plugin/marketplace.json`.
The build takes the next minor above its base for pro-ai-sdlc.

## Files that change

- `tests/check.mjs` (modified): two more rules in `checks["change-ids"]`.
- `tests/ids.mjs` (modified): fixtures for an ADR Source and a roadmap row with and without the id.
- `docs/decisions/0005-adrs-in-the-sdlc-loop.md` to `docs/decisions/0026-change-ids.md` (modified, each one whose Source names an intent folder): the id first on the Source line.
- `docs/roadmap.md` (modified): the convention and the id in every intent cell.
- `plugins/pro-ai-sdlc/templates/adr.md` (modified): the Source placeholder.
- `plugins/pro-ai-sdlc/commands/adr.md`, `plugins/pro-ai-sdlc/commands/spec.md` (modified): Source with the id.
- `intent/README.md`, `CLAUDE.md`, `AGENTS.md` (modified): the id convention.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`, `plugins/pro-ai-sdlc/.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (modified): the bump.

## Order of work

1. Fixtures in `tests/ids.mjs`: an ADR whose Source names an id-bearing folder without the id fails with the file and line, with the id passes; a roadmap row that links such a folder without the id fails, with it passes; a link to a folder that does not exist fails (size S; R7, N1, AC3)
2. `checks["change-ids"]` reads every `^Source:` line under `docs/decisions/` and every table row of `docs/roadmap.md` that links `../intent/<folder>/`, resolves the folder, reads its `id:` and fails when the id is missing from the line or the folder does not exist (size S; R7, N1)
   Checkpoint: `node tests/check.mjs` fails `change-ids` on this repo, naming each ADR and roadmap row that lacks its id.
3. Each ADR whose Source names an intent folder gets `<id>, ` after `Source: `, from the m1 mapping, ADR-0026 included; each edited ADR is grepped for a quote or attribution and any found is removed in the same commit; no Decision, Status or Date line changes (size S; R3, AC2)
4. `docs/roadmap.md` states the convention under its opening lines and puts the id before the link in every intent cell (size S; R1, R2, AC1)
   Checkpoint: `node tests/check.mjs` passes `change-ids`; `grep "^Source: intent/" docs/decisions/*.md` prints nothing.
5. `templates/adr.md` Source placeholder; `commands/adr.md` step 3 fills Source with the id and folder for a change that has an id; `commands/spec.md` step 5 does the same for the drafted ADR; the prose stays harness-neutral (size S; R4, R5, R6, R9, AC4)
6. `intent/README.md`, `CLAUDE.md` and `AGENTS.md` describe `intent/project.json`, `<id>-<slug>/` for new folders and the `id:` line in older ones (size XS; R8)
7. Bump pro-ai-sdlc in both manifests and the marketplace plus `metadata.version` (size XS; N2, AC5)
   Checkpoint: the full proof-of-done block passes; `/adr` by hand on a scratch decision from a fixture change `TST-1` writes `Source: TST-1, intent/<folder>/`; the PR opens.

No step is irreversible.
Steps 3 and 4 touch separate files and can run in parallel with step 5.

## Tests that prove it

- `tests/ids.mjs` fixtures cover the ADR and roadmap rules (passing and failing) plus a missing folder.
- `node tests/check.mjs` proves every ADR and roadmap row in this repo.
- A hand run of `/adr` proves R5; the command is prose and has no unit test.

## Risks

Step 3 is the one most likely to go wrong: a slip while editing 20 ADRs could change more than the Source line.
The guard is `git diff --stat` showing one changed line per ADR, apart from any quote removed under CLAUDE.md's rule, which the PR body lists.
Step 4 edits a long roadmap that other sessions edit in parallel; the PR rebases on the latest `main` right before it opens and re-runs the check.

Stop-list categories: none.

## Options not taken

- An id column in each roadmap table: the tables differ in shape and a new column would touch every header.
- Leaving old ADRs alone and only stamping new ones: the check could not tell an old ADR from a missed one.

## Proof of done

```
node tests/check.mjs                       # change-ids passes, 0 failures
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/ids.mjs
grep "^Source: intent/" docs/decisions/*.md   # prints nothing
claude plugin validate . --strict          # Validation passed
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

## Done

Done as of 544ce43642af.

- Build commit: 544ce43642af on `PDS-50/build-m4`, based on `6d8170a`.
- Checks run:
  - `node tests/check.mjs`: `✓ 50 checks · 0 failures · 13 warnings`, `change-ids pass`.
  - `node tests/eval.mjs --dry`: `✓ 99 cases reference real skills · 107 skills in catalog + 7 distractors` (live routing skipped, no key).
  - `node tests/route-lexical.mjs --min-rank1 70`: `rank-1: 80/98 (81.6%)  top-k: 93/98 (94.9%)  notOneOf failures: 3`, exit 0.
  - `node --test tests/unit/*.test.mjs`: `# pass 200`, `# fail 0`.
  - `node tests/ids.mjs`: `36/36 ids cases passed` (nine new m4 cases).
  - `grep "^Source: intent/" docs/decisions/*.md`: prints nothing, exit 1.
  - `claude plugin validate . --strict` and `claude plugin validate plugins/pro-ai-sdlc --strict`: `✔ Validation passed` each.
  - Before the change, the repo check failed with 32 lines: 20 ADR Source lines and 12 roadmap rows, each named by file and line.
- Definition of done: tests first (the m4 fixtures failed 6 of 36 before the rule), the version bump in the same commit, no names, no em dashes; no runtime code outside the test rule.
- Visual: none.
- Doubt: no hard-to-undo step; every edit is a docs or prose line.
- AC1: every table row of `docs/roadmap.md` that holds `](../intent/` names its `PDS-` id (12 rows) and `change-ids` passes.
- AC2: `grep "^Source: intent/"` prints nothing; `grep -c "^Source: PDS-"` counts 1 in each of the 21 ADRs that had an intent Source.
- AC3: fixtures `check/m4 AC3` in `tests/ids.mjs`: without the id it fails with `docs/decisions/0001-demo.md:9: Source names intent/2026-01-01-a/ without its id TST-1`; with the id it passes.
- AC4: a hand run of `/pro-ai-sdlc:adr` (Sonnet, `--plugin-dir` on this branch) in a scratch repo with change `TST-1` at `intent/2026-01-02-demo/` wrote `Source: TST-1, intent/2026-01-02-demo/.` and committed `adr: 0001 cache-catalog-in-memory`.
- AC5: `node tests/check.mjs` and `claude plugin validate . --strict` pass, above.
- Sign-off: waiting on the maintainer.

The sign-off moves `status` in the intent and the spec to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- `tests/check.mjs` is unchanged: the rule lives in `changeIdProblems(root)` in `tests/ids.mjs`, which `checks["change-ids"]` already imports (an m1 departure), so the two new rules and their fixtures sit in one file.
- N1 is checked for every `](../intent/...)` link on any line of `docs/roadmap.md` and `docs/decisions/*.md`, not only for table rows and Source lines; every link on main resolved before this change.
- ADR-0026's Source line lost its parenthetical "PDS-50 once the backfill lands", which the id now leading the line makes untrue; the spec references in it are kept.
  Every other ADR changed only by the id and a comma on its Source line: 21 files, 21 insertions and 21 deletions.
- Concern 1: each edited ADR was grepped for a quote of chat or a dated attribution; none was found, so nothing else in an ADR changed.
- The roadmap also names the id before the first intent link of each "Now" item in prose (R1), not only in table rows; the Spec and Plan sub-bullets of constraint-floor are left, since its Folder line carries `PDS-24`.
  The ranked list, Detail, Dropped and Housekeeping sections are not "Now" items and keep their links as they were; the "Last updated" line is left to the builds ticking items.
- `AGENTS.md` is a symlink to `CLAUDE.md`, so one edit covers both.
- Beyond the file list, the docs and descriptions that named only the date form now name both: the pro-ai-sdlc description in both manifests and the marketplace entry, the `/intent` description, `plugins/pro-ai-sdlc/README.md`, `templates/incident.md`, `docs/spec-methods.md` and `docs/loop-records.md`.
  The descriptions changed, so the keyless routing floor was re-run.

## Noticed but not touched

- The eval scaffolds under `plugins/pro-ai-sdlc/evals/*/scaffold.sh` still say `intent/<date>-<slug>/`; each builds a fixture repo with no `intent/project.json`, where the date form is the true one.
- `plugins/pro-core/commands/pro-dev.md` (lines 181 and 193) names only `intent/<date>-<slug>/`; it is pro-core content and would need a pro-core bump.
- `demo/factory/new-demo.sh` writes a demo `intent/README.md` naming `<date>-<slug>/`; the demo repo has no shortcode.
- There is no `templates/adr.md` or `templates/intent.md` at the repo root; the only templates are under `plugins/pro-ai-sdlc/templates/`.
- ADR-0026's Where it is enforced still says none of it exists until the m1 to m4 builds land; its body is out of bounds for this module.
