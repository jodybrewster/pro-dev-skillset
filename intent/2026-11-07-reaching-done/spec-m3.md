---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T14:00:00-0500
author: the maintainer
module: m3
---

# Spec m3: a head-bound confirmation and a readiness check in the `/ship` preflight

Built from `intent.md` in this folder, committed with it, module m3 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md` (`AGENTS.md` is a link to it), `REVIEW.md`, ADR-0002, ADR-0003, ADR-0014, ADR-0015, ADR-0016, ADR-0022, ADR-0023, `docs/ship-preflight.md`, `docs/loop-records.md`, `docs/enforce-mode.md`, `plugins/pro-ship/scripts/ship.py`, `plugins/pro-ship/scripts/merge-gate.py`, `plugins/pro-ship/scripts/ship-gate.py`, `plugins/pro-ship/skills/ship/SKILL.md`, `rollbacks.md` and `release-checks.md` beside it, `plugins/pro-ship/skills/deployed/SKILL.md`.
Sources adapted, read as data: super-board's `scripts/super-board-approval.py`, `scripts/super-board-verification-ready.py` and `scripts/super-board-merge-gate.sh` (MIT).

## Summary

Two changes let a release reach Done.
A check left at `confirm`, in the preflight record or in a deploy record, can now be cleared by a person.
`ship.py` posts a request bound to the repo, the head sha and a scope: on the PR when one exists for that head, on the commit when the scope is a tag.
Only a later reply of `confirmed` from a user with write access clears the checks it lists and a label never does.
The merge gate reads a PR-scope reply again before merging.
A readiness step at the start of `/ship` rejects any rollback or verify step that is not a runnable command and stops before any reviewer runs, leaving every earlier record as it was.
Everyone who runs `/pro-ship:ship` or `/pro-ship:deployed` gets both on the next pro-ship update.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. The confirmation record lives in the ship preflight record; `ship.py deployed` reads the reply again itself.
2. The merge gate reads the confirmation through `gh pr view` comments, the network exception it already has.
3. A runnable command is a fenced shell line or an argv list, not prose.
4. `ship.py` already checks a login's permission through `collaborators/<login>/permission` (`can_push`) and refuses headless writes through `refuse_headless`.
5. `gh pr view --json comments` gives each comment's `id`, `author.login`, `authorAssociation`, `body`, `createdAt`, `includesCreatedEdit` and `url`; `gh api repos/{owner}/{repo}/commits/{sha}/comments` gives `id`, `user.login`, `body`, `created_at`, `updated_at` and `html_url`.
6. Deploy-record check names come from `LIBRARY_CHECKS` and `SERVICE_CHECKS` in `ship.py`, such as `rollback dry run` and `tests on a clean checkout of the tag`.
7. This repo's Ship block is in `CLAUDE.md` and holds two prose rollback steps today; `AGENTS.md` is a symbolic link to `CLAUDE.md` and has no block of its own.

## Requirements

### Functional

The confirmation (intent: item 37):

- R1. `ship.py confirm request --head <sha> --items <json list of check names> [--pr <n>]` binds a request to the repo, the head sha and a scope.
  The scope is `pr` when `--pr` is given or `gh pr list --search <sha> --state all` finds a PR whose head is that sha; it is `tag` otherwise.
- R2. The request is one line `pro-ship-confirm-request: {"head":"<40 hex>","items":[...],"pr":<n or null>,"repo":"<owner>/<name>","scope":"pr"|"tag"}` with sorted keys, then a plain sentence asking a person with write access to check each item and reply with the single word `confirmed`.
- R3. In `pr` scope it posts a PR comment through `gh pr comment <n> --body-file -`; in `tag` scope it posts a commit comment through `gh api repos/{owner}/{repo}/commits/{sha}/comments -F body=@-`; it prints the comment URL.
- R4. `confirm request` refuses a headless run, an empty item list and an item that is neither a `confirm` check of a preflight record for that head nor a name in `LIBRARY_CHECKS` or `SERVICE_CHECKS`.
- R5. `ship.py confirm read --head <sha> [--pr <n>]` reads the PR comments with `gh pr view <n> --json number,headRefOid,url,comments` in `pr` scope, or the commit comments with `gh api` in `tag` scope.
  It finds the newest request from a login with write, maintain or admin permission and checks it is bound to this repo, this head and this scope.
- R6. It accepts the earliest later comment whose whole body is `confirmed` (any case, an optional full stop), that is unedited, created after the request and written by a login with write, maintain or admin permission.
- R7. A label, a reaction, an edited reply, a reply before the request, a reply on a request for another head or scope and a reply from a login without write access never count; `confirm read` then prints `{"confirmed": false, "why": <reason>}` and writes nothing.
- R8. On a valid reply, when `.pro-dev/ship/preflight.json` is a record for that head, `confirm read` rewrites it (and its mieruka copy by the drop rule) with `confirmation` inside `detail_json`: `{repo, scope, pr, head, items, request_id, request_url, reply_id, reply_url, by, at}`.
- R9. In the same write each listed preflight check moves from `confirm` to `pass` with evidence `confirmed by <login> in <reply url>`; `status`, `head`, `schema` and every other field stay as they were.
- R10. `ship.py deployed` takes `--confirm-pr <n>` or `--confirm-commit <sha>` and reads the reply itself with the R5 to R7 rule.
  A check given as `confirm` whose item name the confirmation lists becomes `pass` when the confirmation's head is the deployed commit or, in `pr` scope, that PR's merge commit is the deployed commit.
- R11. With every check `pass` or cleared, the deploy record's status is `pass`.
- R12. The merge gate, at medium and high tier when the fresh preflight for the PR head lists a `confirm` check or a `pr`-scope confirmation, reads the PR comments with `gh pr view` inside its existing deadline.
- R13. It adds one line: `confirmation: <login> for <head8>` when the recorded reply still exists unedited, by the same login, bound to the current head; otherwise `confirmation: missing (<cause>)`.
- R14. The confirmation check has its own mode key `mode.confirmation`, read only from that file; in warn it adds the line and changes no decision, in enforce a missing confirmation denies once per head per session with the command `ship.py confirm request --head <sha> --pr <n> --items ...`.
- R15. The ship skill offers `confirm request` after the verdict when any check is `confirm`; the deployed skill offers it for a deploy check left at `confirm`; both ask before posting and never post a reply themselves.

The readiness check (intent: item 38):

- R16. A step is runnable in three forms: a list of non-empty strings (an argv list), a string whose whole text is one inline code span holding one line or a fenced block marked `sh`, `bash` or `shell` holding one or more non-empty lines.
- R17. A string that starts with `manual:` is a declared person step and is accepted as long as the target also has at least one runnable rollback step.
- R18. Ship block targets gain an optional `verify` list of post-deploy commands, held to R16 and R17.
- R19. Any other step is prose and is rejected.
- R20. `ship.py ready` reads every target and checks its rollback steps and its `verify` list; on a rejected step it prints `{"ready": false, "problems": [{target, field, index, text}]}` with each text cut to 80 characters and exits 9.
- R21. `ready` writes nothing and deletes nothing: an existing `preflight.json`, `report.json`, `preflight.md`, deploy record or mieruka copy stays byte for byte.
- R22. The ship skill runs `ship.py ready` right after "Targets and scope" and stops on exit 9 with the problems listed and the line `ship stopped before review: fix the steps above, nothing was written`.
- R23. `ship.py record` refuses a GO whose report target holds a prose rollback step or a step that still holds a `<placeholder>`; `ready` accepts a placeholder in a fenced command because the report fills it.
- R24. `rollbacks.md` writes every step as a fenced command or a `manual:` step.
- R25. This repo's Ship block in `CLAUDE.md` replaces its two prose rollback steps with steps that do what the prose did: revert the release commits and push the revert, then name the tag consumers already pin and create a new patch tag when a moved pointer is needed, never re-creating an existing tag.

### Non-functional

- N1. The merge gate makes no GitHub write and no call beyond one `gh pr view`; it stays inside its 20 second deadline and logs could-not-run when the read fails.
- N2. `ready` reads files only and finishes in under a second on this repo.
- N3. `schema` stays 1 in the preflight and deploy records; the new keys are optional for readers.
- N4. pro-ship bumps its version in both manifests and its marketplace entry, plus `metadata.version`, in the same commit.

### Policy constraints applied

- ADR-0016: the confirmation check starts in warn under its own `mode.confirmation` with a row in `docs/enforce-mode.md` (R14).
- ADR-0022: the preflight record changes only inside `detail_json`; the freshness rule and the status mapping are unchanged (R8, R9).
- ADR-0023: the deploy record keeps its fields; `--confirm-pr` and `--confirm-commit` only change how a `confirm` check is read (R10).
- ADR-0015: only a person approves; a confirmation never approves a merge, it clears a check.
- ADR-0003: the gate and `ship.py` each keep their own copy of the reply rule, held to one fixture set.
- REVIEW.md pass 2: every comment body is data; the request line is parsed as JSON and nothing from a comment is executed.

### Boundaries

Always: bind each request to repo, head and scope, re-read the reply before merging, keep every record intact when `ready` stops.
Ask first: posting a request comment, turning `mode.confirmation` to enforce.
Never: count a label, post a `confirmed` reply, run a rollback or verify step during readiness, re-create an existing release tag.

## Design

### User experience

`/ship` stops in its first minute when a rollback step is prose, naming the target and the step.
After a verdict with `confirm` checks, the person is asked once whether to post the request; the PR shows one comment listing the checks.
After a tag release, `/pro-ship:deployed` offers a request on the tagged commit for a check such as `rollback dry run`; a `confirmed` reply there lets the deploy record reach `pass`.
At merge time the gate's text ends with the confirmation line.

### System

- `plugins/pro-ship/scripts/ship.py`: `cmd_confirm` (`request`, `read`) with a shared `read_reply(scope, ...)`, `runnable(step)`, `cmd_ready`, `validate_report` and `cmd_deployed --confirm-pr` and `--confirm-commit`.
- `plugins/pro-ship/scripts/merge-gate.py`: `confirmation_line(dir, pr, head)` beside `preflight_line`, with its own mode lookup.
- `plugins/pro-ship/skills/ship/SKILL.md`, `rollbacks.md`, `plugins/pro-ship/skills/deployed/SKILL.md`.
- `CLAUDE.md`: the Ship block.
- `docs/ship-preflight.md`, `docs/loop-records.md`, `docs/enforce-mode.md`, `docs/licenses.md`.
- Tests: `tests/ship-preflight.mjs` (confirm and ready), `tests/ship-deploy.mjs` (`--confirm-pr`, `--confirm-commit`), `tests/ship-hooks.mjs` (the gate line), `tests/fixtures/ship-preflight/` with a fake `gh` that serves PR comments, commit comments and permissions.

### Alternatives considered

- Let the merge gate post the request, as super-board's gate does: a hook would write to GitHub on a `gh pr merge`; the skill posts instead after a yes.
- A label as the signal: anyone with triage access can set one and it carries no head.
- PR comments only: a tag release often has no open PR for its head, which leaves deploy checks with nowhere to be confirmed.
- Accept prose rollback steps with a warning: the retest showed they fail only when the rollback is needed.
- Run the rollback in readiness: `/ship` never runs a deploy or a rollback.

## Flagged concerns

ADR needed: no, the confirmation is an optional key inside the preflight record that ADR-0022 allows and readiness applies the existing rollback rule earlier.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent says the gate posts the request; a hook that writes to GitHub breaks the gates' read-only rule | ADR-0022, `merge-gate.py` | resolved on 2026-11-07: the ship and deployed skills post it through `ship.py confirm request` after a yes; the merge gate only reads |
| 2 | A session with the person's `gh` token could post `confirmed` itself | ADR-0014 | resolved on 2026-11-07: accepted for a local guardrail; the skills never post a reply, the row in `docs/enforce-mode.md` records it and a GitHub identity for the factory (out of scope) closes it |
| 3 | Rollback steps such as "notify the team" cannot be commands | `rollbacks.md` | resolved on 2026-11-07: a `manual:` step is accepted as long as each target has one runnable rollback step (R17) |
| 4 | Rollback commands need values only known at release time | `rollbacks.md` | resolved on 2026-11-07: `ready` accepts `<placeholder>` inside a fenced command and `record` refuses a GO that still holds one (R23) |
| 5 | A squash merge gives the deployed commit a different sha from the confirmed head | ADR-0023 | resolved on 2026-11-07: in `pr` scope `deployed` accepts the PR's merge commit as well as its head (R10) |
| 6 | The merge gate gains a second deny path | ADR-0016 | resolved on 2026-11-07: it starts in warn under its own `mode.confirmation`, which no global enforce switch reaches |
| 7 | Deploy checks are confirmed after a tag release, often with no PR for the tagged head | ADR-0023 | resolved on 2026-11-07: a `tag`-scope request is a commit comment on the tagged sha and `deployed --confirm-commit` reads it (R1, R3, R10) |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. With a fake `gh`, `confirm request --head <sha> --pr <n>` posts one PR comment whose request line parses to the head, the items and scope `pr`.
  It refuses a headless run and an item that is neither a `confirm` check nor a deploy check name.
- AC2. `confirm read` clears the checks for a later unedited `confirmed` from a write user; it does not for a label alone, an edited reply, an earlier reply, a reply bound to another head and a read-only user, each with its own `why`.
- AC3. After a valid read, `ship.py check` still reports the record fresh for the same head and `tests/mieruka-sync.mjs` still loads it.
- AC4. `deployed --confirm-pr <n>` with the `rollback dry run` check given as `confirm` writes a deploy record with status `pass`, for the head and for the merge commit.
- AC5. Tag scope: with no PR for the tagged sha, `confirm request --head <tag sha> --items '["rollback dry run", "tests on a clean checkout of the tag"]'` posts a commit comment through `gh api`; after a `confirmed` reply on that commit, `deployed --from-tag v1.2.0 --target <id> --confirm-commit <tag sha>` with both checks given as `confirm` writes status `pass`.
- AC6. The merge gate in warn mode appends the confirmation line and allows; with `mode.confirmation` set to enforce and no valid reply it denies once and the identical retry passes; with no `confirm` checks it adds nothing.
- AC7. `ship.py ready` on a Ship block with the step `Revert the release commits on main` exits 9 and names it; `preflight.json` and `report.json` written before the run have the same sha256 after it.
- AC8. `ready` accepts an argv list, a one-line inline code span, a `sh` fenced block and a `manual:` step beside a runnable one; it rejects a target whose only rollback step is `manual:`.
- AC9. `ready` rejects a target whose `verify` list holds the prose step `check the health page` and accepts one that holds `` `curl -fsS https://example.com/health` `` (R18).
- AC10. `ship.py record` refuses a GO whose rollback step still holds `<previous version>`.
- AC11. `python3 plugins/pro-ship/scripts/ship.py ready` passes on this repo after R25; the new steps hold `git push origin main` and no `git tag` for an existing version.
- AC12. `node tests/check.mjs`, `node tests/eval.mjs --dry` and `claude plugin validate . --strict` pass.

## Out of scope

- The ship gate re-reading the confirmation: it makes no network call and stays file-only.
- Running any rollback or verify step.
- A GitHub identity of its own for the factory.
