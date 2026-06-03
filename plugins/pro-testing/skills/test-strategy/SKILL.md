---
name: test-strategy
description: >-
  Produce a multi-quarter QA strategy document. Covers scope, risk-based
  prioritization, test levels (unit/integration/E2E), pyramid analysis, entry/exit
  criteria, quality KPIs, tool selection rationale, and timeline planning. Output
  is an actionable strategy document, not a shelf document. Use when: "test
  strategy," "QA strategy doc," "testing approach," "QA roadmap." Not for: a
  single-sprint or single-release plan — use `test-planning`. Not for: identifying
  which areas carry the most risk — use `risk-based-testing` first.
  Related: risk-based-testing, qa-metrics, release-readiness, test-planning.
---

# test-strategy

Follow `../../upstream/qa-skills/skills/test-strategy/SKILL.md` and its `references/`.

- Adapt upstream tool names to the current session's capabilities.
- Do not run any upstream CLI bootstrap, install flow, or `.agents/` provisioning unless the user explicitly asks.
- Sibling QA skills the upstream doc points to live under `../../upstream/qa-skills/skills/` — consult them there even if they don't auto-trigger here.
- CROSS-REF: this is QA *test* strategy (levels, pyramid, entry/exit criteria, KPIs) — not product or spec planning. For product ideation use pro-pdd; for client spec decomposition use pro-spdd. Run `risk-based-testing` first; for a single sprint/release use `test-planning`.

_Vendored from [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — MIT. See plugin `LICENSE` and `../../upstream/qa-skills/LICENSE`._
