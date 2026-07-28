---
name: using-pro-dev
description: "Routes a task to the right pro-dev phase and skill across the full development lifecycle (Define→Plan/Spec→Build→Verify→Review→Security→Ship). This is an orientation skill — invoke it at session start, when you don't know where to begin, when the workflow itself is unclear, or when you're unsure which skill applies. It is not a task-execution skill: when a specific skill already matches the task at hand (a bug to fix, a component to build, a suite to run, a PR to review), use that skill directly instead of routing through here."
---

# Using pro-dev

## Overview

`pro-dev-skillset` is a marketplace of lifecycle skills organized by development phase — from initial idea capture through spec, build, verify, review, security, and ship. This meta-skill routes an incoming task to the right phase and skill so you spend zero time wondering what to invoke next. It is the cross-lifecycle router; [[qa-do]] (pro-testing) handles routing *within* the Verify phase, and the open-SPDD branch (pro-spdd) handles the full structured spec workflow for client or team-facing work.

## Router

```
Task arrives
  ├ Don't know what you want? ───────→ interview-me (pro-pdd)
  ├ Rough concept, need variants? ───→ idea-refine (pro-pdd)
  ├ Ideate + design behind a gate? ──→ brainstorming (pro-pdd)
  ├ Wide open-ended ideation, /adhd ─→ adhd (pro-pdd)
  ├ PLAN:
  │   ├ quick/solo, think it through → planning mode, then lavish for review when the plan is substantive
  │   ├ want a written TDD plan ─────→ writing-plans (pro-pdd), then lavish for plan review
  │   ├ render plan/output as HTML ──→ lavish → lavish-axi engine (pro-pdd, bridge: /lavish-engine install)
  │   └ client/structured spec ──────→ open-SPDD branch (pro-spdd: story→analysis→reasons-canvas→generate→review/api-test→sync)
  ├ BUILD:
  │   ├ execute an approved plan ────→ subagent-driven-development (pro-execution)
  │   ├ parallel worktrees / agents ─→ wt / using-git-worktrees (pro-execution)
  │   ├ logic / bug / behavior ──────→ test-driven-development (pro-execution)
  │   ├ API/interface ───────────────→ api-and-interface-design (pro-execution)
  │   ├ doc-verified code ───────────→ source-driven-development (pro-execution)
  │   ├ UI (full pass) ──────────────→ impeccable-bridge → impeccable engine (pro-design, bridge)
  │   ├ UI (one facet) ──────────────→ frontend-ui-engineering + pro-design skills
  │   ├ design doc (DESIGN.md) ──────→ stitch-skill (pro-design)
  │   ├ UI polish (targeted) ─────────→ taste-skill (pro-design)
  │   ├ video / programmatic render ──→ remotion (pro-motion)
  │   ├ complex animation sequence ───→ hyperframes (pro-motion)
  │   ├ marketing / hero animation ───→ gsap (pro-motion)
  │   ├ is this animation any good? ──→ design-eng-bridge → review-animations (pro-design, bridge)
  │   ├ audit motion across the app ──→ design-eng-bridge → improve-animations (pro-design, bridge)
  │   ├ what should animate here? ────→ design-eng-bridge → find-animation-opportunities (pro-design, bridge)
  │   ├ name this motion effect ──────→ design-eng-bridge → animation-vocabulary (pro-design, bridge)
  │   ├ gesture / Apple-feeling UI ───→ design-eng-bridge → apple-design (pro-design, bridge)
  │   ├ which library for X? ─────────→ design-eng-bridge → pick-ui-library (pro-design, bridge)
  │   ├ data/schema ─────────────────→ pro-data (drizzle/prisma/nextauth)
  │   ├ better context ──────────────→ context-engineering (pro-core)
  │   └ high-stakes/unfamiliar ──────→ doubt-driven-development (pro-core)
  ├ Something broke? ────────────────→ systematic-debugging (pro-execution)
  ├ VERIFY:
  │   ├ run the whole suite ─────────→ qa-suite → qa-do / qa-start (pro-testing, bridge: /qa-engine install)
  │   ├ interactive browser check ───→ agent-browser (pro-testing)
  │   ├ committed e2e suite ─────────→ playwright-automation (bridged via qa-suite / /qa-engine)
  │   ├ unit/component ──────────────→ vitest (pro-testing)
  │   ├ claiming done ───────────────→ verification-before-completion (pro-quality)
  │   └ handing work back to a human → user-validation, /validate (pro-quality)
  ├ DOCUMENT:
  │   ├ release notes / migration / README → technical-writer, /document (pro-quality)
  │   ├ docs drifted from code / setup broken → documentation-engineer (pro-quality)
  │   └ API reference from real handlers ────→ api-documenter, /api-docs (pro-quality)
  ├ REVIEW: requesting/receiving-code-review, code-simplification, /code-review, /simplify (pro-quality)
  ├ SECURITY: security-and-hardening / cso (pro-security)
  └ SHIP: ci-cd-and-automation, shipping-and-launch, docs, deprecation (pro-ship)
```

Two branches in this router reference **planned plugins not yet built**: SECURITY (pro-security) and SHIP (pro-ship) are on the roadmap — when the user reaches those phases, surface what is planned and recommend the closest available substitute (e.g. a manual checklist or the existing git workflow). Several BUILD skills — `api-and-interface-design`, `source-driven-development`, `context-engineering`, `doubt-driven-development`, and `frontend-ui-engineering` — are integration-doc phases that may not be installed in every environment; route to them when present, otherwise fall back to the nearest available skill (typically `test-driven-development` or `subagent-driven-development`). Pure planning mode is a valid drafting environment, not the preferred review surface for a substantive plan. When a plan is detailed enough to approve, save, or execute, route it through `lavish` so the user can review the plan as an annotatable HTML artifact before implementation begins.

## Bridges

Some entries are **bridges**, not vendored skills — thin routers that point to a heavier engine installed *outside* this marketplace. They only do work once that engine is present, so they ship an install/update command:

- **`impeccable-bridge` (pro-design) → `impeccable`** — the full end-to-end UI/UX engine. Install/update with **`/design-engine [check|install|update]`** (`npx impeccable skills install`).
- **Mieruka app** — ships its own `.claude-plugin`; install via `npx mieruka init` which registers the MCP server and plugin. Launch with `/start-mieruka`.
- **`qa-suite` (pro-testing) → `qa-skills`** — the broad QA suite (playwright e2e, visual regression, api/contract testing, strategy/risk/planning). Install/update with **`/qa-engine [check|install|update]`** (`npx skills add petrkindlmann/qa-skills …`); once installed, `qa-do`/`qa-start` own the routing within testing. Native (non-bridged) pro-testing skills: `vitest`, `agent-browser`, `storybook-interactions`.
- **`lavish` (pro-pdd) → `lavish-axi`** — renders agent output (plans, tables, diagrams, diffs, reports) as reviewable HTML artifacts the user annotates in the browser, with a poll-for-feedback loop. The CLI works on demand via `npx -y lavish-axi`; install/update the full upstream playbooks with **`/lavish-engine [check|install|update]`** (`npx skills add kunchenguid/lavish-axi --agent claude-code --skill lavish` for the Claude project skill).
- **`design-eng-bridge` (pro-design) → `emilkowalski/skills`** - animation *judgment* rather than animation implementation: strict motion review (`review-animations`), codebase-wide motion audits that emit executable plans (`improve-animations`), where motion is missing and where to refuse it (`find-animation-opportunities`), naming an effect from a description (`animation-vocabulary`), Apple fluid-interface principles (`apple-design`), curated library picks (`pick-ui-library`), and UI variants behind a live picker (`prototype`). Install/update with **`/design-eng-skills [check|install|update]`** (`npx skills@latest add emilkowalski/skills`). `review-animations`, `pick-ui-library`, and `prototype` are explicit-invoke-only upstream - name them or they will not fire.

When a bridge fires and its engine is missing, run the engine's install command (or tell the user to) rather than half-doing the work with general capabilities.

## Lifecycle Sequence

**Solo / default path:**
1. interview-me → clarify goals and constraints
2. idea-refine → surface viable approaches
3. planning mode OR writing-plans → draft the approach, then lavish → review/approve the substantive plan
4. test-driven-development / subagent-driven-development → build
5. qa-do / run the suite → verify
6. requesting-code-review / code-simplification → review
7. shipping-and-launch → ship

**Client / spec-driven path:**
1. interview-me → capture requirements
2. open-SPDD: story → analysis → reasons-canvas → generate → review/api-test → sync
3. qa-do / run the suite → verify
4. requesting-code-review → review
5. shipping-and-launch → ship

Not every task needs every phase — a bug fix might be just `systematic-debugging` → `test-driven-development` → `verification-before-completion`.

## Core Operating Behaviors

The pro-dev-specific rules are:

**(a) Branch to open-SPDD when the work is client-facing or needs a shared written artifact trail before any code is written.** If the audience is a client, a stakeholder, or a team that needs written alignment, route through the SPDD branch. For solo or greenfield work with no external audience, stay on the default path.

**(b) Lavish is the default review surface for substantive plans.** Claude Code / Codex plan mode may be used to think and draft, and a tiny plan can stay in plain text. But when the output is a real implementation plan, milestone plan, client plan, task breakdown, or anything the user is expected to approve before execution, invoke `lavish` and render it as an annotatable HTML artifact. If the harness requires a built-in plan-mode response such as `<proposed_plan>`, keep that response concise and point to the Lavish artifact as the review surface. If the engine is unavailable or the session cannot run it, say so explicitly and fall back to plain text instead of silently skipping Lavish.

**(c) The Verify phase delegates to the `qa-suite` bridge → `qa-do` / `qa-start`.** `qa-suite` (pro-testing) routes to the bridged qa-skills library; once installed (`/qa-engine install`), `qa-do` owns the routing logic within testing. Do not re-implement that routing here — hand off and let it drive. If the suite is missing, run `/qa-engine install` first.

## Quick Reference

| Phase | Skill(s) | Plugin | One-line |
|---|---|---|---|
| Meta | using-pro-dev, [[find-skills]] | pro-core | Router, ecosystem discovery |
| Define | interview-me, idea-refine, brainstorming, adhd | pro-pdd | Clarify → variant → gated ideation → parallel divergent ideation |
| Plan | planning mode for drafting, writing-plans for structured plans, lavish (bridge → lavish-axi, via `/lavish-engine`) for review | pro-pdd | Draft the plan, then render substantive plans as annotatable HTML artifacts |
| Spec (branch) | open-SPDD: spdd-story → analysis → reasons-canvas → generate → code-review/api-test → sync/reverse | pro-spdd | Structured client/team spec pipeline |
| Build | test-driven-development, subagent-driven-development, wt, using-git-worktrees, api-and-interface-design, source-driven-development | pro-execution | Core implementation skills |
| Build | context-engineering, doubt-driven-development | pro-core | Better context hygiene; high-stakes caution |
| Build | impeccable-bridge (bridge → impeccable), frontend-ui-engineering + design skills | pro-design | Full UI/UX pass (via `/design-engine`) + focused design skills |
| Build | stitch-skill (DESIGN.md), taste-skill (targeted polish) | pro-design | Design documentation + visual polish pass |
| Build | remotion (video render), hyperframes (complex animation), gsap (marketing animation) | pro-motion | Motion and video |
| Build | design-eng-bridge → review-animations / improve-animations / find-animation-opportunities / animation-vocabulary / apple-design / pick-ui-library / prototype | pro-design | Animation judgment, not implementation (bridge, via `/design-eng-skills`) |
| Build | drizzle, prisma, nextauth | pro-data | Data layer and auth |
| Verify | qa-suite → [[qa-do]] / qa-start (bridge → qa-skills, via `/qa-engine`), agent-browser, vitest, storybook-interactions | pro-testing | Full suite (bridged), interactive browser, unit, stories |
| Verify | systematic-debugging | pro-execution | Break-fix root cause |
| Verify | verification-before-completion | pro-quality | Gate before claiming done |
| Review | requesting-code-review, receiving-code-review, code-simplification, performance-optimization | pro-quality | Review and polish cycle |
| Security | security-and-hardening, cso | pro-security (planned) | Hardening and security officer review |
| Ship | ci-cd-and-automation, shipping-and-launch, documentation-and-adrs, deprecation-and-migration | pro-ship (planned) | Automate, launch, document, retire |
| Research | lead-research | pro-research | ICP and lead profiling |
| Design | design-token, motion, typography, shadcn, a11y | pro-design | Token system, animation, type, components, accessibility |
