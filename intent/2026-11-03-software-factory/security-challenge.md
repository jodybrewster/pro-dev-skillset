# Security challenge: software factory spec and design

Run by the security-architect subagent in challenge mode on 2026-11-03 against `spec.md` and `design.md` in this folder.
Kept verbatim; how each item is met is in `plan.md`.

## Security challenge

Verdict: proceed with required changes.
PR 4a (levels, templates, `factory.py level`) can go ahead.
PR 4b should not start until the four blocking items are in the plan.
The design treats client-side hooks as the security boundary of a headless session that runs with bypassed permissions and the maintainer's own credentials.
That session can rewrite, sidestep or retry its way past those hooks.

### Blocking

- [9/10] The gates live in files the gated session can write.
  A level 1 session under `--dangerously-skip-permissions` can be steered by a PR comment, a dependency file or test output, or can simply make a mistake.
  It can then run `echo warn > "$CLAUDE_GUARD_DIR/mode"`, overwrite `risk-classify.py` in the plugin cache or put `gh pr merge 7 --squash` in `m.sh` and run `bash m.sh`.
  merge-gate follows `bash -c`, `eval` and `xargs` but not a script file (`if name in SHELLS: ... SHELL_C_RE`).
  Rewriting the plugin cache also backdoors every later interactive session of the maintainer.
  Change: run the factory session in a container or under a separate OS user (`tests/loop.mjs` already has the Docker side), in a dedicated clone rather than the maintainer's checkout.
  Mount the plugin cache and the guard folder read-only.
  Have the hooks read the mode from an env var the runner sets (for example `CLAUDE_GUARD_MODE=enforce`) before any file, because a Bash tool call cannot change the hook process environment.
- [8/10] The model makes the merge decision and reports its own result.
  `/auto` runs `gh pr merge` itself.
  The record state comes from the session's `factory:` lines, so a steered session can print `factory: merged <sha>, deploy is yours` after any outcome.
  Change: `/auto` stops at an open PR.
  After the session exits, `factory.py run` runs `risk-classify.py` on the PR head it fetches itself (as `merge-gate.py resolve_pr` does) and merges with `--match-head-commit` only on low.
  It derives the record from `gh pr view --json state,mergeCommit,headRefOid`.
  On the server side, the factory pushes as its own GitHub identity (a machine user or GitHub App) scoped to the one repo.
  Add a default-branch ruleset that requires a PR and a `v*` tag ruleset that only the maintainer bypasses.
  Without the server side, the token that the first blocking item's attacker holds can still merge, push tags and edit repo settings.
  That also means "deploy stays human" is not enforced today: ship-gate lets the identical retry pass and production-gate's `check_push` returns None for a tag push.
- [9/10] Markdown-only PRs that rewrite policy merge at low.
  The brief PR or any level 1 build PR can also:
  - edit `REVIEW.md` to add a name to `roles.engineer` or set `paths.low: ["**"]`
  - flip another intent to `status: accepted`, `level: 1`, `risk: low`
  - edit `CLAUDE.md`, `AGENTS.md`, `.claude/commands/*.md` or `CONSTRAINTS.md`

  `excused()` waves through every `.md` that is not under `.github/workflows/`, `hooks` or `.claude`.
  `.claude/**/*.md` is then skipped at `is_test_or_fixture` (`low.endswith(DOC_EXT)`).
  merge-gate therefore allows all of these silently.
  The design's risk-table mitigation, "a diff touching REVIEW.md or `.claude/` is a `hook-scripts` or policy signal and reads medium or high", is false for every Markdown file there.
  Change: `factory.py` checks that the brief PR diff is exactly `intent/<own folder>/spec.md` and `plan.md`, nothing else.
  The build PR may not touch `intent/` outside its own folder, `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, `CONSTRAINTS.md`, `.claude/**` or `.pro-dev/**`.
  Add a high `policy-files` signal for those paths to `risk-classify.py` so a person's merges are covered too.
  That is a pro-ship change, so the spec's "reuses them unchanged" assumption has to be dropped.
- [8/10] The factory can feed itself.
  A steered run commits a new `intent/<date>-x/intent.md` with `status: accepted`, `level: 1`, `risk: low` and `author: <maintainer git name>`.
  The build PR reads low.
  `factory.py next` picks the new intent up five minutes later, so one injection becomes an unbounded chain of headless runs, each holding the maintainer's credentials and a spend budget.
  `author:` is a text field.
  The factory merges under the maintainer's gh account and git name (demo step 4: "both by the maintainer's account").
  So "the intent is on the default branch" no longer means a person put it there.
  Change: `next` refuses any intent whose `status: accepted` commit came from the factory (a `Factory-Run:` trailer plus the factory identity from the second blocking item).
  It takes the accepting person from GitHub (the PR's `mergedBy` or the push actor), never from `author:` or `user.name`.
  Add a daily run cap and a daily dollar cap to the runner.

### Required changes

- [9/10] "Enforce" does not block several of the gates the design relies on.
  pr-gate, push-gate and ship-gate deny once per HEAD, diff or commit per session, and "the identical retry passes".
  floor-guard's deny message tells the model to add `floor-allow: <rule-id> <reason>` to a commit message, which the session writes itself.
  pr-gate, ship-gate, push-gate and floor-guard all allow when they could not run.
  Change: list in the spec which gates really block headless.
  For factory runs, turn deny-once into a hard deny through the runner's env.
  Have `factory.py` reject a range that holds any `floor-allow:` line.
  Treat could-not-run as a stop.
- [8/10] The test lock can be bypassed several ways (Q7).
  - protect-tests matches only `Edit|Write|MultiEdit`, so `sed -i`, `cat >` or `git checkout <sha> -- test/x.test.js` in Bash edits a locked test.
  - `rm .claude/test-lock` drops the lock, because the session writes and owns that file.
  - Editing the `test` script or `testPathIgnorePatterns` stops the locked test from running without touching a test file.
  - A test added in step 1 and weakened in step 3 is a new file against the merge base. risk-classify's assertion-removed and floor-guard (merge base when the branch was not pushed between steps) only see its final version.

  A same-name test in another folder does not silence the locked one by itself. The config edit does, and floor-guard is no backstop for it.
  Change: the runner records each step's test blob ids from the commits and fails on any change at the PR head.
  It also runs the test command itself and checks that the locked files ran.
- [8/10] /execute trusts the brief PR's plan as consent (Q5).
  The design's own `Approver: factory, level 1 (role map: <product owner names>)` contains names, so it passes execute.md's "names a person, not an angle-bracket placeholder" test.
  A plan that also says `Stop-list categories: secrets (step 2)` then gets that step built unattended.
  Change: execute.md treats an `Approver:` that starts with `factory` as no consent.
  Before /execute, `factory.py` checks `Stop-list categories: none`, the exact Approver text and `Status: approved` in the merged plan.
- [8/10] PR review comments feed straight into a bypassed session.
  Anyone who can comment on the PR (any GitHub user on a public repo, any collaborator or bot on a private one) can open a thread with instructions to run a command that sends the env file to an outside URL.
  /pr-babysit works every unresolved thread with no filter on who wrote it (`comments(first:30){nodes{author{login} body ...}}`).
  The worktree holds real env files copied by `copy-env.py`.
  Change: in factory runs, act only on threads from role-map logins or a named bot list; any other thread stops the run at level 2.
  Skip `copy-env.py`.
  Pass `--disallowedTools` for WebFetch, WebSearch, `curl`, `wget`, `gh api` writes, `gh repo`, `gh secret`, `gh release`, `git tag` and nested `claude`.
- [8/10] pro-security is missing from the factory install.
  The guide's step 1 and the e2e install only pro-core, pro-ai-sdlc, pro-ship and pro-quality, yet section 2 lists pro-security's `push-gate.py` as reused.
  Without it no security review of the pushed diff runs, and risk-classify only notes `surface-unavailable` and adds no signal.
  A 40-line `src/` change with a test that logs a token or fetches a user-supplied URL then merges with nobody reading it.
  Change: level 1 requires pro-security installed and enabled, and `factory.py` refuses to merge when `notes` holds `surface-unavailable`.
- [8/10] production-gate stands down because pro-ship's files exist, even when pro-ship is off (Q4).
  If pro-ship is installed but disabled (`claude plugin disable`, or `enabledPlugins` false in the repo's `.claude/settings.json`), `find_sibling` still finds its files.
  production-gate then leaves the merge to a merge-gate that never runs.
  Change: delegate only when the runner sets an env marker after confirming pro-ship is enabled for that repo (`claude plugin list --json`).
  Start the session so that repo-controlled settings cannot disable plugins or set `disableAllHooks` (`--setting-sources user` (verify the flag), or check `.claude/settings*.json` at the default branch tip).
  With that in place production-gate loses little, because merge-gate's parser is stricter.
- [8/10] "Only raised" is not enforced against history, and mieruka trusts the field (Q3).
  A low Markdown PR can change another intent's `level: 3` to `level: 1` or its `risk: high` to `low`.
  `factory.py` recomputes the level from the edited facts, and mieruka reads `level:` to decide whether the lead must approve.
  Change: `factory.py level` returns the maximum of the computed level and every value the field has had in the default branch history.
  Mieruka calls `factory.py level` instead of reading the field.
- [8/10] The session can forge records that later human gates trust.
  `ship.check` validates only the schema, a `produced_by` prefix, the head and the status of `.pro-dev/ship/preflight.json`.
  The session can write a GO for the squash sha, and the maintainer's later tag then passes ship-gate silently.
  The same goes for `pr-check.json` and the factory record.
  Deleting the factory record makes the trigger run the intent again (Q6).
  Change: run in the dedicated clone from the first blocking item, so nothing under `.pro-dev/ship/` crosses into the maintainer's checkout.
  The runner, not the session, writes `.pro-dev/factory/` and copies the record out.
- [9/10] The spec, design and intent disagree on whether mieruka writes REVIEW.md.
  R17 says it "reads and writes the `## Roles` block", design section 4 says "read-only in mieruka v1" and the intent says it is "edited in Settings and written to the same block".
  A write path would make a web route a policy editor.
  Change: make R17 read-only.
- [7/10] Intent folder names reach a shell and a prompt.
  A merged Markdown PR can add an intent folder whose name holds a command substitution or spaces and instructions, which then lands in `claude -p "/pro-ai-sdlc:auto <dir>"` or the mieruka trigger.
  Change: accept only `^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$`.
  Spawn with argv arrays in both `factory.py` and `factory-trigger.ts`.
- [7/10] The cost cap cannot stop a run in progress.
  Section 3 reads `total_cost_usd` "per result event, as `loop.mjs:138`".
  One `claude -p` session emits a single result event at the end; `loop.mjs` checks between separate sessions.
  A looping or steered run can therefore spend up to `--max-turns 200` of Opus.
  Change: use the CLI's budget flag (verify `--max-budget-usd`), or sum the streamed usage and kill the process at the cap.
  Add the daily cap from the fourth blocking item.
- [7/10] The e2e GitHub token is far too broad (Q8).
  `loop.mjs` passes `gh auth token` (the maintainer's full token) into a container where the model runs with bypassed permissions, and writes it into the container's global git config.
  The flip to GitHub adds repo create and delete on top of that.
  That reaches every repo of the maintainer.
  `gh repo delete` with an empty name argument targets the repo of the current directory.
  Change:
  - Create and delete the repo on the host only.
  - Give the container a token scoped to that one repo, on a dedicated test account or org.
  - Delete only an explicit `<owner>/sdlc-e2e-<stamp>` that matches the regex and was created during the run.
  - At the start of each run, delete leftover `sdlc-e2e-*` repos older than a day, which covers a crash that skips `finally`.
  - Never commit transcripts to the fixture, so a leaked fixture exposes only tiny-tasks code.
- [6/10] (verify) Mieruka's role check is self-asserted.
  The "You are" picker writes `identity.name`, so anyone who can reach the local server can pick "lead" and press merge, which runs `gh pr merge` with the maintainer's token.
  If the routes have no Origin or CSRF check, a web page the maintainer visits can drive both POSTs.
  Change: ADR-0024 should say the 403 is routing, not authorization.
  Add same-origin checks and a session token on every state-changing route.
  For gates that merge, take the identity from `gh api user` instead of the picker.

### Open questions

- What do `next` and `run` do when `factory.py level` exits 2 or the `## Roles` block cannot be read? The spec has to say "no run" in writing.
- Which parser is canonical for `## Roles`? `risk-classify.py` strips HTML comments and rejects unknown keys, while js-yaml handles comments, duplicates and anchors differently, so one REVIEW.md could read two ways. The block also cannot share the `## Risk tiers` fence, because `parse_block` raises "unknown key" and the tier policy falls back to defaults.
- For a team, does the role map hold git names or GitHub logins? The gates in the second and fourth blocking items need logins.
- Does ADR-0024 accept that a small `src/` change merges with no person reading it until deploy? If so, the record should say so, for example "deploy is yours, unread diff: <n> lines".

### Accepted risks

- A spoofable `author:` in a solo repo, accepted by the maintainer in ADR-0024 and spec concern 2.
  The premise "push rights are the check" stops holding once the factory merges under the same account (fourth blocking item), so this acceptance needs revisiting.
