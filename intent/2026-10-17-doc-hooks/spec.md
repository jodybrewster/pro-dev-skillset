---
intent: intent.md
intent-status: accepted
status: accepted
created: 2026-11-07T10:45:00-05:00
author: the maintainer
---

# Spec: the pro-quality doc hooks judge the right repo and stop blocking legitimate edits

Built from `intent.md` in this folder (commit 45c6672).
Status: accepted.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `PRODUCT.md`, `docs/decisions/0020-required-documents.md`, `docs/decisions/0021-doc-freshness-is-judgment.md`.

This spec is written after the work shipped, so it records what was built rather than proposing it.
The fix landed across PRs #55, #59 and #107; the write gate `docs-to-project.py` carries the surviving behavior and the push gate `docs-before-push.py` was removed.

## Summary

Two PreToolUse hooks in `pro-quality` blocked work they were written to allow, and both ship to every repo that installs the marketplace.
The write gate (`docs-to-project.py`) now lets agent instruction files and Claude scratch files through while it still blocks plan and analysis docs written into `~/.claude/`, and it asks git which repository a target belongs to rather than trusting the path.
The push gate (`docs-before-push.py`) judged the wrong repo and blocked legitimate pushes; it was removed and its doc-freshness job moved into `pr-check` as a judgment step under ADR-0021.
Every session in every repo with `pro-quality` installed gets this behavior from the release that carried the change.

## Assumptions

These rest on the repo as it stands and are marked unconfirmed because the spec was written with nobody available to answer.

1. unconfirmed: the hooks run under `python3` on the consumer's PATH, as `hooks/hooks.json` invokes them.
2. unconfirmed: the harness sets `CLAUDE_PROJECT_DIR` to the session's own repo when it can, and the hook falls back to `cwd` when it does not.
3. unconfirmed: the Claude scratchpad lives at `/tmp/claude-*`, `/private/tmp/claude-*` or under `$TMPDIR` with a `claude-` segment, so the same rule holds on macOS and Linux.
4. unconfirmed: a wrong block costs more than a missed reminder, so each case the hook cannot resolve fails open.
5. unconfirmed: doc freshness on push is better judged by `pr-check` than by a blocking hook, per ADR-0021.

## Requirements

### Functional

- R1. `docs-to-project.py` allows a write to `CLAUDE.md`, `AGENTS.md` or `CLAUDE.local.md` placed directly in `~/.claude/` (intent decision 5).
- R2. `docs-to-project.py` allows a write to an agent instruction file inside the session's own repo, resolved by git common dir so a linked worktree counts as the same repo (intent decision 5, intent lines 23 and 36).
- R3. `docs-to-project.py` allows a write to a Claude scratch path: `/tmp/claude-*`, `/private/tmp/claude-*` or a path under `$TMPDIR` with a `claude-` segment, and nothing else under `/tmp` (intent decision 6, intent line 23).
- R4. `docs-to-project.py` still blocks a plan or analysis doc written into `~/.claude/` or a `~/.claude/` subfolder such as `plans/`, except the single plan-mode file the harness assigns and the auto-memory directory (intent lines 28 and 36).
- R5. `docs-to-project.py` still blocks a `.md`, `.txt` or `.rst` file written into another repository or no repository, judged by git rather than by path prefix (intent line 22).
- R6. When git cannot be consulted, when the payload is malformed or when `file_path` is empty, `docs-to-project.py` exits 0 and lets the write through (intent fail-open choices, intent lines 40 to 44).
- R7. The push gate `docs-before-push.py` is removed and its doc-freshness job moves to `pr-check`, superseding intent Bug 1 and decisions 1, 2, 4 and 7 (ADR-0021).
- R8. `tests/doc-hooks.mjs` drives the real `docs-to-project.py` with one process per case and asserts the exit code, with cases that show the gate blocking and cases that show it allowing (intent line 54, REVIEW.md Pass 1).
- R9. The version-bump law holds for each shipping PR: a content change under `plugins/pro-quality/` bumps the plugin in both manifests and the marketplace entry plus `metadata.version` in the same commit (intent lines 52 to 53, ADR-0002).

### Non-functional

- N1. Each git call the write gate makes is bounded by a 2 second timeout so a slow or wedged git never stalls the user's turn.
- N2. The hook makes no network call, writes nothing outside the decision it returns and never executes text taken from the payload (REVIEW.md Pass 2).
- N3. A block names the project directory it judged so the user can act on the reason (intent line 38, REVIEW.md Pass 2).

### Policy constraints applied

- Hook-loading law (ADR-0003): every script the plugin runs lives in its one `hooks/hooks.json` and is tracked by git; `docs-to-project.py` is registered there and `docs-before-push.py` was unregistered when it was removed.
- Version-bump law (ADR-0002): honored per shipping PR, which is why the intent's stated targets (`pro-quality` 0.9.5, metadata 1.44.0) are historical and not the current numbers.
- REVIEW.md Pass 1: a blocking hook needs a behavior case that blocks and one that allows, met by `tests/doc-hooks.mjs`.
- REVIEW.md Pass 2: the script catches its own errors, exits cleanly and fails open on a bad payload.
- Codex parity (ADR-0004): hooks are scripts, not skills or agents, so no `.toml` sibling is owed.

### Boundaries

Always: let agent instruction files, the auto-memory directory, the plan-mode file and Claude scratch paths through.
Ask first: nothing; the hook is a deterministic gate with no interactive step.
Never: block a write when git is unavailable or the payload is unparsable, and never run a network call or execute payload text.

## Design

### User experience

A session writing `~/.claude/CLAUDE.md`, an agent file in its own repo or a `claude-*` scratch file sees the write go through with no block.
A session writing a plan or analysis doc into `~/.claude/` or into another repo sees a block whose message names the project directory and points to `docs/` or `docs/plans/`.
The tone is a short redirect, not a lecture.

### System

`docs-to-project.py` is a PreToolUse `Write|Edit` hook registered in `plugins/pro-quality/hooks/hooks.json`.
It reads `{"tool_input": {"file_path": ...}}` from stdin, resolves the session repo from `CLAUDE_PROJECT_DIR` or `cwd` and compares git common dirs so a linked worktree is treated as the same repository.
It reuses the existing helpers `common_git_dir`, `nearest_existing_dir`, `is_within` and `in_scratch_space`.
The push gate `docs-before-push.py` was a PreToolUse `Bash` hook; it and its registration were removed and `pr-check` gained the doc-freshness judgment step.
`tests/doc-hooks.mjs` builds throwaway git repos, `HOME` and `TMPDIR` so nothing touches the real `~/.claude`, and `tests/check.mjs` imports its `runDocHookCases()`.

### Alternatives considered

- Keep the `HEAD~1` fallback in the push gate: rejected, it is the root cause of Bug 1 (plan.md).
- Allow all of `/tmp`: rejected, it differs by platform and lets stray docs through, so only `claude-*` directories are exempt (plan.md).
- Fix `docs-before-push.py` in place rather than remove it: rejected by ADR-0021, which treats doc freshness as judgment in `pr-check` rather than a blocking push hook.

## Flagged concerns

Reviewers start here.

ADR needed: no, the load-bearing decision (removing the push hook and moving doc freshness to `pr-check`) is already recorded in ADR-0021 and the surviving write-gate fix sets no new rule.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent's Bug 1 and decisions 1, 2, 4 and 7 describe fixing `docs-before-push.py`, but that hook was removed, so those lines no longer describe shipped behavior. | ADR-0021 | resolved: ADR-0021 (2026-10-31) supersedes the doc-freshness half of this intent and moves the job to `pr-check`. |
| 2 | The intent names `pro-quality` 0.9.5 and metadata 1.44.0, far behind the current 0.19.0 and 1.89.2. | ADR-0002 version-bump law | resolved: the numbers were the targets at authoring; each shipping PR bumped correctly, so they are historical not a defect. |
| 3 | The intent is dated 2026-10-17 and this spec is written after the fix shipped, so it documents rather than gates the change. | SDLC loop order | open: recorded so a reader does not read the spec as a pre-build gate; no further action. |

## Open questions

The intent left no open questions, and the two bugs it named are both resolved: Bug 2 by `docs-to-project.py` and Bug 1 by ADR-0021.

## Acceptance criteria

- AC1. `node tests/doc-hooks.mjs` passes with cases that show the write gate blocking and cases that show it allowing.
- AC2. `node tests/check.mjs && node tests/eval.mjs --dry` pass.
- AC3. `claude plugin validate . --strict` and `claude plugin validate plugins/pro-quality --strict` pass.
- AC4. `docs-before-push.py` is absent from `plugins/pro-quality/scripts/` and from `hooks/hooks.json`.
- AC5. A write to an agent file in `~/.claude/`, to the session repo or to a `claude-*` scratch path returns exit 0, and a plan doc written into `~/.claude/` or another repo returns exit 2.

## Out of scope

- The `pr-check` doc-freshness step itself, which ADR-0021 owns and `pro-ship`/`pro-quality` implement.
- Any wrapper or substitution the push gate could not resolve, now moot because the push gate is gone.
- `PRODUCT.md` upkeep, which REVIEW.md requires at the repo level independent of this change.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
