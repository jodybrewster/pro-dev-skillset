---
source: idea
kind: change
status: accepted
risk: low
created: 2026-10-29T15:30:00-0400
author: the maintainer
---

# Intent: evals for pro-ai-sdlc and pro-egm

Author: the maintainer.
Source: a 2026-10-29 decision to move from pro-pdd toward ai-sdlc and to add evals for pro-ai-sdlc and the EGM plugin.
Status: accepted on 2026-10-29.
Created: 2026-10-29.

## Problem

pro-ai-sdlc is becoming the maintainer's main loop and pro-egm plugs a Goldfish review into it, but neither has an eval.
Their tests cover plumbing only: the hook scripts (`tests/sdlc-hooks.mjs`), the `/execute` scripts (`tests/execute.mjs`), the goldfish script (`tests/goldfish.mjs`) and the `sdlc-contract` check.
Nothing checks that `/spec` writes statements a command can check, that `/plan` ties every step to them, that `/review` catches a planted bug, that `/execute` refuses an unapproved plan or that the agents get used when they should.
The four pro-ai-sdlc agents have no routing case either.

## Proposed outcome

`claude plugin eval` suites inside both plugins, run on demand like the ones from PR 75:

- pro-ai-sdlc: command cases on a scaffolded fixture repo that grade what each command writes or refuses, should-fire cases for the agents and stays-quiet cases beside them.
- pro-egm: the bridge skill fires on a Goldfish request and stays quiet on a plain code review; `/pro-egm:goldfish init` writes the config; a review without `egm@egm` stops with the install line; the `goldfish-reviewer` agent stays read-only.
- Routing cases for the four pro-ai-sdlc agents in the keyless tier.
- A first baseline for every case, recorded in `docs/evals.md`.

## Risk

Low.
The suites ship inside the two plugins and bump them.
The maintainer has uncommitted edits to four pro-ai-sdlc commands on main (the `; true` guards on their context lines); the baseline is taken after those land so it measures the commands he is keeping.
