---
source: idea
kind: idea
status: done
risk: medium
created: 2026-10-29T18:08:46-0400
author: Jody Brewster
---

# Intent: constraint floor and CONSTRAINTS.md

Author: Jody Brewster (pro-dev-skillset).
Source: idea, item 1 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md), from the comparison with [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `constraint-driven-development` (MIT).
Status: done; shipped in #81.
Created: 2026-10-29.

## Problem

When an agent hits a red check it takes the cheapest road to green.
Often that means lowering the bar instead of fixing the code.
The moves are the same every time: a new `@ts-ignore`, `eslint-disable` or `# noqa`; a test skipped, deleted or stripped of its assertions; a stub that throws or an empty `catch` that swallows the failure; a threshold loosened in config; an exception added that nobody discussed.
Each one turns the build green while the code gets worse.
Nothing in the marketplace catches them today.
`protect-tests` only watches test edits while `/fix` runs.
No hook looks for suppression comments.
A project's quality bar is also not written down anywhere an agent reads it, so "done" means whatever the session decides.
This happens in every repo that installs the starter, on any change where a check fails.

## Proposed outcome

Every repo with the plugin has a floor that holds on day one with no setup: the five moves above are named in the diff before a commit or PR lands.
A repo can also write its quality bar into a `CONSTRAINTS.md` at its root, which every agent reads before writing code.
The file has a floor that is the same everywhere, numbered rules that each name the command that checks them, measured values that may rise but never fall and exceptions with an owner and an expiry.
A `/constraints` command writes that file from what it can detect in the repo, asking only what it cannot.
The reviewer, the verifier and `/review` check against the same file, so "done" means one thing.

## Affected users and systems

Jody and any agent session in a repo that installs pro-quality (it is in the starter): JJ, mieruka, personal-site, gemini-live and this repo.
pro-quality (new skill, command and hook script, its `hooks/hooks.json`, Codex parity files, manifests and marketplace entry).
`/pro-dev install` in pro-core, if it offers `/constraints`.
pro-ai-sdlc's reviewer and verifier, which would read the file.
`docs/licenses.md`, routing cases and `tests/check.mjs`.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
The hook script is Python, like every other hook here; Jody ruled out Rust on 2026-10-29 because a compiled binary would have to be committed per platform or built on the user's machine.
The hook starts in warn mode behind `~/.claude/hooks/mode`, like the other gates.
It reads only the diff from the branch point plus untracked files, so it stays fast and never judges code the change did not touch.
It reports the rule and the file and line, never a matched secret value.
"Could not run" must never read as clean.
Tightening the bar is silent; only loosening is flagged.
The `/constraints` intake asks at most four questions, each with a default.
Forked or adapted text keeps its upstream footer and a row in `docs/licenses.md` (MIT, Copyright (c) 2025 Addy Osmani).

## Out of scope

Installing the tools behind the numbered rows (semgrep, osv-scanner, Lighthouse, axe).
Running the guard in CI; that is the `pipeline` item in the pro-ship brainstorm.
Switching the hook to enforce mode.
Writing `CONSTRAINTS.md` into Jody's other repos as part of this change; each repo gets one later by running `/constraints` itself.

## Success looks like

In Jody's repos an agent can no longer add `@ts-ignore` or `eslint-disable`, skip or delete a test, leave a stub or loosen a threshold without the hook naming it before the commit or PR.
A repo that runs `/constraints` ends up with a `CONSTRAINTS.md` where every number has a command behind it that runs today.
In warn mode the guard raises no false alarms Jody disagrees with over a couple of weeks of normal work.

## Open questions

- Which events the guard fires on: `git commit` catches it earliest but runs often; `git push` and `gh pr create` are cheaper and line up with pro-security's push gate. It also runs inside `pr-check` once that exists.
- Whether a repo with no `CONSTRAINTS.md` still gets the floor (recommendation: yes, every floor rule is a safe default).
- Whether a bare `TODO` counts as unfinished work; upstream flags it, which would be noisy in these repos (recommendation: leave it out of the floor or make it a warning only).
- pro-quality or pro-core as the home (recommendation: pro-quality, beside the planned PR gate; both are in the starter).
- Whether `/pro-dev install` offers `/constraints` during setup.
- How the reviewer and verifier read the file without breaking the fresh-context four-field handoff (likely as a path beside REVIEW.md).
- Likely needs an ADR: a floor that every plugin's gates and reviewers share, plus where the project's quality bar lives (`CONSTRAINTS.md` beside or inside REVIEW.md).

## Evidence

None; this is an idea.
Upstream reference: `skills/constraint-driven-development/SKILL.md` and `skills/constraint-driven-development/references/floor-guard.md` in agent-skills at commit `eb07f19`.
Our gap: no hook in `plugins/*/hooks/hooks.json` checks for suppression comments.
`plugins/pro-ai-sdlc/scripts/protect-tests.py` only acts in fix mode.
