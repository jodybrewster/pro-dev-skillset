# Docs

Everything under `docs/`, one line per page.
The agent file is [CLAUDE.md](../CLAUDE.md); the review policy is [REVIEW.md](../REVIEW.md); the release procedure is [RELEASING.md](../RELEASING.md).

## Working on the repo

- [roadmap.md](./roadmap.md): what is being built now, the ranked list of what comes next and which intents are parked. Start here in a new session.
- [overview.md](./overview.md): what the repo is, how it relates to Mieruka and the two use cases it is testing.
- [spec-methods.md](./spec-methods.md): the five ways to work, from plan-driven development to spec-kit, compared, which to pick and how to use each, with a lane diagram ([spec-workflows.svg](./spec-workflows.svg)).
- [evals.md](./evals.md): the three eval tiers (keyless routing in CI, behavioral, plugin), how to run each and how to add a case.
- [subagents.md](./subagents.md): how to split work across parallel subagents and which model each runs on.
- [version-bump-law.md](./version-bump-law.md): the version-bump law in detail.
- [hook-loading.md](./hook-loading.md): the hook-loading law in detail, including blocking on `Stop`.
- [ship-preflight.md](./ship-preflight.md): the record contract that `/pro-ship:ship` writes and the ship gate, the merge gate and pro-legal's release gate read.
- [pr-check-stamp.md](./pr-check-stamp.md): the stamp contract that `/pro-ship:pr-check` writes and pr-gate and the push gate read.
- [enforce-mode.md](./enforce-mode.md): what still blocks each gate from enforce mode, the evidence it needs, the `warn.log` summary commands and the decision record template.
- [codex-parity.md](./codex-parity.md): Codex parity for skills and agents in detail.
- [install-test.md](./install-test.md): the full install test with the demo app, `pro-dev-starter` and Codex.
- [troubleshooting.md](./troubleshooting.md): symptoms and fixes when a skill, hook or dependency misbehaves.
- [private-repo.md](./private-repo.md): what changes because the repo is private.

## Records

- [licenses.md](./licenses.md): every forked, adapted or bridged skill with its upstream, license and copyright line.
- [releases.md](./releases.md): the current version of every plugin, when it shipped and what it shipped.

## Decisions

- [decisions/README.md](./decisions/README.md): the decision log index.
- [decisions/0001-skills-only-history.md](./decisions/0001-skills-only-history.md): skills first, other components only where triggering must be deterministic.
- [decisions/0002-version-bump-law.md](./decisions/0002-version-bump-law.md): every content change bumps the plugin version.
- [decisions/0003-one-hooks-json-per-plugin.md](./decisions/0003-one-hooks-json-per-plugin.md): one `hooks/hooks.json` per plugin.
- [decisions/0004-codex-parity.md](./decisions/0004-codex-parity.md): Codex parity is a hard requirement.
- [decisions/0009-three-eval-tiers.md](./decisions/0009-three-eval-tiers.md): three eval tiers, CI gates only the keyless one.
- [decisions/0014-gate-stamp.md](./decisions/0014-gate-stamp.md): one stamp bound to HEAD, one writer and many readers (proposed).
- [decisions/0016-gate-enforce-rule.md](./decisions/0016-gate-enforce-rule.md): a gate moves from warn to enforce only on a written record of warn-mode evidence (proposed).

## Old plans

- [plans/README.md](./plans/README.md): the planning documents moved from the repo root, with their status.
- [plans/AGENT-SKILLS-INTEGRATION.md](./plans/AGENT-SKILLS-INTEGRATION.md): wrap qa-skills, absorb agent-skills, salvage and remove gstack.
- [plans/CODEX_RECOMMENDATIONS.md](./plans/CODEX_RECOMMENDATIONS.md): feedback from the Codex review on 2026-05-24.
- [plans/MIERUKA_LIFECYCLE_NOTES.md](./plans/MIERUKA_LIFECYCLE_NOTES.md): how the skills and Mieruka work together across the lifecycle.
- [plans/PRO-DEV-LIFECYCLE-PLAN.md](./plans/PRO-DEV-LIFECYCLE-PLAN.md): the `using-pro-dev` router and phase map.
- [plans/QA-SKILLS-BRIDGE-PLAN.md](./plans/QA-SKILLS-BRIDGE-PLAN.md): qa-skills from vendored to a bridge.
