---
name: vercel-deploy-bridge
description: Deploy the current project to Vercel with checks before anything leaves the machine - the token comes only from the environment, no .env file is uploaded or committed, preview by default and every stage, commit, push, link, global install, anonymous --temporary deploy and production deploy waits for a yes. Use when the person says "deploy this to Vercel", "push this live" or "give me a preview URL". This is a BRIDGE (not vendored); the upstream skill installs via /pro-dev install.
---

# vercel-deploy-bridge

This is a bridge to the Vercel deploy skill in [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (MIT per its README).
The bridge owns the deploy steps.
Where the upstream skill differs, these rules win.

## Token rule

`VERCEL_TOKEN` comes only from the environment or a secret store the person names.
Never read it out of `.env`, write it to a file, pass it as `--token`, echo it, log it or paste it into chat.
The one allowed check is `[ -n "$VERCEL_TOKEN" ] && echo set || echo unset`.
Every other way of reading the variable is forbidden.
One token is scoped to one Vercel team.
`VERCEL_ORG_ID` with `VERCEL_PROJECT_ID`, or `vercel link`, fixes the scope before any command runs.
Ask before `vercel link`.

## Deploy rule

Run these checks from the deploy root before any upload or push.
Stop at the first one that fails.

1. `git rev-parse --is-inside-work-tree` must succeed.
   Stop when it fails or when any git check below exits non-zero, so nothing fails open outside a repo.
2. Find every env file with `find <root> -name node_modules -prune -o -name '.env*' -type f -print`.
3. `git ls-files -- '.env*' '*/.env*'` must list nothing beyond `.env.example`-style templates.
4. `git check-ignore -q <file>` must pass for each `.env*` file found that `git ls-files` did not list; a tracked template from check 3 is not checked here.
5. A `.vercelignore` must exist with a literal `.env*` line and no `!` line that re-includes a `.env` file.
   The Vercel CLI reads only `.vercelignore` and its built-in list.
   That list skips `.env.local` and `.env.*.local` but uploads `.env` and `.env.production`.

Then deploy:

- Preview by default.
- Production (`--prod` or a push to the production branch) only when the person says production in this run.
- Never run `vercel env pull`.
- On a git push path stage only the files the person names, show them and ask before the commit and again before the push.
- Ask before `npm install -g vercel`, before `vercel link` and before `vercel deploy --temporary`, which publishes the folder at a public URL anyone can open until it expires.
- With no person present to answer, stop at the first ask.
  An earlier "deploy it" is not the yes for `--temporary`, `vercel link` or production.

## What this replaces in the upstream skill

The upstream skill runs `git add .` and then commits and pushes.
It falls back to `--temporary` without asking.
It runs `vercel link` and `npm install -g vercel` without asking.
The steps above replace all four.
Do not run any of them on the upstream skill's say-so.

## Reading the result

For `vercel inspect` and the URL report, follow the installed `deploy-to-vercel` skill.
Report the preview URL and say which deploy type it was.

## Install

Run `/pro-dev install` and answer yes on the `vercel-deploy` row.
For Codex run `npx -y skills add https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills -a codex -g -y -s deploy-to-vercel`, at user scope so the skill never sits in the repo.
Do not commit `.claude/skills/deploy-to-vercel/`.
A committed copy loads for anyone who opens the repo, with or without pro-ship.
`/pro-dev` keeps the folder out of commits through `.git/info/exclude`; this line is the second layer.

## Alternative

When the `vercel` plugin row is installed, it can deploy through its own tools instead.

---

_Bridge to the Vercel deploy skill in [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (MIT per its README; no license file, no published copyright). No upstream content is vendored here; this file is an original pointer and deploy rule set. Install and license terms are governed by the upstream repo._
