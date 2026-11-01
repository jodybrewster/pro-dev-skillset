---
source: idea
kind: change
status: accepted
risk: medium
created: 2026-11-01T10:26:13-0500
author: the maintainer
---

# Intent: carry the loop past the build, from verified work to deploys, incidents and lessons

Source: idea.
Status: accepted.
Created: 2026-11-01.
Related: [ship-preflight](../2026-10-31-ship-preflight/intent.md), which wrote the GO or NO-GO record before a release; this intent adds the records that come after it.

## Problem

The loop in `pro-ai-sdlc` is complete up to the build: intent, spec, plan, `/execute`, `/review` and `/pr-babysit`.
After that the playbook's artifact chain runs on to a deploy record, an incident record or lesson and a new intent.
None of those exist here.
Nothing writes down that a commit reached an environment, so mieruka's deploy panel has no data and the board stops at build.
An incident in production has no file shape, so it neither starts a new intent nor leaves a regression test behind.
A mistake the reviewer flags on one PR is flagged again on the next, because nothing remembers findings across reviews.
Inside the build, the handoff from "implementation done" to "PR opened" does not require the verifier's independent pass, formatting and linting run only when someone remembers and UI steps are never compared against the mock the plan names.

## Proposed outcome

- After a deploy, one command writes a deploy record for the commit, the target and the environment, with the URL, the result and the preflight it relied on, in mieruka's evidence format.
- One command turns an incident into an incident record, a new intent that re-enters the loop and a regression test case that must fail on the broken commit and pass on the fix.
- `/review` remembers its findings; when the same mistake shows up on a second change it proposes the line for `CLAUDE.md` and a person accepts or declines it.
- The pr-check stamp that lets `gh pr create` through also needs a fresh verifier pass for the same commit.
- After each edit the repo's own formatter and linter run on the edited file and report what they changed or found.
- When a plan names a mock, `/execute` screenshots each UI step and compares it with the mock before the step counts as done.
- Every record lands where mieruka reads it, so its review, ship and maintain views have data to show; mieruka builds those views itself.

## Affected users and systems

Every repo with `pro-ship`, `pro-ai-sdlc` or `pro-quality` installed.
`pro-ship` (the deploy record, the stamp), `pro-ai-sdlc` (`/review`, `/execute`, the incident command, the verifier) and `pro-quality` (the format hook).
mieruka reads the new records; it is changed in its own repo by its own work.

## Constraints

- The whole loop works from Claude Code alone; mieruka only reads what the plugins write and never runs a gate.
- Records use mieruka's evidence manifest as it is: its table accepts only the kinds `review`, `qa_run`, `deploy`, `a11y`, `visual_drift` and `doc`; one unknown kind stops the rest of its sync.
- The record contracts are fixed early and written down in one doc each, because mieruka builds against them at the same time.
- agent-skills is the baseline: its CI, observability, browser testing, review and debugging material that bears on these items comes across in full, or the spec says why an item is left out.
- New gates and hooks start in warn mode (ADR-0016), never crash the turn, make no network call in a hook and never execute text from a payload (REVIEW.md).
- The format hook runs only tools already installed in the repo; it never downloads one.
- The version-bump law, the hook-loading law and Codex parity apply.
- Nothing names the maintainer or quotes chat.

## Out of scope

- mieruka's views, stages and Ship page; mieruka builds them in its own repo.
- `claude -p` in CI, tiered deploy autonomy by environment, a rollback command and a control-band watcher on production metrics.
  Each touches CI secrets or production credentials and gets its own intent with a security challenge before any code.
- Running deploys; the deploy record writes down a deploy that happened.

## Success looks like

In a throwaway repo, a deploy writes a `deploy` record that mieruka's own sync loads with no error.
`/incident` on a described failure leaves an incident record, a new intent folder with `source: incident <ID>` and a failing regression test.
A finding repeated on a second review produces one proposed `CLAUDE.md` line.
`gh pr create` is warned about when the stamp has no fresh verifier pass.
An edit to a file with a prettier config in the repo gets formatted by the repo's prettier.
A plan with a mock produces a `visual_drift` record per UI step.
Every check in `CLAUDE.md`'s "Verifying your work" passes.

## Open questions

- Whether review findings are remembered per repo in an untracked file or in a tracked one people can read in a PR.
  Likely needs an ADR, together with the record contracts.
- How a verifier pass is recorded so that the session that wrote the code cannot simply claim one.

## Evidence

None.
