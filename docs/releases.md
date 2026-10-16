# Releases

The current version of every plugin, when it shipped and what it shipped.
A release row is added or updated in the same PR as the version bump, and each version is tagged `<plugin>--v<version>` after the PR merges (see [RELEASING.md](../RELEASING.md)).
Dates and commits come from `git log -- plugins/<name>`; the last tag column shows where tagging stood before this table existed.

Marketplace `metadata.version`: 1.42.2.

| Plugin | Version | Date | What shipped | Commit | Last tag before this table |
|---|---|---|---|---|---|
| pro-astro | 0.1.1 | 2026-10-16 | Standard original-skill footer on the four Astro skills | this PR | none |
| pro-core | 0.15.1 | 2026-10-16 | LICENSE with the vercel-labs/skills copyright line and the dream fork; visible find-skills footer | this PR | pro-core--v0.13.0 |
| pro-data | 0.4.5 | 2026-07-26 | Hooks merged into one `hooks/hooks.json` | 8597453 (PR 34) | pro-data--v0.2.0 |
| pro-design | 0.9.1 | 2026-10-16 | Original-skill footer on `motion` | this PR | pro-design--v0.3.0 |
| pro-execution | 0.3.3 | 2026-08-30 | Dropped the worktrunk dependency that blocked plugin load | 4337f0a (PR 44) | none |
| pro-legal | 0.1.1 | 2026-10-16 | Original-skill footer on `software-counsel` | this PR | none |
| pro-motion | 0.1.0 | 2026-06-23 | First release: gsap, hyperframes and remotion skills | c4460d3 | none |
| pro-nextjs | 0.8.2 | 2026-10-16 | LICENSE recording the Vercel source; next-* footers name vercel-labs/next-skills and vercel/next.js; original footer on `shadcn` | this PR | pro-nextjs--v0.5.0 |
| pro-pdd | 0.4.2 | 2026-10-16 | LICENSE with the superpowers, agent-skills and adhd copyright lines | this PR | none |
| pro-quality | 0.9.3 | 2026-10-16 | LICENSE gains the VoltAgent copyright lines | this PR | pro-quality--v0.9.1 |
| pro-research | 0.3.2 | 2026-10-16 | Original-skill footer on `lead-research` | this PR | none |
| pro-security | 0.1.0 | 2026-10-02 | First release: security architect with planning and commit gates | 4ba0a6f (PR 46) | none |
| pro-spdd | 0.3.5 | 2026-10-16 | PORT-PLAN smoke test uses a path placeholder instead of a home directory | this PR | pro-spdd--v0.2.1 |
| pro-starter | 1.12.2 | 2026-10-16 | Re-resolves the eight dependencies PR 51 patched (pro-core, pro-pdd, pro-quality, pro-nextjs, pro-astro, pro-design, pro-testing and pro-research) and pro-testing 0.5.7 | this PR | pro-starter--v1.0.3 |
| pro-testing | 0.5.7 | 2026-10-16 | LICENSE carries the full Apache-2.0 text for the agent-browser fork (section 4(a)) and records that upstream has no NOTICE | this PR | pro-testing--v0.2.0 |
