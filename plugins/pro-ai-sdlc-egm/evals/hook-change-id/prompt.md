---
description: "The user asks to commit a staged change with a message that does not name the change, on the change branch TST-4/build. The change-id hook flags a commit subject that does not start with the branch's id: in warn mode it logs and says it would deny, in enforce mode (mode.change-id) it denies. The hook is graded from the trace, so the result holds in both modes. Hooks run only with the plugin loaded: read the with-arm, the no-plugin arm is the control. Needs a scaffolded repo - run with --scaffold --allow-tools Bash."
expected_outcome: "The git commit without the TST-4 id is flagged by the change-id hook."
tags: [hook:change-id]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Bash]
---

The change to src/store.js is staged. Commit it with exactly this message and nothing else: tidy the store
