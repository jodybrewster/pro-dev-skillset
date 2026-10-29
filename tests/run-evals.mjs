#!/usr/bin/env node
// Runs `claude plugin eval` on the workflow plugins (or named plugins) and prints one
// table per plugin: component, case, with, without and delta. Spends tokens, so it is
// on demand only. `--dry-run` prints the plan and spends nothing.
//
//   node tests/run-evals.mjs --sdlc
//   node tests/run-evals.mjs pro-ai-sdlc --runs 1
//   node tests/run-evals.mjs --sdlc --dry-run
//
// On macOS a case tagged `needs:git` is skipped unless --include-git is passed: the
// eval sandbox cannot run the xcrun git shim, so git inside the run fails there.
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { WORKFLOW_PLUGINS, listComponents, listCaseTags, coverageDiff, parseTags } from "./lib/components.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS_DIR = join(ROOT, "plugins");
const GATED = ["Bash", "Write", "Edit"];

export function parseArgs(argv) {
  const o = { plugins: [], sdlc: false, runs: 3, model: "sonnet", maxCostUsd: 10, dryRun: false, jobs: 4, includeGit: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sdlc") o.sdlc = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--include-git") o.includeGit = true;
    else if (a === "--runs") o.runs = Number(argv[++i]);
    else if (a === "--model") o.model = argv[++i];
    else if (a === "--max-cost-usd") o.maxCostUsd = Number(argv[++i]);
    else if (a.startsWith("--")) throw new Error(`unknown flag ${a}`);
    else o.plugins.push(a);
  }
  if (!Number.isFinite(o.runs) || o.runs < 1) throw new Error("--runs needs a positive number");
  if (!Number.isFinite(o.maxCostUsd) || o.maxCostUsd <= 0) throw new Error("--max-cost-usd needs a positive number");
  return o;
}

const unq = (v) => String(v).trim().replace(/^(["'])(.*)\1$/, "$2");

function frontmatterList(text, key) {
  if (!text.startsWith("---")) return [];
  const end = text.indexOf("\n---", 3);
  if (end === -1) return [];
  const lines = text.slice(3, end).split("\n");
  const i = lines.findIndex((l) => new RegExp(`^${key}\\s*:`).test(l));
  if (i === -1) return [];
  const rest = lines[i].replace(new RegExp(`^${key}\\s*:\\s*`), "").trim();
  if (rest.startsWith("[")) return rest.replace(/^\[/, "").replace(/\]\s*$/, "").split(",").map(unq).filter(Boolean);
  if (rest) return [unq(rest)];
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^\s+-\s*(.*)$/);
    if (!m) break;
    out.push(unq(m[1]));
  }
  return out;
}

// Reads every case dir: { name, tags, scaffold, tools }.
export function readCases(pluginDir, evalDir = "evals") {
  const root = join(pluginDir, evalDir);
  if (!existsSync(root)) return [];
  const cases = [];
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (name === "results" || !statSync(dir).isDirectory()) continue;
    const pp = join(dir, "prompt.md");
    if (!existsSync(pp)) continue;
    const text = readFileSync(pp, "utf8");
    const cy = join(dir, "case.yaml");
    const scaffold = existsSync(cy) && /^\s*scaffold_script\s*:/m.test(readFileSync(cy, "utf8"));
    cases.push({ name, tags: parseTags(text), scaffold, tools: frontmatterList(text, "allowed_tools") });
  }
  return cases;
}

// Flag choice for one plugin from its cases.
export function chooseFlags(cases) {
  const flags = [];
  if (cases.some((c) => c.scaffold)) flags.push("--scaffold");
  if (cases.some((c) => c.scaffold || c.tools.some((t) => GATED.includes(t)))) flags.push("--allow-tools", ...GATED);
  return flags;
}

// Splits cases into those to run and those skipped for needing git on macOS. When some
// are skipped, the kept cases are selected by tags no skipped case carries; a kept case
// with no such tag is reported as unreachable.
export function selectRunnable(cases, { platform = process.platform, includeGit = false } = {}) {
  const needsGit = (c) => c.tags.includes("needs:git");
  if (includeGit || platform !== "darwin" || !cases.some(needsGit)) return { run: cases, skipped: [], tags: null, unreachable: [] };
  const skipped = cases.filter(needsGit), run = cases.filter((c) => !needsGit(c));
  const taken = new Set(skipped.flatMap((c) => c.tags));
  const tags = [...new Set(run.flatMap((c) => c.tags).filter((t) => !taken.has(t)))];
  const unreachable = run.filter((c) => !c.tags.some((t) => tags.includes(t))).map((c) => c.name);
  return { run, skipped: skipped.map((c) => c.name), tags, unreachable };
}

export function buildArgs(pluginDir, cases, { model, runs, remaining, jsonPath, jobs = 4, tags = null }) {
  return [
    "plugin", "eval", pluginDir,
    ...chooseFlags(cases),
    ...(tags ? tags.flatMap((t) => ["--tag", t]) : []),
    "--threshold", "0",
    "--no-publish", "--trust-plugin",
    "--model", model,
    "--runs", String(runs),
    "-j", String(jobs),
    "--max-cost-usd", String(Number(remaining.toFixed(4))),
    "--json", jsonPath,
  ];
}

export function evalDirOf(pluginDir) {
  try {
    const m = JSON.parse(readFileSync(join(pluginDir, ".claude-plugin", "plugin.json"), "utf8"));
    return m.experimental && m.experimental.evals ? String(m.experimental.evals) : null;
  } catch { return null; }
}

const pct = (n, d) => `${n}/${d}`;

// One row per case from a `claude plugin eval --json` result. `tagsByCase` maps case name to tags.
export function summarize(result, tagsByCase = {}) {
  return (result.cases || []).map((c) => {
    const tags = (tagsByCase[c.name] || []);
    const component = tags.filter((t) => !t.startsWith("needs:")).join(", ") || "-";
    const scoredNames = (c.graders || []).filter((g) => g.type !== "tool_used" || g.withOnly === false).map((g) => g.name);
    const armStats = (runs, onlyFired) => {
      const list = runs || [];
      if (!list.length) return null;
      let ok = 0;
      for (const r of list) {
        const gs = (r.graders || []).filter((g) => (onlyFired ? !g.scored : g.scored !== false));
        if (gs.length && gs.every((g) => g.passed)) ok++;
      }
      return { ok, n: list.length };
    };
    const withScored = (c.arms?.with || []).some((r) => (r.graders || []).some((g) => g.scored !== false));
    let withCell, withoutCell;
    if (withScored) {
      const w = armStats(c.arms.with, false), wo = armStats(c.arms.without, false);
      withCell = w ? pct(w.ok, w.n) : "-";
      withoutCell = wo ? pct(wo.ok, wo.n) : "-";
    } else {
      const w = armStats(c.arms?.with, true);
      withCell = w ? `fired ${pct(w.ok, w.n)}` : "-";
      withoutCell = "-";
    }
    const d = c.aggregates && typeof c.aggregates.delta === "number" ? c.aggregates.delta : null;
    const delta = withScored && d !== null ? `${d >= 0 ? "+" : ""}${d.toFixed(2)}` : "-";
    void scoredNames;
    return { component, name: c.name, with: withCell, without: withoutCell, delta };
  });
}

export function formatTable(rows) {
  const head = ["component", "case", "with", "without", "delta"];
  const body = rows.map((r) => [r.component, r.name, r.with, r.without, r.delta]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => String(b[i]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ").trimEnd();
  return [line(head), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}

function allowListFor(plugin) {
  const p = join(ROOT, "tests", "cases", "components-uncovered.json");
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8"))
      .filter((e) => e.id.startsWith(`${plugin}/`)).map((e) => e.id.slice(plugin.length + 1));
  } catch { return []; }
}

export function selectPlugins(opts) {
  const names = [...opts.plugins];
  if (opts.sdlc) {
    for (const n of WORKFLOW_PLUGINS) {
      if (names.includes(n)) continue;
      if (evalDirOf(join(PLUGINS_DIR, n))) names.push(n);
    }
  }
  return names;
}

export function main(argv) {
  const opts = parseArgs(argv);
  const names = selectPlugins(opts);
  if (!names.length) { console.error("no plugins: name one or pass --sdlc"); return 1; }
  let total = 0, failed = 0;
  const tmp = opts.dryRun ? null : mkdtempSync(join(tmpdir(), "run-evals-"));
  for (const name of names) {
    const dir = join(PLUGINS_DIR, name);
    const evalDir = evalDirOf(dir) || "evals";
    if (!existsSync(dir)) { console.error(`${name}: no such plugin`); failed++; continue; }
    const all = readCases(dir, evalDir);
    const sel = selectRunnable(all, { includeGit: opts.includeGit });
    const cases = sel.run;
    const comps = listComponents(dir);
    const diff = coverageDiff(comps, listCaseTags(dir, evalDir), allowListFor(name));
    const jsonPath = join(tmp || tmpdir(), `${name}.json`);
    const remaining = opts.maxCostUsd - total;
    const args = buildArgs(dir, cases, { model: opts.model, runs: opts.runs, remaining: Math.max(remaining, 0), jsonPath, jobs: opts.jobs, tags: sel.tags });
    console.log(`\n== ${name} ==`);
    if (sel.skipped.length) console.log(`skipped on macOS (needs:git, pass --include-git to try): ${sel.skipped.join(", ")}`);
    if (sel.unreachable.length) console.log(`not run (shares every tag with a skipped case): ${sel.unreachable.join(", ")}`);
    if (opts.dryRun) {
      console.log(`claude ${args.join(" ")}`);
      console.log(`cases: ${cases.length}`);
      console.log(`uncovered components: ${diff.missing.length ? diff.missing.join(", ") : "none"}`);
      continue;
    }
    if (remaining <= 0) { console.log(`skipped: spent $${total.toFixed(2)} of the $${opts.maxCostUsd} cap`); continue; }
    if (!cases.length) { console.error(`${name}: no cases found`); failed++; continue; }
    const r = spawnSync("claude", args, { stdio: ["ignore", "inherit", "inherit"] });
    if (!existsSync(jsonPath)) { console.error(`${name}: no result file (claude exited ${r.status}); the cases did not load or the run aborted`); failed++; continue; }
    let result;
    try { result = JSON.parse(readFileSync(jsonPath, "utf8")); }
    catch (e) { console.error(`${name}: unreadable result (${e.message})`); failed++; continue; }
    const tagsByCase = Object.fromEntries(all.map((c) => [c.name, c.tags]));
    console.log(formatTable(summarize(result, tagsByCase)));
    const cost = Number(result.costUsd) || 0;
    total += cost;
    console.log(`cost: $${cost.toFixed(2)}${result.partial ? " (partial: cost cap hit)" : ""}`);
    if (r.status && r.status !== 2) failed++; // --threshold 0, so a non-zero exit is a load or run failure
    if (diff.missing.length) console.log(`uncovered components: ${diff.missing.join(", ")}`);
  }
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  if (!opts.dryRun) console.log(`\ntotal cost: $${total.toFixed(2)} of the $${opts.maxCostUsd} cap`);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { console.error(e.message); process.exit(1); }
}
