# ADR-0023: The records after a build are mieruka evidence manifests with one contract page

Date: 2026-11-01

## Status

proposed

Decided by: the maintainer.
Source: intent/2026-11-01-after-build-loop/ (spec R1 to R50).

## Context

The loop's artifact chain runs past the build to a deploy record, an incident record, review lessons and a new intent.
None of those existed, so mieruka's deploy panel had no data and its board stopped at build.
mieruka loads file-dropped evidence from `.mieruka/evidence/<evidence_key>/evidence.json`, accepts only six kinds and four statuses and stops its sync on one unknown kind.
The preflight record (ADR-0022) already set the pattern: a manifest as mieruka expects it, a local copy under `.pro-dev/` and a drop into `.mieruka/` only when that path is ignored.
The pr-check stamp (ADR-0014) let `gh pr create` through without the verifier's independent pass.

## Decision

Four new records follow one contract page, `docs/loop-records.md`.

- The deploy record is kind `deploy`, written by `ship.py deployed` after a deploy, one file per deploy.
- The incident record is a tracked `incident.md` beside the new intent it starts, with a `doc` / `incident` manifest written from its frontmatter.
- The review lesson is a `review` / `review-lesson` manifest written when a finding class repeats on a second change; the finding ledger stays untracked and the accepted line goes into the agent file.
- The visual check is a `visual_drift` / `ui-step` manifest per UI step and viewport.

Every record uses only mieruka's kinds and statuses, keeps `detail_json` a string and uses the preflight's drop rule.
pro-ai-sdlc carries its own copy of the drop rule because plugins do not import each other (ADR-0003).

The pr-check stamp also stores the verifier's result as `reviewers.verifier`, bound to the sha the verifier reports.
`pass` needs that verifier to have passed on HEAD, or on an ancestor that differs from HEAD only under `intent/`, unless pro-ai-sdlc is not installed.

## Consequences

mieruka can show deploys, incidents, lessons and visual checks without a schema change.
A change to a record's fields changes `docs/loop-records.md`, the writer and `tests/mieruka-sync.mjs` together.
pr-check runs the verifier on every PR in repos with pro-ai-sdlc, which costs one more agent run.
Like the stamp and the preflight, every record is a local file anyone with a shell can write; they inform and warn, they do not prove.

## What would reverse it

mieruka gaining its own kinds for incidents or lessons would move those records to the new kinds.
A verifier that proves too slow or too noisy to run on every PR would move it back to `/execute` only.
