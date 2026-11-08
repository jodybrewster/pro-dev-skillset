---
intent: intent.md
intent-status: draft
status: draft
created: 2026-11-08T17:25:05-0500
author: the maintainer
---

# Spec: grade real sessions and improve the skills and the loop from them

Built from `intent.md` in this folder (commit bdac455006d53c91997b17036e2175a97605acc4).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `docs/evals.md`, `docs/loop-records.md`, [ADR-0009](../../docs/decisions/0009-three-eval-tiers.md), [ADR-0023](../../docs/decisions/0023-loop-records.md), [ADR-0024](../../docs/decisions/0024-escalation-levels.md), [ADR-0026](../../docs/decisions/0026-change-ids.md), [ADR-0002](../../docs/decisions/0002-version-bump-law.md) (version-bump law), [ADR-0003](../../docs/decisions/0003-one-hooks-json-per-plugin.md) (hook-loading law), [ADR-0004](../../docs/decisions/0004-codex-parity.md) (Codex parity), `docs/licenses.md`.

## Summary

A person with this marketplace installed gains one new command in `pro-quality` that reads their recent local Claude Code and Codex sessions, scores each against short Markdown rubrics with an LLM judge and prints a report card for the repo: a grade per rubric, three findings each citing a session and a moment, and proposed skill edits as diffs.
A second mode of the same command takes the failed sessions, clusters them by root cause, verifies each against the current skill text and drafts a pull request per skill whose evidence clears the bar, never merging.
A score record joins the six loop records as a seventh, so a mieruka card shows how well a change's sessions ran and how well what they built matches what was asked, and a committed score history lets a skill edit show its before and after.
Two sample apps, the existing `demo/app` landing page and a new todo app, are the first graded subjects and seed the process and outcome history before the command runs on this repo or mieruka.
Transcripts never leave the machine, the paid steps run only on a person's yes and nothing here runs in CI, from a hook or on a pull request.

## Assumptions

All unconfirmed; no one was available to answer when this spec was written.

1. Stack: the collector and the score-history tooling are Python 3 stdlib-only scripts under `plugins/pro-quality/scripts/`, matching the existing scripts there, and the grading and improvement flows are driven by a command skill plus the repo's Node test harness, not a new runtime.
2. The grader runs on Sonnet as `tests/behavioral.mjs` does and the proposer and composer run on Opus, as the intent states; this is the intent's explicit model split and overrides the general builders-on-Opus note for the grader only.
3. Session transcripts are the JSONL files Claude Code writes under `~/.claude/projects/<folder>/` and the Codex rollouts, each record carrying `cwd`, `gitBranch` and `timestamp`; Claude Code prunes them after `cleanupPeriodDays` (30 by default), so the retained window is the ceiling on any backfill.
4. Scale: tens of sessions and up to a few hundred project folders per machine (43 sessions and 157 project folders here on 2026-11-08); batching keeps a run to a few dollars.
5. Who uses it: the maintainer and any user of the marketplace, each grading only their own local history, uploading nothing.
6. The command name is `/pro-quality:grade`, with the improvement half reached as a mode of the same command; `/spec` is the stage that decides the name (see Open questions).
7. mieruka reads the score record through its existing evidence-manifest sync with no schema change, as the intent states.

## Requirements

### Functional

The grading command and its collector

- R1. `pro-quality` ships one new command, `/pro-quality:grade`, that grades the repo's recent sessions and prints a report card. (intent: Proposed outcome para 1; Affected users `pro-quality`)
- R2. The command's default (process) mode produces a grade per rubric, exactly three findings each naming the session and the moment behind it, and at least one proposed diff or a written "no change" per finding. (intent: Proposed outcome para 1; Success looks like bullet 1)
- R3. A stdlib-only collector script, adapted from `skill-doctor`'s `collect_sessions.py`, gathers each session's transcript, every tool call with its output and the final output (diff or PR) into one place; the Warp, Pi, Grok, ZCode and Hermes readers are dropped and the Claude Code and Codex readers are kept. (intent: Constraints "The collector is adapted..."; Out of scope "Grading sessions from Warp...")
- R4. The collector walks every project folder under `~/.claude/projects` whose `cwd` resolves to the target repo, so worktree folders and factory-container folders are included, not only the one folder whose path equals the repo. (intent: Constraints "The collector joins a session...")
- R5. The collector joins a session to its change through the `cwd`, `gitBranch` and `timestamp` fields each transcript record carries. (intent: Constraints "The collector joins a session...")
- R6. Scoring uses short Markdown rubrics, each with labels, a score per label and a one to three sentence reason that cites the transcript. (intent: the talk's method step 2; Constraints "Rubrics are short Markdown...")
- R7. The command ships the four upstream rubrics (efficiency, code quality, procedure compliance, verbosity) and adds the redundant-tests rubric as the first new one; rubrics grow one at a time. (intent: Constraints "Rubrics are short Markdown... the rubric for redundant tests... is the first addition")
- R8. Before any paid step the command shows the sessions it sampled, the rubric count and the estimated cost, then waits for a yes; it never runs from a hook, in CI or on a pull request. (intent: Constraints "Paid steps run only when the person says yes")
- R9. Scoring batches transcripts as the upstream does (one batch up to 50, parallel batches of 20 above that) and the person sets a cap per run. (intent: Constraints "Scoring batches transcripts...")
- R10. Transcripts never leave the machine: scoring runs in the local session or in local subagents and the only shareable artifact is the report. (intent: Constraints "Transcripts never leave the machine")

The improvement mode

- R11. The improvement mode takes the failed sessions, clusters them by root cause, verifies each cluster against the current skill text and drafts one pull request per skill whose evidence clears the bar, then stops without merging. (intent: Proposed outcome para 3; Out of scope "Merging a proposed skill edit without a person")
- R12. The proposer and composer never see the grader's scores or reasoning; they see the transcripts and the current skill, and the grader runs again after a revision exists to confirm the revision scores at least as well as before. (intent: Proposed outcome para 3; Constraints "The proposer and composer never see the grader's output")
- R13. A proposal touches only the skill's own folder, its catalog description and the plugin's version; a proposal that would touch anything else is rejected. (intent: Constraints "A proposal touches only the skill's own folder")
- R14. The improvement guidelines from upstream are kept whole, so no change is made when the instruction was already right and the model ignored it, when the failure is model variance, when the only edit is a restatement or when the real fix is code; "no change" is reported per finding with its reason. (intent: Constraints "The improvement guidelines from upstream are kept whole")

The outcome score

- R15. A second scoring layer reads the deliverable rather than the transcript: the visual check against the plan's mock, the accessibility audit, the web performance auditor and a spec-fit rubric. (intent: Proposed outcome paras 4 to 5)
- R16. The spec-fit rubric has a judge read `spec.md` and the finished artifact and grade each success criterion as met, partly met or missed, with evidence. (intent: Proposed outcome para 5)

Score record, history and the loop

- R17. Each grading run writes a score record that is a mieruka evidence manifest under `.pro-dev/`, dropped into `.mieruka/evidence/<evidence_key>/` only when that folder exists and `git check-ignore` reports it ignored, following `docs/loop-records.md`. (intent: Affected users `pro-ai-sdlc`; Constraints "Score records follow docs/loop-records.md")
- R18. The score record is the seventh loop record documented in `docs/loop-records.md`, uses only mieruka's existing kinds and the four statuses, keeps `detail_json` a string, carries `change_id` when one is found and names the rubric version it was produced under. (intent: Affected users `pro-ai-sdlc`; Constraints "Every score record names the rubric version")
- R19. `docs/loop-records.md`, the writer and `tests/mieruka-sync.mjs` change together, and one score record loads through mieruka's `syncFromFilesystem` in that test. (intent: Affected users mieruka; ADR-0023 consequences; loop-records.md "Checking against mieruka")
- R20. A committed score history lives in the repo, keyed by plugin and by skill or command, so a pull request that edits a skill shows the before and after; the history is not written under `plugins/<name>/`, so a grading run does not trip the version-bump law. (intent: Proposed outcome para 2; Success looks like "a pull request that edits a skill shows the before and after")
- R21. A score history is compared only within one rubric version, and a backfill is a re-run of the whole retained window under the current rubric version, never an import of older scores. (intent: Constraints "A history is only compared within one rubric version")
- R22. `pro-ai-sdlc` gains one rubric per loop command (`/intent`, `/spec`, `/plan`, `/execute`, `/review`, `/pr-babysit`, `/ship`), written from that command's own steps, so procedure compliance is judged against what the command says it does. (intent: Proposed outcome para 1; Affected users `pro-ai-sdlc`)

Evals, routing and the sample apps

- R23. Session grading is documented in `docs/evals.md` as a fifth tier that runs on demand like the paid ones, and `ADR-0009` is updated or superseded to record it. (intent: Affected users `docs/evals.md` and ADR-0009; Open questions "Likely needs an ADR")
- R24. A new skill still ships with a routing case; a behavioral case is wanted for the skills the loop depends on but is no longer the gate for every skill, because real sessions are now the primary signal and a written case is the fallback where no sessions exist yet. (intent: Proposed outcome "A new skill still ships with a routing case")
- R25. `demo/app` is graded as the landing-page sample as it stands, with an outcome score made of the visual, accessibility, performance and spec-fit checks. (intent: Proposed outcome "Two sample projects"; Success looks like "the existing landing page gets an outcome score")
- R26. A new todo app is built through the board as its own card with its own tests, and its outcome score adds its test suite to those four checks; the factory's tiny-tasks fixture is left as it is. (intent: Proposed outcome "The todo app is new"; Success looks like "The todo app reaches Done")
- R27. The sample apps' sessions seed the process history and their artifacts prove the outcome rubrics before the command runs on this repo or mieruka. (intent: Proposed outcome "Their sessions seed the process history")

Licensing

- R28. `docs/licenses.md` and `plugins/pro-quality/LICENSE` gain rows for the `skill-doctor` rubrics and collector (MIT, Denver Technologies, Inc.) and for any Harness-squared prompt text reused (Apache 2.0), and each adapted file keeps its footer. (intent: Affected users `docs/licenses.md` and `plugins/pro-quality/LICENSE`)

### Non-functional

- N1. A full run over the repo's last 45 days of sessions costs a few dollars, held there by the batching in R9 and the per-run cap. (intent: Constraints "to keep cost at a few dollars per run")
- N2. The new scripts are stdlib-only with no Python dependency on Harness-squared and no benchmark adapter; Harness-squared stays a reference. (intent: Constraints "Harness-squared stays a reference")
- N3. `tests/check.mjs`, `node tests/eval.mjs --dry`, the keyless routing gate and the strict validates stay green, and the new scripts have unit tests under `tests/unit/`. (intent: Success looks like "tests/check.mjs and the strict validates stay green")
- N4. The version-bump law, Codex parity and the one-hooks-file law hold for every plugin content change in this work. (intent: Constraints "the version-bump law, Codex parity and the one-hooks-file law apply")

### Policy constraints applied

- Paid model steps run on demand only, never in CI, from a hook or on a pull request ([ADR-0009](../../docs/decisions/0009-three-eval-tiers.md), the no-Claude-in-CI rule): R8 gates every paid step behind a shown cost and a yes.
- Loop records are mieruka evidence manifests with one contract page (`docs/loop-records.md`, [ADR-0023](../../docs/decisions/0023-loop-records.md)): R17 to R19 keep the score record inside that contract, with no new mieruka kind.
- Version-bump law ([ADR-0002](../../docs/decisions/0002-version-bump-law.md)): every content change under `plugins/pro-quality/` and `plugins/pro-ai-sdlc/` bumps that plugin in both manifests, its marketplace entry and `metadata.version`; R20 keeps the score history out of `plugins/` so a run does not trip the law.
- Hook-loading law ([ADR-0003](../../docs/decisions/0003-one-hooks-json-per-plugin.md)): this change adds no blocking hook; the command is invoked by a person, so nothing new is registered in a `hooks/hooks.json`.
- Codex parity ([ADR-0004](../../docs/decisions/0004-codex-parity.md)): the new command and any new agent ship harness-neutral prose, a version-aligned `.codex-plugin/plugin.json` and a `.toml` per agent.
- Forked and adapted content keeps its footer and a `docs/licenses.md` row (`REVIEW.md` pass 3): R28.
- No absolute personal paths or session-folder paths in tracked files (`REVIEW.md` pass 2): the committed score record and history name a session by an opaque id, never by a `~/.claude/projects/...` path (flagged concern 1).

### Boundaries

Always: read the person's local sessions, score them, print a report, write the local `.pro-dev/` score record and propose skill diffs on a branch.
Ask first: spend any model tokens (the cost gate in R8), open a pull request in the improvement mode and build or change a sample app, which goes through the board as a card.
Never: upload or copy a transcript off the machine, run from a hook or in CI, merge a proposed skill edit, let a proposal touch anything beyond the skill folder, its catalog description and the plugin version, or let the proposer see the grader's scores.

## Design

### User experience

A person runs `/pro-quality:grade` in a repo.
The command collects the recent sessions, shows how many it found, the rubric count and the estimated cost and waits.
On a yes it scores in batches and prints a report card: a grade per rubric, three findings each with the session id and the moment, and a proposed diff or a "no change" line per finding.
The same command in its improvement mode clusters the failures, drafts a pull request per skill that clears the bar and stops, leaving the person to review and merge.
The tone of the report is plain and evidence-first: every grade and finding cites the transcript or the deliverable, and "no change" is a normal, reported result.

### System

New under `plugins/pro-quality/`: the `grade` command, the rubric files, the collector script (adapted from `skill-doctor`), the spec-fit and outcome-score logic and a `LICENSE` row; the plugin version bumps.
New under `plugins/pro-ai-sdlc/`: one rubric per loop command and the score-record writer joined to `docs/loop-records.md`; the plugin version bumps.
Reused and named: `tests/behavioral.mjs` and `evals/` (unchanged in function, joined by the committed score history), the visual check (`visual.py`), the accessibility audit, the `web-performance-auditor` agent and the existing `.pro-dev/` drop rule from `docs/loop-records.md`.
`docs/evals.md` gains the fifth tier, `docs/loop-records.md` gains the seventh record, `tests/mieruka-sync.mjs` gains the score record and `tests/unit/` gains cover for the new scripts.
The score history lives outside `plugins/` (under `evals/`, beside `evals/results/`) so a run does not fire the version-bump law.
mieruka reads the score record through its existing manifest sync with no schema change.

### Alternatives considered

- Name the command `skill-doctor`: lost because a built-in Claude Code `/skill-doctor` has existed since 2.1.314 (intent: Affected users `pro-quality`).
- Write the score history under `plugins/<name>/`: lost because every grading run would then trip the version-bump law and demand a plugin bump (flagged concern 3).
- Add a new mieruka kind for the score record: lost because mieruka stops its sync on one unknown kind, so the record reuses an existing kind (flagged concern 2; ADR-0023).
- Depend on Harness-squared's code or a benchmark adapter: lost because the intent keeps it a reference with no Python dependency (N2).
- Keep a behavioral case as the gate for every skill: lost because real sessions become the primary signal and the written case is the fallback (R24).

## Flagged concerns

Reviewers start here.

ADR needed: yes, session grading is the fifth eval tier and the primary signal for skill quality with written cases as the fallback, a rule all later skill work follows; the intent's Open questions flag it.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | A committed score record or history could embed an absolute session path (`~/.claude/projects/...`), which `REVIEW.md` pass 2 flags as a personal path and a session-folder finding | `REVIEW.md` pass 2 | resolved: the committed record and history name a session by an opaque id only, never by its filesystem path; the report in the local session may show the path (R2, R17, R20) |
| 2 | The score record adds a seventh loop record, but mieruka accepts only six kinds and four statuses and stops its sync on one unknown kind | `docs/loop-records.md`, [ADR-0023](../../docs/decisions/0023-loop-records.md) | resolved: the record reuses an existing kind (likely `review` or `doc`) and the four statuses, keeps `detail_json` a string and is proved by `tests/mieruka-sync.mjs` (R18, R19) |
| 3 | A score history committed under `plugins/<name>/` would make every grading run a content change and trip the version-bump law | version-bump law, [ADR-0002](../../docs/decisions/0002-version-bump-law.md) | resolved: the history lives under `evals/`, outside `plugins/`, so a run does not fire the law (R20) |
| 4 | The intent runs the grader on Sonnet, which the general model split treats as the subagent tier while the recent note runs builders on Opus | `CLAUDE.md` Model split | resolved: the intent is explicit (grader on Sonnet as `behavioral.mjs`, proposer on Opus) and this spec records it as the decision (R-assumption 2) |

## Open questions

- The command's name, since `skill-doctor` is taken: this spec decides `/pro-quality:grade` with the improvement half as a mode of the same command; the alternatives `/retro` and another name are recorded and the maintainer can overturn the choice at plan or review.
- Whether the per-command `pro-ai-sdlc` rubrics are generated from each command's steps or written by hand: this spec takes hand-written short rubrics seeded from the command's steps (generated keeps them in step but risks length); unconfirmed, open for the maintainer.
- How many sessions per run give a usable rate without the cost running past a few dollars: the person sets the cap per run (R9); a default of 50, the upstream single-batch size, is proposed and the maintainer tunes it.
- Whether the score history is one file per plugin or one per skill and command: this spec takes one file per plugin keyed by skill and command inside it (R20); unconfirmed, open for the maintainer.
- Whether the daily schedule runs as a `/loop` or stays a manual command: this spec keeps it manual first until the first reports prove the rubrics, following the cost rule over the talk's continuous recommendation; open to revisit once the rubrics are proven.
- Whether the spec-fit rubric grades `spec.md`'s success criteria as written or asks `/spec` to write them in a gradable form: this spec grades them as written now (R16) and notes writing gradable success criteria from `/spec` as a possible later card, not part of this change.

## Acceptance criteria

- AC1. One `/pro-quality:grade` run over this repo's last 45 days of sessions prints a report with a grade per rubric, three findings each citing a session and a moment and at least one proposed diff or a written "no change" per finding, with the cost shown and accepted before it ran. (R1, R2, R8)
- AC2. The same command over the mieruka checkout scores `pro-ai-sdlc` command sessions against their command's own rubric and one finding names a step a command skipped or worked around. (R22)
- AC3. The score record for a graded change loads through `tests/mieruka-sync.mjs` and shows on its mieruka card. (R17, R18, R19)
- AC4. The todo app reaches Done through the board with a process score and an outcome score on its card, and the landing page gets an outcome score made of the visual, accessibility, performance and spec-fit checks. (R15, R25, R26)
- AC5. A deliberate regression to a skill body, opened as a pull request, shows a lower score against the committed history on the next grading run. (R20, R21)
- AC6. A backfill run over the full retained window writes one score record per session with its `change_id`, committed as the first history. (R20, R21)
- AC7. `tests/check.mjs`, `node tests/eval.mjs --dry`, the keyless routing gate and the strict validates pass, and the new scripts have unit tests under `tests/unit/`. (N3)
- AC8. The improvement mode, run on a cluster of failed sessions, opens at most one pull request per skill that touches only the skill folder, its catalog description and the plugin version, and the re-graded revision scores at least as well as before. (R11, R12, R13)

## Out of scope

- Running Harness-squared's benchmarks or its propose-probe-compose at task time inside a real `/execute` run.
- A hosted dashboard; the history is files in the repo and the board shows the record mieruka already reads.
- Grading sessions from Warp, Pi, Grok Build, ZCode or Hermes.
- Running the accessibility and performance auditors on every UI pull request, which is the ui-reviews-on-ui-diffs intent.
- Changing `claude plugin eval`, the routing tiers or the built-in `/skill-doctor`.
- Backfilling a behavioral case for every skill.
- Merging a proposed skill edit without a person; the improvement mode opens pull requests and stops.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
