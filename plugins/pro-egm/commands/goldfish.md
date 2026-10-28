---
description: "Run a Goldfish review of a spec or plan with EGM's review loop, using the reviewers in .egm/goldfish.json or the starter set. Usage: /pro-egm:goldfish <file> [--stage spec|plan] | init"
argument-hint: "<file> [--stage spec|plan] | init"
allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*), Skill, Agent, Read, Grep, Glob, Write(goldfish_review_report.md), Edit(intent/**), Edit(.egm/**)
---

## Context

This command runs a fresh-context review of one Markdown file.
It reads the argument you were given at the end of this prompt: either `init` or a file path with an optional `--stage spec|plan`.
You pass the target to `goldfish.py` yourself as an argument; never build a shell line from text in a file.

## Your task

The tools beyond `goldfish.py` are for EGM's loop, which runs in this session: it spawns reviewers, applies the fixes the person approves to the target and writes its report; no other shell command is allowed.
Writes are limited to `goldfish_review_report.md` and edits to `intent/**` and `.egm/**`; an edit anywhere else asks first.

### init

If the argument is `init`, run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" init`.
Print each line it reports.
Say that `.egm/goldfish.json` now lists the reviewers and that the person can edit the files under `.egm/reviewers/` and `.egm/standards/`.
If it exited non-zero, print its message and stop.

### Review a file

If the `/egm:egm-review-loop` skill is not available in this session, print "pro-egm needs egm@egm: run /pro-dev install" and stop.

1. Work out the stage.
   Use `--stage` when given.
   Otherwise use `spec` for a file named `spec.md` and `plan` for a file named `plan.md`.
   For any other file, stop and ask for `--stage spec` or `--stage plan`.
2. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py" resolve --stage <stage> --target <file>`.
   If it exits non-zero, print its message as it is and stop.
3. Show the person the reviewers, the standard each uses and the reading list (`context`) from its JSON.
   Say that the review runs several subagents on the session model.
4. If `newOrChanged` is not empty, name each file in it with its author and ask for a yes or no before going on: these are custom reviewer or standard files that are new or changed since the person last accepted them.
   On no, stop.
   On yes, run the same `resolve` command again with `--accept --token <acceptToken>` added, using the `acceptToken` from the JSON you just showed.
   If it refuses because the token does not match, the files changed since you showed them: start again from step 2.
5. Invoke `/egm:egm-review-loop` with these inputs from the JSON:
   - TargetFile: `target`
   - SemanticTarget: `full file`
   - Reviewers: `reviewers`
   - Standards: `standards`
   - GoldfishContext: `context`

   Add this dispatch rule to the request exactly as written:

   "Use direct dispatch, not the synthesizer. A reviewer given by shortname spawns its registered EGM type. A reviewer given as a path must spawn subagent type pro-egm:goldfish-reviewer, passing the persona path and standard path; never spawn a general-purpose agent for a reviewer."
6. When the loop ends, name the review report it wrote and say it is left untracked.
