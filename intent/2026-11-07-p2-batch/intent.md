---
source: roadmap
kind: change
breaking: false
status: proposed
risk: medium
level: 3
created: 2026-11-07T12:00:00-0500
author: the maintainer
---

# Intent: the P2 roadmap items, built in order of need

Source: [docs/roadmap.md](../../docs/roadmap.md), P2 tier, after the comparison with super-board 3.3.0 and agent-skills 0.6.15 in #166.
Status: proposed.
Created: 2026-11-07.
Related: [sdlc-happy-path-run](../2026-11-04-sdlc-happy-path-run/intent.md), [rollback-path](../2026-11-04-rollback-path/intent.md).

## Problem

The P2 tier holds twelve open items: 16, 17, 19, 20, 21 and 22 from the agent-skills comparison of 2026-10-29 and 44 to 49 from #166.
None has an intent, so none can enter the loop. The tier mixes one-file fixes with work that needs a new agent or a CI change.
Several of the small ones answer retest findings of 2026-11-04 directly: worktrees from `/execute` and the factory pile up with no safe cleanup, a role is only `user.name`, `## Done` and a merged state are never checked against the base branch, `factory.py level` raises to 3 on an intent that only discusses a stop-list word and the hook tests never run on macOS's Python 3.9.
Two of the larger ones, the architecture review (17) and source-driven development (19), have upstream skills ready to bridge or fork: mattpocock's `codebase-design` and `improve-codebase-architecture`, which super-board's review lane requires on every PR, plus agent-skills' `source-driven-development`.

## Proposed outcome

Every P2 item is either built or has a written reason to park, in this order:

1. The small batch, one PR per plugin: 47 (stop-list scan on added lines only), 46 (a merged state is verified on the fetched base and plan-sync writes `Done as of <sha>`), 49 (`/constraints` proves each check on a known violation and a clean control), 48 (a CI matrix with macOS and Python 3.9 for the hook tests).
2. 44, worktree cleanup: merged branches found by ancestor, `git cherry`, a squash probe and a merged PR; unmerged work is kept and wip-committed; a recovery file is written before anything is deleted; adapted from super-board's `hooks/cleanup-wt.py` with attribution.
3. 45, verified role identity: the `gh api user` login is checked against the role map before a role acts.
4. 22, reviewer evals from the commits behind "Things Claude gets wrong", rescored when the reviewer changes, with clean PRs to measure noise.
5. 17, the architecture review: a `codebase-design-bridge` skill in pro-quality over mattpocock's `codebase-design` and `improve-codebase-architecture` (an `engines.json` row of kind `claude-plugin`, installed with `claude plugin install mattpocock-skills@claude-plugins-official`), plus an `architect` agent in plan, diff and audit modes that mirrors `security-architect`.
6. 19, source-driven development forked from agent-skills into pro-execution, with its docs cache.
7. 20, installed skills declare runnable checks that pr-check runs.
8. 21, the scaling block in `REVIEW.md` and `repo-hygiene`.
9. 16, `pipeline`: the gate as required CI checks.

Items 20, 21 and 16 may park with a reason once 1 to 6 are in, since each pays off only past one person or once CI holds the gate.

## Affected users and systems

- `pro-ai-sdlc`: `factory.py`, `plan-sync.py`, the worktree hook, the reviewer evals.
- `pro-quality`: `constraints`, the new bridge and `architect` agent, `code-reviewer`.
- `pro-execution`: the new `source-driven-development` skill.
- `pro-core`: the registry row for mattpocock-skills.
- `pro-ship`: `pr-check` for item 20, `REVIEW.md` for item 21.
- This repo: `.github/workflows`, `docs/licenses.md`, `docs/enforce-mode.md`, `docs/roadmap.md`.

## Constraints

- Each PR follows the version-bump law and the hook-loading law; the worktree hook joins its plugin's one `hooks/hooks.json`.
- Ported guards and hooks run under the warn and enforce modes, never a plain deny; the cleanup hook starts in warn.
- Bridges follow [ADR-0006](../../docs/decisions/0006-engine-registry-and-pro-dev.md) and the bridge precedent in `pro-design`; forks keep the upstream footer and a row in `docs/licenses.md` (mattpocock/skills MIT, agent-skills MIT).
- Live evals for a new or changed skill run only on the maintainer's yes, with the cost stated first.
- The P1 "reaching Done" group (35 to 39 and 46) comes before the board rerun; 46 is shared with this intent and is built once.

## Out of scope

- The P0 guard hardening (32, 33, 34, 43) and the rest of P1, which have their own intents.
- mattpocock's `domain-modeling` and `grill-with-docs`: whether the SDLC wants a glossary file is a separate decision.
- The item 30 domain skills, forked one by one when a project needs them.

## Risk

Medium.
The cleanup hook deletes worktrees, so it is the one step that can lose work; the recovery file and the warn start bound that.
The rest is additive.

## Check

`docs/roadmap.md` ticks each P2 item with its PR, or records the reason it parked; `node tests/check.mjs` passes after each PR.
