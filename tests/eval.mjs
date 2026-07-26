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

// Hardcoded routing distractors: real user-level skills that compete for the
// same prompts in actual sessions but live outside this marketplace, so
// loadCatalog() below never sees them. Descriptions snapshotted from the
// user's real environment on 2026-07-17.
const DISTRACTORS = [
  {
    slug: "impeccable",
    plugin: "external",
    description:
      "Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks.",
  },
  {
    slug: "dataviz",
    plugin: "external",
    description:
      "Use this skill whenever you are about to create ANY chart, graph, plot, dashboard, or data visualization, in ANY output medium - an HTML or React artifact, inline SVG, plotting code in any library (matplotlib, plotly, d3, Recharts), an image/PNG you will render, or a chart shared into Slack. Read it BEFORE writing the first line of chart code, choosing chart colors, building a stat tile / meter / KPI row, or laying out a dashboard.",
  },
  {
    slug: "skill-creator",
    plugin: "external",
    description:
      "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.",
  },
  {
    slug: "humanizer",
    plugin: "external",
    description:
      "Strip the machine fingerprints out of text - both the invisible character-level encoding (em-dashes, smart quotes, zero-width and non-breaking spaces) and the stylistic tells of LLM prose. Use whenever the user asks to humanize, de-AI, remove the AI-isms, make something sound less like ChatGPT, or strip hidden/weird characters from copied text.",
  },
];

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
