---
description: "Check, install, or update the impeccable UI/UX engine that the impeccable-bridge skill routes to — reports installed version and scope, and keeps the pro-design stack current. Usage: /design-engine [check|install|update]"
argument-hint: "[check|install|update]"
allowed-tools:
  - "Bash(npx impeccable skills*)"
  - "Bash(npx skills add pbakaus/impeccable*)"
  - "Bash(ls ~/.claude/skills/impeccable*)"
  - "Bash(ls .claude/skills/impeccable*)"
  - "Bash(claude plugin update*)"
---

Ensure the design engine behind the `impeccable-bridge` bridge — the standalone `impeccable` skill — is installed and current. `impeccable` is **not vendored** into this marketplace; it's an external package (homepage https://impeccable.style), so this command manages it in place rather than from the repo.

Parse the action from `$ARGUMENTS` (default `check`).

## Install channels (important)

`impeccable` ships two builds:

- **`npx impeccable skills <cmd>`** — a build compiled for THIS harness. This is the canonical, current channel (e.g. the 3.x line). **Prefer this.**
- **`npx skills add pbakaus/impeccable`** — a shared build via the generic skills installer. This tracks npm's `latest`, which has lagged (e.g. `2.3.2` while the harness build is `3.1.1`). Use only as a fallback when `npx impeccable` is unavailable.

Never install the shared build over a newer harness build — that downgrades.

## 1. `check` (default)

- Run **`npx impeccable skills check`** — its own status/version report.
- Also confirm presence directly: `~/.claude/skills/impeccable/SKILL.md` (user scope — applies to every project) and `.claude/skills/impeccable/SKILL.md` (project scope). Read the `version:` frontmatter from whichever exists.
- Report installed/missing, version, and scope. Remind the user that marketplace plugins update separately via `claude plugin update` (that refreshes this `pro-design` bridge; `/design-engine` manages only the external engine).
- Do **not** change anything on `check`.

## 2. `install`

- Run **`npx impeccable skills install`** (harness-specific build).
- If `npx impeccable` is unavailable in the environment, fall back to **`npx skills add pbakaus/impeccable`**, and tell the user it's the shared (possibly older) build.
- Re-run `npx impeccable skills check` and report the resulting version + scope.

## 3. `update`

- Run **`npx impeccable skills update`**.
- Then run **`claude plugin update`** to bring the pro-dev marketplace plugins (including `pro-design`) current.
- Re-run `npx impeccable skills check` and report before → after versions.

## Notes

- This command manages the **engine**, not the bridge. The `impeccable-bridge` skill (in this plugin) is the thin router — it catches whole-surface design intent and hands off to whatever `impeccable` is installed here.
- Nothing about `impeccable` is committed to this marketplace; treat it as an external dependency with its own release cadence.
