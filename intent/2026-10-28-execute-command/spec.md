---
intent: intent/2026-10-28-execute-command/intent.md
intent-status: proposed
status: draft
created: 2026-10-28T07:45:52-0400
author: Jody Brewster
---

# Spec: /execute builds an approved plan in its own worktree

Built from `intent.md` in this folder (commit 1e6668d).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `intent/README.md`, `docs/codex-parity.md`, `docs/decisions/` (ADR-0001 to ADR-0005), `plugins/pro-ai-sdlc/hooks/hooks.json` with `production-gate.py` and `plan-sync.py`, `plugins/pro-ai-sdlc/commands/plan.md` and `pr-babysit.md`, `plugins/pro-ai-sdlc/templates/plan.md`, `plugins/pro-execution/skills/using-git-worktrees/SKILL.md`, the pro-security plugin (`security-architect`, `threat-model`) and `tests/cases/routing.jsonl`.
No `DESIGN.md` or `SECURITY.md` exists in this repo.

## Summary

pro-ai-sdlc gains `/execute <path to plan.md>`, the build stage of the loop between `/plan` and `/pr-babysit`.
It refuses a plan that is not committed and approved, makes a worktree on a fresh branch off `origin/main`, copies the git-ignored env files across without printing them, proves a green baseline, builds the plan's steps test-first, runs the proof of done and the `verifier` agent, fills in the plan's Done section and opens a pull request.
It stops at the pull request.
Anyone with pro-ai-sdlc installed gets it in any repo that uses the `intent/` layout.

## Requirements

### Functional

- R1. `/execute` takes a path to a `plan.md` and stops with a reason when the path is missing, the file is not tracked by git, it has uncommitted changes or its `Status:` line is not `approved` (intent outcome 1).
- R2. `/execute` stops with a reason when the plan's Done section already records a build commit, so an approved plan that was already built is not built twice (intent outcome 1).
- R3. `/execute` runs `git fetch origin` and creates the worktree on a new branch named from the intent folder's slug (the folder name without its date prefix), based on `origin/<default branch>`; it stops if that branch already exists locally or on the remote (intent outcome 2).
- R4. `/execute` uses the harness's own worktree tool when that tool can base the branch on `origin/<default branch>`, so the session follows the worktree.
  Otherwise it runs `git worktree add ../<repo>.<slug> -b <slug> origin/<default branch>`, a sibling folder that needs no new ignore rule.
  Either way the branch base is `origin/<default branch>` and never the current `HEAD` (intent outcome 2, open question 1).
- R5. Env file discovery takes only files that `git ls-files --others --ignored --exclude-standard` lists in the main checkout and whose basename matches `.env`, `.env.*`, `.dev.vars` or `.dev.vars.*`, at any depth outside `node_modules/`, `.git/` and other worktrees (intent outcome 3, open question 2).
- R6. Each env file is copied to the same relative path in the worktree with its permission bits kept; a tracked file such as `.env.example` is never copied or overwritten (intent outcome 3).
- R7. After copying, `/execute` runs `git check-ignore` on every copied path inside the worktree; if any is not ignored it deletes the copies, removes nothing else and stops with the file names (intent constraint on secrets).
- R8. The command prose instructs that env files are copied with `cp` or an equivalent and never read, printed, echoed, grepped for values, staged or quoted in a commit message, log line or PR body; only their relative paths appear in output (intent constraint on secrets).
- R9. In the worktree `/execute` installs dependencies with the lockfile's package manager when a lockfile exists and runs the repo's verify command, found the way `/pr-babysit` finds it (the repo's agent file, then `package.json` scripts `check`, `verify`, `validate`, `test`, then Makefile targets) (intent outcome 4).
- R10. A red baseline stops `/execute` before any change, with the failing command and its last lines of output; the worktree stays in place for the person to inspect (intent outcome 4).
- R11. The build follows the plan's Order of work in order, writing or extending the test for a step before its code; each step or group of steps is committed with a message that names the step (intent outcome 5).
- R12. Any departure from the plan is added to the plan's Departures section in the same commit as the change that departs (intent outcome 5, `plan.md` command step 4).
- R13. After the build `/execute` runs each command under the plan's Proof of done, then dispatches the `verifier` agent in a fresh context. It fills in the Done section's build commit, checks run and one line per acceptance criterion with what was observed; it leaves Sign-off empty for the person (intent outcome 6).
- R14. `/execute` pushes the branch with plain `git push -u origin <branch>` and opens a pull request whose body links the intent folder and lists each acceptance criterion with its proof (intent outcome 6, `intent/README.md`).
- R15. `/execute` never merges, never pushes to the default branch, never passes `--no-verify` and never force-pushes; its last output is the PR URL, the worktree path and a pointer to `/pr-babysit` (intent outcome 7).
- R16. When pro-execution's `using-git-worktrees` or `subagent-driven-development` skill is available, `/execute` defers to it for that part and otherwise does the work itself with plain git, with no plugin dependency declared on pro-execution (intent "Affected users and systems", `CLAUDE.md` on cross-marketplace dependencies).
- R17. The pro-ai-sdlc README, both manifest descriptions and the loop description in `intent/README.md` name `/execute` as the build stage between `/plan` and `/pr-babysit` (intent "Affected users and systems").
- R18. `commands/execute.md` declares `model: opus` in its frontmatter so Opus builds the plan in the session that runs the command (open question 4).
- R19. The building session dispatches subagents when a step benefits from one: parallel steps when `subagent-driven-development` is available, broad code search and the `verifier` pass; each dispatch names its model and effort (open question 4).
- R20. `/execute` does not pause between a green baseline and the build; it stops only on a failure named in R1 to R10 (open question 3).

### Non-functional

- N1. The command prose is harness-neutral: it says "dispatch a subagent" and "the harness's worktree tool" rather than naming one harness's tool, so it reads correctly under Codex.
- N2. Every stop leaves the main checkout untouched: no branch switch, no stash, no file written outside the worktree and the plan in it.
- N3. A run with no env files and no lockfile (this repo) works the same as one with both, with the skipped steps named in the output.

### Policy constraints applied

- Version-bump law (ADR-0002): the PR bumps pro-ai-sdlc from 0.2.0 to 0.3.0 in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and its marketplace entry plus `metadata.version` from 1.49.0 to 1.50.0, in one commit.
- Hook-loading law (ADR-0003): `/execute` adds no hook; `protect-tests`, `production-gate` and `plan-sync` keep running inside the worktree because they are registered per plugin, not per checkout.
- Codex parity (ADR-0004): pro-ai-sdlc ships no skills, so the law's skill and agent checks do not grow; see concern 1 for the command gap.
- ADR-0001 (skills first, commands where triggering must be deterministic): `/execute` is a command because it starts a long, side-effecting run that must only happen when the person asks.
- REVIEW.md security pass: no secrets in tracked files and no personal paths; R5 to R8 keep env values out of every output and commit.
- `CLAUDE.md`: no hard dependency on a plugin from another marketplace and no home-directory path in a command or doc.
- `production-gate`: `/execute` never triggers it, since it pushes only a feature branch and never merges or deploys.

## Design

### User experience

The person runs `/execute intent/<date>-<slug>/plan.md` from the main checkout.
The command prints one line per stage as it goes: gate passed, worktree made at a path on a branch, env files copied (names only, or "none"), dependencies installed, baseline green, step N of M built, proof of done, verifier result, PR opened.
A stop prints the stage, the reason and what the person can do next, for example "plan Status is draft; approve it in plan.md and commit".
There is no pause after the baseline (open question 3); the approved plan is the gate.
The tone matches the other stage commands: plain, short and specific.

### System

New: `plugins/pro-ai-sdlc/commands/execute.md`, with an `argument-hint` of `<path to plan.md>`, a Context block in the style of `plan.md` (repo root, branch, working tree, default branch, the plan's status line) and numbered steps that mirror R1 to R15.
Its `allowed-tools` must cover git worktree and push, `gh pr create`, the package managers, `cp`, Read, Edit, Write and subagent dispatch; the plan settles the exact list.
Modified: `plugins/pro-ai-sdlc/README.md`, both pro-ai-sdlc manifests, `.claude-plugin/marketplace.json` and `intent/README.md`.
Reused: the verify-command lookup from `pr-babysit.md`, the plan template's Done and Departures sections, the `verifier` agent plus pro-execution's `using-git-worktrees` and `subagent-driven-development` when present.
No migration; no data or hook changes.

### Alternatives considered

- A skill instead of a command: a skill can trigger on its own while building and opening a PR must only run when asked (ADR-0001).
- Living in pro-execution, next to the worktree skills: the loop's stage commands all live in pro-ai-sdlc while pro-execution is optional there.
- Copying every ignored file across (build output, caches): slow and copies far more than the app needs; the name list in R5 is the narrow version.
- Symlinking env files instead of copying: an edit in the worktree would change the main checkout's secrets. Some tools also refuse symlinked env files.

## Flagged concerns

ADR needed: no, a new opt-in command is cheap to reverse and sets no rule other work must follow; revisit if the env-file rule in R5 to R8 is later reused by other commands.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | Codex does not load plugin commands, so `/execute` has no Codex path, the same as the other six pro-ai-sdlc commands; the global rule says the loop works "from Claude Code alone" while ADR-0004 asks for parity on skill-bearing plugins only. | ADR-0004, Jody | open: accept the existing command-only gap, or add a Codex prompt or skill for the loop in a later intent. |
| 2 | The intent lists "routing cases" as affected, but `tests/cases/routing.jsonl` only targets skills and pro-ai-sdlc has none, so there is nothing a routing case can point at. | `tests/eval.mjs`, intent | open: drop routing cases from this change unless concern 1 adds a skill. |
| 3 | Copying secrets into a second working tree widens where they live. A nested `.gitignore` or a global excludes file could ignore a file in the main checkout but not in the worktree. | REVIEW.md pass 2, intent constraint | deferred: R7 checks ignore status after the copy; the `security-architect` challenge moves to a later intent (Jody, 2026-10-28) and does not block `/plan`. |
| 4 | Installing dependencies runs package lifecycle scripts with the copied secrets present in the tree. | REVIEW.md pass 2 | deferred: same risk as installing in the main checkout; the later security intent decides whether `--ignore-scripts` or installing before the copy is worth it. |
| 5 | The success criterion names `intent/2026-10-28-quiet-validation-hook/plan.md`, but that plan was already built in PR 60. Its Status still reads `approved` so R2 refuses it. | intent "Success looks like" | open: pick an unbuilt approved plan for the live check. Decide whether `/execute` or the Done sign-off should move a plan's Status to `implemented`. |
| 6 | `using-git-worktrees` prefers the harness's native worktree tool and an in-repo `.worktrees/`, which this repo does not ignore, while this repo's habit is a sibling folder; a native tool may base the branch on `HEAD` rather than `origin/main`. | pro-execution `using-git-worktrees`, memory on basing off `origin/main` | resolved: R4 uses the harness's tool only when it can base on `origin/<default branch>` and falls back to a sibling folder rather than an unignored `.worktrees/` (Jody, 2026-10-28). |
| 7 | The model split in `CLAUDE.md` says Opus orchestrates and Sonnet builds, while R18 makes Opus the builder for `/execute`. | `CLAUDE.md` model split, Jody | resolved: Jody chose Opus as the builder on 2026-10-28; the plan should note whether `CLAUDE.md` and the hq record need a line for this exception. |

## Open questions

1. Worktree location.
   Answered in R4: the harness's worktree tool when it can base the branch on `origin/<default branch>`, otherwise a sibling `../<repo>.<slug>` made with `git worktree add`.
   Jody took the recommendation on 2026-10-28.
2. Which env file names count.
   Answered in R5: `.env`, `.env.*`, `.dev.vars` and `.dev.vars.*`, git-ignored only; `config/*.local.*` is left out until a repo needs it.
3. Pause after the baseline?
   Answered in R20: no pause; it stops only on failure, because the plan's approval is the gate and the PR is the next human checkpoint.
   Jody took the recommendation on 2026-10-28.
4. Build in the current session or dispatch subagents per step?
   Answered in R18 and R19: Opus builds in the current session and dispatches subagents when needed.
   Jody chose Opus as the builder on 2026-10-28 (concern 7).
5. Security challenge for copying secrets.
   Deferred to a later intent (Jody, 2026-10-28); it covers concerns 3 and 4 and does not block `/plan`.

## Acceptance criteria

- AC1. `/execute` on a plan whose Status is `draft`, or with uncommitted edits, stops before making a worktree and names the reason.
- AC2. `/execute` on an unbuilt approved plan in this repo produces a worktree on a branch named from the slug whose merge base is the `origin/main` commit at the time of the run.
- AC3. In a fixture repo with an ignored `.env.local`, a nested ignored `apps/web/.env` and a tracked `.env.example`, the worktree gets the first two at the same paths, `.env.example` is the tracked copy and `git status` in the worktree shows none of them.
- AC4. A transcript and the PR body from AC3's run contain no line of any env file's contents.
- AC5. A fixture whose baseline test fails stops after the baseline with the failing command and makes no commit on the branch.
- AC6. A successful run ends with an open PR that links the intent folder, a plan whose Done section lists the build commit and checks plus an empty Sign-off line. Nothing is merged.
- AC7. `node tests/check.mjs && node tests/eval.mjs --dry` and `claude plugin validate . --strict` pass with pro-ai-sdlc at 0.3.0 in all three places and `metadata.version` at 1.50.0.

## Out of scope

Merging, release and deploy.
Running `/execute` from CI or a `build` label.
Chaining `/spec`, `/plan` and `/execute` into one command (the `/ship` idea).
Cleaning up the worktree after merge; `/merge-pr` or the person does that.
A Codex counterpart for pro-ai-sdlc's commands (concern 1).
