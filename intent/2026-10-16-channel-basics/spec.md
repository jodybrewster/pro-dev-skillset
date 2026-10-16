# Spec: the channel passes its own bar

Intent: [intent.md](./intent.md).
Repo: `~/Projects/pro-dev-skillset` (private, `jodybrewster/pro-dev-skillset`), main at 299df9e.
Evidence: the kaizen ledger `../../kaizen/2026-10-16.md` (its findings are restated here as checks).
This spec says what must be true when the PR merges.
[plan.md](./plan.md) says how to get there.
Each statement below is checkable by a command, a grep or a file that exists.

## 1. Review policy

- S1.1 `REVIEW.md` exists at the repo root and names three passes in order: bugs, security, compliance.
- S1.2 The security pass covers hook decisions (a hook must block what it was written to block, and a malformed payload must neither crash the user's turn nor wedge the session), secrets and personal paths or emails.
- S1.3 The compliance pass covers the version-bump law, the hook-loading law and Codex parity, each with a link to its ADR.
- S1.4 `REVIEW.md` defines Important (breaks behavior, leaks data or breaches a law above; blocks merge) and caps nits at five.
- S1.5 A do-not-report list names generated and vendored paths: `plugins/pro-spdd/upstream/`, anything under `demo/app/` build output, `node_modules/` and lockfiles.

## 2. Intent folder

- S2.1 `intent/README.md` explains the folder in the playbook shape (one folder per change: intent, spec, plan).
- S2.2 `intent/2026-10-16-channel-basics/intent.md` is this initiative's `intent.md` with status `accepted`.
- S2.3 `intent/2026-10-16-channel-basics/spec.md` and `plan.md` are copies of this folder's files.
- S2.4 The `plan.md` copy is the first commit on the branch, before any other change.

## 3. Decision log

- S3.1 `docs/decisions/` holds `0001-skills-only-history.md`, `0002-version-bump-law.md`, `0003-one-hooks-json-per-plugin.md` and `0004-codex-parity.md`.
- S3.2 Each has Context, Decision, Consequences and Status (`accepted`) headings and a date taken from the git commit where the decision was made (git log shows the hash).
- S3.3 Each ADR links to the code that enforces it (`tests/check.mjs` check names, `RELEASING.md`).
- S3.4 `docs/decisions/README.md` indexes the four with one line each.

## 4. Agent file

- S4.1 `CLAUDE.md` is at most 110 lines (`wc -l`), and `AGENTS.md` is still a symlink to it (`test -L AGENTS.md`).
- S4.2 It has a "Verifying your work" block with the exact commands (`node tests/check.mjs && node tests/eval.mjs --dry`, `claude plugin validate . --strict`, the per-plugin loop) and the expected output (17 checks, 0 failures; `Validation passed`), taken from a real run.
- S4.3 It has a "Things Claude gets wrong" list that includes the eight dead hook files, the worktrunk dependency that broke plugin loading (PR 44) and the stale plugin cache from a missing version bump.
- S4.4 The subagent section moves to `docs/subagents.md` and the private-repo gotchas move to `docs/private-repo.md`; `CLAUDE.md` links to both.
- S4.5 The five root planning documents (`AGENT-SKILLS-INTEGRATION.md`, `CODEX_RECOMMENDATIONS.md`, `MIERUKA_LIFECYCLE_NOTES.md`, `PRO-DEV-LIFECYCLE-PLAN.md`, `QA-SKILLS-BRIDGE-PLAN.md`) are `git mv`ed under `docs/plans/` and none remains at the root.
- S4.6 `docs/README.md` indexes every page under `docs/` with one line each.
- S4.7 Every sentence removed from `CLAUDE.md` is present in exactly one new place: the PR body carries a table (old line range, new file) and a throwaway script run over the old and new text prints `0 missing, 0 duplicated`.
- S4.8 Every relative link in `CLAUDE.md`, `README.md`, `RELEASING.md` and `docs/**/*.md` resolves (a link check prints no broken link).

## 5. Licenses

- S5.1 Each plugin that ships forked or adapted content has `plugins/<name>/LICENSE` with the upstream `Copyright (c) <year> <holder>` line reproduced from the upstream's own LICENSE file, read on GitHub, not guessed.
- S5.2 The six plugins with no LICENSE today (pro-astro, pro-legal, pro-motion, pro-nextjs, pro-research, pro-starter) are each audited; a plugin found to be original gets no LICENSE file and an `original` row in the table.
- S5.3 `docs/licenses.md` has one table row per skill that is not original: plugin, skill, upstream repo, license, copyright holder, how it entered (forked, adapted, bridged or original).
- S5.4 The content of PR 35 (pro-core, pro-testing and pro-pdd LICENSE files), PR 37 (pro-nextjs LICENSE and footers pointing at `vercel/next.js`) and PR 38 (find-skills footer, motion footer, README license list) is in this branch.
- S5.5 PRs 35, 37 and 38 are closed with a comment naming the new PR, after it is open.
- S5.6 pro-motion's origin is recorded: either a row per skill (gsap, hyperframes, remotion) naming the upstream or an `original` row plus the standard footer, with the evidence (git log, search) in the PR body.
- S5.7 `README.md` License section points at `docs/licenses.md` instead of carrying its own list.
- S5.8 Finding: pro-motion's SKILL.md files carry no upstream footer today and were added whole in c4460d3 (2026-06-23).

## 6. You-isms

- S6.1 `git grep -n "/Users/jodybrewster"` prints nothing.
- S6.2 `.claude/commands/research.md` and `lead-research.md` use a path relative to the repo root.
- S6.3 The two README examples (lines 104 and 121) use `<path-to-pro-dev-skillset>`.
- S6.4 `git grep -n "gmail.com"` hits only `author` or `owner` fields in manifests.
- S6.5 The `/Users/ada` and `/Users/test` hits are fictional fixtures and stay.

## 7. Releases

- S7.1 Decision, made here: tagging resumes, so RELEASING.md stays true.
- S7.2 Every plugin has a tag `<plugin>--v<version>` for the version in this branch (after bumps), shown by `claude plugin tag plugins/<name> --dry-run` for each.
- S7.3 `docs/releases.md` has a table (plugin, version, date, what shipped) with a row for each plugin's current version, taken from `git log` for that plugin.
- S7.4 `RELEASING.md` points at `docs/releases.md` and says a release row is added in the same PR as the bump.

## 8. Version bumps

- S8.1 Every plugin whose content changed (footers, LICENSE are content; docs outside `plugins/` are not) is bumped in `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` and its marketplace entry.
- S8.2 `.claude-plugin/marketplace.json` `metadata.version` is bumped once, from 1.42.0.
- S8.3 `node tests/check.mjs versions` and `codex-manifests` pass.

## 9. The gate is green

- S9.1 `node tests/check.mjs` prints 17 checks and 0 failures (warnings are unchanged or fewer).
- S9.2 `node tests/eval.mjs --dry` exits 0.
- S9.3 `claude plugin validate . --strict` and `claude plugin validate plugins/<name> --strict` for all 15 plugins pass.
- S9.4 The PR body pastes the output of each and the `validate` workflow is green on the PR.

## 10. Gate and handoff

- S10.1 Nothing is merged by the executor and no tag is pushed.
- S10.2 The PR body lists the exact `claude plugin tag plugins/<name> --push` commands for Jody to run after merge, one per plugin.
- S10.3 Commit messages carry no co-author lines; prose added follows the hq writing rules.

## Out of scope

- Hook warn mode, a per-hook switch and a decision log for blocking hooks (the next brief).
- `claude plugin eval` suites per hook-bearing plugin (the brief after that).
- Upstream re-sync of the forked skills and dating the quarterly watch.
- Pinning GitHub Actions by SHA, activating the branch ruleset (Jody does that in settings), adding routing cases for the 32 uncovered skills.

## Not fully checkable

- S5.1 and S5.6 depend on reading upstream repos on GitHub; the check is the PR body quoting each upstream LICENSE line with its URL.
- S3.2 dates for ADR-0002 are uncertain until `git log -S` is run; the executor records the commit it found.
