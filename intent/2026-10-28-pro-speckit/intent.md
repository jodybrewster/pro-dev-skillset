---
source: idea
kind: change
status: done
risk: medium
created: 2026-10-28T07:05:00-0400
author: Jody Brewster
---

# Intent: GitHub spec-kit as its own plugin

Author: Jody Brewster (pro-dev-skillset).
Source: idea, intent E of the pro-dev simplify umbrella (`intent/2026-10-27-pro-dev-simplify/intent.md`).
Status: done; shipped in PR #71 (2c6500f).
Created: 2026-10-28.

## Problem

pro-dev-skillset has two spec-driven methods, pro-ai-sdlc and pro-spdd.
Jody wants to try GitHub's [spec-kit](https://github.com/github/spec-kit) (MIT) next to them and switch methods by installing and uninstalling plugins.
Jody: "can we add github spec kit to its own plugin as well as an intent?"
Earlier the same day: "Having four different spec driven methods means I can try them out easily by installing and uninstalling the plugins but I can control how they work together as well."
spec-kit is not a Claude plugin.
It is a Python CLI, `specify`, that writes `/speckit-*` skills into each project's `.claude/skills/` and its own files under `.specify/`.

## Proposed outcome

A new `pro-speckit` plugin that bridges to spec-kit without copying any of it.
It carries a thin `spec-kit-bridge` skill: when to use spec-kit's flow (constitution, specify, plan, tasks, implement, converge), how to install it and where its output lives.
Installing it sets the project up for spec-kit through the shared setup command from intent B: install the `specify` CLI pinned to a release, then add the Claude integration to the project.
Updating runs spec-kit's own upgrade path, which keeps the project's constitution.
Uninstalling the plugin leaves a clear way to remove spec-kit from the project.

## Affected users and systems

Sites that choose to install `pro-speckit`; it stays out of pro-dev-starter.
The marketplace entry, a new plugin folder, `docs/licenses.md`, routing cases and the engine registry from intent B.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`; spec-kit also has a Codex integration.
Bridges over vendoring: no spec-kit text in this repo.
Install a pinned release (`uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z`), not whatever is latest.
Add the Claude integration with `--no-model-invocation` so spec-kit's skills do not crowd the skill listing in repos that already carry many skills.
The person runs every install; nothing installs on plugin update or session start.

## Out of scope

How pro-ai-sdlc routes between the installed methods; that is intent C.
spec-kit extensions and presets beyond the core flow.

## Success looks like

On a test repo: install `pro-speckit`, run the setup command, and `/speckit-constitution` through `/speckit-implement` work in Claude Code.
Running the update command upgrades the CLI and the integration and leaves `.specify/memory/constitution.md` untouched.
Uninstalling the plugin and following its removal step leaves no spec-kit skills behind.

## Open questions

- Intent B's `/pro-dev` is not built yet; does E wait for it, or ship with a temporary install command that B later absorbs?
- spec-kit needs `uv` (or `pipx`) and Python on the machine; does the setup install `uv` or only tell the person?
- spec-kit keeps its specs under `specs/<n>-<feature>/` while pro-ai-sdlc uses `intent/`; where intent C draws that line may change this plugin's skill text.
