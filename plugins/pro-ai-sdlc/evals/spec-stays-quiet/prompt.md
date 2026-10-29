---
description: "The user asks what a spec is and how it differs from a plan. This is a question, so the spec command must not run in either arm. Needs a scaffolded repo - run with --scaffold --allow-tools Bash."
expected_outcome: "A short explanation and no /spec command fire."
tags: [quiet:command:spec]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill]
---

Quick question: what is a spec supposed to contain? How is it different from a plan?
