# Plan: the pro-quality doc hooks

This is a small fix with no `spec.md`; the intent states its check.
Work happens in the `pro-dev-skillset.fix-doc-hooks` worktree on `fix/doc-hooks`, cut from `origin/main`.
The job ends at an open PR. Jody sends it up and merges.

## Step 1: failing tests first

1. Add `tests/doc-hooks.mjs`, wire it into `tests/check.mjs`, add `npm run test:doc-hooks`.
2. Push cases: `git -C`, `cd &&`, new branch with no upstream, docs-only diff, a code change that still blocks, no remote.
3. Write cases: agent files, scratchpad and temp paths, plan docs that still block.
4. Commit the cases alone and record the failing count.

## Step 2: the fix

1. `docs-before-push.py`: resolve the repo from the command, judge `upstream...HEAD` or the merge-base with the remote default branch, treat docs-only changes as exempt.
2. `docs-to-project.py`: allow agent files and scratch space.
3. Bump `pro-quality` to 0.9.5 in both manifests and the marketplace entry, and `metadata.version` to 1.44.0.

## Step 3: review follow-ups (PR 55)

Each behavior change gets its failing case in a commit of its own before the fix, and the tests are not edited during the fix.

1. Docs-only rule narrowed to root `*.md`, `docs/**` and `intent/**`.
2. Agent-file allow scoped to `~/.claude/` directly and the session's own repo.
3. Heredoc bodies stripped before the command is split.
4. Wrappers handled: `env`, `command`, `timeout N`, `bash -c` and `sh -c` with a quoted inner command. Splitting respects quotes so the inner command survives.
5. Scratch space limited to `claude-*` directories.
6. The block message includes the judged repo path.
7. Fixture git identity is not an email address (REVIEW.md bans emails outside manifests).

## Known gaps (fail-open on purpose)

- Unresolvable target directories (variables, command substitution, `pushd` and `popd`) are skipped, so the push is allowed. The hook cannot tell which repo is meant.
- `$(...)` and backtick substitutions are not parsed for pushes.
- Wrappers beyond the list above (`sudo`, `nohup`, `xargs`, aliases and shell functions) are not followed.
- A refspec such as `git push origin other:branch` is judged by `HEAD`, not by the refspec.

## Risks and rejected options

- Rejected: keep the `HEAD~1` fallback. It is the root cause of Bug 1.
- Rejected: allow all of `/tmp`. It differs by platform and lets stray docs through. Only `claude-*` directories are exempt.
- Risk: a regex that is too narrow misses a real push. The cost is a missed reminder, which is the cheaper mistake than a wedged session.

## Proof of done

`node tests/doc-hooks.mjs` has 0 failures. `node tests/check.mjs && node tests/eval.mjs --dry` pass.
`claude plugin validate . --strict` and `claude plugin validate plugins/pro-quality --strict` pass.
