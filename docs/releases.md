# Releases

The current version of every plugin, when it shipped and what it shipped.
A release row is added or updated in the same PR as the version bump, and each version is tagged `<plugin>--v<version>` after the PR merges (see [RELEASING.md](../RELEASING.md)).
Dates and commits come from `git log -- plugins/<name>`; the last tag column shows where tagging stood before this table existed.

Marketplace `metadata.version`: 1.69.0.

| Plugin | Version | Date | What shipped | Commit | Last tag before this table |
|---|---|---|---|---|---|
| pro-ai-sdlc | 0.11.0 | 2026-10-30 | The `doubt-driven-development` skill: `/execute` doubts steps the plan marks `irreversible` and steps in a high-tier checkpoint range with a fresh-context reviewer, at most three rounds, an optional Codex second opinion through a copy of `codex-run.py` and a draft PR when findings stay open. Also carries 0.10.0 (the stop list, scope discipline, sized plans and the definition of done, PR 98) and earlier releases not listed here | intent/2026-10-30-doubt-driven-execute | |
| pro-astro | 0.1.1 | 2026-10-16 | Standard original-skill footer on the four Astro skills | this PR | none |
| pro-core | 0.22.0 | 2026-10-30 | The `using-pro-dev` router names `pr-check` and `risk-tiers` in the SHIP branch. Also carries 0.21.0 (the `manual-cli` kind and the `codex` row, PR 99) | intent/2026-10-30-p0-hardening | |
| pro-data | 0.4.5 | 2026-07-26 | Hooks merged into one `hooks/hooks.json` | 8597453 (PR 34) | pro-data--v0.2.0 |
| pro-design | 0.12.0 | 2026-10-28 | `/pro-design:install` sets up its engines (needs pro-core installed). Also carries 0.11.0 (PR 68) | PR 70 | pro-design--v0.3.0 |
| pro-dev-starter | 3.0.0 | 2026-10-28 | Drops `pro-ai-sdlc` from the default stack: it is now opt-in beside `pro-nextjs` and `pro-astro`; `pro-pdd` stays | PR 73 | none |
| pro-egm | 0.3.1 | 2026-10-29 | Eval fixture repos get a git author. Also carries 0.3.0 (PR 78) | this PR | none |
| pro-execution | 0.6.0 | 2026-10-29 | `test-driven-development` and `systematic-debugging` descriptions name the requests they cover and apply to pasted code; sharpened eval cases and two more stays-quiet cases. Also carries 0.5.0 (plugin eval cases) | this PR | none |
| pro-legal | 0.1.2 | 2026-10-17 | Agent `software-counsel` declares `model: opus` | this PR | none |
| pro-motion | 0.1.0 | 2026-06-23 | First release: gsap, hyperframes and remotion skills | c4460d3 | none |
| pro-nextjs | 0.12.0 | 2026-10-28 | `/pro-nextjs:install` sets up its engines (needs pro-core installed). Also carries 0.11.0 (PR 68) | PR 70 | pro-nextjs--v0.5.0 |
| pro-pdd | 0.7.0 | 2026-10-29 | `claude plugin eval` cases for `writing-plans`, a fires and a stays-quiet case, wired through `experimental.evals`. Also carries 0.6.0 (PR 70) | this PR | none |
| pro-quality | 0.15.1 | 2026-10-30 | `code-reviewer` and its Codex `.toml` twin name the finding location form `path:line`, so a second reviewer's findings can be paired. Also carries 0.15.0 and earlier releases this table did not list | this PR | none |
| pro-research | 0.3.3 | 2026-10-17 | The four research agents declare `model: haiku` | this PR | none |
| pro-security | 0.2.0 | 2026-10-28 | One push gate replaces the commit, plan-mode, plan-document and ideation hooks; `security-architect` diff mode reviews the diff and its direct callers only | this PR | none |
| pro-ship | 0.6.0 | 2026-10-30 | The merge gate classifies the PR it is given (`gh pr view` plus one `git fetch` of the head and base), gates `gh api` PUT and GraphQL merges, holds `--auto` to the pin and logs the PR and head sha; the classifier thresholds carry their measured ranges. Also carries 0.5.0 (the optional Codex second review, PR 99) | intent/2026-10-30-p0-hardening | |
| pro-spdd | 0.3.6 | 2026-10-28 | Adds `sdlc-method.json` so pro-ai-sdlc offers `/spdd-story` at the intent stage. Also carries the PORT-PLAN placeholder change (0.3.5) | PR 66 | pro-spdd--v0.2.1 |
| pro-speckit | 0.1.0 | 2026-10-28 | First release: bridge skill for GitHub spec-kit, `/pro-speckit:install` and `/pro-speckit:remove` and an `sdlc-method.json` hand-off at the intent stage. The `specify-cli` and `spec-kit` rows live in pro-core | PR 71 | none |
| pro-starter | 1.14.3 | 2026-10-28 | Version bump only, because pro-dev-starter ships a new version | PR 73 | pro-starter--v1.0.3 |
| pro-testing | 0.7.0 | 2026-10-28 | `/pro-testing:install` sets up its engines (needs pro-core installed). Also carries 0.6.0 | PR 70 | pro-testing--v0.2.0 |
