---
name: web-design-engineer-bridge
description: Bridge to ConardLi/garden-skills web-design-engineer, a 39-file engine for browser-rendered visual artifacts - pages, dashboards, prototypes, HTML slide decks, data visualizations, animations. Carries 26 named style recipes with concrete palette, type, spacing, radius, shadow, and motion values (apple-hig, linear, vercel-mesh, stripe-press, raycast, dieter-rams-braun, bloomberg-terminal and about twenty more), so a request in the style of Apple, Linear, Vercel, Stripe or any named brand with no image supplied routes here. Grounds the work in real reference sites and grades it against a critique guide, scoring five dimensions so you can iterate to a target score. This is a BRIDGE (not vendored); install via the /design-skills command. Use impeccable-bridge for the craft pass inside an existing codebase, emil-design-eng for product UI components, landing-page-design for a conversion page, tastemaker-bridge only when the user supplies an actual reference image, screenshot, or URL, screen-critique to judge without building.
---

# web-design-engineer-bridge

This is a **bridge, not a vendored skill.**
The engine is [`web-design-engineer`](https://github.com/ConardLi/garden-skills/tree/main/skills/web-design-engineer) from [`ConardLi/garden-skills`](https://github.com/ConardLi/garden-skills) (MIT, copyright 2026 ConardLi) - 39 files, about 290 KB, versioned through its own `manifest.json` (1.3.0 at the time of writing).
That tree is **deliberately not copied into this marketplace**.
pro-design's own skills cover focused facets; this routes to `web-design-engineer` when the task is to produce a browser-rendered visual artifact at a "stunning, not merely functional" bar.

What the upstream skill actually does: it positions the agent as a top-tier design engineer, works the requirements through with the user before writing code (design read, five calibration dials, a declared design system, a v0 draft with explicit checkpoints), grounds the work in real reference material rather than inventing tokens, and scores the result across five dimensions so you can iterate to a target.
It ships 26 style recipes (`apple-hig`, `linear`, `vercel-mesh`, `stripe-press`, `raycast`, `dieter-rams-braun`, `muji-kenya-hara`, `pentagram`, `bloomberg-terminal`, `tufte-dataink`, and more) with concrete palette, type, spacing, radius, shadow, and motion values, plus reference files for critique, failure patterns, calibration, design directions, redesign protocol, a block library, and an optional browser acceptance harness that runs only when you explicitly ask for QA.

## When to route here

Route to `web-design-engineer` when the ask is:

- **A browser-rendered visual artifact** - landing page, dashboard, interactive prototype, HTML slide deck, data visualization, animation, UI mockup - and the bar is "stunning".
- **"Design this like a top design engineer" / "make this stunning"** rather than "make this work".
- **A named visual anchor** - "in the style of Apple", "Linear-style", "Vercel mesh", "Stripe Press", "MUJI quietness" - where a concrete recipe beats a vibe description.
- **Score or grade my design, then iterate** - the 5-dimension critique returns dimension scores, a Keep list, severity-sorted fixes, and quick wins, so a target score is a real loop.
- **"I don't know what style I want"** - the Design Direction Advisor proposes three directions from deliberately different schools instead of asking ten taste questions.
- **A redesign of an existing surface** where you need to classify the change as extension, preserve, or overhaul before touching anything.
- **Explicit browser acceptance / QA** of a web artifact across viewports.

Route elsewhere when:

- The work is an **opinionated end-to-end craft pass inside an existing codebase** -> `impeccable-bridge`.
- The work is **product UI components** (the built app, not a visual artifact) -> `emil-design-eng`.
- The work is a **conversion-focused landing page** -> `landing-page-design`.
- The work is **matching an exact reference image's pixels** -> `tastemaker-bridge`.
- The work is **judging a screen without building anything** -> `screen-critique` (or `/critique-screen`).

## Skill catalog (install names)

| Install name | Use it for |
| --- | --- |
| `web-design-engineer` | The engine this bridge routes to: browser-rendered visual artifacts, style recipes, design scoring, direction advice |

The same collection also ships `beautiful-article`, `web-video-presentation`, `gpt-image-2`, and `kb-retriever`, all installable through the same command if you want them.

## How to use the bridge

1. **Check whether the skill is installed.**
   It lands in `~/.claude/skills/web-design-engineer/` (user scope) or `.claude/skills/web-design-engineer/` (project scope).
   - **If present:** follow that skill's `SKILL.md`.
     Load only the one style recipe you picked, not the whole catalog, and read its `references/style-recipes/INDEX.md` first when browsing.
   - **If absent:** tell the user this is a bridge and the engine is not installed, then get it in place with **`/design-skills install garden web-design-engineer`**.
     Do not half-do the work here.
     Offer a focused pro-design skill in the meantime if the user wants to keep moving.
2. **Defer to the upstream skill for the actual work.**
   Do not reimplement its dials, recipes, critique rubric, or acceptance harness in this repo.
   The point of the bridge is that the upstream evolves on its own cadence.

No runtime prerequisites beyond a browser for previewing output.
The acceptance harness is optional and only runs when the user explicitly asks for QA.

## Keeping it installed and current

Use the **`/design-skills`** command (in this plugin):

- `/design-skills check garden` - report which install names from this collection are present and at which scope, and diff the local catalog against the live upstream.
- `/design-skills install garden web-design-engineer` - install just the engine.
- `/design-skills update garden` - re-run the install; the newer files replace the older ones in place.

## Why a bridge, not a fork

`web-design-engineer` is 39 files across a reference tree and a 26-file style-recipe catalog, versioned independently through its own `manifest.json`.
Vendoring it the way pro-dev forks smaller single-file skills would be heavy, drift-prone, and stale within a release or two.
The bridge keeps `pro-design` light and gives the pro-dev lifecycle one discoverable entry point for the whole engine.

---

_Bridge to [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) (MIT). No upstream content is vendored here - this file is an original pointer/router. Install and license terms are governed by the upstream repo._
