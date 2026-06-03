# qa-skills (bridged)

`pro-testing` **bridges** to the QA skills library rather than vendoring it. The broad
suite is installed on demand from upstream; this plugin ships only a thin router skill
(`qa-suite`) and an install/update command (`/qa-engine`).

- Upstream repository: `https://github.com/petrkindlmann/qa-skills`
- Upstream license: MIT (governed by the upstream repo; nothing is copied here)
- Distribution: `npx skills add petrkindlmann/qa-skills <skills>` (the `npx skills` ecosystem)
- Local plugin: `pro-testing`

History: this library was previously **vendored** under `upstream/qa-skills/` (43 skills,
~1.8 MB) with 11 delegating shims. It was converted to a bridge to eliminate the
re-pull/re-copy/version-bump sync tax. See `QA-SKILLS-BRIDGE-PLAN.md` at the repo root.

## How the bridge works

- **`qa-suite`** (skill) — the entry point. Triggers on QA-suite intent, routes to the
  *installed* qa-skills (`qa-do`/`qa-start` own the routing within testing), and tells the
  user to `/qa-engine install` when the suite is absent.
- **`/qa-engine [check|install|update]`** (command) — manages the external suite via
  `npx skills add petrkindlmann/qa-skills …` and runs `claude plugin update` for the stack.

## Curated testing-core subset (what `/qa-engine install` pulls)

`qa-do`, `qa-start`, `qa-project-context`, `playwright-automation`, `visual-testing`,
`api-testing`, `contract-testing`, `test-reliability`, `test-strategy`, `risk-based-testing`,
`test-planning`. The full upstream library has 43 skills.

## Native pro-testing skills (NOT bridged)

- **`vitest`** (PaulRBerg/agent-skills, MIT) — focused Vitest v4 unit/component testing.
- **`agent-browser`** (vercel-labs, Apache-2.0) — interactive verification axis (vs.
  `playwright-automation`'s committed-regression-suite axis, now installed via the bridge).
- **`storybook-interactions`** (peterknezek/skills, MIT) — Storybook interaction tests.

## Territory boundaries (don't install over an owner)

Some upstream skills are intentionally left to other plugins; prefer the owner and don't
route to the bridged version when one exists:

- `unit-testing` → `vitest` (this plugin) owns focused Vitest TS/React.
- `security-testing` → planned `pro-security`.
- `ci-cd-integration`, `release-readiness` → planned `pro-ship`.
- `accessibility-testing` → `pro-design`.

## Maintenance

None for the library itself — it tracks upstream independently. Updating the **curated
subset list** (if upstream renames/adds skills) means editing `/qa-engine`'s subset and the
`qa-suite` skill, then bumping `pro-testing` (version-bump law).
