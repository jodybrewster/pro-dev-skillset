# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

A developer installs the marketplace once and its skills then load in every project they work on (`README.md`).
The two cases under test are a solo developer building a full application and a consulting team delivering for a client (`docs/overview.md`).
A GTM engineer with no codebase is a stated goal for the core plugin, not a current user (`docs/decisions/0013-plugin-layering.md`).

## Product Purpose

It ships workflow intelligence to Claude Code and Codex sessions: skills, hooks, commands and agents that turn a task into the right phase and skill (`CLAUDE.md`, `plugins/pro-core`).
It is not an app and has no UI, server or database (`CLAUDE.md`).
The plugins are independent and work in any repo without Mieruka (`docs/overview.md`).

## Operating Context

It runs inside Claude Code and OpenAI Codex sessions on macOS or Linux, installed from a private GitHub repo that needs the `gh` CLI to bootstrap (`README.md`, `docs/private-repo.md`).
Every skill-bearing plugin also loads under Codex (`docs/codex-parity.md`).
Each plugin keeps its hooks in one `hooks/hooks.json` (`docs/hook-loading.md`, `plugins/pro-core/hooks/hooks.json`).

## Capabilities and Constraints

The marketplace lists 21 plugin folders, each versioned in `.claude-plugin/marketplace.json` and under `plugins/`.
`pro-dev-starter` pulls the default stack and `/pro-dev install` installs the external engines named in `plugins/pro-core/registry/engines.json`.
Every enabled skill and hook costs context and routing accuracy each session, so a plugin boundary is where a person turns a group of them off (`docs/decisions/0013-plugin-layering.md`).
Forked and adapted content keeps its upstream attribution (`docs/licenses.md`).

## Evidence on Hand

The keyless routing gate measures rank-1 accuracy over the skill catalog, run by `tests/route-lexical.mjs` and described in `docs/evals.md`.
`tests/check.mjs` runs the static checks that gate every commit (`CLAUDE.md`).

## Product Principles

- A plugin boundary exists where a real audience ends or a gate needs its own switch (`docs/decisions/0013-plugin-layering.md`).
- A content change under `plugins/<name>/` bumps that plugin's version in the same commit (`docs/version-bump-law.md`).
- Skills work without Mieruka and Mieruka works without them (`docs/overview.md`).
- Every bridge skill routes to an external engine registered as a row, not a copy of the upstream (`README.md`, `plugins/pro-core/registry/engines.json`).

The longer account of what the repo is and what it is testing is in [docs/overview.md](./docs/overview.md).
