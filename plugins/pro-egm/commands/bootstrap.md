---
description: "Write README contracts across a codebase with EGM's egm-bootstrap, so later design work has a map. Documentation only, no commits. Usage: /pro-egm:bootstrap <directory> [README.md|EGM.md]"
argument-hint: "<directory> [contract filename]"
allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*), Agent, Read, Grep, Glob
---

## Context

The argument at the end of this prompt is the root directory to map and an optional contract filename.
Use `EGM.md` instead of `README.md` when the person wants their own README files left alone.

## Your task

Read `${CLAUDE_PLUGIN_ROOT}/skills/egm-bridge/running-egm.md` and follow it for this whole run: how to find the engine, how to read and follow an EGM skill, how reviewers are spawned, where artifacts go and how the `Author` line is filled.

Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" egm`.
If its `egmRoot` is null, print "pro-egm needs egm@egm: run /pro-core:pro-dev install" and stop.
If `skills["egm-bootstrap"]` is null, print the update line from `running-egm.md` and stop.
Never call an EGM skill through the Skill tool: EGM's skills disable model invocation, so read the `SKILL.md` at `skills["egm-bootstrap"]` and follow it here.

Pass the directory as EGM's `path` and the filename as `target_filename` when given.
Keep EGM's safety gate: more than 15 subdirectories needs the person's yes first.
Write only the contract files; never change source code, never run `git add` or `git commit`.
The orchestrator EGM spawns has Bash and Edit; tell the person before it starts that it will write contract files across the tree.
End by listing every contract file created or changed so the person can review them before committing.
