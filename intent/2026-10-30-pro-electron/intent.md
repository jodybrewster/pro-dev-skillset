---
source: research
kind: change
status: done
risk: medium
created: 2026-10-30T12:00:00-0400
author: Jody Brewster
---

# Intent: pro-electron, a stack plugin for Electron apps

Author: Jody Brewster (pro-dev-skillset).
Source: research, "Electron Skills for AI Coding Agents: A Ranked Survey (October 2026)", brought by Jody on 2026-10-30.
Status: done; shipped in #105.
Created: 2026-10-30.

## Problem

The marketplace has stack plugins for Next.js and Astro and nothing for Electron.
The survey found Electron skills elsewhere but none both popular and comprehensive.
The most-installed (partme-ai `electron`) mirrors the API docs and has no testing.
The most complete (jwynia `electron-best-practices`) has a few hundred installs.
Most hard-code Electron 27 to 33 while stable is in the 44 line.
No skill anywhere covers an app-level Electron major upgrade, Electron Fuses or ASAR integrity.

## Proposed outcome

A new opt-in stack plugin, `pro-electron`, shaped like `pro-astro` and `pro-nextjs`, built in the order of the survey's TL;DR.

First, bridges to what already exists (registry rows, no copied upstream text):

- `electron-skills-bridge`, routing to jwynia `electron-best-practices` as the base: process model, typed IPC, security and CSP, Forge packaging, signing, auto-updates and Playwright E2E.
  Default row.
- laststance `electron-release` for macOS notarization and GitHub releases, through the same bridge.
  Default row.
- An Electron MCP server so the agent can see the running app.
  Recommended: Playwright MCP over CDP (`@playwright/mcp --cdp-endpoint http://localhost:9222`), since it adds no new dependency; `electron-mcp-server` (halilural, MIT) as the optional alternative.

Then the original skills that fill the gaps, written from the Electron docs:

- `electron-upgrade`: one major at a time, driven by Electron's breaking-changes doc, with native-module rebuilds and N-API checks, modeled on `astro-upgrade` and `next-upgrade`.
  The clearest unmet need, given the 8-week major cadence and support for only the latest three majors.
- `electron-security-audit`: a static check of `webPreferences`, `setWindowOpenHandler` and `will-navigate`, `shell.openExternal` validation, CSP and Fuses/ASAR integrity, reporting a checklist.

Later, only if the first two prove useful: `electron-testing` (Playwright `_electron` fixtures, dialog stubs, xvfb CI), `electron-perf` and a Windows-signing section for `electron-release`.

## Affected users and systems

A new `plugins/pro-electron/` with both manifests, its marketplace entry and `metadata.version`, rows in `plugins/pro-core/registry/engines.json` (a pro-core bump), routing cases in `tests/cases/routing.jsonl`, plugin eval cases, behavioral cases and fixtures under `evals/`, `tests/bridge-install-smoke.mjs`, the `component-coverage` check, `docs/licenses.md`, the README plugin list and `docs/roadmap.md`.
Nothing changes for repos that do not install it; `pro-dev-starter` does not pull it in.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
jwynia/agent-skills has no license file, so it may only be bridged, never copied.
laststance/skills and electron-mcp-server are MIT.
The original skills must not pin an Electron version in examples; they read the installed version first and say which docs they were written against.
Registry rows, not plugin dependencies, carry the companions, as for every other bridge.

## Out of scope

Copying or forking any upstream skill.
Automating third-party Electron apps (VS Code, Slack) over CDP.
A scaffold skill: jwynia's `scaffold-electron-app.ts` covers it.
Tauri.
Moving the plugin under the `pro-dev-*` names of ADR-0013 while that ADR is proposed; it follows whatever rename the other stack plugins get.

## Evals

Every skill in the plugin ships with evals in the same PR as the skill, across all four tiers of [docs/evals.md](../../docs/evals.md):

- Keyless and model routing: at least two cases per skill in `tests/cases/routing.jsonl`, plus `notOneOf` cases for the boundaries that matter: an Electron upgrade must not route to `next-upgrade` or `astro-upgrade`; an Electron security audit must not route to pro-security's generic review.
  Nothing goes into `tests/cases/uncovered.json`.
- Plugin evals: a `-fires` and a `-stays-quiet` pair for `electron-skills-bridge`, `electron-upgrade` and `electron-security-audit` under `plugins/pro-electron/evals/`, with `"experimental": {"evals": "evals"}` in the manifest.
  pro-electron joins the `component-coverage` check, so a later skill without a case fails CI.
- Behavioral: `evals/cases/electron-upgrade.json` and `evals/cases/electron-security-audit.json`, each run with `--baseline`.
  The upgrade fixture is a tiny app on an old major that uses an API removed in the next one; the agent must upgrade one major at a time, find the removed API and rebuild native modules.
  The audit fixture has planted faults (`nodeIntegration: true`, no `setWindowOpenHandler`, an unchecked `shell.openExternal`, no CSP and Fuses left at their defaults); the agent must report each one with `file:line` and no false alarms on a clean control file.
- The audit script gets its own `node --test` unit tests over the same fixtures.
- The bridge installs go into `tests/bridge-install-smoke.mjs`, so the weekly run catches jwynia or laststance moving or removing a skill.

A skill counts as shipped only when its plugin eval fires in at least 2 of 3 Sonnet runs, its stays-quiet case fires in 0 and its behavioral case beats the baseline.
The first numbers go into the "Measured changes" section of `docs/evals.md` with the model and Claude Code version pinned.

## Success looks like

In an Electron repo with pro-electron installed, `/pro-dev install` offers the jwynia and laststance skills and the MCP setup.
"set up typed IPC between main and renderer" routes to `electron-skills-bridge`, "upgrade Electron from 43 to 45" routes to `electron-upgrade` and "audit this Electron app's security" routes to `electron-security-audit`.
`node tests/check.mjs`, `node tests/eval.mjs --dry`, the lexical routing gate and every strict validation pass.
The plugin and behavioral evals meet the bar in the Evals section.

## Facts the survey got wrong or left unverified

Checked with `gh api` on 2026-10-30:

- laststance/skills has `electron-release` but no `qa-electron`; the QA skill the survey ranks third does not exist there.
  Its repo shows 1 star, not the counts the survey implies.
- jwynia/agent-skills was last pushed on 2026-02-24, so its Electron content is eight months old; the spec should check it against current Electron before making it the default.
- Electron version numbers (44.4.5 stable, 45 shipping) come from the survey and are not yet checked against releases.electronjs.org.

## Open questions

- Default row for jwynia, given no license and no push since February?
  Recommended: yes as a bridge, since bridging copies nothing, with a note that the spec checks its advice against Electron's current security checklist.
- Which MCP server is the default?
  Recommended: Playwright MCP over CDP, because it is already a common dependency and it needs only `--remote-debugging-port` in dev.
- Security: an MCP server that evaluates JS in a running app is a code-execution channel. The dev build must also open a debugging port.
  The spec needs a security challenge: localhost only, dev builds only, never shipped with the port open (a Fuse can enforce that).
- One PR for bridges and both original skills, or bridges first?
  Recommended: one PR for the bridges and `electron-upgrade`, then `electron-security-audit` in a second, since the audit script needs its own tests.
  Each PR carries the evals for the skills it adds.
