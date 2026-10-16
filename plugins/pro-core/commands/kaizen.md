---
description: "Raise the bar. Compare a planning repo's tracked projects against what has become standard practice since the last run (AI-native SDLC, Claude Code features, hooks, skills, agents, evals, security), judge each project against its own profile, red-team it, then leave one improvement applied, the next ones briefed, a dated ledger entry and an HTML report with the per-project matrix. Run from a planning repo that holds STATUS.md and coverage.md; /kaizen init scaffolds one. Usage: /kaizen [init <repo> ... | focus]"
argument-hint: "[init <repo-path> ... | focus, e.g. hooks | evals | security | release]"
allowed-tools: Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, Skill, Artifact, Bash(git *), Bash(claude --version), Bash(claude --help:*), Bash(ls:*), Bash(cat:*), Bash(gh pr list:*), Bash(gh release list:*), Bash(gh api repos/*/rulesets*), Bash(gh api repos/*/branches/*/protection*)
disable-model-invocation: true
---

# Kaizen

Run from the planning repo: the layer above the product repos where every stream's status, the cross-repo briefs and the coverage matrix live.
The current working directory is the planning repo when it holds both `STATUS.md` and `coverage.md`.
This command writes only to the planning repo and, for an adopt-now change, to the user's Claude Code configuration.

Parse the first token of `$ARGUMENTS`:

| Token | Mode |
|---|---|
| `init` | INIT, with the remaining tokens as the repos to track |
| *(empty)* | RUN over the whole setup |
| anything else | RUN with `$ARGUMENTS` as the focus |

In RUN mode, if `STATUS.md` or `coverage.md` is missing, say that this is not a planning repo yet, point at `/kaizen init <repo-path> ...` and stop.

## INIT

Create only what is missing and never overwrite a file that exists.
Each token after `init` is a repo to track: a local path or `owner/name` for a repo read through `gh` only.
Its column name in the matrix is the last path segment.
If no repo is named, ask once which repos to track and stop, since that cannot be decided from here.

1. `STATUS.md`, this skeleton:

   ```markdown
   # Status

   Read this first in any new session.
   Update it whenever a stream moves: a PR opens or merges, an agent finishes, a decision is made.

   ## How to resume

   1. Read this file.
   2. For a stream, read its brief (linked below), then check its branch with `git log` and `git status`; the on-disk state is the truth, not this file.
   3. Background agents do not survive a session; restart from the brief and the last commit on the branch.

   ## Stack rank

   1. (what matters most and why)

   ## Streams

   ### <repo>

   Where it stands, the open PRs and the next step.
   ```

   with one `###` entry under "Streams" per named repo.

2. `coverage.md`: a title, one line naming the cell states (merged, PR, branch, briefed, missing, enforce, warn, n/a, unchecked), a matrix with one column per named repo and these rows, every cell `unchecked`:

   - Intent, spec, plan chain
   - ADRs
   - CLAUDE.md one page, verify block, mistakes list
   - REVIEW.md
   - Production gate hook
   - Test protection, env guard hooks
   - Repo policy hooks
   - Policy skills
   - Agents
   - Agent-config evals
   - Branch protection
   - CI on PRs
   - Stage 6 loop
   - Release tracking

   Below the matrix, a "Where the repos live" list with one line per column: the column name and the path or `owner/name` it was given.

3. `kaizen/README.md`: one paragraph: the folder holds one ledger and one report per `/kaizen` run, dated; each run reads the newest ledger first so the bar only moves up; `profiles.md` says what the bar means for each column.

4. `kaizen/profiles.md`: one entry per named repo, each a `##` heading with the column name and these five fields left for the user to fill in:

   - Kind: what sort of project this is.
   - Serves: who uses it and for what.
   - At stake: what a failure here would cost and to whom.
   - What good looks like for this kind: the practices that make up the bar for this project.
   - Rows that do not apply: the coverage rows marked `n/a` for this column, each with a one-line reason.

   Close the file with an HTML comment holding three example kinds, so a new user sees how far profiles differ:

   - A user configuration directory: no git, no ADRs and no CI apply; hooks, settings, memory and portability are the bar.
   - A public framework repo: the full playbook set applies, plus supply chain (licenses, pinned dependencies, signed releases).
   - A private app over live data: deterministic gates on every write path and personal data kept out of tracked files.

Report the files created and the files left alone.
Say that the first `/kaizen` run fills the `unchecked` cells from evidence once the profiles are written.

## RUN

Focus: `$ARGUMENTS` (optional; empty means the whole setup).

### 1. Where the bar is today

Read, in this order: `STATUS.md`, `coverage.md`, `kaizen/profiles.md`, `adoption-roadmap.md` and `learning.md` when they exist, the newest ledger under `kaizen/` (if none, this is run one) and the stage of the AI-native SDLC playbook the focus touches.
For the playbook, read the text if the planning repo keeps a copy under `playbook/`; otherwise read this command's own summary of the six stages and their measurements at `${CLAUDE_PLUGIN_ROOT}/references/sdlc-stages.md`.
Note the date of the previous run; everything in step 2 is measured against it.

Every column of `coverage.md` is judged against its profile, never against one universal checklist.
A user configuration directory, a public framework and a private app over live data have different bars.
If a column has no profile in `kaizen/profiles.md`, write one from what the repo shows (README, manifests, deploy config, visibility) before judging it.
Name it in the ledger as inferred so the user can correct it.

### 2. Where the bar has moved

Spend the research on four questions, bounded to what changed since the previous run:

1. Claude Code itself: run `claude --version` and compare with the version in the previous ledger; read the changelog and release notes (the Claude Code docs and the GitHub releases) for new hook events, settings keys, permission features, agent and skill capabilities, sandboxing, plan mode and headless flags. Anything that makes a current workaround unnecessary is a finding.
2. The AI-native SDLC: Anthropic's engineering posts and docs on agentic development, evals, review and governance since the previous run plus what practitioners converged on. When the focus is broad and a community-research skill such as `last30days` is installed, use it for community signal.
3. The specific focus, when one is given: the state of the art for that area (for example PreToolUse policy hooks, agent eval harnesses, supply-chain checks for public repos, release automation).
4. The measurements the playbook names for each stage, read from the repos named as columns in `coverage.md` with git and gh: intents created, time from intent commit to PR, PRs merged by a human rather than an agent, hooks in enforce versus warn, eval runs, incidents that became evals. Record the numbers; do not read a single data point as a trend.

Prefer primary sources.
Note the date and URL of each claim.
If the network is down, say so and do steps 1, 4 and 5 only.

### 3. The gap

For each finding, decide one of: adopt now, brief, watch, reject.
Name the reason in one sentence.
Apply the open-source rule from the user's CLAUDE.md when it has one.
In any case apply its one-line test: would a stranger cloning this repo share it?
A practice that would put personal or client data, or one person's machine paths and habits, into a tracked file is rejected.
Apply the adoption rules from `adoption-roadmap.md` when it exists; otherwise use these defaults: advisory before deterministic, one enforced change a week at most, changes ride on real work.

### 4. Raise it

- Adopt now: at most one change this run, only in the planning layer or in configuration that is reversible in one edit: the user's Claude Code configuration under `~/.claude` (with a dated backup beside any file touched), `coverage.md`, `kaizen/profiles.md`, `adoption-roadmap.md`, a memory note or a brief's text. Never product code, never a merge, never a hook flipped to enforce unless its roadmap trigger has passed and the ledger says so.
- Brief: each item that needs an execution session becomes `initiatives/<date>-<slug>/intent.md` in the playbook shape, with `status: draft`, plus one line in `STATUS.md`.
- Watch: one line each in the ledger with what would change the decision.
- Update `coverage.md` cells that moved since the previous run, from evidence (merged PRs, files present), not from memory. A row the column's profile lists as not applying is `n/a`, never `missing`.

### 5. Red-team each project

For every column in `coverage.md` (plus the user's Claude Code configuration as its own entry when it is not already a column), take three adversarial stances shaped by that column's profile and write what each would exploit today, with the file or setting that proves it:

- An attacker: secrets or personal data reachable in tracked files, hooks still in warn mode, a missing branch ruleset, a public endpoint without its limits, a dependency or vendored skill without a license or pin, a deploy path with no rollback.
- An auditor using the playbook's governance questions per stage: what is enforced, what the evidence is, where it is logged, who approves. Any stage whose answer is "a sentence in CLAUDE.md" and nothing deterministic behind it is a finding.
- An incident: the first thing that goes wrong in production or in a headless agent run and whether anything would notice (control bands, alerts, the audit log, a test that would have caught it).

Then, per project, the three actions that raise its bar the most for the least effort, measured against its profile's "what good looks like", ranked, each tied to a roadmap phase or a new brief.
Severity is one of critical, important, nit, using the planning repo's `REVIEW.md` definitions when it has one (otherwise: critical breaks behaviour, leaks data or breaches a policy now; important will do so under a plausible change; nit is style).
Weight severity by the profile's "at stake": the same gap can be critical for a private app over live data and a nit for a scratch repo.

### 6. The report

Write `kaizen/<YYYY-MM-DD>.html`, self-contained, authored to the artifact design rules (load the `artifact-design` skill first if it is available and not already in context): a `<title>` of two to four words, colour tokens on `:root` with a dark variant, body background set, readable at phone width with no horizontal scroll, scripts only from cdnjs if any at all; no personal data, client names or secrets in it, since it may be shared. Sections, in order:

1. The bar: Claude Code version, previous run date, the five measurements that changed.
2. The matrix: rows are the concepts from `coverage.md`, columns are the projects, each cell coloured by state (merged, PR, branch, briefed, missing, enforce, warn, n/a) with a one-word label and a tooltip naming the evidence, plus a legend for every state. The same grid as `coverage.md`, so the two never disagree.
3. Red team, one card per project: its profile's kind and at-stake line, the three stances, each finding with severity and proof, then the three ranked actions.
4. What moved since the last run and what was adopted now.
5. Briefs created this run, linked by path.

Publish it with the Artifact tool as a private page (icon: chart) and update the same artifact URL on later runs if one is recorded in the ledger, so the report has one stable link.
Put the URL in the ledger and in the chat summary.
If the harness has no Artifact tool, keep the HTML file and say so in the summary.

### 7. The ledger

Write `kaizen/<YYYY-MM-DD>.md` (create the folder on run one) with: Claude Code version, the previous run's date, the measurements, the findings table (finding, source and date, decision, reason), the red-team findings per project with severity, any profile written or inferred this run, what was adopted now, what was briefed, what is watched, the report's artifact URL and one line "next run should look at".
Follow the planning repo's Markdown and writing rules (its CLAUDE.md or AGENTS.md) when it has them; otherwise put one sentence per line.
Commit the planning repo with `kaizen: <date>, <one-line summary>`, following the user's commit attribution rules.
End with a six-line summary in chat: what moved, what was adopted, what was briefed, the measurements that changed, the most severe red-team finding per project and the report URL with the ledger path.

## What this command never does

It does not spawn agents, change product code in the repos named as columns in `coverage.md` (it reads them), merge, deploy, publish code or ask the user to choose between options it can decide; it decides, names the decision and moves on.
It raises the bar by one notch per run, on purpose.
