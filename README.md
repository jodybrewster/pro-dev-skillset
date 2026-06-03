# pro-dev-skillset

Jody Brewster's private Claude Code plugin marketplace. One install pulls a curated pro-dev stack into any project.

## What's here

One continuous software lifecycle, delivered as a plugin marketplace. **Start with [`using-pro-dev`](./plugins/pro-core/skills/using-pro-dev/SKILL.md)** (in `pro-core`) — the router that maps any task to the right phase and skill. The lifecycle runs **Define → Plan → Spec → Build → Verify → Review → Security → Ship**, with cross-cutting research/data/design skills alongside.

### Lifecycle phases

| Phase | Skills | Plugin |
|---|---|---|
| **Meta** | [`using-pro-dev`](./plugins/pro-core/skills/using-pro-dev/SKILL.md) (router — start here), `find-skills`, `karpathy-guidelines` | `pro-core` |
| **Define** | `interview-me`, `idea-refine`, `brainstorming` | `pro-pdd` *(opt-in)* |
| **Plan** | pure planning mode *(harness — no skill)*, `writing-plans` | `pro-pdd` *(opt-in)* |
| **Spec** *(branch)* | open-SPDD: `spdd-story → analysis → reasons-canvas → generate → code-review`/`api-test → sync`/`reverse` | `pro-spdd` *(opt-in)* |
| **Build** | `test-driven-development`, `subagent-driven-development`, `using-git-worktrees` | `pro-execution` |
| **Build** | `frontend-ui-engineering`†, design tokens, accessibility audit, motion system, typography scale, shadcn/ui composition | `pro-design` |
| **Build** | drizzle (orm + schema), prisma, nextauth | `pro-data` |
| **Build** | `context-engineering`†, `doubt-driven-development`† | `pro-core` |
| **Verify** | `qa-do`/`qa-start` (router), `agent-browser` (interactive), `playwright-automation` (committed e2e), `vitest`, `visual-testing`, api/contract-testing, test strategy/risk/planning/reliability | `pro-testing` |
| **Verify** | `systematic-debugging` | `pro-execution` |
| **Verify** | `verification-before-completion` | `pro-quality` |
| **Review** | `requesting-code-review`, `receiving-code-review`, `code-simplification`†, `performance-optimization`†, `/code-review` + `/simplify` built-ins | `pro-quality` |
| **Security** | `security-and-hardening`, `cso` | `pro-security` *(planned)* |
| **Ship** | `ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs`, `deprecation-and-migration` | `pro-ship` *(planned)* |
| **Research** *(cross-cutting)* | `/research`, `/lead-research` | `pro-research` *(opt-in)* |
| **Workflows** *(cross-cutting)* | GStack persona-driven planning/review/QA/ship/security/docs | `pro-gstack` *(opt-in)* |

*(opt-in)* = not in `pro-starter`. *(planned)* = plugin not yet built. † = referenced by the `using-pro-dev` router but not yet forked; route to it when present, otherwise fall back to the nearest available skill.

### Plugins

The same skills, grouped by how they're packaged, installed, and attributed.

**Skill-bearing plugins:**

- **`pro-core`** — universal base skills and guardrails: find-skills, Karpathy guidelines, the `using-pro-dev` lifecycle router (maps a task to the right phase and skill), `/gh` GitHub workflow command, and safety/parallelism hooks.
- **`pro-execution`** — execution discipline skills forked from [obra/superpowers](https://github.com/obra/superpowers): TDD, systematic debugging, git worktrees, subagent-driven development. Includes all upstream sidecar files (`testing-anti-patterns.md`, `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`, `find-polluter.sh`, `condition-based-waiting-example.ts`).
- **`pro-quality`** — quality-gate skills forked from `obra/superpowers`: requesting code review (with reusable reviewer prompt), receiving code review, verification-before-completion. Depends on `playwright@claude-plugins-official`.
- **`pro-design`** — frontend design skills: design tokens, accessibility audit (WCAG 2.2 POUR), motion system, typography scale (all from [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills), MIT) + shadcn/ui composition with OKLCH theming, cva variants, compound components, Field form layout (from [agents-inc/skills](https://github.com/agents-inc/skills), MIT). Depends on `figma@claude-plugins-official` for Figma-MCP integration.

- **`pro-testing`** — the Verify phase: `vitest`, `agent-browser` (interactive verification), `storybook-interactions`, plus a vendored `petrkindlmann/qa-skills` library (43 skills) exposed as a curated testing-core subset — `qa-do`/`qa-start` routers, `playwright-automation`, `visual-testing`, api/contract-testing, test-reliability, and QA strategy/risk/planning. Forked from `PaulRBerg/agent-skills`, `petrkindlmann/qa-skills`, `peterknezek/skills` (all MIT) plus `vercel-labs/agent-browser` (Apache-2.0). Depends on `playwright@claude-plugins-official`.
- **`pro-data`** — data + auth skills from `Yoraexe/ceobe`, `Intense-Visions/harness-engineering`, `a5c-ai/babysitter`, `IvanTorresEdge/molcajete.ai` (all MIT): drizzle-orm-architecture, drizzle-schema-definition, nextauth-patterns, prisma-schema-patterns.
- **`pro-spdd`** — opt-in Structured Prompt-Driven Development workflow adapted from [gszhangwei/open-spdd](https://github.com/gszhangwei/open-spdd) (MIT): `/spdd-story`, `/spdd-analysis`, `/spdd-reasons-canvas`, `/spdd-generate`, `/spdd-prompt-update`, `/spdd-sync`, `/spdd-api-test`, `/spdd-code-review`, `/spdd-reverse`. Not included in `pro-starter` yet.
- **`pro-gstack`** — opt-in GStack workflow adapters adapted from [garrytan/gstack](https://github.com/garrytan/gstack) (MIT): persona-driven planning, review, QA, shipping, browser, security, documentation, and memory workflows. Commands are prefixed as `/gstack-*` to avoid collisions. Not included in `pro-starter` yet.
- **`pro-pdd`** — opt-in Define + Plan skills: `interview-me` and `idea-refine` (Define-phase intent extraction and idea refinement, forked from [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills), MIT) plus `brainstorming` and written implementation plans (forked from `obra/superpowers`). Use this when you want a conversational define-to-plan workflow instead of SPDD.

**Stack markers (no own skills — depend on `pro-core`, exist as category slots):**

- **`pro-nextjs`** — Next.js / Vercel projects. Depends on `vercel@claude-plugins-official` and `figma@claude-plugins-official`.

**Meta:**

- **`pro-starter`** — pulls the default stack: 6 skill-bearing plugins (`pro-core` + `pro-execution` + `pro-quality` + `pro-design` + `pro-testing` + `pro-data`) plus the `pro-nextjs` marker plugin and `pro-mieruka`. One install ⇒ Jody's standard stack (33 skills across the starter-installed skill-bearing plugins). `pro-spdd`, `pro-gstack`, `pro-research`, and `pro-pdd` are opt-in.

### Official dependencies

These plugins from `claude-plugins-official` are declared as cross-marketplace dependencies by the relevant `pro-*` plugins:

- `vercel` — Next.js / Vercel deployment workflows (pairs with `pro-nextjs`)
- `figma` — design lookup + asset extraction (pairs with `pro-nextjs` and `pro-design`)
- `playwright` — browser E2E testing (pairs with `pro-quality` and `pro-testing`)

If a Claude Code version does not auto-install cross-marketplace dependencies correctly, run the helper script explicitly:

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/install-companions.sh --jq .content | base64 -d)
```

Layout:

```
.claude-plugin/marketplace.json      # marketplace manifest
plugins/
  pro-core/                          # universal base skills + hooks
  pro-execution/                     # TDD/debug/worktree/subagent execution skills
  pro-quality/                       # quality skills + review/verify commands
  pro-nextjs/                        # marker plugin, no skills
  pro-design/                        # design skills
  pro-testing/                       # testing skills
  pro-data/                          # data/auth skills + schema formatting hook
  pro-starter/                       # meta-plugin: dependencies only
  pro-spdd/                          # opt-in OpenSPDD workflow commands + skills
  pro-gstack/                        # opt-in GStack workflow adapters + upstream snapshot
  pro-pdd/                           # opt-in plan-driven development skills
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

Add `--with-companions` to explicitly pre-install vercel + figma + playwright before dependency resolution. Add `--scope user` to install at user scope (default is project).

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

The skill-bearing plugins are kept compatible with OpenAI Codex via the Agent Skills standard. Last manual smoke check used `codex-cli 0.122.0-alpha.13`; CI does not yet enforce this path.

```bash
codex plugin marketplace add jodybrewster/pro-dev-skillset
# then add each plugin you want to ~/.codex/config.toml:
#   [plugins."pro-core@pro-dev-skillset"]
#   enabled = true
#   [plugins."pro-execution@pro-dev-skillset"]
#   enabled = true
#   [plugins."pro-quality@pro-dev-skillset"]
#   enabled = true
#   [plugins."pro-design@pro-dev-skillset"]
#   enabled = true
#   [plugins."pro-testing@pro-dev-skillset"]
#   enabled = true
#   [plugins."pro-data@pro-dev-skillset"]
#   enabled = true
#   [plugins."pro-nextjs@pro-dev-skillset"]
#   enabled = true
#   [plugins."pro-spdd@pro-dev-skillset"]  # optional
#   enabled = true
#   [plugins."pro-gstack@pro-dev-skillset"]  # optional
#   enabled = true
#   [plugins."pro-pdd@pro-dev-skillset"]  # optional
#   enabled = true
codex exec --skip-git-repo-check "enumerate available skills"
# Expected for starter-installed plugins: 33 pro-* skill slugs; +9 if pro-spdd is enabled; +58 if pro-gstack is enabled; +4 if pro-pdd is enabled
```

Note: Codex 0.122 doesn't have a `plugin install` cascade for transitive deps the way Claude Code does. To get the full stack under Codex today, register the marketplace and enable each pro-* plugin you want explicitly in `config.toml`. Skill bodies should stay harness-neutral (no hard-coded `TodoWrite`/`Task tool` requirements).

## License

- Skill content is forked from MIT-licensed upstream repos: `obra/superpowers` (pro-core, pro-execution, pro-pdd, pro-quality), `addyosmani/agent-skills` (interview-me + idea-refine in pro-pdd), `Owl-Listener/designer-skills` (pro-design), `PaulRBerg/agent-skills` + `petrkindlmann/qa-skills` + `peterknezek/skills` (pro-testing), `Yoraexe/ceobe` + `Intense-Visions/harness-engineering` + `a5c-ai/babysitter` + `IvanTorresEdge/molcajete.ai` (pro-data), `gszhangwei/open-spdd` (pro-spdd), `garrytan/gstack` (pro-gstack). The `agent-browser` skill in pro-testing is forked from `vercel-labs/agent-browser` under Apache-2.0. Per-plugin `LICENSE` files document attribution. Per-file footers cite the upstream repo on each SKILL.md where applicable.
- Everything else in this repo (manifests, templates, README, RELEASING) is private to Jody Brewster.
