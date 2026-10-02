---
description: Review a plan, idea or spec for legal issues before code exists or review what is about to ship (diff, branch, range, tag, release) for licensing, privacy and compliance problems. Returns a pasteable `## Legal review` section or severity-graded findings with a verdict.
argument-hint: '[idea, plan path, diff spec, branch, range, tag or "release"]'
---

Use the `software-counsel` skill on `$ARGUMENTS`.

Pick the mode from the argument.

- An idea in prose or a path to a plan, spec or design doc: plan mode. If it is a path, read the file.
- A diff spec, branch, commit range, tag, PR or the word "release": release mode.
- Nothing: use the current plan in the conversation if there is one. Otherwise run release mode on `origin/main...HEAD`.
- Both a plan and code: plan mode first, then release mode, reported as two sections.

When subagents are available, dispatch the `software-counsel` subagent with only the plan text or path or only the release spec and nothing else so the pass has fresh context.
For release mode, give it a reproduce command such as `git diff origin/main...HEAD` and the release kind.
When subagents are not available, run the procedure in the skill yourself and say the pass was not independent.

Plan mode returns the `## Legal review` section: a verdict, then Blocking, Required changes, Questions for counsel and Accepted risks.
Then offer to fold the section into the plan file.
Release mode returns findings graded Blocking, Required or Advisory with `file:line` evidence, then a verdict of Ship, Ship with changes or Hold.

Anything time-sensitive is verified against primary sources and cited and anything unverified is labeled.
This is read-only.
Report findings and required changes and do not edit code.
For a security review use `security-architect` instead.
