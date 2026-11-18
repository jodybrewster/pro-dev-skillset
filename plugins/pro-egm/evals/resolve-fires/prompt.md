---
description: The user asks in plain words for an Elephant-Goldfish step (triage of goldfish_review_report.md). egm-bridge should fire and the reply should point to /pro-egm:resolve or the install line when egm@egm is missing. The command is named in the skill text so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold.
expected_outcome: The Skill tool loads egm-bridge and the reply sends the user to /pro-egm:resolve or to /pro-dev install.
tags: [skill:egm-bridge, command:resolve]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

The review finished and wrote goldfish_review_report.md. Help me triage those findings and decide which to accept for docs/designs/export.md.
