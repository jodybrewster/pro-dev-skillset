---
description: "The user asks what a diff does, not for a review. The review command must not run in either arm. Needs a scaffolded repo - run with --scaffold --allow-tools Bash."
expected_outcome: "A plain explanation of the diff and no /review command fire."
tags: [quiet:command:review]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill]
---

Can you explain in plain words what the last commit on the feature/top-priority branch changes? I just want to understand it.
