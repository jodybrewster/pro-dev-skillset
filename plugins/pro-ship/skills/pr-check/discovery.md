# Command discovery

`pr-check.py discover` and this page follow the same rules.
The first source that names a step wins for that step.

1. A verify block.
   The first fenced `bash` block under a heading that starts with "Verif" in `CLAUDE.md` or `AGENTS.md`.
   When found it is the whole check list: each command line is a step named `verify:<n>` counting from 1.
   Every other source below is skipped.
2. `package.json` scripts named `build`, `lint`, `typecheck` and `test`, run through the package manager the lockfile names (`pnpm-lock.yaml`, `bun.lock`, `yarn.lock`, else npm).
   With a `tsconfig.json` and no `typecheck` script the step is `tsc --noEmit` through the package manager's exec.
3. Python: `ruff check` when ruff is configured, `mypy .` when mypy is configured and `pytest` when `tests/` or a pytest config exists.
4. A `Makefile` target named `check`, `lint` or `test`.
5. Nothing found: the step is `not-found`.

A step that is `not-found` is reported and does not fail the run.

The mutation check uses the `test` step.
With no `test` step it uses the first verify command whose text contains `test`.
With neither it records `could-not-run`.

Each command gets 300 seconds.
A line `pr-check timeout: <seconds>` in `CLAUDE.md` or `AGENTS.md` raises it.
No command is given a flag that skips checks or hooks.
