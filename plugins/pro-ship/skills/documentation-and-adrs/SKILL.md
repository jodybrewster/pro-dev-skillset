---
name: documentation-and-adrs
description: Use when deciding what to document for a change and how - writing an architecture decision record (ADR) for a choice that is expensive to reverse, recording the why behind a design, keeping agent instruction files and project docs true after behavior changed, documenting a public API or a known gotcha, or judging which docs a branch made stale before a PR. Docs are judgment, not a gate. Not for drafting docs from a finished diff (/document and its subagents) or for listing which documents a repo must have (required-docs in pr-check).
---

# Documentation and ADRs

Document decisions, not just code.
Code shows what was built.
Docs say why it was built this way, what was rejected and what limits apply.
That context is what a future engineer or agent needs and cannot read from the code.

Docs are a judgment call per change.
Update the docs whose content the change made untrue or incomplete, and leave the rest alone.
Nothing here blocks a push; `pr-check` reports a stale doc as Should-fix.

## When to use

- A decision that would be expensive to reverse: a framework or major dependency, a data model, an auth strategy, an API style, hosting or build tooling.
- A choice between competing approaches that someone will ask about later.
- A public API was added or changed.
- User-facing behavior changed.
- You keep explaining the same thing, which means it belongs in a doc.

Skip it for obvious code, for comments that restate the code and for throwaway prototypes.

## Which docs a change touches

Read the diff, then each doc the repo already has.
A doc needs a change only when the diff made something in it untrue, or added a command, flag, setting or rule it should list.

| Change | Doc to check |
|---|---|
| New or changed command, flag, setup step | `README.md` |
| New convention, rule or gotcha for agents | `CLAUDE.md` or `AGENTS.md` |
| A module, service or boundary moved | `ARCHITECTURE.md` |
| Who uses it or what it promises changed | `PRODUCT.md` |
| Visual system or UI pattern changed | `DESIGN.md` |
| A decision was made or reversed | a new ADR |
| Public API surface changed | the API reference (the `/api-docs` command) |

When a doc stays as it is, say why in one line on the PR body's Docs line.
Never edit a doc only to show it moved.
To draft the update itself, run `/document` and give it the diff, so it writes from the code.

## Architecture decision records

### Match the repo's convention first

Look for existing ADRs, an ADR directory named in the project instructions or tooling such as an `.adr-dir` file.
Match its location, file format, numbering, filename pattern and section headings.
Continue the existing sequence; never restart at 001 or add a second scheme.
If the evidence conflicts, say so instead of picking one.
Only when the repo has no convention, use `docs/decisions/NNNN-short-title.md` and the template below.

### Template

```markdown
# ADR-0001: Use PostgreSQL for the primary database

Date: 2025-01-15

## Status

proposed

## Context

What forces the decision: requirements, constraints, what hurts today.

## Decision

What we will do, stated plainly.

## Alternatives considered

- MongoDB: flexible schema, but our data is relational. Rejected.
- SQLite: zero setup, but weak concurrent writes and no managed hosting. Rejected.

## Consequences

What gets easier, what gets harder and what we now have to maintain.
```

### Lifecycle

Status goes proposed, then accepted, then superseded or deprecated.
Never delete an old ADR; it holds history.
When a decision changes, write a new ADR that names the one it supersedes and mark the old one superseded.
Add the new ADR to the index when the repo keeps one.

## Inline comments

Comment the why, not the what.

```typescript
// Fixed window that opens on the first request after the last one expired,
// not on a clock. Known gap: a client can spend the full limit just before a
// reset and again just after.
if (now - windowStart > WINDOW_SIZE_MS) {
  counter = 0;
  windowStart = now;
}
```

Write down a known gotcha where it bites, with a pointer to the ADR when there is one.
Do not comment self-explanatory code.
Do not leave a TODO for something you can do now, or commented-out code; git has the history.

## API docs

Document a public function or endpoint with its inputs, its return value, its errors and one example.
In TypeScript, put it in the doc comment on the type.
For REST, keep the OpenAPI file current.
For a full reference built from the handlers, use `/api-docs`.

## README

A README covers what the project does in one paragraph, a quick start that works from a fresh clone, the commands table and a short architecture note that links to the ADRs.
Check every command in it still runs as written.

## Changelog

Follow the repo's changelog rule.
Never hand-edit a changelog the repo marks as generated.

## Docs for agents

- `CLAUDE.md` or `AGENTS.md` holds the conventions an agent must follow.
- Specs stay current so agents build the right thing.
- ADRs stop an agent from re-deciding a settled question.
- Inline gotchas keep an agent out of known traps.

## Prose review

After the content is right, review the prose for the people who will read it.
Clearer wording must not change the decision or its limits.

1. Mark what must survive the edit: names, numbers and units, commands, paths, links, conditions, trade-offs and uncertainty. Check them against the code; flag what you cannot back up.
2. Replace stock openings, promotional adjectives and repeated summaries with the information the reader needs. Never swap an unsupported claim for an invented example or a stronger guarantee.
3. Compare the edit with the original and its sources. Restore any lost qualifier, check that commands and examples still work and name any open factual question instead of polishing it away.

## Rationalizations

| Excuse | Reality |
|---|---|
| "The code documents itself" | Code shows what. It does not show why, what was rejected or what limits apply. |
| "We'll document when the API settles" | Writing the doc is the first test of the design. |
| "Nobody reads docs" | Agents do, and so does whoever touches this in three months. |
| "ADRs are overhead" | Ten minutes now saves the same debate six months later. |
| "Every doc has to move with the code" | Only the docs the change made wrong. The rest need nothing. |

## Red flags

- An architectural decision with no written reason.
- A public API with no docs or types.
- A README that does not say how to run the project.
- Commented-out code, or a TODO that has sat for weeks.
- A doc edited only so it appears in the diff.

## Check before you finish

- Each decision that is expensive to reverse has an ADR in the repo's convention.
- Every doc the diff made untrue is updated, or the PR body says why not.
- Every command and path in a changed doc exists.
- Agent instruction files match how the repo works now.
- Prose edits kept every detail, trade-off and qualifier from the source.

Adapted from addyosmani/agent-skills (skills/documentation-and-adrs/SKILL.md), MIT, Copyright (c) 2025 Addy Osmani.
