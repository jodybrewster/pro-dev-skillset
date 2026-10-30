---
source: idea
kind: change
status: draft
risk: medium
created: 2026-10-30T09:00:00-0400
author: Jody Brewster
---

# Intent: P0 hardening before any gate moves to enforce mode

Author: Jody Brewster (pro-dev-skillset).
Source: idea, drafted from the follow-ups recorded in [docs/roadmap.md](../../docs/roadmap.md) ("Now") and the "Departures from plan" and Done sections of the plans for [risk-tiers](../2026-10-29-risk-tiers/plan.md), [pr-gate](../2026-10-29-pr-gate/plan.md) and [constraint-floor](../2026-10-29-constraint-floor/plan.md), with no interview.
Status: draft.
Created: 2026-10-30.

## Problem

The P0 review stack shipped four gates: the floor guard, the pr-gate, the merge gate and the existing push gate.
All of them start in warn mode.
Each plan says the same thing: a gate does not move to enforce mode until its known limits are closed and a week of real use has been read.
Those limits are scattered across three plans and the roadmap, so nobody can say today what stands between warn and enforce.
The ones found so far:

- The merge gate (`plugins/pro-ship/scripts/merge-gate.py`) classifies the checked-out branch, not the PR number it is given.
  `/merge-pr` run from `main` reads could-not-run and is treated as high, so every merge from `main` raises a high-tier message.
  In enforce mode that would be a false denial on every low-risk merge.
- The risk classifier's size thresholds are placeholder constants marked unmeasured.
  The calibration over the last 30 merged PRs (#59 to #89) ran and gave 11 low, 9 medium and 10 high, but nobody has set the numbers from that table.
- The pro-core router (`using-pro-dev`) does not name `pr-check` or `risk-tiers`.
  Those are the only two warnings `node tests/check.mjs` still prints for this stack.
A session that starts from the router never learns the skills exist.
- AC9 of the constraint floor and its twins (AC13 of the pr-gate, AC12 of risk-tiers) are a week or two of warn-mode use in two of Jody's repos.
  Nothing says what evidence turns that week into a decision, so the switch risks being made on a feeling.
- Gaps the plans named as left out on purpose, each of which lets a merge or a PR skip a gate once that gate enforces:
  `gh api .../pulls/<n>/merge` is caught by `production-gate.py` but not by the merge gate.
  A low-tier merge given an explicit PR number is not pinned to a commit.
  `gh pr merge --auto` merges later, possibly on a different head than the one approved.
  The user-level `/merge-pr` command does not pass `--match-head-commit <sha>`, so in enforce mode every medium and high merge it runs would be denied.
  That command lives outside this repo and is Jody's file.
- Step 15 of risk-tiers (does a hook `ask` still prompt under each `permission_mode`) was not verified live.
  The gate denies medium and high under `bypassPermissions`, `dontAsk` and `auto` as a fallback.
The plan says the switch to enforce waits for the check.

This is felt by Jody and any agent session in a repo with pro-ship, pro-quality or pro-security installed, every time it merges, opens a PR or pushes.

## Proposed outcome

Jody can answer, per gate, "what is still blocking enforce mode?" from one list.
For each gate the list is empty or says what remains and who owns it.
`/merge-pr` run from `main` with a PR number classifies that PR and not the branch it happens to be on.
The size thresholds are numbers taken from the calibration table, not placeholders.
The router tells a session about `pr-check` and `risk-tiers`.
`node tests/check.mjs` prints no warning for them.
For each of the four gates there is a written rule for what the warn log must show before enforce mode.
Each gate also has a recorded decision per gate: enforce, stay in warn or loosen a rule first.
The remaining bypass routes are either closed or recorded as accepted with a reason.

## Affected users and systems

Jody and any agent session in a repo that installs pro-ship, pro-quality, pro-security, pro-ai-sdlc or pro-core.
`plugins/pro-ship/scripts/merge-gate.py` and its cases in `tests/ship-hooks.mjs`.
`plugins/pro-ship/scripts/risk-classify.py` and its unit cases.
`plugins/pro-core` (the `using-pro-dev` router), its routing cases and its version bump.
`plugins/pro-ai-sdlc/scripts/production-gate.py`, which overlaps the merge gate on `gh pr merge`.
The user-level `/merge-pr` command, outside this repo.
`~/.claude/hooks/mode` and the per-hook `mode.<name>` overrides, `warn.log` and `docs/roadmap.md`.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md` hold for every plugin touched.
Every gate stays in warn mode while this work lands; the intent changes what is known about enforce mode, not the mode itself.
"Could not run" must never read as clean.
A PR number that cannot be resolved still counts as high.
A fix to a gate script is test first, as in the three plans.
Thresholds come from the measured table and are not guessed; if the table does not support a number, the constant stays a placeholder and says so.
The user-level `/merge-pr` command is Jody's file and an agent does not edit it; this repo can only document what that command must do.
No home-directory path goes into a command or doc in this repo.
Commands in the hook parser follow the existing parsing in `push-gate.py` (heredoc stripping, segment splitting, `cd` and `-C` resolution) and add `-R`, PR URLs and `GH_REPO` handling rather than a second parser.

## Out of scope

Switching any gate to enforce mode.
That is a separate decision per gate once the evidence is in.
Overriding a tier down (`--accept-tier`).
Merging `production-gate.py` and the merge gate into one hook.
Rulesets, CODEOWNERS and the scaling dials.
Running the gates in CI (the `pipeline` item in the pro-ship brainstorm).
The P1 and later items on the roadmap.

## Success looks like

`/merge-pr 123` run from `main` prints the tier of PR 123 and the signals behind it.
It never says could-not-run for a PR that `gh pr view` can resolve.
The same holds with `-R owner/repo`, with a PR URL and with `GH_REPO` set.
The classifier has no "placeholder, unmeasured" comment left.
Re-running the calibration over the same 30 PRs gives a table Jody agrees with.
`node tests/check.mjs` reports no router warning for `pr-check` or `risk-tiers`.
After the warn-mode period, a short decision record lists each gate with the count of findings in `warn.log`, how many Jody agrees with and the call made.
The roadmap's "Follow-ups before any gate goes to enforce mode" line is either gone or lists only items with an owner.

## Open questions

- How to resolve the PR for the merge gate.
  Recommendation: call `gh pr view <number|url> --json headRefOid,baseRefName,headRepository` first and classify `--base <merge base> --head <headRefOid>` with the same classifier; treat a failed `gh` call as could-not-run and therefore high.
  Needs Jody's yes on the extra network call, since the gate made none until now.
- Whether the gate may fetch the PR head when it is not in the local clone.
  Recommendation: yes, with `git fetch origin pull/<n>/head` under a short timeout; a failed fetch is could-not-run.
- How to pick the size thresholds.
  Recommendation: read the calibration table, set the low-to-medium and medium-to-high lines at the values that keep every docs-only and test-only PR low and every hook or workflow PR high (the calibration already shows this), round them and re-run the 30 PRs to check no tier moves the wrong way.
  Jody judges the table; an agent proposes numbers.
- Whether the router change belongs in this intent or in a pro-core change of its own.
  Recommendation: here, as one small pro-core bump, since it only closes the two warnings.
- What evidence decides enforce mode for each gate.
  Recommendation: after a week in two repos, `grep` each gate name over `warn.log` and enforce only a gate where every logged finding was either correct or a bug since fixed and no finding was one Jody would have overridden.
  For the floor guard, the revisit trigger in ADR-0010 also applies: findings mostly cleared with `floor-allow:` mean a rule is too broad.
  The merge gate and the pr-gate need a second condition: no could-not-run lines caused by the gate's own limits.
- Which repos count as "two of Jody's repos" and who reads the log.
  Recommendation: this repo plus one app repo that installs the starter (for example JJ or mieruka), Jody reads a summary an agent prepares from `warn.log`.
- Whether `gh api .../pulls/<n>/merge` should be matched by the merge gate.
  Recommendation: yes, treat it like `gh pr merge` since `production-gate.py` already does; the PR number is in the path.
- Whether `gh pr merge --auto` is denied or pinned.
  Recommendation: in enforce mode require `--match-head-commit` with `--auto` at medium and high, the same as a direct merge; record that GitHub then refuses the merge if a later push changes the head.
- Whether low-tier merges given an explicit PR number should also be pinned to a commit.
  Recommendation: leave low alone until the warn log shows a merge from the wrong branch.
- How `/merge-pr` gets `--match-head-commit <sha>`.
  Recommendation: this repo documents the exact call in the risk-tiers guidance and Jody edits his own command; until then the merge gate stays in warn.
- What the live check of `ask` under each `permission_mode` finds (risk-tiers step 15).
  Recommendation: run it as part of this intent and set `NO_PROMPT_MODES` from the result; keep the deny fallback if the check cannot be run.
- Whether the push gate belongs in the enforce review at all, since it is older than this stack and its mode is already set separately.
  Recommendation: include it in the decision record so all four gates are judged the same way.
- Likely needs an ADR: a written rule for when a gate moves from warn to enforce (evidence required, who decides, how a gate goes back), since every future gate would follow it.

## Evidence

None; this is an idea.
The follow-ups come from [docs/roadmap.md](../../docs/roadmap.md) line "Follow-ups before any gate goes to enforce mode" and these plan sections:
[risk-tiers](../2026-10-29-risk-tiers/plan.md) "Departures from plan" (known limit on the merge gate), "What was left out on purpose" (`gh api .../merge`, low-tier pin, `/merge-pr` edit) and the Done block (AC9 calibration of 11 low, 9 medium and 10 high; step 15 not verified).
[pr-gate](../2026-10-29-pr-gate/plan.md) Files (router warning for `pr-check`) and AC13.
[constraint-floor](../2026-10-29-constraint-floor/plan.md) AC9.
The gates are read from `warn.log` in the guard folder under `~/.claude/hooks/`.
