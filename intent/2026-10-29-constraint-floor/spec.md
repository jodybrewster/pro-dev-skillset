---
intent: intent/2026-10-29-constraint-floor/intent.md
intent-status: accepted
status: draft
created: 2026-10-29T18:40:00-0400
author: the maintainer
---

# Spec: constraint floor and CONSTRAINTS.md

Built from `intent.md` in this folder (commit 8b78aa3).
Status: accepted.
Policies and skills consulted: `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, ADRs 0001 to 0009 in `docs/decisions/` (0001, 0002, 0003 and 0004 bear on this change), `docs/licenses.md`, `plugins/pro-quality/hooks/hooks.json`, `plugins/pro-quality/scripts/docs-before-push.py`, `plugins/pro-security/scripts/push-gate.py`, `plugins/pro-ai-sdlc/scripts/guard.py`, `plugins/pro-ai-sdlc/agents/reviewer.md`, `plugins/pro-ai-sdlc/commands/review.md` and upstream `skills/constraint-driven-development/` in agent-skills at `eb07f19`.
No `DESIGN.md` or `SECURITY.md` exists; the one project skill (`.claude/skills/skill-creator`) does not touch compliance, security, privacy or design.

## Summary

pro-quality gains a floor guard, a `constraints` skill, a `/constraints` command and a `CONSTRAINTS.md` template.
The floor guard is a Python `PreToolUse` hook that, before `git push` or `gh pr create`, reads the outgoing diff and names every move that lowers the bar: a new suppression comment, a test made easier or deleted, unfinished work, a loosened rule in `CONSTRAINTS.md` or a new exception.
It works in every repo that installs pro-quality, with or without a `CONSTRAINTS.md`.
It starts in warn mode.
`/constraints` writes a repo's `CONSTRAINTS.md` from what it detects plus at most four questions.
pro-ai-sdlc's reviewer and `/review` read that file beside `REVIEW.md`.
Everyone who installs the starter gets the guard on the next update.

## Requirements

### Functional

- R1. `plugins/pro-quality/scripts/floor-guard.py` exists, is tracked and is registered once in `plugins/pro-quality/hooks/hooks.json` as a `PreToolUse` hook on `Bash`. (Intent: Proposed outcome, first line.)
- R2. The hook acts only when a segment of the Bash command is `git push` (not `--dry-run`) or `gh pr create`; every other command, `git commit` included, passes with no output. (Open question 1.)
- R3. The hook reads the diff from a base to `HEAD` in the repo the command targets (`git -C <path>`, a leading `cd <path> &&`, else the session cwd).
  For `git push` the base is the merge base of `HEAD` with the first of the branch upstream, `origin/HEAD`, `origin/main` or `main` that resolves.
  For `gh pr create` the base is the merge base of `HEAD` with the first of `origin/HEAD`, `origin/main` or `main` that resolves, never the branch's own upstream, because a pushed branch would otherwise give an empty range and its PR diff would never be judged.
- R4. It reports these rules, each with an id:
  - `silenced-checker`: an added line containing `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `biome-ignore`, `# noqa`, `# type: ignore`, `# pyright: ignore`, `istanbul ignore`, `c8 ignore`, `nosemgrep`, `gitleaks:allow` or `Stryker disable`.
  - `test-made-easier`: an added line in a test file containing `.skip(`, `.todo(`, `xit(`, `xdescribe(`, `@pytest.mark.skip`, `pytest.skip(` or `t.Skip(`.
  - `test-deleted`: a test file deleted in the range.
  - `assertion-removed`: a removed line containing `expect`, `assert` or `should` in a test file that still exists, beyond the count of such lines added in the same file.
  - `unfinished-work`: an added line matching a stub (`throw new Error(` with "not implemented", `raise NotImplementedError`, `todo!()`, `unimplemented!()`) or an empty `catch {}`, `catch (e) {}` or `except: pass` on one line.
  - `rule-loosened`: in `CONSTRAINTS.md`, a numbered rule whose threshold moved in the loosening direction, or a Floor bullet or numbered row removed.
  - `new-exception`: an added row in the Exceptions table of `CONSTRAINTS.md`.
  (Intent: Problem, the five moves.)
- R4a. The marker rules `silenced-checker`, `test-made-easier` and `unfinished-work` skip files whose path ends in `.md`, because docs and skills legitimately name the markers.
  `rule-loosened` and `new-exception` still read `CONSTRAINTS.md`.
  The other rules apply to every other file.
- R5. A bare `TODO` is not a finding. (Open question 3.)
- R6. The floor applies whether or not the repo has a `CONSTRAINTS.md`; without one, `rule-loosened` and `new-exception` cannot fire. (Open question 2.)
- R7. A file is a test file when its path matches `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.py` or lies under a `tests/`, `test/` or `__tests__/` directory, plus any globs listed on a `Test files:` line in the repo's `CONSTRAINTS.md`.
- R8. Tightening is silent: a threshold moved in the stricter direction, a new rule or a removed Exceptions row is never reported.
- R9. A commit in the range whose message has a line `floor-allow: <rule-id> <reason>` with a non-empty reason clears that rule's findings for the range; the guard lists each allowance with its reason instead of the finding.
- R10. Each finding prints the rule id, the file, the line number on the new side (the old side for removals) and the line trimmed to 120 characters, with any token matching the credential prefixes in `REVIEW.md` (for example `sk-ant-`, `ghp_`, `AKIA`) replaced by `[redacted]`. (Intent: Constraints, never a secret value.)
- R11. Mode follows `mode.floor-guard`, then `mode`, in `CLAUDE_GUARD_DIR` or `~/.claude/hooks` (default warn), the same lookup as `guard.py`.
  In warn mode the hook logs to `warn.log`, shows the findings as a `systemMessage` and `additionalContext` and allows.
  In enforce mode it denies with a reason that lists the findings and the two ways to clear them: fix the code, or add a `floor-allow:` line with a reason to a commit message. (Intent: Constraints, warn mode.)
- R12. When the guard cannot run (no git, no merge base, a git timeout, an unreadable payload), it logs `could-not-run`, allows and says in its message that the floor was not checked; it never reports "clean" for a run that did not happen. (Intent: Constraints.)
- R13. `python3 floor-guard.py --check [--base <ref>] [--worktree]` runs the same rules from a shell: `--worktree` adds uncommitted and untracked changes; exit 0 means clean, 1 findings, 2 could not run.
- R14. `plugins/pro-quality/templates/CONSTRAINTS.md` exists with a header that says to read it before writing code and not to weaken it to make a change pass, then sections Floor, Enforced with numbers (columns Dimension, Rule, Checked by, Runs at), Measured, not yet enforced (Metric, Today, Direction) and Exceptions (ID, Rule, Path, Reason, Owner, Expires), plus the optional `Test files:` line.
- R15. `plugins/pro-quality/skills/constraints/SKILL.md` explains the floor, the four sections, ratchets, exceptions with expiry and how the guard reads the file, in harness-neutral prose with standard frontmatter.
- R16. `plugins/pro-quality/commands/constraints.md` (`/constraints`) detects the stack and its existing checks (package scripts, `pyproject.toml`, `Makefile`, `.github/workflows/`, the verify command in `CLAUDE.md` or `AGENTS.md`), asks at most four questions each with a default, runs each chosen check once to record today's value for every ratchet, writes `CONSTRAINTS.md` from the template and adds the line "Read CONSTRAINTS.md before writing code. Do not weaken it to make a change pass." to `CLAUDE.md` and `AGENTS.md` when they exist.
  It detects symlinks and writes the line once when `AGENTS.md` is a symlink to `CLAUDE.md`, as in this repo.
  It shows the result and does not commit. (Intent: Proposed outcome.)
- R17. `/constraints` never writes a numbered row without a command that ran successfully during the intake; a dimension without one goes to Measured or is left out. (Intent: Success looks like, second line.)
- R18. `plugins/pro-ai-sdlc/agents/reviewer.md` and `plugins/pro-ai-sdlc/commands/review.md` read `CONSTRAINTS.md` when present, as a policy path beside `REVIEW.md`; in the compliance pass a diff that loosens it without a `floor-allow:` reason is Important. (Open question 6.)

### Non-functional

- N1. The hook adds under 2 seconds to a push with a 1000-line diff; each git call has a 10-second timeout.
- N2. The hook makes no network calls, executes nothing taken from the payload and writes only to `warn.log`.
- N3. Python 3 standard library only, matching every other hook in the marketplace.
- N4. The guard never edits the repo.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-quality goes to 0.13.0 and pro-ai-sdlc to 0.7.0 in both manifests and their marketplace entries, with `metadata.version` to 1.60.0, in the same commit.
- Hook-loading law (ADR-0003): the guard is one more entry in pro-quality's existing `hooks/hooks.json`; the script is tracked.
- Codex parity (ADR-0004): the skill uses standard frontmatter and harness-neutral prose; `.codex-plugin/plugin.json` versions align; no agent is added, so no `.toml` is needed. Codex sessions run the same rules through `--check` (R13).
- Skills first (ADR-0001): a hook is justified because the trigger must be deterministic; the explanation lives in the skill.
- REVIEW.md, pass 1: every blocking path has a behavior case that blocks and one that allows (AC4).
- REVIEW.md, pass 2: a malformed payload never crashes the turn (R12); no network calls (N2); findings redact credentials (R10).
- REVIEW.md, pass 3 and `docs/licenses.md`: the skill, the template and the guard's rule list are adapted from agent-skills (MIT), so the skill carries a footer, `plugins/pro-quality/LICENSE` gains "Copyright (c) 2025 Addy Osmani" and `docs/licenses.md` gains a row marked adapted.
- `CLAUDE.md`: no home-directory paths in the command or the docs; paths are relative to the repo root.

## Design

### User experience

A push that adds `// eslint-disable-next-line` in warn mode lets the push through and shows:

```
[floor-guard] warn mode: 1 floor finding in the outgoing diff (allowed, logged to warn.log)
  silenced-checker  src/app/page.tsx:42  // eslint-disable-next-line @typescript-eslint/no-explicit-any
Fix it, or add "floor-allow: silenced-checker <reason>" to a commit message.
```

In enforce mode the same text is the deny reason and the push does not run.
A clean diff prints nothing.
A guard that could not run prints one line saying so and why.

`/constraints` reads the repo, says what it found (for example "Vitest, ESLint, tsc, GitHub Actions"), asks its questions one at a time with the default in each, runs the checks it will write down and shows the finished file and the `CLAUDE.md` line before anything is saved.

### System

New in pro-quality: `scripts/floor-guard.py`, `skills/constraints/SKILL.md`, `commands/constraints.md`, `templates/CONSTRAINTS.md`.
Changed in pro-quality: `hooks/hooks.json` (one entry), `LICENSE`, both manifests.
Changed in pro-ai-sdlc: `agents/reviewer.md`, its `.codex-plugin/agents/reviewer.toml`, `commands/review.md`, both manifests.
Changed at the root: `.claude-plugin/marketplace.json`, `docs/licenses.md`, `tests/cases/routing.jsonl` (a case for the skill), `tests/quality-hooks.mjs` (guard cases), `README.md` where pro-quality's commands are listed.

Reuse: the command parsing (heredoc stripping, segment splitting, `git -C` and `cd` resolution) follows `docs-before-push.py` and `push-gate.py`; the mode lookup and `warn.log` format follow `guard.py`, copied into pro-quality because plugins install separately and cannot import each other.
The `CONSTRAINTS.md` direction rules (a minimum loosens downward, a maximum upward, an unreadable direction reports any change) follow upstream `references/floor-guard.md`.

### Alternatives considered

- Rust: a binary would have to be committed per platform or built on the user's machine; a reviewer cannot read it.
- Bash, as upstream ships: needs `jq`, behaves differently on macOS and Linux and is harder to test than the Python every other hook uses.
- Firing on `git commit`: runs on every task commit in `/execute` and would repeat the same findings; push and PR creation are the points where the diff leaves the machine; they also match pro-security's push gate.
- Firing on `Write` or `Edit`: judges half-finished edits and doubles the noise.
- Deny once per diff, then let the identical retry pass (push-gate's pattern): fine for an advisory review, but it would let the floor be cleared by retrying; the `floor-allow:` line makes the bypass explicit and recorded instead.
- Folding the bar into `REVIEW.md`: REVIEW.md is how to review; `CONSTRAINTS.md` is what the code must meet and is read by the guard as well as reviewers, so it stays a separate file.

## Flagged concerns

Sources read: the policies listed at the top.

ADR needed: yes, the floor is a rule every gate and reviewer in the marketplace will share, with `CONSTRAINTS.md` as the place a repo's quality bar lives; drafted as [ADR-0010](../../docs/decisions/0010-constraint-floor.md).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The mode lookup from `guard.py` is copied into pro-quality, so two plugins carry the same helper and can drift. | ADR-0003 (plugins stand alone) | resolved: copy it into pro-quality (the maintainer took the recommendation, 2026-10-29) |
| 2 | pro-quality's existing hooks (`docs-before-push.py`) block with no warn mode, while the guard follows the mode file, so one plugin behaves two ways. | The maintainer | resolved: accept for now; bringing `docs-before-push.py` under the mode file is a later change |
| 3 | In enforce mode the guard denies every retry until the findings are fixed or allowed, unlike pro-security's deny-once pattern. | `push-gate.py` convention | resolved: as specced, since a floor that clears on retry is not a floor |
| 4 | The intent says the verifier checks against the file too; this spec only wires the reviewer and `/review`, because running a repo's numbered checks from the verifier needs its own budget design. | intent, Proposed outcome | resolved: the verifier is a follow-up change |
| 5 | Upstream's floor includes "no secrets", which the guard does not scan. | pro-security push gate | resolved: the template lists secrets on the floor with pro-security's push gate and `gitleaks` as the checker |
| 6 | `protect-tests` (pro-ai-sdlc) and the guard can both flag a test change during `/fix`. | pro-ai-sdlc | resolved: different events (edit time in fix mode versus push time) and each message names its own rule |

## Open questions

1. Which events the guard fires on: answered, `git push` and `gh pr create` (R2), plus `--check` for `pr-check` and Codex (R13).
2. Whether a repo with no `CONSTRAINTS.md` still gets the floor: answered, yes (R6).
3. Whether a bare `TODO` counts: answered, no (R5).
4. pro-quality or pro-core: answered, pro-quality.
5. Whether `/pro-dev install` offers `/constraints`: still open, owner the maintainer; left out of this change so pro-core does not move.
6. How the reviewer reads the file without breaking the fresh-context handoff: answered, as a policy path beside `REVIEW.md` (R18).
7. Likely needs an ADR: answered, yes (ADR-0010).

Changed on 2026-10-29 after planning: R3 base for gh pr create, Markdown skipped by the marker rules, AGENTS.md symlink.

## Acceptance criteria

- AC1. `node tests/check.mjs`, `node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70`, `node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC2. `grep -c floor-guard.py plugins/pro-quality/hooks/hooks.json` prints 1 and `git ls-files plugins/pro-quality/scripts/floor-guard.py` lists the file.
- AC3. `node tests/quality-hooks.mjs` passes guard cases in a throwaway repo: each rule in R4 is reported; in enforce mode each denies and in warn mode each allows with the message; a `.md` file that names `eslint-disable`, `.skip(` or `raise NotImplementedError` is not reported by the marker rules while `CONSTRAINTS.md` is still read by `rule-loosened` and `new-exception`; for `gh pr create` the base is the default branch and never the upstream, so a branch that was already pushed (upstream equal to `HEAD`) still has its PR diff judged, while `git push` on the same branch uses the upstream; a clean diff, a Markdown-only diff, `git commit` and `git push --dry-run` produce no output; a `floor-allow:` line clears its rule; a tightened threshold is silent and a loosened one is reported; a repo with no merge base allows with the could-not-run message; a malformed payload exits 0.
- AC4. For every rule that can deny there is one case that denies and one that allows.
- AC5. `python3 plugins/pro-quality/scripts/floor-guard.py --check` exits 0, 1 and 2 in the matching cases of AC3.
- AC6. A finding on a line containing `ghp_` followed by 36 characters prints `[redacted]` in place of the token.
- AC7. `/constraints` run on this repo writes a `CONSTRAINTS.md` whose every numbered row names a command that exits 0 here; it also adds the line once, to `CLAUDE.md`, because `AGENTS.md` is a symlink to it here and the command detects that; the run is shown in the PR and the file is not committed in this change.
- AC8. `docs/licenses.md` has a pro-quality row for `constraints` naming agent-skills as adapted, `plugins/pro-quality/LICENSE` carries the agent-skills copyright line and the skill ends with the upstream footer.
- AC9. After a week of normal work in warn mode in at least two of the maintainer's repos, `grep floor-guard ~/.claude/hooks/warn.log` shows no finding the maintainer disagrees with (checked after merge; it gates the later switch to enforce, not this PR).

## Out of scope

Installing the tools behind numbered rows (semgrep, osv-scanner, Lighthouse, axe).
Running the guard in CI.
Switching the hook to enforce mode.
Writing `CONSTRAINTS.md` into the maintainer's other repos.
Offering `/constraints` from `/pro-dev install`.
The verifier reading `CONSTRAINTS.md` (flagged concern 4).
`pr-check` and the PR gate; they will call `--check` when they exist.
