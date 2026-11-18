---
description: The user asks in plain words for an Elephant-Goldfish step (brainstorm an idea into concepts_brief.md). egm-bridge should fire and the reply should point to /pro-egm:brainstorm or the install line when egm@egm is missing. The command is named in the skill text so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold.
expected_outcome: The Skill tool loads egm-bridge and the reply sends the user to /pro-egm:brainstorm or to /pro-dev install.
tags: [skill:egm-bridge, command:brainstorm]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

I have a rough idea for an app where tenants book the shared laundry room in our building. Can you interview me about it until we have a proper concepts brief?
