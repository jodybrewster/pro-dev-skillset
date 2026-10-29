# Plan: behavioral, plugin and CI evals

Built from `spec.md` and `intent.md` in this folder.
Status: draft.
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

Filled in when the PR opens: each R ticked with its command output or file.

## Done

## Departures from plan
