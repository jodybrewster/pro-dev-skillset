# Plan: review policy and convergence rules

Built from `spec.md` (commit 70b9e4d) and `intent.md` in this folder.
Status: draft.
Approver: Jody Brewster.
Dated: 2026-10-29.

Jody is named as approver because this change sets a rule every reviewer and gate in the marketplace will follow (the ADR the spec calls for) and changes the policy file every installing repo receives.
The blast radius is one plugin and the test is mostly prose, so it does not suit auto mode.
The wording of the rules is the product and the manual runs in steps 11 and 12 need a person to read the output.

Prerequisite, not a step: the spec says the ADR for the convergence rules is "to be drafted" and does not list it among the files this change ships.
So this plan treats the ADR as written and committed before the build starts (next free number is 0011, since ADR-0010 is the constraint-floor ADR).
If Jody wants it to ship in this PR, add `docs/decisions/0011-review-convergence.md` and its row in `docs/decisions/README.md` as one more step before step 12.

## Files that change

- `tests/check.mjs` (modified): the `sdlc-contract` check gains the R21 assertions, written first so they fail before the prose exists.
- `plugins/pro-ai-sdlc/templates/REVIEW.md` (modified): the four new sections, the skip-paths line, the summary-first output format and the two commented optional blocks (R1 to R8).
- `plugins/pro-ai-sdlc/agents/reviewer.md` (modified): `since <sha>`, the Pre-existing tag, class reporting, no duplicate claims and the summary-first report (R9 to R13).
- `plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml` (modified): the same instruction text as the agent file inside the TOML wrapper (R14).
- `plugins/pro-ai-sdlc/commands/review.md` (modified): `--since <sha>`, the session's already-raised list, the dropped count, the Pre-existing group and the summary-first report (R15, R16).
- `plugins/pro-ai-sdlc/commands/pr-babysit.md` (modified): the cap of three rounds in the heading, the Stop step and the Report step, Pre-existing threads skipped, a handled-threads list and one fix per class (R17 to R20).
- `docs/licenses.md` (modified): a pro-ai-sdlc row naming addyosmani/agent-skills as adapted for the optional lists.
  The existing "original" row is reworded so it no longer says no third-party text is included (AC8).
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json` (modified): version 0.6.1 to 0.7.0.
- `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` (modified): version 0.6.1 to 0.7.0, aligned with the Claude manifest.
- `.claude-plugin/marketplace.json` (modified): the pro-ai-sdlc entry to 0.7.0 and `metadata.version` from 1.59.1 to 1.60.0.

No hook, script, skill or registry row changes, so the hook-loading law and the engine registry are not touched.
The `README.md` lines about pro-ai-sdlc name no changed behavior and stay as they are.
The two evals under `plugins/pro-ai-sdlc/evals/review-*` carry their own `REVIEW.md` and an LLM grader that checks findings and not the tally position, so they need no edit.

## Order of work

Steps 2, 3, 5 and 6 touch separate files and can run as parallel subagents once step 1 is done.
Step 4 needs step 3.
Steps 8 and 9 come last so the version numbers are taken at merge time.

1. Add the R21 assertions to `tests/check.mjs` `sdlc-contract` and run `node tests/check.mjs sdlc-contract` to see it fail on each missing item. (R21)
   - The template has the headings "What failure looks like here", "Evidence", "Pre-existing" and "Rounds".
   - `reviewer.md` and `reviewer.toml` both name `Pre-existing` and `since`.
   - `pr-babysit.md` contains "three rounds" and does not contain "five".
2. Edit `templates/REVIEW.md`. (R1 to R8; parallel)
   - Add the four sections and the skip-paths line under "Leave out".
   - Replace the closing tally with the summary line `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>` at the top of the report and the "Nothing to fix." rule.
   - Add the design-smell list and the presumptive blockers as two HTML comments, each with a one-line instruction to uncomment.
   - Keep the three passes, severity rule, nit cap and "Learning from repeats" untouched, with no tier table and no sensitive-paths list.
   - Add the agent-skills footer in the form the forked pro-pdd skills use, after reading one of them for the exact wording.
3. Edit `agents/reviewer.md`. (R9 to R13, N1; parallel)
   - Accept an optional `since <sha>` in the diff spec and review `<sha>..HEAD` only.
   - Tag Pre-existing by comparing the range's added lines with `git show <base>:<path>` and list those findings last, outside the counts.
   - Report a class of bug once with its rule and every location.
   - Never list one claim under two passes.
   - Open with the summary line even when a repo's own `REVIEW.md` says to close with a tally.
   - State that the template or repo file wins only on repo-specific items.
   - Leave the Bash list as it is.
4. Copy the final body of `reviewer.md` into `.codex-plugin/agents/reviewer.toml` and diff the two bodies to show only the wrapper differs. (R14, AC4; after step 3)
5. Edit `commands/review.md`. (R15, R16; parallel)
   - Add `--since <sha>` to the argument hint and pass it in the diff spec.
   - Keep the already-raised list (pass, file, class or claim) in the session, drop repeats, say how many it dropped and never hand the list to the reviewer.
   - Say "no earlier sha recorded, running a full review" when there is none.
   - Report summary first with a Pre-existing group.
6. Edit `commands/pr-babysit.md`. (R17 to R20; parallel)
   - Change the heading, the Stop step and the Report step to three rounds and have the cap stop and ask whether to rethink the approach, listing what is open.
   - Skip threads tagged Pre-existing and list them in the report.
   - Keep a handled list and never start a round whose only open items repeat it.
   - Fix every instance of one class in the same round and reply once per thread with the same commit.
7. Run `node tests/check.mjs sdlc-contract` and expect it to pass. (R21, AC2, AC3, AC5)
8. Add the `docs/licenses.md` row and reword the "original" row. (AC8)
9. Bump the versions at merge time. (AC9)
   - Read the version on main first.
   - If this lands first, set both manifests and the marketplace entry to 0.7.0 and `metadata.version` to 1.60.0.
   - If the constraint-floor change landed first, rebase and take 0.8.0 and 1.61.0.
10. Run the full proof of done commands below. (AC1)
11. Run `/review` by hand on a fixture branch with one added bug, one bug on an untouched line and one bug repeated in three files.
    Paste the run into the PR. (AC6)
12. Run `/review <pr> --since <sha>` on the same branch and then on a clean diff.
    Paste both runs into the PR. (AC7)
13. Run the grep checks for a comma before the word and plus the em dash on every changed file, expecting 0 each. (AC10, N2)

## Tests that prove it

- AC1: the commands under "Proof of done" all exit 0.
- AC2: `grep -c "^## What failure looks like here\|^## Evidence\|^## Pre-existing\|^## Rounds" plugins/pro-ai-sdlc/templates/REVIEW.md` prints 4 and `grep -c "<!--" plugins/pro-ai-sdlc/templates/REVIEW.md` prints 2; the plain `grep -c "^## "` count in the spec does not by itself prove the four names, so the contract assertion from step 1 is the real test.
- AC3: `grep -l "Pre-existing"` over the four files lists all four.
  The step 1 assertion covers the two agent files.
- AC4: diff of the two instruction bodies, run as in step 4.
- AC5: `grep -n "five" plugins/pro-ai-sdlc/commands/pr-babysit.md` prints nothing and `grep -n "three rounds" plugins/pro-ai-sdlc/commands/pr-babysit.md` prints the cap lines.
- AC6: the manual `/review` run from step 11, shown in the PR.
- AC7: the manual `--since` and clean-diff runs from step 12, shown in the PR.
- AC8: `grep -n "agent-skills" docs/licenses.md` shows the new pro-ai-sdlc row and the footer is in the template.
- AC9: `git diff --stat` shows the three version files and the marketplace metadata.
  `claude plugin validate . --strict` also passes.
- AC10: the grep checks from step 13.
- R7 and R8 beyond the keywords are checked by reading the template diff; the contract check cannot see that a block is inactive, so the `<!--` count stands in.

## Risks

What might break:
Anything that parses the old closing tally.
No consumer exists today but `pr-check` and `code-reviewer` will read the new line, so the sibling specs must be given its exact text.
Repos with an older `REVIEW.md` keep a closing-tally instruction that now conflicts with the agent, which is why step 3 states that the summary line goes first regardless.
The three-round cap also ends loops that used to run five rounds, including rounds spent on failing checks and merge conflicts.

The step most likely to go wrong:
Step 3, because the Pre-existing judgment rests on `git diff` and `git show` alone with no `git blame`, so a line changed by an earlier commit in the same PR can be misread.
The spec accepts this and leaves `git blame` for later.
The prose must say to judge by the range only so the reviewer does not improvise.

What was left out on purpose and why:
Refreshing old `REVIEW.md` files, cross-session memory of findings, `git blame`, the tier table and sensitive paths, `CONSTRAINTS.md` and the `code-reviewer` agent.
The spec assigns each to another change or to later work.

Which steps could run in parallel worktrees:
Steps 2, 3, 5 and 6 after step 1, since they edit four different files.
Step 4 follows step 3 and steps 8 and 9 come last.
The shared risk is wording drift between the template, the agent and the two commands, so one reader should compare them against the same list of rules before step 7.

Overlap with intent/2026-10-29-constraint-floor:
That plan also edits `plugins/pro-ai-sdlc/agents/reviewer.md` and `commands/review.md` (to read `CONSTRAINTS.md`) and bumps pro-ai-sdlc and `metadata.version`.
Stack the two PRs.
Whichever merges second rebases onto main, resolves the two prose files by keeping both sets of rules and takes the next version above main (0.8.0 and 1.61.0 if this one is second).
The reviewer.toml twin changes in both PRs and has to be regenerated from the merged `reviewer.md` after the rebase, then diffed again for AC4.

Irreversible parts:
None.
Installed repos only receive the new template on a fresh install.
The plugin cache serves 0.7.0 once published.

Assumed, confirm with Jody:

- Confirmed by Jody on 2026-10-30: the round cap is three and counts every `/pr-babysit` round, including rounds that fix failing checks and conflicts (spec open question 1, flagged concern 2).
- Assumed, confirm with Jody: the finding count moves to the top of the report as one summary line (spec open question 2).
- Assumed, confirm with Jody: `/pro-dev update` refreshing an older `REVIEW.md` is out of this change (spec open question 4, flagged concern 6).
- Assumed, confirm with Jody: the ADR is a prerequisite and not a step in this PR.

If any of these change, steps 1, 3, 5 and 6 are the ones to adjust.

## Options not taken

- Put the ADR in this PR: the spec lists it as to be drafted and not among the shipped files, so it stays a prerequisite until Jody says otherwise.
- Add the assertions after the prose: the checks would then only confirm what was just written, so they come first and fail first.
- One shared sidecar for the rules: plugin files cannot be included across an agent file, so the five copies are guarded by the contract assertions instead (spec flagged concern 5).
- Edit the two `review-*` evals to match the new format: their grader reads findings and not the tally position, so changing them adds cost with no gain.
- Wait for the constraint-floor change before starting: the overlap is two prose files and a version number, which a rebase handles.

## Proof of done

Run from the repo root.
All must pass and the last command must print `✔ Validation passed` for each of the 20 plugin directories.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

Then the manual runs from steps 11 and 12 are pasted into the PR and the grep checks from step 13 print 0 on every changed file.

## Done

Filled in when the build is finished, before sign-off.

- Build commit:
- Checks run:
- AC1:
- Sign-off:

## Departures from plan

