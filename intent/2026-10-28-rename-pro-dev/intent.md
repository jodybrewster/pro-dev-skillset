---
source: idea
kind: change
status: draft
risk: high
created: 2026-10-28T11:30:00-0400
author: the maintainer
---

# Intent: rename the pro-* plugins to pro-dev-*

Author: the maintainer.
Source: idea, raised while naming pro-egm in [intent C](../2026-10-28-spec-methods/spec.md).
Status: draft; not for today.
Created: 2026-10-28.

## Problem

The marketplace is `pro-dev-skillset`, its setup command is `/pro-dev` and its meta-plugin is `pro-dev-starter`, while every other plugin is `pro-*`: `pro-core`, `pro-ai-sdlc`, `pro-design` and the rest.
Every plugin is named pro-*; the question is whether to call them all pro-dev-* instead.
The two prefixes make the family look like two families.

## Proposed outcome

Every plugin in the marketplace is named `pro-dev-<name>`, for example `pro-dev-core` and `pro-dev-ai-sdlc`.
Existing installs keep working through the change and move to the new names without manual uninstall steps.

## Affected users and systems

Every repo with any pro-* plugin installed, at user or project scope, including `demo/app` and the maintainer's own repos.
Every slash command and skill namespace (`/pro-ai-sdlc:spec` becomes `/pro-dev-ai-sdlc:spec`).
`.claude-plugin/marketplace.json`, every plugin's two manifests, `dependencies` arrays, the engine registry `owner` fields, `tests/check.mjs` lists, routing cases, the Codex manifests and agent `.toml` files, tags, `docs/`, README, CLAUDE.md, AGENTS.md, RELEASING.md and `templates/`.
Mieruka, which reads pro-ai-sdlc's templates and rules by path.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
A plugin's install id is its name, so a rename is a new plugin to Claude Code; the old id must keep loading until people have moved.
The `pro-starter` shim (a 1.x name that depends only on `pro-dev-starter`) is the precedent for keeping an old name alive.
`/pro-dev update` is the one place a person already runs after updates (ADR-0006).

## Out of scope

Renaming the marketplace itself or the `/pro-dev` command.
Changing what any plugin does.

## Success looks like

After `claude plugin update` and `/pro-dev update`, a repo that had `pro-core` has `pro-dev-core` enabled and the old one gone, with no command run by hand.
A session that types an old command name gets a one-line pointer to the new one for at least one release.
`node tests/check.mjs` fails on any plugin not named `pro-dev-*`, shims excepted.

## Open questions

- Shims: one shim plugin per old name, like `pro-starter`, or one migration step in `/pro-dev update` that swaps installs as `plugins swap-starter` does.
- How long the old names stay and what ends them.
- Whether `pro-dev-starter` keeps its name or the names become `pro-dev-starter` plus `pro-dev-core` and so on with no special case.
- Mieruka's paths: does it read by plugin name? If so, does it need a release in step?
- Ordering with intents C, D and E, which add and bump plugins under the current names; this should land after them.
- Likely needs an ADR: it sets the naming rule for every future plugin.
- 2026-10-30: [ADR-0013](../../docs/decisions/0013-plugin-layering.md) decides the layering and asks that this rename land in the same release as the consolidation it implies, with names `pro-core`, `pro-dev-*` and `pro-gtm-*` (a domain prefix per plugin) rather than `pro-dev-*` for everything.
