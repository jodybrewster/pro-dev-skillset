---
intent: intent/2026-10-28-plugin-installers/intent.md
intent-status: proposed
status: draft
created: 2026-10-28T14:12:03-0400
author: the maintainer
---

# Spec: every plugin with engines ships its own installer

Built from `intent.md` in this folder (commit 4c11870).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `RELEASING.md`, `docs/codex-parity.md`, `docs/decisions/0006-engine-registry-and-pro-dev.md`, `docs/decisions/0007-spec-method-plugins.md` and the sibling spec `intent/2026-10-28-pro-speckit/spec.md` (R26 and Flagged concern 2).
Code read to ground the design: `plugins/pro-core/scripts/pro-dev.py` (`build_parser`, `read_installs`, `owner_active`, `engine_state`, `run_engine`, `retry_line`, `cmd_status`, `cmd_run`, `cmd_answer`, `write_run_version`), `plugins/pro-core/commands/pro-dev.md` (its `allowed-tools` and how it relays `status` and `run`), `plugins/pro-core/registry/engines.json` (19 rows, registry `version` 3), every `plugins/*/.claude-plugin/plugin.json` (only `pro-dev-starter` and `pro-starter` declare dependencies today), `tests/check.mjs` (the `registry`, `bridges` and `agents` checks) and `tests/pro-dev.mjs` (the fake `claude` and `npx` harness).
No `DESIGN.md`, `SECURITY.md` or compliance skill under `.claude/skills/` exists in this repo.

## Summary

Each plugin that owns rows in `plugins/pro-core/registry/engines.json` ships one command, `/<plugin>:install`, that installs or updates that plugin's engines and no others.
Today that is pro-design, pro-nextjs, pro-testing, pro-pdd, pro-egm and pro-ship, plus pro-speckit when it ships.
The command runs a small identical script in its own plugin, `scripts/pro-dev-owner.py`, which finds pro-core's installed `pro-dev.py` in the Claude Code plugin cache, refuses any other location and calls it with `--owner <plugin>`, the plugin name read from the script's own manifest.
`pro-dev.py` gains that `--owner` filter so status, answers and runs touch only the named owner's rows; every pin, surface check, `gitExclude`, marketplace check and saved answer stays in the one script.
No owning plugin declares a dependency on pro-core, because installing a dependent silently re-enables a pro-core the person disabled (plan step 0). `/<plugin>:install` needs pro-core installed and enabled and otherwise prints one line saying so and stops.
Before any run, both `/<plugin>:install` and `/pro-dev` list every row that will install, mark the answers that came from the committed `.claude/pro-dev.json` and wait for a yes in the conversation.
Apart from that confirmation, `/pro-dev install`, `update` and `check` behave exactly as today and a site on `pro-dev-starter` still has one step.
A person who installs only pro-nextjs runs `/pro-nextjs:install` and gets its engines and nothing else.
Codex users get no new command; their path stays the per-bridge manual commands.

## Requirements

### Functional

- R1. `pro-dev.py` accepts a global option `--owner <name>` before the subcommand; `<name>` must match `^[A-Za-z0-9][A-Za-z0-9._-]*$` and be the `owner` of at least one registry row, else the script prints `unknown owner: <name>` and exits 2 without reading installs. (intent: "`plugins/pro-core/scripts/pro-dev.py` (a way to run one owner's rows)")
- R2. With `--owner X`, `status` (text and `--json`) lists only rows whose `owner` is X in `engines` and adds a top-level `owner` field set to X; every other field is unchanged. (intent: "sets up only its own engines")
- R3. With `--owner X`, `run all install` and `run all update` act only on rows owned by X, in registry file order, with the same install, update, skip, surface and marketplace rules as the unfiltered run. (intent: "All installers run the same rows through the same `pro-dev.py`, so pins, surface checks, `gitExclude`, marketplace checks and saved answers stay in one place")
- R4. With `--owner X`, `run <id> ...` and `answer <id> ...` for a row owned by another plugin print `<id>: owned by <owner>, not <X>` and exit 2 without running or writing anything. (intent: "an installer runs rows it does not own" must fail)
- R5. With `--owner`, the `plugins`, `stale` and `surface` subcommands print `not available with --owner; use /pro-dev` and exit 2. (intent: "sets up only its own engines")
- R6. A run with `--owner` does not write `registryVersion` to `.claude/pro-dev.json`; the SessionStart nudge that compares it must still fire for rows another owner gained.
  Answers it saves go to the same file and key as `/pro-dev install`. (intent: "`/pro-dev check` sees engines installed by either path"; "saved answers stay in one place")
- R7. With `--owner X`, every retry line the script prints names `/X:install` (or `/X:install update` for an update) instead of the absolute `pro-dev.py` path. (intent: "someone who installs one plugin on its own ... has to know that the setup lives in a different plugin")
- R8. Without `--owner`, `pro-dev.py` output and exit codes are unchanged for every subcommand apart from the `answerCommitted` field of R33; every existing case in `tests/pro-dev.mjs` passes unedited. (intent: "With pro-dev-starter installed, `/pro-dev install` sets up everything, as today")
- R9. `plugins/pro-core/commands/pro-dev.md` keeps its sections, `allowed-tools` and flows; it gains the pre-run confirmation of R34 and one line saying each owning plugin also has `/<plugin>:install`. (intent: "A site on `pro-dev-starter` keeps one step"; Security challenge item 3)
- R10. Each owning plugin ships `scripts/pro-dev-owner.py`, byte-identical across plugins, using only `python3` and its standard library. (intent: "All installers run the same rows through the same `pro-dev.py`")
- R11. `pro-dev-owner.py` reads its owner name from `../.claude-plugin/plugin.json` relative to its own file and never takes an owner from its arguments or the environment. (intent: "sets up only its own engines")
- R12. `pro-dev-owner.py` accepts exactly these argument shapes and exits 2 on anything else: `status --json`, `answer <id> yes|no` (id matching the registry id pattern), `run all install` and `run all update`. (constraint: "Each installer's `allowed-tools` holds only the exact `pro-dev.py` pattern it runs")
- R13. `pro-dev-owner.py` finds pro-core only from `claude plugin list --json`.
  It finds the repo root by exactly `pro-dev.py`'s `find_repo` rule (the real path of `git rev-parse --show-toplevel`, else of the working directory) and keeps entries with id `pro-core@pro-dev-skillset` that pass exactly `covers_repo` (user scope, or a `projectPath` that is the repo root or inside it).
  It picks the narrowest covering entry first, local then project then user, then requires that entry to be enabled; a disabled narrowest entry prints `pro-core is disabled for this repo; enable it with claude plugin enable pro-core@pro-dev-skillset` and exits 2 without looking at wider scopes.
  When `claude` is missing or fails, it does not read `installed_plugins.json` or guess; it prints `cannot read plugin installs: claude plugin list --json failed; run it to see why` and exits 2. (constraint: "A plugin's installer needs pro-core's script"; Security challenge items 1 and 2)
- R14. `pro-dev-owner.py` runs the found `scripts/pro-dev.py` only when its real path is a regular file inside the real path of `<config dir>/plugins/cache/pro-dev-skillset/pro-core/` and outside the repo root; otherwise it prints the path it refused and why and exits 2. (constraint: "Engines still install only when a person runs a command"; security policy in `REVIEW.md` Pass 2)
- R15. `pro-dev-owner.py` refuses a pro-core older than the first version that ships `--owner` (a constant in the script), printing `pro-core <found> is older than <min>; update it with /pro-dev update or claude plugin update pro-core@pro-dev-skillset` and exiting 2. (constraint: "A plugin's installer needs pro-core's script")
- R16. When no pro-core entry covers the repo under R13, `pro-dev-owner.py` prints `pro-core is not installed for this repo; install it with claude plugin install pro-core@pro-dev-skillset` and exits 2. (decided 2026-10-28)
- R17. `pro-dev-owner.py` runs `python3 <pro-dev.py> --owner <owner> <args>` as an argv list with no shell, passes stdin, stdout and exit code through and prints the pro-core path and version it chose on its first line. (intent: "pins, surface checks, `gitExclude`, marketplace checks and saved answers stay in one place")
- R18. Each owning plugin ships `commands/install.md`, invoked as `/<plugin>:install`, taking an optional argument `update`; with no argument it installs, with `update` it updates. (intent: "ships one `/<plugin>:install` command"; Open question 2)
- R19. `install.md`'s `allowed-tools` lists only the `status` and `answer` patterns of its own `pro-dev-owner.py`, quoted and unquoted, in the form `Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev-owner.py" status*)`; `run` is not pre-approved and prompts as `/pro-dev`'s `run` does. (constraint: "Each installer's `allowed-tools` holds only the exact `pro-dev.py` pattern it runs"; Flagged concerns 2 and 3)
- R20. `install.md` loads status with a `!` line through `pro-dev-owner.py status --json`, shows the plugin's rows with their state, asks each row with `needsQuestion` true one at a time with its `id` and `why`, saves each reply through `pro-dev-owner.py answer`, confirms per R34, runs `pro-dev-owner.py run all install` (or `run all update`) and shows the row table again. (intent: "sets up only its own engines")
- R21. `install.md` relays the surface line, any `surface beyond the pin` line and any marketplace line exactly as printed, never installs a refused row another way and never runs an engine argv by hand, matching `/pro-dev install` step 3. (intent: "pins, surface checks ... stay in one place")
- R22. `install.md` does not update plugins, swap the starter, remove stale installs or set the repo up for the loop; it ends by naming `/pro-dev check` for a full health check. (intent: "sets up only its own engines")
- R23. pro-design, pro-nextjs, pro-testing, pro-pdd, pro-egm and pro-ship declare no pro-core dependency in `.claude-plugin/plugin.json`.
  Plan step 0 found that installing a plugin that depends on pro-core silently re-enables a disabled pro-core, with its `git-safe`, `memory-recall`, session-start and Stop hooks.
  Decided 2026-10-28: pro-nextjs needs no pro-core dependency.
  Each description says `/<plugin>:install` sets up its engines when pro-core is installed. (Flagged concern 4)
- R24. `tests/check.mjs` gains an `installers` check that fails when a registry `owner` has no `commands/install.md` or no `scripts/pro-dev-owner.py`, when that plugin's manifest lacks the pro-core dependency, when any `pro-dev-owner.py` differs from the others byte for byte or when a plugin ships `scripts/pro-dev-owner.py` but owns no row. (intent: "`tests/check.mjs` fails when a plugin owns a registry row but ships no installer")
- R25. The `installers` check fails when an `install.md` `allowed-tools` entry is anything other than R19's patterns, when its body names `pro-dev.py` directly, passes `--owner` or names a `run <id>` whose id another plugin owns. (intent: "or when an installer runs rows it does not own")
- R26. The pro-speckit installer of `intent/2026-10-28-pro-speckit/spec.md` R26 and R27 (`/pro-speckit:install` and `/pro-speckit:install update`, running pro-speckit's own `pro-dev-owner.py`) follows R10 to R23 and R34 and is covered by R24 and R25 once its rows land; its `/pro-speckit:remove` (that spec's R28) is a separate command outside R12. (intent: "pro-speckit when intent E ships"; Flagged concern 6)
- R27. `tests/pro-dev.mjs` gains cases for R1 to R7, R33 and for `pro-dev-owner.py`: a refused path inside the repo, a refused path outside the cache, a pro-core below the minimum, no covering pro-core, the narrowest-scope pick, a disabled narrowest entry with an enabled user-scope entry (refused), the failed `claude plugin list` path (refused, no `installed_plugins.json` read), a marketplace source other than R32's (refused), an argument outside R12 and one run where only the owner's rows reach the fake `npx` and `claude` logs.
  One fixture holds a pro-core installed at a parent folder of the repo and one at user scope and asserts that `pro-dev-owner.py` picks the user-scope entry and that `owner_active` agrees with it. (intent: "With only pro-nextjs installed, `/pro-nextjs:install` sets up its engines and nothing else"; Security challenge item 1)
- R28. Every plugin whose files change bumps its version in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and its marketplace entry in the same commit: pro-core (minor), pro-design, pro-nextjs, pro-testing, pro-pdd, pro-egm and pro-ship (minor each), then `pro-dev-starter` and `pro-starter` (patch, as meta-plugins over bumped plugins per `RELEASING.md`) and `metadata.version` once, with a row per bump in `docs/releases.md`. (constraint: "The version-bump law")
- R29. No `.codex-plugin/plugin.json` gains a command or dependency entry; each touched plugin's Codex manifest changes only its `version` and, where its description names setup, a clause that `/<plugin>:install` is Claude Code only. (constraint: "Codex parity")
- R30. ADR-0006 is amended in place per the `ADR needed` line below and its "Enforced by" list names `pro-dev-owner.py`, the `installers` check and `tests/pro-dev.mjs`. (intent Open question 3)
- R31. README's setup section gains a line for single-plugin installs (`/<plugin>:install`, Claude Code only) and `CLAUDE.md`'s "Things Claude gets wrong" bullet on bridge rows adds that a new row owner also needs an installer. (intent: "README and CLAUDE.md")
- R32. Before trusting any pro-core entry, `pro-dev-owner.py` reads `plugins/known_marketplaces.json` under `CLAUDE_CONFIG_DIR` or `~/.claude` and requires the `pro-dev-skillset` entry to have a `github` source whose `repo` equals `jodybrewster/pro-dev-skillset` ignoring case, as `marketplace_trusted` in `plugins/pro-ai-sdlc/scripts/methods.py` does; otherwise it prints `pro-dev-skillset is not the trusted marketplace jodybrewster/pro-dev-skillset; refusing to run its pro-core` and exits 2. (Security challenge open question 1)
- R33. `pro-dev.py status --json` adds `answerCommitted: true` to each row whose saved answer is in a `.claude/pro-dev.json` that `git ls-files` tracks (`false` otherwise); with or without `--owner` the field is the only addition to status output. (Security challenge item 3)
- R34. Before calling `run`, every `/<plugin>:install` and `/pro-dev` (install and update) list every row that will install or update, mark each row whose answer came from the committed `.claude/pro-dev.json` (R33) as "answer from the committed .claude/pro-dev.json" and ask for a yes in the conversation.
  Without that yes they run nothing; `plugins/pro-core/commands/pro-dev.md` carries the same step. (Security challenge item 3)

### Non-functional

- N1. `pro-dev-owner.py` adds at most one `claude plugin list --json` call before `pro-dev.py` runs and stays under 150 lines.
- N2. `pro-dev-owner.py` reads no file from the repo and writes nothing anywhere.
- N3. A second `/<plugin>:install` in a row asks nothing and changes nothing, as `/pro-dev install` does.
- N4. All three verify steps in `CLAUDE.md` pass; `node tests/pro-dev.mjs` passes with the new cases.

### Policy constraints applied

- Version-bump law (ADR-0002): R28 bumps each touched plugin in both manifests and the marketplace, with the meta-plugins and `metadata.version`.
- Hook-loading law (ADR-0003): no hook is added; `pro-dev-owner.py` is a command script and is tracked by git like every script a command runs.
- Codex parity (ADR-0004): R29 keeps every Codex manifest version-aligned and adds nothing Codex cannot load; skills are untouched.
- ADR-0006, engines install only on a person's command: the installer is a command; nothing runs from a hook, a plugin update or a session start.
- ADR-0007, marketplace rows and surface pins: `pro-egm`'s `egm` row keeps the marketplace check and pin because R3 runs the same `run_engine`.
- `REVIEW.md` Pass 2: R12 and R14 keep the script to a fixed argument set and a trusted path; R13 and R32 trust only the pro-core Claude Code loads for this repo from the trusted marketplace; R17 runs with no shell; R34 shows every row before it runs.
- `CLAUDE.md`, no hard dependency on another marketplace: R23 declares no dependency at all, so nothing from another marketplace and nothing from pro-core is required.
- `CLAUDE.md`, no home-directory path in a command or doc: the commands use `${CLAUDE_PLUGIN_ROOT}` and the script derives the config directory at run time.

## Design

### User experience

A person with only pro-nextjs installed types `/pro-nextjs:install`.
The first line names the pro-core copy in use, for example `pro-core 0.19.0 at <cache path>`.
They see a table of pro-nextjs's rows: `next-skills` (default) and `vercel` and `vercel-skills` (optional).
Each optional row is asked once with its `why` line; answers land in `.claude/pro-dev.json` and a later `/pro-dev install` does not ask again.
Before the run it lists every row that will install, marks any answer taken from the committed `.claude/pro-dev.json` and waits for a yes.
The `run` call then prompts for permission as `/pro-dev`'s does before it installs.
The command ends with the table again and a line pointing at `/pro-dev check`.
`/pro-nextjs:install update` updates the installed rows and installs any default row now missing.
A failure prints `Retry: /pro-nextjs:install`.
When pro-core is missing, disabled, too old or from an untrusted marketplace, or `claude plugin list --json` fails, the person gets one line with the exact command that fixes it.

A person on `pro-dev-starter` keeps running `/pro-dev install` and sees the same pre-run list and yes step; the per-plugin commands appear in their command list and are harmless if used, since they run a subset of the same rows.

### System

`pro-dev.py` (pro-core): `build_parser` gains `--owner`; `main` validates it against the registry; `cmd_status`, `cmd_run` and `cmd_answer` filter rows by owner; `retry_line` takes the owner; `write_run_version` is skipped under `--owner`; `cmd_plugins_update`, `cmd_swap_starter`, `cmd_stale` and `cmd_surface` refuse under `--owner`; `cmd_status` adds `answerCommitted` (R33).
`owner_active`, `engine_state` and `run_engine` are reused unchanged: a row is still `not-applicable` unless its owner is installed, enabled and covers the repo.

`scripts/pro-dev-owner.py` (each owning plugin): read owner from its manifest, validate argv against R12, check the marketplace source (R32), find pro-core's install (R13), check path (R14) and version (R15), then exec.
It keeps its own copy of the small install-reading logic rather than importing from pro-core, because importing would run pro-core code before the path check.

`commands/install.md` (each owning plugin): frontmatter `description`, `argument-hint: "[update]"` and the R19 `allowed-tools`; a Context block with the `!` status line; then the install and update flows of R20 to R22 and R34, written as a shortened copy of `/pro-dev` sections 2 and 3 limited to engine steps.

`plugins/pro-core/commands/pro-dev.md`: the pre-run list and yes step of R34 in its install and update flows and the one line naming `/<plugin>:install` (R9).

`.claude-plugin/plugin.json` (each owning plugin): a description clause and no pro-core dependency.
`tests/check.mjs`: the `installers` check.
`tests/pro-dev.mjs`: the new cases, reusing its fake `claude` (with `FAKE_PLUGIN_LIST` pointing pro-core's `installPath` into a temp config cache) and fake `npx`.
No data migration: `.claude/pro-dev.json` keeps its shape.

### Alternatives considered

- A pro-core dependency (rejected 2026-10-28, it re-enables a disabled pro-core) and no installer command: `/pro-dev install` would already install only pro-nextjs's rows when pro-nextjs is the only owner present; the intent asks for the setup to sit in the plugin the person installed ("if they choose to install just pro-nextjs then they can have an install").
- A resolver step written in the command prose (call `claude plugin list --json`, read the path, run it): the model would assemble the path at run time and `allowed-tools` could not hold an exact pattern and every run would prompt on an unreviewed path.
- Locating pro-core through `${CLAUDE_PLUGIN_ROOT}/../../pro-core/<version>`: depends on the cache layout and gives no rule for picking among versions or scopes.
- Each plugin vendoring `pro-dev.py` and its rows: two copies of every pin and check drift apart, which is the problem ADR-0006 solved.
- Passing the owner as an argument from the command: a prompt-injected or edited command could name another owner; reading it from the script's own manifest closes that.

## Flagged concerns

ADR needed: yes, ADR-0006 is amended in place (it is still `proposed`), replacing "No plugin ships its own engine install command" with the per-plugin installer rule.
The amendment records that each row owner ships exactly one `/<plugin>:install` (install and update) that runs only its own rows through pro-core's `pro-dev.py --owner` via the plugin's own `pro-dev-owner.py`, that `/pro-dev install` still sets up everything for a starter site, that row owners declare no pro-core dependency and check for pro-core instead, that rows stay in pro-core's one registry for now and that both commands list what will install and ask first.
The build adds why there is no dependency: a dependent re-enables a disabled pro-core (plan step 0).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent reverses ADR-0006's decision "No plugin ships its own engine install command", whose context was that per-plugin commands made setup take nine commands. | ADR-0006 | settled 2026-10-28: amend ADR-0006 in place; per-plugin installers are a subset of `/pro-dev install`, which stays the single step for starter sites (R8, R9, R30). |
| 2 | The intent says each installer's `allowed-tools` holds the exact `pro-dev.py` pattern while a plugin command's `${CLAUDE_PLUGIN_ROOT}` is its own and cannot name pro-core's script path. | intent Constraints | settled 2026-10-28: `allowed-tools` names the plugin's own `pro-dev-owner.py`, which finds pro-core under the trust rules of R13 to R15 and R32 (R19). |
| 3 | The intent's allowed-tools line could be read as pre-approving the run, while `/pro-dev` deliberately leaves `run` unapproved so every install prompts. | `plugins/pro-core/commands/pro-dev.md`, ADR-0006 | settled 2026-10-28: pre-approve only `status` and `answer`; `run` prompts each time, as in `/pro-dev` (R19). |
| 4 | A pro-core dependency would load pro-core's hooks (Bash guard, memory recall, dream nudges, the `/pro-dev update` nudge) in every session of someone who installed only pro-nextjs, which they did not ask for. | intent Constraints | settled 2026-10-28: no dependency, because step 0 showed it re-enables a disabled pro-core; the installer checks for pro-core instead (R23). |
| 5 | Rows live in pro-core and a new row for pro-nextjs reaches `/pro-nextjs:install` only after pro-core updates too, while a person who updates pro-nextjs alone sees no new row and no error. | ADR-0006 Consequences | settled 2026-10-28: rows stay in pro-core's registry for now; R15's minimum version covers the `--owner` release only; per-plugin registry files are deferred and stay ADR-0006's reversal fallback. |
| 6 | pro-speckit's spec R26 says its installer runs `pro-dev.py run <id> install` per row with that exact script pattern in `allowed-tools`, which this spec replaces with `pro-dev-owner.py run all install`. | `intent/2026-10-28-pro-speckit/spec.md` R26 | settled 2026-10-28: pro-speckit's R26 to R28 follow this spec; its command runs its own `pro-dev-owner.py`, not `pro-dev.py` directly (R26). |
| 7 | Installers are Claude Code commands while Codex parity asks that a rule in a Claude manifest have its Codex sibling; Codex has no command or dependency field for this and `owner_active` reads only Claude installs. | ADR-0004, `REVIEW.md` Pass 1 | settled 2026-10-28: Codex users keep the manual install lines the bridge skills already carry (R29); no Codex installer. |
| 8 | Seven plugins each ship a command named `install`: a bare `/install` is ambiguous and the commands show up for starter users who never need them. | intent Open question 1 | settled 2026-10-28: always `/<plugin>:install`, with an `update` argument; health stays in `/pro-dev check` (R18, R22). |

## Security challenge

From a fresh-context `security-architect` challenge of this spec on 2026-10-28, run with Opus at high effort.

Verdict: proceed with required changes; nothing blocking.
The owner name comes from the cached manifest, never from argv or the environment; R12's fixed argument shapes and R4 and R5 inside `pro-dev.py` keep an installer to its own rows and away from `plugins`, `stale` and `surface`; an older `pro-dev.py` rejects `--owner` and fails closed; pre-approval stays limited to `status` and `answer`.

### Required changes

1. [7/10] R13's coverage rule is the reverse of `covers_repo` in `pro-dev.py` (a `projectPath` at or under the repo), so a parent-folder pro-core install could be picked and run though Claude Code does not load it for this repo. Change: R13 uses exactly the `covers_repo` and `find_repo` rules; R27 adds a fixture with a parent-folder and a user-scope pro-core asserting the owner script and `owner_active` agree.
   Answered by R13 and R27.
2. [6/10] (verify) The owner script can run a pro-core the person disabled: the `installed_plugins.json` fallback marks every entry enabled; dropping disabled entries before picking the narrowest scope lets a user-scope copy run when the local one is disabled. Change: refuse with a one-line fix on the fallback path instead of guessing; pick the narrowest covering entry first, then require it to be enabled; verify how `claude plugin list --json` reports per-scope enablement.
   Answered by R13 and R27; the per-scope enablement check is a plan step 0 item.
3. [7/10] A committed `.claude/pro-dev.json` answer can choose an optional engine the person never picked, while the permission prompt shows only `run all install`; this is pre-existing in `/pro-dev` and the spec copies it into seven commands. Change: before `run`, the command lists every row that will install and marks which answers came from the committed file, then asks for a yes in the conversation; the same change goes into `/pro-dev`.
   Answered by R33 and R34, with R9 for `/pro-dev`.

### Open questions from the challenge

- R14 trusts any copy under `cache/pro-dev-skillset/pro-core/`, keyed by marketplace name only; should the owner script check `known_marketplaces.json` for the github source `jodybrewster/pro-dev-skillset`, as `methods.py` does?
  Answered by R32: yes, with the same case-insensitive match.
- When pro-core is installed but disabled, does Claude Code refuse to load a plugin that depends on it, or does installing that plugin re-enable pro-core and with it the `git-safe`, `memory-recall` and Stop ledger hooks? The answer belongs in the ADR-0006 amendment and the plugin descriptions.
  Answered by plan step 0: installing the dependent re-enables the disabled pro-core, so the maintainer dropped the dependency (R23, ADR-0006).

## Open questions

- Command name, `/<plugin>:install` everywhere or something shorter: answered 2026-10-28, `/<plugin>:install` (R18, Flagged concern 8).
- Whether an installer also offers `update` and `check`: answered 2026-10-28, install and update through one command with an `update` argument; check stays in `/pro-dev check` (R18, R22).
- The ADR-0006 amendment: answered 2026-10-28, amended in place (R30, `ADR needed` line).
- Whether pro-core's own registry rows move into each plugin (Flagged concern 5): answered 2026-10-28, rows stay in pro-core for now.
- Whether installing a plugin that depends on pro-core re-enables a disabled pro-core: answered by the build (plan step 0), it does; the maintainer dropped the dependency 2026-10-28 (R23, ADR-0006).

## Acceptance criteria

- AC1. In a temp repo with only pro-nextjs and pro-core installed, `/pro-nextjs:install` installs `next-skills` and asks about `vercel` and `vercel-skills`; the fake tool log in `tests/pro-dev.mjs` shows no argv from another owner's row.
- AC2. With pro-dev-starter installed, `/pro-dev install` lists, asks and runs the same rows as before this change; every existing `tests/pro-dev.mjs` case passes unedited.
- AC3. After `/pro-nextjs:install`, `/pro-dev check` reports `next-skills` as `installed`.
- AC4. `python3 <pro-core>/scripts/pro-dev.py --owner pro-nextjs run impeccable install` exits 2 with `impeccable: owned by pro-design, not pro-nextjs`.
- AC5. `pro-dev-owner.py` exits 2 and runs nothing when pro-core's install path is inside the repo, outside the plugin cache, below the minimum version or absent.
- AC6. `node tests/check.mjs` fails when `plugins/pro-ship/commands/install.md` is removed, when one `pro-dev-owner.py` differs by a byte and when an `install.md` gains a `Bash(python3 .../pro-dev.py ...)` entry.
- AC7. `node tests/check.mjs && node tests/eval.mjs --dry`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC8. Every touched plugin's two manifests and marketplace entry agree on a bumped version; `docs/releases.md` has a row for each.
- AC9. With a committed `.claude/pro-dev.json` that answers `vercel` yes, `/pro-nextjs:install` and `/pro-dev install` both list `vercel` as an answer from the committed file and run nothing until the person says yes.
- AC10. `pro-dev-owner.py` exits 2 and runs nothing when `claude plugin list --json` fails, when the narrowest covering pro-core is disabled and when `known_marketplaces.json` names another source for `pro-dev-skillset`.
- AC11. No owning plugin's manifest declares a pro-core dependency and `node tests/check.mjs installers` fails if one does.

## Out of scope

Changing what any engine installs or how it is pinned.
The `pro-dev-*` rename (intent `2026-10-28-rename-pro-dev`).
Changing what `/pro-dev install` does for a starter site.
Rewording bridge skills; they keep naming `/pro-dev`, which the `bridges` check requires.
A Codex installer.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
