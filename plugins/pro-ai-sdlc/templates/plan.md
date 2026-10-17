# Plan: <short title>

From: `spec.md` (commit <sha>) and `intent.md` in this folder.
Status: draft | approved | implemented.
Approved by: <engineer; lead or architect if high-risk>.
Date: <YYYY-MM-DD>.

## Files that change

- `<path>` (new | modified | deleted): <why>

## Order of work

1. <step, small enough to verify on its own>

## Tests that prove it

- `<test file>` covers <cases>
- <screenshot or e2e check> matches <mock>

## Risks

What could break, the riskiest step, the blast radius, rate limits and migrations.

## Options not taken

- <alternative>: <why not>

## Proof of done

The exact commands and expected output that make this done: tests green, lint clean, build ok, screenshot match.

## Departures from plan

Filled in during implementation, in the same commit as the departure.
Empty means the diff matches the plan.

<!--
Produced in plan mode from the accepted spec. Interrogate before approving:
  What could this change break? Which step is riskiest? What did you choose not to do, and why?
Iterate until an engineer who never saw the conversation could implement from this file alone.
The PR review checks the eventual diff against this file.
Adapted from the AI-native SDLC kit's plans/TEMPLATE.md.
-->
