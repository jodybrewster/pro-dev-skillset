---
description: The user asks in plain words for an Elephant-Goldfish step (egm-lite protocol for a small change). egm-bridge should fire and the reply should point to /pro-egm:lite or the install line when egm@egm is missing. The command is named in the skill text so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold.
expected_outcome: The Skill tool loads egm-bridge and the reply sends the user to /pro-egm:lite or to /pro-dev install.
tags: [skill:egm-bridge, command:lite]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Small bug: lastN in src/last.js returns one item too many. Use the lightweight Elephant-Goldfish protocol for a small change to fix it.
