# Where lead data lives (free-first)

Source guidance for the research subagents. Free, public sources only in this build. Each agent should
prefer the highest-quality source for its data class and cite every claim.

## Firmographics → `company-researcher`

| Data | Free public source |
|------|--------------------|
| What they do / positioning | company site (`/`, `/about`, `/product`), via `read.mjs` |
| Size / headcount band | site careers page, public press, job-posting volume (proxy) |
| HQ / geo / legal entity | site footer, company registries (Companies House UK, SEC EDGAR US, OpenCorporates) |
| Industry / category | site copy, G2/Capterra category, press descriptions |
| Tech stack (coarse) | careers/job posts, engineering blog, public status page |

## Buying signals → `signals-researcher`

Signals are time-sensitive — always capture a date. Strong signals dominate the recency score
(see `scoring.md`).

| Signal | Free public source |
|--------|--------------------|
| Funding / M&A | press releases, TechCrunch/Crunchbase-news (free articles), SEC filings |
| Hiring surge | company careers page, public job boards (count + roles) |
| Leadership change | press, company blog, "leadership"/"team" page diffs |
| Tech adoption / migration | engineering blog, job-post requirements, conference talks |
| Product launch | company blog, Product Hunt, press |

## People → `people-researcher`

**Public sources only. No gated-PII scraping, no scraping of login-walled networks, no buying personal
contact data.** Identify *roles* and *public* contact paths.

| Data | Free public source |
|------|--------------------|
| Decision-maker roles | company "team"/"leadership" page, press quotes, conference speaker lists |
| Public contact path | published work email pattern on the site, public "contact us", author bylines |
| Spokesperson / champion | blog authorship, public talks, podcast appearances |

If the only path to a contact is a gated/PII source, record the **role** and mark contactability as
"role only" — do not attempt to defeat the gate.

---

## DEFERRED — the enrichment layer (not implemented)

Paid enrichment APIs would deepen people/firmographic coverage, but are **out of scope** for this build.
They are documented here and stubbed as `agents/enrichment-researcher.md.disabled` (inert filename so it
cannot load). Do **not** wire these without an explicit decision — they are paid and some touch PII.

| Provider | Would add | Key (placeholder in `.env.example`) |
|----------|-----------|--------------------------------------|
| Exa | semantic/neural search, similar-company discovery | `EXA_API_KEY` |
| Apollo | contact + firmographic enrichment | `APOLLO_API_KEY` |
| People Data Labs | person/company enrichment | `PDL_API_KEY` |
| Hunter | email-pattern verification | `HUNTER_API_KEY` |

When this layer is built: add `enrichment-researcher` as a live agent, gate each provider behind its
key (degrade if absent), keep PII handling explicit, and route any contact data through the same
verification + persistence as the free layer.
