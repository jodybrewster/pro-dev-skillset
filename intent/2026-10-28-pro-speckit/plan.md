# Plan: GitHub spec-kit as its own plugin

Built from `spec.md` (commit 604f92b) and `intent.md` in this folder.
Status: draft.
Approver: Jody Brewster; the change adds a row kind that runs a third-party Python CLI, widens `pro-dev.py`'s run path and records ADR-0008; it is not an auto-mode change.
Dated: 2026-10-28.

## Dependency

Intent `2026-10-28-plugin-installers` ships first.
pro-speckit's `/pro-speckit:install` runs its own copy of `scripts/pro-dev-owner.py`, which calls pro-core's `pro-dev.py --owner pro-speckit`; neither the script nor the `--owner` option exists on `main` today.
The `installers` check that change adds to `tests/check.mjs` also fails a row owner with no installer.
So pro-speckit's rows cannot land before it.
This build branches from `main` only after the installers PR has merged and step 1 confirms it.

## Versions

Read from `.claude-plugin/marketplace.json` on 2026-10-28: `metadata.version` 1.53.1, pro-core 0.18.1, pro-dev-starter 2.0.4, pro-starter 1.14.0.
The installers change is expected to take pro-core 0.19.0, pro-dev-starter 2.0.5, pro-starter 1.14.1 and `metadata.version` 1.54.0.
This change takes the next free versions after that: pro-speckit 0.1.0 (new), pro-core 0.20.0 (minor: new row kind, rows and router line), pro-dev-starter 2.0.6 (patch), pro-starter 1.14.2 (patch) and `metadata.version` 1.55.0.
pro-starter is not in spec R19 but depends on pro-dev-starter and `RELEASING.md` bumps a meta-plugin whose dependency moved, as the installers spec does.
Step 1 rereads the marketplace after the installers PR merges and takes the next free numbers if that PR landed on others.

## Files that change

- `plugins/pro-speckit/.claude-plugin/plugin.json` (new): name, version 0.1.0, a description saying it depends on pro-core and what that loads plus the `pro-core` dependency the installers spec requires of every row owner (R1, R26).
- `plugins/pro-speckit/.codex-plugin/plugin.json` (new): version-aligned Codex manifest with `skills: "./skills/"` and no command or dependency entry; its description says `/pro-speckit:install` is Claude Code only (R1, ADR-0004).
- `plugins/pro-speckit/skills/spec-kit-bridge/SKILL.md` (new): when to use spec-kit's flow, `/pro-dev install` and `/pro-speckit:install`, where output lives, user-invocable only, the intent link line, `/pro-speckit:remove` and `uv tool uninstall specify-cli`, the two Codex commands and the review-like-code list; no spec-kit text (R2 to R4, R25).
- `plugins/pro-speckit/sdlc-method.json` (new): `method` `spec-kit`, `requires` `null`, one `intent` hand-off offering `/speckit-specify {target}` (R12).
- `plugins/pro-speckit/commands/install.md` (new): the shared installer body from the installers change with pro-speckit's name, `argument-hint: "[update]"` and only the owner script's `status` and `answer` patterns in `allowed-tools` (R26, R27).
- `plugins/pro-speckit/commands/remove.md` (new): takes spec-kit out of the repo by the trusted absolute path, asks before `--force` and before deleting `.specify/`, never touches `specs/` and prints the CLI uninstall line; `allowed-tools` pre-approves only `uv tool dir --bin` (R28).
  It refuses when `.specify` is a symlink or not a folder.
  It removes tracked files with `git rm -r -- .specify` and untracked ones only after listing them, then shows `git status`.
  It runs `pro-dev-owner.py answer spec-kit no` and says `.claude/pro-dev.json` changed and should be committed with the removal.
  It needs the owner script's `answer` pattern in `allowed-tools` and `git rm` and `git status` as asked commands.
- `plugins/pro-speckit/scripts/pro-dev-owner.py` (new): a byte-for-byte copy of the installers change's script (R26, installers R10).
- `plugins/pro-core/registry/engines.json` (modified): the `specify-cli` and `spec-kit` rows with the `pinnedFiles` map from step 0 and the registry `version` up by one (R5, R6, R20).
  The `spec-kit` row carries `writesRepo: true`, the field that triggers the R9 and R24 gates at run time.
- `plugins/pro-core/scripts/pro-dev.py` (modified): the `uv-tool` kind, `direct_url.json` detection, drift and the at-pin no-op, the `needs` order rule, the pre-install refusals, the absolute-path run and `PATH` check, `tools.uv`, the `uv` line in `tool_missing`, the read-only spec-kit findings in `status` and the docstring's second user-wide write (R7 to R11, R20 to R24, N5, N6).
  The `needs`, R9 and R24 gates sit inside `run_engine` for install and update, so `retry_line` cannot bypass them.
  Success and the update no-op for a `uvTool` row require the pinned commit.
  A drifted `uv-tool` row is marked as wanting a run.
  The findings cover every `.specify/` or `speckit-*` state, never raise and turn per-path errors into findings.
- `plugins/pro-core/commands/pro-dev.md` (modified): the `uv` stop line beside the `npx` one, the `versionDrift` and spec-kit findings lines in `check`, the R34 line "replace specify-cli <installed> with <pin>, user-wide" for a drifted CLI and nothing new in `allowed-tools` (R10, R11, R34).
- `plugins/pro-core/skills/using-pro-dev/SKILL.md` (modified): pro-speckit on the spec branch beside pro-egm and pro-spdd, in the tree and the table (R18).
- `plugins/pro-core/.claude-plugin/plugin.json`, `plugins/pro-core/.codex-plugin/plugin.json` (modified): 0.20.0 (R19).
- `plugins/pro-dev-starter/.claude-plugin/plugin.json`, `plugins/pro-dev-starter/.codex-plugin/plugin.json` if present, `plugins/pro-starter/.claude-plugin/plugin.json`, `plugins/pro-starter/.codex-plugin/plugin.json` if present (modified): patch bumps (R19, `RELEASING.md`).
- `.claude-plugin/marketplace.json` (modified): the pro-speckit entry, the four version moves and `metadata.version` once (R1, R19).
- `tests/check.mjs` (modified): `uv-tool` accepted, the argv, `needs`, `pinnedFiles` and `writesRepo` rules, `spec-kit-bridge` in `BRIDGES` and `pro-speckit` in `OPT_IN` (R14).
- `tests/pro-dev.mjs` (modified): fake `uv` and `specify`, a fixture registry with the two rows and the R15 cases.
- `tests/methods.mjs` (modified): the R16 case reading pro-speckit's real `sdlc-method.json`.
- `tests/cases/routing.jsonl` (modified): at least one case expecting `spec-kit-bridge` (R18).
- `docs/licenses.md` (modified): the bridged MIT row (R17).
- `docs/releases.md` (modified): rows for pro-speckit, pro-core, pro-dev-starter and pro-starter and the new `metadata.version` (`RELEASING.md`).
- `README.md` (modified): pro-speckit in the plugin list, the opt-in list, the spec row of the phase table and the layout tree.
- `docs/decisions/0008-spec-kit-uv-tool.md` (modified, stays `proposed` until sign-off): drop `/pro-speckit:update` and `update.md`, which R27 replaced; name the `needs` field, the `writesRepo` field and the `detect.uvTool` form; note which generated files step 0 could not pin; state what step 0b found about `exclude-newer` in `uv-receipt.toml` and `uv tool upgrade`.
- `CLAUDE.md` and `AGENTS.md` (modified): the per-plugin validate count goes from 17 to 18 and the warning count to what step 9 prints.

No file under `plugins/pro-ai-sdlc/` changes (R13).

## Order of work

0. Build checks, run by hand before any code, results written under Departures and into ADR-0008 where they change it.
   Isolate every run: `UV_TOOL_DIR` and `UV_TOOL_BIN_DIR` point into a scratch folder, `HOME` is a scratch folder and each repo is a fresh `git init` with one empty commit.
   a. Install: `uv tool install specify-cli --exclude-newer 2026-10-27T18:07:43Z --from git+https://github.com/github/spec-kit.git@43486672fe826d230d884815be7cc2026469a6ba` succeeds and resolves the `hatchling` build backend under the same cutoff.
   b. Provenance: find `direct_url.json` under `uv tool dir` and record its exact relative path on macOS and Linux, the exact `url` string (with or without `git+`) and that `vcs_info.commit_id` is the 40-character SHA, not the tag object `10640fb7e9a879c47e96b832c2f7484fa940f959`.
      Also record whether `uv-receipt.toml` stores `exclude-newer`, whether `uv tool upgrade` and `uv tool upgrade --all` move dependencies past it while `direct_url.json` still matches. Also record how many `specify_cli-*.dist-info` folders an upgrade leaves.
      If the receipt stores it, detection also requires it to match the row.
      If not, ADR-0008 says so.
      More than one `specify_cli-*.dist-info` reads as drift.
   c. Drift: install a different spec-kit commit, then run the pinned argv without `--force`; record whether uv replaces it, refuses or reports it as already installed; this decides whether a drifted `install` runs the row's `install` or `update` argv.
   d. `uv tool dir` and `uv tool dir --bin` honour the two variables, print one line each and do not create anything.
   e. Init: in a clean repo run `<bin>/specify init --here --force --non-interactive --script sh --integration claude "--integration-options=--no-model-invocation --events false"` as one argv element; list every file written, confirm nothing is written outside the repo and the scratch `HOME`, no commit or branch is made and it does not need `claude` on `PATH`.
      The list of files and folders it writes or overwrites is the write set that step 2's symlink check uses.
   f. Flags: every `.claude/skills/speckit-*/SKILL.md` carries `disable-model-invocation: true`; `.claude/settings.json` is absent or has no hook; the `=` form of `--integration-options` with both options in one string is parsed as two options.
   g. Upgrade: commit, edit `.specify/memory/constitution.md`, run `specify integration upgrade claude` with the same options; the constitution hash is unchanged and no managed file churns; then edit a managed script and confirm the upgrade stops, names it and exits non-zero without `--force`.
   h. Uninstall: `specify integration uninstall claude` on unedited skills removes every `speckit-*` folder; with one skill edited it keeps that file and names it; `.specify/` stays.
   i. Determinism (R20): repeat item e in two clean repos with different names and parent paths, one on Jody's Mac and one in a Linux container (`python:3.12` with uv), hash every file under `.claude/skills/speckit-*/SKILL.md`, `.specify/scripts/**` and `.specify/templates/**` and diff the two lists; pin only the files byte-identical in both and list any left out under Departures.
   j. Confirm no generated file embeds the repo path, repo name, user name, date or CLI version string.
   If any result contradicts the spec, stop, amend `spec.md` and `ADR-0008` first and get Jody's yes before step 2.
1. Base: confirm the installers PR has merged (`pro-dev.py --owner` exists, `scripts/pro-dev-owner.py` ships in pro-egm and the `installers` check is in `tests/check.mjs`), branch from the new `main` in a worktree and fix the version numbers from the marketplace.
2. `pro-dev.py` run path for `uv-tool` rows, with the `tests/pro-dev.mjs` cases written first against a fixture registry:
   - `detect: { "uvTool": "<tool name>" }` reads `direct_url.json` under `uv tool dir` and compares `url` and `vcs_info.commit_id` with the URL and SHA parsed from the row's own `--from` argv; the pin then lives in one place (R7).
   - `engine_state` reports a wrong commit as `installed` with `versionDrift: { "installed": <sha>, "pinned": <sha> }`; a missing file reads as `missing`; `install` on a drifted row moves it to the pin with the argv step 0c chose; `update` at the pin prints `specify-cli: at pin` and runs nothing (R7).
   - For a `uvTool` row, success after a run and the update no-op both require the pinned commit with no `versionDrift`, so presence alone never counts.
     A fake `uv` that exits 0 and leaves the old commit must print a failure and not "install ok".
   - A second `specify_cli-*.dist-info` folder reads as drift.
     If step 0b showed the receipt stores `exclude-newer`, detection also requires it to match the row.
   - A drifted `uv-tool` row is marked as wanting a run with both SHAs in `status`, so `wantsInstall` is true and R34 lists "replace specify-cli <installed> with <pin>, user-wide" before the yes.
   - A row with `needs: "<id>"` is skipped with `<id>: needs <needed id> first` unless the needed row is installed with no drift, read fresh at that moment; a run that just installed the CLI goes on to `specify init` (R8).
     A failed CLI reinstall skips `specify integration upgrade`.
   - The `needs` rule, the R9 refusals and the R24 check all live inside `run_engine` for install and update and run before any argv.
     The pasted `retry_line` (`run spec-kit install`) therefore meets the same gates as the `all` loop.
   - The trigger for R9 and R24 is the registry field `writesRepo: true` on the row, not the row id or the argv[0] shape.
   - A `uv-tool` row whose argv[0] is not `uv` runs argv[0] from `<uv tool dir --bin>/<argv[0]>`, an absolute path, even when no `specify` is on `PATH` at all; when one is on `PATH`, `run_engine` resolves the name and refuses with both real paths when they differ (R24).
   - Before the `spec-kit` row's `install`, refuse when `.specify/` exists (`lexists`) or the tree is dirty; the tree state is taken once at the start of `cmd_run`, before any row runs (R9).
     The state is `git status --porcelain=v1 -z --untracked-files=all`, parsed on NUL, dropping only the exact path `.claude/pro-dev.json` because `/pro-dev install` saves the answer there.
     Untracked files elsewhere under `.claude/`, such as `.claude/skills/speckit-plan/SKILL.md`, still count and refuse.
     The row is refused when the status call fails or times out or the repo is not a work tree; `git_out`'s `(False, "")` is never read as clean.
   - Before the `spec-kit` row runs, refuse when any path in the step 0e write set, or any parent of one below the repo root, `lexists` as a symlink.
   - `status` adds `tools.uv` from `shutil.which` with no exec; `uv tool dir` runs only when a `uv-tool` row's owner is active; a site without pro-speckit sees no new process (R10, N2).
   - `tool_missing` gains the `uv` line with the link to uv's installation docs; the docstring names `uv tool install` as the second user-wide write.
3. `pro-dev.py` read-only spec-kit findings, cases first:
   - Spec has no `pro-dev.py check` subcommand to extend; `/pro-dev check` reads `status --json`; a row with `pinnedFiles` gains a `specKitFindings` list in `row_findings` (R11, R20).
   - The findings run whenever `.specify/` or any `.claude/skills/speckit-*` exists, whatever the row's state, so deleting `speckit-specify/SKILL.md` hides nothing.
     A missing pinned file is a finding.
   - Hash each pinned path with `hashlib`, opening only regular files that stay inside the repo with a size cap; report changed, missing and extra files under the three globs plus any symlink there (R20).
   - Every per-path error (non-UTF-8 content, a folder where a file is pinned, an unreadable file, a size over the cap) becomes a finding "could not check <path>: <reason>".
     The function never raises and never returns an empty list after an error.
   - Report every `.claude/skills/speckit-*/SKILL.md` on disk whose first frontmatter block lacks exactly one top-level unquoted `disable-model-invocation: true`; a duplicate key or a quoted `"true"` is a finding (R21).
   - Report each R22 path that exists and each `.claude/settings.json` hook whose command names `specify` (R22).
   - Report a `.specify/feature.json` that `git ls-files` tracks or whose `feature_directory` resolves outside `<repo>/specs/`; do the same for `SPECIFY_FEATURE_DIRECTORY` in the script's environment (R23).
   - `status` never executes `specify`; the fake `specify` marker file proves it (N5).
4. `tests/check.mjs`: accept `uv-tool`; fail a `uv-tool` row whose `install` or `update` lacks `--exclude-newer` with a timestamp or a `--from` ending in `@<40 hex>`; fail `pinnedFiles` values that are not 64 lowercase hex characters or keys outside the three globs; fail a `needs` that does not name an earlier row with the same owner; fail any `uv-tool` row whose argv[0] is not `uv` and that lacks `writesRepo: true`, so a future repo-writing row cannot skip the clean-tree gate; add `spec-kit-bridge` to `BRIDGES` and `pro-speckit` to `OPT_IN` (R14).
5. The plugin and its rows, in one commit with the version bumps so the version-bump law and the `installers`, `registry` and `bridges` checks hold together:
   - the two manifests, the bridge skill, `sdlc-method.json`, `install.md`, `remove.md` and the copied `pro-dev-owner.py`;
   - `remove.md` refuses a `.specify` that is a symlink or not a folder, uses `git rm -r -- .specify` for tracked files, lists untracked ones before removing them, shows `git status` after and runs `pro-dev-owner.py answer spec-kit no`, then says the answers file changed and should be committed with the removal;
   - the `specify-cli` row (`default` true, `detect.uvTool`, the R5 argv, `note` naming tag `v1.2.4`) and after it the `spec-kit` row (`default` false, `needs` `specify-cli`, `writesRepo` true, the R6 detect and argv, `pinnedFiles` from step 0i), registry `version` up by one;
   - the marketplace entry and every bump of R19 plus pro-starter.
6. Routing and methods: the router line in `using-pro-dev`, the routing case and the R16 case in `tests/methods.mjs`.
7. `pro-dev.md`: when a `uv-tool` row is wanted and `tools.uv` is false, say uv is needed with the docs link and stop before either spec-kit row; in the R34 list, show a drifted CLI as "replace specify-cli <installed> with <pin>, user-wide" before the yes; in `check`, print `versionDrift` and each `specKitFindings` line as needs attention and change nothing; leave `allowed-tools` untouched (R10, R11).
8. Docs: `docs/licenses.md`, `docs/releases.md`, `README.md`, the ADR-0008 corrections and the `CLAUDE.md` and `AGENTS.md` counts.
9. Verify in the worktree with every command under Proof of done.
10. Live check in a scratch repo (Proof of done, last block); results go under Done.
    Record the commit SHA of the marketplace clone the check installed from under Done.
    Redo the check if the PR branch moves.

Steps 2 and 3 share `pro-dev.py` and `tests/pro-dev.mjs` and run in that order in one worktree.
Step 4 (`tests/check.mjs`), the plugin content of step 5 without its rows, step 6 and step 8 touch separate files and can run in parallel worktrees once step 1 is done.
The rows of step 5 wait for step 0i's hashes and step 4's rules.
Steps 9 and 10 run last on the merged branch.

## Tests that prove it

- `tests/pro-dev.mjs` covers every R15 case with a fake `uv` (answers `tool dir`, `tool dir --bin` and `tool install`, logs argv and writes a `direct_url.json` with the commit from `--from`) and a fake `specify` that writes a marker file and the fixture's pinned files on `init`:
  CLI missing installs with the pinned SHA and `--exclude-newer` argv;
  another commit shows `versionDrift` in status and update reinstalls;
  a matching commit makes update print `specify-cli: at pin` with no `uv tool install` in the log;
  `spec-kit` is skipped while the CLI is missing and is not run when not picked;
  `spec-kit` install is refused with `.specify/` present, with a dirty tree and with another `specify` first on `PATH`;
  with no `specify` on `PATH` at all the row still runs the absolute `<uv tool dir --bin>/specify` path;
  a fresh run where only `.claude/pro-dev.json` is untracked still installs `spec-kit` (the R9 snapshot);
  the same run with an untracked `.claude/skills/speckit-plan/SKILL.md` beside the answers file is refused;
  a fake `git` that exits non-zero and a repo that is not a work tree each refuse the row;
  `run spec-kit install` with a drifted CLI or a dirty tree meets the same gates as the `all` loop;
  a failed CLI reinstall skips `specify integration upgrade`;
  a fake `uv` that exits 0 and leaves the old commit prints a failure;
  a drifted CLI shows as wanting a run with both SHAs;
  a second `specify_cli-*.dist-info` reads as drift;
  a committed symlink at a write-set path or a parent refuses the row;
  `uv` missing prints the docs line and runs nothing;
  `status` reports a pinned script changed together with its manifest hash, a skill without the flag, each R22 path, a `specify` hook in `.claude/settings.json`, a tracked `.specify/feature.json` and one pointing outside `specs/`;
  `status` reports findings with `speckit-specify/SKILL.md` deleted, a missing pinned file, an unreadable pinned file (a finding, a non-empty list and no exception), a duplicate `disable-model-invocation` key and a quoted `"true"`;
  `status` and the findings leave no marker file;
  with `--owner pro-speckit`, `run all install` reaches only the two rows.
- Every existing `tests/pro-dev.mjs` case passes unedited, which shows a site without pro-speckit is unchanged (N2, installers R8).
- `tests/methods.mjs` covers pro-speckit installed printing its `intent` offer with the target filled in and nothing for `spec`, `plan` or `review` (R16).
- `tests/check.mjs` covers the new registry rules; each is shown failing once by hand on a scratch copy of `engines.json` (no `--exclude-newer`, a tag in `--from`, a 63-character hash, `needs` naming a later row, a non-`uv` argv[0] without `writesRepo: true`) and passing on the real file.
- `tests/cases/routing.jsonl` covers a prompt routing to `spec-kit-bridge`, checked by `node tests/eval.mjs --dry`.
- The live check in step 10 covers AC1 to AC6, AC10 and AC11 against real spec-kit at the pin.

## Risks

Most likely to go wrong: step 2, the run path in `pro-dev.py`.
R9 read literally refuses every first install, because `/pro-dev install` saves the `spec-kit` answer to `.claude/pro-dev.json` and earlier rows write `.claude/skills/` before the `spec-kit` row runs; the plan takes the tree state once at the start of the run with `git status --porcelain=v1 -z --untracked-files=all` and drops only the exact path `.claude/pro-dev.json`.
Tests cover the answers file alone and beside an untracked skill.
The same step changes `run_engine`, which every row of every owner goes through; a slip there breaks `/pro-dev install` for every site; the existing cases passing unedited is the guard.
Step 0 can overturn the spec: if `--events false` in the `=` form is not parsed, if uv will not replace a drifted install without `--force` or if generated files carry a path or version, the rows or R20 change before any code.
If few generated files are byte-identical across machines, `pinnedFiles` covers less and R20 protects less; the left-out files are named under Departures and in ADR-0008.
`uv tool install` is a user-wide write that outlives the repo; two repos on different pins downgrade each other's CLI, which ADR-0008 accepts with `uvx` as the fallback.
The pinned hashes go stale on every spec-kit pin move.
spec-kit ships about weekly; `/pro-dev check` will report drift whenever a repo was set up by hand at another version.
Nothing here is irreversible inside this repo; in a target repo `specify init --force` can overwrite files, which R9 and R24 gate.

What this might break: `/pro-dev install` and `update` for every site if `run_engine` regresses; `/pro-dev check` output if `row_findings` throws on an unexpected file; the `installers` check if `pro-dev-owner.py` drifts from the other copies by one byte.

## Options not taken

- A hardcoded `spec-kit` after `specify-cli` rule in `pro-dev.py`: ADR-0008 says a new CLI engine fits with a row and no new code; the order lives in a `needs` field instead.
- Reading the pin from a separate `detect` field: two copies of the SHA in one row can disagree; `detect.uvTool` parses it from `--from`.
- A new `check` subcommand in `pro-dev.py`: `/pro-dev check` already reads the pre-approved `status --json`; findings go there and nothing new needs approval.
- Checking the dirty tree just before the `spec-kit` row runs: earlier rows and the saved answer would always trip it.
- Checking only the core skills named in `pinnedFiles` for the flag: any `speckit-*` skill on disk is checked and an extension skill also shows up, which is wanted while extensions are out of scope.
- Checking `.claude/settings.local.json` for `specify` hooks: it is untracked and never reaches a PR; left out to match the spec.
- Pinning hashes from one machine: R20 asks for two clean installs and a single run cannot show which files are stable.
- Running the live check from a local-path marketplace: `pro-dev-owner.py` refuses any `pro-dev-skillset` marketplace whose source is not `jodybrewster/pro-dev-skillset` on GitHub (installers R32).

## Proof of done

From the worktree root, all must pass:

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/pro-dev.mjs
node tests/methods.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
git diff --stat "$(git merge-base origin/main HEAD)" HEAD -- plugins/pro-ai-sdlc
cmp plugins/pro-speckit/scripts/pro-dev-owner.py plugins/pro-egm/scripts/pro-dev-owner.py
grep -rnE ',[[:space:]]and\b' plugins/pro-speckit docs/decisions/0008-spec-kit-uv-tool.md
grep -rnP '\x{2014}' plugins/pro-speckit docs/decisions/0008-spec-kit-uv-tool.md
```

Counts as finished, with the new `tests/pro-dev.mjs` and `tests/check.mjs` cases for the security changes among the passing ones: `✓ <n> checks · 0 failures`, every routing case resolving, no `FAIL` line from the two test scripts, `✔ Validation passed` once for the marketplace and once for each of the 18 plugin folders, an empty diff for `plugins/pro-ai-sdlc` against the merge base (AC7 names `bc7c3ef`, which PR 67 has already moved past), no output from `cmp` and no output from either grep.

Live check, after the PR is pushed, in a scratch repo outside this checkout with a scratch `CLAUDE_CONFIG_DIR`, `UV_TOOL_DIR` and `UV_TOOL_BIN_DIR` so Jody's own setup is not touched:

1. `git init` a scratch repo with one commit; add the marketplace from GitHub at the PR branch (or after merge if Claude Code cannot add a branch ref) and install `pro-core` and `pro-speckit` at project scope.
2. AC6 first: with `uv` hidden from `PATH`, `/pro-speckit:install` prints the uv docs line and runs nothing; with an uncommitted file it refuses `spec-kit`; with an empty `.specify/` it refuses `spec-kit`.
3. AC11: with a second `specify` script earlier on `PATH`, `/pro-speckit:install` refuses `spec-kit` and names both paths.
4. AC1: `/pro-speckit:install`, pick `spec-kit`, say yes; `direct_url.json` carries `43486672fe826d230d884815be7cc2026469a6ba`, `.claude/skills/speckit-specify/SKILL.md` has `disable-model-invocation: true`, `.claude/settings.json` has no spec-kit hook and `/pro-dev check` shows both rows installed with no findings; commit the new files.
5. AC2: type `/speckit-constitution`, `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` and `/speckit-implement` on a toy feature; each runs and writes under `.specify/memory/` and `specs/001-<feature>/`.
6. AC3: install `pro-ai-sdlc`, run `/intent` on a toy idea; it ends with the spec-kit offer naming the new `intent.md`; uninstall pro-speckit and the offer is gone.
7. AC4: edit and commit the constitution, record `shasum -a 256 .specify/memory/constitution.md`, run `/pro-speckit:install update` and `/pro-dev update`; the CLI step prints `specify-cli: at pin` and the hash is the same.
8. AC10: in turn, edit `.specify/scripts/bash/create-new-feature.sh` and its manifest hash together, remove the flag from one core skill, add `.specify/extensions.yml` and commit `.specify/feature.json`; `/pro-dev check` reports each and `ps` during the check shows no `specify` process (the fake marker case in `tests/pro-dev.mjs` is the hard proof).
9. AC5: `/pro-speckit:remove` on unedited skills, say yes to removing `.specify/`, then `claude plugin uninstall pro-speckit@pro-dev-skillset`; no `.claude/skills/speckit-*` folder remains, `specs/` is untouched and the printed line is `uv tool uninstall specify-cli`.

## Security challenge

From a fresh-context `security-architect` challenge of this plan on 2026-10-28, run with Opus at high effort.
It covers only what the plan adds to or changes from the spec.

Verdict: proceed with required changes; nothing blocking.

### Required changes

1. [8/10] `run_engine` checks success with `detected()`; if `uvTool` detection only means present, a reinstall that exits 0 without replacing the CLI prints "install ok" on an unreviewed commit. Change: for a `uvTool` row, success after a run and the update no-op both require the pinned commit (no `versionDrift`); test a fake `uv` that exits 0 and leaves the old commit.
   Answered by step 2.
2. [8/10] Findings run only when `speckit-specify/SKILL.md` exists, so a PR that edits a script and deletes that skill hides the edit. Change: compute findings whenever `.specify/` or any `.claude/skills/speckit-*` exists, whatever the row's state. Report a missing pinned file as a finding; add the test.
   Answered by step 3.
3. [8/10] Plain `git status --porcelain` collapses an untracked folder, so the saved answer shows as `?? .claude/` and an exact-path filter refuses every first install, tempting a fix that ignores all of `.claude/`. Change: `git status --porcelain=v1 -z --untracked-files=all`, dropping exactly `.claude/pro-dev.json`; test the answers file beside an untracked `.claude/skills/speckit-plan/SKILL.md` and expect a refusal.
   Answered by step 2.
4. [7/10] `git_out` returns `(False, "")` on timeout, OSError or outside a work tree, which reads as clean. Change: refuse the row when the status call fails or the repo is not a work tree; test with a fake `git` that exits non-zero.
   Answered by step 2.
5. [7/10] If the `needs` rule, R9 refusals and R24 path check live only in the `all` loop, the pasted `retry_line` (`run spec-kit install`) bypasses them. Change: enforce all three inside `run_engine` for install and update before any argv runs; test `run spec-kit install` with a drifted CLI and a dirty tree; test that a failed CLI reinstall skips `specify integration upgrade`.
   Answered by step 2.
6. [7/10] A drifted CLI is reinstalled through the `installed` branch while `wantsInstall` stays false, so a machine-wide CLI replacement skips the R34 list. Change: status marks a drifted `uv-tool` row as wanting a run with both SHAs; R34 lists it as "replace specify-cli <installed> with <pin>, user-wide" before the yes.
   Answered by step 2 and step 7.
7. [7/10] After `/pro-speckit:remove` the committed `spec-kit: yes` answer travels to teammates and reinstalls spec-kit. Change: `remove.md` runs `pro-dev-owner.py answer spec-kit no` and says the answers file changed and should be committed with the removal; drop the line from Risks.
   Answered by step 5.
8. [7/10] `specKitFindings` runs inside the pre-approved `status --json`; a non-UTF-8 file, a folder where a file is pinned or an unreadable file could throw or empty the list. Change: every per-path error becomes a finding ("could not check <path>: <reason>"); the function never raises and never returns an empty list after an error; test an unreadable pinned file.
   Answered by step 3.
9. [6/10] (verify) A committed symlink at `.claude/skills/speckit-implement` reads clean to git while `--force` writes through it outside the repo. Change: take the exact write set from step 0e; before the `spec-kit` row runs, refuse when any of those paths or a parent below the repo root `lexists` as a symlink; use `lexists` for `.specify/` too.
   Answered by step 2.
10. [6/10] (verify) Duplicate or quoted `disable-model-invocation` keys can pass a line check while YAML reads the skill as model-invocable. Change: report any `speckit-*` skill whose first frontmatter block lacks exactly one top-level unquoted `disable-model-invocation: true`; test a duplicate key and a quoted `"true"`.
    Answered by step 3.
11. [6/10] (verify) A later PR could make `.specify` a symlink to `..` before `/pro-speckit:remove` deletes it. Change: `remove.md` refuses when `.specify` is a symlink or not a folder, removes tracked files with `git rm -r -- .specify`, untracked ones only after listing them and shows `git status` after.
    Answered by step 5.
12. [5/10] (verify) `uv tool upgrade --all` can move dependencies past `--exclude-newer` while `direct_url.json` still matches. Change: step 0b records whether `uv-receipt.toml` stores `exclude-newer` and whether `uv tool upgrade` moves dependencies; if stored, detection also requires it to match the row; if not, say so in ADR-0008; more than one `specify_cli-*.dist-info` reads as drift.
    Answered by step 0b and step 2.

### Open questions from the challenge

- What triggers R9 and R24 at run time: the row id, the `uv-tool` kind with a non-`uv` argv[0] or a new registry field? Name the trigger and add a `tests/check.mjs` rule so a future repo-writing `uv-tool` row cannot skip the clean-tree check.
  Answered by step 2 and step 4.
- When `specify` is not on `PATH` at all, R24 still runs the absolute path; say so and test it.
  Answered by step 2.
- The live check installs from a PR branch while the source check compares only `repo`; record the marketplace clone's commit SHA under Done and redo the check if the branch moves.
  Answered by step 10.

### Accepted risks

- One machine-wide `specify` CLI shared by every repo, with `uvx` as the fallback (Jody, ADR-0008).
- Dependency ranges `--exclude-newer` still leaves open (Jody, ADR-0008).

## Done

Filled in when the build is finished, before sign-off.

- Build commit: <sha>
- Marketplace clone commit used by the live check: <sha>
- Checks run: <each command with its real result>
- AC1: <pass or fail, with what was observed>
- AC2: <pass or fail, with what was observed>
- AC3: <pass or fail, with what was observed>
- AC4: <pass or fail, with what was observed>
- AC5: <pass or fail, with what was observed>
- AC6: <pass or fail, with what was observed>
- AC7: <pass or fail, with what was observed>
- AC8: <pass or fail, with what was observed>
- AC9: <pass or fail, with what was observed>
- AC10: <pass or fail, with what was observed>
- AC11: <pass or fail, with what was observed>
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0008 from `proposed` to `accepted`.

## Departures from plan

- Step 0, 2026-10-28, in scratch `UV_TOOL_DIR` and `UV_TOOL_BIN_DIR` with uv 0.11.7 (results in the session scratchpad `speckit-step0/RESULTS.md`):
  - The pinned install works as written; `direct_url.json` sits under `<tool dir>/specify-cli/lib/python*/site-packages/specify_cli-1.2.4.dist-info/`, so detection globs `lib/python*`; `url` has no `git+` or `@rev`; `vcs_info.commit_id` is the pin; there is exactly one dist-info folder.
  - `uv-receipt.toml` stores `exclude-newer` and the `rev`, so detection also matches both to the row; `uv tool upgrade` and `uv tool upgrade --all` change nothing.
  - Reinstalling a different commit, then the pin, replaces the install without `--force`; at the pin the argv is a no-op.
  - `specify init` exits 1 with nothing written when `claude` is not on `PATH`; the `spec-kit` row adds `--ignore-agent-tools` since it already names `--integration claude`.
  - `init` writes 30 files (10 `.claude/skills/speckit-*/SKILL.md` and 20 under `.specify/`), nothing outside the repo, no `.claude/settings.json`; every core skill carries one `disable-model-invocation: true`.
  - Across three repos 27 of the 30 files are byte-identical; the two `.specify/integrations/*.manifest.json` files and `workflows/workflow-registry.json` differ only in timestamps, so R20 pins the skills, scripts, templates and `workflow.yml` (22 files, see the next bullet); no repo path, name or user name appears in any file. The Linux run was not done.
  - `specify integration upgrade claude` does not stop on an edited script: it exits 0, keeps the edit, names it and rewrites a manifest timestamp. An edited skill stops it with exit 1. The update never passes `--force`, so an edited script stays and the R20 hash check reports it.
  - `specify integration uninstall claude` removes unedited skills, keeps and names an edited one and leaves `.specify/`; `--force` must be given on the first run because a second run errors "not installed".
  - Build, 2026-10-28: the registry row holds `pinnedFiles` for 22 files (10 skills, 6 scripts, 5 templates and `.specify/workflows/speckit/workflow.yml`), checked with two fresh repos that gave identical hashes.
    The 27 identical files include the constitution, `integration.json`, `init-options.json`, `.specify/.gitignore` and `.constitution-template.json`, which are not pinned.
  - A new `knownUnpinned` field on the `spec-kit` row lists the two integration manifests and `workflow-registry.json`; `tests/check.mjs` validates it (repo-relative, no `..`, under `.specify/`).
    `.specify/workflows` is on the surface list that `/pro-dev check` reports, so the workflows answer is: `workflow.yml` is pinned and `workflow-registry.json` is known-unpinned and anything else under `.specify/workflows` is reported.
  - `update` also runs the clean-tree and symlink gates, because the `writesRepo` check sits before any argv for install and update alike.
  - The method name in `sdlc-method.json` is `pro-speckit`, not `spec-kit` as spec R12 said, so the needs line in the hand-offs names the plugin.
  - The core skill names are hardcoded in `pro-dev.py` (`SPEC_KIT_CORE`); ADR-0008 says a pin move that renames commands updates that list.
  - The checks-and-docs builder ran `git stash` by mistake; the stash was reverted and nothing was lost.

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.
