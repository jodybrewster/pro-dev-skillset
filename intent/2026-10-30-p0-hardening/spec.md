---
intent: intent/2026-10-30-p0-hardening/intent.md
intent-status: draft
status: draft
created: 2026-10-30T11:52:16-0400
author: Jody Brewster
---

# Spec: P0 hardening before any gate moves to enforce mode

Built from `intent.md` in this folder (commit 81765e0).
Status: draft.
Policies and skills consulted: `CLAUDE.md` (the version-bump, hook-loading and Codex parity laws and the layering rule), `REVIEW.md`, `docs/decisions/` (ADR-0002, ADR-0003, ADR-0004, ADR-0010, ADR-0014 and ADR-0015), `docs/hook-loading.md`, `docs/version-bump-law.md`, `docs/roadmap.md`, the plans and Done blocks of `intent/2026-10-29-risk-tiers/`, `intent/2026-10-29-pr-gate/` and `intent/2026-10-29-constraint-floor/`, `plugins/pro-ship/scripts/merge-gate.py`, `plugins/pro-ship/scripts/risk-classify.py`, `plugins/pro-ship/skills/risk-tiers/SKILL.md`, `tests/ship-hooks.mjs`, `tests/unit/risk-classifier.test.mjs`, `plugins/pro-security/scripts/push-gate.py`, `plugins/pro-ai-sdlc/scripts/production-gate.py` and `guard.py`, `plugins/pro-quality/scripts/floor-guard.py`, `plugins/pro-core/skills/using-pro-dev/SKILL.md`, the router check in `tests/check.mjs` and the user-level `/merge-pr` command (read only).

Decisions from Jody on 2026-10-30, taken as given here:

- The merge gate may make network calls: `gh pr view <number|url> --json headRefOid,baseRefName,headRepository` and, when the head is not local, `git fetch origin pull/<n>/head` under a short timeout.
  Any failure is could-not-run and counts as high.
- Jody's user-level `/merge-pr` is edited by the orchestrator, outside this repo, to pass `--match-head-commit <sha>`.
  This repo documents the exact call in the risk-tiers guidance and never edits a file outside the repo.
- Every other open question takes the intent's recommendation.
- The plan proposes size thresholds from the calibration table and re-runs the 30-PR check; Jody judges the table at PR review.
- Step 15 of risk-tiers is verified with a headless method when one exists, otherwise the deny fallback stays with the reason recorded.
- The week of warn-mode use happens after this build.
  This build delivers the rule, the per-gate evidence criteria, a decision-record template and a warn.log summary; the decision record stays pending with an owner and a date.
- The rule for moving a gate from warn to enforce is ADR-0016, status proposed.
- Gate script fixes are test first.

## Summary

After this ships, one page (`docs/enforce-mode.md`) lists the four gates (floor guard, pr-gate, merge gate and push gate) with what still blocks enforce mode for each and who owns it.
The merge gate classifies the PR it is given, resolved through `gh pr view`, instead of the branch the session sits on so `/merge-pr 123` from `main` reports the tier of PR 123.
It also gates `gh api .../pulls/<n>/merge` and the GraphQL merge mutations and holds `--auto` merges to the same commit pin.
The classifier's size and area thresholds carry the range the calibration over PRs #60 to #89 measured for each, with the table committed beside this spec.
The pro-core router names `pr-check` and `risk-tiers`.
ADR-0016 sets the rule for moving any gate from warn to enforce and a pending decision record waits for the warn-mode week with Jody as owner.
Every gate stays in warn mode.
Jody gets this, along with any session in a repo that installs pro-ship, pro-core or the starter.

## Requirements

### Functional

The merge gate (`plugins/pro-ship/scripts/merge-gate.py`):

- R1. The gate reads the PR selector of `gh pr merge`: the first positional argument after `merge` (a number, a PR URL or a branch name), skipping the values of `-b`, `--body`, `-F`, `--body-file`, `-t`, `--subject`, `-A`, `--author-email`, `--match-head-commit`, `-R` and `--repo`.
  No positional argument means the current branch's PR, as `gh` itself reads it.
- R2. The gate reads the target repo, first match wins: `-R` or `--repo` anywhere in the `gh` call (before `pr` or after `merge`, with a space or `=`), a `GH_REPO=` assignment that prefixes the segment, then `GH_REPO` in the hook's own environment.
  A PR URL selector carries its own repo and needs no `-R`.
- R3. The gate runs `gh pr view [<selector>] --json number,headRefOid,baseRefName,headRepository` with `-R <repo>` when R2 found one, in the directory the merge targets, with a 5 second timeout.
  `number` is added to the fields Jody named, because a URL or branch selector does not give the number that R4's fetch needs.
- R4. When `headRefOid` is not a commit in the local clone, the gate runs `git fetch --no-tags origin pull/<number>/head` with an 8 second timeout and then checks that `headRefOid` resolves.
- R5. The gate classifies with `classify(root, base, headRefOid)`, where `base` is `origin/<baseRefName>` when it resolves, else the local `<baseRefName>`.
- R6. At medium and high, the commit pin is compared with `headRefOid`, never the local `HEAD`.
  Messages and log lines name the PR number and the head sha.
- R7. Each of these is could-not-run and counts as high, with a `could-not-run` log line that names the reason: `gh` missing, `gh` exiting non-zero (not found, not authenticated, no PR for the branch), a timeout, output that is not JSON, a missing or malformed field, a failed fetch, a head that still does not resolve after the fetch and a base that does not resolve.
  An unresolved PR is never low.
- R8. `gh api` calls whose path matches `repos/<owner>/<repo>/pulls/<n>/merge` (with or without a leading slash, `{owner}/{repo}` placeholders allowed) are gated like `gh pr merge <n> -R <owner>/<repo>`, unless the method is set to `GET` explicitly.
  The pin for that call is the `sha` field given with `-f`, `-F`, `--field` or `--raw-field`.
- R9. `gh api graphql` with `mergePullRequest` or `enablePullRequestAutoMerge` in its arguments is could-not-run (high), because the PR cannot be read from a node ID without another call.
- R10. `gh pr merge --auto` at medium and high needs the same `--match-head-commit` as a direct merge and the message says GitHub then refuses the merge if a later push changes the head.
- R11. A low-tier merge stays unpinned (the intent's recommendation); now that the gate classifies the PR itself, the remaining gap is a push to the PR between the gate and the merge, recorded as accepted in `docs/enforce-mode.md`.
- R12. Every behavior the merge gate has today stays as it is unless a requirement above changes it: the mode lookup, the warn and enforce answers, `NO_PROMPT_MODES`, the 20 second deadline, the rule that no flag, file, label or variable turns an ask into an allow (risk-tiers R23) and the silent cases for commands that are not merges.

The classifier (`plugins/pro-ship/scripts/risk-classify.py`):

- R13. The six threshold constants keep a value that sits inside the tier-neutral range the calibration measured and the comment above them names that range per constant and the file that holds the table.
  No "placeholder" or "unmeasured" wording stays.
  A constant the table cannot bound says so in the same comment (the intent's constraint).
- R14. `intent/2026-10-30-p0-hardening/calibration.md` holds one row per PR from #60 to #89 (tier, signal ids, counted files, lines and areas) and the tier-neutral range of each threshold; `calibrate.py` beside it reproduces both from git history and `gh`.
- R15. Re-running the calibration with the chosen values gives 11 low, 9 medium and 10 high with no PR changing tier or every change is listed in `calibration.md` for Jody to judge.

The router (`plugins/pro-core/skills/using-pro-dev/SKILL.md`):

- R16. The SHIP branch names `pr-check` (checks and stamp before `gh pr create`) and `risk-tiers` (the tier of a branch or PR before a merge), both in pro-ship and the prose under the router no longer says pro-ship holds only `vercel-deploy-bridge`.
- R17. `node tests/check.mjs` prints no `router never mentions shipped skill` warning for `pro-ship/pr-check` or `pro-ship/risk-tiers`.

The enforce rule:

- R18. `docs/decisions/0016-gate-enforce-rule.md`, status proposed, sets the rule for moving any gate from warn to enforce: the evidence required, who decides, how the switch is made and how a gate goes back.
  `docs/decisions/README.md` gains its row.
- R19. `docs/enforce-mode.md` holds the one list: per gate, its hook name, plugin, mode file, what still blocks enforce mode, the owner of each blocker and the bypass routes accepted with a reason.
  It also holds the per-gate evidence criteria, the commands that summarize `warn.log` and the push gate's state per gate and the decision-record template.
  `docs/README.md` indexes it.
- R20. `intent/2026-10-30-p0-hardening/enforce-decision.md` is the decision record, filled from the template with status pending, owner Jody and a decision date of 2026-11-13.
- R21. `docs/roadmap.md` replaces the "Follow-ups before any gate goes to enforce mode" line with a pointer to `docs/enforce-mode.md` that names only items with an owner.

Step 15 of risk-tiers:

- R22. A headless probe, `claude -p` with `--permission-prompts none` under each `--permission-mode`, records whether a hook's `ask` still stops a command.
  `NO_PROMPT_MODES` is set from the result, with the Claude Code version in the comment above it and `tests/ship-hooks.mjs` has a case per mode.
  When the probe cannot run, the set stays `{"bypassPermissions", "dontAsk", "auto"}` and the reason is written in the plan's Done block and in `docs/enforce-mode.md`.

Guidance:

- R23. The "Merging a PR" section of `plugins/pro-ship/skills/risk-tiers/SKILL.md` documents the exact call `/merge-pr` makes: `gh pr merge <number> <method> --match-head-commit <headRefOid>`, with `headRefOid` from `gh pr view <number> --json headRefOid` and says the merge gate now resolves the PR itself.
- R24. ADR-0015 gains a dated amendment line: the merge gate reads the PR head through `gh pr view` and may fetch it, which replaces the alternative it listed as rejected ("checking the PR head sha over the network in the hook").

### Non-functional

- N1. The merge gate still answers within its 20 second deadline, with the `gh` and `git fetch` timeouts inside it.
- N2. A command with no merge in it makes no network call; `gh pr view` runs only after R1 or R8 matched.
- N3. `risk-classify.py` stays free of network calls; the network lives in `merge-gate.py` only.
- N4. The gate never changes the working tree or the checked-out branch; the fetch writes only objects and `FETCH_HEAD`.
- N5. No test touches the network: a stub `gh` on `PATH` and a local bare repo as `origin` stand in.
- N6. Every gate stays in warn mode; the plugin defaults do not change.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-ship and pro-core each take the next minor over main in both manifests and their marketplace entries, with `metadata.version`, in the same commit as their content.
- Hook-loading law (ADR-0003): no hook is added or renamed; `merge-gate.py` stays the one registered script in pro-ship's `hooks/hooks.json`.
- Codex parity (ADR-0004): the router and the risk-tiers skill keep standard frontmatter and harness-neutral prose; both `.codex-plugin/plugin.json` files follow the version.
- Test first: every change to `merge-gate.py` and `risk-classify.py` starts with a failing case.
- No home-directory path in a command or doc: the summary commands read the guard folder from `CLAUDE_GUARD_DIR` with the same default the scripts use and name it in prose, not as a literal user path.
- The user-level `/merge-pr` is never edited by this build.
- Writing rules: no em dash, no Oxford comma, straight quotes and one sentence per line.

## Design

### User experience

`/merge-pr 123` from `main` prints the merge gate's message for PR 123: its tier, signals, PR number and head sha, then allows in warn mode.
With a medium or high PR and no pin, the message names the exact `--match-head-commit <sha>` to add.
When `gh` cannot answer, the message says the tier is unknown, treated as high and gives the reason in a few words.
A person reading `docs/enforce-mode.md` sees a table of four gates and, for each, an empty list or the blockers with owners.

### System

`merge-gate.py` keeps its parser (heredoc stripping, segment splitting, substitutions, wrappers, `cd` and `-C` resolution, as in `push-gate.py` and `pr-gate.py`).
`actions()` returns, for each merge it finds, the directory, the args, the repo from R2 and the selector from R1, plus a kind (`pr-merge`, `api-merge` or `graphql-merge`).
`skip_wrappers` already skips assignments; the segment's `GH_REPO=` value is captured as it is skipped.
A new `resolve_pr(directory, selector, repo)` runs R3 to R5 and returns `(root, base, head, number)` or raises `CouldNotRun`.
`classify_dir` calls the classifier with that base and head through the existing `importlib` load.
`decide` compares the pin with the resolved head.
`gh` is found on `PATH` so the tests put a stub first on `PATH` that answers from a JSON file named by an environment variable the stub reads.
The fetch uses the clone's `origin`; a `-R` repo that is not `origin` and whose head is not local reads could-not-run, which is high (accepted).

`risk-classify.py` changes only the comment and, if the table supports it, the values of the six constants.
`REVIEW.md` overrides keep working as before.

The router gains one SHIP sub-branch line per skill; `tests/check.mjs` is not changed.

`docs/enforce-mode.md` is maintainer documentation in this repo; it ships in no plugin so no plugin is bumped for it.
The push gate has no warn mode: it denies once per diff per session and lets the identical retry through and it writes no `warn.log` line.
Its evidence is the count of gated diffs in its state files under the pro-dev state folder and its row in the record decides whether that stays.

### Alternatives considered

- Classifying the local branch and only checking that it is the PR's head: still wrong from `main`, which is the common case.
- Fetching the PR with `gh pr checkout`: it switches the working tree.
- Reading the head from the GitHub REST API with `curl`: needs a token in the hook; `gh` already holds one.
- Denying `gh api graphql` merges outright: the gate never denies in warn and could-not-run already means high.
- Setting the thresholds to new round numbers: the table does not move a tier for any value inside each range so a change would be a guess; keeping the values and writing their measured ranges follows the constraint.
- A plugin script for the warn.log summary: it would move a plugin for a maintainer task; documented commands are enough.
- Writing the decision record now: there is no warn-mode evidence yet.

## Flagged concerns

ADR needed: yes, the rule for moving a gate from warn to enforce binds every future gate ([ADR-0016](../../docs/decisions/0016-gate-enforce-rule.md), proposed).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The gate now makes network calls, which ADR-0015 listed as a rejected alternative and risk-tiers AC11 checked against. | ADR-0015, Jody | resolved: Jody approved the calls on 2026-10-30; R24 amends ADR-0015 and N3 keeps the classifier network-free. |
| 2 | `warn.log` holds no line from floor-guard, pr-gate or merge-gate on Jody's machine today so the installed plugins may predate P0. | Jody | open: the evidence week starts only once `/pro-dev update` shows the new versions in both repos; `enforce-decision.md` records the start date. |
| 3 | The summary commands need the guard folder, which lives under the home folder, while `CLAUDE.md` bans home-directory paths in docs. | `CLAUDE.md` | resolved: the commands read `CLAUDE_GUARD_DIR` with the scripts' own default and the prose names the folder without a user path. |
| 4 | R3 adds `number` to the JSON fields Jody named. | Jody | resolved: the fetch in R4 needs the number for a URL or branch selector; the call and its timeout are otherwise as approved. |
| 5 | The headless probe runs `claude -p`, which spends a small amount of usage and its result is a proxy for an interactive prompt. | Jody | open: the plan runs it on the cheapest model with three turns; Jody can rerun it interactively before any enforce switch. |
| 6 | Which app repo joins this one for the warn-mode week. | Jody | open: the intent names JJ or mieruka; `enforce-decision.md` leaves the slot for Jody. |

## Open questions

- How to resolve the PR for the merge gate: answered by Jody, `gh pr view` first and classify the base and head it returns; a failed call is could-not-run (R3, R5, R7).
- Whether the gate may fetch the PR head: answered by Jody, yes with `git fetch origin pull/<n>/head` under a short timeout (R4).
- How to pick the size thresholds: answered, the plan proposes values from the table and re-runs the check; Jody judges the table at review (R13 to R15).
- Whether the router change belongs here: answered, here as one pro-core bump (R16).
- What evidence decides enforce mode for each gate: answered with the intent's recommendation, written into ADR-0016 and `docs/enforce-mode.md` (R18, R19).
- Which repos count and who reads the log: answered with the recommendation, this repo plus one app repo with the starter; an agent prepares the summary and Jody reads it (open concern 6 for the choice of app repo).
- Whether `gh api .../pulls/<n>/merge` is matched: answered, yes (R8).
- Whether `gh pr merge --auto` is denied or pinned: answered, pinned like a direct merge (R10).
- Whether low-tier merges given a PR number are pinned: answered, no, until the warn log shows a need (R11).
- How `/merge-pr` gets `--match-head-commit <sha>`: answered by Jody, the orchestrator edits his command outside this repo and the guidance documents the call (R23).
- What the live check of `ask` under each `permission_mode` finds: answered, a headless probe with the deny fallback (R22).
- Whether the push gate belongs in the enforce review: answered, yes, all four gates judged the same way (R19, R20).
- Whether an ADR is needed: answered, ADR-0016.

## Acceptance criteria

- AC1. A case in `tests/ship-hooks.mjs` runs `gh pr merge 42 --squash` from `main` with a stub `gh` that returns PR 42 whose head changes a workflow; the gate reports tier high with the head sha and PR 42 and its log has no `could-not-run` line.
  A twin with a README-only head allows silently.
- AC2. The same holds with `-R owner/repo` before `pr` and after `merge`, with a PR URL, with `GH_REPO=owner/repo` prefixing the command and with `GH_REPO` in the hook's environment; the stub records the arguments it got and each case checks `-R` reached it.
- AC3. With the head missing locally, the gate fetches `pull/42/head` from a local bare `origin` and classifies it; with the ref missing on `origin` the result is could-not-run, high.
- AC4. A missing `gh`, a stub that exits 1, a stub that prints text that is not JSON, a stub that sleeps past the timeout and a JSON answer with no `headRefOid` each give could-not-run: ask in enforce, a message in warn, never silent.
- AC5. At medium and high the pin is checked against the PR head: a pin of the local `HEAD` that is not the PR head denies in enforce and a pin of the PR head asks.
- AC6. `gh api -X PUT repos/o/r/pulls/42/merge` is gated (high PR, no `sha` denies in enforce, `-f sha=<head>` asks), `gh api repos/o/r/pulls/42/merge` with `-X GET` is silent and `gh api graphql -f query='mutation { mergePullRequest ... }'` is could-not-run.
- AC7. `gh pr merge 42 --auto` at high with no pin denies in enforce and with the pin asks; the message mentions that GitHub refuses the merge when the head changes.
- AC8. `grep -c -i -E "placeholder|unmeasured" plugins/pro-ship/scripts/risk-classify.py` prints 0, `calibration.md` holds 30 rows and its tier-neutral ranges and the re-run prints 11 low, 9 medium and 10 high or lists each change.
- AC9. `node tests/check.mjs` prints no warning naming `pro-ship/pr-check` or `pro-ship/risk-tiers`.
- AC10. ADR-0016 exists with status proposed and its row in `docs/decisions/README.md`; `docs/enforce-mode.md` lists all four gates with blockers and owners, the evidence criteria per gate, the summary commands and the template; run on a fixture log, the `warn.log` summary prints one count per gate and action.
- AC11. Deferred, not dropped: `enforce-decision.md` exists with status pending, owner Jody and decision date 2026-11-13.
  The filled record (per gate: findings in `warn.log`, how many Jody agrees with and the call made) lands after the warn-mode week, outside this build.
- AC12. The step 15 result is recorded: per mode, whether the probe's command ran, with the Claude Code version or "not verified" with the reason; `NO_PROMPT_MODES` matches and each mode has a case.
- AC13. The risk-tiers skill documents `gh pr merge <number> <method> --match-head-commit <headRefOid>` for `/merge-pr` and ADR-0015 carries the amendment line.
- AC14. The roadmap's follow-ups line is replaced by a pointer to `docs/enforce-mode.md`.
- AC15. Every command in `CLAUDE.md` "Verifying your work" passes, plus `node tests/ship-hooks.mjs`; pro-ship, pro-core and `metadata.version` are bumped.

## Out of scope

Switching any gate to enforce mode.
Editing the user-level `/merge-pr` command or any file outside this repo.
Overriding a tier down (`--accept-tier`).
Merging `production-gate.py` and the merge gate.
Rulesets, CODEOWNERS and the scaling dials.
Running the gates in CI.
Giving the push gate a warn mode.
Refreshing `docs/releases.md`, which the P0 PRs also left behind.
The P1 and later roadmap items.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
