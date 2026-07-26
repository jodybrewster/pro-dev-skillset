---
description: Produce a validation handoff - what changed, what was actually verified, and the concrete steps you should check on your end.
argument-hint: '[what to focus the handoff on]'
---

Use the `user-validation` skill to produce a validation handoff for the work in this session.

Scope it to `$ARGUMENTS` if given; otherwise cover everything that changed in the working tree.

First run the verification you can run yourself and report real output - do not hand the user checks you could have performed. Then write the full handoff to `.pro-dev/validation/latest.md` and echo a condensed version in chat under `## Validate on your end`.

Order the user-facing steps by risk, and give each one a concrete "expect this" so the user can tell pass from fail without reading the diff.
