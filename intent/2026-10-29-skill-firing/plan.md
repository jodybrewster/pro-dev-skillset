# Plan: make four discipline skills fire and prove it

Built from `spec.md` and `intent.md` in this folder.
Status: draft.
Approver: Jody Brewster.
Dated: 2026-10-29.
Branch: `feat/skill-firing`, rebased onto the PR quality gate fix before the first plugin edit.

## Files that change

- `plugins/pro-execution/evals/{test-driven-development,systematic-debugging}-*` and `plugins/pro-quality/evals/{verification-before-completion,requesting-code-review}-*`: sharpened fires cases, four new stays-quiet cases and a `scaffold_script` for the verification case (R1, R2).
- `plugins/pro-execution/skills/test-driven-development/SKILL.md` and `systematic-debugging/SKILL.md`: description (R4).
- `plugins/pro-quality/skills/verification-before-completion/SKILL.md`: description and first rule (R4, R5); `requesting-code-review/SKILL.md`: description (R4).
- Both plugins' manifests, the marketplace entry and `docs/releases.md` (R14).
- `docs/evals.md` (R13).

## Order of work

1. Record the before numbers: the 3-run baseline on the current cases, taken on 2026-10-29 while this plan was drafted (Sonnet, Claude Code 2.1.312, $1.61):

   | Case | Fired | Reply score with | Reply score without |
   |---|---|---|---|
   | `test-driven-development-fires` | 0 of 3 | 0 | 0 |
   | `systematic-debugging-fires` | 0 of 3 | 1 | 1 |
   | `verification-before-completion-fires` | 0 of 3 | 1 | 1 |
   | `requesting-code-review-fires` | 0 of 3 | 0.83 | 0.67 |

   All four stays-quiet cases stayed quiet in 3 of 3 runs.
2. Sharpen the four fires cases and add the four stays-quiet cases (a Sonnet subagent writes them; Opus reviews each trap).
3. Run the sharpened cases with the old descriptions; rework any reply grader the without arm passes 2 of 3 times (R3).
4. Rewrite the four descriptions and the verification first rule (Opus drafts, since the wording is the whole change).
5. Run both plugins at 3 runs; for any skill short of R7, one more wording round, then stop (R11).
6. Run `tests/behavioral.mjs verification-before-completion --baseline`, the lexical gate and the static checks (R9, R10).
7. Bump versions, fill `docs/evals.md` and the proof below (R13, R14).

## Tests that prove it

- The before and after `claude plugin eval` JSON for both plugins, summarized in `docs/evals.md`.
- `node tests/route-lexical.mjs --min-rank1 70`, `node tests/check.mjs`, `node --test tests/unit/*.test.mjs` and strict validation.
- `node tests/behavioral.mjs verification-before-completion --baseline`.

## Risks

- Firing is stochastic and 3 runs is a small sample; a 2 of 3 result is a direction, not a guarantee.
- A broader description can steal prompts from a neighbor; R2 and R8 are there to catch it.
- `scaffold_script` runs author bash on this machine; it only writes the fixture repo into the case's temp dir.

## Proof of done

## Done

## Departures from plan
