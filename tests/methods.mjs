#!/usr/bin/env node
// Behaviour test for pro-ai-sdlc's scripts/methods.py (spec-method hand-offs).
// One process per case, a fake `claude` first on PATH, a temp HOME and temp repos.
// Never touches the real HOME and never calls the network.
//
//   node tests/methods.mjs
//
// Skips cleanly when python3 is not on PATH or the script is not on disk.

import {
  mkdtempSync, mkdirSync, rmSync, existsSync, realpathSync, symlinkSync, writeFileSync, chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "..", "plugins", "pro-ai-sdlc", "scripts", "methods.py");
const EGM_JSON = resolve(HERE, "..", "plugins", "pro-egm", "sdlc-method.json");
const SPDD_JSON = resolve(HERE, "..", "plugins", "pro-spdd", "sdlc-method.json");
const MS = "pro-dev-skillset";

const FAKE_CLAUDE = `#!/usr/bin/env python3
import os, sys
if sys.argv[1:3] == ["plugin", "list"]:
    if os.environ.get("FAKE_FAIL"):
        sys.stderr.write("boom\\n"); sys.exit(1)
    lst = os.environ.get("FAKE_PLUGIN_LIST")
    sys.stdout.write(open(lst).read() if lst and os.path.exists(lst) else "[]")
    sys.exit(0)
sys.exit(0)
`;

const py = spawnSync("sh", ["-c", "command -v python3"], { encoding: "utf8" }).stdout.trim();
if (!py || !existsSync(SCRIPT)) {
  console.log("skipped: python3 or methods.py not found");
  process.exit(0);
}

const root = realpathSync(mkdtempSync(join(tmpdir(), "methods-test-")));
const home = join(root, "home");
const repo = join(root, "repo");
const other = join(root, "other-repo");
const tools = join(root, "tools");
const bin = join(root, "bin");
for (const d of [join(home, ".claude", "plugins"), repo, other, tools, bin]) mkdirSync(d, { recursive: true });
symlinkSync(py, join(tools, "python3"));
writeFileSync(join(bin, "claude"), FAKE_CLAUDE);
chmodSync(join(bin, "claude"), 0o755);
const listPath = join(root, "plugin-list.json");
const marketsPath = join(home, ".claude", "plugins", "known_marketplaces.json");

const setMarket = (source) => writeFileSync(marketsPath, JSON.stringify(
  source === undefined ? {} : { [MS]: { source, installLocation: "x" } }));
const GOOD = { source: "github", repo: "jodybrewster/pro-dev-skillset" };

let n = 0;
const installPath = (name) => { const p = join(root, "cache", name + "-" + (n++)); mkdirSync(p, { recursive: true }); return p; };
const install = (id, { scope = "user", projectPath, enabled = true, method } = {}) => {
  const p = installPath(id.split("@")[0]);
  if (method !== undefined) writeFileSync(join(p, "sdlc-method.json"), method);
  return { id, version: "1.0.0", scope, enabled, installPath: p, ...(projectPath ? { projectPath } : {}) };
};
const setList = (items) => writeFileSync(listPath, JSON.stringify(items));
const readText = (p) => spawnSync("cat", [p], { encoding: "utf8" }).stdout;

const run = (stage, { target = "intent/x/spec.md", fail = false, noClaude = false } = {}) => {
  const r = spawnSync("python3", [SCRIPT, "--stage", stage, "--target", target, "--repo", repo], {
    encoding: "utf8", cwd: repo,
    env: { PATH: noClaude ? tools : `${bin}:${tools}`, HOME: home, FAKE_PLUGIN_LIST: listPath, ...(fail ? { FAKE_FAIL: "1" } : {}) },
  });
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
};

const cases = [];
const t = (name, fn) => cases.push([name, fn]);
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const egm = (extra = {}) => install(`pro-egm@${MS}`, { method: readText(EGM_JSON), ...extra });
const core = () => install(`pro-ai-sdlc@${MS}`);

t("no method installed prints nothing", () => {
  setMarket(GOOD); setList([core()]);
  for (const s of ["intent", "spec", "plan", "review"]) {
    const r = run(s); must(r.code === 0 && r.out === "" && r.err === "", `${s}: ${r.out}${r.err}`);
  }
});
t("pro-egm with egm@egm prints spec and plan offers with the target filled", () => {
  setMarket(GOOD); setList([core(), egm(), install("egm@egm")]);
  const s = run("spec", { target: "intent/a/spec.md" });
  must(s.code === 0 && s.out.startsWith("pro-egm: "), s.out);
  must(s.out.includes("-> /pro-egm:goldfish intent/a/spec.md --stage spec"), s.out);
  must(s.out.includes("several subagents on the session model"), s.out);
  must(s.out.trim().split("\n").length === 1, s.out);
  const p = run("plan", { target: "intent/a/plan.md" });
  must(p.out.includes("-> /pro-egm:goldfish intent/a/plan.md --stage plan"), p.out);
});
t("pro-egm prints nothing for intent and review", () => {
  setMarket(GOOD); setList([core(), egm(), install("egm@egm")]);
  for (const s of ["intent", "review"]) must(run(s).out === "", s);
});
t("pro-egm without egm@egm prints the needs line", () => {
  setMarket(GOOD); setList([core(), egm()]);
  const r = run("spec");
  must(r.out.trim() === "pro-egm needs egm@egm: run /pro-dev install", r.out);
  must(run("intent").out === "", "intent should print nothing");
});
t("a disabled egm@egm counts as not installed", () => {
  setMarket(GOOD); setList([core(), egm(), install("egm@egm", { enabled: false })]);
  must(run("spec").out.includes("needs egm@egm"), "expected needs line");
});
t("a disabled method install is ignored", () => {
  setMarket(GOOD); setList([core(), egm({ enabled: false }), install("egm@egm")]);
  must(run("spec").out === "", "disabled install printed");
});
t("a project install for another repo is ignored", () => {
  setMarket(GOOD); setList([core(), egm({ scope: "project", projectPath: other }), install("egm@egm")]);
  must(run("spec").out === "", "other repo printed");
});
t("a project install for this repo or a folder inside it counts", () => {
  setMarket(GOOD);
  const sub = join(repo, "packages", "a"); mkdirSync(sub, { recursive: true });
  setList([egm({ scope: "project", projectPath: sub }), install("egm@egm")]);
  must(run("spec").out.includes("/pro-egm:goldfish"), "inside-repo install missed");
});
t("a plugin from another marketplace with sdlc-method.json is ignored", () => {
  setMarket(GOOD);
  setList([core(), install("evil@other-market", { method: readText(EGM_JSON) })]);
  must(run("spec").out === "", "foreign marketplace printed");
});
t("pro-dev-skillset marketplace with a non-matching source prints nothing", () => {
  setList([core(), egm(), install("egm@egm")]);
  for (const src of [{ source: "github", repo: "someone/else" }, { source: "git", url: "https://x/y.git" }, { source: "directory", path: "/tmp/x" }, undefined]) {
    setMarket(src); must(run("spec").out === "", `source ${JSON.stringify(src)} printed`);
  }
  writeFileSync(marketsPath, "not json"); must(run("spec").out === "", "unreadable file printed");
  rmSync(marketsPath); must(run("spec").out === "", "missing file printed");
});
t("the github repo comparison ignores case", () => {
  setMarket({ source: "github", repo: "JodyBrewster/Pro-Dev-Skillset" }); setList([egm(), install("egm@egm")]);
  must(run("spec").out.includes("/pro-egm:goldfish"), "case-insensitive match failed");
});
t("malformed JSON is skipped with one warning", () => {
  setMarket(GOOD);
  setList([install(`broken@${MS}`, { method: "{ nope" }), egm(), install("egm@egm")]);
  const r = run("spec");
  must(r.code === 0, "exit " + r.code);
  must(r.err.trim().split("\n").length === 1 && r.err.includes("broken@"), "stderr: " + r.err);
  must(r.out.includes("/pro-egm:goldfish"), "good method lost: " + r.out);
});
t("a bad shape is skipped quietly", () => {
  setMarket(GOOD);
  const bad = JSON.stringify({ method: "x", requires: null, handoffs: [{ stage: "deploy", when: "w", offer: "/x" }] });
  setList([install(`bad@${MS}`, { method: bad })]);
  const r = run("spec"); must(r.code === 0 && r.out === "" && r.err === "", r.out + r.err);
});
t("a symlinked or oversized sdlc-method.json is ignored", () => {
  setMarket(GOOD);
  const a = install(`link@${MS}`); symlinkSync(EGM_JSON, join(a.installPath, "sdlc-method.json"));
  const pad = JSON.stringify({ method: "big", requires: null, handoffs: [{ stage: "spec", when: "x".repeat(70000), offer: "/x" }] });
  const b = install(`big@${MS}`, { method: pad });
  setList([a, b]);
  must(run("spec").out === "", "unsafe file printed");
});
t("when and offer are trimmed to one line", () => {
  setMarket(GOOD);
  const m = JSON.stringify({ method: "m", requires: null, handoffs: [{ stage: "spec", when: "a\nb\r\n  c", offer: "/x\ny {target}" }] });
  setList([install(`m@${MS}`, { method: m })]);
  must(run("spec", { target: "t.md" }).out === "m: a b c -> /x y t.md\n", "got " + run("spec", { target: "t.md" }).out);
});
t("missing claude prints nothing and exits 0", () => {
  setMarket(GOOD); setList([egm(), install("egm@egm")]);
  const r = run("spec", { noClaude: true }); must(r.code === 0 && r.out === "" && r.err === "", r.out + r.err);
});
t("a failing claude prints nothing and exits 0", () => {
  setMarket(GOOD); setList([egm(), install("egm@egm")]);
  const r = run("spec", { fail: true }); must(r.code === 0 && r.out === "" && r.err === "", r.out + r.err);
});
t("a listing in the wrong shape prints nothing and exits 0", () => {
  setMarket(GOOD); writeFileSync(listPath, JSON.stringify({ plugins: [] }));
  const r = run("spec"); must(r.code === 0 && r.out === "", r.out);
  writeFileSync(listPath, "garbage"); must(run("spec").code === 0, "garbage exit");
});
t("pro-spdd prints its intent offer", () => {
  setMarket(GOOD); setList([core(), install(`pro-spdd@${MS}`, { method: readText(SPDD_JSON) })]);
  const r = run("intent");
  must(r.out.startsWith("spdd: ") && r.out.trim().endsWith("-> /spdd-story"), r.out);
  must(run("spec").out === "", "spdd should print nothing at spec");
});
t("50 installs finish in under 2 seconds", () => {
  setMarket(GOOD);
  const items = [core(), egm(), install("egm@egm")];
  for (let i = 0; i < 47; i++) items.push(install(`filler${i}@${MS}`, { method: JSON.stringify({ method: `f${i}`, requires: null, handoffs: [] }) }));
  setList(items);
  const t0 = Date.now(); const r = run("spec"); const ms = Date.now() - t0;
  must(r.out.includes("/pro-egm:goldfish"), "no offer");
  must(ms < 2000, `took ${ms} ms`);
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}: ${e.message}`); }
}
rmSync(root, { recursive: true, force: true });
console.log(failed ? `${failed} of ${cases.length} failed` : `all ${cases.length} cases passed`);
process.exit(failed ? 1 : 0);
