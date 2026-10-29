# Plan: evals for pro-ai-sdlc and pro-egm

Built from `spec.md` and `intent.md` in this folder.
Status: draft.
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
- `/execute` must never make a real worktree outside the temp repo; the case uses a draft plan so the gate stops it before step 2, and the scaffold has no remote.

## Proof of done

## Done

## Departures from plan
