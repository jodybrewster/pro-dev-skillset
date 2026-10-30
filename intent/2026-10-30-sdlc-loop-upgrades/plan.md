# Plan: SDLC loop upgrades

Built from `spec.md` (accepted 2026-10-30, committed with this plan) and `intent.md` in this folder.
Status: approved.
Approver: Jody Brewster.
Dated: 2026-10-30.

Jody approved the batch on 2026-10-30 and asked that it go through spec, plan and execute.
He is named as approver because the batch changes `/execute` (the stage that builds unattended) and sets two rules other work follows (ADR-0017).
The intent is risk medium.
The prose of the commands is the product, so the trials in step 22 need a person to read their output.

ADR-0017 (`docs/decisions/0017-loop-guardrails.md`, proposed) and its index row ship in the spec commit; the Done sign-off moves it to accepted.
Read at planning time: pro-ai-sdlc 0.9.0 and `metadata.version` 1.64.0.
Take the real numbers from `main` at build time.

This plan follows the rules it introduces: every step is sized, a checkpoint follows every two or three steps and the `/execute` guardrails land first.
Sizes: XS is one file and under 30 minutes, S is one or two files and under an hour.

## Files that change

In `plugins/pro-ai-sdlc` (modified):

- `commands/execute.md`: a new `## Stop list` section and a new `## Scope discipline` section, both placed after `## Secrets` and before `## Your task`, plus one-line pointers in steps 5, 6 and 7 (R1 to R10, R20).
- `commands/spec.md`: a new assumptions step, the capability-map offer and the ADR folder rule (R11, R12, R14, R23).
- `commands/plan.md`: sizes, split triggers, checkpoints, risky-first, never-overwrite, the self-review, the definition-of-done read and module plans (R14 to R18, R20).
- `commands/adr.md`: the convention check, the deprecated status and the never-delete rule (R23, R24).
- `templates/spec.md`: `## Assumptions` and `### Boundaries` (R13).
- `templates/plan.md`: size and checkpoint example, the definition-of-done line in `## Done` and `## Noticed but not touched` (R20).
- `templates/adr.md`: `deprecated` in the status line (R24).
- `agents/verifier.md` and `.codex-plugin/agents/verifier.toml`: the test lens, the `Tests` report line and the verdict rule (R21, R22, R26).
- `agents/simplifier.md` and `.codex-plugin/agents/simplifier.toml`: `git blame`, the callers-and-history check and the balance rule (R25, R26).
- `LICENSE`: the attribution notice and the Addy Osmani copyright line (R27).
- `README.md`: name `references/definition-of-done.md` beside the templates and the new `/execute` stop list.
- `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`: version and description (R30).

In `plugins/pro-ai-sdlc` (new):

- `references/definition-of-done.md`: the standing definition of done (R19).
- `evals/execute-pauses-on-migration/` (`case.yaml`, `prompt.md`, `scaffold.sh`, `graders/`): the eval case for the pause (R29).

At the root:

- `tests/check.mjs` (modified): new anchors in `sdlc-contract`, written before the text they check (R28).
- `docs/licenses.md` (modified): a pro-ai-sdlc row for the adapted loop text (R27).
- `README.md` (modified): the pro-ai-sdlc line near line 239 names the definition of done and the stop list.
- `.claude-plugin/marketplace.json` (modified): the pro-ai-sdlc entry's version and description and `metadata.version` (R30).

Not changed: `scripts/execute-gate.py`, `scripts/plan-sync.py`, `hooks/hooks.json`, `plugins/pro-ship/` and `plugins/pro-quality/`.
No hook or script is added, so the hook-loading law is not touched.
No routing case is added; the verifier's description changes, so the lexical gate is rerun in step 15.

## Order of work

Steps 1 to 5 are the `/execute` guardrails and land first, in order, in one track.
After checkpoint A, steps 8 to 18 touch separate files in four tracks that may run as parallel subagents: track P (steps 8 to 11), track S (steps 12 to 14), track V (steps 15 to 17) and track A (step 18).
Step 14 edits `commands/plan.md` after step 10 and 11, so it waits for track P.
Steps 19 to 22 are a serial tail.
Every step ends with its own commit that stages only the files it names, by path.

1. Add the `/execute` anchors to `sdlc-contract` in `tests/check.mjs` and see them fail. (XS; R28, AC2)
   - In the `execC` branch (after the never-merge assertion), fail unless `execC` contains each of: `## Stop list`, `## Scope discipline`, `## Noticed but not touched`, `git add -A`, `Things I didn't touch`, `Potential concerns`, `consented in Risks` and `references/definition-of-done.md`.
   - Fail unless the text between `## Stop list` and the next `## ` heading contains `auth`, `migrations`, `payments`, `deploys` and `secrets`.
   - Run `node tests/check.mjs sdlc-contract` and expect failures naming the missing anchors.
2. Write the `## Stop list` section in `commands/execute.md`. (S; R1, R3, R4, R5)
   - Place it after `## Secrets` and before `## Your task`.
   - Name the five categories with the path names exactly as R1 in spec.md lists them, plus the rule that a step's text saying it changes one of them also fires.
   - The pause line: `stop list: step <N> touches <category> (<path or phrase>). Build it? (yes to continue)`; wait for an explicit yes; anything else is a stop with the stage, the reason and what to do next, keeping the worktree.
   - The consent rule: the plan's `## Risks` names the category and the header's `Approver:` names a person, not an angle-bracket placeholder; then print `stop list: <category> on step <N>, consented in Risks` and go on.
   - Test files and fixtures never fire, as in the classifier.
   - Say it reads path names and plan text only and never opens an env file.
   - Keep the section under 25 lines, one sentence per line.
3. Wire the stop list into step 5 of `commands/execute.md`. (XS; R2, R6)
   - Add at the start of step 5: before the first step, run the stop list over `## Files that change` and the text of every step in `## Order of work`; print `stop list: nothing fired` when nothing does.
   - Add: before each step's commit, run it over `git diff --cached --name-only`.
   - Add: at each checkpoint the plan names, when pro-ship's `risk-tiers` skill is available, follow it to classify `origin/<default_branch>..HEAD`; a signal with id `auth`, `payments`, `migrations`, `iac`, `workflows` or `env-config` that no consent covers pauses before the next step; without the skill, say the classifier was skipped.
   - Add `checkpoint` to the stage lines the intro says to print.
4. Write the `## Scope discipline` section in `commands/execute.md`. (XS; R7, R8)
   - Place it after `## Stop list`.
   - Noticed outside the step: never fixed in that step; one line (file, what was seen, why it was left) under `## Noticed but not touched` in plan.md, in the step's commit.
   - Staging: stage the step's files by path; never `git add -A`, `git add .` or `git commit -a`; compare `git diff --cached --name-only` with the step's files before each commit; a file the step did not name is unstaged or kept with a `## Departures from plan` line.
   - In step 5, change "Commit each step, or a small group of steps, with a message that names the step." to add "staging only its files as `## Scope discipline` says".
   - Keep the section under 15 lines.
5. Point steps 6 and 7 of `commands/execute.md` at the new parts. (XS; R9, R20)
   - Step 6: after "Fill in the plan's `## Done` section", add a line to fill `- Definition of done:` against `${CLAUDE_PLUGIN_ROOT}/references/definition-of-done.md`, naming the items not met or "met".
   - Step 7: after "names any departures", add that the body ends with "Things I didn't touch" (the `## Noticed but not touched` lines and neighboring work left out on purpose) and "Potential concerns" (consented stop-list steps, what the verifier could not check and risks seen), each "None" when empty.
   - Change nothing else in steps 1 to 4, 6 or 7.
   - Run `node tests/check.mjs sdlc-contract` and expect the step 1 anchors to pass.

   Checkpoint A: `node tests/check.mjs sdlc-contract` passes; `git diff origin/main -- plugins/pro-ai-sdlc/scripts/execute-gate.py` prints nothing; `grep -c "Never merge, never push to the default branch" plugins/pro-ai-sdlc/commands/execute.md` prints 1; the two new sections together are under 40 lines (N4).

6. Add the eval case `plugins/pro-ai-sdlc/evals/execute-pauses-on-migration/`. (S; R29, AC3)
   - Copy `case.yaml` (rename `name`), `prompt.md` and `scaffold.sh` from `evals/execute-refuses-draft-plan/` as the base; do not copy its graders, which forbid a worktree this run will make.
   - In `scaffold.sh`: set the plan's `Status: approved.` and give it a step that writes `db/migrations/001_due_dates.sql`, listed under `## Files that change`, with a `## Risks` section that does not mention migrations.
   - Add a bare origin so the gate passes: `ORIGIN=$(mktemp -d)/origin.git && git init -q --bare "$ORIGIN" && git remote add origin "$ORIGIN" && git push -q origin main && git remote set-head origin main`, after the last commit.
   - `prompt.md`: the same `/pro-ai-sdlc:execute intent/2026-01-05-due-dates/plan.md` prompt, `tags: [command:execute, needs:git]`, a description saying the run must pause at the migration step.
   - Graders: `tool_used` on `gh pr create` with `max: 0`; an `llm` grader that passes only if the reply names the migration step and the migrations category and asks before building it; it fails if it says the step was built or a PR opened.
   - Run `node tests/check.mjs evals` and expect no new failure.
7. Add the remaining anchors to `sdlc-contract` in `tests/check.mjs` and see them fail. (S; R28, AC2)
   - `references/definition-of-done.md` exists.
   - `templates/plan.md` contains `## Noticed but not touched`, `references/definition-of-done.md`, `Checkpoint` and still the line prefix `- Build commit:`.
   - `commands/plan.md` contains `references/definition-of-done.md`, `XS`, `Checkpoint` and `never overwrite` (case-insensitive).
   - `templates/spec.md` contains `## Assumptions`, `### Boundaries`, `Always:`, `Ask first:` and `Never:`; `commands/spec.md` contains `capability-map.md` and `unconfirmed`.
   - `agents/verifier.md` and `.codex-plugin/agents/verifier.toml` each contain `one concept per test` and `A test that never fails`.
   - `agents/simplifier.md` and `.codex-plugin/agents/simplifier.toml` each contain `git blame`.
   - `commands/adr.md` and `templates/adr.md` each contain `deprecated`; `commands/adr.md` contains `Never delete`.
   - Run `node tests/check.mjs sdlc-contract` and expect failures for each of these.

   Checkpoint B: the only `sdlc-contract` failures are the step 7 anchors; `node tests/check.mjs evals` passes.

8. Write `plugins/pro-ai-sdlc/references/definition-of-done.md`. (XS; R19, R27; track P)
   - A title, one line on precedence (a repo's `CONSTRAINTS.md` or `REVIEW.md` wins where it says more) and one line on use (the plan's `## Done` cites this file in one line and names the items not met).
   - The items, one per line: the verify command passes; every acceptance criterion was observed; new behavior has tests that fail without the change and cover the scenarios that apply; no new warnings, debug output or commented-out code; no secrets or env values in code, logs, commits or the PR; docs changed where behavior changed (README, agent file, an ADR when a rule changed); version and changelog rules of the repo followed; departures and noticed items recorded in the plan; the verifier ran and its verdict is recorded.
   - Harness-neutral prose, under 30 lines, ending with the footer `Adapted from addyosmani/agent-skills (references/definition-of-done.md), MIT, Copyright (c) 2025 Addy Osmani.`
9. Edit `plugins/pro-ai-sdlc/templates/plan.md`. (XS; R20, N2; track P)
   - Change the `## Order of work` example to `1. <a step small enough to check by itself> (size XS or S; R1, AC1)` and add a second line `   Checkpoint: <the commands to run and what to confirm>`.
   - In `## Done`, after `- Checks run:`, add `- Definition of done: <met, or the items not met> (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more)`.
   - Keep `- Build commit: <sha>` exactly.
   - After `## Departures from plan` and its two lines, add `## Noticed but not touched` with one line: "Problems seen outside a step during the build, one per line: the file, what was seen and why it was left. /execute copies them into the PR body."
   - Keep every existing heading and its order; keep the closing comment last.
10. Edit `commands/plan.md` step 1 and step 2. (S; R15 to R17; track P)
    - Step 1: when the target plan file already exists, never overwrite it; stop, name it and suggest editing it or recording a departure.
    - Step 2: size every step XS, S, M or L (XS one file and under 30 minutes, S one or two files and under an hour, M up to two hours, L more) and aim for XS to S.
    - Split a step that is over two hours, carries more than three acceptance criteria, has "and" in its title or touches two or more subsystems; these are prompts and a step left at L states its reason in the plan.
    - Put a `Checkpoint:` line after every two or three steps with the commands to run and what to confirm.
    - Order the riskiest steps early, after any failing test they need.
    - Read `${CLAUDE_PLUGIN_ROOT}/references/definition-of-done.md` and leave the `- Definition of done:` line in `## Done` for the build to fill.
11. Add the self-review to step 3 of `commands/plan.md`. (XS; R18; track P)
    - After the four questions, add three checks before the plan is shown.
    - Coverage: every requirement and acceptance criterion in the spec maps to at least one step; an unmapped one gets a step or a stated reason.
    - Placeholders: no angle-bracket field, TBD, TODO or "fill in" is left outside `## Done` and `## Departures from plan`.
    - Names: each file, function, flag and heading is spelled the same in every step that uses it.

    Checkpoint C: `node tests/check.mjs sdlc-contract` shows no failure for the definition-of-done, plan template or plan command anchors; `node tests/check.mjs` reports no new failure elsewhere.

12. Edit `plugins/pro-ai-sdlc/templates/spec.md`. (XS; R13, N2; track S)
    - After `## Summary` and its paragraph, add `## Assumptions` with one line: "What this spec rests on, confirmed by the person or marked unconfirmed: stack, auth scheme, platforms or browsers, data, scale and who uses it, whichever apply."
    - After `### Policy constraints applied` and its bullet, add `### Boundaries` with three lines: `Always: <what an agent may always do here>`, `Ask first: <what needs a person's yes>` and `Never: <what is off limits>`.
    - Keep every existing heading and its order.
13. Add the assumptions step to `commands/spec.md`. (S; R11, R12; track S)
    - Insert `### 3. Check assumptions and targets` before the current step 3 and renumber steps 3 to 7 as 4 to 8; update the in-text references ("when step 4 wrote an ADR" becomes step 5).
    - Content: list the assumptions as a numbered list, ask the person to correct them in one message and wait.
    - Turn each vague ask in the intent ("faster", "simpler", "more reliable" and the like) into a measurable criterion with a proposed target and ask in the same message whether the target is right.
    - When the person has said to go ahead without questions or no one is there to answer, write the assumptions under `## Assumptions` marked `unconfirmed`, carry on and name them in the report.
    - In the write step, fill `## Assumptions` and `### Boundaries` from the answers.
    - Run the `spec-from-intent` case's scaffold mentally against the new step: an unattended run must still reach the commit.
14. Add the capability map to `commands/spec.md` and module plans to `commands/plan.md`. (S; R14, R23; track S, after steps 10 and 11)
    - `/spec` step 1: when the intent spans more than one module or would need more than about fifteen requirements, offer a capability map once as a yes or no question.
    - On yes: write `<intent dir>/capability-map.md` with a table (id, module, purpose, depends on, build order) using short stable ids such as `m1`, then one `spec-<module-id>.md` per module from the template, committed together; say that modules are planned and built one at a time in build order because they share the intent's branch name.
    - On no: write one `spec.md` as before.
    - `/spec` ADR step: replace the folder rule with "find the folder and numbering as `/adr` step 2 does".
    - `/plan` step 1: a path to `spec-<module-id>.md` writes `plan-<module-id>.md` beside it.

    Checkpoint D: `node tests/check.mjs sdlc-contract` shows no failure for the spec anchors; `grep -n "^### " plugins/pro-ai-sdlc/commands/spec.md` shows steps 1 to 8 in order.

15. Add the test lens to `agents/verifier.md`. (S; R21, R22; track V)
    - Insert a section `## 4. Check the tests` before `## 4. Report` and renumber the report section to 5.
    - Scope: only tests the diff added or changed.
    - For each new function or behavior, walk the scenario list: happy path, empty input, boundary values, error paths and concurrency where it applies.
    - Check one concept per test, no shared mutable state between tests, mocks only at system boundaries.
    - State the rule `A test that never fails is useless`: a test with no assertion, one that asserts only on its own mock or one that would pass with the change reverted.
    - Add one line: pro-quality's `code-reviewer` walks the same list; this agent does not depend on it.
    - Report: add item `6. Tests: the scenarios missing for new behavior and any test that cannot fail, or "right tests"`.
    - Verdict: missing scenarios for new behavior make it at best `VERDICT: incomplete`; a test that cannot fail makes it `VERDICT: fail`.
    - Description: add "and checks that the tests it added are the right tests" without dropping any existing words.
    - End with the footer `Test lens adapted from addyosmani/agent-skills (agents/test-engineer.md), MIT, Copyright (c) 2025 Addy Osmani.`
    - Run `node tests/route-lexical.mjs --min-rank1 70` and confirm the verifier case at `tests/cases/routing.jsonl` line 84 still ranks it first.
16. Mirror the verifier into `.codex-plugin/agents/verifier.toml`. (XS; R26, AC11; track V, after step 15)
    - Copy the step 15 body into `developer_instructions` and the new description into `description`.
    - Diff the two bodies (strip the frontmatter and the toml wrapper) and expect no difference.
17. Edit `agents/simplifier.md` and `.codex-plugin/agents/simplifier.toml`. (S; R25, R26, AC13; track V)
    - Bash line: "Use Bash only for `git status`, `git diff`, `git log`, `git blame` and the verify command."
    - New section `## 2b. Before removing anything` after `## 2. What to remove`: Grep for every caller; read `git log -S<symbol>` and `git blame` on the lines; leave it and report it when the history gives a reason, such as a bug fix or a workaround.
    - Add to "Leave alone": a helper that names a concept, even with one caller; an inline that makes the caller longer or harder to read; merging two things that only look alike.
    - Footer: `Callers-and-history check and balance rule adapted from addyosmani/agent-skills (skills/code-simplification/SKILL.md), MIT, Copyright (c) 2025 Addy Osmani.`
    - Copy the body into the `.toml` and diff the two as in step 16.
18. Edit `commands/adr.md` and `templates/adr.md`. (S; R23, R24, AC12; track A)
    - Context: extend "ADR folders present" to `docs/adr docs/decisions doc/adr adr docs/architecture/decisions decisions`.
    - Step 2: before picking a folder, look for existing ADRs in those folders; match the folder, the number format (width and any prefix), the file extension and the heading and status style of the newest one; only when none exist use `docs/adr/`.
    - Step 1: ask whether the decision replaces or retires an earlier ADR.
    - Step 4: an ADR retired with no replacement gets status `deprecated` with the date and its index row updated; add `Never delete an old ADR; mark it superseded or deprecated.`
    - `templates/adr.md`: the status line becomes `Status: proposed | accepted | deprecated | superseded by <NNNN>`.
    - Footer on `commands/adr.md`: `Convention check and deprecated status adapted from addyosmani/agent-skills (skills/documentation-and-adrs/SKILL.md), MIT, Copyright (c) 2025 Addy Osmani.`

    Checkpoint E: `node tests/check.mjs` passes with 0 failures; `node tests/route-lexical.mjs --min-rank1 70` passes.

19. Attribution. (XS; R27, AC14)
    - Footers on `commands/execute.md` (after the never-merge line), `commands/spec.md` and `commands/plan.md`, naming the upstream files from the intent's Evidence: `commands/build.toml`, `skills/incremental-implementation/SKILL.md` and `skills/git-workflow-and-versioning/SKILL.md` for execute; `skills/spec-driven-development/SKILL.md` for spec; `skills/planning-and-task-breakdown/SKILL.md` for plan; each with "MIT, Copyright (c) 2025 Addy Osmani".
    - `plugins/pro-ai-sdlc/LICENSE`: add a `#` notice block at the top in the form of `plugins/pro-quality/LICENSE` naming `templates/REVIEW.md`, the loop text in `/execute`, `/spec`, `/plan` and `/adr`, the verifier and simplifier additions and `references/definition-of-done.md`; add `Copyright (c) 2025 Addy Osmani` under the existing copyright line.
    - `docs/licenses.md`: add a pro-ai-sdlc row after line 65 for "loop guardrails in `/execute`, `/spec`, `/plan` and `/adr`, the verifier and simplifier additions and `references/definition-of-done.md`", upstream addyosmani/agent-skills, MIT, Copyright (c) 2025 Addy Osmani, adapted.
20. READMEs. (XS)
    - `plugins/pro-ai-sdlc/README.md`: add `references/definition-of-done.md` after the templates list with one line on what cites it plus one line on the `/execute` stop list.
    - Root `README.md` pro-ai-sdlc line near 239: add "a standing definition of done every plan cites" and "a stop list that pauses `/execute` before risky steps".
21. Bump versions. (XS; R30, AC15)
    - pro-ai-sdlc takes a minor bump (0.9.0 to 0.10.0 at planning time) in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and its entry in `.claude-plugin/marketplace.json`; `metadata.version` takes one minor bump (1.64.0 to 1.65.0 at planning time).
    - Take both numbers from `main` at build time; if main has moved, bump from there.
    - Append the same sentence to the description in all three places: "/execute pauses before steps that touch auth, migrations, payments, deploys or secrets unless the plan's Risks names them; every plan cites references/definition-of-done.md." Keep the three descriptions identical.
22. Run the proof of done, then the trials. (S; AC1 to AC16)
    - The four commands under Proof of done.
    - AC2: delete the `## Scope discipline` heading line from `commands/execute.md`, run `node tests/check.mjs sdlc-contract`, expect a failure, restore with `git checkout -- plugins/pro-ai-sdlc/commands/execute.md`.
    - AC3: `claude plugin eval plugins/pro-ai-sdlc --case 'execute-pauses-on-migration' --runs 1 --model sonnet --no-publish --scaffold --allow-tools Bash Write Edit --trust-plugin` (source `~/.zshrc` and map `MIERUKA_ANTHROPIC_API_KEY` to `ANTHROPIC_API_KEY` first).
    - AC4: in the same scaffold with a `## Risks` line naming migrations and `Approver: Sam Rivera`, run `/pro-ai-sdlc:execute` headless and expect the consented line and no pause at that step; if the run cannot reach the step (no `gh`), reading the transcript up to the stop list is enough.
    - AC8: hand a fresh Sonnet subagent `commands/plan.md` step 3, the due-dates spec from the eval scaffold and a plan with the step for one R removed; expect it to name that R.
    - AC10: in the `verifier-after-build` scaffold, add a test that only covers the happy path for `overdueTasks`, dispatch the verifier and expect a `Tests` line naming missing scenarios and no `VERDICT: pass`.
    - AC11: the two diffs from steps 16 and 17.
    - Optional, tokens permitting: `claude plugin eval plugins/pro-ai-sdlc --case 'spec-from-intent' --runs 1 --model sonnet --no-publish --scaffold --allow-tools Bash Write Edit` to show the unattended fallback still commits (flagged concern 2).

## Tests that prove it

- `node tests/check.mjs sdlc-contract` covers AC2, AC5, AC6, AC7, AC9, AC12 and AC13 through the anchors added in steps 1 and 7.
- `node tests/check.mjs agents` and `node tests/check.mjs codex-parity` cover AC11 alongside the body diffs in steps 16 and 17.
- `node tests/check.mjs evals` covers the shape of the new eval case; the live run in step 22 covers AC3.
- `node tests/check.mjs` (the version-bump and manifest checks) covers AC15.
- The trials in step 22 cover AC4, AC8 and AC10 and need a person to read the output.
- `grep -n "0017" docs/decisions/README.md` and the ADR's status line cover AC16.
- `grep -n "Addy Osmani" plugins/pro-ai-sdlc/LICENSE docs/licenses.md` and a grep for "agent-skills" over the edited commands and agents cover AC14.

## Risks

The step most likely to go wrong is step 13.
An assumptions step that waits for a person can stall unattended runs, the `spec-from-intent` eval among them; the unattended fallback is the guard and step 22 can run that eval to prove it.
Steps 2 and 3 are the next riskiest: a stop list that fires on ordinary words (a `middleware/` folder, a test named `session`) would make `/execute` pause on routine work and teach people to approve by habit.
The path names come from the classifier, which already excludes tests and fixtures; the stop list should say the same.
The doubt-driven-execute intent also edits `commands/execute.md`; this plan keeps its edits in two named sections and one-line pointers so the two merge cleanly.
The verifier's new `fail` rule could fail a sound build if it misreads a test as unable to fail; the rule names the three concrete shapes to keep it narrow.
Capability maps share the intent's branch name and `plan-sync` counts only `plan.md`; this batch documents that limit rather than fixing the scripts.

Stop-list categories: none
Categories this plan touches on the stop list: none.
The batch edits prose in a plugin; no auth, migration, payment, deploy or secrets path changes.
Nothing here is irreversible: no migration, no data and no deploy.
A bad prompt reaches every loop run on an updated install until the next release.

## Options not taken

- Two PRs (guardrails first, the rest after): the spec, plan and definition-of-done edits share two templates and one version bump; ordering the guardrails first gives the same review order.
- Run the classifier script directly from pro-ai-sdlc: no portable path to pro-ship's script and no dependency allowed.
- A shared scenario-list file read by the verifier and `code-reviewer`: cross-plugin reads break the layering; item 18 decides.
- Fix `execute-gate.py` for module plans now: grows the batch; the intent said to split item 29 out if it grows.
- A routing case for the new reference file: it is not a skill and nothing routes to it.

## Proof of done

Run in this order from the repo root; every command must pass.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
git diff origin/main --stat -- plugins/pro-ai-sdlc/scripts plugins/pro-ai-sdlc/hooks
grep -c "Never merge, never push to the default branch" plugins/pro-ai-sdlc/commands/execute.md
```

Expected: `node tests/check.mjs` ends with 0 failures and no more warnings than on `main` before the change, the dry eval and unit tests pass, rank-1 stays at or above 70%, `✔ Validation passed` prints once for the marketplace and once per plugin directory, the `git diff` prints nothing and the grep prints 1.
Then the trials in step 22.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: see `git log` on feat/sdlc-loop-upgrades (the last commit before this one is the version bump, step 21; the plan fill-in and the check.mjs fix follow it).
- Checks run:
  - `node tests/check.mjs`: pass, 33 checks, 0 failures, 12 warnings (CLAUDE.md's last recorded run showed 13 warnings; not compared against a fresh run on main).
  - `node tests/eval.mjs --dry`: pass, 88 cases reference real skills, 98 skills in catalog.
  - `node tests/route-lexical.mjs --min-rank1 70`: pass, rank-1 69/87 (79.3%), 3 notOneOf warnings.
  - `node --test tests/unit/*.test.mjs`: pass 165, fail 0.
  - `claude plugin validate . --strict`: Validation passed.
  - Loop over `plugins/*/` with `claude plugin validate --strict`: all passed.
  - `git diff origin/main --stat -- plugins/pro-ai-sdlc/scripts plugins/pro-ai-sdlc/hooks`: empty.
  - `grep -c "Never merge, never push to the default branch" plugins/pro-ai-sdlc/commands/execute.md`: 1.
- Definition of done: not met on one item: the verifier agent was not dispatched in this build, so its verdict is not recorded (pro-ai-sdlc `references/definition-of-done.md`, shipped by this plan). All other items met.
- AC1: pass (the commands above).
- AC2: pass after a fix. Deleting the `## Scope discipline` heading line first still passed, because step 5 names the heading inline. The check now also requires `## Stop list` and `## Scope discipline` as their own lines; deleting the heading then failed `sdlc-contract` and `git checkout` restored it. The other anchors were not each deleted by hand.
- AC3: not run, needs Jody (live `claude plugin eval` spends API tokens). The case passes `node tests/check.mjs evals`.
- AC4: not run, needs Jody (headless `/execute` run).
- AC5: pass (sdlc-contract anchors; `execute-gate.py` has no diff).
- AC6: pass for the text (anchors in `/spec` and `templates/spec.md`); the unattended `spec-from-intent` eval was not run, needs Jody.
- AC7: pass (anchors in `/plan` and `templates/plan.md`, `- Build commit:` unchanged).
- AC8: not run, needs Jody (fresh subagent trial).
- AC9: pass (file exists, states the precedence, cited by `/plan`, `/execute` and `templates/plan.md`).
- AC10: not run, needs Jody (verifier trial on the verifier-after-build scaffold).
- AC11: pass (body diffs of verifier and simplifier against their `.toml` twins are empty; both still `model: sonnet`; `check.mjs agents` and `codex-parity` pass).
- AC12: pass (anchors in `/adr` and `templates/adr.md`; `/spec` points to `/adr` step 2).
- AC13: pass (anchors in both simplifier twins).
- AC14: pass (footers present, `docs/licenses.md` row and the LICENSE line added).
- AC15: pass (0.10.0 in both manifests and the marketplace entry, descriptions identical, `metadata.version` 1.65.0; main had not moved from 0.9.0 and 1.64.0).
- AC16: pass (ADR-0017 is `proposed` with its index row).
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0017 from `proposed` to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Planning, recorded before the build: the intent recommends running `risk-classify.py` on the plan's file list; the script classifies a git range and pro-ai-sdlc has no portable path to it, so `/execute` uses the prose list before the build and pro-ship's `risk-tiers` skill at checkpoints (spec R6, flagged concern 1).
- Step 22, AC2: the `sdlc-contract` anchor for the two `/execute` headings used a substring match that other text satisfied, so deleting the heading did not fail the check. `tests/check.mjs` now also requires each heading as its own line.
- Steps 2 to 5, 8 to 11, 12 to 14, 15 to 17, 19 and 20 were committed as groups, not one commit per step, as the plan allows.
- Step 14: the `/plan` module-plan line was written in step 10 with the other `/plan` step 1 edits.
  The spec footer was added in step 12 to 14 with the `/spec` edits instead of step 19.
- Step 22: the optional `spec-from-intent` run and the live trials (AC3, AC4, AC8, AC10) were not run; they spend API tokens or need a person.
- Review round 1 fixes: restored steps 9 to 22 and the later sections that the plan fill-in had overwritten.
  Subagent prompts now copy the stop list and scope rules and stop without committing on a stop-list signal.
  An explicit yes covers its category for the run and goes under Potential concerns.
  Classifier ids map to the five categories.
  The verifier's revert rule covers only tests that claim new behavior.
  Added anchors for the pause line, the env file rule, the verifier verdict text and the simplifier history heading, each proved by deletion, plus the eval case `execute-runs-consented-migration`.
  Wording fixes in `/execute`, `/plan`, `/spec`, the README, ADR-0017 and `docs/licenses.md`.
- Review round 2 fixes: consent now needs a `Stop-list categories:` line in Risks plus an approver, and the line is a `sdlc-contract` anchor.
  The plan file is always allowed in a step's commit, `git restore --staged` is allowed and named, and `/spec` has an unattended fallback for the capability-map question.

## Noticed but not touched

- `plugins/pro-ai-sdlc/LICENSE` was already missing the Addy Osmani line for `templates/REVIEW.md`; step 19 fixes it because this batch touches the same file.
