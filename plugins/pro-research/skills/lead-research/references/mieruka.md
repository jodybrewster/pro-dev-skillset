# Mieruka bridge (optional)

Mieruka is a separate, Storybook-like app that installs into the working repo as `.mieruka/`. This
skill is **independent of it** — everything works with zero Mieruka present. When Mieruka *is* present,
the skill mirrors its output into Mieruka's governance surface so clients see scored leads as readable
evidence (saved profiles, signals, score rationale) without reading code.

Detect-and-degrade is the rule: **check, then mirror; never require.**

## Detection

Mieruka is present iff `.mieruka/` exists at the repo root. The orchestrator checks once at setup
(step 0). If absent, skip everything below — the `.research/<run-id>/` outputs are the only artifacts.

A Serper key may already live in `.mieruka/` config (Mieruka uses Serper too). If `SERPER_API_KEY` is
unset but `.mieruka/` has one, reuse it rather than asking the user for a second key.

## File-mirror (implemented path)

Mieruka observes file changes under `.mieruka/`. The documented workstream contract is
`.mieruka/workstreams/<YYYY-MM-DD>-<slug>/`. For a lead-research run, mirror:

```
.mieruka/workstreams/2026-06-02-lead-research-<slug>/
  status.json        # run state: objective, effort tier, entities, counts, run-id, updated_at
  leads.md           # human-readable: one section per entity — score, band, rationale, key signals, citations
  leads.json         # the array of lead_profile.json objects (machine-readable mirror)
```

`status.json` shape (governance-friendly, mirrors `run_manifest.json` plus progress):
```json
{
  "objective": "Score these 12 accounts against our ICP",
  "run_id": "run-20260602-100000-acme-batch",
  "effort_tier": "broad-sweep",
  "entities": ["Acme", "Globex"],
  "counts": {"sources": 41, "claims": 88, "verified": 79, "leads": 12},
  "bands": {"hot": 3, "warm": 5, "nurture": 3, "disqualify": 1},
  "updated_at": "2026-06-02T10:30:00Z"
}
```

Write the mirror at the **end** of a run (after verify + score), and update `status.json` mid-run if the
run is long enough that live progress matters. This is plain file I/O — no MCP dependency.

## MCP data-layer (DEFERRED — stub)

A richer integration would route retrieval and persistence **through Mieruka's MCP server** rather than
mirroring files: reuse Mieruka's Serper-backed search + Playwright capture, and persist evidence into
Mieruka's SQLite store so the app owns one source of truth.

This is **not implemented** because it requires the live MCP tool schema (registered by
`npx mieruka init` / `/init-mieruka`), which is not pinned here yet. Guessing tool names would be
fragile. To build it later:

1. Read the actual tool list from the registered Mieruka MCP server (e.g. via `claude mcp` / ToolSearch).
2. Map this skill's three operations onto the real tools: **search** (discovery), **read/capture**
   (page → text/screenshot), **persist** (evidence/claims/leads → SQLite).
3. Add a `RESEARCH_PERSIST=mieruka` switch so persistence targets Mieruka's store instead of (or in
   addition to) `.research/`, degrading to files when the server is absent.
4. Keep the file-mirror above as the fallback for headless/CI runs where the MCP server may not be
   authenticated or running.
