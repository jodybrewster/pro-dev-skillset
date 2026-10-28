---
source: idea
kind: change
status: proposed
risk: medium
created: 2026-10-28T07:40:00-0400
author: Jody Brewster
---

# Intent: Hallmark, web-design-guidelines and Vercel skill bridges

Author: Jody Brewster (pro-dev-skillset).
Source: idea, intent D of the [pro-dev simplify umbrella](../2026-10-27-pro-dev-simplify/intent.md), items 8 to 12, from a research session on 2026-10-27.
Status: proposed.
Created: 2026-10-28.

## Problem

Jody asked whether the marketplace has UI/UX Pro Max, Hallmark, Emil Kowalski, shadcn or Vercel's web design guidelines, then whether Vercel's agent-skills are in pro-nextjs.
UI/UX Pro Max (now `impeccable-bridge`), Emil Kowalski and shadcn are here; Hallmark, web-design-guidelines and every vercel-labs/agent-skills skill are not.
Research on 2026-10-27 compared each candidate with the skills already shipped.

## Proposed outcome

Four bridges, each a registry row from intent B and no copied upstream text:

- Hallmark ([nutlope/hallmark](https://github.com/nutlope/hallmark), MIT) in pro-design, optional.
  It builds new marketing pages, deals themes, lints with a browser at eight widths and has a fresh-context review; it has no equivalent here.
  Route to it only when the person names Hallmark or explicitly picks it, never as the default for "build something new".
  Hand-off lines go in `taste-skills-bridge` (heavy overlap on anti-slop landing pages), `landing-page-design`, `impeccable-bridge` and `emil-design-eng`.
  `landing-page-design` stays: Hallmark has no conversion copy or SEO.
- web-design-guidelines (vercel-labs/agent-skills) in pro-design, default.
  A code-level `file:line` lint of UI code against Vercel's Web Interface Guidelines: forms, focus, hydration, safe areas, i18n.
  Boundary: this for the rule lint, `accessibility-audit` for WCAG conformance, `screen-critique` for how a screen looks.
- `vercel-skills-bridge` in pro-nextjs: react-best-practices, vercel-optimize, deploy-to-vercel and vercel-cli-with-tokens.
  A separate skill from `next-skills-bridge`, which points at a different repo.
  Bundle-only asks stay with `next-bundle-optimizer`.
- A stack-neutral React bridge, likely in pro-design: composition-patterns and react-view-transitions, which are plain React.
  `shadcn-ui-composition` gains a hand-off for non-shadcn component design.

Dropped: writing-guidelines (Vercel's docs house style clashes with Jody's writing rules) and react-native-skills (no mobile work here).

## Affected users and systems

pro-design and pro-nextjs, the engine registry, `docs/licenses.md`, routing cases in `tests/cases/routing.jsonl` and the descriptions of the skills that gain hand-off lines.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
vercel-labs/agent-skills has no license file, so its skills may only be bridged, never copied.
web-design-guidelines and writing-guidelines fetch their rules live from the `main` branch of MIT-licensed rules repos; nothing pins them.
Hallmark's browser checks need `puppeteer-core` and Chrome and quietly fall back to static checks without them; the bridge says so.
Hallmark's comp and image steps need a `TOGETHER_API_KEY`.

## Out of scope

Rewriting `landing-page-design` or the other overlapping skills beyond their hand-off lines.
React Native support.

## Success looks like

After `/pro-dev install` on a site with pro-design: "build a landing page" still routes to `landing-page-design`, "use Hallmark to build a landing page" routes to the Hallmark bridge and "lint this component against the web interface guidelines" routes to web-design-guidelines.
On a site with pro-nextjs: "deploy this to Vercel" routes to `vercel-skills-bridge`.
`node tests/eval.mjs` passes with new routing cases for each bridge.

## Open questions

- Security: vercel-cli-with-tokens handles Vercel access tokens; the bridge must say tokens come from the environment or a secret store, are never written to files, commands or logs, and are scoped to one team. The spec needs a security-architect challenge.
- Security: web-design-guidelines' live fetch is a remote-instruction channel, since the fetched text becomes the review prompt. Accept it, or pin a commit?
- Does Hallmark's "no eyebrows, 80-word hero" Floor contradict `landing-page-design` guidance anywhere that matters?
- Which plugin hosts the React bridge: pro-design or a new place?
- Needs intent B's registry; can ship alongside C and E once B lands.
