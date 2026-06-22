---
name: lavish
description: Turn a complex or visual agent response into a rich, reviewable HTML artifact the user can annotate in the browser and send feedback on — use when about to deliver a plan, comparison, diagram, table, code diff, report, or anything easier to grasp visually than as prose. This is a BRIDGE to the standalone lavish-axi CLI (kunchenguid/lavish-axi); the CLI runs on demand via `npx -y lavish-axi` and the full upstream playbooks install via /lavish-engine. Not for short plain-text answers or backend-only work.
---

# Lavish — bridge to `lavish-axi`

This is a **bridge, not a vendored skill.** The engine is the standalone [`lavish-axi`](https://github.com/kunchenguid/lavish-axi) CLI — it renders an HTML file into a local, browser-based review surface where the user annotates elements and sends feedback back to you, with live reload and a long-poll loop. The CLI is **not installed into this marketplace**; it runs on demand via `npx -y lavish-axi`, and the full upstream skill (its diagram / table / comparison / plan / code / slides playbooks and design-system rules) installs via **`/lavish-engine`**.

## When to route here

Reach for lavish when the response is easier to *grasp and mark up visually* than to read as prose, and a review loop adds value:

- A **plan** or proposal the user should review before execution begins
- A **comparison / decision matrix**, **table**, or **diagram**
- A **code diff**, **report**, or **slide-style** walkthrough

Stay in plain text for short answers, quick confirmations, or backend-only work.

## How to use the bridge

1. **Prefer the full upstream skill when present.** If `lavish` is installed at user scope (`~/.claude/skills/lavish/`) or project scope (`.claude/skills/lavish/`), follow its `SKILL.md` — it carries the artifact playbooks and the design-system hierarchy (user-specified → the project's existing design system → Tailwind v4 + DaisyUI v5 via CDN). If it's absent and the user wants the richer playbooks, install it with **`/lavish-engine install`**.
2. **The core loop works with no install** — the CLI comes along via npx:
   - Write the artifact to an `.html` file.
   - Open the review session: `npx -y lavish-axi <file>.html`.
   - Poll for the user's annotations / feedback: `npx -y lavish-axi poll <file>.html`.
   - Fix any layout issues first, then apply feedback and re-render; repeat until approved.
   - End the session: `npx -y lavish-axi end <file>.html`.
3. **Defer to `lavish-axi` for the rendering / review mechanics.** Don't reimplement its server, poller, or playbooks here — the point of the bridge is that the engine updates independently.

## Keeping the engine current

Use **`/lavish-engine [check|install|update]`** (in this plugin):

- `/lavish-engine check` — report whether the upstream `lavish` skill is installed and at which scope (the CLI itself always works via `npx -y lavish-axi`).
- `/lavish-engine install` — `npx skills add kunchenguid/lavish-axi --skill lavish` (project scope; `-g` for user scope).
- `/lavish-engine update` — re-add to pull the latest upstream, then `claude plugin update` for the pro-dev stack.

## Why a bridge, not a fork

`lavish-axi` is an actively released CLI (its own local server, live reload, and long-poll feedback channel) on its own cadence. Vendoring its skill would go stale immediately and duplicate a tool that already self-installs via npx. The bridge keeps `pro-pdd` light and lets the engine evolve on its own — while still giving the pro-dev lifecycle a discoverable entry point for rendering plans and other output as reviewable artifacts.

---

_Bridge to the standalone [`lavish-axi`](https://github.com/kunchenguid/lavish-axi) CLI. No upstream content is vendored here — this file is an original pointer/router. Install and license terms are governed by `lavish-axi` itself._
