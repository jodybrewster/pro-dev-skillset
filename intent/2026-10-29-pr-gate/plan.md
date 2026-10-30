# Plan: the PR gate

Built from `spec.md` (commit df45b5a, open questions recorded on 2026-10-30) and `intent.md` in this folder.
Status: implemented.
Approver: Jody Brewster (2026-10-30: "keep going and finish P0 you have my approval on all").
It ships a new hook on `gh pr create` to every repo that installs pro-ship, changes pro-security's push gate and removes a pro-quality hook, which is why an approver is named.
No second approver is needed because Jody owns this marketplace and decided every open question and flagged concern below under that approval.
The blast radius stays small: the hook starts in warn mode, reads one file, makes no network calls and fails open on any error.
Dated: 2026-10-30.

## Decisions taken under the approval

Each item was open in the spec or its flagged concerns.
Each is decided on 2026-10-30 under Jody's approval, using the recommendation already written in the spec or in `docs/roadmap.md`.
The spec's "Open questions" section records the same answers.

- Open question 1, subagent or `claude -p`: decided on 2026-10-30 under Jody's approval, a subagent with the four-field handoff; `claude -p` stays a later option for CI.
- Open question 2, where the hook lives: decided on 2026-10-30 under Jody's approval, pro-ship, with pro-quality's old gate removed outright.
- Open question 3 and flagged concern 2, pro-ship in the starter: decided on 2026-10-30 under Jody's approval, pro-ship joins `pro-dev-starter` in this same release, so a starter-only repo never goes without a PR check.
- Open question 4 and flagged concern 8, finding a sibling plugin's script: decided on 2026-10-30 under Jody's approval, by the method Claude Code documents, verified as described under "Sibling lookup" below.
- Open question 5, the per-command timeout: decided on 2026-10-30 under Jody's approval, keep 300 seconds per command, raised by a line `pr-check timeout: <seconds>` in the repo's `CLAUDE.md` or `AGENTS.md`.
- Open question 6, the default mode: decided on 2026-10-30 under Jody's approval, warn; enforce is a later change after clean logs (AC13).
- Open question 7, draft PRs: decided on 2026-10-30 under Jody's approval, `gh pr create --draft` (or `-d`) does not need the stamp and passes with no output, since a draft is not yet asking for review.
- Open question 8, the tier before the classifier: decided on 2026-10-30 under Jody's approval, the fixed value `unclassified`.
- Open question 9, when the security review runs: decided on 2026-10-30 under Jody's approval, only when pro-security's classifier reports security surface for the diff.
- Open question 10, the ADR: decided on 2026-10-30 under Jody's approval, it ships in this PR as `docs/decisions/0014-gate-stamp.md` with Status `proposed` (0012 is the review handoff ADR in #87).
- Flagged concern 1, what the old gate did that goes away: decided on 2026-10-30 under Jody's approval, accept; the drafted PR body replaces the 50-character length check and the stamp hook names the missing check.
- Flagged concern 3, three gates behave three ways: decided on 2026-10-30 under Jody's approval, keep deny once per HEAD; the local hook is a guardrail and CI is the enforcement; revisit when `pipeline` lands.
- Flagged concern 4, two copies of the validity rule: decided on 2026-10-30 under Jody's approval, copy the rule into both plugins and hold them together with one fixture set and a `stamp-contract` check in `tests/check.mjs` (R27).
- Flagged concern 5, a forged stamp: decided on 2026-10-30 under Jody's approval, accept for a local guardrail and rely on the required CI check later; the ADR says so.
- Flagged concern 6, the sibling specs: decided on 2026-10-30 under Jody's approval, code-reviewer (#87) lands first; its spec was re-read for this plan and R7 matches its four fields.
  One mismatch is resolved here: code-reviewer has two severities (`Important`, `nit`) and no "Blocking".
  For a code reviewer the stamp's `blocking` is the `important` count from its summary line, because `REVIEW.md` says Important findings block the merge and ADR-0011 keeps Pre-existing findings out of that count.
- Flagged concern 7, the security reviewer's output: decided on 2026-10-30 under Jody's approval, pin a tally line.
  `security-architect` today has no summary line in diff mode, only per-finding severities (`blocking`, `should-fix`, `note`) and a verdict.
  Its diff mode gains one last line, `blocking: <n>  should-fix: <n>  notes: <n>`, in the agent and its Codex `.toml`; the stamp's `blocking` reads from it and `important` takes `should-fix`.

Two smaller choices the spec left to the plan, decided on 2026-10-30 under Jody's approval:

- A repo's verify block, when found, is the whole check list.
  The first fenced `bash` block under a heading that starts with "Verif" in `CLAUDE.md` or `AGENTS.md` wins (R3, AC3); each command line becomes a step named `verify:<n>` and package, Python and Makefile discovery is skipped.
  The mutation check uses the `test` step when there is one, else the first verify command whose text contains `test`, else it records `could-not-run`.
- A `mutation: survived` result is confirmed by the person through `pr-check.py stamp --accept-mutation`, which records `mutation.accepted: true` and lets `result` be `pass` (R29 "until the person confirms").

### Sibling lookup

Verified on 2026-10-30 against the Claude Code plugin loading reference ("Find plugins on disk") and this machine.
The plugins root is `CLAUDE_CODE_PLUGIN_CACHE_DIR` when set, else `.claude/plugins` under the user's home.
A copied marketplace plugin lives at `cache/<marketplace>/<plugin>/<version>/` and `${CLAUDE_PLUGIN_ROOT}` points at that version folder, so the spec's `${CLAUDE_PLUGIN_ROOT}/../<plugin>/` misses: the sibling is two levels up and the version is not known.
`installed_plugins.json` in the plugins root records each install with `scope`, `projectPath` (project and local scope), `installPath` and `version`; on this machine pro-quality has several project-scope records at different versions, one per project.
A plugin from a marketplace added by local path loads in place, so there `${CLAUDE_PLUGIN_ROOT}/../<plugin>/` is right.

`pr-check.py` finds `<plugin>/scripts/<file>` in this order and records the path it used:

1. `<own root>/../<plugin>/scripts/<file>`, the in-place layout.
2. `installed_plugins.json`: the `<plugin>@<marketplace>` records (the marketplace read from pro-ship's own path or its own record), preferring a project or local record whose `projectPath` is the repo root or an ancestor of it, then the user record; take that record's `installPath`.
3. The repo's own `plugins/<plugin>/scripts/<file>`, only when the repo's `.claude-plugin/marketplace.json` lists that plugin (this repo dogfooding).
4. Otherwise `not-installed`.

The install record does not say whether the plugin is enabled; a disabled sibling that is still installed is used and its path shows in the stamp (see Risks).

## Files that change

New in pro-ship:

- `plugins/pro-ship/skills/pr-check/SKILL.md` (new): the skill (R1, R6 to R10, R16, R29 orchestration), harness-neutral, standard frontmatter.
- `plugins/pro-ship/skills/pr-check/discovery.md` (new): sidecar with the discovery order of R3 and the verify-block rule above, so the skill and the script agree in prose.
- `plugins/pro-ship/skills/pr-check/pr-body.md` (new): sidecar template for the Testing, Risk and How to revert sections (R16).
- `plugins/pro-ship/scripts/pr-check.py` (new): `discover`, `run`, `stamp` and `find` subcommands, Python 3 standard library (R2 to R5, R11 to R15, R29, N3, N5).
- `plugins/pro-ship/scripts/pr-gate.py` (new): the `PreToolUse` stamp hook (R17 to R24, N1, N2).
- `plugins/pro-ship/hooks/hooks.json` (new): one `PreToolUse` `Bash` entry for `pr-gate.py`, timeout 15 (R17, hook-loading law).

Modified in pro-ship:

- `plugins/pro-ship/.claude-plugin/plugin.json` and `plugins/pro-ship/.codex-plugin/plugin.json` (modified): version 0.2.0 to 0.3.0 and a description that names `pr-check` and the PR gate; no dependency added (R28).

Modified in pro-quality:

- `plugins/pro-quality/scripts/pr-quality-gate.py` (deleted): replaced by pr-gate (R25).
- `plugins/pro-quality/hooks/hooks.json` (modified): drop the `mcp__github__create_pull_request` and `Bash` `PostToolUse` entries that run it; nothing else moves (R25).
- `plugins/pro-quality/.claude-plugin/plugin.json` and `plugins/pro-quality/.codex-plugin/plugin.json` (modified): the next minor over main at build time (0.15.0 at earliest, after code-reviewer's 0.14.0) and a description without the PR gate.
- `tests/quality-hooks.mjs` (modified): remove the `pr-quality-gate.py` cases and the `GATE` constant (R25).

Modified in pro-security:

- `plugins/pro-security/scripts/security_surface.py` (modified): a small `read_stamp(root, head)` helper that returns the stamp only when it is valid by R20 (R26).
- `plugins/pro-security/scripts/push-gate.py` (modified): accept with no output when the stamp is valid and `reviewers.security` is `done` or `skipped-no-surface` with `blocking` 0 (R26).
- `plugins/pro-security/agents/security-architect.md` and `plugins/pro-security/.codex-plugin/agents/security-architect.toml` (modified): the diff-mode tally line (flagged concern 7), the same words in both.
- `plugins/pro-security/.claude-plugin/plugin.json` and `plugins/pro-security/.codex-plugin/plugin.json` (modified): 0.2.0 to 0.3.0 or the next minor over main.
- `tests/security-hooks.mjs` (modified): the push-gate stamp cases (AC6, AC7).

Modified in the starter:

- `plugins/pro-dev-starter/.claude-plugin/plugin.json` (modified): add `pro-ship` to `dependencies`, description updated, 3.0.0 to 3.1.0 (decision on open question 3).

Modified and new at the root:

- `docs/decisions/0014-gate-stamp.md` (new): the shared stamp ADR, Status `proposed`.
- `docs/decisions/README.md` (modified): its row.
- `docs/pr-check-stamp.md` (new): the stamp contract (fields, validity, who reads what, the two tally lines), written once (R27).
- `docs/README.md` and `docs/hook-loading.md` (modified): link the contract page.
- `tests/fixtures/pr-check-stamp/` (new): stamp fixtures plus `expect.json` mapping each to the pr-gate verdict and the push-gate verdict (R27, AC7).
- `tests/ship-hooks.mjs` (new): pr-gate cases (AC5).
- `tests/ship-check.mjs` (new): `pr-check.py` cases (AC3, AC4, AC8, AC9, AC14 to AC16).
- `tests/check.mjs` (modified): `ship-hooks`, `ship-check` and `stamp-contract` checks; `pro-ship` removed from the starter check's `OPT_IN` set.
- `tests/cases/routing.jsonl` (modified): one case that expects `pr-check` (AC12).
- `.claude-plugin/marketplace.json` (modified): pro-ship, pro-quality, pro-security and pro-dev-starter entries and `metadata.version` to the next minor (1.63.0 at earliest).
- `README.md` (modified): the pro-ship and pro-dev-starter bullets, the "opt-in" line and the Ship row of the skills table.
- `docs/roadmap.md` (modified): item 2 marked in progress, the pr-gate questions removed from "Questions waiting on Jody" and item 2's stale "never fired" sentence corrected.

At sign-off only:

- `docs/decisions/0014-gate-stamp.md` (modified): Status to accepted.
- `intent/2026-10-29-pr-gate/intent.md` and `spec.md` (modified): `status` to accepted.
- This file (modified): Status to implemented and the Done block filled in.

Not changed on purpose:

- `plugins/pro-core`: the router (`using-pro-dev`) is not taught `pr-check` here, so pro-core does not move; `node tests/check.mjs` gains one "router never mentions shipped skill" warning, left for a pro-core change.
  `plugins/pro-core/registry/engines.json` gets no row because the skill is not an engine (ADR-0006).
- `plugins/pro-quality/skills/requesting-code-review/handoff.md` and `agents/code-reviewer.md`: owned by #87; pr-check fills the template and changes neither.
- `plugins/pro-ai-sdlc/scripts/production-gate.py`: it may read the stamp later under the ADR, not in this change.
- `CLAUDE.md` and `AGENTS.md`: the expected counts in "Verifying your work" go stale by a few checks and one skill; refreshing them is a separate docs change, as in constraint-floor.
- `.gitignore`: R15 writes `.pro-dev/` to `.git/info/exclude`, which is local and untracked.

## Order of work

Step 0 is a gate, step 1 is the shared contract and steps 2 to 15 run as five tracks on disjoint files.
The orchestrator dispatches tracks A to E to five Sonnet subagents at once in one turn, each with a self-contained prompt that quotes its requirements, the contract page from step 1 and the decisions above.
Steps 16 to 22 need the tracks to finish and run in order.
Take the build off a worktree based on a fresh `origin/main`, because Jody merges in parallel.

0. Prerequisite. Run `git fetch origin` and confirm on `origin/main` that `plugins/pro-quality/agents/code-reviewer.md`, `plugins/pro-quality/skills/requesting-code-review/handoff.md` and `docs/decisions/0012-*.md` exist and that `handoff.md` names exactly `range`, `brief`, `policy` and `risk`.
   If #87 has not merged, tracks A, B, C and E still build (the deterministic half) and track D waits for it.
   Check: `git ls-tree origin/main` lists the three files.

1. The shared contract. Satisfies R11, R13, R20, R26, R27 in prose and the ADR.
   Write `docs/pr-check-stamp.md`: the stamp path, every field of R11 with its allowed values, `reviewers` as an object keyed `code` and `security` (each `agent`, `status`, `blocking`, `important`, `range`), `mutation` as `{status, reason, file, accepted}`, the `result` rule of R13 with AC9 and AC16 folded in, the validity rule of R20, the push-gate acceptance rule of R26 and the two tally lines that feed `blocking`.
   Spell out that `not-installed` for the code reviewer makes `result` `incomplete` (AC9, AC11), which R13's wording leaves open.
   Write `docs/decisions/0014-gate-stamp.md` (context, decision: one writer, many readers, bound to HEAD, deny once, forgery accepted for a local guardrail; consequences; "Where it is enforced"), its row in `docs/decisions/README.md` and the links from `docs/README.md` and `docs/hook-loading.md`.
   Write `tests/fixtures/pr-check-stamp/`: `valid-pass.json`, `valid-security-skipped.json`, `stale-head.json`, `result-fail.json`, `result-incomplete.json`, `security-blocking.json`, `wrong-schema.json`, `corrupt.json` and `expect.json`; `head` is the placeholder `HEAD` that each runner swaps for the throwaway repo's sha.
   Check: every field named in the page appears in `valid-pass.json` and the page has no em dash.

Track A: `pr-check.py` (one subagent, steps in order, test first in each).

2. `discover`. Satisfies R2 (discover), R3, AC3.
   Cases first in `tests/ship-check.mjs`, exported as `runShipCheckCases()`: throwaway repos for a `package.json` with all four scripts and `pnpm-lock.yaml` (expects `pnpm run build` and so on), one with `tsconfig.json` and no `typecheck` script (expects `tsc --noEmit` through the package manager's exec), `bun.lock` and `yarn.lock` variants, `pyproject.toml` with ruff, mypy and `tests/` (expects `ruff check`, `mypy .`, `pytest`), a Makefile with `check` only, an empty repo (four `not-found`) and a `CLAUDE.md` verify block that wins over `package.json`.
   Then write the subcommand; it prints JSON and never writes.
   Check: `node tests/ship-check.mjs` passes the discover cases.

3. `run`, one step per call. Satisfies R4, N5, AC4.
   The host's Bash tool caps a call at ten minutes, so four steps of up to 300 seconds cannot run in one call.
   `run --step <name>` runs one discovered step and merges its record into `.pro-dev/ship/run.json` keyed by HEAD; `run` with no step runs all, for a shell or CI.
   `run` refuses with a message when a tracked file has uncommitted changes, for the same reason R14 gives and because step 5 restores files with `git checkout`.
   Cases first: a passing, a failing and a sleeping command (`timeout` with the limit lowered by the agent-file line), output longer than 20 lines tailed to 20, a line with `ghp_` plus 36 characters built at run time replaced by `[redacted]` along with `sk-ant-` and `AKIA`, the process group killed on timeout and a refusal on a dirty tree.
   Check: `node tests/ship-check.mjs` passes.

4. Floor and sibling lookup. Satisfies R5, R28, the sibling decision.
   Cases first: `find <plugin> <file>` with a fake plugins root through `CLAUDE_CODE_PLUGIN_CACHE_DIR` holding an `installed_plugins.json` with a user record and a project record for the repo (project wins), one with a record for another project (user record used), an in-place sibling folder (wins) and no record (`not-installed`).
   `run --step floor` runs `python3 <floor-guard.py> --check` and maps exit 0, 1 and 2 to `pass`, `findings` and `could-not-run`; a missing guard is `not-installed`.
   Check: the cases pass and, by hand, `python3 plugins/pro-ship/scripts/pr-check.py find pro-quality floor-guard.py` in this repo prints this repo's script path.

5. The mutation check. Satisfies R29, AC14, AC15.
   Cases first: an added untested `if` in a source file (`survived`), the same with a test that covers it (`killed`), a test-only diff (`skipped`, test-only), tier `low` passed by flag (`skipped`, low tier), a diff with no condition (`skipped`, no condition), no runnable test command (`could-not-run`) and a test command killed mid-run; after each, `git status --short` is empty and the file is byte-identical to `git show HEAD:<file>`.
   `run --step mutation` takes the first changed non-test line in the range that has a condition, flips one operator (`==` and `!=`, `===` and `!==`, `<` and `>=`, `>` and `<=`, `&&` and `||`, ` and ` and ` or `) or wraps an `if` condition in a negation, writes the file, reruns the test command once and restores in a `finally` block followed by `git checkout -- <file>`.
   A file counts as a test file by the same patterns as `floor-guard.py`; "related tests" means a test file whose text names the changed file's stem, else `skipped` with "no related tests".
   Check: `node tests/ship-check.mjs` passes; the kill case leaves no change.

6. `stamp`. Satisfies R11 to R15, AC8, AC9, AC16.
   Cases first: a stamp from a passing `run.json` and two reviewer records has every R11 field and `result: pass`; a `fail` step gives `fail`; a code reviewer `not-installed`, a floor `could-not-run`, `mutation: survived` and `mutation: could-not-run` each give `incomplete`; `--accept-mutation` turns `survived` into `pass`; a `run.json` for another HEAD is refused; a modified tracked file is refused with a message; afterwards `git status --short` is empty and `.pro-dev/` is in the file `git rev-parse --git-path info/exclude` names (a worktree keeps it outside `.git/info`).
   Reviewer records come in through `--reviewers <json>`, which the skill builds from the tally lines.
   Check: `node tests/ship-check.mjs` passes and the stamps written match the fixture shapes from step 1.

Track B: `pr-gate.py` (one subagent, steps in order, test first).

7. Matching. Satisfies R18, R19, R24, N1, N2, the draft decision.
   Cases first in `tests/ship-hooks.mjs`, exported as `runShipHookCases()`, with `CLAUDE_GUARD_DIR`, `HOME` and `PRO_DEV_STATE_DIR` set to temp folders: `git push`, `git commit -m "gh pr create"`, `echo gh pr create`, `gh pr create --help`, `gh pr create --draft`, `gh pr create -d` and a heredoc that contains the words all pass with no output; `cd repo && GH_TOKEN=x gh pr create` and `gh pr create -R owner/repo` are acted on; a non-git cwd, a malformed payload and an empty command exit 0.
   Then write the parser, copied from `plugins/pro-quality/scripts/floor-guard.py` (heredoc stripping, segment splitting, wrapper skipping, `cd` resolution) with a comment naming the source plus a cheap first test (`"gh" in cmd and "pr" in cmd`) so other commands return in well under 100 milliseconds.
   Check: the cases pass.

8. Verdicts. Satisfies R20 to R23, AC5, AC7.
   Cases first, each as a pair that blocks and one that allows: no stamp denies in enforce and warns in warn; stale head, `fail`, `incomplete`, wrong schema and corrupt stamps deny with the cause named (missing, unreadable, stale or not passing); the identical retry on the same HEAD passes; a new commit is denied again; a valid stamp passes with no output; `mode.pr-gate` overrides `mode`; warn logs one `warn.log` line and shows the message once per HEAD.
   The fixture cases loop over `tests/fixtures/pr-check-stamp/expect.json`.
   Then write the verdict code: one `git rev-parse HEAD` with a 5 second timeout, the stamp read, mode lookup and `warn.log` format copied from `plugins/pro-ai-sdlc/scripts/guard.py`, session state keyed as in `security_surface.state_path` under a `ship` folder.
   Check: `node tests/ship-hooks.mjs` passes.

9. Timing. Satisfies N1.
   One case times 50 non-PR Bash payloads and asserts a median under 100 milliseconds and one `gh pr create` under 1 second, with looser bounds when `CI` is set.
   Check: the case passes.

Track C: pro-security (one subagent).

10. The push gate accepts the stamp. Satisfies R26, AC6, AC7.
    Cases first in `tests/security-hooks.mjs`: a security-surface diff with `valid-pass.json` (security `done`, `blocking` 0) passes with no output; with `valid-security-skipped.json` passes; with no stamp, `stale-head.json` or `security-blocking.json` denies once as today; the fixture loop over `expect.json` uses the push-gate column.
    Then add `read_stamp` to `security_surface.py` and call it in `push-gate.py` after the diff is known to touch surface and before the deny.
    Check: `node tests/security-hooks.mjs` passes, old cases included.

11. The tally line. Satisfies flagged concern 7.
    In `plugins/pro-security/agents/security-architect.md` diff mode, step 6 ends with "Last line: `blocking: <n>  should-fix: <n>  notes: <n>`" and the same sentence goes into `security-architect.toml`.
    Check: `node tests/check.mjs agents` passes and a grep finds the line in both files.

Track D: the skill and its words (one subagent; waits on step 0 for the handoff).

12. `SKILL.md` and sidecars. Satisfies R1, R6 to R10, R16, R29 orchestration, N4.
    The flow: refuse on a dirty tree; `discover`; `run --step` per step with the host's longest command timeout; stop on a `fail`; mutation at non-low tier; classify security surface by piping `git diff <base>...HEAD` into the `security_surface.py` that `find` returns; dispatch the code reviewer (`pro-quality:code-reviewer`, else `pro-ai-sdlc:reviewer`, else `not-installed`, chosen from the agents the host offers) and, on surface, `security-architect` in diff mode, in one turn, each with only the filled `handoff.md` and the stamp path in `risk`; parse the two tally lines; `stamp`; write `.pro-dev/ship/pr-body.md` from `pr-body.md`; print the report in the format of the spec's User experience.
    Convergence (R10, ADR-0011): a re-run whose last stamp head is an ancestor of HEAD reviews from that head (`since`), drops findings already raised and stops after the third round to ask the person.
    With no `REVIEW.md` it says so and points to `/sdlc-init`.
    Codex and hosts with no subagents (R9): apply each reviewer's skill inline and record `inline`; when `${CLAUDE_PLUGIN_ROOT}` is not substituted or the script is missing, it runs the discovered commands by hand, reports them and says no stamp was written, since the stamp hooks are Claude only.
    The skill tells the person to run it before the first push so the push gate reuses its security review.
    Check: `node tests/check.mjs` frontmatter, sidecar and codex-parity checks pass for the skill and a grep shows no home-directory path.

13. Routing. Satisfies AC12.
    Append a case to `tests/cases/routing.jsonl` whose prompt asks to check a branch before opening a PR and expects `pr-check`, with a `notOneOf` for `requesting-code-review` if the lexical gate confuses them.
    Check: `node tests/eval.mjs --dry` and `node tests/route-lexical.mjs --min-rank1 70` pass.

Track E: remove the old gate (one subagent).

14. Delete it. Satisfies R25, AC2.
    `git rm plugins/pro-quality/scripts/pr-quality-gate.py`, remove its two entries from `plugins/pro-quality/hooks/hooks.json` and its cases and `GATE` constant from `tests/quality-hooks.mjs`.
    Check: `grep -c pr-quality-gate plugins/pro-quality/hooks/hooks.json` prints 0 and `node tests/quality-hooks.mjs` passes.

15. Docs and README. Satisfies the starter decision in prose.
    Update the pro-ship and pro-dev-starter bullets, the opt-in line and the Ship row in `README.md` and the `docs/roadmap.md` lines named under Files.
    Check: `git grep -n pr-quality-gate -- ':!intent' ':!docs/roadmap.md'` prints nothing.

Join steps (serial, after the five tracks).

16. Wire the tests. Satisfies R27, AC5, AC7.
    In `tests/check.mjs` add `ship-hooks` and `ship-check` beside `quality-hooks` and a `stamp-contract` check that runs the fixture loop of both hooks and fails when one hook's verdict for a fixture differs from `expect.json`.
    Prove it can fail: flip one `expect.json` value, see `node tests/check.mjs` fail, flip it back.

17. Register the hook. Satisfies R17, AC2.
    `git add plugins/pro-ship/scripts/pr-gate.py plugins/pro-ship/scripts/pr-check.py` first, then write `plugins/pro-ship/hooks/hooks.json`.
    Check: `grep -c pr-gate.py plugins/pro-ship/hooks/hooks.json` prints 1 and `node tests/check.mjs hooks` passes.

18. The starter. Satisfies the starter decision.
    Add `pro-ship` to `plugins/pro-dev-starter/.claude-plugin/plugin.json` and remove it from `OPT_IN` in `tests/check.mjs`.
    Check: `node tests/check.mjs pro-dev-starter` passes with no new warning.

19. Version bumps, last, read from main. Satisfies ADR-0002.
    `git fetch origin` and take the next minor over `origin/main` for pro-ship, pro-quality, pro-security and pro-dev-starter (expected 0.3.0, 0.15.0, 0.3.0 and 3.1.0) and for `metadata.version` (expected 1.63.0), in both manifests of each plugin with a `.codex-plugin` and in the marketplace entries, in the same commit as the content.
    Check: `node tests/check.mjs` version checks pass and `git diff origin/main -- .claude-plugin/marketplace.json` shows four entries and `metadata.version`.

20. Run every check. Satisfies AC1.
    Run the commands under "Proof of done" and fix what fails.

21. Dogfood. Satisfies AC10, AC11 and part of AC5.
    Run the skill on this branch: it reads this repo's verify block, runs it, runs the floor guard and mutation, dispatches the reviewers and writes the stamp and `pr-body.md`; paste the report and the body into the PR.
    Then in a throwaway Claude Code profile with only pro-ship installed, run the skill on a throwaway repo and confirm each sibling reads `not-installed`, the result is `incomplete` and pr-gate and the push gate still load.
    Then open this PR with `gh pr create` on the stamped HEAD and confirm pr-gate is silent.

22. Review pass. Satisfies REVIEW.md passes 1 to 3.
    Run `/review` on the finished diff with the reviewer at high effort and the policy paths only; fix every Important finding and record departures below in the same commit.
    Then mark the PR ready and stop; AC13 starts after merge.

## Tests that prove it

- AC1: the commands under "Proof of done", run in full.
- AC2: the `grep -c` and `git ls-files` lines in "Proof of done" (steps 14 and 17).
- AC3: `tests/ship-check.mjs` discover cases for pnpm, bun, yarn, tsconfig, Python, Makefile, empty and the verify block (step 2).
- AC4: `tests/ship-check.mjs` run cases for pass, fail, timeout, tailing and redaction with tokens built at run time (step 3).
- AC5: `tests/ship-hooks.mjs`, every blocking case paired with an allowing one, plus the draft and timing cases (steps 7 to 9).
- AC6: the new cases in `tests/security-hooks.mjs` (step 10).
- AC7: both hook files read `tests/fixtures/pr-check-stamp/` and the `stamp-contract` check fails on a disagreement, shown once by flipping a value (step 16).
- AC8, AC9 and AC16: `tests/ship-check.mjs` stamp cases (step 6).
- AC10: the dogfood run pasted into the PR (step 21).
- AC11: the throwaway-profile run (step 21) and the `find` cases with no record (step 4).
- AC12: the routing case and the lexical gate (step 13).
- AC13: after merge, `grep pr-gate` over `warn.log` in the guard folder after a week in two of Jody's repos; it gates the later switch to enforce, not this PR.
- AC14 and AC15: `tests/ship-check.mjs` mutation cases with a byte comparison after each (step 5).
- N1: the timing case (step 9).
- N2 and N3: a read of both scripts in step 22 and a grep for `import` lines outside the standard library.
- R6 to R10 and R16 are prose in a skill, so no script proves them; the dogfood run and the review are the evidence.

## Risks

The step most likely to go wrong is step 5, the mutation check.
It is the only code in this change that edits a tracked file and it does so in the person's working tree.
A crash between the write and the restore or a test command that rewrites the file itself could leave the tree changed.
Three guards hold it: `run` refuses a dirty tree, so `git checkout -- <file>` can never discard the person's own work; the restore runs in `finally` and then again through git; and every AC14 case ends with a byte comparison against `HEAD`.
A `kill -9` of the script itself skips `finally`; the next `run` sees a dirty tree, refuses and names the file, which is the right outcome.
Choosing "related tests" by the file stem is crude; a miss reads as `skipped`, never as `killed`, so it cannot make a stamp pass that should not.

The second is the sibling lookup.
It depends on `installed_plugins.json`, a file Claude Code documents but can change.
A change there makes siblings read `not-installed` and the result `incomplete`, which fails safe: pr-gate denies once and the retry passes.
A disabled but installed pro-quality or pro-security is still found and run, because the install record does not carry the enabled flag; the stamp records the path used so a reader can see it.

The third is reviewer parsing.
The stamp's `blocking` counts come from the model reading a tally line, so a reviewer that drops the line gives a record with no counts.
The skill records such a reviewer as `could-not-run`, which makes the result `incomplete`, never `pass`.

What this might break:

- Every repo on the starter gains pro-ship on update: the PR gate, the `pr-check` skill and the Vercel bridge skill and its install row.
  The bridge adds one skill description to routing in repos that never deploy to Vercel; proposed ADR-0011 on plugin layering (branch `docs/plugin-layering-adr`, not on main) wants the bridge in `pro-nextjs` and the PR gate in a dev domain plugin, so this placement is a later migration, not a dead end.
- A `gh pr create` in warn mode prints a message on every unstamped commit until people run `pr-check`; that is the point of warn mode and AC13 watches it.
- On `gh pr create` both pr-gate and the push gate fire; with a valid stamp both pass, without one the person can see two messages.
- The push gate gets a new accept path; a bug there would skip a security review, so step 10 keeps every old case and adds the deny cases for stale and blocking stamps.
- Building commands can rewrite tracked files (generated code, lockfiles); then `stamp` refuses and the person must commit or clean first, which the message says.
- `pr-check` runs the commands a repo names in its own `CLAUDE.md`, `AGENTS.md`, `package.json` or Makefile; that is the same trust as running the repo's tests by hand and the hook itself executes nothing.
- Version collisions with the risk-tiers PR and any other open PR that bumps pro-ship, pro-quality or pro-security; step 19 reads main at build time.

What was left out on purpose:

- Teaching the router about `pr-check`, so pro-core does not move.
- `production-gate` reading the stamp; the ADR allows it later.
- A gate on `mcp__github__create_pull_request`, since Jody opens PRs with `gh`.
- Running reviewers through `claude -p`, kept for CI.
- Deciding tiers; risk-tiers replaces `unclassified`.
- Signing the stamp (flagged concern 5).

Which steps can run in parallel: tracks A (steps 2 to 6), B (7 to 9), C (10 and 11), D (12 and 13) and E (14 and 15) touch separate files.
Each track's test file is its own and every edit to `tests/check.mjs` waits for step 16, so no two subagents write the same file.
Inside tracks A and B the steps stay in order because each extends one script and one test file.
Steps 16 to 22 are serial because each reads the combined result.

Nothing here is irreversible.
There is no migration; reverting removes the hook and the skill on the next update, though the plugin cache keeps old versions for 14 days and stamps already written under `.pro-dev/` are inert files.

Suits auto mode: yes for steps 0 to 19 under this approval, because each has a command that passes or fails.
Steps 20 to 22 and the PR need Jody, since this ships a hook to every starter repo.

## Options not taken

- `${CLAUDE_PLUGIN_ROOT}/../<plugin>/` as the main sibling lookup, as the spec drafted: it only works for in-place plugins; copied plugins sit under a version folder.
- A registry file where each plugin publishes its script paths (flagged concern 8): it moves pro-core for a problem the documented install record already solves.
- One `run` call for every step: it cannot fit four 300-second steps in a ten-minute tool call.
- Mutation in a throwaway worktree: a fresh worktree has no installed dependencies, which is why code-reviewer moved the check here.
- Mapping verify-block commands onto build, lint, typecheck and test by keyword: guesswork that would mislabel the Testing section.
- Keeping a thin stamp hook in pro-quality instead of adding pro-ship to the starter: two copies of the hook on one command.
- A shared stamp reader in pro-core: a dependency `CLAUDE.md` warns against (flagged concern 4).
- Version bumps in their own commit: ADR-0002 wants them with the content.

## Proof of done

Run from the repo root on the final branch.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/ship-hooks.mjs && node tests/ship-check.mjs
node tests/security-hooks.mjs && node tests/quality-hooks.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
grep -c pr-gate.py plugins/pro-ship/hooks/hooks.json
git ls-files plugins/pro-ship/scripts/pr-gate.py plugins/pro-ship/scripts/pr-check.py plugins/pro-ship/skills/pr-check/SKILL.md
git ls-files plugins/pro-quality/scripts/pr-quality-gate.py
grep -c pr-quality-gate plugins/pro-quality/hooks/hooks.json
```

What counts as finished:

- `node tests/check.mjs` prints 0 failures with `ship-hooks`, `ship-check` and `stamp-contract` among the checks and no warning beyond the one router warning named under Files.
- The routing gate and unit tests pass and each hook test file prints all cases passed with no `FAIL` line.
- Strict validation prints `Validation passed` once for the marketplace and once per plugin directory.
- The first `grep -c` prints 1, the first `git ls-files` lists three files, the second prints nothing and the last `grep -c` prints 0.
- The dogfood report and `pr-body.md` are in the PR and `git status --short` is empty after the run.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: the head of #89.
- Checks run: `node tests/check.mjs` 33 checks, 0 failures, 11 warnings (the new warning is the router not naming `pr-check` yet, left for a pro-core change); `tests/ship-check.mjs` 108/108; `tests/ship-hooks.mjs` 82/82; `tests/security-hooks.mjs` 48 cases; the `stamp-contract` check failed when one `expect.json` verdict was flipped; eval dry; route-lexical rank-1 79.1%; unit tests; strict validate on the marketplace and all 20 plugins.
- AC1 to AC12, AC14 to AC16: pass, by the cases above and the trial below.
- AC10 and AC11: a trial of the skill on a clone of this branch ran the four verify steps, the floor guard and the mutation check, dispatched both reviewers and wrote a stamp that said `fail` (the reviewers found real problems, fixed below); pr-gate denied `gh pr create` on that HEAD with "does not say pass". With the siblings missing, `find` printed `not-installed` and the stamp said `incomplete`.
- AC13: pending after merge.
- Sign-off: Jody, 2026-10-30: "keep going and finish P0 you have my approval on all".

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0014, Status `proposed` from this change, to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- The step 22 review and the step 21 trial found problems, each fixed with a failing case first: the mutation step split lines differently from `git diff` (a form feed made it mutate the wrong line and report `killed`); `stamp` passed when discovered steps had no record; SIGHUP or SIGINT could leave the mutant on disk (now a restore marker `.pro-dev/ship/restore.json` that `run` and `stamp` recover from first); pr-gate missed `gh pr new`, `$(gh pr create)`, brace groups and wrapper commands; a mutant that could not parse counted as `killed` (only spaced comparison operators are flipped now); `--base` set the stamp base to the main tip instead of the merge base.
- The push gate accepts a stamp only when the security review ran (`done`, blocking 0) once its own classifier finds surface; `skipped-no-surface` falls through, so the `valid-security-skipped` fixture's push verdict changed to fall-through.
- The skill stamps `fail` when a step fails, as spec R6 says, instead of writing no stamp, so an older passing stamp cannot stand in.
- The reviewers read `mutation` from `.pro-dev/ship/run.json` during a run, because the stamp is written after they return; the code-reviewer agent and `handoff.md` name both paths (pro-quality is already bumped in this PR).
- The hook timeout is 15 s, as R17 says, not the 10 s first written.
- The gate-stamp ADR is ADR-0014: #86 merged ADR-0013 (plugin layering, proposed) while this was in review.
  That ADR places the PR gate in a future `pro-dev` domain plugin and waits for this change to replace `pr-quality-gate.py` before folding pro-quality, so pro-ship holds pr-check until that migration moves it.
- The security reviewer's count line is its last line, as the contract says, while the code reviewer's opens its report.
