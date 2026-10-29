---
description: "The user says a build just finished (uncommitted overdueTasks work in the tree) and asks for an independent confirmation that it works. The main session should hand that to the verifier agent. Needs a scaffolded repo - run with --scaffold --allow-tools Bash."
expected_outcome: "A Task call goes to the verifier agent, which runs npm test and reports what it saw."
tags: [agent:verifier]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Bash, Skill, Agent]
---

I just finished building overdueTasks from the due-dates spec. The changes are in the working tree and I have not committed them. Get an independent check on it with fresh eyes to see that it really works against the spec.
