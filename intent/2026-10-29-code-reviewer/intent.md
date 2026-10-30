---
source: idea
kind: change
status: draft
risk: medium
created: 2026-10-29T19:00:00-0400
author: Jody Brewster
---

# Intent: a detailed code-reviewer agent

Author: Jody Brewster (pro-dev-skillset).
Source: idea, item 3 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md).
It comes from Jody's asks in the [pro-ship brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md) and from the comparison with [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `agents/code-reviewer.md` (MIT).
The `code-reviewer` row of the [specialist agents intent](../2026-10-28-specialist-agents/intent.md) moves into this intent; that intent keeps the other agents.
Status: draft.
Created: 2026-10-29.

## Problem

Jody asked for "maybe a detailed code reviewer? I know we have a security review".
Neither reviewer in the marketplace is one.
`pro-ai-sdlc:reviewer` is a narrow policy gate: bugs, security and compliance against `REVIEW.md`.
It drops anything without a failure scenario.
Readability, architecture and test-quality problems pass it.
pro-quality's `requesting-code-review/code-reviewer.md` is closer, but it is a prompt template for a general-purpose agent with no agent file, no model and no stable output.
A new Claude Code subagent starts with an empty context, but that template has a `{DESCRIPTION}` field for "what you built", which is where the author's reasoning leaks in.
Jody's rule is "I need the code reviewer to have fresh context as well".
The template breaks it.
The roadmap ranks this P0: every PR that goes through the gate will meet this reviewer, so a missing lens means a class of defect ships in every repo that installs the starter.
The problem shows up on every PR, in every repo with the plugin.
The author is usually an agent that is blind to its own assumptions.

## Proposed outcome

pro-quality ships a `code-reviewer` agent that any command can dispatch by name.
It runs on Opus, reads only and starts with no knowledge of the session that wrote the code.
It reviews a diff on five lenses: correctness, tests, design, performance and compliance.
Security is out of its scope because pro-security covers it.
Each finding gives the file and line, a severity (Important or nit), a Pre-existing tag when the code was already there and a failure scenario that says what input or state makes it fail.
Nits are capped.
It takes a handoff of four fields and nothing else: the base and head sha; paths to `intent.md`, `spec.md` and `plan.md`; paths to `REVIEW.md`, the agent file and `CONSTRAINTS.md` when present; and the risk tier with the signals that set it.
`requesting-code-review` dispatches this agent in place of the template.
A check in `tests/check.mjs` holds the handoff to exactly those fields, so a later edit cannot add a description field back.
The agent carries the review knowledge adapted from agent-skills: the design-smell list, the mutation check, the presumptive blockers and the test scenario list.
It has a Codex twin so the same reviewer can run under Codex.

## Affected users and systems

Jody and any session in a repo that installs pro-quality, which is in the starter.
pro-quality: a new agent, its `.codex-plugin/agents/code-reviewer.toml`, the `requesting-code-review` skill (its `code-reviewer.md` template goes), `LICENSE`, both manifests and its marketplace entry.
The sibling intents being drafted now that call or feed the agent: `pr-gate` (dispatches it), `risk-tiers` (produces the tier in the handoff) and `review-policy` (the `REVIEW.md` template and the convergence rules it reads).
`docs/licenses.md`, `tests/check.mjs`, the routing cases and the root `.claude-plugin/marketplace.json`.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
The agent declares `model: opus` in its frontmatter, because reviewers run on Opus.
Fresh context is a hard requirement: the handoff has four fields, no author-written description, no PR body, no session summary and no earlier findings.
The brief is allowed because it states what was asked for, not how the author reasoned.
The agent never runs as a fork of the session, since a fork inherits the whole context.
The agent's prompt holds only the generic lenses.
Everything specific to a project, such as its laws, its Important bar, its nit cap and its do-not-report list, comes from `REVIEW.md` (Jody, 2026-10-28: the reviewer "needs to look at a REVIEW.md file for project specific reviewing").
The agent only reads `CONSTRAINTS.md`; the constraint-floor intent owns that file.
No agent invokes another agent.
Adapted text keeps an MIT footer, a row in `docs/licenses.md` and the copyright line in `plugins/pro-quality/LICENSE` (Copyright (c) 2025 Addy Osmani).
Keep our failure-scenario rule, which upstream lacks.
Keep our two severities.
No new dependency on another plugin or marketplace.

## Out of scope

The `REVIEW.md` template upgrade and the convergence rules (round cap, no repeated findings, Pre-existing tag semantics); the `review-policy` intent owns both.
`pr-check` and the stamp; the `pr-gate` intent owns them.
The classifier that produces the risk tier; the `risk-tiers` intent owns it.
Codex as a second reviewer run in parallel (roadmap item 13), reviewer evals from past bugs (item 22) and the skeptic pass.
Changing `pro-ai-sdlc:reviewer`, which stays as `/review`'s narrow policy gate.
The security finder, the web-performance auditor and the other agents in the specialist agents intent.
Writing `CONSTRAINTS.md`.
Change-size bands and "a refactor and a feature are two PRs" from the roadmap's optional line, unless Jody asks for them.

## Success looks like

Dispatched by name with the four-field handoff, the agent returns findings in one stable format with file, line, severity and a failure scenario.
A diff that adds a condition no test exercises gets a tests-lens finding that names the missing case.
A diff that bolts a conditional onto an unrelated flow gets a design finding.
A handoff with a description field fails `node tests/check.mjs`.
`requesting-code-review` no longer carries a template with a description field.
`claude plugin validate --strict` and `node tests/check.mjs` pass with the agent and its Codex twin.
Later, the reviewer evals from past bugs (item 22) show it reporting a known bug from this repo's history; that gates item 22, not this change.

## Open questions

- Subagent with the fixed handoff or a separate `claude -p` process: the brainstorm leaves it open. Recommendation: the subagent for now, since it shows progress in the session and the four-field handoff holds the fresh-context rule; `claude -p` fits with CI later and `pr-gate` can choose it without changing this agent.
- Effort: the brainstorm says Opus at high effort and `CLAUDE.md` says medium with high for a review pass. Recommendation: high, because this is a review pass; the dispatcher sets it.
- Whether the mutation check belongs in a read-only agent, since it edits a file and runs tests. Recommendation: run it only in a throwaway worktree and never in the working tree.
- Whether the change-size bands and the "two PRs" rule come in now. Recommendation: leave them out, because the risk classifier already sees size.
- Whether `test-engineer` still earns its own agent once this reviewer has a tests lens. Recommendation: no for now; the specialist agents intent keeps the question.
- Likely needs an ADR: the four-field fresh-context handoff as a contract that every reviewer in the marketplace follows and `tests/check.mjs` enforces, plus `REVIEW.md` as the only source of project review rules.

## Evidence

None; this is an idea.
Upstream reference: `agents/code-reviewer.md`, `skills/code-review-and-quality/SKILL.md` and `agents/test-engineer.md` in agent-skills at commit `eb07f19`.
Our gap: `plugins/pro-quality/skills/requesting-code-review/code-reviewer.md` has a `{DESCRIPTION}` placeholder and no agent file exists for it.
`plugins/pro-ai-sdlc/agents/reviewer.md` runs three passes (bugs, security, compliance) and has no design or test-quality pass.
