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

- Check specifically for the required project-local skill file: `.claude/skills/lavish/SKILL.md`.
- Also report whether a user-scope copy exists at `~/.claude/skills/lavish/SKILL.md`, but do not treat user scope as satisfying the project-local setup check.
- Note that the **CLI can run** via `npx -y lavish-axi`, but substantive plan review requires the project-local upstream `lavish` skill so the richer artifact playbooks are available inside this project.
- Remind the user that the marketplace plugins update separately via `claude plugin update` (that refreshes this `pro-pdd` bridge; `/lavish-engine` manages only the external engine).
- Do **not** change anything on `check`.

## 2. `install`

- Run **`npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish`**.
- Run it from the project root and default to **project scope**; pass `-g` only if the user explicitly asks for global.
- Re-check and require `.claude/skills/lavish/SKILL.md` to exist before reporting success.

## 3. `update`

- Re-run **`npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish`** to pull the latest upstream (the installer overwrites with the current version).
- Then run **`claude plugin update`** to bring the pro-dev marketplace plugins (including `pro-pdd`) current.
- Re-check and require `.claude/skills/lavish/SKILL.md` to exist before reporting success.

## Notes

- This command manages the **project-local upstream skill and engine**, not the bridge. The `lavish` skill (in this plugin) is the thin router — it catches artifact-review intent and drives the project-local upstream playbooks plus `npx -y lavish-axi` (open → poll → end).
- Nothing about `lavish-axi` is committed to this marketplace; treat it as an external dependency with its own release cadence.
