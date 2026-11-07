# ADR-0026: Every change carries a project shortcode and a number, allocated from git and never reused

Date: 2026-11-07

## Status

proposed

Decided by: the maintainer.
Source: PDS-50, intent/2026-11-07-traceable-ids/ (spec-m1 R1 to R20).

## Context

A change in the loop is known only by its folder name, `intent/<date>-<slug>/`.
Its branches, commits, pull requests, pr-check stamp, factory and deploy records and its card in mieruka each name it differently or not at all.
Lining up four pull requests, two intents and a release by hand to see what reached Done showed the cost.
A hosted counter or a ticket system would add a service the loop does not have; renaming 50 folders would break every link in the docs.

## Decision

Each repo that uses the loop declares a shortcode of two to six capitals once, in a tracked `intent/project.json`.
Every change has an id `<shortcode>-<n>` matching `^[A-Z]{2,6}-[1-9][0-9]*$`.
`/intent` allocates it by fetching origin and taking the highest `id:` across `intent/*/intent.md` committed on any local or remote branch (the default branch among them) plus the current working tree, plus one; offline it uses the last fetch and says so.
The id lives in the `id:` line of the intent's frontmatter and is copied into the spec and plan; tools read it from there, never from the folder name.
New folders are named `intent/<id>-<slug>/`; existing folders keep their names and gain an `id:` line in `created:` order.
An id is never reused or renumbered, a dropped intent keeps its folder and the shortcode never changes in place.
Branches, commit subjects, pull request titles, records (as an optional `change_id`), roadmap rows and ADR Source lines carry the id.
A repo with no `intent/project.json` works as before.

## Consequences

One id finds a change's branch, commits, pull requests, stamp, records and docs.
The window left is an intent uncommitted in another worktree or committed but unpushed in another clone: no ref that allocation reads holds it and the `change-ids` check catches that duplicate on the second pull request, not at allocation.
Every script that reads a folder name has to accept two forms for as long as date folders exist.
Evidence keys built from an id-named folder are lowercased to keep the key charset of ADR-0023.
Changing the shortcode means a new decision and a migration of every id, which the check makes visible.
Reverse it if allocation from git produces duplicates often enough that a counter service is cheaper or if mieruka moves to its own ids.

## Alternatives considered

- A counter in `intent/project.json`: concurrent sessions would both bump it and only a merge conflict would tell.
- A hosted counter or a ticket system: a service the loop does not have and the intent rules out.
- Renaming every existing folder: breaks every link in the docs, the roadmap and the ADRs.
- Reading the id from the folder name: existing folders carry none.

## Where it is enforced

- `checks["change-ids"]` in `tests/check.mjs`: a missing, malformed or duplicate id, an id that disagrees with its folder, spec or plan and, after m4, an ADR or roadmap row that names an id-bearing folder without its id.
- `plugins/pro-ai-sdlc/scripts/ids.py`: allocation and backfill.
- `plugins/pro-ai-sdlc/scripts/change-id.py`: commit subjects on an id branch, warn mode under `mode.change-id`.
- Not enforced yet: none of these exist until the m1 to m4 builds land.
