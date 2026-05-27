# GStack Upstream

This plugin imports and adapts workflow templates from GStack.

- Upstream repository: `https://github.com/garrytan/gstack`
- Imported commit: `a6fb31726cece1d1bba401fde593db7cb96bc738`
- Upstream license: MIT
- Local plugin: `pro-gstack`

## Imported Surface

The full upstream repository is vendored under `upstream/gstack/` for traceability and comparison.

Active local commands and skills are generated from every upstream `SKILL.md` file discovered in that snapshot. At import time, that is 58 workflows:

- 53 top-level or first-level GStack workflows
- 1 browser-skill example workflow
- 4 OpenClaw-native GStack workflows

## Local Adaptations

- All active commands are prefixed as `/gstack-*` to avoid collisions with existing local commands such as `/spec`, `/review`, `/qa`, and `/ship`.
- Matching skill wrappers are exposed under `skills/gstack-*`.
- Active wrappers are harness-neutral adapters. They read the vendored upstream workflow as reference material, but they do not execute native GStack setup or shell preambles.
- Native GStack runtime behavior remains available only as vendored source under `upstream/gstack/`; it is not required by this plugin.
- If a workflow requires unavailable native GStack infrastructure, the adapter should run the markdown/process portion and clearly state what native capability was skipped.

