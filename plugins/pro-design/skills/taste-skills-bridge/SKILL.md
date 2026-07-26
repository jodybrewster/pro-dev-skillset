---
name: taste-skills-bridge
description: Bridge to the external Leonxlnx taste-skill library - anti-slop generation of landing pages, portfolios, and redesigns from a brief, plus aesthetic-family styles (brutalist, minimalist, soft/high-end), image-to-code, premium image-generation references (web + mobile), and brand kits. Use when the ask is to GENERATE a fresh marketing/portfolio surface that must not look templated, adopt a specific visual language, or produce design reference imagery. This is a BRIDGE (not vendored); the skills install via the /taste-skills command. For polishing an existing UI use pro-design's own taste-skill; for the comprehensive in-code craft engine use impeccable-bridge.
---

# taste-skills-bridge

This is a **bridge, not a vendored skill.** The engine is [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) (MIT) - a library of 13 frontend-design and image-generation skills installed with the [`npx skills add`](https://github.com/vercel-labs/agent-skills) CLI. That tree is **deliberately not copied into this marketplace** (~300 KB, self-updating with an iteratively-growing block library). pro-design's own skills handle focused facets and polish; this routes to the Leonxlnx library when the task is anti-slop generation, an aesthetic-family style, image-to-code, reference imagery, or a brand kit.

## When to route here

Route to a Leonxlnx skill (install name in `code`) when the ask is:

- **Generate an anti-slop landing page / portfolio / redesign** from a brief - reads the room, infers a direction, ships something that does not look templated -> `design-taste-frontend` (v2), or `design-taste-frontend-v1` for the legacy behavior, or `gpt-taste` when the model is GPT/Codex.
- **Adopt a specific visual language** -> `industrial-brutalist-ui` (Swiss/brutalist), `minimalist-ui` (editorial minimal), `high-end-visual-design` (calm, expensive, soft-contrast).
- **Audit + redesign an existing project** -> `redesign-existing-projects`.
- **Image-first flow** - generate design references, analyze, then implement -> `image-to-code`.
- **Premium reference imagery** -> `imagegen-frontend-web`, `imagegen-frontend-mobile`, or `brandkit` (logo/color/type/mockups).
- **Keep long outputs complete** (no placeholders / skipped sections) -> `full-output-enforcement`.
- **Google Stitch-compatible rules + DESIGN.md export** -> `stitch-design-taste`.

Stay in pro-design's own skills when the task is: polish an existing surface (`taste-skill`), a DESIGN.md reference (`stitch-skill`), tokens (`design-token`), a WCAG pass (`accessibility-audit`), a motion spec (`motion-system`/`motion`), a type scale (`typography-scale`), or shadcn/ui composition (`shadcn-ui-composition`). Use `impeccable-bridge` for the comprehensive, opinionated, whole-surface in-code craft pass.

## Skill catalog (install names)

| Install name | Use it for |
| --- | --- |
| `design-taste-frontend` | Anti-slop landing pages, portfolios, redesigns (v2, default) |
| `design-taste-frontend-v1` | Legacy v1 behavior, for projects pinned to it |
| `gpt-taste` | Stricter variant tuned for GPT / Codex models |
| `image-to-code` | Generate references first, analyze, then implement |
| `redesign-existing-projects` | Visual audit + cleaner redesign of an existing project |
| `high-end-visual-design` | Calm, expensive, soft-contrast interfaces |
| `minimalist-ui` | Editorial minimal product UI, tight hierarchy |
| `industrial-brutalist-ui` | Swiss typography, raw structure, hard contrast |
| `stitch-design-taste` | Google Stitch-compatible rules + DESIGN.md export |
| `full-output-enforcement` | Prevent placeholders / skipped / half-finished output |
| `imagegen-frontend-web` | Premium website reference images |
| `imagegen-frontend-mobile` | Premium mobile screen concepts + flows |
| `brandkit` | Brand-kit imagery: logo, color, type, mockups |

## How to use the bridge

1. **Check whether the skill is installed.** Leonxlnx skills land in `~/.claude/skills/<install-name>/` (user scope) or `.claude/skills/<install-name>/` (project scope).
   - **If present:** follow that skill's `SKILL.md`.
   - **If absent:** tell the user this is a bridge and the skill is not installed, then get it in place with **`/taste-skills install <install-name>`** (or all of them: `/taste-skills install`). Don't half-do the work here; offer the relevant focused pro-design skill in the meantime.
2. **Defer to the Leonxlnx skill for the actual work.** Do not reimplement its rules or the block library in this repo - the point of the bridge is that the upstream evolves on its own cadence.

## Keeping the skills installed and current

Use the **`/taste-skills`** command (in this plugin):

- `/taste-skills check` - report which install names are present, and where. Also diffs the local catalog table above against the live upstream repo and flags drift (upstream skills missing from this table, or local entries renamed/removed upstream).
- `/taste-skills install [name]` - `npx skills add https://github.com/Leonxlnx/taste-skill` (all), or `--skill "<name>"` for one.
- `/taste-skills update [name]` - re-run the install (the newer SKILL.md replaces the older in place).

## Why a bridge, not a fork

The Leonxlnx library is large, self-updating (its block library lands iteratively), and installs cleanly via `npx skills add`. Vendoring all 13 files the way pro-dev forks smaller skills would be heavy, drift-prone, and immediately stale. The bridge keeps `pro-design` light and gives the pro-dev lifecycle one discoverable entry point for the whole library.

---

_Bridge to [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) (MIT). No upstream content is vendored here - this file is an original pointer/router. Install and license terms are governed by the upstream repo._
