---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T14:00:00-0500
author: the maintainer
---

# Capability map: reaching Done

Built from `intent.md` in this folder, committed with it.
Three modules, one spec each, planned and built one at a time in build order because they share the intent's branch name.
m1 lands first because m2 reads the review record that m1 adds.
m3 is independent of the other two but goes last so the board rerun sees the review fixes first.

| id | module | roadmap items | plugins | depends on | build order |
|---|---|---|---|---|---|
| m1 | review memory and findings checked against the code | 35, 39 | pro-ai-sdlc, pro-quality, pro-ship (the `/ship` review range only) | none | 1 |
| m2 | the reviewer's model in the review record and the pr-check stamp | 36 | pro-ship, pro-ai-sdlc, pro-quality | m1 (the review record) | 2 |
| m3 | a head-bound human confirmation and a readiness check in the `/ship` preflight | 37, 38 | pro-ship | none | 3 |

Specs: [spec-m1.md](./spec-m1.md), [spec-m2.md](./spec-m2.md), [spec-m3.md](./spec-m3.md).
Plans: [plan-m1.md](./plan-m1.md), [plan-m2.md](./plan-m2.md), [plan-m3.md](./plan-m3.md).
ADR: [ADR-0027](../../docs/decisions/0027-review-memory.md), drafted with m1.
