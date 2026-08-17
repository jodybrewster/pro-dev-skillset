# pro-dev-skillset

A Claude Code and OpenAI Codex plugin marketplace for professional software development. Install once — a curated stack of skills, hooks, workflow commands, and reusable agent skills becomes available in every project.

## Quick start

**Prerequisites:**
- [Homebrew](https://brew.sh) — package manager used to install the tools below (macOS/Linux)
- [`gh` CLI](https://cli.github.com) — required to bootstrap from this private repo; also powers the `/gh` command in `pro-core`
- [`worktrunk`](https://worktrunk.dev) — required for parallel worktree workflows: `brew install worktrunk && wt config shell install`

Optional machine-level status lines for both Claude Code and Codex CLI:

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/install-statuslines.sh --jq .content | base64 -d)
```

This installs the richer Claude Code command-backed status line at
`~/.claude/statusline-command.sh`, wires it into `~/.claude/settings.json`, and configures Codex's
native `[tui].status_line` with the closest available footer items: model/reasoning, git branch and
changes, context use, quota windows, and current directory. Codex does not currently support an
arbitrary shell-backed statusline hook like Claude Code.

One-line bootstrap for Claude Code inside a fresh project:

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/bootstrap.sh --jq .content | base64 -d)
```

This installs `pro-starter` — the meta-plugin that pulls the full default stack: `pro-core`, `pro-pdd`, `pro-execution`, `pro-quality`, `pro-design`, `pro-testing`, `pro-data`, `pro-research`, and the `pro-nextjs` marker plugin. Bridge engines, project-local skills, and the project `/lavish` command (`lavish`, `impeccable`, and `qa-skills`) are included by default so plan review, design, and QA workflows work out of the box.

Once installed, open Claude in your project and run `/using-pro-dev` to orient yourself.

For Codex CLI, use the Codex bootstrap instead:

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/codex-bootstrap.sh --jq .content | base64 -d)
```

Then open Codex in the project and run `/skills` to confirm the pro-dev skills are available.

## Dependencies

### Required

| Tool | Purpose | Install |
|---|---|---|
| Homebrew | Package manager for the tools below | [brew.sh](https://brew.sh) |
| `gh` (GitHub CLI) | Bootstrap from this private repo; powers the `/gh` command in `pro-core` | `brew install gh` |
| `worktrunk` (`wt`) | Parallel worktree + agent management for the `wt` skill in `pro-execution` | `brew install worktrunk && wt config shell install` |

### Optional

These `claude-plugins-official` plugins are declared as cross-marketplace dependencies by the relevant `pro-*` plugins. They install automatically with the corresponding plugin — or manually via the helper script.

| Tool | Installed by | When you need it |
|---|---|---|
| `vercel@claude-plugins-official` | `pro-nextjs` | Next.js / Vercel deployment workflows |
| `figma@claude-plugins-official` | `pro-design`, `pro-nextjs` | Design lookup and asset extraction |
| `playwright@claude-plugins-official` | `pro-quality`, `pro-testing` | Browser E2E testing |

If a Claude Code version does not auto-install cross-marketplace dependencies correctly, run the helper script explicitly:

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/install-companions.sh --jq .content | base64 -d)
```

## Install paths

### One-line bootstrap (recommended)

Inside a fresh project (requires `gh` CLI — this repo is private):

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/bootstrap.sh --jq .content | base64 -d)
```

Flags: `--no-engines` skips the external engine/project-skill install (offline / CI with no network). `--with-companions` pre-installs vercel + figma + playwright before dependency resolution. `--scope user` installs at user scope (default is project).

### Codex CLI

Inside a fresh project:

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/codex-bootstrap.sh --jq .content | base64 -d)
```

For local development against this checkout instead of the GitHub source:

```bash
bash templates/codex-bootstrap.sh --source /Users/jodybrewster/Projects/pro-dev-skillset
```

The script clones or updates this private repository through `gh` at
`~/.codex/marketplaces/pro-dev-skillset`, adds that local checkout as a Codex plugin marketplace,
installs the default stack
(`pro-core`, `pro-pdd`, `pro-execution`, `pro-quality`, `pro-nextjs`, `pro-design`, `pro-testing`,
`pro-data`, `pro-research`), and leaves opt-in plugins (`pro-spdd`, `pro-gstack`)
disabled unless you pass `--with-opt-in`. It also installs project-local Lavish at
`.claude/skills/lavish/SKILL.md` and the project command at `.claude/commands/lavish.md` unless you
pass `--no-lavish`. The bootstrap runs both the generic skill installer and the `--agent claude-code`
installer so Codex gets `.agents/skills/lavish/SKILL.md` and Claude Code gets
`.claude/skills/lavish/SKILL.md`.

Manual equivalent when you already have a local checkout:

```bash
codex plugin marketplace add /Users/jodybrewster/Projects/pro-dev-skillset
codex plugin add pro-core@pro-dev-skillset
codex plugin add pro-pdd@pro-dev-skillset
codex plugin add pro-execution@pro-dev-skillset
codex plugin add pro-quality@pro-dev-skillset
codex plugin add pro-nextjs@pro-dev-skillset
codex plugin add pro-design@pro-dev-skillset
codex plugin add pro-testing@pro-dev-skillset
codex plugin add pro-data@pro-dev-skillset
codex plugin add pro-research@pro-dev-skillset
```

Codex reads project instructions from `AGENTS.md`. Add one to the target repo root for project
policy; this repo keeps `AGENTS.md` and `CLAUDE.md` aligned so both Codex and Claude Code see the
same marketplace-maintenance guidance here.

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

## What's here

One continuous software lifecycle, delivered as a plugin marketplace. **Start with [`using-pro-dev`](./plugins/pro-core/skills/using-pro-dev/SKILL.md)** (in `pro-core`) — the router that maps any task to the right phase and skill. The lifecycle runs **Define → Plan → Spec → Build → Verify → Review → Security → Ship**, with cross-cutting research/data/design skills alongside.

### Lifecycle phases

| Phase | Skills | Plugin |
|---|---|---|
| **Meta** | [`using-pro-dev`](./plugins/pro-core/skills/using-pro-dev/SKILL.md) (router — start here), `find-skills`, [`dream`](./plugins/pro-core/skills/dream/SKILL.md) + `/dream` (consolidate this project's Claude Code auto-memory into a lean `MEMORY.md`) | `pro-core` |
| **Define** | `interview-me`, `idea-refine`, `brainstorming`, `adhd` (parallel divergent ideation, `/adhd`) | `pro-pdd` |
| **Plan** | planning mode for drafting, `writing-plans`, `lavish`◆ for substantive plan review (render output as annotatable HTML artifacts → lavish-axi, via `/lavish-engine`) | `pro-pdd` |
| **Spec** *(branch)* | open-SPDD: `spdd-story → analysis → reasons-canvas → generate → code-review`/`api-test → sync`/`reverse` | `pro-spdd` *(opt-in)* |
| **Build** | `test-driven-development`, `subagent-driven-development`, `using-git-worktrees` | `pro-execution` |
| **Build** | `impeccable-bridge`◆ (full UI/UX pass → impeccable, via `/design-engine`), `frontend-ui-engineering`†, design tokens, accessibility audit, motion system, typography scale, shadcn/ui composition | `pro-design` |
| **Build** | drizzle (orm + schema), prisma, nextauth | `pro-data` |
| **Build** | `context-engineering`†, `doubt-driven-development`† | `pro-core` |
| **Verify** | `qa-suite`◆ → `qa-do`/`qa-start` + playwright/visual/api/contract/strategy/risk/planning (bridged qa-skills, via `/qa-engine`), `agent-browser` (interactive), `vitest` (unit), `storybook-interactions` | `pro-testing` |
| **Verify** | `systematic-debugging` | `pro-execution` |
| **Verify** | `verification-before-completion` | `pro-quality` |
| **Verify** | `user-validation`, `/validate` — hands *you* the checklist when work lands | `pro-quality` |
| **Document** | `technical-writer`, `documentation-engineer`, `api-documenter` subagents, `/document` + `/api-docs` | `pro-quality` |
| **Review** | `requesting-code-review`, `receiving-code-review`, `code-simplification`†, `performance-optimization`†, `/code-review` + `/simplify` built-ins | `pro-quality` |
| **Security** | `security-and-hardening`, `cso` | `pro-security` *(planned)* |
| **Ship** | `ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs`, `deprecation-and-migration` | `pro-ship` *(planned)* |
| **Research** *(cross-cutting)* | `/research`, `/lead-research` | `pro-research` *(opt-in)* |
| **Workflows** *(cross-cutting)* | GStack persona-driven planning/review/QA/ship/security/docs | `pro-gstack` *(opt-in)* |

*(opt-in)* = not in `pro-starter`. *(planned)* = plugin not yet built. † = referenced by the `using-pro-dev` router but not yet forked; route to it when present, otherwise fall back to the nearest available skill. ◆ = **bridge**: a thin router to an external engine or project-local upstream skill installed separately (e.g. `lavish` → `.claude/skills/lavish/SKILL.md` via `/lavish-engine`, `impeccable-bridge` → `impeccable` via `/design-engine`).

### Plugins

The same skills, grouped by how they're packaged, installed, and attributed.

**Skill-bearing plugins:**

- **`pro-core`** — universal base skills and guardrails: find-skills, Karpathy guidelines, the `using-pro-dev` lifecycle router (maps a task to the right phase and skill), `/gh` GitHub workflow command, `dream` memory consolidation, and safety/parallelism hooks.
  `dream` (forked from [`grandamenium/dream-skill`](https://github.com/grandamenium/dream-skill), MIT) reads this project's Claude Code auto-memory at `~/.claude/projects/<project-slug>/memory/`, scans the project's session transcripts for corrections, decisions, preferences, and patterns, merges what it finds into the memory files, and rebuilds `MEMORY.md` as a lean index under 200 lines.
  Run it with `/dream`; `/dream dry-run` previews the proposed merges, rewrites, and deletions without writing, and `/dream status` reports the timer.
  Consolidation rewrites memory files in place, so the dry run is the recommended first invocation.
  Two hooks keep it on schedule: a `Stop` hook (`scripts/dream-flag.py`) checks the per-project timer as a session ends and leaves a pending flag when consolidation is overdue, and a `SessionStart` hook (`scripts/dream-nudge.py`) turns that flag into a one-time nudge at the start of the next session.
  The interval defaults to 24h and is overridable with `PRO_DEV_DREAM_INTERVAL_HOURS`; `PRO_DEV_DREAM_DISABLED=1` turns the feature off entirely.
  Both hooks are silent no-ops when the project has no auto-memory directory, when there are no memory files, when disabled, or when consolidation is not yet due.
  The auto-trigger deliberately does not spawn a background agent.
  Upstream's `Stop` hook launched a detached `nohup claude -p ... --allowedTools "Read,Write,Edit,Bash,Glob,Grep" &`, an unsupervised agent with write access across every project on the machine; this fork replaces that with flag-on-exit plus nudge-at-next-session-start, so consolidation always runs inside a real session the user is present for.
  `dream` ships inside `pro-core`, so every `pro-starter` install picks it up with no extra step.
- **`pro-execution`** — execution discipline skills forked from [obra/superpowers](https://github.com/obra/superpowers): TDD, systematic debugging, git worktrees, subagent-driven development. Includes all upstream sidecar files (`testing-anti-patterns.md`, `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`, `find-polluter.sh`, `condition-based-waiting-example.ts`).
- **`pro-quality`** — quality-gate skills forked from `obra/superpowers`: requesting code review (with reusable reviewer prompt), receiving code review, verification-before-completion, plus the original `user-validation` handoff. A `Stop` hook watches for sessions that end with real file changes and blocks the stop once to hand you a validation checklist — what changed, what was actually verified, and the concrete steps you should check on your end — written to `.pro-dev/validation/latest.md` and echoed in chat. `/validate` produces one on demand. Conversation-only turns produce nothing. Ships three documentation subagents — `technical-writer` (release notes, migration guides, README prose), `documentation-engineer` (doc drift, broken setup paths, structure), and `api-documenter` (references built from the real handlers, schemas, and serializers) — reachable via `/document` and `/api-docs`. All three are constrained to write only what they can trace to a file they opened. Codex counterparts ship as `.toml` under `.codex-plugin/agents/`. A doc-freshness gate blocks `git push` when code changed but docs did not, routing you into `/document` rather than leaving a dead end, and an API-contract hook nudges `api-documenter` when an OpenAPI, GraphQL, or proto file changes. Depends on `playwright@claude-plugins-official`.
- **`pro-design`** — frontend design skills: design tokens, accessibility audit (WCAG 2.2 POUR), motion system, typography scale (all from [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills), MIT) + shadcn/ui composition with OKLCH theming, cva variants, compound components, Field form layout (from [agents-inc/skills](https://github.com/agents-inc/skills), MIT). Depends on `figma@claude-plugins-official` for Figma-MCP integration.
- **`pro-testing`** — the Verify phase. Native skills: `vitest` (unit/component, from `PaulRBerg/agent-skills`), `agent-browser` (interactive verification, `vercel-labs/agent-browser`, Apache-2.0), `storybook-interactions` (`peterknezek/skills`). Plus `qa-suite` — a **bridge** (not vendored) to the `petrkindlmann/qa-skills` library (43 skills, MIT) installed on demand via the `/qa-engine` command (`npx skills add`): `qa-do`/`qa-start` routers, `playwright-automation`, `visual-testing`, api/contract-testing, test-reliability, and QA strategy/risk/planning. Depends on `playwright@claude-plugins-official`.
- **`pro-data`** — data + auth skills from `Yoraexe/ceobe`, `Intense-Visions/harness-engineering`, `a5c-ai/babysitter`, `IvanTorresEdge/molcajete.ai` (all MIT): drizzle-orm-architecture, drizzle-schema-definition, nextauth-patterns, prisma-schema-patterns.
- **`pro-spdd`** — opt-in Structured Prompt-Driven Development workflow adapted from [gszhangwei/open-spdd](https://github.com/gszhangwei/open-spdd) (MIT): `/spdd-story`, `/spdd-analysis`, `/spdd-reasons-canvas`, `/spdd-generate`, `/spdd-prompt-update`, `/spdd-sync`, `/spdd-api-test`, `/spdd-code-review`, `/spdd-reverse`. Not included in `pro-starter` yet.
- **`pro-gstack`** — opt-in GStack workflow adapters adapted from [garrytan/gstack](https://github.com/garrytan/gstack) (MIT): persona-driven planning, review, QA, shipping, browser, security, documentation, and memory workflows. Commands are prefixed as `/gstack-*` to avoid collisions. Not included in `pro-starter` yet.
- **`pro-pdd`** — Define + Plan skills included in `pro-starter`: `interview-me` and `idea-refine` (Define-phase intent extraction and idea refinement, forked from [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills), MIT) plus `brainstorming` and written implementation plans (forked from `obra/superpowers`), `adhd` — parallel divergent ideation for open-ended design/architecture/naming/API-surface/fuzzy-debugging decisions, forked from [`UditAkhourii/adhd`](https://github.com/UditAkhourii/adhd) (MIT): spawns 5 isolated subagents under different cognitive frames (regulator, biology, speedrunner, 10-year-old, etc.), scores and clusters the results, prunes traps, and deepens the top 3 survivors. Trigger with `/adhd <problem>` or "ADHD mode". And `lavish` — a **bridge** (not vendored) plus `/lavish` command for the [`lavish-axi`](https://github.com/kunchenguid/lavish-axi) CLI that renders agent output (plans, tables, diagrams, diffs, reports) as reviewable HTML artifacts the user annotates in the browser. The starter/bootstrap path materializes the upstream skill at `.claude/skills/lavish/SKILL.md` and project command at `.claude/commands/lavish.md`; if missing, run `/lavish-engine install` or `npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish` from the project root. Use this when you want a conversational define-to-plan workflow instead of SPDD.

**Stack markers (no own skills — depend on `pro-core`, exist as category slots):**

- **`pro-nextjs`** — Next.js / Vercel projects. Depends on `vercel@claude-plugins-official` and `figma@claude-plugins-official`.

**Meta:**

- **`pro-starter`** — pulls the full default stack: `pro-core` + `pro-pdd` + `pro-execution` + `pro-quality` + `pro-design` + `pro-testing` + `pro-data` + `pro-research` + the `pro-nextjs` marker plugin. One install ⇒ the full default stack. `pro-spdd` and `pro-gstack` are opt-in.

### Layout

```
.claude-plugin/marketplace.json      # marketplace manifest
.agents/plugins/marketplace.json     # Codex marketplace manifest
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
  pro-pdd/                           # default define + plan-driven development skills
templates/
  project-settings.json              # drop-in for any new project's .claude/
  codex-bootstrap.sh                 # Codex CLI marketplace + plugin installer
  install-statuslines.sh             # machine-level Claude/Codex statusline installer
RELEASING.md                         # version-bump law + tag scheme
```

## Demo

[`demo/`](./demo) installs this marketplace into a target repo and drives the lifecycle skills to build, verify, and run a real Next.js landing page — a working proof that the install + skills + tests hang together:

```bash
./demo/setup.sh         # install marketplace (project scope) → build → test the site
cd demo/app && claude   # then run /pro-dev-doctor to verify the install through the skills
```

See [demo/LIFECYCLE.md](./demo/LIFECYCLE.md) for the phase-by-phase build trail.

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

## Codex parity

The skill-bearing plugins are kept compatible with OpenAI Codex via the Agent Skills standard and
Codex plugin manifests (`.codex-plugin/plugin.json`). `tests/check.mjs` checks portable skill
frontmatter, sidecar references, Codex manifests, and a repo-local Codex marketplace under
`.agents/plugins/marketplace.json`.

```bash
codex plugin marketplace add jodybrewster/pro-dev-skillset
codex plugin add pro-core@pro-dev-skillset
codex plugin add pro-pdd@pro-dev-skillset
codex plugin add pro-execution@pro-dev-skillset
codex plugin add pro-quality@pro-dev-skillset
codex plugin add pro-nextjs@pro-dev-skillset
codex plugin add pro-design@pro-dev-skillset
codex plugin add pro-testing@pro-dev-skillset
codex plugin add pro-data@pro-dev-skillset
codex plugin add pro-research@pro-dev-skillset
codex exec --skip-git-repo-check "enumerate available pro-dev skills"
```

Note: Codex does not use `pro-starter`'s Claude dependency cascade. Install the concrete plugins you
want, or run `templates/codex-bootstrap.sh`. Skill bodies, command prose, and sidecars should stay
harness-neutral: no hard-coded `TodoWrite`/`TaskCreate`/`TaskUpdate`, and any Claude Code `Task tool`
or MCP tool-name examples must include a Codex/fallback path.

## Releasing

See [RELEASING.md](./RELEASING.md). TL;DR: bump `plugin.json` AND `marketplace.json` in the same commit, validate strict, tag with `claude plugin tag --push`.

## License

- Skill content is forked from MIT-licensed upstream repos: `obra/superpowers` (pro-core, pro-execution, pro-pdd, pro-quality), `grandamenium/dream-skill` (dream in pro-core), `addyosmani/agent-skills` (interview-me + idea-refine in pro-pdd), `UditAkhourii/adhd` (adhd in pro-pdd), `Owl-Listener/designer-skills` (pro-design), `PaulRBerg/agent-skills` + `peterknezek/skills` (pro-testing; the `petrkindlmann/qa-skills` library is **bridged** via `/qa-engine`, not vendored), `Yoraexe/ceobe` + `Intense-Visions/harness-engineering` + `a5c-ai/babysitter` + `IvanTorresEdge/molcajete.ai` (pro-data), `gszhangwei/open-spdd` (pro-spdd), `garrytan/gstack` (pro-gstack). The `agent-browser` skill in pro-testing is forked from `vercel-labs/agent-browser` under Apache-2.0. Per-plugin `LICENSE` files document attribution. Per-file footers cite the upstream repo on each SKILL.md where applicable.
- Manifests, templates, hooks, and tooling in this repo are original work.
