---
name: "spdd-reverse-lead"
description: "Reverse-engineer existing code into a REASONS-Canvas structured prompt, enabling the SPDD bidirectional sync workflow for previously unspecified implementations. Use when the user asks for spdd-reverse, SPDD reverse, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-reverse-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

