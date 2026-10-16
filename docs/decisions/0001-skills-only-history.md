# ADR-0001: Skills first, other components only where triggering must be deterministic

Date: 2026-05-24 (f0887bd, "Initial marketplace + pro-core/pro-starter plugins")

## Status

accepted

## Context

The marketplace began as skills only.
A skill is a folder of instructions that Claude loads when the task matches its description, so whether it fires is probabilistic.
That is acceptable for guidance, and it kept the first commit small and portable.

It stopped being enough once some behavior had to happen every time.
Hooks and slash commands arrived within the first day (c22c205, 2026-05-24, "Phase 4: hooks, slash commands, CI validation").
The first plugin agents followed on 2026-06-02 with the four pro-research researchers (ef447db, the pro-research 0.2.0 commit).
By 2026-06-07 a hook gated pull request quality with an automatic code review (da0f024, "feat(pro-quality): add PR quality gate hook with auto code review").
The agent file recorded the outcome: the marketplace was built from skills at first, and other components are added where deterministic triggering beats description matching.

## Decision

Skills are the default unit of a plugin.
A hook, command or agent is added only when a skill's probabilistic trigger is not good enough.

- A hook for an event that must always fire, such as a pre-tool guard or a session start nudge.
- A command for an explicit user entry point, where the user names the action instead of hoping a description matches.
- An agent for work that needs an isolated context, such as an independent check.

## Consequences

Skill descriptions carry the routing load, so their quality matters and every skill needs routing cases in the eval suite.
Each hook is a loading risk, so hooks follow the hook-loading law in CLAUDE.md.
Codex does not read agents or hooks the same way Claude Code does, so every component beyond a skill adds parity work for the Codex bridge.
A new hook, command or agent needs a stated reason why a skill would not do.

## Enforced by

[`tests/check.mjs`](../../tests/check.mjs) checks `frontmatter`, `router` and `eval-coverage` (skills are discoverable by description and routed by eval cases) and `hooks` (the deterministic layer loads).
The hook-loading law is recorded in [ADR-0003](./0003-one-hooks-json-per-plugin.md).
The policy statement lives in [`CLAUDE.md`](../../CLAUDE.md).
