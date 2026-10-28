#!/usr/bin/env node
// Behaviour test for pro-egm's scripts/goldfish.py (resolve, init, changed-file tracking).
//
// Each case builds a temp git repo, runs the real script in one process and reads its
// JSON, exit code and stderr. Nothing touches the real HOME or the network.
//
//   node tests/goldfish.mjs
//   node tests/goldfish.mjs --only=refuse           # substring filter on case id
//   node tests/goldfish.mjs --plugin-root=/abs/path # run against an installed copy
//
// Skips cleanly when python3 or git is missing or the script is not on disk.

import {
  mkdtempSync, mkdirSync, rmSync, existsSync, realpathSync, symlinkSync,
  writeFileSync, readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLUGIN_ROOT = resolve(HERE, "..", "plugins", "pro-egm");

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Ada Author", GIT_AUTHOR_EMAIL: "ada@example.com",
  GIT_COMMITTER_NAME: "Ada Author", GIT_COMMITTER_EMAIL: "ada@example.com",
};

function git(repo, ...args) { return execFileSync("git", args, { cwd: repo, env: GIT_ENV, encoding: "utf8" }); }

function buildSandbox(pluginRoot) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "goldfish-test-")));
  const repo = join(root, "repo");
  mkdirSync(join(repo, "intent", "2026-01-01-demo"), { recursive: true });
  execFileSync("git", ["init", "-q", repo]);
  const w = (rel, text = "x\n") => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), text);
  };
  w("intent/2026-01-01-demo/intent.md", "# Intent\n");
  w("intent/2026-01-01-demo/spec.md", "# Spec\n");
  w("intent/2026-01-01-demo/plan.md", "# Plan\n");
  const script = join(pluginRoot, "scripts", "goldfish.py");
  const run = (args, { cwd = repo } = {}) => {
    const r = spawnSync("python3", ["-I", script, ...args], { cwd, encoding: "utf8", env: GIT_ENV });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { code: r.status, out: r.stdout, err: r.stderr, json };
  };
  const resolveArgs = (stage, target, extra = []) => ["resolve", "--stage", stage, "--target", target, "--repo", repo, ...extra];
  return { root, repo, w, run, resolveArgs, pluginRoot };
}

const SPEC = "intent/2026-01-01-demo/spec.md";
const PLAN = "intent/2026-01-01-demo/plan.md";
const sorted = (a) => [...a].sort();
const has = (s, t) => s.includes(t);

function config(spec = {}, plan = {}) {
  return JSON.stringify({
    spec: { reviewers: ["zoom_out"], standards: { zoom_out: "zoom-out-standard" }, context: [], ...spec },
    plan: { reviewers: ["codebase_details"], standards: {}, context: [], ...plan },
  });
}

// A refused case: exit 2 and the bad entry named on stderr.
function refused(s, args, named) {
  const r = s.run(args);
  if (r.code !== 2) return { ok: false, detail: `exit ${r.code}, wanted 2; stdout ${r.out.slice(0, 200)} stderr ${r.err.slice(0, 200)}` };
  if (!has(r.err, named)) return { ok: false, detail: `stderr does not name ${named}: ${r.err}` };
  return { ok: true };
}

const CASES = [
  {
    id: "resolve-defaults-spec",
    run(s) {
      const r = s.run(s.resolveArgs("spec", SPEC));
      if (r.code !== 0 || !r.json) return { ok: false, detail: `exit ${r.code}: ${r.err}` };
      const j = r.json;
      const starter = (n) => join(s.pluginRoot, "goldfish", n);
      const want = ["zoom_out", "design_critic", starter("policy.md"), starter("scope.md")];
      if (JSON.stringify(j.reviewers) !== JSON.stringify(want)) return { ok: false, detail: `reviewers ${JSON.stringify(j.reviewers)}` };
      if (j.standards[starter("policy.md")] !== starter("policy-standard.md") || j.standards.zoom_out !== "zoom-out-standard"
        || j.standards.design_critic !== "feature-spec-standard") return { ok: false, detail: `standards ${JSON.stringify(j.standards)}` };
      if (j.semanticTarget !== "full file" || j.target !== SPEC) return { ok: false, detail: `target ${j.target} / ${j.semanticTarget}` };
      if (!j.reviewers.slice(2).every((p) => p.startsWith("/") && existsSync(p))) return { ok: false, detail: "starter paths are not absolute and present" };
      return { ok: true };
    },
  },
  {
    id: "resolve-defaults-plan",
    run(s) {
      const j = s.run(s.resolveArgs("plan", PLAN)).json;
      if (!j) return { ok: false, detail: "no JSON" };
      const scope = join(s.pluginRoot, "goldfish", "scope.md");
      const want = ["implementation_readiness", "codebase_details", scope];
      if (JSON.stringify(j.reviewers) !== JSON.stringify(want)) return { ok: false, detail: `reviewers ${JSON.stringify(j.reviewers)}` };
      if (j.standards.codebase_details !== "implementation-readiness-standard"
        || j.standards[scope] !== join(s.pluginRoot, "goldfish", "scope-standard.md")) return { ok: false, detail: `standards ${JSON.stringify(j.standards)}` };
      return { ok: true };
    },
  },
  {
    id: "reading-list-spec",
    run(s) {
      s.w("REVIEW.md"); s.w("CLAUDE.md");
      const j = s.run(s.resolveArgs("spec", SPEC)).json;
      const want = ["CLAUDE.md", "REVIEW.md", "intent/2026-01-01-demo/intent.md"];
      return sorted(j.context).join() === want.join() ? { ok: true } : { ok: false, detail: `context ${JSON.stringify(j.context)}` };
    },
  },
  {
    id: "reading-list-plan-adds-spec",
    run(s) {
      s.w("AGENTS.md");
      const j = s.run(s.resolveArgs("plan", PLAN)).json;
      const want = ["AGENTS.md", "intent/2026-01-01-demo/intent.md", "intent/2026-01-01-demo/spec.md"];
      return sorted(j.context).join() === want.join() ? { ok: true } : { ok: false, detail: `context ${JSON.stringify(j.context)}` };
    },
  },
  {
    id: "config-wins",
    run(s) {
      s.w(".egm/reviewers/mine.md", "persona\n"); s.w(".egm/standards/mine-std.md", "rubric\n"); s.w("docs/extra.md");
      s.w(".egm/goldfish.json", config({
        reviewers: ["zoom_out", ".egm/reviewers/mine.md"],
        standards: { zoom_out: "zoom-out-standard", ".egm/reviewers/mine.md": ".egm/standards/mine-std.md" },
        context: ["docs/extra.md"],
      }));
      const j = s.run(s.resolveArgs("spec", SPEC)).json;
      if (!j) return { ok: false, detail: "no JSON" };
      if (JSON.stringify(j.reviewers) !== JSON.stringify(["zoom_out", ".egm/reviewers/mine.md"])) return { ok: false, detail: `reviewers ${JSON.stringify(j.reviewers)}` };
      if (!j.context.includes("docs/extra.md")) return { ok: false, detail: `context ${JSON.stringify(j.context)}` };
      return { ok: true };
    },
  },
  {
    id: "refuse-absolute-reviewer",
    run(s) { s.w(".egm/goldfish.json", config({ reviewers: ["/abs.md"] })); return refused(s, s.resolveArgs("spec", SPEC), "/abs.md"); },
  },
  {
    id: "refuse-dotdot-reviewer",
    run(s) { s.w("x.md"); s.w(".egm/goldfish.json", config({ reviewers: ["../x.md"] })); return refused(s, s.resolveArgs("spec", SPEC), "../x.md"); },
  },
  {
    id: "refuse-symlinked-reviewer-file",
    run(s) {
      s.w("secret.md"); mkdirSync(join(s.repo, ".egm", "reviewers"), { recursive: true });
      symlinkSync(join(s.repo, "secret.md"), join(s.repo, ".egm", "reviewers", "evil.md"));
      s.w(".egm/goldfish.json", config({ reviewers: [".egm/reviewers/evil.md"] }));
      return refused(s, s.resolveArgs("spec", SPEC), ".egm/reviewers/evil.md");
    },
  },
  {
    id: "refuse-symlinked-reviewers-folder",
    run(s) {
      s.w("elsewhere/p.md", "persona\n"); mkdirSync(join(s.repo, ".egm"), { recursive: true });
      symlinkSync(join(s.repo, "elsewhere"), join(s.repo, ".egm", "reviewers"));
      s.w(".egm/goldfish.json", config({ reviewers: [".egm/reviewers/p.md"] }));
      return refused(s, s.resolveArgs("spec", SPEC), ".egm/reviewers/p.md");
    },
  },
  {
    id: "refuse-reviewer-outside-egm",
    run(s) { s.w("docs/x.md"); s.w(".egm/goldfish.json", config({ reviewers: ["docs/x.md"] })); return refused(s, s.resolveArgs("spec", SPEC), "docs/x.md"); },
  },
  {
    id: "refuse-standard-outside-egm",
    run(s) {
      s.w("docs/x.md"); s.w(".egm/goldfish.json", config({ standards: { zoom_out: "docs/x.md" } }));
      return refused(s, s.resolveArgs("spec", SPEC), "docs/x.md");
    },
  },
  {
    id: "refuse-context-outside-repo",
    run(s) {
      writeFileSync(join(s.root, "outside.md"), "x\n");
      s.w(".egm/goldfish.json", config({ context: ["../outside.md"] }));
      return refused(s, s.resolveArgs("spec", SPEC), "../outside.md");
    },
  },
  {
    id: "refuse-context-absolute",
    run(s) {
      writeFileSync(join(s.root, "outside.md"), "x\n");
      const abs = join(s.root, "outside.md");
      s.w(".egm/goldfish.json", config({ context: [abs] }));
      return refused(s, s.resolveArgs("spec", SPEC), abs);
    },
  },
  {
    id: "refuse-symlinked-root-claude-md",
    run(s) {
      writeFileSync(join(s.root, "outside.md"), "x\n");
      symlinkSync(join(s.root, "outside.md"), join(s.repo, "CLAUDE.md"));
      return refused(s, s.resolveArgs("spec", SPEC), "CLAUDE.md");
    },
  },
  {
    id: "refuse-path-under-git",
    run(s) {
      s.w(".egm/goldfish.json", config({ context: [".git/config"] }));
      const a = refused(s, s.resolveArgs("spec", SPEC), ".git/config");
      if (!a.ok) return a;
      return refused(s, s.resolveArgs("spec", ".git/config"), ".git/config");
    },
  },
  {
    id: "init-writes-files",
    run(s) {
      const r = s.run(["init", "--repo", s.repo]);
      if (r.code !== 0) return { ok: false, detail: `exit ${r.code}: ${r.err}${r.out}` };
      for (const f of ["reviewers/policy.md", "reviewers/scope.md", "standards/policy-standard.md", "standards/scope-standard.md"]) {
        if (!existsSync(join(s.repo, ".egm", f))) return { ok: false, detail: `${f} missing` };
      }
      const cfg = JSON.parse(readFileSync(join(s.repo, ".egm", "goldfish.json"), "utf8"));
      if (!cfg.spec.reviewers.includes(".egm/reviewers/policy.md") || cfg.plan.standards[".egm/reviewers/scope.md"] !== ".egm/standards/scope-standard.md") {
        return { ok: false, detail: `config ${JSON.stringify(cfg)}` };
      }
      const j = s.run(s.resolveArgs("spec", SPEC)).json;
      return j && j.reviewers.includes(".egm/reviewers/policy.md") ? { ok: true } : { ok: false, detail: "resolve does not accept the init output" };
    },
  },
  {
    id: "init-leaves-existing-file",
    run(s) {
      s.w(".egm/reviewers/policy.md", "mine\n");
      const r = s.run(["init", "--repo", s.repo]);
      if (r.code !== 0) return { ok: false, detail: `exit ${r.code}: ${r.err}` };
      if (readFileSync(join(s.repo, ".egm", "reviewers", "policy.md"), "utf8") !== "mine\n") return { ok: false, detail: "existing file was overwritten" };
      if (!has(r.out, "left alone")) return { ok: false, detail: `not reported: ${r.out}` };
      return existsSync(join(s.repo, ".egm", "reviewers", "scope.md")) ? { ok: true } : { ok: false, detail: "other files not created" };
    },
  },
  {
    id: "init-refuses-dangling-symlink",
    run(s) {
      mkdirSync(join(s.repo, ".egm", "reviewers"), { recursive: true });
      const victim = join(s.root, "victim.md");
      symlinkSync(victim, join(s.repo, ".egm", "reviewers", "policy.md"));
      const r = s.run(["init", "--repo", s.repo]);
      if (r.code !== 2) return { ok: false, detail: `exit ${r.code}, wanted 2` };
      if (existsSync(victim)) return { ok: false, detail: "followed the symlink and created the target" };
      return has(r.out, "reviewers/policy.md") ? { ok: true } : { ok: false, detail: `not named: ${r.out}` };
    },
  },
  {
    id: "init-refuses-symlinked-egm",
    run(s) {
      mkdirSync(join(s.root, "elsewhere"));
      symlinkSync(join(s.root, "elsewhere"), join(s.repo, ".egm"));
      const r = s.run(["init", "--repo", s.repo]);
      if (r.code !== 2) return { ok: false, detail: `exit ${r.code}, wanted 2` };
      return existsSync(join(s.root, "elsewhere", "reviewers")) ? { ok: false, detail: "wrote through the symlink" } : { ok: true };
    },
  },
  {
    id: "changed-file-tracking",
    run(s) {
      s.run(["init", "--repo", s.repo]);
      git(s.repo, "add", "-A"); git(s.repo, "commit", "-qm", "add egm");
      const first = s.run(s.resolveArgs("spec", SPEC)).json;
      const names = first.newOrChanged.map((e) => e.path);
      if (!names.includes(".egm/reviewers/policy.md")) return { ok: false, detail: `first run lists ${JSON.stringify(first.newOrChanged)}` };
      if (first.newOrChanged[0].author !== "Ada Author") return { ok: false, detail: `author ${first.newOrChanged[0].author}` };
      const acc = s.run(s.resolveArgs("spec", SPEC, ["--accept"]));
      if (acc.code !== 0) return { ok: false, detail: `accept exit ${acc.code}: ${acc.err}` };
      if (existsSync(join(s.repo, ".egm", "egm-seen.json")) || !existsSync(join(s.repo, ".git", "egm-seen.json"))) return { ok: false, detail: "seen file is not in the git dir" };
      const again = s.run(s.resolveArgs("spec", SPEC)).json;
      if (again.newOrChanged.length !== 0) return { ok: false, detail: `after accept ${JSON.stringify(again.newOrChanged)}` };
      writeFileSync(join(s.repo, ".egm", "reviewers", "policy.md"), "edited persona\n");
      const edited = s.run(s.resolveArgs("spec", SPEC)).json.newOrChanged.map((e) => e.path);
      return edited.join() === ".egm/reviewers/policy.md" ? { ok: true } : { ok: false, detail: `after edit ${JSON.stringify(edited)}` };
    },
  },
  {
    id: "default-run-lists-no-changes",
    run(s) {
      const j = s.run(s.resolveArgs("spec", SPEC)).json;
      return j.newOrChanged.length === 0 ? { ok: true } : { ok: false, detail: JSON.stringify(j.newOrChanged) };
    },
  },
];

export function runGoldfishCases({ pluginRoot = DEFAULT_PLUGIN_ROOT, only = null } = {}) {
  const selected = only ? CASES.filter((c) => c.id.includes(only)) : CASES;
  const out = { skipped: null, selected, results: [] };
  if (!existsSync(join(pluginRoot, "scripts", "goldfish.py"))) return { ...out, skipped: `${join(pluginRoot, "scripts", "goldfish.py")} not found` };
  for (const t of ["python3", "git"]) {
    if (spawnSync(t, ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: `${t} not found on PATH` };
  }
  for (const c of selected) {
    const s = buildSandbox(pluginRoot);
    let result;
    try { result = c.run(s); }
    catch (err) { result = { ok: false, detail: `threw: ${(err && err.stack) || err}` }; }
    finally { rmSync(s.root, { recursive: true, force: true }); }
    out.results.push({ id: c.id, ok: !!result.ok, detail: result.detail || "" });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.slice(7) ?? null;
  const root = args.find((a) => a.startsWith("--plugin-root="))?.slice(14);
  const { skipped, selected, results } = runGoldfishCases({ only, ...(root ? { pluginRoot: resolve(root) } : {}) });
  if (skipped) { console.log(`skipped: ${skipped}`); return 0; }
  if (!selected.length) { console.log("no cases match"); return 1; }
  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id}${r.ok ? "" : `\n     ${r.detail}`}`);
    if (!r.ok) failed++;
  }
  console.log(`\n${failed ? "✗" : "✓"} ${results.length} cases · ${failed} failures`);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
