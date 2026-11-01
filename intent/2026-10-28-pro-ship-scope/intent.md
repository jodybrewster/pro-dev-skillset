---
source: research
kind: change
status: dropped
risk: medium
created: 2026-10-28T15:45:00-0400
author: the maintainer
---

# Intent: fill the Ship phase with pro-ship v0.1

Author: the maintainer.
Source: research the maintainer brought on 2026-10-28 (kept in full in [research.md](research.md)), "pro-ship: What Goes in It, Where It Lives, and What to Build First", plus the maintainer's ask for GitHub practices and portable twelve-factor apps.
Status: draft; the maintainer is still brainstorming and evaluating the scope before `/spec`.
The brainstorm so far, which widens this scope and proposes splitting it into three intents, is in [brainstorm.md](brainstorm.md).
Dropped on 2026-10-29: the PR gate part (the brainstorm's Intent A) is replaced by four intents, [review-policy](../2026-10-29-review-policy/intent.md), [code-reviewer](../2026-10-29-code-reviewer/intent.md), [pr-gate](../2026-10-29-pr-gate/intent.md) and [risk-tiers](../2026-10-29-risk-tiers/intent.md).
The brainstorm's Intents B (`ship`, `pipeline`, `repo-hygiene`) and C (docs and architecture review) get their own intents when [docs/roadmap.md](../../docs/roadmap.md) reaches them; `research.md` and `brainstorm.md` stay here as their source.
Created: 2026-10-28.

## Problem

Ship is the only lifecycle phase with no plugin behind it.
The router and README list `ci-cd-and-automation`, `shipping-and-launch`, `documentation-and-adrs` and `deprecation-and-migration` as planned.
pro-ship shipped in PR 68 holding only `vercel-deploy-bridge`.
Shipping work today is spread over pro-core's `/gh`, pro-ai-sdlc's `/pr-babysit` and `production-gate` hook, pro-security's `/security-audit`, pro-legal's release gate and pro-quality's `technical-writer`.

## Proposed outcome

The research TL;DR, in its priority order:

1. Placement: pro-ship stays its own plugin and joins `pro-dev-starter`'s dependencies; the core stays stack-agnostic, with stack-specific deploy guidance in reference files or later opt-in siblings.
2. v0.1 MVP, built first:
   - `ship`: a preflight router that runs the checks below, calls `/security-audit` and the legal review where installed and writes `.pro-dev/ship/preflight.md` as Blocking, Should-fix and OK.
   - `twelve-factor`: an evidence-based audit of the twelve factors plus API-first, telemetry and authN/Z, one row per factor with `file:line` evidence, with Node/Next.js and Python checks.
   - `pipeline`: generate or audit GitHub Actions with OIDC to the cloud, least-privilege `permissions`, actions pinned to commit SHAs and required checks.
   - `release`: conventional commits to semver to changelog to tag to GitHub Release, release-please first.
   - One warn-mode `PreToolUse` release-gate hook.
3. Later, not in this intent: repo hygiene (rulesets, CODEOWNERS, templates, Dependabot or Renovate), deploy strategy and rollback, supply chain, observability and smoke tests, migrations, web budgets, mobile, DORA and AI eval gates.

pro-ship calls into the existing plugins for commits, PR shepherding, security and legal review and never rebuilds them.
`vercel-deploy-bridge` stays as it shipped.

## Affected users and systems

Every pro-dev-starter site once pro-ship joins the starter.
`plugins/pro-ship/`, `plugins/pro-dev-starter` (dependencies), the `using-pro-dev` router, README, the registry (if any new engine), `tests/check.mjs` and routing cases, `docs/licenses.md` for content forked from `agent-skills` (MIT).

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
Hooks are warn-mode by default and follow `~/.claude/hooks/mode`; a hook is a guardrail, never a security boundary.
The release-gate hook must not double-prompt with pro-ai-sdlc's `production-gate` or pro-legal's release gate on the same `git tag` or `gh release create`.
The `vercel-deploy` row stays opt-in even when pro-ship joins the starter.
The per-plugin installer rule (intent `2026-10-28-plugin-installers`) applies to any engine pro-ship adds.

## Out of scope

Everything the research marks v0.2 to v0.4.
Rebuilding commit, PR creation, PR review, security scanning or legal review.
Moving `/gh` or `/pr-babysit` out of their plugins.

## Success looks like

On a pro-dev-starter site, "ship it" routes to `/pro-ship:ship`, which writes a preflight report naming every Blocking item with evidence.
`/pro-ship:twelve-factor` on a Next.js app reports each factor with `file:line` evidence.
`/pro-ship:pipeline audit` flags an unpinned action, a missing `permissions` block and a required job that can be skipped.
`/pro-ship:release` opens a release-please PR rather than tagging on its own.
A `git tag` with no fresh preflight prints one warning, not three.

## Open questions

- Join `pro-dev-starter` now or once v0.1 lands; today pro-ship is opt-in and holds only the Vercel deploy bridge.
- How the release gate shares one prompt with `production-gate` and pro-legal's gate: one gate that reads all three, or an order with a marker file.
- Skills or commands: the research says `skills/` is preferred and `commands/` is legacy, while this repo uses `commands/` for slash commands today.
- Which of `ci-cd-and-automation` and `shipping-and-launch` to fork from `agent-skills` and how much to specialise.
- Likely needs an ADR if the release-gate coordination sets a rule for every gate hook.
