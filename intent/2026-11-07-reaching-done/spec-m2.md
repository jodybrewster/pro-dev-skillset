---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T14:00:00-0500
author: the maintainer
module: m2
---

# Spec m2: the reviewer's model on the record

Built from `intent.md` in this folder, committed with it, module m2 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, ADR-0002, ADR-0004, ADR-0014, ADR-0016, ADR-0022, ADR-0023, ADR-0024, `docs/pr-check-stamp.md`, `docs/loop-records.md`, `docs/enforce-mode.md`, `plugins/pro-ship/scripts/pr-check.py`, `plugins/pro-ship/scripts/ship.py`, `plugins/pro-ship/skills/pr-check/SKILL.md`, `plugins/pro-ship/skills/ship/SKILL.md`, `plugins/pro-ai-sdlc/scripts/factory.py`, `plugins/pro-ai-sdlc/commands/execute.md`, `plugins/pro-ai-sdlc/templates/REVIEW.md`, [spec-m1.md](./spec-m1.md).

## Summary

Every review now says which host and which model ran it.
`REVIEW.md` names the rule reviews must meet per host: the Opus family under Claude Code in this repo, any model under Codex.
The pr-check stamp, its PR-body marker, the `/ship` report and m1's review record carry the host and model of each reviewer.
A review that misses its host's rule is flagged on every record with `model_ok: false` and a warn line.
Under `mode.review-model` set to enforce, the stamp turns `incomplete`, `/ship` counts the PR as uncovered and refuses a GO and `factory.py verify` raises the run to level 2.
The Opus-to-Sonnet override the retest found can no longer pass unseen.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. The review record gains `model` and `findings`; m1 adds `findings` and this module adds `model`.
2. `REVIEW.md` names no model today; every Claude reviewer agent in the marketplace declares `model: opus` in frontmatter, while each Codex twin runs on whatever model the Codex host gives it.
3. A session can override the model at dispatch and nothing records the override today.
4. `/execute` stage 8 runs pr-check when pro-ship is installed; the PR body it writes does not carry the pr-check marker today (`plugins/pro-ai-sdlc/commands/execute.md`, stage 8); pro-ship may be absent.
5. Claude model ids compare by family: `opus`, `sonnet`, `haiku` or `fable`.
   A `codex:` entry is `any` or an exact model id string compared verbatim; families apply to Claude only.
6. The hosts are `claude` and `codex`.

## Requirements

### Functional

The required model (intent: "the model REVIEW.md names"):

- R1. `REVIEW.md` gains a `## Review model` section with a fenced `yaml` block that maps each host to its rule (a family for `claude`, `any` or an exact id for `codex`): `claude: opus` and `codex: any`; `plugins/pro-ai-sdlc/templates/REVIEW.md` gains the same section.
- R2. The required model is read from `REVIEW.md` on the default branch tip, never from the branch under review; a missing or unreadable section means `claude: opus` and no entry for any other host.
- R3. For `claude` the family of a model id is the first of `opus`, `sonnet`, `haiku` and `fable` it contains, lowercase; the requirement is met when the families are equal.
  For `codex` the entry is `any` or an exact model id, compared verbatim with the reported id.
  `any` matches every model, a Claude id with no family matches only `any` and a host with no entry has no requirement.
- R4. `pr-check.py review-model [--host claude|codex]` prints `{"host": ..., "required": ..., "source": "<ref>:REVIEW.md" | "default"}` read from the default branch tip.
- R5. Every caller that dispatches a reviewer names the required model for its host at dispatch: `/review`, the pr-check skill, the ship skill and `/execute`'s doubt step.
  With pro-ship installed they ask `pr-check.py review-model`.
  Without it, `/review` and the doubt step read `## Review model` from `git show origin/HEAD:REVIEW.md` and say in their report that pro-ship was not installed; no caller reads `REVIEW.md` from the working tree for this.

Recording the model (intent: "the reviewer's model recorded in the review record and the pr-check stamp"):

- R6. `reviewer.md`, `code-reviewer.md` and both Codex twins end every report with one line, `model: <the model id the agent runs on>  host: <claude or codex>`.
- R7. `pr-check.py stamp` takes `host` and `model` in each `--reviewers` entry and writes `reviewers.code` and `reviewers.security` with `host`, `model` (string or null) and `model_ok`.
- R8. `model_ok` is `true` when the model meets the host's rule (a family for `claude`, `any` or an exact id for `codex`), `false` when a `done` or `inline` reviewer has no model or a model that misses the rule and `null` when the host has no entry in `REVIEW.md`.
- R9. A host with no entry records its model, prints `pr-check: note, <which> review ran on <model> (<host>), REVIEW.md names no model for <host>` and never refuses in either mode.
- R10. The mismatch has its own mode key, `mode.review-model`, read only from that file in the guard folder, warn by default.
  In warn a `model_ok: false` reviewer keeps `status` `done`, the result is computed as if the model matched and `stamp` prints `pr-check: warn, <which> review ran on <model> (<host>), REVIEW.md names <required>`.
  In enforce a `model_ok: false` reviewer makes the stamp's `result` `incomplete` with the same line.
- R11. The marker line gains two fields: `<!-- pro-ship:pr-check head=<sha> result=<result> tier=<tier> model=<family> host=<host> -->`, from the code reviewer: the family for `claude`, the model id for `codex` and `none` when there is no model.
- R12. `lessons.py round` takes `--model <id>` and `--host <host>` and writes both into the review record's `detail_json`; `docs/loop-records.md` adds the keys.

Acting on a review on the wrong model (intent: "/ship and factory verify refusing a stamp whose review did not run on the model REVIEW.md names"):

- R13. `ship.py coverage` reads `model=` and `host=` from each marker; a model that misses the host's rule (a family for `claude`, `any` or an exact id for `codex`) lists the PR under `model_mismatch` with `review ran on <family> (<host>)`.
  In enforce that commit is uncovered; in warn it stays covered.
- R14. A marker written before this change has no `model=` field; it counts as covered and the coverage output lists its PR under `model_unrecorded`.
- R15. `/ship` reads a stamp for HEAD to skip the repo's checks only when its `result` is `pass`.
- R16. The ship skill records `host` and `model` for each specialist it dispatches in `report.json` under `reviewers`.
  `ship.py record` in enforce refuses a GO with a `done` reviewer whose model misses the host's rule; in warn it records the GO and adds `review ran on <family> (<host>)` to the summary.
- R17. `/execute` stage 8 appends the line printed by `pr-check.py marker` to the PR body when pro-ship is installed and pr-check wrote a stamp.
- R18. `factory.py verify build` reads the PR body through the `gh pr view` call it already makes.
  When pro-ship's `pr-check.py` is found next to pro-ai-sdlc and the body has no marker, it raises the run to level 2 with `no pr-check marker`.
  When the marker's model misses the host's rule, it adds `the review ran on <family>, REVIEW.md names <required>`, raising to level 2 only in enforce and as a note in warn.
  When `pr-check.py` is not found, it adds the note `pr-check not installed, reviewer model not checked` and raises nothing for the marker.

### Non-functional

- N1. No reader makes a new network call: `factory.py` adds `body` to its existing `gh pr view` fields and `ship.py coverage` already reads PR bodies.
- N2. `schema` stays 1 in the stamp, the preflight record and the review record; every new field is optional for readers.
- N3. Each plugin change bumps its version in both manifests and its marketplace entry, plus `metadata.version`, in the same commit.
- N4. `docs/enforce-mode.md` gains a `review-model` row with its warn start and its evidence period.

### Policy constraints applied

- ADR-0016: the mismatch starts in warn under its own `mode.review-model`, the pattern m3 uses for `mode.confirmation`; only that file turns it to enforce (R10).
- ADR-0004: the rule is per host; a Codex twin is never refused for not being Opus (R1, R3, R9).
- ADR-0014: the stamp keeps one writer; `host`, `model` and `model_ok` are fields like the others and a forged value passes a local guardrail as a forged stamp does.
- ADR-0022: the preflight record gains no top-level field; `reviewers` goes inside `detail_json`.
- ADR-0023: the review record gains optional keys; `docs/loop-records.md` and `tests/mieruka-sync.mjs` change with it.
- ADR-0024: verify only ever raises the level (R18).

### Boundaries

Always: read the required model from the default branch tip, through `pr-check.py review-model` with pro-ship installed or `git show origin/HEAD:REVIEW.md` without it, record host and model per reviewer, keep old markers readable, start in warn.
Ask first: changing a host's rule in `REVIEW.md`, setting `mode.review-model` to enforce.
Never: read the required model from the branch under review, treat a missing model as a match, refuse a host that has no entry.

## Design

### User experience

A person running `/pro-ship:pr-check` sees the host and model beside each reviewer.
A review that misses its host's rule prints one warn line; under enforce the stamp is `incomplete` with the same line.
`/ship` lists a PR reviewed on Sonnet under `model_mismatch` and under enforce reviews its commits again.
A factory build whose PR has no marker stops at level 2 when pro-ship is installed.

### System

- `REVIEW.md` and `plugins/pro-ai-sdlc/templates/REVIEW.md`: the `## Review model` section.
- `plugins/pro-ship/scripts/pr-check.py`: `review_model(root, host)`, `family(model)`, `model_mode()`, the `review-model` subcommand, `host`, `model` and `model_ok` in `reviewer_record`, the result rule and `cmd_marker`.
- `plugins/pro-ship/scripts/ship.py`: `MARKER` and `parse_marker` with the optional fields, `cmd_coverage`, `validate_report`.
- `plugins/pro-ship/skills/pr-check/SKILL.md` and `plugins/pro-ship/skills/ship/SKILL.md`: ask `review-model`, name the host's required model at dispatch and pass host and model on.
- `plugins/pro-ai-sdlc/commands/execute.md`: stage 8 appends the marker.
- `plugins/pro-ai-sdlc/scripts/factory.py`: the marker check in `verify` for the build phase.
- `plugins/pro-ai-sdlc/scripts/lessons.py`: `round --model --host`.
- `plugins/pro-ai-sdlc/agents/reviewer.md`, `plugins/pro-quality/agents/code-reviewer.md` and their Codex twins: the closing `model:` line.
- `plugins/pro-ai-sdlc/commands/review.md`, `plugins/pro-ai-sdlc/skills/doubt-driven-development/SKILL.md`: ask `review-model` with pro-ship installed, else read `## Review model` with `git show origin/HEAD:REVIEW.md`; both name the host's required model at dispatch.
- `docs/pr-check-stamp.md`, `docs/loop-records.md`, `docs/enforce-mode.md`, `tests/fixtures/pr-check-stamp/`.
- Tests: `tests/ship-check.mjs`, `tests/ship-preflight.mjs`, `tests/factory.mjs`, `tests/lessons.mjs`, `tests/mieruka-sync.mjs`, the `stamp-contract`, `sdlc-contract` and `review-model` checks.

`family`, `model_mode` and the `REVIEW.md` reader are written once in `pr-check.py` and copied into `ship.py` and `factory.py`, because plugins do not import each other; a `review-model` check in `tests/check.mjs` holds the copies to one fixture set.

### Alternatives considered

- Trust only the agent frontmatter: it is the default that the override in the retest bypassed.
- Trust only the agent's own `model:` line: an agent can misname itself; the caller's dispatch model is the first source and the line is the second.
- One model for every host: a Codex twin can never run on Opus, which would refuse every Codex review.
- Refuse from the first day: ADR-0016 starts every new deny path in warn.
- Treat old markers with no model as uncovered: every past release would be reviewed again on the first `/ship` after the update.

## Flagged concerns

ADR needed: no, this adds fields to records whose contracts ADR-0014, ADR-0022 and ADR-0023 already allow to grow and starts its one deny path in warn under ADR-0016.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The model is reported by the caller and the agent; a session could write a false one | ADR-0014 | resolved on 2026-11-07: accepted for a local guardrail as a forged stamp is; the field catches the honest override the retest showed |
| 2 | Old markers carry no model | ADR-0022 | resolved on 2026-11-07: they count as covered and are listed under `model_unrecorded` (R14) |
| 3 | A branch could lower the required model in its own `REVIEW.md` | REVIEW.md | resolved on 2026-11-07: readers ask `pr-check.py review-model`, which reads the default branch tip (R2, R4) |
| 4 | `REVIEW.md` changes are policy paths, which raise a factory run of this module to level 3 | ADR-0024 | resolved on 2026-11-07: this module is built by a person, not the factory |
| 5 | Codex twins run on Codex models; an Opus-only rule would refuse every Codex review | ADR-0004 | resolved on 2026-11-07: `## Review model` names a family per host; Codex is `any` here and a host with no entry is recorded and never refused (R1, R3, R9) |
| 6 | A model mismatch is a new deny path in pr-check, `/ship` and verify | ADR-0016 | resolved on 2026-11-07: its own `mode.review-model`, warn by default with a `docs/enforce-mode.md` row; warn records `model_ok: false` and a line (R10) |
| 7 | A factory build PR carries no marker today and pro-ship may be absent, also for `/review` and the doubt step that would ask pro-ship for the model | ADR-0024, ADR-0003 | resolved on 2026-11-07: `/execute` appends the marker when pro-ship is installed and verify raises for a missing marker only then; without pro-ship `/review` and the doubt step read `## Review model` with `git show origin/HEAD:REVIEW.md` and say so in their report (R5, R17, R18) |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. In warn, `pr-check.py stamp` with a `claude` code reviewer `done` on `claude-sonnet-4-5` writes `model_ok: false`, keeps `status` `done`, prints the warn line from R10 and gives `pass` when all else passes.
- AC2. With `mode.review-model` holding `enforce`, the same stamp gives `result` `incomplete`; on `claude-opus-5-5` it gives `pass`.
- AC3. A `done` reviewer with no `model` gets `model_ok: false`: a warn line in warn, `incomplete` in enforce.
- AC4. A Codex twin run: a stamp whose code reviewer is `host: codex` on a Codex model gets `model_ok: true` under `codex: any`, `true` under a `codex:` entry with that exact id and `false` under a different exact id; with the `codex` entry removed from the fixture `REVIEW.md` it gets `model_ok: null`, prints the note from R9 and is never `incomplete`, in warn or in enforce.
- AC5. `pr-check.py review-model --host claude` prints `opus` with the default tip as source; a feature branch whose `REVIEW.md` sets `claude: sonnet` prints the same.
- AC6. `pr-check.py marker` prints `model=opus host=claude` for an Opus stamp and `model=none` for a stamp with no code model.
- AC7. `ship.py coverage` on a fixture with three PRs (marker `model=opus host=claude`, marker `model=sonnet host=claude`, marker with no model) lists the second under `model_mismatch` and the third under `model_unrecorded`; the second is covered in warn and uncovered in enforce.
- AC8. `ship.py record` in enforce refuses a GO whose report lists a `done` `claude` reviewer on Sonnet; in warn it records the GO with the note in its summary.
- AC9. `factory.py verify build` with pro-ship's `pr-check.py` found and no marker in the body raises to level 2 with `no pr-check marker`; with `pr-check.py` not found it adds only the note `pr-check not installed, reviewer model not checked`; with `model=sonnet host=claude` it notes the mismatch in warn and raises to level 2 in enforce.
- AC10. `/execute` stage 8 names `pr-check.py marker` and appends its line to the PR body when pro-ship is installed, asserted by `sdlc-contract`; a hand run of `/execute` on a demo plan opens a PR whose body ends with the marker line.
- AC11. `lessons.py round --model claude-opus-5-5 --host claude` writes both keys into the record and `tests/mieruka-sync.mjs` still loads it.
- AC12. `node tests/check.mjs`, `node tests/eval.mjs --dry` and `claude plugin validate . --strict` pass.

## Out of scope

- Model checks for test-engineer, the web performance auditor and the legal reviewer, which inform and never block.
- A model ladder or router, which super-board has and this repo skips on purpose.
