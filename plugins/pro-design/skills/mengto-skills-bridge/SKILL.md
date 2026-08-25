---
name: mengto-skills-bridge
description: Bridge to MengTo/Skills, a 130-skill technique library for scroll-driven and immersive web design - cinematic scroll storytelling, GSAP ScrollTrigger and Lenis motion systems, Three.js/WebGL scroll worlds, shader and particle backgrounds, cursor trails, dozens of named style recipes, plus workflow skills such as video-to-superprompt, which turns a screen recording into a prompt. Use when the ask names a scroll story, an immersive effect, a technique or style recipe from this collection, turning a reference video into a prompt, optimizing web animations, or Meng To by name. This is a BRIDGE (not vendored); install via the /design-skills command. build-awwwards-quality-sites (vendored here) is the principles layer, pro-motion's gsap and hyperframes are for hand-written timelines, animate for functional product UI motion.
---

# mengto-skills-bridge

This is a **bridge, not a vendored skill.**
The library is [`MengTo/Skills`](https://github.com/MengTo/Skills) (MIT, copyright 2026 Meng To) - 130 skills across roughly 890 files, laid out as `agent-skills/<group>/<name>/SKILL.md`.
That tree is **deliberately not copied into this marketplace**.
pro-design vendors exactly one skill from it, `build-awwwards-quality-sites`, which carries the principles.
This bridge routes to the rest, which is a technique library: each skill is a concrete recipe for one effect, one layout system, or one workflow.

The groups are `web-design` (90 skills: scroll storytelling, WebGL and shader effects, named style recipes, page archetypes), `codex` (19 workflow skills), `game-development` (21), `media` (2 asset skills), and `ui` (1).

## When to route here

Route to a MengTo skill (install name in `code`) when the ask is:

- **Scroll-based storytelling** - a page that narrates as you scroll, pins sections, scrubs a sequence, or builds a world.
- **Immersive or cinematic effects** - Three.js scenes, WebGL backgrounds, shaders, particles, dither, globes, cursor trails.
- **A named effect or style recipe from the collection** - "progressive blur", "masked reveal", "staggered word reveal", "beautiful shadows", "dark glass clean layout", "editorial tech", and so on.
- **Turning a screen recording or reference video into a prompt** -> `video-to-superprompt`, or `html-to-interaction-prompts` when the source is an existing page.
- **Optimizing or profiling web animations** -> `optimize-web-animations`, `performance-profiling`.
- **Meng To by name**, or a request that points at this collection directly.

Route elsewhere when:

- The ask is **what makes an award-quality site good** rather than how to build one effect -> `build-awwwards-quality-sites` (vendored in this plugin, the principles layer).
- The ask is to **hand-write a timeline** without a recipe -> `gsap` or `hyperframes` in `pro-motion`.
- The ask is **functional UI motion on a built product** (feedback, transitions, affordances) -> `animate`.
- The ask is a **whole-surface craft pass** -> `impeccable-bridge`.

## Skill catalog (representative install names)

The full list is in the [upstream README](https://github.com/MengTo/Skills) and `agent-skills/web-design/WEB-DESIGN-SKILLS.md`.
These are representative, grouped by theme.

| Theme | Install names |
| --- | --- |
| Storytelling and scroll | `cinematic-scroll-storytelling`, `scroll-world-storytelling`, `gsap-scrolltrigger-storytelling`, `build-threejs-scroll-worlds`, `scroll-scrubbed-visual-sequence`, `scroll-progress-timeline`, `animation-on-scroll` |
| Motion systems | `cinematic-gsap-lenis-motion-system`, `animation-systems`, `gsap`, `masked-reveal`, `staggered-word-reveal` |
| WebGL and effects | `threejs`, `webgl-3d-object`, `add-shader-cursor-trail`, `build-interactive-particle-trail`, `dither-background`, `globe-particles`, `progressive-blur`, `beautiful-shadows` |
| Style recipes | `dark-glass-clean-layout`, `editorial-tech`, `clean-minimal-beige-light-mode`, `documentary-brutalist-agency`, `light-mode-paper-technical`, `solar-duotone-bold` |
| Page archetypes | `landing-page`, `pricing-page`, `product-proof-saas`, `agency-grid-layout-minimal` |
| Workflow tools | `video-to-superprompt`, `html-to-interaction-prompts`, `stitched-full-page-capture`, `optimize-web-animations`, `performance-profiling`, `iterate-until-verified`, `web-technique-to-skill`, `daily-ui-inspiration-capture`, `design-first-ui-prompting` |

## How to use the bridge

1. **Pick the narrowest matching skill first.**
   This is a technique library, so a request usually maps to one recipe, occasionally to a recipe plus a motion system.
   Naming the wrong one costs more than reading the README index.
2. **Check whether that skill is installed.**
   Each lands in `~/.claude/skills/<install-name>/` (user scope) or `.claude/skills/<install-name>/` (project scope).
   - **If present:** follow that skill's `SKILL.md`.
   - **If absent:** tell the user this is a bridge and the skill is not installed, then get it in place with **`/design-skills install mengto <install-name>`**.
     Do not half-do the work here.
     Offer `build-awwwards-quality-sites` or a pro-motion skill in the meantime if the user wants to keep moving.
3. **Defer to the upstream skill for the actual work.**
   Do not reimplement its recipes in this repo.

**Runtime prerequisites.**
Most web-design skills need only the project's own toolchain plus the library they name (GSAP, Lenis, Three.js).
`video-to-superprompt` and the capture workflows shell out to local tools such as `ffmpeg` and a browser; check for those before promising a run.

## Keeping it installed and current

Use the **`/design-skills`** command (in this plugin):

- `/design-skills check mengto` - report which install names are present and at which scope, and diff against the live upstream skill list.
- `/design-skills install mengto <install-name>` - install one skill.
  Installing all 130 is possible and almost never what you want.
- `/design-skills update mengto <install-name>` - re-run the install; the newer files replace the older ones in place.

## Why a bridge, not a fork

130 skills across roughly 890 files is an order of magnitude larger than everything `pro-design` vendors put together, and Meng To adds to it continuously.
Forking it would drown this plugin's own skills in a catalog nobody loads all of, and it would be stale within weeks.
The bridge keeps `pro-design` light, keeps the one skill worth vendoring (`build-awwwards-quality-sites`) close at hand, and gives the pro-dev lifecycle a discoverable entry point for the rest.

---

_Bridge to [MengTo/Skills](https://github.com/MengTo/Skills) (MIT). No upstream content is vendored here - this file is an original pointer/router. Install and license terms are governed by the upstream repo._
