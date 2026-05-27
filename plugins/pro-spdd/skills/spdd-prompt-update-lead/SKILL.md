---
name: "spdd-prompt-update-lead"
description: "Update an existing SPDD prompt file with new requirements or architectural changes while preserving the REASONS Canvas structure. Use when the user asks for spdd-prompt-update, SPDD prompt update, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-prompt-update-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

