---
description: "Draft a design doc from a concepts brief with EGM's egm-draft, section by section with an approval gate after each. Writes design_draft.md, then the design doc under docs/designs/. Usage: /pro-egm:draft [concepts_brief.md or notes]"
argument-hint: "[brief or notes path]"
allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*), Read, Grep, Glob, Write(design_draft.md), Edit(design_draft.md), Write(docs/designs/**), Edit(docs/designs/**)
---

## Context

The argument at the end of this prompt is the brief or notes to draft from; EGM finds `concepts_brief.md` itself when none is given.
When EGM is the method for this work, the design doc it writes is the design document: no spec.md or plan.md is written for it.

## Your task

Read `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/running-egm.md` and follow it for this whole run: how to find the engine, how to read and follow an EGM skill, how reviewers are spawned, where artifacts go and how the `Author` line is filled.

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" egm`.
If its `egmRoot` is null, print "pro-egm needs egm@egm: run /pro-dev install" and stop.
If `skills["egm-draft"]` is null, print the update line from `running-egm.md` and stop.
Never call an EGM skill through the Skill tool: EGM's skills disable model invocation, so read the `SKILL.md` at `skills["egm-draft"]` and follow it here.

Pass the argument as EGM's `Context File` when one is given.
Keep every Section Approval Gate EGM defines: write a section, stop and wait for the person.
Write no implementation code; EGM allows pseudocode, APIs and schemas.
When the design doc is saved, recommend `/pro-egm:review <design doc>` as the next step and stop.
