---
intent: intent/2026-11-01-after-build-loop/intent.md
intent-status: accepted
status: accepted
created: 2026-11-01T10:40:00-0500
author: the maintainer
---

# Spec: carry the loop past the build

Built from `intent.md` in this folder.
Status: accepted.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0012, ADR-0014, ADR-0016, ADR-0022, `docs/pr-check-stamp.md`, `docs/ship-preflight.md`, `docs/hook-loading.md`, `plugins/pro-ship/scripts/{ship,pr-check,pr-gate}.py`, `plugins/pro-ship/skills/{ship,pr-check}/`, `plugins/pro-ai-sdlc/commands/{review,execute,intent}.md`, `plugins/pro-ai-sdlc/agents/verifier.md`, `plugins/pro-ai-sdlc/templates/{plan,REVIEW,intent}.md`, `plugins/pro-ai-sdlc/references/definition-of-done.md`, `plugins/pro-quality/hooks/hooks.json`, `plugins/pro-quality/agents/code-reviewer.md` and agent-skills' `ci-cd-and-automation`, `observability-and-instrumentation`, `browser-testing-with-devtools`, `code-review-and-quality`, `debugging-and-error-recovery`, `shipping-and-launch`, `incremental-implementation` and `git-workflow-and-versioning` (MIT).
In mieruka: `apps/web/src/service/spdd-evidence.ts`, `apps/web/src/lib/db.ts`, `apps/web/src/features/ship/DeployPanel.tsx` and `apps/web/src/service/change-sync.ts`.
No `DESIGN.md` or `SECURITY.md` exists in this repo.

## Summary

Six additions carry the loop from verified work to the records that come after a build.
`pro-ship` gains a deploy record written after a deploy and a pr-check stamp that needs a fresh verifier pass.
`pro-ai-sdlc` gains `/incident`, review lessons in `/review` and a visual check of UI steps in `/execute`.
`pro-quality` gains a hook that runs the repo's own formatter and linter on each edited file.
The four new records follow one contract, [docs/loop-records.md](../../docs/loop-records.md) and land where mieruka reads them.

## Assumptions

- mieruka's evidence table accepts the kinds `review`, `qa_run`, `deploy`, `a11y`, `visual_drift` and `doc` and the statuses `pass`, `fail`, `partial` and `info` (confirmed in `lib/db.ts:531` and `spdd-evidence.ts:27`).
- mieruka's sync skips a manifest with no `evidence_key` or `kind` and aborts on an unsafe key; keys here use only `a-z`, `0-9` and `-` (confirmed in `spdd-evidence.ts`).
- mieruka's Floor makes one card per intent folder and lists every file in it, so an `incident.md` beside an `intent.md` shows up with no change (confirmed in `change-sync.ts`).
- Browser control comes from whatever the session has: the Playwright MCP tools, pro-testing's `agent-browser` or a person; none is installed by this work (unconfirmed per repo, so the visual check records `info` when none is there).

## Requirements

### Functional

Deploy record (intent: "After a deploy, one command writes a deploy record").

- R1. `ship.py deployed --target <id> --env <env> [--url <url>] [--commit <sha>] [--outcome succeeded|failed|rolled-back] [--deployed-at <iso>] [--checks <json file>]` writes the deploy record of `docs/loop-records.md` to `.pro-dev/ship/deploys/<evidence_key>.json` and prints the path.
  `--commit` defaults to HEAD and must name a commit that exists; `--outcome` defaults to `succeeded`.
- R2. `ship.py deployed --from-github --target <id> [--env production]` reads the newest deployment for that environment and its newest status from `gh api` with a timeout and fills `commit`, `url` (the status's `environment_url`), `deployed_at` and `outcome` from them; `source` is `github`.
  When gh is missing, not signed in or times out it prints why and writes nothing.
- R3. `--target` must match a target that `ship.py targets` returns and contain only `a-z`, `0-9` and `-`; otherwise it refuses and lists the target ids.
  `target_kind` and `rollback` come from that target.
- R4. `preflight.state` is the freshness cause of `.pro-dev/ship/preflight.json` for `commit`, from the same rule `ship.py check` applies; `preflight.evidence_key` is that record's key when the file parses.
  A missing or stale preflight does not stop the record; it is written down.
- R5. `status` follows the table in `docs/loop-records.md`: `fail` for a failed or rolled-back outcome, `partial` when any check is `finding` or `confirm`, otherwise `pass`.
- R6. A new skill, `/pro-ship:deployed`, runs after a deploy: it asks for or reads the facts in R1 and R2, walks the post-deploy checks (R42) with the person, writes them to a checks file and runs `ship.py deployed`.
  It never runs a deploy command.
- R7. `/pro-ship:ship`'s report ends its GO with one line naming `/pro-ship:deployed` as the step after the deploy.

Verifier pass in the stamp (intent: "The pr-check stamp that lets `gh pr create` through also needs a fresh verifier pass").

- R8. The verifier's report begins with `HEAD: <full sha>` from `git rev-parse HEAD` and states whether tracked files had uncommitted changes.
  When they did, its verdict is `incomplete`.
  It still writes nothing.
- R9. pr-check dispatches `pro-ai-sdlc:verifier` in the same turn as the reviewers when pro-ai-sdlc is installed (found with `find_sibling` on `agents/verifier.md`), with the four-field handoff (ADR-0012).
  When a verifier report is already in the session from `/execute`, it is reused if R11 holds for it.
- R10. `pr-check.py stamp` accepts `verifier` inside `--reviewers` as `{agent, status, verdict, head}`; `status` is `done`, `not-installed` or `could-not-run` and `verdict` is `pass`, `fail`, `incomplete` or null.
  The stamp stores it under `reviewers.verifier`.
- R11. A verifier result counts for the stamp's HEAD when its `head` equals HEAD, or when every file changed between its `head` and HEAD is under `intent/` and its `head` is an ancestor of HEAD, so `/execute`'s last `plan.md` commit does not void it.
- R12. `compute_result` gives `fail` for a counted verifier with verdict `fail`; `pass` needs the verifier `not-installed` or counted with verdict `pass`; any other verifier state, a missing `verifier` key included, gives `incomplete`.
  pr-gate's freshness rule does not change, because it reads only `result`.
- R13. `docs/pr-check-stamp.md`, its fixtures and the `stamp-contract` check describe the new field and rule in the same commit.
- R14. `/execute` runs `/pro-ship:pr-check` after its last commit and before `gh pr create` when pro-ship is installed, passing its verifier report along.

Format and lint after each edit (intent: "After each edit the repo's own formatter and linter run on the edited file").

- R15. A `PostToolUse` hook in pro-quality, `format-on-edit.py`, runs on `Write`, `Edit` and `MultiEdit`.
  It reads only `tool_input.file_path` from the payload.
- R16. It acts only on a regular file inside the repo root, not under `.git/`, `node_modules/` or a path git ignores; a symbolic link is skipped.
- R17. The formatter is the first match for the file's extension: a `Format` yaml block in `CLAUDE.md` or `AGENTS.md` (`format: {<glob>: <command>}` with `{file}` standing for the path), then Biome (`biome.json` or `biome.jsonc` and `node_modules/.bin/biome`), then Prettier (a Prettier config or a `prettier` key in `package.json`, plus `node_modules/.bin/prettier`), then Ruff (`[tool.ruff]` in `pyproject.toml` or `ruff.toml`, plus `ruff` in `.venv/bin` or on PATH), then `gofmt` for `.go` and `rustfmt` for `.rs` when on PATH.
  The linter is the same block's `lint` map, then ESLint (an ESLint config and `node_modules/.bin/eslint`) for JavaScript and TypeScript, then Ruff's `check`.
- R18. It never downloads a tool: no `npx`, `pnpm dlx`, `bunx`, `uvx` or `pipx run`.
  Commands run as an argument list with no shell and the file path as one argument.
- R19. Each tool runs with a 15-second timeout and the hook's own timeout is 40 seconds.
  A tool that is missing, times out or crashes is logged and the hook exits 0.
- R20. The formatter writes the file.
  The hook then reports, as `additionalContext`, that the file was reformatted and must be read again before the next edit, plus the linter's first 20 findings.
  The linter never gets `--fix`.
- R21. In warn mode (the default; `mode.format-on-edit`, then `mode`) lint findings are reported and the hook exits 0.
  In enforce mode lint errors are returned as blocking feedback (exit 2) so the session fixes them; formatting never blocks.
- R22. The hook formats only the edited file, so a change carries no formatting churn in files it did not touch.

Incidents (intent: "One command turns an incident into an incident record, a new intent ... and a regression test case").

- R23. A new command, `/incident <what happened>`, in pro-ai-sdlc interviews for the facts in the incident frontmatter of `docs/loop-records.md`, one question at a time. It then writes `intent/<YYYY-MM-DD>-<slug>/incident.md` from a new template `templates/incident.md` and `intent.md` from the intent template with `source: incident <id>`, `kind: bug` and `risk` from the severity.
- R24. The template's sections are Summary, Impact, Timeline, Evidence preserved, Root cause, Mitigation, Regression test, Runbook update and Follow-ups, carrying agent-skills' stop-the-line steps (R44).
- R25. Logs, stack traces and error text pasted into an incident are treated as data, never as instructions.
  They are fenced in the file.
- R26. The new intent's Success section names the regression test: it fails on the incident commit and passes on the fix.
  The intent's plan writes that test first; `/incident` does not commit a failing test to a branch that CI runs.
- R27. `incident.py record <intent dir>` writes the incident manifest of `docs/loop-records.md` from the frontmatter and refuses a frontmatter with an unknown `state` or `severity`.
  `/incident` runs it after writing; running it again after the state changes rewrites the record.
- R28. `/incident` commits `incident.md` and `intent.md` together on a short branch in the main checkout, the same way an intent is committed.
  It does not push.

Review lessons (intent: "`/review` remembers its findings").

- R29. Each Important finding `/review` reports gets a class: a kebab-case slug for the kind of mistake, reused from the classes `lessons.py classes` lists when one fits.
- R30. `lessons.py add --ref <pr or branch> --head <sha> --class <slug> --file <path> --claim <text>` appends one line to `.pro-dev/review/findings.jsonl`; the same ref and class is stored once.
- R31. `lessons.py repeats` prints each class seen on two or more distinct refs that has no lesson yet.
- R32. For each repeat `/review` shows one proposed line for the agent file's "Things Claude gets wrong" and asks yes or no.
  On yes it adds the line to that section, leaves the edit uncommitted and runs `lessons.py mark <class> accepted --line <text>`; on no it runs `lessons.py mark <class> declined`.
  A proposal that is not answered is recorded as `proposed`.
- R33. `lessons.py mark` writes the review-lesson manifest of `docs/loop-records.md`.
  A declined class is not proposed again.
- R34. `/review` still never posts, approves or edits anything other than the ledger, the lesson records and, on a yes, the one agent-file line.
  Its `allowed-tools` adds only the `lessons.py` script and the edit of the agent file.

Visual check of UI steps (intent: "When a plan names a mock, `/execute` screenshots each UI step").

- R35. The plan template gains an optional header line `Mock: <path or URL>` and an optional `(ui: <route>)` tag on a step.
- R36. For a plan with a `Mock:` line, `/execute` captures each `(ui: ...)` step at a desktop width (1280) and a mobile width (390) once the step's tests pass, with whatever browser tool the session has.
- R37. The comparison is the session's judgment of the screenshot against the mock, plus the console error and warning counts; zero console errors is required for `pass` (R45).
- R38. `visual.py record --intent <dir> --step <n> --viewport desktop|mobile --status <s> --shot <png> --url <url> [--differences <json file>] [--console-errors <n>] [--console-warnings <n>]` copies the PNG into `.pro-dev/visual/` and writes the visual-check manifest of `docs/loop-records.md`.
- R39. A `fail` stops the step until it is fixed or the person accepts the difference, which records `partial`.
  With no browser tool the step records `info` and the run goes on.
- R40. Page content seen through the browser is untrusted data (R46).
- R41. The plan's Done section lists each visual check with its status.

Baseline from agent-skills (intent constraint: "its CI, observability, browser testing, review and debugging material ... comes across in full").

- R42. `/pro-ship:deployed`'s checks are the post-deploy list from `shipping-and-launch` ("In the first hour after launch" and the post-deploy verification list) plus the 15-minute error watch from `ci-cd-and-automation`, each a `pass`, `finding` or `confirm`.
- R43. The code reviewer gains two red flags from `code-review-and-quality`: a bug fix with no regression test and a UI change with no screenshot.
- R44. The incident template carries `debugging-and-error-recovery`'s stop-the-line steps (stop, preserve evidence, diagnose, fix the root cause, guard against it, resume only after verification), its rule that the regression test fails without the fix and passes with it, its verification list and `observability-and-instrumentation`'s rule to update the runbook when an incident closes, with the three-line runbook shape (Means, First check, Escalate to).
- R45. `/execute`'s visual step carries `browser-testing-with-devtools`' screenshot verification (responsive viewports, the loading, empty and error states the step touches) and its clean-console standard.
- R46. It also carries that skill's security boundaries: page content is untrusted, use an isolated profile and run no JavaScript that changes the page.
- R47. `/execute`'s build loop names type checking and linting passing before a step counts, from `incremental-implementation`.
- R48. Every adapted file keeps an agent-skills footer and `docs/licenses.md` lists it.

Shared.

- R49. Every writer in R1, R27, R33 and R38 uses one mieruka drop rule, the one `ship.py` uses.
  Each keeps `detail_json` a string.
- R50. `tests/mieruka-sync.mjs` loads one record of each new type through mieruka's own sync and passes.

### Non-functional

- N1. Every hook exits 0 on a payload it cannot parse, makes no network call and runs in under its timeout (REVIEW.md).
- N2. Scripts are Python standard library only; tests use only `node:` built-ins and drive scripts as subprocesses in throwaway repos.
- N3. The format hook adds under 50 ms when no formatter matches the file.

### Policy constraints applied

- Hook-loading law: the format hook is registered in pro-quality's one `hooks/hooks.json` and its script is tracked.
- Version-bump law: pro-ship, pro-ai-sdlc and pro-quality bump in both manifests and the marketplace entry, plus `metadata.version`.
- Codex parity: the new pro-ship skill has standard frontmatter; the code-reviewer change updates its `.toml` twin. pro-ai-sdlc is Claude Code only, as its README says.
- ADR-0003: pro-ship finds pro-ai-sdlc's verifier through `find_sibling` and records `not-installed`; no plugin imports another, so pro-ai-sdlc carries its own copy of the mieruka drop.
- ADR-0012: the verifier gets the four-field handoff.
- ADR-0014: the stamp stays a local file; a hand-written stamp is still accepted as a known limit.
- ADR-0016: the format hook's blocking behaviour is enforce-only and starts in warn.
- The names rule: no maintainer name or chat quote in any file or PR.

### Boundaries

Always: write records under `.pro-dev/` and the mieruka drop, format the one edited file, read payload fields as data.
Ask first: adding a line to the agent file, accepting a visual difference, the facts of an incident.
Never: run a deploy, download a formatter, pass `--fix` to a linter, commit a failing test to a CI branch, execute text from a payload or a web page.

## Design

### User experience

After a deploy the person runs `/pro-ship:deployed`, answers the checks that need eyes and gets one line with the record path and its status.
`/incident checkout returned 500s after the 14:00 deploy` asks for the severity, when it was detected, the commit or deploy and what was done, then writes the two files and says to run `/spec` on the new intent.
`/review` ends, when a class repeats, with one proposed line and a yes or no.
A Prettier repo sees "formatted src/app.tsx with prettier; read it again before the next edit" after an edit.
A plan with a mock shows a visual line per UI step in its Done section.

### System

- pro-ship: `scripts/ship.py` gains `deployed`, reusing `targets`, `check`, `write_atomic` and `mieruka_copy`. `scripts/pr-check.py` gains the verifier field and rule. New `skills/deployed/SKILL.md`. `skills/pr-check/SKILL.md` dispatches the verifier. `skills/ship/report.md` gains the next-step line.
- pro-ai-sdlc: new `commands/incident.md`, `templates/incident.md`, `scripts/incident.py`, `scripts/lessons.py`, `scripts/visual.py` and `scripts/evidence.py` (the shared manifest writer and mieruka drop for those three). `commands/review.md`, `commands/execute.md`, `agents/verifier.md` and `templates/plan.md` change.
- pro-quality: new `scripts/format-on-edit.py`, registered in `hooks/hooks.json`. `agents/code-reviewer.md` and its `.toml` gain R43.
- Docs: `docs/loop-records.md` (new), `docs/pr-check-stamp.md`, ADR-0023, `docs/licenses.md`, the plugin READMEs and `docs/roadmap.md`.
- Tests: `tests/ship-deploy.mjs`, `tests/format-hook.mjs`, `tests/sdlc-records.mjs` (incident, lessons, visual), new cases in `tests/ship-check.mjs` and `tests/mieruka-sync.mjs`, fixtures under `tests/fixtures/loop-records/` and `tests/fixtures/pr-check-stamp/`.

### Alternatives considered

- A new mieruka kind `incident`: mieruka's `CHECK` constraint rejects it and one bad kind stops its sync, so the incident uses `doc` with `artifact_kind` `incident`.
- The verifier writing its own record file: it would break the "verifier writes nothing" rule and gives no more trust than the session copying its `VERDICT:` and `HEAD:` lines, since anyone with a shell can write either.
- A tracked findings ledger: it would put every review's findings into PRs and churn the tree; the accepted lines in the agent file are the tracked part.
- A PostToolUse hook that records deploys automatically: deploy-on-merge targets have no local command and parsing deploy output for the URL is fragile; `--from-github` covers the automatic case.
- Running `lint --fix` as agent-skills' CI section suggests: an automatic semantic fix after every edit can change behaviour the session did not intend; findings are reported and the session fixes them.
- A pixel-diff library for the visual check: it would need a dependency the standard library does not have; a mock is rarely pixel-exact; the check is a judgment with the console counts as the hard rule.
- Committing the regression test from `/incident`: the failing test would turn CI red on the intent's branch; the plan writes it first instead.

## Upstream coverage

| agent-skills item | Where it lands |
|---|---|
| shipping-and-launch: first hour after launch, post-deploy verification | `/pro-ship:deployed` checks (R42) |
| ci-cd-and-automation: monitor for errors for 15 minutes | `/pro-ship:deployed` checks (R42) |
| ci-cd-and-automation: lint failure, run lint with `--fix` | replaced by reported findings (R20); see Alternatives |
| git-workflow-and-versioning: pre-commit formatting and linting; no formatting mixed with behaviour changes | format hook (R15 to R22) |
| incremental-implementation: type checking and linting pass | `/execute` (R47) |
| debugging-and-error-recovery: stop the line, preserve evidence, regression test fails without the fix, verification list, error output is untrusted | incident template (R24, R25, R44) |
| observability-and-instrumentation: update the runbook when closing an incident; Means, First check, Escalate to | incident template (R44) |
| code-review-and-quality: no regression test with a bug fix; screenshots for UI changes | code reviewer (R43) |
| browser-testing-with-devtools: screenshot verification, responsive viewports, clean console, security boundaries | `/execute` visual step (R45, R46) |
| code-review-and-quality: change sizing, dependency discipline, "I'll clean it up later", multi-model review | left out: they are reviewer checklist content, not repeat counting; recorded on the roadmap for the next code-reviewer change |
| ci-cd-and-automation: Build Cop, feed CI failures to the agent, branch protection | left out: CI judgment steps are the `claude -p` intent, which is out of scope here |

## Flagged concerns

ADR needed: yes, the four record contracts and the verifier rule in the stamp are rules mieruka and later gates build on; [ADR-0023](../../docs/decisions/0023-loop-records.md), proposed.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | `/review` says it changes nothing; it now writes a ledger and, on a yes, one agent-file line | `commands/review.md`, REVIEW.md "Learning from repeats" | resolved: the ledger and lesson records are under the excluded `.pro-dev/`; the agent-file line is written only on an explicit yes, left uncommitted; REVIEW.md already asks for the line on a repeat |
| 2 | The format hook runs repo-controlled tools on every edit | REVIEW.md hook rules | resolved: only tools already in the repo or on PATH, no downloads, no shell, the path as one argument, a timeout; the same trust as the repo's own test command; the plan gets a security-architect challenge |
| 3 | Reformatting a file makes the session's last read stale, so its next edit to that file fails until it reads again | Claude Code edit model | resolved: the hook says so in `additionalContext` every time it changes a file |
| 4 | Requiring the verifier makes pr-check `incomplete` in every repo with pro-ai-sdlc that has not run it | ADR-0014, ADR-0016 | resolved: pr-check dispatches it itself; repos without pro-ai-sdlc record `not-installed`, which passes; pr-gate stays in warn by default |
| 5 | The stamp contract changes while the merge gate and push gate read the stamp | `docs/pr-check-stamp.md` | resolved: both read only `result` and `head`; the contract page, fixtures and check change in one commit |
| 6 | mieruka writes a Markdown copy of each synced record into its tracked `docs/spdd/evidence/`, so deploy records add tracked files in mieruka | mieruka's sync | open, for mieruka: noted in the handoff to its work; nothing here can change it |
| 7 | Deploy, lesson and visual records are never pruned | `.pro-dev/` growth | resolved: one small JSON file per event; pruning is left for when a repo shows it matters |
| 8 | Incident text and web pages are untrusted input into a session that can write files | REVIEW.md, agent-skills security boundaries | resolved: fenced as data in the file, R25 and R46 |

## Open questions

- Untracked or tracked findings ledger: answered, untracked under `.pro-dev/review/`; accepted lines in the agent file are the tracked part.
- How a verifier pass is recorded so the writing session cannot just claim one: answered as far as a local file allows. The verifier is a fresh-context agent dispatched by pr-check, its report carries the sha it checked and the stamp binds to it; a hand-written stamp stays a known limit (ADR-0014).

## Acceptance criteria

- AC1. In a throwaway repo, `ship.py deployed --target web --env production --url https://example.test` writes a `deploy` record whose fields match `docs/loop-records.md`, with `preflight.state` `missing`.
- AC2. With a stubbed `gh`, `ship.py deployed --from-github --target web` fills commit, URL and outcome from the deployment.
- AC3. `pr-check.py stamp` gives `incomplete` with no verifier, `pass` with a counted passing verifier, `fail` with a counted failing one, `pass` with `not-installed` and `pass` when the only change since the verifier's head is under `intent/`.
- AC4. The format hook formats a `.ts` file in a repo with Prettier installed, reports lint findings from ESLint, does nothing for a file outside the repo, an ignored file or a symlink, never calls `npx` and exits 0 on a broken payload.
- AC5. `incident.py record` writes a `doc` / `incident` record with the status for each state and refuses an unknown state.
- AC6. `lessons.py` stores a class once per ref, lists it as a repeat on the second ref and writes a `review-lesson` record on `mark`; a declined class is not listed again.
- AC7. `visual.py record` copies the PNG and writes a `visual_drift` / `ui-step` record.
- AC8. `MIERUKA_ROOT=<checkout> node tests/mieruka-sync.mjs` loads one record of each new type with no sync error.
- AC9. `/incident`, `/review` with a repeat, `/pro-ship:deployed` and `/execute` with a mock each run once by hand in a scratch repo, recorded in the plan's Done section.
- AC10. Every check in `CLAUDE.md`'s "Verifying your work" passes.

## Out of scope

mieruka's views, stages and Ship page.
`claude -p` in CI, tiered deploy autonomy, a rollback command and a control-band watcher.
Running deploys.
Pruning old records.
