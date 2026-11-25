---
description: "Run EGM's full staged goldfish review (egm-review, stages 5 to 9) on a design doc with this repo's reading list. Refuses when subagents cannot be spawned. Usage: /pro-egm:review <design doc> [interactive|uninterrupted|5|6|7|8|9]"
argument-hint: "<design doc> [step]"
allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*), Agent, Read, Grep, Glob, Write(*_report.md), Edit(docs/designs/**)
---

## Context

The argument at the end of this prompt is the design doc and an optional EGM step.
If no file is given, ask for the path in one plain question and stop.
You pass the target to `goldfish.py` yourself as an argument; never build a shell line from text in a file.

## Your task

Read `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/running-egm.md` and follow it for this whole run: how to find the engine, how to read and follow an EGM skill, how reviewers are spawned, where artifacts go and how the `Author` line is filled.

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" egm`.
If its `egmRoot` is null, print "pro-egm needs egm@egm: run /pro-core:pro-dev install" and stop.
If `skills["egm-review"]` is null, print the update line from `running-egm.md` and stop.
Never call an EGM skill through the Skill tool: EGM's skills disable model invocation, so read the `SKILL.md` at `skills["egm-review"]` and follow it here.

If this session cannot spawn subagents, say "pro-egm: egm-review needs subagents; a review in this context is not a goldfish review" and stop.

1. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" context --target <file>`.
   If it exits non-zero, print its message as it is and stop.
2. Show the person the target and the reading list (`context`).
   Say that the review runs five stages in order, each with its own subagents on the session model.
3. Follow EGM's review with `TargetFile` set to `target`, `GoldfishContext` set to `context` and `Step` set to the optional step argument.
   Keep EGM's stages sequential and wait for every reviewer in a stage before the next.
   When EGM hands off to `egm-review-loop` or `egm-resolve`, read that skill from the `skills` map and follow it; edits to the design doc wait for the person's approval as EGM's gates say.
4. When the review ends, name each report it wrote and say they are left untracked.
   Recommend `/pro-egm:resolve` for findings still open.
