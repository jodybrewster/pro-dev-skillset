# Plan m2: the reviewer's model on the record

Built from `spec-m2.md` and `intent.md` in this folder, committed with them.
Status: approved (pre-approved on 2026-11-07).
Approver: the engineer; no lead needed, the change adds fields to existing records and starts its one deny path in warn, each with behavior cases.
Dated: 2026-11-07.

One pull request on its own worktree, branch `build/reaching-done-m2`, built after m1 merges because `lessons.py round` comes from m1.
It bumps three plugins to their next minor version from main at build time: pro-ship (0.17.0 after m1, which makes 0.18.0), pro-ai-sdlc (0.17.0 after m1, which makes 0.18.0) and pro-quality (0.21.0 after m1, which makes 0.22.0), plus one minor bump of `metadata.version` (1.93.0 after m1, which makes 1.94.0), in each commit that changes plugin content.
When another PR lands a bump first, rebase and take the next free minor.

## Files that change

- `REVIEW.md` (modified): the `## Review model` section with `claude: opus` and `codex: any`.
- `plugins/pro-ai-sdlc/templates/REVIEW.md` (modified): the same section for every repo.
- `plugins/pro-ship/scripts/pr-check.py` (modified): `review_model(root, host)`, `family`, `model_mode`, the `review-model` subcommand, `host`, `model` and `model_ok` in `reviewer_record`, the result rule and the two marker fields.
- `plugins/pro-ship/scripts/ship.py` (modified): the optional `model=` and `host=` in `MARKER` and `parse_marker`, `model_mismatch` and `model_unrecorded` in coverage, the reviewer check in `validate_report`.
- `plugins/pro-ship/skills/pr-check/SKILL.md` and `plugins/pro-ship/skills/ship/SKILL.md` (modified): ask `review-model`, name the family at dispatch, pass host and model on.
- `plugins/pro-ai-sdlc/commands/execute.md` (modified): stage 8 appends the line from `pr-check.py marker` to the PR body when pro-ship is installed.
- `plugins/pro-ai-sdlc/scripts/factory.py` (modified): `body` in the `verify` view and the marker check for the build phase.
- `plugins/pro-ai-sdlc/scripts/lessons.py` (modified): `round --model --host`.
- `plugins/pro-ai-sdlc/agents/reviewer.md`, `plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml`, `plugins/pro-quality/agents/code-reviewer.md`, `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` (modified): the closing `model:` line with the host.
- `plugins/pro-ai-sdlc/commands/review.md`, `plugins/pro-ai-sdlc/skills/doubt-driven-development/SKILL.md` (modified): ask `review-model` with pro-ship installed, else read the tip's `REVIEW.md` with `git show`; both name the required model at dispatch.
- Both manifests of pro-ship, pro-ai-sdlc and pro-quality and `.claude-plugin/marketplace.json` (modified): the bumps.
- `docs/pr-check-stamp.md` (modified): `host`, `model` and `model_ok` in the reviewers table, the warn and enforce rule and the marker fields.
- `docs/loop-records.md` (modified): `model` and `host` in the review round.
- `docs/enforce-mode.md` (modified): the `review-model` row.
- `tests/fixtures/pr-check-stamp/` (modified): a Sonnet stamp, a stamp with no model and a Codex stamp.
- `tests/ship-check.mjs`, `tests/ship-preflight.mjs`, `tests/factory.mjs`, `tests/lessons.mjs`, `tests/mieruka-sync.mjs` (modified): the cases below.
- `tests/check.mjs` (modified): `stamp-contract` knows the new fields; a `review-model` check holds the three copies of `family`, `model_mode` and the `REVIEW.md` reader to one fixture; `sdlc-contract` asserts the `model:` line and the marker step in `execute.md`.
- `docs/roadmap.md` (modified): item 36 ticked with the PR.

## Order of work

1. Failing cases in `tests/ship-check.mjs` with `CLAUDE_GUARD_DIR` pointing at a temp folder: a `claude` code reviewer on `claude-sonnet-4-5` gives `model_ok: false`, the warn line and `pass` in warn, `incomplete` with `mode.review-model` holding `enforce`; `claude-opus-5-5` gives `pass` in both; no `model` gives `model_ok: false`; a `codex` reviewer passes under `codex: any` and gets `model_ok: null` and the note with no `codex` entry, in both modes; `review-model --host claude` reads the tip and ignores a feature-branch `REVIEW.md`; the marker carries `model=` and `host=` (size S; R2 to R4, R7 to R11, AC1 to AC6)
2. `pr-check.py`: `review_model(root, host)` reads `REVIEW.md` from the default branch tip with `git show` and falls back to `claude: opus`; `family(model)`; `model_mode()` reads only `mode.review-model`; the `review-model` subcommand; `reviewer_record` takes `host` and `model` and sets `model_ok`; `compute_result` treats `model_ok: false` as `incomplete` only in enforce; `cmd_marker` adds the two fields (size M; R2 to R4, R7 to R11)
   Checkpoint: `node tests/ship-check.mjs` passes; `docs/pr-check-stamp.md` and the fixtures updated; `node tests/check.mjs stamp-contract` passes.
3. `REVIEW.md` and the template gain `## Review model` with a fenced `yaml` block `claude: opus` and `codex: any` (size XS; R1)
4. Failing cases in `tests/ship-preflight.mjs`, then `ship.py`: `MARKER` accepts optional `model=` and `host=`; `cmd_coverage` fills `model_mismatch` and `model_unrecorded` and leaves a mismatched commit uncovered only in enforce; `validate_report` refuses a GO with a mismatched `done` reviewer only in enforce and otherwise adds the note to the summary (size M; R13, R14, R16, AC7, AC8)
   Checkpoint: `node tests/ship-preflight.mjs` and `node tests/ship-hooks.mjs` pass, which shows pr-gate still reads the marker.
5. `execute.md` stage 8: after pr-check writes its stamp, append the line from `pr-check.py marker` to the PR body when pro-ship is installed; `sdlc-contract` asserts it (size XS; R17, AC10)
6. Failing cases in `tests/factory.mjs`, then `factory.py verify`: add `body` to the existing `gh pr view` fields; for the build phase, when `find_script` finds pro-ship's `pr-check.py`, raise to level 2 on no marker and check the marker's family against the tip's `REVIEW.md` for its host, raising only in enforce; without `pr-check.py` add the note and raise nothing for the marker (size M; R18, AC9)
7. The `review-model` check in `tests/check.mjs`: run the copies of `family`, `model_mode` and the reader in `pr-check.py`, `ship.py` and `factory.py` on one fixture list and fail on any difference (size S; spec System)
   Checkpoint: `node tests/factory.mjs` and `node tests/check.mjs` pass.
8. The closing `model:` line with the host in `reviewer.md`, `code-reviewer.md` and both twins; the pr-check skill and the ship skill ask `pr-check.py review-model`; `review.md` and `doubt-driven-development/SKILL.md` ask it when pro-ship is installed and otherwise read `## Review model` with `git show origin/HEAD:REVIEW.md` and say so in their report; all of them name the required model at dispatch and pass host and model into `--reviewers` and `report.json`; `sdlc-contract` asserts the line (size S; R5, R6, R15)
9. `lessons.py round --model --host` writes both keys into `detail_json`; `docs/loop-records.md` adds them; `tests/lessons.mjs` and `tests/mieruka-sync.mjs` cover it (size S; R12, AC11)
10. The `review-model` row in `docs/enforce-mode.md` (warn start, its own evidence period, the accepted limit that the model is self-reported), the bumps and the roadmap tick for 36 (size XS; N2, N3, N4)
    Checkpoint: the full proof of done below (AC12).

No step is irreversible.

## Tests that prove it

- `tests/ship-check.mjs` covers the stamp in warn and enforce for Opus, Sonnet, no model and a Codex reviewer with and without a `codex` entry, the `review-model` subcommand and the marker fields.
- `tests/ship-preflight.mjs` covers coverage with three markers in both modes and the GO refusal in enforce only.
- `tests/factory.mjs` covers verify with and without pro-ship's `pr-check.py`, a missing marker and a mismatched family in both modes, with a fake `gh` that serves a PR body.
- `tests/lessons.mjs` and `tests/mieruka-sync.mjs` cover `model` and `host` in the review record.
- The `review-model` check holds the three copies to one fixture list.
- A hand run of `/execute` on a demo plan proves the marker in the PR body (AC10).

## Risks

Step 2 is the most likely to go wrong: every pr-check stamp now records a model; a skill that forgets to pass one prints a warn line on every PR.
The guards are step 8 landing in the same PR, the `sdlc-contract` assertion and the warn start; in enforce a forgotten model turns the stamp `incomplete`, which is why enforce waits for its evidence period.
Step 6 adds a level 2 raise for a missing marker, which would stop every factory build until step 5 has landed in the image; both are in this PR and the image is rebuilt from the plugin version.
Step 4 changes coverage; old markers stay covered (R14) and a mismatch only uncovers in enforce, which bounds it.
Step 3 edits `REVIEW.md`, a policy path, which would stop a factory run of this module at level 3; this module is built by a person.
Nothing here is irreversible.

Stop-list categories: none; the plan reads and writes local records and PR bodies it already reads, with no auth, migration, payment, deploy or secret handling.

## Options not taken

- One PR per plugin: the stamp, its marker, `/execute` and the readers change together; a split leaves a reader that cannot parse the writer.
- A shared module for `family` and the reader: plugins do not import each other (ADR-0003), which leaves three copies under one check.
- One model for every host: a Codex twin would always be refused.
- `fail` on a mismatch: `incomplete` already blocks pr-gate and tells the person to run the review again.

## Proof of done

```
node tests/check.mjs                         # 0 failures, review-model and stamp-contract pass
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70
node --test tests/unit/*.test.mjs
node tests/ship-check.mjs
node tests/ship-preflight.mjs
node tests/ship-hooks.mjs
node tests/factory.mjs
node tests/lessons.mjs
MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs
python3 plugins/pro-ship/scripts/pr-check.py review-model --host claude   # {"host": "claude", "required": "opus", ...}
claude plugin validate . --strict            # Validation passed
claude plugin validate plugins/pro-ship --strict
claude plugin validate plugins/pro-ai-sdlc --strict
claude plugin validate plugins/pro-quality --strict
```

## Done

Done as of 550e27689883

- Build commit: 550e27689883 on `PDS-52/build-m2`, based on origin/main at 3af9bdd.
- Checks run: `node tests/check.mjs` 51 checks, 0 failures, 13 warnings (all existing: Codex counterparts of pro-research agents, routing cases for subagents, one pro-egm eval prompt, the router and the deployed skill); `node tests/eval.mjs --dry` 99 cases reference real skills; `node tests/route-lexical.mjs --min-rank1 70` rank-1 80/98 (81.6%); `node --test tests/unit/*.test.mjs` pass 200, fail 0; `node tests/ship-check.mjs` 272/272; `node tests/ship-preflight.mjs` 103/103; `node tests/ship-hooks.mjs` 355/355; `node tests/factory.mjs` 184/184; `node tests/lessons.mjs` 102/102; `MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs` passed with review-round among the records; `python3 plugins/pro-ship/scripts/pr-check.py review-model --host claude` printed `{"host": "claude", "required": "opus", "source": "default"}` (the tip has no section until this merges); `claude plugin validate . --strict` and each of pro-ship, pro-ai-sdlc and pro-quality: Validation passed.
- Definition of done: met except the hand run of `/execute` in AC10.
- Visual: none
- Doubt: none
- AC1: ship-check rm1 and rm1b: a Sonnet code review in warn gives `model_ok: false`, status `done`, the warn line, a `review-model` line in `warn.log` and `pass`.
- AC2: rm2 gives `incomplete` under `mode.review-model` enforce; rm2b shows the global `mode` file leaves it in warn; rm3 gives `pass` on `claude-opus-5-5` in both modes.
- AC3: rm4 and rm4b: no model gives `model_ok: false` with the warn line in warn and `incomplete` in enforce.
- AC4: rm5 covers `codex: any`, the exact id and a different id (true, true, false); rm6 gives `model_ok: null`, the note and `pass` in warn and in enforce with no codex entry.
- AC5: rm9 prints `opus` with source `main:REVIEW.md` while the feature branch's `REVIEW.md` names sonnet; rm9c shows a working-tree edit changes nothing.
- AC6: rm10 prints `model=opus host=claude`, rm10b `model=none`, rm10c `model=gpt-5.1-codex host=codex`.
- AC7: ship-preflight model cases list PR 2 under `model_mismatch` with `review ran on sonnet (claude)` and PR 3 under `model_unrecorded`; every commit is covered in warn and PR 2's two commits are uncovered in enforce.
- AC8: record refuses the Sonnet GO in enforce with no record written and records it in warn with `, review ran on sonnet (claude)` in the summary.
- AC9: factory v37 raises to level 2 with `no pr-check marker`; v38 passes with only the note `pr-check not installed, reviewer model not checked`; v39 notes the Sonnet marker in warn and v40 raises it to level 2 in enforce.
- AC10: `sdlc-contract` asserts that stage 8 names `pr-check.py marker` and appends its line; the hand run of `/execute` on a demo plan was not done in this build.
- AC11: lessons round cases write `model: claude-opus-5-5`, `host: claude` and `model_ok: true`; `tests/mieruka-sync.mjs` loads the round written with `--model` and `--host`.
- AC12: `node tests/check.mjs`, `node tests/eval.mjs --dry` and `claude plugin validate . --strict` pass as above.
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 2: `stamp` reads a reviewer with no `host` as `claude` and refuses any host but `claude` and `codex`: an unknown host cannot skip the rule.
  A `model` must be a model id of at most 100 letters, digits and `._:/@[]-` characters; the stamp refuses anything else because the marker carries it.
- Step 2: `model_ok` is null for a reviewer that did not run (`skipped-no-surface`, `not-installed`, `could-not-run`); R8 judges only `done` and `inline`.
- Step 2: each warn or enforce line also lands in `warn.log` under the gate name `review-model`, which is the evidence the `docs/enforce-mode.md` row reads; a note line for a host with no rule does not.
- Step 2: the marker of a `claude` model whose id names no family carries the id itself: `/ship` and verify then read it as a mismatch rather than a family.
- Step 2: the result rule in `docs/pr-check-stamp.md` is renumbered; the model rule is rule 2, after a missing run record and before `pass`.
- Steps 2 and 7: three new stamp fixtures, `review-model-sonnet-warn.json`, `review-model-none-enforce.json` and `review-model-codex-host.json`, with their `expect.json` rows; `valid-pass.json` and `valid-pass-codex.json` gain `host`, `model` and `model_ok`.
- Steps 6, 7 and 9: pro-ai-sdlc's copy of the reader is its own module, `scripts/reviewmodel.py`, which `factory.py` and `lessons.py` import, instead of a copy inside `factory.py`.
  The `review-model` check holds the block in `pr-check.py`, `ship.py` and `reviewmodel.py` byte for byte and runs each copy on `tests/fixtures/review-model/cases.json`.
- Step 8 (R5): `/review` and the doubt step ask `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/reviewmodel.py" --host <host>` instead of `pr-check.py review-model` with pro-ship installed and `git show origin/HEAD:REVIEW.md` without it.
  It prints the same JSON from the same tip with the checked block, needs no pro-ship and leaves no yaml for the session to parse.
  There is no "pro-ship not installed" path left to report.
- Step 9: the review-round record also carries `model_ok`, judged by `reviewmodel.py` against the tip, beside R12's `model` and `host`; `--host` defaults to `claude` and a missing `--model` records null and `model_ok` false.
- Step 6: two markers in the body raise with `more than one pr-check marker`; a marker written before this change passes with the note `the pr-check marker records no reviewer model`.
  `verify` gains a `notes` list in its JSON, printed as `note:` lines; `run` prints each as a `factory: note,` line on stderr.
  The tests serve every build PR a body that ends with an Opus marker as `/execute` now writes one; they point `CLAUDE_GUARD_DIR` at the stub folder.
- Step 4 (R16): `reviewers` in `report.json` is a list of `{agent, status, host, model}`; a reviewer with no host reads as `claude` and a `done` reviewer with no model is a mismatch, as in the stamp.
  A NO-GO is recorded in enforce too, with the note in its summary.
- Step 8: a reviewer's closing line names the model it ran on and wins over the dispatch model when the two differ, since the host ran it; the skills say to report the difference.

## Noticed but not touched

- `/execute`'s `allowed-tools` has no `python3` entry for pro-ship's scripts: `pr-check.py marker` asks once per run as the pr-check steps it follows already do.
- `pro-security:security-architect` has no closing `model:` line (R6 names the two code reviewers); pr-check and `/ship` record its dispatch model.
