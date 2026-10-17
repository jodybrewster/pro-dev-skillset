---
source: <idea | ticket <ID> | incident <ID>>
kind: <bug | idea | change>
status: draft
risk: <low | medium | high>
created: <ISO 8601 timestamp with offset>
author: <name>
---

# Intent: <short title in sentence case>

Author: <name (team)>.
Source: idea | ticket <ID> | incident <ID>.
Status: draft | accepted | rejected.
Created: <YYYY-MM-DD>.

## Problem

The need, told the way the person told it.
Say who runs into it and how often.

## Proposed outcome

The state of the world once this is solved, described so someone could see it.
No solution design here.

## Affected users and systems

The people, teams, services, repos and data this reaches.

## Constraints

Rules the work must respect: policy, security, compliance, money, dates, "reuse the existing login", "no new personal data".
An approach the person already favors or ruled out is noted here as a constraint.

## Out of scope

What this intent leaves alone on purpose.

## Success looks like

The sign, observable or measurable, that tells the person it worked.

## Open questions

What still needs an answer, and who can give it, before or during design.

## Evidence

For a ticket or an incident: the source ID, a link, and any numbers or logs that back the claim.
Write "None" for an idea.

<!--
Lifecycle:
  draft     the person corrects what the interview got wrong
  accepted  the person accepts it in person; a spec pass can start
  rejected  dropped; the reason is written into the file
Location: intent/<YYYY-MM-DD>-<slug>/intent.md, with spec.md and plan.md beside it.
-->
