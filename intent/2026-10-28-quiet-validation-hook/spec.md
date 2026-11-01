---
intent: intent/2026-10-28-quiet-validation-hook/intent.md
intent-status: accepted
status: accepted
created: 2026-10-28T06:50:00-0400
author: the maintainer
---

# Spec: quiet validation hook

Built from `intent.md` in this folder.
Status: accepted.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `docs/hook-loading.md`, `docs/codex-parity.md`, ADRs 0002 to 0005 in `docs/decisions/`, the `user-validation` skill and `/validate` command in pro-quality and `tests/sdlc-hooks.mjs` as the pattern for hook tests.

## Summary

pro-quality's Stop hook (`plugins/pro-quality/scripts/user-validation.py`) stops forcing a validation handoff.
It counts only files the session wrote inside the repo, and by default it ends the turn with one line suggesting `/validate`.
A `PRO_DEV_VALIDATION` setting turns it off or restores the old blocking handoff.
Everyone with pro-quality installed gets this on their next plugin update.

## Requirements

### Functional

- R1. A Write, Edit, MultiEdit or NotebookEdit counts as work only when its `file_path` (or `notebook_path`) resolves inside the git root of the session's `cwd` and outside `.pro-dev/`.
- R2. A Bash `git commit` run in the session still counts as work, as today.
- R3. When no counted work happened since the hook last spoke, the hook prints nothing and exits 0.
- R4. In the default mode, `nudge`, the hook prints `{"systemMessage": "..."}` and never a `decision`; the message names how many repo files the session changed and says to run `/validate` for a checklist.
- R5. In `nudge` mode the hook speaks at most once per distinct set of changed files per session; a later stop with no new repo writes is silent.
- R6. `PRO_DEV_VALIDATION=off` makes the hook print nothing for any payload.
- R7. `PRO_DEV_VALIDATION=block` restores today's behavior: one `{"decision": "block"}` with the handoff instructions, guarded by `stop_hook_active`.
- R8. In `block` mode the "What changed" summary lists only the repo files the session wrote and any commits it made, not unrelated uncommitted work.
- R9. An unknown `PRO_DEV_VALIDATION` value behaves as `nudge`.
- R10. A malformed, empty or non-JSON payload exits 0 with no output.
- R11. The `user-validation` skill description, the `/validate` command and the pro-quality section of `README.md` describe the hook as a suggestion with the three modes, not as an automatic block.

### Non-functional

- N1. The hook makes no network calls and writes only its existing state under `~/.claude/pro-dev/user-validation/` and `.pro-dev/` (in `block` mode).
- N2. The hook finishes within its existing 10 second subprocess limits on a repo with a large transcript.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-quality goes from 0.9.5 to 0.10.0 in both manifests and its marketplace entry, and `metadata.version` bumps once.
- Hook-loading law (ADR-0003): the hook stays in `plugins/pro-quality/hooks/hooks.json` with the same script path; no new hook file.
- Codex parity (ADR-0004): pro-quality's Codex manifest loads skills only, so the hook change has no Codex counterpart; the skill prose edit stays harness-neutral.
- `REVIEW.md` pass 1: a blocking hook needs a behavior case that blocks and one that allows; `block` mode keeps both, and the nudge path gets its own cases.
- `REVIEW.md` pass 2 and `docs/hook-loading.md`: `stop_hook_active` and per-session progress stay, and a bad payload never wedges the turn.

## Design

### User experience

Default: after a turn that edited repo files, the person sees one line such as "pro-quality: this session changed 3 files in pro-dev-skillset. Run /validate for a checklist."
The model is not told to do anything, so the turn ends normally.
Nothing appears after turns that only talk, read or write outside the repo.
`/validate` works as today.
To silence it, set `"PRO_DEV_VALIDATION": "off"` in the `env` block of `.claude/settings.json` (one repo) or `~/.claude/settings.json` (everywhere); `"block"` brings back the forced handoff.

### System

`user-validation.py` changes in three places and keeps its shape:

- `work_happened` becomes `changed_paths`, which returns the set of repo-relative paths from counted tool uses plus a flag for `git commit`, using the git root to filter.
- `main` reads `PRO_DEV_VALIDATION`, returns early on `off`, and stores the last reported path set in the existing per-session state file to decide R5.
- `change_summary` takes the changed paths and limits `git status` and `git diff --stat` to them (`-- <paths>`), with the unpushed-commits line unchanged.

A new `tests/quality-hooks.mjs` drives the script the way `tests/sdlc-hooks.mjs` does, against a throwaway git repo and transcript, and `tests/check.mjs` gains a `quality-hooks` check that runs it.

### Alternatives considered

- Keep blocking and only fix the path filter: still forces a full handoff on every small edit, which is the part the maintainer calls too much.
- Remove the hook and rely on `/validate`: loses the reminder after real work, and there would be no way back without a release.
- A mode file such as `.pro-dev/validation/mode`: `.pro-dev/` is self-ignoring, so the setting could not be shared through the repo; the settings `env` block is the documented place for this and works per repo or per user.

## Flagged concerns

ADR needed: no, the change is local to one hook, behind a setting and cheap to reverse.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The README promises the hook "blocks the stop once"; the default now only suggests. | `README.md` | resolved: the intent asks for this, and R11 updates the README and skill text. |
| 2 | `systemMessage` on a Stop hook is shown to the person, but no test here can see the UI. | `docs/hook-loading.md` | open: the tests check the JSON; the plan needs one live check in a real session. |
| 3 | Sites that relied on the forced handoff lose it silently on update. | The maintainer | open: the release note names `PRO_DEV_VALIDATION=block`; the maintainer decides whether that is enough. |

## Open questions

- Should the default be the one-line nudge or fully off? Answered: nudge, the recommended default in the plan the maintainer approved on 2026-10-28.

## Acceptance criteria

- AC1. `node tests/quality-hooks.mjs` passes cases for R1 to R10, including a write outside the repo (silent), a write inside (nudge), a second stop with no new writes (silent), `off`, `block` with `stop_hook_active` false (blocks) and true (passes) and a garbage payload (exit 0, no output).
- AC2. `node tests/check.mjs && node tests/eval.mjs --dry` and both `claude plugin validate` steps in `CLAUDE.md` pass.
- AC3. In a real session with the updated plugin, a turn that writes only a file outside the repo ends with no hook output, and a turn that edits a repo file ends with the one-line suggestion and no forced handoff.

## Out of scope

pro-ai-sdlc's `plan-sync.py` Stop hook, the content of the handoff and the `.pro-dev/validation/latest.md` format.
