---
id: PDS-59
source: idea
kind: change
breaking: false
status: draft
risk: low
level: 2
created: 2026-11-18T09:36:57-0500
author: the maintainer
---

# Intent: a topic raised in conversation is not a change

Author: the maintainer.
Source: idea.
Status: draft.
Created: 2026-11-18.
Related: [intent/README.md](../README.md), [PDS-58](https://github.com/jodybrewster/pro-dev-skillset/pull/204).

## Problem

This repo's agent file says every change starts as an intent and that work found outside the board is routed back through `/intent`.
An agent reads that as "anything mentioned becomes an intent".
On 2026-11-18 a session was told that a better solution architect skill was needed.
It asked three multiple-choice questions, wrote a full intent from old logs, opened a pull request and pushed a new commit each time feedback or research arrived.
No brainstorm of what the skill should look like had taken place.
The person had to stop the session three times to say that this was still a conversation.

The rule has no start condition.
It says what a change must go through and never says when a topic becomes a change.

## Proposed outcome

The agent file states the start condition: a topic raised in conversation is not a change.
An agent that hears a new idea brainstorms it first.
It sketches a shape, asks one open question at a time and treats feedback and pasted research as input to the discussion.
It writes no intent, spec, file, branch, commit or pull request until the shape is agreed and the person says to make the change.
The intent rule begins at that point.

A person reading the agent file can see that order in the section on how work flows, next to the rule that every change goes through the loop.

## Affected users and systems

- `CLAUDE.md` at the repo root, which `AGENTS.md` links to, so Claude Code and Codex both read it.
- `intent/README.md`, if the same sentence belongs at the top of the intent rules.
- Agents working in this repo and in mieruka's chat, which start intents on a person's behalf.

## Constraints

- The rule is about when the loop starts. It does not loosen the loop once a change is decided.
- It names no person and quotes nobody.
- It does not turn every request into a brainstorm: a bug report or a change the person has already described and asked for goes to `/intent` as today.
- The duplicated "Dogfood it" section in `CLAUDE.md` is removed in the same edit, since the new rule sits beside it.

## Out of scope

- Changing the `/intent` command, which already interviews before it writes. Whether it should refuse to write when no brainstorm has happened is a later question.
- A hook that blocks an intent file from being written. This is a judgement an agent makes, not a pattern a script can match.
- The solution architect skill itself, which is PDS-58.

## Success looks like

- `CLAUDE.md` carries the rule in the section on how work flows, in two to four lines.
- `grep -c "Dogfood it" CLAUDE.md` prints 1.
- `node tests/check.mjs` and `claude plugin validate . --strict` pass.
- A session told "I need a better X" in this repo replies with a sketch and a question and creates no file or branch.

## Open questions

- Whether the same sentence goes into `intent/README.md` or the agent file alone is enough.
- Whether `/pro-ai-sdlc:intent` should carry the rule too, so it holds in repos that install the plugin and do not copy this agent file. That would be a plugin change with a version bump.
- Whether PDS-58 is closed and reopened after its brainstorm or kept as a draft.

## Evidence

Pull request 204 on this repo: four commits to one intent within about an hour on 2026-11-18, each folding in a message from the conversation.
