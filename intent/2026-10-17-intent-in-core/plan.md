# Plan: /intent, /spec and /plan ship from pro-core

Read [intent.md](./intent.md) first.
The brief is `~/Projects/hq/initiatives/2026-10-17-one-click-intent/intent.md`, slice PR B.
The intent states the checks, so this change has no `spec.md` ([intent/README.md](../README.md)).
Status: draft.

## Files that change

- `plugins/pro-core/references/intent-template.md` (new): the kit's intent fields with our frontmatter, read by `/intent` and later by mieruka.
- `plugins/pro-core/references/plan-template.md` (new): the kit's plan sections, read by `/plan`.
- `plugins/pro-core/commands/intent.md`, `spec.md`, `plan.md` (new): the three commands.
- `plugins/pro-*/agents/*.md` (modified, 10 files): a `model:` line each.
- Both pro-core manifests, the marketplace entry and `metadata.version`, `docs/releases.md`, `README.md`.

## Order of work

1. Commit this intent and plan before any change under `plugins/`.
2. Add the two templates under `plugins/pro-core/references/`, so they do not register as commands.
3. Add `/intent` (user-scope behaviour plus the template and the kit's Source and Evidence fields), `/spec` (user-scope behaviour kept) and `/plan` (the kit's plan-from-spec steps and interrogation questions).
4. Set `model:` on every agent: haiku for the four pro-research agents, sonnet for the three pro-quality writers, opus for security-architect, security-auditor and software-counsel.
5. Bump pro-core 0.15.2 to 0.16.0 (three commands added), marketplace entry, `metadata.version` 1.42.3 to 1.43.0, the pro-core manifest descriptions and the releases table.
   pro-starter depends on pro-core with `*`, so no constraint changes and it is not bumped.
6. Run the gate.

## Tests that prove it

- `node tests/check.mjs` covers manifests, version equality, agent frontmatter and Codex parity.
- A grep proves every agent file carries one `model:` line and no `effort` line changed.
- The eval runner's case format is routing for skills only, so no command cases are added.

## Risks

- The plugin commands and the user-scope files share names until Jody deletes the user-scope ones; the user-scope file wins on a bare `/intent`, so behaviour stays the same until then.
- A `model:` in agent frontmatter pins the agent regardless of the session model; a user on a plan without opus gets a fallback or an error.
- The reference path must resolve from an installed plugin, so commands use `${CLAUDE_PLUGIN_ROOT}`.

## Options not taken

- Keep the template inside the command body: mieruka could not read it.
- Name the template path in a skill instead of `references/`: a skill would register for routing and add a warning.
- Add a Codex `model` to the `.toml` files: Codex uses other model names and the brief names Claude roles only.

## Proof of done

`node tests/check.mjs && node tests/eval.mjs --dry`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.

## Departures from plan

None yet.
