---
description: "The user asks in plain words for an implementation plan for the accepted due-dates spec. The plan command should fire and write plan.md beside the spec. Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit."
expected_outcome: "The /plan command runs and intent/2026-01-05-due-dates/plan.md exists with steps that cite the R statements they satisfy and name the tests that prove them."
tags: [command:plan, needs:git]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill]
---

The due-dates spec in this repo is accepted. Can you work out how we should build it and write the plan down?
