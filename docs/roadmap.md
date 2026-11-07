# Roadmap

What is being built in this marketplace now, what comes next in ranked order and which intents are parked.
Update it whenever an intent starts, moves a stage, parks or ships, in the same commit as that change where possible.
Last updated 2026-11-07: the specialist-agents intent is done, closing items 15 and 18; the next run still drives mieruka's board in a browser, after mieruka's trace reader.

A fresh session starts here: read "Now", then the intent folder it names.
The ranked list came from comparing this marketplace with [agent-skills](https://github.com/addyosmani/agent-skills) (local clone `../agent-skills`, commit `eb07f19`, release 0.6.14) and from the [pro-ship brainstorm](../intent/2026-10-28-pro-ship-scope/brainstorm.md) of 2026-10-28, plus the [specialist agents intent](../intent/2026-10-28-specialist-agents/intent.md).
It revisits the older [AGENT-SKILLS-INTEGRATION](./plans/AGENT-SKILLS-INTEGRATION.md) plan, which skipped most of agent-skills before the pro-ship work existed.
Nothing below the "Now" section is decided until it moves into an intent or a spec.

## Now

### Next session: rerun the SDLC by driving mieruka's board

The retest of 2026-11-04 is over: the release went out but no card reached Done, as written below.
In order, each through the loop:

1. The maintainer accepts or corrects the four intents, then answers their open questions: whether `pro-pdd`, `pro-spdd` and `pro-speckit` are being retired, plus the version a rollback release takes.
2. mieruka's trace reader, which the owner merges: its `session-trace-every-path` intent reads change cards and session logs written outside mieruka and defines the log format. Its spec is a draft with no plan yet.
3. [sdlc-happy-path-run](../intent/2026-11-04-sdlc-happy-path-run/intent.md): the happy path to Done with a screenshot per stage and role changes, driven through the board in a browser. Claude in Chrome drives the first run and a Playwright script follows from what worked. It fixes the demo fixture's prose rollback steps and adds a way to clear a check left at `confirm`.
4. [factory-session-capture](../intent/2026-11-04-factory-session-capture/intent.md), reduced to level 1 container runs: each one writes mieruka's log format, tied to its card.
5. mieruka's `trace-evidence-screenshots` intent, which the owner merges: screenshots shown as images in the trace panel.
6. [rollback-path](../intent/2026-11-04-rollback-path/intent.md): a rollback route through the loop and an automated scenario, after the happy path works.
7. [sdlc-git-commands](../intent/2026-11-04-sdlc-git-commands/intent.md): slash commands recommend each git step and the person decides. It changes ADR-0025's rule on who runs the tag, so settle it before that ADR's sign-off.
8. Run the live e2e (`node tests/e2e-sdlc.mjs --scenario 1,2,3 --allow-broad-token`, about $18 to $30) once the maintainer says yes. It has not run since release-versioning.
9. The maintainer signs off the software factory and release-versioning; ADR-0024 and ADR-0025 move to accepted.

### Done: the retest of 2026-11-04

[release-versioning](../intent/2026-11-03-release-versioning/intent.md) and [factory-demo-kit](../intent/2026-11-03-factory-demo-kit/intent.md) are built.
A fresh demo ran two level 1 intents unattended, one level 3 intent through every role and a v1.1.0 release that `/pro-ship:ship` versioned and `/pro-ship:deployed` recorded.
The tests and the documented use passed on a clean checkout of the tag.
No card reached Done, because the rollback check never passed and the deploy record stayed `partial`.
The maintainer stopped the run there; the demo is removed.

Findings not yet in an intent:

- `/intent` says no pull request while the docs say an intent is accepted through one.
- A role is only `user.name`, so a missed switch acts as the wrong person without warning. Squash merges credit the GitHub account.
- A demo session overrode reviewers from Opus to Sonnet. Opus found an Important finding and two high test gaps the Sonnet runs had not. Small sample, but no gate caught the override.
- A bare `/review` can reach the wrong reviewer.
- `/ship` gives reviewers the first and last uncovered commit. That range pulls in covered commits and stops before a covered fix, so a fixed finding came back as Important.
- A small pull request with no intent makes `ship.py version` propose a major version until someone answers.
- A pr-check stamp can never cover the sign-off commit, so a signed-off pull request reads as uncovered.
- `/ship` recorded legal as `could-not-run` where the plugin was not installed. It also condensed a specialist report that should be verbatim.
- `factory.py level` raises to 3 on stop-list words in the text of an intent that only discusses them.
- A rerun of `/pro-ship:deployed` for a tag overwrites the earlier record, so its history is lost.
- `/execute`'s test-file freeze forces extra test files in review fixes. `protect-tests` in enforce mode would block a legitimately reversed test, which is input to the 2026-11-13 enforce decision.
- `## Done` goes stale after later commits.
- The demo fixture has no `AGENTS.md`.

### Built, waiting on sign-off: the software factory

[intent/2026-11-03-software-factory](../intent/2026-11-03-software-factory/intent.md): escalation levels set by `factory.py level` and only raised, a `## Roles` block in `REVIEW.md` plus a runner that takes a level 1 intent to a merged pull request in a container while the host decides every merge ([ADR-0024](./decisions/0024-escalation-levels.md) proposed).
Built in #135 to #139; guide in [factory.md](./factory.md), demo in [factory-demo.md](./factory-demo.md).
Proved live on https://github.com/jodybrewster/factory-demo: two level 1 intents merged with nobody present, one stopped at level 2 for the engineer.
Waiting on the maintainer: the sign-off, merging mieruka #202 and #203 and the live e2e run (`node tests/e2e-sdlc.mjs`, about $18 to $30).
Follow-ups: a failed build on a merged brief has no retry path, because `run --next` and `run <dir>` refuse an intent that already has a spec and the session's unpushed work dies with the container; plans that a later change makes untrue (the reviewer's doc-freshness check), cache the level per intent in mieruka (each card spawns `factory.py`), a scoped GitHub identity for the factory instead of `--allow-broad-token`.

### Done: the loop after the build

[intent/2026-11-01-after-build-loop](../intent/2026-11-01-after-build-loop/intent.md): a deploy record, `/incident`, review lessons, the verifier in the pr-check stamp, a format hook and a visual check of UI steps, all as records mieruka reads ([docs/loop-records.md](./loop-records.md), [ADR-0023](./decisions/0023-loop-records.md) accepted).
Built in #128 and signed off on 2026-11-01; the hand runs of AC9 wait for the first real use.
mieruka's readers are merged in its own repo: the Ship page shows the preflight and deploys, and the board runs past build through Validate, Review, Ship, Done and Maintain; `tests/mieruka-sync.mjs` passes against its main.
Next after it, each its own intent with a security challenge first: `claude -p` in CI, tiered deploy autonomy, a rollback command and a control-band watcher.
The reviewer checklist items left out of it (change sizing, dependency discipline, "I'll clean it up later", multi-model review) go into the next code-reviewer change.

### Done: neutral repo

[intent/2026-11-01-neutral-repo](../intent/2026-11-01-neutral-repo/intent.md) shipped on 2026-11-01: no maintainer name or chat quotes in tracked files and the upstream named agent-skills outside its license lines, held by the `names` check in `tests/check.mjs`.

### Done: item 15, `/ship` preflight

`/pro-ship:ship` shipped on 2026-11-01 ([intent](../intent/2026-10-31-ship-preflight/intent.md), [spec](../intent/2026-10-31-ship-preflight/spec.md), [plan](../intent/2026-10-31-ship-preflight/plan.md), [ADR-0022](./decisions/0022-ship-preflight-record.md) accepted).
It reads how a project ships, reviews only the commits no trusted pr-check marker covers, runs agent-skills' full pre-launch checklist with the test-engineer and web-performance-auditor agents and the legal review and writes a GO or NO-GO record the merge gate, the new `ship-gate` and pro-legal's gate read.
`ship-gate` starts in warn and its evidence period starts with this release.
The mieruka run (AC13) passed on 2026-11-01. Left for mieruka itself: a Ship block (so `apps/web` is not read as an npm publish) and showing the record on its Ship page.

### Waiting on the maintainer

- ADRs 0016 to 0021 are proposed and wait for acceptance.
- The warn-mode evidence week for the floor guard, pr-gate and merge gate in two repos, with the decision record due 2026-11-13 ([docs/enforce-mode.md](./enforce-mode.md)); the merge gate's script changed on 2026-11-01, so its own period restarts that day.
- The four intents under [Housekeeping](#housekeeping): finish the remainder or mark them `done`.
- The twelve-factor-skill build still sits uncommitted in another session's worktree, while the brainstorm moved twelve-factor into the architecture review (item 17); it needs a call before it is committed.

### Since P1 (2026-10-30 and 2026-10-31)

- [#106](https://github.com/jodybrewster/pro-dev-skillset/pull/106): `CLAUDE.md` reminds to run live evals before a skill PR.
- [#107](https://github.com/jodybrewster/pro-dev-skillset/pull/107): doc freshness moved from the push hook into pr-check as a Should-fix step ([ADR-0021](./decisions/0021-doc-freshness-is-judgment.md)).
- [#108](https://github.com/jodybrewster/pro-dev-skillset/pull/108): pro-ship gained `documentation-and-adrs`, adapted from agent-skills; it was a planned Ship-phase skill and is not a ranked item.

### P1 intents (shipped 2026-10-30)

P0 shipped on 2026-10-30 (#81, #82, #87, #88, #89).
Each P1 group went through spec, plan and build in one PR per intent; the ADRs 0016 to 0020 are proposed and wait for acceptance.
Hand checks that need a person or a model run are listed in each plan's Done section.

| Intent | Ranked items | Plugins | Risk | Intent PR | Build PR |
|---|---|---|---|---|---|
| [sdlc-loop-upgrades](../intent/2026-10-30-sdlc-loop-upgrades/intent.md) | 7, 8, 9, 10 with 24, 25, 29 | pro-ai-sdlc | medium | [#90](https://github.com/jodybrewster/pro-dev-skillset/pull/90) | [#98](https://github.com/jodybrewster/pro-dev-skillset/pull/98) |
| [untrusted-input-safety](../intent/2026-10-30-untrusted-input-safety/intent.md) | 11 with 26, 27 | pro-testing, pro-execution, pro-design | low | [#91](https://github.com/jodybrewster/pro-dev-skillset/pull/91) | [#97](https://github.com/jodybrewster/pro-dev-skillset/pull/97) |
| [p0-hardening](../intent/2026-10-30-p0-hardening/intent.md) | follow-ups from P0 | pro-ship, pro-core | medium | [#92](https://github.com/jodybrewster/pro-dev-skillset/pull/92) | [#101](https://github.com/jodybrewster/pro-dev-skillset/pull/101) |
| [doubt-driven-execute](../intent/2026-10-30-doubt-driven-execute/intent.md) | 12 | pro-ai-sdlc | medium | [#93](https://github.com/jodybrewster/pro-dev-skillset/pull/93) | [#102](https://github.com/jodybrewster/pro-dev-skillset/pull/102) |
| [codex-second-reviewer](../intent/2026-10-30-codex-second-reviewer/intent.md) | 13 | pro-quality, pro-ship, pro-core | medium | [#94](https://github.com/jodybrewster/pro-dev-skillset/pull/94) | [#99](https://github.com/jodybrewster/pro-dev-skillset/pull/99) |
| [required-documents](../intent/2026-10-30-required-documents/intent.md) | 14 | pro-core, pro-ai-sdlc, pro-ship | medium | [#95](https://github.com/jodybrewster/pro-dev-skillset/pull/95) | [#103](https://github.com/jodybrewster/pro-dev-skillset/pull/103) |

Merged in the order #97, #98, #99, #101, #102 and #103; doubt-driven-execute reuses the Codex runner from codex-second-reviewer through a byte-identical copy.
The warn-mode evidence week for the gates is in [docs/enforce-mode.md](./enforce-mode.md).

### pro-electron (built 2026-10-30)

A new opt-in stack plugin for Electron apps, from an Electron skills survey of 2026-10-30.
Folder: [intent/2026-10-30-pro-electron/](../intent/2026-10-30-pro-electron/intent.md); spec and plan approved on 2026-10-30.
Ships `electron-skills-bridge` (jwynia `electron-best-practices`, laststance `electron-release`, manual Playwright MCP over CDP), `electron-upgrade` and `electron-security-audit`.
Live evals passed on 2026-10-30 (docs/evals.md).

### constraint-floor (ranked item 1)

Folder: [intent/2026-10-29-constraint-floor/](../intent/2026-10-29-constraint-floor/).

- Intent: written and committed (`8b78aa3`), status draft.
- Spec: [spec.md](../intent/2026-10-29-constraint-floor/spec.md) with 18 functional and 4 non-functional requirements and 9 acceptance criteria, committed with ADR-0010 (`b23f41c`).
- ADR: [ADR-0010](./decisions/0010-constraint-floor.md), status proposed; it moves to accepted at the plan's Done sign-off.
  There is no expectation that the floor will be removed, so it records a revisit trigger instead: findings that mostly get waved through with `floor-allow:` mean a rule is too broad.
- Flagged concerns 1-4 resolved on 2026-10-29 with the recommendations: copy the mode lookup into pro-quality; accept pro-quality's mixed hook behavior for now; enforce mode denies every retry; the verifier reading `CONSTRAINTS.md` is a follow-up change.
- Plan: [plan.md](../intent/2026-10-29-constraint-floor/plan.md), 18 steps in four parallel tracks plus a serial tail; approved on 2026-10-30.
  Three spec changes found while planning were approved on 2026-10-29: `gh pr create` diffs against `main`, the marker rules skip `.md` files and `AGENTS.md` may be a symlink to `CLAUDE.md`.
- Build: steps 1 to 16 done on [#81](https://github.com/jodybrewster/pro-dev-skillset/pull/81) (pro-quality 0.13.0, pro-ai-sdlc 0.7.0, marketplace 1.60.0); 129 guard cases pass and a mutation run broke each rule, the mode lookup, `floor-allow:` and redaction in turn, each caught by at least one case.
- Steps 17 and 18 done: the `/constraints` trial passed and the review pass found six problems, all fixed test first (152 guard cases).
- Signed off on 2026-10-30 and merged in #81. AC9 (a week of warn-mode use in two repos) gates the later switch to enforce mode.

Decisions already made for constraint-floor (2026-10-29): the hook is Python, not Rust or bash; it lives in pro-quality; it starts in warn mode; out of scope are installing semgrep, osv-scanner, Lighthouse or axe, running it in CI, enforce mode and writing `CONSTRAINTS.md` into other repos.

### The P0 review stack (ranked items 2-6)

The brainstorm's "Intent A" was split into four intents on 2026-10-29, drafted from the brainstorm and this roadmap with no interview.
All four intents and specs are committed as drafts.
Each spec says `ADR needed: yes` with the ADR not yet written; each lists its flagged concerns with a recommendation and its open questions.
They replace the dropped [pro-ship-scope intent](../intent/2026-10-28-pro-ship-scope/intent.md); `code-reviewer` moved out of the parked specialist-agents intent.

| Intent | Ranked items | Plugins | Builds on | Spec size |
|---|---|---|---|---|
| [review-policy](../intent/2026-10-29-review-policy/spec.md) | 5, 6 | pro-ai-sdlc | none | shipped in #82 |
| [code-reviewer](../intent/2026-10-29-code-reviewer/spec.md) | 3 | pro-quality | review-policy | shipped in #87 |
| [pr-gate](../intent/2026-10-29-pr-gate/spec.md) | 2 | pro-ship, pro-quality, pro-security | code-reviewer, constraint-floor | shipped in #89 |
| [risk-tiers](../intent/2026-10-29-risk-tiers/spec.md) | 4 | pro-ship | pr-gate | shipped in #88 |


Facts the drafts found that change earlier notes:

- pro-quality's `pr-quality-gate.py` fired since 0.11.1 (PR 76), as a `PostToolUse` hook after `gh pr create` succeeded; it ran `npm run lint` and `npm test` and checked the body length; pr-gate replaces it and the script is deleted.
- `/merge-pr` is a user-level command in `~/.claude/commands/merge-pr.md`, not in this repo; risk-tiers adds a merge-gate hook on `gh pr merge` instead of editing it.

Cross-cutting decisions:

- Five ADRs are pending across the stack: constraint floor (0010), review convergence, the reviewer handoff contract, the shared gate stamp and the tier model.
  Recommended: fold review convergence and the handoff contract into one "review contract" ADR, making four.
- Every spec names a version bump that collides with the others (pro-quality, pro-ai-sdlc, metadata.version); the recommendation in each is to take the next number over main at build time and stack the PRs.
- Build order: constraint-floor and review-policy can run in parallel; then code-reviewer; then pr-gate; then risk-tiers.
- One PR per intent: each intent's PR holds its intent, spec, plan and build and stays a draft until the build lands.
  constraint-floor [#81](https://github.com/jodybrewster/pro-dev-skillset/pull/81), review-policy [#82](https://github.com/jodybrewster/pro-dev-skillset/pull/82), code-reviewer [#83](https://github.com/jodybrewster/pro-dev-skillset/pull/83), pr-gate [#84](https://github.com/jodybrewster/pro-dev-skillset/pull/84) and risk-tiers [#85](https://github.com/jodybrewster/pro-dev-skillset/pull/85).

review-policy shipped in #82 on 2026-10-30 with ADR-0011: round cap three for every round, the finding count first, no REVIEW.md refresh in `/pro-dev update`.
code-reviewer shipped in #87 on 2026-10-30 with ADR-0012 (the four-field handoff).
pr-gate shipped in #89 on 2026-10-30 with ADR-0014 (the gate stamp); pro-ship joined `pro-dev-starter` in the same release.
risk-tiers shipped in #88 on 2026-10-30 with ADR-0015. All of P0 (ranked items 1 to 6) shipped on 2026-10-30.
What still blocks enforce mode, per gate and with owners: [docs/enforce-mode.md](./enforce-mode.md); the decision record is pending until 2026-11-13.
Decided on 2026-10-29 for code-reviewer: effort high set by the dispatcher, subagent dispatch, one shared `handoff.md`; the mutation check moves out of the read-only reviewer into pr-check (pr-gate R29), which records `mutation` in the stamp; callers of the old reviewer template are added (pro-quality `/review` and pro-execution's quality-reviewer prompt; the third, the old PR gate script, is deleted by pr-gate).

## Parked intents

| Intent | Status | Why parked | Comes back when |
|---|---|---|---|
| [2026-10-28-rename-pro-dev](../intent/2026-10-28-rename-pro-dev/intent.md) | draft | The intent itself says "not for today". | The maintainer decides to rename the plugins. |
| [2026-10-28-taste-skill-v2](../intent/2026-10-28-taste-skill-v2/intent.md) | draft | Not on the ranked list; nobody has started it. | pro-design is next touched, or the bridge's smoke test fails. |

## Dropped intents

- [2026-10-28-pro-ship-scope](../intent/2026-10-28-pro-ship-scope/intent.md), 2026-10-29: its PR gate part became the four P0 review-stack intents; the brainstorm's Intents B and C get new intents when ranked items 15, 16, 21, 14 and 17 come up.

## Housekeeping

Marked `done` on 2026-10-31 after checking each against its merged PR: constraint-floor (#81), review-policy (#82), code-reviewer (#87), risk-tiers (#88), pr-gate (#89), untrusted-input-safety (#97), sdlc-loop-upgrades (#98), codex-second-reviewer (#99), p0-hardening (#101), doubt-driven-execute (#102), required-documents (#103) and pro-electron (#105).

Marked `done` on 2026-10-29 after checking git history: [execute-command](../intent/2026-10-28-execute-command/intent.md) (#63), [plugin-installers](../intent/2026-10-28-plugin-installers/intent.md) (#70) and [pro-speckit](../intent/2026-10-28-pro-speckit/intent.md) (#71).
Still `proposed` because part of each did not ship:

- [pro-dev-setup](../intent/2026-10-28-pro-dev-setup/intent.md): #65 left its item 5 undone (pro-quality's `/review`, `/api-docs` and `/lead-research` still exist).
- [design-vercel-bridges](../intent/2026-10-28-design-vercel-bridges/intent.md): #68 shipped everything except Hallmark, which was held.
- [spec-methods](../intent/2026-10-28-spec-methods/intent.md): #66 shipped the EGM hand-off, but #73 made pro-pdd the default against the intent's "pro-ai-sdlc stays the default", and the `/intent` offer was not built.
- [pro-dev-simplify](../intent/2026-10-27-pro-dev-simplify/intent.md): item G has no intent; C and D are partial.

Each needs the maintainer's call: finish the remainder, or mark it `done` with the remainder dropped.

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

Items 32 to 54 were added on 2026-11-07 from a comparison with [super-board](https://github.com/EricTechPro/super-board) (local clone `../super-board`, commit `d0b7d5a`, release 3.3.0) and with agent-skills from `eb07f19` to `301b02b` (release 0.6.15 and later merges).
Their detail is under [Items 32 to 54](#items-32-to-54).

### Need

The tiers rank where an item fires; this rates how much this repo needs each open item now, given the retest of 2026-11-04 and the enforce decision due 2026-11-13.

- High: 32, 33, 40, 35, 36, 37, 38 and 39.
  The first three are open safety holes, each one file.
  The rest are the retest findings that kept a card from Done or let a weaker review through, so they come before the board rerun.
- Medium: 34, 43, 41, 42, 47, 46, 45, 22, 48 and 49.
  These close the remaining guard gaps, make review and test-gap quality less dependent on the model and make factory runs recoverable and honest about Done.
- Low: 44, 50, 51, 52, 53, 54, 16, 17, 19, 20, 21, 23, 28, 30 and 31.
  Polish, or work that pays off only past one person, with several intents running at once or once CI holds the gate.

### P0: every edit and every PR

- [x] 1. Floor guard and `CONSTRAINTS.md` (M, pro-quality): shipped in #81 as [intent/2026-10-29-constraint-floor](../intent/2026-10-29-constraint-floor/intent.md), see [Now](#now)
- [x] 2. The PR gate: `pr-check` and a stamp hook on `gh pr create` (L, pro-ship, pro-quality, pro-security): shipped in #89 from the plan of [pr-gate](../intent/2026-10-29-pr-gate/spec.md), see [Now](#now)
- [x] 3. A detailed `code-reviewer` agent with fresh context (M, pro-quality): shipped in #87 as [code-reviewer](../intent/2026-10-29-code-reviewer/spec.md), see [Now](#now)
- [x] 4. Risk classifier and approval tiers (M, pro-ship): shipped in #88 as [risk-tiers](../intent/2026-10-29-risk-tiers/spec.md), see [Now](#now)
- [x] 5. REVIEW.md template upgrade (S, pro-ai-sdlc): shipped in #82 as [review-policy](../intent/2026-10-29-review-policy/spec.md), see [Now](#now)
- [x] 6. Review convergence rules (S, pro-ai-sdlc, pro-ship): shipped in #82 as [review-policy](../intent/2026-10-29-review-policy/spec.md), see [Now](#now)
- [x] 32. Close the push-guard gaps: `git push origin --delete main`, `refs/heads/main`, a bare `git push` while on main and a base branch other than main or master all pass `git-safe.py` today (S, pro-core): shipped in [#190](https://github.com/jodybrewster/pro-dev-skillset/pull/190) as [guard-hardening m1](../intent/2026-11-07-guard-hardening/plan-m1.md), in warn under `mode.protected-push`
- [ ] 33. A secret-read guard on `Read`, `Grep` and `Bash` for dotenv, key and credential files, plus a helper that says whether a key is set and never prints it (S, pro-core)
- [ ] 34. A key-literal guard: block writing a live-looking API key, flag one already on disk, report the line and never the value (S, pro-security)

### P1: every feature through the loop plus safety

- [x] 7. `/execute` guardrails (S, pro-ai-sdlc): intent drafted in [#90](https://github.com/jodybrewster/pro-dev-skillset/pull/90), built in [#98](https://github.com/jodybrewster/pro-dev-skillset/pull/98)
- [x] 8. Spec template additions (S, pro-ai-sdlc): intent drafted in [#90](https://github.com/jodybrewster/pro-dev-skillset/pull/90), built in [#98](https://github.com/jodybrewster/pro-dev-skillset/pull/98)
- [x] 9. Plan template additions and a definition of done (S, pro-ai-sdlc): intent drafted in [#90](https://github.com/jodybrewster/pro-dev-skillset/pull/90), built in [#98](https://github.com/jodybrewster/pro-dev-skillset/pull/98)
- [x] 10. A test-design lens for the verifier (S, pro-ai-sdlc): intent drafted in [#90](https://github.com/jodybrewster/pro-dev-skillset/pull/90), built in [#98](https://github.com/jodybrewster/pro-dev-skillset/pull/98)
- [x] 11. Untrusted-input rules for browser and error output (S, pro-testing, pro-execution): intent drafted in [#91](https://github.com/jodybrewster/pro-dev-skillset/pull/91), built in [#97](https://github.com/jodybrewster/pro-dev-skillset/pull/97)
- [x] 12. Doubt-driven step in `/execute` (M, pro-ai-sdlc): built as [doubt-driven-execute](../intent/2026-10-30-doubt-driven-execute/spec.md), intent drafted in [#93](https://github.com/jodybrewster/pro-dev-skillset/pull/93), built in [#102](https://github.com/jodybrewster/pro-dev-skillset/pull/102)
- [x] 13. Codex as a second reviewer (M, pro-quality, pro-core): intent drafted in [#94](https://github.com/jodybrewster/pro-dev-skillset/pull/94), built in [#99](https://github.com/jodybrewster/pro-dev-skillset/pull/99)
- [x] 14. Required documents per project (L, pro-core, pro-ai-sdlc, pro-quality): intent drafted in [#95](https://github.com/jodybrewster/pro-dev-skillset/pull/95), built in [#103](https://github.com/jodybrewster/pro-dev-skillset/pull/103)
- [ ] 35. Reviewer memory: grade each earlier finding fixed, not fixed or no longer applies at the new head before the fresh pass, then review merge-base to head instead of the first and last uncovered commit (M, pro-ai-sdlc, pro-ship)
- [ ] 36. The reviewer's model goes into the review record and the pr-check stamp; `/ship` and `factory verify` refuse a review that did not run on Opus (S-M, pro-ship, pro-ai-sdlc)
- [ ] 37. A human confirmation bound to the PR head, which clears a check left at `confirm` (M, pro-ship)
- [ ] 38. A readiness check in the `/ship` preflight that rejects a rollback or verify step that is not a runnable command (S, pro-ship)
- [ ] 39. Validate each finding against the callers, guards and tests that reach the changed code; keep contradicting evidence in the doubt step's review unit (S, pro-quality, pro-ai-sdlc)
- [x] 40. The staged-secret check in `/ship`'s security checklist prints matching lines, so a secret lands in the log; list file names only (S, pro-ship): shipped in [#190](https://github.com/jodybrewster/pro-dev-skillset/pull/190) as [guard-hardening m1](../intent/2026-11-07-guard-hardening/plan-m1.md)
- [ ] 41. A test-gap ledger in `test-engineer`: each acceptance criterion mapped to an assertion or `none`, exact edge-case values and a step that tests the tests (M, pro-quality)
- [ ] 42. A retry path for a factory run that errored before opening a PR, with an attempt cap per intent that escalates to level 3 (M, pro-ai-sdlc)
- [ ] 43. A delete-outside-project guard for `rm`, `find -delete` and `git clean`, with temp folders exempt (M, pro-core)

### P2: situational, or past one person

- [x] 15. `/ship` preflight with a go/no-go verdict (M, pro-ship): built in [#124](https://github.com/jodybrewster/pro-dev-skillset/pull/124) as [2026-10-31-ship-preflight](../intent/2026-10-31-ship-preflight/spec.md), see [Now](#now)
- [ ] 16. `pipeline`: the gate as required CI checks (L, pro-ship)
- [ ] 17. Architecture review with twelve-factor (L, pro-quality)
- [x] 18. Specialist agents: security finder and web-performance auditor (M, pro-security, pro-quality): `test-engineer` and `web-performance-auditor` built in [#124](https://github.com/jodybrewster/pro-dev-skillset/pull/124); `security-architect` in diff mode is the finder; [specialist-agents](../intent/2026-10-28-specialist-agents/intent.md) is done
- [ ] 19. Source-driven development and a docs cache (M, pro-execution)
- [ ] 20. Installed skills declare runnable checks (M, pro-core, stack plugins)
- [ ] 21. The scaling block and `repo-hygiene` (M, pro-ship)
- [ ] 22. Reviewer evals from past bugs (M, this repo)
- [ ] 44. Worktree cleanup that finds merged branches four ways, keeps unmerged work and writes a recovery file before it deletes (M, pro-ai-sdlc)
- [ ] 45. Verified role identity: check the `gh api user` login against the role map before acting (M, pro-ai-sdlc)
- [x] 46. Done means on the base: `factory.py record --state merged` checks the SHA is on the fetched base; plan-sync writes `Done as of <sha>` (S, pro-ai-sdlc): built in [#173](https://github.com/jodybrewster/pro-dev-skillset/pull/173)
- [x] 47. `factory.py level` scans only added lines for stop-list words (S, pro-ai-sdlc): built in [#173](https://github.com/jodybrewster/pro-dev-skillset/pull/173) as a scan of the requirement sections
- [x] 48. A CI matrix with macOS and Python 3.9 for the hook tests (S, this repo): built in [#175](https://github.com/jodybrewster/pro-dev-skillset/pull/175) as a path-filtered `hooks-macos` workflow
- [x] 49. `/constraints` runs each check against a known violation and a clean control before it calls the check enforced (S, pro-quality) [#174](https://github.com/jodybrewster/pro-dev-skillset/pull/174)

### P3: small polish, one batch

- [ ] 23. Re-sync `interview-me` and `idea-refine` (S, pro-pdd)
- [x] 24. `/adr` convention detection and a Deprecated status (S, pro-ai-sdlc): intent drafted in [#90](https://github.com/jodybrewster/pro-dev-skillset/pull/90), built in [#98](https://github.com/jodybrewster/pro-dev-skillset/pull/98)
- [x] 25. Two guards in the simplifier (S, pro-ai-sdlc): intent drafted in [#90](https://github.com/jodybrewster/pro-dev-skillset/pull/90), built in [#98](https://github.com/jodybrewster/pro-dev-skillset/pull/98)
- [x] 26. Debugging addendum (S, pro-execution): intent drafted in [#91](https://github.com/jodybrewster/pro-dev-skillset/pull/91), built in [#97](https://github.com/jodybrewster/pro-dev-skillset/pull/97)
- [x] 27. An accessibility checklist sidecar (S, pro-design): intent drafted in [#91](https://github.com/jodybrewster/pro-dev-skillset/pull/91), built in [#97](https://github.com/jodybrewster/pro-dev-skillset/pull/97)
- [ ] 28. Two `/fix` tweaks (S, pro-core or user scope)
- [x] 29. Optional capability map in `/spec` (S, pro-ai-sdlc): intent drafted in [#90](https://github.com/jodybrewster/pro-dev-skillset/pull/90), built in [#98](https://github.com/jodybrewster/pro-dev-skillset/pull/98)
- [ ] 50. The reviewer writes two to four hypotheses from the criteria and the raw diff before it reads the builder's claims (S, pro-ai-sdlc, pro-quality)
- [ ] 51. TDD: crash and rollback tests go through the real boundary; the red run must fail for the right reason (S, pro-execution)
- [ ] 52. QA evidence rules: `not captured` plus a reason instead of a blank; no rounding a failing contrast ratio up (S, pro-testing, pro-design)

### Later

- [ ] 30. Domain skills: deprecation and migration, observability, API design, performance, context engineering
- [ ] 31. Release, flags, staged rollout, rollback, merge queue, two-person approval, skeptic pass
- [ ] 53. A duplicate and overlap check before a factory run, once several intents run at once (S-M, pro-ai-sdlc)
- [ ] 54. Finding collection from Sentry and PostHog with one verifier per candidate (L, its own intent)

## How the items group into intents

- Constraints: 1, now its own intent at [intent/2026-10-29-constraint-floor](../intent/2026-10-29-constraint-floor/intent.md).
- Intent A, the PR gate (already planned in the pro-ship brainstorm): 2, 3, 4, 5, 6, then 13.
- The pro-ai-sdlc loop batch: 7, 8, 9, 10, with 24, 25 and 29 riding along. One PR, one version bump.
- Safety batch: 11 with 26 and 27.
- Intent C, docs and architecture (pro-ship brainstorm): 14 and 17.
- Intent B, the rest of pro-ship: 15, 16, 21.
- Specialist agents: 18, done through the `/ship` preflight; the intent is closed.
- Single items: 12, 19, 20, 22, 23, 28.
- Guard hardening: 32, 33, 34, 40 and 43, with a row each in [docs/enforce-mode.md](./enforce-mode.md) so they join the warn period.
- Reaching Done: 35 to 39 and 46, before the board rerun in [Now](#now).
- Small sync batch: 49, 51 and 52.

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
The tier sets review depth and approval: low merges on green, medium and high need the maintainer, an agent's approval never counts and an approval covers one commit.
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
- The verdict rules: a Critical finding is NO-GO unless the maintainer explicitly accepts the risk; no GO without a rollback plan (`:78-82`).
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
Done: `test-engineer` and `web-performance-auditor` shipped in pro-quality with the `/ship` preflight (#124); `security-architect` in diff mode already hunts for findings, so no new security agent was added; `/webperf` was left out because `/ship` dispatches the auditor. Reasons are in the intent's Done section.
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

### Items 32 to 54

Paths in this section are in super-board unless they name agent-skills or this repo.
Both upstreams are MIT; an adapted file keeps a footer and a row in [docs/licenses.md](./licenses.md).
Ported guards run under our warn and enforce modes instead of super-board's plain deny.

- 32: `hooks/guard-protected-push.py` parses refspecs; this repo's `plugins/pro-core/scripts/git-safe.py` matches them by regex and lets `--delete` through.
- 33: `hooks/guard-secrets.py` and `scripts/super-board-env-check.sh`; `.env.example` stays readable and the guard fails open on its own errors.
- 34: `hooks/guard-key-literals.py`; reuse the key patterns in `incident.py` and check it does not double-deny with `push-gate`.
- 35: `skills/super-review/SKILL.md` "Review remembers" and step 3b of `skills/super-board/references/run.md`; our reviewer stays blind to earlier reasoning and a separate step checks the recorded findings at the new head. Fixes the retest finding where a fixed finding came back as Important and `/ship` reviewed the wrong range.
- 36: the retest's Opus-to-Sonnet override passed with no gate; `reviewer.md` sets `model: opus` only in frontmatter.
- 37: `scripts/super-board-approval.py`: only a later reply from a user with write access counts, a label never does and the merge gate re-reads it before merging.
- 38: `scripts/super-board-verification-ready.py` halts before dispatch and keeps state; it would have caught the prose rollback steps that stopped the retest.
- 39: agent-skills #736 and #754 (`353ae84`, `c55b842`) in `code-reviewer.md`, `reviewer.md` and `doubt-driven-development`.
- 40: agent-skills #718 (`30187c1`): `git diff --cached -i -G'password|secret|api_key|token' --name-only` in `plugins/pro-ship/skills/ship/references/security-checklist.md`.
- 41: `skills/super-qa/SKILL.md`, the test-gap check; Opus found two high test gaps in the retest that Sonnet runs missed.
- 42: `run.md` caps rebuilds per root-cause hash and sweeps stranded cards; `factory.py` resumes only when a build or brief PR exists.
- 43: `hooks/guard-delete-outside.py`; `git-safe.py` blocks only `rm -rf` of `/`, `~` and `$HOME`.
- 44: `hooks/cleanup-wt.py`, run at session start only when a base tip moved.
- 49: agent-skills #694 (`ba3d99e`); semgrep and axe can exit 0 on findings. Port its `quality-gate.mjs` only if `/constraints` gains a tool table.
- 51: agent-skills #750 (`2b14012`) and `skills/super-qa/references/iteration-preamble.md`.
- 52: `skills/super-qa/SKILL.md` evidence rules and agent-skills #733 (`57bfe5d`).

Not taken from super-board: the GitHub Projects board machinery (waves, card claims, quota guard, merge lock), model ladders and the router, hooks merged into `.claude/settings.json` (breaks the hook-loading law), `eval` of config commands in its merge gate, `ui-refine-loop` (about 2M tokens for five rounds), its emoji commit format and its `pr-security-review`, a verbatim port of anthropics/claude-code-security-review that `security-architect` in diff mode already covers.
Not taken from agent-skills 0.6.15: the `simplify-ignore` hook fixes (we skip the hook), the context-capacity note, the eval runner changes, the error-boundary typing and the security and git-workflow description tweaks, since none has a counterpart here.

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
| code-reviewer | Reviews a change on correctness, readability, architecture, security and performance | pro-quality `code-reviewer` (opus) | 3 |
| security-auditor | Finds vulnerabilities, models threats, suggests hardening | pro-security `security-architect` in diff mode finds; `security-auditor` judges one finding | 18 |
| test-engineer | Plans test strategy, writes tests, analyzes coverage | pro-quality `test-engineer` (opus) | 10, 18 |
| web-performance-auditor | Audits Core Web Vitals, loading, rendering and the network | pro-quality `web-performance-auditor` (opus) | 18 |

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

