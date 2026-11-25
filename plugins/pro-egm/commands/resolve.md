---
description: "Triage goldfish findings with EGM's egm-resolve: each one fixed, contested with evidence, escalated or declined. Edits the document only after the person approves. Usage: /pro-egm:resolve <document> [report]"
argument-hint: "<document> [report]"
allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*), Read, Grep, Glob, Write(goldfish_review_report.md), Edit(docs/designs/**), Edit(concepts_brief.md), Edit(design_draft.md)
---

## Context

The argument at the end of this prompt is the reviewed document and, optionally, the report with the findings.
Without a report, use the newest `consolidated_review_report.md`, `goldfish_review_report.md` or stage report in the working directory and say which one.

## Your task

Read `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/running-egm.md` and follow it for this whole run: how to find the engine, how to read and follow an EGM skill, how reviewers are spawned, where artifacts go and how the `Author` line is filled.

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" egm`.
If its `egmRoot` is null, print "pro-egm needs egm@egm: run /pro-core:pro-dev install" and stop.
If `skills["egm-resolve"]` is null, print the update line from `running-egm.md` and stop.
Never call an EGM skill through the Skill tool: EGM's skills disable model invocation, so read the `SKILL.md` at `skills["egm-resolve"]` and follow it here.

Give EGM the document and the findings as its inputs.
Every finding gets exactly one of EGM's categories: PROPOSE FIX, CONTEST, ESCALATE or DECLINE, with EGM's rules for evidence.
Write the annotated report EGM asks for and present its resolution gate.
Edit the document only after the person approves the fixes; edit only the fixes approved.
End with the open Blocker and Major findings, one line each. Say the report is left untracked.
