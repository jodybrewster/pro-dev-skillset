# Plan: evals for pro-ai-sdlc and pro-egm

Built from `spec.md` and `intent.md` in this folder.
Status: built on 2026-10-29.
Approver: Jody Brewster.
Dated: 2026-10-29.
Branch: `feat/sdlc-egm-evals`, stacked on `feat/skill-firing` (PR 77).

## Files that change

- `plugins/pro-ai-sdlc/evals/`: about eleven case folders, a shared `scaffold.sh` per case (R1 to R8).
- `plugins/pro-egm/evals/`: five case folders (R10 to R15).
- Both plugins' `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, the marketplace entries and `metadata.version`, `docs/releases.md` (R1, R10, R18).
- `tests/cases/routing.jsonl` (R9).
- `docs/evals.md` (R17).

## Order of work

1. Wait for Jody's pending `; true` edits to the pro-ai-sdlc commands to land on main, then rebase the stack on it.
2. Two Sonnet subagents in parallel, one per plugin, write the cases and fixtures; each smoke-runs every case once with `--ablation none` to prove it loads and the scaffold works (R1 to R8, R10 to R15).
3. Add the routing cases and run the keyless gate (R9).
4. Opus reviews every grader for a trap a plain reply would pass, then runs the 3-run baseline for both plugins (R17, R19).
5. Bump versions, write the `docs/evals.md` entry and the proof below (R16, R18).

## Tests that prove it

- `node tests/check.mjs`, `node tests/route-lexical.mjs --min-rank1 70`, `node --test tests/unit/*.test.mjs`, strict validation.
- `claude plugin eval plugins/pro-ai-sdlc --runs 3 --model sonnet --scaffold --allow-tools Bash Write Edit` and the same for pro-egm, with the JSON summarized in `docs/evals.md`.

## Risks

- Commands that write and commit need Bash, Write and Edit in the run; `--allow-tools` grants them inside the eval's sandboxed temp repo only.
- A slash command named in the prompt has no meaningful no-plugin arm; those cases run single arm and are read as pass rates.
- `/execute` must never make a real worktree outside the temp repo; the case uses a draft plan so the gate stops it before step 2. The scaffold has no remote.

## Proof of done

- R1 to R8, R10 to R15, R20, R21: 12 pro-ai-sdlc cases and 5 pro-egm cases, each tagged; `node tests/check.mjs evals` passes.
- R9: four agent routing cases; `node tests/route-lexical.mjs --min-rank1 70` passes at 79.5% rank-1.
- R16: `node tests/check.mjs`, strict validation of the marketplace and every plugin.
- R17: `node tests/run-evals.mjs pro-ai-sdlc pro-egm --runs 3` on 2026-10-29, recorded in `docs/evals.md` with its findings.
  Gate cases: `goldfish-init` and `goldfish-needs-egm` 3 of 3; `execute-refuses-draft-plan` skipped on macOS (needs git). Stays-quiet cases 0 fires.
- R18: pro-ai-sdlc 0.6.0, pro-egm 0.3.0, marketplace 1.59.0 with release rows.
- R19: about $9.30 by `costUsd`: $3.05 of smoke runs and $6.22 for the baseline.
- R22 to R24: `component-coverage` passes; `tests/run-evals.mjs` with `--sdlc`, `--dry-run` and `--include-git`; `node --test tests/unit/*.test.mjs` passes 34 of 34.

## Done

Built on 2026-10-29.
Findings for later changes:
- `/review` with its reviewer found both planted problems as blocking in 1 of 3 runs against 2 of 3 for plain Sonnet.
- `researcher` is never used for a wide question (0 of 3).
- `goldfish-reviewer` passed 2 of 3.
- `spec-from-intent`, `plan-from-spec` and `execute-refuses-draft-plan` need a Linux run; in smoke runs on macOS the commands died on their git context lines and the agent wrote `spec.md` and `plan.md` without the template.
- `execute.md` calls the `python3` gate script without it being in `allowed-tools`, which the smoke run suggests a `dontAsk` session would deny.

## Departures from plan

- Step 1 did not wait for the `; true` edits on main: the git failure in the macOS sandbox blocks the cases they affect regardless, so those cases are tagged `needs:git` and skipped on macOS instead.
- `hook-plan-sync` grades only that the hook fired; its check on `plan.md` was dropped because warn mode changes no file.
- The runner passes `--threshold 0` so a low score is not read as a failed run. It selects the cases to run by `--tag` on macOS, since `--case` takes one glob.
