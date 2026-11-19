---
description: "The user asks in plain words for a review of the feature/top-priority branch before merging. The branch has one real bug (topPriority returns n-1 items) and one REVIEW.md breach (console.log in src/). Needs a scaffolded repo - run with --scaffold --allow-tools Bash."
expected_outcome: "The reply reports the off-by-one in topPriority and the console.log in src/priority.js, both as blocking."
tags: [command:review, agent:reviewer]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Bash, Skill, Agent]
---

I think the work on the feature/top-priority branch is ready. Can you go over it before I merge it into main?
