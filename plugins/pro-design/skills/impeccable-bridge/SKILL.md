---
name: impeccable-bridge
description: The comprehensive, end-to-end UI/UX design pass for production-grade frontend craft — use when the work is "make this genuinely excellent / bolder / more delightful / quieter", a full redesign, a deep design critique or audit, or live in-browser visual iteration, rather than one focused facet. This is a BRIDGE to the standalone `impeccable` skill (which does the heavy lifting); pro-design's focused skills (design-token, accessibility-audit, motion-system, typography-scale, shadcn-ui-composition) cover single facets, this routes to the full engine. Not for backend-only or non-UI tasks.
---

# impeccable-bridge

This is a **bridge, not a vendored skill.** The full UI/UX engine is [`impeccable`](https://www.npmjs.com/package/impeccable) — a production-grade frontend-design skill (Apache-2.0, based on Anthropic's frontend-design skill) that ships ~36 reference files, ~30 scripts, a live-browser variant server, and an `npx impeccable` CLI. That tree is **deliberately not copied into this marketplace.** pro-design's own skills handle specific facets; when the task wants the comprehensive, opinionated, end-to-end pass, hand off to `impeccable`.

## When to route here

Route to the `impeccable` engine when the ask is whole-surface or craft-led:

- Build a new feature/page/screen end-to-end with exceptional craft (`craft`, `shape`)
- Make an existing UI **bolder / more delightful / quieter / drenched in color** (`bolder`, `delight`, `quieter`, `colorize`, `overdrive`)
- Deep design **critique or audit** of a surface (`critique`, `audit`)
- Reshape **layout, typography, motion, interaction** holistically (`layout`, `typeset`, `animate`)
- **Adapt / clarify / distill / polish / harden / optimize** an interface (`adapt`, `clarify`, `distill`, `polish`, `harden`, `optimize`, `onboard`)
- **Live in-browser** variant iteration against a running dev server (`live`)
- Capture or extract a design system (`teach`, `document`, `extract`)

Stay in pro-design's focused skills when the task is a **single facet**: just tokens → `design-token`; just a WCAG pass → `accessibility-audit`; just a motion spec → `motion-system`; just a type scale → `typography-scale`; just shadcn/ui composition → `shadcn-ui-composition`.

## How to use the bridge

1. **Check whether `impeccable` is available.** It is commonly installed at user scope (`~/.claude/skills/impeccable/`) or project scope (`.claude/skills/impeccable/`), and exposes an `npx impeccable` CLI.
   - **If present:** follow its `SKILL.md` — load project context first (`node <skill-dir>/scripts/load-context.mjs`, reading PRODUCT.md / DESIGN.md), identify the register (brand vs. product), then load and follow the matching sub-command reference. Invoke a sub-command as `/impeccable <command> [target]` (e.g. `/impeccable craft <feature>`, `/impeccable audit`, `/impeccable live`).
   - **If absent:** tell the user this is a bridge and the engine isn't installed, then get it in place with **`/design-engine install`** (or directly: `npx impeccable skills install`, homepage https://impeccable.style). Don't half-do the work here. Offer to fall back to the relevant focused pro-design skill(s) for the facets they need in the meantime.
2. **Defer to `impeccable` for the actual design work.** Do not reimplement its process, reference files, or scripts in this repo — the whole point of the bridge is that the engine updates independently of this marketplace.

## Keeping the engine installed and current

Because the engine lives outside this marketplace, use the **`/design-engine`** command (in this plugin) to manage it:

- `/design-engine check` — `npx impeccable skills check` plus a scope/version report.
- `/design-engine install` — `npx impeccable skills install` when missing.
- `/design-engine update` — `npx impeccable skills update`, **and** `claude plugin update` for the pro-dev stack.

Note: prefer the `npx impeccable skills *` commands (the build compiled for this harness, currently the 3.x line) over `npx skills add pbakaus/impeccable` (a shared build that tracks npm's older `latest`).

## Why a bridge, not a fork

`impeccable` is a large, self-updating package with a CLI, a live HMR browser server, and absolute-path script bootstrapping. Vendoring it the way pro-dev forks smaller skills would be heavy, brittle, and immediately stale. The bridge keeps `pro-design` light, avoids duplicating ~70 files, and lets the upstream engine evolve on its own cadence — while still giving the pro-dev lifecycle a discoverable entry point for the full UI/UX pass.

---

_Bridge to the standalone [`impeccable`](https://www.npmjs.com/package/impeccable) skill (Apache-2.0, based on Anthropic's frontend-design skill). No upstream content is vendored here — this file is an original pointer/router. Install and license terms are governed by `impeccable` itself._
