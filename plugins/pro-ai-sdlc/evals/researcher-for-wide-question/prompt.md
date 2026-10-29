---
description: "The user asks how a flow runs across many files. The main session should hand the exploration to the researcher agent. Needs a scaffolded repo - run with --scaffold --allow-tools Bash."
expected_outcome: "A Task call goes to the researcher agent and the reply explains the flow with file references."
tags: [agent:researcher]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Bash, Skill, Agent]
---

I am new to this repo. Walk me through everything that happens from the moment a task is added until it shows up in the listing. Tell me every file involved and where input gets validated.
