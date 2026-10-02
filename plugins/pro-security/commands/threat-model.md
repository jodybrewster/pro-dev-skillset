---
description: Challenge an idea, plan, spec or design doc for security before any code exists - unstated assumptions, trust boundaries, abuse cases - and return a pasteable `## Security challenge` section.
argument-hint: '[idea, or path to a plan/spec/design doc]'
---

Use the `security-architect` skill in challenge mode on `$ARGUMENTS`.
The argument is either an idea in prose or a path to a plan, spec or design doc.
If it is a path, read the file.

If `$ARGUMENTS` is empty, use the current plan in the conversation.
If there is none, ask for one.

When subagents are available, dispatch the `security-architect` subagent with the plan text or path and nothing else, so the pass has fresh context.
When they are not, run the challenge procedure yourself and say it was not independent.

Return the `## Security challenge` section: a verdict, then Blocking, Required changes, Open questions and Accepted risks.
Then offer to fold the section into the plan file.

This is read-only.
Report findings and required changes; do not edit code.
For a whole-repo posture check use `/security-audit` instead.
