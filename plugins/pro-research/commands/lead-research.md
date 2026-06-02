---
description: Run a lead-research deep-research pass on a company, domain, or ICP — fans out research subagents, persists cited evidence, verifies citations, and emits scored lead profiles. Deterministic test entry point for the lead-research skill.
argument-hint: "<company | domain | ICP description>"
---

Run a **lead-research** deep-research pass for: **$ARGUMENTS**

You are the orchestrator. Execute the lead-research workflow end to end. The skill, its references,
agents, and bundled scripts all ship in this plugin — load detail on demand:

- Orchestration & subagent contract: `${CLAUDE_PLUGIN_ROOT}/skills/lead-research/SKILL.md`
- Engine detail (loop, effort scaling, escalation ladder, evidence schema, verification, security):
  `${CLAUDE_PLUGIN_ROOT}/skills/lead-research/references/methodology.md`
- Scoring rubric: `${CLAUDE_PLUGIN_ROOT}/skills/lead-research/references/scoring.md`
- Source map: `${CLAUDE_PLUGIN_ROOT}/skills/lead-research/references/sources.md`
- Mieruka mirror: `${CLAUDE_PLUGIN_ROOT}/skills/lead-research/references/mieruka.md`

**Scripts directory** (pass this exact path to every subagent so it can call the tools):
`${CLAUDE_PLUGIN_ROOT}/skills/lead-research/scripts`

## Steps

0. **Preflight.** Confirm a Serper key is reachable:
   `node -e "process.exit(process.env.SERPER_API_KEY?0:1)"` — if it exits non-zero, check for a key
   in `.mieruka/` (see mieruka.md); if still none, stop and tell the user to
   `export SERPER_API_KEY=...` (it lives in their shell profile but the tool shell may not have it).
   Then mint `run-YYYYMMDD-HHMMSS-<slug>`, create `.research/<run-id>/`, and write `run_manifest.json`
   (objective, plan, effort tier, entity list, and any ICP criteria / scoring_weights from the request).

0.5 **Intake interview** (skip if `$ARGUMENTS` contains `--quick` / `--no-interview`). Interview the
   user until you have enough — adaptive depth. **Recall + inspect before asking**: `node ${CLAUDE_PLUGIN_ROOT}/skills/lead-research/scripts/memory.mjs recall`
   to pre-fill durable prefs + a recurring ICP, inspect the repo/`.mieruka/`/prior runs, then ask only
   real gaps — one at a time, recommended answer, hybrid structured/prose, dynamic dimensions. For lead
   runs, pin down: **ICP criteria + weights, given-accounts vs discover, required profile fields**, plus
   the shared basics (audience/output/depth/success). Don't stop until those are clear (or user says
   "go"). Echo a refined brief, fold it into `run_manifest.json` (incl. `icp.criteria`/`scoring_weights`),
   then `memory.mjs upsert` the durable ICP/prefs and `memory.mjs index` the run. See methodology.md → "Intake interview".

1. **Parse `$ARGUMENTS`.** One company/domain → a single entity. An ICP description or a list →
   multiple entities (and capture the ICP criteria into `run_manifest.icp.criteria` so scoring can
   match them). If `$ARGUMENTS` is empty, ask the user for a company, domain, or ICP and stop.

2. **Scale effort & dispatch** (per the effort table in methodology.md). For each entity, dispatch the
   three agents **in parallel** — `company-researcher`, `signals-researcher`, `people-researcher` — on a
   lower-tier / faster model (e.g. Claude Haiku); they do bounded fetch-and-extract work. Give each the
   four-part brief: its entity, the run directory, and the scripts directory above. They write
   evidence/claims directly to `.research/<run-id>/*.jsonl` and return compact JSON summaries.

3. **Verify, then score.**
   `node ${CLAUDE_PLUGIN_ROOT}/skills/lead-research/scripts/verify_citations.mjs .research/<run-id>`
   then `node ${CLAUDE_PLUGIN_ROOT}/skills/lead-research/scripts/score.mjs .research/<run-id>`.
   Drop or label any claim that failed verification.

4. **Output.** Per entity: `.research/<run-id>/<entity>/lead_profile.json` (schema in
   `templates/lead_profile.json`) plus a human-readable markdown brief — summary, key dated signals,
   recommended contacts, ICP score + rationale, inline citations, and an honest note of any
   unverified/dropped claims. If `.mieruka/` exists, also write the governance mirror per mieruka.md.

Keep it read-only and public-sources-only; never load auth vaults for the browser rung.
