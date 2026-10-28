---
description: "Take spec-kit out of this repo: uninstall its Claude integration, remove .specify/ after listing what goes and set the spec-kit answer to no. Never touches specs/. Usage: /pro-speckit:remove"
allowed-tools:
  - "Bash(uv tool dir:*)"
  - "Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev-owner.py answer*)"
  - "Bash(python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev-owner.py\" answer*)"
---

## Context

- Repo state: !`git status --short 2>&1 | head -40; true`
- specify on PATH: !`command -v specify 2>&1; true`

This command takes spec-kit out of the current repo.
It never touches `specs/`, which holds the person's specs and plans.
Every command below other than `uv tool dir` and the `answer` call prompts the person.
Never commit, stage, push or open a PR.
Never run `uv tool uninstall`; the CLI is machine-wide and other repos may use it.

## Steps

1. Find the CLI.
   Run `uv tool dir --bin` and take `<that folder>/specify` as the only `specify` this command runs, by absolute path.
   If `uv` is missing or that file does not exist, say so and stop.
   If the `specify on PATH` line above shows a different path, refuse and show both paths, because another `specify` first on `PATH` could be anything.
2. Check `.specify` before anything is removed.
   Refuse and stop when `.specify` is a symlink or is not a folder.
   If it does not exist, skip to step 5.
3. Run `<bin>/specify integration uninstall claude` by that absolute path.
   It removes the `speckit-*` skills that are unedited and keeps edited ones, naming each.
   If it names edited files, list them and tell the person they are left behind.
   Ask whether to run it again with `--force` to remove them as well and do it only after a yes.
   Give `--force` on that first run when the person already said yes to losing edits; a second run without it errors "not installed".
4. Remove `.specify`.
   List the tracked files with `git ls-files -- .specify` and the untracked ones with `git ls-files --others -- .specify`.
   Show both lists and ask for a yes.
   After the yes run `git rm -r -- .specify` for the tracked files.
   Remove the untracked ones only after they were listed and the person said yes.
5. Show `git status` so the person sees everything that changed.
6. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pro-dev-owner.py" answer spec-kit no`.
   Say the committed `.claude/pro-dev.json` changed and should be committed with the removal, so `/pro-dev install` does not ask for spec-kit again.
7. Say what stays: `specs/` and, machine-wide, the `specify` CLI.
   To drop the CLI the person runs `uv tool uninstall specify-cli` once no repo needs it.
