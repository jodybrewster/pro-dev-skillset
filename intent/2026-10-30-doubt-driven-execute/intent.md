---
source: idea
kind: idea
status: draft
risk: medium
created: 2026-10-30T09:20:53-0400
author: Jody Brewster
---

# Intent: doubt-driven step in /execute

Author: Jody Brewster (pro-dev-skillset).
Source: idea, item 12 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md), from the comparison with [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `doubt-driven-development` (MIT).
Status: draft.
Created: 2026-10-30.

## Problem

`/execute` builds a plan step by step in one long session.
The context of that session turns assumptions into facts without anyone noticing.
Some steps are hard to undo: a data migration, a public API change, an auth rule, a deploy config or a file delete that other code depends on.
A wrong choice there is cheap to catch while the step is open and expensive once later steps and a merged PR stand on it.
Today the first fresh look comes after the build, from the verifier and then from `/review` or the code-reviewer on the finished diff.
By then the commit history has grown on top of the decision.
EGM goldfish already gives a fresh-context review of a spec or a plan.
Nothing does it for a decision made during the build.
It happens on any plan with a risky step, which is rare per plan but costly when it lands.

## Proposed outcome

When `/execute` reaches a step that is hard to undo, the decision does not stand until a fresh-context reviewer has tried to break it.
The reviewer gets the artifact and its contract only.
It never gets the author's claim that the artifact is right or the reasoning behind it, so it cannot simply agree.
It is told to find problems and not to validate.
The session reads each finding against the artifact, fixes the real ones, records the trade-offs it accepts and goes again.
It stops after three rounds at most and hands the person what is still open.
The person can ask for a second opinion from another model through the Codex CLI.
The step then continues and the plan records which steps were doubted and what came back.

## Affected users and systems

Jody and any agent session that runs `/execute` in a repo with pro-ai-sdlc installed.
pro-ai-sdlc: a new skill, a short offer step in `commands/execute.md`, Codex parity files, manifests and marketplace entry.
The four-field handoff in pro-quality (`skills/requesting-code-review/handoff.md`, ADR-0012), which this reuses as its contract.
`plugins/pro-ship/scripts/risk-classify.py`, if it decides which steps count as hard to undo.
Ranked item 13 (Codex as a second reviewer), which may share the Codex runner.
`docs/licenses.md`, routing cases and `tests/check.mjs`.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
Subagents cannot spawn subagents, so the step runs in the main session and never inside a builder subagent.
`/execute` runs on Opus as the builder, so it can dispatch the reviewer itself.
The reviewer starts with an empty context.
It receives no author description, no session summary and no earlier findings, the same rule as ADR-0012.
The contract is paths to the plan step, the spec, the intent and the policy files, never a paraphrase.
At most three rounds, as in ADR-0011 and the upstream skill.
The session keeps the list of findings already raised and drops repeats; the reviewer is not given that list.
Three rounds with substantive findings go to the person and are not a reason for a fourth.
A big artifact is split and not given more rounds.
The cross-model option is always the person's choice and never automatic.
It runs in a read-only sandbox with the prompt piped through stdin, never interpolated into a shell argument.
It is checked for presence and a working binary first.
A failure is shown and never swallowed into a single-model result.
The person's authorization covers one exact command, so each run is confirmed.
A run that is not interactive skips the cross-model option and says so.
"Could not run" must never read as a clean review.
Forked or adapted text keeps its upstream footer and a row in `docs/licenses.md` (MIT, Copyright (c) 2025 Addy Osmani).
Env files stay unread, as in the `/execute` secrets section.

## Out of scope

Doubting every step; mechanical edits, renames and one-line changes are skipped.
Replacing the post-build verifier, `/review` or the code-reviewer.
Doubt on specs and plans, which EGM goldfish already covers.
Making Codex a second reviewer on high-risk PRs, which is item 13.
Installing the Codex CLI.
Gemini or any other second model.
A hook that blocks a commit until a doubt round has run.

## Success looks like

On a plan with a risky step, `/execute` stops before that step stands and shows what the fresh reviewer found.
The plan's Done section lists the steps that were doubted, the rounds used and how each finding was settled.
In a few weeks of real runs Jody can point to at least one change that a doubt round caught before it was built on.
Steps that are not hard to undo run with no extra pause.
The reviewer's prompt never contains the author's claim, which a check can confirm by reading the skill.

## Open questions

- What counts as hard to undo.
The upstream skill lists branching logic, a module boundary, an unverifiable property and irreversible blast radius, which would fire often.
Recommendation: let `/plan` mark steps as irreversible in the plan.
Let `/execute` also run `risk-classify.py` on the staged diff and offer doubt on a high tier or a strong signal.
The plan marker is the person's call and the classifier is the backstop.
Jody to confirm.
- Offer or automatic.
The roadmap says `/execute` "offers" the step.
`/execute` runs with no pause by design.
Recommendation: for a step the plan marks, run it with no question (the plan already asked); for a step the classifier raises, pause and offer.
- How the contract maps onto the four fields.
A mid-build artifact has no commit range yet.
Recommendation: reuse `brief`, `policy` and `risk` as they are.
Set `range` to the uncommitted diff for the step or to the base and head of the step's commit once committed.
Whether the handoff template needs a note for a decision that is not code (a migration plan, a config choice) is for the spec.
- Which reviewer.
The pro-quality `code-reviewer` is written to give a balanced verdict and the upstream skill says to override that with an issues-only prompt.
Recommendation: a doubt prompt in the skill, sent to the `code-reviewer` agent or a plain subagent, with the adversarial wording pasted verbatim.
- The Codex runner.
Item 13 needs `codex exec` too.
Recommendation: build one small runner script once, in pro-core or pro-quality, that checks the binary, pipes a prompt file through stdin and uses a read-only sandbox; this intent and item 13 both call it.
If item 13 is not built first, ship the runner here and let item 13 reuse it.
Where Codex lives as an engine row in `/pro-dev install` is also open.
- Home of the skill.
The roadmap says pro-ai-sdlc, which owns `/execute`.
Recommendation: pro-ai-sdlc, with the runner outside it so pro-ai-sdlc keeps no hard dependency on another plugin.
- What the plan records.
Recommendation: a short line per doubted step under Done, written by the session in its own words, with no pasted reviewer output.
- Whether goldfish and doubt share a loop.
Recommendation: keep them separate, since goldfish reviews documents and doubt reviews a build decision; note the link in the skill.
- Likely needs an ADR: the rule that a hard-to-undo step in `/execute` gets a fresh-context review before it stands, plus the shared Codex runner contract.

## Evidence

None; this is an idea.
Upstream reference: `skills/doubt-driven-development/SKILL.md` in agent-skills (MIT, Copyright (c) 2025 Addy Osmani): the CLAIM, EXTRACT, DOUBT, RECONCILE and STOP cycle, the rule that the reviewer never sees the claim and the cross-model section.
Our gap: `plugins/pro-ai-sdlc/commands/execute.md` has no review step before the verifier.
The goldfish bridge in `commands/spec.md` and `commands/plan.md` covers documents only.
Related: [ADR-0011](../../docs/decisions/0011-review-convergence.md), [ADR-0012](../../docs/decisions/0012-review-handoff.md) and ranked item 13 in the roadmap.
