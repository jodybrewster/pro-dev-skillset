# Releasing

Single source of truth for how to ship a new version of a plugin in this marketplace.

## The version-bump law

The Claude Code plugin cache is keyed by `(marketplace, plugin, version)`. If you change a `SKILL.md` (or any plugin content) without bumping the version, `claude plugin update` silently serves stale content from the cache.

So: **every content change requires a version bump**, and the bump MUST happen in two files in the same commit:

1. `plugins/<plugin>/.claude-plugin/plugin.json` → `version`
2. `.claude-plugin/marketplace.json` → matching entry's `version`

If a meta-plugin (`pro-starter`) depends on a bumped plugin, also bump the meta-plugin and its marketplace entry so installers re-resolve dependencies.

## Tagging

Use the built-in tagger — it refuses to tag if `plugin.json` and the marketplace entry disagree:

```bash
# Dry-run first to confirm the tag name + version match
claude plugin tag plugins/pro-core --dry-run

# Tag and push in one go
claude plugin tag plugins/pro-core --push -m "pro-core v%s"
```

Tag scheme: `{plugin-name}--v{semver}` (e.g. `pro-core--v0.1.0`).

## Pre-tag checklist

```bash
# Validate the whole marketplace AND each plugin in strict mode
claude plugin validate . --strict
claude plugin validate plugins/pro-core --strict
claude plugin validate plugins/pro-starter --strict
```

All three must pass before you tag.

## Upstream watch (forked skills)

`pro-core` skills were forked from [obra/superpowers](https://github.com/obra/superpowers) under MIT. They do NOT auto-update.

TODO (recurring): check `obra/superpowers` for upstream changes to the forked skills once a quarter:
- brainstorming
- test-driven-development
- systematic-debugging
- writing-plans
- using-git-worktrees
- subagent-driven-development

If upstream has meaningful changes, port them in, bump the plugin version, and re-tag per the law above.
