# Plan: quiet validation hook

Built from `spec.md` (commit e68fb3c) and `intent.md` in this folder.
Status: approved.
Approver: Jody Brewster; the hook runs at the end of every session on every site with pro-quality, so the engineer's sign-off is the approval and no other approver is needed.
Dated: 2026-10-28.

The default mode is `nudge`, approved with this plan on 2026-10-28.

## Files that change

- `tests/quality-hooks.mjs` (new): behavior cases for the Stop hook, modeled on `tests/sdlc-hooks.mjs`, driving the script against a throwaway git repo and transcript.
- `tests/check.mjs` (modified): a `quality-hooks` check that runs those cases, next to `sdlc-hooks`.
- `plugins/pro-quality/scripts/user-validation.py` (modified): repo-only path filter, the `PRO_DEV_VALIDATION` modes, the nudge output, the once-per-change-set rule and the summary scoped to the session's files.
- `plugins/pro-quality/skills/user-validation/SKILL.md` (modified): the description and "When this runs" say the hook suggests `/validate` and name the three modes.
- `plugins/pro-quality/commands/validate.md` (modified): one line saying this is the on-demand path the hook points at.
- `README.md` (modified): the pro-quality section and the Verify row describe the nudge and the setting instead of "blocks the stop once".
- `docs/hook-loading.md` (modified): the "Blocking on Stop" reference names `user-validation.py` in `block` mode.
- `plugins/pro-quality/.claude-plugin/plugin.json`, `plugins/pro-quality/.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (modified): pro-quality 0.9.5 to 0.10.0 and `metadata.version` 1.46.0 to 1.47.0, per the version-bump law; the exact numbers are set at rebase time (see Risks).

## Order of work

1. Branch `quiet-validation-hook` from `origin/main` and bring this intent folder across from `pro-dev-intents`, so the build does not wait on the intents PR.
2. Write `tests/quality-hooks.mjs` and wire it into `tests/check.mjs`; run `node tests/quality-hooks.mjs` and see the new cases fail against today's script (R1, R3 to R6, R8, R9 fail; R7, R10 pass).
3. Change `user-validation.py`:
   - replace `work_happened` with `changed_paths(lines, root)`, which returns the repo-relative paths of Write, Edit, MultiEdit and NotebookEdit targets inside `root` and outside `.pro-dev/`, plus a `git commit` flag; resolve each path with `os.path.realpath` against the payload `cwd` so `/tmp` and `/private/tmp` style aliases match (R1, R2);
   - read `PRO_DEV_VALIDATION` in `main`: `off` returns before any output, `block` keeps today's path, anything else is `nudge` (R6, R7, R9);
   - in `nudge`, print `{"systemMessage": "pro-quality: this session changed N files in <repo name>. Run /validate for a checklist."}` and store a hash of the sorted path set in the existing state file; print nothing when the hash matches the last one (R4, R5);
   - pass the paths to `change_summary` so `git status` and `git diff --stat` run with `-- <paths>` (R8);
   - keep `stop_hook_active`, the progress-first state write and the top-level JSON guard as they are (R10).
   Run `node tests/quality-hooks.mjs` until every case passes.
4. Update the skill, `/validate`, the README and `docs/hook-loading.md` text (R11).
5. Bump the versions.
6. Run the proof-of-done commands, then the live check in AC3.

Steps 2 and 4 touch separate files and could run in parallel, but the whole change is small enough for one worktree.

## Tests that prove it

- `tests/quality-hooks.mjs` covers:
  - conversation-only transcript: no output;
  - Write outside the repo only: no output (R1);
  - Write inside `.pro-dev/` only: no output (R1);
  - Edit inside the repo: a `systemMessage`, no `decision` (R4);
  - a second stop with no new writes: no output (R5);
  - a second stop after a new repo write: a fresh `systemMessage` (R5);
  - a Bash `git commit` with no file writes: a `systemMessage` (R2);
  - `PRO_DEV_VALIDATION=off` with a repo write: no output (R6);
  - `PRO_DEV_VALIDATION=block` with a repo write: `decision: block` whose reason lists the written file and not a pre-existing dirty file (R7, R8);
  - `block` with `stop_hook_active: true`: no output (R7);
  - `PRO_DEV_VALIDATION=bogus`: behaves as nudge (R9);
  - garbage stdin and an empty object: exit 0, no output (R10).
- The live check in AC3 confirms the one-line message actually shows in a Claude Code session, which no test here can see.

## Risks

Step 3's path filter is the step most likely to go wrong.
If it is too strict the hook goes silent after real work; if too loose the false alarms come back.
Relative paths, symlinked temp dirs and a session `cwd` inside a subdirectory of the repo are the cases to test; the realpath-against-root comparison covers them.
A crash here would print a Python traceback at every stop on every site, so the script keeps its catch-all guard and the garbage-payload case.
The branch `fix/doc-hooks-review` (open now) also bumps pro-quality and the marketplace and edits `tests/check.mjs`.
Whichever lands second rebases and takes the next version numbers; the `check.mjs` hunks are in different checks and should merge cleanly.
Sites lose the forced handoff on update; the release note names `PRO_DEV_VALIDATION=block` (spec flagged concern 3, still Jody's call).
Nothing is irreversible: the old behavior is one setting away.

## Options not taken

- Keep blocking and only fix the path filter: still forces a full handoff after every small edit, which is what Jody asked to stop.
- Report every dirty file, not only the session's: that is what made the handoffs list unrelated work.
- Keep counting Codex's `apply_patch`: pro-quality's Codex manifest loads skills only, so this hook never runs under Codex; dropping it removes dead code.
- A per-repo mode file under `.pro-dev/`: that folder is self-ignoring, so the setting could not be shared; the settings `env` block works per repo or per user.

## Proof of done

```bash
node tests/quality-hooks.mjs                       # every case ok
node tests/check.mjs && node tests/eval.mjs --dry   # 0 failures, quality-hooks among the checks
claude plugin validate . --strict                  # ✔ Validation passed
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

Then AC3 by hand: update pro-quality in a session, write a file outside the repo and end the turn (no hook output), then edit a repo file and end the turn (one line suggesting `/validate`, no forced handoff).

## Done

Filled in when the build is finished, before sign-off.

- Build commit: <sha>
- Checks run: <each command with its real result>
- AC1: <pass or fail, with what was observed>
- AC2: <pass or fail>
- AC3: <pass or fail>
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.

## Departures from plan

- The nudge says "1 file" for one file and "N files" otherwise, and a commit-only session says it committed changes.
- The nudge's file count and the `block` summary use the session's accumulated paths from the state file, so a later stop reports the whole session and an edit to an already-reported file stays silent.
- In `block` mode with no session paths (a bare `git commit`) the summary reports only unpushed commits, or says no file changes were recorded, instead of falling back to the whole working tree (spec R8).
- Paths git ignores (`git check-ignore`) are dropped from the counted set; on any git failure the paths are kept.
