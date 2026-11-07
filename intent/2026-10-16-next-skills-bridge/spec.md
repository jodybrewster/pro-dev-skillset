---
intent: ./intent.md
intent-status: accepted
status: draft
created: 2026-11-07T10:30:00-05:00
author: the maintainer
---

# Spec: pro-nextjs bridges the MIT Next.js skills

Built from `intent.md` in this folder (commit 45c6672).
Status: draft.
Policies and skills consulted: CLAUDE.md, AGENTS.md, REVIEW.md, docs/licenses.md, docs/version-bump-law.md, docs/decisions/0002-version-bump-law.md, docs/decisions/0003-one-hooks-json-per-plugin.md, docs/decisions/0004-codex-parity.md, docs/decisions/0006-engine-registry-and-pro-dev.md, the existing bridges in pro-testing (qa-suite), pro-design and pro-ship (vercel-deploy-bridge) and the pro-nextjs LICENSE.

## Summary

pro-nextjs carries no text from vercel-labs/next-skills, a repository that never had a license file.
The `next-skills-bridge` skill routes Cache Components, Partial Prefetching, bundle and dev-loop work to the six MIT Next.js agent skills in vercel/next.js, and the `/pro-dev install` command installs them non-interactively through the `next-skills` engine row.
The old `next-cache-components` skill is gone; `next-cache-components-adoption` and `next-cache-components-optimizer` take its place through the bridge.
`next-best-practices` and `next-upgrade` stay, rewritten section by section from the MIT Next.js documentation with a doc page cited per section and a footer naming that source.
The pro-nextjs LICENSE and docs/licenses.md record the sources.
Everyone with pro-nextjs installed gets this on update; anyone who relied on `next-cache-components` loses it until they run `/pro-dev install`.

This spec is written after the implementation landed in pro-nextjs 0.12.1, so its requirements are the acceptance checks on what shipped rather than a design for new work.

## Assumptions

All unconfirmed; written with no one available to answer.

1. The engine installer is `/pro-dev install` through pro-core's `next-skills` engine row, not a standalone `/next-skills` command; the intent's phrase "`/next-skills` installs them" is read as the engine-backed install the bridge documents.
2. The upstream source of record is vercel/next.js branch `canary`, holding six skills, installed with `npx -y skills add https://github.com/vercel/next.js/tree/canary/skills -a claude-code -y`.
3. The two rewritten skills (`next-best-practices`, `next-upgrade`) have no upstream counterpart in vercel/next.js `skills/`, so they are adapted from the Next.js docs, not bridged.
4. Consumers run a Next.js App Router app; the upstream Cache Components and Partial Prefetching skills target Next.js 16.3 and later, so older apps get less from the bridge.
5. Codex users cannot run `/pro-dev install`, so the bridge SKILL.md must carry the raw `npx skills add` line for them.

## Requirements

### Functional

- R1. No file under `plugins/pro-nextjs/` contains text copied from vercel-labs/next-skills (intent: "pro-nextjs carries no text from vercel-labs/next-skills").
- R2. The `next-cache-components` skill directory does not exist under `plugins/pro-nextjs/skills/` (intent: "It is removed").
- R3. A `next-skills-bridge` skill exists and routes each of the six upstream install names (`next-cache-components-adoption`, `next-cache-components-optimizer`, `next-partial-prefetching-adoption`, `next-partial-prefetching-optimizer`, `next-bundle-optimizer`, `next-dev-loop`) to the matching task: Cache Components, Partial Prefetching, bundle audit and dev-loop verification (intent: "routes Cache Components, Partial Prefetching, bundle and dev-loop work to the upstream skills").
- R4. The bridge SKILL.md states it is a bridge, that the skills are not vendored and that they install via `/pro-dev install`, and it carries the raw `npx -y skills add https://github.com/vercel/next.js/tree/canary/skills -a claude-code -y` command for a Codex user (intent: "`/next-skills` installs them non-interactively").
- R5. pro-core's engine registry has a `next-skills` row owned by pro-nextjs that bridges `next-skills-bridge` and installs the six upstream skills non-interactively (intent decision: install at install time "the way pro-testing bridges qa-skills").
- R6. `next-best-practices` and `next-upgrade` each cite a Next.js docs page per section and end with a footer naming the Next.js documentation (MIT, Copyright (c) 2025 Vercel, Inc.) as the source (intent: "rewritten section by section from the MIT Next.js documentation with a doc page cited per section and a footer naming that source").
- R7. The pro-nextjs LICENSE records the Next.js docs (MIT, Copyright (c) 2025 Vercel, Inc.) as the source of the two rewritten skills and the bridge as the route to the upstream skills (intent proposed outcome).
- R8. docs/licenses.md has a row for `next-skills-bridge` marked `bridged` and rows for `next-best-practices` and `next-upgrade` marked `adapted`, with no `next-cache-components` row (intent: the licenses rows are closed).
- R9. The bridge SKILL.md names the loss: a reader who relied on `next-cache-components` loses it until `/pro-dev install` has run, and it names the command (intent risk: "the bridge says so and names the command").

### Non-functional

- N1. The bridge adds no vendored upstream tree to the repo; the only new tracked files are original pointer prose, the engine row and the license rows (intent decision to bridge, not vendor).
- N2. The bridge SKILL.md notes that the upstream Cache Components and Partial Prefetching skills target Next.js 16.3 and later, so older apps get less (intent risk).

### Policy constraints applied

- Version-bump law (ADR-0002): the content change under `plugins/pro-nextjs/` bumps pro-nextjs in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and the marketplace entry, plus `metadata.version`, in one commit. The shipped change is at 0.12.1 across all three.
- Codex parity (ADR-0004): the bridge SKILL.md is harness-neutral and names the raw install line for Codex, and `.codex-plugin/plugin.json` stays version-aligned with no `.toml` needed since the bridge ships no agent.
- Engine registry (ADR-0006): the `next-skills` row lives in `plugins/pro-core/registry/engines.json` and `/pro-dev` reads it; a registry change needs a pro-core bump.
- Attribution (REVIEW.md pass 3, docs/licenses.md): forked or adapted content keeps its footer and upstream copyright line in the plugin LICENSE and gains its row; a bridge vendors nothing and is marked `bridged`.
- Hook-loading law (ADR-0003): not engaged; pro-nextjs registers no hooks.

### Boundaries

Always: route to the installed upstream skill, point a reader at `/pro-dev install` when a skill is absent, cite a Next.js docs page in the two rewritten skills.
Ask first: nothing in normal use; the bridge installs only when the reader runs the install command.
Never: vendor upstream skill text into the repo, pin the install to a dead source, drop the license row or the footer, name the maintainer anywhere in the files.

## Design

### User experience

A reader working in a Next.js App Router app asks about Cache Components, Partial Prefetching, bundle size or verifying a change in a running `next dev`.
`next-skills-bridge` triggers, checks whether the matching upstream skill is installed in `.claude/skills/` or `~/.claude/skills/` and, if present, defers to that skill's own SKILL.md.
If absent, it tells the reader this is a bridge and the skill is not installed, points at `/pro-dev install` and names `next-best-practices` and the Next.js docs as the interim fallback.
For everyday App Router conventions the reader stays in `next-best-practices`; for a version upgrade, `next-upgrade`.
The tone is a short router: it never reimplements the upstream steps.

### System

Touched: `plugins/pro-nextjs/skills/next-skills-bridge/SKILL.md` (the pointer), the removed `next-cache-components` directory, the rewritten `next-best-practices` and `next-upgrade` skills, the pro-nextjs LICENSE, both pro-nextjs manifests, the marketplace entry and `metadata.version`, the `next-skills` row in `plugins/pro-core/registry/engines.json` and the `docs/licenses.md` rows.
Reuse: the bridge follows the pattern already set by pro-testing's `qa-suite`, pro-design's bridges and pro-ship's `vercel-deploy-bridge`, and the install path is the shared `/pro-dev` engine installer, not a new command.
No migration script; the loss of `next-cache-components` is handled by the bridge prose, not by code.

### Alternatives considered

- Keep the adapted skills and add a license file: rejected, the upstream never carried a license so there is nothing to point a license at.
- Vendor the six upstream skills into the repo: rejected, it means maintaining a tree that drifts from Next.js releases and re-triggers the same license question; a bridge tracks upstream on its own cadence.
- Ship a standalone `/next-skills` command: rejected, the repo already installs bridged engines through `/pro-dev install` and the engine registry, so a new command would duplicate that path.

## Flagged concerns

Reviewers start here.

ADR needed: no, the change follows the established bridge pattern (pro-testing, pro-design, pro-ship) and the version-bump, codex-parity and engine-registry laws already cover it; it sets no new rule and the "prefer bridges over vendoring" direction is already in force.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The `next-skills` engine installs from `vercel/next.js` branch `canary`, a live tip rather than a pinned commit, so an upstream rename or removal breaks the install silently where the other bridges pin a SHA | docs/licenses.md bridge model; engines.json | open: the bridge chose `canary` so the skills track Next.js releases, the cost is that a moved or renamed upstream skill is not caught until install fails; flag for the maintainer to decide whether to pin |
| 2 | The implementation already shipped in pro-nextjs 0.12.1, so this spec is a record of the accepted target, not a design for pending work; accepting it is a verification step | this repo's SDLC loop | open: confirm the shipped state matches R1-R9 and N1-N2, then mark the intent and spec accepted |

## Open questions

- The intent left no Open questions section.
- Carried from the flagged concerns: should the `next-skills` install pin a commit SHA the way `vercel-skills` and `vercel-deploy` do, trading fresh-tracking for a stable install. Open, owner the maintainer.

## Acceptance criteria

- AC1. `grep -ri "next-skills" plugins/pro-nextjs` and a read of the pro-nextjs skills show no text copied from vercel-labs/next-skills and no `next-cache-components` directory (R1, R2).
- AC2. The `next-skills-bridge` SKILL.md lists all six upstream install names with the task each handles, states it is a bridge installed via `/pro-dev install`, carries the raw `npx skills add` line and names the `next-cache-components` loss and the Next.js 16.3+ floor (R3, R4, R9, N2).
- AC3. `plugins/pro-core/registry/engines.json` has a `next-skills` row owned by pro-nextjs that bridges `next-skills-bridge` and installs the six skills non-interactively with `-y` (R5, N1).
- AC4. `next-best-practices` and `next-upgrade` cite a docs page per section and carry the MIT Next.js footer; the pro-nextjs LICENSE and docs/licenses.md record the sources with the bridge marked `bridged` and the two skills marked `adapted`, with no `next-cache-components` row (R6, R7, R8).
- AC5. `node tests/check.mjs`, `node tests/eval.mjs --dry` and `claude plugin validate . --strict` pass, confirming the version-bump law, codex parity and the engine registry hold for the shipped change.

## Out of scope

- Pinning the `next-skills` install to a commit SHA; raised as an open question for the maintainer.
- The `vercel-skills-bridge` and `shadcn` skills, which this intent does not touch.
- Any change to the upstream Next.js skills themselves, which live in vercel/next.js.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
