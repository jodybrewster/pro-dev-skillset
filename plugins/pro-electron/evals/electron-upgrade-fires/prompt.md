---
description: The user asks to move an Electron app two majors forward. electron-upgrade should fire and the reply should plan one major per hop, read the breaking changes per hop and rebuild native modules.
expected_outcome: The Skill tool loads electron-upgrade and the reply plans hop by hop with a breaking-changes read, an @electron/rebuild step and a verify and commit per hop.
tags: [skill:electron-upgrade]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Our desktop app is on Electron 43 and we want to be on 45. It uses better-sqlite3. Can you lay out how you would do the upgrade?
