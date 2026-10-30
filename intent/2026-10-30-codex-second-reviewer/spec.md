---
intent: intent/2026-10-30-codex-second-reviewer/intent.md
intent-status: draft
status: draft
created: 2026-10-30T11:50:00-0400
author: Jody Brewster
---

# Spec: Codex as a second reviewer on high-risk PRs

Built from `intent.md` in this folder (commit 127d252).
Status: draft.
Policies and skills consulted: `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, ADRs 0001 to 0015 in `docs/decisions/` (0003, 0004, 0006, 0011, 0012, 0014 and 0015 bear on this change), `docs/pr-check-stamp.md`, `docs/codex-parity.md`, `docs/version-bump-law.md`, `RELEASING.md`, `plugins/pro-ship/skills/pr-check/` (`SKILL.md`, `pr-body.md`), `plugins/pro-ship/scripts/pr-check.py`, `plugins/pro-ship/scripts/pr-gate.py`, `plugins/pro-security/scripts/push-gate.py` and `security_surface.py` (the two validity-rule copies), `plugins/pro-quality/agents/code-reviewer.md` and its `.codex-plugin/agents/code-reviewer.toml` twin, `plugins/pro-quality/skills/requesting-code-review/handoff.md`, `plugins/pro-core/registry/engines.json`, `plugins/pro-core/scripts/pro-dev.py`, `plugins/pro-core/commands/pro-dev.md`, `plugins/pro-ship/commands/install.md`, `tests/check.mjs` (the `registry`, `installers`, `stamp-contract` and `ship-check` checks), `tests/ship-check.mjs`, `tests/pro-dev.mjs`, `tests/fixtures/pr-check-stamp/`, the Codex section of the [pro-ship brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md), item 13 of [docs/roadmap.md](../../docs/roadmap.md) and the [doubt-driven-execute intent](../2026-10-30-doubt-driven-execute/intent.md).
No `DESIGN.md` or `SECURITY.md` exists; the one project skill (`.claude/skills/skill-creator`) does not touch compliance, security, privacy or design.

## Summary

On a high-tier PR, `/pro-ship:pr-check` runs the Codex twin of `code-reviewer` beside the Claude reviewers, from the same four-field handoff.
A new script, `plugins/pro-ship/scripts/codex-run.py`, does the run: it checks consent, the binary and the login, pipes the instructions and the handoff into `codex exec` through stdin in a read-only sandbox with a timeout and prints the raw report or one could-not-run line.
A deterministic `pr-check.py agree` pairs the two reports by file and nearby lines, so the PR body shows each finding with who raised it, marks agreement and shows a disagreement with both views.
The stamp gains an optional `reviewers.codex` object that never changes `result`, so the gate behaves exactly as it does today.
Codex is an opt-in `codex` row in pro-core's engine registry with a new detect-only kind, `manual-cli`.
`/pro-dev install` asks about it once and the yes is also the consent to send the diff to OpenAI; `/pro-dev check` reports whether the binary is on PATH.
A person or repo without Codex gets one skip line and a normal stamp.
The runner takes no pro-ship path, so the doubt-driven-execute intent can ship a byte-identical copy in pro-ai-sdlc.

## Spike (2026-10-30)

Codex CLI 0.166.0, logged in with ChatGPT, on macOS.
`codex exec --help` and `codex exec review --help` were read.
`codex exec review` takes `--base`, `--commit` or `--uncommitted` and custom review instructions, but runs Codex's own review prompt and layout, so it cannot carry the `code-reviewer` instructions or the four-field handoff; it lost to plain `codex exec`.
Codex has no flag to load a custom agent `.toml`; `.codex/agents/` files are for interactive sessions.
The spike loaded the agent by reading `developer_instructions` from `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` with Python's `tomllib` and sending it first in the prompt.

The run reviewed PR 76 (`386f700`, the PR quality gate hook change: `hooks.json`, `pr-quality-gate.py` and its tests, 259 lines added and 25 removed), a high-tier change because it touches a hooks directory.
The prompt file held `# Instructions`, the `.toml` body, one line asking for the tally line first, then `# Handoff` with `range: <base sha>..<head sha>`, `brief: none`, `policy: REVIEW.md, CLAUDE.md` and `risk: high (...)`.
Command, run from the repo root with the prompt on stdin:

```
codex exec -s read-only --ephemeral --color never -C <repo root> -o <tmp>/last.txt - < <prompt file>
```

Result: exit 0 in 55 seconds, 40,358 tokens, default model at medium reasoning effort.
stdout held only the final report (26 lines); the `-o` file held the same text without the trailing newline.
stderr held a banner (model, sandbox `read-only`, approval `never`), an echo of the whole prompt, each command Codex ran (ten read-only `git diff` and `git show` calls) and the token count, 2,320 lines in all.
The working tree was unchanged afterwards.
The first stdout line was `important: 3  nits: 0  pre-existing: 0  skipped: 3`, which matches the code reviewer's tally line as a whole line.
The report then gave "Ignored from the handoff: none.", three Important findings as a numbered list (each with a bold label such as `Correctness · Pass 1 · Important`, a dash, a backticked `path:line` and a failure scenario), "Nits: none.", "Pre-existing: none." and a skipped list that included "mutation check: not run".
The layout differs from the Claude reviewer's bullet form, so the parser in R19 reads both while R23 pins the location form in the agent text.

Not logged in: `codex login status` printed "Not logged in" and exited 1 within a second (with `CODEX_HOME` pointed at an empty folder); logged in it printed "Logged in using ChatGPT" and exited 0.
`codex exec` with no login retried five times, printed `401 Unauthorized` errors on stderr, left stdout empty and exited 1 after 17 seconds, so the runner checks the login first.
A missing binary is found with a PATH lookup and runs nothing.
Codex loads `AGENTS.md` files on its own (flagged concern 1).
The spike output stayed in a scratch folder outside the repo.

## Requirements

### Functional

The runner (`plugins/pro-ship/scripts/codex-run.py`):

- R1. The script exists, is tracked, uses only the Python 3 standard library and imports nothing from another plugin.
  No path, name or default in it names pro-ship or any other plugin, so a byte-identical copy in another plugin's `scripts/` folder works unchanged. (Intent: Open questions, runner; orchestrator decision.)
- R2. Usage: `codex-run.py (--instructions FILE | --agent NAME) --prompt FILE [--cwd DIR] [--timeout SECONDS] [--check]`.
  - `--instructions FILE`: a `.toml` file gives its `developer_instructions` string, a `.md` file gives its body after the frontmatter and any other file is read as plain text.
  - `--agent NAME`: the first of `<cwd>/.codex/agents/NAME.toml` and `$CODEX_HOME/agents/NAME.toml` (Codex's default home when `CODEX_HOME` is unset) that exists; NAME must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`.
  - `--prompt FILE`: the text to send, for pr-check the filled handoff.
  - `--cwd DIR`: the folder Codex works in; the default is the top of the git work tree that holds the current directory, else the current directory.
  - `--timeout SECONDS`: an integer from 1 to 3600; the default is 540, so a run ends before a host's 600-second command limit.
  - `--check`: run the checks of R3 only.
  (Intent: Open questions, invocation; orchestrator decision.)
- R3. Before any run the script checks these in order and stops at the first that fails:
  1. Consent: `<cwd>/.claude/pro-dev.json` exists as a regular file of at most 64 KiB (opened without following a symlink, with a symlinked `.claude` folder refused) and `answers.codex.answer` is `"yes"`; otherwise the reason is `not-opted-in`.
  2. Binary: `codex` is found on `PATH`; otherwise `not-installed`.
  3. Login: `codex login status` exits 0 within 30 seconds; otherwise `not-logged-in`.
  (Intent: Constraints, consent and opt-in; spike.)
- R4. The run is exactly `codex exec -s read-only --ephemeral --color never -C <cwd> -o <temp file> -`, started with an argv list and no shell, with the working directory set to `<cwd>`, in its own process group that is killed on timeout or on a signal.
  The temp file lives in a fresh temp folder that is removed on exit; nothing is written under `<cwd>`. (Intent: Constraints, read-only; spike.)
- R5. stdin is `# Instructions`, a blank line, the instructions, a blank line, `# Handoff`, a blank line and the prompt file's text.
  The prompt text and the instructions never appear in any argv. (Intent: Constraints; orchestrator decision.)
- R6. On success the script prints the text of the `-o` file exactly, plus a trailing newline when it lacks one, on stdout and nothing else, then exits 0.
  Codex's stderr is never printed on success, because it echoes the whole prompt.
- R7. On any failure the script prints exactly one stdout line `could-not-run: <reason>: <detail>`, prints at most the last five lines of Codex's stderr on stderr and exits nonzero:
  - exit 2 for `usage` (bad or missing arguments, an unreadable or empty instructions or prompt file, a `.toml` with no `developer_instructions` string, Python without `tomllib` for a `.toml`);
  - exit 3 for `not-opted-in`, `not-installed` and `not-logged-in`;
  - exit 4 for `timeout`, `exit-<n>` (Codex exited nonzero) and `empty-output` (exit 0 with an empty or missing `-o` file).
  The script never exits 0 with empty stdout. (Intent: Constraints, never reads as a clean review.)
- R8. `--check` prints `ready` and exits 0 when R3 passes, else prints the R7 line and exits 3; it never starts `codex exec`.

The registry and `/pro-dev` (pro-core):

- R9. `plugins/pro-core/registry/engines.json` gains a row `codex` with `owner` `pro-core`, `kind` `manual-cli`, `default` false, `bridges` `[]`, `detect` `{"bin": "codex"}` and `manual` `["npm install -g @openai/codex", "codex login"]`, with no `install` or `update` argv.
  Its `why` says the CLI runs a second code review on high-tier PRs and that a yes also agrees to send the diff to OpenAI when it runs.
  The registry `version` goes from 4 to 5. (Intent: Open questions, registry owner and kind; orchestrator decision.)
- R10. The `registry` check in `tests/check.mjs` accepts kind `manual-cli` only when `detect` is exactly `{bin}` with a name matching the engine id pattern, `manual` is a non-empty array of strings and the row has no `install` or `update` key.
  The other kinds keep their rules, including required `install` and `update` argv.
  The `installers` check skips owner `pro-core`, whose installer is `/pro-dev` itself.
- R11. `pro-dev.py` treats a `manual-cli` row this way:
  - `detected` is true when `shutil.which` finds the `bin` name; status never runs the CLI.
  - The status JSON row carries `manual`, the list from the registry.
  - `run` never executes anything for the row: a wanted row that is missing prints `<id>: install it yourself: <manual lines joined by "; then ">`, an installed row prints `<id>: already installed` on install and `<id>: update it yourself: <first manual line>` on update, each with outcome `skipped`, so the exit code does not change.
  - `answer codex yes|no` works as for any optional row.
- R12. `plugins/pro-core/commands/pro-dev.md` says that `check` prints a `manual-cli` row as installed (on PATH, login checked when a review runs), missing with its manual lines or declined; it never runs the CLI.
  `install` shows a wanted `manual-cli` row as "install by hand" with its lines and, for `codex`, says the yes is consent to send diffs to OpenAI.

pr-check (pro-ship):

- R13. `pr-check.py codex-trigger --tier <tier>` prints JSON `{run, setting, reason}`.
  The setting comes from the first line of `REVIEW.md` that matches `codex-review: <value>` (key case-insensitive); the default is `high` and an unknown value reads as `high` with the reason saying so.
  `never` gives `run` false; `always` gives true; `high` gives true only for tier `high`, which includes a classifier that could not run; tier `unclassified` under `high` gives false with reason `tier unclassified`. (Intent: Open questions, trigger.)
- R14. `pr-check.py find PLUGIN PATH` also accepts a plugin-relative path that contains a `/`, for example `.codex-plugin/agents/code-reviewer.toml`, resolved through the same search order; a path that is absolute or holds `..` or a backslash prints `not-installed`.
  A bare file name still resolves under `scripts/`.
- R15. The `pr-check` skill, after the handoff is filled, runs `codex-trigger` with the classified tier.
  When it says run, the skill writes the filled handoff to `.pro-dev/ship/handoff.md`, resolves the instructions with `find pro-quality .codex-plugin/agents/code-reviewer.toml` and runs `${CLAUDE_PLUGIN_ROOT}/scripts/codex-run.py --instructions <that path> --prompt .pro-dev/ship/handoff.md` with stdout to `.pro-dev/ship/review-codex.md`, in the same turn as the Claude dispatches so they run in parallel.
  It saves the Claude code reviewer's report to `.pro-dev/ship/review-code.md`.
  The Codex run gets the same four fields as the Claude reviewer, including `since <sha>` on a later round.
  It gets nothing else. (Intent: Proposed outcome; ADR-0012.)
- R16. The skill records `reviewers.codex` from the run:
  - trigger false: `skipped`, reason from the trigger;
  - `find` prints `not-installed` or the runner file is missing: `not-installed`, reason `runner or instructions missing`;
  - runner exit 3: `not-installed`, reason the R7 reason (`not-opted-in`, `not-installed` or `not-logged-in`);
  - runner exit 0 with the code tally line as its first line: `done`, `important` from the tally;
  - runner exit 0 without that line, exit 2, exit 4 or any other exit: `could-not-run`, reason the R7 reason or `no tally line`.
- R17. Whatever `reviewers.codex` holds, the skill does not change how `result` is computed or how the run stops.
  The report says one line for Codex: `codex       done   codex: <n> important, <a> agreed, <d> disputed` or `codex       <status> (<reason>)`. (Intent: Constraints, never fails the gate.)
- R18. A Codex Important finding never blocks the merge and never makes `result` `incomplete`; it appears in the PR body for the person to weigh. (Intent: Open questions, blocking.)
- R19. `pr-check.py agree --code FILE --codex FILE` reads both reports and prints JSON with each side's parsed findings and the lists `agreed`, `disputed`, `code_only` and `codex_only`.
  - A finding is a line that starts with `- ` or `<n>. ` and holds a location token `path:line` or `path:start-end`, with or without backticks; the first token on the line is its location.
  - Its severity is set by the nearest line above it that names `Important`, `Nits` (or `nit`) or `Pre-existing` as a heading, with or without `#` or a trailing colon.
  - Two findings match when the paths are equal and their line ranges overlap after each is widened by `NEAR = 5` lines on both sides; each finding is paired at most once, in report order.
  - A matched pair with the same severity is `agreed`; with different severities it is `disputed`.
  - No model call takes part. (Intent: Open questions, agreement; Constraints, no model picks a winner.)
- R20. `pr-check.py stamp --reviewers` accepts an optional `codex` key.
  When present, the stamp writes `reviewers.codex` as `{agent, status, reason, blocking, important, agreed, disputed, range}`: `agent` `codex:code-reviewer` or null, `status` one of `done`, `skipped`, `not-installed` or `could-not-run`, `reason` a string or null, `blocking` always 0 (a nonzero value is refused), the three counts integers of 0 or more and `range` a string or null.
  When it is absent the stamp has no `reviewers.codex` key.
  `compute_result` reads only `reviewers.code` and `reviewers.security`.
  `schema` stays 1. (Intent: Open questions, stamp; Constraints.)
- R21. `plugins/pro-ship/skills/pr-check/pr-body.md` gains a `## Reviews` section between Testing and Risk.
  When Codex ran it lists the findings in four groups from `agree`: raised by both (agreed), raised by both and rated differently (each reviewer's line as written), Claude only and Codex only, each finding tagged with its source.
  When Codex did not run it holds one line, `Codex review: <status> (<reason>)`.
  The draft never says which side of a dispute is right. (Intent: Proposed outcome; Success looks like.)

The stamp contract:

- R22. `docs/pr-check-stamp.md` lists `reviewers.codex` as optional with its fields and values, says the result rule and both readers ignore it and keeps the validity rule word for word.
  `tests/fixtures/pr-check-stamp/` gains `valid-pass-codex.json`, a passing stamp with a `reviewers.codex` of `could-not-run` and `important` 2, which `expect.json` maps to pr-gate valid and push gate accept.
  `pr-gate.py`, `push-gate.py` and `security_surface.py` do not change. (Intent: Constraints, both copies and fixtures.)

The reviewer twin (pro-quality):

- R23. `plugins/pro-quality/agents/code-reviewer.md` and its `.toml` twin gain one sentence in Findings: each finding is one list item that starts with `- ` and names its location as `path:line` or `path:start-end`.
  The two bodies stay identical. (Intent: Open questions, parsing.)
- R24. A new `agent-twins` check in `tests/check.mjs` fails when the body of `plugins/pro-quality/agents/code-reviewer.md` after its frontmatter and the `developer_instructions` of its `.toml` differ after trimming outer whitespace. (Intent: Open questions, twin.)

Tests:

- R25. `tests/codex-run.mjs` drives the runner against a stub `codex` placed first on a PATH built only from the stub folder and the folders of `python3` and `git`.
  It exports `runCodexRunCases()`, which a `codex-run` check in `tests/check.mjs` runs.
  Each case first asserts that `codex` on that PATH is the stub.
  No test starts the real Codex or touches the network.

### Non-functional

- N1. The runner's only network use is the `codex` process it starts; it adds no other call.
- N2. A Codex run on a diff of about 300 lines takes about a minute and about 40,000 tokens (spike); at the default trigger it runs only on high-tier PRs.
- N3. `codex-run.py` stays under 250 lines.
- N4. Prose follows the repo's writing rules: one sentence per line, no em dash, no Oxford comma and straight quotes.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-ship takes a minor bump (new script, new subcommands, skill and body changes), pro-core a minor bump (new kind and row), pro-quality a patch bump (one sentence in the agent and twin), each in both manifests and its marketplace entry, with `metadata.version` bumped once and a row per plugin in `docs/releases.md`.
- Hook-loading law (ADR-0003): no hook is added or changed.
- No hard dependency (ADR-0003, ADR-0006): pro-ship detects Codex by the binary through the runner and declares no dependency on pro-core or pro-quality; the instructions file is found with `find`.
- Codex parity (ADR-0004): the skill text stays harness-neutral; under a host with no script the skill's "No script" path says the Codex review was skipped; the `.toml` twin is the instruction source and the `agent-twins` check keeps it equal to the `.md`.
- Fresh context (ADR-0012): the Codex run gets the same four fields from the same template and no other text.
- Convergence (ADR-0011): a later round passes `since <sha>` to both reviewers; findings already seen are dropped by the caller for both.
- Stamp contract (ADR-0014): an added optional field, `schema` 1, readers unchanged, the contract page and fixtures change in the same commit.
- Risk tiers (ADR-0015): the trigger reads the classifier's tier, so the author cannot lower it; a classifier that could not run reads as high.
- Engine registry (ADR-0006): an opt-in row installed only when a person says yes in `/pro-dev`; the new kind and the pro-core owner are recorded in ADR-0018, which amends ADR-0006.
- Test first (orchestrator decision): every script change starts with a failing case.
- CLAUDE.md: no home-directory path in a repo file; the runner names `$CODEX_HOME` and Codex's default home in words.

## Design

### User experience

A person runs `/pro-ship:pr-check` on a high-tier branch with Codex opted in and logged in.
The report gains one line and the PR body draft gains a Reviews section:

```
pr-check on 3f9c2ab (base 81d04e7)
  build       pass   pnpm run build
  test        pass   pnpm test
  floor       pass   floor-guard.py --check
  mutation    killed src/gate.ts
  code review done   reviewer: 2 blocking, 2 important
  codex       done   codex: 3 important, 1 agreed, 1 disputed
  security    skipped-no-surface
result: fail
```

The result is `fail` because of the Claude reviewer's two Important findings; the Codex line changes nothing in it.

```
## Reviews

Raised by both (agreed)
- [Claude, Codex] plugins/x/gate.py:203 - a PR URL anywhere in the output counts as success.

Raised by both, rated differently
- [Claude, nit] plugins/x/gate.py:227 - ...
- [Codex, Important] plugins/x/gate.py:225 - ...

Claude only
- [Claude, Important] plugins/x/gate.py:88 - ...

Codex only
- [Codex, Important] plugins/x/gate.py:206 - ...
```

On a medium-tier PR the report says `codex       skipped (tier medium)` and the body says `Codex review: skipped (tier medium)`.
With Codex missing it says `codex       not-installed (not-installed)`; with no opt-in it says `codex       not-installed (not-opted-in)`, with a hint to run `/pro-dev install`.
`/pro-dev install` asks once: "codex: Codex CLI for a second code review on high-tier PRs; yes also agrees to send the diff to OpenAI when it runs. Install it?"
On yes it saves the answer and, when the binary is missing, prints the two manual lines.
`/pro-dev check` shows `codex: installed` or `codex: missing (install by hand: npm install -g @openai/codex; then codex login)`.

### System

New in pro-ship: `scripts/codex-run.py`.
Changed in pro-ship: `scripts/pr-check.py` (`codex-trigger`, `agree`, `find` with a relative path, `stamp` with `reviewers.codex`), `skills/pr-check/SKILL.md`, `skills/pr-check/pr-body.md` and both manifests.
Changed in pro-core: `registry/engines.json`, `scripts/pro-dev.py`, `commands/pro-dev.md` and both manifests.
Changed in pro-quality: `agents/code-reviewer.md`, `.codex-plugin/agents/code-reviewer.toml` and both manifests.
New at the root: `tests/codex-run.mjs`, `tests/fixtures/pr-check-stamp/valid-pass-codex.json` and `docs/decisions/0018-codex-second-reviewer.md`.
Changed at the root: `tests/check.mjs` (`registry`, `installers`, `agent-twins`, `codex-run`), `tests/ship-check.mjs`, `tests/pro-dev.mjs`, `tests/fixtures/pr-check-stamp/expect.json`, `docs/pr-check-stamp.md`, `docs/decisions/README.md`, `docs/decisions/0006-engine-registry-and-pro-dev.md` (one amended line), `docs/releases.md`, `README.md` (the pro-ship paragraph) and `.claude-plugin/marketplace.json`.
Unchanged: `pr-gate.py`, `push-gate.py`, `security_surface.py`, `merge-gate.py`, every `hooks.json` and pro-ai-sdlc.

Reuse: the runner's process-group kill follows `pr-check.py`'s `kill_group`; its consent read follows `pro-dev.py`'s `answers_problem` and `read_answers` (no symlink, 64 KiB cap); the stamp record follows `reviewer_record`; the trigger line follows the `pr-check timeout:` parse; the tests follow `tests/ship-check.mjs` and `tests/pro-dev.mjs` (stub binaries first on PATH, temp HOME).

The runner contract for the later copy: same file bytes, same arguments, same exit codes and output lines.
The doubt-driven-execute intent adds `plugins/pro-ai-sdlc/scripts/codex-run.py` and a check that the copies match; nothing here depends on that.

### Alternatives considered

- `codex exec review`: runs Codex's own review prompt and output layout, so the `code-reviewer` lenses, the four-field handoff and the tally line cannot be carried.
- Passing the instructions with `-c developer_instructions=...`: puts repo text into an argv, visible in a process list and bounded by argv size; stdin is simpler and the spike showed it works.
- Installing the `.toml` into `.codex/agents/`: Codex reads it only in interactive sessions and it would write into the repo or the person's Codex home.
- Codex's GitHub PR review integration: needs CI and Codex cloud access and reads no handoff; the intent keeps it as a later alternative.
- Owner pro-ship for the row: a pro-ai-sdlc user without pro-ship could never opt in while the doubt-driven step needs the same consent.
- A model call that merges the two reports: ruled out by the intent.
- Consent read only by pr-check: the doubt-driven caller would need its own copy; keeping it in the runner makes every caller safe.
- Treating a Codex Important as blocking: the person has not calibrated Codex yet and a tool outage must not block a merge.

## Flagged concerns

Sources read: the policies listed at the top.

ADR needed: yes, a second reviewer from another vendor that is advisory in the gate, the consent rule, the stamp field, the agreement rule and a detect-only registry kind owned by pro-core set rules other work follows; drafted as [ADR-0018](../../docs/decisions/0018-codex-second-reviewer.md) (proposed).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | Codex loads `AGENTS.md` on its own, from the repo and from the person's Codex home, so the reviewer sees more than the four fields. | ADR-0012; Jody | resolved: the repo's `AGENTS.md` is a policy file the handoff already names and the person's own Codex file matches the user `CLAUDE.md` a Claude subagent loads, so no session text leaks; recorded in ADR-0018 |
| 2 | ADR-0006 says every row has install and update argv and every row owner ships `/<plugin>:install`; the `manual-cli` kind has neither and pro-core owns the row with `/pro-dev` as its installer. | ADR-0006 | resolved: ADR-0018 records both and ADR-0006 gets one amended line; Jody accepts at sign-off |
| 3 | The consent answer lives in the committed `.claude/pro-dev.json`, so one person's yes sends diffs to OpenAI for every teammate who has Codex logged in. | intent Constraints; Jody | open: keep consent per repo as the unit for vendor exposure that fits a solo repo today (recommended) or add a per-person answer when the scaling block lands |
| 4 | The intent says overlapping line ranges; exact overlap misses a bug cited two lines apart, so R19 widens each range by five lines. | intent Open questions | resolved: the window is a named constant `NEAR = 5` in `pr-check.py`, recorded in ADR-0018 and tunable after the first high-tier PRs |
| 5 | `docs/pr-check-stamp.md` says `reviewers` holds exactly `code` and `security`. | ADR-0014 | resolved: the page now allows an optional `codex`; both readers already ignore unknown keys, a fixture proves it and no reader rule changes |
| 6 | The Codex twin says "nothing you run sends the diff anywhere" while the run itself sends the diff to OpenAI. | `code-reviewer.toml`; intent Constraints | resolved: the sentence covers the agent's own commands and the opt-in answer is the consent for the vendor; the twin text stays equal to the `.md` |
| 7 | A host command limit of 600 seconds could cut the runner off before its own timeout and leave no could-not-run line. | pr-check SKILL.md | resolved: the runner's default timeout is 540 seconds and a missing or empty output file is read as `could-not-run` |
| 8 | Codex's report layout drifts from the Claude reviewer's (numbered items, bold labels, em dashes). | spike | resolved: R19 parses both forms, R23 pins the location form and a finding with no location is listed as one-model |
| 9 | The merge prompt does not show Codex findings; the intent says the person weighs them at the approval prompt. | ADR-0015; `merge-gate.py` | open: the PR body carries them and the merge gate is unchanged here (recommended); showing them in `merge-gate.py` is a later change |

## Open questions

1. How the run is invoked: answered, `codex exec -s read-only --ephemeral` with the instructions and the handoff on stdin (spike, R4, R5); `codex exec review` cannot carry the agent.
2. How the output is parsed: answered, the same tally line as the Claude reviewer, matched as a whole first line; a missing tally is `could-not-run` (R16).
3. Where the second reviewer sits in the stamp: answered, an optional `reviewers.codex` with the reviewer fields plus `reason`, `agreed` and `disputed`, informational in the result rule, `schema` 1 (R20).
4. Whether a Codex Important finding blocks: answered, no, not at first (R18).
5. How agreement is decided: answered, deterministic match on path and nearby lines, no model (R19, flagged concern 4).
6. The trigger: answered, `codex-review: always | high | never` in `REVIEW.md`, default `high` (R13); `.claude/pro-dev.json` holds only the consent.
7. Where the runner lives: answered, `plugins/pro-ship/scripts/codex-run.py` with no plugin-specific path, copied byte for byte into pro-ai-sdlc by the doubt-driven-execute intent (R1).
8. Which plugin owns the row: answered, pro-core, because two plugins use it and pro-core is always present when `/pro-dev` runs; pro-ship and later pro-ai-sdlc detect the binary through the runner (R9).
9. What the registry kind is: answered, `manual-cli`, detect-only with printed manual lines (R9 to R12).
10. How the `.toml` stays a twin: answered, the `agent-twins` check (R24); parity did not assert it.
11. Likely needs an ADR: answered, yes, ADR-0018.

## Acceptance criteria

- AC1. `node tests/check.mjs && node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC2. `node tests/codex-run.mjs` passes every case: argv has `exec -s read-only --ephemeral` and `-o` and ends with `-`; stdin starts with `# Instructions` and holds `# Handoff` and the prompt; the prompt text is in no argv; exit 0 prints the stub's report; `not-opted-in`, `not-installed` and `not-logged-in` exit 3 without starting `codex exec`; a sleeping stub with `--timeout 1` exits 4 with `could-not-run: timeout`; a stub exit 1 gives `exit-1`; an empty report gives `empty-output`; a missing prompt file exits 2; `--check` prints `ready`.
- AC3. `grep -n "pro-ship\|pro-quality\|pro-core" plugins/pro-ship/scripts/codex-run.py` prints nothing and one case in `tests/codex-run.mjs` copies the script to a temp folder and gets the same success output from there.
- AC4. `engines.json` has the `codex` row of R9 and `node tests/check.mjs registry` passes; a temp copy of the row with an `install` argv makes the check fail (a case in the check's own test or a manual edit reverted).
- AC5. `node tests/pro-dev.mjs` passes new cases: with a stub `codex` on PATH the row is `installed`; without it the row is `missing` and carries `manual`; `run all install` after `answer codex yes` prints the install-it-yourself line, starts no process from the row and exits 0.
- AC6. `node tests/ship-check.mjs` passes new cases for `codex-trigger` (each setting by each tier), `find` with a relative path and a refused `..` path, `agree` (agreed, disputed, one-sided and the Codex numbered layout from the spike) and `stamp` (a `codex` record with `important` 3 and status `could-not-run` leaves `result` `pass`; a nonzero `blocking` is refused; no `codex` key leaves no `reviewers.codex`).
- AC7. `node tests/check.mjs stamp-contract` passes with `valid-pass-codex.json` listed in `expect.json`; `git diff main -- plugins/pro-ship/scripts/pr-gate.py plugins/pro-security/scripts` is empty.
- AC8. `node tests/check.mjs agent-twins` passes; changing one word in the `.toml` body makes it fail; both files hold the location sentence of R23.
- AC9. On a real high-tier PR in this repo, `/pro-ship:pr-check` with Codex opted in writes a stamp whose `reviewers.codex.status` is `done` and a PR body with the Reviews section of R21, each finding tagged; run once by hand and pasted into the PR.
- AC10. The same run with `codex` off PATH prints one `codex       not-installed (not-installed)` line, the body says `Codex review: not-installed (not-installed)` and `result` equals what it was with Codex.
- AC11. pro-ship, pro-core and pro-quality each have equal versions in both manifests and their marketplace entries, `metadata.version` is bumped once and `docs/releases.md` has a row for each.
- AC12. `docs/decisions/0018-codex-second-reviewer.md` exists with status proposed and a row in `docs/decisions/README.md`; ADR-0006 carries an amended line naming ADR-0018; `docs/pr-check-stamp.md` documents `reviewers.codex`.
- AC13. `python3 plugins/pro-core/scripts/pro-dev.py status --json` run in this repo lists a `codex` row with `kind` `manual-cli` and a `manual` list; `plugins/pro-core/commands/pro-dev.md` names how `check` and `install` show a `manual-cli` row.

## Out of scope

Codex's GitHub PR review integration.
A Codex security review; the security reviewer stays Claude only.
A Codex review at the medium tier by default or on every PR (a repo can set `codex-review: always`).
A third reviewer or a skeptic pass.
Letting Codex approve, fix, comment or push.
Running the reviewers in GitHub Actions (`pipeline`).
The doubt-driven step, its pro-ai-sdlc copy of the runner and the byte-identity check for it.
Installing or logging in to Codex for the person; `/pro-dev` only prints the lines.
Showing Codex findings in `merge-gate.py` (flagged concern 9).
