# Loop records after the build

This page is the one contract for the six records the loop writes: the deploy record, the incident record, the review lesson, the review round, the visual check and the factory run record.
mieruka and any other reader build against this page.
The decision behind it is [ADR-0023](./decisions/0023-loop-records.md).
The spec is `intent/2026-11-01-after-build-loop/spec.md`.
The preflight record that comes before a deploy has its own page, [ship-preflight.md](./ship-preflight.md).
Nothing here changes it.

Status: in use since pro-ship 0.11.0 and pro-ai-sdlc 0.13.0; the factory run record since pro-ai-sdlc 0.14.0; the review round since pro-ai-sdlc 0.19.0.

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
The time the record is written is never the deploy time, so a record with no time is refused.

| Field | Value |
|---|---|
| `kind` | `deploy` |
| `artifact_kind` | `deploy` |
| `artifact_key` | the target `id` from the Ship block or detection |
| `evidence_key` | `deploy-<target id>-<first 12 of commit>-<UTC time as YYYYMMDDTHHMMSSZ, lowercased>` |
| `status` | `pass` when the deploy succeeded and every post-deploy check passed; `partial` when it succeeded and a check is a `finding` or still `confirm` or when `--from-tag` ran with no checks; `fail` when the deploy failed or was rolled back |
| `summary` | starts with the env and the result, for example `production: deployed 3f2a9c1b4d5e, 1 check to confirm` |
| `head` | top-level, the full sha that was deployed |

Local copy: `.pro-dev/ship/deploys/<evidence_key>.json`, one file per deploy; nothing is pruned.

`detail_json` holds:

| Key | Type | Value |
|---|---|---|
| `target` | string | the target `id` |
| `target_kind` | string | the target `kind`, for example `deploy-on-merge` |
| `env` | string | the name the person gives, else the target's `env`; a `tag-release`, `publish` or `desktop` target with neither records `release` |
| `env_source` | string | `given`, `target` or `default`, optional |
| `url` | string or null | the deployed URL |
| `commit` | string | the same sha as `head` |
| `deployed_at` | string | when the deploy finished |
| `time_source` | string | where that time came from: `github-deployment`, `release`, `tag-push-run`, `tagger-date`, `commit-date`, `given` or `github`, optional |
| `created` | string | when the record was written |
| `source` | string | `manual` when the person gave the facts, `github` when they came from a GitHub deployment, `tag` when they came from a release tag |
| `outcome` | string | `succeeded`, `failed` or `rolled-back` |
| `preflight` | object | `{state, evidence_key}`: `state` is `fresh`, `missing`, `unreadable`, `stale` or `no-go` by the freshness rule in ship-preflight.md for `commit`; `evidence_key` is the preflight's key or null |
| `checks` | array | `{item, status, evidence}`; `status` is `pass`, `finding` or `confirm` |
| `rollback` | object or null | `{triggers, steps, rto}` copied from the target |

mieruka's deploy panel reads `url`, `env` and `commit`, so those keep these names.
`env_source` and `time_source` are optional additions, so `schema` stays 1.

The checks follow the target's kind (`ship.py checks --target <id>`):

| Kind | Checks |
|---|---|
| `tag-release`, `publish`, `desktop` | tests on a clean checkout of the tag, the documented use runs and a rollback dry run; a health, error rate, latency or log check is refused |
| `deploy-on-merge`, `manual-deploy` | health, error rate, latency, the critical user flow, logs and the rollback mechanism |

## The incident record

The record of an incident is a tracked file, `intent/<ID>-<slug>/incident.md` (or `intent/<YYYY-MM-DD>-<slug>/incident.md` in a repo with no `intent/project.json`), beside the new `intent.md` it starts.
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

## The review round

Written by `lessons.py round` once per review round, after the round's grades and new findings are in the findings table.
`/review` and `/ship` both write it.
The decision behind it is [ADR-0027](./decisions/0027-review-memory.md).

| Field | Value |
|---|---|
| `kind` | `review` |
| `artifact_kind` | `review-round` |
| `artifact_key` | the ref of the findings table: a branch name, `pr-<number>` or `ship-<first 12 of the merge base>` |
| `evidence_key` | `review-round-<first 12 of head>-<round>-<first 8 hex of the SHA-1 of the ref>`; the ref hash keeps a branch review and a `/ship` run at the same head and round apart |
| `status` | `fail` when any Important row is `open` or `not fixed`, `pass` otherwise |
| `summary` | the round, the Important rows still open or not fixed, the fixed rows and whether the fresh pass ran |

Local copies: `.pro-dev/review/rounds/<evidence_key>.json` and the findings table `.pro-dev/review/<key>.json`, where `<key>` is the ref with every `/` written as `--`.
mieruka never reads the table.

`detail_json` holds:

| Key | Type | Value |
|---|---|---|
| `ref` | string | the same ref as `artifact_key` |
| `base` | string | the merge base the round reviewed from |
| `head` | string | the head the round reviewed |
| `round` | integer | the round number, 1 or more |
| `range` | string | `<base>..<head>` |
| `fresh` | string | `ran` when the fresh pass ran, `skipped` when an unfixed Important row stopped it |
| `counts` | object | rows by status: `open`, `fixed`, `not_fixed` and `no_longer_applies` |
| `findings` | array | `{id, file, line, class, severity, status}` per row; never the claim |
| `created` | string | when the record was written |

A row of the findings table holds `id`, `file`, `line`, `pass`, `class`, `severity` (`important`, `nit` or `pre-existing`), `claim` (one sentence of at most 300 characters), `status` (`open`, `fixed`, `not fixed` or `no longer applies`), `raised_at`, `graded_at`, `evidence` (`path:line` or null) and `reopened_from`.
The claim stays in the local table and never reaches the record.

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

`detail_json` holds `step` (the plan step number), `title`, `viewport` (an object `{name, width}`: `desktop` at 1280 or `mobile` at 390), `mock` (the path or URL in the plan), `screenshot` (the PNG's path relative to the repo root), `url` (the page captured), `console` (`{errors, warnings}` counts), `differences` (a list of strings), `head` and `created`.

## The factory run record

Written by `factory.py` when it runs an accepted level 1 intent headless, and by nothing else: the session inside the container never writes it.
The decision behind it is [ADR-0024](./decisions/0024-escalation-levels.md).

| Field | Value |
|---|---|
| `kind` | `doc` |
| `artifact_kind` | `factory-run` |
| `artifact_key` | the intent folder name, for example `2026-11-03-fix-greeting` |
| `evidence_key` | `factory-<intent folder name>` |
| `status` | `info` while running, `pass` once merged, `partial` when the run stopped and the level was raised, `fail` on an error |
| `summary` | `level 1: merged <first 12 of sha>, deploy is yours, unread diff: <n> lines`, `stopped: level raised to <n> (<reason>)`, `error: <reason>` or `running: <state>` |

Local copy: `.pro-dev/factory/<evidence_key>.json`, rewritten on every state change.
The runner's daily counters (`daily.json`) and per-intent lock and log files sit beside it and are not records.

`detail_json` holds:

| Key | Type | Value |
|---|---|---|
| `intent` | string | the intent folder path |
| `level_at_intake` | integer | `1`, the level the run started at |
| `level_now` | integer | the level after the run; above `1` when a host check raised it |
| `state` | string | `queued`, `brief`, `build`, `verify`, `merged`, `stopped` or `error` |
| `reason` | string | why it stopped or failed, empty otherwise |
| `brief_pr` | integer | the number of the PR that holds the spec and plan, once opened |
| `build_pr` | integer | the number of the build PR, once opened |
| `merged_sha` | string | the merge commit of the build PR, once merged |
| `unread_lines` | integer | added plus removed lines of the merged build PR, which no person read |
| `cost_usd` | number | what the sessions have cost so far |
| `broad_token` | boolean | `true` when the run used the maintainer's own `gh` token through `--allow-broad-token` |
| `started` | string | when the run began |
| `updated` | string | when the record was last written |

mieruka's card reads `state`, `level_now` and `reason`, so those keep these names.

## Checking against mieruka

`tests/mieruka-sync.mjs` loads one record of each type with mieruka's own `syncFromFilesystem`, as it does for the preflight.
Run it after any change to this page.
