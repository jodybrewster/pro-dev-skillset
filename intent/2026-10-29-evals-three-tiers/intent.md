---
source: research
kind: change
status: proposed
risk: low
created: 2026-10-29T10:00:00-0400
author: Jody Brewster
---

# Intent: behavioral, plugin and CI evals

Author: Jody Brewster (pro-dev-skillset).
Source: a side-by-side read of Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills) (MIT, v0.6.14, commit eb07f19) on 2026-10-29.
Jody: "lets add in the evals they have that we don't. Behavioral, plugin, CI".
Status: proposed.
Created: 2026-10-29.

## Problem

We only test whether a model would pick a skill, never whether a skill changes what the agent does.
`tests/eval.mjs` asks Haiku to choose one skill per prompt from names and descriptions.
It needs an API key, so CI runs it as `--dry`, which only checks that the 80 cases name real skills.
Nothing in CI fails when a description drifts or when two descriptions start to collide.
38 skills and agents have no routing case and nothing stops that number growing.

agent-skills measures three things we do not:

- a keyless, deterministic routing score over descriptions that gates CI with a floor, plus a collision check between descriptions;
- behavioral evals that run headless `claude` in a throwaway repo built from fixtures and grade the trace against written expectations, including pressure cases (deadline, sunk cost, authority);
- plugin evals under `claude plugin eval`, scored with and without the plugin, as pairs of a case where a skill must fire and one where it must stay quiet.

Their README shows why it matters: one clause in a description took the review skill from 7 of 27 fires to 21 of 27. Nothing short of a real run would have shown it.

## Proposed outcome

Three tiers, each in our own zero-dependency style:

1. CI tier: a lexical router over the catalog runs `tests/cases/routing.jsonl` with no key, gates on a rank-1 floor and fails on near-duplicate descriptions; a ratchet stops new skills shipping without a routing case.
2. Behavioral tier: a runner under `tests/` with cases in `evals/cases/` and fixtures in `evals/fixtures/`, run on demand, with a baseline arm that runs without the skill so each result shows what the skill adds.
3. Plugin tier: fires and stays-quiet case pairs inside pro-execution, pro-quality and pro-pdd, wired through `experimental.evals`, run on demand with `claude plugin eval`.

The first cases cover the discipline skills where skipping hurts most: `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review` and `writing-plans`.

## Risk

Low.
The CI tier adds checks that can fail a PR, so its floor starts below the measured baseline.
The live tiers spend tokens and never run in CI; the repo has no API secret.
Three plugins gain an `evals/` folder and a manifest key, which ships to installs and needs the version bumps.
