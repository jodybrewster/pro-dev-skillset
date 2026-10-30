---
name: requesting-code-review
description: Use when finished work on a branch or PR needs a code review against its requirements - after completing a task or major feature, before merging, or when asked to review a diff or pull request, even when the diff is pasted inline - by dispatching a fresh-context code reviewer subagent. Reviews correctness and quality of the code against its requirements; it does not explain a diff, write commit messages, docs or release notes about the change (technical-writer) or do a security review (security-architect).
---

# Requesting Code Review

Dispatch the `pro-quality:code-reviewer` agent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history. This keeps the reviewer focused on the work product, not your thought process, and preserves your own context for continued work.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get the two shas:**
```bash
BASE_SHA=$(git merge-base origin/main HEAD)  # or the commit before the task
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Find the brief and policy paths.**
The brief is the intent, spec, plan or issue the work answers to.
The policy is `REVIEW.md`, the agent file and `CONSTRAINTS.md` when present.

**3. Fill `handoff.md`.**
It has four fields: `range` (base and head shas), `brief`, `policy` and `risk` (the tier or "unclassified", plus `.pro-dev/ship/pr-check.json` when it exists).
Nothing else goes to the reviewer: no author description, PR body, session summary or earlier findings.

**4. Dispatch with that text and nothing else.**
In Claude Code, dispatch the `pro-quality:code-reviewer` agent with the filled template.
Under Codex, copy `.codex-plugin/agents/code-reviewer.toml` into the Codex agents folder or start a fresh agent run with its instructions.

**5. Act on feedback.**
The report opens with `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>`.
- Fix Important issues before merge
- Weigh nits and fix the cheap ones
- Push back if the reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch pro-quality:code-reviewer with the handoff]
  range: a7981ec..3df7661
  brief: docs/superpowers/plans/deployment-plan.md (Task 2)
  policy: REVIEW.md, the code-reviewer agent file
  risk: unclassified

[Reviewer returns]:
  important: 1  nits: 1  pre-existing: 0  skipped: 0
  Important: no progress indicators in repairIndex()
  nit: magic number (100) for reporting interval

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development:**
- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**
- Review after each task or at natural checkpoints
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Important issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: requesting-code-review/handoff.md

---

_Forked from [obra/superpowers](https://github.com/obra/superpowers) — MIT License. See original repository for full license text._
