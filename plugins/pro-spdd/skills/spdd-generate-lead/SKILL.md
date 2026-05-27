---
name: "spdd-generate-lead"
description: "Generate code from a structured SPDD prompt file following the REASONS Canvas methodology. Use when the user asks for spdd-generate, SPDD generate, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-generate-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

