# pro-dev-skillset

Jody Brewster's private Claude Code plugin marketplace. One install pulls a curated pro-dev stack into any project.

## What's here

**Skill-bearing plugins:**

- **`pro-core`** — core dev skills forked from [obra/superpowers](https://github.com/obra/superpowers): brainstorming, TDD, systematic debugging, writing plans, using git worktrees, subagent-driven development. Includes all upstream sidecar files (`testing-anti-patterns.md`, `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`, `find-polluter.sh`, `condition-based-waiting-example.ts`).
- **`pro-quality`** — quality-gate skills forked from `obra/superpowers`: requesting code review (with reusable reviewer prompt), receiving code review, verification-before-completion.
- **`pro-design`** — frontend design skills: design tokens, accessibility audit (WCAG 2.2 POUR), motion system, typography scale (all from [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills), MIT) + shadcn/ui composition with OKLCH theming, cva variants, compound components, Field form layout (from [agents-inc/skills](https://github.com/agents-inc/skills), MIT). Companion: `figma` for Figma-MCP integration (Figma-to-component skills don't exist as MIT upstream content yet — write originals when needed).

- **`pro-testing`** — testing skills forked from `PaulRBerg/agent-skills`, `petrkindlmann/qa-skills`, `peterknezek/skills` (all MIT): vitest (with mocking + monorepo + testing-patterns + troubleshooting sidecars), playwright-automation (Page Object Model + 8 reference sidecars), storybook-interactions (play-functions-as-spec), visual-testing (Playwright/Chromatic/Percy/Argos patterns).
- **`pro-data`** — data + auth skills from `Yoraexe/ceobe`, `Intense-Visions/harness-engineering`, `a5c-ai/babysitter`, `IvanTorresEdge/molcajete.ai` (all MIT): drizzle-orm-architecture, drizzle-schema-definition, nextauth-patterns, prisma-schema-patterns.
- **`pro-spec`** — spec-driven development skills adapted from `github/spec-kit` (MIT): writing-feature-specs (PRD with Given/When/Then), clarifying-specs (10-category ambiguity taxonomy).

**Stack markers (no own skills — depend on `pro-core`, exist as category slots):**

- **`pro-nextjs`** — Next.js / Vercel projects. Recommended companions: `vercel`, `figma`.

**Meta:**

- **`pro-starter`** — pulls all 7 skill-bearing plugins (`pro-core` + `pro-quality` + `pro-design` + `pro-testing` + `pro-data` + `pro-spec` + `pro-nextjs`). One install ⇒ Jody's full stack (~21 skills across all plugins).

### Recommended companions (opt-in)

These plugins from `claude-plugins-official` pair naturally with the stack but are NOT auto-installed by `pro-starter`. Install with one command:

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/install-companions.sh --jq .content | base64 -d)
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

Inside a fresh project (requires `gh` CLI — this repo is private):

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/bootstrap.sh --jq .content | base64 -d)
```

Add `--with-companions` to also install vercel + figma + playwright. Add `--scope user` to install at user scope (default is project).

### Per-project (committed)

Drop `templates/project-settings.json` into a new project as `.claude/settings.json`:

```bash
mkdir -p .claude
gh api repos/jodybrewster/pro-dev-skillset/contents/templates/project-settings.json --jq .content | base64 -d > .claude/settings.json
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

## Codex parity

The skill-bearing plugins also load under OpenAI Codex via the Agent Skills standard. Verified end-to-end on `codex-cli 0.122.0-alpha.13`:

```bash
codex plugin marketplace add jodybrewster/pro-dev-skillset
# then add to ~/.codex/config.toml:
#   [plugins."pro-starter@pro-dev-skillset"]
#   enabled = true
codex exec --skip-git-repo-check "enumerate available skills"
# → returns the same 23 pro-* skill slugs as Claude Code
```

Note: Codex 0.122 doesn't have a `plugin install` cascade for transitive deps the way Claude Code does. To get the full stack under Codex today, register the marketplace and enable each pro-* plugin you want explicitly in `config.toml`. Two soft drift items in pro-core/pro-quality SKILL.md bodies were rewritten for harness-neutral language (no more hard-coded `TodoWrite`/`Task tool` references).

## License

- Skill content is forked from MIT-licensed upstream repos: `obra/superpowers` (pro-core, pro-quality), `Owl-Listener/designer-skills` (pro-design), `PaulRBerg/agent-skills` + `petrkindlmann/qa-skills` + `peterknezek/skills` (pro-testing), `Yoraexe/ceobe` + `Intense-Visions/harness-engineering` + `a5c-ai/babysitter` + `IvanTorresEdge/molcajete.ai` (pro-data), `github/spec-kit` (pro-spec). Per-plugin `LICENSE` files document attribution. Per-file footers cite the upstream repo on each SKILL.md.
- Everything else in this repo (manifests, templates, README, RELEASING) is private to Jody Brewster.
