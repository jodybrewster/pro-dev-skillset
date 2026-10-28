# Decision log

Binding decisions for this marketplace, one file per decision, numbered in the order they were made.
Each has a date taken from the commit where the decision was made, a status and a link to what enforces it.
A new load-bearing decision gets the next number in the same PR as the change.

| ADR | Decision | Date |
|---|---|---|
| [0001](./0001-skills-only-history.md) | Skills first; hooks, commands and agents only where triggering must be deterministic | 2026-05-24 |
| [0002](./0002-version-bump-law.md) | Every content change bumps the plugin version in both manifests and the marketplace entry | 2026-05-24 |
| [0003](./0003-one-hooks-json-per-plugin.md) | Each plugin registers all its hooks in one `hooks/hooks.json` | 2026-07-26 |
| [0004](./0004-codex-parity.md) | Every skill-bearing plugin also loads under Codex, agents included | 2026-05-24 |
| [0005](./0005-adrs-in-the-sdlc-loop.md) | pro-ai-sdlc carries ADRs through the loop: flagged at intent, drafted at spec, accepted at Done, standalone through /adr | 2026-10-27 |
| [0006](./0006-engine-registry-and-pro-dev.md) | Every bridge engine is a row in pro-core's one registry, installed and updated only through /pro-dev (proposed) | 2026-10-28 |
| [0007](./0007-spec-method-plugins.md) | Spec methods are opt-in plugins whose stage hand-offs pro-ai-sdlc offers and never runs on its own (proposed) | 2026-10-28 |
| [0008](./0008-spec-kit-uv-tool.md) | spec-kit installs through a `uv-tool` row pinned by commit and date and `check` verifies it from registry hashes without running it (proposed) | 2026-10-28 |
