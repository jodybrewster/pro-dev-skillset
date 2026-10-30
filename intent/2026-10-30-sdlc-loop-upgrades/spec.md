---
intent: intent/2026-10-30-sdlc-loop-upgrades/intent.md
intent-status: draft
status: accepted
created: 2026-10-30T11:46:40-0400
author: Jody Brewster
---

# Spec: SDLC loop upgrades

Built from `intent.md` in this folder (commit 0821453).
Status: accepted (Jody approved the batch on 2026-10-30 and asked that it go through spec, plan and execute).
Policies and skills consulted: `CLAUDE.md` (the three laws and the layering rule), `REVIEW.md`, `docs/decisions/` (ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0013 and ADR-0015), `docs/licenses.md`, `docs/roadmap.md` (items 7 to 10, 24, 25 and 29), `plugins/pro-ai-sdlc/commands/` (`execute.md`, `spec.md`, `plan.md` and `adr.md`), `plugins/pro-ai-sdlc/templates/` (`spec.md`, `plan.md` and `adr.md`), `plugins/pro-ai-sdlc/agents/verifier.md`, `plugins/pro-ai-sdlc/agents/simplifier.md` and their `.toml` twins, `plugins/pro-ai-sdlc/scripts/execute-gate.py`, `plugins/pro-ship/scripts/risk-classify.py`, `plugins/pro-ship/skills/risk-tiers/SKILL.md`, `plugins/pro-quality/agents/code-reviewer.md` and `tests/check.mjs` (the `sdlc-contract` check).
No security plugin skill applies; nothing here handles user data or credentials beyond the existing env-file rule, which this spec keeps.

## Summary

Once this ships, the pro-ai-sdlc loop carries the guardrails the P0 builds were missing.
`/execute` pauses for a person before it builds a step that touches auth, migrations, payments, deploys or secrets, records what it noticed outside a step instead of fixing it, stages only the step's files and ends the PR body with "Things I didn't touch" and "Potential concerns".
`/spec` lists its assumptions before it writes, turns vague asks into measurable targets, writes a boundaries block and can split big work through a capability map.
`/plan` sizes every step, splits at four triggers, places checkpoints, puts risky steps early, never overwrites a plan and reviews its own coverage before it shows the plan.
Every plan's `Done` block cites one standing definition of done shipped as `plugins/pro-ai-sdlc/references/definition-of-done.md`.
The verifier checks that the tests a change added are the right tests and its verdict can fall on that.
`/adr` follows a repo's own ADR convention and gains a deprecated status.
The simplifier checks callers and history before it removes anything.
Jody gets it first and any repo with pro-ai-sdlc installed gets it on update.

## Requirements

### Functional

The `/execute` guardrails (roadmap item 7):

- R1. `commands/execute.md` gains a section headed `## Stop list` that names five categories and the path names that signal each, taken from the lists in `plugins/pro-ship/scripts/risk-classify.py`:
  auth (a directory or file stem named `auth`, `login`, `signin`, `signup`, `oauth`, `session`, `sessions`, `permissions`, `rbac`, `acl`, `policies` or `middleware`),
  migrations (a path under `migrations/`, `migrate/` or `drizzle/`, `prisma/schema.prisma`, `schema.sql` or a `.sql` file under `db/` or `database/`),
  payments (a directory or file stem named `payments`, `payment`, `billing` or `stripe`),
  deploys (a `Dockerfile`, a `docker-compose` file, a `.tf` file, a path under `k8s/`, `kubernetes/`, `helm/`, `terraform/`, `pulumi/` or `cdk/`, or a path under `.github/workflows/`)
  and secrets (an env file other than `.example`, `.sample`, `.template` or `.dist`, a `config.`, `settings.` or `env.` file at the root or under `config/`, or a step that adds an environment variable, key or credential).
  A step's text that says it changes one of these (for example "add a migration" or "deploy") also fires.
  Test files and fixtures never fire, as in the classifier.
- R2. The stop list is checked at two points.
  Before the first step it scans the plan's `## Files that change` and the text of every step in `## Order of work`.
  Before each step's commit it checks the names from `git diff --cached --name-only`, because the plan can be wrong.
- R3. When a check fires, `/execute` stops before building (or before committing) that step, prints one line naming the step, the category and the path or phrase that fired and waits for an explicit yes.
  On anything other than yes it stops as any other stop does: it prints the stage, the reason and what the person can do next and keeps the worktree.
  It never blocks without saying why and it is prose in the command, not a hook.
- R4. A step is already consented when the plan's `## Risks` section names its category and the plan header's `Approver:` line names a person (not a placeholder in angle brackets).
  For a consented step `/execute` prints one line and does not pause: `stop list: <category> on step <N>, consented in Risks`.
  Anything the plan did not name pauses.
- R5. The stop list reads path names and plan text only; it never opens an env file, which the `## Secrets` section already forbids.
- R6. When pro-ship's `risk-tiers` skill is available, `/execute` follows that skill at each checkpoint to classify the branch range from `origin/<default_branch>` to `HEAD`.
  A signal with id `auth`, `payments`, `migrations`, `iac`, `workflows` or `env-config` that no consent covers pauses before the next step, as in R3.
  pro-ai-sdlc declares no dependency on pro-ship; without the skill the prose list in R1 is the whole check and the run says the classifier was skipped.
- R7. `commands/execute.md` gains a section headed `## Scope discipline`.
  A problem noticed outside the current step is never fixed in that step.
  It is written as one line (file, what was seen, why it was left) under a `## Noticed but not touched` heading in plan.md, in the same commit as the step.
- R8. The same section sets the staging rule: stage the step's files by path, never with `git add -A`, `git add .` or `git commit -a`.
  It compares `git diff --cached --name-only` with the step's files before each commit.
  A staged file the step did not name is unstaged or kept with a line under `## Departures from plan` saying why.
- R9. The PR body that step 7 of `/execute` writes ends with two parts: "Things I didn't touch" (the plan's `## Noticed but not touched` lines and any neighboring work left out on purpose) and "Potential concerns" (consented stop-list steps, items the verifier could not check and risks seen during the build), each "None" when empty.
- R10. `execute-gate.py`, the worktree step, the env copy, the green baseline, the verifier dispatch and the never-merge line are unchanged.
  The new text sits in the two named sections above plus one-line pointers in steps 5, 6 and 7, so the doubt-driven-execute intent can add its own section without touching these.

The `/spec` changes (items 8 and 29):

- R11. `/spec` gains a step before it writes the draft: list the assumptions the spec would rest on (stack, auth scheme, platforms or browsers, data, scale and who uses it, whichever apply), ask the person to correct them in one message and wait.
  When the person has said to go ahead without questions or no one is there to answer, the assumptions go into the spec marked `unconfirmed` and the report names them.
- R12. In the same step a vague ask in the intent (such as "faster", "simpler" or "more reliable") is turned into a measurable criterion with a proposed target and the person is asked whether the target is right.
- R13. `templates/spec.md` gains a `## Assumptions` section after `## Summary` and a `### Boundaries` subsection after `### Policy constraints applied`, holding three lines: `Always:`, `Ask first:` and `Never:`.
- R14. When an intent spans more than one module or would need more than about fifteen requirements, `/spec` offers a capability map as a yes or no question.
  On yes it writes `<intent dir>/capability-map.md` (a table with a stable module id, the module, its purpose, what it depends on and its place in the build order) and then one `spec-<module-id>.md` per module from the same template.
  On no it writes one `spec.md` as before.
  `/plan`, given a `spec-<module-id>.md`, writes `plan-<module-id>.md` beside it.

The `/plan` changes and the definition of done (item 9):

- R15. `/plan` sizes every step XS, S, M or L and targets XS to S.
  It splits a step that meets a trigger: more than two hours of work, more than three acceptance criteria, "and" in its title or two or more subsystems.
  The triggers are prompts, not hard rules; a step left at L states its reason in the plan.
- R16. `/plan` puts a checkpoint line after every two or three steps (the commands to run and what to confirm) and orders the riskiest steps early, after any failing test they need.
- R17. `/plan` never overwrites an existing plan file; it stops, names the file and suggests editing it or recording a departure.
- R18. Before it shows the plan, `/plan` reviews it: every requirement and acceptance criterion of the spec maps to a step (an unmapped one gets a step or a stated reason), no placeholder is left (angle-bracket fields, TBD, TODO or "fill in") and file, function and flag names match from step to step.
- R19. `plugins/pro-ai-sdlc/references/definition-of-done.md` holds one short standing definition of done.
  A repo's `CONSTRAINTS.md` or `REVIEW.md` takes precedence where it says more.
- R20. `templates/plan.md` keeps every section and the `- Build commit:` line that `execute-gate.py` reads.
  It gains a size and a checkpoint in its `## Order of work` example and a `## Noticed but not touched` section after `## Departures from plan`.
  Its `## Done` block gains one line, `- Definition of done: <met, or the items not met>`, citing pro-ai-sdlc's `references/definition-of-done.md`.
  `/plan` reads the reference file and `/execute` step 6 fills that line.

The verifier's test lens (item 10):

- R21. `agents/verifier.md` gains a step that checks the tests the change added or changed: the scenario list (happy path, empty input, boundary values, error paths and concurrency where it applies), one concept per test, no shared mutable state between tests, mocks only at system boundaries and a test that never fails counted as useless.
  It names pro-quality's `code-reviewer` as holding the same list, without depending on it.
- R22. The verifier's report gains a `Tests` line.
  Missing scenarios for new behavior make the verdict at best `VERDICT: incomplete`; a test that cannot fail makes it `VERDICT: fail`.
  Nothing else about what the verifier runs or how it reports changes.

The P3 riders (items 24 and 25):

- R23. `/adr` looks for existing ADRs before it picks a folder and matches their location, numbering, file extension and headings.
  It falls back to `docs/adr/` only when the repo has none.
  `/spec` step "Draft the ADR" finds the folder the same way.
- R24. `templates/adr.md` and `/adr` gain a `deprecated` status for a decision that no longer holds and has no replacement.
  `/adr` says never to delete an old ADR.
- R25. `agents/simplifier.md` may run `git blame` and `git log` read-only.
  Before it removes or inlines anything it checks the callers (Grep) and the history (`git log` and `git blame`) and leaves the code alone when the history gives a reason.
  It leaves a helper that names a concept even with one caller and does not trade clarity for fewer lines.

Parity, attribution, checks and release:

- R26. `.codex-plugin/agents/verifier.toml` and `.codex-plugin/agents/simplifier.toml` carry the same body as their `.md` twins; the agents stay on `model: sonnet`.
- R27. Adapted text keeps attribution: a footer naming addyosmani/agent-skills (MIT, Copyright (c) 2025 Addy Osmani) on each adapted command, agent and reference file, a pro-ai-sdlc row in `docs/licenses.md` and the Addy Osmani line in `plugins/pro-ai-sdlc/LICENSE`.
- R28. `tests/check.mjs` `sdlc-contract` asserts the new anchors: the two `/execute` sections and their key lines, the plan template's new section and definition-of-done line, the reference file, the spec template's two blocks, the verifier's and simplifier's new rules in both twins and the ADR deprecated status.
- R29. A plugin eval case `execute-pauses-on-migration` scaffolds an approved plan whose step writes a migration not named in Risks and grades that `/execute` pauses, names migrations and opens no PR.
- R30. pro-ai-sdlc takes one minor version bump in both manifests and its marketplace entry, plus one `metadata.version` bump, in one commit.

### Non-functional

- N1. The new prose in agents and the reference file is harness-neutral, since Codex reads the same text.
- N2. Template edits add sections and lines only; existing section names and order stay, so mieruka and `execute-gate.py` keep reading them.
- N3. pro-ai-sdlc declares no new dependency.
- N4. `/execute` stays readable: the two new sections together stay under about forty lines.
- N5. Prose follows the repo's writing rules: one sentence per line, no em dash, no Oxford comma and straight quotes.

### Policy constraints applied

- Version-bump law (ADR-0002): R30, one bump for the batch.
- Hook-loading law (ADR-0003): no hook or script is added, so `hooks/hooks.json` does not change.
- Codex parity (ADR-0004): R26 and N1; commands and templates are Claude-side files and need no twin.
- Layering (ADR-0013): R6 uses pro-ship's skill only when present and R21 points to pro-quality's list without depending on it.
- Risk tiers (ADR-0015): the stop list is a build-time pause and leaves the merge gate to pro-ship.
- Forked or adapted content keeps its footer and its row in `docs/licenses.md` (`CLAUDE.md`): R27.
- Model split (`CLAUDE.md`): the verifier and simplifier stay on Sonnet and `/execute` stays on Opus.

### Boundaries

Always: keep `execute-gate.py` and the never-merge line as they are; bump pro-ai-sdlc once.
Ask first: any change to a template section name or order; any new hook or script.
Never: make pro-ai-sdlc depend on pro-ship or pro-quality; rewrite a committed spec or plan.

## Design

### User experience

A person running `/execute` sees one new kind of stop: `stop list: step 4 touches migrations (db/migrations/002_due.sql). Build it? (yes to continue)`.
A consented step prints one line and carries on.
A plan with no such step runs as before, with one extra status line saying the stop list found nothing.
The PR gains two short parts at the end of its body.

A person running `/spec` gets a numbered list of assumptions and any proposed targets before any file is written and answers once.
The spec they get has an Assumptions section and a boundaries block.
For a big intent they are asked once whether to map modules first.

A person running `/plan` sees sizes beside each step, checkpoint lines between groups and a short coverage note in the plan.
They are told plainly when a plan already exists.

The verifier's report gains one line, for example `Tests: no empty-input or boundary case for overdueTasks; the new test asserts on its own mock`.

### System

All edits are in pro-ai-sdlc, plus `tests/check.mjs`, `docs/licenses.md`, the README files and the marketplace entry.
The stop list reuses the classifier's path names as prose and reuses the classifier itself through pro-ship's `risk-tiers` skill when it is installed.
The classifier takes a git range, not a file list, so it runs at checkpoints on the committed range rather than on the plan's file list.
The definition of done is a new `references/` folder in pro-ai-sdlc, read by `/plan` and `/execute` through `${CLAUDE_PLUGIN_ROOT}/references/definition-of-done.md`.
The scenario list is copied into the verifier rather than shared, until roadmap item 18 decides on a `test-engineer`.
No hook, script, migration or data change.

### Alternatives considered

- Run `risk-classify.py` on the plan's file list before the build: the script takes `--base` and `--head`, not a list; pro-ai-sdlc cannot find pro-ship's script path portably, so the skill runs it at checkpoints instead.
- A hook for the stop list: the intent rules it out for this batch and a hook cannot ask a person mid-build.
- One checklist line per definition-of-done item in `Done`: boxes get ticked by habit; one line that names the failures stays honest.
- Hard split rules in `/plan`: they would fight the parallel tracks that worked in the P0 batch.
- A shared scenario-list file across plugins: pro-ai-sdlc cannot depend on pro-quality.
- Two PRs: the spec, plan and definition-of-done edits share two templates and one version bump.

## Flagged concerns

ADR needed: yes, the batch sets two rules other work must follow: every plan cites one standing definition of done and `/execute` pauses for a person before stop-list steps the plan did not name.
Drafted as [ADR-0017](../../docs/decisions/0017-loop-guardrails.md), status proposed.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent recommends running `risk-classify.py` on the plan's file list, but the script classifies a git range and pro-ai-sdlc cannot locate pro-ship's script without a dependency. | ADR-0013, ADR-0003 | resolved: the prose list scans the plan before the build; pro-ship's `risk-tiers` skill classifies the committed range at checkpoints when installed (R6). |
| 2 | A `/spec` that waits for answers could stall unattended runs such as the `spec-from-intent` eval, which expects a commit within 20 turns. | `plugins/pro-ai-sdlc/evals/spec-from-intent` | resolved: with no one to answer, assumptions are written as `unconfirmed` and the run carries on (R11); the plan runs that eval once. |
| 3 | Module plans named `plan-<module-id>.md` share one branch name, because `execute-gate.py` takes the slug from the folder; the `plan-sync` hook only counts files named `plan.md`. | `scripts/execute-gate.py`, `scripts/plan-sync.py` | resolved for this batch: modules build one at a time in build order and `/spec` says so; if capability maps get real use, split item 29 out and fix both scripts there. |
| 4 | The doubt-driven-execute intent will also edit `commands/execute.md`. | `intent/2026-10-30-doubt-driven-execute` | resolved: this batch adds two named sections and one-line pointers only (R10). |
| 5 | `plugins/pro-ai-sdlc/LICENSE` lacks the Addy Osmani line although `templates/REVIEW.md` is already adapted from agent-skills. | `docs/licenses.md` | resolved: R27 adds it. |
| 6 | The plan's `Status: approved` rests on Jody's approval of the batch, not on a read of this plan. | Jody | open: Jody may want to read the plan before `/execute` runs. |

## Open questions

Every open question in the intent is answered with its recommendation, except where noted.

- Where the stop list's signals come from: the five categories and path names as prose in `/execute`, taken from the classifier's lists (R1); the classifier runs through pro-ship's `risk-tiers` skill when installed, at checkpoints on the branch range rather than on the plan's file list (R6, flagged concern 1).
- Plan file list or growing diff: both, the plan's list before the build and each step's staged files before its commit (R2).
- Whether plan approval is consent: yes for a category the plan's Risks names with an approver in the header; anything else pauses (R4).
- Where noticed notes live: plan.md under `## Noticed but not touched`, copied into the PR body (R7, R9).
- Where the definition of done lives: `plugins/pro-ai-sdlc/references/definition-of-done.md`, short, with `CONSTRAINTS.md` or `REVIEW.md` taking precedence (R19).
- Checklist or one line in `Done`: one line citing the file plus the items not met (R20).
- Hard rules or prompts for splits: prompts, XS to S as the target, a reason for any L (R15).
- Where the capability map goes: `intent/<date>-<slug>/capability-map.md` with one `spec-<module-id>.md` per module (R14, flagged concern 3).
- Verifier alone or shared with the reviewer: the verifier holds the list now with a pointer to `code-reviewer` (R21).
- `fail` or `incomplete` for weak tests: `incomplete` for missing scenarios, `fail` only for a test that cannot fail (R22).
- `git blame` for the simplifier: yes, read-only, with `git log` (R25).
- One PR or two: one PR, with the `/execute` guardrails in the first commits (plan.md orders it).
- ADR: yes, ADR-0017.

No question blocks planning.

## Acceptance criteria

- AC1. The four verify commands in `CLAUDE.md` pass, with no more `tests/check.mjs` warnings than before the change.
- AC2. Removing any one new anchor named in R28 makes `node tests/check.mjs sdlc-contract` fail.
- AC3. `/execute` on an approved plan whose step writes a migration not named in Risks pauses at that step, names migrations and opens no PR (the `execute-pauses-on-migration` eval case, or a manual run of the same scaffold).
- AC4. The same plan with migrations named in Risks and an approver in the header prints the consented line and does not pause at that step.
- AC5. `commands/execute.md` holds the `## Stop list` and `## Scope discipline` sections, the staging rule naming `git add -A`, the `## Noticed but not touched` heading and the two PR-body parts; `execute-gate.py` has no diff.
- AC6. `/spec` holds the assumptions step, the vague-ask rule, the unattended fallback and the capability-map offer; `templates/spec.md` holds `## Assumptions` and `### Boundaries` with `Always:`, `Ask first:` and `Never:`.
- AC7. `/plan` holds the sizes, the four split triggers, the checkpoint and risky-first rules, the never-overwrite rule and the three-part self-review; `templates/plan.md` holds the size and checkpoint example, the definition-of-done line, the unchanged `- Build commit:` line and `## Noticed but not touched`.
- AC8. Handed a spec and a draft plan with one requirement that no step covers, a fresh session following `/plan`'s self-review names that requirement.
- AC9. `plugins/pro-ai-sdlc/references/definition-of-done.md` exists, states the precedence of `CONSTRAINTS.md` and `REVIEW.md` and is cited by `/plan`, `/execute` and `templates/plan.md`.
- AC10. The verifier, handed a diff whose new tests cover only the happy path, reports the missing scenarios on its `Tests` line and does not return `VERDICT: pass`.
- AC11. The verifier and simplifier `.toml` bodies match their `.md` bodies apart from the wrapper and both agents still say `model: sonnet`.
- AC12. `/adr` holds the convention check, the `deprecated` status and the never-delete rule; `templates/adr.md` lists `deprecated`; `/spec`'s ADR step finds the folder the same way.
- AC13. The simplifier allows `git blame` and `git log`, checks callers and history before removal and keeps a helper that names a concept.
- AC14. The adapted files carry the agent-skills footer, `docs/licenses.md` has the pro-ai-sdlc row and `plugins/pro-ai-sdlc/LICENSE` has the Addy Osmani line.
- AC15. pro-ai-sdlc's version agrees across both manifests and the marketplace entry, one minor above `main`; `metadata.version` moved once.
- AC16. ADR-0017 exists with status proposed and a row in `docs/decisions/README.md`.

## Out of scope

The doubt-driven step in `/execute` (item 12) and the untrusted-input rules (item 11).
Codex as a second reviewer (item 13) and required documents per project (item 14).
A separate `test-engineer` agent (item 18).
Turning the stop list into a hook or a merge gate.
Changing what the verifier runs or how it reports outside the `Tests` line.
Fixing `execute-gate.py` and `plan-sync.py` for module plans (flagged concern 3).
Items 23 and 26 to 28 of the P3 batch.
Rewriting specs or plans already committed.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
