# Architecture

## Overview

This repo is a private Claude Code plugin marketplace with no app, server or database ([CLAUDE.md](./CLAUDE.md)).
The marketplace file lists 20 plugins and each plugin ships skills, commands, agents and hooks that a user installs into Claude Code or Codex.
Longer version and the Mieruka bridge: [docs/overview.md](./docs/overview.md).

## Parts

| Part | Path | Job | Talks to |
|------|------|-----|----------|
| Marketplace | `.claude-plugin/marketplace.json` | Lists every plugin with its source and version | Each `plugins/<name>/` folder |
| Core | `plugins/pro-core` | Skill finding, memory, `/pro-dev` install and update, the engine registry in `registry/engines.json` | All other plugins |
| SDLC methods | `plugins/pro-ai-sdlc`, `pro-pdd`, `pro-spdd`, `pro-speckit`, `pro-egm` | One way each of taking a change from idea to merged | `pro-core` |
| Engineering discipline | `plugins/pro-execution`, `pro-quality`, `pro-testing`, `pro-data` | TDD, debugging, review, test and data-layer skills | `pro-core` |
| Web and stacks | `plugins/pro-design`, `pro-motion`, `pro-nextjs`, `pro-astro` | Design, motion and framework conventions | `pro-core` |
| Gates | `plugins/pro-security`, `pro-legal`, `pro-ship` | Hooks that review or block a plan, push or release | Claude Code hook events |
| Research | `plugins/pro-research` | `/research` and `/lead-research` | Web sources |
| Starters | `plugins/pro-starter`, `pro-dev-starter` | Dependency aggregators with no skills of their own | Other plugins |
| Tests | `tests/check.mjs`, `tests/eval.mjs`, `tests/route-lexical.mjs`, `tests/*-hooks.mjs`, `tests/unit/` | Static checks, routing evals and hook tests | Every plugin manifest |

Each plugin carries two manifests: `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` (for example `plugins/pro-core/.codex-plugin/plugin.json`).
Layout of a plugin folder is in [CLAUDE.md](./CLAUDE.md).

## How requests and data flow

A user adds the marketplace and installs a plugin by the name in `.claude-plugin/marketplace.json`.
Claude Code reads the plugin's `.claude-plugin/plugin.json` and loads its skills and commands.
It registers hooks from the one file `plugins/<name>/hooks/hooks.json` (for example `plugins/pro-ai-sdlc/hooks/hooks.json`).
Each hook runs a script from the plugin's `scripts/` folder when its event fires.
`/pro-dev install` reads `plugins/pro-core/registry/engines.json` to install engines and companions.
Shell helpers for setup live in `templates/` (`bootstrap.sh`, `codex-bootstrap.sh`, `install-companions.sh`).

## Boundaries

- Plugin layering: a boundary exists where an audience ends or a gate needs its own switch ([ADR-0013](./docs/decisions/0013-plugin-layering.md), proposed).
- Version-bump law: a content change under `plugins/<name>/` bumps both manifests and the marketplace entry ([ADR-0002](./docs/decisions/0002-version-bump-law.md)).
- Hook-loading law: every hook lives in its plugin's one `hooks/hooks.json` ([ADR-0003](./docs/decisions/0003-one-hooks-json-per-plugin.md)).
- Codex parity: every skill-bearing plugin also loads under Codex ([ADR-0004](./docs/decisions/0004-codex-parity.md)).
- No hard dependency on a plugin from another marketplace (`CLAUDE.md`, "Things Claude gets wrong").
- All decisions: [docs/decisions/](./docs/decisions/README.md).

## Deployables

Nothing is built or deployed.
The marketplace is read from this repo by Claude Code and Codex.
CI is `.github/workflows/validate.yml` (strict validation of the marketplace and each plugin) and `.github/workflows/bridge-install-smoke.yml`.
`tests/docker/Dockerfile` exists for the test harness.
Release steps: [RELEASING.md](./RELEASING.md).

## Twelve-factor

<!-- Filled by the architecture review (ranked item 17): how this app meets each factor and which the platform owns. -->
