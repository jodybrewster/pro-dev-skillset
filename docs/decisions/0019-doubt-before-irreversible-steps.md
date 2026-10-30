# ADR-0019: A hard-to-undo build step gets a fresh-context doubt round before the next step

Date: 2026-10-30

## Status

proposed

Decided by: Jody Brewster.
Source: intent/2026-10-30-doubt-driven-execute/.

## Context

`/execute` builds a whole plan in one long session.
That session turns its own assumptions into facts.
The first fresh read today comes after the build, from the verifier and then from `/review` or the code-reviewer.
By then later steps stand on any wrong choice in a migration, a public API, an auth rule, a deploy config or a delete.
EGM goldfish gives specs and plans a fresh read; nothing does it for a decision made during the build.
A reviewer that sees the author's claim tends to agree with it, which is why ADR-0012 bars author prose from every handoff.
pro-ai-sdlc cannot depend on pro-quality or pro-ship (ADR-0013), so it cannot reference pro-quality's handoff template or import pro-ship's Codex runner.

## Decision

When `/execute` finishes a step that is hard to undo, the main session runs the `doubt-driven-development` skill on that step's commit: before the next step for a step the plan marks, before the next group for a step the classifier raises.
A step is hard to undo when the plan marks it `irreversible`.
When pro-ship is installed, the risk classifier is a backstop at the checkpoints `/execute` already has, never per step: a high tier on the group's own range (since the previous checkpoint, not the cumulative range, and not from the size signal alone) makes every undoubted step in it a candidate, offered to the person in an interactive run and doubted without a question in an unattended one.
The plan marker always triggers doubt; the classifier adds steps only on a high tier.
A classifier run that did not happen is printed as `classifier could not run: <reason>` and listed under "Potential concerns".
The reviewer is a fresh subagent, never a fork.
It receives a fixed adversarial instruction text and the four fields of ADR-0012 (`range`, `brief`, `policy`, `risk`) and nothing else.
The author's claim, reasoning and earlier findings never reach it.
The session reconciles each finding against the diff, keeps the dedupe list itself and stops after three rounds; open findings after three rounds stop an interactive run for the person.
An unattended run finishes the build and opens the pull request as a draft with the open findings under "Potential concerns".
The same holds when two rounds in a row raise findings and none is actionable.
A Codex second opinion is the person's choice in each round, confirmed per exact command, never offered in a non-interactive run and never reported as clean when it could not run.
pro-ai-sdlc keeps its own `handoff.md` with the same four fields.
This is the accepted exception to ADR-0012's single template (Jody, 2026-10-30), amended into ADR-0012: a check in `tests/check.mjs` fails when it names different fields from pro-quality's or drops its closing line.
pro-ai-sdlc keeps a byte-identical copy of `plugins/pro-ship/scripts/codex-run.py`; the `doubt` check fails on any difference.
The plan's Done section records each doubted step in one line in the session's words.

## Consequences

A risky decision gets an independent read while it is still cheap to change.
A step with no marker and no high-tier checkpoint runs exactly as before.
A marked step costs one to three Opus dispatches, plus a Codex run when the person asks.
An unattended build whose doubt rounds did not converge still ends in a pull request, opened as a draft with the open findings listed.
Two handoff templates and two runner copies exist, so a change to either contract edits both in one commit.

What must stay true:

- The reviewer's input has no slot for the claim; the `doubt` check fails on any placeholder in the instruction text.
- The dispatch is never a fork of the session.
- No more than three rounds per step.
- A doubted step with open findings after three rounds never ends in a ready PR.
- Codex runs only on a per-run yes and its failure is shown as could-not-run.
- The two runner copies match byte for byte.

Revisit if the plan marker proves too rare to catch real problems or the classifier backstop fires so often that people stop answering it.
Also revisit if pro-quality's handoff moves to a plugin pro-ai-sdlc may depend on.

## Alternatives considered

- Dispatch pro-quality's `code-reviewer`: it ignores text outside the four fields, so it would drop the adversarial wording; pro-ai-sdlc also cannot depend on it.
- Doubt every non-trivial step as the upstream skill does: branching logic and module boundaries fire on most steps and the build would never finish unattended.
- Reference pro-quality's handoff template: it breaks the layering rule; a checked copy keeps one shape without the dependency.
- Put the runner in pro-core and look it up: a lookup into another plugin's install folder is fragile; a checked copy has none.
- Make cross-model automatic on a high tier: it sends code to a second vendor without a person's yes.

## Where it is enforced

- `plugins/pro-ai-sdlc/skills/doubt-driven-development/` (`SKILL.md`, `doubt-instructions.md`, `handoff.md`).
- `plugins/pro-ai-sdlc/commands/execute.md`, the `## Doubt` section.
- `plugins/pro-ai-sdlc/commands/plan.md` and `templates/plan.md`, the `irreversible` marker and the `Doubt:` line under Done.
- The `doubt` and `handoff` checks in `tests/check.mjs`.
