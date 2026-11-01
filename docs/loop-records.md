# Loop records after the build

This page is the one contract for the four records the loop writes after a build: the deploy record, the incident record, the review lesson and the visual check.
mieruka and any other reader build against this page.
The decision behind it is [ADR-0023](./decisions/0023-loop-records.md).
The spec is `intent/2026-11-01-after-build-loop/spec.md`.
The preflight record that comes before a deploy has its own page, [ship-preflight.md](./ship-preflight.md).
Nothing here changes it.

Status: draft until the build merges; field names and kinds are fixed now so readers can start.

## Shared rules

Every record is a mieruka evidence manifest as it is.
These fields are present in every record:

| Field | Type | Rule |
|---|---|---|
| `schema` | integer | `1`; mieruka ignores it |
| `evidence_key` | string | unique per record, made only of `a-z`, `0-9` and `-`, never starting with `-` or `.` |
| `kind` | string | one of mieruka's six kinds; each record below names its own |
| `artifact_kind` | string | names the record type, so a reader filters on it |
| `artifact_key` | string | what the record is about, named per record below |
| `status` | string | `pass`, `fail`, `partial` or `info`, the four mieruka accepts |
| `summary` | string | one line for a person |
| `detail_json` | string | a JSON-encoded string, never an object |
| `produced_by` | string | `<plugin>:<command>@<version>`, the version read from the plugin's `.claude-plugin/plugin.json` |

Readers ignore fields they do not know.
An added optional field does not change `schema`.
Shas are 40 lowercase hex characters.
Timestamps are ISO 8601 with an offset.

### Where records land

Each writer keeps its own copy under `.pro-dev/`, which is listed in the file `git rev-parse --git-path info/exclude` names, so writing a record never changes the tree.
The mieruka drop is the rule from [ship-preflight.md](./ship-preflight.md#the-mieruka-drop): when `.mieruka/` exists at the repo root, nothing under `.mieruka/evidence/<evidence_key>/` is tracked and `git check-ignore` reports `.mieruka/evidence/<evidence_key>/evidence.json` as ignored, the writer also writes the manifest there.
Otherwise it writes nothing there and prints why.

## The deploy record

Written by `ship.py deployed` after a deploy happened; it never runs a deploy.

| Field | Value |
|---|---|
| `kind` | `deploy` |
| `artifact_kind` | `deploy` |
| `artifact_key` | the target `id` from the Ship block or detection |
| `evidence_key` | `deploy-<target id>-<first 12 of commit>-<UTC time as YYYYMMDDTHHMMSSZ, lowercased>` |
| `status` | `pass` when the deploy succeeded and every post-deploy check passed; `partial` when it succeeded and a check is a `finding` or still `confirm`; `fail` when the deploy failed or was rolled back |
| `summary` | starts with the env and the result, for example `production: deployed 3f2a9c1b4d5e, 1 check to confirm` |
| `head` | top-level, the full sha that was deployed |

Local copy: `.pro-dev/ship/deploys/<evidence_key>.json`, one file per deploy; nothing is pruned.

`detail_json` holds:

| Key | Type | Value |
|---|---|---|
| `target` | string | the target `id` |
| `target_kind` | string | the target `kind`, for example `deploy-on-merge` |
| `env` | string | `production`, `staging`, `preview` or another name the person gives |
| `url` | string or null | the deployed URL |
| `commit` | string | the same sha as `head` |
| `deployed_at` | string | when the deploy finished |
| `created` | string | when the record was written |
| `source` | string | `manual` when the person gave the facts, `github` when they came from a GitHub deployment |
| `outcome` | string | `succeeded`, `failed` or `rolled-back` |
| `preflight` | object | `{state, evidence_key}`: `state` is `fresh`, `missing`, `unreadable`, `stale` or `no-go` by the freshness rule in ship-preflight.md for `commit`; `evidence_key` is the preflight's key or null |
| `checks` | array | `{item, status, evidence}`; `status` is `pass`, `finding` or `confirm` |
| `rollback` | object or null | `{triggers, steps, rto}` copied from the target |

mieruka's deploy panel reads `url`, `env` and `commit`, so those keep these names.

## The incident record

The record of an incident is a tracked file, `intent/<YYYY-MM-DD>-<slug>/incident.md`, beside the new `intent.md` it starts.
The intent's frontmatter says `source: incident <id>` and `kind: bug`.
`incident.py record <intent dir>` reads the file's frontmatter and writes the manifest.

| Field | Value |
|---|---|
| `kind` | `doc` |
| `artifact_kind` | `incident` |
| `artifact_key` | the intent folder name, for example `2026-11-02-checkout-500s` |
| `evidence_key` | `incident-<intent folder name>` |
| `status` | `fail` while `open`, `partial` once `mitigated`, `pass` once `resolved` |
| `summary` | starts with the severity and state, for example `sev2 mitigated: checkout returned 500 for 40 minutes` |

Local copy: `.pro-dev/incidents/<evidence_key>.json`, rewritten each time the record is written again.

The frontmatter of `incident.md`:

| Key | Value |
|---|---|
| `id` | the intent folder name |
| `state` | `open`, `mitigated` or `resolved` |
| `severity` | `sev1` or `sev2`, the two levels the observability checklist allows |
| `detected` | when it was noticed |
| `resolved` | when it was resolved, or empty |
| `commit` | the full sha that was running, or empty when unknown |
| `deploy` | the deploy record's `evidence_key`, or empty |
| `regression_test` | the path of the test that reproduces it, or empty until it exists |

`detail_json` holds those keys plus `intent` (the folder path) and `created`.

## The review lesson

Written by `lessons.py` when `/review` sees the same class of finding on a second change.

| Field | Value |
|---|---|
| `kind` | `review` |
| `artifact_kind` | `review-lesson` |
| `artifact_key` | the finding class, a kebab-case slug such as `unchecked-subprocess-timeout` |
| `evidence_key` | `review-lesson-<class>` |
| `status` | `info` while `proposed`, `pass` once `accepted`, `partial` once `declined` |
| `summary` | the proposed agent-file line |

Local copies: the finding ledger `.pro-dev/review/findings.jsonl` (one line per finding, never read by mieruka) and `.pro-dev/review/lessons/<evidence_key>.json`.

`detail_json` holds `class`, `state` (`proposed`, `accepted` or `declined`), `line` (the proposed text), `file` (`CLAUDE.md` or `AGENTS.md`), `seen` (a list of `{ref, head, file, claim}` for each change the class was found on) and `created`.

## The visual check

Written by `visual.py record` when `/execute` compares a UI step with the mock the plan names.

| Field | Value |
|---|---|
| `kind` | `visual_drift` |
| `artifact_kind` | `ui-step` |
| `artifact_key` | the intent folder name |
| `evidence_key` | `visual-<intent folder name>-step-<n>-<viewport>` |
| `status` | `pass` when the screenshot matches the mock, `partial` when it differs in ways the plan allows, `fail` when it does not match, `info` when it could not run |
| `summary` | the step, the viewport and the result |

Local copy: `.pro-dev/visual/<evidence_key>.json`, with the screenshot beside it as `<evidence_key>.png`.

`detail_json` holds `step` (the plan step number), `title`, `viewport` (`desktop` or `mobile`, with its width), `mock` (the path or URL in the plan), `screenshot` (the PNG's path relative to the repo root), `url` (the page captured), `console` (`{errors, warnings}` counts), `differences` (a list of strings), `head` and `created`.

## Checking against mieruka

`tests/mieruka-sync.mjs` loads one record of each type with mieruka's own `syncFromFilesystem`, as it does for the preflight.
Run it after any change to this page.
