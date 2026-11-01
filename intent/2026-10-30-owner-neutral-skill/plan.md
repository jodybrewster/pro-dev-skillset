# Plan: an owner-neutral skill

Built from `spec.md` and `intent.md` in this folder.
Status: approved.
Approver: Jody Brewster.
Dated: 2026-10-30.

This branch is off `origin/main` beside `intent/twelve-factor-skill`, which also bumps pro-quality.
Whichever merges second rebases and takes the next minor.

## Files that change

- `plugins/pro-quality/skills/owner-neutral/SKILL.md` (new): rule, when to use and not, modes, leak kinds, allowed list, rules, output (R1 to R4, R6, R9 to R11).
- `plugins/pro-quality/skills/owner-neutral/profile.md` (new): the profile pattern and loaders (R5).
- `plugins/pro-quality/skills/owner-neutral/audit.md` (new): token collection, searches, classification, report format (R7, R8).
- `plugins/pro-quality/skills/owner-neutral/principles.md` (new): the twelve principles (R15, R18).
- `plugins/pro-quality/skills/owner-neutral/retrofit.md` (new): retrofit mode (R16).
- Both pro-quality manifests and `.claude-plugin/marketplace.json` (R12).
- `tests/cases/routing.jsonl` (R13).
- `README.md`, `docs/roadmap.md` (R14).

## Steps

1. Read `plugins/pro-quality/skills/constraints/SKILL.md` and `plugins/pro-quality/skills/twelve-factor/` if present for voice; otherwise `plugins/pro-security/skills/security-architect/SKILL.md` for shape.
2. Write `principles.md`, `profile.md`, `audit.md` (with the AI surfaces and `--public`, R17) and `retrofit.md`, then `SKILL.md`.
3. Bumps, routing cases, README and roadmap.
4. Dry-run the audit procedure by hand on this repo's `plugins/` and confirm `pro-ai-sdlc/commands/pr-babysit.md:73` classifies as a leak and the `_Original skill for pro-dev-skillset (...)_` footers as allowed; adjust `audit.md` if not.
5. Run AC1 to AC5 and fix until green.
