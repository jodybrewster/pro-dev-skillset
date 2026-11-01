# Plan: pro-ai-sdlc, the SDLC as one plugin

Read [intent.md](./intent.md) first.
The brief is `~/Projects/hq/initiatives/2026-10-17-one-click-intent/intent.md`, slice PR B.
The intent states the checks, so this change has no `spec.md` ([intent/README.md](../README.md)).
Status: implemented.

## Files that change

- `plugins/pro-ai-sdlc/` (new): manifests, `commands/` (intent, spec, plan, review, pr-babysit, sdlc-init), `templates/` (intent, spec, plan, REVIEW), `agents/` (researcher, verifier, simplifier, reviewer), `hooks/hooks.json`, `scripts/` (protect-tests, plan-sync, production-gate, a shared guard module) and `LICENSE`.
- `plugins/pro-{quality,research,security,legal}/agents/*.md` (modified, 10 files): a `model:` line each.
- The manifests of those four plugins, `pro-starter`, the marketplace (both files), `docs/releases.md`, `README.md`, `.agents/plugins/marketplace.json`.
- `tests/sdlc-hooks.mjs` (new) and a check in `tests/check.mjs`: behaviour cases for the three hooks.

## Order of work

1. Commit this intent and plan before any change under `plugins/`.
2. Templates: the kit's intent, spec, plan and REVIEW templates adapted, with our frontmatter and folder layout.
3. Commands: `/intent` carries the analyst rules, `/spec` and `/plan` read their templates, `/review` runs REVIEW.md's passes, `/pr-babysit` moves from user scope, `/sdlc-init` drafts the repo setup and commits nothing.
4. Agents: move `verifier` and `simplifier`, add `researcher` and `reviewer`, with `model:` by role.
5. Hooks: port the three user-scope hooks to Python, read `~/.claude/hooks/mode` and `mode.<hook>` (default warn) and log to `warn.log`, with a `stop_hook_active` guard on the Stop hook.
6. Add `model:` to the ten agents in the other plugins.
7. Manifests and versions: pro-ai-sdlc 0.1.0, pro-quality, pro-research, pro-security and pro-legal patch bumps, pro-starter 1.12.2 to 1.13.0 with the new dependency, marketplace `metadata.version` 1.42.3 to 1.43.0, releases table, README, Codex marketplace.
8. Run the gate.

## Tests that prove it

- `tests/sdlc-hooks.mjs` drives each hook with a payload in warn and enforce mode: flagged, not flagged, malformed payload, and a second Stop with `stop_hook_active`.
- `node tests/check.mjs` covers manifests, versions, hooks.json wiring and agent frontmatter.
- The eval runner's case format is routing for skills, so no command cases are added.

## Risks

- The user-scope commands and agents share names until the maintainer deletes them; the user-scope file wins on a bare name, so behaviour stays the same until then.
- A `model:` in agent frontmatter pins the agent regardless of the session model.
- Hooks read the same mode files as the user-scope ones, so a user with both installed gets two warnings per flagged call until the user-scope ones are removed.
- Hooks run in every consumer session: a payload that cannot be parsed must allow.

## Options not taken

- Put the commands in pro-core: the maintainer wants the SDLC as one plugin.
- Port the bash hooks as they are: the repo's hooks are Python and need no `jq`.
- Add `/incident` and `/review` triggers from the kit's CI: out of scope.

## Proof of done

`node tests/check.mjs && node tests/eval.mjs --dry && node tests/sdlc-hooks.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.

## Departures from plan

- Codex parity: a `.codex-plugin/plugin.json` and a `.toml` per agent were added for pro-ai-sdlc, which the plan did not list, because the parity law requires them.
- `protect-tests` also honours `.claude/.fix-task` and `SDLC_TASK_KIND=fix` and covers `_test.py`, `_test.go` and `/test/`, taken from the sample repo's hook.
- `/sdlc-init` follows the sample repo's layout (agent file sections, team `.claude/settings.json`, `.gitignore` lines), added after the plan was written.
- The command is `/pr-babysit`, the user-scope name, not `/babysit-pr`.
- `tests/check.mjs` gained `sdlc-hooks` and `sdlc-contract` checks.
- No eval cases for commands: the eval runner's case format is routing for skills; `sdlc-contract` checks the /intent file contract statically and the live run needs a model.
- Review fixes after the Opus review at c8611eb: warn mode for Stop hooks now emits only a user message (never model feedback), with test ps2b.
- The kit-derived templates, the researcher agent and the plan command were rewritten in our own words from section names and ideas; the eight intent.md headings are unchanged.
- `sdlc-contract` also pins the anchors mieruka parses from `commands/intent.md` and the eight template headings.
- pro-ai-sdlc is MIT with the repo root's LICENSE text (pro-core's LICENSE carries fork attributions, so it was not copied); the manifests carry no `license` field, so none was added.
- Nits: the `/sdlc-init` lead-in sentence deduplicated, `.claude/fix-mode` added to its `.gitignore` lines, the pro-starter marketplace description lists ai-sdlc, and the README says the hooks need python3.
- Licensing wording corrected: the kit and sample repo are the author's own generated output from Anthropic's public playbook, so the pro-ai-sdlc row in `docs/licenses.md` says original, adapted from the author's own kit, ideas credited to the playbook. The rewritten text stays.
