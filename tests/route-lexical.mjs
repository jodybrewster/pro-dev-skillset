#!/usr/bin/env node
// Keyless lexical router for the pro-dev-skillset marketplace.
// Ranks every catalog entry (skills, subagents, distractors) against each case in
// tests/cases/routing.jsonl by cosine similarity of stemmed TF-IDF vectors over
// name+description. No network, no dependency, so CI can gate on it.
//
//   node tests/route-lexical.mjs                    # report only
//   node tests/route-lexical.mjs --min-rank1 40     # exit 1 below 40% rank-1
//   node tests/route-lexical.mjs --verbose          # list every collision
//
// A case passes at rank 1 when the top entry is in `expect`; it passes in top-k when any
// `expect` is within the first k (default 3, or the case's `top_k`). A `notOneOf`
// case that ranks a forbidden entry first is reported as a warning: those cases
// mark semantic boundaries that word overlap cannot judge, so tests/eval.mjs
// (the model router) is what holds them.
// Also checks pairwise description similarity: warn at 0.50, fail at 0.75 unless
// the pair is listed in tests/cases/collisions-allowed.json ({ a, b, reason }).

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadCatalog, loadCases, DISTRACTORS } from "./lib/catalog.mjs";

export const WARN_AT = 0.5;
export const FAIL_AT = 0.75;
export const DEFAULT_TOP_K = 3;

const STOPWORDS = new Set((
  "a an and are as at be but by can do does for from has have how i if in into is it its " +
  "me my no not of on or our so that the their them then there these they this to use used " +
  "uses using want when whenever where which while who will with you your should also any " +
  "all each than via per"
).split(" "));

const asArr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

// Light suffix stemmer: enough to join plural and verb forms, nothing clever.
export function stem(word) {
  let w = word;
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("sses")) return w.slice(0, -2);
  for (const suf of ["ingly", "edly", "ing", "ed", "ly", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      if (suf === "s" && (w.endsWith("ss") || w.endsWith("us") || w.endsWith("is"))) break;
      w = w.slice(0, -suf.length);
      break;
    }
  }
  // undo a doubled final consonant left by -ing/-ed (running -> run)
  if (/([^aeiouls])\1$/.test(w) && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  return w;
}

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => t && !STOPWORDS.has(t));
}

const entryText = (e) => `${e.slug} ${e.description || ""}`;

function vectorize(tokens, idf) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const vec = new Map();
  let norm = 0;
  for (const [t, n] of tf) {
    const w = (1 + Math.log(n)) * (idf.get(t) ?? 0);
    if (w === 0) continue;
    vec.set(t, w);
    norm += w * w;
  }
  return { vec, norm: Math.sqrt(norm) };
}

export function cosine(a, b) {
  if (!a.norm || !b.norm) return 0;
  const [small, big] = a.vec.size <= b.vec.size ? [a.vec, b.vec] : [b.vec, a.vec];
  let dot = 0;
  for (const [t, w] of small) { const o = big.get(t); if (o) dot += w * o; }
  return dot / (a.norm * b.norm);
}

// Build the TF-IDF index over catalog entries ({ slug, description, ... }).
export function buildIndex(entries) {
  const docs = entries.map((e) => tokenize(entryText(e)));
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  const n = entries.length;
  const idf = new Map();
  for (const [t, c] of df) idf.set(t, Math.log((n + 1) / (c + 1)) + 1);
  const vectors = docs.map((d) => vectorize(d, idf));
  return { entries, idf, vectors };
}

// Rank all entries for a prompt, best first: [{ slug, score }].
export function rank(index, prompt) {
  const q = vectorize(tokenize(prompt), index.idf);
  return index.entries
    .map((e, i) => ({ slug: e.slug, score: cosine(q, index.vectors[i]) }))
    .sort((x, y) => y.score - x.score || x.slug.localeCompare(y.slug));
}

// Score one case against a ranking. `expect` empty means only notOneOf counts.
export function scoreCase(c, ranking) {
  const expect = asArr(c.expect), notOneOf = asArr(c.notOneOf);
  const k = c.top_k ?? DEFAULT_TOP_K;
  const top = ranking[0]?.slug;
  const hasExpect = expect.length > 0;
  return {
    hasExpect,
    rank1: hasExpect && expect.includes(top),
    topK: hasExpect && ranking.slice(0, k).some((r) => expect.includes(r.slug)),
    notOneOfFail: notOneOf.includes(top),
  };
}

const pairKey = (a, b) => [a, b].sort().join("\u0000");

export function allowedSet(list) {
  return new Set(asArr(list).map((p) => pairKey(p.a, p.b)));
}

// Pairwise similarity at or above WARN_AT. A pair at FAIL_AT or above is `allowed`
// when listed; otherwise it fails. Distractor-vs-distractor pairs are skipped.
export function collisions(index, allowed = new Set(), isDistractor = () => false) {
  const out = [];
  const { entries, vectors } = index;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (isDistractor(entries[i]) && isDistractor(entries[j])) continue;
      const score = cosine(vectors[i], vectors[j]);
      if (score < WARN_AT) continue;
      const a = entries[i].slug, b = entries[j].slug;
      const level = score >= FAIL_AT ? (allowed.has(pairKey(a, b)) ? "allowed" : "fail") : "warn";
      out.push({ a, b, score, level });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

function main() {
  const args = process.argv.slice(2);
  const mi = args.indexOf("--min-rank1");
  const minRank1 = mi >= 0 ? Number(args[mi + 1]) : null;
  if (mi >= 0 && !Number.isFinite(minRank1)) { console.error("--min-rank1 needs a number (percent)"); process.exit(2); }

  const { catalog } = loadCatalog();
  const entries = [...catalog, ...DISTRACTORS];
  const index = buildIndex(entries);
  const cases = loadCases();

  let withExpect = 0, r1 = 0, tk = 0, hardFail = 0;
  const failing = [];
  for (const c of cases) {
    const ranking = rank(index, c.prompt);
    const s = scoreCase(c, ranking);
    if (s.hasExpect) { withExpect++; if (s.rank1) r1++; if (s.topK) tk++; }
    if (s.notOneOfFail) hardFail++;
    if ((s.hasExpect && !s.rank1) || s.notOneOfFail) failing.push({ c, s, ranking });
  }

  for (const { c, s, ranking } of failing) {
    const top3 = ranking.slice(0, 3).map((r) => `${r.slug} ${r.score.toFixed(2)}`).join(", ");
    const tag = s.notOneOfFail ? "NOT-ONE-OF" : s.topK ? "top-k" : "miss";
    console.log(`x ${tag.padEnd(10)} want ${asArr(c.expect).join("|") || "not " + asArr(c.notOneOf).join("|")}  got ${top3}\n    ${c.prompt.slice(0, 90)}`);
  }

  const pct = (n, d) => (d ? (100 * n / d) : 0);
  const rate1 = pct(r1, withExpect), rateK = pct(tk, withExpect);
  console.log(`\nrank-1: ${r1}/${withExpect} (${rate1.toFixed(1)}%)  top-k: ${tk}/${withExpect} (${rateK.toFixed(1)}%)  notOneOf failures: ${hardFail}`);

  const allowPath = join(ROOT, "tests", "cases", "collisions-allowed.json");
  const allowed = allowedSet(existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, "utf8")) : []);
  const distractors = new Set(DISTRACTORS.map((d) => d.slug));
  const found = collisions(index, allowed, (e) => distractors.has(e.slug));
  const failed = found.filter((p) => p.level === "fail");
  for (const p of found) {
    if (p.level === "warn" && !args.includes("--verbose")) continue;
    console.log(`${p.level === "fail" ? "x" : p.level === "allowed" ? "-" : "!"} ${p.level.padEnd(7)} ${p.score.toFixed(2)}  ${p.a} <> ${p.b}`);
  }
  const warns = found.filter((p) => p.level === "warn").length;
  console.log(`collisions: ${failed.length} fail, ${warns} warn (use --verbose to list), ${found.filter((p) => p.level === "allowed").length} allowed`);

  let code = 0;
  if (hardFail) console.log(`! ${hardFail} notOneOf case(s) ranked a forbidden entry first (warning; the model router holds these boundaries)`);
  if (failed.length) { console.log("x description collisions at or above " + FAIL_AT + " need a fix or an entry in tests/cases/collisions-allowed.json"); code = 1; }
  if (minRank1 != null && rate1 < minRank1) { console.log(`x rank-1 ${rate1.toFixed(1)}% is below --min-rank1 ${minRank1}`); code = 1; }
  process.exit(code);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
