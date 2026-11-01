---
intent: intent/2026-10-31-ship-preflight/intent.md
intent-status: accepted
status: draft
created: 2026-10-31T22:17:44-0400
author: the maintainer
---

# Spec: `/ship` preflight with a go/no-go verdict

Built from `intent.md` in this folder (commit e73cbf5).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `docs/pr-check-stamp.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0016, `docs/enforce-mode.md`, `plugins/pro-ship/scripts/merge-gate.py`, `plugins/pro-ship/scripts/pr-gate.py`, `plugins/pro-ship/skills/pr-check/` (SKILL.md, discovery.md, pr-body.md), `plugins/pro-security/scripts/push-gate.py`, `plugins/pro-ai-sdlc/scripts/production-gate.py`, `plugins/pro-legal/scripts/release-gate.py`, the `using-pro-dev` router, `../agent-skills/commands/ship.toml` and `skills/shipping-and-launch/SKILL.md` (MIT) and mieruka's `apps/web/src/service/spdd-evidence.ts`, `apps/web/src/lib/db.ts` and `apps/web/src/features/ship/DeployPanel.tsx`.
No `DESIGN.md` or `SECURITY.md` exists in this repo; the installed `pro-security` skills were read for the hook rules REVIEW.md repeats.

## Summary

Every repo with pro-ship installed, which is every pro-dev-starter repo, gets `/pro-ship:ship`.
It works out how the project ships and what is about to ship, finds the commits no passing `pr-check` covered, reviews only those, runs the release-time checks and writes a GO or NO-GO report with a rollback plan per target.
The result is `.pro-dev/ship/preflight.md` for a person and `.pro-dev/ship/preflight.json` for machines, in mieruka's evidence manifest shape.
A copy lands in `.mieruka/evidence/` when the repo has mieruka's folder.
The merge gate shows the verdict on medium and high merges in repos that deploy on merge.
A new `ship-gate.py` warns on a tag, a release, a manual production deploy or a publish when there is no fresh GO for the commit that ships.

## Requirements

### Functional

Scope and targets (intent: "It works out how the project ships and what is about to ship").

- R1. `ship.py targets` prints a JSON list of ship targets read from repo files alone, each with `id`, `kind` and the files that set it.
  `kind` is one of `deploy-on-merge`, `tag-release`, `manual-deploy`, `desktop` or `publish`.
- R2. Detection, the first matching rule per target winning:
  `vercel.json`, `.vercel/project.json` or `netlify.toml` give `deploy-on-merge`;
  a workflow under `.github/workflows/` that runs on `push` to the default branch and names a deploy step (`deploy`, `vercel`, `netlify`, `fly`, `wrangler`) gives `deploy-on-merge`;
  `fly.toml` or `wrangler.toml` with no such workflow gives `manual-deploy`;
  a workflow that runs on `push: tags` or `release`, or any existing `v*` tag, gives `tag-release`;
  an `electron` dependency or an `electron-builder` or Electron Forge config gives `desktop`;
  a `package.json` with `name` and `version` and no `"private": true`, a `pyproject.toml` with a `[project]` table, a `Cargo.toml` with `[package]` or a `.gemspec` gives `publish`.
- R3. In a monorepo the rules run per workspace package (`workspaces` in the root `package.json`, `pnpm-workspace.yaml` or `apps/*` and `packages/*`), so each app is its own target.
- R4. A fenced `yaml` block under a heading that starts with "Ship" in `CLAUDE.md` or `AGENTS.md` replaces detection, the way a verify block replaces command discovery in pr-check.
  It lists `targets` (each with `id`, `kind` and optional `env`, `url` and `rollback`), an optional `last_deploy` of `github`, `tag` or `ask` and an optional `tag_pattern`, a git glob that picks the release tags for both target detection and the base of `scope`.
  Without it a tag is a release tag when its name holds a semver `vX.Y.Z` or `X.Y.Z`, as in `v1.2.3`, `1.2.3`, `name--v1.2.3` and `name@1.2.3`.
- R5. `ship.py scope` picks the range: `--pr <n>` gives that PR's merge base to its head; otherwise the range runs from the last production deploy to HEAD for a `deploy-on-merge` or `manual-deploy` target and from the newest reachable release tag to HEAD for every other kind.
- R6. The last production deploy is the newest `production` environment entry from `gh api repos/{owner}/{repo}/deployments`, then the newest release tag, then a question to the person; `last_deploy` in the Ship block picks one source.
  The source used is written into the record.

Coverage and review (intent: "It does not review code again").

- R7. `ship.py coverage <base> <head>` maps every commit in the range to a merged PR through `gh pr list --state merged --json number,headRefOid,mergeCommit,body,author,authorAssociation,isCrossRepository`.
  A commit no PR merged is uncovered.
- R8. A PR is covered when its body holds exactly one pr-check marker with `result=pass` and a `head` equal to the PR's `headRefOid` and the marker is trusted.
  A marker is trusted only when the PR is not cross-repository and its author is the current gh user (`gh api user --jq .login`, one call, with a timeout) or its `authorAssociation` is `OWNER`, `MEMBER` or `COLLABORATOR`, because the PR author writes the body.
  `gh pr list` therefore also reads `author`, `authorAssociation` and `isCrossRepository`.
  A marker whose `head` is an ancestor of `headRefOid` covers only the commits up to that head; the later ones are uncovered and so is the merge commit of a merge-type PR.
  A PR with no marker, a non-pass marker, more than one marker or an untrusted marker is uncovered.
- R9. pr-check's PR body draft ends with one line, `<!-- pro-ship:pr-check head=<full sha> result=<result> tier=<tier> -->`, taken from the stamp it just wrote.
  The stamp contract does not change.
- R10. When any commit is uncovered `/ship` lists them and dispatches the code reviewer and, when the commits touch security surface, `security-architect` in diff mode, each with the four-field handoff (ADR-0012) on the uncovered commits only.
  The reviewers and `test-engineer` (R43) are dispatched in one turn so they run in parallel.
  None of them calls another.
  An Important finding from the code reviewer or a blocking finding from the security review is a Blocker.
- R11. When every commit is covered no reviewer runs and the report says so with the PR numbers.

Release checks (intent: "It checks what only matters at release time").

- R12. The release checks run in the six sections of R42 (code quality, security, performance, accessibility, infrastructure, documentation), then legal (R19); each item writes `pass`, `finding` or `confirm` with its evidence.
- R13. The repo's own checks reuse `pr-check.py discover` and `run` on HEAD, unless a valid stamp for HEAD already holds them; a failing check is a Blocker.
- R14. An env var or config key the range adds, read from `.env.example`, `.env.*.example` and `process.env.X` or `os.environ` references in the diff, is a Blocker when the production config can be read and lacks it (`vercel env ls production` for a linked Vercel project) and a `confirm` Recommended fix when it cannot be read.
- R15. A new migration (`prisma/migrations`, `drizzle`, `supabase/migrations`, `db/migrate`, `alembic/versions`, `migrations/`) that drops a table or a column, or that has no down step where the tool supports one, is a Blocker unless the report names how to go back.
- R16. No health check or monitoring config for a `deploy-on-merge` or `manual-deploy` target is a Recommended fix.
  Feature flags the range adds are listed under Acknowledged risks with their default.
- R17. A release the repo's changelog tool has not picked up (a release-please config with no open release PR, a `CHANGELOG.md` with no entry for the version) is a Recommended fix; `/ship` never edits a changelog.
- R18. A tag or release version that differs from the version in the manifests the repo ships is a Blocker.
  In this marketplace the version-bump law check in `tests/check.mjs` stands in for it through R13.
- R19. When pro-legal is installed `/ship` dispatches `software-counsel` in release mode on the whole range with a reproduce command (`git -C <root> diff <base>..<head>`) and the release kind of the target.
  It hands the reviewer nothing else.
  Each Blocking item is a Blocker, each Required item is a Recommended fix and a `Hold` verdict makes the verdict NO-GO.
  When pro-legal is not installed the report says "legal: not installed" and the verdict does not change.
- R19a. pro-legal's `release-gate.py` reads `.pro-dev/ship/preflight.json` for the `tag`, `release`, `publish` and `deploy` kinds.
  It skips its own deny when the record is fresh for the commit by R31, its `legal.status` is `done`, its `legal.verdict` is not `Hold`, its `legal.head` equals the record's `head` and its `legal.base` equals the gate's base or is an ancestor of it.
  It still runs its local release hygiene (LICENSE and license field) and still gates `pr` and `commit-deps` as before.
  It carries its own copy of the R31 rule with a comment naming `docs/ship-preflight.md`, as the push gate does for the stamp.
- R20. A `publish` target can only add Blockers: a version that `npm view <name>@<version> version` (or the registry's equivalent) already returns, a failing dry run of the publish command or a publish workflow with no provenance (`--provenance` or `publishConfig.provenance`).

Verdict and rollback (intent: "It ends in GO or NO-GO with the agent-skills layout").

- R21. The report has the sections Ship decision, Scope, Blockers, Recommended fixes, Acknowledged risks, Rollout plan (deploy targets, R45), Rollback plan (one subsection per target), Post-launch verification and Verification checklist (R47) and Evidence with the specialist reports, in that order.
- R22. Each rollback subsection gives the trigger conditions, the exact steps and the recovery time, from `rollbacks.md` for its kind or from the Ship block's `rollback`.
- R23. The verdict is NO-GO when there is a Blocker or any target lacks a rollback plan.
  It is GO with acknowledged risks only when the person accepts each Blocker by name in the session; the record keeps who accepted it and when.
  An agent's acceptance never counts.
- R24. `/ship` runs, checks and reports and never deploys, tags, publishes, pushes or merges.

The record (intent decisions 2 and 5).

- R25. `ship.py record <report.json>` writes `.pro-dev/ship/preflight.json`: mieruka's manifest fields `evidence_key`, `kind`, `artifact_kind`, `artifact_key`, `status`, `summary`, `detail_json` and `produced_by`, plus the top-level `schema` (1) and `head` (full sha) that the gates read.
- R26. `evidence_key` is `ship-preflight-<12 char sha>`, `kind` is `review`, `artifact_kind` is `ship-preflight` and `artifact_key` is the 12 char sha.
  `status` is `pass` for GO, `partial` for GO with acknowledged risks and `fail` for NO-GO.
  `summary` starts with the verdict and the Blocker count.
  `produced_by` is `pro-ship:ship@<plugin version>`.
- R27. `detail_json` is a JSON-encoded string, because mieruka binds it straight into a text column.
  It holds `verdict`, `head`, `base`, `created`, the scope (kind, range, PR numbers, uncovered commits, last-deploy source), `blockers`, `fixes`, `risks` (with `accepted_by` and `accepted_at`), the check results, a `legal` object (`status` of `done`, `not-installed` or `could-not-run`, `verdict`, `base`, `head`, `blocking` and `required`) and one `targets` entry per target with `id`, `kind`, `env`, `url`, `commit` and `rollback`.
- R28. `record` refuses to run with uncommitted tracked changes, as `pr-check.py stamp` does.
  It adds `.pro-dev/` to the `info/exclude` file when it is missing.
- R29. When `.mieruka/` exists at the repo root and `git check-ignore` reports `.mieruka/evidence/` as ignored, `record` also writes the same manifest to `.mieruka/evidence/<evidence_key>/evidence.json`.
  When the folder is tracked it writes nothing there and says why.
- R30. `.pro-dev/ship/preflight.md` holds the report from R21 and is rewritten with the record.

The gates (intent decision 3).

- R31. A record is a fresh GO for a commit when it parses as a JSON object, `schema` is 1, `produced_by` starts with `pro-ship:ship`, `head` equals that commit and `status` is `pass` or `partial`.
  A reader names one cause otherwise, checked in this order: `missing`, `unreadable`, `stale`, `no-go`.
- R32. The merge gate, on a medium or high merge in a repo where `ship.py targets` returns a `deploy-on-merge` target, appends one line to the message it already shows: `preflight: GO for <8 char sha>`, `preflight: GO with <n> accepted risks` or `preflight: no fresh GO for this PR (<cause>)`, comparing the record to the PR head it already resolved.
  It changes no decision, adds no prompt and stays silent at low.
- R33. `ship-gate.py` is a `PreToolUse` Bash hook in pro-ship's existing `hooks/hooks.json` matcher.
  It acts on `git tag <name>` that creates a tag, `gh release create`, `npm`, `pnpm`, `yarn` or `bun publish`, `cargo publish`, `twine upload`, `gem push`, `uv publish`, `poetry publish`, `vercel` with a production flag, `fly deploy` and `flyctl deploy`, `netlify deploy --prod`, `wrangler deploy`, `electron-builder --publish always` and `electron-forge publish`.
  `--dry-run`, `--help`, tag listing, tag deletion and quoted or heredoc text never match.
- R34. The commit checked is the one the command names (`git tag <name> <commit>`, `gh release create --target <sha>`) and HEAD otherwise.
- R35. With a fresh GO it is silent.
  Without one in warn mode it writes one `warn.log` line and shows the cause and "run /pro-ship:ship" once per commit per session.
  In enforce mode it denies once per commit per session with the same text and lets the identical retry through.
- R36. Mode is `mode.ship-gate`, then `mode`, in `CLAUDE_GUARD_DIR` or `~/.claude/hooks`, default warn.
- R37. It reads one file and runs `git rev-parse`, makes no network call, executes nothing from the payload and writes only `warn.log` and its session state file.
  A malformed payload, no git, no repo or a git timeout logs `could-not-run` and allows.

Upstream checklist and specialists (intent: "the full agent-skills shipping material").

- R42. `release-checks.md` carries agent-skills' pre-launch checklist in full, in its six sections: code quality, security, performance, accessibility, infrastructure and documentation.
  Each item ends as `pass`, `finding` or `confirm` with its evidence.
  An item a passing `pr-check` already proved per PR (tests, build, lint, typecheck, review) reads its result from R13 and is not run again.
  The release-time items are:
  - Code quality: a `TODO` or `FIXME` the range adds in non-test code and a debugging statement the range adds (`console.log`, `print(`, `debugger`) are Recommended fixes.
  - Security: the ecosystem's dependency audit (`npm audit --audit-level=high`, `pnpm audit`, `pip-audit`, `cargo audit`) with a critical or high finding is a Blocker; a credential-shaped string the range adds (the patterns in `REVIEW.md`) is a Blocker; for a web deploy target, missing security headers (CSP, HSTS), a wildcard CORS origin and an auth endpoint with no rate limit are Recommended fixes, read from `references/security-checklist.md`.
  - Performance: R49 for a web target whose range touches UI files; the backend items of `references/performance-checklist.md` (an N+1 query, a missing index for a new query) found in the range are Recommended fixes.
  - Accessibility: for a web target whose range touches UI files, pro-design's `accessibility-audit` runs on the changed views when pro-design is installed; a Critical finding is a Blocker and the rest are Recommended fixes; without pro-design the section is `confirm` with the six upstream checks listed.
  - Infrastructure: env vars (R14), migrations (R15), DNS and SSL for a target with a `url` (`curl -sSI` answers 2xx or 3xx over a valid certificate; a failure is a Blocker), a CDN for static assets (`confirm`), logging and error reporting (R46) and the health check (R16).
  - Documentation: README setup steps for new env vars or commands, API docs for changed endpoints, an ADR for an architectural decision in the range, the changelog (R17) and user-facing docs; each missing one is a Recommended fix.
- R43. `/ship` dispatches `pro-quality:test-engineer` on the whole range with the four-field handoff (ADR-0012), asking for coverage gaps on the changed behavior.
  A gap on a critical path (auth, payments, data writes, the release's headline feature) is a Recommended fix; a missing test for a Blocker's fix is a Blocker.
  It runs at medium and high tier, in the same turn as the R10 reviewers.
- R44. Each feature flag the range adds needs an owner and a removal date, is not nested inside another flag and has both states tested; each miss is a Recommended fix.
- R45. A `deploy-on-merge` or `manual-deploy` target gets a Rollout plan section: the staging step, production with the flag off when the range adds a flag, then the upstream thresholds table (error rate, p95 latency, client errors, business metrics) with advance, hold and roll back columns.
  `/ship` writes the plan and never runs it.
- R46. A deploy target is checked against the pre-launch gate of `references/observability-checklist.md`: structured logs, error reporting, a health check and an alert on the error rate; a missing error reporter or health check is a Recommended fix.
- R47. The report ends with Post-launch verification (the upstream first-hour list: health check returns 200, no new error types, latency normal, the critical flow tested by hand, logs flowing, the rollback path dry-run) and the upstream Verification checklist, before and after deploying, per target.
- R48. The Ship block may name an `error_budget` (a percent remaining or a command that prints one).
  Above 20 percent changes nothing; 0 to 20 percent makes a high-tier range a Blocker; an exhausted budget makes the verdict NO-GO unless the person accepts it by name.
  Without an `error_budget` the report writes one `confirm` line.
- R49. `/ship` dispatches `pro-quality:web-performance-auditor` for a web target whose range touches UI files, in Deep mode when a Lighthouse or PageSpeed JSON or a live URL with the Chrome DevTools MCP is available and in Quick mode otherwise.
  Quick-mode findings are labelled `potential impact` and never carry an invented metric; a regression past a Core Web Vitals "Good" threshold measured in Deep mode is a Blocker.
- R50. `pro-quality` gains `agents/test-engineer.md` and `agents/web-performance-auditor.md`, adapted from the agent-skills agents with their footer, each with `model: opus` (reviewers run on Opus), a `.codex-plugin/agents/<name>.toml` and a routing case or an entry in `tests/cases/uncovered.json`.
  `plugins/pro-ship/skills/ship/references/` gains `performance-checklist.md`, `security-checklist.md` and `observability-checklist.md`, adapted with their footer; `docs/licenses.md` gains their rows.

Packaging.

- R38. The skill is `plugins/pro-ship/skills/ship/SKILL.md` with sidecars `release-checks.md` (adapted from agent-skills' `shipping-and-launch`), `rollbacks.md` and `report.md`; the script is `plugins/pro-ship/scripts/ship.py`.
- R39. The `using-pro-dev` router sends "ship it", "are we ready to release" and "go/no-go" to `ship` and drops `shipping-and-launch` from its planned list; the README's Ship row names `ship`.
- R40. `RELEASING.md` gains one step: run `/pro-ship:ship` before tagging.
- R41. `docs/enforce-mode.md` gains a `ship-gate` row in warn.

### Non-functional

- N1. `ship-gate.py` answers within 5 seconds and its hook timeout is 10.
- N2. The merge gate's added work is file reads only and stays inside its 20 second deadline.
- N3. `ship.py targets` and the record readers run on Python 3 standard library alone, as the other pro-ship scripts do.
- N4. A rerun at the same HEAD replaces the record and the mieruka copy in place; mieruka's sync updates the existing row by `evidence_key`.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-ship, pro-core and pro-legal bump in both manifests and the marketplace entry, plus `metadata.version`, in the build commit.
- Hook-loading law (ADR-0003): `ship-gate.py` is a third entry under pro-ship's one `Bash` matcher in `hooks/hooks.json` and is tracked by git.
- Codex parity (ADR-0004): the skill prose is harness-neutral and the Codex manifest version matches; the gate is a Claude Code hook and Codex users run `/ship` by hand.
- Plugins cannot import each other (ADR-0003): `ship-gate.py` copies `guard_dir`, `mode` and `log` from `guard.py` and its tag and publish matching from `release-gate.py`, with a comment naming the sources, as pr-gate does.
  `merge-gate.py` loads `ship.py` as a sibling script the way it loads `risk-classify.py`.
- REVIEW.md, hooks make no network calls: the Deployments API, `gh pr list`, `npm view` and `vercel env ls` run from `ship.py` under the skill and never from a hook.
- REVIEW.md, every blocking hook has a blocking and an allowing behavior case: `tests/ship-hooks.mjs` gains both for `ship-gate.py`.
- ADR-0014: the record follows the stamp's pattern: one writer, many readers, bound to a commit, deny once, forgery accepted for a local guardrail.
- ADR-0016: `ship-gate` ships in warn and starts its own evidence period; the merge gate's added line is informational and does not restart its period.
- ADR-0012: reviewers for uncovered commits get the four-field handoff and nothing from the session.
- ADR-0015: the merge gate's tier is unchanged and never read from the record.
- Forked content: agent-skills is MIT; `docs/licenses.md` gains a pro-ship `ship` row and the plugin `LICENSE` already carries the agent-skills copyright line.
- Writing rules: no em dashes, no Oxford comma, no comma before "and" and straight quotes in every file this change writes.

## Design

### User experience

The person types `/pro-ship:ship`, "ship it" or "are we ready to release".
The skill prints the targets it found and the range for each in two or three lines, then says which PRs were covered and which commits were not.
It runs the reviewers only when there is something uncovered, then the release checks.
The report opens with one line, `Ship decision: GO`, `Ship decision: GO with 1 accepted risk` or `Ship decision: NO-GO (2 Blockers)`.
Each Blocker names its evidence as `file:line`, a command and its output or a URL.
When there are Blockers the skill asks the person whether to fix them or accept any by name; it never accepts on its own.
It ends with the paths of the report and the record, plus the mieruka copy when one was written.

A gate message is one line: `[ship-gate] no fresh GO for 1a2b3c4d (stale: the preflight is for 9f8e7d6c). Run /pro-ship:ship.`
In warn mode it adds `(warn mode: allowed)`.

### System

New files:

- `plugins/pro-ship/skills/ship/SKILL.md`, `release-checks.md`, `rollbacks.md`, `report.md`.
- `plugins/pro-ship/scripts/ship.py` with the subcommands `targets`, `scope`, `coverage`, `record` and `check <sha>`, the last one printing the R31 verdict for the gates and the tests.
- `plugins/pro-ship/scripts/ship-gate.py`.
- `plugins/pro-ship/skills/ship/references/performance-checklist.md`, `security-checklist.md` and `observability-checklist.md`, adapted from agent-skills.
- `plugins/pro-quality/agents/test-engineer.md` and `web-performance-auditor.md` with `.codex-plugin/agents/` twins, adapted from agent-skills.
- `docs/ship-preflight.md`, the record contract, like `docs/pr-check-stamp.md`.
- `docs/decisions/0022-ship-preflight-record.md`.
- `tests/fixtures/ship-preflight/`: record cases with `expect.json` and target-detection repos (Vercel app, tag-only marketplace, mieruka-shaped monorepo with an Electron app, a publishable package).

Changed files:

- `plugins/pro-ship/hooks/hooks.json`: a third hook under the `Bash` matcher.
- `plugins/pro-ship/scripts/merge-gate.py`: the R32 line in `decide`.
- `plugins/pro-ship/skills/pr-check/pr-body.md`: the R9 marker line.
- `plugins/pro-core/skills/using-pro-dev/SKILL.md`, `README.md`, `RELEASING.md`, `docs/enforce-mode.md`, `docs/licenses.md`, `docs/README.md`, `docs/decisions/README.md`.
- `tests/ship-hooks.mjs` (ship-gate cases, merge gate line cases), `tests/ship-check.mjs` (ship.py), `tests/check.mjs` (a `preflight-contract` check like `stamp-contract`), `tests/cases/routing.jsonl` (one `ship` case with `notOneOf: ["pr-check"]`).
- `plugins/pro-legal/scripts/release-gate.py`: the R19a reader; `tests/legal-hooks.mjs` gains a skip case and a no-skip case per condition.
- The pro-ship, pro-core and pro-legal manifests, the marketplace entries and `metadata.version`.

Example record, as written:

```json
{
  "schema": 1,
  "head": "<40 hex>",
  "evidence_key": "ship-preflight-1a2b3c4d5e6f",
  "kind": "review",
  "artifact_kind": "ship-preflight",
  "artifact_key": "1a2b3c4d5e6f",
  "status": "fail",
  "summary": "NO-GO: 1 Blocker, 2 recommended fixes, 3 targets",
  "detail_json": "{\"verdict\":\"NO-GO\",\"head\":\"...\",\"targets\":[...]}",
  "produced_by": "pro-ship:ship@0.10.0"
}
```

For mieruka today R2 and R3 find one `tag-release` target with three packages: the web app, the CLI and the Electron app.
None has a deploy or a publish, so each rollback is checking out the previous tag.

### Alternatives considered

- A new mieruka evidence `kind` such as `ship`: its `CHECK` constraint rejects it and the uncaught insert stops the sync for every later manifest (decision 5).
- A pro-ship record format with a translation step for mieruka: two formats to keep in step for no gain (decision 5).
- Gate fields only inside `detail_json`: every gate would parse a nested string; two top-level fields mieruka ignores are cheaper.
- No new hook, relying on `production-gate`: pro-ai-sdlc is opt-in, so most starter repos would have nothing on `git tag` (decision 3).
- An `ask` from `ship-gate.py`: it would add a second prompt beside `production-gate`'s on the same release (decision 3).
- Reading past stamps for coverage: the stamp is one local file overwritten by every run, so no merged PR's stamp survives (Flagged concern 1).
- Agent-skills' three parallel reviewers on every run: `pr-check` already ran them per PR (intent constraints).
- A time limit on freshness: the record is bound to a commit like the stamp; a stale production config is caught by rerunning, not by a clock.

## Upstream coverage

agent-skills (release 0.6.14, commit `eb07f19`) is the baseline for this command.
Every part of its shipping material is listed here as kept, replaced or dropped, with the reason.

| Upstream part | Here | Why |
|---|---|---|
| `commands/ship.toml` Phase A: code-reviewer, security-auditor and test-engineer in parallel | kept for the release range: the three run in one turn on the commits no passing `pr-check` covered (R10); `test-engineer` also runs on the whole range (R43) | `pr-check` already ran code and security review on each covered PR; it never ran a coverage analysis |
| Phase A skip rule (2 files, 50 lines, no auth, payments, data or config) | replaced by the risk tiers: a low-tier range with no uncovered commit skips the fan-out | the tiers are this repo's classifier for the same question (ADR-0015) |
| Phase B merge: code quality, security, performance, accessibility, infrastructure, documentation | kept, as the six sections of the pre-launch checklist (R42) | |
| Phase C report: decision, Blockers, Recommended fixes, Acknowledged risks, Rollback plan, specialist reports | kept (R21), with the specialist reports under Evidence | |
| Rules 1 to 4 (parallel, flat, rollback before GO, Critical means NO-GO) | kept (R10, R23) | |
| `skills/shipping-and-launch` pre-launch checklist, all six sections | kept in full in `release-checks.md` (R42) | |
| Feature flag strategy and its rules | kept as checks on flags the range adds (R44) | |
| Staged rollout, rollout thresholds and when to roll back | kept in the report as a rollout plan for deploy targets (R45); running a rollout stays out of scope | `/ship` judges readiness and never deploys |
| Monitoring and observability, error reporting | kept, from `observability-checklist.md` (R42, R46) | |
| Post-launch verification | kept as its own report section (R47) | |
| Error budget release gate | kept when the Ship block names an error budget; `confirm` otherwise (R48) | most repos have no SLO to read |
| Rollback strategy template | kept (R22) | |
| Common rationalizations and red flags | kept in the skill body | |
| Verification checklist (before and after deploying) | kept as the report's last section (R47) | |
| `agents/code-reviewer.md` | already adapted as `pro-quality:code-reviewer` | |
| `agents/security-auditor.md` | replaced by `pro-security:security-architect` in diff mode | that is this repo's diff-mode security reviewer; pro-security's own `security-auditor` judges single findings |
| `agents/test-engineer.md` | adapted as `pro-quality:test-engineer` (R43) | |
| `agents/web-performance-auditor.md` | adapted as `pro-quality:web-performance-auditor` (R49) | |
| `references/performance-checklist.md`, `security-checklist.md`, `observability-checklist.md` | adapted under `plugins/pro-ship/skills/ship/references/` (R42) | |
| `references/accessibility-checklist.md` | used from pro-design's `accessibility-audit`, which already adapted it | one copy |
| `references/definition-of-done.md` | used from pro-ai-sdlc where installed | one copy |
| `references/orchestration-patterns.md` | dropped | it describes how to build fan-out commands, not a ship step |
| `commands/webperf.toml` | dropped from this intent | a standalone `/webperf` is roadmap item 18; `/ship` calls the agent directly |

## Flagged concerns

ADR needed: yes, the preflight record is a contract the gates and mieruka read, so changing it later breaks readers in two repos: [ADR-0022](../../docs/decisions/0022-ship-preflight-record.md), proposed.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent says `/ship` "reads the `pr-check` stamp of each PR in that range", but the stamp is one local file that the next run overwrites, so no merged PR's stamp exists to read. R8 and R9 replace it with a marker line in the PR body that pr-check drafts, which survives the merge and any machine. It changes pr-check's body draft (not the stamp contract) and every PR merged before it ships reads as uncovered on the first run. | Intent, `docs/pr-check-stamp.md` | resolved: the PR body marker, 2026-10-31 |
| 2 | The intent wants an override "in the repo's own config" without naming the file. R4 puts it in a "Ship" yaml block in `CLAUDE.md` or `AGENTS.md`, following pr-check's verify block, because `.pro-dev/` is excluded from git and cannot hold shared config. | Intent | resolved: the agent file block, 2026-10-31 |
| 3 | The intent lists pro-legal's release review among the checks. Running it in `/ship` alone would review the same range twice, because pro-legal's gate denies once on the same `git tag` and asks for that review again; not running it would let `/ship` say GO before legal had looked. | Intent, `plugins/pro-legal/scripts/release-gate.py` | resolved: run it in `/ship` (R19) with pro-legal's gate reading the record and skipping a review the record already holds (R19a), 2026-10-31 |
| 4 | On a `gh release create` in enforce mode `ship-gate`, pro-legal's gate and `production-gate` can all fire. The first two deny once on the same call and the retry meets `production-gate`'s one ask, so the "at most one prompt" constraint holds at the cost of one retry.
With a fresh GO that holds the legal review, neither deny-once gate fires. | Intent constraints, ADR-0014 | resolved: both deny-once gates record the same call, so one retry clears both |
| 5 | REVIEW.md forbids network calls in hooks, while the scope needs the GitHub Deployments API and coverage needs `gh pr list`. | REVIEW.md pass 2 | resolved: those calls run in `ship.py` under the skill; `ship-gate.py` and the merge gate's added line read local files only |
| 6 | pro-ship is in pro-dev-starter, so the new gate reaches every starter repo, including this one, where every release tag warns until `/ship` has run. | ADR-0016, RELEASING.md | resolved: warn mode with one line per commit per session; R40 puts `/ship` in the release steps |
| 7 | For a deploy target scoped from a GitHub deployment, `legal.base` is the last deploy, which is newer than the tag base pro-legal's gate uses, so the R19a skip fails on the base condition and pro-legal's gate still asks once. | `plugins/pro-legal/scripts/release-gate.py` | known limit, documented in `docs/ship-preflight.md`; not fixed |

## Open questions

From the intent, all answered:

- Is mieruka's web app hosted anywhere? No, it runs locally from a tagged release, so it is part of the `tag-release` target.
- Is mieruka's CLI published to npm? No, so mieruka has no `publish` target and R2 must not find one from `apps/web/package.json` alone.
  R4's Ship block in mieruka's agent file settles it, or detection needs a rule; decided in `/plan`.
- mieruka's desktop app has no installer yet, so its rollback is checking out the previous tag.

New ones from the spec, all answered on 2026-10-31 by taking the recommendations: the PR body marker (concern 1), the agent file Ship block (concern 2) and the legal review in `/ship` with pro-legal's gate reading the record (concern 3).
Nothing blocks planning.

## Acceptance criteria

- AC1. In the Vercel fixture `ship.py targets` returns one `deploy-on-merge` target; in a mieruka-shaped fixture with a Ship block it returns one `tag-release` target with three packages and no `publish` target.
- AC2. In a fixture whose range adds `STRIPE_KEY` to `.env.example` with a stubbed `vercel env ls production` lacking it, the report has a Blocker naming `STRIPE_KEY` and the verdict is NO-GO.
- AC3. With a stubbed `gh pr list` of two merged PRs, one with a passing marker at its head and one whose marker head is an ancestor of its head, `ship.py coverage` lists only the second PR's later commits plus a direct-push commit as uncovered.
- AC4. A record written by `ship.py record` parses, has every manifest field, a string `detail_json` and `status` matching the verdict for each of GO, GO with risks and NO-GO.
- AC5. With an ignored `.mieruka/` the same manifest lands in `.mieruka/evidence/ship-preflight-<sha>/evidence.json`; with a tracked one nothing is written there and the output says why.
- AC6. `ship.py check` returns the right cause for each fixture in `tests/fixtures/ship-preflight/expect.json`: fresh GO, `missing`, `unreadable`, `stale` and `no-go`.
  A `partial` record counts as GO.
- AC7. `ship-gate.py` in enforce mode denies `git tag v1.2.0` with no record, lets the identical retry through and is silent with a fresh GO; in warn mode it allows with one message and one `warn.log` line.
- AC8. `ship-gate.py` makes no decision on `git tag -l`, `git tag -d v1`, `npm publish --dry-run`, `vercel` without a production flag or `echo "git tag v1"`.
- AC9. On a medium merge in a `deploy-on-merge` fixture the merge gate's message ends with the preflight line for each of GO, GO with risks and no record; on a low merge and in a `tag-release`-only fixture it shows no preflight line.
- AC10. A malformed payload to `ship-gate.py` exits 0 with no output and a `could-not-run` line.
- AC11. A routing case "ship it, are we good to release?" resolves to `ship`, not `pr-check`.
- AC12. `node tests/check.mjs` passes with the new `preflight-contract` check and the version-bump law.
- AC12a. With pro-legal installed and a fresh GO whose `legal` review covers the range, `git tag v1.2.0` meets no legal deny; with a `Hold` verdict, a stale record or a `legal.base` newer than the last tag it denies once as before.
- AC14. A fixture range adding a `console.log` and a dependency with a known high advisory (stubbed `npm audit`) yields one Recommended fix and one Blocker.
- AC15. On a web fixture whose range touches a component, `/ship` dispatches `web-performance-auditor` in Quick mode and every finding it reports is labelled `potential impact`.
- AC16. The report for a `deploy-on-merge` fixture contains the Rollout plan thresholds table, Post-launch verification and the before and after Verification checklist.
- AC17. `pro-quality:test-engineer` and `pro-quality:web-performance-auditor` load under `claude plugin validate --strict`, have Codex `.toml` twins and pass the Codex parity check.
- AC13. In mieruka, running `/ship` before a tag writes a manifest the next evidence sync loads with no error, shown in its evidence list under `artifact_kind` `ship-preflight`.

## Out of scope

Running deploys, cutting tags or publishing.
`pipeline` (item 16) and a CI version of this check.
Staged rollout, feature-flag systems and automatic rollback (item 31).
Mobile store releases.
mieruka's Ship page and its sync fix, which are a separate intent in that repo.
Moving `ship-gate` to enforce, which follows ADR-0016's evidence period.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
