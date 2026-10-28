---
source: idea
kind: change
status: proposed
risk: high
created: 2026-10-28T07:30:00-0400
author: Jody Brewster
---

# Intent: one /pro-dev command for setup and updates

Author: Jody Brewster (pro-dev-skillset).
Source: idea, intent B of the [pro-dev simplify umbrella](../2026-10-27-pro-dev-simplify/intent.md), items 1 to 5.
Status: proposed.
Created: 2026-10-28.

## Problem

Setting up a site takes many commands and updating it takes more.
The engines behind the bridges are installed by seven separate commands: `/pro-starter`, `/design-engine`, `/design-skills`, `/taste-skills`, `/next-skills`, `/lavish-engine` and `/qa-engine`.
`/sdlc-init` and `/pro-dev-doctor` are two more setup steps.
`claude plugin update` brings new bridge skills but never the engines they point at, so a bridge added in a release does nothing until someone finds and runs the right command.
pro-starter depends on pro-nextjs and pro-astro, though stack plugins are meant to be opt-in per project.
Two plugins ship a `/review` command, and `/api-docs` and `/lead-research` duplicate `/document` and `/research`.
Jody: "I need a general slash command to init everything after I've installed all of the plugins I want, then an update command after I update the plugins."
Then: "no more like /pro-dev install and pro-dev update".
And: "pro-starter should be renamed to pro-dev-starter as well."

## Proposed outcome

One command in pro-core: `/pro-dev install`, `/pro-dev update` and `/pro-dev check`.
It reads one engine registry in pro-core and acts only on engines whose owning plugin is installed.
For each engine the registry records the owning plugin, how to tell it is installed, how to install it, how to update it and whether it is default or optional.
`install` installs the default engines, asks once about each optional one, saves the answers in `.claude/pro-dev.json` and sets the repo up for the intent, spec and plan loop that `/sdlc-init` does today.
`update` updates every installed engine, installs engines that new bridges need and asks only about optional engines it has not asked about before.
`update` also updates the pro-dev plugins in every scope they are installed in, including project-scope installs in subfolders such as `demo/app`.
An install in another scope can shadow the updated one without `/plugin` showing it: intent A's first live check ran pro-quality 0.9.6 from the `demo/app` project-scope install while `/plugin` showed the user-scope 0.10.0.
`update` removes plugin installs whose project folder no longer exists.
`update` ends by reminding the person to restart Claude Code so the updated plugins load.
`check` reports what is installed, missing or stale and changes nothing; it replaces `/pro-dev-doctor`.
The seven engine commands, `/pro-starter`, `/sdlc-init` and `/pro-dev-doctor` are deleted.
pro-starter is renamed pro-dev-starter, keeps no command and no longer depends on pro-nextjs or pro-astro.
`templates/bootstrap.sh` shrinks to: add the marketplace, install pro-dev-starter, then tell the person to run `/pro-dev install`.
pro-quality's `/review` is removed in favor of pro-ai-sdlc's, `/api-docs` becomes a mode of `/document` and `/lead-research` becomes `/research lead`.
A site's flow becomes: install pro-dev-starter and any stack or method plugins, run `/pro-dev install`, and after each `claude plugin update` run `/pro-dev update`.

## Affected users and systems

Every site that installs from this marketplace.
pro-core (new command, registry and script), pro-starter (renamed), pro-ai-sdlc (`/sdlc-init` folded in), pro-design, pro-nextjs, pro-pdd and pro-testing (engine commands removed, bridge skills pointed at `/pro-dev`), pro-quality and pro-research (duplicate commands), `templates/bootstrap.sh`, the README, docs, `tests/` routing cases and the marketplace entries.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
No hard dependency on a plugin from another marketplace (PR 44); companion plugins such as EGM are installed by `/pro-dev`, never declared as dependencies.
Bridges over vendoring: engines stay outside the marketplace.
`/pro-dev` installs third-party code only when the person runs it; nothing installs on plugin update or session start.
The impeccable engine keeps its current rule: install the harness build from impeccable.style and never downgrade it with the npm build.
lavish keeps its project-local install check.

## Out of scope

The new bridges themselves (intents C, D and E add their registry rows).
Changing what any engine does.
A hook that runs `/pro-dev update` automatically.

## Success looks like

On a fresh test repo: install pro-dev-starter, run `/pro-dev install`, and every bridge in the installed plugins has its engine; `/pro-dev check` reports all present.
After a release that adds a bridge, `claude plugin update` then `/pro-dev update` installs its engine without asking about engines already decided.
After `/pro-dev update` and a restart, every install of a pro-dev plugin that covers the repo, in any scope, is on the new version, and no install points at a missing folder.
Installing pro-dev-starter no longer pulls in pro-nextjs or pro-astro.
The command list shrinks from 42 to about 31.

## Open questions

- Likely needs an ADR: it sets the rule every future bridge follows (a registry row, no per-plugin install command).
- Too big for one PR? The duplicate-command cleanup (item 5) could split off.
- Renaming pro-starter makes existing sites uninstall it and install pro-dev-starter by hand; is a one-release shim worth it?
- Where the registry lives and its format: one JSON file in pro-core read by a small script, or one file per plugin collected at run time.
- Default scope for engine installs: project (as `/pro-starter` does today) or user.
- A SessionStart hook that only prints "plugins changed, run /pro-dev update" when the registry version changes: wanted or not?
