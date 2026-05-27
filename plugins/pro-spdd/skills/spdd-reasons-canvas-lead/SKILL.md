---
name: "spdd-reasons-canvas-lead"
description: "Generate REASONS-Canvas structured prompts from business context without external template. Use when the user asks for spdd-reasons-canvas, SPDD reasons canvas, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-reasons-canvas-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

