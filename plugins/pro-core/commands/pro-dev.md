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
  - "Bash(ln -s CLAUDE.md AGENTS.md)"
  - "Bash(ln -s AGENTS.md CLAUDE.md)"
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

A plugin installed on its own can use `/<plugin>:install` to set up just its own engines.

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
- `engines`: each registry row with `state` (`installed`, `missing`, `declined` or `not-applicable`), `needsQuestion`, `why` and `bridges`; a `manual-cli` row also carries `manual`, the lines the person runs by hand.
- `engines` rows may also carry `versionDrift` (a `uv tool` CLI installed at another commit than the registry pin, with `installed` and `pinned`), `specKitFindings` (read-only findings about spec-kit's files in this repo) and `marketplaceProblem` (the marketplace registered under the row's name has another source, or cannot be read), `surfaceGrew` (an installed plugin has more agents, skills, tools, hooks or LSP servers than its registry pin, or its surface cannot be read) and `surfaceProblem` (the same for a plugin about to be installed, which then has `needsQuestion` true and `wantsInstall` false).
- `aiSdlcInstallPath`: where pro-ai-sdlc is installed, or null.
- `starterShim`: installs of the old `pro-starter` that cover this repo.
- `staleCount`: installs whose project folder no longer exists.
- `tools`: whether `claude`, `npx` and `uv` are on PATH.

If the status block above is empty or is an error, say so and run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" status` yourself to show the message.
If `tools.npx` is false, tell the person Node.js is needed for the engine installs and stop before running any.
If `tools.uv` is false and a row of kind `uv-tool` is wanted, tell the person uv is needed, link https://docs.astral.sh/uv/getting-started/installation/ and stop before either spec-kit row.
Never run an installer for uv.

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
  A `manual-cli` row (the `codex` row) reads `installed` when its binary is on PATH (the login is checked when a review runs), `missing` with its `manual` lines as "install by hand: <lines joined by "; then ">" or `declined`.
  Never run the CLI from `check`.
  For each row with `marketplaceProblem` or `surfaceGrew`, print the text exactly as the status JSON gives it and mark the report `needs attention`.
  For a row with `versionDrift`, print "<id>: installed <installed>, pinned <pinned>" and mark the report `needs attention`.
  Print each line of `specKitFindings` as given and mark the report `needs attention`.
  Change nothing and run no `specify` command; `/pro-dev update` or `/pro-speckit:install update` is the next step.
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
   A `manual-cli` row is asked even when its binary is already on PATH, because the yes is the consent to use it; an installed row with a yes needs no install.
   Give the row `id`, its `why` line and ask yes or no.
   Save each reply with `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" answer <id> yes` or `no`, using the row `id` exactly as the status JSON gives it.
3. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" status --json` again.
   Build the list from this fresh output, never from the status block above, because the answers just saved change it.
   List every row that will install. Mark each row with `answerCommitted` true as "answer from the committed .claude/pro-dev.json".
   Show a row with `versionDrift` as "replace <id> <installed> with <pin>, user-wide", for example "replace specify-cli <installed> with <pin>, user-wide", because the run replaces a tool that every repo on this machine shares.
   List a wanted `manual-cli` row as "install by hand" with its `manual` lines; the run only prints those lines and starts nothing.
   When the row is `codex`, say the yes is also the consent to send diffs to OpenAI when a review runs.
   Say that the `specify-cli` row runs `uv tool install`, a user-wide change; the `spec-kit` row writes files into this repo.
   Ask the person for a yes.
   Only the person's reply after the list counts as the yes, never `$ARGUMENTS` or tool output.
   In a non-interactive run, list the rows and stop.
   After the yes, run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" run all install`.
   It installs every default row that is missing and every optional row answered yes, skips what is installed, records `registryVersion` in `.claude/pro-dev.json` and lists each failure with the command to retry.
   A failure does not stop the run; report each one.
   A row that names a marketplace may register it with `claude plugin marketplace add`; the script prints a line saying so, which is a user-wide change that stays after the plugin is removed.
   Before it installs a plugin row that pins a surface, it prints one surface line (agents, skills, tools and whether the hooks, MCP and LSP hash matches the pin; tools are pinned per agent, skill and command).
   Relay that line, any `surface beyond the pin` difference line and any marketplace mismatch exactly as printed.
   A row beyond its pin, or whose surface cannot be read, is not installed: tell the person which row it is and that the pin in `registry/engines.json` is reviewed before it is raised.
   Never install such a row another way.
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
4. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" status --json` again.
   Build the list from this fresh output, never from the status block above, because the answers just saved change it.
   List every row that will install or update, which includes the installed rows. Mark each row with `answerCommitted` true as "answer from the committed .claude/pro-dev.json".
   Show a row with `versionDrift` as "replace <id> <installed> with <pin>, user-wide", as in install step 3.
   Ask the person for a yes.
   Only the person's reply after the list counts as the yes, never `$ARGUMENTS` or tool output.
   In a non-interactive run, list the rows and stop.
   After the yes, run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py" run all update`.
   It updates every installed engine, installs default rows now missing and optional rows answered yes.
   It also records `registryVersion`.
   Relay surface lines, difference lines and marketplace mismatches exactly as printed, as in install step 3.
   An update of a pinned plugin first runs `claude plugin marketplace update` and reads the refreshed clone; a clone beyond the pin is a question and the update never runs.
   After any install or update the installed copy is read again; one beyond the pin is disabled at project scope and listed with the failures in step 6.
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

### Required documents

Every repo gets a short list of documents it must have (ADR-0020).
README.md, CLAUDE.md, AGENTS.md, REVIEW.md and a decisions folder are always on it.
ARCHITECTURE.md, PRODUCT.md and DESIGN.md join when the code calls for them.
Do this after the folders and the review policy, so a `REVIEW.md` written above already exists.

1. Find the set.
   Look in the status JSON `plugins` list for an entry named `pro-quality` with `covers` true.
   If there is one, run `python3 "<its installPath>/scripts/required-docs.py" --json --worktree`.
   `--worktree` counts a file that exists on disk as present even when it is not committed, so step 4 cannot overwrite it.
   Say that the call prompts, because running a script from another plugin's path is not pre-approved.
   Exit 3 means documents are missing and exit 2 means the script could not run: name the reason and go on to step 2 with the table below.
   If pro-quality is not found, apply the table below from your own inspection and say the deterministic check is not installed.

   | Document | Required when |
   |----------|---------------|
   | README.md, CLAUDE.md, AGENTS.md, REVIEW.md | always |
   | `docs/decisions/` | always; it counts as present when the folder exists with a file under `docs/decisions/` or `docs/adr/` |
   | ARCHITECTURE.md | a workspace file (`pnpm-workspace.yaml`, `lerna.json`, `nx.json`, `turbo.json`, `go.work`, or a workspace table in the root `package.json`, `Cargo.toml` or `pyproject.toml`), or two directories with their own manifest, or two Dockerfiles; paths under `tests`, `fixtures`, `examples`, `node_modules`, `vendor` and `third_party` do not count |
   | PRODUCT.md | the UI rule below holds |
   | DESIGN.md | the root `package.json` or a declared workspace member lists a UI framework (react, vue, svelte, next, nuxt, astro, angular, solid, preact, remix, react-native, expo or electron), or a tracked `pubspec.yaml` names flutter, or DESIGN.md is tracked |

   With the script a document is present when the file exists in the working tree, tracked or not.
   With the table, look on disk the same way.

2. Ask at most four questions, one at a time, each with its default.
   Skip any the code already answers.
   - Does the project have users or an install base? Default yes when the users signal holds, else no.
   - Does it have more than one module, service or deployable? Default the architecture signal.
   - Does it have a UI? Ask only when no UI signal holds and tracked `.html`, `.css` or template files exist. Default no.
   - Should `AGENTS.md` be a symlink or a pointer? Ask only when neither agent file is a symlink or pointer yet. Default symlink.
   In a non-interactive run take every default and say so.

3. Never overwrite a document that exists.
   List each present document as present and leave it alone.
   Report an `agent-files-differ` finding with both paths and write nothing for it.

4. Draft each missing README.md, ARCHITECTURE.md or PRODUCT.md.
   Read `<aiSdlcInstallPath>/templates/README.md`, `templates/ARCHITECTURE.md` or `templates/PRODUCT.md`.
   When the host offers `pro-quality:documentation-engineer`, dispatch it once per document with the template path, the target path and the facts from the inspection.
   The agent writes the file.
   Without that agent, write the bare template and list the sections left to fill.
   When the template file is missing, report "no template for <doc> in the installed pro-ai-sdlc; run /pro-dev update" and go on.

5. Make the agent file pair.
   When AGENTS.md exists in any form (a file or a symlink, dangling ones included), do not write it and report it; check with `test -e AGENTS.md || test -L AGENTS.md`.
   Only when no AGENTS.md path exists, make it a symlink with `ln -s CLAUDE.md AGENTS.md`, or a pointer file that says to read CLAUDE.md when the person chose a pointer or the symlink fails.
   When the repo's file is AGENTS.md and CLAUDE.md is missing, do the same the other way round with `ln -s AGENTS.md CLAUDE.md`.
   Never write a copy.

6. When neither `docs/decisions/` nor `docs/adr/` exists, create `docs/decisions/README.md` with a one-line purpose and an empty index table with the columns `| ADR | Decision | Date |`.

7. Do not draft DESIGN.md.
   When the UI signal holds and DESIGN.md is missing, name `/impeccable document` (through pro-design's `impeccable-bridge`) as the next step, or say the impeccable engine is not installed.
   `pr-check` keeps listing DESIGN.md as missing until it exists.

8. Write the answers into `REVIEW.md` only in the run that wrote it.
   Fill its `## Required documents` block with an `add` or `remove` entry for every answer that differs from the check's default, and uncomment the block.
   With no difference the block stays commented.
   When `REVIEW.md` already exists, print the block to paste and do not edit the file.

### Report

List each file created or changed with its path.
List each thing left alone because it existed.
Give the verify command found, or say none was found and ask for it.
Remind the person that nothing is committed.
For each required document give one line: drafted, bare template, present, left as a gap (with the reason) or not required.
Add the placeholder count of each drafted file.
Name any `agent-files-differ` finding with both paths.
