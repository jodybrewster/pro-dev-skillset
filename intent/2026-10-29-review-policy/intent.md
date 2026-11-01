---
source: idea
kind: change
status: done
risk: medium
created: 2026-10-29T19:00:00-0400
author: Jody Brewster
---

# Intent: review policy and convergence rules

Author: Jody Brewster (pro-dev-skillset).
Source: idea, items 5 and 6 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md), from the "REVIEW.md template changes" and "Convergence" sections of the [pro-ship brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md) and the comparison with [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT).
Status: done; shipped in #82.
Created: 2026-10-29.

## Problem

The review policy every repo gets is thin and it has no memory of earlier rounds.
`/pro-dev install` writes pro-ai-sdlc's `REVIEW.md` template into each new repo and every reviewer reads it.
Today the template has three passes, a severity rule, a nit cap and a do-not-report list.
It does not ask what failure looks like in this repo or which paths to skip.
It does not require evidence as a file and line, so a reviewer can guess from a name.
It has no way to say that a bug was already there before the change.
Its report ends with a tally and never says plainly that there is nothing to fix.

The larger gap is convergence.
The brainstorm puts it this way: "The article's worst case was an agent author and an agent reviewer going more than fifty rounds overnight."
Noise costs more with agent authors because each nit becomes another commit and another round.
`/pr-babysit` is that loop and stops at five rounds.
The `reviewer` agent and `/review` look at the whole diff every time, so a second round re-reads code the first round already cleared and can raise the same finding again.
A class of bug is reported one instance at a time, so each instance costs its own round.
Old bugs in code the PR did not touch can block a PR that did not cause them: the brainstorm cites that 59% of what the article's reviewer kept flagging was old code.
This happens on every PR in every repo that uses the loop.
It gets worse as more of the author work is done by agents.

## Proposed outcome

A repo that installs the loop gets a `REVIEW.md` that says what failure looks like here, which paths to skip, that every finding carries file and line evidence from reading the code and that old bugs are tagged Pre-existing.
The review report starts with the count and says plainly when there is nothing to fix.
The template can also offer, as optional rows, the design-smell list and the presumptive blockers from agent-skills.
Review rounds converge.
After the first full review, later rounds look only at the new commits.
A finding is never raised twice and a class of bug is named once with every instance listed, so one round fixes them all.
Pre-existing findings are listed but do not block.
`/pr-babysit` stops after three rounds and asks Jody to reconsider the approach.
The same rules sit in the `reviewer` agent, `/review` and `/pr-babysit` themselves, so they hold in repos whose `REVIEW.md` predates this change.

## Affected users and systems

Jody and any agent session in a repo that installs pro-ai-sdlc: JJ, mieruka, personal-site, gemini-live and this repo.
pro-ai-sdlc: `templates/REVIEW.md`, `agents/reviewer.md` and its Codex twin `.codex-plugin/agents/reviewer.toml`, `commands/review.md`, `commands/pr-babysit.md`, both manifests and the marketplace entry.
Repos that already have a `REVIEW.md` written from the old template keep it until they update it by hand.
Later, the sibling intents that read these rules: the `code-reviewer` agent, `/pro-ship:pr-check` with its stamp and the risk tiers.

## Constraints

The version-bump law, Codex parity and the hook-loading law in this repo's `CLAUDE.md`; no hook changes here.
The reviewer stays read-only with fresh context and gets no earlier findings.
The brainstorm settles that: "The reviewer stays fresh; pr-check dedupes its output against the earlier stamp afterwards, so the reviewer never sees earlier findings."
So the dedupe belongs to the caller and not to the reviewer.
The template already caps nits and has a do-not-report list; those stay.
Template section names the checks read stay as they are.
The design-smell list and the presumptive blockers are optional rows and are never required by default.
Forked or adapted text from agent-skills keeps its footer and a row in `docs/licenses.md`.
Nothing here may invent a number: the round cap of three is the brainstorm's proposal and goes to Jody as an open question.

## Out of scope

The new detailed `code-reviewer` agent in pro-quality and its four-field handoff, owned by intent/2026-10-29-code-reviewer.
`/pro-ship:pr-check`, its stamp and the `gh pr create` hook, owned by intent/2026-10-29-pr-gate.
The risk classifier, approval tiers, the optional tier table and sensitive paths in `REVIEW.md`, owned by intent/2026-10-29-risk-tiers.
`CONSTRAINTS.md` and the floor guard, owned by intent/2026-10-29-constraint-floor.
The machine-readable scaling block in `REVIEW.md` (roadmap item 21, later).
Rewriting a repo's existing `REVIEW.md` for it.
This repo's own `REVIEW.md`, which is its policy and not the template.

How these rules reach the later work: the convergence rules also bind `pr-check` and the `code-reviewer` agent.
`pr-check` does the cross-round dedupe against its stamp and applies the same cap.
`code-reviewer` reads the same `REVIEW.md` and uses the same Pre-existing tag and class naming.
Those intents spec that; this one only keeps its rules written so they can be reused as they stand.

## Success looks like

A review of a clean diff opens with a count of zero and the words "Nothing to fix".
Nothing else needs reading.
A second `/review` round on the same PR, run with the previous head as its starting point, reports only problems in the new commits.
A bug found in five places is reported once as a class with five locations.
A finding on a line the PR did not add is tagged Pre-existing and does not appear in the important count.
`/pr-babysit` on a PR that will not converge stops at round three and says so.
Over a couple of weeks of normal PRs, Jody does not see the same finding twice or a Pre-existing finding blocking a merge.

## Open questions

- The round cap: three (the brainstorm's proposal) or the five that `/pr-babysit` has today (recommendation: three, with the cap counting every round, since the point is to stop and reconsider).
- Whether the report's count moves from the end to the start (recommendation: yes, one summary line first, since the brainstorm asks for a summary that starts with the count).
- Where the "already raised" list lives between rounds when nothing like the pr-check stamp exists yet (recommendation: the calling session keeps it for its own run while cross-session memory waits for the stamp in the PR gate intent).
- Whether `/pro-dev install` or `/pro-dev update` should offer to refresh an older `REVIEW.md` (recommendation: not here; the agent and commands carry the rules so an old file still works).
- Whether the design-smell list and presumptive blockers ship as commented optional blocks in the template or as a sidecar file (recommendation: commented blocks in the template, because a sidecar adds a path the reviewer must find).
- Likely needs an ADR: the convergence rules (a finding is never raised twice, old bugs never block, a fixed round cap) are a rule that every reviewer and gate in the marketplace must follow and that would be expensive to change once repos depend on it.

## Evidence

None; this is an idea.
Sources: the "Convergence, the lesson that matters most for agents" and "REVIEW.md template changes" sections of `intent/2026-10-28-pro-ship-scope/brainstorm.md`; roadmap items 5 and 6 and the agent-skills deltas table in `docs/roadmap.md`.
Our gap: `plugins/pro-ai-sdlc/commands/pr-babysit.md` loops at most five rounds and has no rule against repeats; `plugins/pro-ai-sdlc/agents/reviewer.md` has no Pre-existing tag and no class rule; `plugins/pro-ai-sdlc/templates/REVIEW.md` has no failure-in-this-repo section.
