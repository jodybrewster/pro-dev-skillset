---
name: next-skills-bridge
description: Bridge to the official Next.js agent skills in vercel/next.js (MIT) - adopt or optimize Cache Components ("use cache", cacheLife, static shell, blocking-prerender errors), adopt or tune Partial Prefetching, cut client bundle and initial-load JavaScript, and verify a change against a running next dev. Use when the task is one of those in a Next.js App Router app. This is a BRIDGE (not vendored); the skills install via the /pro-dev command. For everyday App Router conventions use next-best-practices; for a version upgrade use next-upgrade.
---

# next-skills-bridge

This is a bridge, not a vendored skill.
The engine is the set of agent skills the Next.js team publishes in [vercel/next.js `skills/`](https://github.com/vercel/next.js/tree/canary/skills) (MIT).
They are installed with the [`npx skills add`](https://github.com/vercel-labs/skills) CLI and are deliberately not copied into this marketplace, so they update with Next.js itself.

## When to route here

Route to an upstream skill (install name in `code`) when the ask is:

- Turn on Cache Components (`cacheComponents: true`) and work through the blocking-route errors it surfaces -> `next-cache-components-adoption`.
- Grow a route's static shell, fix a slow first paint or a navigation that is not instant, or add `instant()` regression tests, once Cache Components is on -> `next-cache-components-optimizer`.
- Turn on Partial Prefetching (`partialPrefetching`, `export const prefetch = 'partial'`) and resolve its dev insights -> `next-partial-prefetching-adoption`.
- Decide what a link prefetches before the click, or choose between default, viewport and intent prefetching -> `next-partial-prefetching-optimizer`.
- Audit or reduce client bundles and initial-load work (oversized chunks, duplicate dependencies, code that can wait for interaction) -> `next-bundle-optimizer`.
- Confirm an edit works at runtime in a running `next dev`, not just that it compiles -> `next-dev-loop`.

Stay in pro-nextjs's own skills for everyday App Router conventions (`next-best-practices`), a version upgrade (`next-upgrade`) and shadcn/ui (`shadcn`).

## Skill catalog (install names)

| Install name | Use it for | Needs |
| --- | --- | --- |
| `next-cache-components-adoption` | Enable Cache Components and get the build passing | App Router, a runnable app |
| `next-cache-components-optimizer` | Grow the static shell, `instant()` tests per route | Next.js 16.3+, Cache Components on |
| `next-partial-prefetching-adoption` | Enable Partial Prefetching, resolve its insights | Next.js 16.3+, Cache Components on |
| `next-partial-prefetching-optimizer` | Tune what each link prefetches | Next.js 16.3+, both adopted |
| `next-bundle-optimizer` | Audit and reduce initial-load JavaScript | `next analyze` in the installed Next.js |
| `next-dev-loop` | Verify runtime behavior after an edit | A running `next dev` |

The upstream skills hand off to each other by these names, so installing all six is the default.

## How to use the bridge

1. Check whether the skill is installed.
   Upstream skills land in `.claude/skills/<install-name>/` (project scope) or `~/.claude/skills/<install-name>/` (user scope).
   - If present: follow that skill's `SKILL.md`.
   - If absent: tell the user this is a bridge and the skill is not installed, then run `/pro-dev install` (all six).

     The underlying command is `npx -y skills add https://github.com/vercel/next.js/tree/canary/skills -a claude-code -y`, with `-s <install-name>` added last for one skill.
     In the meantime, `next-best-practices` covers the basics and the Next.js docs are the reference.
2. Defer to the upstream skill for the work.
   Do not reimplement its steps here; the point of the bridge is that the skills track Next.js releases on their own cadence.

## Keeping the skills installed and current

Use the `/pro-dev` command (in pro-core):

- `/pro-dev check` - report which install names are present and where, and diff the catalog above against the live upstream tree.
- `/pro-dev install` - install all six.
- `/pro-dev update` - re-run the install; the newer files replace the older ones in place.

## Why a bridge, not a fork

pro-nextjs used to carry a `next-cache-components` skill adapted from vercel-labs/next-skills, a repository with no license file.
The Next.js team now publishes its skills under MIT inside vercel/next.js, so pro-nextjs points at them instead of copying.
The trade-off: the skills do not exist in a project until `/pro-dev install` has run there.

---

_Bridge to the Next.js agent skills in [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills) (MIT, Copyright (c) 2025 Vercel, Inc.). No upstream content is vendored here; this file is an original pointer and router. Install and license terms are governed by the upstream repo._
