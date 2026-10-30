# ADR-0011: Plugins are split by audience, not by size

Date: 2026-10-30

## Status

proposed

## Context

The marketplace has grown to 20 plugin folders with no written rule for where a skill goes or when a plugin boundary is justified.
Some of the result is drift: `pro-data` holds four JS/TS stack skills, `pro-ship` holds one Vercel bridge, `pro-design` and `pro-motion` overlap on motion and `pro-design` and `pro-nextjs` both carry a shadcn skill.
The question of why plugins are separate came up on 2026-10-30 while deciding whether to consolidate.

Two costs drive the answer, and both are paid per enabled plugin, every session, whether or not the session uses it:

- Every enabled skill's description goes into context each turn and competes in routing.
  The catalog has 94 skills and the keyless routing gate scores rank-1 at 75.9%; every irrelevant candidate makes the wrong skill likelier and costs tokens.
- Every enabled hook runs.
  A hook firing where it does not belong is worse than an unused skill: `pro-quality` had to be disabled in the hq planning repo because `docs-to-project`, `docs-before-push` and the `user-validation` Stop hook fired on planning sessions and on pushes of other repos (hq AGENTS.md, 2026-10-17).

A plugin is the only unit a person can enable or disable, so plugin boundaries are the only knob for these costs.
Two goals shape where the boundaries go.
Jody wants to trial SDLC methods by turning them on and off, so each method is its own plugin.
The repo is open source and the core must serve someone outside software: a GTM engineer who hacks social media and video content, has no codebase and would carry a GTM plugin instead of a dev one.
That rules out folding engineering discipline into core.

This split is our own design.
[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) ships one flat plugin of 25 stack-neutral skills organised by SDLC phase; `claude-plugins-official` ships per-vendor plugins with no shared core.
Neither has stack-specific skills next to a general layer, which is the case that forces layering here.

## Decision

A plugin boundary exists where a real audience ends or where a gate needs its own switch, and nowhere else.
Size is a symptom, never the reason: a large plugin is fine when everyone who installs it uses most of it.

The audiences form four layers, each tested by one question:

| Layer | Test: would this person want all of it? | Today |
|---|---|---|
| core | anyone working with AI, in any domain, with no codebase | `pro-core` (find-skills, dream and memory, the session ledger, `/pro-dev`, the engine registry), `/research` |
| domain | anyone in this practice, with no UI and no chosen method | `pro-dev` for software engineering: today's `pro-execution` and `pro-quality`, the reviewer, the PR gate and risk tiers; a future `pro-gtm`, seeded by `lead-research` |
| layer under a domain | anyone on this surface, on any stack | one web plugin: today's `pro-design`, `pro-motion`, `pro-testing` and the Drizzle and Prisma skills |
| stack | anyone on this framework or language | `pro-nextjs` (gaining NextAuth and the Vercel deploy bridge), `pro-astro`, later rust and python |

Two kinds of plugin sit beside the layers:

- A method is a switchable way of working inside a domain: `pro-ai-sdlc`, `pro-pdd`, `pro-spdd`, `pro-speckit` and `pro-egm` under `pro-dev`.
  A method holds only its method; a tool any method could use (today `adhd`, `lavish` and `interview-me` in `pro-pdd`) moves up to the domain.
- A gate is a plugin kept separate only because its hooks need their own switch: `pro-security` and `pro-legal`.

The plugins this leaves, and what each exists to do:

| Plugin | Goal |
|---|---|
| `pro-core` | How a person works with AI in any domain: find the right skill, keep memory across sessions, research a question, dispatch work in parallel safely and install or update the rest of the stack. Nothing in it assumes a codebase. |
| `pro-dev` | How a software engineer works with AI: build test-first, debug systematically, isolate work in worktrees, hand work to subagents, review and verify before claiming done, document what shipped and gate a PR by its risk. Stack-neutral and method-neutral. |
| `pro-dev-web` | What every web project needs regardless of framework: design and motion craft, interface review, a test pyramid (unit, interaction, browser) and the data layer (ORMs, schemas). Assumes JS/TS and React until a non-JS web stack arrives. |
| `pro-dev-nextjs`, `pro-dev-astro`, later rust and python | The conventions, upgrade paths, auth and deploy bridges of one framework or language, written from its docs. Installed only in repos on that stack. |
| `pro-dev-ai-sdlc`, `pro-dev-pdd`, `pro-dev-spdd`, `pro-dev-speckit`, `pro-dev-egm` | One way of taking a change from idea to merged, each with its own stages, templates and records. Only one is usually on; switching is how a method is trialled. |
| `pro-dev-security`, `pro-dev-legal` | A review a plan or diff must pass before it ships, enforced by hooks that need their own on-off switch: security audit, threat model and push gate; counsel on licensing, privacy, AI use and client IP with a release gate. |
| `pro-gtm` (future) | How a go-to-market engineer works with AI: research leads and accounts, plan and produce content and campaigns, measure them. The first domain beside `pro-dev`; `lead-research` is its seed. |
| `pro-dev-starter` | The meta-plugin that installs core, the dev domain, the web layer and the default method in one step. It owns nothing of its own. |

Placement of a new skill: the narrowest layer whose every user would want it.
A new plugin is only ever a domain, a method, a layer under a domain, a stack or a gate.
When no realistic user installs one plugin and wants none of another at the same layer, the two merge.
The web layer assumes JS/TS and React today; its description says so, and it splits only when a non-JS web stack arrives.

## Consequences

Consolidation moves install ids, and an install id is a plugin's name, so every move is a migration for every install and a shim or a `/pro-dev update` step.
It therefore lands in one release together with the parked [rename intent](../../intent/2026-10-28-rename-pro-dev/intent.md), whose naming becomes `pro-core`, `pro-dev-*` and `pro-gtm-*`, a domain prefix per plugin.
The rows in the engine registry move with their skills, which is a `pro-core` bump under ADR-0006.

The review stack ([#83](https://github.com/jodybrewster/pro-dev-skillset/pull/83), [#84](https://github.com/jodybrewster/pro-dev-skillset/pull/84), [#85](https://github.com/jodybrewster/pro-dev-skillset/pull/85)) is planned against today's names; it places the PR gate and risk tiers in the dev domain, not in `pro-ship`, and the fold of `pro-quality` waits until `pr-gate` has replaced `pr-quality-gate.py`.
`pro-ship` and `pro-data` go away.
`using-pro-dev`, the router, maps a task to an SDLC phase and so belongs to the dev domain or becomes domain-aware before a second domain exists.
`/kaizen` runs across projects from a planning repo and does not pass the core test cleanly; it is noted, not moved.

A bigger `pro-dev` is bumped by most PRs under the version-bump law, so stacked PRs become the norm there.
Every hook that moves keeps its own `mode.<name>` file so one gate can be turned off without the rest.

Reverse it if routing accuracy does not improve after consolidation or if a layer keeps needing exceptions to the audience test; the fallback is the flat single plugin agent-skills uses, which works only once the stack-specific skills leave the marketplace.

## Enforced by

- Nothing yet. When the rename lands, [`tests/check.mjs`](../../tests/check.mjs) fails on a plugin whose name carries no domain prefix, shims excepted, and this ADR moves to accepted.
