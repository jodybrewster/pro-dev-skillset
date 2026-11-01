---
intent: intent/2026-10-29-code-reviewer/intent.md
intent-status: draft
status: accepted
created: 2026-10-29T19:30:00-0400
author: the maintainer
---

# Spec: a detailed code-reviewer agent

Built from `intent.md` in this folder (not yet committed).
Status: accepted.
Policies and skills consulted: `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, ADRs 0001 to 0009 in `docs/decisions/` (0001, 0002, 0004 and 0006 bear on this change), `docs/codex-parity.md`, `docs/licenses.md`, `tests/check.mjs` (the `agents` check at line 682 and the coverage checks), `tests/cases/components-uncovered.json`, `plugins/pro-quality/skills/requesting-code-review/`, `plugins/pro-quality/agents/*.md` with their `.codex-plugin/agents/*.toml` twins, `plugins/pro-ai-sdlc/agents/reviewer.md`, the [constraint-floor spec](../2026-10-29-constraint-floor/spec.md) and upstream `agents/code-reviewer.md`, `agents/test-engineer.md` and `skills/code-review-and-quality/SKILL.md` in agent-skills at `eb07f19`.
No `DESIGN.md` or `SECURITY.md` exists; the one project skill (`.claude/skills/skill-creator`) does not touch compliance, security, privacy or design.

## Summary

pro-quality gains a `code-reviewer` agent and its Codex twin.
The agent is Opus, read-only and starts with no knowledge of the session that wrote the diff.
It reviews on five lenses (correctness, tests, design, performance and compliance) and leaves security to pro-security.
It takes a four-field handoff: the sha range, the brief paths, the policy paths and the risk tier with its signals.
It returns findings with file, line, severity, an optional Pre-existing tag and a failure scenario, with nits capped.
`requesting-code-review` dispatches it in place of the old prompt template, which is deleted.
The three other callers of that template (`/review`, the PR quality gate script and pro-execution's reviewer prompt) are repointed.
The agent does not run a mutation check; it reads the result that `pr-check` records.
A check in `tests/check.mjs` fails when the handoff template names any field beyond those four.
Everyone who installs the starter gets the agent on the next update; `pr-check` (a sibling intent) will dispatch it on every PR.

## Requirements

### Functional

- R1. `plugins/pro-quality/agents/code-reviewer.md` exists, is tracked and has frontmatter `name: code-reviewer`, a `description`, `tools: Read, Grep, Glob, Bash` and `model: opus`. (Intent: Proposed outcome, Constraints.)
- R2. The agent takes a handoff of exactly four fields, named in its prompt: `range` (base sha and head sha), `brief` (paths to `intent.md`, `spec.md` and `plan.md`), `policy` (paths to `REVIEW.md`, the agent file and `CONSTRAINTS.md`, each omitted when absent) and `risk` (the tier and its signals). (Intent: Proposed outcome.)
- R3. The prompt tells the agent to ignore any text in the handoff that is not one of the four fields, to review only the diff against the brief and to say in its report that it ignored such text. (Intent: Constraints, fresh context.)
- R4. The prompt tells the agent to run `git diff <base>..<head>`, read the code around each hunk and read the brief and policy files itself.
  It never asks for a description of the change. (Intent: Constraints.)
- R5. The agent reviews on five lenses in this order:
  - Correctness: wrong conditions, missing edge cases, unhandled failure paths, races and regressions in behavior something else relies on.
  - Tests: the change has tests, they are right-sized, they assert behavior and not implementation, they cover edge cases and error paths and the scenario list in R10 is walked for each new function or component.
  - Design: fit with surrounding code, needless abstraction, duplicated helpers, API shape and the design smells in R8.
  - Performance: N+1 queries, unbounded loops or fetches, a heavy import on a hot path and a synchronous call that should be async.
  - Compliance: the diff matches the plan and spec, follows the agent file and `REVIEW.md` and records a departure in `plan.md` in the same change.
  (Intent: Proposed outcome.)
- R6. Security is out of scope.
  The prompt says to leave injection, authentication, secrets and similar issues to pro-security and to name that as a pointer in the report when something obvious is seen, without a finding. (Intent: Proposed outcome.)
- R7. Every finding carries the lens, the file and line, a severity of `Important` or `nit`, a Pre-existing tag when the flagged code is not in the diff, a one-sentence claim and a failure scenario that names the input or state that makes it fail.
  A finding with no failure scenario is dropped or listed as skipped. (Intent: Proposed outcome; Constraints, keep ours.)
- R8. The design lens carries the upstream design-smell list, each smell a design finding and not a nit:
  - a conditional bolted onto an unrelated flow;
  - repeated conditionals on the same shape;
  - a refactor that relocates complexity without reducing the concepts a reader must hold;
  - feature logic placed in a shared module;
  - gratuitous `any` or casts.
  (Intent: Proposed outcome, adapted text.)
- R9. The agent does not run a mutation check, because it is read-only and a fresh worktree has no installed dependencies to run tests.
  `pr-check` runs the check and records `mutation` in its stamp at `.pro-dev/ship/pr-check.json` (pr-gate spec R29).
  When the dispatcher puts that stamp path in the `risk` field, the tests lens reads `mutation` from it and treats `survived` as an Important finding that names the missing test case.
  With no stamp path or no `mutation` value, the report lists "mutation check: not run" under skipped.
  The handoff stays at four fields. (Intent: Proposed outcome, adapted text; flagged concern 2.)
- R10. The tests lens carries the upstream scenario list as a checklist for each new function or component: happy path, empty input, boundary values, error paths and concurrency, plus the rules that tests assert behavior, that a test which never fails is useless and that snapshot tests are suspect unless every change to the snapshot is reviewed. (Intent: Proposed outcome, adapted text.)
- R11. The agent carries the upstream presumptive blockers: a refactor that relocates complexity, a file pushed past a healthy size with no decomposition, feature logic added to a shared module, a near-duplicate of an existing canonical helper and a silent fallback that hides an unclear invariant.
  Each is reported as Important only when the change makes the structure worse, otherwise as a nit with the simpler design named. (Intent: Proposed outcome, adapted text.)
- R12. Severity follows `REVIEW.md` when it defines the Important bar; without one, Important means broken behavior, a breached policy or a missing test for new behavior; everything else is a nit.
  The nit cap is the number in `REVIEW.md`; without one it is five. (Intent: Constraints, REVIEW.md.)
- R13. The report opens with the tally line (amended 2026-10-30 to match review-policy, which shipped the summary line first) `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>`, so a caller can parse it; the format matches `pro-ai-sdlc:reviewer` where they overlap. (Intent: Success looks like, stable format.)
- R14. Pre-existing findings are listed after the others, count in the tally and never count toward the nit cap.
  What blocks a merge is set by `review-policy`; this agent only applies the tag. (Intent: Out of scope.)
- R15. The agent never edits the working tree, commits, pushes, approves or comments.
  It never invokes another agent.
  Bash is for `git diff`, `git log`, `git show` and `git merge-base` only. (Intent: Constraints.)
- R16. With no `REVIEW.md` in the handoff the agent says so and reviews with the generic lenses. (Intent: Constraints.)
- R17. When `CONSTRAINTS.md` is in the handoff, a diff that loosens it is an Important compliance finding; the agent reads the file and does not edit or interpret its numbered rows beyond that. (Intent: Constraints; constraint-floor spec R18.)
- R18. `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` exists with `name = "code-reviewer"`, a `description`, a `developer_instructions` body that carries R2 to R17 in harness-neutral prose and `sandbox_mode = "read-only"`, following the format of `technical-writer.toml`. (Intent: Proposed outcome, Codex twin.)
- R19. `plugins/pro-quality/skills/requesting-code-review/SKILL.md` dispatches `pro-quality:code-reviewer` (or a fresh agent run under Codex) with the handoff in `handoff.md` and no other text.
  The `{DESCRIPTION}` and `{PLAN_OR_REQUIREMENTS}` placeholders are gone from the skill. (Intent: Proposed outcome.)
- R20. `plugins/pro-quality/skills/requesting-code-review/code-reviewer.md` is deleted.
  Nothing in the repo references it. (Intent: Success looks like.)
- R21. `plugins/pro-quality/skills/requesting-code-review/handoff.md` is the single handoff template, with the four fields of R2 and one line per field saying what goes in it and what never does (an author description, a PR body, a session summary or earlier findings). (Intent: Constraints.)
- R22. `tests/check.mjs` gains a contract check, `handoff`, that reads `handoff.md` and fails when its field list is not exactly `range`, `brief`, `policy` and `risk`, when it contains a placeholder named `description`, `summary` or `findings`, or when `code-reviewer.md` does not name the same four fields.
  The check covers any other handoff template under `plugins/*/` whose file name is `handoff.md`. (Intent: Proposed outcome, the check.)
- R23. The agent body and the Codex twin end with the upstream footer, "Adapted from agent-skills (MIT)", with the file names it draws on. (Intent: Constraints.)
- R24. `plugins/pro-quality/commands/review.md` dispatches through `requesting-code-review` with the four handoff fields and acts on Important findings; it no longer says to fill `code-reviewer.md` placeholders or names Critical and Minor. (Found while planning.)
- R25. `plugins/pro-quality/scripts/pr-quality-gate.py` stops pointing at the deleted template and stops injecting the PR title and body as `DESCRIPTION`, which breaks fresh context.
  `pr-gate` deletes this script, so the minimal edit here (recommended) replaces the template lines with the four fields built from the shas the script already computes and keeps the `PR quality gate` heading and the check lines that `tests/quality-hooks.mjs` reads.
  If `pr-gate` merges first the edit is dropped. (Found while planning.)
- R26. `plugins/pro-execution/skills/subagent-driven-development/code-quality-reviewer-prompt.md` points at the handoff fields in place of the deleted template and drops the `DESCRIPTION` line.
  pro-execution goes from 0.6.0 to 0.6.1 in both manifests and its marketplace entry (read from the manifests on 2026-10-29). (Found while planning.)

### Non-functional

- N1. Nothing in the agent runs a network call or sends the diff anywhere; it reads local files and runs local git and the project's own test command.
- N2. The agent file stays under 250 lines so a reviewer can read the whole prompt.
  An agent cannot load sidecar files, so the prompt keeps to short lists and leaves detail out. (Intent: Constraints.)
- N3. A review of a diff of 500 changed lines ends with a report and does not stall on a missing mutation result; the report lists "mutation check: not run" instead.
- N4. The prose of the agent, the twin and `handoff.md` follows the repo's writing rules: one sentence per line, no em dashes and straight quotes.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-quality goes up one minor in both manifests and its marketplace entry, with `metadata.version` bumped once, in the same commit (flagged concern 6).
  pro-execution goes up one patch (0.6.0 to 0.6.1) in both manifests and its marketplace entry in the same commit, because R26 edits a file under it.
- Hook-loading law (ADR-0003): no hook is added, so `hooks/hooks.json` does not change.
- Codex parity (ADR-0004, `docs/codex-parity.md`): R18 adds the `.toml`; the skill edit stays harness-neutral and names the Codex fallback for the dispatch; the `.codex-plugin/plugin.json` version moves with the Claude one.
- CLAUDE.md model split: R1 declares `model: opus` for a reviewer.
- REVIEW.md pass 3 and `docs/licenses.md`: the agent adapts agent-skills text, so `docs/licenses.md` gains a pro-quality row for `code-reviewer` (agent) naming agent-skills as adapted, `plugins/pro-quality/LICENSE` gains "Copyright (c) 2025 Addy Osmani" and the agent ends with the footer (R23).
- REVIEW.md pass 1: no broken sidecar reference, which R20, R24 to R26 and AC8 check after the template is deleted.
- Test coverage rules in `tests/`: pro-quality is not in `WORKFLOW_PLUGINS`, so `tests/cases/components-uncovered.json` needs no entry; the `agents` check only warns when an agent has no routing case, so the spec adds one case to keep the warning count flat (AC9).
- ADR-0006 and the engine registry: the agent is not a bridge skill, so `plugins/pro-core/registry/engines.json` needs no row.
- CLAUDE.md: no home-directory path in the agent, the twin, the skill or the docs.

## Design

### User experience

A person or a command asks for a review through `requesting-code-review`.
The skill gets the two shas, finds the brief and the policy files, fills `handoff.md` and dispatches the agent with that text and nothing else.
The report comes back in this shape:

```
code-reviewer: 2 important, 3 nits, 1 pre-existing
Ignored from the handoff: none

Important
- [tests] src/pay.ts:88 - the new `if (refund > balance)` branch is not exercised.
  Failure scenario: flipping it to `>=` leaves all 41 tests green, so an off-by-one on a full refund ships.
  Missing case: refund equal to balance.

Nits
- [design] src/pay.ts:120 - helper `formatMoney` duplicates `lib/money.ts:14`.
  Failure scenario: a rounding fix lands in one copy and not the other.

Pre-existing
- [correctness] src/ledger.ts:9 - ...

important: 2  nits: 3  pre-existing: 1  skipped: 1
Skipped: mutation check: not run (no pr-check stamp in the handoff)
```

The skill tells the author to fix Important findings before merge and to push back on a finding with reasoning when it is wrong.
The old Critical, Important and Minor ladder goes; two severities remain.

### System

New in pro-quality: `agents/code-reviewer.md`, `.codex-plugin/agents/code-reviewer.toml` and `skills/requesting-code-review/handoff.md`.
Changed in pro-quality: `skills/requesting-code-review/SKILL.md`, `commands/review.md`, `scripts/pr-quality-gate.py`, `LICENSE` and both manifests.
Changed in pro-execution: `skills/subagent-driven-development/code-quality-reviewer-prompt.md` and both manifests (patch bump).
Deleted: `skills/requesting-code-review/code-reviewer.md`.
Changed at the root: `.claude-plugin/marketplace.json` (pro-quality and pro-execution entries), `docs/licenses.md`, `tests/check.mjs` (the `handoff` check), `tests/cases/routing.jsonl` (one case that expects the skill or the agent) and `README.md` where pro-quality's agents are listed.

Reuse: the agent frontmatter and Bash restriction follow `pro-ai-sdlc:reviewer`; the twin follows `technical-writer.toml`; the report tally copies the reviewer's line and adds `pre-existing`; the failure-scenario rule is the reviewer's rule 2; the `agents` check already verifies name and file agreement and the Codex twin.
Plugins install separately, so nothing is imported from pro-ai-sdlc.

The agent holds only generic lenses.
Project laws, the Important bar, the nit cap and the do-not-report list are read from `REVIEW.md` at review time.
The handoff has no field for prior findings: a re-run with later commits passes the same four fields with a new base sha.
Any repeated-finding rule is the caller's job (flagged concern 3).

### Alternatives considered

- Keep the template and add an agent beside it: two sources of review text drift.
  The template's `{DESCRIPTION}` field keeps breaking the fresh-context rule.
- Fork the upstream agent whole: it mixes security into the same pass, uses four severities, has no failure-scenario rule and ends with a Composition block we drop; adapting the five-lens frame and three lists keeps what is ours.
- Pass a description "for orientation": that is the leak the maintainer ruled out.
- `claude -p` as the only dispatch: strongest isolation but no progress in the session; the agent file works under either, so the choice stays with `pr-gate`.
- Let the reviewer fix what it finds: reviewers that edit stop being fresh eyes and approve their own work.
- Fold the tests lens into a separate `test-engineer` agent now: two more dispatches per PR for the same diff; the specialist agents intent keeps that question.

## Flagged concerns

Sources read: the policies listed at the top.

ADR needed: yes, the four-field fresh-context handoff becomes a contract every reviewer in the marketplace follows and `tests/check.mjs` enforces.
`REVIEW.md` also becomes the only source of project review rules; to be drafted; number assigned when written.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | `pr-gate` owns pr-check's handoff while this spec owns the contract check on it, so two templates could diverge. | `pr-gate` intent | resolved: one shared `handoff.md` in this skill that pr-check references and the check reads |
| 2 | The mutation check edits a file and runs tests, while the agent is read-only (no Edit tool, no `sed` or patch under R15) and a fresh worktree has no `node_modules`. | `pro-ai-sdlc:reviewer` convention | resolved: the check moves to `pr-check` (pr-gate spec R29) and the agent reads the result (R9); no throwaway worktree |
| 3 | Convergence wants no finding raised twice, but fresh context bars earlier findings from the handoff. | `review-policy` intent | open: the caller filters repeats after the reviewer returns and uses a new base sha to limit a re-run to new commits (recommended), or add a fifth handoff field, which breaks the rule |
| 4 | `pro-ai-sdlc:reviewer` and this agent both run a compliance pass, so a PR that goes through `/review` and `pr-check` is checked twice. | roadmap, "Deltas" | open: keep both, since `/review` is the SDLC policy gate and this is the gate's reviewer (recommended), or point `/review` at this agent later |
| 5 | The brainstorm says Opus at high effort while `CLAUDE.md` says medium, high only for a review pass. | CLAUDE.md model split | resolved: high, as a review pass, set by the dispatcher because agent frontmatter holds the model and not the effort |
| 6 | constraint-floor, review-policy, risk-tiers and pr-gate each bump pro-quality, so the version numbers collide. | ADR-0002 | open: pick the next minor over main when this change is built and stack the PRs (recommended) instead of fixing 0.13.0 now |
| 7 | The agent reads `CONSTRAINTS.md` but constraint-floor wires only the `pro-ai-sdlc` reviewer to it. | constraint-floor spec R18 | resolved: both read the file as a policy path; this agent adds no interpretation of its rows beyond R17 |
| 8 | Deleting `code-reviewer.md` removes a forked sidecar of an obra/superpowers skill; the skill's footer and licenses row stay. | `docs/licenses.md` | resolved: the skill keeps its footer and its row while the new agent gets its own row |
| 9 | Three more callers of the deleted template (R24 to R26) were missing from the first draft. `pr-quality-gate.py` is deleted by `pr-gate`. | AC8; ADR-0002 | resolved: minimal edit to the script now (R25) and pro-execution takes a patch bump |

## Open questions

1. Subagent or `claude -p`: answered, the subagent now (R19), with the choice left open for `pr-gate`.
2. Effort: answered, high as a review pass, set by the dispatcher (flagged concern 5).
3. Mutation check in a read-only agent: answered, it moves to `pr-check` and the agent reads the result (R9, flagged concern 2).
4. Change-size bands and "a refactor and a feature are two PRs": answered, left out.
5. `test-engineer` as its own agent: answered, not here; the specialist agents intent keeps it.
6. Likely needs an ADR: answered, yes.

Changed on 2026-10-29 after planning: the mutation check moves from this agent to pr-check and three more callers of the deleted template are repointed (R24 to R26).

## Acceptance criteria

- AC1. `node tests/check.mjs`, `node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70`, `node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC2. `plugins/pro-quality/agents/code-reviewer.md` and `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` are listed by `git ls-files` and the `agents` check reports no Codex-twin warning for `code-reviewer`.
- AC3. The agent frontmatter has `model: opus` and its prompt contains the five lens names, the words "Important" and "nit", the Pre-existing tag, the failure-scenario rule plus a sentence that security is out of scope.
- AC4. Adding a `description` field to `handoff.md` makes `node tests/check.mjs` fail with the `handoff` check; removing it makes it pass; removing a field makes it fail.
- AC5. `grep -rn "DESCRIPTION" plugins/pro-quality` prints nothing and `git ls-files plugins/pro-quality/skills/requesting-code-review` lists `SKILL.md` and `handoff.md` only.
- AC6. The agent prompt lists all five design smells of R8, the mutation-result handling of R9, the five scenarios of R10 and the five presumptive blockers of R11.
- AC7. On a throwaway diff that adds a branch no test exercises, a dispatch of the agent with the four fields returns an Important tests-lens finding with a file, a line and a failure scenario plus a report whose first line matches the R13 tally; run once by hand and pasted into the PR.
- AC8. `grep -rn "code-reviewer.md" plugins docs README.md` finds no reference to the deleted template.
- AC9. `tests/cases/routing.jsonl` has a case for "review my branch" that expects `requesting-code-review` and the warning count from `node tests/check.mjs` does not rise.
- AC10. `docs/licenses.md` has a pro-quality row for `code-reviewer` (agent) naming agent-skills as adapted, `plugins/pro-quality/LICENSE` carries the agent-skills copyright line and the agent and twin end with the footer.
- AC11. pro-quality's version is equal in `plugins/pro-quality/.claude-plugin/plugin.json`, `plugins/pro-quality/.codex-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry, with `metadata.version` is bumped once.
- AC12. `plugins/pro-quality/commands/review.md`, `plugins/pro-quality/scripts/pr-quality-gate.py` and `plugins/pro-execution/skills/subagent-driven-development/code-quality-reviewer-prompt.md` contain no `code-reviewer.md` and no `DESCRIPTION`.
  `node tests/quality-hooks.mjs` passes.
- AC13. pro-execution's version is 0.6.1 in both manifests and its marketplace entry (or the next patch over `main` at build time).
- AC14. The agent prompt says it does not run a mutation check, reads `mutation` from the stamp when the `risk` field names one and otherwise reports "mutation check: not run"; the frontmatter `tools` line has no Edit.

## Out of scope

The `REVIEW.md` template upgrade and the convergence rules (`review-policy`).
`pr-check`, the stamp and the PR gate (`pr-gate`).
The risk classifier (`risk-tiers`).
Codex as a second reviewer run in parallel, reviewer evals from past bugs and the skeptic pass.
Changing `pro-ai-sdlc:reviewer`.
The other specialist agents.
Change-size bands.
Writing or changing `CONSTRAINTS.md`.
