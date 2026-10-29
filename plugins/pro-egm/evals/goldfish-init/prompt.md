---
description: Run /pro-egm:goldfish init in a fresh git repo. It should write .egm/goldfish.json naming the starter reviewers. The command is named in the prompt so the no-plugin arm is meaningless; read this case single arm (--ablation none). Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit. The eval sandbox blocks git, so the prompt tells the model to pass --repo.
expected_outcome: .egm/goldfish.json exists and lists zoom_out, design_critic and the policy and scope persona paths under spec. It lists implementation_readiness, codebase_details and the scope persona under plan.
tags: [command:goldfish]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit, Skill]
---

/pro-egm:goldfish init

The eval sandbox blocks git, so if goldfish.py says it is not inside a git repo, run it again with --repo set to the current directory.
