---
intent: intent/2026-11-01-neutral-repo/intent.md
intent-status: accepted
status: accepted
created: 2026-11-01T08:00:00-0500
author: the maintainer
---

# Spec: a repo with no maintainer name, no chat quotes and no stray upstream handle

Built from `intent.md` in this folder.
Status: accepted.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, ADR-0002, ADR-0004, `docs/licenses.md`, the plugin `LICENSE` files and the MIT license text.

## Summary

After this change the tracked files describe decisions without saying who made them or quoting chat.
Personal emails are gone from the manifests.
The upstream is called agent-skills in prose, while every notice MIT requires stays.

## Requirements

### Functional

- R1. `git grep -I -n -i jody -- . ':!CHANGELOG.md'` matches only the string `jodybrewster/pro-dev-skillset` (repo path, links, `TRUSTED_REPO`, install commands).
- R2. `git grep -I -n -i brewster -- . ':!CHANGELOG.md'` matches only that same repo path.
- R3. No tracked file holds a quote of chat attributed to the maintainer or a `(<name>, <date>)` attribution; sentences that carried one state the decision on their own.
  Dates that matter to the decision (an ADR's date, an enforce decision due date) stay.
- R4. `author:`, `Author:`, `Approver:` and `Decided by:` lines name "the maintainer" where they named a person.
- R5. Every `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` has `author: {"name": "pro-dev-skillset"}` with no `email`; `.claude-plugin/marketplace.json` has `owner: {"name": "pro-dev-skillset"}` with no `email`.
- R6. The maintainer's copyright lines read `Copyright (c) 2026 the pro-dev-skillset authors` in the root `LICENSE`, the plugin `LICENSE` files and the skill footers.
- R7. `git grep -I -n -i -e addyosmani -e osmani` matches only: `Copyright (c) 2025 Addy Osmani` lines in `LICENSE` files and forked-file footers, the copyright column of `docs/licenses.md` and URLs to `github.com/addyosmani/agent-skills`.
  Prose such as "addyosmani's ship" becomes "agent-skills' ship".
- R8. `risk-classify.py` prints `"approval": "maintainer"` where it printed the first name; `tests/unit/risk-classifier.test.mjs`, `tests/fixtures/risk/` and the pr-check body draft read the new value.
- R9. A `names` check in `tests/check.mjs` fails on any match outside R1, R2 and R7, so the rule holds for later work.
  It skips this intent folder and `tests/check.mjs` itself, which have to spell the terms out.

### Non-functional

- N1. No behavior change other than R8: every existing test passes unchanged except for the `approval` value.

### Policy constraints applied

- MIT notice (upstream LICENSE): the 2025 Addy Osmani copyright and permission notice stay wherever forked or adapted content lives (R7).
- Version-bump law (ADR-0002): every plugin whose files change bumps in both manifests and the marketplace entry, plus `metadata.version` once per PR.
- Codex parity (ADR-0004): the Codex manifests change with the Claude ones (R5).
- `CHANGELOG.md` is generated: excluded from every grep and never edited.
- REVIEW.md personal data: no email outside manifest `author` or `owner` fields; after R5 there is none at all.

## Design

### System

Four PRs, one area each, each merged when its checks pass:

1. `intent/` (R3, R4).
2. `docs/` with the ADRs and the roadmap, plus `README.md`, `REVIEW.md`, `RELEASING.md`, `CLAUDE.md`, `templates/`, `demo/` (R3, R4, R6 for the root `LICENSE`, R7).
3. `plugins/` (R3, R5, R6, R7, R8) with the version bumps.
4. `tests/` plus the `names` check (R8, R9), landing last so it passes on a clean tree.

A rewrite is done by reading each sentence and restating it, not by deleting the name, so no sentence is left without its subject.

### Alternatives considered

- Removing the upstream copyright lines: breaks the MIT license.
- Renaming the repo path: breaks every install; a move to an org is its own change.
- Rewriting history: breaks every clone and open branch.
- One PR for everything: about 200 files is too much to review at once.

## Flagged concerns

ADR needed: no, the rule is in `CLAUDE.md` and the `names` check enforces it; nothing here is expensive to reverse.

None found beyond the constraints the intent already settles; sources checked: `CLAUDE.md`, `REVIEW.md`, `docs/licenses.md`, the plugin `LICENSE` files.

## Open questions

None.

## Acceptance criteria

- AC1. The greps in R1, R2 and R7 return only the allowed matches.
- AC2. `node tests/check.mjs` passes with the new `names` check, and it fails when a test adds the maintainer's first name to a tracked doc.
- AC3. Every command in `CLAUDE.md`'s "Verifying your work" passes.
- AC4. `risk-classify.py --json` on a high-risk fixture prints `"approval": "maintainer"`.

## Out of scope

History rewrites, the repo path and expanding `/pro-ship:ship`.
