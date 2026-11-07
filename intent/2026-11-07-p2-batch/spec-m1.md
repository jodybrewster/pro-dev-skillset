---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T10:40:00-0500
author: the maintainer
module: m1
---

# Spec m1: the small batch

Built from `intent.md` in this folder (commit 5041d4a), module m1 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0010, ADR-0016, ADR-0017, ADR-0024, `docs/enforce-mode.md`, `docs/hook-loading.md`, `pro-security:security-architect` (diff mode, read for pass 2).

## Summary

Four one-file fixes land, one PR per plugin: `factory.py level` stops raising an intent to level 3 for a stop-list word it only discusses, a merged factory state is checked against the default branch and `/execute` writes the head it filled `## Done` at, `/constraints` proves each check before it writes the row and the hook tests run on macOS with Python 3.9 in CI.
Everyone who runs the factory or `/constraints` gets them on the next plugin update.

## Assumptions

Confirmed on 2026-11-07:

1. `factory.py level` scans the whole intent body today (`compute()`, `stop_words_in`).
   The fix scans only the `## Proposed outcome`, `## Affected users and systems` and `## Constraints` sections, with fenced code and backticked spans removed first.
2. `factory.py record --state merged` takes `--sha` and never checks it against a branch.
3. `plan-sync.py` is a Stop hook under warn and enforce modes; `/execute` is the command that fills `## Done`.
4. `/constraints` has no step that proves a check fires; ADR-0010 keeps semgrep, osv-scanner, Lighthouse and axe out of scope.
5. `validate.yml` runs one Ubuntu job; the hook scripts are stdlib Python and macOS ships Python 3.9.6 as `/usr/bin/python3`.

## Requirements

### Functional

- R1. `stop_words_in` is called on the text of the `## Proposed outcome`, `## Affected users and systems` and `## Constraints` sections of `intent.md` only, each with HTML comments, fenced blocks and backticked spans removed (intent: "raises to 3 on an intent that only discusses a stop-list word").
- R2. A stop-list word that appears only under `## Problem`, `## Out of scope`, `## Risk` or inside code spans does not add a level 3 reason.
- R3. The reason text names the section the word was found in: `stop-list words in Proposed outcome: deploy, release`.
- R4. `history_max` and the only-ever-raised rule are unchanged: an intent whose recorded level is 3 stays 3 after this change.
- R5. `factory.py record --state merged --sha <sha>` fetches the default branch tip as `default_tip` does and refuses with exit 2 when `git merge-base --is-ancestor <sha> <tip>` is false, writing no record (intent: "a merged state is verified on the fetched base").
- R6. The refusal names the sha, the tip and the branch; the state `merged` is only ever written for a sha on the base.
- R7. When `/execute` fills `## Done` it writes the line `Done as of <12-char sha>` as the first line of that section, where the sha is the branch head at that moment.
- R8. `plan-sync.py` reads `## Done` of every plan the working tree changed; when the `Done as of` sha is not the current `HEAD` and files outside the ignored prefixes changed since that sha, it reports `## Done is stale (written at <sha>, head is <sha>)` as a warn-mode message and, in enforce mode, blocks once with that reason.
- R9. A plan with no `Done as of` line behaves exactly as today.
- R10. `/constraints` gains a step before it writes an "Enforced with numbers" row: run the check against a fixture that breaks the rule and against a clean control; write the row only when the first exits non-zero and the second exits 0 (intent: "proves each check on a known violation and a clean control").
- R11. A check that exits 0 on the violation is listed under a `### Not enforced` heading with the command and the two exit codes, never as a row.
- R12. `.github/workflows/validate.yml` gains a job `hooks-macos` on `macos-latest` that runs `node tests/check.mjs` with the system `python3` and no Claude CLI install.
- R13. The job is required for the pull-request event like the existing job; a failure on macOS fails the PR.

### Non-functional

- N1. The macOS job finishes in under ten minutes.
- N2. Each plugin change bumps its version in both manifests and the marketplace entry, plus `metadata.version`, in the same commit.
- N3. `plan-sync.py` reads only the plan files and `git` output; it writes nothing.

### Policy constraints applied

- Version-bump law (ADR-0002): one PR per plugin, each with its bump (N2).
- Hook-loading law (ADR-0003): `plan-sync.py` is already registered; no new hook entry.
- Gate enforce rule (ADR-0016): the stale-Done check starts in warn; its enforce behavior blocks once and honors `stop_hook_active` (R8).
- ADR-0010: no scanner is installed; R10 uses the checks the repo already runs.
- ADR-0024: the level is only raised (R4).
- REVIEW.md pass 2: `factory.py record` already runs `git fetch`; R5 adds no new network call.

### Boundaries

Always: edit the four files named, add behavior cases under `tests/` for each hook change, bump versions.
Ask first: changing a stop-list word, adding a scanner, making the macOS job optional.
Never: lower a recorded level, write a `merged` record for a sha off the base, block in warn mode.

## Design

### User experience

A person running `/execute` sees no change except the `Done as of` line in the plan.
A person whose plan goes stale sees one warn-mode line at Stop naming both shas.
A person running `/constraints` sees each check proven or listed as not enforced.

### System

- `plugins/pro-ai-sdlc/scripts/factory.py`: `compute()` slices the body by `## ` headings before calling `stop_words_in`; `cmd_record` gains the ancestor check.
- `plugins/pro-ai-sdlc/commands/execute.md`: the Done step writes the sha line.
- `plugins/pro-ai-sdlc/scripts/plan-sync.py`: a `stale_done()` helper reads the line and compares with `git rev-parse HEAD`.
- `plugins/pro-quality/skills/constraints/SKILL.md`: the proof step.
- `.github/workflows/validate.yml`: the second job.
- Tests: `tests/factory.mjs` (R1 to R6), `tests/sdlc-hooks.mjs` (R8, R9), a routing or behavioral case for R10 where `tests/cases/` expects one.

### Alternatives considered

- Scan the diff of `intent.md` against the base instead of sections: an intent is text, not code, so the first commit adds every line and the scan would raise on it anyway.
- A separate Stop hook for the stale Done: `plan-sync` already owns the plan at Stop; a second hook would be a hook-loading-law risk for no gain.
- Running the whole CI on macOS: the Claude CLI steps are slow and not what breaks on macOS.

## Flagged concerns

ADR needed: no, each change applies an accepted rule (ADR-0010, ADR-0016, ADR-0024) to one more place.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | R8 blocks in enforce mode on a stale Done, which the 2026-11-13 enforce decision has not seen in warn | `docs/enforce-mode.md` | open: the stale-Done check gets its own row and its own evidence period starting at merge |
| 2 | R1 narrows what the level reads, so an intent can hide `deploy` under `## Problem` on purpose | ADR-0024 | resolved: `risk:` and the author check still apply; the level is only ever raised, so a reviewer can raise it by hand |

## Open questions

- None carried from the intent for this module.

## Acceptance criteria

- AC1. `factory.py level intent/2026-11-04-rollback-path` computes 3 from `risk: high` and its reasons list no stop-list reason.
- AC2. A fixture intent with `auth` only under `## Out of scope` computes level 1 when its author, source and risk allow it; the same word moved under `## Proposed outcome` computes 3.
- AC3. `factory.py record --state merged --sha <sha of an unmerged branch>` exits 2 and leaves no record; the same with a sha on the default branch writes the record.
- AC4. After `/execute` on a demo plan, `## Done` starts with `Done as of <sha>` and `git rev-parse --short=12 HEAD` matches it.
- AC5. With a later commit that changes a script, Stop in warn mode logs `## Done is stale` to `warn.log`; in enforce mode the first Stop blocks and the second passes.
- AC6. `/constraints` on `demo/app` writes a row only for checks that fail the violation fixture; it lists the rest under `### Not enforced`.
- AC7. The `hooks-macos` job passes on this PR and is listed as a check on it.
- AC8. `node tests/check.mjs` and `claude plugin validate . --strict` pass after each PR.

## Out of scope

- Items 44, 45 and 22 (modules m2 to m4).
- Enforce mode for the stale-Done check before its evidence period.
