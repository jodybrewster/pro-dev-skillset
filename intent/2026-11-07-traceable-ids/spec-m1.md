---
id: PDS-50
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T13:56:55-0500
author: the maintainer
module: m1
---

# Spec m1: the id itself

Built from `intent.md` in this folder (commit 1242860), module m1 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `intent/README.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0014, ADR-0016, ADR-0023, ADR-0024, `docs/loop-records.md`, `docs/enforce-mode.md`, `plugins/pro-ai-sdlc/references/definition-of-done.md`, `pro-security:security-architect` (diff mode, read for pass 2).

## Summary

Each repo that uses the loop declares a shortcode once in `intent/project.json` and every change gets an id `<shortcode>-<n>` when its intent is written.
`/intent` and `/incident` allocate the next number from git, write it as `id:` in the intent's frontmatter and name a new folder `intent/<id>-<slug>/`.
`/spec` and `/plan` copy the id into the spec and plan frontmatter.
Every script that reads an intent folder name accepts the new form beside the date form.
This repo gets `{"shortcode": "PDS"}` and every existing intent gains an `id:` line in creation order, PDS-1 to PDS-50, with no folder renamed.
A `change-ids` check in `tests/check.mjs` fails on a missing, malformed or duplicate id.
`/pro-dev install` asks for a shortcode once in a repo that has none.

## Assumptions

Confirmed by the maintainer on 2026-11-07:

1. An id matches `^[A-Z]{2,6}-[1-9][0-9]*$`.
   The shortcode is chosen once and never changed in place.
2. `/intent` allocates by running `git fetch`, then taking the highest `id:` across `intent/*/intent.md` committed on `origin/main` and on any local or remote branch (`refs/heads/*` and `refs/remotes/origin/*`), plus one.
   It works offline from the last fetch and says so.
   Committed intents in other worktrees of the same clone are seen through `refs/heads/*`.
   The window left is an intent that is uncommitted, or committed but unpushed in another clone; the `change-ids` check catches that duplicate on the second pull request.
3. New folders are named `intent/<id>-<slug>/`, for example `intent/PDS-51-slug/`.
   `/spec`, `/plan`, `/execute` and `factory.py` read `id:` from frontmatter and never from the folder name.
4. The backfill numbers the existing intents in `created:` order with the folder name as the tiebreak.
   A date-only `created:` is read as 00:00 UTC on that day; every time is compared in UTC.
5. `evidence_key` keeps its rule `<prefix>-<folder>` and every key written today stays byte-identical.
6. The `author:` field is unchanged.
7. mieruka's own reading of the id is its own intent (mieruka PR 221); this spec only guarantees the field and the sync fixture (module m3).

## Requirements

### Functional

- R1. `intent/project.json` is tracked in this repo and holds exactly `{"shortcode": "PDS"}` (intent: "Each repo declares a shortcode once, in a tracked `intent/project.json`").
- R2. A shortcode matches `^[A-Z]{2,6}$`; an id matches `^[A-Z]{2,6}-[1-9][0-9]*$` and its letters equal the repo's shortcode (intent: "Every change has an id, `<shortcode>-<n>`").
- R3. A new script `plugins/pro-ai-sdlc/scripts/ids.py next` reads the shortcode from `intent/project.json`, runs `git fetch --quiet origin` with a 10 second timeout, reads every `id:` of `intent/*/intent.md` committed on the default branch tip, on every `refs/remotes/origin/*` ref and on every local `refs/heads/*` branch plus the current working tree and prints `<shortcode>-<highest n + 1>`; an intent uncommitted in another worktree or unpushed in another clone is on no ref it reads; the `change-ids` check catches that duplicate on the second pull request (intent: "`/intent` allocates the next number from the ids committed on `origin/main` and on any local or remote branch").
- R4. When the fetch fails or times out, `ids.py next` still prints the id from the refs it has, exits 0 and writes `ids: offline, allocated from the last fetch (<FETCH_HEAD time or never>)` to stderr (assumption 2).
- R5. With no `intent/project.json`, `ids.py next` exits 1 with `ids: no intent/project.json`; `/intent` then writes `intent/<YYYY-MM-DD>-<slug>/intent.md` with no `id:` exactly as today and prints one line suggesting `/pro-dev install` to set a shortcode (intent: "A repo with no `intent/project.json` behaves as today, with a one-line reminder").
- R6. With `intent/project.json`, `/intent` runs `ids.py next`, writes `intent/<id>-<slug>/intent.md` and puts `id: <id>` as the first frontmatter key; `/incident` does the same for the folder it creates (intent: "the intent folder for a new change, `intent/PDS-50-slug/`, plus an `id:` line").
- R7. `templates/intent.md` and `templates/spec.md` gain `id: <change id, or delete this line when the repo has no intent/project.json>` as their first frontmatter key; `templates/plan.md` gains a frontmatter block holding only that key, above its `# Plan:` heading.
- R8. `/spec` and `/plan` copy the intent's `id:` value into the frontmatter of every `spec*.md`, `plan*.md` and `capability-map.md` they write; they write no `id:` when the intent has none.
- R9. `factory.py` accepts an intent folder named `^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$` or `^[A-Z]{2,6}-[1-9][0-9]*-[a-z0-9-]{1,60}$` in `folder_of`, `eligible` and `next_folder`; where it needs the change id it reads `id:` from the intent's frontmatter and never parses the folder name (assumption 3).
  The same two forms are accepted by `plugins/pro-ai-sdlc/factory/session.sh` (its date glob and its `*[!a-z0-9/-]*` guard, which allows capitals only in the id prefix; a container run on `intent/PDS-51-slug` then no longer exits 64), by `tests/e2e-sdlc/checks.mjs` (`intentDirs` and the `^intent\/\d{4}-` filter of `incident-intent`) and by the folder shape `/auto` states in `commands/auto.md`.
- R10. The slug of an intent folder, used today for branch names in `execute-gate.py`, `factory.py binding_reasons` and `factory/session.sh` (its `slug=${base#????-??-??-}` line and the `want` branch it passes to `gh pr list --head`), is the folder name with either a date prefix or an id prefix `[A-Z]{2,6}-[0-9]+-` removed: `PDS-51-fix-greeting` gives `fix-greeting` and the brief branch `fix-greeting-brief` in all three; `commands/auto.md` describes the branch as the folder name without its date or id prefix.
- R11. `ship.py`'s `INTENT_FOLDER` accepts both folder forms; `ship.py version` and the changelog check then count an intent in an id-named folder.
- R12. Every evidence writer that builds a key from a folder name (`factory.py`, `visual.py`, `incident.py`) lowercases the folder into the key: `PDS-51-fix-greeting` gives `factory-pds-51-fix-greeting`, while a date folder gives the same key as today; `artifact_key` stays the folder name as written.
- R13. `tests/check.mjs` gains `checks["change-ids"]`: when `intent/project.json` exists, every `intent/*/intent.md` has an `id:` that matches R2, no two intents share an id, a folder whose name starts with an id carries that same `id:` and every `spec*.md`, `plan*.md` or `capability-map.md` that has an `id:` matches its intent's (intent: "a `check.mjs` check fails on a duplicate or missing id").
- R14. Each failure names the file and the id, for example `intent/2026-11-07-p2-batch/intent.md: id PDS-49 is also used by intent/2026-11-07-review-routes-back/intent.md`.
- R15. With no `intent/project.json` the check passes with one warning and a repo that never set a shortcode is not blocked.
- R16. Because every existing id carries the old letters, changing the shortcode in `intent/project.json` fails the check on every intent; the shortcode cannot change in place (assumption 1).
- R17. `ids.py backfill` lists every intent with no `id:` in the order of assumption 4 and numbers them from the highest existing id plus one; it prints the table and writes nothing; `ids.py backfill --write` inserts `id: <id>` as the first frontmatter line of each such `intent.md` and changes nothing else in the file (intent: "The 49 existing intent folders keep their names and gain an `id:` line in creation order").
- R18. On this repo the backfill gives exactly the mapping in "Backfill mapping" below and renames no folder.
- R19. An id is never reused: `ids.py next` counts every intent whatever its `status`, including `dropped`; an intent folder is never deleted (intent: "An id is never reused or renumbered, even when the change is dropped").
- R20. `/pro-dev install` in pro-core, when pro-ai-sdlc is installed and `intent/project.json` does not exist, asks once for a shortcode proposing a default only when it matches `^[A-Z]{2,6}$` and otherwise asking with no default (`x`, `3d-viewer` and `my_app` fall through to the question); the default is the capitalised initials of the repo folder's hyphen-separated words for two to six words (`pro-dev-skillset` gives `PDS`), the first three letters for one word (`mieruka` gives `MIE`) and the first six initials for more than six words; it accepts only `^[A-Z]{2,6}$`, writes `intent/project.json` on an answer, writes nothing on a skip and never overwrites an existing file (intent: "`/pro-dev install` writes `intent/project.json` when the person gives a shortcode").

### Non-functional

- N1. `ids.py next` returns in under 15 seconds with the network down; the fetch timeout is 10 seconds.
- N2. `ids.py` is stdlib Python that runs on Python 3.9, like the other hook and loop scripts.
- N3. Each plugin change bumps its version in both manifests and the marketplace entry, plus `metadata.version`, in the same commit.
- N4. No person's name appears in any id, file or record this module adds; `author:` is untouched.

### Policy constraints applied

- Version-bump law (ADR-0002): one PR per plugin, each with its own bump (N3).
- Hook-loading law (ADR-0003): this module adds no hook; `ids.py` is a script that commands run.
- Codex parity (ADR-0004): `/intent`, `/spec`, `/plan` and `/incident` stay harness-neutral; the allocation is a script both harnesses can run.
- ADR-0023: keys keep their rule and charset (R12).
- ADR-0024: `factory.py level` reads the same frontmatter; the id never raises or lowers a level.
- REVIEW.md pass 2: `ids.py` runs one `git fetch` from a command, never from a hook.

### Boundaries

Always: write `id:` lines, widen the folder patterns, add cases under `tests/`, bump versions.
Ask first: renaming any existing intent folder, changing the shortcode of a repo, deleting an intent folder.
Never: reuse an id, renumber an id once merged, derive the id from a folder name, overwrite an existing `intent/project.json`.

## Design

### User experience

A person running `/intent` in a repo with a shortcode sees the id in the folder name and the frontmatter and one line saying where the number came from, plus the offline line when the fetch failed.
A person in a repo without one sees today's behavior and one reminder line.
`/pro-dev install` asks one more question with a default that can be skipped.

### System

- `intent/project.json` (new): the shortcode.
- `plugins/pro-ai-sdlc/scripts/ids.py` (new): `next`, `backfill` and `backfill --write`, sharing one `id_of(text)` that reads `id:` with the same rules as `factory.frontmatter`.
- `plugins/pro-ai-sdlc/commands/intent.md`, `incident.md`, `spec.md`, `plan.md`: allocation and copying, with `ids.py` in `allowed-tools`.
- `plugins/pro-ai-sdlc/templates/intent.md`, `spec.md`, `plan.md`: the `id:` line.
- `plugins/pro-ai-sdlc/scripts/factory.py`: `FOLDER_RE` takes both forms, a `slug_of(folder)` helper, a lowercased key.
- `plugins/pro-ai-sdlc/scripts/execute-gate.py`: `slug_of` for both prefixes.
- `plugins/pro-ai-sdlc/factory/session.sh`: the folder glob and the character guard take both forms, with capitals only in the id prefix.
- `plugins/pro-ai-sdlc/commands/auto.md`: the folder shape names both forms.
- `tests/e2e-sdlc/checks.mjs`: `intentDirs` and the `incident-intent` filter take both forms.
- `plugins/pro-ai-sdlc/scripts/visual.py`, `incident.py`: the lowercased key.
- `plugins/pro-ship/scripts/ship.py`: `INTENT_FOLDER` takes both forms.
- `plugins/pro-core/commands/pro-dev.md`: the shortcode question under "Create the folders and the review policy".
- `tests/check.mjs`: `checks["change-ids"]`, which scans the repo and runs the case table in `tests/ids.mjs`.
- `tests/ids.mjs` (new), `tests/factory.mjs`, `tests/execute.mjs`, `tests/ship-version.mjs`: cases for both folder forms.
- Every `intent/*/intent.md`: one `id:` line.

### Backfill mapping

Computed on 2026-11-07 from `origin/main` at 20c5666 by the rule in assumption 4.
p2-batch gets PDS-49, review-routes-back gets PDS-48 and traceable-ids gets PDS-50.
Five intents merged after 20c5666 and before the build follow by the same rule as PDS-51 to PDS-55 (the m1 build records this under Departures).
The first intent written after the backfill gets PDS-56.

| id | folder | created |
|---|---|---|
| PDS-1 | `2026-10-16-next-skills-bridge` | `2026-10-16` |
| PDS-2 | `2026-10-16-review-51-findings` | `2026-10-16T18:00:00-04:00` |
| PDS-3 | `2026-10-17-doc-hooks` | `2026-10-17` |
| PDS-4 | `2026-10-17-intent-in-core` | `2026-10-17` |
| PDS-5 | `2026-10-16-channel-basics` | `2026-10-17T13:00:00-04:00` |
| PDS-6 | `2026-10-25-remove-worktrunk` | `2026-10-25T09:30:00-04:00` |
| PDS-7 | `2026-10-25-security-push-gate` | `2026-10-25T10:15:00-04:00` |
| PDS-8 | `2026-10-27-adrs-in-the-sdlc-loop` | `2026-10-27T07:30:00-0400` |
| PDS-9 | `2026-10-27-pro-dev-simplify` | `2026-10-27T22:30:00-0400` |
| PDS-10 | `2026-10-28-quiet-validation-hook` | `2026-10-28T06:45:00-0400` |
| PDS-11 | `2026-10-28-pro-speckit` | `2026-10-28T07:05:00-0400` |
| PDS-12 | `2026-10-28-pro-dev-setup` | `2026-10-28T07:30:00-0400` |
| PDS-13 | `2026-10-28-spec-methods` | `2026-10-28T07:35:00-0400` |
| PDS-14 | `2026-10-28-design-vercel-bridges` | `2026-10-28T07:40:00-0400` |
| PDS-15 | `2026-10-28-execute-command` | `2026-10-28T08:10:00-0400` |
| PDS-16 | `2026-10-28-taste-skill-v2` | `2026-10-28T09:30:00-0400` |
| PDS-17 | `2026-10-28-rename-pro-dev` | `2026-10-28T11:30:00-0400` |
| PDS-18 | `2026-10-28-plugin-installers` | `2026-10-28T15:30:00-0400` |
| PDS-19 | `2026-10-28-pro-ship-scope` | `2026-10-28T15:45:00-0400` |
| PDS-20 | `2026-10-28-specialist-agents` | `2026-10-28T17:00:00-0400` |
| PDS-21 | `2026-10-29-evals-three-tiers` | `2026-10-29T10:00:00-0400` |
| PDS-22 | `2026-10-29-skill-firing` | `2026-10-29T14:00:00-0400` |
| PDS-23 | `2026-10-29-sdlc-egm-evals` | `2026-10-29T15:30:00-0400` |
| PDS-24 | `2026-10-29-constraint-floor` | `2026-10-29T18:08:46-0400` |
| PDS-25 | `2026-10-29-code-reviewer` | `2026-10-29T19:00:00-0400` |
| PDS-26 | `2026-10-29-pr-gate` | `2026-10-29T19:00:00-0400` |
| PDS-27 | `2026-10-29-review-policy` | `2026-10-29T19:00:00-0400` |
| PDS-28 | `2026-10-29-risk-tiers` | `2026-10-29T19:00:00-0400` |
| PDS-29 | `2026-10-30-p0-hardening` | `2026-10-30T09:00:00-0400` |
| PDS-30 | `2026-10-30-sdlc-loop-upgrades` | `2026-10-30T09:00:00-0400` |
| PDS-31 | `2026-10-30-untrusted-input-safety` | `2026-10-30T09:20:43-0400` |
| PDS-32 | `2026-10-30-required-documents` | `2026-10-30T09:20:44-0400` |
| PDS-33 | `2026-10-30-doubt-driven-execute` | `2026-10-30T09:20:53-0400` |
| PDS-34 | `2026-10-30-codex-second-reviewer` | `2026-10-30T10:00:00-0400` |
| PDS-35 | `2026-10-30-twelve-factor-skill` | `2026-10-30T10:00:00-0400` |
| PDS-36 | `2026-10-30-owner-neutral-skill` | `2026-10-30T11:00:00-0400` |
| PDS-37 | `2026-10-30-pro-electron` | `2026-10-30T12:00:00-0400` |
| PDS-38 | `2026-10-31-ship-preflight` | `2026-10-31T12:00:00-0400` |
| PDS-39 | `2026-11-01-neutral-repo` | `2026-11-01T08:00:00-0500` |
| PDS-40 | `2026-11-01-after-build-loop` | `2026-11-01T10:26:13-0500` |
| PDS-41 | `2026-11-03-software-factory` | `2026-11-03T16:13:11-0500` |
| PDS-42 | `2026-11-03-release-versioning` | `2026-11-03T20:30:00-0500` |
| PDS-43 | `2026-11-03-factory-demo-kit` | `2026-11-03T21:00:00-0500` |
| PDS-44 | `2026-11-04-factory-session-capture` | `2026-11-04T14:00:00-0500` |
| PDS-45 | `2026-11-04-sdlc-happy-path-run` | `2026-11-04T14:05:00-0500` |
| PDS-46 | `2026-11-04-rollback-path` | `2026-11-04T14:10:00-0500` |
| PDS-47 | `2026-11-04-sdlc-git-commands` | `2026-11-04T14:15:00-0500` |
| PDS-48 | `2026-11-07-review-routes-back` | `2026-11-07T11:20:00-0500` |
| PDS-49 | `2026-11-07-p2-batch` | `2026-11-07T12:00:00-0500` |
| PDS-50 | `2026-11-07-traceable-ids` | `2026-11-07T13:05:00-0500` |
| PDS-51 | `2026-11-07-guard-hardening` | `2026-11-07T14:00:00-0500` |
| PDS-52 | `2026-11-07-breaking-change-check` | `2026-11-07T14:31:00-0500` |
| PDS-53 | `2026-11-07-pr-check-every-tier` | `2026-11-07T14:31:00-0500` |
| PDS-54 | `2026-11-07-requirement-trace-check` | `2026-11-07T14:31:00-0500` |
| PDS-55 | `2026-11-07-ui-reviews-on-ui-diffs` | `2026-11-07T14:31:00-0500` |

### Alternatives considered

- A counter in `intent/project.json` bumped by each intent: two sessions would both bump it and the merge conflict would be the only signal; a scan of every remote branch finds the clash before either is pushed.
- Renaming the existing folders to `PDS-n-slug`: every link in the docs, the roadmap and the ADRs would break, which the intent rules out.
- Reading the id from the folder name: the 50 existing folders carry no id in their names; frontmatter is the only place every intent has it.
- A hosted counter or ticket system: ruled out by the intent.

## Flagged concerns

ADR needed: yes, an id scheme that every change in every repo with the loop follows is a rule other work must follow and expensive to reverse once ids appear in branches, commits and records; drafted as [ADR-0026](../../docs/decisions/0026-change-ids.md).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | `factory.py` `FOLDER_RE`, `execute-gate.py`, `factory/session.sh`, `tests/e2e-sdlc/checks.mjs`, `commands/auto.md` and `ship.py` `INTENT_FOLDER` accept only date folders and the first `PDS-n-slug` folder would be refused or skipped; REVIEW.md pass 1 counts that as a regression | `REVIEW.md` | resolved on 2026-11-07: R9 to R11 widen every pattern to both forms in this module with cases for each; no id-named folder exists before its readers accept it |
| 2 | ADR-0023 allows only `a-z`, `0-9` and `-` in an `evidence_key`; `factory-PDS-51-slug` breaks that | ADR-0023, `docs/loop-records.md` | resolved on 2026-11-07: R12 lowercases the folder into the key; every date-folder key is byte-identical and every new key keeps the charset |
| 3 | `incident.md` already has an `id:` key that must equal the folder name, while `id:` in `intent.md` now means the change id | ADR-0023, `docs/loop-records.md` | resolved on 2026-11-07: the two files keep their own meaning; `incident.md` is unchanged and module m3 adds `change_id` to the incident record |
| 4 | The module edits pro-ai-sdlc, pro-ship and pro-core | version-bump law, ADR-0002 | resolved on 2026-11-07: one PR per plugin, each with both manifests, its marketplace entry and `metadata.version`; the second and third rebase; the repo-only files ride with the pro-ai-sdlc PR |
| 5 | `tests/check.mjs` requires `/intent` to name `intent/<YYYY-MM-DD>-<slug>/intent.md` and mieruka parses anchor lines in `commands/intent.md` | `tests/check.mjs` sdlc-contract, mieruka | resolved on 2026-11-07: the date path stays as the no-shortcode branch of R5 and no anchor line changes; whether mieruka shows an id-named folder is its own intent (mieruka PR 221) |
| 6 | The intent counts 49 existing folders and shows `PDS-50-slug` as a new folder while 50 folders exist including this one | the intent | resolved on 2026-11-07: the backfill covers every folder on `origin/main` when it runs, traceable-ids is PDS-50 and the first new folder is PDS-51 |
| 7 | `templates/plan.md` has no frontmatter today and `execute-gate.py` and `plan-sync.py` read plans by regex | `execute-gate.py`, `plan-sync.py` | resolved on 2026-11-07: the block holds only `id:`, `Status:` stays a body line and `tests/execute.mjs` gains a case for a plan with the block |

## Open questions

- The intent's `Check` line asks for the id format, the allocation rule, each place the id appears and the backfill as testable statements: R2, R3, R6 to R8 and R17 to R18 here; the places in git, records and docs are modules m2 to m4.
- None blocks planning.

## Acceptance criteria

- AC1. After the backfill, `python3 plugins/pro-ai-sdlc/scripts/ids.py next` in this repo prints `PDS-56`.
- AC2. In a fixture repo whose `origin/main` holds `TST-3` and whose `origin/other` branch holds `TST-7`, `ids.py next` prints `TST-8`; with a local unpushed branch holding `TST-9` it prints `TST-10`.
- AC3. With `origin` pointing at a path that does not exist, `ids.py next` prints the next id, exits 0 and its stderr starts with `ids: offline`.
- AC4. With no `intent/project.json`, `ids.py next` exits 1 and `/intent` writes a date-named folder with no `id:`.
- AC5. `node tests/check.mjs` fails `change-ids` on a fixture with two intents holding `TST-2` (naming both files) and on a fixture with one intent lacking `id:`; it passes on this repo after the backfill.
- AC6. `ids.py backfill` prints the 55 rows of "Backfill mapping" in order; after `--write`, `git diff --stat` shows 55 files changed, 55 insertions and 0 deletions.
- AC7. `factory.py level intent/<fixture TST-1-demo>` runs and `factory.py record` for that folder writes `.pro-dev/factory/factory-tst-1-demo.json`; the existing `tests/factory.mjs` cases for date folders pass unchanged.
- AC8. `ship.py version` in a fixture counts the `kind:` of an intent in `intent/TST-1-demo/`.
- AC9. `/pro-dev install` in a scratch repo named `demo-app` offers `DA`, writes `intent/project.json` with the answer and writes nothing on a skip; a repo named `mieruka` is offered `MIE` and one named `one-two-three-four-five-six-seven` is offered `OTTFFS`.
- AC10. `node tests/check.mjs` and `claude plugin validate . --strict` pass after each PR.

## Out of scope

- Renaming any existing folder.
- Branches, commit subjects and the hook (m2), record fields (m3) and docs (m4).
- A hosted counter.
- Numbering ADRs.
