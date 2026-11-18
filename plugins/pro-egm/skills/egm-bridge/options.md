# Options research

`/pro-egm:brainstorm` runs this after EGM's readiness gate passes and before EGM's goldfish swarm, so the swarm reads real options instead of a build by default.
The person can skip it at the gate.

## What it finds

For the anchored hypothesis, real candidates in four kinds:

- patch: change what exists today
- buy: a commercial product or managed service
- open source: a project that can be adopted
- build: what would be written new and why nothing above fits

## How it runs

Spawn research subagents in one turn, one per kind except build, each with web search and web fetch.
Pass each one only the anchored hypothesis, the constraints and the assumptions table, never the conversation.
Run them on a fast model (Haiku when the host has it) with medium effort.
Each returns at most five candidates.
For each candidate it gives the name, what it does for this problem, fit, cost (licence and running cost), risk, lock-in, maturity, licence and the effort to run it.
Every claim about a product, price, licence or adoption figure carries a source URL and the date it was read.
A claim with no source is dropped.
Nothing about a product, price or licence is stated from memory, including by this session.

The default cap is three subagents and about 20 pages read in all.
The person can raise or lower it at the gate.

## What goes in the brief

Write the results into `concepts_brief.md` under `## Options`:

| Option | Kind | Fit | Cost | Risk | Lock-in | Licence | Source and date |
|---|---|---|---|---|---|---|---|

Then one line per rejected option with the reason it lost.
EGM's `## Alternatives Weighed` section keeps the same reasons in its own words, because `egm-draft` reads only that section for alternatives.
