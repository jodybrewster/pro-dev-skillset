---
source: idea
kind: change
status: draft
risk: medium
created: 2026-10-28T17:00:00-0400
author: Jody Brewster
---

# Intent: specialist reviewer and auditor agents

Author: Jody Brewster (pro-dev-skillset).
Source: Jody's idea on 2026-10-28, prompted by the four personas in [addyosmani/agent-skills docs/agents.md](https://github.com/addyosmani/agent-skills/blob/main/docs/agents.md) (MIT).
Those four are a starting point, not the final list.
Status: draft; the set of agents is still open.
Parked on 2026-10-29 until ranked item 18 in [docs/roadmap.md](../../docs/roadmap.md).
The `code-reviewer` row moved to its own intent, [2026-10-29-code-reviewer](../2026-10-29-code-reviewer/intent.md), on 2026-10-29; this intent keeps the remaining agents.
Created: 2026-10-28.

## Problem

The marketplace has 15 agents but few that give one specialist view of a change in a fresh context.
`pro-ai-sdlc:reviewer` is a narrow policy gate against REVIEW.md.
`pro-security:security-auditor` judges whether a single candidate finding is real; it does not hunt for findings.
pro-quality's `requesting-code-review/code-reviewer.md` is a prompt template for a general-purpose agent with no agent file, model or stable output.
Nothing covers test strategy or web performance as its own pass.

The pro-ship brainstorm ([brainstorm.md](../2026-10-28-pro-ship-scope/brainstorm.md)) needs reviewers that `/pro-ship:pr-check` can dispatch in parallel with a fixed handoff.
The earlier agent-skills plan ([AGENT-SKILLS-INTEGRATION.md](../../docs/plans/AGENT-SKILLS-INTEGRATION.md)) took only `security-auditor` and skipped the rest; that call predates the pro-ship work and should be revisited.

## Proposed outcome

A small set of specialist agents, each one role with one output format, placed in the plugin that owns its domain.
The candidates, from the upstream personas:

| Upstream persona | Proposed home | Notes |
|---|---|---|
| `security-auditor` | `plugins/pro-security/agents/`, under a new name such as `security-reviewer` | A first-pass OWASP-style audit that finds candidates; the existing `security-auditor` then judges them. The name clashes today. |
| `test-engineer` | `plugins/pro-testing/agents/test-engineer.md` | Test strategy and coverage gaps. Optional if the code-reviewer's tests lens is enough. |
| `web-performance-auditor` | `plugins/pro-quality/agents/`, with a `/webperf` command | Core Web Vitals audit; stack-neutral, so pro-nextjs and pro-astro point to it rather than own it. |

Other candidates worth weighing before `/spec`: an accessibility auditor (upstream ships an `accessibility-checklist` reference but no persona), a docs-drift reviewer (or whether pro-quality's `documentation-engineer` already covers it) and a dependency or supply-chain reviewer for pro-ship's later phases.

Each agent is forked or adapted with attribution, not bridged; the files are small and we already fork `interview-me` and `idea-refine` from the same upstream.
Upstream's "Composition" block is dropped; dispatch rules live in our commands and in pr-check.

## Affected users and systems

Every site that installs pro-quality, pro-security or pro-testing.
`plugins/pro-quality/`, `plugins/pro-security/`, `plugins/pro-testing/` (which gets its first `agents/` folder), their `.codex-plugin/agents/*.toml` twins, both manifests and marketplace entries for each, `docs/licenses.md`, `tests/check.mjs` and routing cases, the `using-pro-dev` router and README.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
Every agent declares `model:` for its role: reviewers and auditors on opus, builders on sonnet, readers on haiku.
Every reviewer starts with fresh context and takes the four-field handoff from the pro-ship brainstorm: base and head sha, brief paths, REVIEW.md and agent file paths, risk tier and its signals.
No agent invokes another agent.
Forked content keeps its MIT footer and a row in `docs/licenses.md`.
No new dependency on another marketplace.

## Out of scope

`/pro-ship:pr-check` itself and the gate that dispatches these agents; that stays in the pro-ship intent.
Codex as a second reviewer.
Changing `pro-ai-sdlc:reviewer` or the existing `pro-security:security-auditor` beyond what the naming needs.

## Success looks like

Each new agent can be dispatched by name with the four-field handoff and returns findings in a stable format with file, line, severity and a failure scenario.
`claude plugin validate --strict` and `node tests/check.mjs` pass with every new agent and its Codex twin.
No two agents in the marketplace share a name.
A reviewer given a diff with a known bug from this repo's history reports it.

## Open questions

- Which agents make the first cut; the four upstream personas are a starting point.
- Whether `test-engineer` earns its own agent or folds into the code-reviewer's tests lens.
- The name for the finding-hunting security agent, given `security-auditor` is taken.
- Whether `web-performance-auditor` belongs in pro-quality or pro-testing.
- Whether this lands before pro-ship v0.1 so pr-check has reviewers to dispatch, or alongside it.
- Whether the upstream reference checklists (`security-checklist`, `performance-checklist`, `accessibility-checklist`, `testing-patterns`) come with their agents.
