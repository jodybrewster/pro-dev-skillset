# ADR-0006: One engine registry in pro-core, driven by /pro-dev

Date: 2026-10-28

## Status

proposed

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
No plugin ships its own engine install command.
Engines install only when a person runs `/pro-dev`, never from a hook, a plugin update or a session start.

## Consequences

A new bridge adds a registry row in the same PR, so `/pro-dev update` picks up its engine after the next plugin update.
`tests/check.mjs` fails when a bridge skill has no row, which keeps the rule enforced.
Every row lives in pro-core, so a bridge change in any plugin also bumps pro-core under the version-bump law.
Optional-engine answers live in `.claude/pro-dev.json`, so a team shares them.
Reverse it if keeping every plugin's rows in pro-core makes pro-core bump on most releases or rows drift from their bridges; the fallback is one registry file per plugin, collected at run time.

## Enforced by

- [`plugins/pro-core/registry/engines.json`](../../plugins/pro-core/registry/engines.json) holds the rows.
- [`plugins/pro-core/commands/pro-dev.md`](../../plugins/pro-core/commands/pro-dev.md) and [`plugins/pro-core/scripts/pro-dev.py`](../../plugins/pro-core/scripts/pro-dev.py) read them.
- [`tests/check.mjs`](../../tests/check.mjs) fails on a bridge with no row and on a malformed row.
