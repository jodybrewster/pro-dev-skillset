# Plan m2: the id in git

Built from `spec-m2.md` (commit of this PR) and `intent.md` in this folder.
Status: approved.
Approver: the engineer; the maintainer pre-approved on 2026-11-07. The hook runs on every Bash call in every repo with pro-ai-sdlc; it starts in warn and has cases for each path.
Dated: 2026-11-07.

Starts after m1 is merged.
Two pull requests: B (pro-ship, steps 1 and 2) merges first so `ship.py` reads an id-prefixed subject before any exists, then A (pro-ai-sdlc, steps 3 to 10).
Each bumps its plugin in both manifests and the marketplace entry plus `metadata.version` in `.claude-plugin/marketplace.json`; A rebases after B.
Each build takes the next minor above its base for pro-ship and pro-ai-sdlc.

## Files that change

- `plugins/pro-ship/scripts/ship.py` (modified): `commit_kind` strips one leading id.
- `tests/ship-version.mjs` (modified): the id-prefixed subjects.
- `plugins/pro-ship/.claude-plugin/plugin.json`, `plugins/pro-ship/.codex-plugin/plugin.json` (modified): the bump.
- `plugins/pro-ai-sdlc/scripts/change-id.py` (new): the commit-subject hook.
- `plugins/pro-ai-sdlc/hooks/hooks.json` (modified): its PreToolUse entry on `Bash`.
- `tests/sdlc-hooks.mjs` (modified): the hook cases.
- `plugins/pro-ai-sdlc/scripts/execute-gate.py` (modified): `change_id` and the `<id>/build` branch.
- `tests/execute.mjs` (modified): the branch cases.
- `plugins/pro-ai-sdlc/scripts/factory.py` (modified): `binding_reasons` for `<id>/brief` and `<id>/build`.
- `plugins/pro-ai-sdlc/factory/session.sh` (modified): `want` is `<id>/brief` or `<id>/build` for an intent with an id.
- `tests/factory.mjs` (modified): the binding cases.
- `plugins/pro-ai-sdlc/commands/spec.md`, `plan.md`, `intent.md`, `incident.md`, `execute.md`, `auto.md`, `pr-babysit.md` (modified): branch and subject rules; `Bash(git switch:*)` in `allowed-tools` of `/spec` and `/plan`.
- `plugins/pro-ai-sdlc/README.md` (modified): the hook under `## Hooks`.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json`, `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` (modified): the bump.
- `docs/enforce-mode.md` (modified): the `change-id` row.
- `docs/factory.md` (modified): the branch names.
- `.claude-plugin/marketplace.json` (modified): the versions and `metadata.version`, once per PR.

## Order of work

1. Failing cases in `tests/ship-version.mjs`: `PDS-51: feat: add x` is a feature, `PDS-51: fix(y)!: z` is breaking, `PDS-51: tidy` is unknown and `feat: x` is unchanged (size XS; R9, AC1)
2. `commit_kind` removes one leading `^[A-Z]{2,6}-[1-9][0-9]*: ` before its match; bump pro-ship (size XS; R9, N2)
   Checkpoint: `node tests/ship-version.mjs` and `node tests/check.mjs` pass; `claude plugin validate plugins/pro-ship --strict` passes; PR B opens and merges.
3. Failing cases in `tests/sdlc-hooks.mjs` for `change-id.py` on a fixture repo: branch `TST-4/build` with `git commit -m "no id"` logs and allows in warn and denies in enforce; `TST-4: ok` allows silently; a heredoc message `TST-4: ok` allows; `git commit` with no `-m`, with `-F` and with `--amend --no-edit` allow silently; branches `main` and `feature/x` log nothing; a payload of `{` exits 0 (size S; R11, R12, R13, R14, AC3)
4. `change-id.py`: read the payload through `guard.read_payload`, split segments as `production-gate.py` does but keep heredoc bodies whole, find `git commit` with an optional `-C <dir>`, read the branch with one `git branch --show-current`, read the subject from `-m`, `--message` or the heredoc, compare with `<id>: ` and go through `guard.warn`, or `deny` only when the file `mode.change-id` exists and holds `enforce`, reading its own key alone as `stale-done` does so a global `mode`, `CLAUDE_GUARD_MODE` or the container's `mode` file from `session.sh` leaves it in warn; a case for each of those three (size M; R11, R12, R13, R14, N1, N3)
   Checkpoint: `node tests/sdlc-hooks.mjs` passes every case, including the existing ones.
5. `hooks/hooks.json` gains the entry beside `production-gate` with a 5 second timeout; `plugins/pro-ai-sdlc/README.md` lists the hook; `docs/enforce-mode.md` gains the `change-id` row (size S; R10, R15, R16, AC5)
   Checkpoint: `node tests/check.mjs` passes the hook-loading checks; `claude plugin validate plugins/pro-ai-sdlc --strict` passes.
6. `execute-gate.py` reads `id:` from the intent's frontmatter, prints `change_id` and `branch` as `<id>/build` or `<id>/build-<module>`; cases in `tests/execute.mjs` for both and for an intent with no id (size S; R4, AC2)
7. `binding_reasons` in `factory.py` expects `<id>/brief` or `<id>/build` for an intent with an id and today's names otherwise; `factory/session.sh` reads the intent's `id:` and sets `want` to the same names; cases in `tests/factory.mjs`, including an s1-harness case asserting the `--head` value passed to the stubbed `gh` (size S; R6, R7, AC4)
   Checkpoint: `node tests/execute.mjs` and `node tests/factory.mjs` pass.
8. `commands/spec.md` and `commands/plan.md` create `<id>/spec` or `<id>/plan` from the default branch with `git switch -c` and write `<id>: spec: <slug>` or `<id>: plan: <slug>`; `commands/intent.md` and `commands/incident.md` write `<id>: intent: <slug>` and `<id>: incident: <slug>` (size S; R1, R2, R3)
9. `commands/execute.md` starts every subject and the PR title with `<id>: `, keeping `feat:` or `fix:` after it; `commands/auto.md` uses `<id>/brief` and `<id>/build`; `commands/pr-babysit.md` prefixes fix commits on an id branch (size S; R5, R6, R8)
10. `docs/factory.md` names the branches; bump pro-ai-sdlc in both manifests and the marketplace plus `metadata.version` (size XS; N2, AC6)
    Checkpoint: the full proof-of-done block passes; PR A opens.

No step is irreversible.
Steps 3 to 5 and steps 6 to 9 touch separate files and can run in parallel worktrees.

## Tests that prove it

- `tests/ship-version.mjs` covers the id before the Conventional Commit word.
- `tests/sdlc-hooks.mjs` covers the hook in warn, in enforce, with a correct subject, a heredoc, each unreadable message, a non-id branch and a malformed payload.
- `tests/execute.mjs` covers the build branch with and without an id and with a module.
- `tests/factory.mjs` covers the brief and build branch binding with and without an id.

## Risks

Step 4 is the one most likely to go wrong: the hook runs on every Bash call; a parse that hangs or throws would touch every session.
The guards are an early exit when the command holds no `git commit`, one `git` call with a 5 second timeout, a catch-all that exits 0 and the warn default.
A heredoc parse that misreads the subject would warn on a good commit; warn mode only logs and `docs/enforce-mode.md` keeps it in warn until a week of lines is read.
Step 7 changes what the factory host accepts as its own PR; a mismatch raises a run to level 3, which stops it safely.
A branch `PDS-51` with no slash would block `PDS-51/spec` in git; no command creates such a branch.

Stop-list categories: none; no auth, migration, payment, deploy or secret handling is touched.

## Options not taken

- `feat(PDS-51): ...` subjects: the id would read as a scope and the intent asks for it first.
- A `commit-msg` hook installed per clone: an install step per clone and outside the guard modes.
- Blocking in enforce on an unreadable message: an editor commit would be denied with no way to show the id.

## Proof of done

```
node tests/check.mjs                       # 0 failures
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/sdlc-hooks.mjs                  # all cases pass, including change-id
node tests/execute.mjs && node tests/factory.mjs && node tests/ship-version.mjs
claude plugin validate . --strict          # Validation passed
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
grep -n "change-id" docs/enforce-mode.md plugins/pro-ai-sdlc/hooks/hooks.json
```

## Done

Filled in when the build is finished, before sign-off.

- Build commit:
- Checks run:
- Definition of done: (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more)
- Visual: none
- Doubt:
- AC1 to AC6:
- Sign-off:

The sign-off moves `status` in the intent and the spec to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- One pull request instead of two: the pro-ship change (steps 1 and 2) rides beside pro-ai-sdlc, each plugin with its own bump in both manifests and the marketplace entry and `metadata.version` once.
  `ship.py` then reads an id before the kind word in the same merge that starts writing ids into subjects, which is what the B-first order was for.
- `change-id.py` reads its own payload instead of going through `guard.read_payload`, so an empty or broken payload logs `could-not-parse` as R14 says; the shared helper logs `parse-error`.
- `change-id.py` also follows a `cd <dir>` earlier in the command, besides `git -C`.
  A session in one checkout that runs `cd <worktree> && git commit` would otherwise read the branch of the wrong checkout and warn on a good commit.
- `execute-gate.py` asks origin for `refs/heads/<branch>` exactly; the bare name it passed before also matched a longer ref ending in the same words.
- The pro-ai-sdlc description in both manifests and the marketplace entry now says four hooks and names `change-id`.
- `tests/factory.mjs` gains the mixed-folder case the m1 review asked for (i10, i11: a date folder and two id folders, `next` takes the date folder first and then the lowest id) and `makePr` takes a `folder` option for the id-intent binding cases.
- The `docs/enforce-mode.md` counts command lists `change-id` beside the other gates.
- A plugin eval case, `plugins/pro-ai-sdlc/evals/hook-change-id/` tagged `hook:change-id`, because the `component-coverage` check fails a new hook with no case; it was scaffolded and the hook run on it by hand, the paid eval was not run.

## Noticed but not touched

- `/incident` still names its branch `incident/<slug>`: spec-m2 sets only its subject, so `/spec` run on that branch commits there and says the branch does not start with `<id>/`.
- R1's one-line note when `/spec` commits on a branch that does not start with `<id>/` is command prose and has no automated case.
- Codex runs no Claude hook, so under Codex the subject rule rests on the command prose alone (ADR-0004).
