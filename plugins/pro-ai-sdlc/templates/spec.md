---
intent: <relative path to intent.md>
intent-status: <status from the intent>
status: draft
created: <ISO 8601 timestamp with offset>
author: <name>
---

# Spec: <short title>

Built from `intent.md` in this folder (commit <sha>).
Status: draft | accepted | superseded.
Policies and skills consulted: <the files and skills read before writing this>.

## Summary

One paragraph on what exists once this ships and who gets it.

## Requirements

### Functional

- R1. <a statement a test or a command can check>

### Non-functional

- N1. <speed, uptime, retention, accessibility or similar>

### Policy constraints applied

- <rule from design, security, compliance or UX>: <how this spec honors it>

## Design

### User experience

The flows, the states and the tone of the copy.

### System

What is touched: components, data, interfaces, hooks into other systems and any migration.
Reuse what is there and name it.

### Alternatives considered

- <option>: <reason it lost>

## Flagged concerns

Anything where the intent or the design collides with a policy, or where two policies disagree.
Reviewers start here.
Write "None found" and name the sources read when there is nothing to flag.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | <the collision> | <file or person> | open, or resolved: <how> |

## Open questions

Each question the intent left open, answered here or still waiting on a named owner.

## Acceptance criteria

- AC1. <something observable that a person or a test can confirm>

## Out of scope

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
