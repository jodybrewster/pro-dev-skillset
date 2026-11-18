---
description: The user asks in plain words for an Elephant-Goldfish step (design doc from concepts_brief.md). egm-bridge should fire and the reply should point to /pro-egm:draft or the install line when egm@egm is missing. The command is named in the skill text so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold.
expected_outcome: The Skill tool loads egm-bridge and the reply sends the user to /pro-egm:draft or to /pro-dev install.
tags: [skill:egm-bridge, command:draft]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

There is a concepts_brief.md in the repo. Turn it into a proper design doc for me, using the Elephant-Goldfish workflow.
