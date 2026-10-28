# Releases

The current version of every plugin, when it shipped and what it shipped.
A release row is added or updated in the same PR as the version bump, and each version is tagged `<plugin>--v<version>` after the PR merges (see [RELEASING.md](../RELEASING.md)).
Dates and commits come from `git log -- plugins/<name>`; the last tag column shows where tagging stood before this table existed.

Marketplace `metadata.version`: 1.51.0.

| Plugin | Version | Date | What shipped | Commit | Last tag before this table |
|---|---|---|---|---|---|
| pro-ai-sdlc | 0.4.0 | 2026-10-28 | Removed `/sdlc-init`; `/pro-dev install` in pro-core sets a repo up for the loop. Also carries `/execute` (0.3.0, PR 63) | this PR | none |
| pro-astro | 0.1.1 | 2026-10-16 | Standard original-skill footer on the four Astro skills | this PR | none |
| pro-core | 0.16.0 | 2026-10-28 | New `/pro-dev` command, the engine registry `registry/engines.json` and `scripts/pro-dev.py`; a SessionStart nudge asks for `/pro-dev update` when the registry moved on | this PR | pro-core--v0.13.0 |
| pro-data | 0.4.5 | 2026-07-26 | Hooks merged into one `hooks/hooks.json` | 8597453 (PR 34) | pro-data--v0.2.0 |
| pro-design | 0.10.0 | 2026-10-28 | Removed `/design-engine`, `/design-skills` and `/taste-skills`; `/pro-dev install` installs those engines and the bridges point to it | this PR | pro-design--v0.3.0 |
| pro-dev-starter | 2.0.0 | 2026-10-28 | Renamed from pro-starter; the default stack without pro-nextjs and pro-astro, which are opt-in; run `/pro-dev install` after it | this PR | none |
| pro-execution | 0.4.0 | 2026-10-25 | Removed the `/worktrunk` command; herdr worktrees and the harness's native worktree tool cover parallel work | this PR | none |
| pro-legal | 0.1.2 | 2026-10-17 | Agent `software-counsel` declares `model: opus` | this PR | none |
| pro-motion | 0.1.0 | 2026-06-23 | First release: gsap, hyperframes and remotion skills | c4460d3 | none |
| pro-nextjs | 0.10.0 | 2026-10-28 | Removed `/next-skills`; `/pro-dev install` installs the Next.js skills | this PR | pro-nextjs--v0.5.0 |
| pro-pdd | 0.5.0 | 2026-10-28 | Removed `/lavish-engine`; `/pro-dev install` installs lavish | this PR | none |
| pro-quality | 0.10.0 | 2026-10-28 | The Stop hook only suggests /validate (one line, once per set of changed files) and counts only repo files the session wrote or a `git commit`, skipping gitignored paths; set `PRO_DEV_VALIDATION=block` in the env block of .claude/settings.json to restore the forced handoff (`off` silences it) | this PR | pro-quality--v0.9.1 |
| pro-research | 0.3.3 | 2026-10-17 | The four research agents declare `model: haiku` | this PR | none |
| pro-security | 0.2.0 | 2026-10-28 | One push gate replaces the commit, plan-mode, plan-document and ideation hooks; `security-architect` diff mode reviews the diff and its direct callers only | this PR | none |
| pro-spdd | 0.3.5 | 2026-10-16 | PORT-PLAN smoke test uses a path placeholder instead of a home directory | this PR | pro-spdd--v0.2.1 |
| pro-starter | 1.14.0 | 2026-10-28 | Deprecated shim for one release that depends only on pro-dev-starter; the `/pro-starter` command is removed and `/pro-dev update` offers the swap | this PR | pro-starter--v1.0.3 |
| pro-testing | 0.6.0 | 2026-10-28 | Removed `/qa-engine`; `/pro-dev install` installs qa-skills | this PR | pro-testing--v0.2.0 |
