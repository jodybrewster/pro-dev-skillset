---
description: "Check, install, or update the lavish-axi engine that the lavish bridge routes to — reports whether the upstream lavish skill is installed and keeps the pro-dev stack current. Usage: /lavish-engine [check|install|update]"
argument-hint: "[check|install|update]"
allowed-tools:
  - "Bash(npx skills add kunchenguid/lavish-axi*)"
  - "Bash(npx -y lavish-axi*)"
  - "Bash(npx skills list*)"
  - "Bash(ls ~/.claude/skills*)"
  - "Bash(ls .claude/skills*)"
  - "Bash(claude plugin update*)"
---

Ensure the engine behind the `lavish` bridge — the standalone `lavish-axi` CLI and its upstream `lavish` skill (kunchenguid/lavish-axi) — is available and current. `lavish-axi` is **not vendored** into this marketplace: the CLI runs on demand via `npx -y lavish-axi`, and the upstream skill (the artifact playbooks + design-system rules) installs via the `npx skills` ecosystem (the same one `find-skills` wraps).

Parse the action from `$ARGUMENTS` (default `check`).

## 1. `check` (default)

- Look for the upstream `lavish` skill at `~/.claude/skills/lavish/` (user scope — applies to every project) and `.claude/skills/lavish/` (project scope). Report which scope(s) have it, if any.
- Note that the **CLI always works** without any install via `npx -y lavish-axi` — the upstream skill only adds the richer artifact playbooks.
- Remind the user that the marketplace plugins update separately via `claude plugin update` (that refreshes this `pro-pdd` bridge; `/lavish-engine` manages only the external engine).
- Do **not** change anything on `check`.

## 2. `install`

- Run **`npx skills add kunchenguid/lavish-axi --skill lavish`**.
- Default to **project scope**; pass `-g` to install at user scope (every project) if the user asks for global.
- Re-check and report what landed and where.

## 3. `update`

- Re-run **`npx skills add kunchenguid/lavish-axi --skill lavish`** to pull the latest upstream (the installer overwrites with the current version).
- Then run **`claude plugin update`** to bring the pro-dev marketplace plugins (including `pro-pdd`) current.
- Re-check and report before → after.

## Notes

- This command manages the **engine**, not the bridge. The `lavish` skill (in this plugin) is the thin router — it catches artifact-review intent and drives `npx -y lavish-axi` (open → poll → end).
- Nothing about `lavish-axi` is committed to this marketplace; treat it as an external dependency with its own release cadence.
