# Plan: swappable spec methods, starting with Elephant-Goldfish

Built from `spec.md` (commit bf4e61d) and `intent.md` in this folder.
Status: draft.
Approver: Jody Brewster; the change adds a third-party install path and a prompt channel, so it is not an auto-mode change.
Dated: 2026-10-28.

## Files that change

New:

- `plugins/pro-egm/.claude-plugin/plugin.json` and `plugins/pro-egm/.codex-plugin/plugin.json` (new): the plugin at `0.1.0`, no dependencies (R1).
- `plugins/pro-egm/skills/egm-bridge/SKILL.md` (new): when to offer a goldfish review, how it fits the loop, how to customize `.egm/`, the Claude and Codex install paths (R2).
- `plugins/pro-egm/commands/goldfish.md` (new): `/pro-egm:goldfish <file> [--stage spec|plan]` and `/pro-egm:goldfish init` (R12, R15).
- `plugins/pro-egm/scripts/goldfish.py` (new): `resolve` and `init`, standard library only (R13 to R15).
- `plugins/pro-egm/goldfish/policy.md`, `scope.md`, `policy-standard.md` and `scope-standard.md` (new): the two starter goldfish and their standards, original text (R16).
- `plugins/pro-egm/sdlc-method.json` (new): `requires` `egm@egm` and the `spec` and `plan` hand-offs (R11).
- `plugins/pro-ai-sdlc/scripts/methods.py` (new): hand-off discovery (R8, R9, N1 to N5).
- `plugins/pro-spdd/sdlc-method.json` (new): the `/spdd-story` hand-off at `intent` (R18).
- `tests/methods.mjs` and `tests/goldfish.mjs` (new): the R20 case tables with a fake `claude` on `PATH` and a temp `HOME`, modelled on `tests/pro-dev.mjs`.

Modified:

- `plugins/pro-core/registry/engines.json`: the `egm` row with its `marketplace` object; `version` 1 to 2 (R3, R4).
- `plugins/pro-core/scripts/pro-dev.py`: before a row's `install`, register its marketplace or refuse on a source mismatch, read from `known_marketplaces.json` (R4); print the plugin surface before installing a `claude-plugin` row and record it after install or update in `.claude/pro-dev.json` under `surfaces`; `status` and `check` name a row whose hooks or MCP servers grew (R6); the docstring says a marketplace add is a user-wide write.
- `plugins/pro-core/commands/pro-dev.md`: relay the surface line and the grown-surface warning as they are printed.
- `tests/pro-dev.mjs`: cases for marketplace add, source mismatch, surface line and grown surface.
- `plugins/pro-ai-sdlc/commands/intent.md` and `review.md`: one Context line calling `methods.py` for the stage and one short step offering what it printed.
- `plugins/pro-ai-sdlc/commands/spec.md` and `plan.md`: one step after the draft that calls `methods.py --stage <stage> --target <file>`, offers each line and, after a goldfish review, folds open Blocker and Major findings into Flagged concerns or Risks and names the untracked report (R10, R17).
- All four: `allowed-tools` gains `Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py":*)` and nothing broader.
- `plugins/pro-ai-sdlc/README.md`: a "Spec methods" section naming the `sdlc-method.json` contract and ADR-0007.
- `tests/check.mjs`: a `methods` check (R19); the `registry` check validates `marketplace` (R5); `egm-bridge` joins `BRIDGES` and `pro-egm` joins `OPT_IN` (R21); `methods` and `goldfish` behavior checks run `tests/methods.mjs` and `tests/goldfish.mjs` the way the `pro-dev` check runs `tests/pro-dev.mjs`.
- `tests/cases/routing.jsonl` and `plugins/pro-core/skills/using-pro-dev/SKILL.md`: one `egm-bridge` case and the router line beside the pro-spdd branch (R23).
- `.claude-plugin/marketplace.json`, both manifests of each bumped plugin: pro-egm `0.1.0` (new entry), pro-core `0.16.0` to `0.17.0`, pro-ai-sdlc `0.4.0` to `0.5.0`, pro-spdd `0.3.5` to `0.3.6`, pro-dev-starter `2.0.0` to `2.0.1`, `metadata.version` `1.51.0` to `1.52.0` (R24, ADR-0002).
- `docs/licenses.md` (R22), `docs/releases.md`, `README.md`, `tests/README.md`, `RELEASING.md` (bridged list) and `CLAUDE.md` (the expected verify output: check count, skill count 88 and plugin count 18).
- `docs/decisions/0007-spec-method-plugins.md`: Enforced-by links once the files exist; Status moves to `accepted` only at sign-off.

Nothing is deleted.

## Order of work

The build runs in a worktree on a branch from local `main` at bf4e61d, which is `origin/main` plus the four spec commits.
Jody's uncommitted `; true` edits in `plugins/pro-ai-sdlc/commands/{adr,plan,review,spec}.md` stay in the main checkout and are not touched (see Risks).

0. Settle the blocking item of the security challenge before any pro-egm code.
   Upstream `docs/claude.md` says the synthesizer spawns "the plugin's registered reviewer types (for example `egm:egm-zoom-out`)", which are read-only, but it says nothing about a reviewer given as a path; a custom goldfish may run as a general-purpose agent with shell access.
   In a scratch repo with `egm@egm` installed, run `/egm:egm-review-loop` with one path reviewer and read the session transcript for the subagent type and tools it got.
   If it is a registered read-only type, record that here and go on.
   If it is general-purpose, pro-egm ships its own read-only adapter agent, `pro-egm:goldfish-reviewer` (`tools: [Read, Grep, Glob]`, `omitClaudeMd: true`); `/pro-egm:goldfish` runs path reviewers through it with direct dispatch, passing EGM's built-in reviewers to EGM as shortnames.
   If that cannot work, path reviewers are dropped and Jody decides again.
   Check: the finding is written under Departures before step 6 starts.
1. Registry `marketplace` field.
   Add the `marketplace` validation to the `registry` check, then the step in `pro-dev.py`: read `known_marketplaces.json`; a missing name runs `claude plugin marketplace add <source>`; a registered name whose source is not `github` with the same `repo` (case-insensitive), or an unreadable file, prints both and fails the row; the file is read again after the add and before the install; the same check runs in `status` and before `update` (security change 9).
   Check: new `tests/pro-dev.mjs` cases for add, already-present and mismatch; `node tests/check.mjs` passes.
2. Plugin surface, pinned in the registry (security changes 1 to 4 and 10).
   The `egm` row gains a `surface` pin reviewed at build time: agent count, skill count, the union of agent `tools` and skill `allowed-tools` (upstream today: `Read`, `Grep`, `Glob` for reviewers, plus `Agent` and `Write` for the synthesizer and `Agent`, `Bash`, `Edit` and `Write` for the bootstrap orchestrator) and a sha256 of every hook and MCP declaration, from `hooks/hooks.json`, `.mcp.json`, inline `hooks` and `mcpServers` in `plugin.json` and the marketplace entry.
   Before install, `pro-dev.py` computes the same surface from the cloned marketplace; after install and before update, from the installed `installPath`.
   It opens only regular files whose resolved path stays inside the clone or install folder, caps each read like `MAX_ANSWERS_BYTES` and reports "surface unknown" on any failure.
   A surface beyond the pin, or unknown, turns the row into a question with the difference printed instead of an install; `check` reports it for an installed row.
   No baseline is written to `.claude/pro-dev.json`, so a PR to that file cannot hide growth; this replaces the per-repo record in spec R6.
   Check: cases for a matching surface, an added tool, a changed hook hash at the same count, an inline hook, a symlinked or FIFO `hooks.json`, a `source` of `../..` and update-then-check.
3. The `egm` row and registry `version: 2`.
   Check: `node tests/check.mjs` passes and `pro-dev.py status --json` lists `egm` as not applicable without pro-egm.
4. `methods.py` and `tests/methods.mjs`.
   Check: every R20 `methods.py` case passes, including the timing bound with 50 fake installs.
5. The `methods` check in `tests/check.mjs` and the two `sdlc-method.json` files (pro-egm, pro-spdd).
   Check: the check passes and fails on a scratch copy with a bad `stage`.
6. `goldfish.py` and `tests/goldfish.mjs` (security changes 5, 6 and 8).
   Every path it prints, reviewers, standards, `context` and the automatic reading list, resolves with all parents inside the repo, is a regular file and is never under `.git/`; reviewers and standards also stay inside `.egm/`.
   `init` resolves `.egm` first, `lstat`s each file and creates it with `O_CREAT | O_EXCL | O_NOFOLLOW`.
   `resolve` keeps a sha256 per custom reviewer and standard in `.git/egm-seen.json`, never committed; it lists each new or changed file with the author of its last commit so `/pro-egm:goldfish` asks before the run.
   Check: defaults per stage with absolute starter paths under the fake `installPath`; a valid `.egm/goldfish.json` wins; `/abs.md`, `../x.md`, a symlink, a symlinked `.egm/reviewers` folder, `docs/x.md`, an outside `context` entry and a symlinked root `CLAUDE.md` are refused with the entry named; `init` writes the files, leaves an existing one untouched and refuses a dangling symlink; a changed reviewer is listed as changed.
7. The rest of pro-egm: starter goldfish and standards, `commands/goldfish.md`, `skills/egm-bridge/SKILL.md`, both manifests and the marketplace entry.
   `commands/goldfish.md` has `allowed-tools: Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/goldfish.py":*)` plus the skill call, takes the target as an argument the model passes and puts no `$ARGUMENTS` in a `!` line (security change 11).
   Check: `claude plugin validate plugins/pro-egm --strict`; `grep` shows no line copied from the upstream skills or agents.
8. The four pro-ai-sdlc commands and the README.
   After a goldfish review, `/spec` and `/plan` write their own one-line summary of each open Blocker or Major finding with no quoted file content and show those lines before the commit (security change 7).
   `methods.py` also reads `known_marketplaces.json` and trusts `*@pro-dev-skillset` only when that marketplace's source is `github` `jodybrewster/pro-dev-skillset` (challenge open question 5).
   Check: with only pro-ai-sdlc's own fake install, `methods.py` prints nothing for each stage (N1); the command diffs add one call and one step each and no broader `allowed-tools`.
9. Routing case, router line, docs, licenses and every version bump in one commit.
   Check: the full verify block in `CLAUDE.md`.
10. Security challenge of this plan by `security-architect` before approval, pasted below as `## Security challenge`; findings folded in.
11. Live check in a scratch repo after the PR merges and the marketplace updates (see Proof of done).

Steps 1 to 3 (pro-core), 4, 5 and 8 (pro-ai-sdlc and pro-spdd) and 6 and 7 (pro-egm) touch separate files and can run as three parallel Sonnet subagents; step 9 runs after all three because every plugin bump edits `.claude-plugin/marketplace.json`.

## Tests that prove it

- `tests/pro-dev.mjs` covers marketplace add, an existing matching marketplace, a mismatched source, the surface line and a grown surface.
- `tests/methods.mjs` covers no method installed, pro-egm with and without `egm@egm`, the `{target}` fill, a disabled install, a project install for another repo, a method file from another marketplace, malformed JSON, a missing or failing `claude` and 50 installs under two seconds.
- `tests/goldfish.mjs` covers the defaults for `spec` and `plan`, the reading list (sibling `intent.md`, `spec.md` for a plan, the policy files that exist), a valid config, each refused path form and `init`.
- `tests/check.mjs` runs all three as checks and adds the `methods` and `marketplace` validations.
- `tests/eval.mjs --dry` confirms the new routing case names a real skill.
- The live check covers AC2 to AC7 against the real `egm@egm`.

## Risks

The step most likely to go wrong is step 0, because its answer can force a read-only adapter agent or drop path reviewers; after that, step 2, the surface pin.
It reads the plugin from the cloned marketplace; EGM's marketplace entry uses `"source": "./"`; another third-party marketplace may point at a git URL with no local clone, so the line must say "surface unknown until installed" rather than fail the install.
A wrong count is cosmetic; a crash here would block every `claude-plugin` row, so the surface code is wrapped and tested on a missing manifest.

What this might break:

- `/spec` and `/plan` for every pro-ai-sdlc user.
  N1 and N2 keep them unchanged when nothing is installed or `claude` fails; step 8's check proves it before the docs commit.
- `/pro-dev install` for existing rows.
  The marketplace step runs only for rows that carry `marketplace`; the existing `tests/pro-dev.mjs` cases must stay green.
- Jody's uncommitted `; true` edits sit in the same four command files.
  The worktree never sees them; when he commits them after this merges, the Context lines may conflict.
  The safer order is for Jody to commit those edits first, so the build branch starts from them.
- `claude plugin marketplace add` is a user-wide write and stays after pro-egm is uninstalled; ADR-0007 accepts that and `/pro-dev` names it.
- EGM's review loop asks the person to confirm its configuration and to approve fixes each round, so the `/spec` run takes several turns; this is EGM's design and the offer says it runs several subagents.

Nothing here is irreversible: no migration, no deleted file and every new path is additive.

Left out on purpose:

- A `docs` goldfish and a security goldfish: Jody tries EGM through pro-egm first and tunes `.egm/goldfish.json` after first use (spec Open question 5).
- EGM's brainstorm, draft and drift-report flows in the loop (spec Out of scope).
- Codex install through the registry (umbrella item G).
- pro-speckit's `sdlc-method.json` (intent E).

## Options not taken

- One branch built serially by the orchestrator: simpler to watch, but steps 1 to 8 split cleanly by plugin, so three parallel builders save most of the wall time.
- Showing the surface only after install: no clone to read is needed, but the person learns what arrived only after it is running, which the security challenge asked to avoid.
- Calling `claude plugin marketplace list --json` for the source check: it exists, but `pro-dev.py` already reads `known_marketplaces.json` for versions, which gives the source as `{"source": "github", "repo": ...}` with no extra process.
- Copying the starter goldfish into each repo on first `/spec` run: no `init` needed, but it writes files the person did not ask for; `init` is one explicit command.

## Proof of done

Run from the worktree root; all must pass:

```bash
node tests/check.mjs && node tests/eval.mjs --dry
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

Expected: `0 failures` with the `methods`, `goldfish` and `registry` checks listed, `88 skills in catalog`, `✔ Validation passed` once for step 2 and 18 times for step 3.

Live check, after merge and `claude plugin marketplace update pro-dev-skillset`, in a fresh scratch git repo with pro-dev-starter installed at project scope:

1. AC1: `/spec` on a small intent makes no method offer.
2. Install `pro-egm@pro-dev-skillset` at project scope, run `/pro-dev install`; AC2: the surface line printed, `claude plugin marketplace list` shows `egm`, `/pro-dev check` reports `egm` installed.
3. AC3 and AC4: `/spec` offers the review, it runs with the default reviewers without asking for inputs, the committed spec has the accepted fixes and `goldfish_review_report.md` is untracked; `/plan` offers the plan reviewers.
4. AC5: `/pro-egm:goldfish init`, drop `zoom_out` from `.egm/goldfish.json`, rerun; then try `../x.md` and see it refused.
5. AC6 and AC7: uninstall `egm@egm`, see the needs line; uninstall pro-egm, see nothing.
6. AC8: install pro-spdd and run `methods.py --stage intent`.

## Security challenge

From a fresh-context `security-architect` challenge of this plan on 2026-10-28, run with Opus at high effort.
It covers only what is new since the spec challenge.
Each item is answered by the step named after it.

Verdict: proceed with required changes; the blocking item is a check before step 6.

### Blocking

- [6/10] (verify) Flagged concern 7 and R14 assume goldfish reviewers have only `Read`, `Grep` and `Glob`, which are the tools of EGM's nine named agents. Nothing says which agent `egm-review-loop` starts for a reviewer given as a path, which covers every starter goldfish and every `.egm/reviewers/*.md`. If it is general-purpose, a contributor can land a persona that tells the reviewer to download and run a remote script, which then runs on the next `/spec`. Answered by step 0.

### Required changes

1. [7/10] `run all install` prints the surface and installs the `default: true` row in the same step, so a grown upstream installs while the line scrolls past. Pin the reviewed surface in the row; beyond the pin or unknown becomes a question. Step 2.
2. [8/10] The plan lists no agent tools and R6 only counts agents, so a reviewer gaining `Bash` or `WebFetch` reads the same. Record each agent's `tools` and each skill's `allowed-tools`; any added tool is growth. Step 2.
3. [7/10] Hooks and MCP servers can be declared inline in `plugin.json` or in the marketplace entry; count every site and compare a hash, not a count. Step 2.
4. [7/10] The baseline in the committed `.claude/pro-dev.json` can be raised by a one-line PR; writing the new counts right after an update compares the install with itself. Step 2 drops the per-repo baseline for the registry pin.
5. [7/10] R14 limits reviewers and standards but not `context` or the automatic reading list; a committed outside path or a symlinked root `CLAUDE.md` reaches the reviewers. Step 6.
6. [6/10] (verify) `init` could follow a dangling symlink or a symlinked `.egm`. Step 6.
7. [6/10] (verify) Reviewer-written text folded into Flagged concerns is committed with no per-line yes; a persona could quote secrets as evidence. Step 8.
8. [6/10] (verify) A pulled change to `.egm/reviewers/policy.md` is not visible from the resolved path list. Step 6 keeps `.git/egm-seen.json` and asks on new or changed files.
9. [7/10] R4 fails open on a non-github source, an unreadable `known_marketplaces.json`, an already detected row and `update`. Step 1.
10. [6/10] (verify) The surface reader parses third-party files before any yes: FIFOs, symlinks to `/dev/zero` and a `source` of `../../..`. Step 2.
11. [5/10] (verify) `commands/goldfish.md` has no exact `allowed-tools` and a crafted intent folder name could run if it reached a `!` line. Step 7.

### Open questions from the challenge

- Which agent and tools does `egm-review-loop` use for a path reviewer? Step 0.
- Does EGM's loop ever stage or commit on its own under `/spec`'s `git add` and `git commit` grants? Step 0 records it from the same run; if it does, `/spec` checks `git status` before its own commit.
- Does an EGM subagent's `Read` outside the repo prompt under the session's permission mode? In auto or bypass mode, steps 6 and 8 are the only fence; the live check records what happens.
- Will the `egm` row's `update` ever target a tag or commit? Not in this change; the step 2 pin is the control on every update.
- `methods.py` trusts `*@pro-dev-skillset` by name, while a repo's settings can declare a marketplace of that name. Step 8 checks the source.

### Accepted risks

- `claude plugin marketplace add` is a user-wide write that stays after pro-egm is uninstalled (ADR-0007, Jody, 2026-10-28).
- A row that names a marketplace may default to installed because installing the glue plugin is the opt-in (ADR-0007, Jody, 2026-10-28); this holds only with step 2's pin.
- EGM's agents run on `model: inherit` for up to five rounds (Flagged concern 5, Jody, 2026-10-28).

The challenge found no instructions in the plan or spec that tried to steer it.
Upstream fact found while answering: `docs/claude.md` lets an `EGM artifact directory: <path>` line in `CLAUDE.md` or `AGENTS.md` choose where EGM writes its report.

## Done

- Build commit: bc7c3ef (PR 66), fixed by PR 67 after the live check.
- Checks run on PR 66: `node tests/check.mjs && node tests/eval.mjs --dry` gave 26 checks, 0 failures, 39 warnings and 73 cases over 89 skills; `claude plugin validate . --strict` passed; the per-plugin loop passed 18 times; CI "Validate marketplace + plugins (strict)" passed.
- Live check on 2026-10-28 in a fresh scratch repo with pro-dev-starter 2.0.1 at project scope, from the published marketplace:
- AC1: pass. `methods.py --stage spec` printed nothing with only pro-dev-starter installed.
- AC2: pass. After installing pro-egm, `/pro-dev`'s `run egm install` printed the surface line ("18 agents, 7 skills ... hooks/MCP hash matches pin"), found the `egm` marketplace registered with the matching source and installed `egm@egm`; `status` reported `egm` installed.
- AC3: fail on 0.1.0, pass on the PR 67 fix. 0.1.0 stopped because every EGM skill sets `disable-model-invocation` and the Skill tool refused `egm-review-loop`. With the fix, `/pro-egm:goldfish` ran one round headless: `zoom_out` and `design_critic` ran as `egm:egm-zoom-out` and `egm:egm-design`, both starter goldfish ran as `pro-egm:goldfish-reviewer`, the spec was edited in place and `goldfish_review_report.md` was left untracked.
- AC4: pass for the offer. `methods.py --stage plan` printed the plan offer with the target filled in; a plan-stage review was not run.
- AC5: pass. After `init`, dropping `zoom_out` removed it from the resolved reviewers; the new `.egm/` files were listed as changed; `../x.md` was refused with the entry named.
- AC6: pass. With pro-egm installed and `egm@egm` missing, `methods.py` printed "pro-egm needs egm@egm: run /pro-dev install".
- AC7: pass. After `claude plugin uninstall pro-egm@pro-dev-skillset`, the spec offer was gone and no file changed.
- AC8: pass. With pro-spdd installed, `methods.py --stage intent` printed the `/spdd-story` offer.
- AC9: pass, per the checks above.
- AC10: pass. All pro-egm text is original; `docs/licenses.md` has the pro-egm row.
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted` and ADR-0007 from `proposed` to `accepted`.

## Departures from plan

- Live check, 2026-10-28: every EGM skill sets `disable-model-invocation`, so `/pro-egm:goldfish` 0.1.0 could not call `egm-review-loop` through the Skill tool.
  EGM's PR 103 says a caller reads the skill's `SKILL.md` and follows it; PR 67 does that, with `goldfish.py egm` finding the file in the enabled `egm@egm` install for the repo.
  The same run showed `claude plugin list --json` reports `enabled` for the cwd's project, so `goldfish.py` and `methods.py` now list from the repo folder.

- Step 0, 2026-10-28, in a scratch repo with `egm@egm` 0.1.0 at project scope, run headless on Sonnet.
  Plain run: EGM used direct dispatch, spawned `egm:egm-zoom-out` for the shortname and `general-purpose` for the reviewer given as a path, so a custom goldfish had every tool.
  EGM staged and committed nothing; it edited the target and wrote `goldfish_review_report.md` at the root.
  Second run with a project agent `goldfish-reviewer` (`tools: Read, Grep, Glob`, `omitClaudeMd: true`) and a caller rule "use direct dispatch; a reviewer given as a path must spawn `goldfish-reviewer`": EGM spawned `goldfish-reviewer` and the probe reported only `Read`, `Grep` and `Glob`.
  So pro-egm also ships `agents/goldfish-reviewer.md` with that frontmatter and its Codex `.toml`; `/pro-egm:goldfish` passes that dispatch rule with every run.
  The rule is an instruction to the session, not a hard control; the step 6 changed-file check and the confirmation before each run remain the fence if a session ignores it.
- Step 2: a surface that cannot be read turns the row into a question instead of the Risks section's "surface unknown until installed", following security change 1; an agent with no `tools` line counts as `*`.
  A row over its pin has no answer path in `/pro-dev`; the pin is raised by a reviewed registry change, as `pro-dev.md` says.
- Step 5: the `sdlc-method.json` validation and the `tests/methods.mjs` run are one `methods` check; `tests/methods.mjs` runs as a child process.
- Step 7: `/pro-egm:goldfish` allows `Skill`, `Agent`, `Read`, `Grep`, `Glob`, `Write` and `Edit` beside the exact `goldfish.py` pattern, because EGM's loop runs inside the command; no other shell command is allowed.
  It checks for EGM by whether `/egm:egm-review-loop` is available.
- Step 8: `/intent`'s offer is step 0 so the `sdlc-contract` check's anchor on step 3 holds.
- Step 9: the catalog counts 89 skills where Proof of done said 88; the numbers in `CLAUDE.md` are from the real run.
- Review fixes before push (fresh `security-architect` diff review and `reviewer` on b679452):
  - `update` refreshes the marketplace clone and checks it against the pin before `claude plugin update` runs; after any install or update the installed copy is checked again and disabled when it is beyond the pin.
  - The pin keeps tools per agent, skill and command instead of one union; the hash also covers command `!` lines, LSP servers and frontmatter hooks.
  - `goldfish.py` accepts a root doc that is a symlink to a file inside the repo (this repo's `AGENTS.md`), allows only EGM's own shortnames, hashes `.egm/goldfish.json` and makes `--accept` take a token from the list it printed; `/pro-egm:goldfish` limits `Write` and `Edit` to the report, `intent/` and `.egm/`.
  - The `/intent` and `/review` Context lines end in `; true`; the needs line reads "pro-egm needs egm@egm: run /pro-dev install".

<!--
Write this in plan mode from an accepted spec, then question it before approval:
what might break, where the weakest step is, and what was skipped on purpose.
Revise until someone who missed the conversation could build from this file alone.
Review compares the final diff with this file.
-->
