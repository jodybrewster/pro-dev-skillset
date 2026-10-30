# ADR-0017: Every plan cites one definition of done and /execute pauses before stop-list steps

Date: 2026-10-30

## Status

proposed

Decided by: Jody Brewster.
Source: intent/2026-10-30-sdlc-loop-upgrades/.

## Context

The P0 review stack checks a diff after it is built.
The stages before review had no standing bar and no pause.
Each plan's `Done` block decided for itself what finished means beyond its acceptance criteria, so the bar moved from plan to plan.
`/execute` builds a whole approved plan unattended, so a step that touches auth, a migration, payments, a deploy or secrets was built with the same calm as a rename.
pro-ship's risk tiers gate the merge, but by then the risky step is already built and committed.
pro-ai-sdlc cannot depend on pro-ship (ADR-0013), so the build-time check cannot require pro-ship's classifier.

## Decision

pro-ai-sdlc ships one standing definition of done at `plugins/pro-ai-sdlc/references/definition-of-done.md`.
Every plan's `Done` block cites it in one line and names the items not met.
A repo's `CONSTRAINTS.md` or `REVIEW.md` takes precedence where it says more.
`/execute` keeps a stop list of five categories: auth, migrations, payments, deploys and secrets, named by path as in pro-ship's classifier.
It checks the plan before the build and each step's staged files before the commit.
A step that fires pauses for an explicit yes from a person.
A category the plan's Risks section names, with an approver in the plan header, counts as consent and does not pause.
The stop list is prose in the command, not a hook.
It never blocks without saying why.
When pro-ship's `risk-tiers` skill is installed, `/execute` also runs it at checkpoints and pauses on a signal no consent covers.

## Consequences

Every plan meets the same bar and a reviewer can see which items a change did not meet.
A risky step gets a person's attention before it is built, not only before merge.
A plan that names its risky steps under an approver runs unattended as before.
Changing the definition of done changes the bar for every later plan, so it moves only through a pro-ai-sdlc release.
The stop list can miss a risky change whose paths use other names; the classifier and the merge gate stay as the later checks.
Reverse this if the pauses fire so often on routine work that people approve them by habit or if a hook-based gate replaces the prose list.

## Alternatives considered

- A hook that blocks risky paths during the build: it cannot ask a person mid-build and would duplicate the merge gate.
- Require pro-ship's classifier: breaks the layering rule (ADR-0013).
- A checklist line per definition-of-done item in every plan: boxes get ticked by habit.
- Leave the bar to each plan's acceptance criteria: the P0 builds showed the bar drifting.

## Enforced by

`tests/check.mjs` (`sdlc-contract`) asserts the stop list, the scope-discipline section, the reference file and the plan template's definition-of-done line.
The `execute-pauses-on-migration` eval case in pro-ai-sdlc checks the pause on demand.
