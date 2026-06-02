#!/usr/bin/env node
// score.mjs — ICP scoring for lead runs. Reads .research/<run-id>/ and writes the
// score fields into each <entity>/lead_profile.json. See references/scoring.md.
//
// Usage:  node score.mjs .research/<run-id>
// Output: JSON summary to stdout. No deps.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_WEIGHTS = { fit: 0.40, signal_recency: 0.25, contactability: 0.20, data_confidence: 0.15 };
// Signal strength priors keyed by substring of claim.kind (see scoring.md).
const SIGNAL_STRENGTH = { funding: 1.0, leadership: 1.0, tech: 1.0, hiring: 0.7, launch: 0.7, news: 0.4 };

function readJsonl(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function readJson(p, dflt) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return dflt; } }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function sourceQuality(src) {
  if (!src) return 0.5;
  if (typeof src.quality === 'number') return src.quality;
  const t = (src.type || '').toLowerCase();
  if (['official', 'registry', 'filing', 'sec'].some(x => t.includes(x))) return 0.9;
  if (['press', 'news', 'media'].some(x => t.includes(x))) return 0.6;
  if (['aggregator', 'blog', 'forum'].some(x => t.includes(x))) return 0.3;
  let host = ''; try { host = new URL(src.url).host; } catch { /* ignore */ }
  if (/sec\.gov|gov\.uk|companieshouse|edgar/.test(host)) return 0.9;
  return 0.5;
}
function freshness(dateStr, now) {
  if (!dateStr) return 0.2;
  const d = Date.parse(dateStr); if (Number.isNaN(d)) return 0.2;
  const days = (now - d) / 86400000;
  if (days < 30) return 1.0; if (days < 90) return 0.7; if (days < 180) return 0.4; if (days < 365) return 0.2; return 0.05;
}
function strengthFor(kind) {
  const k = (kind || '').toLowerCase();
  for (const key of Object.keys(SIGNAL_STRENGTH)) if (k.includes(key)) return SIGNAL_STRENGTH[key];
  return 0.4;
}

function scoreEntity(entity, claims, srcById, manifest, now, weights) {
  const ec = claims.filter(c => c.entity === entity);
  const verified = ec.filter(c => c.verified === true);
  const total = ec.length;

  // data_confidence = 0.6 * verified-ratio + 0.4 * mean source quality
  const verRatio = total ? verified.length / total : 0;
  const qualities = ec.flatMap(c => (c.source_ids || []).map(id => sourceQuality(srcById[id])));
  const meanQ = qualities.length ? qualities.reduce((a, b) => a + b, 0) / qualities.length : 0.5;
  const data_confidence = 0.6 * verRatio + 0.4 * meanQ;

  // signal_recency = best (freshness × strength) over verified signal claims
  let signal_recency = 0;
  for (const c of verified.filter(c => c.kind && !['firmographic', 'contact'].includes(c.kind))) {
    signal_recency = Math.max(signal_recency, freshness(c.date, now) * strengthFor(c.kind));
  }

  // fit = ICP criteria met by a verified claim
  const criteria = manifest?.icp?.criteria || [];
  let fit = 0, fitNote;
  if (criteria.length) {
    const met = criteria.filter(cr => {
      const key = typeof cr === 'string' ? cr : cr.key;
      return verified.some(c => c.field === key || c.kind === key || (c.criteria || []).includes(key));
    }).length;
    fit = met / criteria.length;
    fitNote = `${met}/${criteria.length} ICP criteria`;
  } else {
    fitNote = 'no ICP criteria in run_manifest.icp.criteria (fit unscored = 0)';
  }

  // contactability — best public path among contact claims
  let contactability = 0;
  for (const c of ec.filter(c => c.kind === 'contact')) {
    contactability = Math.max(contactability, c.public_contact_path ? 1.0 : (c.role ? 0.5 : 0));
  }

  const components = { fit, signal_recency, contactability, data_confidence };
  const score = Math.round(100 * Object.keys(weights).reduce((a, k) => a + weights[k] * (components[k] || 0), 0));
  const band = score >= 80 ? 'hot' : score >= 60 ? 'warm' : score >= 40 ? 'nurture' : 'disqualify';

  const sorted = Object.entries(components).sort((a, b) => b[1] - a[1]);
  const driver = sorted[0], gap = sorted[sorted.length - 1];
  const rationale = `${score} — ${band}. Top driver: ${driver[0]} (${driver[1].toFixed(2)}); ${fitNote}. `
    + `Biggest gap: ${gap[0]} (${gap[1].toFixed(2)}). Confidence ${data_confidence.toFixed(2)} from ${verified.length}/${total} verified claims.`;

  return { components, score, band, rationale };
}

export function run(dir) {
  const manifest = readJson(join(dir, 'run_manifest.json'), {});
  const claims = readJsonl(join(dir, 'claims.jsonl'));
  const sources = readJsonl(join(dir, 'sources.jsonl'));
  const srcById = Object.fromEntries(sources.map(s => [s.id, s]));
  const now = manifest.generated_at ? Date.parse(manifest.generated_at) : Date.now();
  const weights = manifest.scoring_weights
    || (process.env.RESEARCH_SCORING_WEIGHTS && JSON.parse(process.env.RESEARCH_SCORING_WEIGHTS))
    || DEFAULT_WEIGHTS;
  const entities = (manifest.entities && manifest.entities.length)
    ? manifest.entities
    : [...new Set(claims.map(c => c.entity).filter(Boolean))];

  const scored = [];
  for (const entity of entities) {
    const r = scoreEntity(entity, claims, srcById, manifest, now, weights);
    const edir = join(dir, slug(entity));
    if (!existsSync(edir)) mkdirSync(edir, { recursive: true });
    const pPath = join(edir, 'lead_profile.json');
    const profile = existsSync(pPath) ? readJson(pPath, {}) : {};
    Object.assign(profile, {
      entity, icp_score: r.score, band: r.band,
      score_components: r.components, score_rationale: r.rationale,
      scored_at: new Date(now).toISOString(),
    });
    writeFileSync(pPath, JSON.stringify(profile, null, 2) + '\n');
    scored.push({ entity, score: r.score, band: r.band });
  }
  return { dir, weights, scored };
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) { console.error('Usage: node score.mjs .research/<run-id>'); process.exit(2); }
  if (!existsSync(dir)) { console.error(`score.mjs: dir not found: ${dir}`); process.exit(1); }
  process.stdout.write(JSON.stringify(run(dir), null, 2) + '\n');
}
