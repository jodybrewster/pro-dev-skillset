---
description: The user asks for typed IPC and a preload bridge in an Electron app without naming a skill. electron-skills-bridge should fire and the reply should point to the jwynia electron-best-practices skill or to /pro-dev install when it is missing.
expected_outcome: The Skill tool loads electron-skills-bridge and the reply names electron-best-practices or /pro-dev install and covers contextBridge with a typed channel list.
tags: [skill:electron-skills-bridge]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

I'm building an Electron app and the renderer calls ipcRenderer.invoke with string channels all over the place. How do I set up typed IPC between main and renderer with a preload script that only exposes what the UI needs?
