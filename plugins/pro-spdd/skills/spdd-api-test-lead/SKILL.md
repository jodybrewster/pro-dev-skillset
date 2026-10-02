---
name: "spdd-api-test-lead"
description: "Generate a self-contained shell script with cURL commands to test API endpoints based on generated code and acceptance criteria. Use when the user runs /spdd-api-test or asks for SPDD api test, or the corresponding Structured Prompt-Driven Development phase."
---

# spdd-api-test-lead

Follow the workflow in `workflow.md`.

Key requirements:

- Preserve OpenSPDD artifact conventions unless the user explicitly asks otherwise.
- Read all referenced `@file` and `@folder` inputs completely before producing artifacts.
- Do not skip required input validation gates.
- Keep outputs concrete, complete, and free of placeholders.
- Do not generate implementation code unless the referenced workflow explicitly requires generation.

