# Roadmap

What is being built in this marketplace now, what comes next in ranked order and which intents are parked.
Update it whenever an intent starts, moves a stage, parks or ships, in the same commit as that change where possible.
Last updated 2026-10-29 (evening): constraint-floor and the four P0 review-stack intents specced as drafts.

A fresh session starts here: read "Now", then the intent folder it names.
The ranked list came from comparing this marketplace with [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (local clone `../agent-skills`, commit `eb07f19`, release 0.6.14) and from the [pro-ship brainstorm](../intent/2026-10-28-pro-ship-scope/brainstorm.md) of 2026-10-28, plus the [specialist agents intent](../intent/2026-10-28-specialist-agents/intent.md).
It revisits the older [AGENT-SKILLS-INTEGRATION](./plans/AGENT-SKILLS-INTEGRATION.md) plan, which skipped most of agent-skills before the pro-ship work existed.
Nothing below the "Now" section is decided until it moves into an intent or a spec.

## Now

### constraint-floor (ranked item 1)

Folder: [intent/2026-10-29-constraint-floor/](../intent/2026-10-29-constraint-floor/).

- Intent: written and committed (`8b78aa3`), status draft.
- Spec: [spec.md](../intent/2026-10-29-constraint-floor/spec.md) with 18 functional and 4 non-functional requirements and 9 acceptance criteria, committed with ADR-0010 (`b23f41c`).
- ADR: [ADR-0010](./decisions/0010-constraint-floor.md), status proposed; it moves to accepted at the plan's Done sign-off.
  Jody saw no reason he would remove the floor, so it records a revisit trigger instead: findings that mostly get waved through with `floor-allow:` mean a rule is too broad.
- Flagged concerns 1-4 resolved on 2026-10-29 with the recommendations: copy the mode lookup into pro-quality; accept pro-quality's mixed hook behavior for now; enforce mode denies every retry; the verifier reading `CONSTRAINTS.md` is a follow-up change.
- Plan: [plan.md](../intent/2026-10-29-constraint-floor/plan.md), 18 steps in four parallel tracks plus a serial tail; approved by Jody on 2026-10-30.
  Jody approved on 2026-10-29 three spec changes found while planning: `gh pr create` diffs against `main`, the marker rules skip `.md` files and `AGENTS.md` may be a symlink to `CLAUDE.md`.
- Build: steps 1 to 16 done on [#81](https://github.com/jodybrewster/pro-dev-skillset/pull/81) (pro-quality 0.13.0, pro-ai-sdlc 0.7.0, marketplace 1.60.0); 129 guard cases pass and a mutation run broke each rule, the mode lookup, `floor-allow:` and redaction in turn, each caught by at least one case.
- Steps 17 and 18 done: the `/constraints` trial passed and the review pass found six problems, all fixed test first (152 guard cases).
- Signed off by Jody on 2026-10-30 and merged in #81. AC9 (a week of warn-mode use in two repos) gates the later switch to enforce mode.

Decisions already made for constraint-floor (2026-10-29): the hook is Python, not Rust or bash; it lives in pro-quality; it starts in warn mode; out of scope are installing semgrep, osv-scanner, Lighthouse or axe, running it in CI, enforce mode and writing `CONSTRAINTS.md` into other repos.

### The P0 review stack (ranked items 2-6)

Jody approved on 2026-10-29 splitting the brainstorm's "Intent A" into four intents, drafted from the brainstorm and this roadmap with no interview.
All four intents and specs are committed as drafts.
Each spec says `ADR needed: yes` with the ADR not yet written; each lists its flagged concerns with a recommendation and its open questions.
They replace the dropped [pro-ship-scope intent](../intent/2026-10-28-pro-ship-scope/intent.md); `code-reviewer` moved out of the parked specialist-agents intent.

| Intent | Ranked items | Plugins | Builds on | Spec size |
|---|---|---|---|---|
| [review-policy](../intent/2026-10-29-review-policy/spec.md) | 5, 6 | pro-ai-sdlc | none | shipped in #82 |
| [code-reviewer](../intent/2026-10-29-code-reviewer/spec.md) | 3 | pro-quality | review-policy | shipped in #87 |
| [pr-gate](../intent/2026-10-29-pr-gate/spec.md) | 2 | pro-ship, pro-quality, pro-security | code-reviewer, constraint-floor | shipped in #89 |
| [risk-tiers](../intent/2026-10-29-risk-tiers/spec.md) | 4 | pro-ship | pr-gate | 30 R, 6 N, 12 AC, 12 concerns |

Questions waiting on Jody, with the drafts' recommendations:

- code-reviewer: effort high or medium for the reviewer (recommended high, set by the dispatcher); the mutation check needs to edit and run tests, so it runs only in a throwaway worktree at medium or high risk (recommended); subagent versus `claude -p` (recommended subagent).
- risk-tiers: which plugin owns the classifier (recommended pro-ship); can a tier be overridden down (recommended Jody only, recorded in the stamp, later); the size thresholds (recommended placeholder constants until a calibration run over merged PRs); does `ask` still prompt when permission checks are bypassed (verify live; deny medium and high if not).

Facts the drafts found that change earlier notes:

- pro-quality's `pr-quality-gate.py` fired since 0.11.1 (PR 76), as a `PostToolUse` hook after `gh pr create` succeeded; it ran `npm run lint` and `npm test` and checked the body length; pr-gate replaces it and the script is deleted.
- `/merge-pr` is a user-level command in `~/.claude/commands/merge-pr.md`, not in this repo; risk-tiers adds a merge-gate hook on `gh pr merge` instead of editing it.

Cross-cutting decisions for Jody:

- Five ADRs are pending across the stack: constraint floor (0010), review convergence, the reviewer handoff contract, the shared gate stamp and the tier model.
  Recommended: fold review convergence and the handoff contract into one "review contract" ADR, making four.
- Every spec names a version bump that collides with the others (pro-quality, pro-ai-sdlc, metadata.version); the recommendation in each is to take the next number over main at build time and stack the PRs.
- Build order: constraint-floor and review-policy can run in parallel; then code-reviewer; then pr-gate; then risk-tiers.
- One PR per intent (Jody, 2026-10-29): each intent's PR holds its intent, spec, plan and build, and stays a draft until the build lands.
  constraint-floor [#81](https://github.com/jodybrewster/pro-dev-skillset/pull/81), review-policy [#82](https://github.com/jodybrewster/pro-dev-skillset/pull/82), code-reviewer [#83](https://github.com/jodybrewster/pro-dev-skillset/pull/83), pr-gate [#84](https://github.com/jodybrewster/pro-dev-skillset/pull/84) and risk-tiers [#85](https://github.com/jodybrewster/pro-dev-skillset/pull/85).

review-policy shipped in #82 on 2026-10-30 with ADR-0011: round cap three for every round, the finding count first, no REVIEW.md refresh in `/pro-dev update` (Jody, 2026-10-30).
code-reviewer shipped in #87 on 2026-10-30 with ADR-0012 (the four-field handoff).
pr-gate shipped in #89 on 2026-10-30 with ADR-0014 (the gate stamp); pro-ship joined `pro-dev-starter` in the same release.
Plans: risk-tiers (#88) is approved and builds next.
Jody decided on 2026-10-29 for code-reviewer: effort high set by the dispatcher, subagent dispatch, one shared `handoff.md`; the mutation check moves out of the read-only reviewer into pr-check (pr-gate R29), which records `mutation` in the stamp; callers of the old reviewer template are added (pro-quality `/review` and pro-execution's quality-reviewer prompt; the third, the old PR gate script, is deleted by pr-gate).

## Parked intents

| Intent | Status | Why parked | Comes back when |
|---|---|---|---|
| [2026-10-28-specialist-agents](../intent/2026-10-28-specialist-agents/intent.md) | draft | `code-reviewer` moved to its own intent; the rest is ranked item 18 (P2). | Item 18 starts: the security finder, `web-performance-auditor` and possibly `test-engineer`. |
| [2026-10-28-rename-pro-dev](../intent/2026-10-28-rename-pro-dev/intent.md) | draft | The intent itself says "not for today". | Jody decides to rename the plugins. |
| [2026-10-28-taste-skill-v2](../intent/2026-10-28-taste-skill-v2/intent.md) | draft | Not on the ranked list; nobody has started it. | pro-design is next touched, or the bridge's smoke test fails. |

## Dropped intents

- [2026-10-28-pro-ship-scope](../intent/2026-10-28-pro-ship-scope/intent.md), 2026-10-29: its PR gate part became the four P0 review-stack intents; the brainstorm's Intents B and C get new intents when ranked items 15, 16, 21, 14 and 17 come up.

## Housekeeping

Marked `done` on 2026-10-29 after checking git history: [execute-command](../intent/2026-10-28-execute-command/intent.md) (#63), [plugin-installers](../intent/2026-10-28-plugin-installers/intent.md) (#70) and [pro-speckit](../intent/2026-10-28-pro-speckit/intent.md) (#71).
Still `proposed` because part of each did not ship:

- [pro-dev-setup](../intent/2026-10-28-pro-dev-setup/intent.md): #65 left its item 5 undone (pro-quality's `/review`, `/api-docs` and `/lead-research` still exist).
- [design-vercel-bridges](../intent/2026-10-28-design-vercel-bridges/intent.md): #68 shipped everything except Hallmark, which Jody held.
- [spec-methods](../intent/2026-10-28-spec-methods/intent.md): #66 shipped the EGM hand-off, but #73 made pro-pdd the default against the intent's "pro-ai-sdlc stays the default", and the `/intent` offer was not built.
- [pro-dev-simplify](../intent/2026-10-27-pro-dev-simplify/intent.md): item G has no intent; C and D are partial.

Each needs Jody's call: finish the remainder, or mark it `done` with the remainder dropped.

## How it is ranked

Impact is measured in the project the plugins are dropped into, not in this repo.

- P0: fires on every edit or every PR in every repo that installs the starter; it stops a defect or a runaway loop from shipping.
- P1: improves every feature that goes through the pro-ai-sdlc loop, or closes a safety hole.
- P2: pays off in specific situations, or once there is more than one person or a CI pipeline.
- P3: small polish, cheap to batch into one PR.
- Later: real but not needed at one-person scale.

Effort is S (one file or a template edit), M (a skill, agent or hook with tests) or L (several plugins or a new command with a hook and CI).
Within a tier, items are in the order to build them.

## The ranked list

### P0: every edit and every PR

- [x] 1. Floor guard and `CONSTRAINTS.md` (M, pro-quality): shipped in #81 as [intent/2026-10-29-constraint-floor](../intent/2026-10-29-constraint-floor/intent.md), see [Now](#now)
- [x] 2. The PR gate: `pr-check` and a stamp hook on `gh pr create` (L, pro-ship, pro-quality, pro-security): shipped in #89 from the plan of [pr-gate](../intent/2026-10-29-pr-gate/spec.md), see [Now](#now)
- [x] 3. A detailed `code-reviewer` agent with fresh context (M, pro-quality): shipped in #87 as [code-reviewer](../intent/2026-10-29-code-reviewer/spec.md), see [Now](#now)
- [ ] 4. Risk classifier and approval tiers (M, pro-ship): specced as [risk-tiers](../intent/2026-10-29-risk-tiers/spec.md), see [Now](#now)
- [x] 5. REVIEW.md template upgrade (S, pro-ai-sdlc): shipped in #82 as [review-policy](../intent/2026-10-29-review-policy/spec.md), see [Now](#now)
- [x] 6. Review convergence rules (S, pro-ai-sdlc, pro-ship): shipped in #82 as [review-policy](../intent/2026-10-29-review-policy/spec.md), see [Now](#now)

### P1: every feature through the loop plus safety

- [ ] 7. `/execute` guardrails (S, pro-ai-sdlc)
- [ ] 8. Spec template additions (S, pro-ai-sdlc)
- [ ] 9. Plan template additions and a definition of done (S, pro-ai-sdlc)
- [ ] 10. A test-design lens for the verifier (S, pro-ai-sdlc)
- [ ] 11. Untrusted-input rules for browser and error output (S, pro-testing, pro-execution)
- [ ] 12. Doubt-driven step in `/execute` (M, pro-ai-sdlc)
- [ ] 13. Codex as a second reviewer (M, pro-quality, pro-core)
- [ ] 14. Required documents per project (L, pro-core, pro-ai-sdlc, pro-quality)

### P2: situational, or past one person

- [ ] 15. `/ship` preflight with a go/no-go verdict (M, pro-ship)
- [ ] 16. `pipeline`: the gate as required CI checks (L, pro-ship)
- [ ] 17. Architecture review with twelve-factor (L, pro-quality)
- [ ] 18. Specialist agents: security finder and web-performance auditor (M, pro-security, pro-quality)
- [ ] 19. Source-driven development and a docs cache (M, pro-execution)
- [ ] 20. Installed skills declare runnable checks (M, pro-core, stack plugins)
- [ ] 21. The scaling block and `repo-hygiene` (M, pro-ship)
- [ ] 22. Reviewer evals from past bugs (M, this repo)

### P3: small polish, one batch

- [ ] 23. Re-sync `interview-me` and `idea-refine` (S, pro-pdd)
- [ ] 24. `/adr` convention detection and a Deprecated status (S, pro-ai-sdlc)
- [ ] 25. Two guards in the simplifier (S, pro-ai-sdlc)
- [ ] 26. Debugging addendum (S, pro-execution)
- [ ] 27. An accessibility checklist sidecar (S, pro-design)
- [ ] 28. Two `/fix` tweaks (S, pro-core or user scope)
- [ ] 29. Optional capability map in `/spec` (S, pro-ai-sdlc)

### Later

- [ ] 30. Domain skills: deprecation and migration, observability, API design, performance, context engineering
- [ ] 31. Release, flags, staged rollout, rollback, merge queue, two-person approval, skeptic pass

## How the items group into intents

- Constraints: 1, now its own intent at [intent/2026-10-29-constraint-floor](../intent/2026-10-29-constraint-floor/intent.md).
- Intent A, the PR gate (already planned in the pro-ship brainstorm): 2, 3, 4, 5, 6, then 13.
- The pro-ai-sdlc loop batch: 7, 8, 9, 10, with 24, 25 and 29 riding along. One PR, one version bump.
- Safety batch: 11 with 26 and 27.
- Intent C, docs and architecture (pro-ship brainstorm): 14 and 17.
- Intent B, the rest of pro-ship: 15, 16, 21.
- Specialist agents (intent already drafted): 18, plus 10 if the verifier lens is not enough.
- Single items: 12, 19, 20, 22, 23, 28.

## What's worth doing from agent-skills, by size

This is the agent-skills part of the list on its own, as it was first written on 2026-10-29, with the checklist items it became.

1. The pro-ship preflight (item 15).
   Their `/ship` answers two things the pro-ship brainstorm leaves open: what the preflight says and when the verdict is NO-GO.
   Feed it into that intent while pro-ship is still being scoped.
2. Review and verify (items 3 and 10).
   The design-smell list, the mutation check and the presumed blockers go into REVIEW.md and the reviewer.
   The test case list goes into the verifier.
   These pick up the readability, architecture and test-quality issues our reviewer does not look for today.
3. Plan and spec (items 8 and 9).
   Task sizing, checkpoints, the assumptions block, the boundaries and the definition of done.
   All of these are template edits in pro-ai-sdlc.
4. Small fixes (items 11, 23, 24 and 26).
   Re-sync `interview-me` and `idea-refine`, the Deprecated ADR status, the debugging addendum and the browser security boundaries.

Items 2 and 3 are all pro-ai-sdlc edits and could ship together as one PR with one version bump.
The constraints work and the floor-guard hook (item 1, now [intent/2026-10-29-constraint-floor](../intent/2026-10-29-constraint-floor/intent.md)) are still the bigger gap, since nothing on our side covers them.
The suggested order was constraints first, then the pro-ai-sdlc batch, with the `/ship` findings going into the pro-ship intent now.
The checklist above keeps that order but puts the PR gate (items 2-6) ahead of the pro-ai-sdlc batch, because it fires on every PR.

## Detail

Paths without a prefix are in agent-skills.
"Pro-ship features" means the numbered list under "Features at a glance" in the [pro-ship brainstorm](../intent/2026-10-28-pro-ship-scope/brainstorm.md).

### 1. Floor guard and `CONSTRAINTS.md`

Moved to [intent/2026-10-29-constraint-floor](../intent/2026-10-29-constraint-floor/intent.md) on 2026-10-29.

### 2. The PR gate

What: `/pro-ship:pr-check` runs build, lint, typecheck and unit tests, then the reviewers, then writes a stamp for HEAD.
A `PreToolUse` hook on `gh pr create` only checks the stamp and denies once when it is missing.
It replaces pro-quality's old `PostToolUse` gate on `gh pr create`, which ran after the PR existed and is deleted.
pro-security's push gate accepts the same stamp, so one security review runs per PR.
Why it is P0: today no check runs before a PR in any repo.
Source: pro-ship features 1, 2 and 6, "The pre-PR gate".
Depends on: 3 for the review half; the deterministic half can land first.

### 3. A detailed `code-reviewer` agent

What: an Opus, read-only agent in pro-quality with lenses for correctness, tests, design, performance and compliance, each finding with file and line, a severity and a failure scenario.
It gets only the four-field handoff (base and head sha, brief paths, REVIEW.md and agent file paths, risk tier and its signals) so the author's reasoning cannot leak in.
Add from agent-skills:
- The design-smell list: a conditional bolted onto an unrelated flow, repeated conditionals, a refactor that only moves complexity, feature logic in a shared module, gratuitous `any` or casts (`skills/code-review-and-quality/SKILL.md:41-56`).
- The mutation check: flip one condition in the change and run the tests; a green run is a finding (same file, "Step 2", about line 150).
- The presumptive-blockers list (end of the same file).
- Optional: change-size bands of 100, 300 and 1000 lines; "a refactor and a feature are two PRs".
Keep ours: the failure-scenario rule (theirs lacks it) and our simpler severities.
Why it is P0: our current reviewer checks bugs, security and compliance only, so readability, architecture and test-quality problems pass.
Source: pro-ship features 3 and 4; [specialist agents intent](../intent/2026-10-28-specialist-agents/intent.md); `agents/code-reviewer.md`.

### 4. Risk classifier and approval tiers

What: a deterministic classifier sorts each diff into low, medium or high from paths, security and legal surface, dependency changes, weakened tests, size and the intent's declared risk.
The tier sets review depth and approval: low merges on green, medium and high need Jody, an agent's approval never counts and an approval covers one commit.
Why it is P0: it sets how much of 2 and 3 runs, which keeps the gate cheap on small PRs and strict on risky ones.
Source: pro-ship features 7 and 8.

### 5. REVIEW.md template upgrade

What: add to pro-ai-sdlc's template what failure looks like in this repo, paths to skip, evidence as file and line, the Pre-existing tag, a summary that starts with the count, the optional tier table and sensitive paths.
Why it is P0: `/pro-dev install` writes this template into every new repo; every reviewer reads it.
Source: pro-ship feature 10, "REVIEW.md template changes".

### 6. Review convergence rules

What: after the first full review, later rounds look only at new commits; a finding is never raised twice; a class of bug is named once so every instance is fixed together; old bugs are tagged Pre-existing and do not block.
`/pr-babysit` already stops at five rounds; the pro-ship brainstorm proposes three.
Why it is P0: an agent author and an agent reviewer can loop for dozens of rounds.
Each nit costs a commit and a round.
Source: pro-ship feature 9, "Convergence".

### 7. `/execute` guardrails

What, all from agent-skills:
- Stop and ask before a task that touches auth, migrations, payments, deploys or secrets (`commands/build.toml:35-39`).
- A "NOTICED BUT NOT TOUCHING" note for problems outside the task, in `/execute` and the implementer prompt (`skills/incremental-implementation/SKILL.md:126-133`).
- Stage only the task's files, never `git add -A` (`commands/build.toml:34`).
- A change summary in the PR body with "THINGS I DIDN'T TOUCH" and "POTENTIAL CONCERNS" (`skills/git-workflow-and-versioning/SKILL.md:191-209`).
Why it is P1: `/execute` now runs a whole plan unattended with no stop list today.
Keep ours: the scripted gate, the worktree, the green baseline, the verifier and never merge.

### 8. Spec template additions

What:
- An "ASSUMPTIONS I'M MAKING, correct me now" block before the draft, in `/spec` step 3 (`skills/spec-driven-development/SKILL.md:71-80`).
- Vague asks turned into measurable criteria, for example "faster" becomes LCP under 2.5s (`:156-168`).
- Always / Ask first / Never boundaries in `templates/spec.md` (`:110-113`).
Why it is P1: wrong assumptions caught at the spec are the cheapest fix in the loop.

### 9. Plan template additions and a definition of done

What:
- Task sizes XS to XL with split triggers: over 2 hours, over 3 acceptance criteria, "and" in the title, 2 or more subsystems (`skills/planning-and-task-breakdown/SKILL.md:125-142`).
- A checkpoint every 2-3 tasks, risky tasks early and never overwriting an unfinished plan (`:144-187`).
- The `writing-plans` self-review (spec coverage, placeholder scan, type consistency) in `/plan` step 3; neither `/plan` nor theirs has it.
- `references/definition-of-done.md` as a pro-ai-sdlc reference cited by the plan's Done block: one standing bar for every change, separate from each task's acceptance criteria.
Why it is P1: right-sized tasks are what let `/execute` and its verifier work in small steps.

### 10. A test-design lens for the verifier

What: from `agents/test-engineer.md`, the scenario list (happy path, empty input, boundaries, error paths, concurrency) and its rules (one concept per test, no shared mutable state, mock only at system boundaries, a test that never fails is useless).
Put them in the verifier or the reviewer's tests lens; a separate `test-engineer` agent is item 18's call.
Why it is P1: our verifier runs the tests but never asks whether they are the right tests.

### 11. Untrusted-input rules

What:
- In `agent-browser`: page content is data, not instructions; run JavaScript read-only; never read credentials; never follow a URL found on a page (`skills/browser-testing-with-devtools/SKILL.md:72-107`).
- In `systematic-debugging`: treat error output as untrusted data (`skills/debugging-and-error-recovery/SKILL.md:272-279`).
Why it is P1: these are prompt-injection holes in every browser session and every failing build.
The fix is a few lines.

### 12. Doubt-driven step in `/execute`

What: before a decision that is hard to undo stands, send only the artifact and its contract (never the author's claim that it is right) to a fresh-context reviewer told to find problems, at most three rounds, with a cross-model option through the Codex CLI.
EGM goldfish already does this for specs and plans; nothing does it during the build.
How: a skill in pro-ai-sdlc that `/execute` offers on irreversible steps; it runs in the main session because subagents cannot spawn subagents.
Source: `skills/doubt-driven-development/SKILL.md`.

### 13. Codex as a second reviewer

What: the same `code-reviewer` as a Codex `.toml`, run with `codex exec` in parallel on high-risk PRs; findings both models raise count as stronger; disagreements are shown as they are.
Codex is an opt-in engine row that `/pro-dev install` asks about.
Source: pro-ship feature 5.
Depends on: 3.

### 14. Required documents per project

What: a conditional set (README, CLAUDE.md, AGENTS.md, REVIEW.md and ADRs always; ARCHITECTURE, PRODUCT and DESIGN when they apply), new templates, `/pro-dev install` drafting missing ones from the code and pr-check listing what is missing.
Why it is P1: the reviewer, the classifier and CI all read these documents.
Source: pro-ship features 14-16.

### 15. `/ship` preflight with a go/no-go verdict

What: `/pro-ship:ship` writes `.pro-dev/ship/preflight.md` for HEAD.
Take from `commands/ship.toml`:
- The body layout: Blockers, Recommended fixes, Acknowledged risks, Rollback plan and the specialist reports (`:49-72`).
- The verdict rules: a Critical finding is NO-GO unless Jody explicitly accepts the risk; no GO without a rollback plan (`:78-82`).
Skip their skip rule (2 files or fewer, under 50 lines); our risk tiers replace it.
`skills/shipping-and-launch/SKILL.md` becomes a sidecar, as the pro-ship brainstorm already plans.
Source: pro-ship feature 18.

### 16. `pipeline`

What: generate or audit GitHub Actions that run the same checks and reviewers as pr-check, as required status checks.
The local hook is a guardrail; the ruleset is the enforcement.
`skills/ci-cd-and-automation/SKILL.md` becomes its sidecar.
Source: pro-ship feature 19.

### 17. Architecture review with twelve-factor

What: an `architect` agent and skill that mirror `security-architect`, with the twelve factors plus API-first, telemetry and authN/Z as the checklist, in plan, diff (only on architecture signals) and audit modes.
Source: pro-ship feature 17.

### 18. Specialist agents

What: a first-pass `security-reviewer` that hunts for findings (our `security-auditor` only judges one), a `web-performance-auditor` with `/webperf` and possibly a `test-engineer`.
Source: [specialist agents intent](../intent/2026-10-28-specialist-agents/intent.md); `agents/security-auditor.md`, `agents/web-performance-auditor.md`, `agents/test-engineer.md`.

### 19. Source-driven development and a docs cache

What: before writing framework code, read the installed versions, fetch the official docs and cite them.
The `sdd-cache` hook stores fetched pages and serves one only when the server answers 304 to a conditional GET.
Ours does this for Next.js only (`next-best-practices`).
Source: `skills/source-driven-development/SKILL.md`, `hooks/SDD-CACHE.md`.

### 20. Installed skills declare runnable checks

What: a way for a plugin to declare its lint rules, scripts or tests so pr-check runs them.
Source: pro-ship feature 11, "Installable skills carry build knowledge and runnable checks".

### 21. The scaling block and `repo-hygiene`

What: the dials (approvals per tier, who approves, depth, where it is enforced) in a REVIEW.md block, with `repo-hygiene` writing rulesets, CODEOWNERS and Dependabot from it.
Source: pro-ship features 13 and 20.

### 22. Reviewer evals from past bugs

What: the commits behind "Things Claude gets wrong" in `CLAUDE.md` become an eval set beside `tests/eval.mjs`, rescored whenever the reviewer changes, plus a few clean PRs to measure noise.
Source: pro-ship feature 12.
Depends on: 3.

### 23. Re-sync `interview-me` and `idea-refine`

Only the two `SKILL.md` files differ from upstream; the sidecars are identical.
- `interview-me`: the terminal turn and stop rule (theirs lines 124-131) with its red flag (line 215) and checklist item (line 234).
- `idea-refine`: the rationalizations table (about lines 165-174) and the "not for" line that routes to `interview-me` or a spec.

### 24. `/adr` additions

Detect the repo's existing ADR convention (`skills/documentation-and-adrs/SKILL.md:36-44`), add a Deprecated status and a rule never to delete an old ADR.

### 25. Two guards in the simplifier

Chesterton's fence: check callers and `git blame` before removing anything, which means allowing `git log` and `git blame` in `simplifier.md`.
The over-simplification guard: do not inline a helper that names a concept or merge unrelated logic (`skills/code-simplification/SKILL.md`, "Maintain Balance", about line 93).

### 26. Debugging addendum

The tree for bugs that will not reproduce: timing, environment, state or randomness (`skills/debugging-and-error-recovery/SKILL.md:53-73`).
Also `git bisect run` for regressions (`:101-109`).

### 27. An accessibility checklist sidecar

`references/accessibility-checklist.md` under pro-design's `accessibility-audit`, which today has severities but no concrete checks.

### 28. Two `/fix` tweaks

Detect the stack instead of assuming `npm test` (`skills/test-driven-development/SKILL.md:24-36`).
Have a subagent write the repro test without seeing the fix (`:343-357`).

### 29. Optional capability map in `/spec`

For big work, a module table with stable ids and a build order, then one spec per module (`skills/spec-driven-development/SKILL.md:34-65`).

### 30. Domain skills

`deprecation-and-migration` (expand/contract schemas and the strangler pattern, a fit for pro-data), `observability-and-instrumentation`, `api-and-interface-design`, `performance-optimization` and `context-engineering`.
Each is a fork with attribution when a project needs it.

### 31. Scale-up items

Release, feature flags, staged rollout, rollback, a merge queue, two-person approval and a skeptic pass that tries to refute each finding.
Source: the pro-ship brainstorm, "Later" and "Built to scale up".

## Skipped on purpose

- `using-agent-skills` and its `session-start.sh`: our router and hooks already do this.
Their own comment says a second router on top of native routing is wrong.
- `simplify-ignore`: too niche.
- Their hand-written changelog advice: our changelogs are generated.
- Their TDD test pyramid and Prove-It command: our TDD skill and `/fix` already go further.
- Their security skill as a replacement: it teaches secure coding, ours audits, so they do different jobs.

Every fork keeps the upstream footer and a row in `docs/licenses.md` (MIT, Copyright (c) 2025 Addy Osmani).

## The agent-skills comparison

What agent-skills ships, our closest match and the checklist items each row feeds.
The last column is blank where there is nothing to take.

### Their skills (25)

| Skill | What it does | Ours | Items |
|---|---|---|---|
| idea-refine | Sharpens a vague idea by widening the options, then narrowing to one | pro-pdd `idea-refine` (forked from theirs) | 23 |
| interview-me | Asks one question at a time until it is about 95% sure what you want | pro-pdd `interview-me` (forked from theirs) | 23 |
| spec-driven-development | Writes a spec or PRD before any code | `/spec` | 8, 29 |
| planning-and-task-breakdown | Splits a spec into small ordered tasks with acceptance criteria | `/plan`, `writing-plans` | 9 |
| incremental-implementation | Builds in thin vertical slices: compilable at every step, feature flags, easy rollback | partly `/execute` | 7 |
| test-driven-development | Red, green, refactor; proves a bug with a failing test first | pro-execution TDD, `/fix` | 28 |
| debugging-and-error-recovery | Systematic root-cause debugging | `systematic-debugging` | 11, 26 |
| code-review-and-quality | Reviews correctness, readability, architecture, security and performance; also change size, dead code and dependencies | `/review`, pro-quality | 3 |
| code-simplification | Makes code clearer without changing its behavior | `simplifier` agent | 25 |
| security-and-hardening | Input handling, auth, secrets, external integrations | pro-security | |
| frontend-ui-engineering | Accessible, responsive production UI | pro-design | 27 |
| browser-testing-with-devtools | Real-browser testing through the Chrome DevTools MCP | `agent-browser` | 11 |
| documentation-and-adrs | ADRs and docs for API changes | `/adr`, pro-quality doc agents | 24 |
| git-workflow-and-versioning | Branching, atomic commits, splitting a messy working tree | partly (`git-safe` hook, worktrees) | 7 |
| shipping-and-launch | Pre-launch checklist, staged rollout, rollback plan, error-budget gate | partly (pro-ship, `production-gate`) | 15, 31 |
| using-agent-skills | The meta-skill that picks which skill applies | `using-pro-dev` | |
| constraint-driven-development | Writes `CONSTRAINTS.md`: a floor, thresholds that never drop and exceptions that expire | none | 1 (now its own intent) |
| doubt-driven-development | Sends decisions to a fresh-context reviewer during the work, with an optional second model | none (EGM only for specs and plans) | 12 |
| source-driven-development | Fetches and cites the official docs for the installed versions before writing framework code | Next.js only | 19 |
| context-engineering | Rules files, how to pack context, when to restart a session | none (some of it is in our CLAUDE.md conventions) | 30 |
| api-and-interface-design | Stable APIs, module boundaries, type contracts | none | 30 |
| observability-and-instrumentation | Logs, metrics, tracing and alerts, plus checking the telemetry itself works | none | 30 |
| performance-optimization | Core Web Vitals, backend and query performance | none | 30 |
| deprecation-and-migration | Strangler pattern, adapters, expand/contract schema changes, zombie code | none | 30 |
| ci-cd-and-automation | CI pipelines, quality gates, deploy strategy | none | 16 |

### Their agents (4)

| Agent | What it does | Ours | Items |
|---|---|---|---|
| code-reviewer | Reviews a change on correctness, readability, architecture, security and performance | `reviewer` (opus) | 3 |
| security-auditor | Finds vulnerabilities, models threats, suggests hardening | pro-security `security-auditor` (judges one finding, does not hunt) | 18 |
| test-engineer | Plans test strategy, writes tests, analyzes coverage | none (the verifier only runs checks) | 10, 18 |
| web-performance-auditor | Audits Core Web Vitals, loading, rendering and the network | none | 18 |

### Their commands (9)

| Command | What it does | Ours | Items |
|---|---|---|---|
| `/spec` | Starts spec-driven development | `/spec` | 8 |
| `/planning` (`/plan` in their README) | Breaks work into tasks with acceptance criteria | `/plan` | 9 |
| `/build` | Builds, tests, verifies and commits one task at a time; `/build auto` runs the whole plan after one approval | `/execute` | 7 |
| `/test` | TDD workflow; for a bug, a failing test proves it first | `/fix` | 28 |
| `/review` | Review on the same five areas as `code-reviewer` | `/review` | 3 |
| `/code-simplify` | Simplifies without changing behavior | built-in `/simplify`, `simplifier` | 25 |
| `/constraints` | Interviews you and writes `CONSTRAINTS.md` | none | 1 (now its own intent) |
| `/ship` | Sends the launch checklist to the specialist agents at once, then gives a go/no-go | none (pro-ship has only a deploy bridge) | 15 |
| `/webperf` | Runs the `web-performance-auditor` | none | 18 |

### Their hooks and references

| File | What it does | Items |
|---|---|---|
| `hooks/session-start.sh` | Loads the meta-skill at session start; unwired on Claude Code by their own choice | |
| `hooks/sdd-cache-*.sh` | Caches fetched docs, serves a page only when the server answers 304 | 19 |
| `hooks/simplify-ignore.sh` | Hides marked code blocks from the simplifier | |
| `references/definition-of-done.md` | One standing bar for every change | 9 |
| `references/accessibility-checklist.md` | Concrete accessibility checks | 27 |
| `references/security-checklist.md`, `performance-checklist.md`, `observability-checklist.md`, `testing-patterns.md`, `orchestration-patterns.md` | Shared checklists the skills cite | 10, 30 |

### Deltas where we have an equivalent

Ours is stronger on enforcement: gates, hooks, a fresh-context reviewer and traceability from intent through spec, plan and Done.
Theirs is stronger on how-to guidance: sizing rules, design smells, test design and tables of the excuses agents use to skip steps.
None of our equivalents should be replaced.

| Area | Theirs has, we lack | We have, they lack | Call | Items |
|---|---|---|---|---|
| idea-refine (our fork) | A table of the excuses agents use to skip steps; a "not for" line that routes to `interview-me` or a spec | Extra trigger phrases, harness-neutral text | Re-sync | 23 |
| interview-me (our fork) | A stop rule: after you confirm, write the Statement of Intent, offer next steps, end the turn | A note that it converges on one intent | Re-sync | 23 |
| spec | An assumptions block; vague asks turned into numbers ("faster" means LCP under 2.5s); Always / Ask first / Never boundaries; a capability map that splits big work into one spec per module | A separate `/intent` stage, policy loading, Flagged concerns, numbered requirements traced to acceptance criteria, an ADR line, goldfish review | Adopt the first three; capability map optional | 8, 29 |
| plan | Task sizes XS to XL with split triggers; a checkpoint every 2-3 tasks; never overwrite an unfinished plan; a definition of done for every change | Questions run before the plan is shown, approver and status fields, a Done sign-off, a Departures section | Adopt all four | 9 |
| ADR | Detect the repo's ADR convention; a Deprecated status; never delete an old ADR | One-question interview, index update, supersede flow, where it is enforced, what would reverse it | Adopt all three | 24 |
| build (`/build` vs `/execute`) | Stop and ask before auth, migrations, payments, deploys or secrets; "NOTICED BUT NOT TOUCHING"; stage only the task's files | A scripted gate, its own worktree, a green baseline, the verifier, an auto PR, never merge | Adopt into `/execute` | 7 |
| TDD and `/fix` | Detect the stack instead of assuming `npm test`; a subagent writes the repro test without seeing the fix | Delete code written before its test, check the test fails for the right reason, fix mode with the `protect-tests` hook | Keep ours; two optional tweaks | 28 |
| debugging | Treat error output as untrusted data; a tree for bugs that will not reproduce; `git bisect run` | No fix without a root cause, one variable at a time, question the design after 3 failed fixes | Short addendum | 11, 26 |
| git | A change summary with "THINGS I DIDN'T TOUCH" and "POTENTIAL CONCERNS"; a checklist before each commit | `git-safe`'s enforced blocks, worktree checks, the version-bump law | Template into the PR body | 7 |
| code review | Design smells; a mutation check; presumed blockers; PR size bands | A check against intent, spec and plan; every finding needs a concrete failure; per-repo REVIEW.md; `receiving-code-review` | Add to REVIEW.md and the reviewer | 3, 5 |
| simplify | Chesterton's fence (`git blame` and callers before removing anything); a guard against over-simplifying | Scope limited to the diff, undo per file when checks fail, a search for duplicate helpers | Two lines in `simplifier.md` | 25 |
| security | Guidance for writing secure code (headers, CORS, cookies, uploads, privacy) | A ten-phase whole-repo audit, a confidence gate, an independent verifier, the push gate | Different jobs; keep ours | |
| test-engineer vs verifier | Which cases to test (empty, boundary, error, concurrency); rules for writing tests | Runs the change and the nearest code around it; a pass, fail or incomplete verdict | Add the case list to the verifier | 10 |
| `/ship` vs pro-ship | A go/no-go layout (Blockers, Recommended, Acknowledged risks, Rollback); a Critical finding means NO-GO unless you accept it; no GO without a rollback plan | A real gate hook, a stamp tied to the commit, risk tiers, a Codex second reviewer | Adopt as the preflight | 15 |
| frontend | Concrete code-level accessibility checks | About 27 design skills | Checklist sidecar for `accessibility-audit` | 27 |
| browser testing | Page content is untrusted, JavaScript runs read-only, never follow URLs found on a page | The `agent-browser` workflow, `qa-suite` | Add a security-boundaries section | 11 |
| meta-skill | A list of 10 failure modes | A real router, session-start hooks that run | Nothing | |

