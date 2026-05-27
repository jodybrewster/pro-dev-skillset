---
name: /gstack-browse
id: gstack-browse
category: Development
description: "Fast headless browser for QA testing and site dogfooding."
---

Run the GStack `browse` workflow through the local `pro-gstack` adapter.

**Input**: Use the arguments after `/gstack-browse` as the workflow request, URL, file reference, plan, diff, or context.

**Adapter rules**:

- Read the matching adapter skill at `skills/gstack-browse/SKILL.md`.
- Use the vendored upstream source at `upstream/gstack/browse/SKILL.md` as reference material for the workflow intent, specialist role, review criteria, and output format.
- Do not expose or invoke the unprefixed upstream command name. This command is intentionally namespaced as `/gstack-browse`.
- Do not run upstream setup, telemetry, update-check, gbrain sync, browser daemon, hook installation, or shell preamble code unless the user explicitly asks to install or run native GStack.
- Translate upstream host-specific tools to the tools available in the current session. Ask direct clarifying questions when an interactive checkpoint is required.
- Keep artifacts, recommendations, and code edits scoped to the current repo unless the user requests otherwise.

