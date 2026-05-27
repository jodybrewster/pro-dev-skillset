---
name: "gstack-setup-browser-cookies"
description: "Import cookies from your real Chromium browser into the headless browse session. Use when the user asks for /gstack-setup-browser-cookies, GStack setup-browser-cookies, or this GStack-derived workflow."
---

# gstack-setup-browser-cookies

Follow `workflow.md`.

Key requirements:

- Preserve the upstream GStack workflow intent while adapting it to this repo and host.
- Use the prefixed local command/skill name; do not switch to the unprefixed upstream command name.
- Read any user-referenced files or folders completely before producing artifacts.
- Ask direct clarifying questions when upstream requires an interactive decision.
- Do not run native GStack setup, telemetry, update checks, gbrain sync, browser daemons, hook installation, or hard-coded shell preambles unless the user explicitly requests native GStack runtime behavior.
- Keep outputs concrete, complete, and free of placeholders.

