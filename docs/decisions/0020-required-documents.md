# ADR-0020: Every repo has a required document set, computed from its code and tuned in REVIEW.md

Date: 2026-10-30

## Status

proposed

Decided by: Jody Brewster.
Source: intent/2026-10-30-required-documents/.

## Context

The reviewer's policy field, the risk classifier and `pr-check` all read a repo's documents, so a reviewer given an empty or stale policy reviews against nothing.
Nothing in the marketplace said which documents a project must have.
`/pro-dev install` drafted only `CLAUDE.md` and `REVIEW.md`.
`docs-before-push.py` checks that existing key documents move with the code, but never asks for a missing one.
Jody asked on 2026-10-28 that every project have the documents it needs.

The set has to depend on the project: a CLI has no design system and a single script needs no architecture page.
It has to work with only some plugins installed.
It has to scale from one person to a team, which is why the other dials live in `REVIEW.md`.

## Decision

Every repo with the plugins has these documents:

| Document | Required when |
|---|---|
| README.md, CLAUDE.md, AGENTS.md, REVIEW.md | always |
| `docs/decisions/` (or `docs/adr/`) holding a tracked file | always |
| ARCHITECTURE.md | the code shows more than one module, service or deployable |
| PRODUCT.md | the project has users or an install base |
| DESIGN.md | the project has a UI |

One deterministic script, `plugins/pro-quality/scripts/required-docs.py`, works the set out from the tracked files.
`/pro-dev install` and `pr-check` both run it; neither carries its own copy of the rules.

A repo tunes the set with one fenced block under `## Required documents` in `REVIEW.md`, holding `add` and `remove` lists.
`remove` may name only the three conditional rows.
With no block or one that cannot be read, the built-in default applies.
An unreadable block is reported.
`pr-check` reads the block from the merge base, so a pull request cannot loosen its own set.

A missing document is Should-fix and never blocks, until the scaling block of ranked item 21 adds a severity dial.

The README, ARCHITECTURE and PRODUCT templates live in pro-ai-sdlc and are read in place; only the drafted document lands in a repo.
PRODUCT.md follows impeccable's product record (product-schema 1) and DESIGN.md is left to impeccable's `document`, so the two tools never disagree on a format.
AGENTS.md is a symlink to CLAUDE.md or a pointer to it; a differing copy is reported.

## Consequences

Every PR shows which required documents are missing, with the rule that asked for each.
A repo that lacks one still merges.
The detection is a heuristic, so it can be wrong for an odd layout; the install question and the `REVIEW.md` block correct it and a wrong guess costs one Should-fix line.
The block parser is a second copy of the classifier's restricted YAML subset, because plugins cannot import each other (ADR-0003).
Templates that every method needs sit in one method plugin, against ADR-0013's rule that a method holds only its method; they move when the dev domain is consolidated.

What must stay true:

- `pr-check` only consumes the check; the rules live in one script.
- "Could not run" is never reported as "nothing missing".
- `/pro-dev install` never overwrites a document that exists.
- The stamp contract does not carry the list.

Revisit if the detection picks the wrong rows in more than one repo in a month or when ranked item 21 adds the severity dial.

## Alternatives considered

A separate file for the set (`.pro-dev/docs.json` or `REQUIRED-DOCS.md`).
It adds a file every gate must find, while `REVIEW.md` already holds the review dials that a team changes through a reviewed PR.

An explicit `required` list in the block.
Detection would stop once the list is written, so a repo that later gains a UI would never be told it needs DESIGN.md.

Detection inside `pr-check.py` or pro-core's `pro-dev.py`.
pr-check would own a rule it should only consume; pro-core must not assume a codebase (ADR-0013).

## Enforced by

- [`tests/required-docs.mjs`](../../tests/required-docs.mjs) through the `required-docs` check in [`tests/check.mjs`](../../tests/check.mjs), which also fails when a template or a consumer's reference to the script goes missing.
