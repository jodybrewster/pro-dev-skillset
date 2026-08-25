---
name: tastemaker-bridge
description: Bridge to codeswithroh/tastemaker, a 70-file script-driven engine for grounding UI in real pixels. Use it when the user supplies an actual reference image, screenshot, Pinterest or Dribbble pin, or URL to extract the look from - Python scripts pull palettes, tokens, and contrast from the image itself rather than a lossy text summary - or when a project needs a style lock that keeps every screen consistent via .tastemaker/style-lock.md. Fires on match this reference exactly, extract the look of, study this design, why does this look AI-generated, lock the style, give me comps. A named brand style or style recipe with no image supplied, such as in the style of Linear or Apple, belongs to web-design-engineer-bridge instead. This is a BRIDGE (not vendored); install via the /design-skills command. Use taste-skills-bridge for aesthetic-family generation and image gen, taste-skill for a quick polish, impeccable-bridge for the full craft engine, screen-critique for a critique without the tastemaker gates.
---

# tastemaker-bridge

This is a **bridge, not a vendored skill.**
The engine is [`tastemaker`](https://github.com/codeswithroh/tastemaker) (MIT, copyright 2026 codeswithroh) - 70 files, about 620 KB, made up of Python scripts, a references tree, CSS/JS asset kits, and a vendored `ideagram` illustration sub-skill.
That tree is **deliberately not copied into this marketplace**.
pro-design's own skills cover focused facets and polish; this routes to `tastemaker` when the work has to be grounded in real pixels and stay consistent across a whole project.

What the upstream skill actually does:

- **Grounds in real pixels, not descriptions.** When the user supplies references, `scripts/extract_palette.py` pulls deterministic dominant colors, contrast ratios, and lightness stats from the actual image, and `scripts/check_contrast.py` verifies the role assignment. Text-mediated style transfer is lossy, and that is most of why AI-built UI looks generic even when the prompt was specific.
- **Generates instead of picking from a fixed set.** With no reference, `scripts/generate_palette.py --mood <mood>` produces a new, legible-by-construction palette per run, so two similar projects do not come out identical.
- **Remembers.** It writes `.tastemaker/style-lock.md` (plus a structural `log.json` and a decisions log) so every later screen reuses the same tokens rather than re-deriving them, and keeps `~/.tastemaker/profile.md` as a cross-project taste profile.
- **Diversifies structure, not only color.** It rotates macrostructure and component archetypes against project memory, because the hero/three-cards/testimonial/CTA rhythm is the strongest page-level "an AI built this" tell.
- **Runs anti-slop gates** through `scripts/anti_slop_scan.py` and `scripts/audit_motion.py`, alongside asset scripts (`fetch_photos.py`, `fetch_icons.py`, `recolor_svg.py`, `export_favicons.py`).

It has four modes: `build` (the default), `study` (extract reusable DNA from a design you admire), `audit` (score existing UI against the anti-slop gate list without editing), and `comps` (reference comps and a brief, handed to your own image generator).

## When to route here

Route to `tastemaker` when the ask is:

- **"Match this reference image / Pinterest board / Dribbble shot exactly"** - the pixels matter, not a paraphrase of the vibe.
- **"Extract the look of X"** or **"study this design"** - pull the reusable DNA out of a screenshot or URL.
- **"Why does this look AI-generated?"** or a complaint that the UI is generic, cookie-cutter, or like every other SaaS site.
- **"Keep the style consistent across all screens"** / **"lock the style"** - the style lock is the whole point.
- **"Give me comps"** - structured comp briefs before committing to code.
- A PRD or spec that needs a design pass scoped to the real screen list before implementation.

Route elsewhere when:

- The ask is **aesthetic-family generation or reference imagery** (brutalist, minimalist, high-end, brand kits, image gen) -> `taste-skills-bridge`.
- The ask is a **quick polish pass** on an existing surface -> `taste-skill`.
- The ask is the **comprehensive in-code craft engine** -> `impeccable-bridge`.
- The ask is a **structured critique** without the tastemaker gates and scripts -> `screen-critique` (or `/critique-screen`).

## Skill catalog (install names)

| Install name | Use it for |
| --- | --- |
| `tastemaker` | The engine: reference-grounded UI generation, style lock, study/audit/comps modes |
| `ideagram` | Concept-to-illustration sub-skill; it rides along inside the `tastemaker` folder, no separate install |

## How to use the bridge

1. **Check whether the skill is installed.**
   It lands in `~/.claude/skills/tastemaker/` (user scope) or `.claude/skills/tastemaker/` (project scope), with `references/`, `scripts/`, `assets/`, and `ideagram/` inside it.
   If any of those subfolders is missing, the install is broken and the skill will not work - reinstall rather than working around it.
   - **If present:** follow that skill's `SKILL.md`.
     Read it top to bottom before starting; it is short by design and the reference files are only worth opening when a step calls for them.
   - **If absent:** tell the user this is a bridge and the engine is not installed, then get it in place with **`/design-skills install tastemaker`**.
     Do not half-do the work here.
     Offer a focused pro-design skill in the meantime if the user wants to keep moving.
2. **Defer to the upstream skill for the actual work.**
   Do not reimplement its scripts, gates, or reference tree in this repo.

**Runtime prerequisites.**
The scripts need **Python 3**, and Pillow for the image-reading paths (`extract_palette.py` in particular).
Check for both before promising a reference-extraction run.
Without Python the palette generator, contrast matrix, and anti-slop scan are all unavailable, which removes the reason to use this skill over a text-only one.

## Keeping it installed and current

Use the **`/design-skills`** command (in this plugin):

- `/design-skills check tastemaker` - report presence and scope, and diff the local catalog against the live upstream.
- `/design-skills install tastemaker` - install the engine with `ideagram` and the script/reference tree intact.
- `/design-skills update tastemaker` - re-run the install; the newer files replace the older ones in place.

## Why a bridge, not a fork

`tastemaker` is 70 files of Python, reference prose, and asset kits, and it carries a second skill inside it.
Vendoring it the way pro-dev forks smaller single-file skills would mean maintaining someone else's scripts, their security guard rails, and their illustration library on our release cadence.
The bridge keeps `pro-design` light and lets the upstream evolve on its own.

---

_Bridge to [codeswithroh/tastemaker](https://github.com/codeswithroh/tastemaker) (MIT). No upstream content is vendored here - this file is an original pointer/router. Install and license terms are governed by the upstream repo._
