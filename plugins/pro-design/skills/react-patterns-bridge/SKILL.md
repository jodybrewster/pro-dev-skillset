---
name: react-patterns-bridge
description: Bridge to Vercel's React composition and view-transition agent skills in vercel-labs/agent-skills - refactor components away from boolean-prop sprawl, design compound components and render props, scale a component API or add React View Transitions or shared-element animation. Use when the task is one of those in any React app. This is a BRIDGE (not vendored); the skills install via the /pro-dev command. For shadcn/ui components use shadcn-ui-composition.
---

# react-patterns-bridge

This is a bridge, not a vendored skill.
The engine is two agent skills that Vercel publishes in [vercel-labs/agent-skills `skills/`](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills).
They are installed with the [`npx skills add`](https://github.com/vercel-labs/skills) CLI from one pinned commit and are not copied into this marketplace.
The guidance here is for any React app and names no framework.

## When to route here

Route to an upstream skill (install name in `code`) when the ask is:

- Refactor a component with many boolean props, design compound components, lift state into a provider, or pick between render props and composition -> `vercel-composition-patterns`.
- Shape a component API that has to scale across callers or teams -> `vercel-composition-patterns`.
- Add page or element transitions with React's View Transitions, including shared-element animation -> `vercel-react-view-transitions`.

Stay in pro-design's own skills for shadcn/ui components (`shadcn-ui-composition`), a rule-level lint of UI code (`web-design-guidelines`) and how a rendered screen looks (`screen-critique`).

## Skill catalog (install names)

| Install name | Use it for | Needs |
| --- | --- | --- |
| `vercel-composition-patterns` | Component composition and API design | A React codebase |
| `vercel-react-view-transitions` | View Transitions and shared-element animation | A React version that ships View Transitions |

The upstream folder `composition-patterns` installs as `vercel-composition-patterns`, because the installer names a skill by the `name:` in its frontmatter.

## How to use the bridge

1. Check whether the skill is installed.
   Upstream skills land in `.claude/skills/<install-name>/` (project scope) or `~/.claude/skills/<install-name>/` (user scope).
   - If present: follow that skill's `SKILL.md`.
   - If absent: tell the user this is a bridge and the skill is not installed, then run `/pro-dev install`.

     The underlying command is `npx -y skills add https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills -a claude-code -y -s vercel-composition-patterns vercel-react-view-transitions`, with `-a codex` in place of `-a claude-code` for Codex.
     Keep `-s` and the install names last.
2. Defer to the upstream skill for the work.
   Do not reimplement its steps here; the point of the bridge is that the skills keep their own guidance.

## Keeping the skills installed and current

Use the `/pro-dev` command (in pro-core):

- `/pro-dev check` - report which install names are present and where.
- `/pro-dev install` - install both.
- `/pro-dev update` - re-run the install from the pinned source.

The source is pinned to one commit.
Moving the pin is a reviewed change that rereads the upstream `SKILL.md` files.

---

_Bridge to the Vercel agent skills in [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills). No upstream content is vendored here; this file is an original pointer and router. Install and license terms are governed by the upstream repo._
