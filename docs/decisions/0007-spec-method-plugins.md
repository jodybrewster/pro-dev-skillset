# ADR-0007: Spec methods plug into the loop as opt-in plugins with stage hand-offs

Date: 2026-10-28

## Status

proposed

## Context

Jody wants to try several spec-driven methods side by side by installing and uninstalling plugins: pro-ai-sdlc, pro-spdd, GitHub spec-kit and Google's Elephant-Goldfish Model (EGM).
Nothing said how they relate, so with two installed a session could start the same feature in two places.
EGM is Google's own plugin, `egm@egm`, in its own marketplace, which a registry row from ADR-0006 could not register.
Its `egm-review-loop` reads reviewer persona and standard files by path, so a repo can bring its own goldfish without a fork.
Source: intent/2026-10-28-spec-methods/.

## Decision

A spec method is an opt-in plugin that ships one `sdlc-method.json` naming its hand-offs by stage: `intent`, `spec`, `plan` or `review`.
pro-ai-sdlc finds them at run time from the enabled `*@pro-dev-skillset` plugins that cover the repo and offers each hand-off as a yes or no question.
It never runs one on its own and never lets a method replace `spec.md` or `plan.md`.
Method files from other marketplaces are ignored, because their text reaches the model's prompt.

A third-party method plugin stays as its upstream ships it.
A pro-dev glue plugin holds the bridge skill, any command and the `sdlc-method.json`; for EGM that is `pro-egm`, which runs EGM's review loop on our own spec and plan with goldfish a repo keeps in `.egm/`.

ADR-0006's registry row gains an optional `marketplace` object, `{ "name", "source" }` with `source` as `owner/repo`.
`/pro-dev` registers that marketplace before the row's install and refuses when a marketplace of that name points at a different source.
This is a user-wide write, accepted for rows that name a marketplace.
Before installing a third-party plugin `/pro-dev` shows what it carries.
`/pro-dev check` names one that gained a hook or MCP server since the last run.
Such a row may default to installed, since installing its glue plugin is the opt-in.

## Consequences

Adding or removing a method touches no pro-ai-sdlc file; intent E's spec-kit plugin is the second method and must fit this contract unchanged.
With no method installed the loop runs exactly as before.
A glue plugin depends on its upstream's inputs, so an upstream change can break it without a release of ours.
Reverse it if EGM keeps changing its review-loop inputs often enough that pro-egm keeps breaking: drop pro-egm and run EGM by hand, keeping the `sdlc-method.json` contract for the other methods.

## Enforced by

- [`plugins/pro-ai-sdlc/scripts/methods.py`](../../plugins/pro-ai-sdlc/scripts/methods.py) discovers and prints the hand-offs.
- [`plugins/pro-egm/scripts/goldfish.py`](../../plugins/pro-egm/scripts/goldfish.py) resolves the reviewers and reading list and confines every path to the repo.
- [`tests/check.mjs`](../../tests/check.mjs) fails on a malformed `sdlc-method.json` and on a malformed `marketplace` object in a registry row.
- [`plugins/pro-core/scripts/pro-dev.py`](../../plugins/pro-core/scripts/pro-dev.py) registers and checks a row's marketplace and reports a plugin's surface.
