# Plan: pro-nextjs bridges the MIT Next.js skills

Read [intent.md](./intent.md) first.
The intent states the checks, so this change has no `spec.md` ([intent/README.md](../README.md)).
An Opus session runs this plan in the worktree `pro-dev-skillset.next-bridge` on branch `next-bridge` and stops at an open PR.

## Steps

1. Commit this intent and plan before any change under `plugins/`.
2. Add `plugins/pro-nextjs/skills/next-skills-bridge/SKILL.md`, modelled on `qa-suite` and `taste-skills-bridge`: what the six upstream skills cover, when to route to each, how to check whether they are installed and the command to run when they are not.
3. Add `plugins/pro-nextjs/commands/next-skills.md` with `check` (default, changes nothing, diffs the catalog against the live upstream tree), `install [skill]` and `update [skill]`, modelled on `/qa-engine` and `/design-skills`.
   The install command is `npx -y skills add https://github.com/vercel/next.js/tree/canary/skills -a claude-code -y`, with `-s <name>` last for one skill.
4. Remove `plugins/pro-nextjs/skills/next-cache-components/`.
5. Rewrite `next-best-practices` and `next-upgrade` from the Next.js docs in vercel/next.js (MIT): every section cites its nextjs.org doc page, and no line matches the vercel-labs/next-skills text at `dc1de9c` verbatim except code tokens any Next.js text must contain.
   Check with a line-overlap script against the source files and record the result in the PR.
6. Rewrite the pro-nextjs `LICENSE` so it names the Next.js docs (MIT, Copyright (c) 2025 Vercel, Inc.) as the source of the two rewritten skills, the bridge as original, `shadcn` as before, and no longer claims vercel-labs/next-skills.
7. Update `docs/licenses.md` (two rows written from the docs, one bridged row for `next-skills-bridge`, the open paragraph closed), `README.md`, both pro-nextjs manifests and the marketplace description.
8. Register the bridge in `tests/check.mjs` (`bridges` list and `COMMANDS`), the router in `using-pro-dev` (a BUILD line and a Bridges entry), a routing case in `tests/cases/routing.jsonl`, and a target in `tests/bridge-install-smoke.mjs` with the workflow's name and comments covering every bridge.
9. Bump in one commit: pro-nextjs 0.8.2 to 0.9.0 (a skill removed, a command added), pro-core 0.15.1 to 0.15.2 (router text), both manifests and marketplace entries, `metadata.version` 1.42.1 to 1.43.0.
   pro-starter depends on both with `*`, so no constraint changes and it is not bumped.
   Add the rows to `docs/releases.md`.
10. Run the gate: `node tests/check.mjs`, `node tests/eval.mjs --dry`, `claude plugin validate . --strict`, `claude plugin validate plugins/pro-nextjs --strict`, `claude plugin validate plugins/pro-core --strict` and `node tests/bridge-install-smoke.mjs`.
11. Open the PR against `main` with the evidence, the removed lines, the cited doc pages, the gate output and the tag commands for Jody.
