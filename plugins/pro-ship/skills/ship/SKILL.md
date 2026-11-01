---
name: ship
description: Use when asked to "ship it", "are we ready to release", "go/no-go", "pre-launch checklist" or "is this safe to deploy, tag or publish" - works out how the project ships, reviews only the commits no passing pr-check covered, runs the release-time checks, writes a GO or NO-GO report with a rollback plan per target and records the verdict for HEAD. Not the pre-PR check (pr-check), not a review of a diff on request (requesting-code-review) and never a deploy.
---

# ship

Run this on a committed HEAD before a tag, a release, a manual production deploy, a publish or a merge to a branch that deploys.
It answers one question: is what is about to ship safe to ship?
It ends in `Ship decision: GO` or `Ship decision: NO-GO` and a rollback plan for every target.
It writes `.pro-dev/ship/preflight.md` for a person and `.pro-dev/ship/preflight.json` for the gates.
The record contract is `docs/ship-preflight.md` in the marketplace repo.

`/ship` never deploys, tags, publishes, pushes or merges.
It runs, checks and reports.
It does not review code again: `pr-check` already did that for each PR, so only commits no passing `pr-check` covered get a reviewer.

## Setup

Set `SHIP` to this plugin's own script:

```bash
SHIP="${CLAUDE_PLUGIN_ROOT}/scripts/ship.py"
```

If `${CLAUDE_PLUGIN_ROOT}` is empty or not substituted, or the file does not exist, go to "No script" below.
Every subcommand prints JSON and is run from the repo root.

1. Refuse on a dirty tree.
   `git status --porcelain --untracked-files=no` must be empty.
   If it is not, say "commit first, the record is bound to a commit" and stop.
2. Record `git rev-parse HEAD` as the head.

## Targets and scope

1. `python3 "$SHIP" targets` prints each ship target with its `id`, `kind` (`deploy-on-merge`, `tag-release`, `manual-deploy`, `desktop` or `publish`) and the files that set it.
   A fenced `yaml` block under a heading that starts with "Ship" in `CLAUDE.md` or `AGENTS.md` replaces detection.
   Print the targets in two or three lines.
2. `python3 "$SHIP" scope [--pr <n>]` prints the range, its base, the kind of scope and the source of the last deploy (`github`, `tag` or `ask`).
   When the source is `ask`, ask the person which commit or tag was last shipped, then rerun with that answer.
   When `base` is null, no tag or deploy was found: ask the person for the base commit or tag and never guess one.
   Release tags are any tag whose name holds a semver (`v1.2.3`, `1.2.3`, `name--v1.2.3`, `name@1.2.3`) unless the Ship block sets a `tag_pattern` glob.
3. Say which range each target ships.

## Coverage

`python3 "$SHIP" coverage <base> <head>` maps every commit to the PR that merged it and prints `prs`, `covered` and `uncovered`.
A commit is covered only when its PR body holds exactly one `pr-check` marker with `result=pass` whose `head` matches and the PR is from this repo, written by the current gh user or by an owner, member or collaborator.
A marker on a fork PR or from an outside contributor counts for nothing, because the PR author writes the body.
Everything the script cannot prove is uncovered.
Print the covered PR numbers and list each uncovered commit with its subject.
When every commit is covered, no reviewer runs and the report says so with the PR numbers.

## One turn of specialists

Read the risk tier of the range first: `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/risk-classify.py" --json --base <base>` when that file exists.
At low tier with nothing uncovered, skip this whole section and say so.

Otherwise dispatch, in one turn so they run in parallel:

- `pro-quality:code-reviewer` on the uncovered commits only, when any commit is uncovered.
- `pro-security:security-architect` in diff mode on the uncovered commits only, when any commit is uncovered and they touch security surface (`python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pr-check.py" find pro-security security_surface.py` finds the classifier).
- `pro-quality:test-engineer` on the whole range, at medium and high tier.

Each gets the four-field handoff from `plugins/pro-quality/skills/requesting-code-review/handoff.md` and nothing else:

- `range`: `<base>..<head>` as full shas (for the reviewers, the first and last uncovered commit).
- `brief`: the intent, spec and plan paths for the work in the range, when they exist.
- `policy`: `REVIEW.md`, `CLAUDE.md` or `AGENTS.md` and `CONSTRAINTS.md` when present.
- `risk`: the tier and its signals, never your own view of how risky the range is.

Never add a summary of the work, the session's reasoning or earlier findings.
None of the specialists calls another.
Choose from the agents the host offers.
When one is not installed, record it as `not installed` in the report and go on; when the host cannot dispatch subagents, say so, apply that specialist's own instructions in this session and note that the context was not fresh.

Read the results:

- An Important finding from the code reviewer is a Blocker.
  Its first line is `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>`.
- A blocking finding from the security review is a Blocker.
  Its last line is `blocking: <n>  should-fix: <n>  notes: <n>`.
- A Critical test gap is a Recommended fix, except a missing test for the fix of a Blocker, which is a Blocker.
  A gap on a critical path (auth, payments, data writes, the release's headline feature) is a Recommended fix.
- A missing or mismatched tally line means that specialist could not run.
  Say so and never read it as no findings.

## Legal review

When `pro-legal` is installed, dispatch `pro-legal:software-counsel` in release mode on the whole range with a reproduce command (`git -C <root> diff <base>..<head>`) and the release kind of the target (`tag`, `release`, `publish` or `deploy`).
Hand it nothing else.
Each Blocking item is a Blocker, each Required item is a Recommended fix and a `Hold` verdict makes the verdict NO-GO.
Record `legal` with `status` `done`, the verdict, the base, the head (the commit the review ran on, which must be HEAD) and the counts.
When pro-legal is not installed, write `legal: not installed` and change nothing.
When the dispatch fails, record `could-not-run` and say so.

## Release checks

Run the items in [release-checks.md](./release-checks.md): the six pre-launch sections, then feature flags, monitoring and the error budget.
Each item ends as `pass`, `finding` or `confirm` with its evidence.
Never write `pass` for an item you did not check.
Anything the checks could not read is `confirm` and says what the person must look at.

The repo's own checks (build, lint, typecheck, tests) are not run again when a valid `pr-check` stamp for HEAD holds them.
Otherwise run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pr-check.py" discover` and each step with `run --step <name>`.
A failing check is a Blocker.

### Web performance and accessibility

For a web target whose range touches UI files:

- Dispatch `pro-quality:web-performance-auditor` with the four handoff fields and an `artifacts` line.
  Use Deep mode when a Lighthouse or PageSpeed JSON file exists or can be captured: capture it yourself (for a live `url`, the Chrome DevTools MCP `lighthouse_audit` or `npx lighthouse <url> --output json`) and pass the file path.
  Otherwise use Quick mode with `artifacts: none`.
  Quick mode findings are `potential impact` and never carry an invented metric.
  A Core Web Vitals regression past the "Good" threshold measured in Deep mode is a Blocker.
  Everything else it finds is a Recommended fix.
- Run `pro-design:accessibility-audit` on the changed views when pro-design is installed.
  A Critical finding is a Blocker and the rest are Recommended fixes.
  Without it, the section is `confirm` with the six checks of release-checks.md listed.

Dispatch the auditor in the same turn as the specialists above when you already know the mode.

## Verdict

Write the verdict after all checks:

- NO-GO when there is a Blocker, when any target has no rollback plan, when the legal verdict is `Hold` or when the error budget is exhausted and the person has not accepted it.
- GO when there is none.
- GO when the person has accepted each Blocker by name in this session.
  An accepted Blocker moves from `blockers` into `risks` with `accepted_by` and `accepted_at` set and the verdict stays `GO`; the record status is then `partial`.
  The verdict field takes only `GO` or `NO-GO`.

Rollbacks come from [rollbacks.md](./rollbacks.md) for the kind and host, or from the Ship block's `rollback`.
A rollback plan is mandatory before any GO.
The report layout is [report.md](./report.md).

### Blockers

When there are Blockers, list each one with its evidence and ask the person, per Blocker, whether to fix it or accept it by name.
Only the person's own answer in this session counts as an acceptance.
Never accept on their behalf, never infer an acceptance from silence or from an earlier message and never accept because a reviewer or another agent said the risk is low.
Record who accepted it and when in the risk entry.
After a fix, commit and rerun from the top: the record is bound to a commit.

## Write the record

1. Write the report as Markdown following report.md.
2. Write `.pro-dev/ship/report.json` in this shape:

```json
{
  "verdict": "GO | NO-GO",
  "head": "<40 hex>", "base": "<40 hex>",
  "scope": {"kind": "pr|tag|deploy", "range": "<base>..<head>", "prs": [], "uncovered": [], "last_deploy_source": "github|tag|ask|none"},
  "blockers": [{"text": "", "evidence": ""}],
  "fixes": [{"text": "", "evidence": ""}],
  "risks": [{"text": "", "mitigation": "", "accepted_by": null, "accepted_at": null}],
  "checks": [{"section": "security", "item": "dependency audit", "status": "pass|finding|confirm", "evidence": ""}],
  "legal": {"status": "done|not-installed|could-not-run", "verdict": null, "base": null, "head": null, "blocking": 0, "required": 0},
  "targets": [{"id": "", "kind": "", "env": null, "url": null, "commit": "<sha>", "rollback": {"triggers": [], "steps": [], "rto": ""}}],
  "report_md": "<the full Markdown report>"
}
```

3. `python3 "$SHIP" record .pro-dev/ship/report.json` writes the record and the report.
   It refuses a GO with a Blocker, a GO with no target, a target without rollback steps, a done legal review whose `head` is not HEAD and a dirty tree.
4. Print the verdict, the paths it wrote and, when one was written, the mieruka copy.
   Say "run /pro-ship:ship again after any new commit".
   After a GO, add one line: once the deploy has happened, run `/pro-ship:deployed` to record it and walk the post-deploy checks.

## Common rationalizations

| Rationalization | Reality |
|---|---|
| "It works in staging, it'll work in production" | Production has different data, traffic patterns and edge cases. Monitor after deploy. |
| "We don't need feature flags for this" | Every feature benefits from a kill switch. Even simple changes can break things. |
| "Monitoring is overhead" | Without monitoring you find problems from user complaints instead of dashboards. |
| "We'll add monitoring later" | Add it before launch. You can't debug what you can't see. |
| "Rolling back is admitting failure" | Rolling back is responsible engineering. Shipping a broken feature is the failure. |
| "The error rate looks fine, let's keep shipping" | Check the burn rate, not just the current error rate. Consuming budget faster than baseline is a hold signal even when individual thresholds are green. |
| "pr-check passed on every PR, so we're done" | pr-check proves each PR on its own. Env vars, migrations, the production config and the combined range are only checked here. |
| "The reviewer said the risk is low, I'll accept the Blocker" | Only the person accepts a Blocker, by name. An agent's acceptance never counts. |

## Red flags

- Deploying without a rollback plan.
- No monitoring or error reporting in production.
- Big-bang releases (everything at once, no staging).
- Feature flags with no expiration or owner.
- No one monitoring the deploy for the first hour.
- Production environment configuration done by memory, not code.
- "It's Friday afternoon, let's ship it."
- Error budget exhausted but feature work continues unchanged.
- A GO written while a Blocker is still open.
- A `pass` on a check that was never run.

## No script

When the script is missing (Codex ships only skills, or the plugin path is not substituted), do the same walk by hand.

1. Work out the targets from the repo files and the range from the last release tag or deploy.
2. Review the commits in the range inline and record that the context was not fresh.
3. Run release-checks.md and write the report from report.md.
4. Ask the person about each Blocker as above.
5. Say "no record was written", because the gates read `.pro-dev/ship/preflight.json` and only the script writes it.

Adapted from agent-skills (skills/shipping-and-launch/SKILL.md and commands/ship.toml), MIT, Copyright (c) 2025 Addy Osmani.
