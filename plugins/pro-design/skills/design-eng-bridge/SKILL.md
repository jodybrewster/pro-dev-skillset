---
name: design-eng-bridge
description: Bridge to Emil Kowalski's design-engineering skill library - strict animation review against a craft bar (easing direction, sub-300ms budgets, spring configs, transform-origin, interruptibility), codebase-wide motion audits that emit executable plans, finding where motion is missing and where it should be refused, naming a motion effect you can only describe, Apple fluid-interface principles (gesture tracking, velocity handoff, momentum projection, rubber-banding), curated frontend library picks, and building several variants of a UI piece behind a live picker. Use when the ask is about animation quality or judgment rather than animation implementation. This is a BRIDGE (not vendored); the skills install via the /design-eng-skills command. For implementing motion use pro-design's motion skill or pro-motion's gsap/hyperframes/remotion; for a general visual polish pass use taste-skill.
---

# design-eng-bridge

This is a **bridge, not a vendored skill.** The engine is [`emilkowalski/skills`](https://github.com/emilkowalski/skills) (MIT) - eight design-engineering skills from the author of [Sonner](https://sonner.emilkowal.ski) and [Vaul](https://vaul.emilkowal.ski), installed with the [`npx skills add`](https://github.com/vercel-labs/agent-skills) CLI. That tree is **deliberately not copied into this marketplace** - it ships on its own cadence and three of its skills use frontmatter this repo's portability checks reject.

The split against pro-dev's own motion skills is judgment vs implementation. `motion` and `motion-system` (pro-design) and `gsap`/`hyperframes`/`remotion` (pro-motion) tell you *how to build* an animation. These skills tell you *whether it should exist, whether it is any good, and what to call it.*

## When to route here

Route to an upstream skill (install name in `code`) when the ask is:

- **Review this animation / is this motion any good?** -> `review-animations`. Reviews motion code against a strict craft bar and defaults to flagging - approval is earned. Carries the full rule catalog (easing curves, per-element duration budgets, spring configs, gestures, `clip-path`, performance, a11y).
- **Audit the motion across the whole app / give me a roadmap of animation fixes** -> `improve-animations`. Surveys the codebase read-only, then writes prioritized findings and self-contained implementation plans into `plans/` that any agent (including a cheaper model) can execute.
- **What could be animated here? / make this feel more alive** -> `find-animation-opportunities`. Read-only; proposes motion with exact values and, just as importantly, refuses the places that should stay still.
- **What's it called when...?** -> `animation-vocabulary`. Reverse-lookup glossary that turns "the bouncy thing when a popover opens" into "pop in", so the next prompt can be precise.
- **Gesture-driven, physical, Apple-feeling UI** -> `apple-design`. Interruptibility, 1:1 direct manipulation, velocity handoff between drag and animation, momentum projection, rubber-banding, translucent materials, optical typography.
- **General UI polish philosophy / why does this feel off?** -> `emil-design-eng`. The trunk skill: the animation decision framework (frequency -> whether to animate at all), component principles, transform mastery, the Sonner principles, and a required Before/After/Why review table.
- **Which library should I use for X?** -> `pick-ui-library`. Curated, opinionated picks for toasts, command menus, OTP inputs, charts, virtualization, drag and drop, state, styling.
- **Show me a few different versions of this UI** -> `prototype`. Builds several genuinely different variants behind a live visual picker so the user flips through them and promotes a winner.

Stay in pro-dev's own skills when the task is: implementing Framer Motion (`motion`), defining duration/easing tokens (`motion-system`), a GSAP/ScrollTrigger marketing animation (`gsap`), complex Framer orchestration (`hyperframes`), programmatic video (`remotion`), a targeted visual polish pass (`taste-skill`), a WCAG audit (`accessibility-audit`), or the comprehensive whole-surface craft pass (`impeccable-bridge`).

## Skill catalog (install names)

| Install name | Use it for | Explicit invoke only |
| --- | --- | --- |
| `emil-design-eng` | UI polish philosophy, animation decision framework, component craft | No |
| `review-animations` | Strict review of motion code against a craft bar | **Yes** |
| `improve-animations` | Codebase-wide motion audit -> prioritized, executable plans | No |
| `find-animation-opportunities` | Where motion is missing, and where to refuse it | No |
| `animation-vocabulary` | Name an effect from a vague description | No |
| `apple-design` | Gesture, spring, momentum, materials, optical type | No |
| `pick-ui-library` | Curated frontend library recommendations | **Yes** |
| `prototype` | Several UI variants behind a live picker | **Yes** |

The three marked **Yes** ship with `disable-model-invocation: true` upstream - they never trigger on their own. Invoke them by name ("use review-animations on this diff") or they will not fire.

## How to use the bridge

1. **Check whether the skill is installed.** Upstream skills land in `~/.claude/skills/<install-name>/` (user scope) or `.claude/skills/<install-name>/` (project scope).
   - **If present:** follow that skill's `SKILL.md`. Several carry sidecars that must be loaded when a precise value is needed - `review-animations/STANDARDS.md`, `improve-animations/AUDIT.md` and `PLAN-TEMPLATE.md`, `prototype/PICKER.md`. Pull exact curves, durations, and spring configs from those files rather than approximating.
   - **If absent:** tell the user this is a bridge and the skill is not installed, then get it in place with **`/design-eng-skills install <install-name>`** (or all of them: `/design-eng-skills install`). Don't half-do the work here; offer the nearest pro-design or pro-motion skill in the meantime.
2. **Defer to the upstream skill for the actual work.** Do not reimplement its rule catalog in this repo - the point of the bridge is that the upstream evolves on its own cadence.

## Keeping the skills installed and current

Use the **`/design-eng-skills`** command (in this plugin):

- `/design-eng-skills check` - report which install names are present, and where. Also diffs the catalog table above against the live upstream repo and flags drift.
- `/design-eng-skills install [name]` - `npx skills@latest add emilkowalski/skills` (all), or `--skill "<name>"` for one.
- `/design-eng-skills update [name]` - re-run the install (the newer `SKILL.md` replaces the older in place).

## Why a bridge, not a fork

Three reasons, in order of weight. The upstream is actively maintained and published to the skills.sh registry with its own release cadence, so a fork is stale the week it lands. Three of the eight skills set `disable-model-invocation: true`, which `tests/check.mjs` fails as a non-portable frontmatter key - vendoring would mean either stripping the key and silently changing when those skills fire, or widening the portability allowlist for one upstream. And the value here is one person's trained judgment; keeping it as a pointer means the user gets Emil's current opinion, not a snapshot of it.

---

_Bridge to [`emilkowalski/skills`](https://github.com/emilkowalski/skills) (MIT, Copyright (c) 2026 Emil Kowalski). No upstream content is vendored here - this file is an original pointer/router. Install and license terms are governed by the upstream repo._
