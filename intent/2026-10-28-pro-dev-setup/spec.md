---
intent: intent/2026-10-28-pro-dev-setup/intent.md
intent-status: proposed
status: draft
created: 2026-10-28T07:46:14-0400
author: the maintainer
---

# Spec: one /pro-dev command for setup and updates

Built from `intent.md` in this folder (commit 1e6668d).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `RELEASING.md`, `docs/decisions/0001` to `0005`, `docs/version-bump-law.md`, `docs/codex-parity.md`, `docs/hook-loading.md` (by reference from `CLAUDE.md`), the umbrella intent `intent/2026-10-27-pro-dev-simplify/intent.md` and the pro-security push gate (`plugins/pro-security/scripts/push-gate.py`, by name).
Code read to ground the design: the nine commands this replaces (`pro-starter`, `design-engine`, `design-skills`, `taste-skills`, `next-skills`, `lavish-engine`, `qa-engine`, `sdlc-init`, `pro-dev-doctor`), `templates/bootstrap.sh`, `templates/codex-bootstrap.sh`, `templates/install-companions.sh`, `templates/project-settings.json`, `tests/check.mjs` (the `bridges` and `pro-starter` checks), `tests/bridge-install-smoke.mjs`, the pro-starter manifest and the shape of `~/.claude/plugins/installed_plugins.json` and the `claude plugin update|uninstall|list` CLI.
No `DESIGN.md`, `SECURITY.md` or compliance skill under `.claude/skills/` exists in this repo.

## Summary

A site installs pro-dev-starter and whichever stack or method plugins it wants, runs `/pro-dev install` once and runs `/pro-dev update` after each `claude plugin update`.
`/pro-dev` lives in pro-core and works from one engine registry, so every bridge's engine is installed, updated and checked the same way.
`update` also brings every pro-dev plugin install that covers the repo onto the latest version in every scope.
It ends with a restart reminder.
`check` is the read-only report that replaces `/pro-dev-doctor`.
Nine setup commands and three duplicate commands go away, pro-starter becomes pro-dev-starter without the stack plugins and `bootstrap.sh` shrinks to three steps.

## Requirements

### Functional

- R1. pro-core ships `commands/pro-dev.md` accepting `install`, `update` and `check`; with no argument it runs `check`. (intent: "One command in pro-core")
- R2. pro-core ships one engine registry, `plugins/pro-core/registry/engines.json`, with one row per engine. (intent: "one engine registry in pro-core")
- R3. Each registry row records: `id`, `owner` (plugin name), `bridges` (skill slugs that route to it), `kind` (`skills-cli`, `npx` or `claude-plugin`), `default` (`true` or `false`), `detect` (the files or command that prove it is installed and the scope each counts for), `install` and `update` (argv arrays, no shell strings) and an optional `note`. (intent: "For each engine the registry records...")
- R4. The registry at ship time holds rows for every engine the deleted commands manage today: lavish, impeccable, qa-skills, taste-skill, next-skills, the seven design collections (garden, mengto, tastemaker, emil, jakub, elaya, owl) and the vercel, figma and playwright companions from claude-plugins-official.
- R5. `plugins/pro-core/scripts/pro-dev.py` reads the registry and `claude plugin list --json` and acts only on rows whose `owner` is installed and enabled for the repo. (intent: "acts only on engines whose owning plugin is installed")
- R6. `install` installs every default row that `detect` reports missing, asks once per optional row with no saved answer and installs the ones answered yes.
- R7. Answers to optional rows are saved in `.claude/pro-dev.json` at the repo root, keyed by row `id`, with the registry version they were asked under. Each `install` or `update` run also writes the registry version it ran against as `registryVersion`. (intent: "saves the answers in .claude/pro-dev.json")
- R8. `install` then does what `/sdlc-init` does today: drafts the "How work flows here" block in the agent file, creates `intent/` and adds `REVIEW.md` from the pro-ai-sdlc template if missing, merges `.gitignore` lines and leaves every change uncommitted. When pro-ai-sdlc is not installed that step is skipped with one line saying so. (intent: "sets the repo up for the intent, spec and plan loop")
- R9. `update` runs, in order: refresh the pro-dev-skillset marketplace, update each pro-dev plugin install that covers the repo at its own scope, update every installed engine row, install default rows now missing, ask only about optional rows with no saved answer, then print the restart reminder. (intent: "update updates every installed engine...", "ends by reminding the person to restart")
- R10. An install covers the repo when its scope is `user`, or its `projectPath` is the repo root or a folder inside it (such as `demo/app`). (intent: "including project-scope installs in subfolders such as demo/app")
- R11. `update` lists every `*@pro-dev-skillset` install whose `projectPath` no longer exists and removes them only after the person confirms, using the mechanism settled in Flagged concern 1. (intent: "update removes plugin installs whose project folder no longer exists")
- R12. When pro-starter is installed in any scope that covers the repo, `update` offers to install pro-dev-starter at the same scope and uninstall pro-starter.
  Before the swap it installs pro-nextjs and pro-astro explicitly at that scope if they are installed there now, so the site keeps its stack plugins.
- R13. `check` changes nothing and reports: each pro-dev plugin install covering the repo with scope and version, flagging any that lag the marketplace version; each registry row as installed, missing, declined or not applicable; strict validation of installed plugins; the router smoke check and the memory section from `/pro-dev-doctor`. (intent: "check reports what is installed, missing or stale and changes nothing; it replaces /pro-dev-doctor")
- R14. These command files are deleted: `pro-starter/commands/pro-starter.md`, `pro-design/commands/{design-engine,design-skills,taste-skills}.md`, `pro-nextjs/commands/next-skills.md`, `pro-pdd/commands/lavish-engine.md`, `pro-testing/commands/qa-engine.md`, `pro-ai-sdlc/commands/sdlc-init.md` and `pro-core/commands/pro-dev-doctor.md`.
- R15. Every bridge skill and doc that names a deleted command names `/pro-dev install`, `/pro-dev update` or `/pro-dev check` instead.
- R16. `plugins/pro-starter/` is renamed `plugins/pro-dev-starter/`, ships no command and no longer lists pro-nextjs or pro-astro as dependencies. (intent: "pro-starter is renamed pro-dev-starter...")
- R17. `templates/bootstrap.sh` does three things: writes `.claude/settings.json` from `templates/project-settings.json` (which now enables `pro-dev-starter@pro-dev-skillset`), installs pro-dev-starter and prints "run /pro-dev install". It no longer installs engines or writes `.claude/commands/lavish.md`.
- R18. pro-quality's `commands/review.md` is deleted; pro-ai-sdlc's `/review` is the only one.
- R19. pro-quality's `commands/api-docs.md` is deleted and `/document api` runs what it ran.
- R20. pro-research's `commands/lead-research.md` is deleted and `/research lead <target>` runs what it ran.
- R21. `tests/check.mjs` gains a `registry` check that fails when a bridge skill has no registry row, a row names a missing owner plugin or bridge skill, a row's `install` or `update` is not an argv array or two rows share an `id`.
- R22. The `bridges` check in `tests/check.mjs` stops requiring a per-plugin install command and requires the bridge to name `/pro-dev` instead.
- R23. The `pro-starter` check in `tests/check.mjs` is renamed for pro-dev-starter and treats pro-nextjs, pro-astro, pro-spdd and pro-legal as opt-in.
- R24. Routing cases under `tests/cases/` that target a deleted command target its replacement.
- R25. For one release `plugins/pro-starter/` stays as a shim: a manifest whose only dependency is pro-dev-starter, no commands or skills and a description telling the person to run `/pro-dev update` to switch. The release after removes it.
- R26. pro-core registers a SessionStart hook in its one `hooks/hooks.json`, running `scripts/pro-dev-nudge.py` beside the existing `dream-nudge.py`. It prints one line, "pro-dev plugins changed since the last /pro-dev run: run /pro-dev update", when the installed registry `version` differs from the `registryVersion` that `/pro-dev install` or `update` last wrote to `.claude/pro-dev.json`. It is silent when the versions match, when the file is missing or when the session is not in a git repo. It never installs or updates anything. (intent open question 6)

### Non-functional

- N1. `check` finishes without network access; the upstream catalog diffs of the old commands run only under `check --upstream`.
- N2. A failed engine install or update is reported and the run carries on with the next row; the final report lists every failure with the command to retry.
- N3. `pro-dev.py` runs registry argv with `subprocess` and no shell, never interpolates text from the repo, the answers file or a plugin payload into a command and writes only inside the repo, except for the stale-install step in R11.
- N4. `pro-dev.py` needs only `python3` and the standard library, like the existing hook scripts.
  It exits with a clear message when `python3`, `claude` or `npx` is missing.
- N5. Running `install` twice in a row makes no change the second time and asks no question.
- N6. `pro-dev.py run <id> install|update` and `pro-dev.py status --json` work from a plain terminal with no Claude Code session, so `codex-bootstrap.sh` can call them later.
- N7. The nudge hook exits 0 on any error, a missing `python3` or a malformed `.claude/pro-dev.json`. It never blocks or loops a session.

### Policy constraints applied

- Version-bump law (ADR-0002): every touched plugin bumps both manifests and its marketplace entry, plus `metadata.version` once; removing commands is a breaking change for anyone typing them, so pro-design, pro-nextjs, pro-pdd, pro-testing, pro-quality and pro-research take a minor bump with the removal named in the release notes; pro-dev-starter starts at `2.0.0`.
- Hook-loading law (ADR-0003): the R26 nudge is registered in pro-core's one `hooks/hooks.json` and `scripts/pro-dev-nudge.py` is tracked by git.
- REVIEW.md pass 1: the nudge ships with behavior cases in `tests/` that show it printing on a version mismatch and staying silent on a match, a missing file and a malformed file.
- Codex parity (ADR-0004): pro-core stays skill-bearing with a version-aligned `.codex-plugin/plugin.json`; pro-dev-starter is a Claude-only aggregator like pro-starter today. See Flagged concern 3 for the Codex side of engine setup.
- No hard dependency on another marketplace (PR 44): companions and EGM are registry rows of kind `claude-plugin`, never manifest dependencies.
- Bridges over vendoring: rows point at upstream installers; nothing upstream is copied in.
- Third-party code installs only when the person runs `/pro-dev`: no hook, plugin update or session start runs `pro-dev.py install` or `update`.
- impeccable rule: its row installs with `npx impeccable skills install`, updates with `npx impeccable skills update` and the `note` records that the `npx skills add pbakaus/impeccable` fallback is never run over a newer harness build.
- lavish rule: its `detect` counts only `.claude/skills/lavish/SKILL.md` in the repo; a user-scope copy does not satisfy it.
- REVIEW.md pass 2: no personal paths in the registry, the script or docs; tests use a temp `HOME`.
- Writing rules from `CLAUDE.md`: command and doc prose has no em dashes, no Oxford comma and straight quotes.

## Design

### User experience

`/pro-dev` with no argument prints the `check` report: a short table of plugins (scope, version, latest) and engines (installed, missing, declined, not applicable), then one line naming the next command to run.
`/pro-dev install` prints what it will install, runs it, asks one question per optional engine with a yes or no and a one-line reason the engine is useful, then sets up the loop files and prints what changed and what to commit.
`/pro-dev update` prints each plugin install it updates with before and after versions, then the engines, then any stale installs it found with a confirm.
It always ends with "Restart Claude Code so the updated plugins load."
Copy is plain and short; failures say which command to retry.

### System

New in pro-core:

- `commands/pro-dev.md`: the command prose; it calls the script for every deterministic step and owns only the questions and the `/sdlc-init` file drafting, which needs judgment.
- `registry/engines.json`: `{ "version": <int>, "engines": [ ...rows ] }`, rows per R3.
- `scripts/pro-dev-nudge.py`: the R26 SessionStart nudge; it reads two version numbers and prints at most one line.
- `scripts/pro-dev.py`: subcommands `status --json` (plugins covering the repo, rows and their state, saved answers), `run <id> install|update`, `plugins update` (marketplace refresh and per-scope `claude plugin update`), `stale` (list dead project installs) and `answer <id> yes|no`.

Changed:

- pro-ai-sdlc: `commands/sdlc-init.md` removed; its template files stay and `/pro-dev install` reads them through the installed pro-ai-sdlc path.
- pro-design, pro-nextjs, pro-pdd, pro-testing: engine commands removed; bridge skills (`impeccable-bridge`, `taste-skills-bridge`, `web-design-engineer-bridge`, `tastemaker-bridge`, `mengto-skills-bridge`, the forked skills that name `/design-skills`, `next-skills-bridge`, `lavish`, `writing-plans`, `qa-suite`, `agent-browser`, `vitest`) point at `/pro-dev`.
- pro-quality: `/review` and `/api-docs` removed, `/document` gains the `api` mode, `api-doc-drift.py` nudge text names `/document api`.
- pro-research: `/lead-research` removed, `/research` gains `lead`; the three researcher agents and the skill's references name the new form. The repo-local dev shims in `.claude/commands/` follow.
- pro-starter becomes pro-dev-starter (directory, manifest name, marketplace entry, `templates/project-settings.json`).
- `templates/bootstrap.sh` per R17; `templates/codex-bootstrap.sh` unchanged in this intent (Flagged concern 3).
- `README.md`, `RELEASING.md`, `docs/install-test.md`, `docs/releases.md`, `demo/setup.sh`, `demo/README.md` and the `using-pro-dev` router name the new commands.
- `tests/check.mjs` per R21 to R23, routing cases per R24 and `tests/bridge-install-smoke.mjs` reads its targets from the registry rather than its own table.

Plugin installs are found by parsing `claude plugin list --json`; if that output lacks `projectPath`, the script falls back to reading `~/.claude/plugins/installed_plugins.json` read-only.
`claude plugin update <name>@pro-dev-skillset --scope <scope>` runs from the install's `projectPath` for project scope, since the CLI resolves project scope from the working folder.
`.claude/pro-dev.json` is meant to be committed, so a team shares its optional-engine choices.
Engines default to project scope, as `/pro-starter` does today.

The command count goes from 41 plugin commands to 30 (12 removed, 1 added); the intent's 42 counted one more.

### Alternatives considered

- One registry file per plugin, collected at run time: keeps a row beside its bridge and avoids a pro-core bump when a bridge changes, but spreads the rules over many files and makes `check.mjs` and the smoke test collect them; one file is easier to review and intents C to E each add rows in one place.
- A Node script instead of Python: Node is likely present for `npx`, but every existing pro-dev script is Python and `pro-dev-doctor` already assumed no Node.
- Keeping the per-engine commands as thin aliases of `/pro-dev`: keeps old muscle memory but leaves the command list as long as it is now, which is the problem.
- Updating every pro-dev install on the machine, in every repo: reaches dead worktrees and other projects' pinned versions; rejected in favor of R10 (Flagged concern 2).

## Flagged concerns

ADR needed: yes, it sets the rule every future bridge follows (a registry row in pro-core and no per-plugin install command) and changes the setup contract for every site.
Draft: [ADR-0006](../../docs/decisions/0006-engine-registry-and-pro-dev.md).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | Removing a stale install has no CLI path: `claude plugin uninstall --scope project` resolves the project from the working folder, which no longer exists, so R11 would have to edit `~/.claude/plugins/installed_plugins.json`, Claude Code's internal state, outside the repo. The file holds dozens of dead worktree entries today. | REVIEW.md pass 2 (writes outside the project) | resolved: edit the file. `update` lists the dead entries and asks once; on yes it writes a backup beside the file, then removes only `*@pro-dev-skillset` entries whose `projectPath` is missing. If the file's shape is not what the script expects it changes nothing and says so. |
| 2 | "Update every scope" read literally reaches project installs in other repos (mieruka worktrees) whose versions those repos chose. | intent wording vs. its own success line ("covers the repo") | resolved: per repo only. R10 holds: user scope plus installs at or under the repo root; installs in other repos are listed in `check` and left alone. Dead entries anywhere are still cleaned by R11. |
| 3 | `/pro-dev` is a Claude command and Codex loads no plugin commands, so Codex sites keep engine setup in `codex-bootstrap.sh`, which duplicates the lavish install and will drift from the registry. | ADR-0004 Codex parity | resolved: `pro-dev.py` stays harness-neutral (N6); a follow-up intent points `codex-bootstrap.sh` at it. |
| 4 | Every new bridge in any plugin now also bumps pro-core, since its row lives in pro-core's registry. | ADR-0002 version-bump law | resolved: accepted cost of one registry file; recorded in ADR-0006. |
| 5 | The `bridges` check in `tests/check.mjs` requires each bridge to name a per-plugin command that exists; deleting them would fail it. | tests/check.mjs | resolved: R21 and R22. |
| 6 | The `pro-starter` check warns when a marketplace plugin is missing from its dependencies, so dropping pro-nextjs and pro-astro would warn. | tests/check.mjs | resolved: R23. |
| 7 | Deleting `pro-starter` from the marketplace breaks every site whose `.claude/settings.json` enables `pro-starter@pro-dev-skillset`. | RELEASING.md | resolved: one-release shim (R25) plus the R12 migration in `update`. |
| 8 | Default engines install without a question on `install` and `update`. | intent constraint "installs third-party code only when the person runs it" | resolved: the person runs the command and the run prints what it will install first; nothing runs on plugin update or session start. |

## Open questions

1. Likely needs an ADR: answered yes; drafted as ADR-0006 (proposed).
2. Too big for one PR? Answered (2026-10-28, on the recommendation): two PRs under this intent. The first covers items 1 to 4 (registry, `/pro-dev`, the nudge, deleted setup commands, rename and shim, bootstrap). The second covers item 5 (duplicate commands), which touches different plugins and merges on its own.
3. A one-release shim for the rename? Answered yes: R25 keeps the shim for one release and `update` performs the switch (R12).
4. Where the registry lives and its format: answered, one JSON file in pro-core read by `scripts/pro-dev.py` (R2, R3, Alternatives).
5. Default scope for engine installs: answered, project, as today (Design, System).
6. A SessionStart hook that prints "plugins changed, run /pro-dev update" when the registry version changes: answered yes; R26. It only prints, so the intent's ban on automatic runs still holds.

## Acceptance criteria

- AC1. In a fresh temp repo with pro-dev-starter installed at project scope, `/pro-dev install` installs every default engine whose owner is installed, asks once per optional engine and writes `.claude/pro-dev.json`; `/pro-dev check` then reports every default engine installed.
- AC2. Running `/pro-dev install` a second time changes no file and asks nothing.
- AC3. Adding a default row to the registry, bumping pro-core and running `claude plugin update` then `/pro-dev update` installs that engine and asks nothing about rows already answered.
- AC4. With pro-quality at an old version at user scope and in `demo/app` project scope, `/pro-dev update` then a restart leaves both on the marketplace version; the run ends with the restart line.
- AC5. With a `*@pro-dev-skillset` install whose `projectPath` is missing, `/pro-dev update` lists it and, on confirm, it no longer appears in `claude plugin list --json`; a backup of `installed_plugins.json` sits beside it.
- AC6. Installing pro-dev-starter installs neither pro-nextjs nor pro-astro.
- AC6b. A site whose settings enable `pro-starter@pro-dev-skillset` still loads after the release with no error and gains pro-dev-starter; `/pro-dev update` there swaps it for pro-dev-starter and keeps pro-nextjs and pro-astro if they were installed.
- AC6c. After a pro-core release that raises the registry version, the first session in a repo with `.claude/pro-dev.json` shows the update line once; after `/pro-dev update` the next session shows nothing.
- AC7. `ls plugins/*/commands/*.md | wc -l` prints 30 and none of the twelve removed commands exists.
- AC8. `node tests/check.mjs && node tests/eval.mjs --dry`, `claude plugin validate . --strict` and the per-plugin strict loop all pass, with the new `registry` check listed.
- AC9. `grep -rE '/(pro-starter|design-engine|design-skills|taste-skills|next-skills|lavish-engine|qa-engine|sdlc-init|pro-dev-doctor|api-docs|lead-research)\b' plugins README.md docs templates tests` finds nothing outside `docs/releases.md` and `docs/decisions/`.
- AC10. `bootstrap.sh` in a fresh temp folder writes settings enabling pro-dev-starter, installs it and prints the `/pro-dev install` line, with no `npx` call.

## Out of scope

- The new bridges (Hallmark, web-design-guidelines, Vercel skills, EGM, spec-kit); intents C, D and E add their rows.
- Changing what any engine does.
- Any hook that runs `/pro-dev update` or `install` on its own; the R26 nudge only prints.
- Pointing `codex-bootstrap.sh` at the registry (Flagged concern 3).
- Removing `templates/install-companions.sh`; it stays as a standalone script.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
