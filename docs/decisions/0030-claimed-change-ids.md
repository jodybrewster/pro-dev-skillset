# ADR-0030: A change id is claimed on origin when it is handed out

Status: proposed
Date: 2026-11-19
Decided by: the maintainer

## Context

ADR-0026 allocates a change id by reading the highest id on origin, the local branches and the working tree.
An id is only visible to others once its intent is committed and pushed.
Two people who start an intent before either has pushed are both given the same number.
A brainstorm can keep an intent unpushed for an hour.
The folders have different names, so git merges both without a conflict.
The duplicate check ADR-0026 relies on is `checks["change-ids"]` in this repo's own test suite; it does not ship with the plugin, so another repo has no guard.
The loop is meant to run from a chat where several people start intents at once.

Allocation also read only what exists now.
An intent folder removed after its change merged took its number with it, so the next change would be given a number already used on a branch, a commit and a pull request.

## Decision

`ids.py claim` takes the id for good at the moment it is handed out.
It pushes an empty commit to `refs/change-ids/<id>` on origin with a lease that succeeds only when that ref does not exist.
When someone else holds the ref the push is refused and the next number is tried.
The claim holds no file and names no person: its author is `change-id`.
The ref is outside `refs/heads` and `refs/tags`, so no branch list, tag list or release page shows it and a default fetch does not bring it down.
A claim is never deleted, so an abandoned intent costs one number.

`/intent` and `/incident` call `claim` where they called `next`.
When origin cannot be reached or refuses the push, the id is still printed with a line saying it is not claimed and the loop goes on as it did under ADR-0026.

Allocation counts three more places: the claims on origin, every intent folder git history ever added on any ref and the ids that open the subject of the commits that added them.
A deleted intent keeps its number.

`ids.py check` exits 1 when two intents in the working tree carry one id and names the later one.
The execute gate stops a build whose intent shares its id.
In `pro-ai-sdlc-egm` the design's status lists it as a reason, so the design cannot be checked as ready.

`ids.py renumber <folder>` claims a new id for an intent, renames its folder and rewrites its `id:` lines.
This amends the rule in ADR-0026 that an id is never renumbered: an id is renumbered only to separate two intents that were given the same one and the earlier intent keeps it.

## Consequences

Two people cannot be given the same id while origin is reachable.
`/intent` now pushes to origin before the intent is committed, where it pushed nothing before; what it pushes is an empty commit on a ref nothing displays.
A host that refuses pushes outside `refs/heads` and `refs/tags` leaves the loop where ADR-0026 left it, with the duplicate caught at the gate and not at allocation.
The claims add one ref per change to origin for the life of the repo.
A branch or a commit made before a renumber keeps the old id in its name.
`pro-ai-sdlc` and `pro-ai-sdlc-egm` carry the same `ids.py` and change together.

## Alternatives considered

- Push a placeholder intent file before the interview: it puts a half-written file on a branch and still leaves a window between reading the highest id and pushing.
- A GitHub issue number per intent: no collisions, but it ties the loop to one host and needs the network for every intent.
- A counter file in the repo: two sessions both bump it and only a merge conflict tells, as ADR-0026 found.
- A tag per id: the same lease works, but tags show in every tag list and on the releases page.

## Where it is enforced

- `plugins/pro-ai-sdlc/scripts/ids.py` and its copy in `plugins/pro-ai-sdlc-egm/`: `claim`, `check`, `renumber` and the history count.
- `scripts/execute-gate.py` in both plugins and `scripts/design.py` in `pro-ai-sdlc-egm`: the stop on a shared id.
- `tests/ids.mjs`, `tests/execute.mjs` and `tests/sdlc-egm.mjs`: the cases, including a refused claim for an id someone else holds.

## What would reverse this

Hosts that refuse the claim ref often enough that the fallback is the normal path, or a move of ids to the board that runs the loop.
