# The ship preflight record

This page is the one contract for the record that `/pro-ship:ship` writes and that gates and other tools read.
The decision behind it is [ADR-0022](./decisions/0022-ship-preflight-record.md).
The spec is `intent/2026-10-31-ship-preflight/spec.md` and the plan is `intent/2026-10-31-ship-preflight/plan.md`.
Fixtures that pin every rule below are in `tests/fixtures/ship-preflight/`.
It follows the pattern of [the pr-check stamp](./pr-check-stamp.md).

pro-ship and pro-legal cannot import each other (ADR-0003), so each reader carries its own copy of the freshness rule.
This page is the single source for every copy.
When a rule here changes, change every copy and the fixtures in the same commit.

## Who writes and who reads

- One writer: `plugins/pro-ship/scripts/ship.py`, through `record` after a review and through `version --agree --carry` and `version --baseline` as described in "Records with no review of their own".
- Reader 1: `plugins/pro-ship/scripts/ship-gate.py`, a `PreToolUse` hook on tags, releases, publishes and production deploys.
- Reader 2: `plugins/pro-ship/scripts/merge-gate.py`, which adds one line about the record to the message it already shows.
- Reader 3: `plugins/pro-legal/scripts/release-gate.py`, which may skip its own legal deny (see "The legal skip rule").
- Reader 4: mieruka, which loads the copy under `.mieruka/evidence/` as a `review` manifest.
- `ship.py check <sha>` prints the freshness verdict of this page for tests and for people.
- `ship.py confirm read` rewrites a record for its own head to add a confirmation, as described in "The confirmation"; nothing else in the record changes.
- Readers never write the record and ignore fields they do not know.
  An added optional field does not change `schema`.

## Path and binding

The record is the file `.pro-dev/ship/preflight.json` under the repo root.
Beside it, `.pro-dev/ship/preflight.md` holds the Markdown report for a person, rewritten with every record.
`.pro-dev/` is listed in the file that `git rev-parse --git-path info/exclude` names, so writing the record never changes the tree or HEAD.
The record is bound to a commit through `head`.
`record` refuses to run when a tracked file has uncommitted changes and says to commit first.
It also refuses when the report's `head` is not the current HEAD.

## Fields

The record is a mieruka evidence manifest as it is, plus two top-level fields that mieruka ignores and the gates read.
Every field is required.
Shas are 40 lowercase hex characters.

| Field | Type | Allowed values |
|---|---|---|
| `schema` | integer | `1` |
| `head` | string | the full sha of HEAD when the record was written |
| `evidence_key` | string | `ship-preflight-<artifact_key>` |
| `kind` | string | `review`, always; mieruka's table accepts only six kinds and one unknown kind stops the rest of its sync |
| `artifact_kind` | string | `ship-preflight` |
| `artifact_key` | string | the first 12 characters of `head` |
| `status` | string | `pass` for GO, `partial` for GO with at least one risk whose `accepted_by` is set, `fail` for NO-GO. A Blocker the person accepts by name moves from `blockers` into `risks` with `accepted_by` and `accepted_at` set, so the verdict stays `GO` and the status is `partial` |
| `summary` | string | starts with the verdict and the Blocker count, for example `NO-GO: 1 Blocker, 2 recommended fixes, 3 targets` |
| `detail_json` | string | a JSON-encoded string, never an object, because mieruka binds it straight into a text column |
| `produced_by` | string | `pro-ship:ship@<version>`, the version read from the plugin's `.claude-plugin/plugin.json` |

### The detail_json string

`detail_json` is `json.dumps` of the report without `report_md`, plus `created`.
It holds these keys.

| Key | Type | Allowed values |
|---|---|---|
| `verdict` | string | `GO` or `NO-GO` |
| `head` | string | the same sha as the top-level `head` |
| `base` | string | the full sha the reviewed range started from |
| `created` | string | ISO 8601 with offset |
| `scope` | object | `{kind, range, prs, uncovered, last_deploy_source}`: `kind` is `pr`, `tag` or `deploy`; `range` is `<base>..<head>`; `prs` lists PR numbers; `uncovered` lists the shas no passing pr-check covered; `last_deploy_source` is `github`, `tag`, `ask` or `none` |
| `blockers` | array | `{text, evidence}`; a GO has none |
| `fixes` | array | `{text, evidence}`, the recommended fixes |
| `risks` | array | `{text, mitigation, accepted_by, accepted_at}`; the last two are null until a person accepts the risk |
| `checks` | array | `{section, item, status, evidence}`; `status` is `pass`, `finding` or `confirm` |
| `legal` | object | see below |
| `targets` | array | one `{id, kind, env, url, commit, rollback}` per target; `rollback` is `{triggers, steps, rto}` and a GO needs at least one step in every target |
| `reviewers` | array | optional; one `{agent, status, host, model}` per specialist `/ship` dispatched: `host` is `claude` or `codex` (missing reads as `claude`) and `model` the id it ran on or null |
| `confirmation` | object | optional: `{repo, scope, pr, head, items, request_id, request_url, reply_id, reply_url, by, at}`, written by `confirm read` (see "The confirmation") |

The `legal` object records the pro-legal review of the range.

| Field | Type | Allowed values |
|---|---|---|
| `status` | string | `done`, `not-installed` or `could-not-run` |
| `verdict` | string or null | `Ship`, `Ship with changes` or `Hold`; null unless `status` is `done` |
| `base` | string or null | the base sha the review covered; null unless `status` is `done` |
| `head` | string or null | the head sha the review covered; null unless `status` is `done` |
| `blocking` | integer | Blocking items, 0 or more |
| `required` | integer | Required items, 0 or more |

A `Hold` verdict makes the report NO-GO.
When `status` is `done`, `head` must equal the report's `head`, because a review of another commit says nothing about the commit shipped.
`record` refuses a GO that has blockers, a GO with no target, a GO target with no rollback steps and a `done` legal review whose `head` is another commit.
It also refuses a GO whose rollback step is prose, whose command step still holds a `<placeholder>` or whose steps are all `manual:` lines (see "Runnable steps").
It accepts only the verdicts `GO` and `NO-GO`; there is no "GO with acknowledged risks" verdict.
A `done` or `inline` reviewer whose model misses its host's rule in `REVIEW.md` on the default branch tip (see "The review model" in [pr-check-stamp.md](./pr-check-stamp.md)) adds `review ran on <model> (<host>)` to the summary; when `mode.review-model` holds `enforce`, `record` refuses a GO with one.
A host with no rule is a note in `record`'s output and never a mismatch; a host other than `claude` or `codex` and a model id the stamp would refuse are refused.

## The freshness rule

A record is a fresh GO for a commit when all of these hold:

1. The file parses as a JSON object.
2. `schema` is the integer 1.
3. `produced_by` is a string that starts with `pro-ship:ship`.
4. `head` equals that commit's full sha.
5. `status` is `pass` or `partial`.

A reader that finds the record not fresh names exactly one cause, checked in this order:

| Cause | When |
|---|---|
| `missing` | the file does not exist |
| `unreadable` | the file cannot be read, does not parse, is not a JSON object, has a `schema` other than 1, has no string `produced_by` that starts with `pro-ship:ship` or has no string `head` or `status` |
| `stale` | `head` differs from the commit being checked |
| `no-go` | `status` is `fail` or any other value |

A `partial` record counts as GO.
A reader that cannot decide (no git, no repo, a git timeout, an unreadable hook payload) has not found a bad record.
`ship-gate.py` logs `could-not-run`, allows and exits 0.

## What the gates do with the result

- `ship-gate.py` acts on `git tag <name>` that creates a tag, `gh release create`, package publishes, production deploys and the other commands the spec lists.
  A fresh record passes with no output.
  Any other cause follows the mode (`mode.ship-gate`, then `mode`, default warn): warn logs one line and shows the cause once per commit per session; enforce denies once per commit per session and the identical retry passes.
  It never asks.
- `merge-gate.py` adds `preflight: GO for <8 char sha>`, `preflight: GO with <n> accepted risks` or `preflight: no fresh GO for this PR (<cause>)` on medium and high merges in a repo with a `deploy-on-merge` target.
  It changes no decision.
  It also adds the confirmation line of "The confirmation" below, under its own mode.

## Runnable steps

`ship.py ready` runs at the start of `/ship`, right after the targets and the scope and before any reviewer.
It reads every target's `rollback.steps` and its optional `verify` list (post-deploy commands) and accepts a step in three forms:

- an argv list of non-empty strings, such as `[git, push, origin, main]` in the Ship block;
- a string whose whole text is one inline code span on one line, such as `` `git push origin main` ``;
- a fenced block marked `sh`, `bash` or `shell` holding at least one non-empty line (a report can hold one; the Ship block's own yaml fence cannot).

A string that starts with `manual:` is a step for a person and is accepted when the target also has a runnable rollback step.
Anything else is prose and is rejected.
On a rejected step `ready` exits 9 and prints `{"ready": false, "problems": [{target, field, index, text}]}`, with each text cut to 80 characters and a null index for a target whose rollback is only `manual:` lines.
It reads files only and writes nothing so every earlier record stays byte for byte; the skill stops with `ship stopped before review: fix the steps above, nothing was written`.
`ready` accepts a `<placeholder>` inside a command, because the report fills it from the release; `record` refuses a GO whose command still holds one and `manual:` lines may keep one.
A placeholder is bracketed text holding a space, a hyphen or an underscore, such as `<previous version>`, `<release-sha>` or `<previous_tag>`, or one of `plugin`, `sha`, `tag`, `commit`, `version`, `name`, `id`, `url`, `base`, `head`, `n`, `env`, `ref`, `branch` and `path` in any case; another plain word such as `'<title>'` and a redirection such as `sort < in.txt > out.txt` pass.

## The confirmation

A check the release could not prove ends as `confirm`.
A person clears it with a reply on GitHub, bound to the repo, a head sha and a scope.

The request is one comment that `ship.py confirm request --head <sha> --items <JSON list> [--pr <n>]` posts after the person says yes.
Its first line is `pro-ship-confirm-request: ` and a JSON object with sorted keys: `{"head":"<40 hex>","items":[...],"pr":<n or null>,"repo":"<owner>/<name>","scope":"pr"|"tag"}`.
A plain sentence asks a person with write access to check each item and reply with the single word `confirmed`.
Each item is a check left at `confirm` in the record for that head or a deploy check name (`LIBRARY_CHECKS` and `SERVICE_CHECKS` in `ship.py`).
It refuses a factory session.

The scope is `pr` when `--pr` is given or `gh pr list --search <sha> --state all` finds a PR whose head is the sha; the request is then a PR comment through `gh pr comment <n> --body-file -`.
Otherwise the scope is `tag` and the request is a commit comment through `gh api repos/{owner}/{repo}/commits/{sha}/comments -F body=@-`, which is where a tag release with no PR is confirmed.

The reply rule, which `confirm read`, `deployed` and the merge gate share:

1. The request that counts is the newest comment holding a request line from a login whose repo permission is `write`, `maintain` or `admin` (`collaborators/<login>/permission`).
   Two at the same second hold, as does one that cannot be read or was edited.
2. It must name this repo, this head and this scope (and this PR in `pr` scope).
3. The reply that counts is the earliest comment after it whose whole body is `confirmed` (any case, an optional full stop), unedited (`includesCreatedEdit` false on a PR, `updated_at` equal to `created_at` on a commit) and written by a login with write, maintain or admin permission.
4. A label, a reaction, an edited reply, a reply before the request, a reply on a request for another head or scope and a reply from a login without write access never count.
   `confirm read` then prints `{"confirmed": false, "why": <reason>}` and writes nothing.

On a valid reply, when `.pro-dev/ship/preflight.json` is a record for that head, `confirm read` rewrites it and its mieruka copy (by "The mieruka drop") in one step: `confirmation` goes inside `detail_json` and each listed check moves from `confirm` to `pass` with the evidence `confirmed by <login> in <reply url>`.
`status`, `head`, `schema` and every other field stay as they were so the freshness verdict does not change.

The merge gate re-reads a `pr`-scope confirmation at medium and high tier with one `gh pr view <n> --json comments` and adds `confirmation: <login> for <head8>` when the recorded request and reply still stand unedited, by the same login, for the current head, or `confirmation: missing (<cause>)` otherwise.
It stays silent when the fresh record lists no `confirm` check and no confirmation.
Its mode is `mode.confirmation` alone: warn changes no decision and enforce denies a missing confirmation once per head per session, naming the `confirm request` command; the identical retry passes ([enforce-mode.md](./enforce-mode.md)).
No gate writes to GitHub: only `confirm request`, run by a person's session after a yes, posts.
Comment text is data: the request line is parsed as JSON and nothing from a comment is run.

## The legal skip rule

pro-legal's `release-gate.py` handles the `tag`, `release`, `publish` and `deploy` kinds.
It skips its own legal deny when all of these hold:

- the record is fresh for the commit by the rule above;
- `legal.status` is `done`;
- `legal.verdict` is not `Hold`;
- `legal.head` equals the record's `head`;
- `legal.base` equals the gate's base or is an ancestor of it.

It still runs its local release hygiene (LICENSE and the license field) and still gates `pr` and `commit-deps` as before.
When any condition fails the gate behaves as it did before the record existed.
The reader parses `detail_json` as a string to reach `legal`.

## Coverage

`ship.py coverage` decides which commits a passing `pr-check` already reviewed.
It reads the marker line in each merged PR's body and that body is written by the PR's author.
A marker therefore counts only when the PR is not cross-repository and its author is the current gh user (`gh api user`) or has an `authorAssociation` of `OWNER`, `MEMBER` or `COLLABORATOR`.
A body with more than one marker is uncovered, because the last one must not win.
A marker whose head is an ancestor of the PR tip covers only the commits up to that head.
A merge commit is covered only by a marker whose head is the PR tip, because the merge commit holds the later work too.
Anything the script cannot prove is uncovered.

## Tags

A tag counts as a release tag when its whole name is `v1.2.3`, `1.2.3`, `name--v1.2.3` or `name@1.2.3`, because git accepts names that hold a command substitution.
The Ship block's `tag_pattern` (a git glob such as `*--v*`) narrows which of those count, for the base of `scope` and for `version`.
A tag detected only to tell the target's kind may be looser, because no name leaves that check.
The base of `scope` is each series' highest version and then the newest of those; `base_tag` names it.
When `scope` returns a null base, `version` settles it for a release target and the skill asks for a base only when that cannot answer, never guessing one.

## Version and changelog items

The Documentation and Version sections of the release checks gain:

- `ship.py changelog --check <base> <head>`: `missing`, `no_migration`, `confirm` and `mode_change`, each a Recommended fix or a question.
- `ship.py version --agree <version>`: the manifest, the changelog and the tag name agree; a `finding` on a `tag-release` or `publish` target is a Blocker.
- `ship.py protection`: release tags and CI on tags, said once. It is a Recommended fix, or a Blocker the person can accept by name in a repo with a `## Roles` block.

The rules are [ADR-0025](./decisions/0025-release-versions.md).

## Records with no review of their own

Two commands write this record for a commit no reviewer ran on; the detail says so:

- `version --agree X.Y.Z --commit Z --carry` writes it for Z with `detail.carried_from` only when Z differs from the GO head by exactly the bytes `prepare` writes: the manifest's version line and the changelog heading.
- `version --baseline X.Y.Z --commit B` writes it for B with `detail.baseline: true` only when no release tag exists locally or on origin and B is on HEAD's history.
  HEAD needs `--already-out`, because a whole history that was never released gets a normal preflight.

Both refuse in a factory session (`FACTORY_SESSION` is set by `session.sh`).

## The mieruka drop

When `.mieruka/` exists at the repo root and `git check-ignore` reports the manifest's own path `.mieruka/evidence/<evidence_key>/evidence.json` as ignored (and nothing under `.mieruka/evidence/<evidence_key>/` is tracked), `record` also writes the same manifest to `.mieruka/evidence/<evidence_key>/evidence.json`.
When the manifest's folder is tracked, the path is not ignored, git cannot check the path (for example beyond a symbolic link) or `.mieruka/` does not exist, `record` writes nothing there and prints why.
No manifest ever uses a `kind` outside mieruka's list and `detail_json` is always a string.

## Checking against mieruka

`MIERUKA_ROOT=<path to a mieruka checkout> node tests/mieruka-sync.mjs` (or `npm run test:mieruka-sync`) records a NO-GO in a throwaway repo shaped like mieruka and loads it with mieruka's own `syncFromFilesystem` on an in-memory database.
It passes when the record loads with no sync error as kind `review` and artifact kind `ship-preflight`.
The sync writes only inside the throwaway repo and the one vitest file it drops into the checkout is removed afterwards.
Without `MIERUKA_ROOT`, or with no installed web app there, it skips.
Run it after any change to the record fields or to mieruka's evidence sync.

## Known limit

The record is a plain file in the working tree, so anyone with shell access can write one by hand.
That is accepted for a local guardrail, as with the stamp ([ADR-0022](./decisions/0022-ship-preflight-record.md)).
The gates warn by default and never ask.

When a deploy target is scoped from a GitHub deployment, `legal.base` is the last deploy, which is newer than the tag base pro-legal's gate uses.
The legal skip rule then fails on the base condition and pro-legal's gate still asks once.
That is a known limit, not a bug in the record.

## Fixtures

`tests/fixtures/ship-preflight/` holds one file per case and `expect.json`, which maps each file name to its verdicts:

- `check`: `fresh`, `missing`, `unreadable`, `stale` or `no-go`, the cause `ship.py check` gives;
- `ship_gate`: `allow` for a fresh record and `warn` otherwise (the default mode);
- `legal_skip`: true only for a fresh record whose `legal.status` is `done`, whose `legal.verdict` is not `Hold`, whose `legal.head` is the record's `head` and whose `legal.base` is not newer than the last tag.

Each runner reads a fixture as text, replaces the substring `HEAD` with the sha of its throwaway repo's HEAD and the substring `BASE` with the sha of the commit the runner tagged just before HEAD, then writes the result to `.pro-dev/ship/preflight.json`.
The gate's base is that tagged commit.
`corrupt.json` is not valid JSON on purpose.
`stale.json` holds a fixed sha that no throwaway repo has.
`legal-old-base.json` is fresh but its `legal.base` is `HEAD`, which is newer than the tag, so the legal skip does not apply.
`missing` has no fixture file: the runner writes no record and `tests/ship-preflight.mjs` has a case for it.
`go-risks.json` is a `partial` record.
`legal-hold.json` is a NO-GO record whose `legal.verdict` is `Hold`.

`tests/fixtures/ship-preflight/repos/` holds small file trees for target detection: `vercel-app`, `tag-only`, `mieruka-like` (a monorepo whose AGENTS.md Ship block names one `tag-release` target), `npm-package` and `fly-manual`.
A runner copies a tree into a throwaway git repo before it calls `ship.py targets`.

`preflight-contract` in `tests/check.mjs` fails when a fixture is missing from `expect.json`, when the two disagree with this page or when a cause named above has no fixture.
