---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T14:00:00-0500
author: the maintainer
---

# Capability map: guard hardening

Built from `intent.md` in this folder, written in the same commit.
Three modules, one spec and one plan each, planned and built one at a time in build order because they share the intent's branch name.
Each module is its own pull request with its own version bumps.

| id | module | purpose | roadmap items | plugins | depends on | build order |
|---|---|---|---|---|---|---|
| m1 | protected push and the staged-secret line | close the push holes in `git-safe.py` and stop `/ship` printing staged secrets; one file each, the highest need | 32, 40 | pro-core, pro-ship | none | 1 |
| m2 | secret read | a secret-read guard on Read, Grep and Bash plus `env-check.py` | 33 | pro-core | m1 (the shared guard helper and `tests/guards.mjs`) | 2 |
| m3 | key literals and delete outside | a key-literal guard on Edit, Write and MultiEdit and a delete-outside guard on Bash | 34, 43 | pro-security, pro-core | m1 (the guard helper, its parser and `tests/guards.mjs`); built after m2 because they share the intent's branch name | 3 |

Specs: [spec-m1.md](./spec-m1.md), [spec-m2.md](./spec-m2.md), [spec-m3.md](./spec-m3.md).
Plans: [plan-m1.md](./plan-m1.md), [plan-m2.md](./plan-m2.md), [plan-m3.md](./plan-m3.md).
