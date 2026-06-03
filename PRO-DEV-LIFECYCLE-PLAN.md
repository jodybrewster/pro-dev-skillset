# Plan: pro-dev lifecycle integration — `using-pro-dev` meta-skill + qa-skills wrap + agent-skills structure parity

## Context

`pro-dev-skillset` has grown to 13 plugins / 20+ skills covering most of the software lifecycle, but it has **no map of itself**. `addyosmani/agent-skills` solves this with a `using-agent-skills` meta-skill: a router diagram (task → phase → skill), a canonical lifecycle sequence, shared operating behaviors, and a quick-reference phase table — plus 7 lifecycle slash commands (`/spec /plan /build /test /review /ship`) and a README organized by phase. We want that same legibility, adapted to pro-dev's reality.

pro-dev is **not a 1:1 of agent-skills** — it's a superset with branches:
- **Define** uses `interview-me` + `idea-refine` (forked from agent-skills, **replacing the retired `grill-me`**) plus `brainstorming`.
- **Spec** is **open-SPDD** (`pro-spdd`, 9 `spdd-*-lead` skills) — pro-dev's replacement for agent-skills `spec-driven-development`.
- **Plan** has a **"pure planning mode"** = out-of-the-box Claude Code plan mode + Codex planning (a *harness feature, not a skill*), alongside the formalized `writing-plans` (pro-pdd).
- **Build** skills from agent-skills are absorbed **by domain** per the integration doc (not as one plugin).
- **Verify** is where the **qa-skills wrap** (this plan's concrete near-term work) lands.
- **Ship** is `pro-ship` (planned, separate effort).

Outcome: a `using-pro-dev` meta-skill (the router), the qa-skills-wrapped `pro-testing` (the Verify phase, built now), and a plan document + repo structure that mirrors agent-skills' phase organization so the whole marketplace reads as one coherent lifecycle.

## The pro-dev lifecycle (the map `using-pro-dev` encodes)

| Phase | pro-dev skill(s) | Plugin | Status |
|---|---|---|---|
| **Meta** | `using-pro-dev` (router), `find-skills` (ecosystem discovery), `karpathy-guidelines` (operating behaviors) | pro-core | find-skills/karpathy exist; **using-pro-dev = NEW** |
| **Define** | `interview-me`, `idea-refine`, `brainstorming` | pro-pdd | brainstorming exists; interview-me/idea-refine = **fork from agent-skills**; `grill-me` (pro-core) = **retired** |
| **Plan** | *pure planning mode* (Claude Code / Codex plan mode — harness, no skill), `writing-plans` | pro-pdd | writing-plans exists; pure-mode is a documented entry, not a skill |
| **Spec (branch)** | open-SPDD: `spdd-story` → `spdd-analysis` → `spdd-reasons-canvas` → `spdd-generate` → `spdd-code-review` / `spdd-api-test` → `spdd-sync`/`spdd-reverse` | pro-spdd | exists (v0.3.0) |
| **Build** | `test-driven-development`, `subagent-driven-development`, `using-git-worktrees` (pro-execution); `api-and-interface-design`, `source-driven-development` (pro-execution, planned Ph6); `context-engineering`, `doubt-driven-development` (pro-core, planned Ph4); `frontend-ui-engineering` + design skills (pro-design, planned Ph7); data skills (pro-data) | multiple | mix of existing + integration-doc phases |
| **Verify** | `qa-do`/`qa-start` (vendored router), `agent-browser`, `playwright-automation`, `vitest`, + vendored qa-skills (this plan); `systematic-debugging` (pro-execution); `verification-before-completion` (pro-quality) | pro-testing, pro-execution, pro-quality | **qa-skills wrap = built now** |
| **Review** | `requesting`/`receiving-code-review`; `code-simplification`, `performance-optimization` (planned Ph5); built-in `/code-review`, `/simplify` | pro-quality | mix |
| **Security** | `security-and-hardening`, `security-auditor`, `cso` | pro-security (planned Ph1) | planned |
| **Ship** | `ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs`, `deprecation-and-migration` + gstack ship workflows | pro-ship (planned Ph2) | planned |
| **Research / Data / Design** | lead-research; drizzle/prisma/nextauth; design-token/motion/typography/shadcn/a11y | pro-research, pro-data, pro-design | exist (domain, cross-cutting) |

## Status (living checklist)

Updated 2026-06-03. Parts A, B, C shipped. Part D is the remaining in-scope work; the rest are separate efforts the router already points at.

### ✅ Part C — Verify phase: qa-skills wrap (shipped, commit `7ff25a5`, pro-testing 0.4.0)
- [x] Vendor `petrkindlmann/qa-skills` (43 skills) into `plugins/pro-testing/upstream/qa-skills/`
- [x] Expose testing-core subset as shims: `qa-do`/`qa-start`, `playwright-automation`, `visual-testing`, `api-testing`/`contract-testing`, `test-reliability`, `test-strategy`/`risk-based-testing`/`test-planning`, `storybook-interactions`, `qa-project-context`
- [x] Relabel the axis — interactive verification (`agent-browser`) vs committed regression suite (`playwright`); add vitest boundary block
- [x] Retire the 2 forks (`playwright-automation`, `visual-testing`) → vendored; overlap-table HOLDs respected
- [x] Bump pro-testing 0.3.3 → 0.4.0

### ✅ Part A — `using-pro-dev` meta-skill (shipped, PR #7, pro-core 0.8.0)
- [x] `plugins/pro-core/skills/using-pro-dev/SKILL.md` — router diagram, both lifecycle sequences, operating behaviors referencing `[[karpathy-guidelines]]`, quick-reference phase table
- [x] Bump pro-core 0.7.0 → 0.8.0 (plugin.json + marketplace.json + descriptions)

### ✅ Part B — Define phase: fork + grill-me retirement (shipped, PR #7, pro-pdd 0.2.0)
- [x] Fork `interview-me` (SKILL.md) into pro-pdd with attribution footer
- [x] Fork `idea-refine` (SKILL.md + 3 sidecars + script) into pro-pdd; Codex-parity fixes (relative script path, harness-neutral question phrasing)
- [x] Delete `grill-me`; `"grill me"` trigger preserved in `interview-me`'s description
- [x] Update pro-pdd `LICENSE` attribution (addyosmani/agent-skills)
- [x] Scrub grill-me refs (README ×2, marketplace.json, plugin.json); swap `mattpocock/skills` → `addyosmani/agent-skills`; fix skill count (+2 → +4)
- [x] Bump pro-pdd 0.1.0 → 0.2.0; marketplace `metadata.version` 1.8.0 → 1.9.0
- [x] `claude plugin validate . --strict` passes

### ⏭️ Part D — agent-skills structure parity (in scope)
- [x] **README phase reorganization** — "What's here" now leads with a per-phase lifecycle table (Define→…→Ship + cross-cutting), `using-pro-dev` linked as the entry point; plugin breakdown retained below for packaging/attribution. Also refreshed stale counts (starter 24→33 skills post-Part C) and the `pro-testing` bullet (vendored qa-skills library)
- [ ] **Skill anatomy consistency** — bring new/edited skills toward the agent-skills anatomy (Overview / When to Use / Process / Rationalizations / Red Flags / Verification) where it fits
- [x] **Lifecycle slash commands — DEFERRED** by decision (no `/spec /plan /build /test /review /ship`); revisit once owning plugins exist

### 🔜 Separate efforts (out of scope here; the router already points at these as "planned")
- [ ] **pro-security** plugin — `security-and-hardening`, `security-auditor`, `cso` (router SECURITY branch is a planned target)
- [ ] **pro-ship** plugin — `ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs`, `deprecation-and-migration`
- [ ] **Build-skill folds** referenced by the router but not yet installed: `context-engineering`, `doubt-driven-development` (pro-core); `api-and-interface-design`, `source-driven-development` (pro-execution); `frontend-ui-engineering` (pro-design)
- [ ] **Review-skill folds**: `code-simplification`, `performance-optimization` (pro-quality) — currently only the `/code-review` + `/simplify` built-ins cover this
- [ ] Once any of the above land, drop the "(planned)" / "route when present" hedges in `using-pro-dev`'s router + quick-reference table

---

## Part A — `using-pro-dev` meta-skill (NEW, in pro-core)

Models `using-agent-skills` but adapted. Lives at `plugins/pro-core/skills/using-pro-dev/SKILL.md`. Contents:

1. **Router diagram** — task → phase → pro-dev skill, with the SPDD branch and the pure-planning-mode entry explicit:
```
Task arrives
  ├ Don't know what you want? ───────→ interview-me (pro-pdd)
  ├ Rough concept, need variants? ───→ idea-refine (pro-pdd)
  ├ Ideate + design behind a gate? ──→ brainstorming (pro-pdd)
  ├ PLAN:
  │   ├ quick/solo, think it through → pure planning mode (Claude Code / Codex plan mode — no skill)
  │   ├ want a written TDD plan ─────→ writing-plans (pro-pdd)
  │   └ client/structured spec ──────→ open-SPDD branch (pro-spdd: story→analysis→reasons-canvas→generate→review/api-test→sync)
  ├ BUILD:
  │   ├ execute an approved plan ────→ subagent-driven-development (pro-execution)
  │   ├ logic / bug / behavior ──────→ test-driven-development (pro-execution)
  │   ├ API/interface ───────────────→ api-and-interface-design (pro-execution)
  │   ├ doc-verified code ───────────→ source-driven-development (pro-execution)
  │   ├ UI ──────────────────────────→ frontend-ui-engineering + pro-design skills
  │   ├ data/schema ─────────────────→ pro-data (drizzle/prisma/nextauth)
  │   ├ better context ──────────────→ context-engineering (pro-core)
  │   └ high-stakes/unfamiliar ──────→ doubt-driven-development (pro-core)
  ├ Something broke? ────────────────→ systematic-debugging (pro-execution)
  ├ VERIFY:
  │   ├ run the whole suite ─────────→ qa-do / qa-start (pro-testing, vendored qa-skills router)
  │   ├ interactive browser check ───→ agent-browser (pro-testing)
  │   ├ committed e2e suite ─────────→ playwright-automation (pro-testing)
  │   ├ unit/component ──────────────→ vitest (pro-testing)
  │   └ claiming done ───────────────→ verification-before-completion (pro-quality)
  ├ REVIEW: requesting/receiving-code-review, code-simplification, /code-review, /simplify (pro-quality)
  ├ SECURITY: security-and-hardening / cso (pro-security)
  └ SHIP: ci-cd-and-automation, shipping-and-launch, docs, deprecation (pro-ship)
```
2. **Lifecycle sequence** — the two canonical paths:
   - *Solo/default:* interview-me → idea-refine → (pure planning **or** writing-plans) → TDD/subagent-driven build → verify (qa-do / run the suite) → review → ship.
   - *Client/spec-driven:* interview-me → open-SPDD (story→…→sync) → verify → review → ship.
3. **Core operating behaviors** — do NOT duplicate `using-agent-skills`' six rules; **reference `[[karpathy-guidelines]]`** (pro-core already encodes think-before-coding / simplicity / surgical-changes / verify) and add only what's pro-dev-specific (when to branch to SPDD; "pure planning mode is a valid stop, not a skip").
4. **Quick-reference phase table** — the lifecycle table above, one-line per skill.
5. Frontmatter `name: using-pro-dev`, `description` triggering on session start / "which skill / where do I start / what's the workflow". Bump pro-core version.

## Part B — Define phase: fork `interview-me` + `idea-refine`, retire `grill-me`

Reverses the integration doc's earlier "skip" for these two. Fork from `/tmp/agent-skills/skills/{interview-me,idea-refine}/` into **pro-pdd** (the ideation/define home, alongside `brainstorming`). Attribution footer `_Forked from addyosmani/agent-skills — MIT._`; Codex-parity scan (frontmatter name+description only).

**Retire `grill-me` (pro-core).** `interview-me`'s upstream description already absorbs the `"grill me"` trigger phrase, so the muscle memory survives. Steps:
- Delete `plugins/pro-core/skills/grill-me/`; bump pro-core.
- Confirm `interview-me`'s `description` includes the `"grill me"` trigger (it does upstream — keep it).
- **Scrub references:** grep the repo for `grill-me` / `grill me` / `/grill-me` — update `plugins/pro-core/find-skills` catalog entries, `README.md`, `.claude-plugin/marketplace.json` descriptions, `CLAUDE.md`, and any command shims so nothing dangles.

## Part C — Verify phase: the qa-skills wrap (concrete near-term build)

This is the part ready to build now. **Vendor-and-adapt** `petrkindlmann/qa-skills` (already cloned at `/tmp/qa-skills`, 43 skills) into `pro-testing`, mirroring the repo's existing gstack pattern.

- **Mechanism:** clone into `plugins/pro-testing/upstream/qa-skills/` intact (skills + references + LICENSE + AGENTS.md). Expose chosen skills via thin shim `plugins/pro-testing/skills/<name>/SKILL.md` (frontmatter `description` copied verbatim for triggering; body = "Follow `../../upstream/qa-skills/skills/<name>/SKILL.md` and its references; adapt host tools; no upstream CLI bootstrap"; attribution footer). Relative `references/` paths resolve inside the vendored tree. Sync = re-pull tree + re-copy changed descriptions + version bump.
- **Scope:** vendor all 43; **expose only the testing-core subset.**
- **agent-browser stays separate** (vercel-labs). Re-label the axis everywhere to **interactive verification (`agent-browser`) vs committed regression suite (`playwright`)**. Sharpen `agent-browser` description+footer; fix dangling footer (note `dogfood` is CLI-bundled, not a repo skill).
- **No `/test` command** (deferred — see Part D). "Run the whole suite" is served by the exposed, description-triggered `qa-do`/`qa-start` router skills, not a command.
- **Retire the 2 forks** (`playwright-automation`, `visual-testing`) in favor of vendored versions; carry the durability-boundary additions into the shim. Diff before deleting.
- **vitest boundary block** + accurate footers across all exposed pro-testing skills.

### Overlap reconciliation (load-bearing — do AS each skill is exposed)
Failure modes: double-triggering and territory theft. Per exposed skill: read its upstream description + AGENTS.md anti-triggers, check the table, grep other plugins for keyword collision; HOLD if owned elsewhere, else lift the anti-trigger wording into the shim.

| Overlap | Decision |
|---|---|
| qa `playwright-automation`/`visual-testing` vs our forks | KEEP-OURS→vendored (retire forks; carry durability boundary into shim) |
| qa `unit-testing` vs our `vitest` | HOLD `unit-testing`; vitest stays the focused TS/React skill |
| qa `api-testing`/`contract-testing` vs pro-spdd `spdd-api-test-lead` | CROSS-REF: pro-testing = general/standalone; spdd = SPDD-Phase-4 cURL bound to ACs |
| qa `security-testing` vs planned pro-security | HOLD (pro-security owns it) |
| qa `ci-cd-integration` vs planned pro-ship | HOLD (pro-ship owns it) |
| qa `accessibility-testing` vs pro-design `accessibility-audit` | HOLD (pro-design owns it) |
| qa `release-readiness` vs planned pro-ship `shipping-and-launch` | HOLD |
| qa `test-strategy`/`risk-based-testing` vs pro-pdd/pro-spdd planning | CROSS-REF (QA strategy ≠ product/spec planning) |
| `agent-browser` vs vendored `playwright-automation` | CROSS-REF (durability axis — our connective tissue) |
| qa `qa-do`/`qa-start` router vs `using-pro-dev` (Part A) | CROSS-REF: `qa-do` routes *within* testing; `using-pro-dev` routes *across* the whole lifecycle and hands off to `qa-do` for verify |

## Part D — agent-skills structure parity (replicate the legible shape)

- **Lifecycle slash commands — DEFERRED.** No commands in this effort (not even `/test`). The lifecycle is driven entirely by description-triggered skills + the `using-pro-dev` router. Commands (`/spec /plan /build /test /review /ship`) can be revisited later once the owning plugins (pro-ship, pro-security, the Phase 4–7 folds) exist; until then they'd be stubs pointing at nothing.
- **README + plan-doc organization by phase** — restructure README's plugin table into the Define→Plan→Spec→Build→Verify→Review→Security→Ship taxonomy with a per-phase skill table (mirrors agent-skills README) and link `using-pro-dev` as the entry point.
- **Skill anatomy consistency** — new/edited skills follow the agent-skills anatomy (Overview / When to Use / Process / Rationalizations / Red Flags / Verification) where it fits.

## Critical files

- NEW: `plugins/pro-core/skills/using-pro-dev/SKILL.md` (Part A) — bump pro-core version.
- NEW: `plugins/pro-pdd/skills/{interview-me,idea-refine}/` (Part B, forked) — bump pro-pdd.
- DELETE: `plugins/pro-core/skills/grill-me/` (Part B, retired) — scrub references repo-wide.
- NEW: `plugins/pro-testing/upstream/qa-skills/**` (vendored), `plugins/pro-testing/skills/<exposed>/SKILL.md` (shims) (Part C). **No `commands/` files** (deferred).
- EDIT: `plugins/pro-testing/skills/{agent-browser,vitest}/SKILL.md`; DELETE forks after diff.
- EDIT: `plugins/pro-testing/LICENSE`, all touched `.claude-plugin/plugin.json` (**version-bump law**), `.claude-plugin/marketplace.json` (entries + top-level `metadata.version`).
- EDIT: `README.md` (phase reorganization, Part D).
- Pattern references: `plugins/pro-gstack/skills/gstack-plan-tune/{SKILL.md,workflow.md}`, `/tmp/agent-skills/skills/using-agent-skills/SKILL.md`.

## Sequencing

1. **Part C (qa-skills wrap)** — concrete, self-contained, no external blockers. Build first.
2. **Part A (using-pro-dev)** — author the router once the Verify phase is real; references existing + planned skills.
3. **Part B (fork interview-me/idea-refine + retire grill-me)** — small, alongside A.
4. **Part D (README parity)** — last; commands deferred entirely.
5. **pro-ship + pro-security + the Phase 4–7 build-skill folds** — separate efforts (the integration doc's phases), out of scope here but referenced by `using-pro-dev`.

## Decisions (locked)

- **D-DEFINE → retire `grill-me`.** Fork `interview-me` + `idea-refine` into pro-pdd; delete `grill-me` (its `"grill me"` trigger lives on in `interview-me`); scrub references.
- **D-CMDS → defer all commands** (including `/test`). Lifecycle is skill- and router-driven only; revisit commands once owning plugins exist.
- **D-USING-LOC → pro-core.** `using-pro-dev` lives alongside `find-skills`/`karpathy-guidelines`; no new plugin.
- **D-SPDD-vs-SDD → SPDD.** open-SPDD (pro-spdd) is the spec branch; agent-skills `spec-driven-development` is never forked.

## Version-bump law

Every touched plugin bumps `plugin.json` + its `marketplace.json` entry + top-level `metadata.version` once per phase. pro-testing 0.3.3 → 0.4.0 (vendored library). pro-core and pro-pdd bump minor for new skills. (RELEASING.md.)

## Verification

- `claude plugin validate plugins/<plugin> --strict` per touched plugin; `claude plugin validate . --strict` repo-wide.
- **Codex-parity** on all new bodies: frontmatter = name+description only; no `Task`/`TodoWrite`; every reference path resolves inside its plugin; vendored `references/` links resolve from the vendored location.
- **Router smoke tests:** "where do I start / what's the workflow" → `using-pro-dev` fires and routes correctly; a spec-driven prompt → SPDD branch; "is my change working in the browser" → agent-browser (not playwright); "write a committed e2e suite" → playwright; "secure this endpoint" → does NOT fire a pro-testing skill (HOLD respected).
- **No-collision check:** HOLD skills present in `upstream/` but not loadable; grep exposed shim descriptions vs other plugins for keyword collisions — each maps to an overlap-table row.
- **grill-me retirement:** repo grep for `grill-me`/`grill me` returns only historical/changelog mentions; `"grill me"` prompt now fires `interview-me`; footers point only at skills that exist (or are noted CLI-bundled).
- **Structure parity:** README reads as Define→…→Ship; `using-pro-dev` quick-reference table matches the live skill inventory.
