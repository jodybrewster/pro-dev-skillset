# pro-dev-skillset

Jody Brewster's private Claude Code plugin marketplace. One install pulls a curated pro-dev stack into any project.

## What's here

**Skill-bearing plugins:**

- **`pro-core`** — core dev skills forked from [obra/superpowers](https://github.com/obra/superpowers): brainstorming, TDD, systematic debugging, writing plans, using git worktrees, subagent-driven development. Includes all upstream sidecar files (`testing-anti-patterns.md`, `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`, `find-polluter.sh`, `condition-based-waiting-example.ts`).
- **`pro-quality`** — quality-gate skills forked from `obra/superpowers`: requesting code review (with reusable reviewer prompt), receiving code review, verification-before-completion.
- **`pro-design`** — frontend design skills forked from [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) (MIT): design tokens, accessibility audit (WCAG 2.2 POUR), motion system, typography scale.

**Stack markers (no own skills — depend on `pro-core`, exist as category slots):**

- **`pro-nextjs`** — Next.js / Vercel projects. Recommended companions: `vercel`, `figma`.
- **`pro-testing`** — Vitest / Playwright / Storybook. Recommended companion: `playwright`.
- **`pro-data`** — Drizzle / Prisma / Auth. Skill slot reserved.
- **`pro-spec`** — Spec-driven development / GitHub Spec Kit. Skill slot reserved.

**Meta:**

- **`pro-starter`** — depends on `pro-core` + `pro-quality` + `pro-nextjs` + `pro-design`. Installing this one plugin pulls Jody's default stack (4 plugins, 13 skills).

### Recommended companions (opt-in)

These plugins from `claude-plugins-official` pair naturally with the stack but are NOT auto-installed by `pro-starter`. Install with one command:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/install-companions.sh)
```

The script installs:
- `vercel` — Next.js / Vercel deployment workflows (pairs with `pro-nextjs`)
- `figma` — design lookup + asset extraction (pairs with `pro-nextjs`)
- `playwright` — browser E2E testing (pairs with `pro-quality`)

> **Why opt-in rather than `dependencies`:** Claude Code 2.1.150 validates cross-marketplace deps but does not auto-install them. Worse — a depending plugin is silently disabled (and its skills disappear) when a declared cross-marketplace dep is missing. Keeping the companions out of `plugin.json` means the `pro-*` skills always work whether or not you've installed the companions.

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

### One-line bootstrap (recommended)

Inside a fresh project:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/bootstrap.sh)
```

Add `--with-companions` to also install vercel + figma + playwright. Add `--scope user` to install at user scope (default is project).

### Per-project (committed)

Drop `templates/project-settings.json` into a new project as `.claude/settings.json`:

```bash
mkdir -p .claude
curl -fsSL https://raw.githubusercontent.com/jodybrewster/pro-dev-skillset/main/templates/project-settings.json -o .claude/settings.json
```

On the next `claude` open, accept the folder-trust prompt → the marketplace registers and `pro-starter` installs (which cascades to the rest).

### Ad-hoc, mid-development

```bash
claude plugin marketplace add jodybrewster/pro-dev-skillset
claude plugin install pro-starter@pro-dev-skillset --scope project
```

## Headless / CI gotcha

`claude -p` (headless) does NOT trigger the folder-trust prompt that authorizes `extraKnownMarketplaces` ([anthropics/claude-code#13097](https://github.com/anthropics/claude-code/issues/13097)).

Verified workaround:

1. Drop `templates/project-settings.json` into the repo as `.claude/settings.json` (the marketplace is then auto-registered on next `claude` invocation, even headless).
2. Either open `claude` interactively once and accept the folder-trust prompt — OR run `claude plugin install pro-starter@pro-dev-skillset --scope project` explicitly (no prompt required).
3. After install, `.claude/settings.json` is updated so `enabledPlugins` contains both `pro-starter` and `pro-core`. Commit it — subsequent `claude -p` runs in CI then re-resolve the same stack on cache miss.

## Folder-trust prompt

Every first-open of a project that adopts the template settings triggers a folder-trust prompt. This is expected and a one-time cost per project per machine.

## Cleanup

`pro-starter` is a meta-plugin — uninstalling it leaves `pro-core` as an orphaned auto-installed dep. To remove both:

```bash
claude plugin uninstall pro-starter@pro-dev-skillset --scope project
claude plugin prune --scope project -y     # -y required in non-TTY contexts
```

## Releasing

See [RELEASING.md](./RELEASING.md). TL;DR: bump `plugin.json` AND `marketplace.json` in the same commit, validate strict, tag with `claude plugin tag --push`.

## License

- `pro-core` skills are forked from [obra/superpowers](https://github.com/obra/superpowers) under the MIT License. See `plugins/pro-core/LICENSE` and the per-file attribution at the bottom of each `SKILL.md`.
- Everything else in this repo is private to Jody Brewster.
