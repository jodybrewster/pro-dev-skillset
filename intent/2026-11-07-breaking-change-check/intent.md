---
id: PDS-53
source: idea
kind: idea
breaking: false
status: draft
risk: medium
level: 3
created: 2026-11-07T14:31:00-0500
author: the maintainer
---

# Intent: a check that finds breaking changes in the diff

Author: the maintainer.
Source: idea.
Status: draft.
Created: 2026-11-07.

## Problem

An intent records `breaking: true | false` and `ship.py version` turns it into a major version, but nothing checks it against the code.
ADR-0025 says so: "Not enforced yet for the `breaking:` field in intents."
An intent marked `breaking: false` can change a public function signature, remove an export, rename an API route or change a CLI flag, and the release goes out as a minor or a patch.
`risk-classify.py` does not look at public interfaces at all, so such a change can also be graded low and merge unattended.
agent-skills covers this ground in `api-and-interface-design` and `deprecation-and-migration`, and neither was adopted.

## Proposed outcome

Before a pull request, the diff's public surface is compared before and after: exported symbols and their signatures, HTTP routes and their request and response shapes, CLI commands and flags, config keys and database columns.
A removed or changed public item is reported as breaking with the file and line.
When the intent says `breaking: false` and the diff breaks something, `pr-check` reports it as a finding and the risk tier rises to at least medium, so it never merges unattended.
A deprecation path from `deprecation-and-migration` (keep the old name, warn, remove later) is offered as the fix.

## Affected users and systems

`pro-ship` (`pr-check`, `risk-classify.py`, `ship.py version`), `pro-ai-sdlc`'s intent template, and every repo whose releases follow ADR-0025.

## Constraints

The comparison is deterministic and runs locally without a model call, like `risk-classify.py`.
Any review prose that needs a model runs inside `pr-check`, never in CI.
Adapt the agent-skills material with its MIT attribution and a row in `docs/licenses.md`.

## Out of scope

Generating migration guides.
Languages the comparison cannot parse: it reports "could not check" for those and does not guess.

## Success looks like

A pull request that removes an export from a change marked `breaking: false` gets a finding naming the export, and its tier is at least medium.

## Open questions

Which languages to support first: the maintainer's repos are mostly TypeScript and Python.

## Evidence

ADR-0025, "Where it is enforced".
