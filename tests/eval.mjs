#!/usr/bin/env node
// Routing evals for the pro-dev-skillset marketplace.
// Feeds every skill's name+description to Claude as the router, asks it to pick
// the best-matching skill for each prompt, and asserts against expectations.
//
//   node tests/eval.mjs                 # run all cases (needs ANTHROPIC_API_KEY)
//   node tests/eval.mjs --dry           # validate cases reference real skills, no API
//   EVAL_MODEL=claude-haiku-4-5-20251001 node tests/eval.mjs
//
// Without ANTHROPIC_API_KEY it falls back to --dry (so keyless CI still passes
// after a static sanity pass). Cases live in tests/cases/routing.jsonl:
//   { "prompt": "...", "expect": "slug" | ["slugA","slugB"], "notOneOf": ["x"] }
//   expect    — chosen skill must be one of these (omit to skip positive check)
//   notOneOf  — chosen skill must NOT be one of these (e.g. a HOLD boundary)

import { loadCatalog, loadCases, DISTRACTORS } from "./lib/catalog.mjs";

const MODEL = process.env.EVAL_MODEL || "claude-haiku-4-5-20251001";
const DRY = process.argv.includes("--dry") || !process.env.ANTHROPIC_API_KEY;

const asArr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

async function routeOne(prompt, catalog) {
  const list = catalog.map((s) => `- ${s.slug} (${s.kind || "skill"}): ${s.description}`).join("\n");
  const system =
    "You are the router for the pro-dev-skillset marketplace. Given a user " +
    "message and a catalog of skills and subagents (slug (kind): description), output ONLY the single " +
    "slug of the best-matching entry, or the literal word none if nothing fits. " +
    "No punctuation, no explanation — just the slug.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 32,
      temperature: 0,
      system,
      messages: [{ role: "user", content: `Catalog:\n${list}\n\nUser message:\n${prompt}` }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.content?.[0]?.text || "").trim().replace(/[^a-z0-9-]/gi, "");
}

// ── run ──────────────────────────────────────────────────────────────────────
const { catalog, slugs } = loadCatalog();
const fullCatalog = [...catalog, ...DISTRACTORS];
const allSlugs = new Set([...slugs, ...DISTRACTORS.map((d) => d.slug)]);
const cases = loadCases();

// static sanity: every referenced slug must exist (catches stale cases)
let badRefs = 0;
for (const c of cases) {
  for (const s of [...asArr(c.expect), ...asArr(c.notOneOf)]) {
    if (!allSlugs.has(s)) { console.log(`✗ case references unknown skill "${s}" — ${c.prompt.slice(0, 50)}`); badRefs++; }
  }
}
if (badRefs) { console.log(`\n✗ ${badRefs} stale skill reference(s) in cases`); process.exit(1); }

if (DRY) {
  const why = process.env.ANTHROPIC_API_KEY ? "--dry" : "no ANTHROPIC_API_KEY";
  console.log(`✓ ${cases.length} cases reference real skills · ${catalog.length} skills in catalog + ${DISTRACTORS.length} distractors`);
  console.log(`(skipped live routing: ${why}. Set ANTHROPIC_API_KEY to run the model.)`);
  process.exit(0);
}

console.log(`Running ${cases.length} routing cases against ${MODEL} (${catalog.length} skills + ${DISTRACTORS.length} distractors)…\n`);
let failed = 0;
const results = await Promise.allSettled(cases.map((c) => routeOne(c.prompt, fullCatalog)));
results.forEach((r, i) => {
  const c = cases[i];
  if (r.status === "rejected") { console.log(`✗ ERROR  ${c.prompt.slice(0, 50)} — ${r.reason.message}`); failed++; return; }
  const chosen = r.value || "none";
  const expect = asArr(c.expect), notOneOf = asArr(c.notOneOf);
  const okPos = expect.length === 0 || expect.includes(chosen);
  const okNeg = !notOneOf.includes(chosen);
  const pass = okPos && okNeg;
  if (!pass) failed++;
  const want = expect.length ? `expect ${expect.join("|")}` : `not ${notOneOf.join("|")}`;
  console.log(`${pass ? "✓" : "✗"} ${chosen.padEnd(28)} [${want}]  ${c.prompt.slice(0, 48)}`);
});

console.log(`\n${failed ? "✗" : "✓"} ${cases.length} cases · ${failed} failures`);
process.exit(failed ? 1 : 0);
