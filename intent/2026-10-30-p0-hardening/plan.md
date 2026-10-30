# Plan: P0 hardening before any gate moves to enforce mode

Built from `spec.md` (commit on branch `feat/p0-hardening`, written 2026-10-30) and `intent.md` in this folder.
Status: approved.
Approver: Jody Brewster, approved 2026-10-30 as part of the batch.
It changes a hook that every repo with pro-ship runs on `gh pr merge` and gives it network calls, which is why an approver is named.
No second approver is needed: Jody owns this marketplace and decided the open questions on 2026-10-30.
The blast radius is bounded: every gate stays in warn mode, a failed network call reads as high and never as low and the classifier itself stays network-free.
Dated: 2026-10-30.

Decided on 2026-10-30 by Jody, recorded in the spec:

- The merge gate may call `gh pr view` and `git fetch origin pull/<n>/head` under short timeouts; any failure is could-not-run, high (spec R3 to R7).
- The orchestrator edits Jody's user-level `/merge-pr` outside this repo; this plan only documents the call (spec R23).
- Every other open question takes the intent's recommendation.
- The plan proposes thresholds from the calibration table; Jody judges the table at PR review (spec R13 to R15).
- Step 15 of risk-tiers is verified headless where possible, else the deny fallback stays (spec R22).
- The warn-mode week happens after this build; its record stays pending (spec AC11).
- ADR-0016 is the warn-to-enforce rule, status proposed.

## Proposed thresholds

The planner re-ran the classifier over the 30 merged PRs #60 to #89 on 2026-10-30 and got the same 11 low, 9 medium and 10 high as the risk-tiers Done block.
(The intent says #59 to #89, which is 31 PRs; the 11/9/10 split matches #60 to #89.)
It then moved one constant at a time with the others at their defaults and recorded which PRs changed tier:

| Constant | Value | Values tried with no tier change | First value that moves a PR |
|---|---|---|---|
| `FILES_MEDIUM` | 10 | 6 to 25 | none in that range |
| `FILES_HIGH` | 30 | 24 to 40 | none in that range |
| `LINES_MEDIUM` | 300 | 191 to 950 | 150 moves #63 low to medium |
| `LINES_HIGH` | 1000 | 968 to 2747 | none in that range |
| `AREAS_MEDIUM` | 3 | 3 only | 2 moves #63 up; 4 moves #67 and #73 down |
| `NO_TEST_LINES` | 50 | 10 to 62 | 63 moves #77 medium to low |

The proposal is to keep all six values, since each sits inside its measured tier-neutral range and to replace the placeholder comment with these ranges.
`AREAS_MEDIUM` is the only constant the table pins exactly.
Rows for Jody to judge at review: #78 (39 files, 2747 lines, declared low) is high on size alone and drops to medium only if both `FILES_HIGH` and `LINES_HIGH` rise past it; #67 and #73 are medium on areas alone (small fixes across two plugins plus the marketplace file).
Step 6 reproduces this with a committed script so the numbers above are checked again at build time.

## Files that change

In pro-ship:

- `plugins/pro-ship/scripts/merge-gate.py` (modified): PR resolution through `gh pr view`, the fetch, the base from `baseRefName`, the pin against the PR head, `-R`, URL and `GH_REPO` parsing, `gh api` REST and GraphQL merges, the `--auto` note, the docstring and `NO_PROMPT_MODES` from the probe (spec R1 to R12, R22).
- `plugins/pro-ship/scripts/risk-classify.py` (modified): the comment above the six threshold constants, with values unchanged unless step 6 finds otherwise (R13).
- `plugins/pro-ship/skills/risk-tiers/SKILL.md` (modified): "Merging a PR" documents the `/merge-pr` call and that the gate resolves the PR itself (R23).
- `plugins/pro-ship/.claude-plugin/plugin.json` and `plugins/pro-ship/.codex-plugin/plugin.json` (modified): the next minor over main, 0.4.0 to 0.5.0 on 2026-10-30 and a description sentence saying the merge gate classifies the PR it is given.

In pro-core:

- `plugins/pro-core/skills/using-pro-dev/SKILL.md` (modified): `pr-check` and `risk-tiers` in the SHIP branch and the stale "today holds only `vercel-deploy-bridge`" sentence fixed (R16).
- `plugins/pro-core/.claude-plugin/plugin.json` and `plugins/pro-core/.codex-plugin/plugin.json` (modified): the next minor over main, 0.20.0 to 0.21.0 on 2026-10-30.

At the root:

- `.claude-plugin/marketplace.json` (modified): the pro-ship and pro-core entries and `metadata.version`, 1.64.0 to 1.65.0 on 2026-10-30.
- `tests/ship-hooks.mjs` (modified): the stub `gh`, the bare `origin` helper and cases mg200 to mg279 (AC1 to AC7, AC12).
- `tests/unit/risk-classifier.test.mjs` (modified): one case that pins the default thresholds and the comment (R13).
- `intent/2026-10-30-p0-hardening/calibrate.py` (new): reproduces the table and the sweep (R14).
- `intent/2026-10-30-p0-hardening/calibration.md` (new): the 30-row table and the ranges (R14, R15).
- `intent/2026-10-30-p0-hardening/enforce-decision.md` (new): the pending decision record (R20, AC11).
- `docs/enforce-mode.md` (new): the one list, the evidence criteria, the summary commands and the record template (R19).
- `docs/README.md` (modified): an index line for `enforce-mode.md` and one for ADR-0016.
- `docs/decisions/0016-gate-enforce-rule.md` and its row in `docs/decisions/README.md` (new and modified, written with the spec).
- `docs/decisions/0015-risk-tiers.md` (modified): the dated amendment line (R24).
- `docs/roadmap.md` (modified): the follow-ups line becomes a pointer (R21).

Not changed on purpose:

- The user-level `/merge-pr` command: outside the repo; the orchestrator edits it.
- `plugins/pro-ship/hooks/hooks.json`: no hook is added; the 30 second timeout already covers the new calls inside the 20 second deadline.
- `plugins/pro-ai-sdlc/scripts/production-gate.py`: it already flags `gh api` merges; merging the two gates is out of scope.
- `plugins/pro-security/scripts/push-gate.py` and `plugins/pro-quality/scripts/floor-guard.py`: they are judged by the record, not changed.
- `tests/check.mjs`: the router warning goes away by itself once the router names the skills.
- `docs/releases.md`: the P0 PRs left it behind too; refreshing it is its own docs change.

## Order of work

Take the build off a fresh `origin/main`, because Jody merges in parallel.
Steps 2 to 5 (Track A) own `merge-gate.py` and `tests/ship-hooks.mjs`.
Steps 6 and 7 (Track B) own `risk-classify.py`, `tests/unit/risk-classifier.test.mjs` and the two calibration files.
Step 8 (Track C) owns the router.
Steps 9 and 10 (Track D) own the docs, the decision record, ADR-0015 and the risk-tiers skill.
After step 1 the four tracks touch disjoint files and can run as four Sonnet subagents in one turn.
Step 11 extends Track A's files and runs after it; steps 12 and 13 are serial.

Verify commands, named once here and used by every checkpoint:

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/ship-hooks.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

1. Preflight and versions (XS). Satisfies the version-bump law and Codex parity up front so every later `node tests/check.mjs` run is green.
   `git fetch origin` and rebase `feat/p0-hardening` onto `origin/main`.
   Read pro-ship, pro-core and `metadata.version` from `origin/main`; on 2026-10-30 they are 0.4.0, 0.20.0 and 1.64.0.
   Take the next minor of each: pro-ship in `plugins/pro-ship/.claude-plugin/plugin.json`, `plugins/pro-ship/.codex-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry; pro-core in its two manifests and its entry; `metadata.version` in `.claude-plugin/marketplace.json`.
   Add one sentence to pro-ship's description in both manifests and the marketplace entry: "The merge gate classifies the PR it is given, read through gh pr view."
   Run `node tests/ship-hooks.mjs` and `node --test tests/unit/risk-classifier.test.mjs` before any other change and note the case counts.
   Check: `node tests/check.mjs` prints 0 failures and its version and codex-manifests checks pass.
   The PR is squash-merged so the bump and the content land as one commit on main.

Track A: the merge gate (test first in every step).

2. Stub `gh` and PR resolution (S). Satisfies R1, R2, R3, R5, R6, AC1, AC2, AC5.
   In `tests/ship-hooks.mjs`, inside the merge gate block, write a stub `gh` as a `#!/bin/sh` file in a temp `bin` folder, mode 755.
   The stub appends its arguments as one line to the file in `GH_STUB_ARGS` when set; sleeps `GH_STUB_SLEEP` seconds when set; exits with `GH_STUB_EXIT` and a line on stderr when set; prints the file in `GH_STUB_OUT` when set; otherwise prints `{"number":42,"headRefOid":"<git rev-parse HEAD>","baseRefName":"main","headRepository":{"name":"r"}}` for its working directory.
   `mrun` puts that `bin` folder first on `PATH` for every merge gate run so the real `gh` is never called and every existing case keeps its meaning (the default answer is the local HEAD).
   Run the suite: every existing case still passes.
   Then add the failing cases:
   mg200: a `featRepo` with a workflow change, checked out on `main`, `GH_STUB_OUT` naming the feat sha; `gh pr merge 42 --squash` in warn gives a message with `high`, `42` and the feat sha and the log has no `could-not-run`.
   mg201: the same in enforce with `--match-head-commit <feat sha>` asks.
   mg202: a README-only feat head from `main` allows silently.
   mg203 (N2): `gh pr view 42`, `git push` and `echo gh pr merge 42` stay silent and leave the `GH_STUB_ARGS` file empty so no command that is not a merge reaches `gh`.
   mg210 to mg214: `gh -R o/r pr merge 42`, `gh pr merge 42 -R o/r`, `gh pr merge 42 --repo=o/r`, `gh pr merge https://github.com/o/r/pull/42` and `GH_REPO=o/r gh pr merge 42`, each checking through `GH_STUB_ARGS` that the stub got `pr view` with the selector and `-R o/r` (the URL case needs no `-R`).
   mg215: `GH_REPO=o/r` in the hook's environment (passed through `extraEnv`) reaches the stub as `-R o/r`.
   mg240: from `main`, a pin of the local `main` sha denies in enforce and names `--match-head-commit <feat sha>`; mg241: the pin of the feat sha asks.
   Run them and see them fail.
   Then change `plugins/pro-ship/scripts/merge-gate.py`:
   `actions()` returns, per merge, the directory, the args, the repo (from `-R`, `--repo`, `--repo=` before `pr` or after `merge`, then a segment `GH_REPO=` assignment captured in `skip_wrappers`, then `os.environ["GH_REPO"]`) and the selector (the first positional after `merge`, skipping the values of `-b`, `--body`, `-F`, `--body-file`, `-t`, `--subject`, `-A`, `--author-email`, `--match-head-commit`, `-R` and `--repo`).
   A new `resolve_pr(directory, selector, repo)` runs `gh pr view [selector] --json number,headRefOid,baseRefName,headRepository [-R repo]` with `cwd` set to the repo root and a 5 second timeout, parses the JSON and returns `(root, base, head, number)`, with `base` set to `origin/<baseRefName>` when `git rev-parse --verify -q` resolves it, else `<baseRefName>`.
   `classify_dir` calls `mod.classify(root, base, head)`; `decide` takes the pin target from the resolved head and puts `PR <number>` in the summary.
   Check: `node tests/ship-hooks.mjs` passes, old and new cases.

3. Fetch and every failure path (S). Satisfies R4, R7, AC3, AC4.
   Cases first.
   A helper builds a bare repo `origin.git`, adds it as `origin` of a work repo, pushes `main`, commits a workflow change on `feat`, pushes it as `refs/pull/42/head`, then deletes `feat`, runs `git reflog expire --expire=now --all` and `git gc -q --prune=now` so the commit is gone locally and `GH_STUB_OUT` names its sha.
   The helper asserts `git cat-file -e <sha>` fails before the gate runs, so a surviving object cannot fake a fetch.
   mg220: from `main` in warn the gate fetches and reports high with no `could-not-run`; the checked-out branch and `git status --porcelain` are the same after the run as before (N4); mg221: with no `refs/pull/42/head` on `origin` the result is could-not-run, a message in warn with `unknown`.
   mg230: `PATH` set to a temp folder holding only a symlink to `git`, with the gate run by the absolute path of `python3` (resolve it once with `which python3`) so `gh` is missing.
   mg231: `GH_STUB_EXIT=1`; mg232: `GH_STUB_OUT` pointing at a file holding `not json`; mg233: `GH_STUB_SLEEP=8`; mg234: JSON with no `headRefOid`; mg235: a `baseRefName` that resolves neither as `origin/<name>` nor locally.
   Each of mg230 to mg235 asks in enforce, gives a message with `unknown` in warn and logs `could-not-run` with a reason; none is silent.
   Run them and see them fail.
   Then add to `resolve_pr`: when `git cat-file -e <head>^{commit}` fails, run `git fetch --no-tags origin pull/<number>/head` with an 8 second timeout and check the head again; map every failure listed in R7 to `CouldNotRun` with a short reason (`gh not found`, `gh exited 1`, `gh timed out`, `gh output not JSON`, `PR head missing`, `fetch failed`, `head not found after fetch`, `base <name> not found`).
   Check: `node tests/ship-hooks.mjs` passes and mg233 finishes under the 20 second deadline.

Checkpoint A1: run the verify commands; all pass.

4. `gh api` merges (S). Satisfies R8, R9, AC6.
   Cases first, from `main` with `GH_STUB_OUT` naming a high feat head:
   mg250: `gh api -X PUT repos/o/r/pulls/42/merge` denies in enforce and names `sha`; mg251: the same with `-f sha=<feat sha>` asks; mg252: `--method PUT /repos/{owner}/{repo}/pulls/42/merge -F sha=<feat sha>` asks with no `-R` sent to the stub; mg253: `gh api -X GET repos/o/r/pulls/42/merge` is silent; mg254: `gh api repos/o/r/pulls/42` is silent; mg255: `gh api graphql -f query='mutation { mergePullRequest(input: {}) { clientMutationId } }'` asks as high with `could-not-run` in the log; mg256: the same with `enablePullRequestAutoMerge`.
   Run them and see them fail.
   Then extend `actions()`: after `gh`, `api` with a path argument matching `^/?repos/([^/]+)/([^/]+)/pulls/(\d+)/merge$` gives kind `api-merge`, selector the number and repo `owner/repo` unless the parts are `{owner}` and `{repo}`; `-X GET` or `--method GET` skips it; `graphql` with either mutation name in any argument gives kind `graphql-merge`, which `decide` treats as could-not-run.
   `pinned_shas` reads `sha=<value>` from `-f`, `-F`, `--field` and `--raw-field` for `api-merge`.
   Check: `node tests/ship-hooks.mjs` passes.

5. `--auto` and the docstring (XS). Satisfies R10, R12, AC7.
   Cases first: mg260: `gh pr merge 42 --auto --squash` at high with no pin denies in enforce and the text includes `refuses the merge`; mg261: with the pin it asks.
   Run `gh pr merge --help` and confirm `--auto` and `--match-head-commit` are both listed with no note that they exclude each other; write what it says in the Done block.
   Then add the sentence "With --auto, GitHub refuses the merge if a later push changes the head." to the pin message when `--auto` is present.
   Rewrite the module docstring: replace "No network calls" with the two calls, their timeouts and the could-not-run rule; name `gh api` merges.
   Check: `node tests/ship-hooks.mjs` passes and `grep -c "No network calls" plugins/pro-ship/scripts/merge-gate.py` prints 0.

Checkpoint A2: run the verify commands; all pass.

Track B: the thresholds.

6. Calibration script and table (S). Satisfies R14, R15.
   Write `intent/2026-10-30-p0-hardening/calibrate.py`, Python 3 standard library, run from the repo root.
   It lists merged PRs with `gh pr list --state merged --limit 60 --json number,title,mergeCommit`, keeps #60 to #89, loads `plugins/pro-ship/scripts/risk-classify.py` with `importlib` and for each PR calls `classify(".", "<sha>^1", "<sha>")` and counts the code files, lines and areas the way `size_signals` does (excluding `excused` and `is_test` paths).
   With `--sweep` it reruns the set once per value in the grid of the "Proposed thresholds" table, patching `default_thresholds` and prints the PRs whose tier changed.
   It prints Markdown: the 30-row table (PR, title, tier, signal ids, files, lines, areas) and the sweep results.
   Run `python3 intent/2026-10-30-p0-hardening/calibrate.py --sweep > intent/2026-10-30-p0-hardening/calibration.md` (the sweep takes a few minutes), then add a two-line header naming the date, the commit of `risk-classify.py` it ran against and the proposed values.
   Check: the file holds 30 table rows, the count line reads 11 low, 9 medium and 10 high and the sweep matches the table in this plan; if it does not, write the new ranges in `calibration.md` and in "Departures from plan".

7. The comment and its pin (XS). Satisfies R13, AC8.
   Case first in `tests/unit/risk-classifier.test.mjs`: read `plugins/pro-ship/scripts/risk-classify.py` as text and assert it has no match for `/placeholder|unmeasured/i`, that it names `calibration.md` and that the six constants hold the values chosen in step 6 (10, 30, 300, 1000, 3 and 50 unless step 6 moved one).
   Run it and see it fail on the comment.
   Then replace the comment above the constants with one line per constant giving its measured range from `calibration.md` ("measured on PRs #60 to #89: no tier changes for 191 to 950") and a line that `AREAS_MEDIUM` is the one value the table pins; leave the values unless step 6 found a reason.
   Check: `node --test tests/unit/*.test.mjs` passes.

Track C: the router.

8. Name the two skills (XS). Satisfies R16, R17, AC9.
   In `plugins/pro-core/skills/using-pro-dev/SKILL.md`, turn the SHIP line of the fenced router into a branch with three lines: `├ checks and stamp before gh pr create → pr-check (pro-ship)`, `├ how risky is this branch or PR, before a merge → risk-tiers (pro-ship)` and `└ deploy to Vercel → vercel-deploy-bridge (pro-ship, opt-in, bridge: /pro-dev install); ci-cd-and-automation, shipping-and-launch, docs, deprecation (still planned)`.
   Use the same box characters and arrow style as the other branches.
   In the paragraph under the router, replace "the opt-in pro-ship plugin, which today holds only `vercel-deploy-bridge`" with "pro-ship, which today holds `pr-check`, `risk-tiers` and `vercel-deploy-bridge`".
   Check: `node tests/check.mjs` prints 0 failures and `node tests/check.mjs 2>&1 | grep -c -E "pro-ship/(pr-check|risk-tiers)"` prints 0; `node tests/route-lexical.mjs --min-rank1 70` still passes.

Track D: the rule, the list and the guidance.

9. `docs/enforce-mode.md` (S). Satisfies R19, AC10.
   Write it one sentence per line with these sections.
   "The rule" links ADR-0016 and says every gate defaults to warn and is switched per machine with `mode.<gate>`.
   "Gates" is one table with columns gate, plugin, hook script, mode file, open blockers (owner), accepted with a reason:
   floor guard (pro-quality, `floor-guard.py`, `mode.floor-guard`): open, the warn-mode week (Jody); accepted, `docs-before-push.py` blocks whatever the mode (constraint-floor flagged concern 2).
   pr-gate (pro-ship, `pr-gate.py`, `mode.pr-gate`): open, the warn-mode week (Jody); accepted, a forged stamp passes a local guardrail (ADR-0014).
   merge gate (pro-ship, `merge-gate.py`, `mode.merge-gate`): open, the warn-mode week (Jody), `/merge-pr` passing `--match-head-commit` (Jody, outside this repo) and, if step 11 could not verify, the live `ask` check (Jody); accepted, a low merge is not pinned so a push between gate and merge goes through, a `-R` repo that is not `origin` with no local head reads high and in enforce `production-gate.py` asks a second time.
   push gate (pro-security, `push-gate.py`, no mode file): open, the week's gated-diff count (Jody); accepted, it denies once per diff and lets the identical retry through.
   "Evidence per gate" lists the shared conditions of ADR-0016 and the extra ones: floor guard, findings mostly cleared with `floor-allow:` mean a rule is too broad (ADR-0010); pr-gate and merge gate, no `could-not-run` line caused by the gate's own limits; push gate, every gated diff did touch security surface.
   "Summary commands" gives, in a fenced block:
   `GUARD="${CLAUDE_GUARD_DIR:-$HOME/.claude/hooks}"` and `SINCE=2026-11-01`;
   `awk -F'\t' -v since="$SINCE" '$1 >= since && $2 ~ /^(floor-guard|pr-gate|merge-gate)$/ {n[$2 "\t" $3]++} END {for (k in n) print k "\t" n[k]}' "$GUARD/warn.log" | sort` for counts per gate and action;
   `awk -F'\t' -v since="$SINCE" '$1 >= since && $3 == "could-not-run" && $2 ~ /^(pr-gate|merge-gate)$/ {print $2 "\t" $4}' "$GUARD/warn.log" | sort | uniq -c` for the could-not-run reasons;
   and for the push gate, `find "${PRO_DEV_STATE_DIR:-$HOME/.claude/pro-dev}/security" -name '*.json' -newermt "$SINCE"` piped to a `python3 -c` that sums the length of each file's `gated_diffs`.
   Say in prose that the folders are the guard folder and the pro-dev state folder the scripts use, under the home folder unless the variables are set.
   "Decision record template" is a fenced Markdown block with: gate, plugin version installed, period start and end, repos, lines by action, findings read, findings Jody agrees with, findings he would have overridden, could-not-run lines from the gate's own limits, the call (enforce, stay in warn or loosen a rule first), the date and Jody's words.
   Add the index lines to `docs/README.md`: one for `enforce-mode.md` after `pr-check-stamp.md` and one for ADR-0016 in the decisions list.
   Check: make a fixture log in a temp folder with two lines for each of `floor-guard`, `pr-gate` and `merge-gate`, one `could-not-run` line and one old line before `SINCE`; run the two `awk` commands with `CLAUDE_GUARD_DIR` set to it and confirm one count per gate and action, the old line left out and one reason line.

10. Record, roadmap, ADR-0015 and the skill (XS). Satisfies R20, R21, R23, R24, AC11, AC13, AC14.
    Write `intent/2026-10-30-p0-hardening/enforce-decision.md` from the template: status pending, owner Jody Brewster, decision date 2026-11-13, repos "this marketplace and one app repo with the starter, to be named by Jody", one empty row per gate and a line that the period starts once `/pro-dev update` shows pro-ship 0.5.0 or later and pro-quality 0.15.0 or later in both repos.
    In `docs/roadmap.md` replace the "Follow-ups before any gate goes to enforce mode" line with: "What still blocks enforce mode, per gate and with owners: [docs/enforce-mode.md](./enforce-mode.md); the decision record is pending until 2026-11-13."
    In `docs/decisions/0015-risk-tiers.md`, under Status, add "Amended 2026-10-30 by intent/2026-10-30-p0-hardening/: the merge gate reads the PR head through `gh pr view` and may fetch it, which replaces the rejected alternative of checking the head over the network."
    Leave that alternative's bullet in place and append " (since adopted, see the amendment)".
    In `plugins/pro-ship/skills/risk-tiers/SKILL.md`, rewrite "Merging a PR": the merge gate resolves the PR itself so the classifier reads the PR's head even from `main`; `/merge-pr` reads `headRefOid` with `gh pr view <number> --json headRefOid`, shows the tier, signals and sha, waits for Jody at medium and high and runs `gh pr merge <number> <method> --match-head-commit <headRefOid>`; the same pin holds with `--auto`; a `gh api .../pulls/<n>/merge` call pins with `-f sha=<headRefOid>`.
    Check: `node tests/check.mjs` passes and `grep -c "match-head-commit <headRefOid>" plugins/pro-ship/skills/risk-tiers/SKILL.md` prints at least 1.

Checkpoint B/C/D: run the verify commands; all pass.

Serial tail.

11. Headless probe of `ask` per permission mode (S). Satisfies R22, AC12.
    Run it outside the repo in a new temp folder `T` with `git init -q`.
    Write `T/pre.py`, a `PreToolUse` hook that appends the payload's `permission_mode` and command to `T/pre.log` and, when the command contains `merge-gate-probe`, prints `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"probe"}}`.
    Write `T/post.py`, a `PostToolUse` hook that appends `ran <command>` to `T/post.log`.
    Write `T/settings.json` registering both on the `Bash` matcher with `python3 <absolute path>`.
    For no mode flag and then each value `claude --help` lists for `--permission-mode` (on 2.1.314: `manual`, `acceptEdits`, `plan`, `auto`, `dontAsk` and `bypassPermissions`), run from `T`, with a 120 second timeout:
    `claude -p "Run this exact command with the Bash tool and nothing else: echo merge-gate-probe" --settings T/settings.json --permission-prompts none --model haiku --max-turns 3 --output-format json [--permission-mode <mode>]`.
    Record per run: the `permission_mode` the hook logged, whether `post.log` gained a `ran` line, the `permission_denials` in the JSON and the `claude --version`.
    Reading: `--permission-prompts none` denies anything that would prompt so a denial means the hook's `ask` would have prompted and a `ran` line means the mode let the command through without one.
    A mode that ran joins `NO_PROMPT_MODES`; a mode that was denied may leave it; a run that errored, never called Bash or was stopped by the mode itself (likely `plan`) is inconclusive and keeps today's treatment.
    Cases first in `tests/ship-hooks.mjs`: mg270 onward, one per recorded `permission_mode` value, a high PR with the pin in enforce: deny for each value in the new set and ask for the rest; then set `NO_PROMPT_MODES` in `merge-gate.py` with a comment holding the date, the version and the per-mode result and update cases mg80 and mg81 to match.
    Fallback: if `claude -p` cannot run here (no auth, no network, the flag is gone), keep `{"bypassPermissions", "dontAsk", "auto"}`, write "not verified" and the reason in the Done block and in the merge gate row of `docs/enforce-mode.md`.
    Check: `node tests/ship-hooks.mjs` passes with the recorded set.

12. Proof of done and the PR body (XS). Satisfies AC15 and gathers the evidence for AC1 to AC14.
    Run every command under "Proof of done" and fix what fails.
    Paste the calibration count line, the sweep table and the step 11 per-mode results in the PR body.
    Update the Done block of this plan with real results.

13. Review pass (S). Satisfies `REVIEW.md` passes 1 to 3.
    Run `/review` on the finished diff with the `reviewer` subagent at high effort, with the policy paths and nothing else.
    Fix every Important finding test first and record any departure under "Departures from plan" in the same commit.
    Commit, push and open the PR as a draft; stop there, since the merge and the warn-mode week are Jody's.

## Tests that prove it

- AC1: mg200 to mg202 in `tests/ship-hooks.mjs` (step 2); N2 by mg203.
- N1: mg233 finishing under the deadline (step 3); N3: `grep -c -E "gh pr view|git fetch" plugins/pro-ship/scripts/risk-classify.py` prints 0; N4: mg220 asserts the checked-out branch and `git status --porcelain` are unchanged after the fetch.
- AC2: mg210 to mg215, checked through the stub's argument log (step 2).
- AC3: mg220 and mg221 against a local bare `origin` (step 3).
- AC4: mg230 to mg235 (step 3).
- AC5: mg240 and mg241 (step 2).
- AC6: mg250 to mg256 (step 4).
- AC7: mg260 and mg261 (step 5).
- AC8: the unit case of step 7, `calibration.md` and the sweep of step 6.
- AC9: the `grep -c` of step 8 printing 0.
- AC10: ADR-0016 and its row (written with the spec), `docs/enforce-mode.md` and the fixture-log run of step 9.
- AC11: `enforce-decision.md` exists with status pending, owner and date (step 10); the filled record is deferred to after the warn-mode week.
- AC12: mg270 onward and the comment above `NO_PROMPT_MODES` or "not verified" with the reason (step 11).
- AC13: the `grep -c` of step 10 and the amendment line in ADR-0015.
- AC14: the roadmap line (step 10).
- AC15: every command under "Proof of done".
- Every case that can block in mg200 to mg279 has a twin that allows, as the existing merge gate cases do; the table at the top of the merge gate block gains a row per new area.

## Risks

The step most likely to go wrong is step 11.
It depends on Claude Code behavior this repo cannot pin, on `--permission-prompts none` meaning what its help text says and on a nested `claude -p` run working inside a builder session.
`-p` is also only a proxy for an interactive prompt: a mode could behave differently with a person at the terminal.
`NO_PROMPT_MODES` keeps `bypassPermissions`, `dontAsk` and `auto` and fails closed: a mode leaves the set only after an interactive ask check per mode (Jody).
If the set were too small, a mode where an ask does not prompt would let a high merge through, so the headless probe is evidence and not a reason to shrink it.
Every gate also stays in warn until that check is done.

The next weakest is step 3.
The fixture that removes the head from the local clone relies on `reflog expire` and `gc --prune=now`; if the object survives, mg220 passes without fetching.
The case therefore asserts `git cat-file -e <sha>` fails before the gate runs.
A slow `gh` adds up to 5 seconds and a slow fetch up to 8 seconds before the classifier starts; the 20 second deadline still answers as could-not-run, which is high.

Parsing is the third.
A new `-R` and selector reader can misread a flag value as the selector, which would send the wrong PR to `gh pr view`; a wrong selector fails or returns another PR and in enforce the pin then denies so it cannot merge the wrong head.
The cases cover flags with values before the selector.

What this might break:

- Every consumer's `gh pr merge` now calls `gh pr view` first: up to 5 seconds more per merge and a network dependency; offline the merge reads high, which in warn mode is a message.
- A repo whose PRs come from forks: `pull/<n>/head` exists on the base repo's `origin` so the fetch works when `origin` is the base repo and reads high when it is the fork.
- The existing merge gate cases now run against the stub; a stub bug could hide a regression so step 2 runs the old suite against the stub before changing the gate.
- The router change moves pro-core for every starter repo; the lexical routing gate in step 8 checks nothing else moved.
- The calibration sweep in step 6 uses `gh` and history so it runs by hand and not in CI.

What was left out on purpose:

- Editing `/merge-pr`: Jody's file, edited by the orchestrator outside the repo.
- Pinning low merges: the intent recommends waiting for a wrong-branch merge in the warn log.
- A warn mode for the push gate and refreshing `docs/releases.md`: out of scope.
- Fetching from a `-R` repo that is not `origin`: rare here and it fails safe as high.
- Writing the enforce decisions: no evidence exists yet (AC11 is deferred, not dropped).

Which steps can run in parallel: after step 1, Tracks A (steps 2 to 5), B (6 and 7), C (8) and D (9 and 10) touch disjoint files and suit four Sonnet subagents in one turn.
Inside Track A the steps stay in order because each extends one script and one test file.
Steps 11 to 13 are serial.

Nothing here is irreversible.
There is no migration; reverting removes the network calls and the router lines on the consumers' next update, though the plugin cache keeps the old version until then.

Suits auto mode: yes for steps 1 to 10 and 12 once Jody approves, since each has a command that passes or fails.
Step 11 runs a nested `claude -p` that spends a small amount of usage and step 13 ships a hook change to every consumer so both need Jody's yes.

## Options not taken

- Building the PR resolution into `risk-classify.py`: it would give the classifier a network call (spec N3).
- `gh pr checkout` to get the head: it changes the working tree.
- One combined commit with the bumps last: `node tests/check.mjs` would fail its version check at every checkpoint before that.
- Changing the threshold values to round numbers: every value in each range gives the same tiers so a change would be a guess.
- A plugin script for the `warn.log` summary: a plugin release for a maintainer task.
- Probing `ask` only by reading the docs: the risk-tiers build did that and they do not say.
- Denying `gh api graphql` merges in warn mode: warn never denies; could-not-run already raises them to high.

## Proof of done

Run from the repo root on the final branch.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/ship-hooks.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
node tests/check.mjs 2>&1 | grep -c -E "pro-ship/(pr-check|risk-tiers)"
grep -c -i -E "placeholder|unmeasured" plugins/pro-ship/scripts/risk-classify.py
grep -c "match-head-commit <headRefOid>" plugins/pro-ship/skills/risk-tiers/SKILL.md
git diff origin/main --stat -- .claude-plugin/marketplace.json plugins/pro-ship/.claude-plugin plugins/pro-ship/.codex-plugin plugins/pro-core/.claude-plugin plugins/pro-core/.codex-plugin
git status --short
```

What counts as finished:

- `node tests/check.mjs` prints 0 failures and 10 warnings, two fewer than the 12 on main on 2026-10-30; `node tests/eval.mjs --dry` reports every case pointing at a real skill.
- The routing gate passes at 70 or above and `node --test` reports no failure.
- `node tests/ship-hooks.mjs` prints all cases passed with no `FAIL` line, mg200 onward included.
- Strict validation prints `Validation passed` once for the marketplace and once per plugin directory.
- The router `grep -c` prints 0, the placeholder `grep -c` prints 0 and the skill `grep -c` prints 1 or more.
- The diff stat lists the marketplace file and the four manifests.
- `git status --short` is empty.
- The Done block holds the calibration count, the step 5 `gh` help reading and the step 11 result, verified per mode or "not verified" with the reason.

## Done

Built on 2026-10-30 by the builder session on branch `feat/p0-hardening`, rebased on origin/main at 6581c04 (PR 97).

- Build commit: 71e3bbd (the last content commit before this block; the commit that adds this block follows it).
- Baseline before any change: `node tests/check.mjs` 33 checks, 0 failures, 12 warnings; `node tests/ship-hooks.mjs` 182 cases; `node --test tests/unit/*.test.mjs` 165 pass, 0 fail; routing gate passing.
- Checks run on the final branch, each passing:
  - `node tests/check.mjs`: 33 checks, 0 failures, 10 warnings (two fewer than the 12 on main).
  - `node tests/eval.mjs --dry`: 88 cases reference real skills, 98 skills in catalog plus 7 distractors (live routing skipped, no API key).
  - `node tests/route-lexical.mjs --min-rank1 70`: rank-1 70/87 (80.5%), top-k 83/87, 3 notOneOf warnings, exit 0.
  - `node --test tests/unit/*.test.mjs`: 166 pass, 0 fail.
  - `node tests/ship-hooks.mjs`: 231/231 cases passed.
  - `claude plugin validate . --strict`: Validation passed once; the per-plugin loop passed for 20 of 20 plugin directories.
  - `node tests/check.mjs | grep -c -E "pro-ship/(pr-check|risk-tiers)"` prints 0; the placeholder `grep -c` prints 0; the `match-head-commit <headRefOid>` `grep -c` prints 1; `grep -c "No network calls"` on the gate prints 0; the network `grep -c` on `risk-classify.py` prints 0 (N3).
  - The `warn.log` summary commands ran on a fixture log: one count per gate and action, the line before `SINCE` left out and one could-not-run reason line; the push gate command summed 3 gated diffs over two fixture state files.
- Calibration (step 6): `calibrate.py` over PRs #60 to #89 prints 30 rows and "30 PRs: 11 low, 9 medium and 10 high", the same split as the risk-tiers Done block. All six values kept. Ranges: files_medium 6 and up, files_high 24 and up, lines_medium 191 and up, lines_high 968 and up, areas_medium 3 only, no_test_lines 0 to 56. The table is `calibration.md`.
- Step 5 (`gh pr merge --help` on `--auto` with `--match-head-commit`): on gh 2.21.2 the help lists both flags (`--auto`: "Automatically merge only after necessary requirements are met"; `--match-head-commit SHA`: "Commit SHA that the pull request head must match to allow merge") and says nothing that makes them exclude each other.
- Step 11 (`ask` per permission mode), Claude Code 2.1.314, haiku, `--permission-prompts none`, one run per mode from a temp folder outside the repo, PreToolUse hook answering "ask" for `echo merge-gate-probe`. The hook logged the `permission_mode` values below. In every run the command was denied, `post.log` got no `ran` line and `permission_denials` named Bash:
  - no flag: hook logged `auto` (the machine default), denied.
  - `manual`: hook logged `default`, denied.
  - `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`: hook logged the same value, denied.
  - Control, plain `echo plain-control` with the same settings under `bypassPermissions`, `dontAsk` and `auto`: ran, no denials. So the denial came from the hook's ask.
  - Result: `NO_PROMPT_MODES` is empty. `plan` could also have been stopped by the mode itself but it was never in the set. The probe is a headless proxy, so the interactive recheck stays with Jody before any enforce switch (written in `docs/enforce-mode.md`).
- AC1 to AC7: pass, by mg200 to mg262 in `tests/ship-hooks.mjs` (231 cases, all passing).
- AC8: pass (placeholder `grep -c` 0, 30 rows, ranges, 11 low 9 medium 10 high with no PR changing tier).
- AC9: pass (the router `grep -c` prints 0, check warnings down from 12 to 10).
- AC10: pass (ADR-0016 and its row, `docs/enforce-mode.md` with four gates, criteria, commands and template, fixture-log run).
- AC12: pass (the table above, comment above `NO_PROMPT_MODES`, mg270 to mg275 and mg81).
- AC13: pass (skill `grep -c` prints 1, amendment line in ADR-0015).
- AC14: pass (roadmap line replaced).
- AC15: pass for every command under "Proof of done" that was run here. The last two (`git diff origin/main --stat` and `git status --short`) are checked at the end of this build: the stat lists the marketplace file and the four manifests and the tree is clean.
- Not done here: step 13 (the `/review` pass with the reviewer subagent at high effort), the draft PR and its body with the calibration lines and probe results. They are left to the orchestrator.
- AC11: deferred; `enforce-decision.md` is pending with Jody as owner and 2026-11-13 as the decision date.
- Sign-off: pending.

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0016, Status `proposed` from this change, to `accepted`.

## Departures from plan

Added in the same commit as the change that departs, or in this one where noted.

- Version: main took `metadata.version` 1.65.0 in PR 97 while this branch was in progress, so this branch takes 1.66.0 (commit "chore(p0-hardening): metadata.version 1.66.0"). pro-ship 0.5.0 and pro-core 0.21.0 stand because main did not move them.
- Step 1: the bump commit also carries this plan's status change to approved.
- Steps 2 and 3: the gh failure mapping was written in the step 2 change, so mg230 to mg235 already passed when step 3's cases were added. Only mg220 and mg221 failed first. Cases beyond the plan: mg216, mg217 (selector parsing), mg252b, mg257, mg258 (api twins), mg262 (the `--auto` twin) and each of mg230 to mg235 runs in enforce and in warn.
- Step 4: `api-merge` message names `-f sha=<head>` instead of `--match-head-commit`.
  The hook's first filter lowers the command case so `enablePullRequestAutoMerge` is seen.
- Step 6: the sweep reports exact boundaries (a tier changes only when a threshold crosses an observed value, so the observed values and their neighbours are tested) with "and up" where nothing above the default moves a PR. The planner's `no_test_lines` range of 10 to 62 was off: the measure is source lines added in PRs with no test change, #77 has 56, so the range is 0 to 56 and 57 moves #77. The value 50 stays inside it. The planner's other ranges hold.
- Step 7: the existing unit case "the size thresholds are named placeholder constants" asserted the old wording, so it was renamed and its wording check removed. The new case holds the check.
- Step 9: the push gate command prints nothing when no state file is newer than `SINCE` on macOS xargs, which reads as zero.
- Step 11: the probe found the ask held in every mode, so `NO_PROMPT_MODES` is empty and mg80's deny cases are gone; mg81 now asks under all seven mode values and mg84 asks. While the set is empty the deny branch of the gate has no case (`PROBED_NO_PROMPT` in the test file takes a mode if one is added). Three extra control runs (plain echo under the three modes that were in the old set) were added to show the ask caused the denial.
- Orchestrator decisions applied: `/merge-pr` is already edited outside this repo, so it is listed as done and not as a blocker in `docs/enforce-mode.md`; the app repo reads "this repo plus one app repo (Jody to name: JJ or mieruka)" in the decision record.
- Review round 1 fixes: the `gh api` merge path matches full URLs and query strings (mg250b to mg250e, mg251b to mg251e); `NO_PROMPT_MODES` is restored to `bypassPermissions`, `dontAsk` and `auto` (this reverses the step 11 departure above: mg81, mg84 and mg27x again cover the deny branch and mg120b covers it in the deadline path; the earlier risk statement that a wrong reading costs only a denied merge was wrong for a smaller set and is rewritten); the several-pins, ask and pinned-warn log lines name the PR and head sha (mg110, mg200, mg201); the gate classifies against `baseRefOid` when `gh pr view` gives it (mg223, mg224); `export GH_REPO=...` carries to later segments (mg218); more cases for a hanging fetch (mg222) and `--repo=` before `pr` (mg219).
