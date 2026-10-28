---
description: "Set up and maintain pro-dev in a repo: check what is installed and stale, install the engines the bridges route to and set the repo up for the intent, spec and plan loop, or update plugins and engines. Usage: /pro-dev [check|install|update]"
argument-hint: "[check|install|update]"
allowed-tools:
  - "Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py status*)"
  - "Bash(python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py\" status*)"
  - "Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py answer*)"
  - "Bash(python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py\" answer*)"
  - "Bash(python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/dream-timer.py\"*)"
  - "Bash(claude plugin list*)"
  - "Bash(claude plugin validate*)"
  - "Bash(git rev-parse:*)"
  - "Bash(git status:*)"
  - "Bash(git branch:*)"
  - "Bash(git log:*)"
  - "Bash(git ls-files:*)"
  - "Bash(ls:*)"
  - "Bash(wc -l*)"
  - "Bash(mkdir:*)"
  - Read
  - Glob
  - Grep
  - Write
  - Edit
---

## Context

- Repo root: !`git rev-parse --show-toplevel 2>&1; true`
- Working tree: !`git status --short --branch 2>&1; true`
- Status: !`python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" status --json 2>&1; true`

Parse the action from `$ARGUMENTS`: `check`, `install` or `update`.
With no argument, run `check`.
This command works from the engine registry at `${CLAUDE_PLUGIN_ROOT}/registry/engines.json`.
`scripts/pro-dev.py` does every deterministic step and this command owns the questions and the file drafting.
Never run an engine install or update by hand; call the script, which runs the registry argv with no shell.
Only `status` and `answer` are pre-approved.
`run`, `plugins` and `stale` prompt the person each time, because they install or change things.
Nothing here installs third-party code except when the person runs `/pro-dev install` or `/pro-dev update`.
Never commit, stage, push or open a PR.

The status JSON lists:

- `plugins`: each pro-dev-skillset install with scope, version, `latest`, `covers` (true when its scope is user or its folder is this repo or inside it) and `lagging`.
- `engines`: each registry row with `state` (`installed`, `missing`, `declined` or `not-applicable`), `needsQuestion`, `why` and `bridges`.
- `aiSdlcInstallPath`: where pro-ai-sdlc is installed, or null.
- `starterShim`: installs of the old `pro-starter` that cover this repo.
- `staleCount`: installs whose project folder no longer exists.
- `tools`: whether `claude` and `npx` are on PATH.

If the status block above is empty or is an error, say so and run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" status` yourself to show the message.
If `tools.npx` is false, tell the person Node.js is needed for the engine installs and stop before running any.

## 1. check (default)

Change nothing.
Never call `run`, `plugins` or `stale --remove` from `check`; those are not pre-approved and prompt on purpose.
Print a short report, then one line naming the next command to run.

- Plugins: a table of each install with `covers` true, with scope, version and latest.
  Flag every one that lags.
  List installs with `covers` false under one line that says they belong to other repos and are left alone.
  Mention `staleCount` when it is above zero and say `/pro-dev update` offers to remove them.
  If `starterShim` is not empty, say `/pro-dev update` offers to swap `pro-starter` for `pro-dev-starter`.
- Engines: a table of each row with its state.
  Say which are default and which are optional.
- Strict validation: for each installed pro-dev plugin that covers the repo, run `claude plugin validate` on its `installPath` from the status JSON and report any failure.
- Router smoke check: confirm `pro-core` exposes the `using-pro-dev` skill, then sanity-route these prompts against the installed skill descriptions and flag any that would resolve elsewhere:
  - "where do I start / what's the workflow" goes to `using-pro-dev`.
  - "is my change working in the browser" goes to `agent-browser` (pro-testing), not a committed-suite skill.
  - "poke holes in my plan for a magic-link login" goes to `security-architect` (pro-security), not a code-review skill.
  - "can I ship this with an AGPL dependency?" goes to `software-counsel` (pro-legal, opt-in), not a security skill.
- Memory consolidation: run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/dream-timer.py" --status` from the repo root.
  Take the interval and the `due:` verdict from its output.
  If the `memory:` line reports none, the project has no auto-memory directory yet; report that as informational.
  When the directory exists, count its memory files with `ls` and measure its `MEMORY.md` with `wc -l`; flag more than 200 lines as needs attention with `/dream dry-run` as the next step.
  Confirm pro-core's installed `hooks/hooks.json` registers `scripts/dream-flag.py` on `Stop` and `scripts/dream-nudge.py` on `SessionStart`; Claude Code loads no other hook file, so a missing entry never fires.
  Recommend `/dream dry-run` when consolidation is due or the index is over budget.
- Mieruka ships its own plugin; mention it only if the repo uses it.
- Verdict: `healthy` or `needs attention`, with the memory line.
- The upstream catalog diffs are not part of `check`.
  Each registry row may carry an `upstream` list of `gh api` lines; run them only if the person asks for `check --upstream`.
  Report a failed call as skipped.

## 2. install

1. Show the engines the run will install: the rows with `wantsInstall` true.
   Say which are skipped because their owner plugin is not installed.
2. Ask about each optional row with `needsQuestion` true, one at a time.
   Give the row `id`, its `why` line and ask yes or no.
   Save each reply with `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" answer <id> yes` or `no`, using the row `id` exactly as the status JSON gives it.
3. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" run all install`.
   It installs every default row that is missing and every optional row answered yes, skips what is installed, records `registryVersion` in `.claude/pro-dev.json` and lists each failure with the command to retry.
   A failure does not stop the run; report each one.
4. Set the repo up for the loop, as in section 4.
5. Run `check`'s engine table again so the person sees what landed.
6. Print what changed and what to commit.
   A second `install` in a row changes nothing and asks nothing, because answers are saved and installed rows are skipped.

## 3. update

Print each step as it finishes.

1. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" plugins update`.
   It refreshes the marketplace, then updates each pro-dev plugin install that covers the repo at its own scope and prints before and after versions.
2. If `starterShim` was not empty, offer to swap `pro-starter` for `pro-dev-starter` at the same scope.
   On yes run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" plugins swap-starter`.
   It installs `pro-nextjs` and `pro-astro` explicitly first when they are installed at that scope, so the site keeps its stack plugins.
3. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" status --json` again, since the registry may have changed with the plugin update.
   Ask about each optional row with `needsQuestion` true, as in install step 2.
4. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" run all update`.
   It updates every installed engine, installs default rows now missing and optional rows answered yes.
   It also records `registryVersion`.
5. If `staleCount` is above zero, run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" stale`, show the list and ask once whether to remove them.
   On yes run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" stale --remove`.
   It writes a backup of `installed_plugins.json` beside the file and removes only pro-dev-skillset entries whose folder is gone.
   If it reports an unexpected file shape, it changed nothing; say so.
6. List every failure from the steps above with the command to retry.
7. End with exactly this line: Restart Claude Code so the updated plugins load.

## 4. Set the repo up for the loop (install only)

This prepares the repo for the loop that `/intent`, `/spec`, `/plan`, `/review` and `/pr-babysit` run.
It writes files and stops.
It never commits, stages, pushes or opens a PR; the person reviews the changes and commits them.
If `aiSdlcInstallPath` is null, skip this section and say in one line that pro-ai-sdlc is not installed so the loop setup was skipped.

### Inspect the repo

Find the stack, the verify command (from the agent file, then `package.json` scripts `check`, `verify`, `validate`, `test`, then Makefile targets, then the language default), the test directories and the generated or protected paths.
Read the agent file if there is one.
Do not read `.env` files.

### Draft the agent file

The target shape is the reference architecture at `ai-sdlc-kit-sample-repo`, a checkout kept beside this one if present, with one departure: `intent/<date>-<slug>/{intent,spec,plan}.md` in one folder instead of flat `specs/` and `plans/`.
If that checkout is not present, use the shape described here.

Write into `CLAUDE.md`, or `AGENTS.md` if that is the repo's file.
If neither exists, create `CLAUDE.md` with the sections below, filled from the inspection and kept under one page.
If the file exists, add only the sections that are missing, change nothing already there and report what differs.

Sections, in this order: Commands (build, test, lint, a single test, e2e if any, each with its healthy output), Verification (run the build, tests and linter before calling anything finished and paste what they print; a failing test means fixing the code), Conventions, Architecture (including "Lifecycle artifacts: intent, then spec, then plan, then PR, see REVIEW.md"), How work flows here and Things Claude gets wrong.
Leave a placeholder in angle brackets for anything the inspection could not find.

The "How work flows here" section says, in short sentences, one per line:

- Work enters through `intent/<date>-<slug>/intent.md`, written by `/intent`.
- `/spec` writes spec.md beside it, `/plan` writes plan.md.
  plan.md is committed before the first change and kept true afterwards.
- The verify command, named exactly, runs before anything is called done.
- For a bug, the failing test is committed before the fix and tests are not edited during the fix.
- `/review` checks the diff against REVIEW.md; findings go to the person and are never a verdict.
- The person merges.
  Agents work up to the gate (branch, PR, green checks, addressed findings) and stop there.
- A "Things Claude gets wrong" list, empty to start, that a mistake flagged twice is added to.

### Create the folders and the review policy

- Create `intent/` with a short `README.md` that says what an intent folder holds (intent.md, spec.md, plan.md), unless `intent/` exists.
- If the repo has no `REVIEW.md`, write one from the template at `<aiSdlcInstallPath>/templates/REVIEW.md`, replacing the generated-files placeholder with the paths found in the inspection.
  If it has one, leave it alone.
- If `.claude/settings.json` does not exist, write team settings: `permissions.allow` for the read-only git commands and the repo's build, test and lint commands.
  Add `permissions.deny` for reading `.env`, `.env.*` and `secrets/` and for forced git pushes.
  If it exists, show the entries to merge and do not edit it.
  The guard hooks are not written here; the plugins supply them.
- Make sure `.gitignore` ignores `.claude/settings.local.json`, `.claude/worktrees/`, `.claude/.fix-task` and `.claude/fix-mode`; append only the missing lines.
- `.claude/pro-dev.json` is meant to be committed so a team shares its optional-engine choices; do not ignore it.

### Report

List each file created or changed with its path.
List each thing left alone because it existed.
Give the verify command found, or say none was found and ask for it.
Remind the person that nothing is committed.
