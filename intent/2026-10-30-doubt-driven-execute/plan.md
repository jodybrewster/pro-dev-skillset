# Plan: doubt-driven step in /execute

Built from `spec.md` and `intent.md` in this folder, committed together with this plan.
Status: approved.
Approver: Jody Brewster.
Dated: 2026-10-30.

Jody approved the plan with the batch on 2026-10-30 and named the changes in the Departures section.
Jody is named as approver because the change adds a rule every `/execute` build follows (ADR-0019) and lets a session send code to a second vendor on a yes.
The skill's prose is the product and AC6 and AC7 need a person to watch one real run.
It does not suit auto mode.

This plan builds after two other intents merge: sdlc-loop-upgrades and codex-second-reviewer.
Step 1 checks both and stops if either is missing.
Sections those intents add are named by heading, never by line number.
Version numbers are read from `main` at build time.

## Files that change

In pro-ai-sdlc (new):

- `plugins/pro-ai-sdlc/skills/doubt-driven-development/SKILL.md` (new): the claim, extract, doubt, reconcile and stop cycle, the trigger rules, the Codex offer and the Done line (R1 to R4, R8 to R16, R19, R20, R22, R23, R28).
- `plugins/pro-ai-sdlc/skills/doubt-driven-development/doubt-instructions.md` (new): the reviewer's fixed adversarial text with no placeholder (R5, R28).
- `plugins/pro-ai-sdlc/skills/doubt-driven-development/handoff.md` (new): the four fields (R6, R7).
- `plugins/pro-ai-sdlc/scripts/codex-run.py` (new): a byte-identical copy of `plugins/pro-ship/scripts/codex-run.py` (R17).

In pro-ai-sdlc (modified):

- `plugins/pro-ai-sdlc/commands/execute.md`: a `## Doubt` section beside the stop list section, a pointer from step 5, a stage line and the report line (R18 to R20).
- `plugins/pro-ai-sdlc/commands/plan.md`: when to mark a step irreversible (R21).
- `plugins/pro-ai-sdlc/templates/plan.md`: the `irreversible` marker and the `Doubt:` line under Done (R21, R22).
- `plugins/pro-ai-sdlc/LICENSE`: the Addy Osmani attribution, unless sdlc-loop-upgrades already added it (R28).
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`: minor version bump; the description names the skill.
- `plugins/pro-ai-sdlc/.codex-plugin/plugin.json`: the same version and description plus `"skills": "./skills/"` (R26).

At the root:

- `tests/check.mjs`: a new `doubt` check and two barred names added to the `handoff` check (R24, R25).
- `tests/cases/routing.jsonl`: one case for the skill (R27).
- `tests/cases/components-uncovered.json`: one entry for the skill (R27).
- `docs/licenses.md`: one pro-ai-sdlc row (R28).
- `README.md`: the pro-ai-sdlc description line names the skill.
- `docs/roadmap.md`: item 12 marked built with the PR link.
- `.claude-plugin/marketplace.json`: the pro-ai-sdlc entry version and description plus `metadata.version`.

Already written at the spec stage and not changed by the build: `docs/decisions/0019-doubt-before-irreversible-steps.md` and its row in `docs/decisions/README.md` (AC12).
No hook is added, so `plugins/pro-ai-sdlc/hooks/hooks.json` does not change.
No bridge skill is added, so `plugins/pro-core/registry/engines.json` does not change.
No agent is added, so no `.toml` is needed.

## Order of work

Sizes are XS (under 30 minutes) and S (under two hours).
Steps 2 to 3 come first so the checks fail before the files exist.
After the first checkpoint, steps 4 to 6 (skill files), 7 (execute) and 8 (plan template and command) touch separate files and can run in parallel; step 6 reads the names fixed in steps 4 and 5.
Steps 9 and 10 are independent of each other.
Step 11 is last among the edits because it touches the shared marketplace file.

1. (XS) Rebase and confirm the two predecessors. (all R)
   - Run `git fetch origin && git rebase origin/main`.
   - Confirm sdlc-loop-upgrades has merged: `plugins/pro-ai-sdlc/commands/execute.md` has a stop list section (a heading that names the stop list or lists auth, migrations, payments, deploys and secrets) and `plugins/pro-ai-sdlc/templates/plan.md` has a size marker on steps.
   - Confirm codex-second-reviewer has merged: `plugins/pro-ship/scripts/codex-run.py` is tracked (`git ls-files plugins/pro-ship/scripts/codex-run.py`).
   - Read the runner's usage line at the top of `codex-run.py` and note its exact arguments for step 6.
   - Read how the stop list section finds pro-ship's `risk-classify.py` and note it for step 7.
   - If either intent has not merged, stop and report; do not build against a guess.
   - Read the current pro-ai-sdlc version from `plugins/pro-ai-sdlc/.claude-plugin/plugin.json` and `metadata.version` from `.claude-plugin/marketplace.json`.
2. (S) Add the `doubt` check and extend the `handoff` check in `tests/check.mjs`, then see them fail. (R24, R25, AC3, AC4)
   - Follow the shape of `checks["handoff"]`: build `failures` and `warnings`, return `{ failures, warnings }`, add a short comment above naming R24.
   - Name the folder `plugins/pro-ai-sdlc/skills/doubt-driven-development/`.
   - Fail when `SKILL.md`, `doubt-instructions.md` or `handoff.md` is missing there.
   - Fail when `doubt-instructions.md` matches `/\{[^}\n]*\}/` or `/<[A-Za-z][^>\n]*>/` (any placeholder in braces or angle brackets).
   - Fail when `doubt-instructions.md` does not contain "Do not validate".
   - Fail when `SKILL.md` does not contain "three rounds" or does not contain "never sent to the reviewer".
   - Fail when `plugins/pro-ai-sdlc/commands/execute.md` has no line equal to `## Doubt` or does not contain `doubt-driven-development`.
   - Read `plugins/pro-ship/scripts/codex-run.py` and `plugins/pro-ai-sdlc/scripts/codex-run.py` as Buffers; fail when exactly one exists or when `!a.equals(b)`; when neither exists, fail with "plugins/pro-ship/scripts/codex-run.py missing".
   - In `checks["handoff"]`, change the barred-placeholder regex from `description|summary|findings` to `description|summary|findings|claim|reasoning`.
   - Run `node tests/check.mjs doubt` and expect failures for the missing skill files, the missing section and the missing copy.
   - Run `node tests/check.mjs handoff` and expect a pass.
3. (XS) Copy the runner. (R17, AC4)
   - `cp plugins/pro-ship/scripts/codex-run.py plugins/pro-ai-sdlc/scripts/codex-run.py` and keep its file mode (`chmod --reference` is not on macOS; use `ls -l` on both and `chmod +x` if the source is executable).
   - `cmp plugins/pro-ship/scripts/codex-run.py plugins/pro-ai-sdlc/scripts/codex-run.py` prints nothing.
   - `git add` it so it is tracked.
   - Run `node tests/check.mjs doubt` and expect the runner failure gone.
   - Commit steps 2 and 3: "test: doubt check and runner copy".

Checkpoint A: `node tests/check.mjs doubt` fails only on the skill files and the `## Doubt` section; `node tests/check.mjs handoff` passes.
Change one byte in the copy, see the `doubt` check name the runner, then restore it with `git checkout -- plugins/pro-ai-sdlc/scripts/codex-run.py` (AC4).

4. (XS) Write `doubt-instructions.md`. (R5, R28, N4; parallel)
   - Adapt the upstream adversarial prompt from `skills/doubt-driven-development/SKILL.md` in addyosmani/agent-skills (Step 3, the fenced block) into plain sentences, one per line.
   - It says: this is an adversarial review; find what is wrong with the change in the range; assume the author is overconfident; look for unstated assumptions, edge cases not handled, hidden coupling or shared state, ways the brief could be violated, conventions in the policy files it breaks and failure under unexpected input.
   - It says "Do not validate." and "Do not summarize." as two lines, then: find problems or say plainly that you found none after a thorough read.
   - It says how to work: run `git diff` on the range, read the code around each hunk, read every brief and policy path yourself, run nothing that writes, never open, read or quote env files (`.env` and its variants).
   - It says how to report: one finding per entry with file, line, a one-sentence problem and a failure scenario that names the input or state that breaks it; a finding with no failure scenario is dropped.
   - It contains no braces and no angle brackets anywhere, the footer included.
   - End with the footer line from R28.
   - Run `node tests/check.mjs doubt` and expect this file's failures gone.
5. (XS) Write the skill's `handoff.md`. (R6, R7, R25; parallel)
   - Copy the structure of `plugins/pro-quality/skills/requesting-code-review/handoff.md`: an opening line, the paths-relative-to-repo-root lines, a `## Fields` heading with four bullets in the form "- `name`: ..." and the closing line on what never goes in.
   - `range`: `<sha before the step>..<head of the step>`, never a description of the step or a file list.
   - `brief`: the paths to `plan.md` with the step number, `spec.md` and `intent.md`, never a paraphrase or an excerpt.
   - `policy`: the paths to `REVIEW.md`, `CLAUDE.md` or `AGENTS.md` and `CONSTRAINTS.md` when each exists, never a copy of the rules.
   - `risk`: the classifier's tier and signal ids when it ran, else `unclassified`, never the author's view.
   - Closing line: nothing else goes in any field: no claim, no author description, no reasoning, no session summary and no earlier findings.
   - Run `node tests/check.mjs handoff` and expect a pass; it now covers this file.
6. (S) Write `SKILL.md`. (R1 to R4, R8 to R16, R19, R20, R22, R23, R28, N3; after steps 4 and 5)
   - Frontmatter: `name: doubt-driven-development` and a `description` of one or two sentences: use when `/execute` or a build session reaches a step that is hard to undo (a data migration, a public API change, an auth rule, a deploy or infrastructure config or a delete other code depends on) and the decision should face a fresh-context reviewer before the next step; not for mechanical edits, renames, one-line changes, specs or plans (goldfish covers those).
   - When to use and when not (R2), the main-session rule (R3) and the link to goldfish (R23).
   - The cycle, one short subsection each:
     - Claim: two or three lines the session writes for itself; the sentence "The claim is never sent to the reviewer." appears verbatim.
     - Extract: the range is the step's committed range; a step too big to hold in one read is split, not given more rounds.
     - Doubt: read `doubt-instructions.md` and `handoff.md`, fill the four fields, dispatch a fresh subagent with the full instruction text followed by the filled fields and nothing else; never a fork; name Opus and high effort; under Codex start a fresh agent run with the same text.
     - Codex offer (R13 to R16): interactive only, after each single-model round, show the exact command and say it sends the diff and paths to OpenAI; on yes write the filled fields to `$(git rev-parse --git-dir)/doubt/step-<n>-round-<r>.md` and run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/codex-run.py"` with the arguments its usage line names (noted in step 1), `doubt-instructions.md` as the instruction file and that prompt file; on failure print "Codex could not run: <reason>" and offer retry or skip; in a non-interactive run print "Cross-model skipped: non-interactive run."; under Codex itself the offer is not made.
     - Reconcile (R9, R10): the four classes in order, the dedupe list kept by the session and never sent, fixes in a new commit.
     - Stop (R11, R12): "three rounds" verbatim, the early stops, no round on an unchanged diff, the stop for the person after three open rounds and the validating-not-doubting stop.
   - Record (R22): the `Doubt:` line format with one example line.
   - End with the footer from R28.
   - Keep the body under 200 lines and use "dispatch a fresh subagent" wording, never a Claude-only tool name, so the `codex-parity` check stays clean.
   - Run `node tests/check.mjs doubt` and `node tests/check.mjs codex-parity`; expect only the `## Doubt` failure left in `doubt`.
   - Commit steps 4 to 6: "feat(pro-ai-sdlc): doubt-driven-development skill".

Checkpoint B: `node tests/check.mjs handoff` and `node tests/check.mjs codex-parity` pass and `node tests/check.mjs doubt` fails only on `commands/execute.md`.
Add `{claim}` to `doubt-instructions.md`, see `doubt` fail, restore; add a `` - `claim`: `` bullet to the skill's `handoff.md`, see `handoff` fail, restore (AC3).

7. (S) Add the `## Doubt` section to `commands/execute.md`. (R18 to R20, AC5; parallel with step 8)
   - Place it directly after the stop list section added by sdlc-loop-upgrades, at the same heading level (`## Doubt` if the stop list is a `##` section; if the stop list sits under `## Your task`, still use a `## Doubt` line placed right after that task step and before `### 6.` and record the placement under Departures).
   - Content, one sentence per line:
     - A step is doubted when the plan marks it `irreversible`; it runs with no question because the person approved the plan.
     - When pro-ship is installed, after each step's commit run its `risk-classify.py` with `--base <sha before the step> --head HEAD --json` and no `--intent`, found the same way the stop list section finds it; a tier of `high` makes an unmarked step a candidate; an interactive run asks once naming the tier and the signal ids; a non-interactive run doubts it with no question; exit 2 prints "classifier could not run: <reason>" and the step goes on; without pro-ship say once that the classifier backstop is skipped.
     - The `doubt-driven-development` skill runs in this session after the step's commit and before the next step; a builder subagent's step is doubted here after the subagent returns.
     - The skill's dispatch carries its own env-file rule, so the Secrets copy rule is met without adding text to the handoff.
     - After three rounds with open findings an interactive run stops at that step and prints the open findings in your own words; an unattended run finishes the build, opens the PR with `gh pr create --draft` and lists them under "Potential concerns".
     - Record each doubted step as one `Doubt:` line under `## Done`.
   - In `### 5. Build the plan`, add one line: "After a step's commit, run the `## Doubt` section before the next step."
   - Add "step N doubted (R rounds)" to the list of stage lines in the opening paragraph.
   - In `### 8. Report`, add "the doubted steps with their rounds".
   - Do not add `codex-run.py` or `risk-classify.py` to `allowed-tools`; each run asks.
   - Run `node tests/check.mjs doubt` and `node tests/check.mjs sdlc-contract`; both pass.
8. (S) Add the marker to `templates/plan.md` and the rule to `commands/plan.md`. (R21, R22, AC5; parallel with step 7)
   - Read how a step's size is written in `templates/plan.md` after the rebase and add `irreversible` in the same place and style, with a few words on what cannot be undone, for example `1. (S, irreversible: drops the legacy column) <step>` when sizes read `1. (S) <step>`; use a `- Irreversible: <what>` sub-bullet instead when sizes are a `- Size:` sub-bullet.
   - Under `## Done` add `- Doubt: <one line per doubted step: step, trigger, rounds, Codex ran, skipped or could not run, how each finding was settled; "none" when no step was doubted>` after the existing lines and before Sign-off.
   - Keep every existing section name and order; the `sdlc-contract` check and `execute-gate.py` read them.
   - In `commands/plan.md` step 2 or the sizing rule sdlc-loop-upgrades added, add: mark a step `irreversible` when it changes a data migration, a public API, an auth rule or a deploy or infrastructure config or when it deletes a file other code depends on; name each marked step under Risks; `/execute` doubts marked steps before going on.
   - Run `node tests/check.mjs sdlc-contract` and `node tests/execute.mjs` (or `node tests/check.mjs execute-scripts`); both pass, which shows the gate still parses the template.
   - Commit steps 7 and 8: "feat(pro-ai-sdlc): /execute doubts irreversible steps".

Checkpoint C: `node tests/check.mjs` reports 0 failures apart from any version-bump failure, which step 11 clears.

9. (XS) Routing and coverage. (R27, AC9; parallel with step 10)
   - Append to `tests/cases/routing.jsonl`: `{"prompt": "Before this migration step stands, have a fresh reviewer with no context try to break the change and offer a Codex second opinion.", "expect": "doubt-driven-development", "notOneOf": ["egm-bridge", "requesting-code-review"], "note": "pro-ai-sdlc doubt step for a hard-to-undo build decision"}`.
   - Add `{"id": "pro-ai-sdlc/skill:doubt-driven-development", "reason": "a positive eval needs a live /execute build with a subagent dispatch; covered by the doubt check and the manual trial"}` to `tests/cases/components-uncovered.json`.
   - Run `node tests/eval.mjs --dry` and `node tests/route-lexical.mjs --min-rank1 70`; rank-1 stays at or above 70.
   - If the new case is not rank-1 lexically, leave it; the gate is the overall rate and the model router decides the rest.
10. (XS) Attribution and docs. (R28, AC10; parallel with step 9)
    - `docs/licenses.md`: add after the pro-ai-sdlc rows `| pro-ai-sdlc | doubt-driven-development | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT | Copyright (c) 2025 Addy Osmani | adapted |`.
    - `plugins/pro-ai-sdlc/LICENSE`: if it has no Addy Osmani line yet, add a short attribution notice at the top in the style of `plugins/pro-quality/LICENSE` naming the skill and "Copyright (c) 2025 Addy Osmani".
    - `README.md`: in the pro-ai-sdlc bullet of the plugin list, name the `doubt-driven-development` skill that `/execute` runs on irreversible steps.
    - `docs/roadmap.md`: mark item 12 built, in the style the roadmap uses for built items.
    - Commit steps 9 and 10: "docs: doubt-driven-development routing, coverage and attribution".
11. (XS) Bump versions and the Codex skills path. (AC8, AC11, ADR-0002; last edit)
    - pro-ai-sdlc goes up one minor from the version read in step 1, in `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`, `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` and its entry in `.claude-plugin/marketplace.json`.
    - `metadata.version` goes up one minor, once.
    - Add one sentence to the pro-ai-sdlc description in all three places: "A doubt-driven-development skill sends a hard-to-undo build step to a fresh-context reviewer before the next step, with an optional Codex second opinion."
    - Add `"skills": "./skills/"` to `plugins/pro-ai-sdlc/.codex-plugin/plugin.json`.
    - Run `node tests/check.mjs`; 0 failures.
    - Commit: "chore(pro-ai-sdlc): <new version>, marketplace <new metadata.version>".

Checkpoint D: run the full proof of done below.

12. (S) Manual trials for AC6 and AC7, run by Jody or with Jody watching.
    - In a scratch repo with pro-ai-sdlc installed from this branch, commit an approved plan with three steps, the second marked irreversible: a migration that drops a column which one function still reads.
    - Run `/execute` on it; expect a doubt round on step 2 only, a finding about the column still read and a `Doubt:` line under Done.
    - Ask the session to print the exact text it dispatched; confirm it is the instruction text plus four fields and has no claim.
    - Say yes to the Codex offer once; expect findings tagged `codex`.
    - Repeat with `codex` removed from `PATH`; expect "Codex could not run" and a Done line that says could not run.
    - Summarize the result in the PR body under the acceptance criteria; do not paste reviewer output.

## Tests that prove it

- `node tests/check.mjs doubt` covers R24, AC3 and AC4: the three skill files, no placeholder in the instruction text, "Do not validate", "three rounds", the claim sentence, the `## Doubt` section and the byte-identical runner copies.
- `node tests/check.mjs handoff` covers R25 and AC3: the skill's `handoff.md` has exactly the four fields and no `claim` or `reasoning` placeholder.
- `node tests/check.mjs sdlc-contract` and `node tests/check.mjs execute-scripts` show the edited `execute.md` and `templates/plan.md` still meet the contract and the gate.
- `node tests/check.mjs codex-manifests` and `node tests/check.mjs codex-parity` cover AC8 and R26.
- `node tests/eval.mjs --dry` and `node tests/route-lexical.mjs --min-rank1 70` cover AC9.
- `node tests/check.mjs component-coverage` passes with the new uncovered entry.
- `grep -n "Addy Osmani" docs/licenses.md plugins/pro-ai-sdlc/LICENSE` and `grep -n "Adapted from addyosmani/agent-skills" plugins/pro-ai-sdlc/skills/doubt-driven-development/*.md` cover AC10.
- `node tests/check.mjs` covers AC11 through the version-bump check.
- `git ls-files plugins/pro-ai-sdlc/skills/doubt-driven-development plugins/pro-ai-sdlc/scripts/codex-run.py` covers AC2.
- Step 12 covers AC6 and AC7.

## Risks

What might this break?
`templates/plan.md` is read by `execute-gate.py` (Status and the Build commit line) and by the `sdlc-contract` check; step 8 adds lines only and runs both.
`commands/execute.md` is checked for its never-merge line and named sections; step 7 adds a section and three lines.
A doubt section that fires too often would slow every build; it fires only on a plan marker or a high-tier classifier result; the classifier runs only when pro-ship is installed.
Adding the skills path to pro-ai-sdlc's Codex manifest makes Codex load a skill folder there for the first time; the `codex-manifests` check covers the shape.

Which step is the most likely to go wrong?
Step 6, the skill: it must hold the cycle, the Codex flow and the stop rules in under 200 lines of harness-neutral prose; its quality shows only in a real run (step 12).
Second is step 7, because its placement depends on how sdlc-loop-upgrades shaped the stop list; step 1 reads it first and a different shape is a recorded departure, not a guess.
The runner call in step 6 depends on codex-second-reviewer's usage line; if that interface takes no instruction file, pass the instruction text at the top of the prompt file instead and record it as a departure.

What was left out on purpose, with the reason?
A behavioral eval, because it needs a live build and a subagent; the uncovered entry says so and step 12 stands in.
The Codex engine row and install, which codex-second-reviewer owns.
A hook that blocks commits until doubt ran, which the intent rules out.
Any change to pro-quality's handoff or reviewer, which would need a pro-quality bump for no gain.

Which steps touch separate files and could run in parallel worktrees?
Steps 4, 5, 7 and 8 after checkpoint A; step 6 after 4 and 5; steps 9 and 10 together; step 11 last.

Overlaps with sibling work:

- sdlc-loop-upgrades, untrusted-input-safety and required-documents may each bump pro-ai-sdlc and `metadata.version`; take the next minor over `main` at build time (step 11) and rebase before pushing.
- ADR numbers 0016 to 0018 belong to sibling intents; if they merge after this branch, their rows go above the 0019 row in `docs/decisions/README.md` on rebase.
- If codex-second-reviewer changes `codex-run.py` later, both copies change in its commit or the `doubt` check fails; that is the intended guard.

Nothing here is irreversible: no migration, no data and no deploy.
A Codex run sends a diff to OpenAI only after a per-run yes.

## Options not taken

- Dispatch pro-quality's `code-reviewer`: it ignores text outside the four fields and pro-ai-sdlc cannot depend on it.
- Reference pro-quality's `handoff.md`: breaks layering; the checked copy keeps the shape.
- Pre-approve the runner in `allowed-tools`: turns the per-run yes into a one-time grant.
- Write a new runner: codex-second-reviewer already ships one; a copy with a byte check is cheaper and cannot drift silently.
- Put the doubt step inside `### 5. Build the plan` only: a section of its own beside the stop list keeps the two pauses readable and lets the check find it by heading.

## Proof of done

Run in this order from the repo root; every command must pass.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
cmp plugins/pro-ship/scripts/codex-run.py plugins/pro-ai-sdlc/scripts/codex-run.py
git ls-files plugins/pro-ai-sdlc/skills/doubt-driven-development plugins/pro-ai-sdlc/scripts/codex-run.py
```

Expected: `node tests/check.mjs` ends with 0 failures and no more warnings than on `main` before the change, the dry eval counts the new case, rank-1 stays at or above 70%, the unit tests pass, `✔ Validation passed` prints once for the marketplace and once per plugin directory, `cmp` prints nothing and the last command lists the three skill files and the runner.
Then the manual checks at checkpoints A and B (AC3, AC4) and the trial in step 12 (AC6, AC7).

## Done

Filled in when the build is finished, before sign-off.

- Build commit: e92d1fe (the version bump; the Done fill follows in the next commit)
- Checks run: `node tests/check.mjs` pass (36 checks, 0 failures, 12 warnings); `node tests/eval.mjs --dry` pass (89 cases, 99 skills); `node tests/route-lexical.mjs --min-rank1 70` pass (rank-1 70/88, 79.5%); `node --test tests/unit/*.test.mjs` pass (165, 0 fail); `claude plugin validate . --strict` pass; the per-plugin strict loop pass (20 of 20); `cmp` on the two runner copies prints nothing; `git ls-files` lists the three skill files and the runner.
- Definition of done: met
- AC1: pass, every command above passed.
- AC2: pass, `git ls-files` lists `SKILL.md`, `doubt-instructions.md`, `handoff.md` and `codex-run.py`.
- AC3: pass, `{claim}` and `<claim>` in the instruction text failed `doubt` and a `claim` bullet in the skill's `handoff.md` failed `handoff`; both passed once restored.
- AC4: pass, a one-byte change to the pro-ai-sdlc runner copy made `doubt` name the runner; it passed once restored.
- AC5: pass, `execute.md` has `## Doubt` with the plan marker, the high-tier classifier backstop, the three-round stop and the draft PR rule; `templates/plan.md` shows the `irreversible` marker and the `Doubt:` line; `commands/plan.md` tells the planner when to mark a step.
- AC6: not run, needs Jody (a hand trial of `/execute` on a throwaway repo).
- AC7: not run, needs Jody (the Codex yes path and the `codex`-off-PATH path; the real `codex` was not run).
- AC8: pass, the Codex manifest has `"skills": "./skills/"` and `codex-manifests` passes.
- AC9: pass, the routing case is in `routing.jsonl` and `eval.mjs --dry` counts 89 cases.
- AC10: pass, the `docs/licenses.md` row, the LICENSE notice and the footer on both skill files are in place.
- AC11: pass, pro-ai-sdlc is 0.11.0 in both manifests and its marketplace entry and `metadata.version` is 1.68.0, bumped once.
- AC12: pass, ADR-0019 and its row exist (written at the spec stage and updated for Jody's decisions).
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0019 from `proposed` to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Jody's decisions of 2026-10-30 changed the spec, plan and ADR-0019 before the build: an unattended run with open findings after three rounds finishes and opens a draft PR with the findings under "Potential concerns"; the trigger is the plan marker plus a high-tier classifier result with no medium-tier signal trigger; the skill's `handoff.md` is its own copy held by the `doubt` check (commit bbb469f).
- Step 2: the check compares the doubt `handoff.md` with pro-quality's by the four field names in order and the closing "Nothing else goes in any field" line, not byte for byte, because the `range`, `brief` and `risk` wording differs by design.
- Step 7: the stop list sits in its own `## Stop list` section followed by `## Scope discipline`, so `## Doubt` is placed after `## Scope discipline` and before `## Your task`.
- Step 7: the stop list section does not find `risk-classify.py` itself; step 5 of `/execute` uses pro-ship's `risk-tiers` skill, so `## Doubt` classifies through that skill with `--base`, `--head` and `--json` instead of a script path.
- Step 8: sizes sit inside the step's parentheses as "(size XS or S; R1, AC1)", so the marker is `irreversible: <what cannot be undone>` in the same parentheses; the `Doubt:` line goes after the `Definition of done:` line.
- Step 6: the runner's usage on main is `--instructions FILE --prompt FILE [--consent-ref REF]` and it also needs the repo's `codex` consent in `.claude/pro-dev.json`; the skill calls it with those flags, reads consent from the work tree (no `--consent-ref`) and tells the person to run `/pro-dev install` on `not-opted-in`.
