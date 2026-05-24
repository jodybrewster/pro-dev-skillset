---
description: Dispatch a code reviewer subagent against the current diff (or a specified scope) using crafted context — never your session history.
argument-hint: '[scope, e.g. "the diff" or "PR #123"]'
---

Use the `requesting-code-review` skill to dispatch a fresh code reviewer subagent. Scope: `$ARGUMENTS` if provided; otherwise default to the current uncommitted diff (`git diff HEAD`). Follow the skill's template — compute BASE_SHA and HEAD_SHA, fill the `code-reviewer.md` placeholders, then act on the returned Critical / Important / Minor findings.
