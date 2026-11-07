---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T10:40:00-0500
author: the maintainer
module: m2
---

# Spec m2: worktree cleanup with a recovery file

Built from `intent.md` in this folder (commit 5041d4a), module m2 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0016, ADR-0017, `docs/hook-loading.md`, `docs/enforce-mode.md`, `docs/licenses.md`, `pro-security:security-architect` (diff mode, read for pass 2).

## Summary

A SessionStart hook in pro-ai-sdlc lists the worktrees `/execute` and the factory left behind, works out which branches are merged and, in enforce mode only, removes those worktrees and branches after writing a recovery file.
It is adapted from super-board's `hooks/cleanup-wt.py` (MIT) and keeps every unmerged or dirty worktree.

## Assumptions

Confirmed on 2026-11-07:

1. Worktrees made by `/execute` live under the repo's `.claude/worktrees/` or beside the checkout as `../<repo>-<slug>`; the hook reads `git worktree list --porcelain` and does not guess paths.
2. The hook joins pro-ai-sdlc's one `hooks/hooks.json` under `SessionStart`.
3. It starts in warn mode, where it reports and deletes nothing.
4. Merge detection uses four probes: `git merge-base --is-ancestor`, `git cherry`, a squash probe (`git diff --quiet <base>...<branch>` after a merge-tree) and `gh pr view --json state` when `gh` is present.

## Requirements

### Functional

- R1. On SessionStart the hook runs only when the default branch tip differs from the tip it recorded at its last run in `.pro-dev/cleanup-wt/last-tip`; otherwise it exits 0 silently (intent: "worktrees pile up").
- R2. For each worktree other than the main one it classifies the branch as `merged` when any of the four probes says so, `dirty` when `git status --porcelain` in it is non-empty, otherwise `unmerged`.
- R3. In warn mode it prints one line per worktree with its class and path as additional context and deletes nothing.
- R4. In enforce mode it first writes `.pro-dev/cleanup-wt/<timestamp>.tsv` with one row per worktree (path, branch, head sha, class, action), then removes only `merged` worktrees with `git worktree remove` and their branches with `git branch -d`.
- R5. A `dirty` worktree is never removed; the hook commits its changes as `wip: cleanup-wt kept <branch>` on that branch only when `CLEANUP_WT_WIP=1` is set, otherwise it leaves it alone.
- R6. An `unmerged` worktree and its branch are never removed.
- R7. `--dry-run` from a shell prints the plan and writes nothing; `--restore <tsv>` prints the `git worktree add` and `git branch` commands that recreate each removed row.
- R8. A failure of any `git` or `gh` call makes the hook exit 0 with no deletions.

### Non-functional

- N1. The hook finishes in under five seconds for ten worktrees when `gh` is absent; the `gh` probe has a three-second timeout.
- N2. Python 3.9 stdlib only.
- N3. The script keeps super-board's footer and `docs/licenses.md` gains its row (MIT, Copyright (c) 2026 Eric Tech, adapted).

### Policy constraints applied

- Hook-loading law (ADR-0003): one entry in `plugins/pro-ai-sdlc/hooks/hooks.json`, script tracked.
- Gate enforce rule (ADR-0016): warn first, with a row in `docs/enforce-mode.md`.
- REVIEW.md pass 2: the `gh pr view` read is the merge gate's approved exception extended to this hook, recorded in the ADR-0015 amendment line; no other network call.
- REVIEW.md pass 1: behavior cases show the hook deleting a merged worktree in enforce mode and keeping a dirty and an unmerged one.
- Forked content rule: footer and licenses row (N3).

### Boundaries

Always: list, classify, write the recovery file before any removal.
Ask first: enabling enforce mode, setting `CLEANUP_WT_WIP`.
Never: remove a dirty or unmerged worktree, force-delete a branch, touch the main worktree.

## Design

### User experience

In warn mode a session that opens after a merge sees a short context line: `cleanup-wt: 2 merged worktrees could be removed (../repo-foo, ../repo-bar); run python3 ... --dry-run`.
In enforce mode the same session sees `cleanup-wt: removed 2 merged worktrees, recovery file .pro-dev/cleanup-wt/<ts>.tsv`.

### System

- `plugins/pro-ai-sdlc/scripts/cleanup-wt.py`, adapted; uses `guard.py` for mode, log and warn.
- `plugins/pro-ai-sdlc/hooks/hooks.json`: a `SessionStart` entry.
- `evidence.ensure_excluded` already keeps `.pro-dev/` out of commits.
- Tests: `tests/sdlc-hooks.mjs` cases over a fixture repo with one merged, one dirty and one unmerged worktree.

### Alternatives considered

- Cleaning up in `/merge-pr` only: misses factory and `/execute` worktrees merged elsewhere.
- Deleting in warn mode with a confirmation: a SessionStart hook cannot ask.

## Flagged concerns

ADR needed: no, it applies ADR-0016 and the ADR-0015 network exception to one more hook.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The hook reads `gh pr view`, a network call REVIEW.md pass 2 allows only for the merge gate | `REVIEW.md`, ADR-0015 amendment | resolved on 2026-11-07: the exception line in REVIEW.md extends to `cleanup-wt.py`, limited to `gh pr view` on the branch's own PR |
| 2 | Enforce mode deletes worktrees, the one irreversible act in this batch | `docs/enforce-mode.md` | resolved: recovery file before every removal (R4), `--restore` (R7), warn start |

## Open questions

- Resolved: the `gh` probe stays (concern 1).

## Acceptance criteria

- AC1. In a fixture repo with three worktrees, warn mode prints three classified lines and `git worktree list` is unchanged.
- AC2. Enforce mode removes only the merged one, its branch is gone, the dirty and unmerged ones remain and the TSV has three rows with the right actions.
- AC3. `--restore <tsv>` prints commands that, when run, recreate the removed worktree at the recorded sha.
- AC4. With `gh` removed from `PATH` the hook still classifies by the three git probes and exits 0.
- AC5. A second SessionStart with the same default tip exits 0 in under one second with no output.
- AC6. `docs/licenses.md` has the row and the script ends with the upstream footer.

## Out of scope

- Pruning stale branches with no worktree.
- Cleaning worktrees of other repos.
