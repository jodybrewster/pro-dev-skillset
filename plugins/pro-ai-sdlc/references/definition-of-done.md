# Definition of done

A repo's `CONSTRAINTS.md` or `REVIEW.md` wins wherever it says more than this file.
The plan's `## Done` section cites this file in one line and names the items not met, or says "met".

- The verify command passes.
- Every acceptance criterion was observed, not assumed.
- New behavior has tests that fail without the change and cover the scenarios that apply.
- No new warnings, debug output or commented-out code.
- No secrets or env values in code, logs, commits or the pull request.
- Docs changed where behavior changed: the README, an agent file and an ADR when a rule changed.
- The version and changelog rules of the repo are followed.
- Departures and noticed items are recorded in the plan.
- The verifier ran and its verdict is recorded.

Adapted from agent-skills (references/definition-of-done.md), MIT, Copyright (c) 2025 Addy Osmani.
