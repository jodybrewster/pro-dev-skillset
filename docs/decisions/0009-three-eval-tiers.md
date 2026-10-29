# ADR-0009: Three eval tiers; CI gates only the keyless one

Date: 2026-10-29

## Status

proposed

## Context

Until now the only eval was `tests/eval.mjs`, which asks Haiku to pick one skill per prompt.
It needs an API key, so CI ran it as `--dry` and only checked that the cases name real skills.
Nothing measured whether a skill changes what the agent does.
Nothing in CI failed when a description drifted.
Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills) measures routing without a key, runs behavioral evals against fixtures and ships `claude plugin eval` cases.
The repo has no API secret in GitHub Actions.
Source: intent/2026-10-29-evals-three-tiers/.

## Decision

Evals come in three tiers.

The keyless tier runs in CI on every PR.
`tests/route-lexical.mjs` ranks the catalog against `tests/cases/routing.jsonl` with stemmed TF-IDF, gates on a rank-1 floor and fails on near-duplicate descriptions.
The `eval-coverage` check fails on a skill with no routing case unless it is on `tests/cases/uncovered.json`, which can only shrink.

The behavioral tier runs on demand.
`tests/behavioral.mjs` builds a throwaway git repo from `evals/fixtures/`, runs `claude --bare` with the skill and grades the trace against the case's expectations, with a baseline arm that runs without the skill.

The plugin tier runs on demand.
A plugin that carries cases sets `experimental.evals` in its manifest and keeps fires and stays-quiet pairs under its own `evals/` folder for `claude plugin eval`.

Neither live tier runs in CI or spends tokens without an explicit command.
The floor is raised as routing improves and never lowered to let a regression pass.

## Consequences

A new skill needs a routing case before it merges.
A description edit that drops a skill below the floor or makes it collide with another fails the PR.
Behavioral and plugin results are read as numbers with a baseline, never as pass or fail; skill firing is stochastic.
Plugins with cases ship their `evals/` folder to installs, a few kilobytes each.
