---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T10:40:00-0500
author: the maintainer
module: m3
---

# Spec m3: verified role identity

Built from `intent.md` in this folder (commit 5041d4a), module m3 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, `docs/factory.md`, ADR-0024, ADR-0017, `pro-security:security-architect` (challenge mode, read for pass 2).

## Summary

A role in the `## Roles` block can carry a GitHub login; the factory checks the logged-in `gh` user against it before a role acts.
A missed `user.name` switch no longer acts as the wrong person without warning.

## Assumptions

Confirmed on 2026-11-07:

1. `parse_roles` accepts exactly the five role keys with name lists; the factory compares `git config user.name` with those names.
2. `gh auth status` and `gh api user --jq .login` are available wherever the factory runs with `--allow-broad-token`; a plain session may have no `gh`.
3. The check downgrades to the name check with a warning when `gh` or the network is missing; it never refuses for that reason alone.

## Requirements

### Functional

- R1. The `## Roles` yaml block accepts an optional `logins:` map of display name to GitHub login; `parse_roles` returns it and rejects a login that is not `[A-Za-z0-9-]{1,39}` (intent: "a role is only `user.name`").
- R2. `factory.py roles` prints each role's names with the login in parentheses when one is mapped.
- R3. A new `factory.py whoami` prints `user.name`, the `gh` login when available and the roles both resolve to; exit 0 when they agree, 3 when they name different roles, 2 when `gh` is unavailable.
- R4. Before `run`, `verify` and `record --state merged` act under a role, the factory runs the `whoami` check; a disagreement refuses with the two identities and the roles each maps to.
- R5. When `gh` is unavailable the check warns `factory: identity not verified (no gh login), using user.name` once per run and continues.
- R6. `/review` and `/ship`, which read the role for reviewer and sign-off, call the same check through `factory.py whoami --json` and show its warning line in their report.

### Non-functional

- N1. One `gh api user` call per command, cached for the run in `.pro-dev/factory/`.
- N2. No login or token is written to any record; the record stores the role name only.

### Policy constraints applied

- ADR-0024: the level and role rules are unchanged; this adds a second identity source.
- REVIEW.md pass 2: `gh api user` is a read with the existing broad-token exception; the response is parsed as JSON, never executed.
- N2 keeps personal data out of records, per REVIEW.md secrets and personal data.

### Boundaries

Always: compare, warn, refuse on disagreement.
Ask first: adding a login to the Roles block of a repo.
Never: act under a role the `gh` login contradicts, store the login in a record.

## Design

### User experience

`factory.py whoami` answers "who does the tooling think I am" in three lines.
A disagreement reads: `factory: user.name 'A' is engineer, gh login 'b' is product_owner; set one straight before continuing`.

### System

- `plugins/pro-ai-sdlc/scripts/factory.py`: `parse_roles` gains `logins`; `cmd_whoami`; a `check_identity()` called from `cmd_run`, `cmd_verify` and `cmd_record`.
- `plugins/pro-ai-sdlc/commands/review.md` and `plugins/pro-ship/skills/ship/SKILL.md`: one line each to run the check and print its result.
- `docs/factory.md`: the `logins:` key and `whoami`.
- Tests: `tests/factory.mjs` with a fake `gh` on `PATH`.

### Alternatives considered

- Reading the login from `git config` only: the retest problem is that `git config` is what people forget to switch.
- Refusing when `gh` is missing: a chat-first session without a terminal has no `gh`, so it would block the mieruka path.

## Flagged concerns

ADR needed: no, the Roles block format grows a key; ADR-0024 already owns the block.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | Squash merges credit the GitHub account, so even a correct `user.name` leaves the wrong author on `main` | `docs/factory.md` | open: the factory may need its own account, as super-board's `second-account.md` does; not solved here |

## Open questions

- Whether the factory should run under its own GitHub account (concern 1); a later intent.

## Acceptance criteria

- AC1. With a fake `gh` returning login `b` mapped to product_owner and `user.name` set to an engineer, `factory.py whoami` exits 3 and `factory.py run` refuses before taking a lock.
- AC2. With the two agreeing, both commands proceed as today.
- AC3. With `gh` absent, `whoami` exits 2, `run` warns once and proceeds.
- AC4. No file under `.pro-dev/factory/` contains the login string after a run.
- AC5. `node tests/check.mjs` passes; the pro-ai-sdlc and pro-ship bumps are in the PR.

## Out of scope

- A dedicated GitHub identity for the factory.
- Verifying identity on a Codex host.
