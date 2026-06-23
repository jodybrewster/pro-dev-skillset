---
name: lead-research
description: >-
  Deep web research engine with lead/account research as its headline use. Give it
  a company, domain, or ICP and it produces scored, cited lead profiles — firmographics,
  buying signals (funding, hiring, news, tech changes), and key public contacts — each
  with an explicit ICP score and evidence trail. Also a general-purpose deep researcher:
  decomposes a question, fans out parallel research subagents, climbs a free-first retrieval
  ladder (Serper search -> Jina/Firecrawl read -> agent-browser), persists evidence to survive
  compaction, and verifies every citation before it ships. Use when: "research this company,"
  "build a lead profile," "score these accounts against our ICP," "who should we target,"
  "find buying signals for X," "deep research on <topic>," "qualify this prospect." Prefer
  this over ad-hoc web search whenever the answer must be cited, scored, or reproducible.
---

<objective>
You are the orchestrator of a deep-research run. You plan the work, scale effort to the
question, dispatch parallel subagents that gather cited evidence, persist everything to disk,
then verify citations and synthesize a scored, sourced result. Subagents do the fetching; you
do the planning, scoring, and synthesis. The headline application is lead/account research,
but the engine is general.
</objective>

## 0. Setup (once per run)

1. Confirm `SERPER_API_KEY` is set (required). If missing, stop and tell the user to copy
   `.env.example` and set it. `JINA_API_KEY` / `FIRECRAWL_API_KEY` are optional (higher limits /
   JS fallback). If `.mieruka/` exists in the repo, a Serper key may already live in its config —
   see `references/mieruka.md`.
2. Mint a run id: `run-YYYYMMDD-HHMMSS-<slug>`. Create `.research/<run-id>/`.
3. Write `run_manifest.json` with: the objective, the decomposed plan, the effort tier, and the
   entity list.

All retrieval goes through the bundled scripts in `scripts/` (invoked via Bash). Never fetch raw
pages into your own context — subagents return compact JSON evidence objects, and the durable copy
lives in `.research/<run-id>/*.jsonl`.

## 0.5 Intake interview (unless `--quick`)

Before planning, **interview the user until you have enough to research well** (skip on `--quick` /
`--no-interview`). Adaptive depth: a rich request gets a short confirm; a thin one gets relentless
grilling. For each question, **recall + inspect before asking**: run `node scripts/memory.mjs recall`
to pre-fill from durable memory, inspect the repo / `.mieruka/` / prior runs, then ask the user only
the real gaps — **one at a time, always with a recommended answer**, hybrid structured/prose. Derive
the questions dynamically per query; don't stop until you understand the objective, scope, audience,
depth, output shape, source preferences, and success criteria (or the user says "go"). Then echo a
refined brief, write it to `run_manifest.json`, and `memory.mjs upsert`/`index` the durable bits.
Full detail: `references/methodology.md` → "Intake interview".

## 1. Plan & scale effort

Decompose the objective into independent research angles, then pick an effort tier:

| Tier | When | Subagents |
|------|------|-----------|
| Quick lookup | one entity, one fact | 1 |
| Comparison | 2–4 entities or facets | 2–4 |
| Broad sweep | ICP scan, many accounts, full profile | 5+ (one angle/entity each) |

For lead research the default angles map to the three agents: **company** (firmographics),
**signals** (funding/hiring/news/tech), **people** (public contacts). Add or drop angles per tier.

## 2. Dispatch subagents (four-part contract)

Dispatch subagents **in parallel** — one message, multiple dispatches — not one at a time. Run them
on a **lower-tier / faster model (e.g. Claude Haiku)**: they do bounded fetch-and-extract work, so the
small model is enough — reserve the larger model for orchestration, scoring, and synthesis. This
controls cost and avoids rate limits on wide fan-outs. Give each a self-contained brief built from
these four parts:

1. **Objective** — the one question this agent answers.
2. **Output format** — append compact JSON evidence objects to `.research/<run-id>/evidence.jsonl`;
   register each source in `sources.jsonl`; extract falsifiable claims to `claims.jsonl`. Return a
   short JSON summary to the orchestrator, never raw page text.
3. **Tool & source guidance** — use `scripts/search.mjs` then `scripts/read.mjs`; escalate to
   `scripts/browse.sh` only for auth-gated / JS-interactive / infinite-scroll targets. See
   `references/sources.md` for where each data class lives.
4. **Task boundaries** — public sources only; no gated-PII scraping; stop when the angle is answered
   or sources go thin; cite every claim with a URL + retrieved-at timestamp.

Agent definitions ship in this plugin's `agents/` directory (`company-researcher`, `signals-researcher`,
`people-researcher`). Enrichment via paid APIs (Exa/Apollo/PDL/Hunter) is **deferred** — see
`references/sources.md`; do not call those.

## 3. Retrieval escalation ladder (free-first)

Each layer escalates only when the cheaper one returns thin results. Full detail in
`references/methodology.md`.

1. **Discovery** — `node scripts/search.mjs "<query>"` (Serper; Brave behind `RESEARCH_SEARCH_PROVIDER=brave`).
2. **Read** — `node scripts/read.mjs <url>` (Jina by default).
3. **Read fallback** — the same script auto-falls-back to Firecrawl for JS-heavy / structured targets.
4. **Interactive** — `scripts/browse.sh <url>` (agent-browser; degrades to a clear no-op if absent).

## 4. Verify, then score

- **Citations:** run `node scripts/verify_citations.mjs .research/<run-id>` — it re-fetches each cited
  URL and checks it actually supports the claim, flagging unverified ones. Do not ship a claim whose
  citation failed verification; downgrade or drop it.
- **Score (lead runs):** run `node scripts/score.mjs .research/<run-id>` to compute the weighted ICP
  score (fit, signal recency, contactability, data confidence) per entity. Rubric + weights in
  `references/scoring.md`.

## 5. Output

Per entity, emit:
- `.research/<run-id>/<entity>/lead_profile.json` — structured, schema in `templates/lead_profile.json`,
  including the ICP score and a score rationale.
- A human-readable markdown brief: summary, key signals, recommended contacts, ICP score with rationale,
  and inline citations. Note any unverified/dropped claims honestly.

**Mieruka mirror (optional):** if `.mieruka/` exists, also write a governance workstream so clients see
scored leads as readable evidence. See `references/mieruka.md`.

## Modes — lead vs. general research

This engine serves two entry points over the **same** scripts and methodology:

- **General research (any topic)** — decompose → dispatch generic `research-agent`s per angle → verify
  → **synthesize a cited report** (`.research/<run-id>/report.md`). No §4 scoring. Driven by `/research`.
- **Lead/account research** — the steps above with the company/signals/people agents and the §4 scoring
  + `lead_profile.json` output. Driven by `/lead-research`.

Sections §1–§3 (plan, dispatch, retrieval) apply to both. §4 scoring + §5 lead profiles are lead-only;
general runs use the synthesis output in `references/methodology.md`.

## References (load on demand)

- `references/methodology.md` — research loop, effort scaling, full escalation ladder, evidence schema,
  verification pass, and the browser-security note. **The generic engine — no lead concepts.**
- `references/scoring.md` — ICP scoring rubric and weights.
- `references/sources.md` — where firmographic / signal / people data lives, plus the deferred enrichment layer.
- `references/mieruka.md` — the optional Mieruka governance mirror + the deferred MCP data-layer path.

## Security note

The `scripts/browse.sh` path can combine a private browser session, untrusted web content, and actions —
the "lethal trifecta." Keep it read-only, public targets only; auth-vault usage is out of scope. See the
security section in `references/methodology.md`.
