# Plan: the channel passes its own bar

Read [spec.md](./spec.md) first; every step cites the statements it satisfies (S1.1 and so on).
You are an Opus session in `~/Projects/pro-dev-skillset`.
Subagents you spawn run on Sonnet; give each the file paths and the exact change, since it cannot see this plan.
Your job ends at an open PR.
You do not merge, push tags or edit `~/Projects/hq`.

## Rules for prose you add

- No em dashes (use a plain dash), no Oxford comma, no comma before a conjunction joining two clauses, straight quotes only, no emojis.
- Sentence-case headers, one sentence per line in Markdown, no bolded lead-ins, no filler openers.
- Commit messages: conventional style as in `git log`, no co-author lines.
- A pro-core hook (git-safe) blocks a Bash command whose text contains push or merge against main, even inside a heredoc; when that happens, write the file with the Write tool instead of a heredoc and do not bypass the hook.

## Step 0: set up

1. Read `.claude/settings.local.json` and run `claude plugin list` in the repo, so you know which hooks will fire.
   Expect pro-quality (docs-before-push on `git push`) and pro-security (commit-gate on `git commit`) when enabled.
   When a hook blocks or gives an instruction, follow it (update the docs, run the review it asks for).
   Never bypass it with `--no-verify` or by editing its settings.
2. `git fetch origin`, then `git worktree add -b channel-basics ../pro-dev-skillset.channel-basics 299df9e`, and work only in that worktree.
   If `origin/main` has moved, say so in the PR and rebase before opening it.
3. This plan is already committed in hq, so plan mode is not needed; read it in full, then write nothing else until step 1 is committed.

## Step 1: commit the brief (S2.4)

1. Create `intent/2026-10-16-channel-basics/` with `intent.md`, `spec.md` and `plan.md`, copied verbatim from `~/Projects/hq/initiatives/2026-10-17-channel-passes-its-own-bar/`.
   Set the intent's status to `accepted` if it says otherwise.
2. Commit as `docs(intent): the channel's first intent, spec and plan`.

Proof: `git log --oneline` shows this as the first commit above 299df9e.
## Step 2: REVIEW.md (S1.1 to S1.5)

1. Create `REVIEW.md` shaped like `~/Projects/gemini-live-nextjs/REVIEW.md` (read it): intro, Pass 1 bugs, Pass 2 security, Pass 3 compliance, What Important means, Nits, Do not report.
2. Pass 2 lists: hook scripts under `plugins/*/scripts/` (a blocking decision is deny or block with a reason, and a malformed payload must not crash a user's turn), secrets (prefixes for AWS, Anthropic, GitHub, Slack and private keys), absolute personal paths and emails outside manifest author fields.
3. Pass 3 lists the three laws and links the ADRs that step 4 creates; write the links now and check them in step 6.

Proof: `wc -l REVIEW.md` and a read-through against S1.
## Step 3: you-isms (S6)

1. Replace `/Users/jodybrewster/Projects/pro-dev-skillset/plugins/...` in `.claude/commands/research.md` (lines 16 and 38) and `lead-research.md` (line 18) with `plugins/pro-research/skills/lead-research/scripts` relative to the repo root, and say "run from the repo root".
2. README lines 104 and 121: use `<path-to-pro-dev-skillset>`.
3. Also fix `plugins/pro-spdd/PORT-PLAN.md` line 142 (`PLUGIN=$PWD/plugins/pro-spdd`) and the comment at `templates/codex-bootstrap.sh` line 11.
   `MIERUKA_LIFECYCLE_NOTES.md` line 422 is fixed after the move in step 6.
4. Leave `/Users/ada` (dream SKILL.md) and `/Users/test` (pro-spdd upstream fixtures); they are fictional.

Proof: `git grep -n "/Users/jodybrewster"` prints nothing at the end of step 6, and `git grep -n "gmail.com"` hits manifests only.

## Step 4: decision log (S3)

Create `docs/decisions/` with `README.md` (index) and four ADRs, each with Context, Decision, Consequences, Status (accepted) and Date.
Verify every date and hash with `git log` before you write it.
- 0001 skills-only history: the repo started skills-only on 2026-05-24 (f0887bd) and hooks arrived 2026-06-07 (da0f024, PR 18).
  Decision: skills first, then hooks, commands and agents only where deterministic triggering beats description matching.
- 0002 the version-bump law: source is `CLAUDE.md` and `RELEASING.md`.
  Find the commit that introduced it with `git log -S"version-bump law" --format='%h %ad %s' -- CLAUDE.md RELEASING.md` (earliest hit; fall back to f0887bd and say so).
  Enforced by `node tests/check.mjs versions`.
- 0003 one `hooks/hooks.json` per plugin: 2026-07-26, 8597453 (PR 34), eight dead hook files in pro-core, pro-data and pro-quality.
  Enforced by `node tests/check.mjs hooks`.
- 0004 Codex parity is a hard requirement: earliest commits f689820 and 29c0a98 (2026-05-24); agent parity came later (find it with `git log -S"codex-plugin/agents"`).
  Enforced by the codex-parity, codex-manifests and agents checks.

Proof: S3.1 to S3.4 by listing the folder and `grep -c "^## " docs/decisions/000*.md`.
## Step 5: licenses (S5)

1. Read the three open PRs for exact content: `gh pr view 35 --repo jodybrewster/pro-dev-skillset --json body,files` and `gh pr diff 35`, same for 37 and 38.
   Apply them.
   PR 35 adds LICENSE content for pro-core (find-skills from vercel-labs/skills, Copyright (c) 2026 Vercel, Inc.), pro-testing (Paul Razvan Berg 2025, Peter Knezek 2026) and pro-pdd (Addy Osmani 2025, ADHD contributors 2026, a lavish bridge note).
   PR 37 adds a pro-nextjs LICENSE crediting `vercel/next.js` (MIT, Copyright (c) 2025 Vercel, Inc.) and repoints the footers on next-best-practices, next-cache-components and next-upgrade (they say "Adapted from vercel-labs/next-skills" today).
   PR 38 makes the find-skills footer visible, adds the original footer to the pro-design `motion` skill and fixes the README license list.
   Do not trust the PR text: read each upstream's LICENSE (`gh api repos/<owner>/<repo>/license`) and copy the copyright line as written.
2. Audit the six plugins with no LICENSE: pro-astro, pro-legal, pro-motion, pro-nextjs, pro-research, pro-starter.
   Search footers, plugin.json descriptions, README mentions and `git log` for upstreams.
   pro-motion: no SKILL.md in gsap, hyperframes or remotion names an upstream and the plugin arrived whole in c4460d3 (2026-06-23).
   Run `git log --follow` on each file, read the commit body and compare the text with upstream candidates.
   If you find an upstream, add its LICENSE and a footer.
   If not, add the standard footer (`_Original skill for pro-dev-skillset (Jody Brewster). MIT License._`) and put "no upstream found, evidence: <what you searched>" in the PR.
3. Write `docs/licenses.md`: one row per non-original skill (plugin, skill, upstream repo, license, copyright holder, how it entered) and one summary row per fully original plugin.
   Seed it from the README License section and the RELEASING.md upstream watch lists.
   vercel-labs/agent-browser is Apache-2.0; include its NOTICE if it has one.
4. Replace the README License bullet list with two sentences and a link to `docs/licenses.md`.

Proof: `ls plugins/*/LICENSE`, the table and `git grep -n "Copyright (c)" plugins/*/LICENSE`.
## Step 6: agent file and docs (S4)

1. `git mv` the five root planning documents to `docs/plans/` with the same file names.
   Write `docs/plans/README.md` with one line per document and its status (read the first 20 lines of each).
2. Move the "Use subagents to parallelize" section to `docs/subagents.md` and "Private repo gotchas" to `docs/private-repo.md`.
   Move the long hook-loading and Codex parity detail into `docs/hook-loading.md` and `docs/codex-parity.md`, which the ADRs link to, and keep a one-line rule for each in `CLAUDE.md`.
3. Rewrite `CLAUDE.md` to about 100 lines (limit 110): what the repo is, the model split (Opus orchestrates, Sonnet subagents), the three laws as one line each with ADR links, the layout cheatsheet, "Verifying your work", "Things Claude gets wrong" and links to `REVIEW.md`, `RELEASING.md` and `docs/`.
   Run the verify commands first and paste real output into the block: `node tests/check.mjs && node tests/eval.mjs --dry` (expect 17 checks, 0 failures), `claude plugin validate . --strict`, then the per-plugin loop.
   Mistakes list: the eight dead hook files, the worktrunk dependency (PR 44, 4337f0a), the stale cache after a missing bump and the `*` cross-marketplace dependency note.
   Keep `AGENTS.md` as the symlink and do not touch it.
4. Write `docs/README.md` indexing everything under `docs/`.
5. Moved-sentence proof (S4.7): save the old text with `git show 299df9e:CLAUDE.md` to a temp dir outside the repo.
   Write a throwaway script outside the repo that splits the old text into sentences and counts each in the new `CLAUDE.md` plus the new docs pages.
   It must print `0 missing, 0 duplicated`; list any deliberate rewrite in a table in the PR.
   Paste the line-range table (old lines, new file) in the PR body.
   Also run a relative-link check over `CLAUDE.md`, `README.md`, `RELEASING.md`, `REVIEW.md` and `docs/` (S4.8).
6. Fix `MIERUKA_LIFECYCLE_NOTES.md` line 422 in its new place.

Proof: `wc -l CLAUDE.md` (at most 110), `test -L AGENTS.md`, the script output and the link check.
## Step 7: releases (S7) and version bumps (S8)

Do this last, after all content edits.
1. Bump versions per `RELEASING.md` in the manifests: `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and the `.claude-plugin/marketplace.json` entry.
   Expect patch bumps for pro-core (LICENSE, find-skills footer), pro-testing, pro-pdd, pro-design (motion footer), pro-nextjs (LICENSE, footers) and any plugin that gains a LICENSE or footer in step 5.
   Do not bump for docs outside `plugins/`.
   A bump across a minor needs the constraint cascade from RELEASING.md; a patch bump does not.
   Bump `metadata.version` once from 1.42.0 (to 1.42.1 unless a minor was crossed), and bump `pro-starter` only if a dependency constraint changed.
2. Write `docs/releases.md` (plugin, version after the bump, date, what shipped) from `git log -- plugins/<name>` and the plugin's older tags.
   Add a line to `RELEASING.md` that a release row is added in the same PR as the bump, and link the table.
3. Run `claude plugin tag plugins/<name> --dry-run` for all 15 plugins and keep the output.
   Do not run it with the push flag.
4. Commit in logical groups (review policy, decisions, docs move, licenses, you-isms, bumps and releases).
   The pre-commit and docs-before-push hooks may ask for doc updates; do them.

Proof: `node tests/check.mjs versions` and `codex-manifests` pass.
## Step 8: verify and open the PR (S9, S10)

1. Run and keep the full output of `node tests/check.mjs`, `node tests/eval.mjs --dry`, `claude plugin validate . --strict` and the per-plugin loop.
   Fix any failure before continuing and do not edit tests to make them pass.
2. Push the branch with upstream tracking, then run `gh pr create --base main` with a HEREDOC body containing:
   - a summary in three sentences;
   - a checklist of every spec statement (S1.1 to S10.3), ticked, with the proof next to each;
   - "Supersedes #35, #37 and #38" with one line on what was carried over from each;
   - the moved-sentences table, the pro-motion evidence and the upstream LICENSE lines you copied with their URLs;
   - the tag commands for Jody after merge, one per plugin at the bumped version: `claude plugin tag plugins/<name> --push -m "<name> v%s"` (all 15);
   - the verify output, pasted;
   - the footer `Generated with [Claude Code](https://claude.com/claude-code)`, with no co-author line.
3. Wait for the `validate` workflow and fix it if red.
4. Close the old ones: `gh pr close 35 --comment "Superseded by <new PR URL>"`, then 37 and 38.
   Do not delete their branches.

## Stop

Do not run `gh pr merge` (the production-gate hook asks; answer no), do not push tags and do not activate the branch ruleset.
Report the full PR URL, the check results and any statement you could not satisfy, then stop.
