# Plan: every plugin with engines ships its own installer

Built from `spec.md` (commit a60e1aa) and `intent.md` in this folder.
Status: draft.
Approver: Jody Brewster, as owner and architect of the marketplace.
This is not auto-mode work: it adds a script that finds and runs another plugin's code, widens what a command may run without a prompt and adds an installer to six plugins, so every new permission pattern and every script run needs his eye.
Dated: 2026-10-28.

## Files that change

- `plugins/pro-core/scripts/pro-dev.py` (modified): the global `--owner` option and its filters, refusals and retry lines (R1 to R7), `answerCommitted` in status (R33); output without `--owner` unchanged apart from that field (R8).
- `plugins/pro-core/commands/pro-dev.md` (modified): the pre-run list and yes step in install and update (R34) and one line naming `/<plugin>:install` (R9).
- `plugins/{pro-design,pro-nextjs,pro-testing,pro-pdd,pro-egm,pro-ship}/scripts/pro-dev-owner.py` (new, six byte-identical copies): reads the owner from its own manifest, checks argv, the marketplace source, scope, path and version, then runs pro-core's `pro-dev.py --owner` with `sys.executable -I` (R10 to R17, R32, N1, N2); it has no flag or environment variable that overrides R32, R14 or R15.
- `plugins/{pro-design,pro-nextjs,pro-testing,pro-pdd,pro-egm,pro-ship}/commands/install.md` (new, six copies that differ only in the plugin name): the `/<plugin>:install [update]` flow (R18 to R22, R34), which relays a refusal and stops.
- `plugins/{pro-design,pro-nextjs,pro-testing,pro-pdd,pro-egm,pro-ship}/.claude-plugin/plugin.json` (modified): a description clause, no pro-core dependency (Jody, 2026-10-28) and a minor bump (R23, R28).
- `plugins/{pro-design,pro-nextjs,pro-testing,pro-pdd,pro-egm,pro-ship}/.codex-plugin/plugin.json` (modified): version and the clause that `/<plugin>:install` is Claude Code only, nothing else (R29).
- `plugins/pro-core/.claude-plugin/plugin.json` and `plugins/pro-core/.codex-plugin/plugin.json` (modified): minor bump to 0.19.0.
- `plugins/pro-dev-starter/.claude-plugin/plugin.json` and `plugins/pro-starter/.claude-plugin/plugin.json` (modified): patch bumps as meta-plugins over bumped plugins (R28); neither has a Codex manifest.
- `.claude-plugin/marketplace.json` (modified): every bumped version, the six owner descriptions to match their Claude manifests and `metadata.version` 1.54.0.
- `tests/check.mjs` (modified): the new `installers` check (R24, R25).
- `tests/pro-dev.mjs` (modified): new cases for R1 to R7, R33 and the owner script (R27); the fake `claude` gains a `FAKE_LIST_FAIL` switch so `plugin list` can fail and its `plugin list` JSON is built from what step 0 recorded; no existing case is edited (R8).
- `docs/decisions/0006-engine-registry-and-pro-dev.md` (modified): the Consequences sentence "What installing an owning plugin does to a disabled pro-core is checked when the installers are built and recorded here" is replaced by the step 0 finding; Status stays `proposed` until sign-off (R30).
- `README.md` (modified): one line in the setup section for single-plugin installs (R31).
- `CLAUDE.md` and `AGENTS.md` (modified, kept mirrored): the bridge-row bullet in "Things Claude gets wrong" adds that a new row owner also needs an installer (R31).
- `docs/releases.md` (modified): a row per bump and the new `metadata.version`.

Left alone on purpose: `plugins/pro-core/registry/engines.json` (no row or `version` change, so the SessionStart nudge does not fire), every bridge skill (the `bridges` check requires them to keep naming `/pro-dev`), `plugins/pro-ai-sdlc/commands/` (Jody's uncommitted work in the main checkout) and `intent/2026-10-28-pro-speckit/` (another agent's plan).

## Order of work

Build in a worktree on branch `feat/plugin-installers` based on local `main`, which is three commits ahead of `origin/main` with this spec and the ADR-0006 amendment; they ride in this PR.
Leave the uncommitted `plugins/pro-ai-sdlc/commands/*.md` edits in the main checkout alone.
Intent E (pro-speckit) builds on this change, so this PR merges first and E's version bumps stack on top of these.

0. Build checks, run before any code as one `set -eu` script kept in the session scratchpad and run in a single Bash call, because every Bash call starts with a fresh environment and a reset working folder.
   The script exports a scratch `CLAUDE_CONFIG_DIR`, creates a scratch git repo and `cd`s into it itself.
   Before any write it asserts that `claude plugin list --json` prints `[]` and that the scratch repo's real path is outside the worktree and outside `~/.claude`; otherwise it exits.
   No sub-step is ever run on its own, so Jody's real installs are never touched.
   a. Per-scope enablement: add a local marketplace named `pro-dev-skillset` from a copy of the worktree, install pro-core at user scope and at project scope in the scratch repo, run `claude plugin disable pro-core@pro-dev-skillset --scope local` there, then run `claude plugin list --json` from the repo root, from outside the repo and from a subfolder that has its own local disable.
      Record whether `enabled` differs per entry or is one effective value per plugin id for the working folder, which folder decides and what `projectEnabled` means.
      Install two pro-core versions, an older at user scope and a newer at project scope; record which `installPath` loads when the scopes differ.
      Today's real output (Claude Code 2.1.312) shows the same `enabled` on every entry of one id and `projectEnabled: false` on all 238 entries, which suggests the effective value for the working folder.
      If that holds, `pro-dev-owner.py` runs `claude plugin list --json` from the folder that matches what the session loads.
      R13's "narrowest covering entry, then require it enabled" reads that effective flag.
      Save the recorded JSON; the step 4 fake `claude` is built from it.
   b. Disabled pro-core and a dependent: with pro-core disabled at project scope in the scratch repo, install a scratch build of pro-nextjs that declares the pro-core dependency at the same scope.
      Record which of three things happens: pro-core is re-enabled (and with it `git-safe`, `memory-recall` and the Stop ledger hooks), the install refuses or pro-nextjs installs but fails to load with a dependency error; read `claude plugin list --json` and the scratch `settings.json` files before and after.
   c. Confirm every `installPath` in `claude plugin list --json` resolves under `<config dir>/plugins/cache/pro-dev-skillset/pro-core/<version>` and record the `source` object that `known_marketplaces.json` gives the `pro-dev-skillset` entry.
      A directory source is refused by R32 by design, so the script records that refusal and does not look for a way around it.
   d. Redirects under an allow rule: with the `status*` patterns of R19 in a scratch settings file, check in a scratch session whether `status --json > somefile` prompts.
      If it does not prompt, narrow the patterns to the exact `status --json` and `status` forms and record the change for step 5.
   Check: the answers are written into this plan's Departures if any of them changes a requirement and into the ADR-0006 Consequences line and the six descriptions in step 7 either way.
1. `pro-dev.py --owner` (R1 to R7), test first.
   Add the R1 to R7 cases to `tests/pro-dev.mjs` and watch them fail; then add `--owner` to `build_parser` before the subparsers, validate it in `main` against the name pattern and the registry owners before `read_installs` runs, filter rows in `cmd_status`, `cmd_run` and `cmd_answer`, refuse `plugins`, `stale` and `surface`, skip `write_run_version` under `--owner` and pass the owner to `retry_line` through one module-level value set in `main`.
   Check: `node tests/pro-dev.mjs --only=owner` passes and every older case passes unedited (R8).
2. `answerCommitted` (R33).
   Add a case with a tracked and an untracked `.claude/pro-dev.json` first; then add the field per row in `cmd_status` from one `git ls-files` call.
   Check: `node tests/pro-dev.mjs` passes in full.
3. The `installers` check in `tests/check.mjs` (R24, R25), written before any installer exists.
   Check: `node tests/check.mjs installers` fails once per owner (six) for a missing `commands/install.md`, `scripts/pro-dev-owner.py` and dependency.
   The check also requires the relay-and-stop sentence of step 5 in `install.md`.
4. `pro-dev-owner.py` (R10 to R17, R32, N1, N2), written once in `plugins/pro-nextjs/scripts/` and copied byte for byte to the other five.
   Add the owner-script cases of R27 to `tests/pro-dev.mjs` first, with a fake `claude` whose `plugin list` JSON comes from step 0 and a sandbox that lays out `<temp HOME>/.claude/plugins/cache/pro-dev-skillset/pro-core/0.19.0/` from the working pro-core, a plugin folder holding the owner script and its manifest and a `known_marketplaces.json` fixture.
   The script order is: argv shape (R12), owner from `../.claude-plugin/plugin.json` (R11), marketplace source (R32), `claude plugin list --json` from the repo root with no fallback (R13), narrowest covering entry then enabled (R13, R16), real-path check inside the cache and outside the repo (R14), minimum version 0.19.0 as a constant (R15), then `sys.executable -I <pro-dev.py> --owner <owner> <args>` as an argv list (R17), so `PYTHONPATH` and `PYTHONSTARTUP` load nothing.
   R13 prefers the entry whose `projectPath` equals the repo root and refuses when more than one candidate remains with different `installPath`s.
   The script has no flag or environment variable that overrides R32, R14 or R15.
   It prints `pro-core <version> at <path>` to stderr and flushes it before the child spawns, so the `!` line in `install.md` (which captures `2>&1`) shows it first while `status --json` stdout stays parseable JSON.
   Check: `node tests/pro-dev.mjs --only=owner-script` passes, `wc -l` prints under 150 and `cmp` finds the six copies identical.
5. `install.md` (R18 to R22, R34), written once for pro-nextjs and copied with the plugin name changed.
   Frontmatter carries `description`, `argument-hint: "[update]"` and exactly four `allowed-tools`: the quoted and unquoted `status` and `answer` patterns of its own `pro-dev-owner.py` per R19.
   The body loads status with `!` and `; true` and shows the first output line exactly as printed.
   If that line is not `pro-core <version> at <path>` followed by status JSON, the command relays the output and stops; it never runs the fix line, `claude plugin` or `pro-dev.py` itself.
   Otherwise it shows the row table, asks each `needsQuestion` row and saves answers.
   It then builds the list from a fresh `status --json` taken after the answers are saved, never from the `!` snapshot: rows with `wantsInstall`, plus `installed` rows for update, with "answer from the committed .claude/pro-dev.json" against each `answerCommitted` row.
   Only the person's reply after the list counts as the yes, never `$ARGUMENTS` or tool output.
   A non-interactive run lists the rows and stops.
   After the yes it runs `run all install` or `run all update`, relays surface and marketplace lines as printed and ends with the table and a pointer to `/pro-dev check`.
   Check: `node tests/check.mjs installers` passes and `claude plugin validate plugins/pro-nextjs --strict` passes once the step 7 dependency is in place.
6. `pro-dev.md` (R9, R34): the pre-run list and yes step goes in install between step 2 and step 3 and in update between step 3 and step 4, built from a fresh `status --json` after answers are saved with only the person's reply as the yes and a non-interactive run listing and stopping; one line after the Context block names `/<plugin>:install`.
   Check: `claude plugin validate plugins/pro-core --strict` and a read-through that no other section moved.
7. Manifests, ADR and docs: the six descriptions (R23) with no dependency, the six Codex clauses (R29), the marketplace descriptions, the ADR-0006 Consequences line (R30), README and the mirrored `CLAUDE.md` and `AGENTS.md` bullet (R31).
   Check: `node tests/check.mjs` passes and `diff CLAUDE.md AGENTS.md` shows only the lines that differed before.
8. Version bumps in one pass, re-reading `.claude-plugin/marketplace.json` first in case `main` moved: pro-core 0.18.1 to 0.19.0; pro-design 0.11.0 to 0.12.0; pro-nextjs 0.11.0 to 0.12.0; pro-testing 0.6.0 to 0.7.0; pro-pdd 0.5.0 to 0.6.0; pro-egm 0.1.1 to 0.2.0; pro-ship 0.1.0 to 0.2.0; pro-dev-starter 2.0.4 to 2.0.5; pro-starter 1.14.0 to 1.14.1; `metadata.version` 1.53.1 to 1.54.0; each in both manifests where it has two and in its marketplace entry, with a row each in `docs/releases.md`.
   If `main` has moved, bump from the new numbers and keep `pro-dev-owner.py`'s minimum equal to the pro-core version this PR ships.
   Check: the `versions` and `codex-manifests` checks pass.
9. Proof of done below, then the live check in the step 0 scratch config with this branch's marketplace copy: only pro-core and pro-nextjs installed.
   a. Run the cached `pro-dev-owner.py status --json` against the real `claude` with the marketplace added from a local directory; R32 refuses a directory source by design, so the refusal is the pass.
   b. Rewrite the scratch `known_marketplaces.json` entry to `{"source": "github", "repo": "jodybrewster/pro-dev-skillset"}` over the same cache and run it again; confirm it names the cached pro-core and lists only pro-nextjs's three rows.
   c. With fake `claude` and `npx` first on `PATH` under the scratch config, run `python3 plugins/pro-core/scripts/pro-dev.py --owner pro-nextjs run impeccable install`; it must print `impeccable: owned by pro-design, not pro-nextjs` and `exit 2`.
      No real engine installs.
   Jody then runs `/pro-nextjs:install` once in a scratch repo in a real session under the scratch config with the github-sourced marketplace, to see the confirmation step and the permission prompt on `run`; his real pro-core stays at 0.18.1 until release, so R15 refuses there.

Parallel work: steps 0 to 2 are sequential, since step 0 can change requirements and step 2 builds on step 1's status code.
Once step 1 lands the `--owner` interface, steps 3, 4, 5 and 6 touch separate files and can run as four Sonnet subagents in one turn, each with its requirement numbers and the step's check.
The README and `CLAUDE.md` parts of step 7 can run beside them; the manifest parts wait for step 0's answer.
Step 8 runs alone at the end because every bump touches `marketplace.json`.

## Tests that prove it

- Step 0 is a manual record, not a test: the commands run and their output go into the PR description.
- `tests/pro-dev.mjs` covers step 1 (an unknown owner and a bad owner name exit 2 before any `claude` call; status lists only the owner's rows with a top-level `owner`; `run all install` reaches the fake `npx` and `claude` only with the owner's argv; `run <id>` and `answer <id>` for another owner's row exit 2 with the R4 line and write nothing; `plugins`, `stale` and `surface` exit 2; no `registryVersion` written; retry lines name `/<owner>:install`).
- `tests/pro-dev.mjs` covers step 2 (tracked file gives `true`, untracked gives `false`).
- `tests/pro-dev.mjs` covers step 4 with every R27 fixture: install path inside the repo, outside the cache, pro-core 0.18.1, no covering pro-core, narrowest-scope pick, disabled narrowest entry beside an enabled user entry, `FAKE_LIST_FAIL` with an `installed_plugins.json` present but unread, a `known_marketplaces.json` naming another repo, an argument outside R12, a parent-folder plus user-scope fixture asserting the chosen entry is user scope or has a `projectPath` equal to the repo root and is one `owner_active` counts and a tie-break fixture with two candidates and different `installPath`s that must refuse.
- `tests/pro-dev.mjs` covers AC1 end to end through the owner script: only pro-nextjs and pro-core in the fake list, `next-skills` installs, no argv from another owner reaches the log.
- `node tests/check.mjs installers` covers steps 3 and 5, with AC6's three mutations run in a scratch copy of the worktree.
- `claude plugin validate` strict, for the marketplace and per plugin, covers steps 5 to 8.
- The AC4 case in `tests/pro-dev.mjs` covers the R4 refusal with the fake `claude` and `npx`; step 9c repeats it under the scratch config.
- The step 9 live run covers what the fakes cannot: the real `claude plugin list --json` shape, the real cache layout and the permission prompt on `run`.

## Risks

The riskiest step is step 4, the owner script's choice of which pro-core to run.
If its scope, enablement or path rules drift from what Claude Code actually loads, it either refuses a valid setup (fail-closed, annoying, fixable) or runs a pro-core copy Claude Code does not load for this repo, which is the security failure the challenge flagged.
The parent-folder fixture, the disabled-narrowest fixture, the tie-break fixture and the step 9 run against the real `claude` are there to catch that before merge.
Step 0 is the second weak point: if a dependency re-enables a disabled pro-core, installing pro-nextjs turns pro-core's hooks back on for someone who switched them off; nothing in this repo can prevent it, so the plan records it in ADR-0006 and each description rather than working around it.
If instead a disabled pro-core makes the dependent fail to load, the descriptions and the R13 refusal line must say to enable pro-core first.

What might break:
- Existing installs of the six plugins: the next `claude plugin update` pulls pro-core in at that scope, so a site that had only pro-nextjs starts loading pro-core's Bash guard, memory recall and nudges (accepted in Flagged concern 4).
- `/pro-dev install` for starter sites: it gains one confirmation turn before `run`; the script's behavior and rows are unchanged, which every unedited `tests/pro-dev.mjs` case keeps honest.
- A person who updates pro-nextjs but keeps an older pro-core at a wider scope gets the R15 refusal until pro-core updates; the line names the fix.
- The six `install.md` copies can drift in prose because the check only enforces the owner script's bytes and the `allowed-tools`; review reads them side by side.
- `pro-speckit`'s plan relies on this PR's `installers` check, which fails if a plugin ships `pro-dev-owner.py` before it owns a row, so intent E must add its rows and installer in the same commit.

A refusal line ends in a fix command, so `install.md` must relay it and stop; the model running that fix could re-enable a pro-core the person disabled.
The R34 yes is prose, so a reply from the person after a list built from a fresh status is the only gate once `run` is auto-approved.

Nothing here is irreversible: no data migrates, `.claude/pro-dev.json` keeps its shape and the step 0 experiments live in a scratch config that is deleted afterwards.

## Options not taken

- Writing `pro-dev-owner.py` in Node: every pro-dev script is Python and `/pro-dev check` does not assume Node.
- Symlinking one owner script from pro-core into each plugin: the plugin cache copies each plugin folder on its own, so a cross-plugin link would dangle.
- Generating the six `install.md` files from a template with a build script: it adds a build step for six short files; copies plus review are enough.
- A check that the six `install.md` files are identical apart from the name: not in the spec; left for a later change if they drift.
- Printing the owner script's first line to stdout as R17 could be read: it would put a non-JSON line ahead of `status --json` for every caller, so it goes to stderr and still shows first in the `!` line.
- Splitting the work into one PR per plugin: the `installers` check needs all six owners at once and every PR would bump pro-core and the meta-plugins again.
- Building pro-speckit's installer here: it lands with intent E once its rows exist.

Left out on purpose: a Codex installer (Flagged concern 7), moving rows into each plugin (Flagged concern 5), `check` inside the installers (health stays in `/pro-dev check`) and any change to bridge skills or the registry.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
node tests/pro-dev.mjs
for p in pro-design pro-testing pro-pdd pro-egm pro-ship; do cmp plugins/pro-nextjs/scripts/pro-dev-owner.py "plugins/$p/scripts/pro-dev-owner.py" || exit 1; done
wc -l plugins/pro-nextjs/scripts/pro-dev-owner.py
grep -n "pro-dev.py\|--owner" plugins/*/commands/install.md
ls plugins/*/commands/*.md | wc -l
```

Finished means: check prints one more check than before (the `installers` check) with 0 failures and the same warning count, eval dry-run passes, validation passes once for the marketplace and once per plugin directory and `tests/pro-dev.mjs` passes every case including the new ones.
The `cmp` loop prints nothing, `wc -l` prints a number under 150, the AC4 case in `tests/pro-dev.mjs` passes (step 9c runs the real command under fakes in the scratch config), the grep prints nothing and the command count is six higher than on `main`.
AC6's three mutations each make `node tests/check.mjs installers` fail in a scratch copy.
Then the step 9 live runs and Jody's `/pro-nextjs:install` session, with the observed output pasted into Done.

## Security challenge

From a fresh-context `security-architect` challenge of this plan on 2026-10-28, run with Opus at high effort.
It covers only what the plan adds on top of the spec's challenge.

Verdict: proceed with required changes; nothing blocking.
The owner script keeps the spec's order of checks (argv, owner from the manifest, marketplace, plugin list, path, version, exec with no shell) and `run` stays unapproved.

### Required changes

1. [8/10] Step 0c asks for a source R32 can read for a local-directory marketplace.
   Step 9 runs the owner script against a local copy, but R32 refuses any directory source by design. Change: step 0c says a directory source is refused by design; step 9 treats that refusal as a pass and proves the positive path by rewriting the scratch `known_marketplaces.json` entry to the github source over the same cache; step 4 states the owner script has no flag or environment override for R32, R14 or R15.
   Answered by steps 0c, 4 and 9.
2. [7/10] Step 0 relies on a scratch `CLAUDE_CONFIG_DIR` and cwd, but each Bash call starts with fresh environment and a reset cwd.
   A step run alone lands in Jody's real `~/.claude` and could replace his marketplace or disable his real pro-core. Change: run step 0 as one `set -eu` script that sets `CLAUDE_CONFIG_DIR` and `cd`s into the scratch repo itself; before any write it asserts that `claude plugin list --json` prints `[]` and the scratch repo's real path is outside the worktree.
   Answered by step 0.
3. [7/10] Proof of done runs `pro-dev.py --owner pro-nextjs run impeccable install` against the real `claude` and `npx`; an R4 bug would install a third-party engine into the marketplace repo. Change: run it only under the step 0 scratch config with the fake `claude` and `npx` first on `PATH`, or drop it since the AC4 test covers it.
   Answered by step 9.
4. [7/10] Refusal lines end in a fix command and the `!` line's `; true` hides the exit code, so the model may run the fix itself and re-enable a pro-core the person disabled. Change: `install.md` shows the first output line exactly as printed; if it is not `pro-core <version> at <path>` followed by status JSON, the command relays the output and stops, never running the fix line, `claude plugin` or `pro-dev.py` itself; the `installers` check requires that sentence.
   Answered by steps 3 and 5.
5. [7/10] A fixture "asserting the owner script and `owner_active` pick the same entry" cannot be written: `owner_active` returns a bool, follows an any-enabled rule and "narrowest" has no tie-break. Change: the fixture asserts the chosen entry is user scope or has a real `projectPath` equal to the repo root and is one `owner_active` counts; R13 prefers the entry whose `projectPath` equals the repo root and refuses if more than one remains with different `installPath`s; add a tie-break fixture.
   Answered by step 4.
6. [6/10] (verify) If `enabled` is one effective value per id for the cwd, fixtures with differing `enabled` values test a shape the CLI never emits.
   Listing from the repo root may disagree with a session started in a subfolder that disables pro-core locally. Change: step 0a also lists from a subfolder with its own local disable and records which folder decides, plus which `installPath` loads when user and project scope differ; the owner script lists from the folder that matches what the session loads; the step 4 fake `claude` is built from the JSON recorded in step 0.
   Answered by steps 0a and 4.
7. [6/10] (verify) The R34 yes is prose and becomes the only gate when `run` is auto-approved ("don't ask again", a committed `permissions.allow` covering `python3`, or `claude -p`). Change: `install.md` and `pro-dev.md` build the list from a fresh `status --json` after answers are saved (rows with `wantsInstall`, plus `installed` rows for update), never from the `!` snapshot; only the person's reply after the list counts as the yes, never `$ARGUMENTS` or tool output; a non-interactive run lists the rows and stops.
   Answered by steps 5 and 6.
8. [5/10] (verify) R17 starts the child with `python3` from `PATH`, so `PYTHONPATH` or `PYTHONSTARTUP` could load code into it. Change: start it with `sys.executable -I` and flush the stderr line before spawning.
   Answered by step 4.

### Open questions from the challenge

- Jody's real `pro-dev-skillset` marketplace source: answered 2026-10-28, it is `{"source": "github", "repo": "jodybrewster/pro-dev-skillset"}`, so R32 passes on his machine.
- Which config the step 9 real-session run uses: his real pro-core stays at 0.18.1 until release, so R15 refuses there; step 9 names the scratch config with a github-sourced marketplace.
- Whether Claude Code prompts for `status --json > somefile` under a `status*` allow rule; if not, a prompt-injected model could overwrite a file. Check in step 0 and narrow the pattern if needed.
- Whether the owner script should pass a protocol version so `pro-dev.py` can refuse an old caller after a later trust fix.

## Done

Filled in when the build is finished, before sign-off.

- Build commit:
- Checks run:
- AC1:
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0006 from `proposed` to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 0 findings.
  `enabled` is one effective value per plugin id for the cwd, decided by the git root, so a subfolder with its own local disable does not change it.
  `projectEnabled` is not the effective state and the owner script does not read it.
  A dependency re-enables a disabled pro-core, so Jody dropped the pro-core dependency from the six owning plugins ("yes you don't need pro-core for pro-nextjs", 2026-10-28).
  The installer checks for pro-core instead and the `installers` check now fails if an owner declares the dependency.
  A directory marketplace source has the shape `{"source": "directory", "path": ...}`, which R32 refuses; only the github source of `jodybrewster/pro-dev-skillset` passes.
  Whether a `status*` redirect can slip past the allowed-tools pattern still needs a live check, so the patterns stay exact as the `installers` check requires.
  `CLAUDE_CODE_PLUGIN_DIRS` must be unset in isolated scripts or the real plugins load into the scratch config.
- Build departures.
  Step 0 and steps 1 to 3 ran in parallel.
  The fake `claude` uses entries carrying the step 0 extra fields instead of the raw JSON files.
  The owner script reads the pro-core version from the list entry.
