---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T10:40:00-0500
author: the maintainer
module: m4
---

# Spec m4: reviewer evals from past bugs

Built from `intent.md` in this folder (commit 5041d4a), module m4 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md` ("Things Claude gets wrong", live-eval reminder), `docs/evals.md`, ADR-0009, `REVIEW.md`.

## Summary

The commits behind "Things Claude gets wrong" become an eval set for the reviewer agents, scored by the existing eval runner, so a change to `code-reviewer` or `reviewer` shows whether it still catches the defects this repo has shipped.
A few clean PRs measure noise.

## Assumptions

Confirmed on 2026-11-07:

1. ADR-0009 defines three eval tiers; this set is a paid behavioral tier run only when asked.
2. `tests/run-evals.mjs` and `tests/behavioral.mjs` take a plugin or skill and a case file; the reviewer agents can be driven through `/review` on a fixed range.
3. The eight "Things Claude gets wrong" entries each name a fixing commit or PR in `CLAUDE.md`.

## Requirements

### Functional

- R1. `tests/cases/reviewer-bugs.json` holds one case per entry in "Things Claude gets wrong": the parent of the fixing commit as `range`, the plugin, the expected finding class and the file the finding must cite (intent: "reviewer evals from the commits behind Things Claude gets wrong").
- R2. Three cases are clean: a merged docs-only PR, a merged version-bump PR and a merged test-only PR, expecting zero Important findings.
- R3. `node tests/behavioral.mjs reviewer-bugs --baseline` runs the pro-quality `code-reviewer` and the pro-ai-sdlc `reviewer` over each range and writes a report under `.research/` with per-case hit, miss or noise.
- R4. The score is `caught / 8` and `noise / 3`; the report fails when caught drops below the recorded baseline or noise rises above it.
- R5. `docs/evals.md` names the set, its cost and the rule that it runs before a PR that changes either reviewer agent, when the person says yes.

### Non-functional

- N1. One run costs under $5 at Opus prices, stated in `docs/evals.md`.
- N2. Case files hold shas and paths only, no diff text, so the set stays small.

### Policy constraints applied

- Live evals are manual: R5 makes the run an offer, never a gate.
- REVIEW.md pass 2: `.research/` never enters a commit; the report lands there.
- No personal names or quotes in case descriptions.

### Boundaries

Always: add a case when a new entry joins "Things Claude gets wrong".
Ask first: running the set.
Never: run it in CI, commit a report.

## Design

### System

- `tests/cases/reviewer-bugs.json`, a `reviewer-bugs` mode in `tests/behavioral.mjs` (or a sibling `tests/reviewer-evals.mjs` if the behavioral runner's shape does not fit), a baseline file beside the cases.
- `CLAUDE.md`: one line under "Things Claude gets wrong" pointing at the set.

### Alternatives considered

- Hand-written synthetic bugs: the real commits are what the reviewer actually missed.

## Flagged concerns

ADR needed: no, ADR-0009 already places paid evals.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| None found | sources: `CLAUDE.md`, `docs/evals.md`, ADR-0009, `REVIEW.md` | | |

## Open questions

- None.

## Acceptance criteria

- AC1. The case file validates in `node tests/check.mjs` (shas resolve, files exist at the parent commit).
- AC2. One paid run on the maintainer's yes produces a report with eight bug cases and three clean cases scored; a baseline file is committed from it.
- AC3. `docs/evals.md` names the command and the cost.

## Out of scope

- Running it in CI.
- Evals for the security or test-engineer agents.
