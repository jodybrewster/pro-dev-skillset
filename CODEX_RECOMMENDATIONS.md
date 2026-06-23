# Codex Recommendations

Feedback from the Codex review on 2026-05-24.

## Summary

The research supports this repo's current direction, but the repo should stay curated rather than expanding into a large all-purpose frontend framework. The current marketplace is strongest as a personal/team methodology stack with focused plugins, not as an ECC-style kitchen sink.

## Recommendations

1. **Keep `pro-starter` lean.**
   The current split into `pro-core`, `pro-execution`, `pro-quality`, `pro-design`, `pro-testing`, `pro-data`, `pro-pdd`, and `pro-nextjs` is coherent. Keep `pro-pdd` opt-in and avoid adding `pro-meta`, `pro-vite-react`, or `pro-observability` until repeated real project demand makes them worth the extra surface area.

2. **Decide whether `pro-nextjs` stays a marker or becomes real.**
   The research describes a richer `pro-nextjs` plugin with App Router, React Server Components, Server Actions, Vercel, and v0 handoff guidance. The repo currently treats `pro-nextjs` as a marker plugin. That is fine, but it should be intentional. If most target projects are Next.js apps, graduating `pro-nextjs` into a real stack plugin is probably the next highest-value addition.

3. **Add upstream provenance metadata.**
   Per-plugin `LICENSE` files and SKILL footers are useful, but quarterly drift audits would be easier with explicit source metadata. Add either per-plugin `UPSTREAM.md` files or per-skill `UPSTREAM` files containing source repo, path, commit, and local modification notes.

4. **Keep companion plugins opt-in for now.**
   The research recommends cross-marketplace dependencies, but this repo intentionally avoids them because missing cross-marketplace deps can silently disable plugins. Keep the companion-script approach unless current Claude Code behavior is re-tested and confirmed to be safer.

5. **Consider `pro-meta` only for maintenance.**
   A small maintenance plugin or script collection could help this repo scale: upstream checks, release checklist helpers, Codex parity smoke instructions, and marketplace audit tooling. Do not install it by default through `pro-starter`.

6. **Add a drift-audit script.**
   The biggest recurring risk is documentation and manifest drift. Add a script that checks:
   - marketplace and plugin version consistency
   - `SKILL.md` count used in docs
   - legacy `superpowers:` references
   - missing sidecar files referenced by skills
   - dependency ranges after version bumps
   - stale private-repo install commands

7. **Keep wholesale imports isolated.**
   This recommendation was superseded for GStack by the opt-in `pro-gstack` comparison plugin. The default stack should still stay curated: `pro-gstack` vendors the full upstream source for traceability, exposes prefixed harness-neutral adapters, and remains outside `pro-starter`. Treat ECC and any future large imports the same way unless they earn promotion through repeated use.

## Practical Next Steps

1. Add upstream provenance metadata.
2. Add a drift-audit script and wire it into CI.
3. Decide whether `pro-nextjs` should become a real stack plugin.
4. Re-test cross-marketplace dependency behavior before replacing companion scripts with plugin dependencies.

## Follow-up Recommendations from Repo Review

Feedback from the Codex repo review on 2026-06-23.

### Summary

The repo is moving in the right direction: `using-pro-dev` gives the marketplace a real lifecycle
map, plugin boundaries are mostly coherent, and the static checks already catch version, router,
frontmatter, and reference drift. The next improvements should focus on making Codex a true first-
class target, making lifecycle state durable enough for Mieruka, and tightening the pre-PR shipping
path so the user's main role becomes planning, approving plans, and reviewing PRs.

### Recommendations

1. **Make `AGENTS.md` the canonical cross-harness instruction file.**
   Add a root `AGENTS.md` and make `CLAUDE.md` point to the same policy, either by symlink or by a
   tiny wrapper that links to `AGENTS.md`. If symlinks prove brittle across installers or editors,
   keep both files committed and add a drift check that fails when their shared policy sections
   diverge. Update commands that read repo policy, especially `/gh`, to read `AGENTS.md`,
   `CLAUDE.md`, `.agents/AGENTS.md`, and `.claude/CLAUDE.md` in that order.

2. **Expand Codex parity from "skill body" to "plugin surface."**
   `tests/check.mjs` currently checks `SKILL.md` bodies for a few Claude-only terms, but commands
   and sidecar prompt templates can still contain hard-coded Claude Code assumptions. Extend the
   check to scan command files, sidecars, and frontmatter keys across the plugin surface, excluding
   vendored upstream snapshots where appropriate. Flag hard requirements such as `Task tool`,
   `TodoWrite`, `mcp__...` tool names, and Claude-only policy file names unless the text includes a
   harness-neutral fallback.

3. **Treat non-standard skill frontmatter as a Codex risk.**
   A few `SKILL.md` files use keys beyond the Agent Skills baseline (`allowed-tools`, `argument-hint`,
   `metadata`, `license`, `dependencies`, `user-invocable`). Claude may tolerate these, but Codex
   compatibility should be verified or the keys should move into the body. The parity check should
   either enforce the portable subset (`name`, `description`, optional `tags` / `tools` / `model`) or
   maintain an explicit allowlist backed by a Codex smoke test.

4. **Add an automated Codex smoke test path.**
   The README correctly says CI does not yet enforce Codex compatibility. Add a best-effort CI job
   once Codex marketplace commands stabilize, preferably `continue-on-error` at first. Until then,
   add a local script that registers the marketplace, enables the default plugins explicitly, and
   verifies that Codex can enumerate the expected skill slugs.

5. **Make plan approval a durable lifecycle gate.**
   To support the desired flow, "plan, review plans, review PRs," the lifecycle needs a first-class
   approved-plan state. Model the default path as:
   `Define -> Plan Draft -> Plan Review/Approval -> Build -> Verify -> Pre-PR Gate -> PR Review -> Ship`.
   Build/execution skills should consume an approved plan artifact or explicitly record when the user
   chose to skip formal planning.

6. **Implement `/gate` as the first concrete Ship primitive.**
   The gated pre-PR pipeline is a good fit because `pro-ship` is still planned and `/gh` intentionally
   stays one-action-per-turn. `/gate` should own the pre-push middle: rebase, review, tests, docs,
   lint, explicit push approval, PR creation, and CI reporting. It should stop at a clean PR and
   leave final PR review and `/gh ship` to the user.

7. **Create a reusable Mieruka bridge contract.**
   Mieruka integration is promising but currently varies by skill. Extract a shared reference or
   skill that defines the integration rule: detect `.mieruka/`, try MCP when tools are available,
   fall back to a file mirror, and never fail the core workflow when Mieruka is absent. Keep
   harness-specific MCP tool names in an adapter section rather than in the main workflow prose.

8. **Use Mieruka as the lifecycle state surface, not a hard dependency.**
   Mieruka should own visible workstream state, approval gates, evidence boards, and handoffs when it
   is present. The skill marketplace should still work without it by writing durable markdown/JSON
   artifacts. This keeps the marketplace portable while letting Mieruka make the process less
   terminal-centered.

9. **Fix small repo hygiene drift.**
   Remove stale `pro-mieruka` references from bootstrap/docs until that plugin exists, add
   `__pycache__/` and `*.pyc` to `.gitignore`, and consider ignoring common generated outputs at the
   repo root. Also update `using-pro-dev` to mention the shipped `wt` skill so the router warning
   from `tests/check.mjs` goes away.

### Practical Next Steps

1. Add `AGENTS.md` and update `/gh`, docs freshness hooks, and repo policy language to read both
   `AGENTS.md` and `CLAUDE.md`.
2. Expand `tests/check.mjs` to scan commands and sidecars for Codex parity issues.
3. Add an approved-plan artifact and Mieruka/file-mirror status schema for lifecycle gates.
4. Implement `/gate` in `pro-quality` or the eventual `pro-ship` boundary, starting with the native
   orchestrator plan already reviewed.
5. Extract a reusable Mieruka bridge reference and update SPDD/research integrations to use it.
