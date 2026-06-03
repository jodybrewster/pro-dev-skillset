# qa-skills Upstream

This plugin vendors and adapts the QA skills library from qa-skills.

- Upstream repository: `https://github.com/petrkindlmann/qa-skills`
- Imported commit: `3282001983dc85f60a9f2d03231596359b88fb88`
- Upstream license: MIT (retained at `upstream/qa-skills/LICENSE`)
- Local plugin: `pro-testing`

## Imported Surface

The full upstream repository is vendored under `upstream/qa-skills/` (minus `.git`) for
traceability and comparison. At import time that is **43 skills** plus their `references/`,
`AGENTS.md`, `README.md`, and `LICENSE`.

## Exposed skills (11)

Only a curated testing-core subset is exposed as auto-triggering shim skills under
`skills/`. Each shim copies the upstream `description` verbatim and delegates to
`../../upstream/qa-skills/skills/<name>/SKILL.md`:

- **Routers / foundation:** `qa-do`, `qa-start`, `qa-project-context`
- **Automation:** `playwright-automation`, `visual-testing`, `api-testing`, `contract-testing`
- **Reliability:** `test-reliability`
- **Strategy / planning:** `test-strategy`, `risk-based-testing`, `test-planning`

`playwright-automation` and `visual-testing` replace the previous file-level forks of these
two skills; the vendored versions are now the single source of truth.

## Held back (vendored, NOT exposed)

These remain available under `upstream/qa-skills/skills/` but are not exposed as shims,
because another current or planned plugin owns the territory (exposing would double-trigger
or steal ownership):

- `unit-testing` → `vitest` (this plugin) owns the focused Vitest TS/React skill
- `security-testing` → planned `pro-security`
- `ci-cd-integration`, `release-readiness` → planned `pro-ship`
- `accessibility-testing` → `pro-design`
- the remaining ~27 specialized skills (chaos-engineering, mobile-testing, database-testing,
  performance-testing, coverage-analysis, cross-browser-testing, selector-drift-recovery,
  synthetic-monitoring, etc.) — exposable in a later pass without re-vendoring.

## Local Adaptations

- Shims are harness-neutral adapters. They read the vendored upstream skill as reference
  material; they do not run native qa-skills CLI bootstrap, install flows, or `.agents/`
  provisioning unless the user explicitly requests it.
- Frontmatter on shims is `name` + `description` only (Agent Skills / Codex parity).
- `agent-browser` (vercel-labs, Apache-2.0) is intentionally NOT part of this library — it
  owns the *interactive verification* axis; `playwright-automation` owns the *committed
  regression suite* axis.

## Sync

Re-pull the upstream tree into `upstream/qa-skills/`, re-copy any changed `description`
values into the exposed shims, and bump the `pro-testing` version (version-bump law).
