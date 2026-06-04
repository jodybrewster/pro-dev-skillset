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

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = process.env.EVAL_MODEL || "claude-haiku-4-5-20251001";
const DRY = process.argv.includes("--dry") || !process.env.ANTHROPIC_API_KEY;

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const listDirs = (p) => (isDir(p) ? readdirSync(p).filter((d) => isDir(join(p, d))) : []);

function frontmatter(text) {
  const data = {};
  if (!text.startsWith("---")) return data;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return data;
  for (const line of text.slice(3, end).split("\n")) {
    const m = line.match(/^(name|description):\s?(.*)$/);
    if (m) data[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return data;
}

// build the skill catalog (excluding gstack — that's its own upstream suite)
function loadCatalog() {
  const catalog = [];
  const slugs = new Set();
  for (const plugin of listDirs(join(ROOT, "plugins"))) {
    if (plugin === "pro-gstack") continue;
    for (const slug of listDirs(join(ROOT, "plugins", plugin, "skills"))) {
      const p = join(ROOT, "plugins", plugin, "skills", slug, "SKILL.md");
      if (!existsSync(p)) continue;
      const fm = frontmatter(readFileSync(p, "utf8"));
      catalog.push({ slug, plugin, description: fm.description || "" });
      slugs.add(slug);
    }
  }
  return { catalog, slugs };
}

function loadCases() {
  return readFileSync(join(ROOT, "tests", "cases", "routing.jsonl"), "utf8")
    .split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}

const asArr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

async function routeOne(prompt, catalog) {
  const list = catalog.map((s) => `- ${s.slug}: ${s.description}`).join("\n");
  const system =
    "You are the skill router for the pro-dev-skillset marketplace. Given a user " +
    "message and a catalog of skills (slug: description), output ONLY the single " +
    "slug of the best-matching skill, or the literal word none if no skill fits. " +
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
const cases = loadCases();

// static sanity: every referenced slug must exist (catches stale cases)
let badRefs = 0;
for (const c of cases) {
  for (const s of [...asArr(c.expect), ...asArr(c.notOneOf)]) {
    if (!slugs.has(s)) { console.log(`✗ case references unknown skill "${s}" — ${c.prompt.slice(0, 50)}`); badRefs++; }
  }
}
if (badRefs) { console.log(`\n✗ ${badRefs} stale skill reference(s) in cases`); process.exit(1); }

if (DRY) {
  const why = process.env.ANTHROPIC_API_KEY ? "--dry" : "no ANTHROPIC_API_KEY";
  console.log(`✓ ${cases.length} cases reference real skills · ${catalog.length} skills in catalog`);
  console.log(`(skipped live routing: ${why}. Set ANTHROPIC_API_KEY to run the model.)`);
  process.exit(0);
}

console.log(`Running ${cases.length} routing cases against ${MODEL} (${catalog.length} skills)…\n`);
let failed = 0;
const results = await Promise.allSettled(cases.map((c) => routeOne(c.prompt, catalog)));
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
