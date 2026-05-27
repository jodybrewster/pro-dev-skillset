---
name: "gstack-design-consultation"
description: "Design consultation: understands your product, researches the landscape, proposes a complete design system (aesthetic, typography, color, layout, spacing, motion), and generates font+color preview... Use when the user asks for /gstack-design-consultation, GStack design-consultation, or this GStack-derived workflow."
---

# gstack-design-consultation

Follow `workflow.md`.

Key requirements:

- Preserve the upstream GStack workflow intent while adapting it to this repo and host.
- Use the prefixed local command/skill name; do not switch to the unprefixed upstream command name.
- Read any user-referenced files or folders completely before producing artifacts.
- Ask direct clarifying questions when upstream requires an interactive decision.
- Do not run native GStack setup, telemetry, update checks, gbrain sync, browser daemons, hook installation, or hard-coded shell preambles unless the user explicitly requests native GStack runtime behavior.
- Keep outputs concrete, complete, and free of placeholders.

