# Decision log

Binding decisions for this marketplace, one file per decision, numbered in the order they were made.
Each has a date taken from the commit where the decision was made, a status and a link to what enforces it.
A new load-bearing decision gets the next number in the same PR as the change.

| ADR | Decision | Date |
|---|---|---|
| [0001](./0001-skills-only-history.md) | Skills first; hooks, commands and agents only where triggering must be deterministic | 2026-05-24 |
| [0002](./0002-version-bump-law.md) | Every content change bumps the plugin version in both manifests and the marketplace entry | 2026-05-24 |
| [0003](./0003-one-hooks-json-per-plugin.md) | Each plugin registers all its hooks in one `hooks/hooks.json` | 2026-07-26 |
| [0004](./0004-codex-parity.md) | Every skill-bearing plugin also loads under Codex, agents included | 2026-05-24 |
| [0005](./0005-adrs-in-the-sdlc-loop.md) | pro-ai-sdlc carries ADRs through the loop: flagged at intent, drafted at spec, accepted at Done, standalone through /adr | 2026-10-27 |
| [0006](./0006-engine-registry-and-pro-dev.md) | Every bridge engine is a row in pro-core's one registry, installed and updated through /pro-dev or its owning plugin's /<plugin>:install (proposed, amended 2026-10-28) | 2026-10-28 |
| [0007](./0007-spec-method-plugins.md) | Spec methods are opt-in plugins whose stage hand-offs pro-ai-sdlc offers and never runs on its own (proposed) | 2026-10-28 |
| [0008](./0008-spec-kit-uv-tool.md) | spec-kit installs through a `uv-tool` row pinned by commit and date and `check` verifies it from registry hashes without running it (proposed) | 2026-10-28 |
| [0009](./0009-three-eval-tiers.md) | Three eval tiers: keyless routing gates CI, behavioral and plugin evals run on demand (proposed) | 2026-10-29 |
| [0010](./0010-constraint-floor.md) | Every repo gets the same constraint floor; `CONSTRAINTS.md` holds a repo's quality bar and every gate and reviewer reads it | 2026-10-29 |
| [0011](./0011-review-convergence.md) | Review rounds converge: later rounds read only new commits, a finding is raised once, old bugs never block and /pr-babysit stops after three rounds | 2026-10-30 |
| [0012](./0012-review-handoff.md) | Every reviewer dispatch hands over exactly four fields (range, brief, policy, risk) from one template so the read stays fresh (accepted, amended 2026-10-30) | 2026-10-30 |
| [0013](./0013-plugin-layering.md) | Plugins are split by audience, not by size: core, domain, a layer under a domain, stack, plus switchable methods and gates (proposed) | 2026-10-30 |
| [0014](./0014-gate-stamp.md) | One pr-check stamp bound to HEAD has one writer and many readers; pr-gate and the push gate read it and a forged stamp is accepted for a local guardrail | 2026-10-30 |
| [0015](./0015-risk-tiers.md) | The tier is the highest floor among deterministic signals, declared risk only raises it and only the person at the prompt approves a merge, pinned to one HEAD sha | 2026-10-30 |
| [0016](./0016-gate-enforce-rule.md) | A gate moves from warn to enforce only on a written per-gate record of warn-mode evidence, decided by Jody, switched per machine and sent back on a false denial (proposed) | 2026-10-30 |
| [0017](./0017-loop-guardrails.md) | Every plan cites one standing definition of done and /execute pauses for a person before auth, migration, payment, deploy or secrets steps the plan did not name (proposed) | 2026-10-30 |
| [0018](./0018-codex-second-reviewer.md) | Codex is an advisory second reviewer on high-tier PRs: same handoff, read-only runner, opt-in consent, a `manual-cli` row owned by pro-core and agreement decided by a script (proposed) | 2026-10-30 |
| [0019](./0019-doubt-before-irreversible-steps.md) | A hard-to-undo step in /execute gets a fresh-context doubt round before the next step, with no author claim in the handoff, three rounds at most and Codex only on a per-run yes (proposed) | 2026-10-30 |
| [0020](./0020-required-documents.md) | Every repo has a required document set, computed from its code by one script and tuned by a block in `REVIEW.md`; a missing document is Should-fix and never blocks (proposed) | 2026-10-30 |
| [0021](./0021-doc-freshness-is-judgment.md) | Doc freshness is a Should-fix judgment step in pr-check that never blocks; the docs-before-push hook is removed (proposed) | 2026-10-31 |
| [0022](./0022-ship-preflight-record.md) | The `/ship` preflight record is a mieruka evidence manifest (`kind` review, `artifact_kind` ship-preflight) bound to a commit; gates warn or deny once without a fresh GO and never ask (proposed) | 2026-10-31 |
