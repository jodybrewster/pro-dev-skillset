---
id: PDS-42
source: idea
kind: change
status: accepted
risk: medium
level: 2
created: 2026-11-03T20:30:00-0500
author: the maintainer
---

# Intent: releases carry a version, checks that fit the target and deploy facts from the deploy

Source: idea.
Status: accepted.
Created: 2026-11-03.
Related: [software-factory](../2026-11-03-software-factory/intent.md); the agent-skills baseline `skills/git-workflow-and-versioning` (section "Release & Versioning").

## Problem

The first `/pro-ship:ship` on the factory demo had no earlier release tag, so it asked which commit the release range should start from and listed commit hashes.
A person cannot answer that without reading git history.
Nothing in the loop says what version a release is: the factory merges changes but never records whether each one is a feature, a fix or a breaking change.
`/ship` never proposes a version either.
The agent-skills baseline covers semantic versioning, the tag as the source of truth and a human changelog written in the same change; pro-ship took on none of it and did not write down why.

## Proposed outcome

- `/pro-ship:ship` proposes the next version in plain words ("v1.1.0: two features and one fix since v1.0.0") from the changes since the last release tag, using semantic versioning: a breaking change is major, a new feature minor, a fix patch.
- With no release tag yet, it reads the version the project already declares (package.json, pyproject.toml, Cargo.toml) and offers to tag what was already out as that version, instead of asking for a commit.
- Each change records its kind once: the intent's `kind:` (idea, bug, change) plus a breaking flag, so the factory and `/execute` know whether it is a feature, a fix or breaking.
- A human changelog entry is written in the same change, under Unreleased, grouped Added, Changed, Fixed, Deprecated, Removed, Security; `/ship` turns Unreleased into the version it proposes.
- The version in the project's manifest is bumped in the release change, so the tag, the manifest and the changelog agree.
- `/pro-ship:deployed` picks its post-deploy checks by the target's kind: a library or `tag-release` target gets tests on a clean checkout of the tag, a run of the documented use and a rollback dry run.
  It is never asked to confirm health, error rate, latency or logs; a service keeps those checks.
- A deploy record takes its facts from the deploy: the time the tag was pushed (or the GitHub deployment's time) and the environment the target names, not the moment the record is written or a label the skill picks.
- `/pro-ship:ship` reports whether release tags are protected (a ruleset on `v*`) and whether CI runs on tags; it names the risk once and does not block on it.

## Constraints

- Follow the agent-skills baseline section in full; anything dropped is written down with its reason.
- The tag stays a person's step; `/ship` proposes, it never tags.
- A repo whose changelog is generated (like this marketplace) is told apart and left alone.

## Out of scope

Publishing packages; release notes on GitHub releases beyond what the changelog holds.

## Success looks like

On a repo with no release tag, `/pro-ship:ship` asks one plain question ("tiny-tasks says 1.0.0; tag what is on main before the first factory change as v1.0.0?") and then proposes "v1.1.0 (minor): Added sort by title, due dates; Fixed trimmed titles", with the changelog already written by the changes themselves.

## Open questions

None.

## Evidence

The factory demo's first `/pro-ship:ship` (2026-11-03) asked the person to pick a base commit from three hashes.
Its first GO then told the person to tag v1.0.0, a version already tagged; the 1.1.0 bump and the README were written by hand in a separate PR.
Its `/pro-ship:deployed` left the v1.1.0 deploy partial over four server checks that cannot apply to a library.
It also recorded the time the record was written as the deploy time.
The release review noted that a `v*` tag could land on any commit.
