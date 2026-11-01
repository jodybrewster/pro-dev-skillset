# pro-dev-skillset

A Claude Code and OpenAI Codex plugin marketplace for professional software development. Install once — a curated stack of skills, hooks, workflow commands, and reusable agent skills becomes available in every project.

## Quick start

**Prerequisites:**
- [Homebrew](https://brew.sh) — package manager used to install the tools below (macOS/Linux)
- [`gh` CLI](https://cli.github.com) — required to bootstrap from this private repo; also powers the `/gh` command in `pro-core`

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

This writes the project settings and installs `pro-dev-starter`, the meta-plugin that pulls the default stack: `pro-core`, `pro-pdd`, `pro-execution`, `pro-quality`, `pro-design`, `pro-motion`, `pro-testing`, `pro-data`, `pro-research` and `pro-security`.
It then tells you to run `/pro-dev install` in a Claude Code session.

### Set up a site

1. Install `pro-dev-starter` and any stack or method plugins you want, such as `claude plugin install pro-nextjs@pro-dev-skillset`.
   `pro-nextjs`, `pro-astro` and `pro-electron` are opt-in.
2. Run `/pro-dev install` in a Claude Code session.
3. After each `claude plugin update`, run `/pro-dev update`.
4. Run `/pro-dev check` any time to see what is installed and what is stale.

Every bridge skill routes to an external engine.
Each engine is a row in the registry at `plugins/pro-core/registry/engines.json`.
`/pro-dev install` installs the default rows (`lavish`, `impeccable` and `qa-skills` among them) and asks once per optional engine.
It saves the answers in `.claude/pro-dev.json`, which is meant to be committed so a team shares its choices.

`/pro-dev update` updates the pro-dev plugins in user scope and in project installs at or under the repo, such as `demo/app`.
It then updates the engines and offers to remove dead installs, after you confirm and with a backup of `installed_plugins.json`.
It ends with a reminder to restart Claude Code.
A SessionStart nudge tells you to run `/pro-dev update` when a plugin update brought a newer registry than the one `.claude/pro-dev.json` records.

### Install one plugin on its own

A plugin that owns engine rows also ships `/<plugin>:install`, which sets up only that plugin's engines and asks first.
The seven are `/pro-design:install`, `/pro-nextjs:install`, `/pro-testing:install`, `/pro-pdd:install`, `/pro-egm:install`, `/pro-ship:install` and `/pro-speckit:install`.
Add `update` to update them.
They need `pro-core` installed and enabled and print one line saying so when it is not.
Codex users keep the install lines in each bridge skill.

`pro-starter` is now a shim that depends only on `pro-dev-starter` and stays for one release.
An existing site keeps loading.
`/pro-dev update` offers to swap `pro-starter` for `pro-dev-starter`; an install you disabled is left as it is.

Once installed, open Claude in your project and run `/using-pro-dev` to orient yourself.

For Codex CLI, use the Codex bootstrap instead:

```bash
bash <(gh api repos/jodybrewster/pro-dev-skillset/contents/templates/codex-bootstrap.sh --jq .content | base64 -d)
```

Then open Codex in the project and run `/skills` to confirm the pro-dev skills are available.

## Work with a spec method

`pro-pdd` is the default: plan-driven development, which is Claude Code as it is plus a written plan you approve before `pro-execution` builds it test first.

`pro-ai-sdlc`, heavily inspired by Anthropic's [AI-native SDLC playbook](https://claude.com/resources/articles/the-ai-native-sdlc-playbook) (PDF on that page), is an opt-in plugin for changes that need a record: `/intent`, `/spec`, `/plan`, `/execute`, `/review` and `/pr-babysit` check each change against the repo's rules and record sign-off.
`/incident` turns a production incident into an incident record and a new intent and `/review` proposes an agent-file line when the same kind of finding comes back on a second change.

Three more methods are opt-in plugins, installed with `claude plugin install <name>@pro-dev-skillset`:

- `pro-egm` adds a goldfish review of your spec and plan by reviewers with no history.
- `pro-speckit` brings GitHub spec-kit and its `/speckit-*` commands.
- `pro-spdd` brings open-SPDD's story and structured-prompt flow.

[docs/spec-methods.md](./docs/spec-methods.md) compares them side by side, says which to pick and walks through each one step by step.

## Dependencies

### Required

| Tool | Purpose | Install |
|---|---|---|
| Homebrew | Package manager for the tools below | [brew.sh](https://brew.sh) |
| `gh` (GitHub CLI) | Bootstrap from this private repo; powers the `/gh` command in `pro-core` | `brew install gh` |

### Optional

These `claude-plugins-official` plugins are optional companions, not declared dependencies.
They report their version as `unknown`, and Claude Code's resolver rejects that against any range, so a hard dependency on one would stop the whole `pro-*` plugin from loading.
Install them with `templates/install-companions.sh` or `bootstrap.sh --with-companions`.

| Tool | Pairs with | When you need it |
|---|---|---|
| `vercel@claude-plugins-official` | `pro-nextjs`, `pro-astro` | Next.js and Astro deployment workflows on Vercel |
| `figma@claude-plugins-official` | `pro-design`, `pro-nextjs` | Design lookup and asset extraction |
| `playwright@claude-plugins-official` | `pro-quality`, `pro-testing` | Browser E2E testing |

The official Cloudflare plugin pairs with `pro-astro`'s `astro-on-cloudflare` skill (Wrangler, Workers best practices, web-perf and the Cloudflare MCP server).
It lives in its own marketplace and is not installed by `install-companions.sh`; add it by hand when a project deploys to Cloudflare: `/plugin marketplace add cloudflare/skills` then `/plugin install cloudflare@cloudflare`.
The `pro-astro` skills also use the official Astro Docs MCP server when it is configured: `claude mcp add --transport http astro-docs https://mcp.docs.astro.build/mcp`.

`node tests/check.mjs versions` fails if a `*` cross-marketplace dependency is ever reintroduced.

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
bash templates/codex-bootstrap.sh --source <path-to-pro-dev-skillset>
```

The script clones or updates this private repository through `gh` at
`~/.codex/marketplaces/pro-dev-skillset`, adds that local checkout as a Codex plugin marketplace,
installs the default stack
(`pro-core`, `pro-pdd`, `pro-execution`, `pro-quality`, `pro-nextjs`, `pro-astro`, `pro-design`, `pro-motion`,
`pro-testing`, `pro-data`, `pro-research`, `pro-security`), and leaves opt-in plugins (`pro-spdd`, `pro-egm`, `pro-legal`)
disabled unless you pass `--with-opt-in`. It also installs project-local Lavish at
`.claude/skills/lavish/SKILL.md` and the project command at `.claude/commands/lavish.md` unless you
pass `--no-lavish`. The bootstrap runs both the generic skill installer and the `--agent claude-code`
installer so Codex gets `.agents/skills/lavish/SKILL.md` and Claude Code gets
`.claude/skills/lavish/SKILL.md`.

Manual equivalent when you already have a local checkout:

```bash
codex plugin marketplace add <path-to-pro-dev-skillset>
codex plugin add pro-core@pro-dev-skillset
codex plugin add pro-ai-sdlc@pro-dev-skillset   # optional: the intent, spec and plan loop
codex plugin add pro-pdd@pro-dev-skillset
codex plugin add pro-execution@pro-dev-skillset
codex plugin add pro-quality@pro-dev-skillset
codex plugin add pro-nextjs@pro-dev-skillset
codex plugin add pro-astro@pro-dev-skillset
codex plugin add pro-electron@pro-dev-skillset   # optional: Electron apps
codex plugin add pro-design@pro-dev-skillset
codex plugin add pro-testing@pro-dev-skillset
codex plugin add pro-data@pro-dev-skillset
codex plugin add pro-motion@pro-dev-skillset
codex plugin add pro-research@pro-dev-skillset
codex plugin add pro-security@pro-dev-skillset
codex plugin add pro-legal@pro-dev-skillset   # opt-in
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

On the next `claude` open, accept the folder-trust prompt → the marketplace registers and `pro-dev-starter` installs (which cascades to the rest). Then run `/pro-dev install`.

### Ad-hoc, mid-development

```bash
claude plugin marketplace add jodybrewster/pro-dev-skillset
claude plugin install pro-dev-starter@pro-dev-skillset --scope project
# then, in a session: /pro-dev install
```

## What's here

One continuous software lifecycle, delivered as a plugin marketplace. **Start with [`using-pro-dev`](./plugins/pro-core/skills/using-pro-dev/SKILL.md)** (in `pro-core`) — the router that maps any task to the right phase and skill. The lifecycle runs **Define → Plan → Spec → Build → Verify → Review → Security → Ship**, with cross-cutting research/data/design skills alongside.

### Lifecycle phases

| Phase | Skills | Plugin |
|---|---|---|
| **Meta** | [`using-pro-dev`](./plugins/pro-core/skills/using-pro-dev/SKILL.md) (router — start here), `find-skills`, [`dream`](./plugins/pro-core/skills/dream/SKILL.md) + `/dream` (consolidate this project's Claude Code auto-memory into a lean `MEMORY.md`), `/kaizen` (raise each project's bar one notch per run from a planning repo) | `pro-core` |
| **Define** | `interview-me`, `idea-refine`, `brainstorming`, `adhd` (parallel divergent ideation, `/adhd`) | `pro-pdd` |
| **Plan** | planning mode for drafting, `writing-plans`, `lavish`◆ for substantive plan review (render output as annotatable HTML artifacts → lavish-axi, via `/pro-dev install`) | `pro-pdd` |
| **Spec** *(branch)* | goldfish review of a spec or plan: `egm-bridge` → `egm@egm` reviewers with fresh context | `pro-egm` *(opt-in)* |
| **Spec** *(branch)* | GitHub spec-kit: `spec-kit-bridge` → pinned `specify` CLI, then `/speckit-constitution`, `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement` | `pro-speckit` *(opt-in)* |
| **Spec** *(branch)* | open-SPDD: `spdd-story → analysis → reasons-canvas → generate → code-review`/`api-test → sync`/`reverse` | `pro-spdd` *(opt-in)* |
| **Build** | `test-driven-development`, `subagent-driven-development`, `using-git-worktrees` | `pro-execution` |
| **Build** | `emil-design-eng` (start here for product UI), `landing-page-design`, `build-awwwards-quality-sites`, `apple-design`, `animate` + `animation-vocabulary`, `screen-critique` (`/critique-screen`), `interface-review`, `better-interface`, `better-layout`, `perception-laws`, design tokens, accessibility audit, motion system, typography scale, shadcn/ui composition, `frontend-ui-engineering`†, `impeccable-bridge`◆ (full UI/UX pass → impeccable, via `/pro-dev install`), `taste-skills-bridge`◆ (via `/pro-dev install`), `web-design-engineer-bridge`◆, `tastemaker-bridge`◆, `mengto-skills-bridge`◆ (all three via `/pro-dev install`) | `pro-design` |
| **Build** | `web-design-guidelines` (lint UI files against Vercel's Web Interface Guidelines), `react-patterns-bridge`◆ (React composition and view transitions) | `pro-design` |
| **Build** | `vercel-skills-bridge`◆ (React performance and Vercel cost, vercel-labs/agent-skills, via `/pro-dev install`) | `pro-nextjs` |
| **Build** | drizzle (orm + schema), prisma, nextauth | `pro-data` |
| **Build** | `context-engineering`†, `doubt-driven-development`† | `pro-core` |
| **Verify** | `qa-suite`◆ → `qa-do`/`qa-start` + playwright/visual/api/contract/strategy/risk/planning (bridged qa-skills, via `/pro-dev install`), `agent-browser` (interactive), `vitest` (unit), `storybook-interactions` | `pro-testing` |
| **Verify** | `systematic-debugging` | `pro-execution` |
| **Verify** | `verification-before-completion`; the floor guard warns on `git push` and `gh pr create` when a diff lowers the bar; `format-on-edit` runs the repo's own formatter and linter on each edited file | `pro-quality` |
| **Verify** | `user-validation`, `/validate` — hands *you* the checklist; a Stop hook suggests `/validate` after repo edits (`PRO_DEV_VALIDATION` = nudge, block or off) | `pro-quality` |
| **Document** | `technical-writer`, `documentation-engineer`, `api-documenter` subagents, `/document` + `/api-docs`, `required-docs.py` (the required-document check); `/pro-dev install` in `pro-core` calls that agent to draft missing required documents when `pro-quality` is present | `pro-quality` |
| **Review** | `requesting-code-review`, `receiving-code-review`, `constraints` + `/constraints` (writes a repo's `CONSTRAINTS.md`, which the floor guard reads), `code-simplification`†, `performance-optimization`†, `/code-review` + `/simplify` built-ins | `pro-quality` |
| **Security** | `security-architect` + `/threat-model` (challenges ideas, plans and diffs; held once at push by a hook), `security-audit` + `/security-audit` (whole-repo audit), `security-auditor` subagent, `security-and-hardening`† | `pro-security` |
| **Legal** | `software-counsel` + `/legal-review` (issue spotting on plans and releases: licensing, privacy, AI, client IP; enforced by hooks) | `pro-legal` *(opt-in)* |
| **Ship** | `ship` (a go/no-go before a tag, release, deploy or publish: reviews only the commits no passing `pr-check` covered, runs the release checks, writes a rollback plan per target and records the verdict for HEAD that the `ship-gate` hook reads), `deployed` (after a deploy: the post-deploy checks and a deploy record mieruka reads, from the facts or a GitHub deployment), `pr-check` (build, lint, typecheck and tests, then the reviewers and the verifier, then a stamp for HEAD that the gate hook on `gh pr create` reads), `risk-tiers` (a deterministic low, medium or high tier from the diff, with every signal printed and the merge pinned to one HEAD sha), `documentation-and-adrs` (which docs a change touches, ADRs in the repo's own convention; docs are judgment, never a gate) and `vercel-deploy-bridge`◆ (deploy to Vercel with token and `.env` checks, via `/pro-dev install`) | `pro-ship` |
| **Ship** | `ci-cd-and-automation`, `deprecation-and-migration` | `pro-ship` *(planned)* |
| **Research** *(cross-cutting)* | `/research`, `/lead-research` | `pro-research` *(opt-in)* |

*(opt-in)* = not in `pro-dev-starter`. *(planned)* = plugin not yet built. † = referenced by the `using-pro-dev` router but not yet forked; route to it when present, otherwise fall back to the nearest available skill. ◆ = **bridge**: a thin router to an external engine or project-local upstream skill installed separately (e.g. `lavish` → `.claude/skills/lavish/SKILL.md` via `/pro-dev install`, `impeccable-bridge` → `impeccable` via `/pro-dev install`).

### Plugins

The same skills, grouped by how they're packaged, installed, and attributed.

**Skill-bearing plugins:**

- **`pro-ai-sdlc`** - the AI-native SDLC as one stack-agnostic plugin: `/intent`, `/spec`, `/plan`, `/execute` (build an approved plan in its own worktree and open the PR), `/review` and `/pr-babysit`, with repo setup for the loop in `/pro-dev install` (`pro-core`), the intent, spec, plan and REVIEW templates, a standing definition of done every plan cites, a stop list that pauses `/execute` before risky steps, a `doubt-driven-development` skill that `/execute` runs on irreversible steps, the `researcher`, `verifier`, `simplifier` and `reviewer` agents and warn-mode hooks for protected tests, plan drift and production actions.
- **`pro-core`** — universal base skills and guardrails: find-skills, Karpathy guidelines, the `using-pro-dev` lifecycle router (maps a task to the right phase and skill), `/gh` GitHub workflow command, `dream` memory consolidation, and safety/parallelism hooks.
  `dream` (forked from [`grandamenium/dream-skill`](https://github.com/grandamenium/dream-skill), MIT) reads this project's Claude Code auto-memory at `~/.claude/projects/<project-slug>/memory/`, scans the project's session transcripts for corrections, decisions, preferences, and patterns, merges what it finds into the memory files, and rebuilds `MEMORY.md` as a lean index under 200 lines.
  Run it with `/dream`; `/dream dry-run` previews the proposed merges, rewrites, and deletions without writing, and `/dream status` reports the timer.
  Consolidation rewrites memory files in place, so the dry run is the recommended first invocation.
  Two hooks keep it on schedule: a `Stop` hook (`scripts/dream-flag.py`) checks the per-project timer as a session ends and leaves a pending flag when consolidation is overdue, and a `SessionStart` hook (`scripts/dream-nudge.py`) turns that flag into a one-time nudge at the start of the next session.
  The interval defaults to 24h and is overridable with `PRO_DEV_DREAM_INTERVAL_HOURS`; `PRO_DEV_DREAM_DISABLED=1` turns the feature off entirely.
  Both hooks are silent no-ops when the project has no auto-memory directory, when there are no memory files, when disabled, or when consolidation is not yet due.
  The auto-trigger deliberately does not spawn a background agent.
  Upstream's `Stop` hook launched a detached `nohup claude -p ... --allowedTools "Read,Write,Edit,Bash,Glob,Grep" &`, an unsupervised agent with write access across every project on the machine; this fork replaces that with flag-on-exit plus nudge-at-next-session-start, so consolidation always runs inside a real session the user is present for.
  `dream` ships inside `pro-core`, so every `pro-dev-starter` install picks it up with no extra step.
  `/kaizen` raises the bar one notch per run from a planning repo (a repo holding `STATUS.md` and `coverage.md`; `/kaizen init <repo-path> ...` scaffolds one): it judges each tracked project against its own profile in `kaizen/profiles.md`, red-teams it, applies at most one reversible improvement, briefs the rest and writes a dated ledger plus an HTML report with the coverage matrix.
- **`pro-execution`** — execution discipline skills forked from [obra/superpowers](https://github.com/obra/superpowers): TDD, systematic debugging, git worktrees, subagent-driven development. Includes all upstream sidecar files (`testing-anti-patterns.md`, `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`, `find-polluter.sh`, `condition-based-waiting-example.ts`).
- **`pro-quality`** — quality-gate skills forked from `obra/superpowers`: requesting code review (dispatches the `code-reviewer` agent: Opus, read-only, fresh context, a four-field handoff of range, brief, policy and risk), receiving code review, verification-before-completion, plus the original `user-validation` handoff. A floor guard warns on `git push` and `gh pr create` when a diff lowers the bar (deleted tests, loosened lint, skipped checks), and `/constraints` writes a repo's `CONSTRAINTS.md`, adapted from [agent-skills](https://github.com/addyosmani/agent-skills) (MIT). A `Stop` hook watches for sessions that wrote files inside the repo and ends the turn with one line suggesting `/validate`. `/validate` hands you a checklist — what changed, what was actually verified, and the concrete steps you should check on your end — written to `.pro-dev/validation/latest.md` and echoed in chat. Set `PRO_DEV_VALIDATION` in the `env` block of `.claude/settings.json` to `off` to silence the hook or `block` to have it block the stop once and require the checklist. Conversation-only turns and writes outside the repo produce nothing. Ships three documentation subagents — `technical-writer` (release notes, migration guides, README prose), `documentation-engineer` (doc drift, broken setup paths, structure), and `api-documenter` (references built from the real handlers, schemas, and serializers) — reachable via `/document` and `/api-docs`. All three are constrained to write only what they can trace to a file they opened. Codex counterparts ship as `.toml` under `.codex-plugin/agents/`. Doc freshness is a judgment step in `pro-ship`'s `/pr-check` (docs changed where behavior changed, reported as Should-fix), not a push hook. An API-contract hook nudges `api-documenter` when an OpenAPI, GraphQL, or proto file changes. Pairs with the optional `playwright@claude-plugins-official` companion.
- **`pro-design`** - the design surface, grouped by what you are actually doing.
  Start here and craft: `emil-design-eng` (polished product UI - components, screens, empty and loading states), `apple-design` (Apple HIG principles applied to a screen), `animate`, and `animation-vocabulary`, all forked from [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT); `landing-page-design` (a single-CTA conversion page with a real visual system, and it asks you questions before it designs) from [elayadesign/ai-design-skills](https://github.com/elayadesign/ai-design-skills) (MIT); `build-awwwards-quality-sites` (the principles and techniques behind Awwwards-level immersive scroll storytelling) from [MengTo/Skills](https://github.com/MengTo/Skills) (MIT).
  Motion: `animate` adds or refines animation on a site that already exists and decides what should move at all, `animation-vocabulary` turns "snappy but not bouncy" into exact easing, duration, and spring terms, and the older `motion` (Framer Motion implementation and discipline) and `motion-system` skills still cover implementation and token-level motion scales.
  Review and fix: `screen-critique` with the `/critique-screen` command judges a rendered screen through seven critique lenses, and `perception-laws` covers Gestalt grouping, Von Restorff, and visual hierarchy - both from [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) (MIT). `interface-review` reviews the UI changes in a PR, branch, or working tree and flags regressions, `better-interface` is the holistic pass that consolidates the `better-*` family into one ranked verdict (any domain whose skill is not installed comes back as `Not reviewed`), and `better-layout` fixes spacing, alignment, and grouping to the pixel - all three from [jakubkrehel/skills](https://github.com/jakubkrehel/skills) (MIT). `accessibility-audit` (WCAG 2.2 POUR) rounds it out.
  Systems: `design-token` and `typography-scale` (Owl-Listener/designer-skills), `shadcn-ui-composition` with OKLCH theming, cva variants, compound components, and Field form layout (from [agents-inc/skills](https://github.com/agents-inc/skills), MIT), `stitch-skill` (create/update `DESIGN.md`), and `taste-skill` (a targeted visual polish pass).
  Bridges (not vendored): `impeccable-bridge` routes to the standalone `impeccable` engine via `/pro-dev install`; `taste-skills-bridge` routes to [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) via `/pro-dev install`; `web-design-engineer-bridge` routes to [`ConardLi/garden-skills`](https://github.com/ConardLi/garden-skills) `web-design-engineer`, which grounds a design in real references, ships style recipes for Apple/Linear/Vercel/Stripe and friends, and scores the result so you can iterate against a number; `tastemaker-bridge` routes to [`codeswithroh/tastemaker`](https://github.com/codeswithroh/tastemaker), which extracts tokens from a reference image's actual pixels with scripts, locks that style across a project, and gates the usual AI slop (needs Python 3); `mengto-skills-bridge` routes to the full [`MengTo/Skills`](https://github.com/MengTo/Skills) library of 130 skills - scroll storytelling, WebGL/shader/3D effects, style recipes, and video-to-superprompt; `react-patterns-bridge` routes to the React composition and view-transition skills in [`vercel-labs/agent-skills`](https://github.com/vercel-labs/agent-skills) (MIT per its README).
  `web-design-guidelines` is native: it lints the UI files you name against Vercel's [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) and fetches the rules at run time from a pinned commit.
  The last three install with `/pro-dev install`, which also pulls the non-vendored remainder of every collection.
  The bridge trade-off is worth stating plainly: a bridged engine does nothing in a project until it has been installed there, so run the install command before you rely on one.
  Pairs with the optional `figma@claude-plugins-official` companion for Figma-MCP integration.
- **`pro-testing`** — the Verify phase. Native skills: `vitest` (unit/component, from `PaulRBerg/agent-skills`), `agent-browser` (interactive verification, `vercel-labs/agent-browser`, Apache-2.0), `storybook-interactions` (`peterknezek/skills`). Plus `qa-suite` — a **bridge** (not vendored) to the `petrkindlmann/qa-skills` library (43 skills, MIT) installed on demand via `/pro-dev install` (`npx skills add`): `qa-do`/`qa-start` routers, `playwright-automation`, `visual-testing`, api/contract-testing, test-reliability, and QA strategy/risk/planning. Pairs with the optional `playwright@claude-plugins-official` companion.
- **`pro-data`** — data + auth skills from `Yoraexe/ceobe`, `Intense-Visions/harness-engineering`, `a5c-ai/babysitter`, `IvanTorresEdge/molcajete.ai` (all MIT): drizzle-orm-architecture, drizzle-schema-definition, nextauth-patterns, prisma-schema-patterns.
- **`pro-security`** - the Security phase, in the default stack.
  `security-architect` challenges a specific idea, plan, spec or diff: it restates the plan as a system, draws the trust boundaries, names the unstated assumptions and the attack that breaks each, and returns a `## Security challenge` section to fold into the plan (`/threat-model`, plus a read-only `security-architect` subagent for a fresh-context pass).
  `security-audit` is the whole-repo posture audit (`/security-audit`), with the `security-auditor` subagent judging each finding independently.
  One hook gates the push.
  A `git push` or `gh pr create` whose diff against its upstream touches auth, data, input handling, payments, secrets, LLM tools or CI is held once per distinct diff, and the identical retry passes.
  `git commit` is never gated.
  In diff mode the `security-architect` reads the diff, the changed files and the direct callers of a changed symbol and does not walk the tree; whole-repo review stays with `security-audit`.
  The audit and the threat framing are adapted from the `cso` skill in [garrytan/gstack](https://github.com/garrytan/gstack) (MIT); the challenge procedure and hooks are original.
- **`pro-legal`** - the Legal phase, opt-in and not in `pro-dev-starter`.
  `software-counsel` is an in-house product counsel persona that spots legal issues in a plan or a release.
  It is issue spotting and not legal advice.
  In `plan` mode it reviews an idea, plan or spec and returns a `## Legal review` section to fold into the plan (`/legal-review`).
  In `release` mode it reviews what is about to ship.
  Hooks make it hard to skip.
  Exiting plan mode with a plan that touches licensing, personal data, AI, scraping or payments is denied until the plan carries a `## Legal review` section produced by an independent `software-counsel` pass.
  A release gate holds `git tag`, `gh release create`, package publishes, production deploys, `gh pr create` and commits that add problematically licensed dependencies or change LICENSE and NOTICE files.
  A dated `legal-landscape.md` baseline backs the review, with a CI staleness check.
  The content is original.
- **`pro-spdd`** — opt-in Structured Prompt-Driven Development workflow adapted from [gszhangwei/open-spdd](https://github.com/gszhangwei/open-spdd) (MIT): `/spdd-story`, `/spdd-analysis`, `/spdd-reasons-canvas`, `/spdd-generate`, `/spdd-prompt-update`, `/spdd-sync`, `/spdd-api-test`, `/spdd-code-review`, `/spdd-reverse`. Not included in `pro-dev-starter` yet.
- **`pro-egm`** - opt-in glue for Google's [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) (Apache-2.0, bridged, not vendored): `/pro-egm:goldfish` runs the goldfish review of a spec or plan with fresh-context reviewers a repo keeps in `.egm/`, and the `egm-bridge` skill points to `/pro-dev install`, which installs `egm@egm`. Once installed, `/spec` and `/plan` offer the review. EGM's skills cannot be started by a model, so `/pro-egm:goldfish` reads EGM's `egm-review-loop` skill file and follows it, with custom goldfish run through a read-only reviewer agent. Not included in `pro-dev-starter`.
- **`pro-speckit`** - opt-in glue for GitHub's [spec-kit](https://github.com/github/spec-kit) (MIT, bridged, not vendored): the `spec-kit-bridge` skill points to `/pro-dev install` or `/pro-speckit:install`, which install the `specify` CLI at a pinned commit and then set spec-kit up in the repo with model invocation off and its event hooks off. `/pro-speckit:remove` takes spec-kit out of the repo and never touches `specs/`. `/pro-dev check` hashes the files spec-kit wrote against the registry pin without running `specify`. Not included in `pro-dev-starter`.
- **`pro-ship`** - the shipping plugin, included in `pro-dev-starter`. It holds `/pro-ship:pr-check`, which runs the repo's build, lint, typecheck and tests, then the reviewers, then writes a stamp for HEAD. On a high-tier PR it can also run Codex as an advisory second reviewer when the repo opted in through `/pro-dev install`. It also holds a `PreToolUse` gate hook on `gh pr create` that denies once when the stamp is missing (it starts in warn mode and fails open). `/pro-ship:ship` is the go/no-go before a release: it finds the ship targets (a Ship block in `CLAUDE.md` or `AGENTS.md` overrides detection), reviews only the commits no passing `pr-check` marker from someone who can push covered, runs agent-skills' pre-launch checklist with pro-quality's `test-engineer` and `web-performance-auditor`, writes rollout, rollback and post-launch plans per target and records the verdict for HEAD in `.pro-dev/ship/preflight.json` (copied into an ignored `.mieruka/evidence/` for mieruka, see `docs/ship-preflight.md`). It never deploys. A second gate hook, `ship-gate`, warns on a tag, release, publish or production deploy with no fresh GO. `/pro-ship:risk-tiers` explains the risk classifier, which sorts a diff into low, medium or high. It also covers how `/merge-pr` shows its signals before a merge. Then there is `vercel-deploy-bridge`, which deploys through Vercel's `deploy-to-vercel` skill with its own checks: the token comes only from the environment and no `.env` file is uploaded or committed. Every stage, commit, push, link, global install and production deploy waits for a yes. `/pro-dev install` asks once and installs the upstream skill pinned, with its folder kept out of commits. The other Ship skills are still planned.
- **`pro-pdd`** — Define + Plan skills included in `pro-dev-starter`: `interview-me` and `idea-refine` (Define-phase intent extraction and idea refinement, forked from [`agent-skills`](https://github.com/addyosmani/agent-skills), MIT) plus `brainstorming` and written implementation plans (forked from `obra/superpowers`), `adhd` — parallel divergent ideation for open-ended design/architecture/naming/API-surface/fuzzy-debugging decisions, forked from [`UditAkhourii/adhd`](https://github.com/UditAkhourii/adhd) (MIT): spawns 5 isolated subagents under different cognitive frames (regulator, biology, speedrunner, 10-year-old, etc.), scores and clusters the results, prunes traps, and deepens the top 3 survivors. Trigger with `/adhd <problem>` or "ADHD mode". And `lavish` — a **bridge** (not vendored) plus `/lavish` command for the [`lavish-axi`](https://github.com/kunchenguid/lavish-axi) CLI that renders agent output (plans, tables, diagrams, diffs, reports) as reviewable HTML artifacts the user annotates in the browser. The starter/bootstrap path materializes the upstream skill at `.claude/skills/lavish/SKILL.md` and project command at `.claude/commands/lavish.md`; if missing, run `/pro-dev install` or `npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish` from the project root. Use this when you want a conversational define-to-plan workflow instead of SPDD.

**Framework plugins (skills trigger from file context in projects that use the framework):**

- **`pro-nextjs`** - Next.js projects: `next-best-practices` and `next-upgrade`, written from the Next.js docs, `next-skills-bridge`, which routes to the official Next.js agent skills in vercel/next.js and installs them with `/pro-dev install`, `vercel-skills-bridge`, which routes to the React performance and Vercel cost skills in [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (MIT per its README) the same way and `shadcn`. Pairs with the optional `vercel@claude-plugins-official` and `figma@claude-plugins-official` companions.
- **`pro-astro`** - Astro projects: `astro-best-practices` (auto-applied guardrails), `astro-upgrade` (Astro 5 to 6 to 7 and adapter majors), `astro-on-cloudflare` (`@astrojs/cloudflare` on Workers) and `astro-on-vercel` (`@astrojs/vercel`). The content is original, written from the official Astro, Cloudflare and Vercel docs. Pairs with the official Astro Docs MCP server and, on Cloudflare, the official `cloudflare/skills` plugin.
- **`pro-electron`** - Electron apps: `electron-skills-bridge` (routes to jwynia's `electron-best-practices` and laststance's `electron-release`, pinned and installed with `/pro-dev install`), `electron-upgrade` (major-version upgrades) and `electron-security-audit` (a read-only audit against the official security checklist). Driving the running app through Playwright MCP over CDP is a manual setup the skills describe.

**Meta:**

- **`pro-dev-starter`** - pulls the default stack: `pro-core` + `pro-pdd` + `pro-execution` + `pro-quality` + `pro-design` + `pro-testing` + `pro-data` + `pro-research` + `pro-motion` + `pro-security` + `pro-ship`. One install gives the default stack. `pro-ai-sdlc`, `pro-nextjs`, `pro-astro`, `pro-electron`, `pro-spdd`, `pro-egm` and `pro-speckit` are opt-in and installed by hand.
  Version 3.0.0 dropped `pro-ai-sdlc` from the stack; removing a dependency does not uninstall it, so a site that already has it keeps it until you run `claude plugin uninstall pro-ai-sdlc@pro-dev-skillset`.
- **`pro-starter`** - a deprecated shim for one release: it depends only on `pro-dev-starter`. Run `/pro-dev update` to switch.

### Layout

```
.claude-plugin/marketplace.json      # marketplace manifest
.agents/plugins/marketplace.json     # Codex marketplace manifest
plugins/
  pro-ai-sdlc/                       # SDLC stage commands, templates, agents, warn-mode hooks
  pro-core/                          # universal base skills + hooks
  pro-execution/                     # TDD/debug/worktree/subagent execution skills
  pro-quality/                       # quality skills + review/verify commands
  pro-nextjs/                        # Next.js skills
  pro-astro/                         # Astro skills (core, upgrade, Cloudflare, Vercel)
  pro-electron/                      # Electron skills (bridge, upgrade, security audit)
  pro-design/                        # design skills
  pro-testing/                       # testing skills
  pro-data/                          # data/auth skills + schema formatting hook
  pro-motion/                        # video and animation skills
  pro-research/                      # deep-research and lead-research engines
  pro-security/                      # security architect, whole-repo audit, push gate
  pro-legal/                         # opt-in software counsel, legal review plan and release gates
  pro-dev-starter/                   # meta-plugin: dependencies only
  pro-starter/                       # deprecated shim that depends on pro-dev-starter
  pro-spdd/                          # opt-in OpenSPDD workflow commands + skills
  pro-egm/                           # opt-in goldfish review glue for egm@egm
  pro-speckit/                       # opt-in GitHub spec-kit bridge, pinned CLI and install/remove commands
  pro-ship/                          # pr-check, the PR gate hook and the Vercel deploy bridge
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
cd demo/app && claude   # then run /pro-dev check to verify the install through the skills
```

See [demo/LIFECYCLE.md](./demo/LIFECYCLE.md) for the phase-by-phase build trail.

## Headless / CI gotcha

`claude -p` (headless) does NOT trigger the folder-trust prompt that authorizes `extraKnownMarketplaces` ([anthropics/claude-code#13097](https://github.com/anthropics/claude-code/issues/13097)).

Verified workaround:

1. Drop `templates/project-settings.json` into the repo as `.claude/settings.json` (the marketplace is then auto-registered on next `claude` invocation, even headless).
2. Either open `claude` interactively once and accept the folder-trust prompt — OR run `claude plugin install pro-dev-starter@pro-dev-skillset --scope project` explicitly (no prompt required).
3. After install, `.claude/settings.json` is updated so `enabledPlugins` contains both `pro-dev-starter` and `pro-core`. Commit it — subsequent `claude -p` runs in CI then re-resolve the same stack on cache miss.

## Folder-trust prompt

Every first-open of a project that adopts the template settings triggers a folder-trust prompt. This is expected and a one-time cost per project per machine.

## Cleanup

`pro-dev-starter` is a meta-plugin — uninstalling it leaves `pro-core` as an orphaned auto-installed dep. To remove both:

```bash
claude plugin uninstall pro-dev-starter@pro-dev-skillset --scope project
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
codex plugin add pro-ai-sdlc@pro-dev-skillset   # optional: the intent, spec and plan loop
codex plugin add pro-pdd@pro-dev-skillset
codex plugin add pro-execution@pro-dev-skillset
codex plugin add pro-quality@pro-dev-skillset
codex plugin add pro-nextjs@pro-dev-skillset
codex plugin add pro-astro@pro-dev-skillset
codex plugin add pro-electron@pro-dev-skillset   # optional: Electron apps
codex plugin add pro-design@pro-dev-skillset
codex plugin add pro-testing@pro-dev-skillset
codex plugin add pro-data@pro-dev-skillset
codex plugin add pro-motion@pro-dev-skillset
codex plugin add pro-research@pro-dev-skillset
codex plugin add pro-security@pro-dev-skillset
codex plugin add pro-legal@pro-dev-skillset   # opt-in
codex exec --skip-git-repo-check "enumerate available pro-dev skills"
```

Note: Codex does not use `pro-dev-starter`'s Claude dependency cascade. Install the concrete plugins you
want, or run `templates/codex-bootstrap.sh`. Skill bodies, command prose, and sidecars should stay
harness-neutral: no hard-coded `TodoWrite`/`TaskCreate`/`TaskUpdate`, and any Claude Code `Task tool`
or MCP tool-name examples must include a Codex/fallback path.

## Releasing

See [RELEASING.md](./RELEASING.md). TL;DR: bump `plugin.json` AND `marketplace.json` in the same commit, validate strict, tag with `claude plugin tag --push`.

## License

Manifests, templates, hooks, scripts and tooling in this repo are original work under the MIT [LICENSE](./LICENSE).
So are the skills whose footer says so.
Forked, adapted and bridged skills keep their upstream license, recorded per plugin in `plugins/<name>/LICENSE` and listed with every upstream and copyright line in [docs/licenses.md](./docs/licenses.md).
