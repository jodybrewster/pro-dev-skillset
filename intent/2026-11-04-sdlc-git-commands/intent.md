---
source: idea
kind: change
breaking: false
status: proposed
risk: high
level: 3
created: 2026-11-04T14:15:00-0500
author: the maintainer
---

# Intent: slash commands recommend each git step and the person decides

Source: idea.
Status: proposed.
Created: 2026-11-04.
Related: [release-versioning](../2026-11-03-release-versioning/intent.md).

## Problem

The SDLC commands stop at the file and leave the git work to the person.
Each stage of the 2026-11-04 retest needed a branch, a commit, a push, a pull request and a merge typed by hand.
The release needed the same again, plus a version step, a tag and a push, in exact order.

Typing these by hand is slow and it goes wrong.
Commands landed in the wrong window several times and the person has to know the right flags, such as pinning a merge to its head commit.
None of it helps the decision the person is actually there to make.

## Proposed outcome

The whole loop runs from `pro-ai-sdlc`, including ship.
Each git step has a slash command that looks at the state, recommends what to do, gives the reason and asks.
The person answers yes, changes it or says no, so every decision is informed and the typing is gone.

- `/branch`, `/commit` and `/pr` recommend the name, then the files and message, then the body with its pr-check result.
- `/merge` recommends merge or wait, with the checks, findings and risk. It pins the merge to the head it showed.
- `/release` recommends the version from the changes and opens a release pull request with only those files.
- `/tag` checks for a GO on the commit, recommends the tag and creates and pushes it on a yes.

The person can override any recommendation.
A larger version needs no argument and is recorded as their choice.
A smaller one than the changes suggest first names the change that says breaking and what that means for callers.

## Affected users and systems

- `pro-ai-sdlc`: new commands, a declared dependency on `pro-ship` and its routing cases.
- `pro-ship`: its `ship` and `deployed` stop competing with the commands of the same name for `pro-ai-sdlc` users.
- ADR-0025, still proposed, plus the docs that say a person types the tag.
- mieruka, if its buttons call these commands.

## Constraints

- Every command opens with the repo, the branch and the commit, so a yes also confirms the right window.
- Nothing merges or tags without the person's yes in that session.
- `/auto` never calls `/merge` or `/tag`.
- On a NO-GO, `/tag` shows the Blockers and the fix or accept-by-name choice, then records what was accepted.
- `/ship` stays read-only, because the gates trust its record for that reason.
- Repo protections still apply: no command bypasses a tag ruleset or a required check.
- A pushed tag cannot be taken back, so `/tag` says so before asking.
- Codex parity, the version-bump law and the layering rule of ADR-0013 apply.
- A security challenge comes first, because this gives an agent a path to merge and tag.

## Out of scope

- A branching model with long-lived `develop` or `release` branches.
- Moving `ship.py` and the gates: ADR-0013 decides where they end up and the commands do not change when they move.
- Unattended merging, which ADR-0024's levels govern.

## Success looks like

A person takes a change from idea to a pushed tag using only slash commands and types no git command.
In a test where a command runs in the wrong repo, the first line makes that visible before anything is pushed.

## Open questions

- Whether `pro-pdd`, `pro-spdd` and `pro-speckit` are being retired. If they are, everything can move into `pro-ai-sdlc`; if not, `pro-ship` keeps the scripts. The maintainer decides.
- How routing keeps `/ship` unambiguous when both plugins are installed: a bare `/review` already reached the wrong reviewer in the retest.
- What happens to `/commit-push-pr` and `/merge-pr`, which exist only in a personal setup today.
- Likely needs an ADR: ADR-0025 says the tag stays a person's step, that `/ship` prints the command and that letting `/ship` create the tag was rejected because a pushed tag cannot be taken back. `/tag` keeps `/ship` out of it and keeps the person's decision, but it changes who runs the command, so ADR-0025 must be amended before its sign-off.

## Evidence

- On 2026-11-04 the retest's demo commands landed in the wrong repo's window at least three times.
- `docs/decisions/0025-release-versions.md:23` and `:39` hold the tag rule this changes.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json` declares no dependencies, although its commands call `pro-ship`'s `pr-check`.
