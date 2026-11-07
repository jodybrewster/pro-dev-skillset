---
id: PDS-50
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T13:56:55-0500
author: the maintainer
---

# Capability map: traceable change ids

Built from `intent.md` in this folder (commit 1242860).
Four modules, one spec each, planned and built one at a time in build order.
m1 lands first; m2, m3 and m4 each need the id m1 allocates and the `id:` line it writes.
A module's spec is accepted on its own; a later module may park with a reason written in its spec.
The decision every module follows is [ADR-0026](../../docs/decisions/0026-change-ids.md).

| id | module | purpose | plugins | depends on | build order |
|---|---|---|---|---|---|
| m1 | the id itself | `intent/project.json` with `{"shortcode": "PDS"}`, allocation in `/intent` and `/incident`, `id:` in the intent, spec and plan templates, every folder pattern widened to accept `PDS-n-slug`, the `change-ids` check, the backfill of every existing intent and the shortcode question in `/pro-dev install` | pro-ai-sdlc, pro-ship, pro-core, this repo | none | 1 |
| m2 | the id in git | stage branches `PDS-n/<stage>`, commit subjects `PDS-n: ...` and PR titles in `/spec`, `/plan`, `/execute` and `/auto`, plus a warn-mode PreToolUse hook on `git commit` keyed `mode.change-id` | pro-ai-sdlc, pro-ship | m1 | 2 |
| m3 | the id in records | an optional `change_id` on the pr-check stamp, the factory, deploy, incident and visual records and every review finding, documented in `docs/loop-records.md` and proved by `tests/mieruka-sync.mjs` | pro-ai-sdlc, pro-ship, this repo | m1 | 3 |
| m4 | the id in docs | roadmap rows, ADR Source lines, `/adr` and the roadmap convention name the id | pro-ai-sdlc, this repo | m1 | 4 |

Specs: [spec-m1.md](./spec-m1.md), [spec-m2.md](./spec-m2.md), [spec-m3.md](./spec-m3.md), [spec-m4.md](./spec-m4.md).
Plans: [plan-m1.md](./plan-m1.md), [plan-m2.md](./plan-m2.md), [plan-m3.md](./plan-m3.md), [plan-m4.md](./plan-m4.md).
