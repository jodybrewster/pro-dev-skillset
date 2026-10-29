# Plan: make four discipline skills fire and prove it

Built from `spec.md` and `intent.md` in this folder.
Status: built on 2026-10-29.
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

- R1, R2: four sharpened fires cases and four `-stays-quiet-2` cases; `node tests/check.mjs evals` passes.
- R3: with the old descriptions the TDD, verification and debugging reply graders passed without the plugin in 0, 0 and 1 of 3 runs.
- R4, R5, R6: four descriptions and the verification first rule changed; no other description or routing case changed.
- R7: TDD fires 3 of 3 with reply 3 of 3 against 0 of 3; verification fires 3 of 3 with reply 2 of 3 against 1 of 3. Review fires 3 of 3 but its reply is not separated (see Done). Debugging fires 0 of 3.
- R8: all 16 stays-quiet cases at 0 fires in both arms.
- R9: `node tests/route-lexical.mjs --min-rank1 70` passes at 78.5% rank-1, no collision at 0.75.
- R10: `node tests/behavioral.mjs verification-before-completion --baseline` scored 4 of 4 with the skill and 1 of 4 without.
- R11: debugging stopped after two wording rounds; the round-2 wording ships.
- R12: `claude plugin eval` spend was $13.29 by `costUsd` across the baseline, smoke runs, step 3, rounds 1 and 2 and probes. The one behavioral run billed to the API key is not in that figure.
- R13: `docs/evals.md` "Measured changes".
- R14: pro-execution 0.6.0, pro-quality 0.12.0, marketplace 1.58.0 with release rows.

## Done

Built on 2026-10-29.
Findings for later changes:
- `systematic-debugging` does not fire on a pasted failing test even with the request phrasings named.
- `requesting-code-review` fires but the agent reviews inline instead of dispatching the reviewer subagent, so the case grades the dispatch (`reviewer-dispatched`, 0 in both arms) and the review content (passes in both arms).

## Departures from plan

- The TDD reply grader reads the whole run (`focus: trace`) and the case allows Write, Edit and Bash; the first version graded only the final message, which showed the code first even when the agent had written and failed the test first.
- The review case's verdict-line regex was replaced by a `tool_used` grader on `Task`, because `regex` graders cannot read the trace and the main reply paraphrases the reviewer's verdict.
- Debugging and verification got a second wording round; TDD and review met the firing target in round 1.
