# Plan: wrap qa-skills, absorb agent-skills, salvage gstack, then remove gstack

## Context

Three related goals:
0. **Wrap `petrkindlmann/qa-skills` into `pro-testing` first** (MIT) using a vendor-and-adapt model: vendor the full 43-skill QA library, expose only the testing-core subset, retire the two current hand-forked qa-skills skills, and sharpen the `agent-browser` vs `playwright-automation` boundary.
1. **Absorb the genuinely-additive parts of `addyosmani/agent-skills`** (MIT) into the marketplace — 12 net-new skills, 5 reference checklists, 1 agent — without duplicating skills we already have at equal rigor, and without disturbing `pro-spdd` (sole owner of spec-driven work).
2. **Remove `pro-gstack` entirely**, but first salvage the ~22 of its 58 skills whose value is framework-independent (survives without the gstack runtime: gbrain, browser daemon, telemetry, deploy/queue infra, iOS bridge, proprietary binaries). The rest (~30) are pure gstack runtime/infra and are dropped with the plugin.

These are executed as **small, independently-reviewable phases**. Each phase ends with version bumps, marketplace registration, and `claude plugin validate` passing, so it can be reviewed and shipped before the next begins. **Removing `pro-gstack` is the final phase** — nothing is deleted until all salvage is done and validated.

The net effect: `pro-testing` becomes a robust QA plugin that tracks a strong upstream and has a clear interactive-vs-committed-suite boundary; the persona-driven planning/review workflows CLAUDE.md calls "the backbone of the solo-developer use case" survive (in a new `pro-review` plugin); the gstack security audit engine moves into `pro-security`; and the gstack plugin and its runtime coupling go away.

## Locked decisions

- **qa-skills mechanism: vendor-and-adapt.** Clone `petrkindlmann/qa-skills` into `plugins/pro-testing/upstream/qa-skills/` intact (skills + references + LICENSE + AGENTS.md). Expose chosen skills through thin shims under `plugins/pro-testing/skills/<name>/`. Do not use a git submodule or runtime `npx skills add`.
- **qa-skills scope: vendor the full 43, expose only the testing-core subset.** Skills owned by other existing/planned plugins are vendored-but-not-exposed to avoid cross-plugin trigger collisions.
- **Retire current qa-skills forks.** `plugins/pro-testing/skills/playwright-automation/` and `visual-testing/` become shims over the vendored upstream versions after diffing for local additions. The local `agent-browser`/Playwright durability boundary is carried into the shim, not the vendored upstream file.
- **`agent-browser` stays separate.** It is vercel-labs/Apache-2.0 and remains the interactive browser-driving skill. The durable regression-suite path is `playwright-automation`.
- **Testing axis wording:** use **interactive verification (`agent-browser`) vs committed regression suite (`playwright-automation`)**, not "ad-hoc vs e2e."
- **`/test` command:** add a thin orchestration command on top of repo test tooling, composing with qa-skills router/foundation skills (`qa-do`/`qa-start`) where useful.
- **agent-skills overlaps → skip duplicates.** Keep existing superpowers-derived skills; do NOT fork agent-skills' `test-driven-development`, `debugging-and-error-recovery`, `code-review-and-quality`, `git-workflow-and-versioning`, `incremental-implementation`, `interview-me`, `idea-refine`, `browser-testing-with-devtools`, `using-agent-skills`.
- **Skip agent-skills `spec-driven-development`** and **`planning-and-task-breakdown`** — `pro-spdd` and `pro-pdd/writing-plans` cover these.
- **agent-skills agents:** fork `security-auditor` only (skip `code-reviewer`, `test-engineer`).
- **agent-skills hooks:** skip `session-start.sh`; defer `sdd-cache` + `simplify-ignore` to optional Phase 11.
- **gstack: salvage everything framework-independent, drop the rest, delete the plugin last.** Dedupe the "plain" vs "openclaw" packagings — prefer the cleaner-to-port source per skill.
- **gstack security:** move `gstack-cso` into `pro-security` (it's pure bash+grep, no gstack binary). This gives `pro-security` all three tiers — build-guide + light auditor agent + deep audit engine — and removes the earlier reason to keep gstack.

## Source repos

- qa-skills clone: `/tmp/qa-skills` (currently present; ephemeral — re-create with `git clone --depth 1 https://github.com/petrkindlmann/qa-skills.git /tmp/qa-skills`).
- agent-skills clone: `/tmp/agent-skills`
- gstack vendored content: `plugins/pro-gstack/upstream/gstack/<name>/SKILL.md` (the `skills/gstack-<name>/` dirs are thin adapters).

## qa-skills wrap details

`pro-testing` currently has 5 skills. Two (`playwright-automation`, `visual-testing`) are hand-forked from `petrkindlmann/qa-skills`, leaving dangling related-skill references (`test-reliability`, `selector-drift-recovery`, `ci-cd-integration`, `api-testing`, `accessibility-testing`) and missing real user-facing capabilities such as standalone API/contract testing and a "which test tool when" decision model.

The fix is to vendor the whole qa-skills tree and expose a deliberately bounded subset. This mirrors the existing `pro-gstack` pattern (`plugins/pro-gstack/upstream/gstack/` + thin adapter skills) while keeping `pro-testing` trigger surfaces clean.

### Adapter pattern

Each exposed qa-skills skill gets a shim:

```markdown
---
name: <name>
description: <upstream description as the base, sharpened with local anti-triggers where needed>
---
# <name>

Follow `../../upstream/qa-skills/skills/<name>/SKILL.md` and its `references/`.
Adapt host tool names to the current session. Do not run any upstream install/CLI
bootstrap. Read referenced files completely before producing artifacts.

_Wraps [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — MIT._
```

Do not copy upstream descriptions verbatim when doing so would create a trigger collision. The shim description is the canonical routing boundary. Use upstream frontmatter and `AGENTS.md` anti-triggers as the base, then add local `Use when` / `Not for` wording where this marketplace needs clearer ownership.

### Exposure rule

Expose only testing-domain skills whose descriptions pass overlap checks. Initial expose set:

`qa-project-context`, `qa-do`, `qa-start`, `test-strategy`, `playwright-automation`, `visual-testing`, `api-testing`, `contract-testing`, `service-virtualization`, `selector-drift-recovery`, `test-reliability`, `cypress-automation`, `cross-browser-testing`, `database-testing`, `test-data-management`, `test-environments`, `ai-test-generation`, `ai-bug-triage`, `ai-qa-review`, `qa-metrics`, `coverage-analysis`, `test-migration`.

Any additional production/observability/process qa-skills must be explicitly added to this list before shims are committed. Do not expose them under a broad rule.

Vendor but do not expose:

- `unit-testing` — held because `pro-testing/vitest` owns focused TS/React unit/component tests.
- `security-testing` — owned by planned `pro-security`.
- `ci-cd-integration` — owned by planned `pro-ship`.
- `accessibility-testing` — overlaps existing `pro-design/accessibility-audit`.
- `release-readiness` — owned by planned `pro-ship/shipping-and-launch`.

### Overlap reconciliation

| Overlapping skills | Decision | Boundary |
|---|---|---|
| qa-skills `playwright-automation`, `visual-testing` vs current forks | KEEP-OURS -> vendored | Retire forks after diff; keep local durability-boundary additions in shims. |
| qa-skills `unit-testing` vs `pro-testing/vitest` | HOLD `unit-testing` | `vitest` stays the focused TS/React unit/component skill. |
| qa-skills `api-testing`/`contract-testing` vs `pro-spdd/spdd-api-test-lead` | CROSS-REF | pro-testing = general API/schema/contract tests; SPDD = Phase-4 cURL script bound to acceptance criteria. |
| qa-skills `security-testing` vs planned `pro-security` | HOLD | Security belongs to `pro-security`. |
| qa-skills `ci-cd-integration` vs planned `pro-ship` | HOLD | CI/CD belongs to `pro-ship`. |
| qa-skills `accessibility-testing` vs `pro-design/accessibility-audit` | HOLD | Accessibility belongs to `pro-design`. |
| qa-skills `release-readiness` vs planned `pro-ship/shipping-and-launch` | HOLD | Release readiness belongs to `pro-ship`. |
| qa-skills `test-strategy`/`risk-based-testing`/`test-planning` vs `pro-pdd`/`pro-spdd` planning | CROSS-REF | QA test strategy is not product/spec planning. |
| `agent-browser` vs vendored `playwright-automation` | CROSS-REF | Interactive verification vs committed typed regression suite. |
| `/test` command vs built-in `/run`, `/verify`, `/code-review` | CROSS-REF | `/test` runs suites; `/run` launches app; `/verify` confirms a change; `/code-review` reviews a diff. |

Before committing each exposed shim: read its upstream description and `AGENTS.md` anti-triggers, grep other plugins' skill descriptions for keyword collisions, and either hold the skill or sharpen both sides. Any new collision gets a row in this table before exposure.

### pro-testing connective tissue

- `agent-browser` description/footer: interactive, in-the-loop browser driving; not a committed suite. Note `dogfood` as CLI-bundled (`agent-browser skills get dogfood`), not a repo skill.
- `playwright-automation` shim: committed, typed, CI-run suite; for interactive verification use `agent-browser`; for pure logic/unit/component testing use `vitest`.
- `vitest` skill: add the same choosing-between-these block so users route correctly.
- `/test` command (`plugins/pro-testing/commands/test.md`): detect vitest/jest config, `playwright.config.*`, Cypress, and Storybook; run each suite; route failures into `test-reliability`, `selector-drift-recovery`, or `ai-bug-triage` as appropriate.
- agent-skills `testing-patterns.md`: co-locate as a reference in `pro-testing` during this same phase, not as a later separate `0.4.0` bump.

## gstack salvage classification (deduped)

**DROP (~30) — gstack runtime/infra, removed with the plugin:** `browse`, `scrape`, `skillify`, `benchmark`, `benchmark-models`, `pair-agent`, `open-gstack-browser`, `setup-browser-cookies`, `setup-gbrain`, `sync-gbrain`, `learn`, `landing-report`, `plan-tune`, `gstack-gstack`, `gstack-upgrade`, `hackernews-frontpage`, `design-html`, `design-shotgun`, `ios-clean`, `ios-design-review`, `ios-fix`, `ios-qa`, `ios-sync`, `qa`, `qa-only` (covered by pro-testing), `investigate`/`openclaw-investigate` (covered by pro-execution `systematic-debugging`).

**MOVE (~22) — by destination:**

| Destination | Salvaged skills | Notes |
|---|---|---|
| NEW `pro-review` | `office-hours`, `plan-ceo-review`, `plan-eng-review`, `plan-design-review`, `plan-devex-review`, `autoplan` | persona planning/review suite; use openclaw source for office-hours/ceo-review where cleaner |
| `pro-security` | `cso` | 14-phase OWASP+STRIDE audit engine |
| `pro-quality` | `review`, `design-review`, `health`, `codex` | post-code quality gates; `codex` needs the external `codex` CLI |
| `pro-ship` | `ship`, `land-and-deploy`, `setup-deploy`, `document-generate`, `document-release`, `make-pdf` | `make-pdf` needs a Paged.js/Chromium renderer (gstack binary) — ship a script or mark setup-required |
| `pro-design` | `design-consultation` | taste-profiling + design-system methodology |
| `pro-core` | `careful`, `guard`, `freeze`, `unfreeze`, `context-save`, `context-restore`, `retro` | safety hooks + context checkpoints + git retrospective |
| `pro-spdd` | `spec` | **evaluate fit** — pro-spdd already owns a complete REASONS/SPDD spec workflow; `gstack-spec` may be redundant. Include only if it complements rather than competes. |

## agent-skills inventory (net-new + skipped overlaps)

**Upstream:** `addyosmani/agent-skills` — 23 production-grade engineering workflow skills for AI coding agents, MIT-licensed.

```
skills/            # 23 workflow skills
agents/            # 3 specialist personas (code-reviewer, test-engineer, security-auditor)
references/        # security / testing / performance / accessibility / orchestration checklists
.claude/commands/  # 7 Claude Code slash commands
.gemini/commands/  # 7 Gemini CLI slash commands
docs/              # setup guides (cursor, copilot, gemini-cli, opencode, windsurf, skill-anatomy)
hooks/             # session lifecycle integrations
```

**Skills organized by lifecycle phase (upstream taxonomy):**
- **Define (3):** interview-driven requirements, idea refinement, spec-driven development
- **Plan (1):** task breakdown with acceptance criteria
- **Build (6):** incremental implementation, testing, API design, frontend, context management, source-driven
- **Verify (2):** browser testing, debugging
- **Review (4):** code-quality gates, simplification, security hardening, performance
- **Ship (5):** git workflows, CI/CD, deprecation, docs, launch
- **Meta (1):** maps work → appropriate skill workflow

We absorb by *domain* rather than mirroring this lifecycle taxonomy (the marketplace is domain-plugin-oriented). The Define/Plan/Verify phases are mostly skipped (covered by `pro-spdd`/`pro-pdd`/`pro-execution`); the Build/Review/Ship phases are where the net-new value lands. We do not fork the `.claude/commands`, `.gemini/commands`, or `docs/`.

**Net-new — the big wins (no equivalent here):**
- Skills: `api-and-interface-design`, `frontend-ui-engineering`, `context-engineering`, `source-driven-development`, `doubt-driven-development`, `code-simplification`, `security-and-hardening`, `performance-optimization`, `ci-cd-and-automation`, `deprecation-and-migration`, `documentation-and-adrs`, plus `shipping-and-launch` (net-new to the default stack).
- Agents: `security-auditor` (taking) + `code-reviewer`, `test-engineer` (skipped).
- References: `security-checklist`, `performance-checklist`, `accessibility-checklist`, `testing-patterns`, `orchestration-patterns` (all taken).

**Overlaps with existing skills → routing decision (all SKIP the fork, keep ours):**

| agent-skills | existing here | decision |
|---|---|---|
| `spec-driven-development` | `pro-spdd` (owns spec work) | skip — pro-spdd wins |
| `planning-and-task-breakdown` | `pro-pdd/writing-plans` | skip |
| `interview-me` / `idea-refine` | `pro-core/grill-me`, `pro-pdd/brainstorming` | skip |
| `test-driven-development` | `pro-execution/test-driven-development` (near-dup) | skip |
| `debugging-and-error-recovery` | `pro-execution/systematic-debugging` | skip |
| `code-review-and-quality` | `pro-quality/requesting`+`receiving-code-review` | skip |
| `git-workflow-and-versioning` | `pro-execution/using-git-worktrees`, `pro-core/gh` | skip |
| `incremental-implementation` | `pro-execution/subagent-driven-development` | skip |
| `browser-testing-with-devtools` | `pro-testing/agent-browser`+`playwright` | skip |
| `using-agent-skills` | `pro-core/find-skills` | skip (meta-skill; hard-codes a static catalog) |

Rationale: the existing equivalents are `obra/superpowers`-derived and equally rigorous (e.g. TDD 374 lines + sidecar, debugging 300 lines + 5 sidecars), with load-bearing sidecars. Forking the agent-skills versions would add double-triggering and maintenance with no quality gain.

## Global conventions (every forked/salvaged file)

1. **Attribution footers** matching repo convention:
   - agent-skills: `_Forked from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) — MIT License._`
   - gstack: `_Adapted from [garrytan/gstack](https://github.com/garrytan/gstack) — MIT License._` (verified: MIT, © 2026 Garry Tan; matches existing pro-gstack wording)
2. **`LICENSE`** added to each new plugin (`pro-security`, `pro-ship`, `pro-review`).
3. **Version-bump law** (`CLAUDE.md`/`RELEASING.md`): bump each touched `plugin.json` version **and** its `marketplace.json` entry; new plugins get a new entry; bump top-level `metadata.version` once per phase touching the manifest.
4. **gstack preamble strip** (when salvaging): remove update-checks, telemetry/analytics writes, gbrain `context_queries` frontmatter + `gstack-learnings-search`, `gstack-slug`/`gstack-paths` sourcing (replace output paths with repo-local or `~/.claude/...`), routing injection, question-tuning/"Continuous Checkpoint Mode", session/restore-point caches.
5. **Binary neutralization** (when salvaging): `$B` browse-daemon calls → use pro-testing `agent-browser`/claude-in-chrome MCP or mark as optional enhancement; `$D` design-binary calls → optional/no-op; `codex` CLI → keep but make optional (external tool, not gstack-proprietary); bundle self-contained hook scripts (`check-careful.sh`, `check-freeze.sh`) into the destination skill's `bin/`.
6. **Codex-parity port fixes** (agent-skills): soften hard `CLAUDE.md` refs to "CLAUDE.md / AGENTS.md / equivalent" in `context-engineering`, `code-simplification`, `documentation-and-adrs`; keep frontmatter `name`+`description` only.
7. **Reference co-location:** a skill reaches sidecars only inside its own plugin — co-locate each cited checklist in the consuming skill's dir and rewrite the in-body path; duplicate across plugins as needed (`shipping-and-launch` cites all three checklists → carry all three in `pro-ship`).

## Phases (each independently reviewable + shippable)

### Phase 0 — Fold qa-skills into `pro-testing` (do first)
This is the merged version of the former `QA-SKILLS-WRAP-PLAN.md`.
- Vendor `/tmp/qa-skills` into `plugins/pro-testing/upstream/qa-skills/` intact, including `skills/`, `references/`, `AGENTS.md`, and `LICENSE`.
- Retire current standalone `playwright-automation` and `visual-testing` forks after diffing them against upstream and carrying any local additions into shims.
- Add shims for the explicit exposed qa-skills subset only; held skills remain present only under `upstream/`.
- Edit `agent-browser`, `playwright-automation`, and `vitest` to use the interactive verification vs committed regression suite boundary.
- Add `plugins/pro-testing/commands/test.md`.
- Co-locate agent-skills `testing-patterns.md` reference in `pro-testing` during this same phase.
- Bump `pro-testing` v0.3.3 -> v0.4.0, update marketplace entry and top-level `metadata.version`, then validate.

### Phase 1 — NEW `pro-security`
Full security tier in one plugin.
- agent-skills: `security-and-hardening` skill, `security-auditor` agent, `security-checklist.md` (co-located).
- gstack: `cso` (strip preamble; drop `gstack-learnings-search` and slug paths).
- Optional: cross-reference between `security-and-hardening` (build), `security-auditor` (quick review), `cso` (deep audit); optionally enrich `security-auditor` with three `cso` ideas (confidence gating, quote-the-source pre-emit gate, variant analysis).
- `plugin.json` v0.1.0, `LICENSE`, register + bump `metadata.version`, validate.

### Phase 2 — NEW `pro-ship`
- agent-skills: `ci-cd-and-automation`, `deprecation-and-migration`, `shipping-and-launch`, `documentation-and-adrs` (+ co-located security/performance/accessibility checklists for `shipping-and-launch`).
- gstack: `ship`, `land-and-deploy`, `setup-deploy`, `document-generate`, `document-release`, `make-pdf`.
- **Reconcile overlaps:** keep agent-skills versions as the principles/checklist layer and gstack versions as the executable end-to-end workflow layer (e.g. `shipping-and-launch` = checklist, `ship`/`land-and-deploy` = the run-it workflow; `documentation-and-adrs` = decision records, `document-generate`/`-release` = Diataxis authoring). Cross-reference rather than merge. Decide per-skill during the phase; flag any true redundancy for drop.
- `plugin.json` v0.1.0, `LICENSE`, register + bump, validate.

### Phase 3 — NEW `pro-review` (the gstack crown jewels)
Persona-driven planning/review suite, pure salvage.
- `office-hours`, `plan-ceo-review`, `plan-eng-review`, `plan-design-review`, `plan-devex-review`, `autoplan` (strip preamble; bundle `dx-hall-of-fame.md` reference for devex; `autoplan` coordinates the others — make codex/restore-point bits optional).
- `plugin.json` v0.1.0, `LICENSE`, register + bump, validate.

### Phase 4 — Fold into `pro-core`
- agent-skills: `context-engineering`, `doubt-driven-development`, `orchestration-patterns.md` (reference).
- gstack: `careful`, `guard`, `freeze`, `unfreeze` (bundle `check-careful.sh`/`check-freeze.sh` into `bin/`; replace `gstack-paths` state dir with `~/.claude/state/`), `context-save`, `context-restore` (replace slug/paths with repo-local), `retro` (git-based; strip learnings).
- Bump pro-core (v0.7.0 → 0.8.0), update marketplace, validate.

### Phase 5 — Fold into `pro-quality`
- agent-skills: `code-simplification`, `performance-optimization` (+ co-located `performance-checklist.md`).
- gstack: `review` (pre-landing PR review), `design-review` (designer-eye QA+fix), `health` (code-health dashboard; drop gbrain D6 sub-score), `codex` (Codex CLI wrapper; keep codex optional).
- **Reconcile:** existing `requesting/receiving-code-review` + new `code-simplification` + gstack `review`/`codex` are complementary review angles — cross-reference; flag redundancy if any.
- Bump pro-quality (v0.6.1 → 0.7.0), validate.

### Phase 6 — Fold into `pro-execution`
- agent-skills: `api-and-interface-design`, `source-driven-development`.
- Bump pro-execution (v0.1.0 → 0.2.0), validate.

### Phase 7 — Fold into `pro-design`
- agent-skills: `frontend-ui-engineering` (+ co-located `accessibility-checklist.md`).
- gstack: `design-consultation` (strip preamble; `$D` mockup is optional enhancement; competitive research via WebSearch).
- Bump pro-design (v0.4.2 → 0.5.0), validate.

### Phase 8 — `pro-testing` checkpoint
No separate `pro-testing` implementation phase remains here; Phase 0 owns the qa-skills wrap, agent-skills `testing-patterns.md`, and the v0.4.0 bump. Use this checkpoint only to verify later cross-plugin references still route correctly after `pro-security`, `pro-ship`, `pro-review`, and `pro-design` have landed.

### Phase 9 — `pro-spdd` (conditional)
- gstack: `spec` — **only if** it complements pro-spdd's REASONS/SPDD workflow rather than competing. If redundant, drop it and skip this phase.
- If included: bump pro-spdd, validate.

### Phase 10 — Marketplace integration, validation, docs
- Full repo validation: `claude plugin validate . --strict`.
- Codex-parity scan across all new bodies: no `Task`/`TodoWrite`, no `/mnt/skills/...`, no unhedged `CLAUDE.md`-only assumptions, frontmatter = `name`+`description`; every sidecar reference resolves within its plugin.
- Update `README.md` (plugin table: add `pro-security`, `pro-ship`, `pro-review`; new skills) and `CLAUDE.md` (use-case sections — the persona suite now lives in `pro-review`, not `pro-gstack`).
- Confirm all entry versions match their `plugin.json` and `metadata.version` is current.

### Phase 11 — Companion hooks (optional)
- `sdd-cache` (WebFetch cache) → `pro-execution/hooks/`, pairs with `source-driven-development`.
- `simplify-ignore` (block-masking) → `pro-quality/hooks/`, pairs with `code-simplification`.
- Port `CLAUDE_PROJECT_DIR`/hook-event coupling; validate; smoke-test.

### Phase 12 (FINAL) — Remove `pro-gstack`
Only after Phases 0–10 are reviewed and validated.
- Delete `plugins/pro-gstack/` (entire dir incl. vendored `upstream/gstack/`).
- Remove the `pro-gstack` entry from `.claude-plugin/marketplace.json`; bump `metadata.version`.
- Scrub references: `README.md`, `CLAUDE.md` (the "experimenting with"/use-case-1 sections name GStack — rewrite to point at `pro-review`/`pro-security`/`pro-ship`), `templates/`, any `.claude/commands/` shims, and the marketplace allowlist if it referenced gstack.
- Grep the repo for `gstack`/`pro-gstack`/`gbrain`/`/gstack-` to confirm no dangling references or broken plugin dependencies.
- Full `claude plugin validate . --strict` passes with `pro-gstack` gone.

## Verification

- **Per-phase:** `claude plugin validate plugins/<plugin> --strict` passes; plugin version matches its marketplace entry.
- **Repo-wide (Phase 10 & 12):** `claude plugin validate . --strict` passes (CI parity).
- **qa-skills wrap smoke tests:** "write an API contract test" routes to `api-testing`/`contract-testing`; "is my change working in the browser" routes to `agent-browser`; "write a committed e2e suite" routes to `playwright-automation`; "my selectors broke after the refactor" routes to `selector-drift-recovery`; `/test` in a repo with both Vitest and Playwright configs runs both suites.
- **qa-skills no-collision checks:** held skills (`unit-testing`, `security-testing`, `ci-cd-integration`, `accessibility-testing`, `release-readiness`) have no shim under `plugins/pro-testing/skills/`; exposed Related Skills entries point only at exposed skills or explicitly noted external/CLI-bundled skills.
- **Salvage smoke tests:** a salvaged skill triggers and runs without any gstack binary — e.g. `plan-eng-review` on a plan file, `cso` on a repo, `ship` dry-run, `office-hours` on an idea. Confirm `$B`/`$D`/gbrain calls were stripped or made optional (no hard failures).
- **agent-skills smoke tests:** "harden this endpoint" → `security-and-hardening`; "prep for production launch" → `shipping-and-launch`.
- **Removal check (Phase 12):** repo grep for `gstack`/`gbrain` returns only historical/changelog mentions; no plugin declares a dependency on `pro-gstack`; marketplace plugin count is correct.

## Open questions & needs-investigation (resolve before/within the relevant phase)

These are flagged-but-unresolved items. Each names the phase where it must be settled. Several require actually diffing files we've only described.

### A. Overlap reconciliation — diff and decide keep-both / merge / drop
- **A0 (Phase 0, pro-testing):** qa-skills exposure list must be explicit before shims land. Diff current `playwright-automation`/`visual-testing` against `/tmp/qa-skills`; prune or annotate Related Skills entries so held skills do not look loadable; confirm `api-testing`/`contract-testing` do not collide with `spdd-api-test-lead`.
- **A1 (Phase 2, pro-ship):** `shipping-and-launch` (agent-skills) vs gstack `ship` + `land-and-deploy`; `documentation-and-adrs` vs `document-generate` + `document-release`; `ci-cd-and-automation` vs `setup-deploy`. Working hypothesis: agent-skills = principles/checklist layer, gstack = executable workflow layer; confirm by diffing, cross-reference, drop true dups.
- **A2 (Phase 5, pro-quality):** review-surface pile-up — existing `requesting`/`receiving-code-review` + new `code-simplification` + gstack `review` + `codex`, PLUS the built-in `/code-review` and `/simplify` commands. Map how these coexist without double-triggering; decide whether any are redundant.
- **A3 (Phase 1, pro-security):** triggering boundaries between `security-and-hardening` (build-time), `security-auditor` (quick review), `cso` (deep audit) — ensure descriptions don't all fire on the same prompt.
- **A4 (Phase 7/5/3, pro-design split):** three design-review-flavored skills land in different plugins — `design-consultation` (pro-design), `design-review` (pro-quality), `plan-design-review` (pro-review). Confirm the boundaries are clean and descriptions disambiguate.

### B. Open decisions not yet made
- **B1:** `security-auditor` — keep lean (upstream) or enrich with three `cso` ideas (confidence gating, quote-the-source gate, variant analysis)? (Asked, not answered.)
- **B2 (Phase 9):** does `gstack-spec` belong in `pro-spdd` at all, given pro-spdd already owns a complete REASONS/SPDD spec workflow? Default to DROP unless a diff shows it's complementary.
- **B3 (Phase 3 vs 5):** is the `pro-review` (planning reviews) vs `pro-quality` (PR/code reviews) split correct, or should all review personas live together in `pro-review`? (Assigned unilaterally — confirm.)

### C. Naming & invocation (decide globally, before Phase 1)
- **C1:** Do salvaged gstack skills keep the `gstack-` prefix + `/gstack-*` commands, or get renamed to clean slugs (`office-hours`, `plan-ceo-review`, `cso`→`security-audit`)? Affects user muscle memory.
- **C2:** Do salvaged workflows keep slash-command invocation (gstack style), or become description-triggered skills (agent-skills style)? Mixed marketplace today — pick a convention per destination plugin.
- **C3:** Renaming interacts with D below — `autoplan` and others call sibling skills by name; renames must be propagated.

### D. Cross-skill wiring to rewire or bundle
- **D1:** `autoplan` coordinates `plan-ceo/eng/design/devex-review` by name — rewire references after any rename/split (Phase 3).
- **D2:** `guard` = `careful` + `freeze` composite; `investigate` (if salvaged) references `freeze`'s `check-freeze.sh` — bundle hook scripts so dependencies resolve within `pro-core` (Phase 4).
- **D3:** `devex-review` needs the `dx-hall-of-fame.md` sidecar; `plan-eng-review` uses a `gstack-review-read` baseline — bundle or replace (Phases 3/5).

### E. Runtime / binary replacement specifics
- **E1 (Phase 2):** `make-pdf` needs a Paged.js/Chromium renderer (gstack binary). Decide: ship a standalone script, depend on an external tool, or mark setup-required + degrade gracefully.
- **E2 (Phase 5):** `codex` requires the external OpenAI `codex` CLI — acceptable dependency? Define behavior when absent (skip/warn).
- **E3 (Phases 5/7):** browser-dependent salvage (`design-review`, `devex-review`) replace `$B` with what — pro-testing `agent-browser` or claude-in-chrome MCP? This may create a **cross-plugin dependency** (a pro-quality/pro-design skill needing pro-testing) — decide whether to declare it or keep skills self-describing.
- **E4 (Phase 5):** `health` wraps `tsc`/`biome`/`knip`/`shellcheck` — define graceful degradation when a target repo lacks them.

### F. Licensing — RESOLVED
- **F1 (resolved):** gstack is MIT, © 2026 Garry Tan (`plugins/pro-gstack/upstream/gstack/LICENSE`). Attribution: `_Adapted from [garrytan/gstack](https://github.com/garrytan/gstack) — MIT License._`
- **F2 (resolved):** the `openclaw/` subtree has no separate LICENSE — it's part of the vendored gstack tree and shares its MIT license. Same attribution.

### G. Process & repo state
- **G1:** Branch/PR strategy — one PR per phase (matches "review each one")? Document it.
- **G2:** In-flight uncommitted changes exist (`M pro-testing/LICENSE`, untracked `.claude/commands/`, `pro-testing/skills/agent-browser/`) — reconcile or land these before starting so phases don't clobber them.
- **G3:** Does the default-install list in `templates/` and the marketplace allowlist need the 3 new plugins added (and gstack removed in Phase 12)? Check `.github/workflows/` install test too.

### H. Verification method
- **H1:** Define the concrete triggering smoke-test harness (scratch repo + `claude -p` headless, or interactive) used in each phase's verification, starting with Phase 0 because qa-skills adds the largest trigger surface.
- **H2:** Codex-parity for salvaged gstack skills is heavier than for agent-skills (they carry bash/`$B`/Claude-specific constructs) — budget per-skill portability review, not just a grep.

## File comparison matrix (open these side-by-side to evaluate overlaps)

Paths: qa-skills = `/tmp/qa-skills/...` (ephemeral clone — see handoff); agent-skills = `/tmp/agent-skills/...` (ephemeral clone — see handoff); gstack = `plugins/pro-gstack/upstream/gstack/...`; existing = `plugins/pro-<x>/skills/...`. All paths verified present unless the source clone has been cleaned up.

### A0 — pro-testing qa-skills wrap
| Decision | qa-skills | Existing/local |
|---|---|---|
| retire fork | `/tmp/qa-skills/skills/playwright-automation/SKILL.md` | `plugins/pro-testing/skills/playwright-automation/SKILL.md` |
| retire fork | `/tmp/qa-skills/skills/visual-testing/SKILL.md` | `plugins/pro-testing/skills/visual-testing/SKILL.md` |
| browser boundary | n/a | `plugins/pro-testing/skills/agent-browser/SKILL.md`, `plugins/pro-testing/skills/vitest/SKILL.md` |
| API testing overlap | `/tmp/qa-skills/skills/api-testing/SKILL.md`, `/tmp/qa-skills/skills/contract-testing/SKILL.md` | `plugins/pro-spdd/skills/spdd-api-test-lead/SKILL.md` |
| held ownership | `/tmp/qa-skills/skills/{unit-testing,security-testing,ci-cd-integration,accessibility-testing,release-readiness}/SKILL.md` | `plugins/pro-testing/skills/vitest/SKILL.md`, `plugins/pro-design/skills/accessibility-audit/SKILL.md`, planned `pro-security`, planned `pro-ship` |

### A1 — pro-ship overlaps
| Decision | agent-skills | gstack |
|---|---|---|
| ship workflow | `skills/shipping-and-launch/SKILL.md` | `ship/SKILL.md`, `land-and-deploy/SKILL.md` |
| docs | `skills/documentation-and-adrs/SKILL.md` | `document-generate/SKILL.md`, `document-release/SKILL.md` |
| ci/cd | `skills/ci-cd-and-automation/SKILL.md` | `setup-deploy/SKILL.md` |

### A2 — pro-quality review pile-up
| Item | Path |
|---|---|
| existing reviewers | `plugins/pro-quality/skills/requesting-code-review/SKILL.md`, `.../receiving-code-review/SKILL.md` |
| agent-skills (SKIPPED — diff to confirm skip) | `/tmp/agent-skills/skills/code-review-and-quality/SKILL.md` |
| agent-skills simplify (taking) | `/tmp/agent-skills/skills/code-simplification/SKILL.md` |
| gstack reviewers (taking) | `review/SKILL.md`, `codex/SKILL.md`, `design-review/SKILL.md`, `health/SKILL.md` |
| built-ins (no file) | `/code-review`, `/simplify` skills |

### A3 — pro-security tiers
| Tier | Path |
|---|---|
| build-time | `/tmp/agent-skills/skills/security-and-hardening/SKILL.md` |
| quick-review agent | `/tmp/agent-skills/agents/security-auditor.md` |
| deep audit | `cso/SKILL.md` |

### A4 — design split (confirm clean boundaries)
| Skill → plugin | Path |
|---|---|
| design-consultation → pro-design | `design-consultation/SKILL.md` |
| design-review → pro-quality | `design-review/SKILL.md` |
| plan-design-review → pro-review | `plan-design-review/SKILL.md` |
| frontend-ui-engineering → pro-design | `/tmp/agent-skills/skills/frontend-ui-engineering/SKILL.md` |
| existing pro-design | `plugins/pro-design/skills/{accessibility-audit,design-token,motion-system,shadcn-ui-composition,typography-scale}/SKILL.md` |

### B2 — gstack-spec fit vs pro-spdd
| Item | Path |
|---|---|
| gstack spec | `spec/SKILL.md` |
| agent-skills spec (skipped) | `/tmp/agent-skills/skills/spec-driven-development/SKILL.md` |
| pro-spdd (owns this) | `plugins/pro-spdd/skills/spdd-story-lead/SKILL.md`, `.../spdd-reasons-canvas-lead/SKILL.md`, `.../spdd-analysis-lead/SKILL.md` (+ 6 more `spdd-*-lead`) |

### C/Dedup — openclaw vs plain gstack packagings (pick cleaner source per skill)
| Skill | Plain | Openclaw variant |
|---|---|---|
| office-hours | `office-hours/SKILL.md` | `openclaw/skills/gstack-openclaw-office-hours/SKILL.md` |
| ceo-review | `plan-ceo-review/SKILL.md` | `openclaw/skills/gstack-openclaw-ceo-review/SKILL.md` |
| retro | `retro/SKILL.md` | `openclaw/skills/gstack-openclaw-retro/SKILL.md` |
| investigate (likely DROP — covered) | `investigate/SKILL.md` | `openclaw/skills/gstack-openclaw-investigate/SKILL.md` |

### Skipped agent-skills overlaps — diff if you want to re-confirm the skip
`/tmp/agent-skills/skills/{test-driven-development,debugging-and-error-recovery,git-workflow-and-versioning,incremental-implementation,interview-me,idea-refine,browser-testing-with-devtools,using-agent-skills}/SKILL.md`
vs existing `plugins/pro-execution/skills/{test-driven-development,systematic-debugging,subagent-driven-development,using-git-worktrees}/SKILL.md`, `plugins/pro-core/skills/{grill-me,find-skills}/SKILL.md`, `plugins/pro-pdd/skills/brainstorming/SKILL.md`, `plugins/pro-testing/skills/{agent-browser,playwright-automation}/SKILL.md`.

## Fresh-context handoff (read this first in a new session)

- **This plan:** `AGENT-SKILLS-INTEGRATION.md` (repo root) — canonical copy also at `~/.claude/plans/snuggly-zooming-giraffe.md`.
- **Superseded plan:** `QA-SKILLS-WRAP-PLAN.md` is now only a pointer to this merged document.
- **qa-skills source:** clone at `/tmp/qa-skills` (currently present; **ephemeral** — re-create with `git clone --depth 1 https://github.com/petrkindlmann/qa-skills.git /tmp/qa-skills`).
- **agent-skills source:** clone at `/tmp/agent-skills` (currently present; **ephemeral** — re-create with `git clone --depth 1 https://github.com/addyosmani/agent-skills.git /tmp/agent-skills`).
- **gstack source:** vendored in-repo (no clone needed) under `plugins/pro-gstack/upstream/gstack/` — plain skills at `<name>/SKILL.md`, openclaw variants under `openclaw/skills/`.
- **Tooling gotcha:** in this environment the GitHub MCP server fails auth and `gh api` fails TLS (`x509: OSStatus -26276`). Use `git clone` and `WebFetch` for GitHub content; `git`/`gh` for local repo ops work fine.
- **Marketplace/manifest facts:** entry schema in `.claude-plugin/marketplace.json` = `{name, source, description, version, category, strict}`; per-plugin `plugin.json` = `{name, version, description, author, dependencies:[{name, marketplace, version}]}`. Version-bump law applies (bump plugin.json + marketplace entry + top-level `metadata.version`).
- **Gating decisions before Phase 1:** naming/invocation convention (C1/C2) and `security-auditor` enrichment (B1).

## Out of scope

- agent-skills: `spec-driven-development`, `planning-and-task-breakdown`, the 9 duplicate-overlap skills, the meta `using-agent-skills` skill, the `code-reviewer`/`test-engineer` agents, `session-start.sh`.
- gstack: all ~30 DROP skills (runtime/infra/iOS/browser-daemon/gbrain/setup), salvaged as nothing — they die with the plugin.
- No changes to `pro-data`, `pro-mieruka`, `pro-research`, `pro-nextjs`, `pro-starter` beyond what's listed.
