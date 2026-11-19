# <Feature name>

- Status: <draft | in review | approved>
- Date: <YYYY-MM-DD>

## Overview

<Two or three sentences: what the feature is, the problem it solves and where it sits in the system.>

## The Problem

<The need in plain words and who has it.
Each line traces to an intent.>

## Goals

- <A result someone could observe or measure.>

## Non-Goals

- <What this feature leaves alone on purpose.>

## Open Questions

- <A question still unanswered and who can answer it. Remove it once it is settled.>

## Critical User Journeys (CUJs)

### CUJ 1: <journey title>

- Given: <the starting state>
- When: <what the person does>
- Then: <what they see and what is true afterwards>

## Technical Plan (Architecture)

<How it works: the parts, the data, the interfaces between them and how it fits the code that exists.
Name the files and modules it builds on.>

## Alternatives Considered

### Alternative A: <title>

<What it was and why it lost.>

## Non-Functional Requirements

- <Performance, accessibility, security, privacy and limits that the design must meet.>

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `<path>` (<Create | Modify | Delete>)

<What changes and why. Pseudocode, an interface or a schema is fine. No implementation code.>

### Verification Plan

<The tests and checks that show it works and the commands that run them.>

## Flagged concerns

<`None found.` and the files checked, or one row per conflict between this design and a repo rule.>

| Concern | Source | Status |
|---|---|---|
| <what conflicts> | <the file and line that says otherwise> | <open, or closed with a few words on why> |

<!--
One file per feature, kept true as changes land. The history is in git.
Product reads The Problem, Goals, Non-Goals and the journeys.
Design reads the journeys and the non-functional requirements.
Engineering reads the technical plan, the alternatives and the implementation plan.
Flagged concerns is added by /design and closed by the policy owner; the other section names follow the design
document of the Elephant-Goldfish Model (Apache-2.0, https://github.com/google/elephant-goldfish-model) so its
draft, review and resolve steps read this file as their own.
Reviews and approvals are not written here. They are in design-record.json beside each intent, bound to the
exact version of this file that was reviewed and approved.
-->
