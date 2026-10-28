# Releases

The current version of every plugin, when it shipped and what it shipped.
A release row is added or updated in the same PR as the version bump, and each version is tagged `<plugin>--v<version>` after the PR merges (see [RELEASING.md](../RELEASING.md)).
Dates and commits come from `git log -- plugins/<name>`; the last tag column shows where tagging stood before this table existed.

Marketplace `metadata.version`: 1.54.0.

| Plugin | Version | Date | What shipped | Commit | Last tag before this table |
|---|---|---|---|---|---|
| pro-ai-sdlc | 0.5.1 | 2026-10-28 | `methods.py` lists plugins from the repo folder so `enabled` is read for that repo. Also carries (0.5.0, PR 66): `/intent`, `/spec`, `/plan` and `/review` offer the hand-offs an installed spec method declares, through the new `scripts/methods.py`; prints nothing when no method is installed. Also carries removed `/sdlc-init` (0.4.0) and `/execute` (0.3.0, PR 63) | PR 67 | none |
| pro-astro | 0.1.1 | 2026-10-16 | Standard original-skill footer on the four Astro skills | this PR | none |
| pro-core | 0.19.0 | 2026-10-28 | `/pro-dev` and `pro-dev.py` gain `--owner <plugin>` so a plugin runs only its own registry rows, plus a pre-run list and yes step in install and update. Also carries 0.18.1 (PR 69) | PR 70 | pro-core--v0.13.0 |
| pro-data | 0.4.5 | 2026-07-26 | Hooks merged into one `hooks/hooks.json` | 8597453 (PR 34) | pro-data--v0.2.0 |
| pro-design | 0.12.0 | 2026-10-28 | `/pro-design:install` sets up its engines (needs pro-core installed). Also carries 0.11.0 (PR 68) | PR 70 | pro-design--v0.3.0 |
| pro-dev-starter | 2.0.5 | 2026-10-28 | Version bump only, because pro-core ships a new version | PR 70 | none |
| pro-egm | 0.2.0 | 2026-10-28 | `/pro-egm:install` sets up its engines (needs pro-core installed). Also carries 0.1.1 (PR 67) | PR 70 | none |
| pro-execution | 0.4.0 | 2026-10-25 | Removed the `/worktrunk` command; herdr worktrees and the harness's native worktree tool cover parallel work | this PR | none |
| pro-legal | 0.1.2 | 2026-10-17 | Agent `software-counsel` declares `model: opus` | this PR | none |
| pro-motion | 0.1.0 | 2026-06-23 | First release: gsap, hyperframes and remotion skills | c4460d3 | none |
| pro-nextjs | 0.12.0 | 2026-10-28 | `/pro-nextjs:install` sets up its engines (needs pro-core installed). Also carries 0.11.0 (PR 68) | PR 70 | pro-nextjs--v0.5.0 |
| pro-pdd | 0.6.0 | 2026-10-28 | `/pro-pdd:install` sets up its engines (needs pro-core installed). Also carries 0.5.0 | PR 70 | none |
| pro-quality | 0.10.0 | 2026-10-28 | The Stop hook only suggests /validate (one line, once per set of changed files) and counts only repo files the session wrote or a `git commit`, skipping gitignored paths; set `PRO_DEV_VALIDATION=block` in the env block of .claude/settings.json to restore the forced handoff (`off` silences it) | this PR | pro-quality--v0.9.1 |
| pro-research | 0.3.3 | 2026-10-17 | The four research agents declare `model: haiku` | this PR | none |
| pro-security | 0.2.0 | 2026-10-28 | One push gate replaces the commit, plan-mode, plan-document and ideation hooks; `security-architect` diff mode reviews the diff and its direct callers only | this PR | none |
| pro-ship | 0.2.0 | 2026-10-28 | `/pro-ship:install` sets up its engines (needs pro-core installed). Also carries 0.1.0 (PR 68) | PR 70 | none |
| pro-spdd | 0.3.6 | 2026-10-28 | Adds `sdlc-method.json` so pro-ai-sdlc offers `/spdd-story` at the intent stage. Also carries the PORT-PLAN placeholder change (0.3.5) | PR 66 | pro-spdd--v0.2.1 |
| pro-starter | 1.14.1 | 2026-10-28 | Version bump only, because pro-dev-starter ships a new version | PR 70 | pro-starter--v1.0.3 |
| pro-testing | 0.7.0 | 2026-10-28 | `/pro-testing:install` sets up its engines (needs pro-core installed). Also carries 0.6.0 | PR 70 | pro-testing--v0.2.0 |
