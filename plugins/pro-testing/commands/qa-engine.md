---
description: "Check, install, or update the qa-skills testing suite that the qa-suite bridge routes to — reports which skills are installed and keeps the pro-dev stack current. Usage: /qa-engine [check|install|update]"
argument-hint: "[check|install|update]"
allowed-tools:
  - "Bash(npx skills add petrkindlmann/qa-skills*)"
  - "Bash(npx skills list*)"
  - "Bash(ls ~/.claude/skills*)"
  - "Bash(ls .claude/skills*)"
  - "Bash(claude plugin update*)"
---

Ensure the testing suite behind the `qa-suite` bridge — the standalone `qa-skills` library (petrkindlmann/qa-skills) — is installed and current. `qa-skills` is **not vendored** into this marketplace; it installs via the `npx skills` ecosystem (the same one `find-skills` wraps).

Parse the action from `$ARGUMENTS` (default `check`).

## Curated testing-core subset

`/qa-engine install` pulls this subset by default (the layer pro-testing previously vendored). The user can override by passing explicit skill names.

```
qa-do qa-start playwright-automation visual-testing api-testing contract-testing test-reliability test-strategy risk-based-testing test-planning qa-project-context
```

The full library has 43 skills — browse with `npx skills` or at https://github.com/petrkindlmann/qa-skills. `vitest`, `agent-browser`, and `storybook-interactions` are **native** pro-testing skills, not installed here.

## 1. `check` (default)

- Look for qa-skills at `~/.claude/skills/` (user scope — applies to every project) and `.claude/skills/` (project scope). Report which of the curated subset are present and at which scope.
- Remind the user that the marketplace plugins update separately via `claude plugin update` (that refreshes this `pro-testing` bridge; `/qa-engine` manages only the external suite).
- Do **not** change anything on `check`.

## 2. `install`

- Run **`npx skills add petrkindlmann/qa-skills <curated subset>`** (or the specific skills from `$ARGUMENTS` if given).
- `-g` installs at user scope (every project); omit for project scope. Default to project scope unless the user asks for global.
- Re-check and report what landed and where.

## 3. `update`

- Re-run **`npx skills add petrkindlmann/qa-skills <subset>`** to pull the latest (the skills installer overwrites with the current upstream).
- Then run **`claude plugin update`** to bring the pro-dev marketplace plugins (including `pro-testing`) current.
- Re-check and report before → after.

## Notes

- This command manages the **suite**, not the bridge. The `qa-suite` skill (in this plugin) is the thin router — it catches QA-suite intent and hands off to whatever `qa-skills` is installed here; `qa-do`/`qa-start` (once installed) own the routing within testing.
- Nothing about `qa-skills` is committed to this marketplace; treat it as an external dependency with its own release cadence.
