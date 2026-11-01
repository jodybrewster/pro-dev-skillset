---
source: idea
kind: change
status: accepted
risk: low
created: 2026-10-30T10:00:00-0400
author: Jody Brewster
---

# Intent: a twelve-factor skill

Author: Jody Brewster (pro-dev-skillset).
Source: idea, the first slice of item 17 in [docs/roadmap.md](../../docs/roadmap.md), "Architecture review with twelve-factor".
Jody asked on 2026-10-30 to look at the `twelve-factor` plugin in [jmagly/aiwg](https://github.com/jmagly/aiwg/tree/d88d04e401f658c10e0845b88610aafb100d2c73/agentic/code/plugins/twelve-factor) (MIT) and create a twelve-factor skill for this repo.
Status: accepted (Jody, 2026-10-30, by asking for it).
Created: 2026-10-30.

## Problem

Nothing in the marketplace checks an app against the twelve factors.
Neither our plugins nor [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) carry one.
The aiwg plugin exists but its README calls its evidence status "design intent": it has generic checklists and no stack-specific checks, so an agent running it has to guess what evidence looks like.
The [pro-ship research](../2026-10-28-pro-ship-scope/research.md) already wrote the concrete Node/Next.js and Python checks per factor.
The [brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md) decided twelve-factor belongs in an architecture review in pro-quality, with an `architect` agent and three modes.
That whole item is size L; the checklist and its audit can ship first and stand alone.

## Proposed outcome

pro-quality ships a `twelve-factor` skill.
It covers the twelve factors plus API-first, telemetry and authN/Z (Hoffman's additions, as the research chose).
It runs in two modes: plan mode challenges a spec, plan or design before code exists; audit mode reviews a whole repo.
Each factor gets one row: a status of pass, partial, fail, platform-owned or n/a, file and line evidence (or `missing`) and the fix.
A sidecar holds the per-factor checks for Node/Next.js and Python, with the search that finds the evidence.
It adapts aiwg's evidence rule: never infer compliance from intent or naming, record missing evidence as missing and give every partial or fail a fix.
The later `architect` agent loads this skill as its checklist.

## Affected users and systems

Anyone with pro-quality installed, which is in the starter.
pro-quality: the new skill, `LICENSE`, both manifests and its marketplace entry.
`docs/licenses.md`, `docs/roadmap.md`, `README.md` and `tests/cases/routing.jsonl`.

## Constraints

The version-bump law and Codex parity in this repo's `CLAUDE.md`.
Harness-neutral prose so the skill loads under Codex.
Read-only: the skill reports and never edits app code.
Adapted text keeps an MIT footer, a row in `docs/licenses.md` and "Copyright (c) 2024 Joe Magly" in `plugins/pro-quality/LICENSE`.
Supply chain and dependency hygiene, which aiwg adds, stay with pro-security's `security-audit`; the skill points there instead of auditing them.

## Out of scope

The `architect` agent and its Codex twin.
Diff mode and the pr-check architecture signals.
The ARCHITECTURE.md twelve-factor section.
Mechanical factor checks as pr-check scripts.
A slash command; the skill is invocable by name.
Those stay in roadmap item 17 and the docs intent (C) of the brainstorm.

## Success looks like

Asked to audit a Next.js repo against twelve-factor, the skill returns fifteen rows, each with a status and either a `file:line` or `missing`.
Asked to review a plan that keeps sessions in process memory, plan mode flags factor VI with the fix.
`node tests/check.mjs`, `node tests/eval.mjs --dry`, the lexical routing gate and `claude plugin validate --strict` pass.

## Evidence

None; this is an idea.
Upstream reference: `skills/twelve-factor-audit/SKILL.md`, `skills/twelve-factor-design/SKILL.md`, `rules/twelve-factor-evidence.md`, `checklists/` and `templates/` in jmagly/aiwg at `d88d04e`.
