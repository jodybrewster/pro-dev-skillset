# Plan: one /pro-dev command for setup and updates

Built from `spec.md` (commit c15ecf2) and `intent.md` in this folder.
Status: draft.
Approver: Jody Brewster, as owner and architect of the marketplace.
The intent is `risk: high`: it changes the install path for every site and edits Claude Code's `installed_plugins.json`, so this is not auto-mode work.
Dated: 2026-10-28.

## Files that change

PR 1 (items 1 to 4 of the umbrella):

- `plugins/pro-core/registry/engines.json` (new): the engine registry (R2 to R4).
- `plugins/pro-core/scripts/pro-dev.py` (new): status, run, plugins update, stale cleanup and answers (R5 to R13, N1 to N6).
- `plugins/pro-core/scripts/pro-dev-nudge.py` (new): the SessionStart nudge (R26, N7).
- `plugins/pro-core/hooks/hooks.json` (modified): registers the nudge beside `dream-nudge.py`.
- `plugins/pro-core/commands/pro-dev.md` (new): the command prose, the optional-engine questions and the `/sdlc-init` file drafting (R1, R6, R8).
- `plugins/pro-core/commands/pro-dev-doctor.md` (deleted): folded into `/pro-dev check` (R13, R14).
- `plugins/pro-core/skills/using-pro-dev/SKILL.md` (modified): router names `/pro-dev` (R15).
- `plugins/pro-ai-sdlc/commands/sdlc-init.md` (deleted): folded into `/pro-dev install` (R8, R14).
- `plugins/pro-ai-sdlc/README.md` (modified): names `/pro-dev install` for setup.
- `plugins/pro-design/commands/{design-engine,design-skills,taste-skills}.md` (deleted) (R14).
- `plugins/pro-design/skills/{impeccable-bridge,taste-skills-bridge,web-design-engineer-bridge,tastemaker-bridge,mengto-skills-bridge,animate,apple-design,better-interface,better-layout,interface-review}/SKILL.md` (modified): name `/pro-dev` (R15).
- `plugins/pro-nextjs/commands/next-skills.md` (deleted); `plugins/pro-nextjs/skills/next-skills-bridge/SKILL.md` (modified).
- `plugins/pro-pdd/commands/lavish-engine.md` (deleted); `plugins/pro-pdd/skills/{lavish,writing-plans}/SKILL.md` (modified).
- `plugins/pro-testing/commands/qa-engine.md` (deleted); `plugins/pro-testing/skills/{qa-suite,agent-browser,vitest}/SKILL.md` and `plugins/pro-testing/references/upstream.md` (modified).
- `plugins/pro-dev-starter/.claude-plugin/plugin.json` (new): the renamed aggregator at `2.0.0` without pro-nextjs or pro-astro (R16).
- `plugins/pro-starter/` (modified): becomes the one-release shim; `commands/pro-starter.md` deleted, manifest depends only on pro-dev-starter (R25).
- `.claude-plugin/marketplace.json` (modified): pro-dev-starter entry, shim entry, every bumped version, `metadata.version`, descriptions that named deleted commands.
- Each touched plugin's `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` (modified): version bumps and descriptions.
- `templates/bootstrap.sh` (modified): three steps (R17).
- `templates/project-settings.json` (modified): enables `pro-dev-starter@pro-dev-skillset`.
- `tests/check.mjs` (modified): new `registry` check, `bridges` check names `/pro-dev`, starter check renamed with the opt-in set, Codex skip lists name pro-dev-starter and the shim (R21 to R23).
- `tests/pro-dev.mjs` (new): behavior cases for `pro-dev.py` and the nudge, with a fake `claude` and `npx` on `PATH` and a temp `HOME`.
- `tests/bridge-install-smoke.mjs` (modified): reads its targets from the registry.
- `tests/cases/routing.jsonl` (modified only if a case targets a deleted command; today none does) (R24).
- `README.md`, `RELEASING.md`, `docs/install-test.md`, `docs/troubleshooting.md` (if it names a deleted command), `demo/setup.sh`, `demo/README.md` (modified): the new flow.
- `docs/decisions/0006-engine-registry-and-pro-dev.md` (modified at Done): `proposed` to `accepted`.

PR 2 (item 5):

- `plugins/pro-quality/commands/{review,api-docs}.md` (deleted); `plugins/pro-quality/commands/document.md` (modified): `api` mode (R18, R19).
- `plugins/pro-quality/scripts/api-doc-drift.py` (modified): nudge text names `/document api`.
- `plugins/pro-research/commands/lead-research.md` (deleted); `plugins/pro-research/commands/research.md` (modified): `lead` mode (R20).
- `plugins/pro-research/agents/{company,people,signals}-researcher.md`, `plugins/pro-research/skills/lead-research/{SKILL.md,references/methodology.md}` (modified): name `/research lead`.
- `.claude/commands/{lead-research,research}.md` (modified or deleted): the repo-local dev shims follow.
- Manifests, marketplace entries and `metadata.version` for pro-quality and pro-research; README rows.

## Order of work

Build in a worktree on branch `feat/pro-dev-setup` based on local `main`, since the spec and ADR commits are not on `origin` yet; they ride in PR 1.
Leave the five uncommitted pro-ai-sdlc command edits in the main checkout alone; they are Jody's `; true` fix and not part of this plan.
Copy that `; true` pattern into every `!` context line of the new `pro-dev.md`.

PR 1:

1. Registry and its gate.
   Add the `registry` check to `tests/check.mjs` first and watch it fail on every bridge with no row.
   Then write `engines.json` with the rows from R4, translating each deleted command's install and update lines into argv arrays and copying the curated qa-skills subset, the impeccable fallback note and the lavish project-only `detect` across exactly.
   Check: `node tests/check.mjs registry` passes and fails again when one row is deleted.
2. `pro-dev.py status --json`.
   Parse `claude plugin list --json`, fall back to reading `installed_plugins.json`, apply R10 (user scope plus installs at or under the repo root) and report each row as installed, missing, declined or not applicable.
   Check: `tests/pro-dev.mjs` cases for owner installed or not, project versus user `detect`, lavish user-scope copy not counting and an install under `demo/app` counted while one in another repo is not.
3. `pro-dev.py run <id> install|update` and `answer <id> yes|no`.
   Argv only, no shell; a failure is reported and the run continues (N2); answers and `registryVersion` land in `.claude/pro-dev.json` (R7).
   Check: cases with a fake `npx` that records its argv, one that fails, a second `install` that runs nothing (N5) and an answers file with a hostile string that is never executed (N3).
4. `pro-dev.py plugins update` and `stale`.
   Marketplace refresh, then `claude plugin update <p>@pro-dev-skillset --scope <s>` from each install's `projectPath`; the pro-starter swap of R12 with pro-nextjs and pro-astro installed first when present; `stale` lists dead `*@pro-dev-skillset` entries and, on `--remove`, writes `installed_plugins.json.bak-<timestamp>` beside the file, removes only those entries and refuses when the file's shape is unexpected (R11).
   Check: cases against a fixture `installed_plugins.json` in the temp `HOME`: other marketplaces untouched, live entries untouched, backup written, unknown shape left byte-identical.
5. The nudge.
   `pro-dev-nudge.py` plus its `hooks.json` entry (R26, N7).
   Check: cases for mismatch prints one line, match is silent, missing file is silent, malformed file is silent with exit 0, outside a git repo is silent.
6. `commands/pro-dev.md`.
   `check` (default), `install` and `update` call the script for every deterministic step; the command owns the yes or no question per optional row and the `/sdlc-init` drafting, carried over from `sdlc-init.md` with its "never commits" rule; `check` carries the router smoke check and memory section from `pro-dev-doctor.md`; `update` always ends with the restart line.
   `allowed-tools` lists only `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev.py*`, `claude plugin list|validate*` and the file tools the drafting needs.
   Check: `claude plugin validate plugins/pro-core --strict`.
7. Delete the seven engine commands, `sdlc-init.md` and `pro-dev-doctor.md`; repoint every bridge skill and the router.
   Switch the `bridges` check to require `/pro-dev` (R22).
   Check: `node tests/check.mjs` and the AC9 grep.
8. Rename and shim.
   Create `plugins/pro-dev-starter/` with the dependency list minus pro-nextjs and pro-astro at `2.0.0`; turn `plugins/pro-starter/` into the shim at `1.14.0`; update `project-settings.json`, the marketplace and the three `pro-starter` mentions in `tests/check.mjs` (lines 257, 266, 345) plus the starter check and its opt-in set (R23).
   Check: `claude plugin validate plugins/pro-dev-starter --strict`, the same for the shim and `node tests/check.mjs`.
9. `bootstrap.sh`, `demo/setup.sh`, README, RELEASING, install-test and the other docs.
   Check: AC10 in a temp folder and the AC9 grep.
10. `bridge-install-smoke.mjs` reads the registry.
    Check: `node tests/bridge-install-smoke.mjs` locally (network).
11. Version bumps in one pass: pro-core 0.16.0, pro-ai-sdlc 0.3.0, pro-design 0.10.0, pro-nextjs 0.10.0, pro-pdd 0.5.0, pro-testing 0.6.0, pro-dev-starter 2.0.0, pro-starter shim 1.14.0, `metadata.version` 1.50.0, both manifests and the marketplace entry for each.
    Minor bumps because commands are removed; release notes name each removal.
12. Proof of done below, then the live check: in a fresh temp repo and in this repo with `demo/app` deliberately one version behind.

PR 2, from a second worktree once PR 1 merges (it only shares `marketplace.json` and `metadata.version`):

13. pro-quality: delete `/review` and `/api-docs`, add `api` mode to `/document`, update `api-doc-drift.py` text; bump to 0.11.0.
14. pro-research: delete `/lead-research`, add `lead` to `/research`, update agents, skill, methodology and the dev shims; bump to 0.4.0.
15. `metadata.version` 1.51.0, README rows, proof of done.

Parallel work: in PR 1, steps 1 to 6 are sequential (each builds on the script); once step 1 lands, the bridge repointing in step 7 splits by plugin (pro-design, pro-nextjs, pro-pdd, pro-testing) across Sonnet subagents in one turn.
Steps 8 and 9 touch separate files and can run beside it.
Steps 13 and 14 are independent of each other.

## Tests that prove it

- `tests/pro-dev.mjs` (new, run from `tests/check.mjs` like the other hook suites) covers steps 2 to 5: scope filtering, detect rules, argv recording, failure carry-on, idempotence, hostile answers file, the pro-starter swap, stale cleanup with backup and refusal plus every nudge case.
- `tests/check.mjs registry` covers R21; `bridges` covers R22; the starter check covers R23.
- `tests/bridge-install-smoke.mjs` proves the registry's install argv still work against the real upstreams.
- Live check AC1 to AC6c: fresh temp repo with pro-dev-starter at project scope, then this repo with `demo/app` behind; read `claude plugin list --json` before and after and restart between.
- AC10: run `bootstrap.sh` in an empty temp folder.

## Risks

The step most likely to go wrong is step 4.
`claude plugin update --scope project` has to run from the install's folder, `claude plugin list --json` may not expose `projectPath` and the stale cleanup edits a Claude Code file whose format is undocumented.
A bad write there could drop live installs for every repo on the machine; the backup, the shape check and the "only `*@pro-dev-skillset` with a missing folder" rule keep that recoverable.
The tests run against a fixture in a temp `HOME`, never the real file.
Step 8 is the other weak point: a mistake in the shim breaks loading for every existing site on update because the marketplace drops plugins that fail to resolve.
The live check runs the shim path in `demo/app` before PR 1 merges.
Deleting commands breaks muscle memory and any doc outside this repo that names them; the release notes list each one with its replacement.
Nothing is irreversible: the deletions and rename revert with the PR; the stale cleanup leaves a backup.

## Options not taken

- One PR for all five items: item 5 touches different plugins and only shares the marketplace file, so splitting keeps PR 1 reviewable.
- Pointing `codex-bootstrap.sh` at the script now: deferred to umbrella item G.
- Thin alias commands for the deleted ones: keeps the long command list the intent sets out to cut.
- A Node script: every pro-dev script is Python and `/pro-dev check` must not assume Node.
- Updating every install on the machine: Jody chose per repo.

Left out on purpose: the upstream catalog diffs of the old engine commands move behind `check --upstream` and are not rebuilt in this PR beyond carrying the existing `gh api` lines into the registry `note`; nobody ran them routinely and they need network.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
node tests/pro-dev.mjs
ls plugins/*/commands/*.md | wc -l
grep -rE '/(pro-starter|design-engine|design-skills|taste-skills|next-skills|lavish-engine|qa-engine|sdlc-init|pro-dev-doctor|api-docs|lead-research)\b' plugins README.md docs templates tests | grep -vE '^docs/(releases\.md|decisions/)'
```

Finished means: check prints 0 failures with the `registry` check listed, validation passes once for the marketplace and once per plugin directory (pro-dev-starter adds one), `tests/pro-dev.mjs` passes every case, the count prints 33 after PR 1 (41 less 9 plus 1) and 30 after PR 2 and the grep prints nothing.
Then the live check AC1 to AC6c with the observed output pasted into Done.

## Done

Filled in when the build is finished, before sign-off.

- Build commit:
- Checks run:
- AC1:
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0006 from `proposed` to `accepted`.

## Departures from plan

- The nudge emits SessionStart `additionalContext` JSON, as `dream-nudge.py` does, rather than plain stdout, so the agent passes the line on to the person.
- `pro-dev.py` gained `run all install|update` and a separate `plugins swap-starter`, because R12 says the swap is offered and the command asks before running it.
- `tests/bridge-install-smoke.mjs` keeps its expected-skills and contents table and takes each target's install argv from the registry row, so it tests what `/pro-dev install` runs.
- The smoke run found that the skills CLI with `-y` and no `-s` installs one default skill: the taste-skill, emil and jakub rows gained `-s '*'` and the lavish row gained `-y`, each confirmed by a real install in a temp folder.
- Upstream taste-skill is now one skill (`design-taste-frontend`), so `taste-skills-bridge` and the smoke test's 13-name table are stale; changing the bridge is outside this intent and is left for a follow-up.
- The security challenge of the diff found that a symlinked `.claude/pro-dev.json` let a repo overwrite a file outside it; the script now refuses non-regular files, writes through a temp file and `os.replace` and drops the `.bak` copy. The same pass narrowed the command's pre-approved tools to `status` and `answer`, bounded the nudge's read, added a hook timeout and made `stale` skip installs on unmounted drives.
- The AC9 grep also excludes `docs/plans/`, which holds old plans kept as history like `docs/releases.md`.
- Manifest descriptions that named a deleted command were rewritten to name `/pro-dev`, beyond the marketplace descriptions the plan listed.

<!--
Write this in plan mode from an accepted spec, then question it before approval:
what might break, where the weakest step is, and what was skipped on purpose.
Revise until someone who missed the conversation could build from this file alone.
Review compares the final diff with this file.
-->
