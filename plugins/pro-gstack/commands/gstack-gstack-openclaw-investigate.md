---
name: /gstack-gstack-openclaw-investigate
id: gstack-gstack-openclaw-investigate
category: Development
description: "Use when asked to debug, fix a bug, investigate an error, or do root cause analysis, and when users report errors, stack traces, unexpected behavior, or say something stopped working."
---

Run the GStack `gstack-openclaw-investigate` workflow through the local `pro-gstack` adapter.

**Input**: Use the arguments after `/gstack-gstack-openclaw-investigate` as the workflow request, URL, file reference, plan, diff, or context.

**Adapter rules**:

- Read the matching adapter skill at `skills/gstack-gstack-openclaw-investigate/SKILL.md`.
- Use the vendored upstream source at `upstream/gstack/openclaw/skills/gstack-openclaw-investigate/SKILL.md` as reference material for the workflow intent, specialist role, review criteria, and output format.
- Do not expose or invoke the unprefixed upstream command name. This command is intentionally namespaced as `/gstack-gstack-openclaw-investigate`.
- Do not run upstream setup, telemetry, update-check, gbrain sync, browser daemon, hook installation, or shell preamble code unless the user explicitly asks to install or run native GStack.
- Translate upstream host-specific tools to the tools available in the current session. Ask direct clarifying questions when an interactive checkpoint is required.
- Keep artifacts, recommendations, and code edits scoped to the current repo unless the user requests otherwise.

