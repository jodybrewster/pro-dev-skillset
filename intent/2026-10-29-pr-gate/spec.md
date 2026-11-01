---
intent: intent/2026-10-29-pr-gate/intent.md
intent-status: draft
status: accepted
created: 2026-10-29T19:30:00-0400
author: the maintainer
---

# Spec: the PR gate

Built from `intent.md` in this folder (not yet committed).
Status: accepted.
Policies and skills consulted: `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, ADRs 0001 to 0009 in `docs/decisions/` (0002, 0003, 0004 and 0006 bear on this change), `docs/hook-loading.md`, `plugins/pro-quality/scripts/pr-quality-gate.py` and its `hooks/hooks.json`, `plugins/pro-security/scripts/push-gate.py` and `security_surface.py`, `plugins/pro-security/agents/security-architect.md`, `plugins/pro-ai-sdlc/scripts/production-gate.py` and `guard.py`, `plugins/pro-ai-sdlc/agents/verifier.md` and `reviewer.md`, `plugins/pro-ship/`, `tests/quality-hooks.mjs`, `tests/security-hooks.mjs`, `intent/2026-10-28-pro-ship-scope/brainstorm.md` and `intent/2026-10-29-constraint-floor/spec.md`.
The sibling intents `code-reviewer`, `risk-tiers` and `review-policy` were drafted at the same time; R7 was aligned with code-reviewer's handoff afterwards and concerns 6 and 7 still need a re-check once those specs are accepted.
No `DESIGN.md` or `SECURITY.md` exists; the one project skill (`.claude/skills/skill-creator`) does not touch compliance, security, privacy or design.

## Summary

pro-ship gains a `pr-check` skill, a small script behind it and a `PreToolUse` hook on `gh pr create`.
The skill finds the repo's build, lint, typecheck and unit test commands, runs them, runs the constraint floor check when pro-quality is installed, dispatches the reviewers in parallel with fresh context and writes `.pro-dev/ship/pr-check.json`, a stamp bound to the HEAD sha.
It also drafts the Testing, Risk and How to revert sections of the PR body.
The hook checks the stamp and nothing else: with no passing stamp for HEAD it denies once per commit per session, following the mode file.
pro-quality's `pr-quality-gate.py` and its two `PostToolUse` entries are removed.
pro-security's push gate accepts a valid stamp that records a clean security review, so one security review runs per PR.
Everyone who installs pro-ship gets it on the next update; repos on the starter get it when pro-ship joins the starter (Flagged concern 2).

## Requirements

### Functional

- R1. `plugins/pro-ship/skills/pr-check/SKILL.md` exists with standard frontmatter (`name`, `description`), is model-invocable and is written in harness-neutral prose, so it loads under Codex. (Intent: Constraints, skills not commands.)
- R2. `plugins/pro-ship/scripts/pr-check.py` exists, is tracked and has three subcommands that print JSON and never edit tracked files: `discover` (the commands to run), `run` (runs them and records the outcome of each) and `stamp` (writes the stamp from the pieces it is given). (Intent: Proposed outcome, first paragraph.)
- R3. `discover` picks commands in this order and stops at the first source that names a given step:
  - a verify command named in the repo's `CLAUDE.md` or `AGENTS.md`;
  - `package.json` scripts `build`, `lint`, `typecheck` (else `tsc --noEmit` when a `tsconfig.json` exists) and `test`, run with the package manager the lockfile names (`pnpm`, `bun`, `yarn`, else `npm run`);
  - Python: `ruff check` when ruff is configured, `mypy` or `pyright` when configured, `pytest` when tests exist;
  - Makefile targets `build`, `lint`, `typecheck`, `test`, then `check`, `verify`.
  A step with no command is reported `not-found` and is not a failure. (Intent: Proposed outcome; the brainstorm's "Shape", step 1.)
- R4. `run` executes each discovered command once from the repo root, with its own timeout, never passing flags that skip checks or hooks.
  It records for each command: the step, the exact command, `status` (`pass`, `fail`, `timeout` or `not-found`), the exit code and the last 20 lines of output with credential-shaped tokens (the prefixes in `REVIEW.md`, pass 2) replaced by `[redacted]`.
- R5. When pro-quality's floor guard is found, `run` also runs `python3 <floor-guard.py> --check` and records `floor` as `pass` (exit 0), `findings` (exit 1) or `could-not-run` (exit 2); when it is not found it records `not-installed`. (Intent: Proposed outcome; constraint-floor spec, R13.)
- R6. The skill dispatches the reviewers in one turn, in parallel, only after `run` finishes and only when no step has status `fail`.
  A failing step stops the review and the stamp records `result: fail`. (Intent: Proposed outcome, first paragraph.)
- R7. Each reviewer gets only the four-field handoff defined by `intent/2026-10-29-code-reviewer` in `plugins/pro-quality/skills/requesting-code-review/handoff.md` (`range`: base and head sha; `brief`: intent, spec and plan paths; `policy`: `REVIEW.md`, the agent file and `CONSTRAINTS.md` when present; `risk`: tier and its signals) and nothing else; the skill never passes the session's reasoning, a summary of the work or its own opinion of the diff. (Intent: Constraints, fresh context.)
- R8. Reviewer selection, by what is installed:
  - code review: the `code-reviewer` agent from pro-quality when present, else pro-ai-sdlc's `reviewer`, else none;
  - security review: pro-security's `security-architect` in diff mode, dispatched only when pro-security's `security_surface.py` reports security surface for the diff, else recorded `skipped-no-surface`.
  A reviewer that is not installed is recorded `not-installed`, never as passed. (Intent: Proposed outcome, last line; Open questions 7 and 8.)
- R9. Where the host cannot dispatch subagents the skill says so and applies each reviewer's own skill itself in the same session, records the reviewer as `inline` and notes that the context was not fresh. (Codex parity; Intent: Constraints.)
- R10. The skill obeys the convergence rules of `intent/2026-10-29-review-policy` and reads the repo's `REVIEW.md` for project rules; with no `REVIEW.md` it says so and points to `/sdlc-init`.
  The reviewers still run with their generic lenses. (Intent: Constraints.)
- R11. `stamp` writes `.pro-dev/ship/pr-check.json` with: `schema` (1), `head` and `base` (full shas), `created` (ISO 8601 with offset), `tier`, `checks` (R4), `floor` (R5), `mutation` (R29), `reviewers` (each with `agent`, `status` of `done`, `inline`, `skipped-no-surface`, `not-installed` or `could-not-run` plus `blocking` and `important` counts) and `result`. (Intent: Proposed outcome, second paragraph.)
- R12. `tier` is the fixed value `unclassified` until `intent/2026-10-29-risk-tiers` lands; no gate reads it before then. (Intent: Out of scope; Open question 6.)
- R13. `result` is `pass` when every step that ran passed, `floor` is `pass`, `not-installed` or `not-found`, no reviewer reports a Blocking finding and every reviewer that was dispatched finished; `fail` when a step failed, the floor has findings or a reviewer reports Blocking; `incomplete` in every other case, including a timeout, a `could-not-run` and a reviewer that returned nothing. (Intent: Constraints, could not run is never passed.)
- R14. `stamp` refuses to run with uncommitted changes to tracked files and says to commit first, because the stamp is bound to a commit and not to a working tree.
- R15. The stamp lives under `.pro-dev/`, which the skill adds to `.git/info/exclude` when no ignore rule covers it, so writing the stamp never changes the tree or HEAD.
- R16. The skill writes `.pro-dev/ship/pr-body.md` with the Testing, Risk and How to revert sections drafted from the stamp:
  - Testing lists each command with its result and says what was not found or not run;
  - Risk gives the tier, the touched areas by top-level directory, the floor and reviewer findings still open and the security surface hit when there was one;
  - How to revert gives `git revert` with the commit range and flags migrations, config or generated files in the diff for the person to confirm.
  It prints the draft, never runs `gh pr create` and states every claim it could not check as "confirm". (Intent: Proposed outcome, last paragraph.)
- R17. `plugins/pro-ship/scripts/pr-gate.py` exists, is tracked and is registered once in `plugins/pro-ship/hooks/hooks.json` as a `PreToolUse` hook on `Bash`, with a timeout of 15 seconds. (Intent: Proposed outcome.)
- R18. The hook acts only when a segment of the Bash command is `gh pr create` (after env assignments, `cd <dir> &&` or `-R` flags; never inside a heredoc body or a quoted string) and the command has no `--help`; every other command passes with no output, `git push` included. (Intent: Success looks like, first line.)
- R19. The hook finds the repo from `cd <path> &&` in the command or else the payload `cwd`, reads the HEAD sha with one `git rev-parse` call and reads `.pro-dev/ship/pr-check.json`.
  It runs no build, test, lint, agent or network call and never writes outside its state file. (Intent: Constraints, only checks the stamp.)
- R20. A stamp is valid when it parses, `schema` is 1, `head` equals the current HEAD sha and `result` is `pass`.
  A missing, unreadable, stale or non-passing stamp is invalid.
  The hook says which of the four it was.
- R21. A valid stamp passes with no output.
- R22. With an invalid stamp, in enforce mode the hook denies once per HEAD sha per session with a reason that names the cause and says to run `/pro-ship:pr-check`; the identical retry passes. State is kept per session and repo as in `security_surface.session_state`. (Intent: Success looks like, first two lines.)
- R23. Mode follows `mode.pr-gate`, then `mode`, in `CLAUDE_GUARD_DIR` or `~/.claude/hooks`, default warn, the same lookup as `guard.py`.
  In warn mode the hook logs to `warn.log`, shows the cause as a `systemMessage` once per HEAD sha per session and allows.
- R24. When the hook cannot decide (an unreadable payload, no git, no repo, a git timeout) it logs `could-not-run`, allows and exits 0.
- R25. `plugins/pro-quality/scripts/pr-quality-gate.py` is deleted, its two `PostToolUse` entries are removed from `plugins/pro-quality/hooks/hooks.json` and its cases are removed from `tests/quality-hooks.mjs`; no other hook in pro-quality changes. (Intent: Affected systems.)
- R26. `plugins/pro-security/scripts/push-gate.py` reads the stamp before it denies.
  It accepts, with no deny and no output, when the stamp is valid by R20, `reviewers.security.status` is `done` or `skipped-no-surface` and `reviewers.security.blocking` is 0.
  Without a stamp, or with any other stamp, it behaves as it does today. (Intent: Proposed outcome, third paragraph.)
- R27. The stamp-validity rules of R20 and R26 are written in `docs/` once.
  Both hooks read the same fixture set in `tests/` so a change to one fails until the other follows. (Flagged concern 4.)
- R28. pro-ship declares no hard dependency on pro-quality, pro-security, pro-ai-sdlc or pro-core in its manifests; every sibling is found at run time and missing ones are recorded as `not-installed`. (CLAUDE.md, Things Claude gets wrong.)
- R29. After the unit tests pass and before the reviewers are dispatched, `pr-check` runs a mutation check when the diff touches non-test code and the tier is not `low`.
  While the tier is `unclassified` (R12) the check therefore runs whenever the diff touches non-test code, because an unclassified diff is not known to be low risk; it costs one extra test run.
  It inverts one condition in the changed non-test lines, reruns the tests related to that file and restores the file.
  The restore happens in a `finally` path and by `git checkout -- <file>` as a second step, even on error or timeout.
  The tree is never left dirty.
  It records `mutation` in the stamp as `survived` (the related tests still pass), `killed` (a test failed), `skipped` with a reason (low tier, test-only diff, no condition found or no related tests) or `could-not-run`.
  A `survived` result makes `result` `incomplete` until the person confirms.
  A `could-not-run` result makes it `incomplete` like any other could-not-run (R13).
  The `code-reviewer` agent reads this value when the stamp path is in its `risk` field and treats `survived` as an Important finding (code-reviewer spec R9). (2026-10-29.)

### Non-functional

- N1. The hook adds under 1 second to a `gh pr create` and under 100 milliseconds to any other Bash command.
- N2. The hook and the script make no network calls, execute nothing taken from the payload and the hook writes only `warn.log` and its session state file.
- N3. Python 3 standard library only, like every other hook in the marketplace.
- N4. No path in a skill, command or doc is a home-directory path other than `~/.claude/hooks`.
- N5. `run` kills a command on timeout and records `timeout`; the default per-command timeout is 300 seconds and a repo can raise it in its verify command section of `CLAUDE.md` or `AGENTS.md` (Open question 5).

### Policy constraints applied

- Version-bump law (ADR-0002): pro-ship goes to 0.3.0, pro-quality to its next minor and pro-security to 0.3.0 in both manifests and the marketplace entries, with `metadata.version` to the next minor, in the same commit.
  pro-quality's number depends on whether `constraint-floor` (which takes 0.13.0) merges first; the plan sets it against origin/main when building.
- Hook-loading law (ADR-0003): pr-gate is registered in pro-ship's one `hooks/hooks.json` (a new file; pro-ship has none today) and its script is tracked; pro-quality loses two entries from its existing file.
- Codex parity (ADR-0004): the skill uses harness-neutral prose and standard frontmatter; pro-ship's `.codex-plugin/plugin.json` versions align; the plugin adds no agent, so no `.toml` is needed.
  The hooks are Claude only, so under Codex the skill is the gate and the stamp is its output.
- Engine registry (ADR-0006): pro-ship already owns registry rows, so it still takes no pro-core dependency (R28); the new skill adds no engine, so `plugins/pro-core/registry/engines.json` does not change.
- REVIEW.md, pass 1: every blocking hook has a behavior case that blocks and one that allows (AC5).
- REVIEW.md, pass 2: a malformed payload never crashes the turn (R24); no network calls (N2); the hook never loops a Stop because it is not a Stop hook; the stamp carries redacted output only (R4).
- REVIEW.md, pass 1: a skill that names a script, sidecar or path must name one that exists and is tracked (R2, R17, AC2).
- `CLAUDE.md`: no home-directory paths (N4); no hook file named per concern (R17 uses `hooks/hooks.json`).

## Design

### User experience

The maintainer finishes a change and, before opening the PR, says "check this" or runs `/pro-ship:pr-check`.
The skill reports in the order it ran things.
For example:

```
pr-check on 3f9c2ab (base 81d04e7)
  build       pass   pnpm run build
  lint        pass   pnpm run lint
  typecheck   pass   pnpm run typecheck
  test        pass   pnpm test
  floor       pass   floor-guard.py --check
  code review done   reviewer: 0 blocking, 2 important
  security    skipped-no-surface
result: pass
stamp: .pro-dev/ship/pr-check.json
PR body draft: .pro-dev/ship/pr-body.md
```

A failing step stops the run before any reviewer is dispatched and says which command failed, with the output tail.
The next `gh pr create` on that commit passes with no output.
A `gh pr create` on a commit with no stamp, in enforce mode, stops once:

```
pr-gate: no pr-check stamp for 3f9c2ab. Run /pro-ship:pr-check, or retry the same command to open the PR as it is.
```

In warn mode the same text is shown as a message and the command runs.
The second try on the same commit goes through, as with the push gate.

### System

New in pro-ship: `skills/pr-check/SKILL.md` (with a sidecar for command discovery and one for the PR body draft), `scripts/pr-check.py`, `scripts/pr-gate.py`, `hooks/hooks.json`.
Changed in pro-ship: both manifests.
Removed from pro-quality: `scripts/pr-quality-gate.py`; changed: `hooks/hooks.json` and both manifests.
Changed in pro-security: `scripts/push-gate.py` (and a small stamp reader in `scripts/security_surface.py`) and both manifests.
Changed at the root: `.claude-plugin/marketplace.json`, `docs/` (one page for the stamp contract, linked from `docs/README.md` and `docs/hook-loading.md`), `tests/ship-hooks.mjs` (new, wired into `tests/check.mjs` as a check beside `quality-hooks`), `tests/quality-hooks.mjs`, `tests/security-hooks.mjs`, `tests/cases/routing.jsonl` (a case for the skill), `README.md` where pro-ship is described and `docs/roadmap.md` (item 2 marked in progress).

Reuse and divergence:

- Command parsing (heredoc stripping, segment splitting, wrapper skipping) follows `pr-quality-gate.py` and `push-gate.py`; plugins install separately and cannot import each other, so pr-gate carries its own copy.
- The mode lookup and `warn.log` format follow `guard.py`.
- Session state and the deny-once pattern follow `push-gate.py` and `security_surface.py`.
- Command discovery follows the verifier's order but covers four separate steps; the verifier finds one verify command, so the logic is written in the skill sidecar and the script rather than reused.
- Where a sibling script lives is found by looking, in order, at `${CLAUDE_PLUGIN_ROOT}/../<plugin>/scripts/`, then the repo's own `plugins/<plugin>/scripts/` and then the plugin cache folder Claude Code reports; a miss is `not-installed` (Open question 4).

The stamp is a single JSON file with one writer.
`pr-check.py stamp` writes it and the two hooks only read it.

### Alternatives considered

- Hook runs the checks itself: a build or a test suite can pass the hook timeout and hang the session.
  The old gate's 30 and 60 second limits show the failure (a slow suite reads as failing).
- Keep `pr-quality-gate.py` and add the new hook beside it: two gates on the same command, one after the PR exists; the brainstorm says replace it.
- Put the hook in pro-quality: pro-quality is in the starter but the stamp is pro-ship's artifact and the skill that writes it lives there; a hook in another plugin would break when only one of the two is installed.
- A command rather than a skill: other skills could not chain it and Codex would not load it (brainstorm, "Skills, not commands").
- Deny every retry until the stamp is valid, as the floor guard does in enforce mode: this local hook is a guardrail and the required CI check is the enforcement; denying once matches pro-security's push gate and avoids a stuck session when the checks cannot run on a machine.
- Bind the stamp to a diff hash as the push gate does: the PR is made of commits, so the HEAD sha is the simplest value that cannot go stale unnoticed; a rebase changes it and correctly invalidates the stamp.
- Gate `mcp__github__create_pull_request` as well: the maintainer uses `gh` for everything on GitHub, so that path is not gated and the old gate's matcher for it goes with the old gate.
- Reviewers through `claude -p`: a second process with its own cost and login path; recommended for CI later (Open question 1).

## Flagged concerns

Sources read: the policies listed at the top.
The three sibling intents are not read yet, so concerns 6 and 7 may change once they land.

ADR needed: yes, a stamp under `.pro-dev/ship/` that three gates read (pr-gate, the push gate and later `production-gate`) with one writer and a rule for what makes it valid is a rule every gate must follow and is expensive to reverse once repos hold stamps; to be drafted; number assigned when written.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | Removing `pr-quality-gate.py` drops two things the old gate did: the PR description length check (more than 50 characters) and a hook-run lint and test on repos that never run pr-check. | The maintainer; REVIEW.md, pass 1 (regressions) | open: accept, since the drafted body replaces the length check and the stamp hook names the missing check (recommended) |
| 2 | pro-ship is opt-in and not in `pro-dev-starter`; removing pro-quality's gate would leave starter-only repos with no PR check at all. | Brainstorm ("Join pro-dev-starter when v0.1 lands, not now") | open: add pro-ship to the starter in this release (recommended) or keep a thin copy of the stamp hook in pro-quality |
| 3 | The hook follows the mode file but denies once, while `production-gate` asks and the floor guard denies every retry, so three gates behave three ways. | `guard.py`; `push-gate.py` | open: as specced, because this hook is a guardrail and CI is the enforcement (recommended); revisit when `pipeline` lands |
| 4 | The stamp contract is read by two plugins (pro-ship, pro-security) that cannot import each other, so two copies of the validity rule can drift. | ADR-0003 (plugins stand alone) | open: copy it and hold both with one shared fixture set and a check in `tests/check.mjs` (R27, recommended) or move the stamp reader into pro-core and add a dependency, which `CLAUDE.md` warns against |
| 5 | The stamp is a plain file the session itself can write, so an agent can forge a passing stamp to get past the hook. | The maintainer; REVIEW.md, pass 2 | open: accept for a local guardrail and rely on the required CI check (recommended) or sign the stamp with a key outside the repo, which a session could also reach |
| 6 | The skill must read the four-field handoff and the finding format from `code-reviewer`; the convergence rules from `review-policy`, both unwritten; if they change, R7, R10 and R13 change. | `intent/2026-10-29-code-reviewer`; `intent/2026-10-29-review-policy` | open: land code-reviewer's spec first and re-check this one (recommended); the deterministic half (R2 to R5, R14 to R28) does not depend on them |
| 7 | pro-security's `security-architect` already returns a verdict for a diff; the stamp's Blocking count depends on its output format, which this spec has not pinned. | pro-security owner | open: pin the tally line in the stamp contract page and count Blocking from it (recommended) |
| 8 | Sibling scripts (the floor guard, `security_surface.py`) are found by path in a cache layout that Claude Code can change. | ADR-0006 (registry detection) | open: look in the three places in the Design and record `not-installed` on a miss (recommended) or have each plugin publish its script path in a small registry file |

## Open questions

1. Fixed handoff to a subagent versus `claude -p`: answered, a subagent with the fixed handoff (R7); `claude -p` stays a later option for CI.
2. Where the hook lives: answered, pro-ship (R17), with the starter question in Flagged concern 2.
3. Whether pro-ship joins `pro-dev-starter`: decided on 2026-10-30 under the maintainer's approval, yes, in the same release (Flagged concern 2).
4. How pr-check finds a sibling script: decided on 2026-10-30 under the maintainer's approval, by the documented install record (`installed_plugins.json`) after the in-place layout, as verified in `plan.md` ("Sibling lookup"); the `${CLAUDE_PLUGIN_ROOT}/../<plugin>/` path in Design, System only works for plugins loaded in place (Flagged concern 8).
5. The per-command timeout: decided on 2026-10-30 under the maintainer's approval, 300 seconds with a repo override (N5).
6. The default mode: answered, warn (R23); a later change moves it to enforce after clean logs, not this PR.
7. Whether a draft PR needs the stamp: decided on 2026-10-30 under the maintainer's approval, no; `gh pr create --draft` or `-d` passes with no output.
8. The tier before the classifier exists: answered, the fixed value `unclassified` (R12).
9. How the security review decides it is needed: answered, only on security surface (R8).
10. Likely needs an ADR: answered, yes (Flagged concerns, `ADR needed`).

The flagged concerns above are decided in `plan.md` ("Decisions taken under the approval") on 2026-10-30 under the maintainer's approval.

Changed on 2026-10-29 after planning: the mutation check moves from the code-reviewer agent into pr-check (R29) and the stamp gains a `mutation` field.

## Acceptance criteria

- AC1. `node tests/check.mjs`, `node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70`, `node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC2. `grep -c pr-gate.py plugins/pro-ship/hooks/hooks.json` prints 1; `git ls-files plugins/pro-ship/scripts/pr-gate.py plugins/pro-ship/scripts/pr-check.py plugins/pro-ship/skills/pr-check/SKILL.md` lists all three; `git ls-files plugins/pro-quality/scripts/pr-quality-gate.py` prints nothing and `grep -c pr-quality-gate plugins/pro-quality/hooks/hooks.json` prints 0.
- AC3. `plugins/pro-ship/scripts/pr-check.py discover` run in a throwaway repo with a `package.json` (build, lint, typecheck and test scripts and a `pnpm-lock.yaml`), in one with `pyproject.toml` and tests, in one with only a Makefile and in an empty one names the matching commands and reports `not-found` for the rest; a verify command in `CLAUDE.md` wins over the scripts.
- AC4. `pr-check.py run` records `pass`, `fail` and `timeout` for a passing, a failing and a sleeping command, tails at most 20 lines and replaces a line containing `ghp_` followed by 36 characters with `[redacted]`.
- AC5. `node tests/ship-hooks.mjs` (run through `node tests/check.mjs`) passes pr-gate cases in a throwaway repo, each as a pair that blocks and one that allows:
  - no stamp: denies in enforce mode, allows with the message in warn mode;
  - stamp for an older HEAD: denies; stamp for HEAD with `result: fail` or `incomplete`: denies; a corrupt stamp: denies and says unreadable;
  - the identical retry on the same HEAD passes and a new commit is denied again;
  - a valid stamp passes with no output;
  - `git push`, `git commit -m "gh pr create"`, `echo gh pr create`, `gh pr create --help` and a heredoc that contains the words pass with no output;
  - `cd repo && GH_TOKEN=x gh pr create` is treated as a PR create;
  - a non-git cwd, a malformed payload and an empty command exit 0.
- AC6. `node tests/security-hooks.mjs` passes new push-gate cases: a security-surface diff with a valid stamp (`security.status: done`, `blocking: 0`) passes with no deny; the same diff with no stamp, a stale stamp or `blocking: 1` denies once as today; a stamp with `skipped-no-surface` passes.
- AC7. Both hook test files read the same stamp fixtures from one folder under `tests/`.
  A change to one fixture that one hook accepts and the other rejects fails `node tests/check.mjs`.
- AC8. `pr-check.py stamp` in a throwaway repo writes `.pro-dev/ship/pr-check.json` with every field of R11; it exits non-zero with a message when a tracked file is modified; `git status --short` is empty afterwards and `.git/info/exclude` lists `.pro-dev/`.
- AC9. A stamp built with a reviewer set to `not-installed` and one with a floor of `could-not-run` both come out `incomplete`, never `pass`.
- AC10. The skill, run on this repo after the change, produces a stamp and a `pr-body.md` whose three sections are filled from that stamp; the run is shown in the PR.
- AC11. With the skill's sibling plugins uninstalled in a throwaway Claude Code profile, the skill still runs, records each missing sibling as `not-installed` and the result is `incomplete`; pr-gate and the push gate still load.
- AC12. `routing.jsonl` has a case for `pr-check` and `node tests/route-lexical.mjs --min-rank1 70` still passes.
- AC13. After a week of normal work in warn mode in at least two of the maintainer's repos, `grep pr-gate ~/.claude/hooks/warn.log` shows no stop the maintainer disagrees with (checked after merge; it gates the later switch to enforce, not this PR).
- AC14. `pr-check.py` on a throwaway repo with a diff that adds an untested condition records `mutation: survived`; with a test that covers it records `killed`; with a test-only diff or tier `low` records `skipped` with a reason; with no runnable test command records `could-not-run`.
- AC15. In each AC14 case and when the test command is killed mid-run, `git status --short` is empty afterwards and the changed file is byte-identical to its committed content.
- AC16. A stamp with `mutation: survived` or `could-not-run` comes out `incomplete`, never `pass`.

## Out of scope

The reviewer agent and its four-field handoff.
The risk classifier and approval tiers.
Convergence rules and the `REVIEW.md` template.
Codex as a second reviewer.
The same checks as required GitHub Actions status checks (`pipeline`).
Installed skills that declare runnable checks.
The required documents check.
A gate on `gh pr merge` or on releases; `production-gate` may read the same stamp later under the ADR.
Switching the hook to enforce mode.
Creating the PR.
