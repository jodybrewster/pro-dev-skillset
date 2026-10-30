# ADR-0010: A shared constraint floor, with CONSTRAINTS.md as a repo's quality bar

Date: 2026-10-29

## Status

accepted (2026-10-30)

Decided by: Jody Brewster.
Source: intent/2026-10-29-constraint-floor/.

## Context

When an agent hits a red check it takes the cheapest road to green.
Often that means silencing the checker, skipping or deleting a test, leaving a stub or loosening a threshold instead of fixing the code.
No hook in the marketplace caught those moves; `protect-tests` only watches test edits during `/fix`.
A repo's quality bar was not written down anywhere an agent reads it, so each session decided for itself what "done" meant.
Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills) names the moves and ships a `CONSTRAINTS.md` format and a reference floor guard.

## Decision

Every repo that installs pro-quality gets the same floor: no new suppression comment, no test made easier or deleted, no unfinished stub, no loosened rule and no unannounced exception.
pro-quality's floor guard enforces it on the outgoing diff before `git push` and `gh pr create`.
The floor applies with or without a `CONSTRAINTS.md`.
A repo writes the rest of its quality bar in `CONSTRAINTS.md` at its root: numbered rules that each name the command that checks them, measured values that may rise but never fall and exceptions with an owner and an expiry.
A finding is cleared by fixing the code or by a `floor-allow: <rule> <reason>` line in a commit message, so every bypass is written down.
Gates and reviewers in this marketplace read `CONSTRAINTS.md` as a policy file beside `REVIEW.md`; none of them keeps a second copy of the bar.

## Consequences

Agents can no longer lower the bar quietly; each move is named before the diff leaves the machine.
A repo's bar lives in one file that any agent on any harness can read and that changes only through a reviewed diff.
Each new gate or reviewer has to read `CONSTRAINTS.md` instead of carrying its own thresholds.

What must stay true:

- The guard judges only what the change touched (the diff from the branch point), never code it inherited.
- It never blocks without naming the rule, the file and the line.
- It never prints a secret.
- Tightening the bar is silent; only loosening is flagged.
- A guard that could not run says so; it never reports a clean result for a run that did not happen.
- The floor needs no installs and works on day one.

Revisit the decision if the floor's findings turn out mostly to be ones that get waved through with `floor-allow:`, which would mean a rule is too broad and should be narrowed, or if Claude Code or Codex ship a built-in check that does the same job.

## Alternatives considered

- Leave the bar to each reviewer's prompt: every reviewer would carry its own copy and they would drift.
- Fold the bar into `REVIEW.md`: REVIEW.md says how to review; the bar is what code must meet and is read by the guard as well as reviewers.
- A Rust or bash guard: a binary has to be committed per platform and cannot be reviewed; bash needs `jq` and behaves differently on macOS and Linux.

## Where it is enforced

- `plugins/pro-quality/scripts/floor-guard.py`, registered under the `Bash` matcher of `PreToolUse` in `plugins/pro-quality/hooks/hooks.json`; it runs on `git push` and `gh pr create` and as `--check` from a shell.
- Its cases in `tests/quality-hooks.mjs`, run by the `quality-hooks` check in `tests/check.mjs`.
- `plugins/pro-quality/templates/CONSTRAINTS.md`, the `constraints` skill and `/constraints`.
- pro-ai-sdlc's `reviewer` agent and `/review`, which read `CONSTRAINTS.md` beside `REVIEW.md`.
