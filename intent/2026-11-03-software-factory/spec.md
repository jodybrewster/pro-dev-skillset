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
Level 1 intents run headless in a container on a fresh clone: the session proposes (a short spec and plan, then the build through the existing `/execute` and `/review`, each as a pull request) and the runner on the host decides, merging only after its own checks and only when `risk-classify.py` reads low.
Levels 2 and 3 run the loop as today, with the gates owned by named roles from a `## Roles` block in `REVIEW.md`.
Deploy stays a person's step.
Mieruka reads the same files and records and gains a human roles setting.
The design detail, with path and line references, is the factory plan in `design.md` beside this spec.

## Assumptions

- pro-ship's `risk-classify.py` and `merge-gate.py` behave as ADR-0015 describes; `risk-classify.py` gains one `policy-files` signal (R19).
- `claude -p` supports `--max-budget-usd`, `--disallowedTools` and `--setting-sources` (checked on 2.1.317).
- Docker is available where the factory runs.
- The maintainer's git `user.name` fills every role in a solo repo.

## Requirements

### Functional

- R1 The intent template has a `level: 1 | 2 | 3` frontmatter field.
- R2 `factory.py level <intent dir>` prints the level and its reasons from the intent's `source`, `author`, `risk`, stop-list words and new-dependency words, reading the intent and `REVIEW.md` from the default branch tip, with exit 0 unchanged, 3 raised and 2 could not run; could not run means no run.
- R3 A level is only ever raised: the level is the highest of the computed level and every value the field has had on the default branch; mieruka asks `factory.py` instead of reading the field.
- R4 Level 1 needs: `source` of `idea` or `incident <id>`, `author` listed under `product_owner` or `engineer` in the role map, `risk: low`, no stop-list category (auth, migrations, payments, deploys, secrets, env vars), no new dependency.
- R5 `REVIEW.md` holds a `## Roles` block with `product_owner`, `engineer`, `lead`, `policy_owner` and `platform_owner`, each a list of names; the REVIEW.md template ships it and `/pro-dev install` fills it with the git user in every role.
- R6 `/intent` runs `factory.py level` and writes the result; `/spec` and `/plan` rerun it and commit a raise with their file.
- R7 `factory.py next --repo` names the oldest accepted level 1 intent on the default branch with no `spec.md`, no factory record and an accepting commit without a `Factory-Run:` trailer; folder names must match `^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$`; a daily run cap and a daily dollar cap stop it.
- R8 `factory.py run` takes a lock and runs each session with `claude -p` in a Docker container on a fresh clone with its own plugin install, `CLAUDE_GUARD_MODE=enforce`, `--max-budget-usd`, `--disallowedTools` for network, release and nested-agent tools and argv-only spawns; the runner, not the session, writes every record.
- R9 `/pro-ai-sdlc:auto brief` writes spec and plan with no flagged concern and no stop-list category and opens one PR; `/pro-ai-sdlc:auto build` runs `/execute` and `/review` and leaves the build PR open. The session never merges.
- R9a The runner merges the brief PR only when its diff is exactly the intent's own `spec.md` and `plan.md` with `Status: approved`, `Stop-list categories: none` and the factory approver line.
- R9b The runner merges the build PR only when: PR checks pass; `risk-classify.py` on the head it fetched reads low with no `surface-unavailable` note (pro-security required); no test file changed after the commit that added it and no test config changed; no `floor-allow:` line in the range; no path under the policy list. It merges with `--match-head-commit` and reads the result from `gh pr view`. Anything else raises the level and stops.
- R10 `/auto` never merges, deploys, tags, publishes, pushes to the default branch, edits `REVIEW.md` or `.claude/`, lowers a level, acts on PR comments or passes `--no-verify`; `/execute` treats an `Approver:` that starts with `factory` as no consent for a stop-list step.
- R11 `/execute` appends each step's committed test files to `.claude/test-lock`; `protect-tests.py` flags an edit to a listed file whenever that marker exists, not only in fix mode.
- R12 The production gate is unchanged: the session never merges, the runner merges outside any Claude session.
- R13 The factory run record is a mieruka manifest (`kind` doc, `artifact_kind` factory-run) written under `.pro-dev/factory/` and dropped into `.mieruka/evidence/` by the existing rule; `docs/loop-records.md` defines it and `tests/mieruka-sync.mjs` loads it.
- R14 `tests/e2e-sdlc.mjs` builds a fixture repo with a throwaway private GitHub origin created and deleted on the host (explicit `sdlc-e2e-<stamp>` name, stale ones older than a day removed at start; `--local` uses a bare remote and stops at the open PR), installs pro-core, pro-ai-sdlc, pro-ship, pro-quality and pro-security at the ref under test and runs three scenarios with a role driver: (1) a product owner feature at level 1, (2) an engineer bug at level 1 with the test lock, (3) a level 3 data export through policy owner, product owner, engineer and lead gates, a deploy by tag and an incident that writes a fourth intent.
- R15 The e2e checks are deterministic and live in one module that mieruka's twin imports.
- R16 `docs/factory.md` is a step-by-step guide with a validation after every step; `docs/factory-demo.md` is a demo script with expected output.
- R17 Mieruka: a human roles schema in `packages/core`, a People section in Settings that shows and edits the `## Roles` block in the working tree (it takes effect only once a person merges it, since the factory reads the default branch) behind a same-origin check, the identity, gate routes that refuse an identity outside the gate's role, a level badge, a factory run state on the card, a trigger that starts `factory.py run` for an accepted level 1 intent and `--match-head-commit` on its merge.
- R18 Mieruka's e2e twin runs the same three scenarios through its routes and passes the same checks.
- R19 pro-ship's `risk-classify.py` gains a high `policy-files` signal for `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, `CONSTRAINTS.md`, `.claude/**`, `.pro-dev/**` and `intent/` outside the change's own intent folder, Markdown included.
- R20 The container gets a GitHub token scoped to the one repo (`FACTORY_GH_TOKEN`); the maintainer's own token is used only with `--allow-broad-token`, which the record notes.
- R21 The record of a merged level 1 run says `deploy is yours, unread diff: <n> lines`.

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
| 4 | Gates inside the session can be rewritten or retried past by the session | security-architect challenge | the runner on the host makes every merge decision from state it fetched itself; the session runs in a container on a fresh clone |
| 5 | The e2e creates GitHub repos with the maintainer's token | the maintainer | private, `sdlc-e2e-` prefix, deleted in `finally`, on demand only |

Mieruka's gate refusal by role is routing, not authorization, on a local single-user server; the merge buttons stay behind a same-origin check.

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
