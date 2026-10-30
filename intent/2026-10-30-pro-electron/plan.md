# Plan: pro-electron, a stack plugin for Electron apps

Built from `spec.md` (commit 7102701 for the intent) and `intent.md` in this folder.
Status: approved.
Approver: Jody Brewster (approved spec and plan on 2026-10-30: "can we run the specs, plan you have my approval").
Dated: 2026-10-30.

## Files that change

- `plugins/pro-electron/.claude-plugin/plugin.json` (new): manifest, 0.1.0, evals key.
- `plugins/pro-electron/.codex-plugin/plugin.json` (new): Codex parity.
- `plugins/pro-electron/skills/electron-skills-bridge/SKILL.md` (new): the bridge (R3, R4).
- `plugins/pro-electron/skills/electron-upgrade/SKILL.md` (new): the upgrade workflow (R7).
- `plugins/pro-electron/skills/electron-security-audit/SKILL.md` (new): the audit skill (R8).
- `plugins/pro-electron/skills/electron-security-audit/scripts/audit.mjs` (new): the checker (R9).
- `plugins/pro-electron/skills/electron-security-audit/scripts/audit.test.mjs` (new): unit tests (R10).
- `plugins/pro-electron/skills/electron-security-audit/scripts/fixtures/planted/` and `fixtures/clean/` (new): test inputs.
- `plugins/pro-electron/commands/install.md` and `scripts/pro-dev-owner.py` (new): owner install wiring, copied from pro-nextjs (R6).
- `plugins/pro-electron/evals/<skill>-fires/` and `<skill>-stays-quiet/` for each skill (new): plugin evals (R12).
- `evals/cases/electron-upgrade.json`, `evals/cases/electron-security-audit.json`, `evals/fixtures/electron-upgrade/`, `evals/fixtures/electron-security-audit/` (new): behavioral (R14).
- `.claude-plugin/marketplace.json` (modified): entry plus `metadata.version` (R1).
- `plugins/pro-core/registry/engines.json` and pro-core's two manifests plus its marketplace entry (modified): two rows, bump (R5).
- `tests/check.mjs` (modified): opt-in set, router-skip set, component-coverage list (R2, R13).
- `tests/cases/routing.jsonl` (modified): routing cases (R11).
- `tests/bridge-install-smoke.mjs` (modified): two targets (R15).
- `docs/licenses.md`, `README.md`, `docs/roadmap.md`, `docs/evals.md` (modified): R16, R17, AC6.

## Order of work

1. Write the audit fixtures and a failing `audit.test.mjs` (S; R10, AC2).
2. Write `audit.mjs` until the tests pass (M; R9, N3, AC2).
   Checkpoint: `node --test plugins/pro-electron/skills/electron-security-audit/scripts/` passes.
3. Write the three SKILL.md files (S each; R3, R4, R7, R8).
4. Write the manifests, marketplace entry, `commands/install.md` and `scripts/pro-dev-owner.py` (S; R1, R2, R6).
5. Add the two registry rows and bump pro-core (S; R5).
   Checkpoint: `node tests/check.mjs` passes.
6. Add the routing cases and the `tests/check.mjs` list changes (S; R2, R11, R13).
7. Write the six plugin eval cases (S; R12).
8. Write the two behavioral cases and fixtures (S; R14).
   Checkpoint: `node tests/route-lexical.mjs --min-rank1 70`, `node tests/check.mjs component-coverage` and `node tests/behavioral.mjs --dry-run` pass.
9. Add the smoke-test targets and run that target live (S; R15).
10. Docs: licenses, README, roadmap (XS; R16, R17).
    Checkpoint: the full N1 set.
11. Run the live plugin and behavioral evals if an API key is available and record the numbers in `docs/evals.md` (S; AC6).

Steps 1-2, 3, 4-5 with 9, 6-7 and 8 touch separate files and run in parallel; 10 and 11 run last.

## Tests that prove it

- `audit.test.mjs` covers every R9 rule on the planted fixture and zero findings on the clean one.
- `tests/check.mjs` covers manifests, version bumps, registry, Codex parity, eval files and component coverage.
- `tests/route-lexical.mjs` covers routing; `tests/behavioral.mjs --dry-run` validates the behavioral cases.
- `tests/bridge-install-smoke.mjs` proves the pinned installs land.

## Risks

The step most likely to go wrong is 5 with 9: `npx skills add` on a nested folder at a pinned commit may not resolve, which would leave the bridge pointing at an install that fails.
Step 9 runs the real install to catch it.
The audit script's regex rules can false-alarm on unusual code; the clean fixture and the skill's "heuristic" note limit that.
New skill descriptions can pull routing away from existing skills; the lexical gate catches a rank-1 drop.

Stop-list categories: none (no migration, public API, auth or deploy config).

## Options not taken

- Bundled `.mcp.json`: see the spec's alternatives.
- A TypeScript AST parser in the audit: adds a dependency.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node --test plugins/pro-electron/skills/electron-security-audit/scripts/audit.test.mjs
node tests/behavioral.mjs --dry-run
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

Each must exit 0.

## Done

- Build commit: the `feat: pro-electron` commit on `feat/pro-electron`.
- Checks run: `node tests/check.mjs` 37 checks, 0 failures, 10 warnings; `node tests/eval.mjs --dry` 96 cases, 102 skills; `node tests/route-lexical.mjs --min-rank1 70` rank-1 77/95 (81.1%, main 79.5%), notOneOf failures 2 (main 3); `node --test tests/unit/*.test.mjs` 167 pass; audit tests 16 pass; `node tests/behavioral.mjs --dry-run` ok, 8 runs planned; `claude plugin validate . --strict` and the per-plugin loop pass.
- Definition of done: met except AC6, which needs a live run.
- Doubt: none
- AC1: pass.
- AC2: pass, 16 of 16; every planted fault found, clean fixture zero findings.
- AC3: pass, all seven new cases rank first.
- AC4: pass.
- AC5: pass; the plugin's `install` command is listed in `components-uncovered.json` with the same reason as the other owner install commands.
- AC6: not run yet; needs an API key and about two dollars on Sonnet.
- Sign-off:

## Departures from plan

- `node --test <dir>/` does not work on Node 22, so the proof command names `audit.test.mjs` directly.
- `WORKFLOW_PLUGINS` lives in `tests/lib/components.mjs`, so the coverage change landed there and in `tests/unit/components.test.mjs`.
- `.agents/plugins/marketplace.json` gained a pro-electron entry; the `codex-manifests` check needs it.
- The upgrade eval fixture went from 45-to-47 (47 is not released) to 43-to-45, using the Electron 45 removal of `Buffer` and `setImmediate` in sandboxed preloads.
- The `electron-security-audit` description was narrowed after it outranked `security-architect` on a generic SQL injection case.

## Noticed but not touched

- `tests/bridge-install-smoke.mjs`: the `taste-skills-bridge` target fails with 12 of 13 skills missing upstream; unrelated to this change.
- `tests/route-lexical.mjs`: "Can you do a security audit of this repo?" was already a miss on main; `electron-security-audit` now sits second behind `security-architect` there.
