# Spec: one security gate, on push, scoped to the diff

Each statement is checkable by a command, a grep or a file.

## Hooks

- S1.1 `plugins/pro-security/hooks/hooks.json` registers exactly one event, `PreToolUse`, with exactly one entry, matcher `Bash`, running `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/push-gate.py"`.
- S1.2 `plugins/pro-security/scripts/` holds `push-gate.py` and `security_surface.py` and no other `.py` file.
  `commit-gate.py`, `ideation-nudge.py`, `plan-doc-gate.py` and `plan-gate.py` are gone.
- S1.3 `grep -rn 'commit-gate\|ideation-nudge\|plan-doc-gate\|plan-gate' plugins/pro-security tests README.md docs/releases.md` returns nothing except historical rows in `docs/releases.md`.

## push-gate.py

- S2.1 A `git push` in any form (`git push`, `git push -u origin x`, `git push --force-with-lease`, prefixed by environment assignments, after `cd` in a chain, with `-C <dir>`) is classified as a push.
  `git push --dry-run` is not gated.
- S2.2 `gh pr create` is classified as a PR.
- S2.3 `git commit` in any form is never gated; the script emits nothing for it even when the staged diff touches security surface.
- S2.4 The diff for a push is `git diff <upstream>...HEAD` where `<upstream>` is the branch's `@{upstream}` when it exists, otherwise the first of `origin/HEAD`, `origin/main`, `main` that resolves.
  When none resolves, the script emits nothing.
  The diff for a PR uses the same fallback list without consulting `@{upstream}`.
- S2.5 A diff whose files are Markdown only, or that `security_surface.diff_files` maps to no category, emits nothing.
- S2.6 A diff that touches security surface is denied through `permissionDecision: "deny"` once per distinct diff (sha256 of the diff text) per session.
  The identical retry in the same session emits nothing.
  Another session with the same diff is denied again.
- S2.7 The deny reason names the categories, up to five of the files, the exact `git diff` command that reproduces the diff and tells Claude to dispatch `security-architect` in diff mode on that diff and nothing else.
- S2.8 Malformed stdin, an empty command, a non-git cwd and any exception all exit 0 with no output.

## Agent

- S3.1 In `plugins/pro-security/agents/security-architect.md`, the Diff mode section says the scope is the diff handed in: the hunks, the changed files in full and the direct callers of a changed or added symbol, found with `Grep` on that symbol's name, at most five such files.
  It says never to list or walk the tree with `Glob`, and that a file the diff does not touch is out of scope unless it calls a changed symbol.
- S3.2 `plugins/pro-security/skills/security-architect/diff-review.md` says the same in its reading instructions and no longer says to read "enough callers, middleware, route registration and schema".
- S3.3 `plugins/pro-security/.codex-plugin/agents/security-architect.toml` carries the same diff-mode scope.
- S3.4 Both agent files still point whole-repo work at `security-audit`.

## Tests

- S4.1 `tests/security-hooks.mjs` drives `push-gate.py` and `security_surface.py` only.
  It has cases for: CSS-only push passes; Markdown-only push passes; push of an auth change denied; identical retry passes; other session denied; `git commit` with a staged auth change passes; `git commit -am` passes; `git push --dry-run` passes; `gh pr create` with an auth change denied and its retry passes; `gh pr create` on main with no divergence passes; push with no upstream and no `origin/main` passes; chain with environment assignment and `-C`; `git status` passes; `git log --grep=push` passes; malformed stdin passes; empty command passes.
- S4.2 `node tests/check.mjs` reports 0 failures and the `security-hooks` check runs cases (not skipped, not zero).
- S4.3 `node tests/eval.mjs --dry` passes.
- S4.4 `claude plugin validate . --strict` and `claude plugin validate plugins/pro-security --strict` pass.

## Versions and docs

- S5.1 `plugins/pro-security/.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` are at `0.2.0` and their descriptions mention the push gate and not commit, prompt or plan hooks.
- S5.2 `.claude-plugin/marketplace.json` has pro-security at `0.2.0` with the same description and `metadata.version` at `1.46.0`.
- S5.3 `README.md` describes pro-security's hook as a single push gate; the sentence about exiting plan mode being denied and the sentence about ideation nudges are gone; line 266's tree comment says "push gate" not "planning/commit hooks".
- S5.4 `docs/releases.md` has a pro-security `0.2.0` row dated 2026-10-25 and `metadata.version` 1.46.0.
- S5.5 `tests/README.md` describes `security-hooks.mjs` as driving the push gate.
