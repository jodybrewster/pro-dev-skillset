# pro-dev-skillset

Jody Brewster's private Claude Code plugin marketplace. One install pulls a curated pro-dev stack into any project.

## What's here

- **`pro-core`** — core dev skills forked from [obra/superpowers](https://github.com/obra/superpowers): brainstorming, TDD, systematic debugging, writing plans, using git worktrees, subagent-driven development.
- **`pro-starter`** — meta-plugin with no skills of its own; depends on `pro-core` (and, in later phases, the other `pro-*` plugins). Installing this one plugin pulls the whole stack.

Layout:

```
.claude-plugin/marketplace.json      # marketplace manifest
plugins/
  pro-core/                          # real plugin: skills only
  pro-starter/                       # meta-plugin: dependencies only
templates/
  project-settings.json              # drop-in for any new project's .claude/
RELEASING.md                         # version-bump law + tag scheme
```

## Install paths

### Per-project (committed, recommended)

Drop `templates/project-settings.json` into a new project as `.claude/settings.json`:

```bash
mkdir -p .claude
curl -fsSL https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/project-settings.json -o .claude/settings.json
```

On the next `claude` open, accept the folder-trust prompt → the marketplace registers and `pro-starter` installs (which cascades to `pro-core`).

### Ad-hoc, mid-development

```bash
claude plugin marketplace add jodybrewster/pro-dev-skillset
claude plugin install pro-starter@pro-dev-skillset --scope project
```

## Headless / CI gotcha

`claude -p` (headless) does NOT trigger the folder-trust prompt that authorizes `extraKnownMarketplaces` ([anthropics/claude-code#13097](https://github.com/anthropics/claude-code/issues/13097)). For CI:

1. Open the project interactively once, accept the folder-trust prompt.
2. Commit the resulting `.claude/settings.local.json` (or the trusted-folders entry).
3. Subsequent `claude -p` runs in CI will then read the trusted config and install plugins as expected.

## Folder-trust prompt

Every first-open of a project that adopts the template settings triggers a folder-trust prompt. This is expected and a one-time cost per project per machine.

## Releasing

See [RELEASING.md](./RELEASING.md). TL;DR: bump `plugin.json` AND `marketplace.json` in the same commit, validate strict, tag with `claude plugin tag --push`.

## License

- `pro-core` skills are forked from [obra/superpowers](https://github.com/obra/superpowers) under the MIT License. See `plugins/pro-core/LICENSE` and the per-file attribution at the bottom of each `SKILL.md`.
- Everything else in this repo is private to Jody Brewster.
