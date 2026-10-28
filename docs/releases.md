# Releases

The current version of every plugin, when it shipped and what it shipped.
A release row is added or updated in the same PR as the version bump, and each version is tagged `<plugin>--v<version>` after the PR merges (see [RELEASING.md](../RELEASING.md)).
Dates and commits come from `git log -- plugins/<name>`; the last tag column shows where tagging stood before this table existed.

Marketplace `metadata.version`: 1.53.1.

| Plugin | Version | Date | What shipped | Commit | Last tag before this table |
|---|---|---|---|---|---|
| pro-ai-sdlc | 0.5.1 | 2026-10-28 | `methods.py` lists plugins from the repo folder so `enabled` is read for that repo. Also carries (0.5.0, PR 66): `/intent`, `/spec`, `/plan` and `/review` offer the hand-offs an installed spec method declares, through the new `scripts/methods.py`; prints nothing when no method is installed. Also carries removed `/sdlc-init` (0.4.0) and `/execute` (0.3.0, PR 63) | PR 67 | none |
| pro-astro | 0.1.1 | 2026-10-16 | Standard original-skill footer on the four Astro skills | this PR | none |
| pro-core | 0.18.1 | 2026-10-28 | `plugins swap-starter` skips a disabled pro-starter install and re-installs only enabled stack plugins, so a deliberately disabled plugin is not switched back on. Also carries 0.18.0 (PR 68) | PR 69 | pro-core--v0.13.0 |
| pro-data | 0.4.5 | 2026-07-26 | Hooks merged into one `hooks/hooks.json` | 8597453 (PR 34) | pro-data--v0.2.0 |
| pro-design | 0.11.0 | 2026-10-28 | `react-patterns-bridge` and the `web-design-guidelines` lint (rules from a pinned commit, no shell); hand-off clauses in `accessibility-audit`, `screen-critique` and `shadcn-ui-composition` | PR 68 | pro-design--v0.3.0 |
| pro-dev-starter | 2.0.4 | 2026-10-28 | Version bump only, because pro-core ships a new version | PR 69 | none |
| pro-egm | 0.1.1 | 2026-10-28 | `/pro-egm:goldfish` reads EGM's `egm-review-loop` skill file and follows it, since every EGM skill refuses model invocation; `goldfish.py egm` finds it. First release (0.1.0, PR 66): `/pro-egm:goldfish` runs egm@egm's goldfish review on a spec or plan with repo-confined reviewers, plus the `egm-bridge` skill and `sdlc-method.json` | PR 67 | none |
| pro-execution | 0.4.0 | 2026-10-25 | Removed the `/worktrunk` command; herdr worktrees and the harness's native worktree tool cover parallel work | this PR | none |
| pro-legal | 0.1.2 | 2026-10-17 | Agent `software-counsel` declares `model: opus` | this PR | none |
| pro-motion | 0.1.0 | 2026-06-23 | First release: gsap, hyperframes and remotion skills | c4460d3 | none |
| pro-nextjs | 0.11.0 | 2026-10-28 | `vercel-skills-bridge` for React and Next.js performance and Vercel cost tuning, with the token rule; `vercel-cli-with-tokens` left out on purpose | PR 68 | pro-nextjs--v0.5.0 |
| pro-pdd | 0.5.0 | 2026-10-28 | Removed `/lavish-engine`; `/pro-dev install` installs lavish | this PR | none |
| pro-quality | 0.10.0 | 2026-10-28 | The Stop hook only suggests /validate (one line, once per set of changed files) and counts only repo files the session wrote or a `git commit`, skipping gitignored paths; set `PRO_DEV_VALIDATION=block` in the env block of .claude/settings.json to restore the forced handoff (`off` silences it) | this PR | pro-quality--v0.9.1 |
| pro-research | 0.3.3 | 2026-10-17 | The four research agents declare `model: haiku` | this PR | none |
| pro-security | 0.2.0 | 2026-10-28 | One push gate replaces the commit, plan-mode, plan-document and ideation hooks; `security-architect` diff mode reviews the diff and its direct callers only | this PR | none |
| pro-ship | 0.1.0 | 2026-10-28 | First release, opt-in: `vercel-deploy-bridge` owns the deploy steps (token rule, fail-closed `.env*` and `.vercelignore` checks, asks before stage, push, link, global install, temporary and production deploys) over Vercel's pinned `deploy-to-vercel` | PR 68 | none |
| pro-spdd | 0.3.6 | 2026-10-28 | Adds `sdlc-method.json` so pro-ai-sdlc offers `/spdd-story` at the intent stage. Also carries the PORT-PLAN placeholder change (0.3.5) | PR 66 | pro-spdd--v0.2.1 |
| pro-starter | 1.14.0 | 2026-10-28 | Deprecated shim for one release that depends only on pro-dev-starter; the `/pro-starter` command is removed and `/pro-dev update` offers the swap | this PR | pro-starter--v1.0.3 |
| pro-testing | 0.6.0 | 2026-10-28 | Removed `/qa-engine`; `/pro-dev install` installs qa-skills | this PR | pro-testing--v0.2.0 |
