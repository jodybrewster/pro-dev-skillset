# PR body draft

Write `.pro-dev/ship/pr-body.md` with these four sections from the stamp and the diff, then the marker line below.
Print it.
Never run `gh pr create`.
Write "confirm" beside any claim you could not check.

## Testing

One line per check: the command and its result.
Then say what was `not-found`, `timeout` or `could-not-run` plus what the floor and mutation check recorded.

## Reviews

When the Codex second review ran (`reviewers.codex.status` is `done`), list the findings in four groups from `pr-check.py agree`.
Tag each finding with its source: `[Claude, <severity>]` or `[Codex, <severity>]`.
Tag an agreed one `[Claude, Codex]`.

- Raised by both (agreed): one line per pair.
- Raised by both, rated differently: each reviewer's line as written, one under the other.
- Claude only.
- Codex only.

A group with no findings reads "none".
Never say which side of a dispute is right.
The person weighs a Codex finding; it never blocks the merge.

When Codex did not run, write one line: `Codex review: <status> (<reason>)`, taken from `reviewers.codex`.

## Risk

- Tier: the stamp's `tier`, then one line per signal from `risk.signals` (id, floor and evidence).
  A tier of `high` with `risk.could_not_run` true reads "high (classifier could not run: <reason>)".
- Declared risk: the stamp's `risk.declared`, and any `risk-underdeclared` entry from `risk.findings` copied word for word.
  The finding is shown and never fails the run.
- Areas touched: the top-level directories in `git diff --name-only <base>...HEAD`.
- Open findings: floor findings and reviewer findings that are still unresolved, with the counts from the stamp.
- Missing documents: each missing required document with its rule and "Should-fix", from the `documents` line of the report.
  Write "none" only when the check ran and found none, else "not checked (<why>)".
- Docs: each stale doc from the `docs` line of the report, either "updated" or the one-line reason it stays.
  Write "current" when the check found none stale.
- Security surface: the categories the classifier reported, or "none".

## How to revert

`git revert <base>..<head>` with the real shas.
List any migration, config or generated file in the diff and write "confirm" beside each, so the person decides whether a revert needs more than the revert commit.

## Marker line

End the draft with the output of `pr-check.py marker`, alone on the last line and unchanged.
It reads `<!-- pro-ship:pr-check head=<full sha> result=<result> tier=<tier> -->` from the stamp you just wrote.
`/pro-ship:ship` reads it later to tell which PRs a passing pr-check already covered.
When the command exits 1 there is no stamp: say so and leave the line out.
