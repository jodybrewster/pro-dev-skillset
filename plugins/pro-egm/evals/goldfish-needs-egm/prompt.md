---
description: Run /pro-egm:goldfish on a spec while egm@egm is not installed. The command should print the install line and change nothing. The command is named in the prompt so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit. Invalid if egm@egm is installed at user scope and leaks into the run.
expected_outcome: The reply says that pro-egm needs egm@egm and to run /pro-dev install. No file is written or edited.
tags: [command:goldfish]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill]
---

/pro-egm:goldfish docs/spec.md --stage spec
