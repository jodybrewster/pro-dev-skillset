# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```
Subagent invocation (Claude Code: the pro-quality:code-reviewer agent; Codex: a fresh agent run with the code-reviewer.toml instructions):
  Fill the four fields of requesting-code-review/handoff.md and send nothing else:

  range: [commit before task]..[current commit]
  brief: [plan-file] and the spec or issue for Task N
  policy: REVIEW.md, the agent file and CONSTRAINTS.md when present
  risk: [tier or "unclassified"], plus .pro-dev/ship/pr-check.json when it exists
```

**In addition to standard code quality concerns, the reviewer should check:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)

**Code reviewer returns:** a report that opens with `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>`, then Important findings and nits.
