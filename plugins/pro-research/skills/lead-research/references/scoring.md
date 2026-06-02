# ICP scoring rubric

`scripts/score.mjs` computes a single 0–100 **ICP score** per entity from four weighted components.
The weights are the default ICP; override them per engagement via `.research/<run-id>/run_manifest.json`
(`scoring_weights`) or env (`RESEARCH_SCORING_WEIGHTS` as JSON). Weights must sum to 1.0.

## Components & default weights

| Component | Weight | What it measures | Scored from |
|-----------|--------|------------------|-------------|
| **fit** | 0.40 | How well the entity matches the ICP definition (industry, size, geo, tech, business model) | firmographic evidence vs. the ICP spec |
| **signal_recency** | 0.25 | How fresh and relevant the buying signals are (funding, hiring, leadership change, tech adoption) | signal evidence timestamps + signal type |
| **contactability** | 0.20 | Whether there's a reachable, relevant decision-maker from public sources | people evidence (role match + a public contact path) |
| **data_confidence** | 0.15 | How well-verified the underlying evidence is | share of claims with `verified: true` + source quality |

`score = 100 * Σ(weight_i × component_i)`, each component normalized to 0–1.

## Component scoring (0–1 each)

**fit** — fraction of ICP criteria met, weighted by how hard each is to satisfy. A criterion is "met"
only if backed by a verified claim. Unknown criteria count as 0, not as a guess.

**signal_recency** — combine signal **freshness** and signal **strength**:
- Freshness decays: `< 30d → 1.0`, `< 90d → 0.7`, `< 180d → 0.4`, `< 365d → 0.2`, older → 0.05.
- Strength by type: funding / leadership change / new-tech adoption = strong (×1.0); hiring surge /
  product launch = medium (×0.7); generic news mention = weak (×0.4).
- Component = max over signals of `freshness × strength` (the single best live signal dominates),
  with a small bonus for multiple concurrent strong signals (cap at 1.0).

**contactability** — `0` no relevant public contact; `0.5` a relevant role identified but no public
contact path; `1.0` a relevant decision-maker with a public, non-gated contact path. **No gated-PII
scraping** — see `sources.md`.

**data_confidence** — `0.6 × (verified_claims / total_claims) + 0.4 × mean_source_quality`, where
source quality is a 0–1 prior by source type (official/registry/filing = high, reputable press =
medium, aggregators/blogs = low).

## Score rationale (required)

`score.mjs` emits a `score_rationale` string per entity naming the dominant driver and the biggest gap,
e.g. _"82 — strong fit (5/6 ICP criteria) and a fresh $40M Series B (Mar 2026); capped by contactability
(role found, no public email) and one unverified hiring claim."_ The rationale ships in the lead profile
and the markdown brief so a human can audit the number.

## Banding (for the brief)

`≥ 80` hot · `60–79` warm · `40–59` nurture · `< 40` disqualify (for now). Bands are presentation only;
the raw score is the source of truth.
