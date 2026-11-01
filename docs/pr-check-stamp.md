# The pr-check stamp

This page is the one contract for the stamp that `/pro-ship:pr-check` writes and that other hooks read.
The decision behind it is [ADR-0014](./decisions/0014-gate-stamp.md).
The spec is `intent/2026-10-29-pr-gate/spec.md` and the plan is `intent/2026-10-29-pr-gate/plan.md`.
Fixtures that pin every rule below are in `tests/fixtures/pr-check-stamp/`.

pro-ship and pro-security cannot import each other (ADR-0003), so each plugin carries its own copy of the validity rule.
This page is the single source for both copies.
When a rule here changes, change both copies and the fixtures in the same commit.

## Who writes and who reads

- One writer: `plugins/pro-ship/scripts/pr-check.py stamp`.
- Reader 1: `plugins/pro-ship/scripts/pr-gate.py`, a `PreToolUse` hook on `gh pr create`.
- Reader 2: `plugins/pro-security/scripts/push-gate.py`, through `read_stamp` in `security_surface.py`.
- Readers never write the stamp and ignore fields they do not know.
  An added optional field does not change `schema`.

## Path and binding

The stamp is the file `.pro-dev/ship/pr-check.json` under the repo root.
`.pro-dev/` is listed in the file that `git rev-parse --git-path info/exclude` names, so writing the stamp never changes the tree or HEAD.
The stamp is bound to a commit through `head`.
`stamp` refuses to run when a tracked file has uncommitted changes and says to commit first.

## Fields

Every field below is required unless the table says optional.
Counts are integers of 0 or more.
Shas are 40 lowercase hex characters.

| Field | Type | Allowed values |
|---|---|---|
| `schema` | integer | `1` |
| `head` | string | the full sha of HEAD when the stamp was written |
| `base` | string | the full sha of the merge base the review range started from |
| `created` | string | ISO 8601 with offset, for example `2026-10-30T09:15:00-04:00` |
| `tier` | string | `low`, `medium`, `high` or `unclassified`, see "The tier and risk fields"; no gate reads it |
| `checks` | array | zero or more check records, see below |
| `floor` | string | `pass`, `findings`, `could-not-run`, `not-installed` or `not-found` |
| `mutation` | object | `{status, reason, file, accepted}`, see below |
| `reviewers` | object | the keys `code`, `security` and `verifier`, plus an optional `codex`, see below |
| `result` | string | `pass`, `fail` or `incomplete` |
| `risk` | object | optional; `{tier, signals, declared, findings, tie}` from the classifier, plus `could_not_run: true` and `reason` when it could not run |
| `sources` | object | optional; `{"floor-guard": <path or "not-installed">}`, the path `pr-check.py find` used |

### The tier and risk fields

`pr-check.py stamp --risk <file>` copies the classifier's JSON (`plugins/pro-ship/scripts/risk-classify.py --json`) into the stamp.
`schema` stays 1, because the change adds a field and no gate reads `tier` for validity.

| `tier` | When it is written | How readers treat it |
|---|---|---|
| `low`, `medium`, `high` | the classifier ran and printed that tier | The tier of the change. The mutation check is skipped at `low` with reason `low tier` and runs at the others. |
| `high` with `risk.could_not_run` true | the classifier is installed but could not run (an empty range, no merge base, a git timeout) | Read as high. A run that could not classify is never low. `risk.reason` says why. |
| `unclassified` | the classifier is not installed, or the stamp was written before the classifier existed | No tier is known. Read it as unknown, not as low. The mutation check runs whenever non-test code changed. |

The `risk` object holds:

| Field | Type | Allowed values |
|---|---|---|
| `tier` | string | `low`, `medium` or `high`, the same as the top-level `tier` |
| `signals` | array | the classifier's records `{id, floor, strength, evidence, reason}` |
| `declared` | string | `low`, `medium`, `high` or `none`, the risk `REVIEW.md` or the intent declared |
| `findings` | array of strings | for example `risk-underdeclared: ...`; shown in the PR body and never fails the run |
| `tie` | array or null | `[top, one below]` when only weak signals set the top tier |

A stamp with no `risk` field is valid.
Readers ignore a `risk` field they do not know how to read.

### Check record

Each element of `checks` is one command that `run` executed or could not find.

| Field | Type | Allowed values |
|---|---|---|
| `step` | string | `build`, `lint`, `typecheck`, `test`, `check`, `verify` or `verify:<n>` where `<n>` counts from 1 |
| `command` | string or null | the exact command line; null when `status` is `not-found` |
| `status` | string | `pass`, `fail`, `timeout` or `not-found` |
| `exit_code` | integer or null | the process exit code; null for `timeout` and `not-found` |
| `output_tail` | array of strings | the last 20 lines of output, each with credential-shaped tokens replaced by `[redacted]`; empty for `not-found` |

### The mutation object

| Field | Type | Allowed values |
|---|---|---|
| `status` | string | `survived`, `killed`, `skipped` or `could-not-run` |
| `reason` | string or null | why it was `skipped` or `could-not-run` (`low tier`, `test-only diff`, `no condition found`, `no related tests`, `no runnable test command`); null for `survived` and `killed` |
| `file` | string or null | the repo-relative path whose condition was inverted; null when none was |
| `accepted` | boolean | `true` only when the person confirmed a `survived` result through `pr-check.py stamp --accept-mutation`; `false` otherwise |

### The reviewers object

`reviewers.code` and `reviewers.security` are each an object with these fields.

| Field | Type | Allowed values |
|---|---|---|
| `agent` | string or null | `pro-quality:code-reviewer`, `pro-ai-sdlc:reviewer` or `pro-security:security-architect`; null when `status` is `not-installed`, `skipped-no-surface` or `could-not-run` before dispatch |
| `status` | string | `done`, `inline`, `skipped-no-surface`, `not-installed` or `could-not-run` |
| `blocking` | integer | findings that block the merge, see the tally lines |
| `important` | integer | see the tally lines |
| `range` | string or null | `<base>..<head>` as handed to the reviewer; null when it was not dispatched |

`skipped-no-surface` is only valid for `security`.
`inline` means the host could not dispatch a subagent and the skill applied the reviewer's skill in the same session, with a context that was not fresh.
A reviewer that was not dispatched has `blocking` 0 and `important` 0.

### The verifier

`reviewers.verifier` is the independent verifier pass of `pro-ai-sdlc:verifier`.
`schema` stays 1.
A stamp written before the field existed has no `verifier` key and the readers ignore it because they read only `result`.
`stamp` writes the key every time: when the caller passes none it records `{"agent": null, "status": "could-not-run", "verdict": null, "head": null}`.

| Field | Type | Allowed values |
|---|---|---|
| `agent` | string or null | `pro-ai-sdlc:verifier` for `done`, which `stamp` requires; null otherwise |
| `status` | string | `done`, `not-installed` or `could-not-run` |
| `verdict` | string or null | `pass`, `fail` or `incomplete` from the report's last line; null when there was no verdict |
| `head` | string or null | the 40 lowercase hex sha from the report's first line, `HEAD: <sha>`; null when there was none |

`stamp` checks the record before it uses it:

- `head` must be 40 lowercase hex characters or null and is refused otherwise, before any git command sees it.
- A `done` record needs `agent` `pro-ai-sdlc:verifier`.
- `not-installed` is refused when `verifier_available` is true, so a session cannot declare a dispatchable verifier absent.
  The verifier is available when `pro-ai-sdlc` has `agents/verifier.md` as an in-place sibling or in an install record (project or local scope covering the repo, then user scope).
  The repo's own `plugins/` folder never counts, because it proves a file and not an install.
  An install that `enabledPlugins` sets to false is not available.
  Only two sources are read: `~/.claude/settings.json`, then the HEAD copy of the repo's `.claude/settings.json` (`git show HEAD:.claude/settings.json`), with the later one winning.
  The working copy and `.claude/settings.local.json` are ignored, so a session cannot disable the verifier by editing an untracked or uncommitted file.
  An absent key, a missing file and a git error all mean enabled.
- When `not-installed` is accepted because a setting disabled an install, the record carries `disabled_by` (`user settings` or `committed project settings`) so a reviewer can see it.
  The field is absent otherwise.

A verifier result counts for the stamp's HEAD when its `status` is `done` and either:

- its `head` equals HEAD; or
- its `head` is an ancestor of HEAD and every path in `git diff --name-status --no-renames <head> HEAD` starts with the top-level `intent/`.
  With rename detection off a rename shows as a delete and an add, so both the old and the new path must be under `intent/`.
  A symlink (mode 120000), a submodule entry (mode 160000) or a mode change in that diff voids the result.
  This keeps `/execute`'s last `plan.md` commit from voiding a verifier pass and nothing else.

The verifier's report begins with `HEAD: <sha>`, `Uncommitted tracked changes: none | <n> files` and `Untracked files not ignored: <n>`.
Uncommitted tracked changes make its verdict `incomplete`.
Untracked files can change what passes and the stamp does not see them, so CI stays the backstop.

### The codex reviewer

`reviewers.codex` is optional.
It records the Codex second review that `/pro-ship:pr-check` can run on a high-tier PR ([ADR-0018](./decisions/0018-codex-second-reviewer.md)).
It is informational: the result rule, the pr-gate and the push gate ignore it.
The `schema` stays 1.
When no Codex review was considered the stamp has no `reviewers.codex` key.

| Field | Type | Allowed values |
|---|---|---|
| `agent` | string or null | `codex:code-reviewer`; null when Codex did not run |
| `status` | string | `done`, `skipped`, `not-installed` or `could-not-run` |
| `reason` | string or null | why it was `skipped`, `not-installed` or `could-not-run` (`tier medium`, `not-opted-in`, `timeout`, `no tally line`); null for `done` |
| `blocking` | integer | always 0; `stamp` refuses a nonzero value, because a Codex finding never blocks the merge. Any other malformed record is written as `could-not-run` with the reason `malformed codex record` |
| `important` | integer | the `important` count of Codex's own tally line; 0 when it never started (the stamp does not check it against `status`) |
| `agreed` | integer | findings both reviewers raised at the same severity, from `pr-check.py agree` |
| `disputed` | integer | findings both reviewers raised at different severities, from `pr-check.py agree` |
| `range` | string or null | `<base>..<head>` as handed to Codex; null when it was not dispatched |

## The two tally lines

The skill reads a count from each reviewer's output and passes it to `stamp` through `--reviewers <json>`.
Each line has two spaces between its pairs.
Match it as a whole line.
When the line is missing or does not match, the reviewer's `status` is `could-not-run`.

Code reviewer, the first line of its report:

`important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>`

- `blocking` is `important`, because `REVIEW.md` says Important findings block the merge.
- `important` is `important`, the same number.
- `nits`, `pre-existing` and `skipped` are not recorded and never block.

Security reviewer (`security-architect` in diff mode), the last line of its report:

`blocking: <n>  should-fix: <n>  notes: <n>`

- `blocking` is `blocking`.
- `important` is `should-fix`.
- `notes` is not recorded and never blocks.

## The result rule

`pr-check.py stamp` computes `result` in this order.
The first rule that matches wins.

1. `fail` when any of these holds:
   - a check has `status` `fail`;
   - `floor` is `findings`;
   - `reviewers.code` or `reviewers.security` has `blocking` above 0 (`reviewers.codex` is never read);
   - `reviewers.verifier` counts for HEAD (see "The verifier") and has `verdict` `fail`.
2. `pass` when all of these hold:
   - every check has `status` `pass` or `not-found` (a repo with no command found has only `not-found` checks and still passes this line);
   - `floor` is `pass`, `not-installed` or `not-found`;
   - `mutation.status` is `killed` or `skipped`, or it is `survived` with `accepted` true;
   - `reviewers.code.status` is `done` or `inline`;
   - `reviewers.security.status` is `done`, `inline` or `skipped-no-surface`;
   - `reviewers.verifier.status` is `not-installed`, or it counts for HEAD and has `verdict` `pass`.
3. `incomplete` in every other case.

The consequences of rule 3 are spelled out because the spec leaves them open:

- A check with `status` `timeout` gives `incomplete`.
- `floor` of `could-not-run` gives `incomplete`.
- `mutation.status` of `survived` with `accepted` false gives `incomplete` (AC16).
- `mutation.status` of `could-not-run` gives `incomplete` (AC16).
- `reviewers.code.status` of `not-installed` or `could-not-run` gives `incomplete` (AC9, AC11).
  A missing code reviewer is never a pass.
- `reviewers.security.status` of `not-installed` or `could-not-run` gives `incomplete`.
- `reviewers.verifier` missing, `could-not-run`, `done` with a `verdict` of `incomplete` or null, or `done` for a commit that no longer counts for HEAD gives `incomplete`.
  A verifier that did not run is never a pass and an old verifier pass does not carry across a code change.
- A run record with no check for a step that `discover` returns for this HEAD, no `floor` or no `mutation` gives `incomplete` unless rule 1 matches.
  `stamp` names the missing records on stderr, so a run that skipped every step never stamps `pass`.
- `floor` of `not-installed` is the one sibling that may be absent and still pass, as R13 says.

A failing check stops the review (R6), so the reviewers are not dispatched and both record `could-not-run`.
Rule 1 wins in that case and `result` is `fail`.

## The validity rule

A stamp is valid when all four hold:

1. The file parses as a JSON object.
2. `schema` is the integer 1.
3. `head` equals the current HEAD sha, the output of one `git rev-parse HEAD` in the repo.
4. `result` is `pass`.

A reader that finds the stamp invalid names exactly one cause, checked in this order:

| Cause | When |
|---|---|
| `missing` | the file does not exist |
| `unreadable` | the file cannot be read, does not parse, is not a JSON object, has a `schema` other than 1 or has no string `head` or `result` |
| `stale` | `head` differs from the current HEAD sha |
| `not-passing` | `result` is `fail` or `incomplete` or any other value |

A reader that cannot decide (no git, no repo, a git timeout, an unreadable hook payload) is not a stamp problem.
pr-gate logs `could-not-run`, allows and exits 0.
The push gate falls through to its existing behavior.

## The push-gate acceptance rule

`push-gate.py` accepts with no output and no deny when the stamp is valid by the rule above and also:

- `reviewers.security` is an object;
- `reviewers.security.status` is `done` or `skipped-no-surface`;
- `reviewers.security.blocking` is the integer 0.

`skipped-no-surface` is accepted only by the stamp's own reading of the diff.
When the push gate's classifier finds security surface in the push range, only `done` satisfies it and `skipped-no-surface` falls through.
`inline` does not satisfy the push gate, because that review did not run with a fresh context.
With no stamp or any other stamp the push gate behaves as it did before this contract: it denies once per diff and session when the diff touches security surface.
The push gate never reads `checks`, `floor`, `mutation`, `tier` or `reviewers.code`.

## What pr-gate does with the result

`pr-gate.py` acts only on `gh pr create` without `--draft`, `-d` or `--help`.
A valid stamp passes with no output.
An invalid stamp is handled by mode (`mode.pr-gate`, then `mode`, default warn):

- In enforce mode it denies once per HEAD sha per session with the cause and the line "run /pro-ship:pr-check"; the identical retry passes.
- In warn mode it appends one line to `warn.log`, shows the cause as a `systemMessage` once per HEAD sha per session and allows.

## Known limit

The stamp is a plain file in the working tree, so anyone with shell access can write one by hand.
That is accepted for a local guardrail.
The enforcement is the required CI check that comes with `pipeline` (ADR-0014).

## Fixtures

`tests/fixtures/pr-check-stamp/` holds one file per case and `expect.json`, which maps each file name to the verdict of each reader.
Each runner reads a fixture as text, replaces the substring `HEAD` with the sha of its throwaway repo and writes the result to `.pro-dev/ship/pr-check.json`.
`corrupt.json` is not valid JSON on purpose.
`stale-head.json` holds a fixed sha that no throwaway repo has.
Both hook test files loop over `expect.json`: pr-gate checks the `pr_gate` entry and the push gate checks the `push_gate` entry.
`stamp-contract` in `tests/check.mjs` fails when a fixture is missing from `expect.json` or the two disagree with this page.
