# ADR-0025: A release version is proposed from intent kinds, agrees with the manifest and the changelog and post-deploy checks follow the target kind

Date: 2026-11-03

## Status

proposed

Decided by: the maintainer.
Source: intent/2026-11-03-release-versioning/ (spec R1 to R24).

## Context

The factory merges changes but never records whether each is a feature, a fix or breaking, so `/pro-ship:ship` cannot say what version a release is.
The first release on the demo asked the person to pick a base commit from hashes, told the person to tag a version that already existed and left a library deploy partial over four server checks that cannot apply.
The agent-skills baseline covers semantic versioning, the tag as the source of truth and a human changelog; pro-ship took none of it and did not write down why.

## Decision

The next version is proposed by `ship.py version` from the kinds of the intents in the range: a breaking change is major, a feature (`idea` or `change`) minor and a fix (`bug`) patch.
An intent records `breaking: true | false` beside `kind:`; a missing value is unknown and is assumed breaking until the person answers.
With no release tag the declared manifest version (package.json, pyproject.toml, Cargo.toml) is offered as the first release.
The tag is the source of truth for the last version and stays a person's step; `/ship` prints the command and never runs it.
The manifest is bumped in the release change by `ship.py prepare` and `--agree` proves tag, manifest and changelog agree.
A human changelog entry is written under Unreleased in the same change as the work; a generated changelog is detected and never edited.
`/pro-ship:deployed` takes its checks from the target kind: a tag-release, publish or desktop target gets tests on a clean checkout of the tag, a run of the documented use and a rollback dry run and is refused health, error rate, latency and log checks.
A deploy record's time and environment come from the deploy and carry a `time_source`; the time a record is written is never the deploy time.

## Consequences

A release has a version a person can accept in one sentence and a changelog that was written when the impact was fresh.
Intents gain one field and old intents read as unknown until answered.
The deploy record keeps schema 1 and gains optional keys.
Reverse this if intents stop being the unit of change or if releases move to a generator that owns the version.

## Alternatives considered

- Derive the version from the tag and never edit the manifest: package registries read the manifest inside the artifact.
- Let `/ship` create the tag: a pushed tag is consumed by others and cannot be taken back.
- Bump from Conventional Commit subjects: pull request merges do not keep them reliably.

## Where it is enforced

`plugins/pro-ship/scripts/ship.py` (`version`, `changelog`, `prepare`, `checks`, `protection`, `deployed`) and `tests/ship-version.mjs` and `tests/ship-deploy.mjs`.
Not enforced yet for the `breaking:` field in intents.
