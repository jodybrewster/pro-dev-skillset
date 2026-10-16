# ADR-0003: One hooks/hooks.json per plugin

Date: 2026-07-26 (8597453, "fix(hooks): make plugin hooks actually load, add user-validation handoff (#34)")

## Status

accepted

## Context

Claude Code loads one hook file per plugin on its own, hooks/hooks.json.
Any other filename in hooks/ is silently ignored.
There is no warning and no validation error, and `claude plugin validate --strict` still passes.

Commit 8597453 found eight hook files across pro-core, pro-data and pro-quality that had never run.
They were named per concern, like git-safe.json and validation-handoff.json, instead of being merged into hooks/hooks.json.
The git-safe guard, the doc-freshness push gate, the PR quality gate and the parallel-subagent nudge were all dead.
One pro-data hook also pointed at scripts/format-schema.py, which was never written.
No check failed and no hook ran.

## Decision

Each plugin registers all its hooks in exactly one file, hooks/hooks.json, grouped by event.
Every script a hook runs exists and is tracked by git.
Event names are exact and case-sensitive: PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, SubagentStop, SessionStart, SessionEnd and PreCompact.

## Consequences

A plugin may declare extra hook files through a hooks field in plugin.json, but the single file is preferred because it leaves fewer ways to be wrong.
A referenced script that exists locally but is untracked warns in development and fails when CI is set, since a fresh CI checkout holds tracked files only.
A Stop hook that blocks must guard with stop_hook_active and record per-session progress, or its own writes can re-trigger it.
Merging the files switched the hooks on for the first time, which exposed latent bugs such as the doc-freshness gate not resolving symlinks.
The long detail lives in docs/hook-loading.md.

## Enforced by

- [`tests/check.mjs`](../../tests/check.mjs) check `hooks` (`checks.hooks`) lists each plugin's hooks/*.json files.
  It fails on a file that is neither hooks/hooks.json nor declared in plugin.json, on invalid JSON and on an unknown event name.
  It also fails on a script referenced through `${CLAUDE_PLUGIN_ROOT}` that is missing from disk, and checks that referenced scripts are tracked by git.
- The detail page [`docs/hook-loading.md`](../hook-loading.md).
- The review policy [`REVIEW.md`](../../REVIEW.md).
