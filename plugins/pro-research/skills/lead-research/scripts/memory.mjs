#!/usr/bin/env node
// memory.mjs — research domain memory. Durable, cross-run recall so the intake
// interview shrinks over time. No deps. Lives under <base>/_memory/.
//
//   node memory.mjs recall  [--base .research]              -> print profile.json (+ recent runs) as JSON
//   node memory.mjs upsert '<json>' [--base .research]      -> deep-merge patch into profile.json
//   node memory.mjs index  '<json>' [--base .research]      -> append a run record to runs.jsonl
//
// profile.json holds durable, reusable facts the user confirmed at intake:
//   { "preferences": { "depth": "...", "output": "..." }, "icp": {...}, "known_context": [...] }
// runs.jsonl is an append-only index of past runs: { run_id, question, at, mode }.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function memDir(base) { return join(base, '_memory'); }
function profilePath(base) { return join(memDir(base), 'profile.json'); }
function runsPath(base) { return join(memDir(base), 'runs.jsonl'); }

function readJson(p, dflt) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return dflt; } }
function ensureDir(base) { const d = memDir(base); if (!existsSync(d)) mkdirSync(d, { recursive: true }); return d; }

// Deep-merge plain objects; arrays and scalars from patch overwrite.
function deepMerge(target, patch) {
  if (Array.isArray(patch) || typeof patch !== 'object' || patch === null) return patch;
  const out = { ...(target && typeof target === 'object' ? target : {}) };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? deepMerge(out[k], v) : v;
  }
  return out;
}

export function recall(base) {
  const profile = readJson(profilePath(base), {});
  const runs = existsSync(runsPath(base))
    ? readFileSync(runsPath(base), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    : [];
  return { profile, recent_runs: runs.slice(-10) };
}

export function upsert(base, patch) {
  ensureDir(base);
  const merged = deepMerge(readJson(profilePath(base), {}), patch);
  writeFileSync(profilePath(base), JSON.stringify(merged, null, 2) + '\n');
  return merged;
}

export function index(base, record) {
  ensureDir(base);
  appendFileSync(runsPath(base), JSON.stringify(record) + '\n');
  return record;
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const baseIdx = args.indexOf('--base');
  const base = baseIdx >= 0 ? args[baseIdx + 1] : '.research';
  const payload = args[1] && !args[1].startsWith('--') ? args[1] : null;
  try {
    if (cmd === 'recall') {
      process.stdout.write(JSON.stringify(recall(base), null, 2) + '\n');
    } else if (cmd === 'upsert') {
      if (!payload) throw new Error("upsert needs a JSON arg, e.g. memory.mjs upsert '{\"preferences\":{\"depth\":\"standard\"}}'");
      process.stdout.write(JSON.stringify(upsert(base, JSON.parse(payload)), null, 2) + '\n');
    } else if (cmd === 'index') {
      if (!payload) throw new Error("index needs a JSON arg, e.g. memory.mjs index '{\"run_id\":\"...\",\"question\":\"...\"}'");
      process.stdout.write(JSON.stringify(index(base, JSON.parse(payload)), null, 2) + '\n');
    } else {
      console.error('Usage: node memory.mjs <recall|upsert|index> [json] [--base .research]');
      process.exit(2);
    }
  } catch (e) {
    console.error(`memory.mjs error: ${e.message}`);
    process.exit(1);
  }
}
