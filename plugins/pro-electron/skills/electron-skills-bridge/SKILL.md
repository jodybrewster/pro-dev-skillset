---
name: electron-skills-bridge
description: Bridge to community Electron agent skills (jwynia/agent-skills electron-best-practices, laststance/skills electron-release) - typed IPC between main and renderer, preload and contextBridge, multi-window state, project structure, Electron Forge packaging, code signing, macOS notarization, auto-updates, GitHub release of an Electron app, Playwright E2E for Electron or seeing a running app through a manual MCP setup. Use when the task is one of those in an Electron app. This is a BRIDGE (not vendored); the skills install via the /pro-dev command. For an Electron major version upgrade use electron-upgrade; for a security audit use electron-security-audit.
---

# electron-skills-bridge

This is a bridge, not a vendored skill.
The engines are two community agent skills for Electron, each pinned to a commit and installed with the [`npx skills add`](https://github.com/vercel-labs/skills) CLI.
They are deliberately not copied into this marketplace.

## When to route here

Route to an upstream skill (install name in `code`) when the ask is:

- Typed IPC between main and renderer, preload scripts and `contextBridge`, electron-trpc or error serialization across the IPC boundary -> `electron-best-practices`.
- Process separation, project structure, multi-window state or React patterns in an Electron renderer -> `electron-best-practices`.
- Context isolation, CSP, permission handlers or a security checklist for how the app is built -> `electron-best-practices`. For a scan of an existing codebase use `electron-security-audit`.
- Electron Forge packaging, bundle optimization, CI/CD for builds or auto-update setup -> `electron-best-practices`.
- Playwright E2E tests or test structure for an Electron app -> `electron-best-practices`.
- macOS code signing and notarization, electron-builder config, publishing to GitHub Releases or the `latest-mac.yml` auto-update feed -> `electron-release`.

Stay in pro-electron's own skills for an Electron major version upgrade (`electron-upgrade`) and a security audit of existing code (`electron-security-audit`).

## Skill catalog (install names)

| Install name | Source | Use it for | Pinned commit |
| --- | --- | --- | --- |
| `electron-best-practices` | [jwynia/agent-skills](https://github.com/jwynia/agent-skills/tree/e02ec7e226a6e4f8419fd3b88a1d8e472d421b32/skills/tech/development/tooling/electron-best-practices) (MIT per its SKILL.md, no LICENSE file) | Architecture, typed IPC, security setup, Forge packaging, signing, auto-updates, CI/CD, Playwright E2E, React patterns | `e02ec7e226a6e4f8419fd3b88a1d8e472d421b32` (last pushed 2026-02-24) |
| `electron-release` | [laststance/skills](https://github.com/laststance/skills/tree/746d4db0d9cbd767f19b96a432a15c0e42beaa29/skills/electron-release) (MIT) | macOS signing and notarization, electron-builder, GitHub Releases, `latest-mac.yml` feed | `746d4db0d9cbd767f19b96a432a15c0e42beaa29` |

The upstream content is pinned and may lag current Electron.
Check `npm view electron dist-tags` for the current majors and prefer the official docs at electronjs.org where they disagree with an upstream skill.

`electron-best-practices` includes Deno analysis scripts.
Ask the person before running any of them.
They are third-party code and nothing in this bridge authorizes running them.

## How to use the bridge

1. Check whether the skill is installed.
   Upstream skills land in `.claude/skills/<install-name>/SKILL.md` (project scope) or the same path under the user's skills folder (user scope).
   - If present: load that `SKILL.md` and follow it.
   - If absent: tell the person this is a bridge and the skill is not installed, tell them to run `/pro-dev install` (or `/pro-electron:install`), then stop.
     Never install it yourself.
2. Defer to the upstream skill for the work.
   Do not reimplement its steps here.
3. Where the upstream skill and the official Electron docs disagree, the docs win.

## Seeing the running app

An agent can drive and screenshot a running Electron app through the Chrome DevTools Protocol.
This is a manual setup because an always-on MCP server pointed at a debugging port would load in every session.

Default: Playwright MCP over CDP.

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest --cdp-endpoint http://localhost:9222
```

Alternative: [`electron-mcp-server`](https://github.com/halilural/electron-mcp-server) (halilural, MIT), run with `npx -y electron-mcp-server`.

Rules for either server:

- Start only a dev build with `--remote-debugging-port=9222`.
- Keep the port on localhost.
- Never ship a build with the port open.
- Keep the `EnableNodeCliInspectArguments` fuse off in release builds. `electron-security-audit` flags it.
- Evaluating JavaScript in the app is code execution inside the app's process. Ask the person before doing it.

## Keeping the skills installed and current

Use the `/pro-dev` command (in pro-core):

- `/pro-dev check` - report which install names are present and where.
- `/pro-dev install` - install both.
- `/pro-dev update` - re-run the install. Updates move the pinned commit only when pro-electron does, so a new upstream revision is reviewed first.

---

_Bridge to [jwynia/agent-skills](https://github.com/jwynia/agent-skills) and [laststance/skills](https://github.com/laststance/skills). No upstream content is vendored here; this file is an original pointer and router. Install and license terms are governed by the upstream repos._
