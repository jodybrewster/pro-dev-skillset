---
description: The user asks in plain words for an Elephant-Goldfish step (staged fresh-context review of docs/designs/export.md). egm-bridge should fire and the reply should point to /pro-egm:review or the install line when egm@egm is missing. The command is named in the skill text so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold.
expected_outcome: The Skill tool loads egm-bridge and the reply sends the user to /pro-egm:review or to /pro-dev install.
tags: [skill:egm-bridge, command:review]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Can I get a fresh-context review of docs/designs/export.md? Reviewers that have not seen my reasoning, staged, the Elephant-Goldfish way.
