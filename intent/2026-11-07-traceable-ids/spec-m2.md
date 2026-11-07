---
id: PDS-50
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T13:56:55-0500
author: the maintainer
module: m2
---

# Spec m2: the id in git

Built from `intent.md` in this folder (commit 1242860), module m2 of [capability-map.md](./capability-map.md).
Status: draft.
Depends on m1: the `id:` line and `ids.py` must be on the default branch first.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0016, ADR-0024, ADR-0025, `docs/enforce-mode.md`, `docs/hook-loading.md`, `plugins/pro-ai-sdlc/README.md`, `pro-security:security-architect` (diff mode, read for pass 2).

## Summary

Once an intent has an id, every branch, commit subject and pull request title of that change starts with it.
`/spec`, `/plan`, `/execute`, `/auto`, `/intent`, `/incident` and `/pr-babysit` name branches `<id>/<stage>` and write subjects `<id>: <today's subject>`.
`ship.py` reads a Conventional Commit word behind the id and a release is still versioned from `PDS-51: feat: ...`.
A new PreToolUse hook on `git commit` warns when a commit on a branch named for an id lacks that id, in warn mode under `mode.change-id`.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. Stage branches are `<id>/spec`, `<id>/plan`, `<id>/brief`, `<id>/build` and `<id>/build-<module>`.
   A spec and plan written together, as in this repo, share `<id>/spec`.
2. Commit subjects start `<id>: ` and pull request titles start the same way.
3. The hook is a PreToolUse Bash hook in pro-ai-sdlc's one `hooks/hooks.json`, mode key `mode.change-id` and warn by default; it fires only on a branch whose name starts with an id.
4. A squash merge on the default branch carries the id because the pull request title does; the hook never looks at the default branch.
5. A repo or an intent with no id keeps today's branch names and subjects.

## Requirements

### Functional

- R1. With an intent that has `id:`, `/spec` run on the default branch creates `<id>/spec` with `git switch -c` before its commit; on any other branch it commits there and says so in one line when the branch does not start with `<id>/` (intent: "the branch for each stage, `PDS-50/spec`, `PDS-50/plan`, `PDS-50/build-m1`").
- R2. `/plan` commits on the current branch when it starts with `<id>/` and creates `<id>/plan` when run on the default branch.
- R3. `/intent`, `/incident`, `/spec` and `/plan` write subjects `<id>: intent: <slug>`, `<id>: incident: <slug>`, `<id>: spec: <slug>` and `<id>: plan: <slug>` when the intent has an id and today's subjects otherwise (intent: "the first words of every commit subject, `PDS-50: ...`").
- R4. `execute-gate.py` reads `id:` from the intent's frontmatter, adds `change_id` to its JSON output and sets `branch` to `<id>/build` for `plan.md` and `<id>/build-<module>` for `plan-<module>.md`; with no id it prints the slug as today; the local and `origin` existence checks apply to the new name.
- R5. `/execute` starts every commit subject with `<id>: ` and opens the pull request titled `<id>: feat: <title>` or `<id>: fix: <title>` by the intent's `kind`, keeping the word `ship.py version` reads (intent: "plus every pull request title").
- R6. `/auto brief` creates `<id>/brief` and `/auto build` works on `<id>/build`, with `<id>: ` on each subject and title; with no id the names stay `<slug>-brief` and `<slug>`.
- R7. `factory.py`'s `binding_reasons` expects the head branch `<id>/brief` or `<id>/build` when the intent has an id and today's names otherwise; the host then never raises a run to level 3 over the new branch names.
- R8. `/pr-babysit` starts each fix commit subject with `<id>: ` when the branch starts with an id.
- R9. `ship.py`'s `commit_kind` removes one leading `^[A-Z]{2,6}-[1-9][0-9]*: ` before it reads the Conventional Commit word: `PDS-51: feat: add x` is a feature, `PDS-51: fix(y)!: z` is breaking and `PDS-51: tidy` is unknown, as `tidy` is today.
- R10. `plugins/pro-ai-sdlc/hooks/hooks.json` gains a PreToolUse entry on `Bash` that runs `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/change-id.py"` with a 5 second timeout (intent: "A hook warns when a commit on a change branch lacks the id").
- R11. `change-id.py` acts only on a command segment that runs `git commit`, after the same wrapper stripping `production-gate.py` does; it acts only when `git branch --show-current` in the payload's `cwd` (or in the directory a `-C` names) matches `^([A-Z]{2,6}-[1-9][0-9]*)/`; otherwise it exits 0 with no output.
- R12. It reads the subject from the first `-m` or `--message` value or from the first non-empty line of a heredoc that value opens (`-m "$(cat <<'EOF'` and the unquoted form); when the message comes from an editor, `-F`, `-C`, `--no-edit` or `--amend` without `-m`, it exits 0 with no output.
- R13. When the subject does not start with `<branch id>: `, warn mode (the default) logs to `warn.log` under the gate name `change-id`, tells the session and allows; enforce mode returns `deny` with the reason `commit subject must start with "<id>: " on branch <branch>`.
  The hook reads only its own key, as `stale-done` does: it stays in warn unless the file `mode.change-id` exists and holds `enforce`; neither a global `mode` file of enforce, `CLAUDE_GUARD_MODE` nor the `mode` file the factory container writes in `session.sh` can enforce it before its warn period.
- R14. A payload that is empty, not JSON or has no command exits 0 and logs `could not parse`; the script runs no network call and only `git branch --show-current`.
- R15. `docs/enforce-mode.md` gains a row for `change-id` with its mode file, its open blocker (its own warn-mode week in two repos) and its accepted limits (R12's unread messages pass) (intent: "The hook starts in warn mode and gets its row in `docs/enforce-mode.md`").
- R16. `plugins/pro-ai-sdlc/README.md` lists the hook under `## Hooks`.

### Non-functional

- N1. The hook returns in under one second on a repo of this size; it makes one `git` call.
- N2. Each plugin change bumps its version in both manifests and the marketplace entry, plus `metadata.version`, in the same commit.
- N3. Python 3.9 stdlib only.

### Policy constraints applied

- Hook-loading law (ADR-0003): the entry goes in the one `hooks/hooks.json` and `change-id.py` is tracked (R10).
- Gate enforce rule (ADR-0016): warn by default with its own row (R13, R15).
- REVIEW.md pass 1: a case that shows the hook denying and one that shows it allowing (AC3).
- REVIEW.md pass 2: no network, no write outside the guard folder, no text from the payload executed (R14).
- Codex parity (ADR-0004): Codex runs no Claude hook; the commands' prose carries the subject rule under both harnesses.
- ADR-0025: `ship.py version` still reads the kind word (R9).

### Boundaries

Always: prefix subjects and titles with the id, add hook cases, bump versions.
Ask first: moving `change-id` to enforce, adding the id rule to the default branch.
Never: block in warn mode, run a network call from the hook, rewrite a commit message.

## Design

### User experience

A person on `PDS-51/build` who commits without the id sees one warn line naming the expected prefix; nothing is blocked.
Branch lists, `git log --oneline` and the pull request list group by id at a glance.

### System

- `plugins/pro-ai-sdlc/commands/spec.md`, `plan.md`, `intent.md`, `incident.md`, `execute.md`, `auto.md`, `pr-babysit.md`: branch and subject rules; `Bash(git switch:*)` added to `allowed-tools` of `/spec` and `/plan`.
- `plugins/pro-ai-sdlc/scripts/execute-gate.py`: the id and the new branch name.
- `plugins/pro-ai-sdlc/scripts/factory.py`: `binding_reasons`.
- `plugins/pro-ai-sdlc/scripts/change-id.py` (new) and `hooks/hooks.json`.
- `plugins/pro-ship/scripts/ship.py`: `commit_kind`.
- `docs/enforce-mode.md`, `plugins/pro-ai-sdlc/README.md`, `docs/factory.md` (branch names).
- Tests: `tests/sdlc-hooks.mjs` (R11 to R14), `tests/execute.mjs` (R4), `tests/factory.mjs` (R7), `tests/ship-version.mjs` (R9).

### Alternatives considered

- `feat(PDS-51): ...` as the subject: the id would sit inside the Conventional Commit scope, which other tools read as a component name; the intent asks for the id as the first words.
- A `commit-msg` git hook installed into each repo: it would need an install step per clone and would not run under Claude Code's permission model; a plugin hook needs nothing.
- A hook that also checks the default branch: squash merges carry the PR title and the check belongs on the PR title, which `/execute` writes.

## Flagged concerns

ADR needed: no, this module applies ADR-0026 to branches and subjects.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | A new gate needs its warn start, its own mode file and a row in `docs/enforce-mode.md` | ADR-0016 | resolved on 2026-11-07: R13 and R15 start it in warn under `mode.change-id` with its own row and evidence week |
| 2 | `ship.py` reads the Conventional Commit word at the start of a subject and `PDS-51: feat: x` would read unknown and be assumed breaking | ADR-0025 | resolved on 2026-11-07: R9 strips one leading id first; the pro-ship PR merges before the pro-ai-sdlc PR so no id-prefixed subject reaches a release unread |
| 3 | The factory host raises a run to level 3 when the PR head branch is not `<slug>-brief` or `<slug>` | ADR-0024 | resolved on 2026-11-07: R7 changes `binding_reasons` in the same PR as `/auto` (R6), with a case for each name |
| 4 | The module edits pro-ai-sdlc and pro-ship | version-bump law, ADR-0002 | resolved on 2026-11-07: two PRs, each with its bump and `metadata.version`, pro-ship first |
| 5 | The new hook must load from the plugin's one hooks file and its script must be tracked | hook-loading law, ADR-0003 | resolved on 2026-11-07: R10 adds the entry to `hooks/hooks.json` beside `production-gate` and `check.mjs` already checks the script exists |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. `commit_kind("PDS-51: feat: add x", "")` returns feature, `commit_kind("PDS-51: fix(y)!: z", "")` returns breaking and `commit_kind("PDS-51: tidy", "")` returns unknown in `tests/ship-version.mjs`.
- AC2. `execute-gate.py` on a fixture `plan-m1.md` whose intent holds `id: TST-4` prints `"branch": "TST-4/build-m1"` and `"change_id": "TST-4"`; on an intent with no id it prints the slug.
- AC3. In `tests/sdlc-hooks.mjs`, on branch `TST-4/build`: `git commit -m "no id"` in warn mode logs `change-id` to `warn.log` and allows; the same in enforce mode denies with the reason; `git commit -m "TST-4: ok"` allows silently; a heredoc message starting `TST-4: ` allows; `git commit` with no `-m` allows; on branch `main` and on `feature/x` nothing is logged; a payload of `{` exits 0; with a global `mode` file of enforce, with `CLAUDE_GUARD_MODE=enforce` and with no `mode.change-id`, `git commit -m "no id"` on `TST-4/build` still only warns.
- AC4. `factory.py` binding cases accept `TST-4/brief` for an intent with that id and still accept `<slug>-brief` for one without.
- AC5. `docs/enforce-mode.md` has a `change-id` row naming `change-id.py` and `mode.change-id`.
- AC6. `node tests/check.mjs` and `claude plugin validate . --strict` pass after each PR.

## Out of scope

- Enforce mode for `change-id` before its evidence week.
- Rewriting the subjects of commits already made.
- Record fields (m3) and docs (m4).
