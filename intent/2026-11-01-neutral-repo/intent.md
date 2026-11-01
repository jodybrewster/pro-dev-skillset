---
source: idea
kind: change
status: done
risk: medium
created: 2026-11-01T08:00:00-0500
author: the maintainer
---

# Intent: take the maintainer's name, quotes and the upstream author's handle out of the repo

Source: idea.
Status: done; shipped in #118 to #121 and the tests PR.
Created: 2026-11-01.
Related: [owner-neutral-skill](../2026-10-30-owner-neutral-skill/intent.md), which keeps owners out of the apps these plugins help build; this intent does the same for the marketplace itself.

## Problem

The repo names its maintainer about 900 times in 190 files.
Intents quote chat word for word, decisions carry "(name, date)" attributions, intent and ADR headers carry `author`, `Approver` and `Decided by` names, every plugin manifest carries a personal email and one script returns the maintainer's first name as a data value.
The handle `addyosmani` also appears about 160 times in 74 files, most of them in prose that only needs the repo name.
The marketplace is meant for other people to install and read, so this reads as one person's notebook and leaks a personal email.

## Proposed outcome

- No quote of chat and no "(name, date)" attribution anywhere in tracked files; each sentence states the decision itself.
- A role that has to be named is "the maintainer".
- No personal email in any manifest.
- The upstream is named "agent-skills" in prose; the handle stays only where the upstream's license or a working link needs it.
- `CLAUDE.md` already carries the rule for new work (#115); this intent clears what exists.

## Affected users and systems

Every tracked file outside `CHANGELOG.md`: `intent/` (98 files), `docs/` and the ADRs, the roadmap, `README.md`, `REVIEW.md`, `RELEASING.md`, `CLAUDE.md`, `templates/`, `tests/`, `demo/`, skill prose, script comments, the 22 plugin manifests plus their Codex twins and `.claude-plugin/marketplace.json`.
`plugins/pro-ship/scripts/risk-classify.py` prints `"approval": "Jody"` in its JSON, which its tests and the pr-check body read.

## Constraints

- MIT requires the upstream's copyright notice in every copy: "Copyright (c) 2025 Addy Osmani" stays in each plugin `LICENSE` and in the footers of forked or adapted files, and `docs/licenses.md` keeps its upstream links and copyright column.
- The repo path `jodybrewster/pro-dev-skillset` stays: install commands, `TRUSTED_REPO` and every GitHub link depend on it.
- Git history and closed pull requests are not rewritten; a force-push to `main` would break every clone and open branch.
- `CHANGELOG.md` is generated and is not edited (it has no mention today).
- The version-bump law applies to every plugin whose content changes.
- Each PR is one area and merges once its checks pass.

## Out of scope

Moving the repo to another owner or org.
Rewriting history.
The apps the plugins help build (owner-neutral-skill covers them).
Expanding `/pro-ship:ship` with more of agent-skills, which is the next change after this one.

## Success looks like

`git grep -i jody` returns only the repo path, and `git grep -i brewster` returns nothing outside the repo path.
`git grep -i -e addyosmani -e osmani` returns only license lines, license footers and upstream URLs.
No manifest has an `email` field with a personal address.
Every check in `CLAUDE.md`'s "Verifying your work" passes.

## Decisions

1. The maintainer's own copyright lines (three `LICENSE` files, the root `LICENSE` and 14 skill footers) become "Copyright (c) 2026 the pro-dev-skillset authors".
2. Manifest `author.name` and the marketplace `owner.name` become `pro-dev-skillset`, with no email.
3. `risk-classify.py` prints `"approval": "maintainer"`; its tests and readers change in the same PR.
