---
name: "gstack-land-and-deploy"
description: "Land and deploy workflow. Use when the user asks for /gstack-land-and-deploy, GStack land-and-deploy, or this GStack-derived workflow."
---

# gstack-land-and-deploy

Follow `workflow.md`.

Key requirements:

- Preserve the upstream GStack workflow intent while adapting it to this repo and host.
- Use the prefixed local command/skill name; do not switch to the unprefixed upstream command name.
- Read any user-referenced files or folders completely before producing artifacts.
- Ask direct clarifying questions when upstream requires an interactive decision.
- Do not run native GStack setup, telemetry, update checks, gbrain sync, browser daemons, hook installation, or hard-coded shell preambles unless the user explicitly requests native GStack runtime behavior.
- Keep outputs concrete, complete, and free of placeholders.

