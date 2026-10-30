---
description: Dispatch a code reviewer subagent against the current diff (or a specified scope) using crafted context - never your session history.
argument-hint: '[scope, e.g. "the diff" or "PR #123"]'
---

Use the `requesting-code-review` skill to dispatch the `pro-quality:code-reviewer` agent in a fresh context.
Scope: `$ARGUMENTS` if provided; otherwise default to the current uncommitted diff (`git diff HEAD`).
Follow the skill: compute the base and head shas, fill the four fields of `handoff.md` (range, brief, policy, risk) and send that text and nothing else.
Then act on the returned Important findings and weigh the nits.
