# ADR-0006: One engine registry in pro-core, driven by /pro-dev

Date: 2026-10-28

## Status

proposed

Amended 2026-10-28 in place by intent `2026-10-28-plugin-installers`: per-plugin installers alongside `/pro-dev`.

## Context

Bridge skills route to engines that live outside this marketplace and install on demand.
Each owning plugin shipped its own command to install them: `/design-engine`, `/design-skills`, `/taste-skills`, `/next-skills`, `/lavish-engine` and `/qa-engine`, with `/pro-starter` as an umbrella over three of them.
`claude plugin update` brings a new bridge skill but never its engine, so a bridge added in a release did nothing until someone found the right command.
Setup took nine commands and each new bridge added another.
Source: intent/2026-10-28-pro-dev-setup/.

## Decision

Every bridge engine is a row in one registry, `plugins/pro-core/registry/engines.json`.
A row names its owning plugin, the bridge skills that use it, how to detect it, its install and update argv and whether it is installed by default or asked about.
`/pro-dev install|update|check` in pro-core reads the registry and acts only on rows whose owning plugin is installed.
`/pro-dev install` stays the single step that sets up everything for a site on `pro-dev-starter`.
Every plugin that owns registry rows also ships one `/<plugin>:install`, which installs and with `update` updates that plugin's rows and no others.
It runs pro-core's `pro-dev.py --owner <plugin>` through the plugin's own `scripts/pro-dev-owner.py`, a script identical in every owning plugin.
That script reads the owner from its own manifest and runs only a pro-core from the trusted marketplace that Claude Code loads for this repo.
No owning plugin depends on pro-core: installing a dependent silently re-enables a pro-core the person disabled, with its `git-safe`, `memory-recall`, session-start and Stop hooks.
Jody decided 2026-10-28: "yes you don't need pro-core for pro-nextjs".
`/<plugin>:install` needs pro-core installed and enabled and otherwise prints one line saying so and stops.
Rows stay in pro-core's one registry for now.
Before running, both `/pro-dev` and every `/<plugin>:install` list each row that will install, mark answers taken from the committed `.claude/pro-dev.json` and wait for a yes.
Health checks stay in `/pro-dev check`.
Engines install only when a person runs `/pro-dev` or a `/<plugin>:install`, never from a hook, a plugin update or a session start.

## Consequences

A new bridge adds a registry row in the same PR, so `/pro-dev update` picks up its engine after the next plugin update.
`tests/check.mjs` fails when a bridge skill has no row, which keeps the rule enforced.
Every row lives in pro-core, so a bridge change in any plugin also bumps pro-core under the version-bump law.
A person who installs one plugin alone gets its engines from `/<plugin>:install` without learning `/pro-dev`; a new row reaches that command only after pro-core updates too.
A person who installed only one owning plugin gets none of pro-core's hooks and installs pro-core to use the installer.
Codex has no installer; Codex users keep the manual install lines in the bridge skills.
Optional-engine answers live in `.claude/pro-dev.json`, so a team shares them.
Reverse it if keeping every plugin's rows in pro-core makes pro-core bump on most releases or rows drift from their bridges; the fallback is one registry file per plugin, collected at run time.

## Enforced by

- [`plugins/pro-core/registry/engines.json`](../../plugins/pro-core/registry/engines.json) holds the rows.
- [`plugins/pro-core/commands/pro-dev.md`](../../plugins/pro-core/commands/pro-dev.md) and [`plugins/pro-core/scripts/pro-dev.py`](../../plugins/pro-core/scripts/pro-dev.py) read them.
- [`tests/check.mjs`](../../tests/check.mjs) fails on a bridge with no row and on a malformed row; its `installers` check fails when a row owner ships no `commands/install.md` or `scripts/pro-dev-owner.py`, declares a pro-core dependency, ships a differing `pro-dev-owner.py` or an installer that reaches rows it does not own.
- Each owning plugin's `scripts/pro-dev-owner.py` finds and checks pro-core before running `pro-dev.py --owner`.
- [`tests/pro-dev.mjs`](../../tests/pro-dev.mjs) covers `--owner` and the owner script's refusals.
