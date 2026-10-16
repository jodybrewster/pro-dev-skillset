# The version-bump law (non-negotiable)

Moved from `CLAUDE.md`, which keeps a one-line rule.
The decision is [ADR-0002](./decisions/0002-version-bump-law.md).

The Claude Code plugin cache is keyed by `(marketplace, plugin, version)`.
Codex plugin installs also read the plugin version from `.codex-plugin/plugin.json`.
Any content edit without a version bump silently serves stale content on update.
So:

- Edit `plugins/<plugin>/.claude-plugin/plugin.json` → bump `version`
- Edit `plugins/<plugin>/.codex-plugin/plugin.json` → keep `version` aligned with the Claude plugin manifest
- Edit `.claude-plugin/marketplace.json` → bump matching entry + top-level `metadata.version`
- If a dep crosses a minor (e.g. `pro-core 0.3 → 0.4`), every dependent plugin's `^0.3.0` constraint must widen to `^0.4.0` and re-tag.

Full procedure: [RELEASING.md](../RELEASING.md).
