---
source: idea
kind: change
breaking: false
status: draft
risk: low
level: 2
created: 2026-11-07T14:31:00-0500
author: the maintainer
---

# Intent: accessibility and performance reviews run on pull requests that change UI

Author: the maintainer.
Source: idea.
Status: draft.
Created: 2026-11-07.

## Problem

The marketplace has an accessibility audit (`pro-design`) and a web performance auditor (`pro-quality`), both adapted from agent-skills.
Neither runs on a pull request: the performance auditor only runs at `/ship` time and the accessibility audit only when someone asks.
A change that drops a form label or adds a large client bundle can merge, unattended at level 1, without either being looked at.

## Proposed outcome

When a pull request's diff touches UI (components, pages, styles or client bundles), `pr-check` runs the accessibility audit and the web performance auditor beside its other reviews and records both in the stamp.
A diff that touches no UI skips both and says so in the stamp.
Their Critical findings count like the code review's.

## Affected users and systems

`pro-ship`'s `pr-check`, `pro-design`'s accessibility audit and `pro-quality`'s `web-performance-auditor`; repos with a frontend.

## Constraints

Both run locally inside `pr-check`, never in CI.
They run once per head commit and only on UI diffs, to keep usage down.
The performance auditor stays in quick mode unless Lighthouse output is supplied.

## Out of scope

Running Lighthouse or a browser in CI.
Visual regression testing.

## Success looks like

A pull request that changes a React component has both reviews in its stamp; one that changes only a Python script has neither and the stamp says they were skipped.

## Open questions

None.

## Evidence

None.
