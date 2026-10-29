---
description: The user asks for a Goldfish review of the spec in the repo. egm-bridge should fire and the reply should point to /pro-egm:goldfish or the install line when egm@egm is missing. The command is named in the skill text so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold.
expected_outcome: The Skill tool loads egm-bridge and the reply sends the user to /pro-egm:goldfish docs/spec.md --stage spec or to /pro-dev install.
tags: [skill:egm-bridge]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Can you run a Goldfish review of docs/spec.md? I want fresh-context reviewers with no history to poke holes in it before I build anything.
