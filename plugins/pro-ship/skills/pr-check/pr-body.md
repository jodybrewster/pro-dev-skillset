# PR body draft

Write `.pro-dev/ship/pr-body.md` with these three sections from the stamp and the diff.
Print it.
Never run `gh pr create`.
Write "confirm" beside any claim you could not check.

## Testing

One line per check: the command and its result.
Then say what was `not-found`, `timeout` or `could-not-run` plus what the floor and mutation check recorded.

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
