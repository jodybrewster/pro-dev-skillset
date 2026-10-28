# Plan: /execute builds an approved plan in its own worktree

Built from `spec.md` (commit f2d1710) and `intent.md` in this folder.
Status: approved.
Approver: Jody Brewster; no separate lead, but this copies secrets between checkouts, so it does not suit auto mode.
Dated: 2026-10-28.

## Files that change

- `plugins/pro-ai-sdlc/scripts/execute-gate.py` (new): the R1 to R3 checks as a script, so the gate is deterministic and testable; prints the slug, branch name and intent folder or the reason it stops.
- `plugins/pro-ai-sdlc/scripts/copy-env.py` (new): R5 to R7 as a script, so env files are found, copied and checked by code that prints only relative paths and the model never opens them.
- `plugins/pro-ai-sdlc/commands/execute.md` (new): the command, with `model: opus` (R18), calling the two scripts through `${CLAUDE_PLUGIN_ROOT}/scripts/` and carrying R4 and R8 to R20 as prose steps.
- `tests/execute.mjs` (new): fixture-repo cases for both scripts, exported as `runExecuteCases()` the way `tests/sdlc-hooks.mjs` exports its cases.
- `tests/check.mjs` (modified): a new `execute-scripts` check that runs those cases plus `sdlc-contract` lines that pin the command's script paths, `model: opus` and its never-merge rule.
- `package.json` (modified): a `test:execute` script beside the other per-suite scripts.
- `plugins/pro-ai-sdlc/README.md` (modified): an Execute row in the loop table, a Scripts note and a line that the plugin is Claude Code only (R17, spec Summary).
- `intent/README.md` (modified): one line that `/execute` builds from `plan.md` and opens the PR (R17).
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` (modified): version 0.3.0 and `/execute` in the description (ADR-0002, R17).
- `.claude-plugin/marketplace.json` (modified): the pro-ai-sdlc entry at 0.3.0 with the same description, `metadata.version` 1.50.0.
- `CLAUDE.md` and `AGENTS.md` (modified): one line under Model split that `/execute` runs on Opus as the builder (spec concern 7).

## Order of work

1. Make the worktree the way `/execute` will: `git fetch origin`, `git worktree add ../pro-dev-skillset.execute-command -b execute-command origin/main`, then build there.
   The main checkout carries Jody's uncommitted edits to five pro-ai-sdlc commands, so nothing is built in it.
2. Probe that `claude plugin validate plugins/pro-ai-sdlc --strict` accepts `model: opus` in a command's frontmatter, using a scratch copy of the plugin outside the repo.
   If it is refused, stop and record a departure before going further, since R18 depends on it.
3. Write `tests/execute.mjs` with every case below for both scripts, wire it into `tests/check.mjs` as `execute-scripts` and add `test:execute` to `package.json`.
   Run `node tests/execute.mjs` and see every case fail because the scripts do not exist yet; commit the red tests.
4. Write `execute-gate.py` until its cases pass.
   It takes the plan path and checks: the file exists and is tracked (`git ls-files --error-unmatch`), `git status --porcelain -- <plan>` is empty, a line reads `Status: approved` (trailing period allowed), the Done section's `Build commit:` value is empty or the `<sha>` placeholder and branch `<slug>` exists neither locally nor on `origin` (`git ls-remote --heads origin <slug>`).
   On success it prints one JSON line with `slug`, `branch`, `intent_dir` and `default_branch`; on failure it exits 1 with a one-line reason.
   This commit also bumps pro-ai-sdlc to 0.3.0 in both plugin manifests and the marketplace entry plus `metadata.version` to 1.50.0, since it is the first content change under `plugins/pro-ai-sdlc/` (ADR-0002).
5. Write `copy-env.py <main checkout> <worktree>` until its cases pass.
   It lists candidates with `git -C <main> ls-files --others --ignored --exclude-standard -z` limited to the pathspecs `:(glob)**/.env`, `:(glob)**/.env.*`, `:(glob)**/.dev.vars` and `:(glob)**/.dev.vars.*`, drops anything under `node_modules/`, skips a path the worktree tracks or already has, copies the rest with `shutil.copy2` and then runs `git -C <worktree> check-ignore` on each copy.
   If any copy is not ignored it removes every copy it made, prints the offending paths and exits 2; otherwise it prints the copied paths (or `none`) and exits 0.
   It never prints, logs or hashes file contents.
6. Write `commands/execute.md` in the style of `plan.md` and `pr-babysit.md`: frontmatter with `description`, `argument-hint: "<path to plan.md>"`, `model: opus` and an `allowed-tools` list covering the two scripts, git (fetch, worktree, branch, status, log, diff, add, commit, push), `gh pr create`, `gh pr view`, the npm, pnpm, yarn and bun install and run commands, `cp`, Read, Edit, Write, Glob, Grep and subagent dispatch.
   Steps in the command: run the gate (R1 to R3); make the worktree with `git worktree add ../<repo>.<slug> -b <slug> origin/<default branch>` and move the session into it with Claude Code's worktree tool given that path (R4); run `copy-env.py` and print its output only (R5 to R8); install and run the baseline verify command, stopping on red with the worktree kept (R9, R10, R20); build the Order of work test-first, one commit per step or group, departures in the same commit (R11, R12, R19); run the Proof of done commands, dispatch the `verifier` with model and effort named, fill the Done section except Sign-off (R13); `git push -u origin <slug>` and `gh pr create` with the intent folder link and one line per acceptance criterion, falling back to the compare URL if `gh` fails (R14); print the PR URL, the worktree path and `/pr-babysit` (R15).
   The secrets rule (R8) sits as its own short section near the top. The never-merge, never-`--no-verify`, never-force-push rule closes the command.
7. Add the `sdlc-contract` lines to `tests/check.mjs`: `commands/execute.md` names `${CLAUDE_PLUGIN_ROOT}/scripts/execute-gate.py` and `${CLAUDE_PLUGIN_ROOT}/scripts/copy-env.py`, its frontmatter has `model: opus`, it names the plan's `## Done` and `## Departures from plan` sections and it contains a never-merge line.
8. Update `plugins/pro-ai-sdlc/README.md`, `intent/README.md`, `CLAUDE.md` and `AGENTS.md` (one Model split line each, same wording) and the three description strings for `/execute`.
9. Run the proof of done, open the PR from the worktree and link this intent folder.

## Tests that prove it

- `tests/execute.mjs` gate cases, each in a fixture repo with a bare `origin`: plan untracked (stop), plan with an uncommitted edit (stop), `Status: draft` (stop), `Status: approved` with a filled `Build commit:` (stop, R2), branch already local (stop), branch already on `origin` (stop), approved plan with the `<sha>` placeholder (pass, prints the slug with the date prefix removed).
- `tests/execute.mjs` copy cases: the AC3 fixture (ignored `.env.local` and `apps/web/.env` copied with their mode bits, tracked `.env.example` left as the tracked copy, `node_modules/pkg/.env` skipped, `.dev.vars` copied); a run where every file contains a marker string, asserting the marker never appears in stdout or stderr (AC4 for the script); a main checkout whose uncommitted `.gitignore` edit ignores `.env.local` while `origin/main`'s does not (exit 2, the copy removed, the path named); a repo with no env files (prints `none`, exit 0).
- `node tests/check.mjs` runs both the `execute-scripts` and `sdlc-contract` checks.
- Live check A (AC1): `/execute` on this folder's own `plan.md` while its status is `draft` stops at the gate with no worktree made.
- Live check B (AC5): in a scratch repo with an approved plan and a failing test, `/execute` stops after the baseline, keeps the worktree and makes no commit on the branch.
- Live check C (AC2, AC3, AC4, AC6): after merge, `/execute` on the next unbuilt approved plan in this repo, chosen by Jody (spec concern 5), ends with an open PR, a Done section with the build commit and checks and an empty Sign-off; the transcript and PR body hold no env file contents.

## Risks

The step most likely to go wrong is step 5.
A pathspec or ignore rule that matches more than intended could copy a secret into a place git tracks. A mistake in the rollback could leave one behind; the not-ignored fixture and the marker-string case exist to catch both.
The second risk is the command prose: during a failing baseline the model may want to read `.env` to debug, which R8 forbids. Only the prose holds that line, so the rule must be explicit and early.
Step 2 could fail if strict validation rejects `model:` in a command; R18 then needs another route, recorded as a departure.
What it could break: nothing that exists today, since `/execute` is new and the scripts are not hooks; the version bump only reaches people who update.
If Jody's uncommitted pro-ai-sdlc command edits land first with their own bump, this branch merges `origin/main` and bumps to the next minor.
Nothing here is irreversible: a bad run leaves a worktree and a branch that `git worktree remove` and `git branch -D` clear.

## Options not taken

- Creating the worktree with Claude Code's worktree tool by name: it places the worktree under `.claude/worktrees/` (not ignored in this repo), names the branch itself and follows the user's `worktree.baseRef` setting, which can be `head`; `git worktree add` fixes the base and branch name while the tool is still used to move the session into the result, so R4 holds both ways.
- Env discovery and gating as command prose only: the model would have to list and handle secret files itself and nothing could test it.
- `.worktrees/` inside the repo, as `using-git-worktrees` defaults to: needs a new ignore rule in every repo that uses `/execute`.
- Moving a plan's Status to `implemented` from `/execute` (spec concern 5): the gate already refuses a plan with a build commit. Status changes belong to the sign-off, so it is left out.
- Removing pro-ai-sdlc's `.codex-plugin/` folder now that the plugin is Claude Code only: a separate decision for a later intent (spec concern 1).
- Running the live checks on `intent/2026-10-28-quiet-validation-hook/plan.md`, as the intent suggested: it was built in PR 60, so the gate rightly refuses it.

## Proof of done

Run in the worktree; every line must pass.

```bash
node tests/execute.mjs
node tests/check.mjs && node tests/eval.mjs --dry
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
git grep -n -e '/Users/' -e '~/Projects/' -- plugins/pro-ai-sdlc tests/execute.mjs
```

Finished looks like: every execute case passing, `0 failures` from `check.mjs`, `✔ Validation passed` once for the marketplace and once per plugin, no output from the `git grep` and live checks A and B observed as described.
Live check C runs after merge and is recorded in Done before sign-off.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: 545df8f
- Checks run: `node tests/execute.mjs` 28/28 execute cases passed; `node tests/check.mjs` 22 checks, 0 failures, 38 warnings; `node tests/eval.mjs --dry` 72 cases reference real skills; `claude plugin validate . --strict` passed; all 16 plugins passed `claude plugin validate <plugin> --strict`; the personal-path `git grep` printed nothing.
- Verifier (sonnet, fresh context): found a crash on a dangling env symlink, symlinks copied as their targets' contents and gaps in `execute.md` for R3, R16 and per-stage output; all fixed in 545df8f and listed under Departures.
- AC1: partly passed. `execute-gate.py` refuses `intent/2026-10-17-intent-in-core/plan.md` ("plan Status is implemented, not approved") and this folder's plan ("branch execute-command already exists locally"), and fixture cases g5 and g6 cover uncommitted and draft plans; a live `/execute` run is not done yet.
- AC2: not run; live check C after merge.
- AC3: passed in fixtures (c1 to c7): ignored `.env.local` and `apps/web/.env` copied with mode 0600 kept, tracked `.env.example` untouched, `node_modules` skipped, worktree `git status` clean.
- AC4: passed for the scripts (c5, c11, c16 find no marker in any output); the transcript and PR body half waits on live check C.
- AC5: not run; live check B needs the plugin installed at 0.3.0.
- AC6: not run; live check C after merge.
- AC7: passed; pro-ai-sdlc is 0.3.0 in both manifests and the marketplace entry, `metadata.version` is 1.50.0.
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves any ADR with Status `proposed` from this change to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 6, `allowed-tools`: `cp` is left out because `copy-env.py` does the copying; `node`, `make`, `git show`, `git merge-base` and `gh repo view` are added so the verify command, the verifier and the PR step run without a prompt in repos like this one.
- R4: the worktree is always made with `git worktree add` and entered with Claude Code's worktree tool, rather than made by that tool when it can base on `origin/<default branch>`, for the reasons under Options not taken; the base and the session following the worktree still hold.
- Verifier findings: `copy-env.py` now recreates a symlinked env file as the same link, where it used to copy the target's contents (one outside the repo included) or crash on a dangling link; any copy error rolls back and exits 2. The gate also reads a bold `**Build commit:**` line and says when there is no origin remote. Cases c14 to c16, g11 and g12 cover them.
- Security review of the diff (security-architect, opus, nothing blocking): `allowed-tools` drops `Bash(python3:*)` and `Bash(node:*)` so an injected `node -e` or `python3 -c` prompts; the Secrets section now says checks are recorded as command, result and counts (never pasted output) and is copied into every subagent prompt. A hook-level deny on reading env files and narrowing `git push` are left for the deferred security intent.
