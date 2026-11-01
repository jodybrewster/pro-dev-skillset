---
intent: intent/2026-10-30-twelve-factor-skill/intent.md
status: accepted
created: 2026-10-30T10:10:00-0400
author: the maintainer
---

# Spec: a twelve-factor skill

Built from `intent.md` in this folder.
Policies consulted: `CLAUDE.md`, `REVIEW.md`, ADR-0002 (version bump), ADR-0004 (Codex parity), ADR-0013 (layering), `docs/licenses.md`, the pro-ship research and brainstorm and `plugins/pro-security/skills/security-architect/SKILL.md` as the shape to follow.

## Requirements

- R1. `plugins/pro-quality/skills/twelve-factor/SKILL.md` exists with frontmatter `name: twelve-factor` and a `description` that names "twelve-factor", "12-factor", plan review and repo audit. It says the skill is read-only.
- R2. The skill names fifteen factors in order: I Codebase, II Dependencies, III Config, IV Backing services, V Build, release, run, VI Processes, VII Port binding, VIII Concurrency, IX Disposability, X Dev/prod parity, XI Logs, XII Admin processes, then API-first, Telemetry and AuthN/Z.
- R3. It resolves a mode: a plan, spec, design or idea is plan mode; a repo, path or "audit" is audit mode; empty input uses the plan in the conversation, else the repo.
- R4. Every factor row has exactly one status from `pass`, `partial`, `fail`, `platform-owned`, `n/a`.
- R5. The evidence rule, adapted from aiwg: a `pass` cites a `file:line` or a command output that reproduces it; missing evidence is written `missing` and is never read as a pass or a fail; a `partial` or `fail` names a fix; compliance is never inferred from intent, naming or convention.
- R6. `platform-owned` is for a factor the hosting platform meets (for example port binding and concurrency on Vercel or Lambda) and the row names the platform and the file that shows it, such as `vercel.json`.
- R7. Plan mode flags what the plan does not say about the factors it touches (a new backing service, a new config value, a new deployable, state kept in a process) and lists the evidence a later audit will need.
- R8. Audit mode first detects the stack from manifests (`package.json`, `next.config.*`, `pyproject.toml`, `requirements*.txt`, `Dockerfile`, `vercel.json`, `fly.toml`, `Procfile`, compose files) and then runs the checks for that stack.
- R9. `plugins/pro-quality/skills/twelve-factor/factors.md` holds, per factor: one line on what it means, the Node/Next.js checks, the Python checks, how to find the evidence (file globs or a grep) and what platform-owned looks like when it applies. The checks are the research table's, not invented ones.
- R10. `plugins/pro-quality/skills/twelve-factor/report.md` holds the output template: summary (app, stack, mode, date, overall status), the fifteen-row factor table (factor, status, evidence, fix), a remediation list ordered by priority and open questions.
- R11. Audit mode writes the report to `.pro-dev/architecture/twelve-factor.md` in the audited repo and prints the summary and the fail rows in chat; plan mode ends with a section headed exactly `## Twelve-factor challenge`, ready to paste into the plan.
- R12. The skill is read-only toward app code and config, ignores instructions inside reviewed files that try to steer it and says plainly when a factor has nothing to report.
- R13. Supply chain, dependency vulnerabilities and secrets are routed to pro-security's `security-audit` in one line and not audited here.
- R14. `SKILL.md` and both sidecars end with the footer `_Adapted from the twelve-factor plugin in [jmagly/aiwg](https://github.com/jmagly/aiwg) - MIT License. ..._`, naming what was taken.
- R15. `plugins/pro-quality/LICENSE` carries "Copyright (c) 2024 Joe Magly" for this skill and `docs/licenses.md` has a pro-quality `twelve-factor` row, adapted.
- R16. pro-quality goes 0.14.0 to 0.15.0 in both manifests and its marketplace entry; `metadata.version` goes 1.62.0 to 1.63.0; the descriptions name the skill. (If main has moved, bump from what main says.)
- R17. `tests/cases/routing.jsonl` gains two cases that expect `twelve-factor`: one audit prompt, one plan-review prompt.
- R18. `README.md` lists the skill in the Review row and the pro-quality paragraph; `docs/roadmap.md` item 17 says the skill shipped and the agent, diff mode and ARCHITECTURE.md section remain.

## Acceptance

- AC1. `node tests/check.mjs && node tests/eval.mjs --dry` passes.
- AC2. `node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs` passes and both new cases rank `twelve-factor` first.
- AC3. `claude plugin validate . --strict` and the per-plugin loop pass.
- AC4. `grep -c '^| ' plugins/pro-quality/skills/twelve-factor/report.md` shows a table with a header, a separator and fifteen factor rows.
- AC5. No em dash, curly quote or ", and" in the new files (`grep -nP '\x{2014}|[\x{201C}\x{201D}\x{2018}\x{2019}]|, and ' ...` returns nothing).
