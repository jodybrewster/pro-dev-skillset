---
intent: <relative path to intent.md>
intent-status: <status from the intent>
status: draft
created: <ISO 8601 timestamp with offset>
author: <name>
---

# Spec: <short title>

From: `intent.md` in this folder (commit <sha>).
Status: draft | accepted | superseded.
Skills and policies in force: <list the policy files and skills loaded when this was written>.

## Summary

One paragraph: what will exist when this ships, and for whom.

## Requirements

### Functional

- R1. <requirement, testable>

### Non-functional

- N1. <performance, availability, data retention, accessibility>

### Policy constraints applied

- <brand, security, compliance or UX rule>: <how the spec satisfies it>

## Design

### User experience

Flows, states and copy direction.

### System

Components touched, data model changes, APIs, integration points and migration notes.
Reuse what exists and name it.

### Alternatives considered

- <option>: <why rejected>

## Flagged concerns

Reviewers work these first.
One row per conflict between the intent or design and a policy.
Write "None found" and list the sources checked if there are none.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | <what conflicts> | <file or owner> | open, or resolved: <how> |

## Open questions

The intent's open questions carried forward, answered here or still open with an owner.

## Acceptance criteria

- AC1. <observable, testable>

## Out of scope

<!--
Accepting this spec starts plan mode. Do not write a plan here.
Adapted from the AI-native SDLC kit's specs/TEMPLATE.md.
-->
