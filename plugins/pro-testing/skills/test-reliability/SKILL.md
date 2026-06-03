---
name: test-reliability
description: >-
  Runtime per-test healing with evidence: multi-attribute selector healing,
  environment-aware diagnosis, flake classification, quarantine management, and
  confidence-scored auto-repair. Goes beyond simple locator fallbacks to cover
  action-level healing, data healing, and observable repair workflows. Use when:
  "flaky test," "test stability," "self-healing locator," "broken locator
  recovery," "unreliable test," "quarantine flaky test." Not for: bulk
  regenerating selectors after a planned UI refactor — use
  `selector-drift-recovery`. This skill heals ONE test at runtime; the other
  rewrites many tests offline.
  Related: playwright-automation, selector-drift-recovery, ci-cd-integration, qa-metrics, ai-qa-review.
---

# test-reliability

Follow `../../upstream/qa-skills/skills/test-reliability/SKILL.md` and any files it references.

- Adapt upstream tool names to the current session's capabilities.
- Do not run any upstream CLI bootstrap, install flow, or `.agents/` provisioning unless the user explicitly asks.
- Sibling QA skills the upstream doc points to live under `../../upstream/qa-skills/skills/` — consult them there even if they don't auto-trigger here.
- This skill heals ONE flaky test at runtime. For bulk selector regeneration after a planned UI refactor, the upstream `selector-drift-recovery` skill lives in `../../upstream/qa-skills/skills/`.

_Vendored from [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — MIT. See plugin `LICENSE` and `../../upstream/qa-skills/LICENSE`._
