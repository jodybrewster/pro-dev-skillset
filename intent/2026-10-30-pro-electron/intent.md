---
source: research
kind: change
status: draft
risk: medium
created: 2026-10-30T12:00:00-0400
author: Jody Brewster
---

# Intent: pro-electron, a stack plugin for Electron apps

Author: Jody Brewster (pro-dev-skillset).
Source: research, "Electron Skills for AI Coding Agents: A Ranked Survey (October 2026)", brought by Jody on 2026-10-30.
Status: draft.
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

A new `plugins/pro-electron/` with both manifests, its marketplace entry and `metadata.version`, rows in `plugins/pro-core/registry/engines.json` (a pro-core bump), routing cases in `tests/cases/routing.jsonl`, `docs/licenses.md`, the README plugin list and `docs/roadmap.md`.
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

## Success looks like

In an Electron repo with pro-electron installed, `/pro-dev install` offers the jwynia and laststance skills and the MCP setup.
"set up typed IPC between main and renderer" routes to `electron-skills-bridge`, "upgrade Electron from 43 to 45" routes to `electron-upgrade` and "audit this Electron app's security" routes to `electron-security-audit`.
`node tests/check.mjs`, `node tests/eval.mjs --dry`, the lexical routing gate and every strict validation pass.

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
