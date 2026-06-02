#!/usr/bin/env node
// search.mjs — discovery rung of the lead-research retrieval ladder.
// Serper (default) with a Brave adapter behind the same interface; swap with
// RESEARCH_SEARCH_PROVIDER=brave. No external deps; native fetch (Node >= 18).
//
// Usage:  node search.mjs "<query>" [--num 10] [--provider serper|brave]
// Output: JSON { provider, query, results:[{title,url,snippet,position}] } to stdout.

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SERPER_ENDPOINT = 'https://google.serper.dev/search';
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

// Resolve the Serper key from env, or — if a Mieruka install sits beside us —
// from its config (Mieruka uses Serper too). See references/mieruka.md.
export function resolveSerperKey() {
  if (process.env.SERPER_API_KEY) return process.env.SERPER_API_KEY;
  for (const p of ['.mieruka/config.json', '.mieruka/mieruka.config.json', '.mieruka/mieruka.json']) {
    try {
      if (!existsSync(p)) continue;
      const cfg = JSON.parse(readFileSync(p, 'utf8'));
      const k = cfg.serperKey || cfg.serper_api_key || cfg.serperApiKey || cfg?.search?.serperKey;
      if (k) return k;
    } catch { /* tolerate a malformed mieruka config — fall through to null */ }
  }
  return null;
}

async function serperSearch(query, num) {
  const key = resolveSerperKey();
  if (!key) throw new Error('SERPER_API_KEY not set (and no key found in .mieruka/). See .env.example.');
  const res = await fetch(SERPER_ENDPOINT, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num }),
  });
  if (!res.ok) throw new Error(`Serper HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const results = (data.organic || []).map((r, i) => ({
    title: r.title, url: r.link, snippet: r.snippet || '', position: r.position ?? i + 1,
  }));
  return { provider: 'serper', query, results };
}

// --- Brave adapter (STUB) ---------------------------------------------------
// Untested against the live Brave Search API. Implemented to the documented shape
// so a client engagement can swap providers with one env flag — verify before relying.
async function braveSearch(query, num) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error('RESEARCH_SEARCH_PROVIDER=brave but BRAVE_API_KEY not set. (Brave adapter is an untested stub.)');
  const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query)}&count=${num}`;
  const res = await fetch(url, { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Brave HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const results = (data.web?.results || []).map((r, i) => ({
    title: r.title, url: r.url, snippet: r.description || '', position: i + 1,
  }));
  return { provider: 'brave', query, results };
}

export async function search(query, { num = 10, provider } = {}) {
  provider = provider || process.env.RESEARCH_SEARCH_PROVIDER || 'serper';
  if (provider === 'brave') return braveSearch(query, num);
  return serperSearch(query, num);
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const query = args.find(a => !a.startsWith('--'));
  const numIdx = args.indexOf('--num');
  const num = numIdx >= 0 ? parseInt(args[numIdx + 1], 10) : 10;
  const provIdx = args.indexOf('--provider');
  const provider = provIdx >= 0 ? args[provIdx + 1] : undefined;
  if (!query) {
    console.error('Usage: node search.mjs "<query>" [--num N] [--provider serper|brave]');
    process.exit(2);
  }
  try {
    process.stdout.write(JSON.stringify(await search(query, { num, provider }), null, 2) + '\n');
  } catch (e) {
    console.error(`search.mjs error: ${e.message}`);
    process.exit(1);
  }
}
