# ADR-0011: Review rounds converge

Date: 2026-10-30

## Status

proposed

Decided by: Jody Brewster.
Source: intent/2026-10-29-review-policy/.

## Context

An agent author and an agent reviewer can loop for fifty rounds overnight.
Each nit becomes a commit and each commit becomes another round.
`/pr-babysit` was that loop, capped at five rounds.
The `reviewer` agent and `/review` read the whole diff every time, so a later round re-read code an earlier round had cleared and could raise the same finding again.
A class of bug was reported one instance at a time, so each instance cost its own round.
Old bugs in code the PR never touched could block a PR that did not cause them.

## Decision

Later rounds review only the new commits, through `since <sha>` on the reviewer and `--since <sha>` on `/review`.

A finding is never raised twice.
The calling session keeps the list of what was already raised and drops repeats.
The reviewer is not given that list, so it stays a fresh-context reader and the session does the deduping.

A class of bug is named once with every instance in it.
One fix per class closes it.

A finding in code the PR did not change is tagged Pre-existing.
It is listed and never blocks.

`/pr-babysit` stops after three rounds and asks Jody to rethink the approach.
Every round counts toward the cap.

The report opens with one summary line: `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>`.

## Consequences

A PR with an old bug nearby now merges on its own merits and the old bug stays visible in the report.
A bug the first round missed in unchanged code is found only by a fresh full review, which Jody can ask for.
The summary line gives a reader and a script the verdict before the detail.
Five copies of the rules exist (template, agent, TOML, two commands), so the contract check guards them.

What must stay true:

- The reviewer is never handed earlier findings.
- Pre-existing findings never count toward blocking.
- The round cap counts every round, including rounds that only fixed failing checks or merge conflicts.
- The summary line is the first line of every review report.

Revisit if three rounds proves too few on large PRs or if the dedupe list in the calling session loses entries across a long run.

## Alternatives considered

Pass earlier findings to the reviewer.
It would dedupe at the source but it anchors the reviewer on what the last round saw and ends the fresh-context read.

Keep five rounds.
Each extra round is another chance for a nit to turn into a commit and a new round.
A person also sees the PR later.
The brainstorm put the cap at three.

Use git blame to decide Pre-existing.
It is slow and wrong after a move or a reformat, so the reviewer judges from the diff whether the line changed.

## Where it is enforced

- `plugins/pro-ai-sdlc/templates/REVIEW.md`: the policy every repo gets.
- `plugins/pro-ai-sdlc/agents/reviewer.md` and `plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml`: `since <sha>`, the Pre-existing tag, class reporting and the summary line.
- `plugins/pro-ai-sdlc/commands/review.md`: `--since <sha>`, the already-raised list and the Pre-existing group.
- `plugins/pro-ai-sdlc/commands/pr-babysit.md`: the three-round cap and one fix per class.
- The `sdlc-contract` check in `tests/check.mjs`.
