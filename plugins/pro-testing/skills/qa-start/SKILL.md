---
name: qa-start
description: >-
  Launcher that bootstraps QA on a brand-new project. Chains qa-project-context →
  test-strategy → test-planning in one guided sequence. Use when: "set up QA on a
  new project," "QA from scratch," "no QA exists yet," "/qa-start." Not for:
  onboarding a QA engineer to an existing codebase — use `qa-project-bootstrap`.
  Related: qa-project-context, test-strategy, test-planning, qa-project-bootstrap.
---

# qa-start

Follow `../../upstream/qa-skills/skills/qa-start/SKILL.md` and any files it references.

- Adapt upstream tool names to the current session's capabilities.
- Do not run any upstream CLI bootstrap, install flow, or `.agents/` provisioning unless the user explicitly asks.
- Sibling QA skills the upstream doc points to live under `../../upstream/qa-skills/skills/` — consult them there even if they don't auto-trigger here.
- This chains `qa-project-context` → `test-strategy` → `test-planning`, all exposed here. For onboarding to an existing codebase, the upstream `qa-project-bootstrap` skill lives in `../../upstream/qa-skills/skills/`.

_Vendored from [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — MIT. See plugin `LICENSE` and `../../upstream/qa-skills/LICENSE`._
