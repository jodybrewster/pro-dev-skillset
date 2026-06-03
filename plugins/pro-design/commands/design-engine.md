---
description: "Check, install, or update the impeccable UI/UX engine that the ui-ux-pro-max bridge routes to — reports installed version and scope, and keeps the pro-design stack current. Usage: /design-engine [check|install|update]"
argument-hint: "[check|install|update]"
allowed-tools:
  - "Bash(ls ~/.claude/skills/impeccable*)"
  - "Bash(ls .claude/skills/impeccable*)"
  - "Bash(npx impeccable*)"
  - "Bash(claude plugin update*)"
---

Ensure the design engine behind the `ui-ux-pro-max` bridge — the standalone `impeccable` skill — is installed and current. `impeccable` is **not vendored** into this marketplace; it's an external package, so this command manages it in place rather than from the repo.

Parse the action from `$ARGUMENTS` (default `check`).

## 1. Detect (always run first)

Check both scopes for `impeccable/SKILL.md` and read its `version:` frontmatter:

- **User scope:** `~/.claude/skills/impeccable/SKILL.md` (applies to every project on this machine)
- **Project scope:** `.claude/skills/impeccable/SKILL.md` (committed with the repo)

Report installed/missing per scope and the version of each.

## 2. `check` (default)

Report status and stop — do **not** install or change anything:

- Whether `impeccable` is resolvable (either scope present, or `npx impeccable` available).
- The installed version(s) and scope(s).
- A reminder that the marketplace plugins update **separately**: `claude plugin update` refreshes the pro-dev stack (including this `pro-design` bridge). `/design-engine` manages only the external engine.

## 3. `install` (when missing in both scopes, or the user asks)

`impeccable` is distributed via its own CLI / site (homepage **https://impeccable.style**, entry `npx impeccable`), not the npm `latest` tag alone.

- Run `npx impeccable` to bootstrap it (the CLI scaffolds the skill and project context).
- **Never silently downgrade.** npm's `latest` has lagged the build shipped via impeccable.style (e.g. a machine here carries `3.1.1` while npm `latest` was `2.3.2`). If step 1 detected a version newer than an install would fetch, STOP and confirm with the user before overwriting.
- Re-run detection and report the new version + scope.

## 4. `update`

- First show the currently-detected version (step 1).
- Update through the same front door that produced the install (`npx impeccable`, or re-running the impeccable.style installer). **If you can't determine which channel produced the installed version, ASK the user how they installed it** rather than guessing — a wrong channel can downgrade them.
- Also run `claude plugin update` to bring the pro-dev marketplace plugins (including `pro-design`) current.
- Re-detect and report before → after versions.

## Notes

- This command manages the **engine**, not the bridge. The `ui-ux-pro-max` skill (in this plugin) is the thin router — it catches whole-surface design intent and hands off to whatever `impeccable` is installed here.
- Nothing about `impeccable` is committed to this marketplace; treat it as an external dependency with its own release cadence.
