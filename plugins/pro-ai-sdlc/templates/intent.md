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

What cannot be done today, in the originator's own words.
Who feels it and how often.

## Proposed outcome

What better looks like.
Observable, not a solution design.

## Affected users and systems

Roles, teams, services, repos and data.

## Constraints

Policy, security, compliance, budget, time, "existing authentication only", "no new PII".
Approaches the person already ruled in or out are recorded here, not designed.

## Out of scope

What this intent deliberately does not cover.

## Success looks like

How the person will know it worked, as something observable or measurable.

## Open questions

Things the product owner or a policy owner must answer before or during design.

## Evidence

Required for a ticket or an incident: the source ID, a link, the metric, the baseline, the window and links to logs or traces.
Write "None" for an idea.

<!--
Lifecycle:
  draft     the originator corrects what was misunderstood
  accepted  the person accepts it in person; a spec pass starts
  rejected  dropped; the reason goes in the file
Location: intent/<YYYY-MM-DD>-<slug>/intent.md. The spec and plan sit beside it.
Adapted from the AI-native SDLC kit's intent/TEMPLATE.md with this marketplace's frontmatter and folder layout.
-->
