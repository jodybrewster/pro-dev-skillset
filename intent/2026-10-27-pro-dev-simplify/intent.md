---
source: idea
kind: change
status: proposed
risk: medium
created: 2026-10-27T22:30:00-0400
author: Jody Brewster
---

# Intent: simplify setup to /pro-dev and make the spec methods swappable

Author: Jody Brewster (pro-dev-skillset).
Source: idea, from a research session on design and Vercel skills on 2026-10-27.
Status: proposed.
Created: 2026-10-27.

This is an umbrella intent and a running list.
It spans several changes, so each item below becomes its own intent when it is picked up, and the list records where each one stands.

## Problem

Setting up a site takes too many commands.
Engine setup is spread over `/pro-starter`, `/design-engine`, `/design-skills`, `/taste-skills`, `/next-skills`, `/lavish-engine`, `/qa-engine`, `/sdlc-init` and `/pro-dev-doctor`.
A plugin update never installs the engines that new bridges need.
Jody: "I need a simpler approach to all of this? I need a general slash command to init everything after I've installed all of the plugins I want, then an update command after I update the plugins."
The validation Stop hook blocks the end of turns where nothing in the repo changed, and Jody finds it too much.
pro-starter depends on pro-nextjs and pro-astro, though stack plugins are meant to be opt-in.

## Proposed outcome

One command in pro-core, `/pro-dev install|update|check`, driven by one engine registry, sets up and refreshes everything for the plugins a site has installed.
The setup commands it replaces are deleted.
Each spec-driven method is its own plugin, so it can be tried by installing and uninstalling it, while pro-ai-sdlc controls how the installed methods work together.
Jody: "Having four different spec driven methods means I can try them out easily by installing and uninstalling the plugins but I can control how they work together as well."

## Running list

Status per item: todo, intent (its own intent folder exists), in PR, done or dropped.
Every item below has its intent written as of 2026-10-28; A also has its spec.

The items ship as six intents, in this order:

- A. Quiet validation hook - item 6. Small and independent, so it goes first. Intent: `intent/2026-10-28-quiet-validation-hook/`.
- B. /pro-dev setup - items 1 to 5. Builds the registry the later intents add rows to. Intent: `intent/2026-10-28-pro-dev-setup/`.
- C. Swappable spec methods - item 7 apart from spec-kit: the EGM bridge plugin and pro-ai-sdlc routing between whichever methods are installed. Needs B's registry. Intent: `intent/2026-10-28-spec-methods/`.
- D. Design and Vercel bridges - items 8 to 11. Needs B's registry; can run alongside C. Intent: `intent/2026-10-28-design-vercel-bridges/`.
- E. spec-kit as its own plugin, `pro-speckit` - the spec-kit part of item 7. Intent: `intent/2026-10-28-pro-speckit/`.
- F. `/execute <plan.md>` in pro-ai-sdlc: worktree, env files, baseline, build to the plan and a pull request. Independent of B. Intent: `intent/2026-10-28-execute-command/`.

1. todo - `/pro-dev install|update|check` in pro-core with an engine registry; answers to optional engines saved in `.claude/pro-dev.json`; `check` replaces `/pro-dev-doctor`.
2. todo - delete the setup commands `/pro-dev` replaces: `/pro-starter`, `/design-engine`, `/design-skills`, `/taste-skills`, `/next-skills`, `/lavish-engine`, `/qa-engine`; fold `/sdlc-init` into `/pro-dev install`.
3. todo - rename pro-starter to pro-dev-starter, make it a pure dependency bundle with no command and drop pro-nextjs and pro-astro from its dependencies.
4. todo - shrink `templates/bootstrap.sh` to: add the marketplace, install pro-dev-starter, then run `/pro-dev install`.
5. todo - remove duplicate commands: pro-quality's `/review` (keep pro-ai-sdlc's), `/api-docs` becomes a mode of `/document`, `/lead-research` becomes `/research lead`.
6. todo - tone down the validation Stop hook: count only writes inside the repo, stop blocking and print a one-line pointer to `/validate` instead, and add an opt-out.
7. todo - spec methods as swappable plugins, with pro-ai-sdlc as the default loop and the coordinator that routes to whichever methods are installed:
   - pro-ai-sdlc (intent, spec, plan): stays the default.
   - pro-spdd: kept as an opt-in plugin.
   - Google Elephant-Goldfish Model (https://github.com/google/elephant-goldfish-model, Apache-2.0): a thin bridge plugin; `/pro-dev install` installs `egm@egm`, never as a hard dependency.
   - GitHub spec-kit (https://github.com/github/spec-kit, MIT): a thin bridge plugin; `/pro-dev install` runs `specify init`, `/pro-dev update` upgrades the CLI.
8. todo - Hallmark bridge in pro-design (https://github.com/nutlope/hallmark, MIT): optional engine, only when named or explicitly chosen; hand-off lines in `taste-skills-bridge`, `landing-page-design`, `impeccable-bridge` and `emil-design-eng`.
9. todo - web-design-guidelines (vercel-labs/agent-skills): default engine row in pro-design; rules are fetched live and unpinned.
10. todo - `vercel-skills-bridge` in pro-nextjs: react-best-practices, vercel-optimize, deploy-to-vercel, vercel-cli-with-tokens; tokens from the environment only.
11. todo - stack-neutral React bridge, likely pro-design: composition-patterns, react-view-transitions.
12. dropped - writing-guidelines (Vercel docs house style clashes with Jody's writing rules) and react-native-skills (no mobile work).

## Affected users and systems

Every site that installs from this marketplace.
pro-core, pro-starter, pro-ai-sdlc, pro-design, pro-nextjs, pro-quality, pro-research, pro-pdd, pro-testing, pro-spdd, two new bridge plugins, `templates/bootstrap.sh`, docs and routing cases.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
No hard dependency on a plugin from another marketplace (PR 44).
Bridges over vendoring: no upstream text is copied in.
vercel-labs/agent-skills has no license file, so only bridges are allowed for it.
`/pro-dev` never installs anything from a third party without being run by the person.

## Out of scope

Running engine installs automatically on plugin update or session start.

## Success looks like

On a fresh site: install pro-dev-starter and any stack plugins, run `/pro-dev install`, and every installed bridge has its engine.
After `claude plugin update`, `/pro-dev update` brings every engine current and installs any new ones.
Installing or uninstalling a spec-method plugin changes what pro-ai-sdlc routes to with no other edits.
A session that only talks or edits files outside the repo ends without a Stop hook block.

## Open questions

- Renaming pro-starter makes existing sites uninstall it and install pro-dev-starter by hand; is a one-release shim worth it?
- Where exactly pro-ai-sdlc hands off to EGM, spec-kit and pro-spdd, for example `/spec` offering `/egm:egm-review` when EGM is installed.
