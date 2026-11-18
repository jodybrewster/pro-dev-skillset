---
description: The user asks in plain words for an Elephant-Goldfish step (design versus code drift report). egm-bridge should fire and the reply should point to /pro-egm:drift or the install line when egm@egm is missing. The command is named in the skill text so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold.
expected_outcome: The Skill tool loads egm-bridge and the reply sends the user to /pro-egm:drift or to /pro-dev install.
tags: [skill:egm-bridge, command:drift]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Compare the checked-in design in docs/designs against the actual code and tell me where they have drifted. Report only, change nothing.
