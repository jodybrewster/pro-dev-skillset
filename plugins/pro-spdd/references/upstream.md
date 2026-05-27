# OpenSPDD Upstream

This plugin imports and adapts command templates from OpenSPDD.

- Upstream repository: `https://github.com/gszhangwei/open-spdd`
- Imported commit: `328d4bc94b86daeb3f3605472c821874c05f001b`
- Upstream license: MIT
- Local plugin: `pro-spdd`

## Imported Commands

Core commands:

- `/spdd-analysis`
- `/spdd-reasons-canvas`
- `/spdd-generate`
- `/spdd-prompt-update`
- `/spdd-sync`

Optional OpenSPDD commands included in this plugin:

- `/spdd-story`
- `/spdd-api-test`
- `/spdd-code-review`
- `/spdd-reverse`

## Local Adaptations

- Command templates are exposed as Claude Code slash commands under `commands/`.
- Matching skill wrappers are exposed under `skills/` for skill-based hosts.
- Skill wrappers keep their bodies short and load the copied workflow from `workflow.md`.
- Upstream tool-specific wording for `AskUserQuestion` was adapted to direct user-question language.
- The OpenSPDD Go CLI is vendored for traceability under `upstream/open-spdd/`, but is not required at runtime by this plugin.

