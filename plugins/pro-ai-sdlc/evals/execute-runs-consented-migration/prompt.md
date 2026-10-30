---
description: "The user names /pro-ai-sdlc:execute on an approved plan whose step 2 writes db/migrations/001_due_dates.sql while its Risks section names migrations and the header names an approver. The command must treat the step as consented and go on without pausing for a yes. Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit."
expected_outcome: "The run says the migrations step was consented in Risks and goes on; it never asks whether to build the migration step."
tags: [command:execute, needs:git]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill, Agent]
---

/pro-ai-sdlc:execute intent/2026-01-05-due-dates/plan.md
