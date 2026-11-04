---
intent: intent/2026-11-03-release-versioning/intent.md
intent-status: accepted
status: draft
created: 2026-11-03T21:30:00-0500
author: the maintainer
---

# Spec: releases carry a version, checks that fit the target and deploy facts from the deploy

Built from `intent.md` in this folder.
Status: draft.
Policies and skills consulted: CLAUDE.md (the three laws, the Ship block), RELEASING.md, REVIEW.md, ADR-0002, ADR-0004, ADR-0022, ADR-0023, ADR-0024, `docs/ship-preflight.md`, `docs/loop-records.md`, `plugins/pro-ship/skills/ship/SKILL.md` and `release-checks.md`, `plugins/pro-ship/skills/deployed/SKILL.md`, `plugins/pro-ship/scripts/ship.py`, `plugins/pro-ai-sdlc/templates/intent.md`, `plugins/pro-ai-sdlc/scripts/factory.py` and agent-skills `skills/git-workflow-and-versioning` (Release & Versioning) and `skills/shipping-and-launch`.

## Summary

Every intent records whether it is a feature, a fix or breaking (`kind:` plus a new `breaking:` flag) and `/execute` writes a changelog line under Unreleased in the same change.
`ship.py version` turns the intents and changelog since the last release tag into one proposed semver and `/pro-ship:ship` says it in plain words.
With no release tag it reads the version the project already declares and asks one question instead of listing commit hashes.
`ship.py prepare` edits the manifest and the changelog for the proposed version into the working tree so tag, manifest and changelog agree; the tag stays a person's step.
`/pro-ship:deployed` picks its post-deploy checks by target kind, takes the deploy time and environment from the deploy and `/ship` reports tag protection once.

## Assumptions

- Release tags and `tag_pattern` behave as `ship.py` has them: a tag counts when its name holds a semver unless the Ship block sets a glob (`ship.py:507-521`).
- Intent frontmatter is plain `key: value` lines, so a new `breaking:` key needs no parser change (`factory.py:170-184`).
- Python 3.11 or newer is on the path for `tomllib`; older Python falls back to a regex read of `pyproject.toml` and `Cargo.toml`.
- `gh` can read rulesets and workflow runs only with repo access; without it the answer is `unknown`, never a failure.
- A repo with no `intent/` folders still works: the change kind falls back to the commit subject (R3).
- Unconfirmed: the five calls in "Open questions" are the recommended ones; the maintainer may overturn them at approval.

## Requirements

### Functional

- R1. `python3 "$SHIP" version [--target ID] [--base REF]` prints JSON: `state` (`proposal`, `first-release`, `nothing`), `last_tag`, `last_version`, `bump` (`major`, `minor`, `patch`), `next`, `next_if_not_breaking`, `tag` (the tag name in the style of the newest tag), `counts` (`breaking`, `feature`, `fix`), `changes` (subject, kind, source) and `question` (null or one plain sentence).
  It reads files and tags only, makes no network call and never writes.
- R2. The bump is the highest kind in the range: any breaking change is major, else any feature is minor, else a fix is patch.
  While the last version is 0.x a breaking change bumps minor and `reasons` says so.
  An empty range gives `state: nothing` and no version.
  The size of the diff never changes the bump.
- R3. Each change in the range gets one kind from its intent: `kind: idea` is a feature, `bug` is a fix, `change` is a feature and `breaking: true` makes it breaking whatever the kind.
  A change belongs to an intent when the range touches that `intent/<folder>/`.
  A commit with no intent falls back to its Conventional Commit prefix (`feat`, `fix`, a `!` or a `BREAKING CHANGE:` footer) and, when it has none, counts as a fix and is listed under `unclassified` so the person sees it.
- R4. A change whose intent has no `breaking:` line is `unknown`.
  `next` assumes it is breaking, `next_if_not_breaking` gives the other number and `question` asks about it once.
  The proposal never silently picks the smaller number.
- R5. `/pro-ship:ship` prints the proposal as one sentence of plain words, for example `v1.1.0 (minor): two features and one fix since v1.0.0`, then the changes grouped Added, Changed and Fixed and asks the person to accept or change it.
  It never tags.
  It prints the tag command (`git tag -a v1.1.0 <sha> -m "Release 1.1.0"`) for the person to run once the release change has merged.
- R6. With no release tag reachable from HEAD, `version` returns `state: first-release` and reads the declared version from the target's `package.json` (`version`), `pyproject.toml` (`[project] version` or `[tool.poetry] version`) or `Cargo.toml` (`[package] version`).
  Its `question` names the version and the commit in words and offers three answers: tag the commit that was out before the first intent as that version, pick another commit by subject or treat the whole history as the first release.
  The question lists no bare hashes.
- R7. The default commit for R6 is the parent of the oldest commit that added a file under `intent/`.
  When the repo has no `intent/` it is the newest commit whose manifest holds the declared version.
  When the manifest at that commit does not hold the declared version, `version` says so and the question asks the person to pick.
- R8. With no release tag and no declared version, `version` proposes `v0.1.0` for the whole history and says no earlier release was found.
- R9. The intent template gains `breaking: <true | false>` after `kind:`.
  `/intent` asks for it when `kind` is `idea` or `change` and writes `false` for `bug` unless the person says otherwise.
  An intent that predates the field reads as `unknown` (R4).
- R10. The changelog mode comes from, in order, a `changelog:` key in the Ship block (`manual`, `generated` or `none`), generator markers (a `.changeset/` folder, `release-please-config.json`, `cliff.toml`, `.releaserc*`, a release workflow naming release-please or semantic-release or a first-line note in `CHANGELOG.md` saying it is generated or not to be edited) and then the file itself (`CHANGELOG.md` with an Unreleased heading is `manual`, none is `none`).
  `python3 "$SHIP" changelog` prints `{mode, path, unreleased, groups}`.
- R11. In `manual` mode `/execute` adds one line under `## [Unreleased]` in the same change, in the group that fits: `idea` and `change` go under Added or Changed, `bug` under Fixed, plus Deprecated, Removed and Security by judgment.
  A breaking change gets a `Migration:` line.
  `/execute` creates the file in Keep a Changelog form when the mode is `none` and the person's repo has a manifest; it never creates or edits the file in `generated` mode.
- R12. `python3 "$SHIP" changelog --check <base> <head>` compares the intents in the range with the Unreleased entries and reports each intent with no entry.
  A missing entry is a Recommended fix.
  A breaking intent whose entry has no `Migration:` line is a Recommended fix.
  A Removed entry or a breaking change also adds one `confirm` item: was the deprecation window kept (the `deprecation-and-migration` skill).
- R13. `python3 "$SHIP" prepare <X.Y.Z>` edits the working tree only: the manifest version and in `manual` mode the changelog (Unreleased becomes `## [X.Y.Z] - <date>` with a fresh empty Unreleased above it and the comparison links updated when the file has them).
  It refuses when `changelog` is `generated` and says the generator owns the file, when the tree is dirty, when the version is not `X.Y.Z` in digits or when the tag already exists.
  It never commits, tags or pushes.
- R14. `python3 "$SHIP" version --agree <X.Y.Z>` returns three checks with evidence: the manifest holds `X.Y.Z`, the changelog has a heading for it (manual mode) and the tag name is unused.
  `/ship` runs it with the version the person accepted.
  A mismatch on a `tag-release` or `publish` target is a Blocker; a repo with no manifest reads `manifest: none` and passes that one check.
- R15. `python3 "$SHIP" checks --target ID` prints the post-deploy check set for the target's kind.
  `tag-release`, `publish` and `desktop` get three: tests pass on a clean checkout of the tag, the documented use runs (the README's first usage example) and a rollback dry run (the previous tag exists and the revert commands in the report parse).
  `deploy-on-merge` and `manual-deploy` keep today's list (health, errors, latency, critical flow, logs, rollback).
- R16. `deployed` refuses a check whose item matches health, error rate, latency or logs when the target kind is `tag-release`, `publish` or `desktop` and says which checks the kind takes.
- R17. `deployed --from-tag <tag> --target ID` fills the commit, the outcome (`succeeded`) and the time from the tag.
  The time comes from the first source that answers: the GitHub deployment, the GitHub release's `published_at`, the `created_at` of the workflow run that the tag push started, the annotated tag's tagger date, the commit date.
  The record's `detail_json` gains `time_source` naming it.
- R18. `deployed` never fills `deployed_at` with the time the record is written.
  Without `--deployed-at`, `--from-github` or `--from-tag` it refuses and names the three options.
- R19. The environment comes from the target (`env` in the Ship block).
  A `tag-release`, `publish` or `desktop` target with none records `release` and `detail_json` gains `env_source: "default"`.
  `deployed` no longer defaults `--env` to `production` for those kinds.
- R20. `python3 "$SHIP" protection` prints `{tags_protected, via, ci_on_tags, notes}`; each value is `yes`, `no` or `unknown`.
  Protected means an active ruleset (or classic tag protection) whose ref conditions cover `refs/tags/*` or the target's tag pattern.
  CI on tags comes from the workflows `ship.py` already reads (`ship.py:356-398`).
  A `gh` error or a missing permission gives `unknown` with the reason, never a refusal.
- R21. `/ship` names the protection result once per run, only for `tag-release` and `publish` targets, as one Recommended fix and never a Blocker.
- R22. The Documentation items of `release-checks.md` gain "changelog updated for the range" from R12 and the version agreement from R14.
- R23. When `ship.py` is missing (the no-script path) the skills do the same walk by hand and say no record was written, as they do today.
- R24. `docs/loop-records.md` documents `time_source`, `env_source` and the check sets by kind; `docs/ship-preflight.md` documents the new check items; ADR-0025 records the rules.

### Non-functional

- N1. `ship.py` stays standard library only; every subprocess is an argv list; `version` and `changelog` make no network call; each `gh` call keeps its timeout (`GH_TIMEOUT`).
- N2. A version string is checked against `^\d+\.\d+\.\d+$` before it reaches a file name, a tag name or a command; tag names are checked against the Ship block's glob.
- N3. `version` on a repo of 2000 commits finishes in under 3 seconds.

### Policy constraints applied

- Version-bump law: pro-ship and pro-ai-sdlc bump in both manifests, the marketplace entry and `metadata.version` in each PR that touches them (ADR-0002).
- Codex parity: skills stay harness-neutral and the no-script path is kept (ADR-0004, R23).
- Records: new fields are optional additions to the deploy record, so `schema` stays 1 (ADR-0023, `docs/loop-records.md:40-73`).
- Layering: pro-ai-sdlc declares no dependency on pro-ship; `/execute` finds `ship.py` the way pr-check finds a sibling script and writes the changelog line by hand when it is not installed.
- No manual edit to a generated file: `CHANGELOG.md` is never written in `generated` mode and this marketplace's Ship block says so (concern 1).
- Names: nothing written names the maintainer.

### Boundaries

Always: read the last release tag as the source of truth for the last version; print the tag command and leave the tag to the person; run `--agree` before a GO.
Ask first: running `prepare` (it edits files); tagging a commit that is not HEAD (the first release).
Never: tag, push, publish or edit a generated changelog; guess a base commit; write the time a record was written as the deploy time.

## Design

### User experience

First release on the demo: `/pro-ship:ship` says `tiny-tasks says 1.0.0. Tag the commit before the first factory change ("Add task list") as v1.0.0?`.
After the answer it says `v1.1.0 (minor): Added sort by title and due dates; Fixed trimmed titles`, lists the changes and offers to run `prepare 1.1.0`.
The report ends with the tag command.
`/pro-ship:deployed` on a library target walks three checks, shows the tag, the time and its source (`tag push run, 2026-11-03T21:02:11-05:00`) and never mentions health or latency.

### System

Touched: `plugins/pro-ship/scripts/ship.py` (new `version`, `changelog`, `prepare`, `checks`, `protection`, `deployed --from-tag`), the `ship` and `deployed` skills and `release-checks.md`, `plugins/pro-ai-sdlc` (intent template, `/intent`, `/execute`), `docs/loop-records.md`, `docs/ship-preflight.md`, ADR-0025 and the tests in the plan.
Reused: `release_tags` and `release_tag` (`ship.py:517-559`), `targets` (`ship.py:524`), `workflow_facts`, `github_facts`, `read_checks`, `write_atomic`.
The current ask-for-a-base path (`SKILL.md:41`) stays as the last resort when `version` cannot answer.

### Alternatives considered

- Derive the version from the tag and never edit the manifest, as the baseline suggests: npm, PyPI and crates read the version from the manifest inside the artifact, so the manifest has to carry it; the agreement check (R14) gives the same guarantee.
- Let `/ship` tag after a GO: the tag is irreversible once pushed and consumed; it stays a person's step.
- Compute the bump from Conventional Commits only: the factory squashes and merges by pull request, so commit subjects are not a reliable record; the intent is.
- Generate the changelog from commits at release time: the baseline says to write it with the change; the intents already hold the wording.

## Flagged concerns

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | `CHANGELOG.md` files here are generated and must never be edited by hand; R9 to R13 would write one | CLAUDE.md (Never manually modify CHANGELOG.md) | resolved: `generated` mode (R10) makes `/execute`, `prepare` and the check leave the file alone; this repo's Ship block gets `changelog: generated`; no changelog file is edited in this work |
| 2 | The intent says the tag stays a person's step but the first release asks for a tag on an old commit | intent Constraints | resolved: R5 and R6 print the command; nothing in `ship.py` runs `git tag` (tested by a PATH stub that fails on `tag`) |
| 3 | `/ship` "never edits a document" and refuses a dirty tree, yet `prepare` edits files | `SKILL.md:14`, `release-checks.md:77` | resolved: `prepare` is a separate subcommand the person agrees to; it runs before the GO, on a clean tree and the preflight record stays bound to the commit made afterwards |
| 4 | Dropping the `now()` default for `deployed_at` and the `production` default for env changes today's behaviour (`ship.py:1045`) | ADR-0023 | resolved: the record's shape is unchanged; both defaults were the bug the intent names; `tests/ship-deploy.mjs` is updated and the refusal text names the replacement |
| 5 | The push time of a tag is not in git | none | resolved: a source ladder (R17) with `time_source` in the record, so a weaker time is visible |
| 6 | `kind: change` is ambiguous: a refactor is not a feature | intent kinds | resolved: it maps to minor and the proposal lists every change so the person can lower it; see Open questions |
| 7 | Manifest text, tag names and `gh` output are untrusted input that reaches files, tag commands and records | security | open: N2 validates versions and tag names; the plan's Security challenge covers `prepare` regex edits and the clean checkout that runs the repo's own tests |
| 8 | The marketplace tags per plugin (`name--vX.Y.Z`) and its manifests are `plugin.json`, not package.json | CLAUDE.md Ship block | resolved: the proposal works per target with the style of the newest tag; there is no manifest reader for `plugin.json`, so `--agree` reports `manifest: none`; the version-bump law keeps covering it |
| 9 | Adding `breaking:` to the template touches pro-ai-sdlc, which also owns the level rules | ADR-0024 | resolved: `breaking:` does not change the level in this work (Open questions) |

ADR needed: yes, semver from intent kinds, the changelog modes and the post-deploy check sets by target kind are rules other work follows and are costly to reverse once releases carry versions; drafted as [ADR-0025](../../docs/decisions/0025-release-versions.md), proposed.

### Baseline map

Source: agent-skills `skills/git-workflow-and-versioning` (Release & Versioning) and `skills/shipping-and-launch`.

| Baseline item | Result |
|---|---|
| MAJOR breaking, MINOR feature, PATCH fix | R2, R3 |
| The number is a promise: a behaviour change consumers relied on is major whatever the diff size | R2 (size never changes the bump), R3 (`breaking:` overrides kind) |
| When unsure whether a change is breaking, assume it is | R4 |
| Tag the release with an annotated tag, immutable | R5 prints `git tag -a`; R20 and R21 report protection |
| The tag is the source of truth | R1 reads the last version from the tag; R6 treats the manifest as a hint only when no tag exists |
| Derive the version from the tag and do not hand-edit it in scattered files | Dropped as written: the artifact reads its version from the manifest, so R13 edits one manifest and R14 proves tag, manifest and changelog agree |
| Human changelog grouped Added, Changed, Fixed, Deprecated, Removed, Security, newest on top | R10, R11, R13 |
| Written around user impact, not from `git log` | R11 (written by `/execute` from the intent); commit prefixes are used only to classify (R3), never as changelog text |
| Write the entry in the same change | R11, R12 |
| Breaking changes get a migration note and a deprecation window | R11 (`Migration:` line), R12 (migration check and a `confirm` for the window; the window itself is judgment) |
| Rationalizations and red flags (patch for a small fix, changelog at release time) | R2 and R11; kept as prose in the `ship` skill's table |
| shipping-and-launch: changelog updated before launch | R22 |
| shipping-and-launch: post-deploy health, error rate, latency, logs | kept for services; replaced for libraries by R15 and R16 |

## Open questions

All answered here with the recommended call; the maintainer can overturn any at approval.

1. Does `kind: change` bump minor or patch?
   Minor (R3).
   A change that is only internal is recorded with `kind: bug` or lowered by the person in the proposal.
2. Does a breaking change at 0.x bump major?
   No, minor (R2), the npm and Cargo convention; the proposal says so.
3. Does `breaking: true` raise the escalation level?
   No.
   `risk-classify.py` already reads the real diff and the level rules stay ADR-0024's.
4. What environment does a library deploy record carry?
   `release` (R19).
5. Do `publish` and `desktop` targets use the library check set?
   Yes (R15); publishing itself stays out of scope, so the "package installs from the registry" check is not added.

## Acceptance criteria

- AC1. On a fixture with no tag and a `package.json` at 1.0.0, `version` returns `first-release`, the declared version, the default commit of R7 and a question with no bare hash; the same holds for `pyproject.toml` and `Cargo.toml`.
- AC2. On a fixture with tag `v1.0.0` and intents of kind idea, idea and bug (all `breaking: false`), `version` returns `minor`, `v1.1.0` and counts of two features and one fix.
- AC3. One `breaking: true` intent in that range gives `major`; one intent with no `breaking:` line gives `next` as the major number, `next_if_not_breaking` as the minor and a question.
- AC4. At last version 0.4.2 a breaking change proposes 0.5.0.
- AC5. `changelog` reports `generated` for each marker in R10 and `ship.py prepare` refuses there without writing; `/execute` writes nothing to a generated file.
- AC6. `prepare 1.1.0` on a manual-mode fixture changes exactly the manifest and the changelog, leaves the tree uncommitted and no tag exists afterwards; `--agree 1.1.0` then passes all three checks and a 1.0.9 manifest fails one.
- AC7. `deployed` on a `tag-release` target refuses a "health endpoint returns 200" check, accepts the three of R15 and records `env: release`, `env_source: default`.
- AC8. `deployed --from-tag v1.1.0` records the workflow run time with `time_source: tag-push-run`; with that source stubbed away it records the tagger date; with no flag and no `--deployed-at` it refuses.
- AC9. `protection` answers `yes`, `no` and `unknown` for stubbed ruleset, empty and 403 answers.
- AC10. The routing, version-bump, hook-loading and Codex parity checks pass; `node tests/check.mjs`, the unit tests and strict validation pass.
- AC11. `grep` over the diff finds no em dash, no Oxford comma and no name of the maintainer.

## Out of scope

As the intent: publishing packages and GitHub release notes beyond the changelog.
Also: creating or changing tag protection rules, per-plugin manifest readers for `plugin.json`, signing tags and a changelog generator.
