---
description: "Run EGM's lite protocol (egm-lite) for a small change: critique pause, checklist and spec review, exec, diff review and resolution, one phase per turn. Usage: /pro-egm:lite <task> | checklist | exec | goldfish | review"
argument-hint: "<task> | checklist | exec | goldfish | review"
allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*), Agent, Read, Grep, Glob, Write(egm_lite_checklist.md), Write(egm_lite_alternatives.md), Edit(egm_lite_checklist.md)
---

## Context

The argument at the end of this prompt is either a new task or one of EGM lite's phase commands: `checklist`, `exec`, `goldfish` or `review`.
Lite is for small changes, bug fixes and refactors.
For a feature with several components, recommend `/pro-egm:brainstorm` instead and stop.

## Your task

Read `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/running-egm.md` and follow it for this whole run: how to find the engine, how to read and follow an EGM skill, how reviewers are spawned, where artifacts go and how the `Author` line is filled.

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" egm`.
If its `egmRoot` is null, print "pro-egm needs egm@egm: run /pro-core:pro-dev install" and stop.
If `skills["egm-lite"]` is null, print the update line from `running-egm.md` and stop.
Never call an EGM skill through the Skill tool: EGM's skills disable model invocation, so read the `SKILL.md` at `skills["egm-lite"]` and follow it here.

Run exactly the one section of EGM lite that the argument triggers, then halt as EGM's model rules say.
EGM lite's own checklist and approval gate come before any edit: never edit repository files before the person says `exec` or Proceed on `egm_lite_checklist.md`.
Its reviews spawn fresh-context subagents; if this session cannot spawn them, say so and stop.
Never commit or push.
