---
name: vercel-skills-bridge
description: Bridge to Vercel's React performance and cost agent skills in vercel-labs/agent-skills - apply React and Next.js performance rules (waterfalls, bundle size, re-renders, server-side work) and tune Vercel usage and cost from vercel metrics, usage and contract output. Use when the task is React performance work or a Vercel bill or usage review. This is a BRIDGE (not vendored); the skills install via the /pro-dev command. For deploying use vercel-deploy-bridge; for Next.js client bundle work alone use next-skills-bridge.
---

# vercel-skills-bridge

This is a bridge, not a vendored skill.
The engine is two agent skills that Vercel publishes in [vercel-labs/agent-skills `skills/`](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills).
They are installed with the [`npx skills add`](https://github.com/vercel-labs/skills) CLI from one pinned commit and are deliberately not copied into this marketplace.

## Token rule

This rule overrides the upstream skills' own steps wherever they differ.

- `VERCEL_TOKEN` comes only from the environment or from a secret store the person names.
- Never read it out of a `.env` file into the transcript, never write it to a file, never pass it as `--token`, never echo or log it and never paste it into chat.
- The only check this bridge runs is `[ -n "$VERCEL_TOKEN" ] && echo set || echo unset`.
  Every other way of reading the variable is forbidden.
- One token is scoped to one Vercel team.
  Set `VERCEL_ORG_ID` with `VERCEL_PROJECT_ID`, or run `vercel link`, to fix the scope before any command runs.
- Ask before `vercel link` and before the `vercel link --yes` that `vercel-optimize` suggests.
  Linking creates or attaches a Vercel project.

## When to route here

Route to an upstream skill (install name in `code`) when the ask is:

- Apply React or Next.js performance rules to code: request waterfalls, bundle size, re-renders, server-side work -> `vercel-react-best-practices`.
- Review Vercel usage and spend, find what drives the bill and tune it, working from `vercel metrics`, `vercel usage` and `vercel contract` output -> `vercel-optimize`.

Send other asks elsewhere:

- Client bundle and initial-load JavaScript in a Next.js app, with nothing else -> `next-bundle-optimizer` through `next-skills-bridge`.
- Deploy this to Vercel -> `vercel-deploy-bridge` when pro-ship is installed.
  Otherwise use the `vercel` plugin row in the `/pro-dev` registry.
  This bridge runs no deploy itself.

## Skill catalog (install names)

| Install name | Use it for | Needs |
| --- | --- | --- |
| `vercel-react-best-practices` | React and Next.js performance rules applied to code | A React or Next.js codebase |
| `vercel-optimize` | Vercel usage and cost tuning | An authenticated Vercel CLI and a linked project |

The upstream `vercel-cli-with-tokens` skill is not installed on purpose.
It reads `.env` on its own trigger, where the token rule above cannot reach it.
Token-based CLI work stays in this bridge under the token rule.

## How to use the bridge

1. Check whether the skill is installed.
   Upstream skills land in `.claude/skills/<install-name>/` (project scope) or `~/.claude/skills/<install-name>/` (user scope).
   - If present: follow that skill's `SKILL.md`, with the token rule above taking precedence.
   - If absent: tell the user this is a bridge and the skill is not installed, then run `/pro-dev install`.

     The underlying command is `npx -y skills add https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills -a claude-code -y -s vercel-react-best-practices vercel-optimize`, with `-a codex` in place of `-a claude-code` for Codex.
     Keep `-s` and the install names last.
2. Defer to the upstream skill for the performance and cost work.
   Do not reimplement its steps here.

## Keeping the skills installed and current

Use the `/pro-dev` command (in pro-core):

- `/pro-dev check` - report which install names are present and where.
- `/pro-dev install` - install both.
- `/pro-dev update` - re-run the install from the pinned source.

The source is pinned to one commit.
Moving the pin is a reviewed change that rereads the upstream `SKILL.md` files.

---

_Bridge to the Vercel agent skills in [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills). No upstream content is vendored here; this file is an original pointer and router. Install and license terms are governed by the upstream repo._
