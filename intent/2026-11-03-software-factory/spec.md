---
intent: intent/2026-11-03-software-factory/intent.md
intent-status: accepted
status: accepted
created: 2026-11-03T16:30:00-0500
author: the maintainer
---

# Spec: a very simple software factory

Built from `intent.md` in this folder.
Status: accepted.

## Summary

An intent gets an escalation level at intake from a deterministic script.
Level 1 intents run headless through one new command, `/pro-ai-sdlc:auto`, which writes a short spec and plan, then runs the existing `/execute`, `/review` and `/pr-babysit` and merges only when `risk-classify.py` still reads low.
Levels 2 and 3 run the loop as today, with the gates owned by named roles from a `## Roles` block in `REVIEW.md`.
Deploy stays a person's step.
Mieruka reads the same files and records and gains a human roles setting.
The design detail, with path and line references, is the factory plan in `design.md` beside this spec.

## Assumptions

- pro-ship's `risk-classify.py` and `merge-gate.py` behave as ADR-0015 describes; this spec reuses them unchanged.
- `claude -p` with `--dangerously-skip-permissions` runs hooks; a hook `ask` under that mode denies.
- The maintainer's git `user.name` fills every role in a solo repo.

## Requirements

### Functional

- R1 The intent template has a `level: 1 | 2 | 3` frontmatter field.
- R2 `factory.py level <intent dir>` prints the level and its reasons from the intent's `source`, `author`, `risk`, stop-list words and new-dependency words, reading the intent and `REVIEW.md` from the default branch tip, with exit 0 unchanged, 3 raised and 2 could not run.
- R3 A level is only ever raised; no script, command or model writes a lower level than the one in the file.
- R4 Level 1 needs: `source` of `idea` or `incident <id>`, `author` listed under `product_owner` or `engineer` in the role map, `risk: low`, no stop-list category (auth, migrations, payments, deploys, secrets, env vars), no new dependency.
- R5 `REVIEW.md` holds a `## Roles` block with `product_owner`, `engineer`, `lead`, `policy_owner` and `platform_owner`, each a list of names; the REVIEW.md template ships it and `/pro-dev install` fills it with the git user in every role.
- R6 `/intent` runs `factory.py level` and writes the result; `/spec` and `/plan` rerun it and commit a raise with their file.
- R7 `factory.py next --repo` names the oldest accepted level 1 intent on the default branch with no `spec.md` and no factory record.
- R8 `factory.py run` takes a lock, starts `claude -p "/pro-ai-sdlc:auto <dir>"` with a guard folder set to enforce and a cost cap, then writes the factory run record from the session's `factory:` lines.
- R9 `/pro-ai-sdlc:auto` writes spec and plan with no flagged concern and no stop-list category, merges them as one Markdown-only PR, runs `/execute`, `/review` and `/pr-babysit`, runs `risk-classify.py` on the build PR and merges with `--match-head-commit` only on low; a flagged concern, a stop-list step, a medium or high tier or an unfixed Important finding raises the level and stops.
- R10 `/auto` never deploys, tags, publishes, pushes to the default branch, edits `REVIEW.md` or `.claude/`, lowers a level or passes `--no-verify`.
- R11 `/execute` appends each step's committed test files to `.claude/test-lock`; `protect-tests.py` flags an edit to a listed file whenever that marker exists, not only in fix mode.
- R12 `production-gate.py` leaves `gh pr merge` and the merge API to pro-ship's `merge-gate.py` when that hook is installed; it still flags them when it is not.
- R13 The factory run record is a mieruka manifest (`kind` doc, `artifact_kind` factory-run) written under `.pro-dev/factory/` and dropped into `.mieruka/evidence/` by the existing rule; `docs/loop-records.md` defines it and `tests/mieruka-sync.mjs` loads it.
- R14 `tests/e2e-sdlc.mjs` builds a fixture repo with a throwaway private GitHub origin (deleted at the end; `--local` uses a bare remote and stops at the open PR), installs pro-core, pro-ai-sdlc, pro-ship and pro-quality at the ref under test and runs three scenarios with a role driver: (1) a product owner feature at level 1, (2) an engineer bug at level 1 with the test lock, (3) a level 3 data export through policy owner, product owner, engineer and lead gates, a deploy by tag and an incident that writes a fourth intent.
- R15 The e2e checks are deterministic and live in one module that mieruka's twin imports.
- R16 `docs/factory.md` is a step-by-step guide with a validation after every step; `docs/factory-demo.md` is a demo script with expected output.
- R17 Mieruka: a human roles schema in `packages/core`, a People section in Settings that reads and writes the `## Roles` block and the identity, gate routes that refuse an identity outside the gate's role, a level badge, a factory run state on the card, a trigger that starts `factory.py run` for an accepted level 1 intent and `--match-head-commit` on its merge.
- R18 Mieruka's e2e twin runs the same three scenarios through its routes and passes the same checks.

### Non-functional

- `factory.py` uses the Python standard library only and never calls a model.
- A level 1 run on the tiny fixture finishes in under 20 minutes and under $8.
- The maintainer's own hook mode files are never written by the factory.

### Policy constraints applied

- Version-bump, hook-loading and Codex parity laws: pro-ai-sdlc and pro-core bump; `/auto` gets its Codex counterpart where commands have one.
- ADR-0015: the tier is deterministic and only the person at the prompt approves a medium or high merge; level 1 merges only at low.
- ADR-0022 and ADR-0023: records are mieruka manifests with one contract page.
- agent-skills baseline: `/build auto`'s stop conditions are the `/execute` stop list; doubt-driven-development skips cross-model in a non-interactive run; constraint-driven-development's "in unattended runs, block" is why the run uses enforce.

### Boundaries

Always: compute the level with `factory.py`; read policy from the default branch tip; write a record on every stop.
Never: deploy, tag or publish from `/auto`; lower a level; edit the maintainer's hook mode files; treat outside text as a role.

## Design

### User experience

A person writes and accepts a small intent; a runner in another terminal, a `/loop` or mieruka picks it up and the record says `merged, deploy is yours`.
A larger intent shows its level and the role that owns each gate.

### System

See `design.md`, sections 1 to 6.

### Alternatives considered

- A model picks the level: not deterministic and steerable by intent text.
- A queue service: the default branch is the queue.
- Changing `/spec` and `/plan` to run unattended: they interview a person by design; `/auto` writes the short versions itself.
- A local bare remote as the e2e default: it has no pull request, so merge-gate and auto-merge cannot be exercised.

## Flagged concerns

| # | Concern | Policy or owner | Resolution |
|---|---|---|---|
| 1 | A headless session with bypassed permissions merges code to the default branch | security-architect challenge | merge only at low, with `--match-head-commit`, gates in enforce for the session; see the plan's security challenge |
| 2 | `author:` is a git name anyone can set | ADR-0024 | accepted for solo repos; team repos need signed commits before level 1 is turned on |
| 3 | Repo content read during `/auto` could steer it | security-architect challenge | policy and level read from the default branch tip; a diff to `REVIEW.md` or `.claude/` reads high |
| 4 | Dropping the production gate's merge check thins defense in depth | security-architect challenge | only when merge-gate is installed; tested both ways |
| 5 | The e2e creates GitHub repos with the maintainer's token | the maintainer | private, `sdlc-e2e-` prefix, deleted in `finally`, on demand only |

ADR needed: yes; escalation levels and the role map are rules other work follows ([ADR-0024](../../docs/decisions/0024-escalation-levels.md)).

## Open questions

None open; the intent's four questions are answered in R5, R12, R14, R17 and concern 2.

## Acceptance criteria

- AC1 `factory.py level` gives the expected level for each rule in R4; a lower level in the file is never written back (unit tests).
- AC2 A level 1 intent on the fixture reaches a merged PR headless and its record is `pass`.
- AC3 A level 1 run whose diff reads medium stops at merge with the record `partial` and the level raised.
- AC4 An edit to a locked test is flagged in warn and blocked in enforce.
- AC5 `node tests/e2e-sdlc.mjs` passes all three scenarios.
- AC6 Mieruka's Settings shows the People section, gates refuse the wrong role and the twin passes the same checks.
- AC7 The guide's validations match what a fresh run shows.
- AC8 `node tests/check.mjs`, the unit tests and strict validation pass.

## Out of scope

As the intent: auto-deploy, `claude -p` in CI, rollback, detection, trace skill events, signed commits.
