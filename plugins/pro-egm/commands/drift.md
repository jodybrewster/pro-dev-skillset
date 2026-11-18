---
description: "Compare checked-in design docs or README contracts with the code using EGM's egm-drift-report. Report only: changes nothing else. Usage: /pro-egm:drift [design directory, default docs/designs]"
argument-hint: "[directory]"
allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*), Read, Grep, Glob, Write(*_DRIFT_REPORT.md)
---

## Context

The argument at the end of this prompt is the directory of design docs or README contracts.
Default to `docs/designs` when it exists; otherwise ask for the directory in one plain question.

## Your task

Read `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/running-egm.md` and follow it for this whole run: how to find the engine, how to read and follow an EGM skill, how reviewers are spawned, where artifacts go and how the `Author` line is filled.

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" egm`.
If its `egmRoot` is null, print "pro-egm needs egm@egm: run /pro-dev install" and stop.
If `skills["egm-drift-report"]` is null, print the update line from `running-egm.md` and stop.
Never call an EGM skill through the Skill tool: EGM's skills disable model invocation, so read the `SKILL.md` at `skills["egm-drift-report"]` and follow it here.

Write only EGM's `<YYYY-MM-DD>_DRIFT_REPORT.md`.
Never edit a design doc or source file, even when the drift is obvious; list it in the report.
End with the report's path, the number of documents with drift and say the report is left untracked.
