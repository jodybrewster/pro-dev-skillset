---
intent: intent.md
intent-status: accepted
status: draft
created: 2026-11-07T10:26:51-05:00
author: the maintainer
---

# Spec: land the findings from the review of PR 51

Built from `intent.md` in this folder (commit 45c6672).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `docs/decisions/0002-version-bump-law.md`, `docs/decisions/0004-codex-parity.md`, `RELEASING.md`, `docs/roadmap.md`.

## Summary

The independent review of PR 51 (cc48aad) raised four substantive defects and a set of style nits: a meta-plugin that re-resolves nothing after a dependency bump, a verify loop that passes on failure, an unmet Apache-2.0 obligation in `pro-testing` and the nits.
This spec is written on 2026-11-07, three weeks after the intent, and its first job is to record that the repo has moved well past the state the review saw.
Every substantive finding has already been resolved by later work, and the one version-pin outcome the intent names has been superseded by the `pro-starter` rename.
What exists once this ships is therefore a verified, closed-out record of the PR 51 review rather than a fresh set of edits.

## Assumptions

All marked `unconfirmed`: this spec was written with the run-without-questions flag and nobody was available to answer.

1. The audience is the marketplace maintainer and anyone who installed the plugins touched by PR 51; there is no runtime, server or UI in scope.
2. The intent's `status: accepted` still holds, even though the roadmap does not list this intent under Now, Parked or Dropped.
3. The version-bump law, the hook-loading law and Codex parity apply to any content change this intent would still drive under `plugins/`.
4. The goal is correctness of the record and of the shipped files, not re-doing work that already landed.

## Requirements

### Functional

- R1. The unconditional meta-plugin rule holds in both places: `RELEASING.md` says any dependency bump bumps the meta-plugin and `docs/decisions/0002-version-bump-law.md` says the same, with no surviving wording that narrows it to minor bumps (traces to intent "RELEASING.md's unconditional meta-plugin rule stands and ADR-0002 says the same").
- R2. A consumer who installed the meta-plugin before PR 51 can re-resolve the plugins PR 51 patched through a meta-plugin bump (traces to intent "`pro-starter` 1.12.2 re-resolves the plugins PR 51 patched").
- R3. The verify loop in `CLAUDE.md` fails the chain when any plugin fails validation rather than exiting 0 (traces to intent "The verify loop fails the chain when any plugin fails").
- R4. `plugins/pro-testing/LICENSE` carries the full Apache-2.0 text beside the agent-browser fork, satisfying section 4(a), and records the upstream NOTICE state (traces to intent "`pro-testing` 0.5.7 ships the full Apache-2.0 text beside the agent-browser fork").
- R5. The nits the review listed are fixed: no em dash in `.claude/commands/research.md`, no home-directory path in `docs/plans/AGENT-SKILLS-INTEGRATION.md` and the comma-before-a-conjunction cases the review named are gone (traces to intent "The nits are fixed").
- R6. `REVIEW.md` catches a tilde-prefixed home path in a reviewed diff (traces to intent "REVIEW.md catches the next tilde path").

### Non-functional

- N1. `CLAUDE.md` stays at or under the line budget the plan assumed and reads as human-written prose under the repo's writing rules.
- N2. Any change this intent still drives under `plugins/` bumps its plugin in both manifests, the marketplace entry and `metadata.version` in the same commit.

### Policy constraints applied

- Version-bump law ([ADR-0002](../../docs/decisions/0002-version-bump-law.md)): any residual content change under `plugins/` carries its version bump; no such change remains open in this spec.
- Codex parity ([ADR-0004](../../docs/decisions/0004-codex-parity.md)): a `pro-testing` or meta-plugin bump aligns the `.codex-plugin/plugin.json`; both are already aligned at their current versions.
- Writing rules (`CLAUDE.md`): no em dash, no Oxford comma, no comma before a conjunction, straight quotes; these are the same rules the nits in R5 enforce.
- REVIEW.md security pass: a tilde-prefixed home path to one person's files is a finding; R6 is that rule.

### Boundaries

Always: read the current state of each file the intent names before claiming a finding is open or closed.
Ask first: whether to close this intent as superseded, whether to narrow it to a residual cleanup and whether the `pro-starter` rename retires R2.
Never: re-pin `pro-starter` to 1.12.2, re-apply a fix that already landed, or merge, tag or publish anything.

## Design

### User experience

There is no user-facing flow.
The reader is the maintainer deciding what, if anything, is left to do on this intent.

### System

Current state of each finding, read on 2026-11-07:

- R1: resolved. `docs/decisions/0002-version-bump-law.md` Consequences says any bump, patch bumps included, bumps the meta-plugin and records the 2026-10-16 correction of the earlier minor-only wording. `RELEASING.md` states the unconditional rule and names the renamed meta-plugin `pro-dev-starter`.
- R2: superseded. `pro-starter` is now 1.12 behind: it sits at 1.14.4 and its description reads "Deprecated: renamed to pro-dev-starter." The 1.12.2 pin the intent names was overtaken by the rename and by every bump since, so a 1.12.2 outcome is no longer buildable or meaningful.
- R3: resolved. `CLAUDE.md`'s verify loop runs each plugin validate in a subshell that exits 1 on the first failure, so the chain carries the failing status.
- R4: resolved. `plugins/pro-testing/LICENSE` carries the full Apache-2.0 text under the agent-browser heading, cites section 4(a) and records that vercel-labs/agent-browser has no NOTICE file upstream (checked 2026-10-16). `pro-testing` is at 0.8.2, past the 0.5.7 the intent named.
- R5: resolved for the two specific nits. `.claude/commands/research.md` was rewritten and holds no em dash. `docs/plans/AGENT-SKILLS-INTEGRATION.md` holds no home-directory path.
- R6: resolved. `REVIEW.md` security pass tells the reviewer to grep the diff for `~/.claude/` and `~/Projects/` and treat a plan file, checkout or session folder as a finding.

Nothing in this spec reopens code or config.
The files named above are read, not written.

### Alternatives considered

- Plan and build the intent as written: rejected, because the substantive fixes already landed and R2 would re-pin a deprecated plugin.
- Delete the intent folder outright: rejected, because the review record and the traceability from the PR 51 finding to its resolution are worth keeping; a close or supersede decision is the maintainer's.

## Flagged concerns

The sources checked were `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `docs/decisions/0002-version-bump-law.md`, `docs/decisions/0004-codex-parity.md`, `RELEASING.md` and `docs/roadmap.md`.

ADR needed: no, this is a closed-out bug record and the one decision it rested on (the unconditional meta-plugin rule) was already recorded in ADR-0002 on 2026-10-16.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent is superseded: every substantive outcome already landed through later work and the intent appears on no roadmap list. | the maintainer | open: close the intent as done, or narrow it to a residual cleanup. |
| 2 | R2 (`pro-starter` 1.12.2 re-resolves) is not buildable: `pro-starter` is deprecated at 1.14.4 and renamed to `pro-dev-starter`. | the maintainer | open: confirm the rename retires R2 rather than requiring a 1.12.2 pin. |
| 3 | Comma-before-a-conjunction cases exist today in `README.md` and `docs/decisions/0004-codex-parity.md`, but in lines the files gained after the review, not the lines the review named; the original nits are gone. | the maintainer | open: treat as a fresh style pass, separate from this intent, or fold into R5 if the intent is kept. |

## Open questions

- Should this intent be marked done and recorded on the roadmap, given every substantive finding is resolved? Open, owner the maintainer.
- Does the `pro-starter` rename to `pro-dev-starter` formally retire the 1.12.2 re-resolve outcome (R2)? Open, owner the maintainer.
- Are the current comma nits in `README.md` and ADR-0004 in scope here or a separate style pass? Open, owner the maintainer.

## Acceptance criteria

The intent's Check section named tags and versions that the repo has since moved past, so these criteria verify the record rather than reproduce those exact numbers.

- AC1. `docs/decisions/0002-version-bump-law.md` and `RELEASING.md` both state the unconditional meta-plugin rule with no minor-only wording.
- AC2. `CLAUDE.md`'s verify loop exits non-zero on the first plugin that fails validation.
- AC3. `plugins/pro-testing/LICENSE` contains the full Apache-2.0 text under the agent-browser heading and the NOTICE note.
- AC4. `.claude/commands/research.md` has no em dash and `docs/plans/AGENT-SKILLS-INTEGRATION.md` has no home-directory path.
- AC5. `REVIEW.md` instructs the reviewer to grep a diff for tilde-prefixed home paths.
- AC6. `node tests/check.mjs` and `node tests/eval.mjs --dry` pass and `claude plugin validate . --strict` passes.

## Out of scope

- Re-pinning or re-releasing `pro-starter` / `pro-dev-starter` at 1.12.2.
- `pro-nextjs` (the `next-bridge` branch reworks it) and footers on the pro-spdd skills, both ruled out by the intent.
- A general comma-and-style sweep of files the review did not name.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
