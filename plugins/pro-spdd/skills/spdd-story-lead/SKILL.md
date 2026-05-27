---
name: "spdd-story-lead"
description: "Decompose high-level feature requirements into INVEST-compliant, business-focused stories with clear scope boundaries and testable acceptance criteria. Use when the user asks for spdd-story, SPDD story, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-story-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

