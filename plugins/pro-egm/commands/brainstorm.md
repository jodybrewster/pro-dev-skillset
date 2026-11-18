---
description: "Brainstorm a topic with EGM before any change exists: read and report, a discovery interview one question per turn, options research with dated sources, EGM's goldfish swarm and a brief-stage review. Writes concepts_brief.md, never an intent or code. Usage: /pro-egm:brainstorm <the topic, in a sentence or two>"
argument-hint: "<topic>"
allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*), Agent, Read, Grep, Glob, Write(concepts_brief.md), Edit(concepts_brief.md), Write(docs/designs/**), Edit(docs/designs/**)
---

## Context

This is the front of the lifecycle: a topic raised in conversation is not yet a change.
The brainstorm grows shared context, weighs options and ends with a brief the person accepts.
It writes no intent, no spec, no plan and no code.
The topic is the argument at the end of this prompt; if it is empty, ask for it in one plain question.

## Your task

Read `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/running-egm.md` and follow it for this whole run: how to find the engine, how to read and follow an EGM skill, how reviewers are spawned, where artifacts go and how the `Author` line is filled.

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" egm`.
If its `egmRoot` is null, print "pro-egm needs egm@egm: run /pro-dev install" and stop.
If `skills["egm-brainstorm"]` is null, print the update line from `running-egm.md` and stop.
Never call an EGM skill through the Skill tool: EGM's skills disable model invocation, so read the `SKILL.md` at `skills["egm-brainstorm"]` and follow it here.

Run EGM's brainstorm with these additions from pro-egm, in this order:

1. Before EGM's Step 1, read `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/discovery.md` and do its read-and-report step. Change nothing.
2. In EGM's Step 1, cover the topics in `discovery.md` as well as EGM's own questions, under EGM's rules: open questions in plain text, one per turn, no multiple-choice answers.
   Keep the assumptions table as `discovery.md` says and show it with the working hypothesis at EGM's readiness gate.
3. When the person chooses "Review with Goldfishes" at the gate, first run the options research in `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/options.md` unless the person skips it, then run EGM's Step 2 swarm as written.
   Put the anchored hypothesis, the assumptions and the options table in the swarm's prompt.
   EGM's swarm reviewer list is fixed in its skill and its reviewers are EGM agents; do not add path reviewers to it.
4. When EGM writes `concepts_brief.md`, add the sections in `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/brief.md` after EGM's own.
5. Before EGM's Step 4 handoff gate, offer the brief-stage review once: `/pro-egm:goldfish concepts_brief.md --stage brief`, which runs the architect, security and compliance and sponsor goldfish as a second pass through EGM's review loop.
   It runs several subagents; run it only on a yes.
6. At EGM's Step 4 gate, keep EGM's choices and then recommend the next step:
   - work that goes through EGM: `/pro-egm:draft concepts_brief.md`; EGM's design doc becomes the document for it and no spec.md or plan.md is written
   - work that stays in the `pro-ai-sdlc` lane: `/intent` with `concepts_brief.md` as its input, one change from the brief's "Changes the work breaks into" at a time
   Do not run either yourself.

Name every file written and say which are meant to be committed (`running-egm.md` lists them).
