---
intent: intent/2026-10-30-owner-neutral-skill/intent.md
status: accepted
created: 2026-10-30T11:10:00-0400
author: the maintainer
---

# Spec: an owner-neutral skill

Built from `intent.md` in this folder.
Policies consulted: `CLAUDE.md`, `REVIEW.md`, ADR-0002, ADR-0004, ADR-0013 and `plugins/pro-quality/skills/constraints/SKILL.md` for pro-quality's voice.

## Requirements

- R1. `plugins/pro-quality/skills/owner-neutral/SKILL.md` exists with `name: owner-neutral` and a description that routes on: hard-coded name or preferences in prompts or code, personal data in the repo, a profile or settings file for the user, "so someone else can use this app", handing an app to another person. It names build mode and audit mode.
- R2. The rule, stated once at the top: code, prompts, skills, templates and test fixtures refer to "the user" or "the owner"; identity, preferences, taste, criteria and personal data come from a profile loaded at run time.
- R3. Leak kinds, each with an example: `identity` (name, email, handle, phone, address), `preference` ("X wants", "X prefers", "X likes", taste written as a rule), `personal-data` (a CV, job history, salary, contacts, health, location in fixtures or seeds), `personal-path` (a home-directory path, a machine name), `account` (a personal account ID, a workspace or bucket name that is the owner's).
  Secrets are routed to `security-audit` and not audited here.
- R4. Allowed and not reported: LICENSE and copyright lines, attribution footers, package `author` fields, commit authors, CODEOWNERS, decision records and changelogs that say who decided or wrote something.
  The line between them: a mention is allowed when it records who; it is a leak when the software's behavior or output depends on it.
- R5. The profile pattern in `profile.md`: a committed example (`profile.example.yaml` or `.json`) holding a made-up person; the real profile outside git, either gitignored at the repo root (`profile.local.yaml`) or under the user's config dir (`~/.config/<app>/profile.yaml`), with the path overridable by an env var `<APP>_PROFILE`; a loader that validates the profile at start-up and fails with a message naming the example file; prompts built from profile fields at run time, never pasted in.
  Short Node/TypeScript (zod) and Python (pydantic) loader examples.
- R6. Build mode: before writing a name, a preference or personal data into code or a prompt, add the field to the example profile and the schema, read it through the loader and write the prompt or code in terms of the field. When there is no profile yet, create the example, the gitignore line and the loader first.
- R7. Audit mode in `audit.md`: collect owner tokens (git `user.name` and its first name, `user.email` and its local part, the home path and username, values from a real profile file if present) and search tracked files for them plus preference phrasing ("<token> (wants|prefers|likes|hates|needs)", "<token>'s"). Classify each hit as a leak kind or allowed (R4). Report one row per leak: `file:line`, kind, the quoted text and where it moves (which profile field).
- R8. Audit output: a summary line (`leaks: <n>  allowed: <n>  files: <n>`), the leak table and a short list of profile fields to add. Printed in chat; written to `.pro-dev/owner-neutral/report.md` when the audit covers a whole repo.
- R9. Audit mode is read-only. The skill never prints the real profile's contents back beyond the quoted leak text.
- R10. The skill text names no real person; examples use a made-up owner (for example "Sam").
- R11. Footer: `_Original skill for pro-dev-skillset. MIT License._` on SKILL.md and the sidecars, in the form other original skills use.
- R12. pro-quality bumps one minor version in both manifests and its marketplace entry; `metadata.version` bumps one minor; descriptions name the skill.
- R13. `tests/cases/routing.jsonl` gains two cases that expect `owner-neutral`: one build prompt (a preference about to go into a prompt), one audit prompt (another person needs to use the app).
- R14. `README.md` lists the skill in the Review row and the pro-quality paragraph; `docs/roadmap.md` gains a line for the follow-ups (the `owner-baked-in` floor-guard rule, cleaning this marketplace's own leaks).

- R15. `plugins/pro-quality/skills/owner-neutral/principles.md` holds twelve numbered principles, each a must with one line of why and the check that proves it.
  SKILL.md lists their names and links the file.
  The principles, in this order:
  1. The code knows no one: no real person's identity in code, prompts, skills, agent files, tests or seeds.
  2. The owner is config: identity, preferences and criteria live in one profile, validated at start-up; the committed example holds a made-up person.
  3. Prompts are templates: every prompt speaks of "the user" and takes profile values at run time; no preference is written into a prompt as a rule.
  4. Repo instructions are about the project: committed `CLAUDE.md`, `AGENTS.md`, skills and agent files describe the project; the owner's working style lives in their user-level instructions, never in the repo.
  5. Fixtures are synthetic: few-shot examples, eval cases, golden outputs, seeds and test data use made-up people; never a real CV, message, contact or history.
  6. Derived data is personal data: embeddings, vector stores, caches, model responses, transcripts, logs and memory files built from a user's data stay out of git and can be rebuilt.
  7. Each user has their own data dir: the path comes from config or env (default the platform's user data dir); the app writes nothing personal inside the repo.
  8. Accounts and keys are the user's: API keys, model provider, account IDs and workspace names come from env; defaults are neutral, never the owner's account.
  9. Taste is a named default: an opinionated default is allowed when it is a documented config value the user can change, not a sentence hidden in a prompt.
  10. Attribution is history, not behavior: R4.
  11. A stranger can run it: clone, copy the example profile, fill it in and run; the README documents exactly that and it is the acceptance test.
  12. Public means the history too: before a repo goes public, audit git history and generated artifacts; when history leaks, publish a fresh history rather than rewriting in place, and only after the owner confirms.
- R16. Retrofit mode in `retrofit.md`: for an existing app that drifted personal, produce an ordered plan: run the audit, design the profile schema from the leaks, add the example and the loader, rewrite prompts as templates, replace fixtures with synthetic ones, move personal and derived data to the data dir, add the stranger test to the README, then the history decision (principle 12).
  It writes the plan and edits code only when asked; it never rewrites history or deletes data itself.
- R17. Audit mode covers the AI surfaces by name: prompt files and strings passed to a model, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.codex/`, skill and agent files, eval and fixture dirs, seed data, vector store and cache dirs, logs and transcripts.
  With `--public` (or "before open-sourcing") it adds a read-only history check (`git log --all -p -S<token>` per owner token, counting commits) and a list of tracked generated artifacts.
- R18. The skill names this repo's own `CLAUDE.md` style of personal rules as the thing principle 4 forbids for apps that are meant for others, and explains that a private tool may keep them only in user-level files.

## Acceptance

- AC1. `node tests/check.mjs && node tests/eval.mjs --dry` passes.
- AC2. `node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs` passes and both new cases rank `owner-neutral` first, with no existing case losing rank 1.
- AC3. `claude plugin validate . --strict` and the per-plugin loop pass.
- AC4. `grep -rn "<maintainer name>" plugins/pro-quality/skills/owner-neutral` returns nothing.
- AC5. No em dash, curly quote or the comma-and sequence in the new files.
