---
description: "Check, install, or update the Emil Kowalski design-engineering skill library that the design-eng-bridge skill routes to. Reports which skills are installed and where, and installs/updates them in place. Usage: /design-eng-skills [check|install|update] [install-name]"
argument-hint: "[check|install|update] [install-name]"
allowed-tools:
  - "Bash(npx skills@latest add emilkowalski/skills*)"
  - "Bash(npx skills add emilkowalski/skills*)"
  - "Bash(ls ~/.claude/skills*)"
  - "Bash(ls .claude/skills*)"
  - "Bash(gh api repos/emilkowalski/skills/*)"
  - "Bash(curl -s https://api.github.com/repos/emilkowalski/skills/*)"
---

Ensure the skills behind the `design-eng-bridge` bridge - the external [`emilkowalski/skills`](https://github.com/emilkowalski/skills) library - are installed and current. These skills are **not vendored** into this marketplace; this command manages them in place via the [`npx skills add`](https://github.com/vercel-labs/agent-skills) CLI.

Parse the action from `$ARGUMENTS` (default `check`), and an optional install-name (e.g. `review-animations`, `apple-design`).

Install names: `emil-design-eng`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary`, `apple-design`, `pick-ui-library`, `prototype`.

## 1. `check` (default)

- List `~/.claude/skills/` (user scope - applies to every project) and `.claude/skills/` (project scope), and report which install names above are present and at which scope.
- Report installed vs missing. Remind the user that the bridge skill and this command update with the marketplace via `claude plugin update`, while these skills update via `/design-eng-skills update`.
- **Sidecar check.** Four skills are useless without their sidecars, and a partial copy is worse than a missing one because the skill will silently approximate values it should be reading. Confirm these exist next to their `SKILL.md` and report any that are missing:
  - `review-animations/STANDARDS.md`
  - `improve-animations/AUDIT.md`, `improve-animations/PLAN-TEMPLATE.md`
  - `prototype/PICKER.md`
- **Upstream catalog diff.** Upstream folder names currently match install names 1:1, but confirm rather than assume:
  1. List the upstream folders: `gh api repos/emilkowalski/skills/contents/skills --jq '.[] | select(.type=="dir") | .name'` (fallback if `gh` is unavailable: `curl -s https://api.github.com/repos/emilkowalski/skills/contents/skills | jq '.[] | select(.type=="dir") | .name'`). Expect 8 folders.
  2. For each folder, read its install name from `SKILL.md`'s `name:` frontmatter: `gh api repos/emilkowalski/skills/contents/skills/<dir>/SKILL.md -H "Accept: application/vnd.github.raw" | grep '^name:'` (fallback: `curl -s -H "Accept: application/vnd.github.raw" https://api.github.com/repos/emilkowalski/skills/contents/skills/<dir>/SKILL.md | grep '^name:'`).
  3. Compare the resulting upstream install-name set against the install-name list above and the table in `design-eng-bridge/SKILL.md`. Report **upstream-only names** (new upstream skills missing from the bridge table - suggest updating the bridge skill and this command, which requires a pro-design version bump) and **local-only names** (skills renamed or removed upstream - flag as stale).
  4. While reading frontmatter, also note which skills carry `disable-model-invocation: true`. The bridge table marks `review-animations`, `pick-ui-library`, and `prototype` as explicit-invoke-only; if that set has changed upstream, the table is stale.
  - If any of these calls fail (no network, no `gh`/`curl`, rate limit), say the upstream diff was skipped and continue - that's not an error.
- Do **not** change anything on `check`.

## 2. `install [name]`

- All skills: **`npx skills@latest add emilkowalski/skills`** (the CLI scans the repo's `skills/` folder and installs every skill).
- One skill: **`npx skills@latest add emilkowalski/skills --skill "<install-name>"`**.
- Re-check presence and report the resulting install names + scope, then run the sidecar check above.

## 3. `update [name]`

- Re-run the same install command (all, or `--skill "<name>"`); the newer `SKILL.md` replaces the older one in place. Install names are stable across versions, so no downstream reference changes are needed.
- Report before -> after for the affected skills.

## Notes

- This command manages the **skills**, not the bridge. The `design-eng-bridge` skill (in this plugin) is the thin router - it catches animation-review, motion-audit, animation-naming, Apple-interface, library-pick, and prototype-variant intent and hands off to whichever upstream skill is installed here.
- `review-animations`, `pick-ui-library`, and `prototype` set `disable-model-invocation: true` upstream, so they only run when named explicitly. After installing, tell the user to invoke those three by name.
- Nothing about `emilkowalski/skills` is committed to this marketplace; treat it as an external dependency with its own release cadence (MIT, Copyright (c) 2026 Emil Kowalski).
