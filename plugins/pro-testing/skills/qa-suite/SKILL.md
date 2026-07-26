---
name: qa-suite
description: Entry point for the broad QA-skills testing suite — use when the user wants to run the whole test suite and triage what's failing, run a full QA pass, set up testing for a project, or pick the right testing skill (playwright e2e, visual regression, API/contract testing, test strategy/planning, risk-based testing, flaky-test triage). This is a BRIDGE to the standalone `qa-skills` library (petrkindlmann/qa-skills); it routes to the installed suite and, when it's missing, installs it via /qa-engine. Not for focused Vitest unit tests (use `vitest`) or one-off interactive browser checks (use `agent-browser`).
---

# QA Suite — bridge to `qa-skills`

This is a **bridge, not a vendored library.** The broad QA capability is the standalone [`qa-skills`](https://github.com/petrkindlmann/qa-skills) collection (43 skills, MIT) — its own router (`qa-do`, `qa-start`) plus the leaf skills (`playwright-automation`, `visual-testing`, `api-testing`, `contract-testing`, `test-strategy`, `test-planning`, `risk-based-testing`, `test-reliability`, `qa-project-context`, …). That library is **not copied into this marketplace**; it's installed on demand via the `npx skills` ecosystem.

## How to use the bridge

1. **Check whether `qa-skills` is installed.** Look for its skills at user scope (`~/.claude/skills/`) or project scope (`.claude/skills/`) — e.g. `qa-do`, `qa-start`, `playwright-automation`.
   - **If present:** defer to the installed suite. `qa-do` is its task router and `qa-start` sets QA up in a project — hand off to them; they own the routing within testing. Don't re-implement that here.
   - **If absent:** tell the user the suite isn't installed, then run **`/qa-engine install`** (or directly: `npx skills add petrkindlmann/qa-skills -y --agent claude-code --skill <skills>` — the `-y`/`--agent`/trailing `--skill` flags are required to install non-interactively into `.claude/skills/`; bare skill names trigger the interactive picker). Offer the focused native skills in the meantime: `vitest` (unit/component), `agent-browser` (interactive browser check), `storybook-interactions`.
2. **Defer to `qa-skills` for the actual work.** Do not reimplement its skills or references in this repo — the point of the bridge is that the library updates independently.

## What stays native in `pro-testing`

These are **not** part of the bridge — they're first-class pro-testing skills, always available:

- **`vitest`** — focused Vitest v4 unit/component testing for TS React/Next.js.
- **`agent-browser`** — interactive, one-off browser verification (durable axis: interactive vs. committed regression suite).
- **`storybook-interactions`** — Storybook interaction tests.

## Keeping the suite installed and current

Use **`/qa-engine [check|install|update]`** (in this plugin):

- `/qa-engine check` — report which qa-skills are installed and where.
- `/qa-engine install` — `npx skills add petrkindlmann/qa-skills <curated subset>`.
- `/qa-engine update` — re-add the subset **and** `claude plugin update` for the pro-dev stack.

## Why a bridge, not a vendored library

Carrying `qa-skills` in-repo (the prior approach) meant maintaining a ~1.8 MB / 176-file tree and re-syncing on every upstream change. Bridging removes that maintenance entirely and lets the suite track upstream on its own cadence. The trade-off: the qa-skills don't exist or trigger in a project until `/qa-engine install` has run there.

---

_Bridge to the standalone [`qa-skills`](https://github.com/petrkindlmann/qa-skills) library (MIT). No upstream content is vendored here — this file is an original pointer/router. Install and license terms are governed by `qa-skills` itself._
