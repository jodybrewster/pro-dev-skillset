---
description: "A plan exists under intent/ and the user asks for a code change that does not touch it. The plan-sync Stop hook flags code changed with no plan.md touched: in enforce mode it blocks the first stop and the agent records a departure or says it followed the plan, in warn mode it only shows the user a message. Graded from the trace and on plan.md, so a warn-mode run may leave no trace: read it as a finding about the hook mode. Needs a scaffolded repo - run with --scaffold --allow-tools Bash Write Edit."
expected_outcome: "The plan-sync hook fires on stop and the agent addresses the plan."
tags: [hook:plan-sync]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Bash, Write, Edit]
---

Add a countTasks(store) function to src/tasks.js that returns how many tasks are in the store. Do not touch anything else.
