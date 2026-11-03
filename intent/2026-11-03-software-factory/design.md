# Design: a very simple software factory

Written 2026-11-03 against pro-dev-skillset `c88d6a7` (main, clean), mieruka `63e2e1c` (main, dirty tree, two agent worktrees on `spec/approve-intent-button` and `spec/projects-view`) and agent-skills `eb07f19` (0.6.14).
Every "today" claim below was read in those checkouts; path:line cites point at them.
Nothing was edited.

## 1. The factory in one paragraph

An intent enters through `/intent` as it does today and gets one new frontmatter field, `level: 1 | 2 | 3`, set at intake by a deterministic script from the intent's own facts (declared risk, source, author against the REVIEW.md role map, stop-list words, new dependencies) and only ever raised afterwards.
A level 1 intent that a named role accepts on the default branch is picked up by a plain runner script that starts one headless Claude Code session per intent; that session runs one new command, `/pro-ai-sdlc:auto`, which writes a short spec and plan in one commit, then runs the existing `/execute`, `/review` and `/pr-babysit` unchanged, classifies the real diff with pro-ship's `risk-classify.py` and merges with `gh pr merge --match-head-commit` only when the tier is still low.
Deploy stays a human step at every level: the run ends with a record that says "merged, deploy is yours".
Level 2 and 3 intents run the loop exactly as today, with the engineer, lead and policy owner acting at the gates they already own (spec acceptance, plan approval, merge).
The gates in pro-ship and pro-ai-sdlc already refuse to let a medium or high change through without a person.
Mieruka reads the same files and records, adds a human role map to its settings, shows the level and the owning role on each gate and acts through the same commands; it reimplements nothing.
New surface: one command, one script with four subcommands, two template fields, one record type, one hook change, one test-lock marker.

```mermaid
flowchart LR
  subgraph intake [Intake, a person present]
    PO[Product owner or engineer<br/>/intent, accepts] --> I[intent.md<br/>status: accepted<br/>level: n from factory.py level]
  end
  I -->|level 1| R[factory.py run<br/>claude -p /pro-ai-sdlc:auto]
  I -->|level 2 or 3| S[/spec, /plan as today]
  R --> A[spec+plan, one commit<br/>status accepted/approved]
  A --> X[/execute unchanged<br/>worktree, test first, test lock,<br/>verifier, pr-check, PR]
  S --> G2{Engineer approves plan<br/>lead too at level 3<br/>policy owner closes concerns}
  G2 --> X
  X --> V[/review, /pr-babysit unchanged]
  V --> C{risk-classify on the PR<br/>low?}
  C -->|low and level 1| M[gh pr merge --match-head-commit<br/>merge-gate allows low]
  C -->|medium or high| RAISE[level raised, run stops<br/>record says which gate]
  RAISE --> G3{Engineer merges at level 2<br/>lead at level 3}
  M --> D[deploy is yours:<br/>/pro-ship:ship GO, tag, /pro-ship:deployed]
  G3 --> D
  D --> INC[/incident writes intent n+1]
  R -. writes .-> REC[.pro-dev/factory/*.json<br/>+ .mieruka/evidence copy]
  REC -. read by .-> MK[mieruka: level badge,<br/>gate buttons by role,<br/>run state]
```

Who acts where:

| Level | Intake | Spec | Plan | Merge | Deploy |
|---|---|---|---|---|---|
| 1 Auto | a named role accepts | `/auto` writes it, no concerns allowed | `/auto` writes it, no stop-list category | `/auto` merges when the diff is low | engineer |
| 2 Engineer | any role | product owner accepts | engineer approves | engineer, `--match-head-commit` | engineer |
| 3 Escalated | any role | policy owner closes each flagged concern, then product owner accepts | engineer plus lead in `Approver:` | lead, `--match-head-commit` | engineer |

Files that move: `intent/<date>-<slug>/{intent,spec,plan}.md` (tracked), the branch and PR, `.pro-dev/ship/pr-check.json`, `.pro-dev/factory/<folder>.json` (new, untracked), `.pro-dev/ship/deploys/*.json`, `.mieruka/evidence/*/evidence.json` copies.

## 2. Reuse, change, new

### pro-dev-skillset

Reused unchanged (the factory is mostly these):

| Piece | Why it already does the job |
|---|---|
| `/execute` (`plugins/pro-ai-sdlc/commands/execute.md`) | worktree (`:102-108`), test first (`:132`), stop list (`:38-56`), unattended semantics already defined (`:79`, `:87`, `:176`), verifier (`:183`), pr-check before the PR (`:194-196`), never merges (`:209`) |
| `/review`, `/pr-babysit`, `/incident`, `/adr` | unchanged; `/pr-babysit` keeps its name and still never merges (`pr-babysit.md:74`) |
| `execute-gate.py` | refuses an unapproved or already built plan (`:63-69`), needs an origin (`:77-78`) |
| pro-ship `risk-classify.py` | deterministic tier from the diff, policy read from the merge base so a PR cannot loosen it (`risk-classify.py:775-776`); exit 0 low, 3 medium, 4 high, 2 could not run (`:52`, docstring) |
| pro-ship `merge-gate.py` | low merges allowed, medium and high need `--match-head-commit` and a person; in enforce an ask under `bypassPermissions` denies (`:50-57`, `NO_PROMPT_MODES`); nothing clears an ask (docstring) |
| pro-ship `pr-check` skill, `pr-gate.py`, `ship-gate.py`, `ship.py deployed`, `/pro-ship:ship` | stamp, preflight and deploy record as they are |
| pro-quality `floor-guard.py` | weakened or deleted tests denied at push in enforce (docstring `:3-13`), the backstop for the test lock |
| pro-security `push-gate.py` | security review of the pushed diff, satisfied by a fresh stamp (`:7-10`) |
| `guard.py` modes | `mode.<hook>` files in `~/.claude/hooks` (`guard.py:22-31`) |
| `tests/loop.mjs` | the `claude -p` stage driver, cost cap, Docker host side (`:81-105`, `:123-141`) |
| `docs/loop-records.md` shared rules | every new record is a mieruka manifest with the same fields (`:17-27`) and the same drop rule (`:36-37`) |
| pro-core `/pro-dev install` | the one setup command; `/sdlc-init` no longer exists (removed in #65, `plugins/pro-core/commands/pro-dev.md:161-215` is its successor) |

Changed:

| File | Change | Why not reuse as is |
|---|---|---|
| `plugins/pro-ai-sdlc/templates/intent.md` | add `level: <1 \| 2 \| 3>` to frontmatter (after `risk:` at `:5`) and a lifecycle note | the level has to live with the intent so every later stage and mieruka read one field |
| `plugins/pro-ai-sdlc/templates/REVIEW.md` | add a `## Roles` fenced yaml block beside `## Risk tiers` (`:84-108`), not commented out: `roles.product_owner`, `roles.engineer`, `roles.lead`, `roles.policy_owner`, `roles.platform_owner`, each a list of git `user.name` values | the role map is policy, REVIEW.md is where policy already lives and `parse_block` already reads this flat subset (`risk-classify.py:659-713`) |
| `plugins/pro-ai-sdlc/commands/intent.md` | after writing the file, run `factory.py level <dir>` and write its answer into `level:`; say the level and why in the report (`:83`) | the model must not pick the level |
| `plugins/pro-ai-sdlc/commands/spec.md`, `plan.md` | on start run `factory.py level <dir>`; when it raises, write the new level into intent.md in the same commit | a raise can come from what the spec or plan discovers |
| `plugins/pro-ai-sdlc/commands/execute.md` | after each step's commit append that commit's test files to `.claude/test-lock` in the worktree (stage 5, after `:134`); print `test lock: <n> files` | safety rule 3 |
| `plugins/pro-ai-sdlc/scripts/protect-tests.py` | a second marker: when `<root>/.claude/test-lock` exists, an edit to a path listed in it is flagged the same way (`:21-40`); new test files stay free | locking from the first test on, not only in fix mode |
| `plugins/pro-ai-sdlc/scripts/production-gate.py` | `gh pr merge` and `gh api merge` (`:91-97`) are left to pro-ship's merge-gate when it is installed (sibling lookup as `pr-check.py find_sibling`, `:475-500`); without pro-ship they stay flagged | today both hooks fire on one merge; in enforce the production gate asks even for a low tier, which a headless run cannot answer, so level 1 could never merge |
| `plugins/pro-core/commands/pro-dev.md` | step "Create the folders and the review policy" (`:196-203`) also fills the `## Roles` block with `git config user.name` in every role; `/pro-dev check` prints the role map | a solo repo must work with zero hand edits |
| `docs/loop-records.md` | a fifth record, the factory run (section below) | mieruka needs the run state and the stop reason, which no file holds |
| `tests/mieruka-sync.mjs` | load one factory run record too | the contract test for every record |
| `.gitignore` guidance in `pro-dev.md:207` | add `.claude/test-lock` | untracked marker |

New:

| Piece | What it is | Why no existing piece can be it |
|---|---|---|
| `plugins/pro-ai-sdlc/scripts/factory.py` | stdlib Python, four subcommands: `level <intent dir>` (prints the level and reasons, exit 0 unchanged, 3 raised, 2 could not run), `next --repo` (the oldest accepted level 1 intent with no spec.md on the default branch, or nothing), `run <intent dir>` (lock file, `claude -p "/pro-ai-sdlc:auto <dir>"`, cost cap, writes the record), `record <intent dir> --state ... --reason ...` | the level rule has to be deterministic (safety rule 1), `risk-classify.py` needs a diff (empty range is could-not-run) so it cannot grade an intent; nothing in `plugins/` runs `claude -p` today (grep confirmed) |
| `plugins/pro-ai-sdlc/commands/auto.md` | the unattended stage driver for one level 1 intent; Opus like `/execute` (`execute.md:4`) | `/spec` and `/plan` interview a person (`spec.md:66` "show it to the person"); they stay as they are and `/auto` writes the short versions itself, then calls the unchanged `/execute`, `/review` and `/pr-babysit` through the Skill tool |
| `tests/e2e-sdlc.mjs` plus `tests/e2e-sdlc/scenarios/*.json` and `checks.mjs` | the e2e (section 5) | `tests/loop.mjs` has no roles, no gates, no merge, no deploy |
| `docs/factory.md`, `docs/factory-demo.md` | guide and demo script | docs |
| `docs/decisions/0024-escalation-levels.md` | levels, the role map, "only raised", deploy stays human | a rule other work follows |

Factory run record (added to `docs/loop-records.md`):

| Field | Value |
|---|---|
| `kind` | `doc` (as the incident record, `loop-records.md:83`), confirmed against mieruka's kind list at spec time |
| `artifact_kind` | `factory-run` |
| `artifact_key` | the intent folder name |
| `evidence_key` | `factory-<intent folder name>` |
| `status` | `info` while running, `pass` when merged, `partial` when stopped at a gate (level raised), `fail` on an error |
| `summary` | `level 1: merged <short sha>, deploy is yours` or `stopped: level raised to 2 at merge (tier medium: <signal ids>)` |
| `detail_json` | `level_at_intake`, `level_now`, `state` (`queued`, `spec`, `build`, `review`, `merge`, `merged`, `stopped`, `error`), `stage`, `reason`, `branch`, `pr_url`, `cost_usd`, `session_id`, `started`, `updated` |

Local copy `.pro-dev/factory/<evidence_key>.json`, rewritten on every state change; mieruka copy by the drop rule.

### mieruka

Reused unchanged: the stage derivation from files (`apps/web/src/service/change-progress.ts:154`), the file reads (`change-sync.ts:133-138`, `:197`), the next-command map `/pro-ai-sdlc:spec`, `:plan`, `:execute` (`change-sync.ts:255-260`), the evidence store (`spdd-evidence.ts:10-12`), `approve_spec` (`advance/route.ts:87-105`), `approve-plan`, the acceptance gate (`gate/route.ts:87`), the Ship page readers (`features/ship/records.ts`), the intent watcher (`intent-watcher.ts:18`), `js-yaml` (`apps/web/package.json:65`).

Changed:

| File | Change |
|---|---|
| `apps/web/src/app/api/cards/[id]/gate/route.ts:66` | `mergePr` adds `--match-head-commit <head sha>` (it reads the head with `gh pr view --json headRefOid` first); today's command is denied by merge-gate in enforce at medium and high, the same defect `intent/2026-10-30-p0-hardening/intent.md:39` records for `/merge-pr` |
| the gate routes (`advance`, `worktrees/[id]/approve-plan`, `gate`) | refuse with 403 when the identity does not fill the gate's role; the response names the role and its names |
| `features/build/ChangeProgressPanel.tsx`, the card | level badge from `intent.md` frontmatter; a level 1 card shows the factory run state and no buttons until `merged` |
| `features/settings/SettingsView.tsx` (near `FactoryRolesSection`, `:262-316`) | a People section: the role map from REVIEW.md and a "You are" picker |
| `features/ship/DeployPanel.tsx` | after a level 1 merge the panel says "deploy is yours" with the tag command and the `/pro-ship:deployed` step |

New:

| Piece | What |
|---|---|
| `packages/core/src/human-roles.ts` | zod `HumanRoleMapSchema` (five roles, each `string[]`) and `IdentitySchema` (`{ name }`) |
| `apps/web/src/service/human-roles.ts` | reads `## Roles` from REVIEW.md with js-yaml (fenced block under the heading, as `risk-classify.py:715-730` finds it), reads `identity.name` from `~/.mieruka/config.json` (default `git config user.name`), answers `fills(role)` |
| `apps/web/src/service/factory-record.ts` | reads the `factory-run` manifest for a card from the evidence store, like `features/ship/records.ts:176` does for deploys |
| `apps/web/src/service/factory-trigger.ts` | when the watcher sees an accepted level 1 intent with no spec.md and no factory record, runs `python3 <pro-ai-sdlc install>/scripts/factory.py run <dir>` once; the install path comes from the same lookup `/pro-dev` uses (`aiSdlcInstallPath`, `pro-dev.md:52`) |
| `apps/web/tests/e2e/factory.spec.ts` | the twin (section 5) |

Not changed in mieruka: the agent role catalog (`packages/core/src/roles.ts:19`, `templates/roles.json`) stays as it is; human roles are a separate schema because a human has no runtime, model or authority.

### agent-skills

Nothing is forked.
The baseline's `/build auto` is the one autonomous mode it has ("the only human gate; after approval, run autonomously", `commands/build.toml`) and its stop conditions (auth, destructive migrations, payments, deletions, deploys, secrets) are already the `/execute` stop list.
Its `/ship` fan-out and GO or NO-GO are already `/pro-ship:ship`.
Its code-reviewer, security-auditor and test-engineer agents are already dispatched by pr-check and ship.
Two baseline rules are adopted as written: doubt-driven-development skips cross-model in a non-interactive run and never invokes an external CLI without authorization (`skills/doubt-driven-development/SKILL.md:161-165`, already in the fork at `plugins/pro-ai-sdlc/skills/doubt-driven-development/SKILL.md:55-56`).
The second is constraint-driven-development's "in unattended runs a warning nobody reads is a warning, so block" (its Step 6), which is the reason level 1 runs with the gates in enforce for that session (section 3).
Dropped with a reason: none.

## 3. Level 1 with nobody present

Trigger, runnable on a laptop today:

```bash
# one terminal, foreground; stops with ctrl-c
while true; do python3 "$SDLC/scripts/factory.py" run --next --repo ~/Projects/some-repo --max-cost-usd 5; sleep 300; done
```

`$SDLC` is the pro-ai-sdlc install path (`claude plugin list --json`, the `installPath` of `pro-ai-sdlc@pro-dev-skillset`).
Alternatives that run the same line: `/loop 5m` in an open session, a launchd or cron entry, or mieruka's trigger service.
No service, no queue file: the queue is `git log` of the default branch.

What `factory.py run` reads and does:

| Step | What | Where it stops |
|---|---|---|
| 1 | `git fetch origin`; list `intent/*/intent.md` on `origin/<default>` with `status: accepted`, `level: 1`, no `spec.md`, no `.pro-dev/factory/factory-<folder>.json`; take the oldest | nothing to do: exit 0 silently |
| 2 | `factory.py level <dir>` from the files at `origin/<default>` (never the working tree): raise when `source:` is not `idea` or `incident <id>`, when `author:` is not in `roles.product_owner` or `roles.engineer` of REVIEW.md at `origin/<default>`, when `risk:` is medium or high, when the intent text names a stop-list category (`execute.md:41-45` words) or a new dependency; when raised, write the level into intent.md on a short branch, open a PR for it and write the record `stopped` | a raise: the person continues at level 2 or 3 |
| 3 | lock `.pro-dev/factory/<folder>.lock` (pid, started); refuse when held | a second runner |
| 4 | `claude -p "/pro-ai-sdlc:auto <dir>" --output-format stream-json --verbose --model opus --max-turns 200 --dangerously-skip-permissions` in a copy of the environment with `CLAUDE_GUARD_DIR` pointing at a folder whose `mode` reads `enforce`; `RELEASE_APPROVAL` unset | cost cap reached (`total_cost_usd` per result event, as `loop.mjs:138`) |
| 5 | write the record from the session's last line of the form `factory: <state> <reason>` | always |

The enforce folder for the session is the point: in enforce, `protect-tests` exits 2, `floor-guard` denies, `merge-gate` denies medium and high under `bypassPermissions` (`merge-gate.py:50-57`) and `production-gate` asks, which denies headless.
The maintainer's own `~/.claude/hooks/mode` stays untouched, so the warn-mode week for interactive sessions is not disturbed.

What `/auto` may do, in order (each line printed as `factory: <state>`):

1. `factory.py level <dir>` again; stop at `stopped` on a raise.
2. Write `spec.md` from the template with `Status: accepted`, `Flagged concerns: None found` with the sources checked; if any concern would be flagged, write it, set the level to 2 in intent.md and stop (`stopped`, reason `spec: flagged concern`).
3. Write `plan.md` with `Status: approved`, `Approver: factory, level 1 (role map: <product owner names>)`, `Stop-list categories: none`; if any step would touch a category, stop with level 2 (`stopped`, reason `plan: stop list <category>`).
4. Commit spec and plan together on a short branch `<slug>-brief` off `origin/<default>`, push, open a PR, `gh pr merge --squash --match-head-commit` it (a Markdown-only diff is low; `risk-classify.py` excuses `.md` from path and size signals); this is the "intent, short spec and plan in one commit" of the agreed table and it leaves the plan tracked and approved, which `execute-gate.py:54-64` requires.
5. Skill `pro-ai-sdlc:execute <plan>`; it runs as today with its unattended rules; a stop inside it is `stopped` with the stage it printed.
6. Skill `pro-ai-sdlc:review <pr>`; an Important finding is fixed in the worktree and pushed; a second round with an Important finding left is `stopped`, reason `review: important findings`.
7. Skill `pro-ai-sdlc:pr-babysit`; stop after its three rounds is `stopped`.
8. `python3 <pro-ship>/scripts/risk-classify.py --base origin/<default> --head HEAD --intent <dir> --json`; exit 0 continues; 3 or 4 raise the level (2 or 3), write it into intent.md on the branch, push and stop; 2 stops as `could not run`.
9. `gh pr merge <n> --squash --match-head-commit <head sha>`; merge-gate allows low; the production gate leaves merges to it.
10. `factory: merged <sha>, deploy is yours`; the record is `pass`.

What it may never do: deploy, tag, publish, push to the default branch, edit REVIEW.md or `.claude/`, lower a level, pass `--no-verify`, read an env file (`execute.md:26-36` is copied into `/auto`).

## 4. Mieruka

Human roles setting:

| Item | Where | Shape |
|---|---|---|
| The role map | `REVIEW.md` `## Roles` block in the project repo, read-only in mieruka v1 | `roles.product_owner: [name]` and four more keys, a list of git `user.name` values |
| Who is at the keyboard | `~/.mieruka/config.json` `identity: { name }` | written by the Settings "You are" picker, default `git config user.name` |
| In core | `packages/core/src/human-roles.ts` | zod, exported like `./roles` |
| In the UI | Settings, a People section under "Agents and models" (`SettingsView.tsx:241`) | one row per role with its names; the picker; a line "edit REVIEW.md to change who fills a role" |

Mapping to REVIEW.md is the identity: mieruka parses the same block the factory and `risk-classify.py` read, so one file is the truth for the plugin, the gates and the UI.

Gates:

| Gate | Where today | Role that may act | Level 1 |
|---|---|---|---|
| Approve intent | in flight, `intent/2026-11-03-approve-intent-button` (spec accepted, no plan) | product owner, engineer | the same button; after it the factory trigger fires |
| Approve spec | `advance` `approve_spec` (`advance/route.ts:87`) | product owner; at level 3 disabled until every flagged concern row reads closed, which the policy owner does | none, written by `/auto` |
| Approve plan | `worktrees/[id]/approve-plan`, `approvePlanText` (`change-run.ts:288`) | engineer; at level 3 the lead too (two `Approver:` names) | none |
| Merge | `gate` `approve` (`gate/route.ts:134`) | engineer at level 2, lead at level 3 | none; the card shows the run state |
| Deploy | Ship page | engineer | "deploy is yours" after `merged` |
| Accept at validate | Validate stage | product owner | product owner, after deploy |

A button is enabled when `fills(role)` is true for the identity; otherwise it shows "waits for <role>: <names>".
Every action goes through the commands and files as today (status flips committed, `gh pr merge` with the pin); nothing new is computed in mieruka.

What mieruka reads: `intent.md` frontmatter `level:` and `status:`; `spec.md` and `plan.md` status lines as today; `REVIEW.md` `## Roles`; the `factory-run` manifest under `.mieruka/evidence/factory-<folder>/evidence.json`; the deploy and preflight records as today.
The session trace shows no skills today (`features/session-trace/` has no skill reference); a `Skill` tool call appears as a generic `tool_call`.
Deferred with a reason: labeling Skill calls in the trace is a nice-to-have that the factory does not need to work; it is listed under follow-ups.

Coordination with the other session: the intent, spec and plan PRs for this work branch off `main` and name `intent/2026-11-03-approve-intent-button` as a dependency for the Approve intent gate; the gate-role change to `advance/route.ts` waits until that intent's build merges, so the two never edit the same route in flight.
The dirty tree and the two worktrees are left alone.

## 5. The e2e and its mieruka twin

`tests/e2e-sdlc.mjs`, from `tests/loop.mjs`:

| Part | From loop.mjs | Changed |
|---|---|---|
| Host side, Docker, API key, GH token, ref under test, `--max-cost-usd`, transcripts folder | `:81-105` | `--scenario 1,2,3`, `--github` (default on, see below), `--local` for a cheaper run that stops at the open PR, `--keep` |
| Marketplace add and install | `:144-151` | installs pro-core, pro-ai-sdlc, pro-ship, pro-quality only; pro-core for `/pro-dev install` then disabled with `claude plugin disable` so the loop runs without it |
| Fixture | `scaffold.sh` (`:23`, `:156`) | the same tiny-tasks repo plus `## Ship` with a `tag-release` target (`tag_pattern: "v*"`) in CLAUDE.md and a `## Roles` block with four role names |
| Origin | local bare (`:158-161`) | default: a throwaway private GitHub repo `sdlc-e2e-<stamp>` made with `gh repo create --private`, deleted at the end unless `--keep`; `--local` keeps the bare remote |
| Stage driver | `claude -p` with `--resume` (`:123-141`) | each gate answer is a `claude -p` turn or a git commit made as the role (`git -c user.name="<role name>"`), so the role driver is the same table in every scenario |
| Checks | `:225-239` | deterministic only, in `tests/e2e-sdlc/checks.mjs` |

The origin default flips from the agreed local bare remote to GitHub because a pull request, `merge-gate.py`, `pr-check`'s PR marker and `gh pr merge` only exist there; a local bare remote proves nothing about auto-merge.
`loop.mjs` already needs a GitHub token for the private marketplace (`:83`), so the dependency is not new.
`--local` stays for the cheap smoke that ends at the open PR.

Scenarios (`tests/e2e-sdlc/scenarios/<n>.json`: intent text, role, gate answers, expected level, expected stop):

| n | Who | Intent | Level | Path | Deterministic checks |
|---|---|---|---|---|---|
| 1 | product owner | "list tasks sorted by title" | 1 | `/intent` as the PO (one `claude -p` turn plus scripted answers), accept, `factory.py run --next` | `level: 1` in intent.md; brief PR merged; one build branch; main untouched until the squash; `.pro-dev/ship/pr-check.json` result pass with `reviewers.verifier`; PR merged by `gh pr merge` with the pin (`gh pr view --json mergeCommit`); record `pass` with `deploy is yours`; `warn.log` has no `would-` line from the session's enforce folder; no tag yet |
| 2 | engineer | "bug: a task with an empty title is accepted" | 1 | same as 1 | the first build commit adds a test and no `src/` change (`git show --stat`); `.claude/test-lock` listed that file; a scripted "weaken the test" turn inside the run is refused (`warn.log` `protect-tests block`); merged |
| 3 | engineer, then policy owner and lead | "export tasks to a file under EXPORT_DIR" | 3 | `/intent`, level 3 (secrets category); `/spec` as engineer; policy owner closes the flagged concern by commit; PO accepts; `/plan`; engineer and lead approve (two names); `/execute` stop-list consent in Risks; `/review`; lead merges with the pin; engineer runs `/pro-ship:ship`, tags `v1.1.0`, pushes the tag, runs `ship.py deployed --target app --env production --commit <sha> --outcome succeeded`; then `/incident "export wrote an empty file"` | `level: 3` and never lower; commit authors at each gate equal the role map names; `Approver:` has two names; PR not mergeable by the engineer alone (merge-gate text in the transcript); tag on origin; `.pro-dev/ship/preflight.json` GO; deploy record `pass`; `intent/<date>-<slug>/incident.md` plus a fourth intent with `source: incident` and `level` >= 2 |
| all | | | | | `tests/mieruka-sync.mjs` loads one record of each type including `factory-run` |

The mieruka twin, `apps/web/tests/e2e/factory.spec.ts` in the mieruka repo:

- Boots a throwaway project with the existing harness (`apps/web/tests/e2e/helpers/agent-project.ts`, a real git repo and `.mieruka/config.json`) pointed at the same fixture the pro-dev-skillset e2e scaffolds, with `PRO_DEV_SKILLSET_ROOT` naming the checkout so the scenario JSON and `checks.mjs` are imported from there, not copied.
- The same role answers are sent through mieruka's routes instead of git: identity set per role in `~/.mieruka/config.json` of the fixture home, then `POST /api/cards/[id]/advance approve_spec`, `POST /api/worktrees/[id]/approve-plan`, `POST /api/cards/[id]/gate approve`; a wrong role expects 403.
- Scenario 1 and 2 expect mieruka's trigger to start `factory.py run` on acceptance and the card to show the run state from the record.
- The same `checks.mjs` runs against the fixture repo at the end, so a pass means the same files, statuses, commit order, stamp, tag and records.

Browser checks with Claude in Chrome, in the mieruka run and the demo (not in CI; `claude-in-chrome` is the person's own browser):

| Page | Check |
|---|---|
| `/settings` | the People section lists five roles with the fixture names and the picker shows the identity |
| the board | the level 1 card has the `auto` badge and no buttons; the level 3 card shows "waits for policy owner: <name>" on Approve spec |
| the card after the run | the run state reads `merged, deploy is yours` |
| `/ship` | the preflight GO and the deploy record for `v1.1.0` |
| `/build/session/<cardId>` | the trace shows the `/auto` session with its subagents |

Each check is a `find` or `get_page_text` on the page with the expected text, recorded as a line in `docs/factory.md`'s validation table; a screenshot per page goes to the transcripts folder.

## 6. The demo script

Setup once: a repo with `/pro-dev install` done (it fills `## Roles` with the maintainer's git name in every role), `mode` files absent (warn) for the interactive session, `factory.py run --next` in a second terminal on a 60 second loop.

| Step | Run | Expected output |
|---|---|---|
| 1 | `/intent "show tasks sorted by title"` | interview, then `intent/<date>-sorted-tasks/intent.md` committed, report ends `level: 1 (idea, author in product_owner, risk low, no stop-list words)` |
| 2 | edit `status: accepted`, commit, push | the second terminal prints `factory: queued intent/<date>-sorted-tasks` within a minute |
| 3 | watch the second terminal | `factory: spec`, `factory: plan`, `brief PR #n merged`, then `/execute`'s own lines (gate passed, worktree made, baseline green, step 1 of 2 built, verifier, pr-check, PR opened), `factory: review important: 0`, `factory: merged <sha>, deploy is yours`; about 6 to 10 minutes |
| 4 | `gh pr list --state merged --limit 2` | the brief PR and the build PR, both squashed, both by the maintainer's account |
| 5 | `cat .pro-dev/factory/factory-<folder>.json` | `"status": "pass"`, `"state": "merged"`, `cost_usd` |
| 6 | `/intent "bug: an empty title is accepted"`, accept, push | same run; in `git log --stat` the first build commit touches only `test/`; `grep protect-tests ~/.claude/hooks/warn.log` is empty because nothing tried to weaken the test |
| 7 | `/intent "export tasks to a file under EXPORT_DIR"` | report ends `level: 3 (stop-list: secrets, env var)`; the second terminal never picks it up |
| 8 | `/spec intent/<date>-export-tasks/intent.md` | spec with one flagged concern (personal data leaves the process); the command shows it and stops for the person |
| 9 | close the concern in spec.md as the policy owner, set `Status: accepted`, commit | `/plan` writes a plan with `Stop-list categories: secrets (step 2)` and asks for a lead in `Approver:`; set two names, `Status: approved`, commit |
| 10 | `/execute intent/<date>-export-tasks/plan.md` | `stop list: secrets on step 2, consented in Risks`, build, PR opened |
| 11 | `/review`, then `gh pr merge --squash` without the pin | merge-gate warn line: `medium` or `high`, names `--match-head-commit`; with the pin the merge goes through |
| 12 | `/pro-ship:ship`, then `git tag v1.1.0 && git push origin v1.1.0`, then `/pro-ship:deployed` | GO record, ship-gate silent on the tag, deploy record written, `.mieruka/evidence/` copy when mieruka is set up |
| 13 | open mieruka | the two level 1 cards in Done with `auto`, the export card moving through the gates with the owning role on each button, Ship page with the deploy |

## 7. The guide outline (`docs/factory.md`)

| Step | Do | Validate (run, see) |
|---|---|---|
| 1 Install | `claude plugin marketplace add`, install pro-core, pro-ai-sdlc, pro-ship, pro-quality | `claude plugin list` shows the four enabled |
| 2 Set the repo up | `/pro-dev install` | `REVIEW.md` has `## Roles` with your name in every role; `intent/README.md` exists; `/pro-dev check` prints the role map |
| 3 Learn the levels | read ADR-0024 | `python3 $SDLC/scripts/factory.py level intent/<any>` prints a level and reasons |
| 4 Modes | leave `~/.claude/hooks/mode` as it is; the runner uses its own enforce folder | `cat ~/.claude/hooks/warn.log` after a run shows lines tagged with the runner's cwd only |
| 5 First level 1 intent | steps 1 to 5 of the demo | record `pass` |
| 6 A bug at level 1 | step 6 of the demo | test commit first; lock listed |
| 7 A level 3 intent by hand | steps 7 to 12 | each gate names its role |
| 8 Deploy and record | `/pro-ship:ship`, tag, `/pro-ship:deployed` | deploy record under `.pro-dev/ship/deploys/` |
| 9 An incident | `/incident` | `incident.md` plus a new intent at level 2 or higher |
| 10 Mieruka | `mieruka projects import`, Settings People, identity | the board shows the level badges; buttons match your roles |
| 11 The e2e | `node tests/e2e-sdlc.mjs --scenario 1` | `n/n checks passed, cost $x` |
| 12 Stopping and rollback | ctrl-c the runner; `git revert` a squash; the `/ship` rollback plan | the lock file is released; the record of a stopped run says why |

## 8. Ordered work, one PR each

pro-dev-skillset first.

| # | PR | Proves | Depends on |
|---|---|---|---|
| 1 | intent `intent/2026-11-03-software-factory/intent.md`, roadmap "Now" entry | the problem and the levels table are agreed | none |
| 2 | spec, ADR-0024 proposed, the record contract added to `docs/loop-records.md` as a proposed section; security challenge by `security-architect` on the spec (section 9 questions) | the contract mieruka builds against is fixed early | 1 |
| 3 | plan (worktree from here) | the maintainer approves the plan with the challenge answered | 2 |
| 4a | pro-ai-sdlc 0.14.0: templates (`level:`, `## Roles`), `factory.py level` and `record`, `/intent`, `/spec`, `/plan` level hooks, `docs/loop-records.md` final, `tests/mieruka-sync.mjs`, unit tests for `level` (`tests/unit/factory-level.test.mjs`) | a level is computed the same way every time and can only go up | 3 |
| 4b | pro-ai-sdlc 0.15.0: `/auto`, `factory.py next` and `run`, `production-gate.py` merge delegation, `protect-tests.py` test lock, `execute.md` lock writes, hook tests in `tests/sdlc-hooks.mjs` | the riskiest step: a level 1 intent reaches a merged PR headless while a medium diff stops it | 4a |
| 4c | pro-core 0.25.0: `/pro-dev install` fills `## Roles`, `/pro-dev check` prints it | a solo repo needs no hand edit | 4a |
| 5 | `tests/e2e-sdlc.mjs`, scenarios, checks, `docs/evals.md` section with the cost; first run against the 4b branch recorded in `docs/evals.md` | requirement 5 for pro-dev-skillset | 4b, 4c (runs against their branch before merge) |
| 6 | `docs/factory.md`, `docs/factory-demo.md`, `docs/README.md` index, ADR-0024 accepted at the plan's sign-off | requirements 6 and 7 | 5 |

Then mieruka.

| # | PR | Proves | Depends on |
|---|---|---|---|
| 7 | intent in the mieruka repo (human roles, levels, gates by role, factory record, trigger) | agreed scope; names the approve-intent-button dependency | 2 |
| 8 | spec with its ADR (a fourth owner-pressed write is not added; the role map is read-only) | | 7 |
| 9 | plan | | 8 |
| 10a | core `human-roles.ts`, services `human-roles.ts` and `factory-record.ts`, Settings People section, `mergePr` pin | settings and the fixed merge | 9, 4a merged |
| 10b | level badge, gate buttons by role with 403s, factory trigger service, Ship page "deploy is yours" | requirement 4 | 10a, approve-intent-button build merged |
| 11 | `factory.spec.ts` twin plus the Chrome check table in `docs/factory.md` (a small PR back in pro-dev-skillset) | requirement 5 for mieruka, requirement 9 | 10b, 5 |

Parallel: 4a and 4c together; 5's harness skeleton (host side, fixture, GitHub origin, checks for scenario 3's human path) alongside 4b; 7 to 9 as soon as 2 merges; 10a alongside 5.
Riskiest: 4b.
Its proof is scenario 1 passing twice on the branch plus one deliberate medium diff stopping at `merge`.

Before each build PR that touches a command: the reminder from CLAUDE.md applies, `node tests/run-evals.mjs pro-ai-sdlc` (about $4 to $7 on Sonnet, `docs/evals.md:128`) runs only on a yes.

## 9. Risks, security challenge, open questions, costs

Risks:

| Risk | Mitigation |
|---|---|
| Level 1 is only as safe as `factory.py level` | stdlib, reads `origin/<default>` not the tree, unit tests per rule; `risk-classify.py` on the real diff is the second deterministic check before the merge |
| `author:` is `git config user.name` (`intent.md:13` context), which anyone can set | in a solo repo the write permission on the default branch is the real check; for a team the open question below |
| A repo file steers `/auto` (prompt injection) into editing REVIEW.md or lowering a level | REVIEW.md and `intent.md` `level:` are read from `origin/<default>`; a diff touching REVIEW.md or `.claude/` is a `hook-scripts` or policy signal and reads medium or high (`risk-classify.py` path signals), so the merge stops |
| Removing the production gate's merge check thins defense in depth | only when merge-gate is installed and found; `tests/sdlc-hooks.mjs` has a case for both |
| A headless `ask` denies and the run loops | `--max-turns`, the cost cap and `/auto`'s rule that a denied tool call is a stop |
| `mergePr` without the pin in mieruka | fixed in 10a; without it the twin fails at level 2 in enforce |
| The other mieruka session edits `advance/route.ts` | 10b waits for that build |
| The e2e creates GitHub repos | token with repo scope only, name prefix `sdlc-e2e-`, deleted in `finally`, `--keep` to inspect |

Questions for `security-architect` (challenge mode on the spec, before PR 3):

1. A level 1 session runs with `--dangerously-skip-permissions` and the gates in enforce; which tool call that no gate covers could do harm? Is `--allowedTools` a better fence than bypass?
2. `author:` equals a spoofable git name; is "the intent commit is on the default branch" enough for a solo repo? What should a team require (signed commits, GitHub author of the intent PR)?
3. Can repo content read during `/auto` (README, test output, a fixture) turn into an instruction that lowers the level, edits the role map or consents to a stop-list category, given REVIEW.md and the level are read from `origin/<default>`?
4. Leaving `gh pr merge` to merge-gate: what does production-gate lose? Is a missing merge-gate detected safely?
5. The brief PR (spec and plan, Markdown only) is self-merged as low; can a Markdown-only PR carry anything the build then trusts (plan steps, `Stop-list categories: none`, `Approver:`)?
6. The factory record and lock file are written by the runner and read by mieruka; can a crafted record make mieruka merge or skip a gate?
7. The test lock lists paths in `.claude/test-lock`; can a new test file shadow a locked one (same name, new folder) and is floor-guard enough as the backstop?
8. The e2e's throwaway GitHub repo: token scope, cleanup on crash, what a leaked fixture would expose.

Open questions for the maintainer:

1. The e2e's default origin becomes a throwaway GitHub repo because merge-gate and auto-merge need a pull request; `--local` stays for the cheap smoke to the open PR. Accept the flip?
2. `production-gate.py` stops flagging `gh pr merge` when pro-ship's merge-gate is installed. Accept, or keep both and have level 1 run with `RELEASE_APPROVAL=1` (which also waves through pushes to main, so not recommended)?
3. For a team repo, is a spoofable `author:` acceptable for level 1 until signed commits are required (ADR-0024 would record the choice)?
4. Mieruka's role map is read-only in v1 (edit REVIEW.md by hand). Fine for now?

Costs per run, Sonnet for the role driver turns and Opus for `/auto` and `/execute` as they declare (`execute.md:4`):

| Run | Cost | Time |
|---|---|---|
| `node tests/e2e-sdlc.mjs --scenario 1` | about $5 to $8 | 15 to 25 minutes |
| `--scenario 2` | about $5 to $8 | same |
| `--scenario 3` (gates, deploy, incident) | about $8 to $14 | 30 to 40 minutes |
| all three, default `--max-cost-usd 30` | about $18 to $30 | about an hour |
| `--local --scenario 1` smoke to the open PR | about $3 to $5 | 10 minutes |
| mieruka twin, all three | the same tokens plus a local server; about $20 to $30 | about an hour |
| `node tests/run-evals.mjs pro-ai-sdlc` after 4a and 4b | about $4 to $7 | 20 minutes |

On demand only, never in CI; each run's numbers go into `docs/evals.md` as the loop test's do (`docs/evals.md:162-163`).

## 10. What the brief got wrong

| Brief said | Found |
|---|---|
| `/sdlc-init` is a pro-ai-sdlc command | removed in #65 (`97558ea`); setup is pro-core's `/pro-dev install` (`pro-dev.md:161`). The Skill tool's listing of `pro-ai-sdlc:sdlc-init` comes from a stale installed cache, so standalone setup needs pro-core installed for that one step |
| `/pro-ship:ship` and `/pro-ship:deployed` are commands | both are skills (`plugins/pro-ship/skills/ship`, `skills/deployed`); the only command is `/pro-ship:install` |
| pro-ai-sdlc hooks are protect-tests and production-gate | plus the Stop hook `plan-sync.py` (`hooks.json:25-34`); protect-tests fires only with `.claude/fix-mode`, `.claude/.fix-task` or `SDLC_TASK_KIND=fix` (`protect-tests.py:18-29`) |
| `lessons.py` writes lessons into CLAUDE.md or AGENTS.md | it writes only `.pro-dev/review/`; the `/review` session adds the agent-file line after a yes (`review.md:104-107`) |
| the e2e runs with a local bare remote and merges | a local remote has no pull request, so merge-gate, the pr-check marker and `gh pr merge` cannot run; the default has to be GitHub (open question 1) |
| `tests/loop.mjs` installs the SDLC | it installs pro-core, pro-ai-sdlc and pro-egm (`:148`) and does not check that a PR opened |
| mieruka "lets people act at the gates" through the same commands | its stage runner uses the Agent SDK `query` with the `claude_code` preset (`change-run.ts:5`, `:119`), not `claude -p`; the twin drives routes, not a CLI. Its merge runs `gh pr merge --squash --delete-branch --yes` with no pin (`gate/route.ts:66`), which merge-gate denies in enforce at medium and high |
| the "How work flows here" block is a template read by commands | it is generated prose in `pro-dev.md:183-193`; no command or script reads it |
| agent-skills' shipping skill holds the hard rule that deploy stays human | it does not; the rule is the playbook's and `/build auto`'s stop list is the baseline's only human gate. The plan records the rule in ADR-0024 |
| the enforce decision covers the gates | `intent/2026-10-30-p0-hardening/enforce-decision.md` lists four gates and not ship-gate; its spec still reads `status: draft` while the intent is `done` |
| mieruka's settings has a role catalog UI to extend | `FactoryRolesSection` is a read-only table of agent roles (`SettingsView.tsx:262-316`); human roles need a new schema, not a row in `roles.ts` |
