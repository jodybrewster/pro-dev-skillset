---
description: "[local test] Lead-research a company/domain/ICP → scored, cited lead profiles. Dev shim for the pro-research plugin's /lead-research."
argument-hint: "<company | domain | ICP description>"
---

Run a **lead-research** deep-research pass for: **$ARGUMENTS**

> Local test shim for the `pro-research` plugin (this repo). Same engine, repo-relative paths.
> The shipped version is `plugins/pro-research/commands/lead-research.md`.

You are the orchestrator. Lead/account path — fans out the company/signals/people agents, verifies,
**scores against the ICP**, and emits lead profiles. Read on demand:
- Orchestration & contract: `plugins/pro-research/skills/lead-research/SKILL.md`
- Engine: `plugins/pro-research/skills/lead-research/references/methodology.md`
- Scoring: `.../references/scoring.md` · Sources: `.../references/sources.md` · Mieruka: `.../references/mieruka.md`

**Scripts directory** (pass to every subagent):
`/Users/jodybrewster/Projects/pro-dev-skillset/plugins/pro-research/skills/lead-research/scripts`

Agents: `plugins/pro-research/agents/{company,signals,people}-researcher.md`.

## Steps

0. **Preflight.** `node -e "process.exit(process.env.SERPER_API_KEY?0:1)"` — if non-zero, check
   `.mieruka/`; else stop and ask the user to `export SERPER_API_KEY=...` and relaunch. Mint
   `run-YYYYMMDD-HHMMSS-<slug>`, create `.research/<run-id>/`, write `run_manifest.json` (objective,
   plan, tier, entity list, and any ICP criteria / scoring_weights from the request).
0.5 **Intake interview** (skip if `$ARGUMENTS` has `--quick`/`--no-interview`). Interview until you have
   enough — adaptive depth. **Recall + inspect before asking**: `node plugins/pro-research/skills/lead-research/scripts/memory.mjs recall`
   to pre-fill durable prefs + a recurring ICP, inspect the repo/`.mieruka/`/prior runs, then ask only
   real gaps — one at a time, recommended answer, hybrid structured/prose. Pin down ICP criteria +
   weights, given-accounts vs discover, required profile fields, plus audience/output/depth/success.
   Echo a refined brief, fold into `run_manifest.json`, then `memory.mjs upsert`/`index`. See methodology.md → "Intake interview".

1. **Parse** `$ARGUMENTS` → one company/domain = one entity; an ICP/list = multiple entities (capture
   ICP criteria into `run_manifest.icp.criteria`). If empty, ask for a company/domain/ICP and stop.
2. **Dispatch company-researcher / signals-researcher / people-researcher per entity, in parallel** —
   on a lower-tier / faster model (e.g. Claude Haiku); they do bounded fetch-and-extract work. Give each
   its entity + run dir + scripts dir. They append to `.research/<run-id>/*.jsonl`.
3. **Verify, then score.**
   `node .../scripts/verify_citations.mjs .research/<run-id>` then `node .../scripts/score.mjs .research/<run-id>`
   (use the absolute scripts path above). Drop/label failed claims.
4. **Output.** Per entity: `.research/<run-id>/<entity>/lead_profile.json` (schema in
   `plugins/pro-research/skills/lead-research/templates/lead_profile.json`) + a markdown brief
   (summary, dated signals, contacts, ICP score + rationale, citations, honest unverified note). If
   `.mieruka/` exists, write the governance mirror per mieruka.md.

Read-only, public sources only; never load auth vaults for the browser rung.
