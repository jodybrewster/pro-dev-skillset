# PR body draft

Write `.pro-dev/ship/pr-body.md` with these four sections from the stamp and the diff.
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
- Security surface: the categories the classifier reported, or "none".

## How to revert

`git revert <base>..<head>` with the real shas.
List any migration, config or generated file in the diff and write "confirm" beside each, so the person decides whether a revert needs more than the revert commit.
