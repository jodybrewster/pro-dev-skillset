---
name: /gstack-document-generate
id: gstack-document-generate
category: Development
description: "Generate missing documentation from scratch for a feature, module, or entire project."
---

Run the GStack `document-generate` workflow through the local `pro-gstack` adapter.

**Input**: Use the arguments after `/gstack-document-generate` as the workflow request, URL, file reference, plan, diff, or context.

**Adapter rules**:

- Read the matching adapter skill at `skills/gstack-document-generate/SKILL.md`.
- Use the vendored upstream source at `upstream/gstack/document-generate/SKILL.md` as reference material for the workflow intent, specialist role, review criteria, and output format.
- Do not expose or invoke the unprefixed upstream command name. This command is intentionally namespaced as `/gstack-document-generate`.
- Do not run upstream setup, telemetry, update-check, gbrain sync, browser daemon, hook installation, or shell preamble code unless the user explicitly asks to install or run native GStack.
- Translate upstream host-specific tools to the tools available in the current session. Ask direct clarifying questions when an interactive checkpoint is required.
- Keep artifacts, recommendations, and code edits scoped to the current repo unless the user requests otherwise.

