---
source: idea
kind: change
status: done
risk: medium
created: 2026-10-29T19:00:00-0400
author: the maintainer
---

# Intent: the PR gate

Author: the maintainer.
Source: idea, item 2 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md) and "The pre-PR gate" in the [pro-ship brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md), from the maintainer's ask on 2026-10-28.
Status: done; shipped in #89.
Created: 2026-10-29.

## Problem

The ask is for build checks, lint checks, unit tests, typechecking and AI agents checking the code with a fresh context window before a pull request, at a minimum, maybe as a hook.

Today nothing runs those checks before a PR opens, in any repo that installs the starter.
Build and typecheck are never run by a hook.
Lint and tests run only inside pro-quality's `pr-quality-gate.py`.
That script runs after the PR exists (PostToolUse), so a failure is found when the PR is already open.
Since pro-quality 0.11.1 (PR 76) the script fires on `gh pr create`, which the brainstorm said it never did.
It still has no build step, no typecheck step and no Python support.
It runs `npm run lint` and `npm test` inside the hook with 30 and 60 second timeouts, so a slow suite is cut off and reads as a failure.
Its fresh-context review is a line of text that tells the session to dispatch a reviewer from the `requesting-code-review` skill.
The session can ignore that line.
No record says whether a review happened.
pro-security's push gate reviews the same diff on its own schedule, so a PR can get a security review at push time that nothing links to the PR.
The PR body has no required Testing, Risk or How to revert section, so a reviewer cannot tell how the change was tested or how to undo it.

## Proposed outcome

Before a PR opens, one command runs the project's build, lint, typecheck and unit tests and the constraint floor check, then hands the diff to the reviewers in parallel, each with a fresh context.
The command leaves a stamp for the commit it checked: the commands that ran, how each ended, what the floor guard and the reviewers found and the risk tier.
The `gh pr create` step checks only that stamp.
With no passing stamp for the current commit it stops once and says to run the check.
It never runs a build or a test itself.
The security review that the push gate would have run is recorded in the same stamp, so it runs once per PR and the push gate accepts it.
The command also drafts the Testing, Risk and How to revert sections of the PR body from what it ran, for the maintainer to sign off.
Each piece still works when a sibling plugin or agent is not installed.
Says what it skipped.

## Affected users and systems

The maintainer and any agent session in a repo that installs pro-ship, pro-quality or pro-security: JJ, mieruka, personal-site, gemini-live and this repo.
pro-ship (a new `pr-check` skill, its script and a `gh pr create` stamp hook, plus manifests, Codex parity files and the marketplace entry).
pro-quality (`pr-quality-gate.py` and its two hook entries are removed).
pro-security (`push-gate.py` accepts the stamp).
The reviewers the skill dispatches: pro-security's `security-architect` today and the `code-reviewer` of the sibling intent when it lands.
`tests/quality-hooks.mjs`, `tests/security-hooks.mjs`, `tests/cases/routing.jsonl` and `tests/check.mjs`.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
The hook only checks the stamp.
It never runs builds or tests, because a hook timeout would hang the session (brainstorm, "Shape").
It follows `~/.claude/hooks/mode` and its per-hook override, like the other gates.
Denies once per commit as pro-security's push gate does.
Every reviewer gets fresh context: only the fixed four-field handoff owned by [intent/2026-10-29-code-reviewer](../2026-10-29-code-reviewer/intent.md), never the author's reasoning.
The skill obeys the convergence rules of [intent/2026-10-29-review-policy](../2026-10-29-review-policy/intent.md) and reads the repo's `REVIEW.md` as the only project review policy.
Rules from `CLAUDE.md`: no hard dependency on a plugin from another marketplace and no pro-core dependency on a plugin that owns registry rows, so every sibling is detected at run time and optional.
Hooks make no network calls and never crash the turn.
"Could not run" must never read as passed.
pr-check is a skill, not a command, so other skills can chain it and Codex loads it (brainstorm, "Skills, not commands").
The skill name `pr-check` is open.

## Out of scope

The reviewer agent and its handoff contract; that is [intent/2026-10-29-code-reviewer](../2026-10-29-code-reviewer/intent.md).
The risk classifier and approval tiers; that is [intent/2026-10-29-risk-tiers](../2026-10-29-risk-tiers/intent.md).
Until it lands the stamp carries a fixed tier value.
Convergence rules and the `REVIEW.md` template; that is [intent/2026-10-29-review-policy](../2026-10-29-review-policy/intent.md).
Codex as a second reviewer (roadmap item 13).
The same checks as required GitHub Actions status checks (roadmap item 16, `pipeline`).
Installed skills that declare runnable checks (roadmap item 20).
The required documents check (roadmap item 14).
A gate on `gh pr merge` or on releases; the release side stays with `production-gate`.
Creating the PR itself.

## Success looks like

In the maintainer's repos a `gh pr create` on a commit that was never checked stops once and names `/pro-ship:pr-check`.
After the check passes the same command goes through with no second prompt.
A commit with a failing build, lint, typecheck or test run gets a stamp that says so and the hook does not accept it.
The stamp names which reviewers ran and which did not.
A change that touches security surface gets one security review per PR instead of one at push time and one at PR time.
The drafted Testing, Risk and How to revert sections are accurate enough that the maintainer edits them rather than writes them.
In warn mode the gate raises no stop the maintainer disagrees with over a couple of weeks of normal work.

## Open questions

- Fixed handoff to a subagent versus `claude -p` for the reviewers (brainstorm, open). Recommendation: a subagent with the fixed handoff, since it runs in the same session with no second login or cost path and `claude -p` can be added later for CI.
- Where the hook lives. Recommendation: pro-ship, since the stamp is its artifact, with pro-quality's old gate removed outright.
- Whether pro-ship joins `pro-dev-starter` with this change. Today it is opt-in and holds only the Vercel bridge, so removing pro-quality's gate would leave starter-only repos with no PR check (recommendation: add it to the starter in the same release).
- The default mode of the new hook (recommendation: warn, then enforce after a couple of weeks of clean logs).
- Whether a draft PR (`gh pr create --draft`) needs the stamp (recommendation: it does not, since a draft is not yet asking for review).
- Whether the stamp's tier is absent or a fixed value until the risk classifier lands (recommendation: the fixed value `unclassified`).
- How pr-check finds a sibling plugin's script, such as pro-quality's floor guard, when plugins install into separate folders.
- How the security review decides it is needed (recommendation: only when the diff touches security surface, using pro-security's own classifier, so a CSS change costs no Opus run).
- Likely needs an ADR: a stamp under `.pro-dev/ship/` that several gates read, with one writer (pr-check) and a rule for what makes a stamp valid.

## Evidence

None; this is an idea.
The gap, from the code: `plugins/pro-quality/scripts/pr-quality-gate.py` runs after the PR is created, covers `lint` and `test` for npm only and only asks the session to dispatch a reviewer.
`plugins/pro-security/scripts/push-gate.py` denies once per distinct diff per session and has no way to know a review already ran.
`plugins/pro-ship/` holds only the Vercel bridge and an installer.
