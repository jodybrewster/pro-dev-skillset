---
name: "spdd-sync-lead"
description: "Sync code changes back to the structured SPDD prompt file following the REASONS Canvas methodology. Use when the user asks for spdd-sync, SPDD sync, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-sync-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

