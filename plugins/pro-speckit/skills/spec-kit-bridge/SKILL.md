---
name: spec-kit-bridge
description: Bridge to GitHub's spec-kit - run a feature through its constitution, specify, plan, tasks and implement flow instead of /spec and /plan. Use when someone wants spec-driven development with spec-kit, asks about /speckit-specify or the specify CLI, or wants spec-kit installed or removed. This is a BRIDGE (not vendored); the CLI installs through the /pro-dev command.
---

# spec-kit-bridge

This is a bridge, not a vendored skill.
The engine is GitHub's spec-kit and its `specify` CLI.
Nothing of it is copied here, so it updates with the pin pro-core reviews.

## When to use spec-kit

Use it for a feature you want to take through spec-driven steps with files kept in the repo: ground rules, a spec, a plan, a task list and then the build.
It is one way to do the spec and plan stages, an alternative to `/spec` and `/plan`.
Skip it for a small fix that fits an intent and a short plan.

## The commands, in order

1. `/pro-speckit:install` gets the `specify` CLI and sets spec-kit up in this repo; `/pro-dev install` does the same with the other engines.
   It stops with a one-line reason when the tree is not clean.
2. Review and commit the new `.specify/` and `.claude/skills/speckit-*/` files.
3. `/speckit-constitution` once per repo, to write its ground rules.
4. `/speckit-specify` for each feature.
5. `/speckit-plan`.
6. `/speckit-tasks`.
7. `/speckit-implement`.
8. `/pro-dev check` any time, to see whether the spec-kit files still match what was reviewed.
9. `/pro-speckit:install update` after a pro-speckit update, to move to the next reviewed pin.
10. `/pro-speckit:remove` to take spec-kit out of the repo.

You type every `/speckit-*` command yourself.
Its skills are user-invocable only, so the model does not start them on its own.

## Where the output lives

Setup files go under `.specify/` and `.claude/skills/speckit-*/`.
Each feature gets a folder `specs/<NNN>-<feature>/`.

## One loop per feature

A feature runs through spec-kit or through `/spec` and `/plan`, never both.
When you take the offer at the end of `/intent`, the intent folder keeps its `intent.md` only and gets no `spec.md` or `plan.md`.
Add a "spec-kit:" line to `intent.md` that links the feature's `specs/` folder.

## Review these like code

Treat a change to any of these as you would a change to code in a PR:

- `.specify/scripts/` and `.specify/templates/`
- `.claude/skills/speckit-*/`
- `.specify/extensions.yml`, `.specify/extensions/`, `.specify/presets/`, `.specify/workflows/`, `.specify/integration-events.yml` and `.specify/integrations/packages/`
- hooks in `.claude/settings.json`
- `.specify/feature.json`
- `.specify/memory/constitution.md`
- `specs/**/tasks.md`

## Needs uv

The CLI installs with `uv`, which pro-speckit does not install for you.
Install it first: https://docs.astral.sh/uv/getting-started/installation/

## Removing

`/pro-speckit:remove` takes spec-kit out of the repo and leaves `specs/` alone.
`uv tool uninstall specify-cli` drops the CLI machine-wide, once no repo needs it.

## Codex

Codex does not run the pro-speckit commands.
Install `uv`, then the person installs the `specify` CLI from GitHub's spec-kit repository by its documented lines and runs `specify init --here --integration codex` in a clean repo.
Then use the spec-kit commands Codex shows for that integration, in the same order as above.

---

_Bridge to GitHub's spec-kit ([github/spec-kit](https://github.com/github/spec-kit)). No upstream content is vendored here; this file is original. Install and license terms are governed by the upstream repo._
