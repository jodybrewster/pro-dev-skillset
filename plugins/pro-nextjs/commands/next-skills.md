---
description: "Check, install, or update the official Next.js agent skills (vercel/next.js skills/) that the next-skills-bridge routes to. Reports which are installed and where, installs them non-interactively and diffs the catalog against the live upstream. Usage: /next-skills [check|install|update] [skill-name]"
argument-hint: "[check|install|update] [skill-name]"
allowed-tools:
  - "Bash(npx -y skills add https://github.com/vercel/next.js/tree/canary/skills*)"
  - "Bash(ls ~/.claude/skills*)"
  - "Bash(ls .claude/skills*)"
  - "Bash(gh api repos/vercel/next.js/*)"
  - "Bash(curl -s https://api.github.com/repos/vercel/next.js/*)"
---

Manage the official Next.js agent skills behind the `next-skills-bridge` skill.
They live in [vercel/next.js `skills/`](https://github.com/vercel/next.js/tree/canary/skills) (MIT) and are not vendored into this marketplace; this command installs them in place with the `npx skills add` CLI.

Parse the action from `$ARGUMENTS` (default `check`) and an optional install name.

## Catalog

```
next-cache-components-adoption next-cache-components-optimizer next-partial-prefetching-adoption next-partial-prefetching-optimizer next-bundle-optimizer next-dev-loop
```

Install names come from each skill's `name:` frontmatter, which matches its folder name upstream.

## 1. `check` (default)

- List `.claude/skills/` (project scope) and `~/.claude/skills/` (user scope) and report which catalog names are present and at which scope.
  Read each installed skill's `name:` frontmatter rather than trusting the directory name.
- Upstream catalog diff:
  1. `gh api 'repos/vercel/next.js/git/trees/canary?recursive=1' --jq '.tree[] | select(.path | test("^skills/[^/]+/SKILL.md$")) | .path'`
  2. Fallback without `gh`: `curl -s 'https://api.github.com/repos/vercel/next.js/git/trees/canary?recursive=1' | jq -r '.tree[] | select(.path | test("^skills/[^/]+/SKILL.md$")) | .path'`
  3. The skill name is the middle path segment.
     Report upstream-only names (new skills; suggest adding them to this command and `next-skills-bridge`, which needs a pro-nextjs version bump) and local-only names (renamed or removed upstream; flag them as stale).
  - If a call fails (no network, no `gh`, rate limit), say the diff was skipped and continue.
- Remind the user that pro-nextjs itself updates with `claude plugin update`; this command manages only the upstream skills.
- Change nothing on `check`.

## 2. `install [skill]`

- All six, at project scope:
  `npx -y skills add https://github.com/vercel/next.js/tree/canary/skills -a claude-code -y`
- One skill:
  `npx -y skills add https://github.com/vercel/next.js/tree/canary/skills -a claude-code -y -s <install-name>`
- Flag notes: `-a claude-code` copies into `.claude/skills/<install-name>/` (where `check` looks) and `-y` skips every prompt.
  Add `-g` before `-s` to install at user scope (`~/.claude/skills/`); default to project scope unless the user asks for global.
  The CLI also writes a `skills-lock.json` in the current directory that records the source and ref.
- Point at the `skills/` folder URL, not at `vercel/next.js` alone.
  The repo root also holds contributor skills under `.agents/skills/` (backports, PR triage) that are meant for Next.js maintainers, and the root form clones far more than it needs.
- Verified on 2026-10-16 with skills CLI 1.7.2: the all-six form installed every skill with its `references/` and template sidecars in under 30 seconds, and `-s next-dev-loop` installed that one alone.
- Re-check and report what landed and where.

## 3. `update [skill]`

- Re-run the install command; the newer `SKILL.md` and sidecars replace the old ones in place.
  `npx -y skills update` also works for skills recorded in `skills-lock.json`.
- Report before and after for the affected skills.

## Notes

- `next-skills-bridge` (in this plugin) is the thin router; this command manages the upstream skills it routes to.
- Nothing from vercel/next.js is committed to this marketplace.
  Install and license terms are governed by the upstream repo (MIT, Copyright (c) 2025 Vercel, Inc.).
