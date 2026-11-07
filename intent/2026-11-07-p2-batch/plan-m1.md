# Plan m1: the small batch

Built from `spec-m1.md` (commit 1b96079) and `intent.md` in this folder.
Status: approved.
Approver: the engineer; no lead needed, the blast radius is two scripts, one skill and one workflow, each with behavior cases.
Dated: 2026-11-07.

Three pull requests, each buildable in its own worktree in parallel: A (pro-ai-sdlc, steps 1 to 6), B (pro-quality, step 7) and C (this repo, steps 8 and 9).
A and B both bump `metadata.version` in `.claude-plugin/marketplace.json`, so the second to merge rebases first.

## Files that change

- `plugins/pro-ai-sdlc/scripts/factory.py` (modified): `compute()` scans only the three requirement-bearing sections for stop-list words and names the section; `cmd_record` refuses a `merged` sha that is not on the default tip.
- `plugins/pro-ai-sdlc/scripts/plan-sync.py` (modified): reads `Done as of <sha>` and reports a stale `## Done`.
- `plugins/pro-ai-sdlc/commands/execute.md` (modified): the Done step writes `Done as of <sha>` first.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`, `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` (modified): 0.15.2 to 0.16.0.
- `tests/factory.mjs` (modified): cases for the section scan and the ancestor check.
- `tests/sdlc-hooks.mjs` (modified): cases for the stale Done in warn and enforce.
- `plugins/pro-quality/skills/constraints/SKILL.md` (modified): the proof step and the `### Not enforced` heading.
- `plugins/pro-quality/.claude-plugin/plugin.json`, `plugins/pro-quality/.codex-plugin/plugin.json` (modified): 0.19.0 to 0.20.0.
- `.claude-plugin/marketplace.json` (modified): the two plugin versions and `metadata.version`, once per PR.
- `.github/workflows/validate.yml` (modified): the `hooks-macos` job.
- `docs/enforce-mode.md` (modified): a row for the stale-Done check under `plan-sync`.
- `docs/factory.md` (modified): the section rule for the level and the ancestor rule for `record`.
- `docs/roadmap.md` (modified): items 46 to 49 ticked with their PR, in the PR that lands each.

## Order of work

1. Failing cases for the level scan in `tests/factory.mjs`: an intent with `auth` only under `## Out of scope` expects level 1; the same word under `## Proposed outcome` expects 3 with a reason naming the section; a recorded level 3 stays 3 (size S; R1, R2, R3, R4, AC1, AC2)
2. `compute()` slices the body by `## ` headings, strips HTML comments, fenced blocks and backticked spans, calls `stop_words_in` on the Proposed outcome, Affected users and systems and Constraints sections only and writes `stop-list words in <section>: a, b` (size S; R1, R2, R3)
   Checkpoint: `node tests/factory.mjs` passes the new cases; `python3 plugins/pro-ai-sdlc/scripts/factory.py level intent/2026-11-04-rollback-path` lists no stop-list reason.
3. Failing cases for `record --state merged` in `tests/factory.mjs`: a sha from an unmerged fixture branch exits 2 with no record file; a sha on the default branch writes the record (size S; R5, R6, AC3)
4. `cmd_record` resolves the default tip with `default_tip()` and runs `git merge-base --is-ancestor <sha> <tip>` when the state is `merged`; a false result raises `Refuse` naming the sha, the tip and the branch (size XS; R5, R6)
   Checkpoint: `node tests/factory.mjs` green end to end.
5. `execute.md` writes `Done as of <12-char head sha>` as the first line of `## Done`; `plan-sync.py` gains `stale_done(top, plans)`: for each changed plan with that line, compare with `git rev-parse --short=12 HEAD` and, when they differ and files outside `IGNORED_PREFIXES` changed since that sha, report `## Done is stale (written at <sha>, head is <sha>)` through the existing warn and enforce paths; a plan without the line behaves as today (size M; R7, R8, R9, AC4, AC5)
6. Cases in `tests/sdlc-hooks.mjs`: stale Done in warn logs and passes; in enforce blocks once and passes with `stop_hook_active`; a plan without the line is unchanged; then the pro-ai-sdlc bump to 0.16.0 in both manifests and the marketplace, the `docs/factory.md` lines, the `docs/enforce-mode.md` row and the roadmap ticks for 46 and 47 (size S; R8, R9, N2, AC5)
   Checkpoint: `node tests/check.mjs` and `claude plugin validate plugins/pro-ai-sdlc --strict` pass; PR A opens.
7. `constraints/SKILL.md`: before writing an "Enforced with numbers" row, run the check against a fixture that breaks the rule and a clean control; write the row only on non-zero then zero; list the others under `### Not enforced` with the command and both exit codes; bump pro-quality to 0.20.0 in both manifests and the marketplace; tick item 49 (size S; R10, R11, N2, AC6)
   Checkpoint: `claude plugin validate plugins/pro-quality --strict` and `node tests/check.mjs` pass; `/constraints` on `demo/app` by hand writes rows only for checks that fail the fixture; PR B opens.
8. `validate.yml` gains a `hooks-macos` job on `macos-latest`, `timeout-minutes: 10`, steps checkout, setup-node 20, `python3 --version`, `node tests/check.mjs`; no Claude CLI install (size XS; R12, R13, N1, AC7)
9. The job shows as a check on PR C and passes; tick item 48 (size XS; R13, AC7)
   Checkpoint: `gh pr checks` lists `hooks-macos` as passed; PR C opens.

No step is irreversible.

## Tests that prove it

- `tests/factory.mjs` covers the section scan (both placements of a stop word, a recorded level staying 3) and the ancestor check (off-base sha refused, on-base sha recorded).
- `tests/sdlc-hooks.mjs` covers the stale Done in warn, in enforce, on the second stop and the no-line case.
- `node tests/check.mjs` on macOS proves the CI job.
- A hand run of `/constraints` on `demo/app` proves R10 and R11; the skill is prose, so there is no unit test.

## Risks

Step 5 is the one most likely to go wrong: `plan-sync.py` runs at every Stop in every repo with the plugin, so a wrong comparison would nag on every session.
The guard is the no-line case (R9), the warn start and the existing `stop_hook_active` path; damage stops at one warn line per Stop.
Step 2 narrows what raises the level; an intent could hide a risky word under `## Problem`.
`risk:` and the author check still apply and the level can be raised by hand, as spec concern 2 records.
Step 4 makes `record --state merged` call `git` for the tip; a repo with no remote falls back to `HEAD` as `default_tip` does today.
Nothing here is irreversible.

Stop-list categories: none; the plan edits no auth, migration, payment, deploy or secret handling, it changes how `deploy` and friends are read in an intent.

## Options not taken

- One PR for all four items: three plugins and the workflow would need one bump each and a single revert would undo unrelated fixes.
- A diff-based stop-word scan: an intent is prose, every line is added in its first commit.
- A new Stop hook for the stale Done: `plan-sync` owns the plan at Stop and a second hook is a hook-loading-law risk.
- Running the full CI on macOS: the Claude CLI install is slow and not what breaks there.

## Proof of done

```
node tests/check.mjs                       # 48 or more checks, 0 failures
node tests/eval.mjs --dry
node tests/factory.mjs                     # all cases pass, including the new ones
node tests/sdlc-hooks.mjs                  # all cases pass, including the stale Done cases
claude plugin validate . --strict          # Validation passed
claude plugin validate plugins/pro-ai-sdlc --strict
claude plugin validate plugins/pro-quality --strict
python3 plugins/pro-ai-sdlc/scripts/factory.py level intent/2026-11-04-rollback-path   # level 3, no stop-list reason
gh pr checks <PR C>                        # hooks-macos pass
```

## Done

Done as of eac31ffbb1d6

PR A only (steps 1 to 6); PR B and PR C fill their own lines.

- Build commit: eac31ffbb1d6 on `build/p2-m1-a` (5ded122 steps 1 to 4, e00cd86 steps 5 and 6, eac31ffbb1d6 prose fixes)
- Checks run:
  - `node tests/factory.mjs`: 157/157 factory cases passed (the first run before the change: 149/157, l5 to l7 and m1 to m4 failing).
  - `node tests/sdlc-hooks.mjs`: 47/47 sdlc hook cases passed (before the change: 44/47, sd4 to sd6 failing).
  - `node tests/check.mjs`: 48 checks, 0 failures, 13 warnings (run on e00cd86; eac31ffbb1d6 changes prose and one test name only).
  - `node tests/eval.mjs --dry`: 99 cases reference real skills, 107 skills in catalog + 7 distractors; live routing skipped with no key.
  - `node --test tests/unit/*.test.mjs`: pass 198, fail 0.
  - `node tests/route-lexical.mjs --min-rank1 70`: passed, 0 collision failures, 3 notOneOf warnings as before.
  - `claude plugin validate . --strict` and `claude plugin validate plugins/pro-ai-sdlc --strict`: Validation passed.
  - `python3 plugins/pro-ai-sdlc/scripts/factory.py level intent/2026-11-04-rollback-path`: `level: 3 (risk: high; stop-list words in Proposed outcome: deploy, release; stop-list words in Affected users and systems: deploy, release; no readable Roles block in REVIEW.md on origin/main (REVIEW.md has no ## Roles block))`.
  - `/usr/bin/python3 -m py_compile` on `factory.py` and `plan-sync.py` under Python 3.9.6: ok.
- Definition of done: met for PR A, except AC1 below.
- Visual: none
- Doubt: none
- AC1: fail as written. The level is 3 from `risk: high`, but the reasons still name stop-list words, because the intent uses release and deploy as the subject of its Proposed outcome and Affected users and systems; see Departures.
- AC2: pass. Case l4 (auth under Problem, Out of scope and Risk) reads level 1; l5 (auth under Proposed outcome) reads 3 with `stop-list words in Proposed outcome: auth`; l6 names Constraints; l7 ignores code spans, fences and comments; l8 keeps a recorded level 3.
- AC3: pass. Case m1 exits 2 with no record for a sha on an unmerged branch; m2 names the sha, `origin/main` and `main`; m3 and m4 refuse no sha and an unknown sha; m5 writes the record for the main sha.
- AC4: not run live. `commands/execute.md` now writes `Done as of <git rev-parse --short=12 HEAD>` first; cases sd2 and sd3 show a Done at the head, then the plan committed alone, passes.
- AC5: pass in the sandbox. sd4 and sd5: warn mode after a later code commit prints and logs `## Done is stale (written at <sha>, head is <sha>)` to `warn.log` without blocking; sd6 blocks once in enforce; sd7 passes with `stop_hook_active`; sd1 and sd9 show a plan with no line or an unknown sha unchanged.
- AC6: pass, by hand on `demo/app` (after `npm ci`) following this branch's `constraints/SKILL.md` and `commands/constraints.md` rather than the installed plugin. Proved and written as rows: `npx tsc --noEmit` (type error in `components/data.ts`: violation exit 2, clean exit 0), `npm test` (failing assertion in `app/__tests__/data.test.ts`: violation exit 1, clean exit 0) and `npm run build` (bad export in `app/page.tsx`: violation exit 1, clean exit 0). Not enforced: a type error in a test file passed both `npx tsc --noEmit` (tsconfig excludes `**/__tests__/**`) and `npm test` (Vitest does not type-check), violation exit 0 and clean exit 0 for each. Measured: 9 passing tests and 102 kB First Load JS for `/`; no coverage provider is installed, so coverage was left out. `floor-guard.py` parses exactly the three rows. `demo/app/CONSTRAINTS.md` was written and not committed.
- AC7: other PR.
- AC8: `node tests/check.mjs` and `claude plugin validate . --strict` pass after PR A; PRs B and C report their own.
- Sign-off:

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 4: a refused `record --state merged` returns 2 from `cmd_record` instead of raising `Refuse`, because `main()` maps a `record` refusal to exit 1 and R5 and AC3 ask for 2.
- Step 4: `record --state merged` with no `--sha` is refused the same way, since R6 allows a merged record only for a sha on the base.
- Step 4: `record` does not fetch; it reads the tip `default_tip()` resolves from local refs, as the plan says. The refusal tells the person to run `git fetch` when the merge is newer than the last fetch.
  R5 says the tip is fetched and the spec's policy line says `record` already fetches; it does not.
- Steps 1 and 2: `tests/unit/factory-level.test.mjs` and the existing `l3` case in `tests/factory.mjs` put their stop-list words under `## Proposed outcome`, because under `## Problem` they no longer raise the level (R2); the unit file gains a case for a word under Problem staying at level 1.
- Steps 1 and 2: AC1 cannot pass as written. `intent/2026-11-04-rollback-path` uses release and deploy as the subject of its `## Proposed outcome` and `## Affected users and systems`, so under R1 its reasons still list `stop-list words in Proposed outcome: deploy, release` and the same for Affected users and systems; the level is 3 either way. The build follows R1 to R3 and leaves AC1 for the spec owner to restate.
- Step 5: `stale_done()` reads the plans the working tree changed and the plans the branch's own commits changed since it left the default branch (`origin/HEAD`, `origin/main`, `origin/master`, `main` or `master`, local refs only).
  R8 names only the working tree, but AC5's later commit leaves a clean tree, so a working-tree-only read would never see the plan; on the default branch itself only the working tree counts, so merged plans never nag.
- Step 5: a `Done as of` sha the repo does not have, as after a rebase, passes. The line is read from the first non-blank line under `## Done`.
- Step 5: when the plan.md reminder and a stale Done fire together, one Stop reports both in one message and one block.
- Step 6: `plugins/pro-ai-sdlc/README.md` and `docs/factory-demo.md` change too: the hook line names the stale Done and the demo's expected level line names the section.

## Noticed but not touched

