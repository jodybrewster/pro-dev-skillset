---
description: The user asks whether their Electron app is safe to ship without naming a skill. electron-security-audit should fire and the reply should flag the planted faults in main.js with file and line. Needs a scaffolded app - run with --scaffold.
expected_outcome: The Skill tool loads electron-security-audit and the reply lists nodeIntegration, contextIsolation off, sandbox off, the unchecked shell.openExternal and the missing CSP with main.js line numbers.
tags: [skill:electron-security-audit]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Bash, Skill]
---

Before we ship this Electron app, can you go through its security setup and tell me what is wrong? I want a checklist I can work from.
