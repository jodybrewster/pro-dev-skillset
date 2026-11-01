# Plan: a twelve-factor skill

Built from `spec.md` and `intent.md` in this folder.
Status: approved.
Approver: Jody Brewster.
Dated: 2026-10-30.

## Files that change

- `plugins/pro-quality/skills/twelve-factor/SKILL.md` (new): overview, when to use and not, mode resolution, statuses, the evidence rule, rules, output and related (R1 to R8, R11 to R14).
- `plugins/pro-quality/skills/twelve-factor/factors.md` (new): the fifteen factors with checks (R2, R6, R9).
- `plugins/pro-quality/skills/twelve-factor/report.md` (new): the report template and the plan-mode section (R10, R11).
- `plugins/pro-quality/LICENSE`, `docs/licenses.md` (R15).
- `plugins/pro-quality/.claude-plugin/plugin.json`, `plugins/pro-quality/.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json` (R16).
- `tests/cases/routing.jsonl` (R17).
- `README.md`, `docs/roadmap.md` (R18).

## Steps

1. Read `plugins/pro-security/skills/security-architect/SKILL.md` for the shape and voice, `plugins/pro-quality/skills/constraints/SKILL.md` for pro-quality's voice and the twelve-factor table in `intent/2026-10-28-pro-ship-scope/research.md` (section "The twelve-factor audit: concrete checks") for the checks.
2. Write `factors.md` from the research table, one section per factor (R9).
3. Write `report.md` (R10, R11).
4. Write `SKILL.md`, linking both sidecars (R1 to R8, R11 to R14).
5. Add the license line, the licenses row, the version bumps and the routing cases (R15 to R17).
6. Update `README.md` and `docs/roadmap.md` (R18).
7. Run AC1 to AC5 and fix until they pass.
