---
description: "[local test] Deep-research any topic → cited report. Dev shim for the pro-research plugin's /research."
argument-hint: "<research question or topic>"
---

Run a **deep-research** pass on: **$ARGUMENTS**

> Local test shim for the `pro-research` plugin (this repo). Same engine, repo-relative paths.
> The shipped version is `plugins/pro-research/commands/research.md`.

You are the orchestrator. General-purpose path — any topic, no scoring, output is a cited report.
Engine detail (loop, effort scaling, escalation ladder, evidence schema, verification, synthesis,
security) is in `plugins/pro-research/skills/lead-research/references/methodology.md` — read it on demand.

**Scripts directory** (pass to every subagent):
`/Users/jodybrewster/Projects/pro-dev-skillset/plugins/pro-research/skills/lead-research/scripts`

The generic angle agent is `plugins/pro-research/agents/research-agent.md` — dispatch subagents with
that role (give each its angle, the run directory, and the scripts directory above).

## Steps

0. **Preflight.** `node -e "process.exit(process.env.SERPER_API_KEY?0:1)"` — if non-zero, check
   `.mieruka/`; if still none, stop and ask the user to `export SERPER_API_KEY=...` and relaunch. If
   `$ARGUMENTS` is empty or too underspecified, ask 2–3 clarifying questions first. Mint
   `run-YYYYMMDD-HHMMSS-<slug>`, create `.research/<run-id>/`, write `run_manifest.json` (question, angles, tier).
0.5 **Intake interview** (skip if `$ARGUMENTS` has `--quick`/`--no-interview`). Interview the user until
   you have enough to research well — adaptive depth. **Recall + inspect before asking**: `node plugins/pro-research/skills/lead-research/scripts/memory.mjs recall`
   to pre-fill durable memory, inspect the repo/`.mieruka/`/prior `.research/` runs, then ask only real
   gaps — one at a time, recommended answer, hybrid structured/prose, dynamic dimensions. Don't stop
   until objective/scope/audience/depth/output/sources/success are clear (or user says "go"). Echo a
   refined brief, fold into `run_manifest.json`, then `memory.mjs upsert`/`index`. See methodology.md → "Intake interview".

1. **Decompose** `$ARGUMENTS` into 3–6 independent angles (scale per the effort table). Record in the manifest.
2. **Dispatch one research-agent per angle, in parallel** — on a lower-tier / faster model (e.g. Claude
   Haiku); they do bounded fetch-and-extract work. Give each its angle + run dir + scripts dir.
   They append evidence/claims to `.research/<run-id>/*.jsonl` and return compact JSON summaries.
3. **Verify.** `node /Users/jodybrewster/Projects/pro-dev-skillset/plugins/pro-research/skills/lead-research/scripts/verify_citations.mjs .research/<run-id>` — drop/label failures.
4. **Synthesize** → write `.research/<run-id>/report.md` and present it: direct answer up top, sections
   by theme, inline `[n]` citations into `sources.jsonl`, plus an honest "Open questions / disagreements /
   unverified" section. If `.mieruka/` exists, optionally mirror per mieruka.md.

Read-only, public sources only; never load auth vaults for the browser rung.
