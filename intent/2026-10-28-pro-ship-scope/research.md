# Research: pro-ship scope

Research the maintainer brought on 2026-10-28, kept as written for the brainstorm that shapes `intent.md` in this folder.
The research's own caveats apply: it read the README and PRs 46, 48, 54 and 65, not `RELEASING.md`, `CLAUDE.md` or the plugin manifests.
Notes from this repo's state on 2026-10-28 are in `## Notes against the repo` at the end.

---

# pro-ship: What Goes in It, Where It Lives, and What to Build First

**Build pro-ship as its own plugin, and have the default meta-plugin list it as a dependency. Do not fold its contents into another plugin.** That is how pro-security and pro-ai-sdlc already work in pro-dev-skillset. Scope it to the gap your README already points at: the "Ship" phase is marked `pro-ship` *(planned)* and lists `ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs` and `deprecation-and-migration`. Fill that gap with four things: a twelve-factor audit, a CI/CD pipeline generator and auditor, a release and versioning workflow, and a production-readiness gate. Your existing `/gh`, `/pr-babysit`, `pro-security` and `pro-legal` already handle commits, PR shepherding, security scanning and legal release review, so pro-ship should call into those rather than rebuild them.

## TL;DR

- **Placement:** make `pro-ship` a standalone plugin and add it to the default stack's dependency list. Note that PR #65, merged today (Oct 28, 2026), renamed `pro-starter` to `pro-dev-starter` 2.0.0 and kept `pro-starter` as a one-release shim, so the dependency belongs in `pro-dev-starter`. Keep the core stack-agnostic. Put React Native/EAS and AWS-specific deploy guidance in reference files, or later in opt-in sibling plugins, the same way pro-nextjs and pro-astro were split out.
- **MVP (v0.1):** `/ship` (a preflight router), `twelve-factor` + `/twelve-factor` (an evidence-based audit of the 12 factors plus Hoffman's API-first, telemetry and authN/Z factors), `/pipeline` (generate or audit GitHub Actions with OIDC to AWS, least-privilege `permissions`, SHA-pinned actions and required checks), `/release` (conventional commits → semver → changelog → tag → GitHub Release), and one warn-mode `PreToolUse` release-gate hook.
- **Later (v0.2–v0.4):** repo hygiene (rulesets, CODEOWNERS, templates, Dependabot/Renovate), deployment strategies and rollback runbooks, supply chain (SBOM, SLSA provenance via GitHub artifact attestations), observability and post-deploy smoke tests, migration safety, web performance and accessibility budgets, mobile (EAS) releases, DORA metrics, and LLM eval gates for AI apps.

## Key Findings

### 1. What your repo tells us about where pro-ship fits

- **The marketplace is organised by lifecycle phase.** The README describes "one continuous software lifecycle… Define → Plan → Spec → Build → Verify → Review → Security → Ship." Ship is the only phase whose plugin has not been built yet.
- **The phase already has placeholder skills.** The Ship row lists `ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs` and `deprecation-and-migration`. They match skill names in `agent-skills` (MIT), which your router already references with † markers. That repo's index describes `ci-cd-and-automation` as "Automated quality gates on every change" and `shipping-and-launch` as "Pre-launch checklist, monitoring, rollback plan". Fork these two as the starting content, the same way pro-pdd forked `interview-me` and `idea-refine`.
- **"Collections" in your repo are meta-plugins made of dependencies.** `pro-starter` is "meta-plugin: dependencies only". PR #65 (merged Oct 28, 2026) renamed it to `pro-dev-starter` (2.0.0) "without pro-nextjs or pro-astro", and `pro-starter` "stays one release as a shim". So "part of the starter" means adding `pro-ship` to `pro-dev-starter`'s `dependencies` array. It does not mean putting files inside it.
- **Your existing plugins already cover parts of shipping. pro-ship should route to them, not duplicate them:**
  - `pro-core`: the `/gh` GitHub workflow command.
  - `pro-ai-sdlc`: `/pr-babysit` plus a warn-mode `production-gate` hook.
  - `pro-security`: `/security-audit`, which already covers "secrets in history, supply chain, CI/CD, containers and IaC". A commit or `gh pr create` that touches security surface is held for a diff review.
  - `pro-legal` (opt-in): a release gate on "git tag, gh release create, package publishes, production deploys, gh pr create".
  - `pro-quality`: a `technical-writer` subagent for release notes, and a doc-freshness gate on `git push`.
- **Follow the conventions you already use:** skill + slash command + read-only subagent per concern, warn-mode hooks behind `~/.claude/hooks/mode`, `.pro-dev/<area>/` storage paths, Codex parity via `.codex-plugin/plugin.json`, `tests/check.mjs` contract checks, and version bumps in `plugin.json` and `marketplace.json` in the same commit.

### 2. What a Claude Code plugin can contain (late 2026)

- **Components.** A plugin is "a directory of skills, agents, hooks, MCP servers, or other components" with a manifest at `.claude-plugin/plugin.json`. Only the manifest goes inside `.claude-plugin/`. `skills/`, `agents/`, `hooks/hooks.json` and `.mcp.json` sit at the plugin root. The docs say "Prefer skills/ for new plugins"; `commands/` is legacy.
- **Skills double as slash commands.** Plugin skills are namespaced: `my-plugin/skills/review/SKILL.md` becomes `/my-plugin:review`. So `skills/release/SKILL.md` in pro-ship runs as `/pro-ship:release`, and you do not need a `pro-` prefix on each skill.
- **Useful SKILL.md frontmatter:**
  - `disable-model-invocation: true` for workflows you want "to trigger manually with /name". The deploy example in the docs pairs it with `context: fork`. Use this on `/release` and `/rollback`.
  - `allowed-tools`, e.g. `Bash(git add *) Bash(git commit *)`.
  - `argument-hint`.
  - `context: fork` + `agent`, which runs the skill in a subagent.
  - `model`.
  - `hooks`, which skills register when invoked.
- **Portability.** Fields beyond `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools` are Claude Code extensions that other surfaces reject. That matters for your Codex parity tests.
- **Hooks can block.** `PreToolUse` fires "before a tool call executes" and "can block it". A blocking hook either exits with code 2 or returns `permissionDecision: "deny"`, and the `if` field accepts permission-rule syntax such as `Bash(git *)`. The docs warn that "the `if` filter is best-effort, use the permission system rather than a hook to enforce a hard allow or deny". So release gates should warn or ask, and should not be treated as security boundaries.
- **Dependencies.** Plugins list dependencies in `plugin.json` with semver ranges. Ranges resolve against tags named `{plugin-name}--v{version}`, and cross-marketplace dependencies need an `allowCrossMarketplaceDependenciesOn` allowlist. This is the mechanism `pro-dev-starter` already uses. Keep official-marketplace companions such as `vercel@claude-plugins-official` optional, as your README already does.

### 3. What already exists (don't duplicate)

| Existing asset | What it covers | pro-ship stance |
|---|---|---|
| `commit-commands@claude-plugins-official` | `/commit`, `/commit-push-pr`, `/clean_gone` | Don't rebuild commit or PR creation. Add the conventional-commit policy and PR-readiness checks on top |
| `pr-review-toolkit`, `code-review` (official) | Multi-agent PR review | Your `pro-quality` review plus these are enough. pro-ship only checks *readiness* (CI green, release notes, migrations) |
| `anthropics/claude-code-action@v1` | @claude mentions, automated PR review, scheduled runs in Actions | Have `/pipeline` *generate* a workflow that uses it (optional), not reimplement it |
| `agent-skills` `ci-cd-and-automation`, `shipping-and-launch` | Generic CI quality gates, launch checklist, staged rollouts | Fork as the base content (MIT), then specialise for your stack |
| `jmagly/aiwg` `twelve-factor` plugin (`/twelve-factor:twelve-factor-audit`, `twelve-factor-reviewer` agent) | Pass/partial/fail 12-factor audit with JSON output | It exists, but its README calls its evidence status "design intent" and ClaudePluginHub rates it 54/100. Write your own, with concrete Node/Next.js and Python checks |
| Your `pro-security`, `pro-legal`, `pro-ai-sdlc`, `pro-quality` | Security audit, legal release gate, PR babysitting, release-notes writer | Route to them from `/ship`; never duplicate |

## Details

### Recommended directory layout

```
plugins/pro-ship/
├── .claude-plugin/plugin.json        # name, version, deps: pro-core (^), optional: pro-security
├── .codex-plugin/plugin.json         # Codex parity, per repo convention
├── LICENSE                           # MIT + agent-skills attribution for forked skills
├── skills/
│   ├── using-pro-ship/SKILL.md       # router: maps "ship it" intents to the skills below
│   ├── ship/SKILL.md                 # /pro-ship:ship  – preflight orchestrator (disable-model-invocation)
│   ├── twelve-factor/                # /pro-ship:twelve-factor – audit
│   │   ├── SKILL.md
│   │   ├── factors.md                # 12 + API-first, telemetry, authN/Z, workload identity
│   │   ├── checks-node-next.md
│   │   └── checks-python.md
│   ├── pipeline/                     # /pro-ship:pipeline – generate|audit GitHub Actions
│   │   ├── SKILL.md
│   │   └── templates/{ci.yml,deploy-aws-oidc.yml,reusable-build.yml,release.yml}
│   ├── release/SKILL.md              # /pro-ship:release – conventional commits → semver → changelog → tag
│   ├── repo-hygiene/SKILL.md         # rulesets, CODEOWNERS, templates, Dependabot/Renovate
│   ├── deploy-strategy/SKILL.md      # blue/green, canary, flags, rollback design
│   ├── rollback/SKILL.md             # /pro-ship:rollback – runbook generation + execution checklist
│   ├── supply-chain/SKILL.md         # SBOM, attestations/SLSA, signed commits (hands off to pro-security)
│   ├── observability/SKILL.md        # OTel, health/readiness, structured logs, SLOs
│   ├── migrations/SKILL.md           # expand/contract, backfills, lock-safety
│   ├── web-budgets/SKILL.md          # Lighthouse CI, bundle size, a11y gates
│   ├── mobile-release/SKILL.md       # EAS build/submit/update, runtimeVersion, staged rollout
│   ├── ai-release/SKILL.md           # eval gates, prompt/model config as config, cost guardrails
│   └── dora/SKILL.md                 # /pro-ship:dora – compute 5 metrics from gh data
├── agents/
│   ├── release-engineer.md           # read-only: judges readiness, writes .pro-dev/ship/preflight.md
│   ├── twelve-factor-auditor.md      # read-only, fresh-context evidence collector
│   └── pipeline-reviewer.md          # read-only: workflow security + speed review
├── hooks/hooks.json                  # warn-mode gates (see table)
└── scripts/                          # deterministic checks (node), e.g. scan-env.mjs, lint-workflows.mjs
```

### Prioritised components

| Pri | Type | Name (invocation) | Purpose / what it does |
|---|---|---|---|
| **P0** | Skill + cmd | `ship` (`/pro-ship:ship`) | Preflight orchestrator. Runs the twelve-factor quick check, pipeline audit, release-readiness checks (CI green, changelog, version bump, migrations flagged), and calls `/security-audit` and `/legal-review` where installed. Writes `.pro-dev/ship/preflight.md` with Blocking / Should-fix / OK |
| **P0** | Skill + cmd + agent | `twelve-factor` (`/pro-ship:twelve-factor [--fix]`) | Evidence-based audit, one row per factor: status, evidence (file:line), remediation. Checks listed below |
| **P0** | Skill + cmd + agent | `pipeline` (`/pro-ship:pipeline generate\|audit`) | Generates or audits GitHub Actions (checks listed below) |
| **P0** | Skill + cmd | `release` (`/pro-ship:release`) | Validates conventional commits, picks the tool (release-please, changesets or semantic-release), proposes the semver bump, drafts release notes (hands prose to `technical-writer`), tags and creates the GitHub Release. `disable-model-invocation: true` |
| **P0** | Hook | `release-gate` (PreToolUse, `if: Bash(git tag *)`, `gh release create *`, `git push * main`) | Warn mode: if `.pro-dev/ship/preflight.md` is missing or stale for HEAD, print or ask to run `/pro-ship:ship`. Coordinate with pro-legal's gate so a single tag doesn't trigger two prompts |
| **P1** | Skill + cmd | `repo-hygiene` (`/pro-ship:repo-hygiene`) | Audits or scaffolds rulesets (required checks, required reviews, linear history, merge queue), CODEOWNERS, PR/issue templates (YAML forms), `dependabot.yml` or `renovate.json`, `SECURITY.md`. Uses `gh api` |
| **P1** | Skill | `deploy-strategy` | Chooses blue/green, canary or flags per target (Vercel/Cloudflare previews and instant rollback; AWS CodeDeploy/ECS/Lambda aliases; feature-flag lifecycle) |
| **P1** | Skill + cmd | `rollback` (`/pro-ship:rollback`) | Generates `docs/runbooks/rollback.md` per service and walks through an actual rollback. `disable-model-invocation: true` |
| **P1** | Hook | `conventional-commit-check` (PreToolUse `Bash(git commit *)`) | Warns on non-conforming messages. Skip if commitlint/husky already exists |
| **P1** | Hook | `workflow-lint` (PostToolUse on edits to `.github/workflows/*`) | Runs actionlint/zizmor if present. Flags `pull_request_target` misuse, unpinned actions, missing `permissions` |
| **P2** | Skill | `observability` | OTel setup (`instrumentation.ts` + `@vercel/otel` for Next.js; OTel SDK for Python), `/healthz` + `/readyz`, structured JSON logs to stdout, SLO/alert stubs |
| **P2** | Skill | `supply-chain` | CycloneDX/SPDX SBOM, `actions/attest-build-provenance`, signed tags/commits, npm provenance |
| **P2** | Skill | `migrations` | Expand/contract checklist for Prisma/Drizzle/Alembic. Flags destructive DDL in a release |
| **P2** | Skill | `web-budgets` | Lighthouse CI, bundle-size budget, axe accessibility gate in the pipeline |
| **P2** | Skill + cmd | `smoke` (`/pro-ship:smoke <url>`) | Post-deploy verification: health endpoints, critical-path Playwright smoke (defers to pro-testing) |
| **P3** | Skill | `mobile-release` | EAS build/submit/update; runtimeVersion policy; channels; staged rollout; store versioning |
| **P3** | Skill + cmd | `ai-release` (`/pro-ship:ai-release`) | Eval gate in CI, prompt/model versioning, cost guardrails |
| **P3** | Skill + cmd | `dora` (`/pro-ship:dora`) | Computes DORA's five metrics from `gh` deployments, PRs and incident labels |
| **P3** | Agent | `release-engineer` | Read-only fresh-context judge for `/ship`, mirroring `security-auditor` |

### The twelve-factor audit: concrete checks

Use the original 12 factors plus Kevin Hoffman's *Beyond the Twelve-Factor App* (O'Reilly, April 2016). In a 2016 O'Reilly excerpt from the book, Hoffman says he "added factors such as telemetry, security, and the concept of 'API first'" and calls the result "15-factor guidelines". Also track the open-source refresh. Heroku open-sourced Twelve-Factor on 12 November 2024, per both the 12factor.net announcement by Yehuda Katz and Heroku's own post by Chief Architect Vish Abrams. Its maintainers' FAQ says "We intend to keep the number of factors the same". Their open proposals add a **workload identity** factor (issue #9), allow **mounted-volume config** (issue #4), and expand **logs to telemetry** (issue #3). Treat those as proposals, not settled factors.

| Factor | Node/Next.js checks | Python checks |
|---|---|---|
| I Codebase | One deployable per repo or a clear monorepo app boundary; no copy-pasted shared code between apps | Same |
| II Dependencies | Lockfile committed; `npm ci`/`pnpm i --frozen-lockfile` in CI; `engines` + `.nvmrc`; no reliance on global CLIs | `uv.lock`/`poetry.lock`/pinned `requirements.txt`; `requires-python` |
| III Config | No hard-coded URLs or keys; `process.env` read through a single validated schema (zod/t3-env) that fails fast at boot; `.env*` gitignored with a committed `.env.example`; `NEXT_PUBLIC_*` reviewed for secrets; build-time vs runtime env understood | `pydantic-settings`/`os.environ` with validation; no `settings_prod.py` branching on hostname |
| IV Backing services | DB/Redis/S3 via URL env vars; swappable without code change | Same |
| V Build, release, run | Immutable build artifact; config injected at release; no `npm run build` on the prod box | Wheel/container built once, promoted |
| VI Processes | No in-memory sessions or local-disk uploads (use S3/Redis); serverless-safe | No module-level mutable state used as a cache across requests |
| VII Port binding | `PORT` honoured; self-contained server (`next start`, standalone output) | `uvicorn`/`gunicorn` binding `$PORT` |
| VIII Concurrency | Scale out by processes or instances, not threads; background jobs in a separate worker process type | Celery/RQ/ARQ workers separate from web |
| IX Disposability | SIGTERM handler that drains the server and closes pools; fast boot; idempotent jobs | Same; gunicorn graceful timeout |
| X Dev/prod parity | docker-compose with the same Postgres/Redis major versions; no SQLite-in-dev/Postgres-in-prod | Same |
| XI Logs → telemetry | JSON logs to stdout (pino); no file transports; OTel traces | `structlog`/JSON to stdout; OTel |
| XII Admin processes | Migrations and one-offs as scripts run in the release image (`prisma migrate deploy`) | `alembic upgrade`, management commands |
| + API first | OpenAPI/GraphQL schema committed and contract-tested | Same (FastAPI schema export) |
| + Telemetry | Health/readiness endpoints, RED metrics, trace propagation | Same |
| + AuthN/Z & identity | No shared static credentials between services; OIDC/workload identity in CI and runtime | Same |

### The CI/CD pipeline: what `/pipeline` generates and audits

- **Stages:** install (cached) → lint → typecheck → unit test → build → preview deploy on PR → integration/e2e → promote to staging → manual approval via GitHub Environments → production.
- **Structure:** a matrix for Node/Python versions, reusable workflows (`workflow_call`) for build and deploy, and `concurrency` groups to cancel superseded runs.
- **AWS auth via OIDC instead of long-lived keys.** GitHub's docs say OIDC lets workflows access AWS "without needing to store the AWS credentials as long-lived GitHub secrets". It requires `permissions: id-token: write` and `aws-actions/configure-aws-credentials` with `role-to-assume`. Scope the trust policy's `sub` claim to the repo and environment.
- **Workflow hardening:** a top-level `permissions: {}` or read-only default, actions pinned to full commit SHAs (GitHub's own example pins `configure-aws-credentials` by SHA), and no secrets exposed to `pull_request_target`.
- **Required checks and merge queue.** Required status checks must pass before merge. If you enable a merge queue, CI must also trigger on `merge_group`, or the queue stalls. A skipped job reports "Success" and will not block a merge even when it is required, so `/pipeline audit` should flag conditionally skipped required jobs.
- **Supply chain:** `actions/attest-build-provenance`. GitHub says "Artifact attestations by itself provides SLSA v1.0 Build Level 2", and that "Reusable workflows can provide isolation between the build process and the calling workflow, to meet SLSA v1.0 Build Level 3."

### Release workflow choices

- **release-please** (the default for apps). It "opens a release pull request instead and does nothing until someone merges it", and it writes `CHANGELOG.md` by default. It fits your PR-centric, human-in-the-loop style, and its manifest mode handles monorepos.
- **changesets** for multi-package libraries.
- **semantic-release** only for fully automated single-package publishing.
- All three except changesets need disciplined Conventional Commits, so pair them with the commit-check hook.

## Recommendations

1. **Placement.** Create `plugins/pro-ship` and add it to `pro-dev-starter`'s dependencies; the `pro-starter` shim inherits it. Make the hooks warn-mode by default so new installs aren't blocked. Move the README's Ship row from *(planned)* to `pro-ship`, and route "ship/release/deploy/CI" intents in `using-pro-dev`.
2. **v0.1 (MVP, about a week):**
   - `ship`, `twelve-factor` (+ auditor agent), `pipeline` (generate/audit, AWS OIDC + Vercel templates), `release` (release-please path first).
   - The `release-gate` hook.
   - Fork `ci-cd-and-automation` and `shipping-and-launch` from agent-skills as reference material.
   - Add `tests/check.mjs` contract cases and routing evals.
3. **v0.2:** `repo-hygiene`, `deploy-strategy`, `rollback`, the commit and workflow-lint hooks, and `documentation-and-adrs` / `deprecation-and-migration`, which the README already lists for this phase.
4. **v0.3:** `observability`, `smoke`, `migrations`, `supply-chain`, `web-budgets`.
5. **v0.4:** `ai-release`, `dora`, `mobile-release`. If mobile content grows, split it into an opt-in `pro-expo` or `pro-mobile` plugin, mirroring how `pro-nextjs` and `pro-astro` came out of the default starter.
6. **Naming.** Keep `pro-ship` as the plugin name and short verb skill names (`/pro-ship:ship`, `/pro-ship:release`, `/pro-ship:rollback`). Namespacing already prevents collisions, and your other plugins use unprefixed skill names (`security-audit`, `threat-model`). Avoid `/review` and `/commit`, which collide in users' heads with the official plugins.

## What else to consider

- **Mobile (React Native/Expo).** OTA updates only reach binaries whose runtime version matches: "The runtime version of the build and the target runtime version of an update must match exactly." Expo recommends `runtimeVersion: { policy: "appVersion" }`; the fingerprint policy is an alternative. Use channels (production/staging) and `eas update` staged rollouts. Have `mobile-release` block an OTA when native code changed.
- **DORA.** Measure the current *five* metrics: change lead time, deployment frequency, failed deployment recovery time, change fail rate and deployment rework rate. Rework rate was added in 2024, which DORA's own history of its metrics calls "the most significant structural change to the metrics". Use them per service against its own history; don't use them to rank teams.
- **AI-app shipping.** Gate prompt and model changes with eval suites in CI. `promptfoo/promptfoo-action` posts PR summaries, has a `fail-on-threshold` input, and supports `repeat`/`repeat-min-pass` for non-deterministic tests. Keep the model ID, temperature and prompt versions in versioned config, not inline. Add per-environment token and cost budgets, and alert on spend anomalies. Your profile already treats "evals as the release gate", and pro-ship is where that becomes concrete.
- **Observability for Next.js.** `instrumentation.ts` with `registerOTel({ serviceName })` from `@vercel/otel` covers the Node and Edge runtimes. The Next.js 15 release post says `instrumentation.js` is "now stable and the experimental.instrumentationHook config option can be removed."
- **Release trains and freezes, incident runbooks, feature-flag cleanup, and status pages** are good later candidates for `deploy-strategy` and `rollback`.

## Caveats

- I read the repo README and PRs #46, #48, #54 and #65. I did not read `RELEASING.md`, `CLAUDE.md` or individual `plugin.json` files, so check exact dependency syntax and the hook-mode mechanics against your own code.
- Claude Code's hook `if` filter is "best-effort", so treat pro-ship hooks as guardrails, not enforcement. Hard policy belongs in GitHub rulesets and Environments.
- The Twelve-Factor refresh is still in progress. The workload-identity, config and telemetry changes are open proposals. The open-sourcing date itself is settled: the 12factor.net and Heroku primary announcements both say 12 November 2024, though some secondary sources misdate it.
- Install counts and ratings for third-party plugins come from aggregator sites and may be inaccurate.

---

## Notes against the repo

Written 2026-10-28 after PR 68, for the brainstorm.

- pro-ship already exists (PR 68, 0.1.0) as an opt-in plugin holding `vercel-deploy-bridge`; the research predates it. Its `vercel-deploy` row stays opt-in if pro-ship joins the starter.
- pro-ai-sdlc's `production-gate` and pro-legal's release gate already react to `git tag` and `gh release create`; a pro-ship release gate makes three, so they need one shared prompt.
- This repo puts slash commands in `commands/`; the research's "prefer skills/" advice is a choice to make before v0.1, since `disable-model-invocation` skills cannot be chained by the model (the EGM lesson in `CLAUDE.md`).
- Every plugin that owns registry rows gets its own installer (intent `2026-10-28-plugin-installers`), so any pro-ship engine needs `/pro-ship:install`.
- The maintainer's own adds from the same day: GitHub practices (branch and PR hygiene, conventional commits, rulesets, CODEOWNERS, Dependabot) and portable, twelve-factor apps; both map to the research's `repo-hygiene` and `twelve-factor`.
