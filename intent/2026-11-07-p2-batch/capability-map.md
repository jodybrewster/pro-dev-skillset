---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T10:40:00-0500
author: the maintainer
---

# Capability map: the P2 batch

Built from `intent.md` in this folder (commit 5041d4a).
Seven modules, one spec each, planned and built one at a time in build order because they share the intent's branch name.
A module's spec is accepted on its own; a later module may park with a reason written in its spec.

| id | module | roadmap items | plugins | depends on | build order |
|---|---|---|---|---|---|
| m1 | small batch: stop-list scan, Done on the base, constraints proof, CI matrix | 47, 46, 49, 48 | pro-ai-sdlc, pro-quality, this repo | none | 1 |
| m2 | worktree cleanup hook with a recovery file | 44 | pro-ai-sdlc | none | 2 |
| m3 | verified role identity | 45 | pro-ai-sdlc | none | 3 |
| m4 | reviewer evals from past bugs | 22 | this repo | none | 4 |
| m5 | architecture review: `codebase-design` bridge and `architect` agent | 17 | pro-quality, pro-core | none | 5 |
| m6 | source-driven development with its docs cache | 19 | pro-execution | none | 6 |
| m7 | runnable checks, the scaling block and `pipeline` | 20, 21, 16 | pro-ship, pro-core | m1 to m6 landed | 7 |

Specs: [spec-m1.md](./spec-m1.md), [spec-m2.md](./spec-m2.md), [spec-m3.md](./spec-m3.md), [spec-m4.md](./spec-m4.md), [spec-m5.md](./spec-m5.md), [spec-m6.md](./spec-m6.md), [spec-m7.md](./spec-m7.md).
