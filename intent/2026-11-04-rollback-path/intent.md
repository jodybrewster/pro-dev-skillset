---
source: idea
kind: change
breaking: false
status: proposed
risk: high
level: 3
created: 2026-11-04T14:10:00-0500
author: the maintainer
---

# Intent: a release can be rolled back through the loop and tested unattended

Source: idea.
Status: proposed.
Created: 2026-11-04.
Related: [release-versioning](../2026-11-03-release-versioning/intent.md), [sdlc-happy-path-run](../2026-11-04-sdlc-happy-path-run/intent.md).

## Problem

Every GO needs a rollback plan, but nothing ever runs one and the loop has no route for it.
On the 2026-11-04 retest, reviews of under ten lines of rollback steps found four Important problems in a row, each only because a reader traced the steps by hand.

Reverting a release also leaves the release tooling with no clean path:

- `ship.py version` proposes 2.0.0 or 1.2.0 after the revert, with no patch option.
- `--agree 1.1.1` is refused.
- `ship.py prepare` writes an empty version heading and the reverted release's changelog section disappears.
- A revert of a feature release removes public API, so it is usually a breaking release. Nothing says so.
- Rollback steps that name versions go stale at the next release, because the Ship block has no way to say "the previous tag" and "this tag".
- A Ship block silently replaces the default rollback plan, whose first step tells consumers to pin the previous tag.
- Text beside the block never reaches the record.

## Proposed outcome

A person can roll back a release by following one route through the loop, from the trigger to a new release, with the card and the deploy record saying what happened.
The rollback plan a repo declares is checked before it is needed.
An automated scenario makes a bad release, rolls it back and ends with the board showing the right state.

## Affected users and systems

- `pro-ship`: `ship.py`, the rollbacks reference, `/ship` and `/deployed`.
- `pro-ai-sdlc`: `/incident` and the loop's records.
- `tests/e2e-sdlc.mjs`: a rollback scenario.
- mieruka: how a card reads a rolled-back deploy, through its own intent if it needs one.
- Anyone who depends on a released version.

## Constraints

- A rollback changes what consumers receive, so a person decides it and an unattended run only rehearses it on a demo.
- The roadmap asks for a security challenge before a rollback command, which applies here.
- The live scenario runs only on the maintainer's yes, with its cost stated first.
- Tag and history protections stay on: the route never moves or deletes a pushed tag.
- Depends on a happy path that reaches Done: [sdlc-happy-path-run](../2026-11-04-sdlc-happy-path-run/intent.md) comes first.

## Out of scope

- Deploy-on-merge and manual-deploy services at first, unless the spec shows they share the route: tag-release is what the retest exposed.
- Database rollbacks.
- Automatic rollback on a signal: the control-band watcher is a separate roadmap item.

## Success looks like

On a fresh demo, the automated scenario ships a release with a seeded bug, sees the trigger, reverts through a pull request and releases the next version with a correct changelog.
The card and the deploy records show the bad release and its replacement.
A rollback plan with a step that cannot work is caught before the release goes out.

## Open questions

- What version a rollback release takes and when it counts as breaking: a person needs to settle this first.
- Whether to check a rollback plan by running it on a throwaway clone or by reading it.
- Whether a rollback gets its own record kind or is a deploy that says `rolled-back`.
- Likely needs an ADR: the versioning rule for a rollback release, as an addition to ADR-0025.

## Evidence

From the retest on 2026-11-04, on the demo repo `factory-demo-3`:

- A revert of `v1.0.0..v1.1.0` took 10 commits with no conflicts, tests passed 3 of 3 and the documented use ran.
- In the same clone, `ship.py version` proposed 2.0.0 or 1.2.0 and `prepare 1.2.0` wrote an empty heading.
- `docs/roadmap.md` lists a rollback command as a later intent that needs a security challenge first.
