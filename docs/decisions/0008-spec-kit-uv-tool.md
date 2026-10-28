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
Jody is new to spec-kit and wants plain slash commands with every safety check built in.
Source: intent/2026-10-28-pro-speckit/.

## Decision

The registry gains a `uv-tool` row kind for a Python CLI installed with `uv tool install`.
A `uv-tool` row pins a 40-character commit SHA in `--from`, never a tag.
It carries `--exclude-newer` set to the reviewed release's `published_at`.
The tag name goes in the row `note`.
`update` on such a row is a no-op while the installed copy matches the pin, so dependencies are not resolved again.

`pro-dev.py` detects a `uv-tool` CLI from uv's `direct_url.json` under `uv tool dir` and counts it as installed only when `vcs_info.commit_id` equals the pin.
It never runs the CLI to learn its version.
It runs the CLI only from `run`, by the absolute path `<uv tool dir --bin>/specify`.
It refuses when `specify` on `PATH` resolves to a different real path.

spec-kit takes two rows in file order: `specify-cli` installs the CLI and `spec-kit` sets up the repo.
The `spec-kit` row is skipped until the CLI is at the pin and defaults to false, so a user-scope pro-speckit never writes into a repo set up for another engine.
It refuses a dirty working tree or an existing `.specify/`.

The `spec-kit` row stores in the registry a `pinnedFiles` map: the sha256 of every file the pinned CLI writes with the pinned options under `.claude/skills/speckit-*/`, `.specify/scripts/` and `.specify/templates/`.
`/pro-dev check` hashes those files on disk with the standard library and never runs `specify`; it also reports extension, preset, workflow and `specify` hook paths and a feature pointer outside `specs/`.
The constitution, spec-kit's own manifests and `specs/` are never pinned.

`uv tool install` is a second named user-wide write, after ADR-0007's marketplace step, recorded in the `pro-dev.py` docstring.
`/pro-dev` never installs `uv`; when it is missing it says how to get it from uv's docs.
The CLI is shared machine-wide.
If two repos on different pins keep downgrading each other, the fallback is `uvx` with the same pin and no shared install.

Raising a pin is a reviewed PR that moves the SHA, the `--exclude-newer` timestamp and the `pinnedFiles` hashes together, signed off by Jody.
The dependency ranges that `--exclude-newer` still leaves open are a risk Jody accepts.

A method whose upstream is a CLI ships `requires: null` in its `sdlc-method.json` and states its prerequisite in the hand-off text.
pro-speckit's `/pro-speckit:install`, `/pro-speckit:update` and `/pro-speckit:remove` run only its own rows through `pro-dev.py`, so every check above runs inside them.

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
- [`tests/check.mjs`](../../tests/check.mjs) fails a `uv-tool` row without `--exclude-newer` or a 40-character commit, or with a malformed `pinnedFiles` hash (to be built).
- [`tests/pro-dev.mjs`](../../tests/pro-dev.mjs) proves `status` and `check` never run `specify` (to be built).
- `plugins/pro-speckit/commands/` holds `install.md`, `update.md` and `remove.md` (to be built).
