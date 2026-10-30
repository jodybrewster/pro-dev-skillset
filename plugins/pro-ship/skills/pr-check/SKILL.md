---
name: pr-check
description: Use before opening a pull request, or when asked to "check this", "is this ready for a PR" or "pre-PR check" - runs the repo's own build, lint, typecheck and test commands, the floor guard and a mutation check, dispatches a fresh-context code review (and a security review when the diff touches security surface), writes a stamp bound to HEAD that the PR gate reads and drafts the PR body. Not a replacement for reviewing a diff on request (requesting-code-review) or for merging (merge-pr).
---

# pr-check

Run this on a committed branch before `gh pr create`.
It writes `.pro-dev/ship/pr-check.json` for HEAD and a PR body draft at `.pro-dev/ship/pr-body.md`.
It never opens the PR.
The stamp contract is `docs/pr-check-stamp.md` in the marketplace repo.

Run it before the first push too.
The push gate then reuses the security review in the stamp and does not ask for a second one.

## Setup

Set `CHECK` to the script path.
Ask `pr-check.py find` first, then fall back to the plugin's own folder:

```bash
CHECK="${CLAUDE_PLUGIN_ROOT}/scripts/pr-check.py"
```

If `${CLAUDE_PLUGIN_ROOT}` is empty or not substituted, or the file does not exist, go to "No script" below.
Every subcommand prints JSON and is run from the repo root.

1. Refuse on a dirty tree.
   `git status --porcelain --untracked-files=no` must be empty.
   If it is not, say "commit first, the stamp is bound to a commit" and stop.
2. Find the base: `git merge-base origin/main HEAD` (use the default branch the repo has).
   Record base and head shas with `git rev-parse`.
3. Look for `REVIEW.md` at the repo root.
   When it is missing, say so once and point to `/sdlc-init`.
   Continue anyway.

## Run

1. `python3 "$CHECK" discover` prints the commands and where each came from.
   [discovery.md](./discovery.md) has the order.
2. For each discovered step, one call per step: `python3 "$CHECK" run --step <name>`.
   Use the host's longest command timeout for the call, because one step can take up to 300 seconds.
   A repo raises the per-command limit with a line `pr-check timeout: <seconds>` in `CLAUDE.md` or `AGENTS.md`.
3. Then `python3 "$CHECK" run --step floor`.
   The script finds pro-quality's floor guard and records `pass`, `findings`, `could-not-run` or `not-installed`.
4. Stop on the first step with status `fail`.
   Print the failed command and its output tail, write no stamp and dispatch no reviewer.
   A step with status `timeout` does not stop the run; it makes the result `incomplete`.
5. Mutation check: `python3 "$CHECK" run --step mutation`.
   It runs when the diff touches non-test code and the tier is not `low`.
   The tier is `unclassified` for now, so it runs whenever non-test code changed.
   The script inverts one condition, reruns the related tests and restores the file.
   Confirm `git status --porcelain --untracked-files=no` is empty afterwards.
   If it is not, run `git checkout -- <file>` for each listed file and report it.
   `survived` makes the result `incomplete` until the person confirms.
   Ask once.
   On a yes, add `--accept-mutation` to the stamp call.

## Reviews

### Security surface

Classify the diff with pro-security's classifier:

```bash
SURFACE=$(python3 "$CHECK" find pro-security security_surface.py)
git diff <base>...HEAD | python3 "$SURFACE"
```

Any output means security surface.
`find` reporting `not-installed` means the security reviewer is recorded `not-installed`.
No surface means it is recorded `skipped-no-surface`.

### Handoff

Fill the one template in `plugins/pro-quality/skills/requesting-code-review/handoff.md`.
Do not write a second template.
The four fields are:

- `range`: `<base>..<head>` as full shas.
- `brief`: the intent, spec and plan paths for this work, when they exist.
- `policy`: `REVIEW.md`, `CLAUDE.md` or `AGENTS.md` plus `CONSTRAINTS.md` when present.
- `risk`: `unclassified` and the stamp path `.pro-dev/ship/pr-check.json`.

Send that text and nothing else.
Never add a summary of the work, the session's reasoning, your own opinion of the diff or earlier findings.

### Dispatch

Dispatch both reviewers in one turn so they run in parallel.
Choose from the agents the host offers:

- Code review: `pro-quality:code-reviewer`, else `pro-ai-sdlc:reviewer`, else record `not-installed`.
- Security review, only on surface: `pro-security:security-architect` in diff mode.

When the host cannot dispatch subagents, say so.
Apply each reviewer's own skill in this session instead, record the reviewer as `inline` and note that the context was not fresh.
An `inline` security review does not satisfy the push gate.

### Tally lines

Read one count line from each report and match it as a whole line.
A missing line or a mismatch records `could-not-run` for that reviewer.

- Code reviewer, first line: `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>`.
  `blocking` and `important` both take the `important` count.
- Security reviewer, last line: `blocking: <n>  should-fix: <n>  notes: <n>`.
  `blocking` takes `blocking` and `important` takes `should-fix`.

Build the `--reviewers` JSON with keys `code` and `security`.
Each holds `agent`, `status`, `blocking`, `important` and `range`.
`docs/pr-check-stamp.md` lists the allowed values.

### Convergence

Read the last stamp's `head`.
When it is an ancestor of HEAD (`git merge-base --is-ancestor`), this is a later round.
Put `since <sha>` in `range` for the reviewer so it reviews only the new commits.
Drop findings the person has already seen or fixed.
Stop after the third round and ask the person to rethink the approach (ADR-0011).
Every round counts, including rounds that only fixed failing checks.

## Stamp and report

1. `python3 "$CHECK" stamp --reviewers '<json>'`, plus `--accept-mutation` when confirmed.
   It refuses on a dirty tree.
2. Write `.pro-dev/ship/pr-body.md` from [pr-body.md](./pr-body.md).
3. Print the report in the order things ran, then the result, the stamp path and the draft path:

```
pr-check on 3f9c2ab (base 81d04e7)
  build       pass   pnpm run build
  test        pass   pnpm test
  floor       pass   floor-guard.py --check
  mutation    killed src/gate.ts
  code review done   reviewer: 0 blocking, 2 important
  security    skipped-no-surface
result: pass
stamp: .pro-dev/ship/pr-check.json
PR body draft: .pro-dev/ship/pr-body.md
```

Print the draft body.
Never run `gh pr create`.
Say "confirm" for every claim in the draft that was not checked.
A `not-installed` code reviewer, a `could-not-run`, a timeout or a surviving mutation makes the result `incomplete`. The report says which.

## No script

When the script is missing (Codex ships only skills, or the plugin path is not substituted), run the checks by hand.

1. Read the verify block in `CLAUDE.md` or `AGENTS.md`, else the repo's build, lint, typecheck and test commands ([discovery.md](./discovery.md)).
2. Run each command once from the repo root and report its result and output tail.
3. Review inline as above and record it as not fresh.
4. Draft the PR body.
5. Say "no stamp was written", because the stamp hooks run in Claude Code only and the script writes the stamp.
