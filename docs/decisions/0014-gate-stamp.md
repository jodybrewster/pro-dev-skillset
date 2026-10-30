# ADR-0014: One stamp, one writer and many readers, bound to HEAD

Date: 2026-10-30

## Status

accepted (2026-10-30)

Decided by: Jody Brewster.
Source: intent/2026-10-29-pr-gate/.

## Context

Two hooks need to know whether a change was checked and reviewed: a new hook on `gh pr create` in pro-ship and pro-security's push gate.
Without a shared record each would repeat the work or ask the person again.
pro-quality's old PR hook only checked the length of the PR body, which the plan accepts losing.
The plugins cannot import each other (ADR-0003) and a plugin declares no hard dependency on a sibling, so a shared record has to be a file with a written contract.
The flagged concern in the spec is that two copies of the validity rule can drift.

## Decision

`/pro-ship:pr-check` writes one stamp, `.pro-dev/ship/pr-check.json`, through `pr-check.py stamp`.
Every other component only reads it.

- One writer: only `pr-check.py stamp` writes the stamp and it refuses to run with uncommitted tracked changes.
- Many readers: pr-gate and the push gate each carry their own copy of the validity rule and read the stamp without writing it.
- Bound to HEAD: a stamp is valid only when `head` equals the current HEAD sha, so any new commit makes it stale.
- Deny once: with an invalid stamp in enforce mode a hook denies once per HEAD sha per session and lets the identical retry through.
- Forgery accepted: the stamp is a plain file, so a person can write one by hand, which is accepted for a local guardrail with the required CI check as the later enforcement.
- Could not run is never passed: `not-installed`, `could-not-run` and `timeout` make `result` `incomplete`.

The fields, the result rule, the validity rule, the push-gate acceptance rule and the two tally lines are written once in [docs/pr-check-stamp.md](../pr-check-stamp.md).

## Consequences

A person who runs `/pro-ship:pr-check` once per commit passes both gates with one set of checks and one review.
A new commit asks for a new stamp.
A repo without pro-quality or pro-security still gets a stamp, but its `result` is `incomplete`, so pr-gate warns or denies and says why.
Changing the stamp means changing this page, both copies of the rule and the fixtures in one commit.
The spec's flagged concern 4 is held by one fixture set that both hook tests read.

Revisit the decision when `pipeline` makes the stamp a required CI check, or when a third reader needs a field the contract lacks.

## Alternatives considered

- Each gate runs its own checks: it repeats work and gives three behaviors for one change.
- A shared Python module imported by both plugins: plugins stand alone and cannot rely on a sibling being installed (ADR-0003).
- A signed stamp: it adds key handling for a guardrail that CI will enforce later.

## Where it is enforced

- `docs/pr-check-stamp.md`, the contract.
- `tests/fixtures/pr-check-stamp/`, read by `tests/ship-hooks.mjs` and `tests/security-hooks.mjs`.
- The `stamp-contract` check in `tests/check.mjs`.
- `plugins/pro-ship/scripts/pr-gate.py` and `plugins/pro-security/scripts/push-gate.py`, the two readers.
