---
name: "spdd-code-review-lead"
description: "Review AI-generated code against REASONS-Canvas structured prompts, detecting intent drift, safeguard violations, and scope boundary issues to reduce human reviewer cognitive load. Use when the user asks for spdd-code-review, SPDD code review, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-code-review-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

