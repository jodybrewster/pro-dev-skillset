---
name: /gstack-gstack-openclaw-retro
id: gstack-gstack-openclaw-retro
category: Development
description: "Weekly engineering retrospective. Analyzes commit history, work patterns, and code quality metrics with persistent history and trend tracking. Team-aware with per-person contributions, praise, and growth areas. Use when asked for weekly retro, what shipped this week, or engineering retrospective."
---

Run the GStack `gstack-openclaw-retro` workflow through the local `pro-gstack` adapter.

**Input**: Use the arguments after `/gstack-gstack-openclaw-retro` as the workflow request, URL, file reference, plan, diff, or context.

**Adapter rules**:

- Read the matching adapter skill at `skills/gstack-gstack-openclaw-retro/SKILL.md`.
- Use the vendored upstream source at `upstream/gstack/openclaw/skills/gstack-openclaw-retro/SKILL.md` as reference material for the workflow intent, specialist role, review criteria, and output format.
- Do not expose or invoke the unprefixed upstream command name. This command is intentionally namespaced as `/gstack-gstack-openclaw-retro`.
- Do not run upstream setup, telemetry, update-check, gbrain sync, browser daemon, hook installation, or shell preamble code unless the user explicitly asks to install or run native GStack.
- Translate upstream host-specific tools to the tools available in the current session. Ask direct clarifying questions when an interactive checkpoint is required.
- Keep artifacts, recommendations, and code edits scoped to the current repo unless the user requests otherwise.

