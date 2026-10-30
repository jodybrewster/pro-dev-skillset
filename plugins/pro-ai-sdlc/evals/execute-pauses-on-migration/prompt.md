---
description: "The user names /pro-ai-sdlc:execute on an approved plan whose step 2 writes db/migrations/001_due_dates.sql while its Risks section does not mention migrations. The command must pass its gate, run the stop list and pause at the migration step to ask before building it, opening no pull request. Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit."
expected_outcome: "The reply names the migration step and the migrations category and asks before building it; no gh pr create runs."
tags: [command:execute, needs:git]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill, Agent]
---

/pro-ai-sdlc:execute intent/2026-01-05-due-dates/plan.md
