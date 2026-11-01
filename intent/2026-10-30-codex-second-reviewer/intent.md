---
source: idea
kind: idea
status: done
risk: medium
created: 2026-10-30T10:00:00-0400
author: the maintainer
---

# Intent: Codex as a second reviewer on high-risk PRs

Author: the maintainer.
Source: idea, item 13 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md) and feature 5 of the [pro-ship brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md) ("maybe use codex for code review as well").
Status: done; shipped in #99.
Created: 2026-10-30.

## Problem

One model reviews every PR here.
`code-reviewer` runs on Opus with a fresh context, but a single model family has blind spots that a second read from another family would catch.
On a high-risk change (a hook, a workflow file, a gate script) a missed bug costs the most and the review is the last check before the maintainer approves.
Today the high tier only changes how deep the one reviewer looks and how loudly the merge gate asks.
Nobody sees whether a second model agrees.
The pieces for a second read already exist.
`code-reviewer` has a `.codex-plugin/agents/code-reviewer.toml` twin from Codex parity, a four-field handoff ([ADR-0012](../../docs/decisions/0012-review-handoff.md)) and a tier from the classifier ([ADR-0015](../../docs/decisions/0015-risk-tiers.md)).
Nothing runs the twin.
The stamp has no place to record a second reviewer.

## Proposed outcome

On a high-tier PR, `pr-check` runs the Codex counterpart of `code-reviewer` in parallel with the Claude reviewers, from the same four-field handoff.
The PR body and the stamp list findings per reviewer.
A finding both models raise is marked stronger.
A finding only one model raises is shown with its source.
When the two disagree, both views appear as they are and neither side settles it.
A repo or person without Codex sees one line saying the Codex review was skipped.
The gate behaves exactly as it does today.
Codex is an opt-in engine row that `/pro-dev install` asks about, so installing and logging in to it is a choice made once.

## Affected users and systems

The maintainer and any agent session in a repo that uses `pr-check` (pro-ship) and the reviewer (pro-quality).
`pro-quality`: the `code-reviewer` agent and its `.toml` twin, which must stay in step.
`pro-ship`: the `pr-check` skill and script, the PR body draft and the stamp contract in [docs/pr-check-stamp.md](../../docs/pr-check-stamp.md), including its fixtures and the two copies of the validity rule in pro-ship and pro-security.
`pro-core`: a new row in `plugins/pro-core/registry/engines.json` and `/pro-dev install`, under [ADR-0006](../../docs/decisions/0006-engine-registry-and-pro-dev.md).
`REVIEW.md` or `.claude/pro-dev.json`, if the trigger is configurable.
Codex itself: its install, its login and the usage it spends.
Ranked item 12 (doubt-driven `/execute`), which also wants a cross-model option through the Codex CLI.

## Constraints

The Codex reviewer gets the same four fields and nothing else, so it is fresh context by construction and obeys the rules of ADR-0012.
It is read-only: it never edits, commits, approves or comments, as the `.toml` already states.
Codex is optional and never a hard dependency.
ADR-0003 forbids a hard dependency on a plugin from another marketplace and ADR-0006 says an owning plugin must not depend on pro-core.
A missing CLI, a missing login, a timeout or malformed output is reported as skipped or could-not-run and never reads as a clean review.
It never fails the gate on its own account, because the person did not choose the tier and a tool outage must not block a merge.
The high tier triggers it by default because it adds time and usage.
The tier comes from the classifier, so the author cannot lower it to avoid the second look (ADR-0015).
The diff goes to a second vendor when Codex runs, so the opt-in answer is also the consent for that.
An engine installs only when a person runs `/pro-dev` and says yes, never from a hook or a plugin update.
The stamp change must be an added optional field so `schema` stays 1 and the readers ignore what they do not know.
Both copies of the validity rule and the fixtures change in the same commit if any reader rule changes.
The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md` apply.
Findings are never merged by a model call that picks a winner.

## Out of scope

Codex's own GitHub PR review integration (kept as a later alternative in the brainstorm).
Running the Codex security review; the security reviewer stays Claude only.
A Codex review at the medium tier or on every PR.
A third reviewer or a skeptic pass that tries to refute findings.
Letting Codex approve, fix or push.
Running the reviewers in GitHub Actions; that is item 16 (`pipeline`).
The doubt-driven step of item 12 itself, beyond agreeing on the shared runner.
Installing or logging in to Codex on the person's behalf outside `/pro-dev install`.

## Success looks like

On a real high-tier PR in this repo the stamp and the PR body show a Codex review beside the Claude one, with each finding tagged by who raised it.
A finding both raised is visibly marked and a disagreement is shown with both views.
On a machine with no Codex the same PR gets the one-line skip note and a normal stamp.
`/pro-dev install` offers Codex as a no or default-off row and `/pro-dev check` reports whether it is present.
Over the first several high-tier PRs the maintainer can say whether the second read found anything the first missed.
That is the measure of whether the added time and usage are worth keeping.

## Open questions

- How the Codex run is invoked: `codex exec` with the handoff as the prompt and the `.toml` instructions, or a dedicated review subcommand if one fits better. The brainstorm notes the CLI was not on `PATH` when it was written although `~/.codex/` exists, so the spec has to find how it installs and how a custom agent file is loaded. Recommendation: `codex exec` in a read-only sandbox with the handoff paths, decided after a spike that runs it once on a past PR.
- How the output is parsed. The Claude reviewer's first line is a tally (`important: <n>  nits: <n>  ...`). Recommendation: the `.toml` keeps the same tally line and the same finding layout so one parser reads both.
  A missing tally means could-not-run.
- Where the second reviewer sits in the stamp. Options are a third key under `reviewers` or an optional `reviewers.codex` object. Recommendation: an optional `reviewers.codex` with the same fields plus `agreed` and `disputed` counts, `schema` stays 1.
  The result rule treats it as informational so a Codex outage never turns `pass` into `incomplete` and its findings do not block (the person reads them at the approval prompt). Revisit if Codex proves reliable.
- Whether a Codex Important finding should block. Recommendation: no, not at first; show it and let the person weigh it at the merge prompt, since agreement is the signal and a lone finding from a model the maintainer has not yet calibrated is noise-prone.
- How agreement is decided. Matching by file and line range is cheap but misses the same bug described at two lines. Recommendation: match by file and an overlapping line range deterministically, list the rest as raised by one model and never use a model to merge them.
- The trigger. Recommendation: the high tier, with a `codex-review: always | high | never` setting in `REVIEW.md` or `.claude/pro-dev.json`, default `high`.
- Where the Codex runner lives so item 12 can reuse it. Recommendation: one small script in pro-ship that takes an agent name and the handoff and prints the raw result, with pr-check as its first caller. Item 12 would then call the same script from pro-ai-sdlc, which cannot import pro-ship, so the spec should decide between a copy kept in sync like the stamp rule or a home in pro-core.
- Which plugin owns the registry row. The roadmap names pro-quality and pro-core. Recommendation: pro-core holds the row because the engine serves two plugins, with pro-ship and pro-ai-sdlc detecting it by the binary and not depending on it. Whether the row belongs to the `owner` of pr-check (pro-ship) is a question for the spec because an owner also ships `/<plugin>:install`.
- What the registry `kind` is. Existing kinds are `skills-cli`, `npx`, `claude-plugin` and `uv-tool`, none of which installs and logs in to a CLI. Recommendation: a new kind with a detect-only check and a printed install line, since the login step cannot be run for the person.
- How the `.toml` stays a true twin of the `.md` over time. Recommendation: a check in `tests/check.mjs` that the two bodies match apart from the frontmatter, if parity does not already assert it.
- Likely needs an ADR: a second reviewer from another vendor that is advisory in the gate, how it is recorded in the stamp and what counts as agreement.

## Evidence

None; this is an idea.
Sources read: the Codex section of [the pro-ship brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md), the Detail section of item 13 in [docs/roadmap.md](../../docs/roadmap.md), `plugins/pro-quality/agents/code-reviewer.md` and its `.codex-plugin/agents/code-reviewer.toml` twin, [ADR-0012](../../docs/decisions/0012-review-handoff.md), [ADR-0015](../../docs/decisions/0015-risk-tiers.md), [docs/pr-check-stamp.md](../../docs/pr-check-stamp.md), [ADR-0006](../../docs/decisions/0006-engine-registry-and-pro-dev.md), `plugins/pro-core/registry/engines.json` (no Codex row yet) and [docs/codex-parity.md](../../docs/codex-parity.md).
Item 13 depends on item 3 (`code-reviewer`), which shipped in P0.
Item 12 shares the Codex CLI and is the other consumer of a runner.
