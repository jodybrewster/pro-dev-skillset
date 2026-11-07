---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T10:40:00-0500
author: the maintainer
module: m5
---

# Spec m5: architecture review

Built from `intent.md` in this folder (commit 5041d4a), module m5 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, ADR-0002, ADR-0004, ADR-0006, ADR-0012, ADR-0013, `docs/licenses.md`, `plugins/pro-design/skills/impeccable-bridge/SKILL.md`, `plugins/pro-core/registry/engines.json`, `plugins/pro-security/agents/security-architect.md`.

## Summary

pro-quality gains a `codebase-design-bridge` skill that routes deep-module and interface questions to mattpocock's `codebase-design` and `improve-codebase-architecture`, installed as the `mattpocock-skills` plugin through `/pro-dev install`, plus an `architect` agent that reviews a plan, a diff or a whole repo for architecture in the way `security-architect` does for security.

## Assumptions

Confirmed on 2026-11-07:

1. `claude plugin install mattpocock-skills@claude-plugins-official` installs the upstream; its skills appear at `skills/codebase-design/SKILL.md` under the plugin cache and may also be at user or project scope.
2. The registry already has a `claude-plugin` kind.
3. The agent runs on Opus with the handoff fields of ADR-0012 (range, brief, policy, risk).
4. The twelve factors plus API-first, telemetry and authN/Z are the audit checklist, as roadmap item 17 says.

## Requirements

### Functional

- R1. `plugins/pro-core/registry/engines.json` gains a row `mattpocock-skills` of kind `claude-plugin`, owner pro-quality, `bridges: [codebase-design-bridge]`, detect on `skills/codebase-design/SKILL.md` at plugin, user or project scope, install and update through `claude plugin` (intent: "a `codebase-design-bridge` skill in pro-quality over mattpocock's `codebase-design` and `improve-codebase-architecture`").
- R2. `plugins/pro-quality/skills/codebase-design-bridge/SKILL.md` says it is a bridge, names the two upstream skills, routes "design this module", "is this interface deep or shallow", "where should this live" and "audit the architecture" to them and tells the person to run `/pro-dev install` when the detect fails.
- R3. The bridge vendors no upstream text; `docs/licenses.md` gains a bridged row (MIT, Copyright (c) 2026 Matt Pocock).
- R4. `plugins/pro-quality/agents/architect.md` (and its `.codex-plugin/agents/architect.toml`) runs on Opus, read-only, in three modes: `plan` returns a `## Architecture challenge` section, `diff` returns scored findings on a range when it shows architecture signals (new module, new dependency, a public interface change, a cross-layer import), `audit` fills a scorecard over the checklist of assumption 4.
- R5. The agent reads the bridge's upstream skill when installed and says so in its report; when absent it reviews from its own checklist and names the gap.
- R6. `/review` dispatches `architect` in diff mode when the range carries an architecture signal; `/ship` lists its findings under the same convergence rules as the other specialists (ADR-0011).
- R7. A routing case in `tests/cases/routing.jsonl` sends an architecture prompt to the bridge and a security prompt stays with `security-architect`.

### Non-functional

- N1. Codex parity: the agent has its `.toml`, the skill prose names no harness.
- N2. Both plugins bump per the version-bump law; pro-core for the registry row.
- N3. `tests/bridge-install-smoke.mjs` covers the new row.

### Policy constraints applied

- ADR-0006: a bridge skill has a registry row; the `registry` check enforces it.
- ADR-0013: the skill sits in pro-quality, the narrowest layer whose every user wants it.
- ADR-0012: the handoff is the four fields and nothing else.
- Bridges over vendoring: R3.
- Live evals: the PR reminds about `node tests/run-evals.mjs pro-quality`; it runs only when asked.

### Boundaries

Always: detect before routing, report read-only.
Ask first: installing the upstream plugin, enabling the diff-mode dispatch in `/review`.
Never: copy upstream skill text into this repo, approve or block a PR from the agent.

## Design

### User experience

Asking "should this be one module or three" from a repo with the plugin installed gets the upstream skill's answer; without it, a one-line pointer to `/pro-dev install`.
`/review` on a PR that adds a module gains an "Architecture" block with scored findings.

### System

- Files named in R1 to R7, plus `plugins/pro-quality/commands/review.md` and `plugins/pro-ship/skills/ship/SKILL.md` for R6.
- The agent mirrors `plugins/pro-security/agents/security-architect.md` in structure and `plugins/pro-security/skills/security-architect/{challenge,diff-review}.md` as sidecars under `skills/architect/`.

### Alternatives considered

- Forking the mattpocock skills: upstream updates often and is plugin-managed; a bridge tracks it for free.
- Putting the agent in a new `pro-architecture` plugin: no audience ends there (ADR-0013).

## Flagged concerns

ADR needed: yes, a new specialist review that `/review` and `/ship` dispatch sets a rule other work follows; drafted as [ADR-0026](../../docs/decisions/0026-architecture-review.md) at plan time once the maintainer answers the open question below.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | An Opus agent on every `/review` with an architecture signal adds cost to the loop | `docs/evals.md`, the model split | open: dispatch only on the signals in R4; the maintainer confirms the list |
| 2 | mattpocock-skills is a 28-skill plugin; installing it brings skills that overlap ours (`tdd`, `code-review`, `grilling`) | `using-pro-dev`, the router | open: the install note says which overlap and that ours route first; a routing case guards the two most likely collisions |

## Open questions

- Which architecture signals trigger diff mode (concern 1): the four in R4 are the proposal.
- Whether the ADR is written at spec time or plan time; the proposal is plan time, after the signal list is settled.

## Acceptance criteria

- AC1. `/pro-dev check` reports `mattpocock-skills` missing or present with its version.
- AC2. `/pro-dev install` on a clean machine installs it and the bridge detect passes.
- AC3. `architect` in plan mode on `intent/2026-11-04-rollback-path/intent.md` returns a `## Architecture challenge` section with at least one concern tied to a line of the intent.
- AC4. `architect` in diff mode on a fixture range that adds a cross-layer import returns a finding citing the import; on a docs-only range it returns no findings.
- AC5. The routing case passes in `node tests/route-lexical.mjs`.
- AC6. `node tests/check.mjs`, `claude plugin validate . --strict` and the Codex parity check pass.

## Out of scope

- `domain-modeling` and `grill-with-docs` (a separate decision on a glossary file).
- Twelve-factor fixes applied by the agent; it reports only.
