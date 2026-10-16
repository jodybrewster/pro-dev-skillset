# Plan: convert qa-skills from vendored to a bridge

## Context

Part C (pro-testing 0.4.0, merged) **vendored** `petrkindlmann/qa-skills` into
`plugins/pro-testing/upstream/qa-skills/` — **1.8 MB, 176 files, 43 skills** —
plus 12 thin shims in `plugins/pro-testing/skills/`. The maintenance tax is the
sync chore: every upstream change means re-pull the tree, re-copy changed
descriptions, and version-bump.

This plan eliminates that by switching qa-skills from **vendor-and-adapt** to a
**bridge**, mirroring the `impeccable-bridge → impeccable` bridge in `pro-design`
(skill + `/design-engine` command). Instead of carrying the 43-skill tree, we
point to the externally-installed qa-skills and provide a command to install/
update it in place.

> **STATUS: EXECUTED** (branch `feat/qa-skills-bridge`, pro-testing 0.5.0).
> Decisions taken: **(1) vitest stays native** — it turned out to already be a
> native `PaulRBerg/agent-skills` fork (not a qa-skills shim; the earlier audit
> mis-flagged it because of a boundary cross-reference), so no re-fork was
> needed, only a dangling-reference fix. **(2) bridge skill = `qa-suite`** (a
> distinct name, to avoid colliding with the *installed* `qa-do`/`qa-start`).
> **(3) `/qa-engine install` pulls the full curated subset by default**, with
> per-skill override via arguments.

## Current state (audit)

- **Vendored tree:** `plugins/pro-testing/upstream/qa-skills/` — 1.8 MB, 176
  files: 43 `skills/`, plus `agents/ evals/ scripts/ site/ tools/
  skills_index.json` and upstream docs.
- **12 qa-skills shims** (point into the vendored tree): `api-testing`,
  `contract-testing`, `playwright-automation`, `qa-do`, `qa-project-context`,
  `qa-start`, `risk-based-testing`, `test-planning`, `test-reliability`,
  `test-strategy`, `visual-testing`, **`vitest`**.
- **2 native skills** (independent forks, NOT qa-skills — **keep**):
  `agent-browser` (vercel-labs/agent-browser, Apache-2.0) and
  `storybook-interactions` (peterknezek/skills, MIT).
- **Distribution:** qa-skills installs via
  `npx skills add petrkindlmann/qa-skills <skill names>` — the `npx skills` /
  skills.sh ecosystem (the same one `find-skills` already wraps). Not npm.
  Claude Code native (`npx skills add` or clone).

## Proposed shape (bridge)

1. **DELETE** `plugins/pro-testing/upstream/qa-skills/` (the whole 1.8 MB tree) —
   this is what kills the sync chore.
2. **DELETE** the qa-skills shims (see vitest exception below).
3. **ADD** one bridge skill that triggers on "run the QA suite / which test
   skill / qa-do" and routes to the *installed* qa-skills; if absent, tells the
   user to run `/qa-engine install`. (Naming: see open question 2.)
4. **ADD** command **`/qa-engine [check|install|update]`** — mirrors
   `/design-engine`:
   - `check` → detect qa-skills in `~/.claude/skills/` / `.claude/skills/`,
     report which of the curated subset are present.
   - `install` → `npx skills add petrkindlmann/qa-skills <curated subset>`.
   - `update` → re-add the subset + `claude plugin update` for the pro-dev stack.
5. **KEEP native:** `agent-browser`, `storybook-interactions`.
6. **Curated testing-core subset** the `/qa-engine` command installs (the layer
   the shims exposed, minus vitest if kept native): `qa-do`, `qa-start`,
   `playwright-automation`, `visual-testing`, `api-testing`, `contract-testing`,
   `test-reliability`, `test-strategy`, `risk-based-testing`, `test-planning`,
   `qa-project-context`.

## The trade-off (bless or veto)

- **Vendored (today):** the 43 qa skills ride *inside* the marketplace — they
  trigger out-of-the-box, offline, with zero extra steps. Cost: we maintain the
  tree.
- **Bridged (proposed):** zero upstream maintenance, marketplace stays light.
  Cost: the qa skills **do not exist or trigger in a project until
  `npx skills add` (or `/qa-engine install`) has run there.** pro-testing's QA
  layer becomes install-on-demand, not self-contained. This is the same model
  already accepted for the `impeccable` bridge.

## `vitest` — special case (resolve before executing)

`vitest` is currently a qa-skills shim, but the lifecycle plan and the Part C
overlap table describe it as "our own focused TS/React unit skill" that we keep
(HOLD qa `unit-testing`). Decision needed:

- **Option A — keep `vitest` native (recommended).** Re-fork the single
  `vitest` SKILL.md out of the vendored tree into a standalone pro-testing skill
  (small, self-contained) *before* deleting the tree. pro-testing keeps a native
  unit/component skill out-of-the-box; everything else bridges.
- **Option B — bridge `vitest` too.** Include it in the `/qa-engine` curated
  subset; nothing native beyond agent-browser + storybook-interactions.

## Discoverability + description updates (part of execution)

- **`using-pro-dev` router** (pro-core): Verify branch `qa-do`/`qa-start` become
  "bridge — install via `/qa-engine`"; keep the routing language.
- **README phase table** Verify/pro-testing row: note the QA layer is bridged
  (install via `/qa-engine`); `vitest` (if Option A) + `agent-browser` +
  `storybook-interactions` native.
- **pro-testing description** (plugin.json + marketplace.json): rewrite from
  "vendored qa-skills library (43 skills)" to "bridge to qa-skills via
  `/qa-engine`; native vitest/agent-browser/storybook".

## Version-bump law

- pro-testing `0.4.0 → 0.5.0` (vendored library removed, bridge added) +
  marketplace entry + top-level `metadata.version`.
- pro-core bump if `using-pro-dev` is edited in the same change.

## Verification

- `claude plugin validate . --strict`.
- No dangling references to `upstream/qa-skills/` anywhere (`grep -r`).
- `/qa-engine install` on a clean environment pulls the curated subset via
  `npx skills add`; `qa-do` then triggers.
- Codex parity on the bridge skill + command (name+description frontmatter; no
  `Task`/`TodoWrite`; paths resolve).
- Trade-off documented; README + router say "install-on-demand," not "included."

## Open questions for Jody

1. **vitest:** keep native (Option A, recommended) or bridge it (Option B)?
2. **Bridge skill name:** a single `qa-suite` router, or preserve the
   `qa-do`/`qa-start` names as the bridge entry (muscle memory)?
3. **Install behavior:** should `/qa-engine install` pull the full curated subset
   by default, or prompt per-skill?

## Decisions (locked so far)

- **D-QA-BRIDGE → yes.** Convert qa-skills from vendored to a bridge; delete the
  1.8 MB tree; add `/qa-engine`. Keep `agent-browser` + `storybook-interactions`
  native. Accept the install-on-demand trade-off (consistent with the impeccable
  bridge).
- **D-QA-ISOLATE → own branch/PR.** Execute separately from the pro-design
  bridge work, since it reverses freshly-merged Part C.
