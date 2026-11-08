---
id: PDS-57
source: idea
kind: idea
breaking: false
status: draft
risk: medium
level: 2
created: 2026-11-07T13:54:09-0500
author: the maintainer
---

# Intent: grade real sessions and improve the skills and the loop from them

Author: the maintainer.
Source: idea.
Status: draft.
Created: 2026-11-07, rewritten 2026-11-08 after the talk "Your AI Agent Is Hiding Its Mistakes From You" (Ben Holmes, Warp, AI Engineer, 2026-11-06, https://www.youtube.com/watch?v=pz74r-4dGfQ) and its open-source skill, `skill-doctor` (https://github.com/warpdotdev/common-skills, MIT).
Related: [docs/evals.md](../../docs/evals.md), [ADR-0009](../../docs/decisions/0009-three-eval-tiers.md), [docs/loop-records.md](../../docs/loop-records.md), [ADR-0023](../../docs/decisions/0023-loop-records.md), the Harness² paper (arXiv 2610.14224) and its code at `~/Projects/harness2` (Apache 2.0).

## Problem

The maintainer wants to score and grade what the skills and the `pro-ai-sdlc` loop actually produce, so that the skills and the loop improve from evidence instead of from memory.
Today nothing in the marketplace reads a finished session back.
CI tells whether a skill routes; `tests/behavioral.mjs` can run 7 of 99 skills against a written case, last run on 2026-10-29; `/review` writes lessons about findings in a diff.
None of them look at the sessions that ran in this checkout, the mieruka checkout or a user's repo: 43 Claude Code sessions for this project alone and 157 project folders under `~/.claude/projects`, plus Codex rollouts.

The talk names the failure this leaves open: an agent that hits a stale instruction works around it in silence and reports success.
In the speaker's example an outdated test-harness instruction cost about two minutes of port discovery on every run and nobody saw it until the traces were scored.
The same shape exists here.
A `/execute` run that re-reads files, re-runs the verify command three times or rewrites a PR body by hand leaves no mark anywhere a person looks, and a skill whose description never fires is indistinguishable from a skill that works.
Each merged skill edit is a guess with no before and after number.

The talk's method, which Warp runs as its factory's self-improvement loop and ships for free as `skill-doctor`:

1. Collect every agent conversation in one place: the transcript, every tool call with its output and the final output (diff or PR).
2. Score each conversation with an LLM judge against short Markdown rubrics the team writes; each rubric has labels, a score per label and a one to three sentence reason that cites the transcript.
   The shipped rubrics are efficiency, code quality, procedure compliance (did the agent follow the rules and skills in scope) and verbosity; the talk also scores redundant tests.
3. Aggregate pass and fail rates per criterion over time, so an inflection can be traced to a merged change.
4. On a schedule, sample recent conversations, keep the failures and hand them to an agent with the skills repo, which opens pull requests against skills and config.
   The guidelines refuse a change unless a missing or wrong instruction caused a scored failure and that instruction would have prevented it; "no change" is a normal result.

Harness² (Google Research, 2026) is the research counterpart: it keeps the model fixed and refines the files around it with an answer-free proposer, probing candidates on the same task and composing from how the runs differed.
Its code targets Linux, Vertex AI, OpenCode and Codex and three benchmarks, so it stays a reference for the method.

## Proposed outcome

A person with this marketplace installed can grade their recent sessions in one command and read a report card for the repo: a grade per rubric, three findings with the session and the moment behind each, and proposed skill edits as diffs.
The same command, pointed at this repo and at mieruka, grades the loop itself: `/intent`, `/spec`, `/plan`, `/execute`, `/review`, `/pr-babysit` and `/ship` sessions get scored on whether they followed their own command, how much rework they caused and how much the person had to steer.

Each run writes a score record that mieruka's board can show beside the change it belongs to, so a card carries how well its sessions ran, not only whether they finished.
A score history lives in the repo per plugin and per command, so a pull request that edits a skill shows the before and after.

A second mode runs the improvement half: it takes the failed sessions, clusters them by root cause, verifies each against the current skill text and drafts a pull request per skill whose evidence clears the bar.
The proposer never sees the rubric scores or the grader reasoning; it sees the transcripts and the current skill, and the grader runs again afterwards to confirm the revision scores at least as well.
This is Harness²'s answer-free rule and the guard against a skill tuned to one session.

Scores come in two layers.
The process score reads the transcript, as above.
The outcome score reads the deliverable: the visual check against the plan's mock, the accessibility audit, the web performance auditor and a spec-fit rubric in which a judge reads `spec.md` and the finished artifact and grades each success criterion as met, partly met or missed, with evidence.
A card then shows how well the sessions ran and how well what they built matches what was asked.

Two sample projects are the first graded subjects.
The landing page already exists: `demo/app` is the Next.js and Tailwind marketing page built through the skills as the install proof of concept, with its build trail in `demo/LIFECYCLE.md`, so it is graded as it stands and any change to it goes through the board as a card.
The todo app is new, built through the board as its own card with its own tests; the factory demo's tiny-tasks fixture is a library with no UI and stays as it is.
The landing page's outcome score rests on the visual, accessibility, performance and spec-fit checks, the todo app's adds its test suite.
Their sessions seed the process history and their artifacts prove the outcome rubrics before either is run on this repo or mieruka.

A new skill still ships with a routing case.
A behavioral case is wanted for the skills the loop depends on, but it is no longer the gate for every skill, because real sessions are the primary signal from here and a written case is the fallback where no sessions exist yet.

## Affected users and systems

- `pro-quality`: the new grading command and its improvement mode, the rubric files and the collector script. The name `skill-doctor` is taken by a built-in Claude Code command since 2.1.314, which shows skill usage and context cost in the Stats tab, so the command here needs another name.
- `pro-ai-sdlc`: a rubric per command, written from the command's own steps, so procedure compliance can be judged against what the command says it does; the score record as a seventh loop record in [docs/loop-records.md](../../docs/loop-records.md) with `change_id` on it.
- `tests/behavioral.mjs` and `evals/`: unchanged in function; `evals/results/` is joined by a committed score history.
- `docs/evals.md` and [ADR-0009](../../docs/decisions/0009-three-eval-tiers.md): a fifth tier, session grading, which runs on demand like the paid ones.
- `docs/licenses.md` and `plugins/pro-quality/LICENSE`: rows for the `skill-doctor` rubrics and collector (MIT, Denver Technologies, Inc.) and for any Harness² prompt text reused (Apache 2.0).
- `pro-design` and `pro-quality`'s auditors: run on the sample apps as part of the outcome score; making them run on UI pull requests is [ui-reviews-on-ui-diffs](../2026-11-07-ui-reviews-on-ui-diffs/intent.md) and stays there.
- `demo/`: `demo/app` is graded as the landing page sample; a todo app sample joins it beside the tiny-tasks factory fixture.
- mieruka: reads the score record; no change to its schema, because the record is an evidence manifest like the other six.
- Every user of the marketplace: one new command that reads their local history and uploads nothing.

## Constraints

- Transcripts never leave the machine. Scoring runs in the local session or in local subagents; the only shareable artifact is the report. The shipped `skill-doctor` states this rule and it holds here.
- Paid steps run only when the person says yes: the command shows the sessions it sampled, the rubric count and the estimated cost, then waits. It never runs from a hook, in CI or on a PR.
- Scoring batches transcripts the way the upstream does (one batch up to 50, parallel batches of 20 above that) to keep cost at a few dollars per run; the person sets a cap per run.
- Rubrics are short Markdown with labels, scores and a reason format, start from the four upstream ones and grow one at a time; the rubric for redundant tests from the talk is the first addition, because this repo's reviews have flagged over-testing before.
- The proposer and composer never see the grader's output; the grader confirms after a revision exists. A proposal touches only the skill's own folder, its catalog description and the plugin's version; anything else is rejected.
- The improvement guidelines from upstream are kept whole: no change when the instruction was already right and the model ignored it, when the failure is model variance, when the only edit is a restatement or when the real fix is code. "No change" is reported per finding with the reason.
- Score records follow [docs/loop-records.md](../../docs/loop-records.md): a mieruka evidence manifest under `.pro-dev/`, dropped into `.mieruka/evidence/` when that folder exists and is ignored.
- Harness² stays a reference. No Python dependency on it, no benchmark adapter. The collector is adapted from `skill-doctor`'s stdlib-only `collect_sessions.py` with its footer and licenses row; the Warp, Pi, Grok, ZCode and Hermes readers are dropped and Claude Code plus Codex are kept.
- The grader runs on Sonnet as `behavioral.mjs` does; the proposer on Opus; the version-bump law, Codex parity and the one-hooks-file law apply.
- The collector joins a session to its change through the `cwd`, `gitBranch` and `timestamp` fields every transcript record carries, and walks every project folder whose `cwd` resolves to the repo, because each worktree and each factory container run has its own folder under `~/.claude/projects`. The upstream collector filters by one repo path and would miss them.
- Every score record names the rubric version it was produced under. A history is only compared within one rubric version; a backfill is a re-run of the whole retained window under the current version, never an import of older scores.
- Claude Code deletes transcripts after `cleanupPeriodDays`, 30 by default, so the retained window is the ceiling on any backfill. Raising it is a setting on the person's machine, noted in the command's docs, not something the plugin changes.

## Out of scope

- Running Harness²'s benchmarks or its propose-probe-compose at task time inside a real `/execute` run.
- A hosted dashboard. The history is files in the repo and the board shows the record mieruka already reads.
- Grading sessions from Warp, Pi, Grok Build, ZCode or Hermes.
- Running the accessibility and performance auditors on every UI pull request; that is the ui-reviews-on-ui-diffs intent.
- Changing `claude plugin eval`, the routing tiers or the built-in `/skill-doctor`.
- Backfilling a behavioral case for every skill.
- Merging a proposed skill edit without a person; the improvement mode opens pull requests and stops.

## Success looks like

- One grading run over this repo's last 45 days of sessions produces a report with a grade per rubric, three findings each citing a session and a moment, and at least one proposed diff or a written "no change" per finding, with the cost shown and accepted before it ran.
- The same run over the mieruka checkout scores `pro-ai-sdlc` command sessions against their command's own rubric and one finding names a step a command skipped or worked around.
- The score record for a graded change shows on its mieruka card.
- The todo app reaches Done through the board with a process score and an outcome score on its card, and the existing landing page gets an outcome score made of the visual, accessibility, performance and spec-fit checks.
- A deliberate regression to a skill body, opened as a pull request, shows a lower score against the committed history on the next grading run.
- A backfill run over the full retained window (sessions from 2026-10-10 onward on 2026-11-08, across the main checkouts, worktree folders and factory runs) writes one score record per session with its `change_id`, committed as the first history.
- `tests/check.mjs` and the strict validates stay green; the new scripts have unit tests under `tests/unit/`.

## Open questions

- The command's name, since `skill-doctor` is taken: `/pro-quality:grade`, `/retro` or another; `/spec` decides.
- Whether the per-command rubrics for `pro-ai-sdlc` are generated from each command's steps or written by hand; generated keeps them in step with the command, hand-written keeps them short.
- How many sessions per run give a usable rate without the cost running past a few dollars; the maintainer sets the cap.
- Whether the score history is one file per plugin or one per skill and command.
- Whether the daily schedule runs as a `/loop` in a local session or stays a manual command until the first few reports prove the rubrics; the talk recommends continuous, the cost rule here says manual first.
- Whether the spec-fit rubric grades the success criteria in `spec.md` as written or asks `/spec` to write them in a gradable form from now on.
- Likely needs an ADR: session grading is the fifth eval tier and the primary signal for skill quality, with written cases as the fallback.

## Evidence

None beyond the counts above: 43 sessions for this project and 157 project folders under `~/.claude/projects` on 2026-11-08, 7 behavioral cases in `evals/cases/`, results last recorded 2026-10-29.
