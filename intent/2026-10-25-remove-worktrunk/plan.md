# Plan: remove worktrunk from the stack (verify and close)

Built from `spec.md` (commit c3f13f4) and `intent.md` in this folder.
Status: draft.
Approver: the engineer.
Dated: 2026-11-07.

The spec records that the removal the intent asked for is already in the tree: the 2026-11-07 survey found no `worktrunk` literal and no standalone `wt` token under `plugins/`, `templates/`, `README.md` or `.claude-plugin/`, the router sends parallel work only to `using-git-worktrees`, the companions script installs only the three `claude-plugins-official` companions, the allowlist holds only `claude-plugins-official`, and the live versions (pro-execution 0.7.2, pro-core 0.25.0) are past the intent's stale 0.4.0 / 0.15.3 targets.
This plan therefore verifies the end state against the live tree and closes the intent as already satisfied.
No source file changes and no version bump: if a step finds a stray reference the survey missed, the plan stops and the build removes that one reference and applies the version-bump law to the plugin it sits in, recording the departure.

## Files that change

- None under `plugins/`, `templates/`, `README.md` or `.claude-plugin/`: the survey found nothing left to delete, so there is no content change and the version-bump law does not fire.
- `intent/2026-10-25-remove-worktrunk/plan.md` (new): this plan.
- `intent/2026-10-25-remove-worktrunk/intent.md` and `spec.md` (modified at sign-off only): `status` moves to `accepted` once `## Done` is filled; no earlier edit.

## Order of work

1. Confirm the removal survey against the live tree (size XS; R1, R2, R3, R4, R5, AC1, AC2, AC3, AC4).
   Run the AC1 grep over the four scoped paths and read the four surfaces the spec names: the `using-pro-dev` router, `templates/install-companions.sh`, the `allowCrossMarketplaceDependenciesOn` field in `.claude-plugin/marketplace.json` and the `using-git-worktrees` skill file.
   Confirm the grep returns no match, the router names only `using-git-worktrees` for parallel work, the script installs `vercel`, `figma` and `playwright` only, the allowlist holds only `claude-plugins-official` and the `using-git-worktrees` skill is present and unchanged.
   If any surface still carries a `worktrunk` or `wt` reference, stop and switch to the fallback in the summary above rather than proceeding to step 3.
   Checkpoint: the grep prints no match and each of the four surfaces matches the spec's System section; record the grep output verbatim.

2. Run the repo's static and validation gates (size S; N1, N2, AC5).
   Run `node tests/check.mjs && node tests/eval.mjs --dry`, then `node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs`, then `claude plugin validate . --strict`, then the per-plugin validation loop from CLAUDE.md.
   Confirm each exits zero and the check output matches the expected line in CLAUDE.md (37 checks, 0 failures, the known warnings).
   Checkpoint: every command above exits zero; paste the check summary line and the final `Validation passed`.

3. Close the intent as already satisfied (size XS).
   Fill `## Done` in this plan: no build commit for source (the verification is the deliverable), the checks run with their real output, each AC pass with what was observed, and the definition-of-done line.
   Move `status` to `accepted` in `intent.md` and `spec.md` at sign-off, in the same commit as the `## Done` fill.
   Checkpoint: `intent.md` and `spec.md` both read `status: accepted`; `git status` shows only the three intent-folder files staged.

## Tests that prove it

- The AC1 grep over `plugins templates README.md .claude-plugin` returns no match (step 1).
- `node tests/check.mjs && node tests/eval.mjs --dry` and the route-lexical and unit gates pass (step 2).
- `claude plugin validate . --strict` and the per-plugin loop pass (step 2).
- No behavioral or live eval is needed: no skill description or body changes, so there is nothing new to route.

## Risks

The step most likely to go wrong is step 1, the survey grep.
The shell sandbox in this environment blocks a pattern containing a backslash (`\bwt\b`) or a glob metacharacter, so a naive run of the AC1 command is refused rather than returning a clean no-match.
The build runs the grep through a path that accepts the pattern (a read-only search subagent, or `rg` with the pattern read from a quoted argument that the harness allows) and treats a refusal as "not yet verified", never as "no match".
A missed reference would break the intent's premise, not production: the worst case is the plan finds a stray `worktrunk` string and the build has to delete it and bump one plugin, which the fallback in the summary covers.
Nothing here deletes a file other code depends on, changes a public API, an auth rule, a data migration or a deploy config.

Stop-list categories: none. No step touches a data migration, a public API, an auth rule, a deploy or infrastructure config, or a delete that other code depends on.

## Options not taken

- Delete-then-bump to the intent's version targets (pro-execution 0.4.0, pro-core 0.15.3): rejected, those targets are behind the live tree (0.7.2 and 0.25.0) and there is nothing left to delete.
- Rewrite the intent into a fresh survey-and-close task: rejected, the intent stands and the spec already records the overtaken premise.
- Hold the intent open pending a deliberate verification PR: rejected, the survey plus the check and validate gates are the verification; a separate PR adds process with no content.

## Proof of done

```
rg -n -i 'worktrunk|\bwt\b' plugins templates README.md .claude-plugin   # no match
node tests/check.mjs && node tests/eval.mjs --dry                        # 37 checks, 0 failures
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict                                        # Validation passed
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )  # passes per plugin
```

Finished means the grep returns no match, every gate exits zero and the check summary matches the CLAUDE.md expected output.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: <sha>
- Checks run: <each command with its real result>
- Definition of done: <met, or the items not met> (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more)
- Visual: none (this plan has no Mock: line)
- Doubt: none (no step is on the stop-list)
- AC1: <pass or fail, with what was observed>
- AC2: <pass or fail, with what was observed>
- AC3: <pass or fail, with what was observed>
- AC4: <pass or fail, with what was observed>
- AC5: <pass or fail, with what was observed>
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

## Noticed but not touched

Problems seen outside a step during the build, one per line: the file, what was seen and why it was left.
/execute copies them into the PR body.
