---
source: idea
kind: change
status: accepted
risk: medium
level: 2
created: 2026-11-03T21:00:00-0500
author: the maintainer
---

# Intent: one command builds a fresh factory demo

Source: idea.
Status: accepted.
Created: 2026-11-03.
Related: [software-factory](../2026-11-03-software-factory/intent.md), [release-versioning](../2026-11-03-release-versioning/intent.md).

## Problem

The first factory demo was set up by hand over an afternoon: the tiny-tasks fixture, a role map with fictional people, branch protection with a required check, a CI workflow, a `## Ship` block, a `v1.0.0` tag on the starting code, the plugins at local scope and two accepted intents.
Retesting the factory after a change means doing all of it again.
A half-cleaned demo gives misleading results on mieruka's board.

## Proposed outcome

`demo/factory/new-demo.sh <name>` creates a private GitHub repo and a local checkout with everything the demo needs, ready for `factory.py run --next` and for the larger intent of the demo script.
`demo/factory/remove-demo.sh <name>` archives the GitHub repo, uninstalls the local-scope plugins and moves the checkout to the Trash.
`docs/factory-demo.md` starts from the script.

## Constraints

- The demo uses fictional people only.
- The script refuses a name that already exists, on GitHub or on disk.
- Removing a GitHub repo is the person's call: the remove script archives; it prints the delete command instead of running it.

## Out of scope

The e2e harness, which builds its own throwaway repos.

## Success looks like

`demo/factory/new-demo.sh factory-demo-2` followed by the demo script's acts runs the whole show again, release included, with no hand setup.

## Open questions

None.

## Evidence

The 2026-11-03 demo at https://github.com/jodybrewster/factory-demo, set up by hand.
