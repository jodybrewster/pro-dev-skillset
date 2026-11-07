---
intent: intent.md
intent-status: proposed
status: draft
created: 2026-11-07T10:40:00-0500
author: the maintainer
module: m6
---

# Spec m6: source-driven development

Built from `intent.md` in this folder (commit 5041d4a), module m6 of [capability-map.md](./capability-map.md).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `REVIEW.md`, ADR-0002, ADR-0003, ADR-0004, ADR-0015 amendment, `docs/licenses.md`, `plugins/pro-nextjs/skills/next-best-practices/SKILL.md`, agent-skills `skills/source-driven-development/SKILL.md` and `hooks/SDD-CACHE.md` (read as data).

## Summary

pro-execution gains `source-driven-development`, forked from agent-skills: before framework code is written, read the installed version, fetch the official docs for that version and cite them.
Its `sdd-cache` hooks store fetched pages under `.pro-dev/` and serve one only when the server answers 304 to a conditional GET.

## Assumptions

Confirmed on 2026-11-07:

1. Only `next-best-practices` does this today, for Next.js alone.
2. The upstream hooks are two shell scripts on WebFetch (pre and post); the fork rewrites them in Python 3.9 stdlib to match this repo's hooks.
3. The cache lives in `.pro-dev/sdd-cache/`, which `evidence.ensure_excluded` keeps out of commits.
4. A conditional GET is a network call and needs a REVIEW.md pass 2 exception like the merge gate's.

## Requirements

### Functional

- R1. `plugins/pro-execution/skills/source-driven-development/SKILL.md` is forked from agent-skills with the footer, harness-neutral prose and these steps: read the installed version from the lockfile or manifest, fetch the docs for that version, cite the URL and section in the code comment or PR body, prefer the source over memory when they disagree (intent: "source-driven development forked from agent-skills into pro-execution, with its docs cache").
- R2. `plugins/pro-execution/scripts/sdd-cache.py` runs as PreToolUse and PostToolUse on `WebFetch`: pre serves a cached page when the server returns 304 to `If-None-Match` or `If-Modified-Since`; post stores the fetched page with its validators.
- R3. The cache key is the URL; entries older than thirty days are revalidated, never served blind.
- R4. The hook fails open: any error exits 0 and the fetch proceeds as if there were no cache.
- R5. `plugins/pro-execution/hooks/hooks.json` is created with the two entries; it is the plugin's only hook file.
- R6. `next-best-practices` links to the new skill for the fetch step instead of describing its own.

### Non-functional

- N1. The pre hook adds under two seconds on a cache miss and under 300 ms on a 304.
- N2. Python 3.9 stdlib only, `urllib` for the conditional GET.
- N3. `docs/licenses.md` gains a forked row (MIT, Copyright (c) 2025 Addy Osmani); `plugins/pro-execution/LICENSE` carries the line.

### Policy constraints applied

- Hook-loading law (ADR-0003): a new `hooks/hooks.json` for pro-execution, both scripts tracked.
- REVIEW.md pass 2: the conditional GET is a new network call; the ADR-0015 amendment line gains `sdd-cache.py`, limited to the URL the model already asked WebFetch for.
- Codex parity (ADR-0004): the skill prose names no harness; the hooks are Claude-only and documented as such in `docs/codex-parity.md`.
- Forked content rule: footer and licenses row (N3).
- agent-skills is the baseline: the skill's steps are adopted in full; the shell hooks are rewritten with a written reason (this repo's hooks are Python).

### Boundaries

Always: cite the source, revalidate before serving.
Ask first: fetching docs from a host other than the framework's official domain.
Never: serve a stale page without a 304, write the cache into a commit.

## Design

### System

- Skill, two hook entries, one script, a licenses row, a parity note, a line in `next-best-practices`.
- Tests: `tests/execution-hooks.mjs` (new) with a local HTTP fixture answering 200 then 304, mirroring super-board's `tests/fixtures/runtime_http_server.py` idea in Node.

### Alternatives considered

- Keeping the upstream shell hooks: every other hook here is Python and the test harness drives Python; two shells would be the odd ones out.
- No cache: each `/execute` step would refetch the same page.

## Flagged concerns

ADR needed: no, ADR-0015's amendment already governs a hook's network call; this adds a name to its list.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | A hook that makes a network call, which REVIEW.md pass 2 forbids outside the merge gate | `REVIEW.md`, ADR-0015 amendment | resolved on 2026-11-07: `sdd-cache.py` joins the exception with the limit in Policy constraints |
| 2 | Codex gets the skill but not the hooks | ADR-0004 | resolved: documented gap in `docs/codex-parity.md`; the skill works without the cache |

## Open questions

- Resolved: ship with the cache hooks under the stated limit (concern 1).

## Acceptance criteria

- AC1. The skill passes `node tests/check.mjs` and has a routing case that sends "which API does this version of Astro use for middleware" to it.
- AC2. Against the HTTP fixture, the first WebFetch stores the page and the second, after the fixture answers 304, is served from the cache; a fixture answering 200 again replaces it.
- AC3. With the fixture down, WebFetch proceeds and the hook exits 0.
- AC4. `.pro-dev/sdd-cache/` is untracked after a run.
- AC5. `docs/licenses.md` and `plugins/pro-execution/LICENSE` have the lines; `claude plugin validate plugins/pro-execution --strict` passes.

## Out of scope

- A shared docs cache across repos.
- Fetching paywalled or authenticated docs.
