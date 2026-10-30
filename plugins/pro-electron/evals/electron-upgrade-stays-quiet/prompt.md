---
description: A Next.js major upgrade. electron-upgrade must stay at 0 fires in both arms; the Next.js upgrade skill owns this.
expected_outcome: The reply handles the Next.js upgrade and electron-upgrade never loads.
tags: [quiet:skill:electron-upgrade]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

We are on Next.js 14 and want to move to 15. What changes should I expect around async request APIs and caching and how should I order the upgrade?
