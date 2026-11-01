# Plan: a detailed code-reviewer agent

Built from `spec.md` (commit dcdb98f, amended 2026-10-29 before approval) and `intent.md` in this folder.
Status: implemented.
Approver: the maintainer.
Dated: 2026-10-29.

The maintainer is named as approver because the spec sets a contract every reviewer in the marketplace will follow (the four-field handoff) and the intent is risk medium.
The prose of the agent prompt is the product and AC7 needs a person to read one real review.
It does not suit auto mode.

The ADR for the four-field handoff ships in this PR as `docs/decisions/0012-review-handoff.md` (proposed), with its row in `docs/decisions/README.md`, written in step 7 (one PR per intent).
ADR-0011 is review convergence, shipped in #82.

Build-time readings on 2026-10-30, replacing the numbers below: pro-quality 0.13.0 to 0.14.0, pro-execution 0.6.0 to 0.6.1 and `metadata.version` 1.61.0 to 1.62.0.
review-policy shipped the summary line `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>` as the first line of every report and "Nothing to fix." when important and nits are zero; the agent uses that line wherever this plan says "tally line".
`policy` names `CONSTRAINTS.md` when present beside `REVIEW.md` and the agent file (ADR-0010).

## Files that change

In pro-quality (new):

- `plugins/pro-quality/agents/code-reviewer.md` (new): the Opus, read-only reviewer with five lenses, the four-field handoff, the design smells, the mutation-result handling, the scenario list, the presumptive blockers and the MIT footer (R1 to R17, R23).
- `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` (new): the Codex twin with `sandbox_mode = "read-only"`, following `technical-writer.toml` (R18).
- `plugins/pro-quality/skills/requesting-code-review/handoff.md` (new): the single handoff template with the four fields (R21).

In pro-quality (modified or deleted):

- `plugins/pro-quality/skills/requesting-code-review/SKILL.md` (modified): dispatch `pro-quality:code-reviewer` with the filled `handoff.md` and no other text, name the Codex fallback, drop the placeholders and the Critical, Important and Minor ladder (R19).
- `plugins/pro-quality/skills/requesting-code-review/code-reviewer.md` (deleted): the old template with the `{DESCRIPTION}` field (R20).
- `plugins/pro-quality/commands/review.md` (modified): it tells the model to "fill the `code-reviewer.md` placeholders" and to act on Critical, Important and Minor findings (R24, AC8, AC12).
- `plugins/pro-quality/scripts/pr-quality-gate.py` (modified): the `PostToolUse` hook after `gh pr create` tells the model to fill the old template with `DESCRIPTION` set to the PR title and `PLAN_OR_REQUIREMENTS` set to the first 500 characters of the PR body.
  That is the author-written description the contract bars, so the text must switch to the four fields (the shas it already computes).
  The minimal edit is enough because pr-gate deletes the script (R25, AC12).
  `tests/quality-hooks.mjs` asserts only the "PR quality gate" heading and the description check lines, so it should keep passing.
- `plugins/pro-quality/LICENSE` (modified): add the "Copyright (c) 2025 Addy Osmani" attribution for the agent beside the existing VoltAgent and obra lines (AC10).
- `plugins/pro-quality/.claude-plugin/plugin.json` (modified): version 0.12.0 to 0.13.0 and the description names the agent.
- `plugins/pro-quality/.codex-plugin/plugin.json` (modified): version 0.12.0 to 0.13.0, aligned with the Claude manifest.

In pro-execution (modified):

- `plugins/pro-execution/skills/subagent-driven-development/code-quality-reviewer-prompt.md` (modified): it says "Use template at requesting-code-review/code-reviewer.md" with `DESCRIPTION` taken from the implementer's report.
  Repoint it to the handoff fields and drop the description line (R26, AC12).
- `plugins/pro-execution/.claude-plugin/plugin.json` (modified): version 0.6.0 to 0.6.1 (AC13).
- `plugins/pro-execution/.codex-plugin/plugin.json` (modified): version 0.6.0 to 0.6.1, aligned.

At the root:

- `tests/check.mjs` (modified): a new `handoff` contract check (R22), written first.
- `tests/cases/routing.jsonl` (modified): one case that expects `code-reviewer` (AC9).
- `docs/licenses.md` (modified): a pro-quality row for `code-reviewer` (agent) naming agent-skills as adapted, with "Copyright (c) 2025 Addy Osmani" (AC10).
- `README.md` (modified): the pro-quality row at line 224 and the description at line 252 still say "reusable reviewer prompt"; name the agent instead.
- `.claude-plugin/marketplace.json` (modified): the pro-quality entry 0.12.0 to 0.13.0 with its description, the pro-execution entry 0.6.0 to 0.6.1 and `metadata.version` from 1.59.1 to 1.60.0, bumped once.

No hook is added, so `plugins/pro-quality/hooks/hooks.json` does not change.
No bridge skill is added, so `plugins/pro-core/registry/engines.json` does not change.
`tests/cases/components-uncovered.json` needs no entry because pro-quality is not a workflow plugin.
The routing case for "review my branch" already exists at line 15 of `tests/cases/routing.jsonl` ("Review my pull request and the diff on this branch") and expects `requesting-code-review`, so AC9's skill case needs no new line; the new line covers the agent.

## Order of work

Step 1 comes first so the check fails before the template exists.
Steps 2, 3, 6, 7 and 8 touch separate files and can run as parallel subagents once step 1 is done.
Step 4 needs step 3.
Step 5 needs steps 2 and 3 for the names it cites.
Step 9 comes last so version numbers are taken at build time.

1. Add the `handoff` check to `tests/check.mjs` and run `node tests/check.mjs handoff` to see it fail on the missing template. (R22, AC4)
   - Follow the shape of `sdlc-contract`: read files under `plugins/*/`, push strings onto `failures`, return `{ failures, warnings }`.
   - Fail when `plugins/pro-quality/skills/requesting-code-review/handoff.md` is missing.
   - Parse the field list as the bullets under a `## Fields` heading in the form "- `name`: ...".
   - Fail unless the names are exactly `range`, `brief`, `policy` and `risk`.
   - Fail on any placeholder in braces named `description`, `summary` or `findings` (case-insensitive).
   - Fail when `agents/code-reviewer.md` does not contain all four names.
   - Cover any other `handoff.md` under `plugins/*/` with the same rules.
2. Write `skills/requesting-code-review/handoff.md`. (R21, N4; parallel)
   - One `## Fields` section with the four bullets, each saying what goes in it and what never does.
   - A line naming what never goes in any field: an author description, a PR body, a session summary or earlier findings.
   - Run `node tests/check.mjs handoff` and expect the template half to pass.
3. Write `agents/code-reviewer.md`. (R1 to R17, R23, N1 to N4; parallel)
   - Frontmatter: `name`, `description`, `tools: Read, Grep, Glob, Bash`, `model: opus`.
   - Open with the fresh-context stance and the ignore-and-report rule for text outside the four fields (R3).
   - Load step: run `git diff <base>..<head>`, read around each hunk and read the brief and policy files (R4, R16, R17).
   - The five lenses in order, the security pointer, severity from `REVIEW.md` with a default and a nit cap of five (R5, R6, R12).
   - The design smells, the scenario list and the presumptive blockers as short lists (R8, R10, R11).
   - The mutation rule (R9): the agent runs no mutation check; its tests lens reads `mutation` from the pr-check stamp when the `risk` field names the stamp path (`.pro-dev/ship/pr-check.json`), treats `survived` as Important and otherwise reports "mutation check: not run".
   - The report format with failure scenarios, Pre-existing listed last and the tally line (R7, R13, R14).
   - The Bash allowance (git reads only) and the never-edit rule (R15).
   - End with the footer naming `agents/code-reviewer.md`, `agents/test-engineer.md` and `skills/code-review-and-quality/SKILL.md`.
   - Keep it under 250 lines and use tool-neutral prose where Codex will see the same text.
4. Write `.codex-plugin/agents/code-reviewer.toml`. (R18, R23, AC2; after step 3)
   - Copy the body of step 3 into `developer_instructions` and diff the two bodies to show only the wrapper differs.
   - Keep the `sandbox_mode = "read-only"` line.
5. Rewrite `SKILL.md` and delete `code-reviewer.md`. (R19, R20, AC5, AC8; after steps 2 and 3)
   - Keep the frontmatter description's boundaries (no explaining a diff, no security review) and the obra footer.
   - Steps: get the two shas, find the brief and policy paths, fill `handoff.md`, dispatch with that text and nothing else, act on findings.
   - Name the Codex fallback: copy the `.toml` into the Codex agents folder or start a fresh agent run with its instructions.
   - Keep "fix Important findings before merge" and "push back with reasoning"; drop Critical and Minor.
   - `git rm` the old template.
6. Repoint the callers of the old template. (R20, R24 to R26, AC8, AC12; parallel)
   - `commands/review.md` in pro-quality: dispatch through the skill with the four fields and act on Important findings.
   - `scripts/pr-quality-gate.py` in pro-quality (minimal edit, since pr-gate deletes it): replace the `DESCRIPTION` and `PLAN_OR_REQUIREMENTS` lines with the four fields; keep the `PR quality gate` heading and the check lines the hook tests read.
   - `code-quality-reviewer-prompt.md` in pro-execution: same repoint, no description line.
   - Run `node tests/quality-hooks.mjs` (the quality-hooks check runs it) to see the gate cases still pass.
   - Run `grep -rn "code-reviewer.md\|DESCRIPTION"` over the three files and expect nothing.
7. Attribution. (R23, AC10; parallel)
   - Add the agent-skills copyright line and a one-line note in `plugins/pro-quality/LICENSE`.
   - Add the `docs/licenses.md` row.
   - Update the two README lines.
8. Add the routing case to `tests/cases/routing.jsonl`, expecting `code-reviewer`, in the style of the `reviewer` case at line 82. (AC9; parallel)
   - Run `node tests/route-lexical.mjs --min-rank1 70`; the new case counts in the denominator (rank-1 is 75.9% now), so confirm it stays above 70.
9. Bump versions. (AC11, AC13, ADR-0002; last)
   - pro-quality takes a minor bump and pro-execution a patch bump (R26), each in both manifests and its marketplace entry.
   - Take the pro-quality and pro-execution numbers and `metadata.version` from the current `main` at build time, not from this plan.
   - Edit both manifests and the marketplace entry for each plugin and `metadata.version` once.
10. Run the full proof of done below, then do the manual runs for AC4 and AC7. (AC1 to AC11)
    - AC4: back up `handoff.md`, add a `description` field, run `node tests/check.mjs handoff`, expect a failure, restore the file, repeat once with a field removed.
    - AC14: read the agent prompt for the mutation rule and the `tools` line.
    - AC7: in a scratch branch add a branch of code no test exercises, dispatch the agent with the four fields and paste the report into the PR.

## Tests that prove it

- `node tests/check.mjs handoff` covers AC4: exact four fields, no `description`, `summary` or `findings` placeholder, the agent names the same four fields, a missing template fails.
- `node tests/check.mjs agents` covers AC2: name matches file, the `.toml` has name, description and `developer_instructions`, no Codex-twin warning for `code-reviewer`.
- `git ls-files plugins/pro-quality/agents/code-reviewer.md plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` covers AC2: both tracked.
- `grep -c "model: opus" plugins/pro-quality/agents/code-reviewer.md` prints 1. A grep for the five lens names, "Important", "nit", "Pre-existing", "failure scenario" and "out of scope" covers AC3.
- `grep -rn "DESCRIPTION" plugins/pro-quality` prints nothing and `git ls-files plugins/pro-quality/skills/requesting-code-review` lists `SKILL.md` and `handoff.md` only (AC5).
- A grep of the agent for the five smells, "mutation", the five scenarios and the five blockers covers AC6 and AC14, with the frontmatter `tools` line free of Edit.
- The three-file grep and `node tests/quality-hooks.mjs` cover AC12; the pro-execution manifests and marketplace entry cover AC13.
- `grep -rn "code-reviewer.md" plugins docs README.md` prints nothing (AC8).
- `node tests/check.mjs` and `node tests/route-lexical.mjs --min-rank1 70` cover AC9: the warning count does not rise and rank-1 stays above 70.
- `grep -n "agent-skills" docs/licenses.md plugins/pro-quality/LICENSE` and `grep -n "Adapted from agent-skills" plugins/pro-quality/agents/code-reviewer.md plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` cover AC10.
- `node tests/check.mjs` covers AC11: the version-bump check fails when the two manifests and the marketplace entry disagree.
- The manual dispatch in step 10 covers AC7.
- The full proof of done below covers AC1.

## Risks

Questions from `/plan` step 3, answered.

What might this break?
The three callers of the deleted template (`commands/review.md`, `pr-quality-gate.py` and pro-execution's `code-quality-reviewer-prompt.md`) point at a file that stops existing; step 6 fixes them and AC8 greps for strays.
Every PR created with `gh pr create` fires the gate hook, so a bad edit to `pr-quality-gate.py` would hit every installing repo; `tests/quality-hooks.mjs` runs the gate cases.
The skill's evals under `plugins/pro-quality/evals/requesting-code-review-*` grade that a subagent was dispatched and that review content appears, so a changed report shape could turn a grader red; they run on demand and are not in the proof of done.
Handoff.md's `## Fields` format is a new parse contract, so a later edit to the heading breaks the check on purpose.

Which step is the most likely to go wrong?
Step 3, the agent prompt: it must hold five lenses, four lists, the report format and the safety rules inside 250 lines. Its quality shows only in a real review (AC7).
Within it, the weak part is fitting the lens detail under the line cap.
The mutation check is no longer in the agent (it moved to pr-check on 2026-10-29), so the agent stays read-only with Bash limited to git reads.
Bash restrictions live in the prompt, not in frontmatter, so nothing enforces them.

What was left out on purpose, with the reason?
The `REVIEW.md` template changes, the round cap and the Pre-existing semantics belong to review-policy.
The mutation check, `pr-check` and the stamp belong to pr-gate, the tier classifier to risk-tiers and `CONSTRAINTS.md` to constraint-floor.
Change-size bands, a separate `test-engineer`, Codex as a second reviewer and reviewer evals are out per the spec.
No engine registry row and no hook change, because the agent is neither a bridge nor a hook.

Which steps touch separate files and could run in parallel worktrees?
Steps 2, 3, 6, 7 and 8 after step 1; step 4 after step 3; step 5 after steps 2 and 3.
Step 9 is last because it edits the shared marketplace file.

Overlaps with sibling plans:

- pro-quality version collision with constraint-floor, which touches pro-quality hooks, scripts, a new skill and command and bumps pro-quality.
  Review-policy and the other sibling plans also bump `metadata.version`.
  Stack the PRs and take the next number over `main` at build time (step 9); 0.13.0 and 1.60.0 here are only today's reading.
- constraint-floor edits pro-quality scripts and this plan edits `scripts/pr-quality-gate.py`, so the two PRs may conflict in that file; rebase the later one and re-run the quality-hooks check.
- The agent depends on review-policy's Pre-existing tag and round rules.
  Here the agent only applies the tag (R14) and the caller filters repeats, so the agent works alone, but the tag wording and the tally line (`pre-existing: <n>`) must match what review-policy ships.
  If review-policy changes the tally, change this agent and the toml in the same stack.
- The handoff contract may fold into a shared review-contract ADR with review-policy; the plan assumes it exists before step 1.
- pr-gate owns pr-check's handoff while this change owns the check on it (spec flagged concern 1); the plan assumes one shared `handoff.md` that the check reads, so pr-gate references it and adds no second template.

Decided by the maintainer on 2026-10-29 and no longer open: effort high set by the dispatcher, a subagent dispatch (`pr-gate` may choose `claude -p` later without changing the agent), one shared `handoff.md` that pr-check also uses, the mutation check moving into pr-check (pr-gate spec R29) and the three extra callers with the pro-execution patch bump.

Decided on 2026-10-30 under the maintainer's approval of all P0 work, with the spec's recommendations:

- Both severities stay and Critical goes; this changes the wording `commands/review.md` and the gate hook use today.
- The caller filters repeated findings with a new base sha and the handoff gets no prior-findings field (flagged concern 3).
- `pro-ai-sdlc:reviewer` stays and both compliance passes run (flagged concern 4).

Nothing here is irreversible: no migration, no data and no deploy.
The damage from a bad prompt reaches every review the agent runs until the next plugin update.

## Options not taken

- Keep the old template beside the agent: two sources of review text drift and the `{DESCRIPTION}` field breaks fresh context.
- Leave `pr-quality-gate.py` as it is and fix it under pr-gate: the hook would keep injecting a PR-body description and a dead template path in the meantime.
- Put the handoff check in a new test file: `tests/check.mjs` already holds the contract checks and CI runs it.
- Skip the Codex twin until pr-gate needs it: ADR-0004 makes parity a hard requirement for every agent.
- Make `hooks.json` run the reviewer: agents are dispatched by name and no hook is needed.

## Proof of done

Run in this order from the repo root; every command must pass.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
grep -rn "DESCRIPTION" plugins/pro-quality
grep -rn "code-reviewer.md" plugins docs README.md
git ls-files plugins/pro-quality/skills/requesting-code-review
```

Expected: `node tests/check.mjs` ends with 0 failures and no more warnings than before the change (13 on 2026-10-29), the dry eval and the unit tests pass, `✔ Validation passed` prints once for the marketplace and once per plugin directory, both greps print nothing and the last command lists `SKILL.md` and `handoff.md` only.
Then the two manual runs in step 10 (AC4 and AC7).

## Done

Filled in when the build is finished, before sign-off.

- Build commit: the head of #87.
- Checks run: `node tests/check.mjs` 30 checks, 0 failures, 10 warnings (the new `handoff` check failed first on the missing template and agent); eval dry 86 cases; route-lexical rank-1 80.0%; unit tests; `node tests/quality-hooks.mjs` 152/152; strict validate on the marketplace and all 20 plugins.
- AC1: pass, the commands above.
- AC2: pass, both agent files are tracked and the agents and codex-parity checks name no warning for `code-reviewer`.
- AC3: pass, `model: opus`, the five lenses, Important, nit, Pre-existing, failure scenario and "out of scope" are in the agent.
- AC4: pass, adding a `description` field and removing `brief` each failed the `handoff` check; the file was restored both times.
- AC5: pass, `grep -rn "DESCRIPTION" plugins/pro-quality` prints nothing and the skill folder holds `SKILL.md` and `handoff.md` only.
- AC6: pass, the five smells, the five scenarios, the five blockers and the mutation rule are in the agent; `tools` has no Edit.
- AC7: pass after the fixes recorded under departures; see the trial there.
- AC8: pass, `grep -rn "requesting-code-review/code-reviewer.md" plugins README.md` prints nothing.
- AC9: pass, a routing case expects `code-reviewer`; rank-1 80.0%.
- AC10: pass, the agent-skills line in the LICENSE notice, the `docs/licenses.md` row and the footer in both agent files.
- AC11: pass, pro-quality 0.14.0, pro-execution 0.6.1 and `metadata.version` 1.62.0 agree across manifests and the marketplace.
- Sign-off: the maintainer, 2026-10-30.

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves any ADR with Status `proposed` from this change to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- AC8's grep `grep -rn "code-reviewer.md" plugins docs README.md` also matches the new agent's own path (`agents/code-reviewer.md`), the license notice and ADR-0012's history, so the stray-pointer check is `grep -rn "requesting-code-review/code-reviewer.md" plugins README.md`, which prints nothing.
- The lexical routing gate shows 3 notOneOf warnings instead of 2: the README-onboarding case (line 31) now ranks `systematic-debugging` 0.12 over `documentation-engineer` 0.11 because the new agent shifts term weights.
  It is a warning the gate leaves to the model router; rank-1 rose to 80.0%.
- The AC7 trial (a fresh Opus reviewer on a fixture with an off-by-one at a discount boundary and untested error paths) found the planted bug with a failure scenario, flagged the untested paths as an Important tests finding, reported the mutation check as not run, made no edits and used only the four fields.
  It also found an unplanted bug (`TIERS['constructor']`).
  It showed five gaps, fixed here: R13 and AC7 still said the tally ends the report (amended to "opens", as review-policy shipped); labels mixed lens and pass; "mutation check: not run" now has an exact lowercase form; `skipped` is defined; a finding that breaks behavior is never a borderline nit; handoff paths are relative to the repo root.
