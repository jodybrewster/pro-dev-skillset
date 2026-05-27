---
name: "spdd-analysis-lead"
description: "Analyze business requirements against codebase context at a strategic level, producing enriched context (business + domain concepts + strategic direction + risks) for REASONS Canvas generation. Use when the user asks for spdd-analysis, SPDD analysis, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-analysis-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

