---
intent: intent/2026-10-28-pro-speckit/intent.md
intent-status: proposed
status: draft
created: 2026-10-28T12:32:06-0400
author: Jody Brewster
---

# Spec: GitHub spec-kit as its own plugin

Built from `intent.md` in this folder (commit 1e6668d).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `RELEASING.md`, `docs/decisions/0001` to `0007` (ADR-0006 and ADR-0007 in particular), `docs/licenses.md`, `docs/codex-parity.md`, the umbrella intent `intent/2026-10-27-pro-dev-simplify/intent.md` and the closest model `intent/2026-10-28-spec-methods/` (intent, spec and plan).
Code read to ground the design: `plugins/pro-egm/` (the glue plugin pattern: manifests, `sdlc-method.json`, `skills/egm-bridge/SKILL.md`, `commands/goldfish.md`), `plugins/pro-ai-sdlc/scripts/methods.py` (the `requires` rule and how offers print), `plugins/pro-spdd/sdlc-method.json` (the one `intent`-stage hand-off), `plugins/pro-core/registry/engines.json` (the `skills-cli`, `npx` and `claude-plugin` row kinds), `plugins/pro-core/scripts/pro-dev.py` (`detected`, `engine_state`, `tool_missing`, `run_engine`, `cmd_run` and the `tools` status field), `plugins/pro-core/commands/pro-dev.md`, `plugins/pro-core/skills/using-pro-dev/SKILL.md` and `tests/check.mjs` (the `registry`, `bridges` and `methods` checks and the `BRIDGES` and `OPT_IN` lists).
No `DESIGN.md`, `SECURITY.md` or compliance skill under `.claude/skills/` exists in this repo.

Upstream facts verified on GitHub with `gh api` on 2026-10-28 against `github/spec-kit` at tag `v1.2.4` (README, `LICENSE`, `pyproject.toml`, `SECURITY.md`, `docs/installation.md`, `docs/install/uv.md`, `docs/upgrade.md`, `docs/integrations/claude.md`, `docs/integrations/codex.md`, `docs/integrations/cli.md`, `docs/reference/core.md`, `templates/commands/`, `src/specify_cli/integrations/claude/__init__.py` and the repo tree):

- The license is MIT with the line "Copyright GitHub, Inc.".
- The latest release is `v1.2.4`, published 2026-10-27; `v1.2.0` to `v1.2.4` shipped between 2026-10-13 and 2026-10-27, five releases in two weeks.
- spec-kit is not a Claude Code plugin: the tree has no `.claude-plugin/` folder and no `marketplace.json`.
- The CLI is the Python package `specify-cli` (console script `specify`), needs Python 3.11 or newer and is installed with `uv` (recommended) or `pipx`.
- The pinned source install is `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z`; PyPI's `specify-cli` is a second official channel.
- Its runtime dependencies are ranges, not pins (for example `typer>=0.24.0`, `rich` with no bound, `mcp>=2.2.0,<3.0.0`); `uv` resolves them from PyPI at install time.
- The wheel bundles its templates, scripts and extensions; `specify init` works offline.
- `specify init --here --integration claude` sets up an existing folder; a non-empty folder also needs `--force` to accept the merge; `--non-interactive` stops it waiting on a picker; `--script sh|ps|py` picks the helper script type.
- `specify init` writes `.specify/` (`memory/constitution.md`, `templates/`, `scripts/bash/*.sh` or the PowerShell or Python variants, `integration.json`, `init-options.json` and a managed `.specify/.gitignore` that ignores `feature.json`).
- The Claude integration writes one skill per core command as `.claude/skills/speckit-<command>/SKILL.md`, invoked as `/speckit-<command>`.
- The core commands at `v1.2.4` are `constitution`, `specify`, `clarify`, `plan`, `tasks`, `analyze`, `checklist`, `implement`, `converge` and the deprecated `taskstoissues`; the README's minimal flow is constitution, specify, plan, tasks, implement, converge.
- `--integration-options="--no-model-invocation"` writes `disable-model-invocation: true` into the core command skills only; extension skills stay model-invocable.
- The integration can write hook handlers into `.claude/settings.json` (SessionStart, PreToolUse, PostToolUse, SessionEnd, UserPromptSubmit and Stop) from integration defaults, installed extensions or `.specify/integration-events.yml`; events are on by default and `--integration-options="--events false"` turns them off and removes hooks it installed earlier.
- The command skills run the shell scripts under `.specify/scripts/` and read extension hooks from `.specify/extensions.yml`.
- Feature work lives under `specs/<NNN>-<feature>/` (`spec.md`, `plan.md`, `tasks.md` and siblings); `SPECIFY_FEATURE_DIRECTORY` or `.specify/feature.json` can point a feature at another folder, with no containment check.
- Git branching moved to an opt-in `git` extension; `specify init` no longer creates branches.
- Updating is two steps: the CLI (`specify self upgrade --tag vX.Y.Z` or `uv tool install specify-cli --force --from git+...@vX.Y.Z`), then the project (`specify integration upgrade claude`, then `specify extension update`).
- Bare `specify self upgrade` moves to the latest release with no prompt.
- `specify integration upgrade` never touches `.specify/memory/constitution.md` and stops when a managed file was edited unless given `--force`.
- Passing `--integration-options` to `upgrade` replaces every stored option; each option to keep has to be repeated.
- `specify integration uninstall claude` removes the unmodified skill files it tracks, keeps edited ones unless given `--force` and leaves `.specify/` in place.
- `specify integration status` reports modified or missing managed files.
- The Codex integration writes `.agents/skills/speckit-<command>/SKILL.md`, invoked as `$speckit-<command>`.

## Summary

A new opt-in plugin `pro-speckit` lets a site try GitHub spec-kit beside pro-ai-sdlc and the other methods, without copying any spec-kit text.
It holds a thin `spec-kit-bridge` skill and an `sdlc-method.json`; pro-ai-sdlc's existing `methods.py` offers spec-kit at `/intent` with no edit to pro-ai-sdlc.
Two new registry rows in pro-core let `/pro-dev install` install the `specify` CLI pinned to one reviewed commit and then, when the person picks it for this repo, add spec-kit's Claude integration with its skills user-invocable only and its hook events off.
`/pro-dev update` reinstalls the CLI only when it is off the pin and runs `specify integration upgrade claude`, which leaves the constitution alone.
`/pro-dev check` never runs `specify`: it reads the CLI's install provenance and hashes spec-kit's generated files against hashes pinned in the registry.
The bridge skill names the removal steps that uninstalling the plugin cannot run by itself.
A feature taken through spec-kit lives where spec-kit puts it, `specs/<NNN>-<feature>/`, linked from its `intent.md`; no spec-kit file replaces or sits beside `spec.md` in the intent folder.
pro-speckit stays out of pro-dev-starter.

## Requirements

### Functional

- R1. A new plugin `plugins/pro-speckit/` ships `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` at the same version with `skills: "./skills/"`, `skills/spec-kit-bridge/SKILL.md`, `sdlc-method.json` and a marketplace entry; it has no hooks, no agents, no commands and no scripts. (intent: "A new pro-speckit plugin that bridges to spec-kit without copying any of it")
- R2. `spec-kit-bridge` says when to reach for spec-kit's flow (constitution, specify, plan, tasks, implement, converge), that `/pro-dev install` installs it, where its output lives (`.specify/` and `specs/<NNN>-<feature>/`), that its skills are user-invocable only so the person types each `/speckit-<command>` and how a spec-kit feature links back to its intent (R12); it carries the review line of R25, quotes no spec-kit text and names `/pro-dev` so the `bridges` check passes. (intent: "It carries a thin spec-kit-bridge skill: when to use spec-kit's flow ... how to install it and where its output lives")
- R3. `spec-kit-bridge` carries the removal steps for a repo: `specify integration uninstall claude`, the note that edited skill files stay unless the person adds `--force`, removing `.specify/` and `specs/` by hand only if the person wants the history gone and `uv tool uninstall specify-cli` to drop the CLI machine-wide. (intent: "Uninstalling the plugin leaves a clear way to remove spec-kit from the project")
- R4. `spec-kit-bridge` gives a Codex user the two commands to run by hand: the pinned `uv tool install` line and `specify init --here --integration codex`, invoked there as `$speckit-<command>`. (constraint: "Codex parity ... spec-kit also has a Codex integration")
- R5. `plugins/pro-core/registry/engines.json` gains a row `specify-cli`: `owner` `pro-speckit`, `bridges` `[]`, `kind` `uv-tool` (Flagged concern 1), `default` `true`, a `note` naming tag `v1.2.4`, `install` `["uv", "tool", "install", "specify-cli", "--exclude-newer", "2026-10-27T18:07:43Z", "--from", "git+https://github.com/github/spec-kit.git@43486672fe826d230d884815be7cc2026469a6ba"]` and `update` the same argv with `--force` after `specify-cli`. (intent: "install the specify CLI pinned to a release"; constraint: "Install a pinned release ... not whatever is latest"; Flagged concerns 1 and 4)
  The pin is the commit SHA of tag `v1.2.4`, never the tag name or the annotated tag object `10640fb7e9a879c47e96b832c2f7484fa940f959`.
  The `--exclude-newer` value is the `published_at` of the reviewed release, read with `gh api repos/github/spec-kit/releases/tags/v1.2.4 --jq .published_at` (2026-10-27T18:07:43Z).
  Every `uv-tool` argv carries `--exclude-newer` and a 40-character commit in `--from`; a pin move changes the SHA, the timestamp and the R20 hashes in one commit.
- R6. The registry gains a second row `spec-kit`: `owner` `pro-speckit`, `bridges` `["spec-kit-bridge"]`, `kind` `uv-tool`, `default` `false` (proposed, Flagged concern 2), `detect` `{ "all": [ { "file": "skills/speckit-specify/SKILL.md", "scopes": ["project"] } ] }`, `install` `["specify", "init", "--here", "--force", "--non-interactive", "--script", "sh", "--integration", "claude", "--integration-options=--no-model-invocation --events false"]`, `update` `["specify", "integration", "upgrade", "claude", "--integration-options=--no-model-invocation --events false"]` and the `pinnedFiles` map of R20; it sits after `specify-cli` in the file and the registry `version` goes up by one. (intent: "then add the Claude integration to the project"; constraint: "Add the Claude integration with --no-model-invocation"; Flagged concerns 2 and 5)
  With `default` `false`, `/pro-dev install` lists the row unticked and runs it only when the person picks it for this repo, so a user-scope pro-speckit never writes spec-kit files into a repo set up for another engine.
  The leading `specify` in both argvs is replaced at run time by the absolute path of R24.
- R7. `pro-dev.py` detects the `specify-cli` row without running `specify`: it runs `uv tool dir`, reads `specify-cli/lib/python*/site-packages/specify_cli-*.dist-info/direct_url.json` under it and counts the row as installed only when `url` is `https://github.com/github/spec-kit.git` and `vcs_info.commit_id` equals the pinned SHA. (intent: "pinned to a release"; Flagged concern 3)
  A missing file or another commit reads as `missing` for install and as `installed` with a `versionDrift` field for status and update.
  `update` on this row is a no-op that prints "specify-cli: at pin" when the commit matches, so dependencies are not resolved again.
- R8. `pro-dev.py` skips the `spec-kit` row with "spec-kit: needs specify-cli first" when the `specify-cli` row is not installed at the pin (R7); `run all` then never runs `specify init` or `specify integration upgrade` with an old or missing CLI. (Flagged concern 2)
- R9. Before running the `spec-kit` row's `install`, `pro-dev.py` refuses with a one-line reason when `.specify/` already exists in the repo or the working tree has uncommitted changes; `specify init --force` then never merges over unsaved work or an existing spec-kit setup. (Flagged concern 5)
- R10. The status JSON's `tools` field gains `uv`; when a row of the new kind is wanted and `uv` is missing, `/pro-dev` prints how to install `uv` from its official docs and never runs an installer for it. (intent open question 2; Flagged concern 7)
- R11. `/pro-dev check` never runs `specify` and `/pro-dev` pre-approves no `specify` command; spec-kit's own `specify integration status` is not called, because it trusts `.specify/integrations/*.manifest.json`, which the repo can rewrite. For a repo with the `spec-kit` row installed `check` runs R20 to R23, reports each finding as `needs attention` and changes nothing. (Flagged concern 6)
- R12. pro-speckit's `sdlc-method.json` declares `method` `spec-kit`, `requires` `null` and one `intent` hand-off whose `when` says the feature can run through spec-kit instead of `/spec` and `/plan`, that the person types the command and that `/pro-dev check` should be clean first; its `offer` is `/speckit-specify {target}`; when the person takes it, the feature's spec-kit folder is linked from `intent.md` and the intent folder gets no `spec.md` or `plan.md`. (umbrella: "Installing or uninstalling a spec-method plugin changes what pro-ai-sdlc routes to with no other edits"; ADR-0007 consequence; Flagged concerns 8, 9 and 10)
- R13. No file under `plugins/pro-ai-sdlc/` changes. (ADR-0007: "intent E's spec-kit plugin is the second method and must fit this contract unchanged")
- R14. `tests/check.mjs` accepts `uv-tool` in the `registry` check and fails a `uv-tool` row whose `install` or `update` lacks `--exclude-newer` or a 40-character commit in `--from`, or whose `pinnedFiles` holds a value that is not 64 hex characters; it adds `spec-kit-bridge` to `BRIDGES` and `pro-speckit` to `OPT_IN`; pro-speckit is not a dependency of pro-dev-starter. (intent: "it stays out of pro-dev-starter")
- R15. `tests/pro-dev.mjs` gains cases with fake `uv` and `specify` on `PATH`, where the fake `specify` writes a marker file when run:
  CLI missing installs with the pinned SHA and `--exclude-newer` argv;
  a `direct_url.json` with another commit reports drift and update reinstalls;
  a matching commit makes update a no-op;
  `spec-kit` skipped while the CLI is missing and not run when not picked;
  `spec-kit` install refused with `.specify/` present, with a dirty tree and with `specify` on `PATH` outside `uv tool dir --bin`;
  `uv` missing prints the docs line and runs nothing;
  `check` reports a pinned script changed together with its manifest hash, a core skill without `disable-model-invocation: true`, each R22 path, a `.claude/settings.json` hook calling `specify`, a tracked `.specify/feature.json` and one pointing outside `specs/`;
  `status` and `check` leave no marker file.
- R16. `tests/methods.mjs` gains a case: pro-speckit installed prints its `intent` offer with the target filled in and nothing for `spec`, `plan` or `review`.
- R17. `docs/licenses.md` gains the row `pro-speckit | spec-kit-bridge | [github/spec-kit](https://github.com/github/spec-kit) | MIT | Copyright GitHub, Inc. | bridged`.
- R18. `tests/cases/routing.jsonl` gains at least one case expecting `spec-kit-bridge`; the `using-pro-dev` router names pro-speckit on the spec branch beside pro-egm and pro-spdd.
- R19. pro-speckit starts at `0.1.0`; pro-core takes a minor bump for the rows, the new kind and the router line; pro-dev-starter takes a patch bump because it depends on pro-core; `metadata.version` goes up once. (version-bump law)
- R20. The `spec-kit` row's `pinnedFiles` maps each repo-relative path the pinned CLI writes with the row's pinned options under `.claude/skills/speckit-*/SKILL.md`, `.specify/scripts/**` and `.specify/templates/**` to its sha256. `pro-dev.py check` hashes those paths on disk with `hashlib` without running `specify`; it reports each changed or missing file and each extra file under those globs. (Security challenge; Flagged concern 6)
  The hashes come from running the pinned install in two clean temporary repos on different machines (or a machine and CI); only files byte-identical in both are pinned and plan.md lists any left out.
  `.specify/memory/constitution.md`, `.specify/integrations/*.manifest.json` and `specs/**` are never pinned.
- R21. `check` reads the frontmatter of each core skill `.claude/skills/speckit-<command>/SKILL.md` for the `v1.2.4` core commands and reports any without `disable-model-invocation: true`. (Security challenge; constraint: "Add the Claude integration with --no-model-invocation")
- R22. `check` reports as needing attention any of `.specify/extensions.yml`, `.specify/extensions/`, `.specify/presets/`, `.specify/workflows/`, `.specify/integration-events.yml` and `.specify/integrations/packages/`, plus any hook in `.claude/settings.json` whose command calls `specify`, whoever added it. (Security challenge; out of scope: extensions and presets)
- R23. `check` reports a `.specify/feature.json` that `git ls-files` tracks or whose `feature_directory` resolves outside the repo's `specs/`; it also reports a `SPECIFY_FEATURE_DIRECTORY` in its own environment that does the same. (Security challenge; ADR-0007)
- R24. `pro-dev.py` runs every `specify` argv by the absolute path `<uv tool dir --bin>/specify`; before running one it resolves `specify` on `PATH` and refuses with a one-line reason when it resolves to a different real path. (Security challenge; Flagged concern 3)
- R25. `spec-kit-bridge` says these are reviewed like code in a PR: `.specify/scripts/`, `.specify/templates/`, `.claude/skills/speckit-*/`, the R22 extension, preset and workflow paths, `.claude/settings.json` hooks, `.specify/feature.json`, `.specify/memory/constitution.md` and `specs/**/tasks.md`. (Security challenge; Flagged concern 6)
- R26. pro-speckit ships `commands/install.md` (`/pro-speckit:install`), which runs `pro-dev.py run <id> install` for the `specify-cli` and `spec-kit` rows only, with the same pins, checks and refusals as `/pro-dev install`; its `allowed-tools` holds only that exact script pattern. (Jody, 2026-10-28: "the individual plugins can all have installers")

### Non-functional

- N1. Nothing spec-kit installs or updates runs except from `/pro-dev install` or `/pro-dev update` run by the person; no hook, plugin update or session start runs a row. (intent: "The person runs every install; nothing installs on plugin update or session start")
- N2. With pro-speckit not installed, `/pro-dev` output, `methods.py` output and every pro-ai-sdlc command behave exactly as on `main` at bc7c3ef.
- N3. `/pro-dev update` leaves `.specify/memory/constitution.md` byte-for-byte unchanged and never passes `--force` to `specify integration upgrade`. (intent success line)
- N4. No row argv calls bare `specify self upgrade`, `uvx` without a pin or any `curl | sh` installer.
- N5. `pro-dev.py status` and `check` stay read-only and never execute `specify`; they run only `uv tool dir` and `git` and read files; only `run` calls `specify` (R11, R24).
- N6. The new `pro-dev.py` code uses only `python3` and the standard library and passes every argv with no shell, as the existing rows do.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-speckit (new), pro-core (registry, `pro-dev.py`, router) and pro-dev-starter bump both manifests and their marketplace entries in one commit, with `metadata.version` once (R19).
- Hook-loading law (ADR-0003): pro-speckit ships no `hooks/hooks.json`; spec-kit's own event hooks in the target repo's `.claude/settings.json` are turned off by `--events false` (R6).
- Codex parity (ADR-0004): pro-speckit is skill-bearing and ships a version-aligned `.codex-plugin/plugin.json` and harness-neutral bridge prose; registry installs stay Claude only until umbrella item G and the bridge gives the Codex commands (R4).
- ADR-0006 engine registry: spec-kit installs only through registry rows run by `/pro-dev`; pro-speckit ships no install command.
- ADR-0007 spec methods: pro-speckit ships an `sdlc-method.json`, pro-ai-sdlc is untouched (R13) and no spec-kit file replaces `spec.md` or `plan.md` (R12).
- No hard dependency on another marketplace (PR 44): spec-kit is not a plugin and appears in no manifest `dependencies` array.
- Bridges over vendoring: the bridge names spec-kit's commands and folders and copies none of its templates; no plugin `LICENSE` is needed (R17).
- REVIEW.md pass 2: no new hook in this repo; argv only, no shell strings (N6); no home-directory path in the plugin or docs.
- REVIEW.md pass 3: `docs/licenses.md` gains the bridged row; the new row kind and the CLI-row rules come with an ADR (Flagged concerns).
- RELEASING.md: each bumped plugin gets its `docs/releases.md` row and a tag after merge.
- Writing rules from `CLAUDE.md`: no em dashes, no Oxford comma, straight quotes, one sentence per line in Markdown.

## Design

### User experience

A site that wants to try spec-kit installs `pro-speckit@pro-dev-skillset`, then runs `/pro-dev install`.
`/pro-dev` lists two rows: `specify-cli` ticked with its pinned tag and `spec-kit` unticked with its why line, asked for this repo.
If `uv` is missing it says so, links uv's install page and stops before either row.
Otherwise it installs the CLI with `uv tool install` at the pinned commit, then, if the person picked `spec-kit`, runs `specify init --here` for Claude in the repo by the CLI's absolute path, which needs no `.specify/` yet, a clean working tree and no other `specify` first on `PATH`.
The new files under `.specify/` and `.claude/skills/speckit-*/` are left uncommitted for the person to review and commit.

From then on `/intent` ends with one extra offer: "spec-kit: run this feature through spec-kit instead of /spec and /plan; type /speckit-specify intent/<date>-<slug>/intent.md".
The person types it, spec-kit writes `specs/<NNN>-<feature>/spec.md` and the person adds a "spec-kit:" link line to `intent.md`.
The person carries on with `/speckit-plan`, `/speckit-tasks`, `/speckit-implement` and `/speckit-converge`.
They run `/speckit-constitution` once per repo.
Declining the offer leaves the loop exactly as today.

`/pro-dev update` reinstalls the CLI only when its commit is off the pin and runs `specify integration upgrade claude`; if a managed spec-kit file was edited it stops and says which.
The constitution is never touched.
`/pro-dev check` shows the CLI's installed commit against the pin and lists any pinned spec-kit file that changed, any core skill the model can invoke, any extension, preset or `specify` hook and any feature pointer outside `specs/`.
To stop using spec-kit the person uninstalls pro-speckit and follows the removal steps in the bridge skill; the offer at `/intent` disappears with the plugin.

### System

New:

- `plugins/pro-speckit/`: two manifests, `skills/spec-kit-bridge/SKILL.md`, `sdlc-method.json` and a marketplace entry (R1 to R4, R12).

Changed:

- `plugins/pro-core/registry/engines.json`: the `specify-cli` and `spec-kit` rows with the `pinnedFiles` map and a version bump (R5, R6, R20).
- `plugins/pro-core/scripts/pro-dev.py`: the `uv-tool` kind with its `direct_url.json` detect, the order rule between the two rows, the pre-install refusals, the absolute-path call and `PATH` check, `tools.uv`, a `uv` line in `tool_missing` and the on-disk checks in the check path (R7 to R11, R20 to R24); its docstring names `uv tool install` as a second user-wide write.
- `plugins/pro-core/commands/pro-dev.md`: the `uv` stop line beside the `npx` one and the check lines for R20 to R23, with no `specify` command pre-approved (R10, R11).
- `plugins/pro-core/skills/using-pro-dev/SKILL.md`: the pro-speckit line (R18).
- `tests/check.mjs`, `tests/pro-dev.mjs`, `tests/methods.mjs`, `tests/cases/routing.jsonl` (R14 to R16, R18).
- `docs/licenses.md`, `docs/releases.md`, `README.md`, `.claude-plugin/marketplace.json` (R17, R19).

The two-row split reuses `cmd_run`, which walks rows in file order; the CLI installs before `specify init` runs.
`detected()` already handles the `spec-kit` row through `detect.all` with a project-scope file under `.claude/`; only the CLI row needs the new detect.
`methods.py` needs no change: `requires` must be a plugin id or `null` and spec-kit is not a plugin; pro-speckit sets `null` and the `when` text points at `/pro-dev install` for a repo without the skills (Flagged concern 9).
pro-ai-sdlc's `/review` still reads `intent.md`; for a spec-kit feature the reviewer follows the link line to `specs/<NNN>-<feature>/`.

### Alternatives considered

- A pro-speckit install command (the intent's first open question): no longer needed, since `/pro-dev` merged in PR 65; ADR-0006 rules out per-plugin install commands.
- One row whose `install` is a list of argvs: keeps the CLI and the project step together but widens the row shape for every kind; two rows and an order rule reuse what `cmd_run` already does.
- A `kind: npx`-style row running `uvx --from git+...@<pin> specify init`: no persistent CLI to drift; `/pro-dev update` then has no CLI to upgrade and every `uvx` run resolves dependencies again.
- `specify self upgrade --tag <pin>` as the update argv: spec-kit's own path; it runs the old binary to replace itself; the `uv tool install --force` line is the same step spelled out and needs only `uv`.
- Pointing `SPECIFY_FEATURE_DIRECTORY` at the intent folder so spec-kit writes `spec.md` and `plan.md` there: one folder per feature; it overwrites or competes with pro-ai-sdlc's own `spec.md` (ruled out by ADR-0007) and the variable has no containment check.
- Hand-offs at `/plan` to `/speckit-tasks` or `/speckit-analyze` over our own spec and plan: inside the contract; spec-kit's commands expect their own template sections; worth a later intent after a live try.
- Leaving spec-kit's hook events on: matches its default but lets spec-kit and its extensions write Stop and PreToolUse hooks into the repo's `.claude/settings.json`.
- Vendoring spec-kit's templates as plugin skills: ruled out by bridges over vendoring and by its weekly release pace.

## Flagged concerns

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | spec-kit fits none of the three row kinds: `tests/check.mjs` accepts only `skills-cli`, `npx` and `claude-plugin`, `tool_missing` knows only `claude` and `npx` and the status `tools` field has no `uv`. | ADR-0006, `tests/check.mjs`, `plugins/pro-core/scripts/pro-dev.py`, Jody | settled 2026-10-28 (Jody): a new `uv-tool` row kind, recorded in ADR-0008. It runs `uv tool install` from GitHub pinned to commit `43486672fe826d230d884815be7cc2026469a6ba` (tag `v1.2.4` in the row `note`) with `--exclude-newer` set to the reviewed release date; update is a no-op when the installed copy already matches the pin; `/pro-dev` never installs `uv` and says how to get it when it is missing. The ADR names `uvx` with no shared install as the fallback if two repos on different pins keep downgrading each other. |
| 2 | Setup is two dependent steps (CLI, then `specify init`) and a row has one `install` argv with no way to say one row needs another. | ADR-0006, Jody | settled 2026-10-28 (Jody): two rows in file order, `specify-cli` then `spec-kit`, with the fixed rule that skips `spec-kit` until the CLI is at the pin (R8). `spec-kit` runs with no question when pro-speckit is installed at project or local scope for this repo, since that install is the yes; it is asked once per repo for a user-scope install. It refuses a dirty tree or an existing `.specify/` either way. pro-speckit ships `/pro-speckit:install`, which runs only its own rows through `pro-dev.py`, under the per-plugin installer rule of intent `2026-10-28-plugin-installers` (R26). |
| 3 | `detect` reads files under `.claude/` or a plugin id; it cannot see a CLI on `PATH` or its version; running `specify version` from the pre-approved `status` would execute third-party code on every check. | ADR-0006, `plugins/pro-core/commands/pro-dev.md`, Jody | open: proposed detecting the CLI by `vcs_info.commit_id` in its `direct_url.json` under `uv tool dir`, never by running it (R7); `status` and `check` never execute `specify` (R11, N5); `run` calls it by absolute path and refuses another `specify` on `PATH` (R24). |
| 4 | Pinning: a git tag can be moved upstream, the CLI's dependencies are open ranges resolved from PyPI at install time and spec-kit shipped five releases in two weeks; a tag pin both drifts and does not fix what runs. | intent constraint "Install a pinned release", REVIEW.md pass 2, Jody | settled 2026-10-28 with concern 1: the commit SHA, not the tag, plus `--exclude-newer`. |
| 5 | `specify init --here --force` merges into a non-empty repo and can overwrite files, while `/pro-dev` runs it from a registry argv with no prompt of its own. | REVIEW.md pass 2, `plugins/pro-core/commands/pro-dev.md` ("Never commit"), Jody | open: proposed refusing when `.specify/` exists or the tree is dirty (R9), running the row only when the person picks it for this repo (R6) and by the pinned CLI's absolute path (R24); every change it makes is a reviewable diff that `check` then compares with the registry hashes (R20). |
| 6 | spec-kit writes executable surface into the repo: `.specify/scripts/*.sh` that its skills run, extension hooks in `.specify/extensions.yml` that its skills honor and, with events on, hooks in `.claude/settings.json`; on a contributor's branch any of these can change. | REVIEW.md pass 2, Jody | open: proposed `--events false` on install and update (R6); `check` hashes core skills, scripts and templates against the registry pin without running `specify` (R11, R20), asserts `disable-model-invocation: true` (R21), flags extension, preset, workflow and `specify` hook paths (R22) and flags a tracked or escaping `feature.json` (R23); the bridge names what is reviewed like code (R25). |
| 7 | `uv tool install` writes outside the repo (uv's tool folder and a `specify` shim on `PATH`), while `pro-dev.py` says its writes stay inside the repo except the ADR-0007 marketplace step. | `plugins/pro-core/scripts/pro-dev.py` docstring, ADR-0007, Jody | open: proposed accepting it as a second named user-wide write in the docstring and the ADR; `uv` itself is never installed by `/pro-dev` (R10). |
| 8 | Where a spec-kit spec lives: intent C settled that no method replaces `spec.md`, while spec-kit's whole flow writes its own `spec.md`, `plan.md` and `tasks.md` under `specs/<NNN>-<feature>/`. | ADR-0007, intent C Flagged concern 2, Jody | open: proposed a feature runs through one loop or the other; a spec-kit feature keeps `intent.md` with a link line and its spec-kit folder stays where spec-kit writes it, following pro-spdd's `intent`-stage precedent (R12). |
| 9 | `methods.py` takes `requires` only as a plugin id; it cannot print "needs /pro-dev install" when the repo lacks spec-kit's skills; the offer then points at a missing `/speckit-specify`. | ADR-0007, `plugins/pro-ai-sdlc/scripts/methods.py`, Jody | open: proposed `requires: null` with the `when` text naming `/pro-dev install`, which keeps pro-ai-sdlc untouched (R12, R13); a file-based `requires` would change pro-ai-sdlc and wait for its own intent. |
| 10 | `--no-model-invocation` stops the model from running `/speckit-*` skills, while ADR-0007 hand-offs are offered as a yes or no the model then acts on. | intent constraint, ADR-0007, Jody | open: proposed the offer tells the person to type the command (R12, R2); the constraint stays as the intent wrote it. |
| 11 | The success line wants "no spec-kit skills behind" after removal; `specify integration uninstall` keeps edited skill files unless given `--force`; uninstalling a plugin cannot run any step. | intent success line, Jody | open: proposed the bridge names the uninstall step and when `--force` is needed (R3) and the acceptance check runs on unedited skills (AC5). |

ADR needed: yes (ADR-0008).
It widens ADR-0006's row shape and sets how a method whose upstream is not a plugin fits ADR-0007.
Not drafted yet; 0008 is the next free number in `docs/decisions/`.
It must decide:

- The `uv-tool` row kind, pinned to a commit SHA with `--exclude-newer` at the reviewed release's timestamp and an update that is a no-op at the pin (settled by Jody, concerns 1 and 4).
- The dependency-range risk that remains under `--exclude-newer` (Jody's decision).
- That a CLI row is detected from uv's `direct_url.json` and never by running the CLI; rows call it by absolute path (R7, R24).
- That `check` proves integrity from hashes pinned in the registry and never runs a third-party CLI (R11, R20).
- The order rule between rows and a repo-writing row that defaults to false (concern 2, open).
- `uv tool install` as a second named user-wide write (concern 7, open).
- Whether the CLI stays shared machine-wide or runs through `uvx` with no shared install (open for Jody).
- What raising a pin reviews and who signs it off (open for Jody).
- That a method whose upstream is a CLI ships `requires: null` and states its prerequisite in the hand-off text (concern 9, open).

## Security challenge

From a fresh-context `security-architect` challenge of this spec on 2026-10-28, run with Opus at high effort.
It read the upstream source at `v1.2.4` without running it.

Verdict: proceed with required changes; nothing blocking.

### Required changes

- [8/10] A tag is not a pin: anyone who can push to `github/spec-kit` can move `v1.2.4`. Pin the commit `43486672fe826d230d884815be7cc2026469a6ba`, not `10640fb7e9a879c47e96b832c2f7484fa940f959`, which is the annotated tag object; put the tag name in the row `note`. (Settles open question 4.) Answered by R5.
- [7/10] Dependencies resolve fresh from PyPI on every install and update (`rich` unbounded, the `mcp` tree and the unpinned `hatchling` build backend, which runs during the git build). Add `--exclude-newer <timestamp of the reviewed release>` to both argvs, make the CLI row's update a no-op when the installed copy already matches the pin and record the remaining range risk in ADR-0008 as Jody's decision. Answered by R5 and R7; the range risk is listed for ADR-0008.
- [8/10] R11's `specify integration status` compares files with `.specify/integrations/*.manifest.json`, which the repo itself can rewrite: a PR can change `.specify/scripts/bash/create-new-feature.sh` and its hash together so `/pro-dev check` reports clean. Copy ADR-0007's pin: the `spec-kit` row stores, in the registry, the sha256 of every file the pinned CLI writes with the pinned options; `pro-dev.py` hashes them on disk without running `specify` and `check` reports any difference. Answered by R20 and R11.
- [8/10] `--no-model-invocation` is dropped by later commands that rewrite skills, such as `specify preset add` and `specify integration use`, with fresh manifest hashes. The model could then start `/speckit-implement` from injected text. The registry pin above catches it; `check` also asserts `disable-model-invocation: true` in each core skill. Answered by R20 and R21.
- [7/10] Extension hooks are an instruction channel: `specify.md` treats a hook in `.specify/extensions.yml` with no `enabled` field as enabled and says a mandatory hook "MUST" be invoked. Extensions are out of scope, so `check` reports as needing attention any `.specify/extensions.yml`, `.specify/extensions/`, `.specify/presets/`, `.specify/workflows/`, `.specify/integration-events.yml`, `.specify/integrations/packages/` or a `.claude/settings.json` hook that calls `specify`. The bridge's "review like code" line names these plus `.specify/memory/constitution.md` and `specs/**/tasks.md`. Answered by R22 and R25.
- [7/10] R7 checks uv's copy of the CLI, but `run_argv` runs the first `specify` on PATH, which upstream warns can be another install. Read provenance from the tool venv's `specify_cli-*.dist-info/direct_url.json` and require `vcs_info.commit_id` to equal the pin; call `specify` by its absolute path in `uv tool dir --bin` and refuse when PATH resolves it elsewhere. Answered by R7 and R24.
- [7/10] `default: true` on the `spec-kit` row lets a user-scope pro-speckit write scripts and skills into any repo where `/pro-dev install` runs for some other engine. Make `spec-kit` `default: false`, or refuse it unless pro-speckit is installed at project or local scope for this repo; `specify-cli` can stay default. Answered by R6 (`default: false`, proposed under Flagged concern 2).
- [6/10] (verify) R11 does not say whether the `specify integration status` call is pre-approved; if it were, plain `/pro-dev` would run the CLI and its dependencies with no prompt. The registry pin removes the call; if it stays, it is not pre-approved. Answered by R11 and N5: the call is dropped.
- [5/10] (verify) A committed `.specify/feature.json` or `SPECIFY_FEATURE_DIRECTORY` can point spec-kit's scripts at `intent/<slug>/` or outside the repo, over the files ADR-0007 protects. `check` flags a tracked `feature.json` or one whose `feature_directory` leaves `specs/`. Answered by R23.

### Open questions from the challenge

- Are the files spec-kit generates byte-identical across machines for one version and option set? The registry pin needs that; if not, which subset can be pinned? Answered by R20: only files byte-identical across two clean installs are pinned.
- The CLI is shared by every repo on the machine, so two repos on different pins downgrade each other on update. Accept that in ADR-0008, or run `uvx --from git+...@<sha> --exclude-newer <ts> specify` with no shared install? Open for Jody.
- With five releases in two weeks, what does raising a pin review? Who signs it off? Open for Jody.
- Does `specify integration upgrade claude --integration-options="... --events false"` remove hooks an extension or a bare `specify init` added, or only its own? Answered by R22: `check` flags any `.claude/settings.json` hook that calls `specify`, whoever added it.
- Should the `/intent` offer's `when` text tell the person to run `/pro-dev check` first? Answered by R12.

Controls that already hold: registry argvs run with no shell, R9 refuses a dirty tree or an existing `.specify/`, `--events false` is set on install and update, N5 keeps `status` from running `specify` and uv tool commands ignore project `uv.toml` and `pyproject.toml`.

## Open questions

1. Intent B's `/pro-dev` is not built yet; does E wait for it? Answered: no wait. B merged in PR 65 (commit 97558ea, marketplace 1.51.0) and the registry, `pro-dev.py` and `/pro-dev install|update|check` exist on `main`; no temporary command is needed.
2. Does the setup install `uv` or only tell the person? Still open, proposed answer: only tell, with a link to uv's install docs (R10), because uv's own installer is `curl | sh` and the umbrella forbids third-party installs the person did not run. Owner: Jody.
3. spec-kit keeps its specs under `specs/<n>-<feature>/` while pro-ai-sdlc uses `intent/`; where does the line fall? Still open, proposed answer in Flagged concern 8: one loop per feature, linked from `intent.md`. Owner: Jody.
4. Which reference to pin, the `v1.2.4` tag or its commit SHA (Flagged concern 4)? Answered 2026-10-28 (Jody): commit `43486672fe826d230d884815be7cc2026469a6ba` with `--exclude-newer` (R5).
5. Whether `/pro-dev update` also runs `specify extension update`: the core flow needs no extension and the intent puts extensions out of scope; this spec leaves it out. Owner: Jody.

## Acceptance criteria

- AC1. On a clean test repo with `uv` present: install `pro-speckit@pro-dev-skillset` at project scope, run `/pro-dev install` and pick `spec-kit`; the CLI's `direct_url.json` carries the pinned commit, `.claude/skills/speckit-specify/SKILL.md` exists with `disable-model-invocation: true`, `.claude/settings.json` has no spec-kit hook and `/pro-dev check` reports both rows installed.
- AC2. In that repo `/speckit-constitution`, `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` and `/speckit-implement` each run when typed in Claude Code and write under `.specify/memory/` and `specs/<NNN>-<feature>/`.
- AC3. `/intent` in that repo ends with the spec-kit offer naming the new `intent.md`; with pro-speckit uninstalled the offer is gone and nothing else in `/intent` changed.
- AC4. After editing `.specify/memory/constitution.md` and committing, `/pro-dev update` runs the CLI and integration steps and the constitution's hash is unchanged.
- AC5. After `claude plugin uninstall pro-speckit@pro-dev-skillset` and the bridge's removal step on unedited skills, no `.claude/skills/speckit-*` folder remains.
- AC6. `/pro-dev install` with `uv` missing prints the uv docs line and runs no row; with `.specify/` already present or a dirty tree it refuses the `spec-kit` row with its reason.
- AC7. `git diff --stat bc7c3ef -- plugins/pro-ai-sdlc` is empty on the PR branch.
- AC8. `node tests/check.mjs && node tests/eval.mjs --dry`, `claude plugin validate . --strict` and the per-plugin strict loop pass, with the R15 and R16 cases green.
- AC9. No text in `plugins/pro-speckit` is copied from spec-kit; `docs/licenses.md` has the pro-speckit row.
- AC10. In the AC1 repo, editing `.specify/scripts/bash/create-new-feature.sh` and its hash in `.specify/integrations/*.manifest.json` together makes `/pro-dev check` report the script; so do removing `disable-model-invocation: true` from a core skill, adding `.specify/extensions.yml` and committing `.specify/feature.json`; no `specify` process runs during `check`.
- AC11. With a second `specify` earlier on `PATH`, `/pro-dev install` and `/pro-dev update` refuse the `spec-kit` row and name both paths.

## Out of scope

- How pro-ai-sdlc routes between installed methods beyond the one `sdlc-method.json` (intent C, ADR-0007).
- spec-kit extensions, presets, bundles, workflows and its bug and assessment processes.
- Installing spec-kit for Codex from the registry (umbrella item G).
- Hand-offs at `/plan` or `/review` into spec-kit commands.
- Installing `uv` or Python.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
