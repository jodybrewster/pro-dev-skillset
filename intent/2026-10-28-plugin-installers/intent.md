---
source: idea
kind: change
status: proposed
risk: medium
created: 2026-10-28T15:30:00-0400
author: Jody Brewster
---

# Intent: every plugin with engines ships its own installer

Author: Jody Brewster (pro-dev-skillset).
Source: idea, raised while settling intent E (pro-speckit) Flagged concern 2.
Status: proposed.
Created: 2026-10-28.

## Problem

ADR-0006 says no plugin ships its own engine install command: every engine installs through `/pro-dev install` in pro-core.
That suits a site on `pro-dev-starter`, but someone who installs one plugin on its own, such as `pro-nextjs` or `pro-speckit`, has to know that the setup lives in a different plugin.
Jody: "the individual plugins can all have installers but anything bundled with starter should install with starter but if they choose to install just pro-nextjs then they can have an install".

## Proposed outcome

Each plugin that owns registry rows ships one `/<plugin>:install` command that sets up only its own engines.
A site on `pro-dev-starter` keeps one step: `/pro-dev install` sets up every installed plugin's engines, so starter users never need the per-plugin commands.
All installers run the same rows through the same `pro-dev.py`, so pins, surface checks, `gitExclude`, marketplace checks and saved answers stay in one place.

## Affected users and systems

The plugins that own rows today: pro-design, pro-nextjs, pro-testing, pro-pdd, pro-egm and pro-ship; pro-speckit when intent E ships.
`plugins/pro-core/scripts/pro-dev.py` (a way to run one owner's rows), `plugins/pro-core/commands/pro-dev.md`, ADR-0006, `tests/check.mjs`, README and CLAUDE.md.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
Engines still install only when a person runs a command, never from a hook or a plugin update (ADR-0006).
Each installer's `allowed-tools` holds only the exact `pro-dev.py` pattern it runs.
A plugin's installer needs pro-core's script, so each such plugin depends on pro-core.

## Out of scope

Changing what any engine installs or how it is pinned.
The `pro-dev-*` rename (intent `2026-10-28-rename-pro-dev`).

## Success looks like

With only pro-nextjs installed, `/pro-nextjs:install` sets up its engines and nothing else.
With pro-dev-starter installed, `/pro-dev install` sets up everything, as today.
`/pro-dev check` sees engines installed by either path.
`tests/check.mjs` fails when a plugin owns a registry row but ships no installer, or when an installer runs rows it does not own.

## Open questions

- Command name: `/<plugin>:install` everywhere, or a shorter name.
- Whether an installer also offers `update` and `check`, or only `install`.
- Likely needs an ADR amendment to ADR-0006: it reverses "no plugin ships its own engine install command".
