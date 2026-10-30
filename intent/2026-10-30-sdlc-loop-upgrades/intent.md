---
source: idea
kind: change
status: draft
risk: medium
created: 2026-10-30T09:00:00-0400
author: Jody Brewster
---

# Intent: SDLC loop upgrades

Author: Jody Brewster (pro-dev-skillset).
Source: idea, the "loop batch" of the ranked list in [docs/roadmap.md](../../docs/roadmap.md): items 7, 8, 9 and 10, with 24, 25 and 29 riding along, from the comparison with [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT).
Status: draft.
Created: 2026-10-30.

## Problem

The P0 review stack is shipped, so a diff now gets a floor guard, a fresh-context reviewer, a risk tier and a gate stamp.
The stages before review have not moved.
`/execute` runs a whole approved plan unattended and opens a PR.
It has no stop list.
A task that touches auth, a migration, payments, a deploy or secrets gets built with the same calm as a rename.
Nothing tells the builder what to do with a problem it notices outside the task, so it either fixes it (scope creep) or says nothing (the reviewer never hears of it).
Commits are written per step, but no rule says to stage only the step's files.
The PR body links the intent and lists acceptance criteria, but it has no "things I didn't touch" or "potential concerns" part, so a reviewer cannot tell scope discipline from luck.

The spec stage has the same shape.
`/spec` goes from intent to draft in one move, so a wrong assumption (the stack, the auth scheme, the browsers) surfaces in review or after.
Vague asks such as "faster" stay vague.
`templates/spec.md` has no boundaries block, so what an agent may always do, must ask about or never do is not written down.

The plan stage shows it most.
Every plan built in the P0 batch was written without a split rule.
The departures sections say what that cost: constraint-floor needed 18 steps in four tracks plus a serial tail, pr-gate carried 22 steps with a long list of review findings.
Risk-tiers needed 22 steps.
Nothing said when a step was too big, so steps grew until a review pass found six or more Important problems per plan.
There is no checkpoint rule, so risky work was not forced early.
The `Done` block was hand-written each time.
No standing bar sits behind it.
Each plan decided for itself what finished means, apart from its acceptance criteria.
Plans also carry no self-review for spec coverage or placeholders.
`/plan` step 3 asks four questions that never check that every requirement has a step.

The verifier is the last gap.
It runs the verify command and exercises the change and its two nearest neighbors.
It never asks whether the tests are the right tests.
The `code-reviewer` agent already walks a test scenario list (happy path, empty input, boundaries, error paths, concurrency), so the check exists in review but not in the build loop, where the verifier is the only fresh pair of eyes before the PR.

Three small items share the same stage files.
`/adr` uses `docs/adr/`, else `docs/decisions/`, else creates `docs/adr/`.
It does not read a repo's own convention (numbering, file extension, headings), it has no Deprecated status and nothing stops an old ADR from being deleted.
The simplifier removes code with no check on why it exists and it has no guard against over-simplifying.
It may already run `git log`, but not `git blame`.
`/spec` has no route for work too big for one spec.

This reaches every feature that goes through the loop, in this repo and in any repo that installs pro-ai-sdlc.

## Proposed outcome

`/execute` stops and asks before it builds a task that touches auth, migrations, payments, deploys or secrets.
It says which signal fired.
It records what it noticed outside the task under a "noticed but not touching" note instead of fixing it.
It stages only the files of the step it is committing.
The PR body ends with "Things I didn't touch" and "Potential concerns".
The scripted gate, the worktree, the green baseline, the verifier and the rule never to merge are unchanged.

`/spec` lists its assumptions and gets them corrected before it writes the draft.
It turns a vague ask into measurable criteria and asks whether the targets are right.
The spec template carries an Always, Ask first and Never block.
For big work `/spec` can offer a small capability map first (a module table with stable ids and a build order) and then write one spec per module.

`/plan` sizes each step and splits at the triggers: more than two hours of work, more than three acceptance criteria, "and" in the title, or two or more subsystems.
It puts a checkpoint every two or three steps and the risky steps early.
It never overwrites a plan that is already unfinished.
Before it shows the plan it checks spec coverage (every requirement and acceptance criterion maps to a step), scans for placeholders and checks that names stay consistent between steps.
The plan's `Done` block cites one standing definition of done kept as a pro-ai-sdlc reference, so every change meets the same bar apart from its own acceptance criteria.

The verifier asks, for the tests the change added, whether they are the right tests: the scenario list, one concept per test, no shared mutable state, mocks only at system boundaries and a test that never fails counted as useless.
Its report gains a line for that and its verdict can fall on it.

`/adr` matches the repo's existing ADR location, numbering, extension and headings.
It adds a Deprecated status and a rule never to delete an old ADR.
The simplifier checks callers and history before it removes anything and leaves alone a helper that names a concept.

## Affected users and systems

Jody and any agent session that runs the loop: this repo and any repo with pro-ai-sdlc installed (opt-in, not part of `pro-dev-starter`).
pro-ai-sdlc: `commands/execute.md`, `commands/spec.md`, `commands/plan.md`, `commands/adr.md`, `templates/spec.md`, `templates/plan.md`, `templates/adr.md`, `agents/verifier.md` and `agents/simplifier.md`, a new `references/` folder, the Codex counterparts of the two agents, the manifests and the marketplace entry (pro-ai-sdlc is at 0.9.0, marketplace `metadata.version` 1.64.0).
`docs/licenses.md`, because the text is adapted from agent-skills.
Routing cases and `tests/check.mjs`, which read the templates and frontmatter.
Read, not changed: `plugins/pro-ship/scripts/risk-classify.py` already detects auth, payments, migrations, infrastructure, deploy and secrets paths.
`plugins/pro-quality/agents/code-reviewer.md` already holds the scenario list.
`plugins/pro-ai-sdlc/scripts/execute-gate.py` is the gate `/execute` keeps.

## Constraints

The three laws in this repo's `CLAUDE.md`.
One PR and one version bump for the whole batch: pro-ai-sdlc moves once in both manifests and its marketplace entry, plus `metadata.version`, in the same commit (version-bump law).
If a new script or hook is added, it lives in the plugin's `hooks/hooks.json` and is tracked by git (hook-loading law).
The edited agents keep a `.toml` counterpart that matches (Codex parity).
The new prose stays harness-neutral.
pro-ai-sdlc declares no dependency on pro-ship or pro-quality.
[ADR-0013](../../docs/decisions/0013-plugin-layering.md) keeps layers apart.
So the `/execute` stop list may reuse the classifier's path names but cannot require the plugin.
Companions are optional.
The stop list fires on the task's paths and the plan's text before the build, never on the contents of env files, which `/execute` already never opens.
The stop list is a pause for a person.
It never blocks silently and it is not a hook in this batch.
Template edits keep the section names and order that tools read; additions go in as new sections or lines.
Adapted text keeps its upstream footer and a row in `docs/licenses.md` (MIT, Copyright (c) 2025 Addy Osmani).
Jody's rule that Opus orchestrates, Sonnet builds and Haiku reads is unchanged: the verifier and simplifier stay on Sonnet.

## Out of scope

The doubt-driven step in `/execute` (item 12) and the untrusted-input rules (item 11), which are P1 items of their own.
Codex as a second reviewer (item 13) and required documents per project (item 14).
A separate `test-engineer` agent, which item 18 decides.
Turning the stop list into a hook or a merge gate; the risk tiers in pro-ship already gate the merge.
Changing what the verifier runs or how it reports its verdict outside the new tests line.
Items 23 and 26 to 28 of the P3 batch.
Rewriting plans or specs already committed.

## Success looks like

An `/execute` run on a plan with a migration step pauses at that step, names the signal and waits.
A run on a plan with no such step finishes as before with no extra pause.
Each step's commit holds only that step's files.
The PR body of a build has the two new parts.
A `/spec` run prints its assumptions first and the written spec has the boundaries block.
A new plan splits any step that meets a trigger, shows a checkpoint every two or three steps and names a definition of done in its `Done` block.
A trial plan with a requirement that has no step is caught by the self-review.
The verifier, handed a diff whose tests only cover the happy path, says so and does not return `VERDICT: pass`.
In the next two or three loop runs the plans show fewer departures that trace to a step that was too big, which is the sign the split rule works.

## Open questions

- Where the stop list's signals come from.
  Recommendation: write the five categories and the path names into `/execute` as prose, taken from the classifier's lists.
  Run `risk-classify.py` on the plan's file list when pro-ship is installed.
  That keeps the layering and still uses the better detector when it is there.
- Whether the stop list reads the plan's `Files that change` or the diff as it grows.
  Recommendation: the plan's file list before the build and a check of each step's staged files before its commit, since the plan can be wrong.
- Whether a person who approved the plan with a risky step already gave consent.
  Recommendation: yes for steps the plan names in its Risks section with an approver in the header; the pause stays for anything the plan did not name.
- How the "noticed but not touching" notes are kept.
  Recommendation: collect them in plan.md under a new `Noticed but not touched` heading and copy them into the PR body, so they survive the session.
- Where the definition of done lives.
  Recommendation: `plugins/pro-ai-sdlc/references/definition-of-done.md`, adapted from upstream and kept short, with a repo's `CONSTRAINTS.md` or `REVIEW.md` taking precedence where they say more.
- Whether the plan's `Done` block gains a checklist line per definition-of-done item or one line that cites the file.
  Recommendation: one line that cites the file plus the items that failed, so the block stays short and no checkbox is ticked by habit.
- Whether the split triggers are hard rules or prompts.
  Recommendation: prompts in `/plan` with the sizes XS to S as the target.
  The plan states a reason for any step left at L, because a hard rule would fight the parallel tracks that worked in the P0 batch.
- Whether the capability map is a committed file and where it goes.
  Recommendation: `intent/<date>-<slug>/capability-map.md` beside the intent, with one `spec-<module-id>.md` per module, so `/spec` and `/plan` find them without a new root file.
  This is the part of the batch most likely to grow; if it does, split item 29 out.
- Whether the test-design lens belongs in the verifier alone or is shared with the reviewer through one file.
  Recommendation: put the scenario list in the verifier now and leave a pointer to the `code-reviewer` list, since pro-ai-sdlc cannot depend on pro-quality; unify when item 18 decides on a `test-engineer`.
- Whether a weak tests finding from the verifier sets `VERDICT: fail` or `incomplete`.
  Recommendation: `incomplete` for missing scenarios on new behavior and `fail` only for a test that cannot fail, so the verdict keeps its meaning.
- Whether the simplifier gets `git blame` through its Bash allowance.
  Recommendation: yes, read-only, with `git log` for the history of a symbol; it needs both for the Chesterton check.
- Whether this is one PR as set or two (execute, spec and plan first, verifier and the P3 items after).
  Recommendation: one PR as set, because the spec, plan and definition-of-done edits share two templates and one version bump, but order the plan so the `/execute` guardrails land in the first commits.
- Likely needs an ADR: a standing definition of done that every plan cites, plus a stop list that pauses unattended builds.
  Other work must follow both.
  The pause is a new rule for `/execute`.

## Evidence

None; this is an idea.
Upstream reference, all at agent-skills commit `eb07f19`: `commands/build.toml` (stop list and staging, lines 34 to 39), `skills/incremental-implementation/SKILL.md` ("noticed but not touching", lines 126 to 133), `skills/git-workflow-and-versioning/SKILL.md` (change summaries, lines 191 to 209), `skills/spec-driven-development/SKILL.md` (assumptions, boundaries, success criteria and the capability map), `skills/planning-and-task-breakdown/SKILL.md` (sizing and split triggers, lines 125 to 187), `references/definition-of-done.md`, `agents/test-engineer.md`, `skills/documentation-and-adrs/SKILL.md` (lines 36 to 44) and `skills/code-simplification/SKILL.md` ("Maintain Balance").
Our state today: `commands/execute.md` has no stop list and no staging rule; `templates/spec.md` has no assumptions or boundaries; `templates/plan.md` has no sizes, checkpoints or definition of done and there is no `references/` folder in pro-ai-sdlc; `agents/verifier.md` has no test lens; `commands/adr.md` falls back to `docs/adr/` with no convention check.
P0 builds, "Departures from plan" in `intent/2026-10-29-constraint-floor/plan.md` (a step 18 review that found six Important problems), `intent/2026-10-29-pr-gate/plan.md` and `intent/2026-10-29-risk-tiers/plan.md` (each a long list of review findings in a plan with 18 or more steps) and `intent/2026-10-29-code-reviewer/plan.md` (the `Done` block filled by hand against an AC list).
