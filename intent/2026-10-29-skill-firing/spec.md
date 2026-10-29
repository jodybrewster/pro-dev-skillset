---
intent: intent/2026-10-29-skill-firing/intent.md
intent-status: proposed
status: draft
created: 2026-10-29T14:20:00-0400
author: Jody Brewster
---

# Spec: make four discipline skills fire and prove it

Built from `intent.md` in this folder.
Status: draft.
Read: the four `SKILL.md` files, their plugin eval cases under `plugins/pro-execution/evals/` and `plugins/pro-quality/evals/`, `evals/cases/verification-before-completion.json`, `docs/evals.md`, the "Plugin evals" section of agent-skills' `evals/README.md` (commit eb07f19) and `claude plugin eval --help` (Claude Code 2.1.312), which documents an opt-in `scaffold_script` per case.
Stacked on PR 75 (the eval tiers) and the PR quality gate fix, because all three bump pro-quality.

## Measurement

Every number in this change comes from `claude plugin eval plugins/<plugin> --runs 3 --model sonnet --no-publish`, Claude Code 2.1.312, unless the run says otherwise.
"Fires" means the case's `tool_used: Skill` grader passed in the with-plugin arm.
The before numbers are taken on the cases as they stand on `feat/evals-three-tiers` before any edit here, then again on the sharpened cases with the old descriptions, so a grader change and a description change are never measured together.

## Requirements

### Cases

- R1. Each of the four fires cases has a reply grader that a plain reply fails on its own prompt:
  - `test-driven-development-fires`: the failing test is written and run (or shown failing) before the implementation;
  - `systematic-debugging-fires`: the prompt plants a tempting symptom fix (a guard at the crash site) where the real cause is upstream; the grader passes only a reply that names the upstream cause and does not ship the guard as the fix;
  - `verification-before-completion-fires`: runs in a scaffolded repo (`scaffold_script`) whose suite has one failing test the user's message does not mention; the grader passes only a reply that runs the suite and reports the failure;
  - `requesting-code-review-fires`: the prompt states a requirement the diff does not meet; the grader passes only a review that checks the diff against the stated requirements and flags the miss.
- R2. Each of the four skills gains a second stays-quiet case on an adjacent prompt that the new description wording could pull in (for example "explain what this function does" with code pasted), with `min: 0`, `max: 0`, `arm: both`.
- R3. The sharpened graders are measured with the old descriptions first; a reply grader that still passes in the without arm in 2 or more of 3 runs is reworked before any description changes.

### Descriptions and skill body

- R4. Each of the four descriptions keeps its "Use when" opening and the boundaries it states today, names the concrete requests it covers and says it applies when the code, diff, error or claim is pasted inline and the request does not name the skill; each stays under 1024 characters.
- R5. `verification-before-completion` opens its body with one rule ahead of everything else: before any statement that work is done, fixed or passing, run the project's full test or check command in this session and quote its result.
- R6. No other skill's description changes; `tests/cases/routing.jsonl` does not change.

### Targets

- R7. Each of the four fires cases fires in at least 2 of 3 runs.
  Its reply grader passes in more runs with the plugin than without (Δ above 0).
- R8. Every stays-quiet case in pro-execution, pro-quality and pro-pdd stays at 0 fires in 3 runs, in both arms.
- R9. `node tests/route-lexical.mjs --min-rank1 70` still passes with no collision at 0.75.
- R10. `node tests/behavioral.mjs verification-before-completion --baseline` scores at least 3 of 4 expectations in the skill arm.
- R11. A skill that misses R7 after two rounds of description changes keeps its best-measured wording and its numbers are recorded as a finding; the change does not keep iterating past that.
- R12. Total eval spend for this change stays under $15, read from each run's `costUsd`.

### Records

- R13. `docs/evals.md` gains a "Measured changes" section with a before and after table per skill: fires out of 3, reply grader with and without, model, Claude Code version and date.
- R14. pro-execution and pro-quality bump per the version-bump law with their `docs/releases.md` rows; the forks keep their footers and license rows.

## Out of scope

- Descriptions of the other 89 skills.
- `writing-plans`, which already fires.
- Running any live eval in CI.
