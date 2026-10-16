---
source: planning-session
kind: bug
status: accepted
risk: low
outcome: O6
opportunity: the independent review of the merged PR 51 found a release that re-resolves nothing, a verify loop that passes on failure, an Apache-2.0 obligation unmet and a handful of nits
created: 2026-10-16T18:00:00-04:00
author: Jody Brewster
---

# Intent: land the findings from the review of PR 51

## Problem

PR 51 (cc48aad) bumped ten plugins and left `pro-starter` at 1.12.1.
RELEASING.md says a dependency bump always bumps the meta-plugin, while ADR-0002's Consequences narrow that to minor bumps.
With `pro-starter` unchanged, `claude plugin update pro-starter` reports up to date and re-resolves nothing.

The verify loop in CLAUDE.md ends in `|| break`, which does not carry the failing status.
The chain exits 0 after a plugin fails validation.

`plugins/pro-testing/LICENSE` points at the Apache-2.0 text by URL.
Section 4(a) of the Apache License requires a copy of the license to accompany the work.

The review also listed nits: an em dash in `.claude/commands/research.md`, a home-directory path in `docs/plans/AGENT-SKILLS-INTEGRATION.md`, commas before a conjunction (in ADR-0004, `docs/licenses.md`, CLAUDE.md and README.md) and no check for tilde-prefixed home paths in REVIEW.md.

## Proposed outcome

RELEASING.md's unconditional meta-plugin rule stands and ADR-0002 says the same.
`pro-starter` 1.12.2 re-resolves the plugins PR 51 patched.
The verify loop fails the chain when any plugin fails.
`pro-testing` 0.5.7 ships the full Apache-2.0 text beside the agent-browser fork.
The nits are fixed and REVIEW.md catches the next tilde path.

## Affected users and systems

Anyone who installed `pro-starter` before PR 51; anyone pasting the verify loop; the pro-testing plugin's license file.

## Constraints

Nothing merged, tagged or published by anyone but Jody.
`pro-nextjs` is out of scope (the `next-bridge` branch is reworking it) and so are footers on the pro-spdd skills.
The version-bump law applies to every content change under `plugins/`.

## Check

`node tests/check.mjs` reports 17 checks and 0 failures.
`node tests/eval.mjs --dry` passes.
`claude plugin validate --strict` passes for the marketplace, `pro-starter` and `pro-testing`.
`claude plugin tag --dry-run` names `pro-starter--v1.12.2` and `pro-testing--v0.5.7`.
