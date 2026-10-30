# Plan: constraint floor and CONSTRAINTS.md

Built from `spec.md` (commit b23f41c, amended 2026-10-29 before approval) and `intent.md` in this folder.
Status: draft.
Approver: Jody Brewster.
It adds a hook that runs on every Bash call in every repo that installs pro-quality, which is why an approver is named at all.
No second approver is needed because Jody owns this marketplace and decided the spec, the four flagged concerns and ADR-0010 himself.
The blast radius is also small: the hook starts in warn mode, makes no network calls, edits nothing and fails open on any error.
The review pass in step 18 reads the script as a second pair of eyes.
Dated: 2026-10-29.

## Files that change

New:

- `plugins/pro-quality/scripts/floor-guard.py` (new): the guard, a Python 3 standard library `PreToolUse` hook that also runs from a shell as `--check` (R1, R13).
- `plugins/pro-quality/skills/constraints/SKILL.md` (new): explains the floor, the four sections, ratchets, exceptions and how the guard reads the file; ends with the upstream footer (R15, AC8).
- `plugins/pro-quality/commands/constraints.md` (new): the `/constraints` intake that writes a repo's `CONSTRAINTS.md` (R16, R17).
- `plugins/pro-quality/templates/CONSTRAINTS.md` (new): the file the command fills in and the guard parses (R14).

Modified in pro-quality:

- `plugins/pro-quality/hooks/hooks.json` (modified): one more entry under the existing `Bash` matcher of `PreToolUse`, with a 30 second timeout (R1, AC2).
- `plugins/pro-quality/LICENSE` (modified): add "Copyright (c) 2025 Addy Osmani" and a line in the attribution notice naming the `constraints` skill, the template and the guard's rule list as adapted (AC8).
- `plugins/pro-quality/.claude-plugin/plugin.json` (modified): version 0.12.0 to 0.13.0 and a description that mentions the floor guard and `/constraints` (version-bump law).
- `plugins/pro-quality/.codex-plugin/plugin.json` (modified): version aligned to 0.13.0 and the same description (Codex parity).

Modified in pro-ai-sdlc:

- `plugins/pro-ai-sdlc/agents/reviewer.md` (modified): read `CONSTRAINTS.md` when present as a policy path beside `REVIEW.md`; a diff that loosens it without a `floor-allow:` reason is Important in the compliance pass (R18).
- `plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml` (modified): the same words in `developer_instructions`, so the two stay identical (R18, Codex parity).
- `plugins/pro-ai-sdlc/commands/review.md` (modified): read `CONSTRAINTS.md` in "Load the policy", list it in the Context line for policy files and pass it to the `reviewer` subagent as a policy path (R18).
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json` (modified): version 0.6.1 to 0.7.0 (version-bump law).
- `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` (modified): version aligned to 0.7.0.

Modified at the root:

- `.claude-plugin/marketplace.json` (modified): the pro-quality entry to 0.13.0 with a description that mentions the guard, the pro-ai-sdlc entry to 0.7.0 and `metadata.version` from 1.59.1 to 1.60.0.
- `docs/licenses.md` (modified): a pro-quality row for `constraints` naming [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) as adapted and `constraints` added to the sentence about forked plugins that also hold original content if it applies (AC8).
- `tests/quality-hooks.mjs` (modified): the guard's cases, written before the script (AC3, AC4, AC5, AC6).
- `tests/cases/routing.jsonl` (modified): one routing case that expects `constraints`, so the skill is not added to `tests/cases/uncovered.json` (AC1).
- `README.md` (modified): the pro-quality bullet and the verify and review rows in the skills table mention the floor guard and `/constraints`.

At sign-off only:

- `docs/decisions/0010-constraint-floor.md` (modified): Status from proposed to accepted and "Where it is enforced" rewritten from "Not enforced yet" to the real paths.
- `intent/2026-10-29-constraint-floor/intent.md` and `intent/2026-10-29-constraint-floor/spec.md` (modified): `status` to accepted.
- `intent/2026-10-29-constraint-floor/plan.md` (modified): Status to implemented and the Done block filled in.

Not changed on purpose:

- `tests/check.mjs`: its `quality-hooks` check already runs every case that `runQualityHookCases()` returns, so new cases need no wiring.
- `tests/cases/uncovered.json`: it is a ratchet and the new skill gets a real case instead.
- `plugins/pro-core`: whether `/pro-dev install` offers `/constraints` is spec open question 5, left out so pro-core does not move.
- `plugins/pro-security`, `plugins/pro-ai-sdlc/agents/verifier.md` and `plugins/pro-quality/scripts/docs-before-push.py`: flagged concerns 2 and 4 defer them.
- `CLAUDE.md` and `AGENTS.md` (a symlink to `CLAUDE.md`): the "expected output" counts in "Verifying your work" go stale by one skill and a few cases.
  Those numbers are labelled as one run on one date, so refreshing them is a separate docs change.

## Order of work

Steps 1 to 6 are one track (the guard and its tests).
Steps 7 to 10, step 11 and step 12 are three more tracks.
The four tracks touch disjoint files, so the orchestrator dispatches them to four Sonnet subagents at once in one turn, each with a self-contained prompt that quotes its requirements.
Steps 13 to 18 need the tracks to finish and run in order.
Take the build off a worktree based on a fresh `origin/main`, because Jody merges in parallel.

Track A: the guard (one subagent, steps in order, test first inside each step).

1. Gating, range, mode and output with one probe rule. Satisfies R1 (file exists), R2, R3, R11, R12, N2, N3, N4.
   First write the cases in `tests/quality-hooks.mjs`: a helper that builds a throwaway repo with a `main` branch and a `feat` branch, a runner that sets `CLAUDE_GUARD_DIR` and `HOME` to temp dirs and cases for each of these.
   Silent: `git commit`, `git push --dry-run`, `ls`, a heredoc body that mentions `git push`, a clean diff and a diff that changes only a README.
   Acting: `git push`, `gh pr create`, `cd <path> && git push`, `git -C <path> push` and `bash -c "git push"`.
   Range: for `git push` the diff base is the upstream when set, else `origin/HEAD`, `origin/main` or `main`, whichever resolves first.
   For `gh pr create` the base is `origin/HEAD`, `origin/main` or `main`, whichever resolves first, never the upstream: a branch already pushed (upstream equal to `HEAD`) still has its PR diff judged on `gh pr create`, while `git push` on it uses the upstream (R3).
   Mode: warn by default, `mode` set to enforce and `mode.floor-guard` overriding `mode`.
   Output: warn prints a `systemMessage` and `additionalContext`, logs to `warn.log` and allows; enforce denies with a reason that names the findings and both ways to clear them.
   Could not run: a repo with no merge base, a non-git cwd and a malformed payload each allow and exit 0 and all but the malformed payload say the floor was not checked.
   Run `node tests/quality-hooks.mjs` and see the new cases fail because the script is missing.
   Then write `plugins/pro-quality/scripts/floor-guard.py`: segment splitting, heredoc stripping and `cd` and `-C` resolution copied from `plugins/pro-quality/scripts/docs-before-push.py` and extended to match `gh pr create` and skip dry runs, the mode lookup and `warn.log` writer copied from `plugins/pro-ai-sdlc/scripts/guard.py`, a 10 second timeout on every git call and `silenced-checker` as the one probe rule.
   Check: the step 1 cases pass.

2. The four diff rules that need no `CONSTRAINTS.md`. Satisfies R4 (`test-made-easier`, `test-deleted`, `assertion-removed`, `unfinished-work`), R5, R7, R10, AC3, AC4 and AC6.
   Cases first.
   For each rule there is one case that fires and one that stays quiet: a skipped test versus an unskipped one, a deleted test file versus a deleted source file, a removed `expect` with no replacement versus one rewritten to the same count, a stub versus real code and a bare `TODO` that never fires.
   Also cover R4a: a `.md` file that names `eslint-disable`, `.skip(` or `raise NotImplementedError` is not reported by `silenced-checker`, `test-made-easier` or `unfinished-work`, while the same text in a source file is.
   Also cover each way a file counts as a test file (`*.test.*`, `*.spec.*`, `*_test.*`, `test_*.py`, a `tests/`, `test/` or `__tests__/` directory) and one that does not.
   Cover the line number on the new side for added lines and the old side for removals.
   AC6: a line with `ghp_` plus 36 characters prints `[redacted]`, with the token built at run time so no literal credential sits in the test file.
   Also cover lines trimmed to 120 characters and the other prefixes in `REVIEW.md` (`sk-ant-`, `AKIA`).
   Then implement a unified diff parser (`git diff -U0 --no-color` plus `--name-status` for deletions) and the rules.
   Check: `node tests/quality-hooks.mjs` passes.

3. The `CONSTRAINTS.md` rules. Satisfies R4 (`rule-loosened`, `new-exception`), R6, R7 (the `Test files:` line), R8, AC3 and AC4.
   Cases first, using the section layout of R14.
   A minimum moved down is reported and moved up is silent; a maximum moved up is reported and moved down is silent; a number with no readable direction is reported on any change; a Floor bullet removed and a numbered row removed are reported; a new numbered rule and a removed Exceptions row are silent; an added Exceptions row is reported.
   With no `CONSTRAINTS.md`, neither rule can fire and the floor still applies (R6).
   A `Test files: a/**, b/*.x` line makes those paths test files.
   Then implement it, reading the old and new text of `CONSTRAINTS.md` from the diff range and pairing numbers within their direction as upstream `references/floor-guard.md` does.
   Check: `node tests/quality-hooks.mjs` passes.

4. The `floor-allow:` line. Satisfies R9, AC3.
   Cases first: an allowance with a reason clears only its own rule and the output lists it with the reason; one with no reason clears nothing; an allowance for a different rule clears nothing; an allowance in any commit of the range counts.
   Then implement it by reading `git log --format=%B` over the range.
   Check: `node tests/quality-hooks.mjs` passes.

5. The `--check` mode. Satisfies R13, AC5.
   Cases first: `--check` exits 0 on a clean branch, 1 with findings and 2 when it could not run; `--base <ref>` changes the range; `--worktree` adds an uncommitted change and an untracked file that the default range misses.
   Then implement it on the same rule code as the hook, so both read one set of rules.
   Check: `node tests/quality-hooks.mjs` passes and `python3 plugins/pro-quality/scripts/floor-guard.py --check` exits 0 on a clean throwaway repo.

6. Timing. Satisfies N1.
   Add one case that pushes a 1000-line diff and asserts the hook finishes in under 2 seconds on a warm run, with a looser bound for CI.
   If it is slower, fix the diff pass (one `git diff` call, no per-line subprocess) before moving on.
   Check: the case passes.

Track B: the pro-quality content (one subagent, steps in order, or three if the orchestrator prefers).

7. `plugins/pro-quality/templates/CONSTRAINTS.md`. Satisfies R14.
   The header says to read it before writing code and not to weaken it to make a change pass.
   Sections in order: Floor (with secrets listed, pro-security's push gate and `gitleaks` as the checker, per flagged concern 5), Enforced with numbers (Dimension, Rule, Checked by, Runs at), Measured, not yet enforced (Metric, Today, Direction), Exceptions (ID, Rule, Path, Reason, Owner, Expires) and the optional `Test files:` line.
   Check: a grep for each section name and each column header in the file.

8. `plugins/pro-quality/skills/constraints/SKILL.md`. Satisfies R15, AC8 (footer).
   Standard frontmatter with only `name` and `description`, tool-neutral prose, no Claude-only tool names and no sidecar it does not ship.
   The description is written to route (see step 10).
   It ends with the upstream footer for addyosmani/agent-skills (MIT, Copyright (c) 2025 Addy Osmani) in the form other adapted skills use.
   Check: `node tests/check.mjs` frontmatter and codex-parity checks pass for it.

9. `plugins/pro-quality/commands/constraints.md`. Satisfies R16, R17.
   Frontmatter with a description and `allowed-tools` limited to read tools, the git commands it needs, `Write` and `Edit`, plus `Bash` for running the repo's own chosen checks.
   Body: detect the stack (package scripts, `pyproject.toml`, `Makefile`, `.github/workflows/`, the verify command in `CLAUDE.md` or `AGENTS.md`); say what was found; ask at most four questions one at a time with a default each; run every check it will write down once and record today's value for each ratchet; write a numbered row only for a check that exited 0; send everything else to Measured or leave it out; show the file and the `CLAUDE.md` line before saving; add "Read CONSTRAINTS.md before writing code. Do not weaken it to make a change pass." to `CLAUDE.md` and `AGENTS.md` when they exist, once when `AGENTS.md` is a symlink to `CLAUDE.md` (detect symlinks); never commit.
   The command uses no home-directory path.
   Check: `node tests/check.mjs` command frontmatter checks pass.

10. A routing case. Satisfies AC1.
    Append one line to `tests/cases/routing.jsonl` whose prompt asks for a repo's quality bar and floor rules and expects `constraints`, with a `notOneOf` for the nearest existing skill if the lexical gate shows confusion.
    Check: `node tests/eval.mjs --dry` and `node tests/route-lexical.mjs --min-rank1 70` pass.

Track C: pro-ai-sdlc (one subagent).

11. Reviewer reads the file. Satisfies R18.
    Edit `plugins/pro-ai-sdlc/agents/reviewer.md` and `plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml` with the same sentences: in "Load the policy" read `CONSTRAINTS.md` when present beside `REVIEW.md` and in the compliance pass a diff that loosens it without a `floor-allow:` reason is Important.
    Edit `plugins/pro-ai-sdlc/commands/review.md`: add `CONSTRAINTS.md` to the "Review policy present" listing, read it in step 2 and pass it as a policy path to the subagent in step 3.
    The four-field handoff does not change.
    Check: `node tests/check.mjs agents` passes and the `.md` and `.toml` bodies match line for line.

Track D: licenses and docs (one subagent).

12. Attribution and README. Satisfies AC8.
    Add the Addy Osmani copyright line to `plugins/pro-quality/LICENSE` and a sentence in its notice naming what was adapted.
    Add the `constraints` row to `docs/licenses.md` marked adapted and fix the sentence listing plugins with original and forked content if it needs it.
    Update the pro-quality bullet and the skills table rows in `README.md`.
    Check: `node tests/check.mjs` licenses check passes and a grep shows the copyright line and the row.

Join steps (serial, after the four tracks).

13. Template and guard agree. Satisfies R14, R4, AC3.
    Add a case to `tests/quality-hooks.mjs` that copies `plugins/pro-quality/templates/CONSTRAINTS.md` into a throwaway repo, commits it, then loosens a number, adds an Exceptions row and removes a Floor bullet and expects all three findings.
    This is the one place the parser and the template are tested together.
    Fix whichever side is wrong; the template wins only where the spec's R14 says so.

14. Register the hook. Satisfies R1, AC2.
    `git add plugins/pro-quality/scripts/floor-guard.py` first, since the hook-loading law fails in CI on an untracked script.
    Add the entry to `plugins/pro-quality/hooks/hooks.json` under the existing `Bash` matcher.
    Check: `grep -c floor-guard.py plugins/pro-quality/hooks/hooks.json` prints 1, `git ls-files plugins/pro-quality/scripts/floor-guard.py` lists the file and `node tests/check.mjs hooks` passes.

15. Version bumps, last, read from main. Satisfies the version-bump law (ADR-0002).
    Run `git fetch origin` and read the current values from `origin/main`: the spec's 0.13.0, 0.7.0 and 1.60.0 were true on 2026-10-29 and may not be at build time.
    Take the next minor over whatever main holds for pro-quality, pro-ai-sdlc and `metadata.version`, in both manifests of each plugin and in the marketplace entries, in the same commit as the content.
    Check: `node tests/check.mjs` version checks pass and `git diff origin/main -- .claude-plugin/marketplace.json` shows exactly two entries and `metadata.version`.

16. Run every check. Satisfies AC1.
    Run the commands under "Proof of done" and fix what fails.

17. Dogfood. Satisfies AC7 and part of AC3.
    Run `python3 plugins/pro-quality/scripts/floor-guard.py --check --base origin/main` on this branch.
    The skill, the template and the other Markdown files name the markers but the marker rules skip `.md` files (R4a), so only the script and the cases in `tests/quality-hooks.mjs` can still show findings on their marker lists.
    If any appear, write the matching `floor-allow: <rule> <reason>` lines into the final commit message instead of weakening the rules; that also proves the allowance works on a real range.
    Then run `/constraints` in this repo, show the written `CONSTRAINTS.md` and the `CLAUDE.md` line in the PR and confirm each numbered row's command exits 0 here.
    Remove the generated `CONSTRAINTS.md` and revert the `CLAUDE.md` line before committing, because the spec says that file is not committed in this change.

18. Review pass. Satisfies REVIEW.md passes 1 to 3.
    Run `/review` on the finished diff with the `reviewer` subagent at high effort, with the policy paths and nothing else.
    Fix every Important finding and record any departure from this plan under "Departures from plan" in the same commit.
    Then open the PR and stop.
    AC9 starts after merge.

## Tests that prove it

- AC1: the five commands in "Proof of done" and the two strict validation commands, run in full.
- AC2: `grep -c floor-guard.py plugins/pro-quality/hooks/hooks.json` prints 1 and `git ls-files plugins/pro-quality/scripts/floor-guard.py` lists the file (step 14).
- AC3: `tests/quality-hooks.mjs` covers each rule in R4 reporting; a `.md` file naming a marker unreported; a pushed branch still judged on `gh pr create`; enforce denying and warn allowing for each; a clean diff, a README-only diff, `git commit` and `git push --dry-run` silent; a `floor-allow:` line clearing its rule; a tightened threshold silent and a loosened one reported; a repo with no merge base allowing with the could-not-run message; a malformed payload exiting 0 (steps 1 to 4 and 13).
- AC4: the same file pairs every denying case with an allowing case, rule by rule (steps 1 to 3).
  A short table at the top of the cases lists each rule next to its two case ids so a reviewer can see none is missing.
- AC5: cases that run `python3 plugins/pro-quality/scripts/floor-guard.py --check` and assert exit 0, 1 and 2 (step 5).
- AC6: a case that builds a `ghp_` token of 36 characters at run time and asserts `[redacted]` appears and the token does not (step 2).
- AC7: the `/constraints` run on this repo, shown in the PR, with a loop that runs each numbered row's command and shows exit 0 (step 17).
- AC8: `grep -n "Addy Osmani" plugins/pro-quality/LICENSE docs/licenses.md`, a look at the end of `plugins/pro-quality/skills/constraints/SKILL.md` for the footer and the licenses check in `node tests/check.mjs` (step 12).
- AC9: after merge, `grep floor-guard` over `warn.log` in the guard directory after a week of use in two of Jody's repos.
  This gates the later switch to enforce mode and not the PR.
- N1: the 1000-line timing case (step 6).
- N2 to N4: a read of the script in step 18 and a case that asserts the repo is byte-identical before and after a run.
- R16 and R17 are prose in a command, so no script proves them; step 17's run and the step 18 review are the evidence.

## Risks

The step most likely to go wrong is step 3, the `CONSTRAINTS.md` direction rules.
Reading "a minimum loosens downward, a maximum upward" out of free Markdown means regexes over text that people write in many ways.
A wrong guess reads as a false alarm (a tightened number flagged) or a miss (a loosened number silent) and a miss defeats the purpose.
The guard falls back to reporting any change to a number whose direction it cannot read, as upstream does, so a miss is only possible when the words around a number point the wrong way.
Pairing numbers within their direction can still mis-pair when a row gains and loses a number in one diff.
The cases in step 3 cover a reorder, a reworded row and a number that gains direction words and step 13 runs the parser on the shipped template.

The next weakest is `assertion-removed`.
Counting removed `expect`, `assert` and `should` lines against added ones in the same file flags a refactor that moves assertions to another file, a test split in two and a rename that touches many lines.
It never fires on a file that still has at least as many assertions as before, which keeps the common refactors quiet.
A moved assertion still reads as a finding, so the message names the count and `floor-allow:` is the way through.
Warn mode and AC9's week of real use are how this gets tuned.

Command parsing for `git push` and `gh pr create` is the third.
Copying `docs-before-push.py`'s segment splitter keeps it consistent with an existing hook, but that splitter was written for `git push` only.
Extending it to `gh pr create` and `--dry-run` must not make `echo gh pr create`, `git commit -m "gh pr create"` or a heredoc body fire.
Step 1's silent cases are written for exactly those strings.
A target that cannot be resolved (a variable, `pushd`) allows, as the existing hook does and says the floor was not checked.

What this might break:

- Every consumer's `git push` and `gh pr create` gain a hook.
  In warn mode the cost is a message and a log line.
  In enforce mode it denies every retry until the findings are fixed or allowed (flagged concern 3), so the switch to enforce is a separate decision after AC9.
- The new hook runs beside `docs-before-push.py` on the same matcher.
  That hook blocks with no warn mode and the guard follows the mode file, so one plugin behaves two ways until a later change (flagged concern 2).
- The mode lookup is copied from pro-ai-sdlc into pro-quality (flagged concern 1).
  If one copy changes, the other will not follow.
  A comment above the copy names its source and the case that pins the behavior.
- The version collision with the review-policy intent.
  That intent also edits pro-ai-sdlc, probably `agents/reviewer.md`, `commands/review.md` and the same two manifests and it will bump the same version and `metadata.version`.
  Whichever merges second rebases and takes the next number over main.
  Step 15 reads main at build time for that reason and the reviewer edits are small additive sentences so a conflict is quick to resolve.
- The guard can flag its own diff.
  The script and the tests contain the marker strings; the skill and the template do not count because the marker rules skip `.md` files.
  Step 17 handles what remains with `floor-allow:` lines in the commit message.
- A guard that writes a line to `warn.log` on every unreadable payload could grow the log; it writes one line per run and only on a failure.

What was left out on purpose:

- Offering `/constraints` from `/pro-dev install`, because it would move pro-core (open question 5).
- The verifier reading `CONSTRAINTS.md`, because it needs its own budget design (flagged concern 4).
- Bringing `docs-before-push.py` under the mode file, because it is a behavior change to a shipped hook (flagged concern 2).
- Running the guard in CI, `pr-check` and the PR gate; they will call `--check` when they exist.
- Scanning for secrets, which stays with pro-security's push gate (flagged concern 5).
- Refreshing the expected counts in `CLAUDE.md`, as noted under files.
- A `.constraintsignore` as upstream has; the spec does not ask for one and `floor-allow:` already records an exception.

Which steps can run in parallel: steps 1 to 6 (Track A), steps 7 to 10 (Track B), step 11 (Track C) and step 12 (Track D) touch separate files and run as four concurrent subagents.
Steps 1 to 6 stay in order inside their track because each extends the same script and test file.
Steps 7 to 9 could be split further, but they share the template's column names, so one subagent is simpler.
Steps 13 to 18 are serial because each reads the combined result.

Nothing in this change is irreversible.
There is no migration.
Reverting the commit removes the hook on the consumers' next update, though the plugin cache keeps the old version until then.

Suits auto mode: yes for steps 1 to 15 once Jody approves this plan, because every step has a command that passes or fails.
Steps 16 to 18 and the PR need Jody, since this ships a hook to every consumer repo.

## Options not taken

- One long track with one agent: it would work but the four tracks have no shared files, so parallel subagents cut the wall time for no extra risk.
- Writing the script first and the cases after: the spec asks for a behavior case that denies and one that allows for every blocking path and writing them first is the only way to be sure each case can fail.
- Registering the hook first and writing the script after: a registered hook with no script fails the hook-loading law; step 14 comes after the script exists and is tracked.
- Splitting the guard into one script per rule: one script keeps one parse of the diff, which keeps N1 within reach and gives `--check` the same code as the hook.
- Importing the mode helper from pro-ai-sdlc: plugins install separately and cannot import each other (ADR-0003), so it is copied (flagged concern 1).
- Putting the version bumps in their own commit: ADR-0002 wants them in the same commit as the content.
- Shipping a `CONSTRAINTS.md` for this repo in the same change: the spec rules it out and each repo runs `/constraints` itself later.

## Proof of done

Run from the repo root on the final branch.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/quality-hooks.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
grep -c floor-guard.py plugins/pro-quality/hooks/hooks.json
git ls-files plugins/pro-quality/scripts/floor-guard.py
```

What counts as finished:

- `node tests/check.mjs` prints 0 failures and `node tests/eval.mjs --dry` reports every case pointing at a real skill, with the new skill in the catalog.
- The routing gate and the unit tests pass.
- `node tests/quality-hooks.mjs` prints `<n>/<n> quality hook cases passed` with no `FAIL` line.
- `claude plugin validate . --strict` prints `Validation passed` once and the loop prints it once per plugin directory.
- The `grep -c` prints 1 and `git ls-files` lists the script.
- These exit codes hold, checked in the throwaway repo cases and by hand once:
  - `python3 plugins/pro-quality/scripts/floor-guard.py --check` exits 0 on a clean branch.
  - It exits 1 on a branch with a `// eslint-disable-next-line` added.
  - It exits 2 outside a git repo.
- `git status` shows no `CONSTRAINTS.md` and no `CLAUDE.md` change from the step 17 run.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: <sha>
- Checks run: <each command with its real result>
- AC1: <pass or fail, with what was observed>
- AC2: <pass or fail, with what was observed>
- AC3: <pass or fail, with what was observed>
- AC4: <pass or fail, with what was observed>
- AC5: <pass or fail, with what was observed>
- AC6: <pass or fail, with what was observed>
- AC7: <pass or fail, with what was observed>
- AC8: <pass or fail, with what was observed>
- AC9: <pending until a week of use after merge>
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0010, Status `proposed` from this change, to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.
