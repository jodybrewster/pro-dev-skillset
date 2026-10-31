# ADR-0021: Doc freshness is a judgment step in pr-check, not a push hook

Date: 2026-10-31

## Status

proposed

Decided by: Jody Brewster.
Supersedes the doc-freshness half of intent/2026-10-17-doc-hooks/.

## Context

`docs-before-push.py` was a PreToolUse Bash hook in pro-quality.
It blocked any `git push` whose commits touched code unless every key doc the repo had (`README.md`, `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `PRODUCT.md`, `DESIGN.md`) also appeared in the diff.
It ignored warn mode.
Its message said to explain an unchanged doc in the PR description, yet a rerun saw the same diff and blocked again, so the only way through was a cosmetic edit the message forbade.
Jody reported on 2026-10-31 that it stopped agents in other repos before they finished their goals.

addyosmani/agent-skills ships no push gate for docs.
It treats docs as judgment: a `documentation-and-adrs` skill, a "docs changed where behavior changed" item in its definition of done and a docs list in `shipping-and-launch`.
pro-ai-sdlc already carries that definition of done (ADR-0017).

## Decision

The hook and its script are removed.
`pr-check` gains a step that reads the diff and the docs the repo has and names each doc the diff made untrue or incomplete.
A doc that describes nothing the diff touched needs no change.
Each stale doc is Should-fix: the agent fixes it with `/document` or gives a one-line reason on the PR body's Docs line.
It never changes the result and never blocks, like a missing required document (ADR-0020).

## Consequences

A push no longer stops on docs, so a branch can be pushed with stale docs.
The check runs when `pr-check` or `/execute` runs, which is before review, where a reason for an unchanged doc can be read.
The judgment is the model's and is not deterministic; the `/document` subagents still write only from repository evidence.
