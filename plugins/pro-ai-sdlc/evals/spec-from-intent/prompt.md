---
description: "The user asks in plain words for the spec of the accepted due-dates intent in the repo. The spec command should fire and write spec.md beside the intent. Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit."
expected_outcome: "The /spec command runs and intent/2026-01-05-due-dates/spec.md exists with numbered, checkable requirements that each trace to the intent."
tags: [command:spec, needs:git]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill]
---

We accepted the due-dates intent in this repo. Please write up the spec for it so we can start planning.
