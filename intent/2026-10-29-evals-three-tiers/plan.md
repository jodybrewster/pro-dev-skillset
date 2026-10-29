# Plan: behavioral, plugin and CI evals

Built from `spec.md` and `intent.md` in this folder.
Status: built on 2026-10-29.
Approver: Jody Brewster.
Dated: 2026-10-29.
Branch: `feat/evals-three-tiers` off origin/main 50919a1, in the worktree `../pro-dev-skillset.evals`.

## Files that change

New:

- `tests/lib/catalog.mjs` (R1).
- `tests/route-lexical.mjs` (R2 to R5).
- `tests/cases/collisions-allowed.json` and `tests/cases/uncovered.json` (R5, R6).
- `tests/behavioral.mjs` and `tests/lib/trace.mjs` (R10 to R16).
- `tests/unit/*.test.mjs` (R8).
- `evals/cases/{test-driven-development,systematic-debugging,verification-before-completion}.json` and `evals/fixtures/<skill>/` (R9, R17).
- `plugins/pro-execution/evals/`, `plugins/pro-quality/evals/`, `plugins/pro-pdd/evals/`: ten case folders (R18, R19).
- `docs/evals.md` and `docs/decisions/0009-three-eval-tiers.md` (R23, R24).

Modified:

- `tests/eval.mjs` (R1), `tests/check.mjs` (`coverage` and `evals` checks, R6, R20).
- `.github/workflows/validate.yml` (R7), `.gitignore` (R15, R21).
- the three plugins' `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (R18, R22).
- `tests/README.md`, `docs/README.md`, `docs/decisions/README.md`, `CLAUDE.md`, `AGENTS.md` (R23, R24).

## Order of work

1. Extract `tests/lib/catalog.mjs` and switch `tests/eval.mjs` to it; `node tests/eval.mjs --dry` output is unchanged (R1).
2. Build `tests/route-lexical.mjs`, run it, record the baseline rank-1 and top-3 rates and every collision at 0.50 or above; list existing collisions over 0.75 in `collisions-allowed.json` with a reason each (R2 to R5).
3. Add the `coverage` check and seed `uncovered.json` with today's uncovered skills (R6).
4. Build `tests/behavioral.mjs` with `tests/lib/trace.mjs`, then the three case files and fixtures; prove `--dry-run`, then one live run of each eval with `--baseline`, keyed from `MIERUKA_ANTHROPIC_API_KEY` (R9 to R17).
5. Write the ten plugin eval cases, add the `evals` check, the manifest key and the version bumps; run `claude plugin eval plugins/<p> --runs 1` once per plugin (R18 to R22).
6. Write the unit tests and wire both CI steps with the floor from step 2 (R7, R8).
7. Write `docs/evals.md`, the ADR and the pointers (R23, R24).

Steps 2 and 3, step 4 and step 5 touch disjoint files after step 1, so three Sonnet subagents build them in parallel; Opus reviews and runs the live checks.

## Tests that prove it

- `node tests/check.mjs && node tests/eval.mjs --dry` pass, with the new `coverage` and `evals` checks listed.
- `node tests/route-lexical.mjs --min-rank1 <floor>` exits 0; lowering a description to a single word for a covered skill makes it exit 1 (checked by hand, then reverted).
- `node --test tests/unit/` passes.
- `node tests/behavioral.mjs --dry-run` validates every case; one live `--baseline` run per eval leaves graded JSON in `evals/results/`.
- `claude plugin eval plugins/<p> --runs 1` completes for each of the three plugins.
- `claude plugin validate . --strict` and the per-plugin loop pass.

## Risks

- The lexical rank-1 rate on prompts written for an LLM router may be low; the floor is set from the measured number. A low number is reported as a finding rather than gamed by editing prompts.
- Forked skills with near-identical descriptions may trip the collision check on day one; they go in the allow list with a reason.
- Skill firing is stochastic; plugin eval numbers are read from the report and Δ, never as a CI pass or fail.

## Options not taken

- Running the live tiers in CI: the repo has no API secret and each run costs tokens.
- Putting plugin eval cases under a root `evals/`: `claude plugin eval` reads cases from inside the plugin.
- Porting `run-evals.js`: it is CommonJS and one file for all tiers; ours follows `tests/` conventions.

## Proof of done

- R1: `node tests/eval.mjs --dry` output is byte-identical before and after the extraction to `tests/lib/catalog.mjs`.
- R2 to R5: `node tests/route-lexical.mjs --min-rank1 70` exits 0 in about 0.1s: rank-1 60 of 79 (75.9%), top-3 73 of 79 (92.4%), 0 collisions at 0.75, 16 warnings between 0.50 and 0.75, 3 `notOneOf` warnings.
- R6: `node tests/check.mjs eval-coverage` passes with 25 skills in `tests/cases/uncovered.json`; the full run is `✓ 28 checks · 0 failures · 13 warnings`.
- R7, R8: both steps are in `validate.yml`; `node --test tests/unit/*.test.mjs` passes 20 of 20.
- R9 to R17: `node tests/behavioral.mjs --dry-run` validates 3 case files and 4 evals; a live `--baseline` run (Sonnet) scored 12 of 16 expectations with the skill and 10 of 16 without. `test-driven-development` #1 went from 2 of 4 to 4 of 4. `verification-before-completion` scored 1 of 4 in both arms: the agent never ran the suite and missed the broken import in `src/report.js`.
- R18 to R22: `claude plugin eval plugins/<p> --runs 1 --model sonnet` completed for all three plugins (Claude Code 2.1.312, $0.78 in total). `writing-plans` fired and its reply graders went from 0 to 2 (Δ 1). The other four fires cases did not fire the skill on a natural prompt; every stays-quiet case stayed quiet. The `evals` check fails on a regex that does not compile and on an `evals/` folder without the manifest key (checked by hand, then removed). Strict validation passes for the marketplace and the three plugins.
- R23, R24: `docs/evals.md`, ADR-0009 and the pointers in `docs/README.md`, `docs/decisions/README.md`, `tests/README.md` and `CLAUDE.md` (which `AGENTS.md` links to).

## Done

Built on 2026-10-29 on `feat/evals-three-tiers`.
Findings for later changes, not fixed here:
- `test-driven-development`, `systematic-debugging`, `verification-before-completion` and `requesting-code-review` did not fire on a natural prompt in one run each; their descriptions are the lever, as agent-skills found.
- The reply graders for review, verification and debugging passed in both arms, so they do not yet separate the skill from a capable model; they need a sharper trap.
- `verification-before-completion` did not make the agent run the suite even with the skill appended.
- Three `notOneOf` boundaries overlap lexically: "Review my pull request" ranks `interface-review` first, the WCAG audit ranks `web-design-guidelines` and "eight boolean props" ranks `shadcn-ui-composition`.

## Departures from plan

- R4: a `notOneOf` miss in the lexical tier is a warning, not a failure. All three such cases failed on day one and they test meaning that word overlap cannot see.
- R7: the floor is 70 rather than 75. The baseline is 75.9%, so 75 left under one point of headroom and a single new case would have failed CI.
- R7: CI runs `node --test tests/unit/*.test.mjs`, because Node 22 reads a bare directory argument as a module path.
- The `requesting-code-review` severity regex was tightened to labels and headings, so a passing mention of "minor" does not count.
