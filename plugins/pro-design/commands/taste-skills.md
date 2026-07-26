---
description: "Check, install, or update the Leonxlnx taste-skill library that the taste-skills-bridge skill routes to. Reports which skills are installed and where, and installs/updates them in place. Usage: /taste-skills [check|install|update] [install-name]"
argument-hint: "[check|install|update] [install-name]"
allowed-tools:
  - "Bash(npx skills add https://github.com/Leonxlnx/taste-skill*)"
  - "Bash(ls ~/.claude/skills*)"
  - "Bash(ls .claude/skills*)"
  - "Bash(gh api repos/Leonxlnx/taste-skill/*)"
  - "Bash(curl -s https://api.github.com/repos/Leonxlnx/taste-skill/*)"
---

Ensure the taste skills behind the `taste-skills-bridge` bridge - the external [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) library - are installed and current. These skills are **not vendored** into this marketplace; this command manages them in place via the [`npx skills add`](https://github.com/vercel-labs/agent-skills) CLI.

Parse the action from `$ARGUMENTS` (default `check`), and an optional install-name (e.g. `design-taste-frontend`, `brandkit`).

Install names: `design-taste-frontend`, `design-taste-frontend-v1`, `gpt-taste`, `image-to-code`, `redesign-existing-projects`, `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `stitch-design-taste`, `full-output-enforcement`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `brandkit`.

## 1. `check` (default)

- List `~/.claude/skills/` (user scope - applies to every project) and `.claude/skills/` (project scope), and report which install names above are present and at which scope. Read the `name:`/`version:` frontmatter where useful.
- Report installed vs missing. Remind the user that the bridge skill and this command update with the marketplace via `claude plugin update`, while the taste skills themselves update via `/taste-skills update`.
- **Upstream catalog diff.** The upstream repo's `skills/` folder names do not match the installable `name:` values (e.g. the `brutalist-skill` folder installs as `industrial-brutalist-ui`), so build the real upstream catalog from each skill's frontmatter, not from the folder listing alone:
  1. List the upstream folders: `gh api repos/Leonxlnx/taste-skill/contents/skills --jq '.[] | select(.type=="dir") | .name'` (fallback if `gh` is unavailable: `curl -s https://api.github.com/repos/Leonxlnx/taste-skill/contents/skills | jq '.[] | select(.type=="dir") | .name'`). Expect 13 folders.
  2. For each folder, read its install name from `SKILL.md`'s `name:` frontmatter: `gh api repos/Leonxlnx/taste-skill/contents/skills/<dir>/SKILL.md -H "Accept: application/vnd.github.raw" | grep '^name:'` (fallback: `curl -s -H "Accept: application/vnd.github.raw" https://api.github.com/repos/Leonxlnx/taste-skill/contents/skills/<dir>/SKILL.md | grep '^name:'`).
  3. Compare the resulting upstream install-name set against the install-name list above and the table in `taste-skills-bridge/SKILL.md`. Report **upstream-only names** (new upstream skills missing from the bridge table - suggest updating the bridge skill and this command, which requires a pro-design version bump) and **local-only names** (skills renamed or removed upstream - flag as stale).
  - If any of these calls fail (no network, no `gh`/`curl`, rate limit), say the upstream diff was skipped and continue - that's not an error.
- Do **not** change anything on `check`.

## 2. `install [name]`

- All skills: **`npx skills add https://github.com/Leonxlnx/taste-skill`** (the CLI scans the repo's `skills/` folder and installs every skill).
- One skill: **`npx skills add https://github.com/Leonxlnx/taste-skill --skill "<install-name>"`**.
- Re-check presence and report the resulting install names + scope.

## 3. `update [name]`

- Re-run the same install command (all, or `--skill "<name>"`); the newer `SKILL.md` replaces the older one in place. Install names are stable across versions, so no downstream reference changes are needed.
- Report before -> after for the affected skills.

## Notes

- This command manages the **skills**, not the bridge. The `taste-skills-bridge` skill (in this plugin) is the thin router - it catches anti-slop generation, visual-style, image-gen, and brand-kit intent and hands off to whichever Leonxlnx skill is installed here.
- Nothing about `Leonxlnx/taste-skill` is committed to this marketplace; treat it as an external dependency with its own release cadence (MIT).
