# Plan: grade real sessions and improve the skills and the loop from them

Built from `spec.md` (commit bdac455006d53c91997b17036e2175a97605acc4) and `intent.md` in this folder.
Status: draft.
Approver: the maintainer, acting as lead for the architecture decision (the fifth eval tier, ADR-0009 superseded) and the loop-records contract change (a seventh record).
Dated: 2026-11-08.

All assumptions from the spec are carried here unconfirmed; nobody was available to answer when this plan was written, so each open question takes the spec's proposed default and the maintainer can overturn it at review.

This is a large change that spans two plugins, new scripts, a contract change, docs and an ADR.
It is built as phases of small steps, not in one pass.
Two subjects of the work are separate board cards, not steps here: the new todo app (R26, its own card with its own tests) and the daily schedule (left manual per the spec's open question).
The acceptance criteria that need the paid grader to run (AC1, AC2, AC4, AC5, AC6, AC8) are proven by a gated run after the code lands, not by a step that spends tokens unasked; each such step names the run that proves it and the cost gate stands in front of it.

## Files that change

Phase A, foundations (no model tokens):

- `plugins/pro-quality/scripts/collect_sessions.py` (new): the stdlib-only collector, adapted from `skill-doctor`, Claude Code and Codex readers only, walking every `~/.claude/projects` folder whose `cwd` resolves to the repo and joining a session to its change through `cwd`, `gitBranch` and `timestamp`.
- `tests/unit/collect-sessions.test.mjs` (new): unit cover for the collector's folder walk, repo-resolution filter and the cwd/gitBranch/timestamp join, over inline JSONL fixtures.
- `plugins/pro-quality/rubrics/efficiency.md`, `code-quality.md`, `procedure-compliance.md`, `verbosity.md`, `redundant-tests.md` (new): the four upstream rubrics plus the first new one, each short Markdown with labels, a score per label and a one-to-three-sentence reason that cites the transcript.
- `plugins/pro-ai-sdlc/rubrics/intent.md`, `spec.md`, `plan.md`, `execute.md`, `review.md`, `pr-babysit.md`, `ship.md` (new): one procedure-compliance rubric per loop command, written from that command's own steps.
- `plugins/pro-ai-sdlc/scripts/score.py` (new): the score-record writer, reusing `evidence.py` and an existing mieruka kind, carrying `change_id` and naming the rubric version.
- `tests/unit/score.test.mjs` (new): unit cover for the record shape, the kind and status validation, the rubric-version field and the `change_id` strip-on-mismatch.
- `docs/loop-records.md` (modified): the seventh record documented, with its kind, artifact kind, writer and `change_id` source.
- `tests/mieruka-sync.mjs` (modified): one score record written with `score.py` and loaded through mieruka's `syncFromFilesystem`, the count assertion raised and the record's `change_id` recognised.
- `evals/scores/` (new directory, tracked) with one file per plugin keyed by skill and command: the committed score history, outside `plugins/` so a run does not trip the version-bump law.

Phase B, the grade command (process mode):

- `plugins/pro-quality/commands/grade.md` (new): the `/pro-quality:grade` command, harness-neutral prose, that collects sessions, shows the sample, rubric count and estimated cost, waits for a yes, scores in batches on Sonnet and prints the report card.
- `plugins/pro-quality/skills/grade/SKILL.md` (new, if the command body needs a skill): the grading method the command invokes.

Phase C, the outcome score:

- `plugins/pro-quality/rubrics/spec-fit.md` (new): the rubric a judge uses to read `spec.md` and the finished artifact and grade each success criterion met, partly met or missed, with evidence.
- `plugins/pro-quality/commands/grade.md` (modified): the outcome mode wiring the visual check, the accessibility audit, the `web-performance-auditor` agent and the spec-fit rubric into one outcome score.

Phase D, the improvement mode:

- `plugins/pro-quality/commands/grade.md` (modified) and its skill: the improvement mode that clusters failed sessions, verifies each cluster against the current skill text, drafts one pull request per skill that clears the bar and stops, with the answer-free proposer and the re-grade.

Phase E, docs, evals and the ADR:

- `docs/evals.md` (modified): the fifth tier, session grading, run on demand like the paid ones.
- `docs/decisions/0009-three-eval-tiers.md` (modified) and a new `docs/decisions/00NN-session-grading-tier.md` (new): the new ADR superseding or amending 0009 to record session grading as the fifth tier and the primary signal for skill quality, with written cases as the fallback; the decisions index row added.
- `tests/cases/routing.jsonl` (modified) and `tests/cases/uncovered.json` (modified): a routing case for `/pro-quality:grade`, removed from uncovered if listed.

Phase F, version law, Codex parity and licensing:

- `plugins/pro-quality/.claude-plugin/plugin.json`, `plugins/pro-quality/.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (pro-quality entry and `metadata.version`) (modified): the pro-quality version bump.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`, `plugins/pro-ai-sdlc/.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (pro-ai-sdlc entry) (modified): the pro-ai-sdlc version bump.
- `.codex-plugin/agents/*.toml` under each plugin (new): a Codex counterpart for any new agent (only if a new agent is added; the plan prefers reusing the existing `web-performance-auditor`).
- `plugins/pro-quality/LICENSE` and `docs/licenses.md` (modified): rows for the `skill-doctor` rubrics and collector (MIT, Denver Technologies, Inc.) and for any Harness-squared prompt text reused (Apache 2.0), each adapted file keeping its footer.

## Order of work

Phase A, foundations. These three tracks (steps 1 to 2, step 3, steps 4 to 6) touch separate files and can run in parallel worktrees.

1. Write `collect_sessions.py`: port the Claude Code and Codex readers from `skill-doctor`, drop the Warp, Pi, Grok, ZCode and Hermes readers, walk every `~/.claude/projects` folder, keep a session whose records' `cwd` resolves to the repo (so worktree and factory-container folders are included) and emit per session the transcript, each tool call with its output and the final output, joined by `cwd`, `gitBranch` and `timestamp`; keep the upstream footer. (size S; R3, R4, R5, N2, R28)
2. Write `tests/unit/collect-sessions.test.mjs` over inline JSONL fixtures: a folder whose cwd matches is kept, a sibling repo's folder is dropped, a worktree folder resolving to the repo is kept and the join key is read from the record. (size S; N3, AC7)
   Checkpoint: `node --test tests/unit/collect-sessions.test.mjs` passes; `python3 plugins/pro-quality/scripts/collect_sessions.py --repo "$PWD" --dry` lists this repo's sessions and no other repo's.
3. Write the five pro-quality rubrics and the seven pro-ai-sdlc per-command rubrics as short Markdown, each with labels, a score per label and the reason format; seed each pro-ai-sdlc rubric from its command's own steps. (size M, twelve small files of one kind, reason: a single rubric is XS but they share one format and review as one set; R6, R7, R22)
   Checkpoint: each rubric is under a screen, names its labels and scores and cites "the transcript" in its reason line; `node tests/check.mjs` still green.
4. Write `score.py` reusing `evidence.py`: build the record with an existing kind (reuse `review` or `doc`, decided against adding a kind per flagged concern 2), the four statuses, `detail_json` as a JSON string, `change_id` from the intent beside the change and a `rubric_version` field; drop into `.pro-dev/` and mirror to `.mieruka/evidence/` under the existing drop rule. (size S; R17, R18, R20 history-key naming deferred to step 6)
5. Document the seventh record in `docs/loop-records.md` and extend `tests/mieruka-sync.mjs` to write one score record and load it through `syncFromFilesystem`, raising the count assertion and listing the record among those carrying `change_id`. (size S; R18, R19, AC3)
   Checkpoint: `node tests/mieruka-sync.mjs` loads the score record with the right kind and artifact kind and no error; `node --test tests/unit/score.test.mjs` passes.
6. Create `evals/scores/` with one committed file per plugin keyed by skill and command, written by `score.py`, holding only an opaque session id, the rubric version and the scores (never a `~/.claude/projects/...` path), and compared only within one rubric version. (size S; R20, R21, flagged concern 1 and 3)
   Checkpoint: `git check-ignore evals/scores` reports nothing (the folder is tracked); a sample score file carries no absolute path; `node tests/check.mjs` green.

Phase B, the grade command.

7. Write `grade.md` (and its skill if the body needs one) for the default process mode: collect via step 1, show the sampled sessions, the rubric count and the estimated cost, wait for a yes, score in batches (one batch up to 50, parallel batches of 20 above that) on Sonnet with the person's per-run cap, and print a grade per rubric, exactly three findings each naming the session and the moment, and a proposed diff or a written "no change" per finding; never run from a hook, in CI or on a PR. (size M, reason: one command but it carries the cost gate, the batching and the report shape, all in harness-neutral prose; R1, R2, R8, R9, R10)
   Checkpoint: `claude plugin validate plugins/pro-quality --strict` passes; the command's prose names the cost gate, the batch sizes and the three-findings shape; a routing case is added in step 12.

Phase C, the outcome score.

8. Write `spec-fit.md` and wire the outcome mode into `grade.md`: a judge reads `spec.md` and the artifact and grades each success criterion met, partly met or missed with evidence, and the outcome score joins the visual check (`visual.py`), the accessibility audit and the `web-performance-auditor` agent. (size M, reason: two surfaces, the rubric and the command wiring, over four existing checks; R15, R16, R25)
   Checkpoint: `claude plugin validate plugins/pro-quality --strict` passes; the spec-fit rubric grades against `spec.md` success criteria as written (the gradable-criteria option is a later card per the spec).

Phase D, the improvement mode.

9. Wire the improvement mode into `grade.md` and its skill: take the failed sessions, cluster by root cause, verify each cluster against the current skill text, apply the upstream improvement guidelines whole (no change on a right-but-ignored instruction, on model variance, on a restatement or when the fix is code), draft at most one pull request per skill that clears the bar touching only the skill folder, its catalog description and the plugin version, then stop without merging; the proposer and composer never see the grader's scores and the grader re-runs after a revision exists to confirm it scores at least as well. (size L, reason: the answer-free proposer, the clustering, the per-skill PR boundary and the re-grade are one coherent flow that cannot be split without leaving a half-built mode; R11, R12, R13, R14)
   Checkpoint: `claude plugin validate plugins/pro-quality --strict` passes; the command's prose forbids the proposer seeing scores, caps the PR at one per skill and lists the four "no change" reasons.

Phase E, docs, evals and the ADR.

10. Add the fifth tier to `docs/evals.md` and write the ADR that supersedes or amends ADR-0009, recording session grading as the fifth tier and the primary signal for skill quality with written cases as the fallback, plus the decisions index row. (size S, irreversible: supersedes a standing ADR, which is reversed only by another ADR; R23)
    Checkpoint: `node tests/check.mjs` green (the decisions index and the ADR header parse); `docs/evals.md` shows five tiers.
11. Record the behavioral-case policy change: a new skill still ships a routing case, a behavioral case is wanted for the loop-critical skills but no longer gates every skill, because real sessions are now the primary signal and a written case is the fallback where no sessions exist. (size XS; R24)
    Checkpoint: the policy line is in `docs/evals.md` or the ADR and reads consistently with step 10.
12. Add the `/pro-quality:grade` routing case to `tests/cases/routing.jsonl` and remove it from `tests/cases/uncovered.json` if listed. (size XS; R24, N3)
    Checkpoint: `node tests/eval.mjs --dry` and `node tests/route-lexical.mjs --min-rank1 70` pass with the new case.

Phase F, version law, Codex parity and licensing.

13. Add the `skill-doctor` (MIT, Denver Technologies, Inc.) and Harness-squared (Apache 2.0, only if its prompt text is reused) rows to `plugins/pro-quality/LICENSE` and `docs/licenses.md`, and keep each adapted file's footer. (size S; R28)
14. Bump `pro-quality` and `pro-ai-sdlc` in both manifests each, their marketplace entries and `metadata.version`, in the same commit as their content changes, and add a Codex `.toml` for any new agent (none if the existing `web-performance-auditor` is reused). (size S, irreversible: a published version number is superseded only by the next bump, not edited down; N4)
    Checkpoint: `node tests/check.mjs` (versions and codex-manifests checks) green.

Phase G, prove it (gated runs, after the code lands).

15. Run the full verify suite and the gated grader runs that prove the acceptance criteria the model needs: a process run over this repo's last 45 days (AC1), a run over the mieruka checkout for `pro-ai-sdlc` command sessions (AC2), the landing-page outcome score on `demo/app` (AC4 landing page), a deliberate-regression PR scored lower (AC5), a backfill over the retained window writing one record per session (AC6) and the improvement mode on a failed cluster (AC8); each waits behind the cost gate and the todo-app half of AC4 waits on its own board card. (size L, reason: several paid runs, each gated and some depending on a separate card; AC1, AC2, AC4, AC5, AC6, AC8)
    Checkpoint: the full verify block in CLAUDE.md passes; each gated run's report is shown with its cost accepted before it ran; the todo-app outcome score is tracked as its own card, not this one.

## Tests that prove it

- `tests/unit/collect-sessions.test.mjs` covers the folder walk, the repo-resolution filter (match kept, sibling dropped, worktree kept) and the cwd/gitBranch/timestamp join.
- `tests/unit/score.test.mjs` covers the record shape, kind and status validation, the `rubric_version` field and the `change_id` strip on a non-matching id.
- `tests/mieruka-sync.mjs` loads one score record through mieruka's real `syncFromFilesystem` with the right kind and artifact kind and no error.
- `node tests/check.mjs`, `node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70` and the strict validates stay green (N3, AC7).
- The landing-page outcome score against `demo/app` is the visual check at 1280 and 390, the accessibility audit, the `web-performance-auditor` pass and the spec-fit rubric against `demo`'s spec, run under the cost gate (R25, AC4).
- The gated grader runs in step 15 are the behavioral proof of AC1, AC2, AC4, AC5, AC6 and AC8; they spend tokens and run only on a yes.

## Risks

The step most likely to go wrong is step 9, the improvement mode: the answer-free boundary (the proposer never seeing the grader's scores) and the one-PR-per-skill limit are easy to violate in prose, and a proposer that over-reaches would edit outside the skill folder or tune a skill to one session; the guard is the explicit "no change" reasons, the re-grade and the folder-boundary rejection, all stated in the command and checked by eye before any PR is opened.
The next most likely is step 1, the collector: the repo-resolution filter must resolve `cwd` through worktree and factory-container folders without pulling in a sibling repo, and the Codex rollout format differs from Claude Code's; step 2's fixtures cover both the keep and the drop case.
The widest blast radius is the loop-records contract (steps 4 and 5): a seventh record that used a new mieruka kind would stop mieruka's sync on every record, so the plan reuses an existing kind and proves it through `tests/mieruka-sync.mjs` before anything else depends on it.
A committed score record or history could embed an absolute `~/.claude/projects/...` session path, which `REVIEW.md` pass 2 flags; step 6 holds the committed artifact to an opaque session id only, with the path shown in the local report alone.
A score history written under `plugins/<name>/` would make every run a content change and trip the version-bump law; step 6 keeps it under `evals/`.

Stop-list categories: no data migration, no public API change, no auth rule and no deploy or infrastructure config; the one irreversible-grade move is step 10 (supersedes ADR-0009, reversed only by another ADR) and step 14 (a published version number, superseded only by the next bump), both named here and neither a stop-list category.

## Options not taken

- Name the command `skill-doctor`: lost because a built-in Claude Code `/skill-doctor` has existed since 2.1.314; this plan takes `/pro-quality:grade` with the improvement half as a mode of the same command.
- Write the score history under `plugins/<name>/`: lost because every grading run would then trip the version-bump law; it lives under `evals/scores/`.
- Add a new mieruka kind for the score record: lost because mieruka stops its sync on one unknown kind; the record reuses an existing kind.
- Depend on Harness-squared's code or a benchmark adapter: lost because the intent keeps it a reference with no Python dependency; Harness-squared stays a reference.
- Generate the per-command rubrics from each command's steps at runtime: lost because hand-written short rubrics stay in step with the command without risking length; seeded from the steps, written by hand.
- One score-history file per skill and command: lost against one file per plugin keyed by skill and command inside it, the spec's proposed default; the maintainer can overturn it.
- Run the grader on a daily `/loop`: lost for now against a manual command, following the cost rule over the talk's continuous recommendation until the first reports prove the rubrics.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/mieruka-sync.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

All must print their pass lines with zero failures.
The gated grader runs in step 15 each print a report with the cost shown and accepted before the run, and the paid runs happen only on a yes.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: <sha>
- Checks run: <each command with its real result>
- Definition of done: <met, or the items not met> (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more)
- Visual: <one line per visual check: step, viewport, status and any accepted difference; "none" when the plan has no Mock: line>
- Doubt: <one line per doubted step: step, trigger, rounds, Codex ran, skipped or could not run, how each finding was settled; "none" when no step was doubted>
- AC1: <pass or fail, with what was observed>
- Sign-off: <the owner's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves any ADR with Status `proposed` from this change to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

## Noticed but not touched

Problems seen outside a step during the build, one per line: the file, what was seen and why it was left.
/execute copies them into the PR body.
