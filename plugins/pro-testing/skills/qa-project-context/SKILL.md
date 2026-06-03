---
name: qa-project-context
description: >-
  Set up your QA project context. Creates and fills .agents/qa-project-context.md
  with your tech stack, test frameworks, CI/CD pipeline, environments, coverage goals,
  risk areas, and team structure. Every other QA skill reads this file first to skip
  redundant questions and give context-aware recommendations. Use when: "set up QA context,"
  "configure testing," first use of any QA skill, "initialize project."
---

# qa-project-context

Follow `../../upstream/qa-skills/skills/qa-project-context/SKILL.md` and any files it references.

- Adapt upstream tool names to the current session's capabilities.
- This skill writes `.agents/qa-project-context.md` in the user's repo — only create or overwrite it when the user is setting up QA context. Do not auto-provision it as a side effect of another task.
- Sibling QA skills the upstream doc points to live under `../../upstream/qa-skills/skills/` — consult them there even if they don't auto-trigger here.

_Vendored from [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — MIT. See plugin `LICENSE` and `../../upstream/qa-skills/LICENSE`._
