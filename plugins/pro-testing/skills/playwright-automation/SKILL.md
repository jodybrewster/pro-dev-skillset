---
name: playwright-automation
description: >-
  Write production-grade Playwright tests in TypeScript: Page Object Model,
  fixtures, auto-waiting, user-facing locators, parallel execution, CI
  integration, visual testing, accessibility. Includes explicit "do not" list
  for AI agents and 2025-2026 feature awareness. Use when: "Playwright," "write
  E2E test," "page object," "browser test setup," "new Playwright suite." Not
  for: fixing individual flaky tests at runtime — use `test-reliability`. Not
  for: bulk regenerating selectors after a UI refactor — use
  `selector-drift-recovery`.
  Related: visual-testing, ci-cd-integration, api-testing, test-reliability, selector-drift-recovery, accessibility-testing.
---

# playwright-automation

Follow `../../upstream/qa-skills/skills/playwright-automation/SKILL.md` and its `references/`.

- Adapt upstream tool names to the current session's capabilities.
- Do not run any upstream CLI bootstrap, install flow, or `.agents/` provisioning unless the user explicitly asks.
- Sibling QA skills the upstream doc points to live under `../../upstream/qa-skills/skills/` — consult them there even if they don't auto-trigger here. `test-reliability` is exposed; `selector-drift-recovery` lives in `upstream/`.
- Durability axis: use `playwright-automation` for a **committed, typed, CI-run regression suite**. For ad-hoc, interactive, one-off browser verification of a running app, use `agent-browser` instead.

_Vendored from [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — MIT. See plugin `LICENSE` and `../../upstream/qa-skills/LICENSE`._
