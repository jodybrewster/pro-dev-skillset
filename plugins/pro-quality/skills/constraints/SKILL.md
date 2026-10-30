---
name: constraints
description: Use when asked to set or write down a repo's quality bar, floor rules or standards, to create or read CONSTRAINTS.md and when a diff weakens the bar - new eslint-disable or ts-ignore comments, skipped or deleted tests, removed assertions, stubs, a lowered coverage threshold or a new exception; explains the floor, the ratchet rule and the floor-allow commit line that the floor guard checks on git push and gh pr create
---

# Constraints

A repo's quality bar belongs in a file that outlives the session.
That file is `CONSTRAINTS.md` at the repo root.
Read it before writing code and do not weaken it to make a change pass.
`/constraints` writes it from what the repo already runs.

## The floor

Seven moves lower the bar without anyone deciding to.
The floor guard names each one by id:

- `silenced-checker`: a new comment that mutes a checker, such as `@ts-ignore`, `eslint-disable`, `# noqa` or `# type: ignore`.
- `test-made-easier`: a new skip or todo marker in a test file.
- `test-deleted`: a test file removed.
- `assertion-removed`: assertions removed from a test that stays, beyond the ones added.
- `unfinished-work`: a new stub or an empty catch block.
- `rule-loosened`: a threshold in `CONSTRAINTS.md` moved the easy way or a Floor bullet or numbered row was removed.
- `new-exception`: a new row in the Exceptions table.

Secrets sit on the floor too.
pro-security's push gate and `gitleaks` check those.
A bare `TODO` is not a finding.
Markdown files are skipped by the marker rules because docs name the markers.

## The four sections

The file has these sections in this order.

1. Floor: the moves above as bullets, plus secrets.
2. Enforced with numbers: a table of Dimension, Rule, Checked by and Runs at. Each rule has a number and a direction word. A row exists only when its check ran and exited 0.
3. Measured, not yet enforced: a table of Metric, Today and Direction. These are numbers with no failing check yet.
4. Exceptions: a table of ID, Rule, Path, Reason, Owner and Expires.

An optional `Test files:` line lists extra globs the guard treats as tests.

## Ratchets

A number may only move the strict way.
A minimum (at least) may rise and may not fall.
A maximum (at most) may fall and may not rise.
Tightening is never reported.
A move the other way is `rule-loosened`.
When a measured number beats its target, raise the target and promote the row once a check backs it.

## Exceptions

When a rule has to bend, add an Exceptions row with the rule id, the path, the reason, an owner and an expiry date.
Adding the row is itself a finding (`new-exception`), so a person sees it.
Delete the row when it expires or when the code no longer needs it.

## How the guard reads it

The floor guard is a hook in pro-quality.
It runs when a command is `git push` or `gh pr create` and reads the outgoing diff against the merge base.
It works without a `CONSTRAINTS.md`, but `rule-loosened` and `new-exception` need the file.
It starts in warn mode: findings are shown and logged and the command runs.
In enforce mode a finding denies the command.

To clear a finding, fix the code or add a line to a commit message in the range:

```
floor-allow: <rule> <reason>
```

The reason must not be empty.
The guard lists each allowance with its reason instead of the finding.
From a shell, `python3 floor-guard.py --check [--base <ref>] [--worktree]` runs the same rules and exits 0 when clean, 1 with findings and 2 when it could not run.

---

_Adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (`constraint-driven-development`) - MIT License, Copyright (c) 2025 Addy Osmani. See the original repository for the full license text._
