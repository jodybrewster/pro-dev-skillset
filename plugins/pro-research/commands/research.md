---
description: Deep-research any topic — decomposes the question into angles, fans out research subagents over the free-first retrieval ladder, persists cited evidence, verifies citations, and synthesizes a cited report. General-purpose (no lead scoring).
argument-hint: "<research question or topic>"
---

Run a **deep-research** pass on: **$ARGUMENTS**

You are the orchestrator. This is the **general-purpose** path — any topic, no ICP scoring, no lead
profiles. The output is a cited report. Engine detail (research loop, effort scaling, escalation
ladder, evidence schema, verification, synthesis, security) lives in:
`${CLAUDE_PLUGIN_ROOT}/skills/lead-research/references/methodology.md`

**Scripts directory** (pass this exact path to every subagent): `${CLAUDE_PLUGIN_ROOT}/skills/lead-research/scripts`

## Steps

0. **Preflight.** Confirm a Serper key: `node -e "process.exit(process.env.SERPER_API_KEY?0:1)"` — if
   non-zero, check `.mieruka/` (see mieruka.md); if still none, stop and ask the user to
   `export SERPER_API_KEY=...`. If `$ARGUMENTS` is empty **or too underspecified to research well**,
   ask 2–3 clarifying questions (scope, depth, constraints) first, then proceed. Mint
   `run-YYYYMMDD-HHMMSS-<slug>`, create `.research/<run-id>/`, write `run_manifest.json` (question,
   decomposed angles, effort tier).

0.5 **Intake interview** (skip if `$ARGUMENTS` contains `--quick` / `--no-interview`). Interview the
   user until you have enough to research well — adaptive depth (rich query → short confirm; thin query
   → relentless). For each question, **recall + inspect before asking**: `node ${CLAUDE_PLUGIN_ROOT}/skills/lead-research/scripts/memory.mjs recall`
   to pre-fill from durable memory, inspect the repo/`.mieruka/`/prior runs, then ask only real gaps —
   one at a time, recommended answer, hybrid structured/prose, dimensions derived dynamically. Don't
   stop until objective/scope/audience/depth/output/sources/success are clear (or user says "go").
   Echo a refined brief, fold it into `run_manifest.json`, then `memory.mjs upsert` durable prefs and
   `memory.mjs index` the run. See methodology.md → "Intake interview".

1. **Decompose** `$ARGUMENTS` into independent angles — typically 3–6, scaled per the effort table in
   methodology.md (a narrow factual question may need 1–2; a broad survey more). Record them in the manifest.

2. **Dispatch one `research-agent` per angle, in parallel** — on a lower-tier / faster model (e.g.
   Claude Haiku); they do bounded fetch-and-extract work. Give each its angle, the run directory, and
   the scripts directory above. They write evidence/claims to `.research/<run-id>/*.jsonl` and return
   compact JSON summaries.

3. **Verify.** `node ${CLAUDE_PLUGIN_ROOT}/skills/lead-research/scripts/verify_citations.mjs .research/<run-id>`.
   Drop or explicitly label any claim that failed verification. (No scoring step — that's the lead path.)

4. **Synthesize a cited report** → write `.research/<run-id>/report.md` and present it:
   - a direct answer to the question up top, then sections by theme;
   - every non-obvious claim carries an inline citation `[n]` mapping to a source in `sources.jsonl`;
   - a "Sources" list, and an honest "Open questions / disagreements / unverified" section noting
     where sources conflicted or a claim couldn't be verified.
   If `.mieruka/` exists, optionally mirror the report into a governance workstream (see mieruka.md).

Keep it read-only and public-sources-only; never load auth vaults for the browser rung.
