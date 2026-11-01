# ADR-0008: A pinned `uv-tool` row kind for spec-kit's CLI, checked without running it

Date: 2026-10-28

## Status

proposed

## Context

GitHub spec-kit is not a Claude Code plugin.
It is a Python CLI, `specify`, installed with `uv` and run to write `.specify/` and `.claude/skills/speckit-*/` into a repo.
ADR-0006's registry knows only the `skills-cli`, `npx` and `claude-plugin` row kinds, so it had no way to install or detect it.
spec-kit shipped five releases in two weeks; a git tag can be moved upstream and the CLI's dependencies are open ranges resolved from PyPI at install time.
The files it writes include shell scripts its skills run.
spec-kit's own `specify integration status` trusts manifest hashes that the repo itself can rewrite.
The maintainer is new to spec-kit and wants plain slash commands with every safety check built in.
Source: intent/2026-10-28-pro-speckit/.

## Decision

The registry gains a `uv-tool` row kind for a Python CLI installed with `uv tool install`.
A `uv-tool` row pins a 40-character commit SHA in `--from`, never a tag.
It carries `--exclude-newer` set to the reviewed release's `published_at`.
The tag name goes in the row `note`.
`update` on such a row is a no-op while the installed copy matches the pin, so dependencies are not resolved again.

`pro-dev.py` detects a `uv-tool` CLI from uv's `direct_url.json` under `uv tool dir` and counts it as installed only when `vcs_info.commit_id` equals the pin.
The row names this detection in `detect.uvTool`.
`uv-receipt.toml` stores `exclude-newer` and the `rev`, so detection also matches both to the row.
A second `specify_cli-*.dist-info` folder reads as drift.
It never runs the CLI to learn its version.
Step 0 showed that `uv tool upgrade` and `uv tool upgrade --all` change nothing on a pinned install.
It also showed that reinstalling another commit and then the pin replaces the install without `--force`.
It runs the CLI only from `run`, by the absolute path `<uv tool dir --bin>/specify`.
It refuses when `specify` on `PATH` resolves to a different real path.

spec-kit takes two rows in file order: `specify-cli` installs the CLI and `spec-kit` sets up the repo.
The `spec-kit` row carries `needs: "specify-cli"`, so it is skipped until that row is installed with no drift, read fresh when the row is about to run.
The `needs` rule sits inside `run_engine`, so a pasted retry line cannot bypass it.
The row defaults to false, so a user-scope pro-speckit never writes into a repo set up for another engine.
It carries `writesRepo: true`, the registry field that triggers the repo-write gates at run time: it refuses a dirty working tree or an existing `.specify/` and refuses a symlink on any path `init` writes.
`tests/check.mjs` fails any `uv-tool` row whose argv[0] is not `uv` and that lacks `writesRepo: true`, so a later row cannot skip the gate.
Its `install` passes `--ignore-agent-tools`, because `specify init` exits 1 with nothing written when `claude` is not on `PATH` and the row already names `--integration claude`.

The `spec-kit` row stores in the registry a `pinnedFiles` map: the sha256 of every file the pinned CLI writes with the pinned options under `.claude/skills/speckit-*/`, `.specify/scripts/` and `.specify/templates/`.
`init` writes 30 files and the map pins 22 of them: the 10 core skills, the 6 scripts, the 5 templates and `.specify/workflows/speckit/workflow.yml`.
The two `.specify/integrations/*.manifest.json` files and `.specify/workflows/workflow-registry.json` differ between repos only in timestamps, so they sit in the row's `knownUnpinned` list instead.
`knownUnpinned` is an array of repo-relative paths under `.specify/`; `/pro-dev check` treats them as expected, so the workflow and integration surface it reports does not flag them.
The constitution, `.specify/integration.json`, `init-options.json`, `.specify/.gitignore` and `.constitution-template.json` are byte-identical across repos but are not pinned: the constitution is the user's to edit and the rest hold no executable content.
The 27 byte-identical files held across three repos on one Mac; two runs of the final pinned command in fresh repos gave the same 22 hashes; the Linux comparison was not run.
`specify integration upgrade` does not stop on an edited script: it keeps the edit, names it and exits 0.
The update never passes `--force`.
`pro-dev.py` names the 10 core skill names in code (`SPEC_KIT_CORE`), so moving the pin to a release that renames, adds or drops a command also updates that list in the same PR.
An edited script therefore survives an upgrade and the hash check in `/pro-dev check` is what catches it.
`/pro-dev check` hashes those files on disk with the standard library and never runs `specify`; it also reports extension, preset, workflow and `specify` hook paths and a feature pointer outside `specs/`.
The constitution, spec-kit's own manifests and `specs/` are never pinned.

`uv tool install` is a second named user-wide write, after ADR-0007's marketplace step, recorded in the `pro-dev.py` docstring.
`/pro-dev` never installs `uv`; when it is missing it says how to get it from uv's docs.
The CLI is shared machine-wide.
If two repos on different pins keep downgrading each other, the fallback is `uvx` with the same pin and no shared install.

Raising a pin is a reviewed PR that moves the SHA, the `--exclude-newer` timestamp and the `pinnedFiles` hashes together, signed off by the maintainer.
The dependency ranges that `--exclude-newer` still leaves open are a risk the maintainer accepts.

A method whose upstream is a CLI ships `requires: null` in its `sdlc-method.json` and states its prerequisite in the hand-off text.
pro-speckit ships `/pro-speckit:install` and `/pro-speckit:remove`; `/pro-speckit:install update` replaces a separate update command.
The install command runs only pro-speckit's own rows through `pro-dev.py`, so every check above runs inside it.

## Consequences

A new Python CLI engine fits the registry with a row and no new code.
What runs is fixed by commit and date.
`check` catches a changed script even when its manifest hash was changed with it.
Every pin move costs a review and a fresh set of hashes, which spec-kit's release pace makes frequent.
Repos on one machine share one CLI, so the pin in the newest installed registry wins.
Reverse it if spec-kit's frequent releases keep breaking the pinned setup: drop pro-speckit and its rows and let anyone who wants spec-kit run it by hand.

## Enforced by

- [`plugins/pro-core/registry/engines.json`](../../plugins/pro-core/registry/engines.json) holds the `specify-cli` and `spec-kit` rows (to be built).
- [`plugins/pro-core/scripts/pro-dev.py`](../../plugins/pro-core/scripts/pro-dev.py) detects the CLI from `direct_url.json`, runs it by absolute path and hashes `pinnedFiles` in `check` (to be built).
- [`tests/check.mjs`](../../tests/check.mjs) fails a `uv-tool` row without `--exclude-newer` or a 40-character commit, with a malformed `pinnedFiles` hash or key, with a `needs` that names no earlier row of the same owner, or with a non-`uv` argv[0] and no `writesRepo: true`.
- [`tests/pro-dev.mjs`](../../tests/pro-dev.mjs) proves `status` and `check` never run `specify` (to be built).
- `plugins/pro-speckit/commands/` holds `install.md` and `remove.md` (to be built).
