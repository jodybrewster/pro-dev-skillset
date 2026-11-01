---
source: planning-session
kind: bug
status: accepted
risk: medium
outcome: O6
opportunity: pro-nextjs ships three skills adapted from vercel-labs/next-skills, a repository that never carried a license file
created: 2026-10-16
author: the maintainer
---

# Intent: pro-nextjs bridges the MIT Next.js skills instead of carrying unlicensed text

## Problem

`next-best-practices`, `next-upgrade` and `next-cache-components` in pro-nextjs were adapted from [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills).
That repository never had a license file, and it now holds only a README that says the skills moved to [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills).
The `docs/licenses.md` rows for the three skills are open for that reason.

## Decision

The maintainer decided on 2026-10-16 that pro-nextjs bridges the MIT skills in vercel/next.js and installs them at install time, the way pro-testing bridges qa-skills and pro-design bridges the design libraries.

## Upstream evidence, read on 2026-10-16

- `gh api repos/vercel/next.js/license --jq '.license.spdx_id'` prints `MIT`; the copyright line is `Copyright (c) 2025 Vercel, Inc.`
- `skills/` in vercel/next.js (branch canary) holds six skills: `next-bundle-optimizer`, `next-cache-components-adoption`, `next-cache-components-optimizer`, `next-dev-loop`, `next-partial-prefetching-adoption` and `next-partial-prefetching-optimizer`, plus a `.claude-plugin/plugin.json` named `nextjs`.
- None of our three slugs ever lived there: the commit history of `skills/next-best-practices`, `skills/next-upgrade` and `skills/next-cache-components` in vercel/next.js is empty.
- The skills left vercel-labs/next-skills in `ae552b1` ("Remove Next.js skills (moved to vercel/next.js)"); `dc1de9c` is the last commit that still has them.
- `npx -y skills add https://github.com/vercel/next.js/tree/canary/skills -a claude-code -y` (skills CLI 1.7.2) installed all six into `.claude/skills/` of a fresh temp directory in 27 seconds, with their `references/` and template sidecars, and wrote a `skills-lock.json` pointing at `vercel/next.js` ref `canary`.
  Adding `-s next-dev-loop` installed that one skill only.

## How close the old skills are to upstream, and what follows

- `next-cache-components` covers the same ground as the two upstream cache-components skills, and 150 of its 282 non-blank lines match the unlicensed source verbatim (headings, code samples and the migration table).
  It is removed; `next-cache-components-adoption` and `next-cache-components-optimizer` take its place through the bridge.
- `next-best-practices` and `next-upgrade` have no upstream counterpart.
  Their verbatim overlap with the unlicensed source is small (section headings, one sentence and two shell commands), so they stay, rewritten section by section from the MIT Next.js documentation with a doc page cited per section and a footer naming that source.

## Proposed outcome

pro-nextjs carries no text from vercel-labs/next-skills.
`next-skills-bridge` routes Cache Components, Partial Prefetching, bundle and dev-loop work to the upstream skills and `/next-skills` installs them non-interactively.
The pro-nextjs LICENSE and `docs/licenses.md` record the Next.js docs (MIT, Copyright (c) 2025 Vercel, Inc.) as the source of the two rewritten skills and the bridge as the route to the upstream skills.

## Risk

Medium.
Anyone relying on `next-cache-components` loses it on update until they run `/next-skills install`; the bridge says so and names the command.
The upstream skills target Next.js 16.3 and later, so older apps get less from the bridge than they did from the old skill.
