# ADR-0002: The version-bump law

Date: 2026-05-24 (f0887bd, "Initial marketplace + pro-core/pro-starter plugins")

## Status

accepted

## Context

Claude Code keys its plugin cache on the marketplace, the plugin and the version.
A content edit that keeps the old version leaves the cache key unchanged, so `claude plugin update` serves the cached copy and nothing warns.
Codex installs read the plugin version from `.codex-plugin/plugin.json`.
The rule was written down in the first commit, in RELEASING.md, before any plugin had shipped a second version.

## Decision

Every content change to a plugin bumps its version in the same commit.
The bump lands in `plugins/<plugin>/.claude-plugin/plugin.json`, in `plugins/<plugin>/.codex-plugin/plugin.json` and in the matching entry of `.claude-plugin/marketplace.json`, together with `metadata.version` in that file.
When a dependency crosses a minor, every dependent widens its caret constraint to the new minor and gets its own bump.

## Consequences

- A missed bump means a stale cache on update, with no error from Claude Code or Codex.
- The two plugin manifests stay aligned because Codex reads its version from `.codex-plugin/plugin.json`.
- Docs outside `plugins/` need no bump.
- Under npm semver `^0.1.0` accepts `0.1.*` but not `0.2.0`, so a minor bump cascades through the `^0.x` constraints of all dependents and through any meta-plugin that depends on them.
- Each bump is followed by a tag `<plugin>--v<semver>`, made with `claude plugin tag`, which refuses to tag when `plugin.json` and the marketplace entry disagree.
- Small edits cost a release, which is the price of a cache that can be trusted.

## Enforced by

- [`RELEASING.md`](../../RELEASING.md) holds the full procedure, the constraint cascade workflow and the tagging steps.
- [`tests/check.mjs`](../../tests/check.mjs) check `versions` fails when plugin.json and the marketplace entry differ, when an in-marketplace dependency range is not satisfied or when a cross-marketplace dependency uses "*".
- [`tests/check.mjs`](../../tests/check.mjs) check `codex-manifests` fails when a Codex manifest version differs from the Claude manifest version.
- The CI workflow [`.github/workflows/validate.yml`](../../.github/workflows/validate.yml) runs these checks on every change.
- The review policy [`REVIEW.md`](../../REVIEW.md) treats a missing bump as a finding.
