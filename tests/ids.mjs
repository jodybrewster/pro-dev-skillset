#!/usr/bin/env node
// Behaviour test for pro-ai-sdlc's ids.py (intent/2026-11-07-traceable-ids, spec-m1) and the
// rule behind checks["change-ids"] in tests/check.mjs. ids.py allocates the next change id from
// every ref and the working tree and backfills an `id:` line into intents that have none.
// Every case runs in a throwaway git repo with a bare origin under the OS temp dir and
// GIT_CONFIG_GLOBAL=/dev/null, so the real user config never leaks in. No network is used.
//
//   node tests/ids.mjs
//
// Exports runIdsCases() and changeIdProblems(root) for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IDS = join(ROOT, "plugins", "pro-ai-sdlc", "scripts", "ids.py");
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" };

export const SHORTCODE_RE = /^[A-Z]{2,6}$/;
export const ID_RE = /^[A-Z]{2,6}-[1-9][0-9]*$/;
const ID_PREFIX_RE = /^([A-Z]{2,6}-[1-9][0-9]*)-/;

// The `key: value` lines between the first two --- lines, read like factory.frontmatter.
export function frontmatterOf(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  if (!lines.length || lines[0].trim() !== "---") return {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() !== "---") continue;
    const fm = {};
    for (const ln of lines.slice(1, i)) {
      const m = ln.match(/^([a-z_]+):\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2].replace(/\s+#.*$/, "");
      if (v.length >= 2 && v[0] === v[v.length - 1] && `"'`.includes(v[0])) v = v.slice(1, -1);
      fm[m[1]] = v;
    }
    return fm;
  }
  return {};
}

// checks["change-ids"]: every intent has a well-formed id that carries the repo's shortcode, no
// two intents share one, an id-named folder carries its own id and the spec, plan and capability
// map agree with their intent (spec-m1 R13 to R16). Each failure names the file and the id.
export function changeIdProblems(root) {
  const failures = [], warnings = [];
  const projectPath = join(root, "intent", "project.json");
  if (!existsSync(projectPath)) {
    warnings.push("intent/project.json not found: change ids are not checked (run /pro-dev install to set a shortcode)");
    return { failures, warnings };
  }
  let code = null;
  try { code = JSON.parse(readFileSync(projectPath, "utf8"))?.shortcode; } catch { /* reported below */ }
  if (typeof code !== "string" || !SHORTCODE_RE.test(code)) {
    failures.push(`intent/project.json: the shortcode must match ${SHORTCODE_RE.source}`);
    return { failures, warnings };
  }
  const seen = new Map();
  const folderIds = new Map();
  const dir = join(root, "intent");
  for (const folder of readdirSync(dir).sort()) {
    const intentPath = join(dir, folder, "intent.md");
    if (!statSync(join(dir, folder)).isDirectory() || !existsSync(intentPath)) continue;
    const rel = `intent/${folder}/intent.md`;
    const id = frontmatterOf(readFileSync(intentPath, "utf8")).id;
    if (!id) { failures.push(`${rel}: no id: line (run ids.py backfill --write)`); continue; }
    if (!ID_RE.test(id)) { failures.push(`${rel}: id ${id} does not match ${ID_RE.source}`); continue; }
    if (id.replace(/-\d+$/, "") !== code) failures.push(`${rel}: id ${id} does not carry the shortcode ${code} from intent/project.json`);
    folderIds.set(folder, id);
    if (seen.has(id)) failures.push(`${rel}: id ${id} is also used by ${seen.get(id)}`);
    else seen.set(id, rel);
    const prefix = folder.match(ID_PREFIX_RE);
    if (prefix && prefix[1] !== id) failures.push(`${rel}: the folder is named for ${prefix[1]} but its id is ${id}`);
    for (const f of readdirSync(join(dir, folder)).sort()) {
      if (!/^(spec.*|plan.*|capability-map)\.md$/.test(f)) continue;
      const other = frontmatterOf(readFileSync(join(dir, folder, f), "utf8")).id;
      if (other !== undefined && other !== id) failures.push(`intent/${folder}/${f}: id ${other || "(empty)"} does not match ${id} in ${rel}`);
    }
  }
  failures.push(...docIdProblems(root, folderIds));
  return { failures, warnings };
}

// spec-m4 R7 and N1: an ADR `Source:` line under docs/decisions/ and a table row of
// docs/roadmap.md that name an intent folder carrying an id name that id too (in the same cell
// for a row); every ../intent/ link in those files must resolve. Each failure names file:line.
const namesId = (text, id) => new RegExp(`(^|[^A-Za-z0-9-])${id}(?![0-9])`).test(text);
function docIdProblems(root, folderIds) {
  const failures = [];
  const intentDir = join(root, "intent");
  const linkProblems = (rel, n, line) => {
    for (const m of line.matchAll(/\]\(((?:\.\.\/)+intent\/[^)#\s]+)/g)) {
      if (!existsSync(resolve(root, dirname(rel), m[1]))) failures.push(`${rel}:${n}: ${m[1]} does not resolve`);
    }
  };
  const decisions = join(root, "docs", "decisions");
  if (existsSync(decisions)) {
    for (const f of readdirSync(decisions).filter((x) => x.endsWith(".md")).sort()) {
      const rel = `docs/decisions/${f}`;
      readFileSync(join(decisions, f), "utf8").split("\n").forEach((line, i) => {
        linkProblems(rel, i + 1, line);
        if (!/^Source:/.test(line)) return;
        for (const folder of new Set([...line.matchAll(/(?:^|[^A-Za-z0-9._/-]|\.\.\/)intent\/([A-Za-z0-9._-]+)\//g)].map((m) => m[1]))) {
          if (!existsSync(join(intentDir, folder))) { failures.push(`${rel}:${i + 1}: intent/${folder}/ does not exist`); continue; }
          const id = folderIds.get(folder);
          if (id && !namesId(line, id)) failures.push(`${rel}:${i + 1}: Source names intent/${folder}/ without its id ${id}`);
        }
      });
    }
  }
  const roadmap = join(root, "docs", "roadmap.md");
  if (existsSync(roadmap)) {
    const rel = "docs/roadmap.md";
    readFileSync(roadmap, "utf8").split("\n").forEach((line, i) => {
      linkProblems(rel, i + 1, line);
      if (!line.startsWith("|")) return;
      for (const cell of line.split("|")) {
        for (const folder of new Set([...cell.matchAll(/\]\(\.\.\/intent\/([A-Za-z0-9._-]+)\//g)].map((m) => m[1]))) {
          const id = folderIds.get(folder);
          if (id && !namesId(cell, id)) failures.push(`${rel}:${i + 1}: the row links intent/${folder}/ without its id ${id}`);
        }
      }
    });
  }
  return failures;
}

function git(cwd, ...args) {
  return spawnSync("git", ["-c", "user.name=t", "-c", "user.email=fixture", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: ENV });
}
function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
const intentText = ({ id = null, status = "draft", created = "2026-01-02T10:00:00-0500" } = {}) =>
  `---\n${id ? `id: ${id}\n` : ""}source: idea\nkind: change\nstatus: ${status}\nrisk: low\ncreated: ${created}\nauthor: t\n---\n\n# Intent: demo\n\n## Problem\n\nx\n`;

export function runIdsCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };
  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "ids-sandbox-")));
  const add = (id, expect, ok, why = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(why).slice(0, 600) });
  const ids = (args, cwd) => {
    const t0 = Date.now();
    const r = spawnSync("python3", ["-I", IDS, ...args], { cwd, encoding: "utf8", timeout: 60_000, env: ENV });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", ms: Date.now() - t0 };
  };
  const brief = (r) => `status ${r.status} stdout ${r.stdout.slice(0, 300)} stderr ${r.stderr.slice(0, 300)}`;
  // A checkout on main with a bare origin; `files` maps a repo path to its text.
  const repoWithOrigin = (name, files) => {
    const origin = join(sandbox, `${name}-origin.git`);
    const repo = join(sandbox, name);
    git(sandbox, "init", "-q", "--bare", "-b", "main", origin);
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    for (const [p, t] of Object.entries(files)) write(join(repo, p), t);
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "init");
    git(repo, "remote", "add", "origin", origin);
    git(repo, "push", "-q", "-u", "origin", "main");
    return { repo, origin };
  };
  const PROJECT = (code = "TST") => JSON.stringify({ shortcode: code }) + "\n";

  try {
    // ── next: allocation across origin/main, a remote branch, a local branch and the working tree ──
    {
      const fx = repoWithOrigin("next", { "intent/project.json": PROJECT(), "intent/2026-01-01-a/intent.md": intentText({ id: "TST-3" }) });
      // A second clone pushes TST-7 to origin/other; this checkout only sees it after a fetch.
      const other = join(sandbox, "next-other");
      git(sandbox, "clone", "-q", fx.origin, other);
      git(other, "switch", "-q", "-c", "other");
      write(join(other, "intent", "2026-01-02-b", "intent.md"), intentText({ id: "TST-7" }));
      git(other, "add", "-A");
      git(other, "commit", "-q", "-m", "b");
      git(other, "push", "-q", "origin", "other");
      let r = ids(["next"], fx.repo);
      add("next/AC2 the highest id on origin/main and a fetched remote branch, plus one", "TST-8",
        r.status === 0 && r.stdout.trim() === "TST-8" && !/offline/.test(r.stderr), brief(r));
      git(fx.repo, "switch", "-q", "-c", "local");
      write(join(fx.repo, "intent", "2026-01-03-c", "intent.md"), intentText({ id: "TST-9" }));
      git(fx.repo, "add", "-A");
      git(fx.repo, "commit", "-q", "-m", "c");
      git(fx.repo, "switch", "-q", "main");
      r = ids(["next"], fx.repo);
      add("next/AC2 a local branch never pushed counts", "TST-10", r.status === 0 && r.stdout.trim() === "TST-10", brief(r));
      write(join(fx.repo, "intent", "2026-01-04-d", "intent.md"), intentText({ id: "TST-11", status: "dropped" }));
      r = ids(["next"], fx.repo);
      add("next/R3 an uncommitted intent in the working tree counts, dropped or not", "TST-12", r.status === 0 && r.stdout.trim() === "TST-12", brief(r));
      git(fx.repo, "switch", "-q", "-c", "drop");
      git(fx.repo, "add", "-A");
      git(fx.repo, "commit", "-q", "-m", "d");
      git(fx.repo, "switch", "-q", "main");
      r = ids(["next"], fx.repo);
      add("next/R19 a dropped intent committed on a branch still counts", "TST-12", r.status === 0 && r.stdout.trim() === "TST-12", brief(r));
      write(join(fx.repo, "intent", "2026-01-05-e", "intent.md"), intentText({ id: "OLD-40" }));
      r = ids(["next"], fx.repo);
      add("next/R2 an id with other letters is not counted", "TST-12", r.status === 0 && r.stdout.trim() === "TST-12", brief(r));
      rmSync(join(fx.repo, "intent", "2026-01-05-e"), { recursive: true, force: true });

      // ── offline ──
      git(fx.repo, "remote", "set-url", "origin", join(sandbox, "no-such-origin.git"));
      r = ids(["next"], fx.repo);
      add("next/AC3 an unreachable origin still prints the id and exits 0", "TST-12 offline",
        r.status === 0 && r.stdout.trim() === "TST-12" && r.stderr.startsWith("ids: offline, allocated from the last fetch ("), brief(r));
      add("next/N1 the offline path returns in under 15 seconds", "< 15000 ms", r.ms < 15_000, `${r.ms} ms`);
    }
    {
      const fx = repoWithOrigin("first", { "intent/project.json": PROJECT("AB"), "intent/2026-01-01-a/intent.md": intentText() });
      const r = ids(["next"], fx.repo);
      add("next/a repo whose intents carry no id yet starts at 1", "AB-1", r.status === 0 && r.stdout.trim() === "AB-1", brief(r));
    }
    {
      const fx = repoWithOrigin("noproj", { "intent/2026-01-01-a/intent.md": intentText({ id: "TST-3" }) });
      const r = ids(["next"], fx.repo);
      add("next/AC4 no intent/project.json exits 1", "exit 1", r.status === 1 && r.stdout.trim() === "" && r.stderr.trim() === "ids: no intent/project.json", brief(r));
      write(join(fx.repo, "intent", "project.json"), JSON.stringify({ shortcode: "tst" }));
      const bad = ids(["next"], fx.repo);
      add("next/R2 a shortcode outside ^[A-Z]{2,6}$ exits 1", "exit 1", bad.status === 1 && /shortcode/.test(bad.stderr), brief(bad));
    }

    // ── backfill: created order in UTC, a date-only value at 00:00 UTC, the folder name as the tiebreak ──
    {
      const fx = repoWithOrigin("fill", {
        "intent/project.json": PROJECT(),
        "intent/2026-01-01-has-id/intent.md": intentText({ id: "TST-4", created: "2026-01-01" }),
        "intent/2026-01-02-zeta/intent.md": intentText({ created: "2026-01-02T10:00:00-0500" }),
        "intent/2026-01-02-eta/intent.md": intentText({ created: "2026-01-02T15:00:00+00:00" }),
        "intent/2026-01-02-date-only/intent.md": intentText({ created: "2026-01-02" }),
        "intent/2026-01-01-late/intent.md": intentText({ created: "2026-01-02T23:30:00-04:00" }),
        "intent/README.md": "x\n",
      });
      const want = [
        "| id | folder | created |",
        "|---|---|---|",
        "| TST-5 | `2026-01-02-date-only` | `2026-01-02` |",
        "| TST-6 | `2026-01-02-eta` | `2026-01-02T15:00:00+00:00` |",
        "| TST-7 | `2026-01-02-zeta` | `2026-01-02T10:00:00-0500` |",
        "| TST-8 | `2026-01-01-late` | `2026-01-02T23:30:00-04:00` |",
      ].join("\n");
      let r = ids(["backfill"], fx.repo);
      add("backfill/R17 prints the table in created order with the folder as the tiebreak", "4 rows from TST-5",
        r.status === 0 && r.stdout.trim() === want, brief(r));
      add("backfill/R17 without --write it writes nothing", "clean tree", git(fx.repo, "status", "--porcelain").stdout.trim() === "", git(fx.repo, "status", "--porcelain").stdout);
      r = ids(["backfill", "--write"], fx.repo);
      const stat = git(fx.repo, "diff", "--numstat").stdout.trim().split("\n").filter(Boolean);
      add("backfill/R17 --write adds one line to each file and deletes none", "4 files, 1 insertion, 0 deletions",
        r.status === 0 && stat.length === 4 && stat.every((l) => /^1\t0\t/.test(l)), brief(r) + stat.join(";"));
      const zeta = readFileSync(join(fx.repo, "intent", "2026-01-02-zeta", "intent.md"), "utf8");
      add("backfill/R17 the id is the first frontmatter line", "---\\nid: TST-7", zeta.startsWith("---\nid: TST-7\nsource: idea\n"), zeta.slice(0, 80));
      r = ids(["backfill"], fx.repo);
      add("backfill/a second run has nothing to do", "nothing", r.status === 0 && /nothing to backfill/.test(r.stdout + r.stderr) && !/\| TST-/.test(r.stdout), brief(r));
      r = ids(["backfill", "--write"], fx.repo);
      const stat2 = git(fx.repo, "diff", "--numstat").stdout.trim().split("\n").filter(Boolean);
      add("backfill/a second --write changes nothing", "same 4 lines", r.status === 0 && stat2.join() === stat.join(), stat2.join(";"));
      r = ids(["next"], fx.repo);
      add("next/after the backfill the next id follows it", "TST-9", r.stdout.trim() === "TST-9", brief(r));
    }
    {
      const fx = repoWithOrigin("fillbad", { "intent/project.json": PROJECT(), "intent/2026-01-01-a/intent.md": intentText({ created: "soon" }) });
      const r = ids(["backfill", "--write"], fx.repo);
      add("backfill/an unreadable created: refuses and writes nothing", "exit 1",
        r.status === 1 && /2026-01-01-a/.test(r.stderr) && git(fx.repo, "status", "--porcelain").stdout.trim() === "", brief(r));
    }

    // ── changeIdProblems: the rule checks["change-ids"] runs on this repo ──
    {
      const fixture = (name, files) => {
        const dir = join(sandbox, `chk-${name}`);
        for (const [p, t] of Object.entries(files)) write(join(dir, p), t);
        return changeIdProblems(dir);
      };
      let p = fixture("none", { "intent/2026-01-01-a/intent.md": intentText() });
      add("check/R15 no intent/project.json passes with one warning", "0 failures, 1 warning", p.failures.length === 0 && p.warnings.length === 1, JSON.stringify(p));
      p = fixture("dup", { "intent/project.json": PROJECT(), "intent/2026-01-01-a/intent.md": intentText({ id: "TST-2" }), "intent/2026-01-02-b/intent.md": intentText({ id: "TST-2" }) });
      add("check/AC5 a duplicate id fails naming both files", "one failure naming both",
        p.failures.length === 1 && p.failures[0] === "intent/2026-01-02-b/intent.md: id TST-2 is also used by intent/2026-01-01-a/intent.md", JSON.stringify(p));
      p = fixture("missing", { "intent/project.json": PROJECT(), "intent/2026-01-01-a/intent.md": intentText({ id: "TST-1" }), "intent/2026-01-02-b/intent.md": intentText() });
      add("check/AC5 an intent with no id fails naming the file", "one failure",
        p.failures.length === 1 && p.failures[0].startsWith("intent/2026-01-02-b/intent.md: no id: line"), JSON.stringify(p));
      p = fixture("malformed", { "intent/project.json": PROJECT(), "intent/2026-01-01-a/intent.md": intentText({ id: "TST-01" }) });
      add("check/R13 a malformed id fails", "one failure", p.failures.length === 1 && /id TST-01 does not match/.test(p.failures[0]), JSON.stringify(p));
      p = fixture("folder", { "intent/project.json": PROJECT(), "intent/TST-3-demo/intent.md": intentText({ id: "TST-4" }) });
      add("check/R13 an id-named folder that disagrees with its id fails", "one failure",
        p.failures.length === 1 && p.failures[0] === "intent/TST-3-demo/intent.md: the folder is named for TST-3 but its id is TST-4", JSON.stringify(p));
      p = fixture("spec", {
        "intent/project.json": PROJECT(), "intent/TST-3-demo/intent.md": intentText({ id: "TST-3" }),
        "intent/TST-3-demo/spec-m1.md": "---\nid: TST-5\n---\n", "intent/TST-3-demo/plan.md": "---\nid: TST-3\n---\n# Plan\n",
        "intent/TST-3-demo/capability-map.md": "# no frontmatter\n",
      });
      add("check/R13 a spec whose id disagrees with its intent fails", "one failure naming the spec",
        p.failures.length === 1 && p.failures[0] === "intent/TST-3-demo/spec-m1.md: id TST-5 does not match TST-3 in intent/TST-3-demo/intent.md", JSON.stringify(p));
      p = fixture("recode", { "intent/project.json": PROJECT("NEW"), "intent/2026-01-01-a/intent.md": intentText({ id: "TST-1" }), "intent/2026-01-02-b/intent.md": intentText({ id: "TST-2" }) });
      add("check/R16 a shortcode changed in place fails every intent", "two failures",
        p.failures.length === 2 && p.failures.every((f) => /does not carry the shortcode NEW/.test(f)), JSON.stringify(p));
      p = fixture("badcode", { "intent/project.json": JSON.stringify({ shortcode: "toolong1" }), "intent/2026-01-01-a/intent.md": intentText({ id: "TST-1" }) });
      add("check/R2 a malformed shortcode fails", "one failure", p.failures.length === 1 && /shortcode must match/.test(p.failures[0]), JSON.stringify(p));
      p = fixture("clean", {
        "intent/project.json": PROJECT(), "intent/2026-01-01-a/intent.md": intentText({ id: "TST-1" }),
        "intent/TST-2-demo/intent.md": intentText({ id: "TST-2" }), "intent/TST-2-demo/spec.md": "---\nid: TST-2\n---\n", "intent/README.md": "x\n",
      });
      add("check/both folder forms with matching ids pass", "0 failures", p.failures.length === 0 && p.warnings.length === 0, JSON.stringify(p));

      // spec-m4 R7 and N1: an ADR Source line or a roadmap table row that names an id-bearing
      // intent folder names its id too; every ../intent/ link in those docs must resolve.
      const base = { "intent/project.json": PROJECT(), "intent/2026-01-01-a/intent.md": intentText({ id: "TST-1" }) };
      const adr = (source) => `# ADR-0001: demo\n\nDate: 2026-01-01\n\n## Status\n\naccepted\n\n${source}\n\n## Context\n\nx\n`;
      p = fixture("adr-noid", { ...base, "docs/decisions/0001-demo.md": adr("Source: intent/2026-01-01-a/.") });
      add("check/m4 AC3 an ADR Source naming an id-bearing folder without the id fails with the file and line", "one failure",
        p.failures.length === 1 && p.failures[0] === "docs/decisions/0001-demo.md:9: Source names intent/2026-01-01-a/ without its id TST-1", JSON.stringify(p));
      p = fixture("adr-id", { ...base, "docs/decisions/0001-demo.md": adr("Source: TST-1, intent/2026-01-01-a/ (spec R1 to R3).") });
      add("check/m4 AC3 the same Source with the id passes", "0 failures", p.failures.length === 0, JSON.stringify(p));
      p = fixture("adr-prefix", { ...base, "docs/decisions/0001-demo.md": adr("Source: TST-10, intent/2026-01-01-a/.") });
      add("check/m4 R7 a longer id that starts with the right one does not count", "one failure",
        p.failures.length === 1 && /without its id TST-1$/.test(p.failures[0]), JSON.stringify(p));
      p = fixture("adr-conv", { ...base, "docs/decisions/0001-demo.md": adr("Source: conversation.") });
      add("check/m4 R4 a Source with no intent folder passes", "0 failures", p.failures.length === 0, JSON.stringify(p));
      p = fixture("adr-gone", { ...base, "docs/decisions/0001-demo.md": adr("Source: TST-9, intent/2026-01-09-gone/.") });
      add("check/m4 N1 an ADR Source naming a folder that does not exist fails", "one failure",
        p.failures.length === 1 && p.failures[0] === "docs/decisions/0001-demo.md:9: intent/2026-01-09-gone/ does not exist", JSON.stringify(p));
      const roadmap = (row) => `# Roadmap\n\n| Intent | Risk |\n|---|---|\n${row}\n`;
      p = fixture("road-noid", { ...base, "docs/roadmap.md": roadmap("| [a](../intent/2026-01-01-a/intent.md) | low |") });
      add("check/m4 AC1 a roadmap row linking an id-bearing folder without the id fails with the line", "one failure",
        p.failures.length === 1 && p.failures[0] === "docs/roadmap.md:5: the row links intent/2026-01-01-a/ without its id TST-1", JSON.stringify(p));
      p = fixture("road-id", { ...base, "docs/roadmap.md": roadmap("| TST-1 [a](../intent/2026-01-01-a/intent.md) | low |") });
      add("check/m4 AC1 the same row with the id passes", "0 failures", p.failures.length === 0, JSON.stringify(p));
      p = fixture("road-cell", { ...base, "docs/roadmap.md": roadmap("| [a](../intent/2026-01-01-a/intent.md) | TST-1 |") });
      add("check/m4 R2 the id in another cell of the row does not count", "one failure", p.failures.length === 1, JSON.stringify(p));
      p = fixture("road-gone", { ...base, "docs/roadmap.md": roadmap("| TST-9 [gone](../intent/2026-01-09-gone/intent.md) | low |\n\nSee [old](../intent/2026-01-08-old/intent.md).") });
      add("check/m4 N1 a roadmap link to a folder that does not exist fails, in a row or in prose", "two failures",
        p.failures.length === 2 && p.failures[0] === "docs/roadmap.md:5: ../intent/2026-01-09-gone/intent.md does not resolve" &&
        p.failures[1] === "docs/roadmap.md:7: ../intent/2026-01-08-old/intent.md does not resolve", JSON.stringify(p));
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runIdsCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} ids cases passed`);
  process.exit(bad ? 1 : 0);
}
