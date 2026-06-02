#!/usr/bin/env node
// verify_citations.mjs — re-fetch each cited URL and check it actually supports the
// claim. Sets claims[].verified true/false in place and writes verification_summary.json.
// Support check is heuristic (entity presence + a salient value token); see methodology.md.
//
// Usage:  node verify_citations.mjs .research/<run-id>
// Output: JSON summary to stdout. Reuses read.mjs (no deps).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readUrl } from './read.mjs';

function readJsonl(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// Salient tokens to look for: $amounts, 4-digit years, and plain numbers.
function salientTokens(text) {
  const t = text || '';
  const toks = new Set();
  (t.match(/\$\s?\d[\d,.]*\s?[bmk]?/gi) || []).forEach(x => toks.add(x.replace(/\s+/g, '').toLowerCase()));
  (t.match(/\b\d{4}\b/g) || []).forEach(x => toks.add(x));
  (t.match(/\b\d[\d,.]*\b/g) || []).forEach(x => toks.add(x.toLowerCase()));
  return [...toks];
}

function supports(pageText, claim) {
  const page = (pageText || '').toLowerCase();
  if (!page) return false;
  const entity = (claim.entity || '').toLowerCase().split(' ')[0]; // first token of the entity name
  const entityOk = entity ? page.includes(entity) : true;
  const vals = salientTokens(claim.claim);
  const valOk = vals.length ? vals.some(v => page.includes(v.replace(/[$,]/g, ''))) : true;
  return entityOk && valOk; // entity must appear, plus a salient value if the claim has one
}

export async function run(dir) {
  const claimsPath = join(dir, 'claims.jsonl');
  const claims = readJsonl(claimsPath);
  const srcById = Object.fromEntries(readJsonl(join(dir, 'sources.jsonl')).map(s => [s.id, s]));
  const cache = new Map();
  let verified = 0, failed = 0;
  const details = [];

  for (const c of claims) {
    const urls = (c.source_ids || []).map(id => srcById[id]?.url).filter(Boolean);
    if (urls.length === 0) {
      c.verified = false; failed++;
      details.push({ id: c.id, verified: false, reason: 'no source urls' });
      continue;
    }
    let ok = false, err = null;
    const checked = [];
    for (const url of urls) {
      let page;
      if (cache.has(url)) page = cache.get(url);
      else {
        try { page = (await readUrl(url, { maxChars: 20000 })).content; }
        catch (e) { page = null; err = e.message; }
        cache.set(url, page);
      }
      checked.push(url);
      if (supports(page, c)) { ok = true; break; }
    }
    c.verified = ok;
    if (ok) verified++; else failed++;
    details.push({ id: c.id, verified: ok, checked, ...(err ? { error: err } : {}) });
  }

  writeFileSync(claimsPath, claims.map(c => JSON.stringify(c)).join('\n') + '\n');
  const summary = { dir, total: claims.length, verified, failed, checked_at: new Date().toISOString(), details };
  writeFileSync(join(dir, 'verification_summary.json'), JSON.stringify(summary, null, 2) + '\n');
  return summary;
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) { console.error('Usage: node verify_citations.mjs .research/<run-id>'); process.exit(2); }
  if (!existsSync(dir)) { console.error(`verify_citations.mjs: dir not found: ${dir}`); process.exit(1); }
  const out = await run(dir);
  process.stdout.write(JSON.stringify({ dir: out.dir, total: out.total, verified: out.verified, failed: out.failed }, null, 2) + '\n');
}
