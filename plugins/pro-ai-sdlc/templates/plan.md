# Plan: <short title>

Built from `spec.md` (commit <sha>) and `intent.md` in this folder.
Status: draft | approved | implemented.
Approver: <the engineer, plus a lead or architect when the risk is high>.
Dated: <YYYY-MM-DD>.
Mock: <repo path or http(s) URL of the design mock, only when the plan builds UI>

## Files that change

- `<path>` (new, modified or deleted): <reason>

## Order of work

1. <a step small enough to check by itself> (size XS or S; irreversible: <what cannot be undone>, only when it applies; R1, AC1)
   Checkpoint: <the commands to run and what to confirm>

## Tests that prove it

- `<test file>` covers <the cases>
- <visual or end-to-end check> against <the reference>

## Risks

The step most likely to go wrong, what it could break, how far the damage would reach, and anything irreversible such as a migration.

Stop-list categories: <none, or each category with the steps that touch it>

## Options not taken

- <alternative>: <why it lost>

## Proof of done

The exact commands to run and the output that counts as finished: tests, lint, build, visual comparison.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: <sha>
- Checks run: <each command with its real result>
- Definition of done: <met, or the items not met> (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more)
- Visual: <one line per visual check: step, viewport, status and any accepted difference; "none" when the plan has no Mock: line>
- Doubt: <one line per doubted step: step, trigger, rounds, Codex ran, skipped or could not run, how each finding was settled; "none" when no step was doubted>
- AC1: <pass or fail, with what was observed>
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves any ADR with Status `proposed` from this change to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

## Noticed but not touched

Problems seen outside a step during the build, one per line: the file, what was seen and why it was left.
/execute copies them into the PR body.

<!--
Write this in plan mode from an accepted spec, then question it before approval:
what might break, where the weakest step is, and what was skipped on purpose.
Revise until someone who missed the conversation could build from this file alone.
Mock: is optional. Give a repo-relative path or an http(s) URL.
Tag each UI step in Order of work with (ui: <route>), for example (ui: /settings).
/execute then captures the route at 1280 and 390 wide once the step's tests pass and compares it with the mock.
Delete the line when the plan has no UI.
Review compares the final diff with this file.
-->
