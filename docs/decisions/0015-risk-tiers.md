# ADR-0015: The tier is the highest deterministic floor and only the person at the prompt approves a merge

Date: 2026-10-30

## Status

accepted (2026-10-30) (2026-10-30)

Amended 2026-10-30 by intent/2026-10-30-p0-hardening/: the merge gate reads the PR head through `gh pr view` and may fetch it, which replaces the rejected alternative of checking the head over the network.

Decided by: the maintainer.
Source: intent/2026-10-29-risk-tiers/.

## Context

Every gate and reviewer here needs to know how much care a change deserves.
Without one shared answer each gate would invent its own rule and an author could pick the tier that suits them.
The merge gate also has to ask a person, and an agent that can set an environment variable or write a file can fake an approval.
The size thresholds have not been measured against merged PRs yet, so they are placeholders.
The security and legal surface classifiers live in other plugins, which pro-ship cannot import as a hard dependency (ADR-0003).

## Decision

The tier is the highest floor among deterministic signals, computed by `risk-classify.py` with no model call.
The author's declared `risk:` only raises the tier (not on a docs-only diff) and a lower declaration becomes a `risk-underdeclared` finding.
A run that could not happen is high, never low.
A model may settle a tie between weak signals, choosing between the two tiers the classifier named, and that changes reviewer depth only.
Only the person answering a permission prompt approves a medium or high merge, and an agent's statement of approval never counts.
An approval covers one HEAD sha through `gh pr merge --match-head-commit`, so a new commit needs a new look.
The tier table lives in an optional `## Risk tiers` section of `REVIEW.md`.
The approval column stays fixed until the scaling block exists.
A tier is overridden down only by the maintainer, recorded in the stamp against one HEAD sha.
That override is later work and is not built.

## Consequences

The printed signals are the reason for a tier, so a person can argue with a specific signal and not with a score.
A repo with no `REVIEW.md` section gets the defaults.
A change under `.github/workflows/` or a hooks directory is high whatever its size.
The size thresholds can be wrong until the calibration run over merged PRs fixes them.
When pro-security or pro-legal is absent the output says `surface-unavailable` and the tier rests on the other signals.
Medium and high merges always cost one answered prompt.

Revisit the decision when the calibration run shows the thresholds or floors misplace merged PRs, or when the scaling block lets a repo set approval.

## Alternatives considered

- A score with weights: harder to explain and to argue with than a tier equal to the highest floor.
- A classifier that calls a model: not deterministic, too slow for a hook and unexplainable.
- Copying the two surface classifiers into pro-ship: they would drift from their owners.
- A required dependency on pro-security and pro-legal: breaks the rule that plugins stand alone.
- Approval recorded in the stamp or a PR comment: an agent can write either and cannot answer the prompt.
- Approval by an environment variable: an agent can set it.
- Checking the PR head sha over the network in the hook: breaks the no-network rule and `--match-head-commit` makes GitHub check it. (since adopted, see the amendment)

## Where it is enforced

- `plugins/pro-ship/scripts/risk-classify.py`, which sets the tier.
- `plugins/pro-ship/scripts/merge-gate.py`, which asks and requires `--match-head-commit`.
- The `pr-check` stamp, which records the tier and its signals.
- `plugins/pro-ai-sdlc/templates/REVIEW.md`, which carries the `## Risk tiers` section.
