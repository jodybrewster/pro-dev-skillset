# Plan m3: a head-bound confirmation and a readiness check in the `/ship` preflight

Built from `spec-m3.md` and `intent.md` in this folder, committed with them.
Status: approved (pre-approved on 2026-11-07).
Approver: the engineer plus the maintainer as lead, because the merge gate gains a deny path and `ship.py` gains its first GitHub writes.
Dated: 2026-11-07.

One pull request on its own worktree, branch `build/reaching-done-m3`, built after m2 merges.
It bumps pro-ship to its next minor version from main at build time (0.18.0 after m2, which makes 0.19.0) in both manifests and its marketplace entry, plus one minor bump of `metadata.version` (1.94.0 after m2, which makes 1.95.0), in each commit that changes plugin content.
When another PR lands a bump first, rebase and take the next free minor.
Readiness (steps 1 to 3) and the confirmation (steps 4 to 9) touch separate functions of `ship.py` and could be built in parallel worktrees; they share the bump and one file, which keeps them in one PR.

## Files that change

- `plugins/pro-ship/scripts/ship.py` (modified): `runnable(step)`, `cmd_ready`, the prose and placeholder refusal in `validate_report`, `cmd_confirm` with `request` and `read` over a shared `read_reply` for both scopes and `--confirm-pr` and `--confirm-commit` in `cmd_deployed`.
- `plugins/pro-ship/scripts/merge-gate.py` (modified): `confirmation_line` with its own `mode.confirmation` lookup, called beside `preflight_line`.
- `plugins/pro-ship/skills/ship/SKILL.md` (modified): the readiness step after "Targets and scope" and the confirmation offer after the verdict.
- `plugins/pro-ship/skills/ship/rollbacks.md` (modified): every step a fenced command or a `manual:` step.
- `plugins/pro-ship/skills/deployed/SKILL.md` (modified): the confirmation offer for a deploy check left at `confirm`, `--confirm-pr` and `--confirm-commit`.
- `plugins/pro-ship/.claude-plugin/plugin.json`, `plugins/pro-ship/.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (modified): the bump.
- `CLAUDE.md` (modified): the Ship block's rollback steps; `AGENTS.md` is a link to it and changes with it.
- `docs/ship-preflight.md` (modified): `confirmation` inside `detail_json`, the request line, the two scopes and the reply rule.
- `docs/loop-records.md` (modified): how a deploy check is cleared by `--confirm-pr` or `--confirm-commit`.
- `docs/enforce-mode.md` (modified): a `confirmation` row.
- `docs/licenses.md` (modified): the super-board row names the approval and readiness scripts.
- `tests/ship-preflight.mjs`, `tests/ship-deploy.mjs`, `tests/ship-hooks.mjs` (modified) and `tests/fixtures/ship-preflight/` (modified): a fake `gh` that serves PR comments, commit comments, a PR search and permissions.
- `docs/roadmap.md` (modified): items 37 and 38 ticked with the PR; the "Now" line about clearing a check left at `confirm` points at this PR.

## Order of work

1. Failing cases in `tests/ship-preflight.mjs` for `ready`: the prose step `Revert the release commits on main` exits 9 and is named; an argv list, a one-line inline code span, a `sh` fenced block and a `manual:` step beside a runnable one pass; a target whose only rollback step is `manual:` fails; a `verify` list with `check the health page` fails and one with a fenced `curl` passes; `preflight.json` and `report.json` keep their sha256 across a failing run (size S; R16 to R21, AC7, AC8, AC9)
2. `ship.py`: `runnable(step)` returns `command`, `manual` or `prose`; `cmd_ready` walks every target's `rollback.steps` and `verify`, prints the problems with each text cut to 80 characters and exits 9; it opens no file for writing (size M; R16 to R21, N2)
   Checkpoint: `node tests/ship-preflight.mjs` passes the new cases and the old ones.
3. `validate_report` refuses a GO with a prose step or a `<placeholder>` left in a command step, while `manual:` lines are exempt; `rollbacks.md` rewritten; the ship skill runs `ready` right after "Targets and scope" and stops with the R22 line; the Ship block in `CLAUDE.md` replaces its two prose steps with these four, which revert and push the revert and tag nothing (size S; R22 to R25, AC10, AC11):
   - `` `git revert --no-edit <first release commit>^..<last release commit>` ``
   - `` `git push origin main` ``
   - `manual: installs pinned to the previous release's tag already have the old copy`
   - `manual: a new release, if one is needed, goes through /ship with its own bump and tag`
   Checkpoint: `python3 plugins/pro-ship/scripts/ship.py ready` exits 0 on this repo; `node tests/check.mjs` passes.
4. Failing cases for `confirm` in `pr` scope with a fake `gh` on `PATH`: `request` posts one PR comment whose request line parses to the head, the items and scope `pr`; it refuses a headless run and an item that is neither a `confirm` check nor a deploy check name; `read` clears the checks for a later unedited `confirmed` from a write user and refuses a label alone, an edited reply, an earlier reply, a reply bound to another head and a read-only user, each with its own `why`; after a valid read `ship.py check` still reports the record fresh (size S; R1 to R9, AC1, AC2, AC3)
5. `ship.py cmd_confirm`: `request` works out the scope (`--pr`, else `gh pr list --search <sha> --state all`, else `tag`), builds the sorted-key JSON line and posts through `gh pr comment --body-file -` or `gh api repos/{owner}/{repo}/commits/{sha}/comments -F body=@-` after `refuse_headless`; `pick_scope` serves `request`, `read` and `deployed` alike; `read_reply` applies the reply rule to either comment shape; `read` rewrites `preflight.json` atomically for a record of that head with `confirmation` inside `detail_json` and the listed checks moved to `pass`, then refreshes the mieruka copy by the drop rule (size M; R1 to R9)
   Checkpoint: `node tests/ship-preflight.mjs` and `MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs` pass.
6. Failing cases in `tests/ship-deploy.mjs`, then `cmd_deployed --confirm-pr <n>` and `--confirm-commit <sha>`: read the reply with `read_reply`; a `confirm` check whose item name the confirmation lists becomes `pass` when the confirmed head or, in `pr` scope, the PR's merge commit is the deployed commit; the record reaches `pass`; the tag-scope case uses `--from-tag v1.2.0` with `rollback dry run` and `tests on a clean checkout of the tag` (size M; R10, R11, AC4, AC5)
7. Failing cases in `tests/ship-hooks.mjs`, then `merge-gate.py`: at medium and high tier with a fresh preflight that lists a `confirm` check or a `pr`-scope confirmation, one `gh pr view <n> --json comments` inside the existing deadline; the line `confirmation: <login> for <head8>` or `confirmation: missing (<cause>)`; `mode.confirmation` read only from that file; in enforce a missing confirmation denies once per head per session with the `confirm request` command and the identical retry passes; nothing added when the record lists no `confirm` check (size M; R12, R13, R14, N1, AC6)
   Checkpoint: `node tests/ship-hooks.mjs` passes; the gate answers inside 20 seconds with a fake `gh` that sleeps 15.
8. The ship skill offers `confirm request` after the verdict when any check is `confirm`; the deployed skill offers it for a deploy check left at `confirm` and names `--confirm-pr` and `--confirm-commit`; both ask first and never post a reply (size S; R15)
9. `docs/ship-preflight.md`, `docs/loop-records.md`, the `confirmation` row in `docs/enforce-mode.md` (warn start, the accepted limit that a session holding the person's token could post the reply), the super-board row in `docs/licenses.md`, the pro-ship bump with `metadata.version` and the roadmap ticks for 37 and 38 (size S; N3, N4)
   Checkpoint: the full proof of done below (AC12).

Steps 5 and 6 add the first GitHub writes in `ship.py`; they post only after the person's yes and only through `confirm request`, which leaves nothing irreversible beyond a comment the person can delete.

## Tests that prove it

- `tests/ship-preflight.mjs` covers `ready` (each step form, a manual-only target, the `verify` list, untouched records), the GO refusal and `confirm` in `pr` and `tag` scope (request, each refusal of `read` and a valid read that keeps the record fresh).
- `tests/ship-deploy.mjs` covers `--confirm-pr` for the head and for the merge commit and `--confirm-commit` after a tag release.
- `tests/ship-hooks.mjs` covers the merge gate's confirmation line in warn, the deny once in enforce, the retry and silence when nothing is `confirm`.
- `tests/mieruka-sync.mjs` loads the preflight record after a confirmation.
- `python3 plugins/pro-ship/scripts/ship.py ready` on this repo proves the Ship block.

## Risks

Step 7 is the most likely to go wrong: the merge gate runs on every `gh pr merge` in every repo with pro-ship; a second `gh pr view` could push it past its deadline or misread a reply.
The guards are the existing deadline with could-not-run as the fallback, the warn start under its own mode key and the silence when the record lists no `confirm` check; the damage is one extra line, or one deny per head in enforce.
Step 5 trusts a reply from the person's own `gh` login, which an agent with that token could also post; the spec's concern 2 accepts that for a local guardrail and the `docs/enforce-mode.md` row records it.
Step 3 changes `CLAUDE.md`, which every session reads; the edit is limited to the rollback lines of the Ship block.
Its `git push origin main` step is the one place the repo's PR-only rule gives way, because a rollback has to land before a PR could merge; `/ship` writes it and never runs it.

Stop-list categories: deploy (steps 3 and 6 change how rollback steps and deploy checks are read, never run) and permission (step 5 checks a login's write access); neither changes an auth rule or runs a deploy.

## Options not taken

- The merge gate posts the request: a hook would write to GitHub; the skill posts after a yes.
- A `confirmed` label: anyone with triage access can set it and it carries no head.
- PR comments only: a tag release often has no PR for its head.
- Two PRs for readiness and confirmation: both bump pro-ship and both change `ship.py`, which one PR avoids rebasing.
- Tagging inside the rollback: re-creating `<plugin>--v<previous version>` rewrites what installs pinned; a new tag belongs to a release that `/ship` checks.

## Proof of done

```
node tests/check.mjs                         # 0 failures
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70
node --test tests/unit/*.test.mjs
node tests/ship-preflight.mjs
node tests/ship-deploy.mjs
node tests/ship-hooks.mjs
MIERUKA_ROOT=<mieruka checkout> node tests/mieruka-sync.mjs
python3 plugins/pro-ship/scripts/ship.py ready   # exit 0 on this repo
claude plugin validate . --strict            # Validation passed
claude plugin validate plugins/pro-ship --strict
```

## Done

Filled in when the build is finished, before sign-off.

- Build commit:
- Checks run:
- Definition of done:
- Visual: none
- Doubt:
- AC1:
- AC2:
- AC3:
- AC4:
- AC5:
- AC6:
- AC7:
- AC8:
- AC9:
- AC10:
- AC11:
- AC12:
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

## Noticed but not touched
