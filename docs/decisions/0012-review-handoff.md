# ADR-0012: Every reviewer dispatch hands over four fields from one template

Date: 2026-10-30

## Status

accepted (2026-10-30)

Amended 2026-10-30 by ADR-0019: a second template is allowed when a sync check holds it to the same four fields and closing line.

Decided by: the maintainer.
Source: intent/2026-10-29-code-reviewer/.

## Context

A new Claude Code subagent starts with an empty context.
pro-quality's old `requesting-code-review/code-reviewer.md` was a prompt template with a `{DESCRIPTION}` field for "what you built".
That field is where the author's reasoning leaks into the reviewer.
The rule is that the code reviewer has fresh context as well.
The template broke it.
The author is usually an agent that is blind to its own assumptions, so a reviewer that reads the author's account inherits the same blind spots.
Several callers in the marketplace dispatch a reviewer.
Each could grow its own template and its own fields.
`pro-ai-sdlc:reviewer` stays as `/review`'s narrow policy gate.

## Decision

Every reviewer dispatch in the marketplace hands over exactly four fields:

- `range`: the base and head shas.
- `brief`: paths to the intent, spec, plan or issue, which state what was asked for.
- `policy`: paths to `REVIEW.md`, the agent file and `CONSTRAINTS.md` when present.
- `risk`: the tier or `unclassified`, plus the pr-check stamp path when it exists.

A dispatch never carries an author description, a PR body, a session summary or earlier findings, so the read stays fresh.
The brief is allowed because it records the request, not how the author reasoned.
There is one template, `skills/requesting-code-review/handoff.md` in pro-quality.
The `handoff` check in `tests/check.mjs` enforces it.
pro-quality's `code-reviewer` agent (Opus, read-only) is the detailed reviewer.
`pro-ai-sdlc:reviewer` stays.

## Consequences

The reviewer judges the diff against what was asked and the repo's policy, not against the author's story.
Every caller builds the same four fields, so a gate, a command and a skill dispatch the same way.
A re-run after new commits passes the same four fields with a new base sha.
The caller filters repeats after the reviewer returns.

What must stay true:

- The handoff has four fields and no more.
- No field holds author-written prose about the change.
- The reviewer is never run as a fork of the session, since a fork inherits the whole context.
- There is one handoff template; a caller references it and does not copy it, except that a plugin that cannot depend on pro-quality may keep a second template under a sync check (ADR-0019).

Revisit the decision if the caller-side filter cannot stop repeated findings across rounds, which would push toward a fifth field, or if Claude Code or Codex ship a built-in fresh-context review that makes the template redundant.

## Alternatives considered

- Keep the `{DESCRIPTION}` template: it is the leak this decision closes.
- Add a fifth prior-findings field: earlier findings anchor the reviewer on the first read, which breaks the fresh-context rule; the caller filters repeats instead.
- One template per caller: the templates would drift and the check could not hold them to one field list.

## Where it is enforced

- `plugins/pro-quality/skills/requesting-code-review/handoff.md`, the template, and `plugins/pro-ai-sdlc/skills/doubt-driven-development/handoff.md`, the one second template, held to the same fields and closing line by the `doubt` check.
- The `handoff` check in `tests/check.mjs`, which fails when the field list is not exactly `range`, `brief`, `policy` and `risk`, when a placeholder is named `description`, `summary`, `findings`, `claim` or `reasoning`, or when `code-reviewer.md` names different fields.
- `plugins/pro-quality/agents/code-reviewer.md` and its Codex twin, which name the same four fields and ignore other handoff text.
- `plugins/pro-quality/skills/requesting-code-review/SKILL.md` and the callers that dispatch through it.
