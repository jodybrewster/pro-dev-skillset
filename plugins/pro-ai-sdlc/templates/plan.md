# Plan: <short title>

Built from `spec.md` (commit <sha>) and `intent.md` in this folder.
Status: draft | approved | implemented.
Approver: <the engineer, plus a lead or architect when the risk is high>.
Dated: <YYYY-MM-DD>.

## Files that change

- `<path>` (new, modified or deleted): <reason>

## Order of work

1. <a step small enough to check by itself>

## Tests that prove it

- `<test file>` covers <the cases>
- <visual or end-to-end check> against <the reference>

## Risks

The step most likely to go wrong, what it could break, how far the damage would reach, and anything irreversible such as a migration.

## Options not taken

- <alternative>: <why it lost>

## Proof of done

The exact commands to run and the output that counts as finished: tests, lint, build, visual comparison.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

<!--
Write this in plan mode from an accepted spec, then question it before approval:
what might break, where the weakest step is, and what was skipped on purpose.
Revise until someone who missed the conversation could build from this file alone.
Review compares the final diff with this file.
-->
