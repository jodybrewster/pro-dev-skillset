---
description: Write the repo's CONSTRAINTS.md from the checks it already runs, with at most four questions. Never commits.
argument-hint: '[refresh]'
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(git status:*), Bash(git rev-parse:*), Bash(git ls-files:*), Bash(git log:*), Bash(ls:*), Bash(test:*), Bash(readlink:*), Bash(npm run:*), Bash(npm test:*), Bash(npx:*), Bash(pnpm:*), Bash(yarn:*), Bash(make:*), Bash(node:*), Bash(python3:*), Bash(pytest:*), Bash(ruff:*), Bash(mypy:*), Bash(cargo:*), Bash(go:*)
---

Use the `constraints` skill. Write `CONSTRAINTS.md` at the repo root from the template in the pro-quality plugin (`templates/CONSTRAINTS.md`). If `$ARGUMENTS` is `refresh`, read the existing file first and update Today values and rows instead of starting over.

1. Detect the stack and its checks. Read the package scripts, `pyproject.toml`, `Makefile`, `.github/workflows/` and the verify command in `CLAUDE.md` or `AGENTS.md`. Say in one sentence what you found, for example "Vitest, ESLint, tsc and GitHub Actions".

2. Ask at most four questions one at a time, each with a default. Pick the four that matter most for what you found. Typical ones: which dimensions to enforce (default: types, lint and tests), the coverage floor (default: today's value rounded down), where checks run (default: CI) and extra globs for test files (default: none). Skip a question the repo already answers. When the repo has no type checker or linter, offer the verify commands it already documents (in `CLAUDE.md`, `AGENTS.md` or CI) as the dimensions instead. Wait for each answer before the next.

3. Run each check you will write down once. Record today's value for every ratchet. A check that fails, times out or is not installed does not get a numbered row: put the metric under "Measured, not yet enforced" with its value if you have one; otherwise leave it out. Never write a numbered row for a command that did not exit 0 in this run. Do not install tools.

4. Fill the template. Keep the section names and column headers as they are. Give every numbered rule a direction word (minimum, at least, maximum or at most). A command that passes with warnings backs a rule about failures, not warnings; record the warning count under Measured with today's value as its limit, never a target nobody set. Keep the Floor section whole. Leave Exceptions with its header row only unless the user named one. Drop the template's example row and an empty `Test files:` line.

5. Show the full file and this line before saving anything: "Read CONSTRAINTS.md before writing code. Do not weaken it to make a change pass." Wait for a yes or edits.

6. On a yes, write `CONSTRAINTS.md`. Add the line above to `CLAUDE.md` and `AGENTS.md` when they exist and do not already carry it. Check with `test -L AGENTS.md` and `readlink AGENTS.md` first: when `AGENTS.md` is a symlink to `CLAUDE.md` (or the reverse), add the line once.

7. Do not commit, stage or push. Report the files written and the rows that went to Measured. Use paths relative to the repo root, never a home-directory path.
