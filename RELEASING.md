# Releasing

Single source of truth for how to ship a new version of a plugin in this marketplace.

## The version-bump law

The Claude Code plugin cache is keyed by `(marketplace, plugin, version)`. If you change a `SKILL.md` (or any plugin content) without bumping the version, `claude plugin update` silently serves stale content from the cache.

So: **every content change requires a version bump**, and the bump MUST happen in two files in the same commit:

1. `plugins/<plugin>/.claude-plugin/plugin.json` → `version`
2. `.claude-plugin/marketplace.json` → matching entry's `version`

If a meta-plugin (`pro-starter`) depends on a bumped plugin, also bump the meta-plugin and its marketplace entry so installers re-resolve dependencies.

### Constraint cascade

`^0.x.y` follows npm strict semver: `^0.1.0` accepts `0.1.*` but NOT `0.2.0`. So when you bump a dep across a minor (e.g. `pro-core 0.1.0 → 0.2.0`), every plugin whose `dependencies` array pins `^0.1.0` of that plugin must widen to `^0.2.0` and re-tag.

Workflow for a minor bump of plugin `X`:
1. Edit `plugins/X/.claude-plugin/plugin.json` → bump `version`
2. Edit `.claude-plugin/marketplace.json` → bump matching entry's `version` (and the top-level `metadata.version`)
3. Grep `dependencies` arrays across all other plugins for `X@<marketplace>` and widen any `^0.<old>` constraints to `^0.<new>`
4. Bump those dependent plugins (and their marketplace entries) too
5. `claude plugin validate . --strict` + per-plugin
6. Commit, push, tag each touched plugin with `claude plugin tag --push`

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

## Codex parity

Forked SKILL.md files should load under OpenAI Codex too (Agent Skills standard). Recurring check: any time you fork or edit a SKILL.md, scan for:

- Hard-required Claude-Code-specific tool names in the body (e.g. `Task`, `TodoWrite`) — replace with harness-neutral language ("dispatch a subagent", "update your task tracker")
- Missing sidecar files referenced in the body — every `@filename.md` or "see `filename.md`" must exist in the same directory
- Non-standard frontmatter keys (`harness:`, `claude_code:`, `tools_required:`) — the standard only guarantees `name`, `description`, optional `tags`/`tools`/`model`

Known soft drift in current pro-core: `requesting-code-review` and `subagent-driven-development` mention `Task`/`TodoWrite` by CC-specific name. Not a blocker for CC users; will rewrite when we have an active Codex consumer.

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
