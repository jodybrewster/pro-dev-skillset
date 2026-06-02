#!/usr/bin/env node
// read.mjs — read rung of the retrieval ladder. Jina reader (default) with a
// Firecrawl fallback for JS-heavy / structured targets. Native fetch, no deps.
//
// Usage:  node read.mjs <url> [--firecrawl] [--max-chars N]
// Output: JSON { url, via, chars, thin, content } to stdout.
// Also exported as readUrl() for verify_citations.mjs.

import { pathToFileURL } from 'node:url';

const THIN_CHARS = 200;            // below this a read is "thin" → try to escalate
const DEFAULT_MAX_CHARS = 12000;
const JINA_PREFIX = 'https://r.jina.ai/';
const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';

async function jinaRead(url) {
  const headers = { Accept: 'text/plain' };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  const res = await fetch(JINA_PREFIX + url, { headers });
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  return await res.text();
}

// Returns markdown string, or null when no FIRECRAWL_API_KEY (cannot escalate).
async function firecrawlRead(url) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const res = await fetch(FIRECRAWL_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  });
  if (!res.ok) throw new Error(`Firecrawl HTTP ${res.status}`);
  const data = await res.json();
  return data?.data?.markdown || data?.markdown || '';
}

export async function readUrl(url, { firecrawl = false, maxChars = DEFAULT_MAX_CHARS } = {}) {
  let content = '';
  let via = 'jina';

  if (firecrawl) {
    const fc = await firecrawlRead(url);
    if (fc != null) { content = fc; via = 'firecrawl'; }
    else { content = await jinaRead(url); via = 'jina'; }   // no key → degrade to Jina
  } else {
    try { content = await jinaRead(url); }
    catch { content = ''; }
    if (content.trim().length < THIN_CHARS) {               // thin/blocked/JS → escalate
      try {
        const fc = await firecrawlRead(url);
        if (fc != null && fc.trim().length > content.trim().length) { content = fc; via = 'firecrawl'; }
      } catch { /* keep the thin Jina result */ }
    }
  }

  content = content.slice(0, maxChars);
  return { url, via, chars: content.length, thin: content.trim().length < THIN_CHARS, content };
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const url = args.find(a => !a.startsWith('--'));
  const firecrawl = args.includes('--firecrawl');
  const mcIdx = args.indexOf('--max-chars');
  const maxChars = mcIdx >= 0 ? parseInt(args[mcIdx + 1], 10) : DEFAULT_MAX_CHARS;
  if (!url) {
    console.error('Usage: node read.mjs <url> [--firecrawl] [--max-chars N]');
    process.exit(2);
  }
  try {
    process.stdout.write(JSON.stringify(await readUrl(url, { firecrawl, maxChars }), null, 2) + '\n');
  } catch (e) {
    console.error(`read.mjs error: ${e.message}`);
    process.exit(1);
  }
}
