---
description: "The user asks for a one-line typo fix. The intent command must not run in either arm. Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit."
expected_outcome: "The typo in README.md is fixed directly and no /intent command fires."
tags: [quiet:command:intent]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill]
---

There is a typo in README.md, 'recieve' should be 'receive'. Fix it.
