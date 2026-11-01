---
intent: intent/2026-10-30-pro-electron/intent.md
intent-status: draft
status: draft
created: 2026-10-30T15:00:00-0400
author: the maintainer
---

# Spec: pro-electron, a stack plugin for Electron apps

Built from `intent.md` in this folder (commit 7102701).
Status: draft.
Policies and skills consulted: `CLAUDE.md` (the three laws and the layering rule), `REVIEW.md`, `docs/evals.md`, `docs/licenses.md`, `docs/codex-parity.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0006 (engine registry), ADR-0009 (three eval tiers), ADR-0013 (layering, proposed), `plugins/pro-core/registry/engines.json`, `plugins/pro-astro/` and `plugins/pro-nextjs/` as the reference stack plugins, `tests/bridge-install-smoke.mjs`.

## Summary

A new opt-in stack plugin, `pro-electron`, with three skills.
`electron-skills-bridge` routes to two upstream skills installed through `/pro-dev install` (jwynia `electron-best-practices` and laststance `electron-release`) and tells the agent how to attach an MCP server to the running app.
`electron-upgrade` moves an app one Electron major at a time.
`electron-security-audit` runs a bundled Node script that statically checks an Electron app's main-process code and packaging config and reports findings with `file:line`.
Every skill ships with routing, plugin and behavioral evals.
Repos that do not install the plugin see no change.

## Assumptions

Unconfirmed: going ahead was approved on 2026-10-30 with the intent's recommendations, so these are written down rather than asked.

1. Target apps are TypeScript or JavaScript Electron apps built with electron-vite, Electron Forge or electron-builder.
2. Electron 45.2.0 is the stable release, 45.0.0 shipped on 2026-10-21 and 46 is in alpha (`npm view electron dist-tags`, 2026-10-30), so 43, 44 and 45 are the supported majors.
   The survey's "44.4.5 stable" was out of date.
3. The audit script runs on Node 20 or later with no npm dependencies, so it works in any repo without an install step.
4. Users run macOS, Windows or Linux; the audit and upgrade skills are platform-neutral; signing advice stays with the bridged `electron-release`.
5. The upstream skills stay where they are: jwynia at `skills/tech/development/tooling/electron-best-practices` (commit `e02ec7e`, 2026-02-24) and laststance at `skills/electron-release` (commit `746d4db`, 2026-10-18).

## Requirements

### Functional

- R1. `plugins/pro-electron/` exists with `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` at version 0.1.0, a marketplace entry in `.claude-plugin/marketplace.json` with the same version and `metadata.version` bumped.
- R2. The plugin is opt-in: it is not a dependency of `pro-dev-starter` and `tests/check.mjs` lists it in the opt-in and router-skip sets beside `pro-astro`.
- R3. `skills/electron-skills-bridge/SKILL.md` routes architecture, typed IPC, preload and contextBridge, CSP, packaging, auto-update and Playwright E2E asks to `electron-best-practices` and notarization and GitHub release asks to `electron-release`, with an install-name catalog table and the "check installed, else `/pro-dev install`" steps used by `next-skills-bridge`.
- R4. The bridge documents the MCP setup as a manual step: `claude mcp add` for `@playwright/mcp` with `--cdp-endpoint http://localhost:9222` as the default and `electron-mcp-server` as the alternative, both only against a dev build started with `--remote-debugging-port=9222`.
- R5. `plugins/pro-core/registry/engines.json` has two `skills-cli` rows owned by `pro-electron`: `electron-best-practices` (default true) and `electron-release` (default true), each installing from a source pinned to the commit in assumption 5, with `detect`, `why`, `upstream` and `note` fields like the `vercel-skills` row; pro-core is bumped.
- R6. `pro-electron` ships `commands/install.md` and `scripts/pro-dev-owner.py`, byte-identical to pro-nextjs's script, like every other plugin that owns registry rows.
- R7. `skills/electron-upgrade/SKILL.md` reads the installed Electron version first, upgrades one major at a time, reads Electron's breaking-changes doc for each hop, rebuilds native modules (`@electron/rebuild` or the packager's own rebuild), checks Node ABI and N-API needs, runs the app's build and tests after each hop and commits each verified hop.
  It names no Electron version as current; it says which docs it was written against and tells the agent to check `npm view electron dist-tags`.
- R8. `skills/electron-security-audit/SKILL.md` runs `scripts/audit.mjs <path>` and turns its JSON output into a checklist report.
- R9. `scripts/audit.mjs` reports each of these with rule id, file and line: `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`, `webSecurity: false`, `allowRunningInsecureContent: true`, `enableRemoteModule`, a `BrowserWindow` with no `setWindowOpenHandler` in the codebase, no `will-navigate` handler, `shell.openExternal` called on a value with no URL check in the same function, no `Content-Security-Policy` in HTML or `session` headers and no `@electron/fuses` (`flipFuses` or `FusesPlugin`) in the packaging config.
  It exits 0 when clean and 1 with findings; it prints JSON with `--json`.
- R10. The audit script has `node --test` unit tests over a planted-fault fixture and a clean fixture: every planted fault is found and the clean fixture yields zero findings.
- R11. Routing: at least two cases per skill in `tests/cases/routing.jsonl`, plus `notOneOf` cases keeping an Electron upgrade off `next-upgrade` and `astro-upgrade` and an Electron security audit off pro-security's generic skills; nothing added to `tests/cases/uncovered.json`.
- R12. Plugin evals: `plugins/pro-electron/evals/` holds a `-fires` and a `-stays-quiet` case for each of the three skills, tagged per `docs/evals.md`; the manifest sets `"experimental": {"evals": "evals"}`.
- R13. pro-electron joins the `component-coverage` check's plugin list, so a later skill with no eval case fails CI.
- R14. Behavioral: `evals/cases/electron-upgrade.json` and `evals/cases/electron-security-audit.json` with fixtures under `evals/fixtures/`, each runnable by `node tests/behavioral.mjs --dry-run`.
- R15. `tests/bridge-install-smoke.mjs` gains a target per new registry row, so the weekly run catches an upstream rename or removal.
- R16. `docs/licenses.md` gains rows: jwynia bridged (no LICENSE file in the repo; its SKILL.md frontmatter says MIT), laststance bridged (MIT) and the two original skills.
- R17. The README plugin list, the codex install list and `docs/roadmap.md` name pro-electron.

### Non-functional

- N1. `node tests/check.mjs`, `node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70`, `node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- N2. Keyless routing rank-1 does not drop below the main baseline at build time.
- N3. The audit script runs in under 5 seconds on a 500-file repo and never executes or imports the code it reads.

### Policy constraints applied

- Version-bump law: pro-electron starts at 0.1.0, pro-core bumps for the registry rows and `metadata.version` bumps, all in the build commit.
- Hook-loading law: the plugin registers no hooks, so it has no `hooks/hooks.json`.
- Codex parity: `.codex-plugin/plugin.json` with `"skills": "./skills/"`, harness-neutral skill prose and no agents, so no `.toml` files.
- No plugin dependency on another marketplace; companions are registry rows (`CLAUDE.md`, PR 44).
- A bridge row needs a pro-core bump (ADR-0006).
- Bridged content is never copied (`docs/licenses.md`).
- No home-directory paths in commands or docs (`CLAUDE.md`).

### Boundaries

Always: read the installed Electron version before advising; run the audit script read-only.
Ask first: running an upstream skill's own scripts (jwynia's Deno scripts) or opening a debugging port.
Never: ship a build with `--remote-debugging-port` or the `EnableNodeCliInspectArguments` fuse left on; copy upstream skill text into this repo.

## Design

### User experience

A person in an Electron repo installs `pro-electron@pro-dev-skillset` and runs `/pro-dev install`, which asks about the two upstream skills.
Asks about IPC, packaging or releases route to the bridge, which loads the upstream skill or names the install line.
"Upgrade Electron" routes to `electron-upgrade`, which announces itself, shows the current and target majors and walks one hop at a time.
"Audit this Electron app's security" routes to `electron-security-audit`, which runs the script and prints a checklist grouped by severity with each finding's file, line, why it matters and the fix.

### System

New: `plugins/pro-electron/` (both manifests, three skills, the audit script and its tests, `commands/install.md`, `scripts/pro-dev-owner.py`, `evals/`).
Modified: `.claude-plugin/marketplace.json`, `plugins/pro-core/registry/engines.json` and pro-core's manifests, `tests/check.mjs`, `tests/cases/routing.jsonl`, `tests/bridge-install-smoke.mjs`, `docs/licenses.md`, `README.md`, `docs/roadmap.md`, `evals/cases/` and `evals/fixtures/`.
The audit script uses line-oriented regex and small brace matching over `.js`, `.ts`, `.mjs`, `.cjs`, `.html` and packaging configs, skipping `node_modules`, `dist`, `out` and `.vite`.
It is a heuristic checker; the skill says so.

### Alternatives considered

- Bundle an `.mcp.json` in the plugin: lost, because an always-on MCP server pointed at a debugging port would load in every session, even with no app running. It also nudges people toward leaving the port open.
- A new `mcp` registry kind so `/pro-dev install` adds the server: lost for now; it is a pro-core change with its own review and the manual line is one command.
- Parse with the TypeScript compiler API: lost, because it adds a dependency the target repo may not have; regex covers the listed rules.
- Two PRs (bridges plus upgrade, then audit): merged into one, since the plugin is new and the version bumps would collide.

## Flagged concerns

ADR needed: no, a stack plugin following ADR-0006 and ADR-0013 sets no new rule.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | jwynia/agent-skills has no LICENSE file; only its SKILL.md frontmatter says MIT. | `docs/licenses.md` | resolved: bridged only, pinned to `e02ec7e`, the licenses row records the gap. |
| 2 | jwynia's skill ships Deno scripts that an agent may run; that is third-party code execution. | REVIEW.md, pro-security | resolved: the bridge says to ask first before running them and the row pins the commit so updates are reviewed. |
| 3 | An MCP server that evaluates JS in the app plus an open debugging port is a code-execution channel. | pro-security | resolved: manual setup only, localhost, dev builds only; the audit flags `EnableNodeCliInspectArguments` and missing fuses. |
| 4 | The intent's success line said `/pro-dev install` would offer the MCP setup. | intent | resolved: departure recorded; manual step instead (Alternatives). |
| 5 | The intent recommended two PRs. | intent | resolved: one PR (Alternatives). |
| 6 | The survey's `qa-electron` skill does not exist. | intent | resolved: dropped from scope. |

## Open questions

- Default row for jwynia: answered yes, bridged and pinned (the recommendations were approved on 2026-10-30).
- Default MCP server: answered, Playwright MCP over CDP, set up by hand.
- MCP security challenge: answered by concern 3.
- PR split: answered, one PR.

## Acceptance criteria

- AC1. All N1 commands pass on the build branch.
- AC2. `node --test plugins/pro-electron/skills/electron-security-audit/scripts/*.test.mjs` passes: every planted fault found, the clean fixture has zero findings.
- AC3. `node tests/route-lexical.mjs` ranks the expected skill first for each new pro-electron case, or the miss is listed with its reason in the PR.
- AC4. `node tests/behavioral.mjs --dry-run` lists both new cases with no validation errors.
- AC5. `node tests/check.mjs component-coverage` passes with pro-electron in the list and nothing added to `components-uncovered.json`.
- AC6. Live evals (plugin and behavioral, Sonnet) are run on demand after merge; each skill's fires case fires in at least 2 of 3 runs, its stays-quiet case in 0. The numbers go into `docs/evals.md`.

## Out of scope

`electron-testing`, `electron-perf` and Windows signing.
A scaffold skill.
Automating third-party Electron apps.
An `mcp` registry kind.
Renaming to `pro-dev-electron` under ADR-0013.
