# ADR-0028: Session grading is the fifth eval tier and the primary signal for skill quality

Status: proposed
Date: 2026-11-08
Decided by: the maintainer
Source: PDS-57, intent/PDS-57-skill-improve-loop/

## Context

The repo has three eval tiers ([ADR-0009](./0009-three-eval-tiers.md)): keyless routing gates CI, model routing and behavioral evals run on demand and a new skill has to ship a routing case and, where one exists, a behavioral case.
None of them read a finished session back.
CI says whether a skill routes; `tests/behavioral.mjs` runs 7 of 99 skills against a written case; `/review` writes lessons about findings in a diff.
So an agent that hits a stale instruction, re-reads files, re-runs the verify command or rewrites a PR body by hand leaves no mark anywhere a person looks, and a merged skill edit is a guess with no before-and-after number.
The method from the talk "Your AI Agent Is Hiding Its Mistakes From You" (Warp, 2026-11-06) and its open-source `skill-doctor` scores real agent conversations against short rubrics, aggregates pass and fail rates over time and, on the failures, drafts changes to the skills; Harness-squared (Google Research, 2026) is the answer-free research counterpart.
The constraint pulling against adoption is cost and privacy: scoring spends model tokens and reads local transcripts that must never leave the machine.

## Decision

Session grading is the fifth eval tier.
It reads recent local Claude Code and Codex sessions, scores each against short Markdown rubrics with an LLM judge and reports a grade per rubric with findings that cite the transcript and the deliverable.
It runs on demand only, behind a shown cost and a person's yes, never in CI, from a hook or on a pull request.
Real sessions are the primary signal for skill quality from here.
A new skill still ships a routing case, but a behavioral case is wanted only for the skills the loop depends on and is no longer the gate for every skill, because a written case is the fallback where no sessions exist yet.
Each run writes a score record that is a mieruka evidence manifest under the `docs/loop-records.md` contract and names the rubric version it was produced under.
A committed score history, kept outside `plugins/` so a run does not trip the version-bump law, is compared only within one rubric version.

## Consequences

A skill edit can show a before-and-after number against the committed history, and a stale instruction an agent silently worked around becomes a scored, cited finding.
`docs/evals.md` gains the tier and `ADR-0009`'s gate for a per-skill behavioral case softens to a want for the loop's own skills.
The improvement half can draft skill changes from evidence, under the answer-free rule that the proposer never sees the grader's scores.
What becomes harder: a run spends tokens and reads transcripts, so the cost gate and the no-upload rule have to hold on every path.
What must stay true: no transcript leaves the machine, no paid step runs without a yes and no proposed skill edit merges without a person.

## Alternatives considered

- Keep the three tiers and a behavioral case as the gate for every skill: rejected because it never reads a real session and a written case for 99 skills is the backfill the intent rules out.
- Run grading continuously on a schedule from the start: deferred because the cost rule says manual first until the first reports prove the rubrics.
- Depend on Harness-squared's code or a benchmark adapter: rejected; it stays a reference with no Python dependency.

## Where it is enforced

Not enforced yet.
The tier is documented in `docs/evals.md`, the score record in `docs/loop-records.md` and `tests/mieruka-sync.mjs`, and the cost gate and no-upload rule live in the `/pro-quality:grade` command; none of them is a blocking gate, in keeping with the on-demand, token-spending nature of the tier.
