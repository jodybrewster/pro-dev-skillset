---
description: Prove a change actually works by running it and observing output — no completion claims without fresh verification evidence.
argument-hint: '[feature description]'
---

Use the `verification-before-completion` skill. Identify the verification command that proves `$ARGUMENTS` works (tests, build, manual run — whatever matches the claim). If `$ARGUMENTS` is empty, verify the most recent change in this session. Run the FULL command fresh, read the complete output, then report actual status with evidence. No "should work" — only "ran X, saw Y."
