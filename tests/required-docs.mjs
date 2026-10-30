#!/usr/bin/env node
// Behaviour test for pro-quality's required-docs.py. Every case builds a throwaway git repo,
// runs the script once with cwd at that repo and asserts the exit code and the JSON.
//
//   node tests/required-docs.mjs
//
// Also exported as runRequiredDocsCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "plugins", "pro-quality", "scripts", "required-docs.py");
const REVIEW_TEMPLATE = join(ROOT, "plugins", "pro-ai-sdlc", "templates", "REVIEW.md");

export function runRequiredDocsCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "required-docs-")));
  const env = {
    ...process.env,
    HOME: join(sandbox, "home"),
    PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  };
  let repoN = 0;
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 400) });
  const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env });
  const put = (repo, files) => {
    for (const [p, c] of Object.entries(files)) {
      const f = join(repo, p);
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, c);
    }
  };
  const commit = (repo, files, msg = "c") => { put(repo, files); git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", msg); return git(repo, "rev-parse", "HEAD").stdout.trim(); };
  const mkrepo = (files = {}) => {
    const repo = join(sandbox, `repo${++repoN}`);
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    commit(repo, files, "init");
    return repo;
  };
  const run = (repo, args = ["--json"]) => {
    const r = spawnSync("python3", [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env, timeout: 30000 });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", json };
  };
  const names = (r) => (r.json && r.json.missing ? r.json.missing.map((m) => m.doc) : []);
  const ruleOf = (r, doc) => ((r.json && r.json.missing) || []).find((m) => m.doc === doc)?.rule || "";
  const finding = (r, prefix) => ((r.json && r.json.findings) || []).some((f) => f.startsWith(prefix));
  const has = (r, ...docs) => docs.every((d) => names(r).includes(d));
  const hasNot = (r, ...docs) => docs.every((d) => !names(r).includes(d));

  const ALWAYS = { "README.md": "# r\n", "CLAUDE.md": "# c\n", "AGENTS.md": "# a\n", "REVIEW.md": "# Review\n", "docs/decisions/README.md": "# d\n" };
  const block = (body) => `# Review\n\n## Required documents\n\n\`\`\`yaml\n${body}\n\`\`\`\n`;
  const pkg = (o) => JSON.stringify(o);

  try {
    // 1
    { const r = run(mkrepo({ "README.md": "# r\n" }));
      add("bare", "exit 3, defaults, four always rows missing",
        r.status === 3 && r.json?.source === "defaults" && has(r, "CLAUDE.md", "AGENTS.md", "REVIEW.md", "docs/decisions/") && hasNot(r, "README.md") && ruleOf(r, "CLAUDE.md") === "always", r.stdout + r.stderr); }
    // 2
    { const r = run(mkrepo(ALWAYS));
      add("complete", "exit 0, nothing missing", r.status === 0 && r.json?.missing?.length === 0, r.stdout + r.stderr); }
    // 3
    { const files = { ...ALWAYS }; delete files["docs/decisions/README.md"]; files["docs/adr/0001-x.md"] = "# x\n";
      const r = run(mkrepo(files));
      const row = (r.json?.rows || []).find((x) => x.doc === "docs/decisions/");
      add("adr-folder", "docs/adr/ counts as the decisions folder", r.status === 0 && row && row.present === true, r.stdout + r.stderr); }
    // 4
    { const repo = mkrepo({ "README.md": "# r\n" }); put(repo, { "CLAUDE.md": "# c\n" });
      const r = run(repo);
      add("untracked", "an untracked CLAUDE.md is missing", has(r, "CLAUDE.md"), r.stdout + r.stderr); }
    // 5
    { const r = run(mkrepo({ ...ALWAYS, "package.json": pkg({ dependencies: { react: "1" } }) }));
      add("ui-react", "react in dependencies makes DESIGN.md and PRODUCT.md required",
        r.status === 3 && has(r, "DESIGN.md", "PRODUCT.md") && ruleOf(r, "DESIGN.md").startsWith("has a UI:") && ruleOf(r, "PRODUCT.md").startsWith("has users:"), r.stdout + r.stderr); }
    // 6
    { const r = run(mkrepo({ ...ALWAYS, "package.json": pkg({ workspaces: ["apps/*"] }), "apps/web/package.json": pkg({ devDependencies: { next: "1" } }) }));
      add("ui-workspace", "next in a workspace member makes the UI signal hold", has(r, "DESIGN.md", "PRODUCT.md"), r.stdout + r.stderr); }
    // 7
    { const r = run(mkrepo({ ...ALWAYS, "package.json": pkg({ name: "x" }), "demo/app/package.json": pkg({ dependencies: { next: "1" } }) }));
      add("ui-stray-app", "a package.json outside the workspaces does not count", hasNot(r, "DESIGN.md", "PRODUCT.md"), r.stdout + r.stderr); }
    // 8
    { const r = run(mkrepo({ ...ALWAYS, "DESIGN.md": "# d\n" }));
      add("ui-design-md", "a tracked DESIGN.md turns the UI signal on, so PRODUCT.md is required", has(r, "PRODUCT.md") && hasNot(r, "DESIGN.md"), r.stdout + r.stderr); }
    // 9
    { const r = run(mkrepo({ ...ALWAYS, "pnpm-workspace.yaml": "packages:\n  - 'pkgs/*'\n" }));
      add("arch-pnpm", "pnpm-workspace.yaml makes ARCHITECTURE.md required",
        has(r, "ARCHITECTURE.md") && ruleOf(r, "ARCHITECTURE.md").startsWith("more than one module, service or deployable:") && ruleOf(r, "ARCHITECTURE.md").includes("pnpm-workspace.yaml"), r.stdout + r.stderr); }
    // 10
    { const r = run(mkrepo({ ...ALWAYS, "package.json": pkg({ name: "x" }), "server/go.mod": "module x\n" }));
      add("arch-manifests", "two manifest directories make ARCHITECTURE.md required", has(r, "ARCHITECTURE.md"), r.stdout + r.stderr); }
    // 11
    { const r = run(mkrepo({ ...ALWAYS, "package.json": pkg({ name: "x" }), "tests/fixtures/x/package.json": "{}", "examples/y/package.json": "{}" }));
      add("arch-fixtures-ignored", "fixture and example manifests are ignored", hasNot(r, "ARCHITECTURE.md"), r.stdout + r.stderr); }
    // 12
    { const r = run(mkrepo({ ...ALWAYS, "Dockerfile": "FROM x\n", "worker/Dockerfile.worker": "FROM x\n" }));
      add("arch-dockerfiles", "two Dockerfiles make ARCHITECTURE.md required", has(r, "ARCHITECTURE.md"), r.stdout + r.stderr); }
    // 13
    { const r = run(mkrepo({ ...ALWAYS, "REVIEW.md": block("add: [SECURITY.md]") }));
      add("block-add", "an add entry is required with rule REVIEW.md add",
        r.status === 3 && r.json?.source === "REVIEW.md" && has(r, "SECURITY.md") && ruleOf(r, "SECURITY.md") === "REVIEW.md add", r.stdout + r.stderr); }
    // 14
    { const r = run(mkrepo({ ...ALWAYS, "REVIEW.md": block("remove: [PRODUCT.md]"), "package.json": pkg({ dependencies: { react: "1" } }) }));
      add("block-remove", "remove drops PRODUCT.md and keeps DESIGN.md", hasNot(r, "PRODUCT.md") && has(r, "DESIGN.md"), r.stdout + r.stderr); }
    // 15
    { const r = run(mkrepo({ ...ALWAYS, "REVIEW.md": block("remove: [README.md]") }));
      add("block-remove-always", "removing an always row is unreadable and defaults apply",
        String(r.json?.source).startsWith("unreadable (") && finding(r, "required-docs-block-unreadable"), r.stdout + r.stderr); }
    // 16
    { const r = run(mkrepo({ ...ALWAYS, "REVIEW.md": block("severity: blocking") }));
      add("block-unknown-key", "an unknown key is unreadable",
        String(r.json?.source).startsWith("unreadable (") && finding(r, "required-docs-block-unreadable"), r.stdout + r.stderr); }
    // 17
    { const r = run(mkrepo({ ...ALWAYS, "REVIEW.md": `# Review\n\n<!--\n## Required documents\n\n\`\`\`yaml\nadd: [SECURITY.md]\n\`\`\`\n-->\n` }));
      add("block-commented", "a commented block reads as defaults", r.json?.source === "defaults" && r.status === 0, r.stdout + r.stderr); }
    // 18
    { const tpl = readFileSync(REVIEW_TEMPLATE, "utf8");
      const a = run(mkrepo({ ...ALWAYS, "REVIEW.md": tpl }));
      const stripped = tpl.replace(/^<!-- Required documents:[^\n]*\n/m, "").replace(/(## Required documents[\s\S]*?```\n)-->\n/, "$1");
      const b = run(mkrepo({ ...ALWAYS, "REVIEW.md": stripped }));
      add("block-template", "the shipped template reads as defaults, and as REVIEW.md once uncommented",
        a.json?.source === "defaults" && b.json?.source === "REVIEW.md", `${a.json?.source} / ${b.json?.source}`); }
    // 19
    { const repo = mkrepo({ ...ALWAYS, "package.json": pkg({ dependencies: { react: "1" } }) });
      const base = git(repo, "rev-parse", "HEAD").stdout.trim();
      commit(repo, { "REVIEW.md": block("remove: [PRODUCT.md]") }, "loosen");
      const withRef = run(repo, ["--json", "--policy-ref", base]);
      const noRef = run(repo, ["--json"]);
      add("policy-ref", "--policy-ref reads the base policy, so a PR cannot loosen its own set", has(withRef, "PRODUCT.md") && hasNot(noRef, "PRODUCT.md"), withRef.stdout + noRef.stdout); }
    // 20
    { const link = mkrepo({ "README.md": "# r\n", "CLAUDE.md": "# c\n", "REVIEW.md": "# r\n", "docs/decisions/README.md": "# d\n" });
      symlinkSync("CLAUDE.md", join(link, "AGENTS.md")); git(link, "add", "-A"); git(link, "commit", "-q", "-m", "link");
      const a = run(link);
      const pointer = mkrepo({ ...ALWAYS, "AGENTS.md": "# Agents\n\nRead CLAUDE.md for the project rules.\n\nIt is the one source.\n" });
      const b = run(pointer);
      const same = mkrepo({ ...ALWAYS, "CLAUDE.md": "same\n", "AGENTS.md": "same\n" });
      const c = run(same);
      const longA = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n") + "\n";
      const differs = mkrepo({ ...ALWAYS, "CLAUDE.md": longA, "AGENTS.md": longA + "extra\n" });
      const d = run(differs);
      add("agents-symlink", "a symlink raises no finding", a.status === 0 && !finding(a, "agent-files-differ"), a.stdout + a.stderr);
      add("agents-pointer", "a pointer raises no finding", !finding(b, "agent-files-differ"), b.stdout + b.stderr);
      add("agents-copy-same", "an identical copy raises no finding", !finding(c, "agent-files-differ"), c.stdout + c.stderr);
      add("agents-copy-differs", "a differing copy raises agent-files-differ", finding(d, "agent-files-differ"), d.stdout + d.stderr); }
    // 21
    { const dir = join(sandbox, "plain"); mkdirSync(dir, { recursive: true });
      const r = run(dir);
      add("not-a-repo", "exit 2 with could_not_run", r.status === 2 && r.json?.could_not_run === true, r.stdout + r.stderr); }
    // 22
    { const r = run(mkrepo({ "README.md": "# r\n" }), []);
      const lines = r.stdout.split("\n").filter((l) => l.startsWith("missing  "));
      add("human", "one missing line per document", r.status === 3 && lines.length === 4 && /^missing {2}CLAUDE\.md {2}\(always\)$/.test(lines[0]), r.stdout + r.stderr); }
    // 23 worktree presence
    { const repo = mkrepo({ "README.md": "# r\n" }); put(repo, { "CLAUDE.md": "# c\n", "docs/decisions/0001-x.md": "# x\n" });
      const r = run(repo, ["--json", "--worktree"]);
      add("worktree-untracked", "--worktree counts an untracked file and folder as present", hasNot(r, "CLAUDE.md", "docs/decisions/") && has(r, "AGENTS.md", "REVIEW.md"), r.stdout + r.stderr);
      const outside = join(sandbox, "outside.md"); writeFileSync(outside, "# o\n");
      symlinkSync(outside, join(repo, "AGENTS.md"));
      const l = run(repo, ["--json", "--worktree"]);
      add("worktree-symlink-out", "--worktree does not follow a symlink out of the repo", has(l, "AGENTS.md"), l.stdout + l.stderr);
      symlinkSync("README.md", join(repo, "REVIEW.md"));
      const k = run(repo, ["--json", "--worktree"]);
      add("worktree-symlink-in", "--worktree follows a symlink that stays inside the repo", hasNot(k, "REVIEW.md"), k.stdout + k.stderr); }
    // 24 policy-ref handling
    { const repo = mkrepo(ALWAYS);
      const bad = run(repo, ["--json", "--policy-ref", "nosuchref"]);
      add("policy-ref-bad", "an unknown ref is could-not-run, not defaults", bad.status === 2 && bad.json?.could_not_run === true, bad.stdout + bad.stderr);
      const dash = run(repo, ["--json", "--policy-ref=-x"]);
      add("policy-ref-dash", "a ref starting with - is could-not-run", dash.status === 2 && dash.json?.could_not_run === true, dash.stdout + dash.stderr);
      const base = commit(repo, { "x.txt": "x\n" }, "x");
      const noReview = mkrepo({ "README.md": "# r\n" });
      const first = git(noReview, "rev-parse", "HEAD").stdout.trim();
      const ok = run(noReview, ["--json", "--policy-ref", first]);
      add("policy-ref-no-review", "a base with no REVIEW.md stays defaults", ok.json?.source === "defaults" && base !== "", ok.stdout + ok.stderr); }
    // 25 dot-prefixed workspace glob
    { const r = run(mkrepo({ ...ALWAYS, "package.json": pkg({ workspaces: ["./.config/*"] }), ".config/web/package.json": pkg({ dependencies: { react: "1" } }) }));
      add("ui-dot-glob", "a ./.config/* workspace glob keeps its leading dot", has(r, "DESIGN.md", "PRODUCT.md"), r.stdout + r.stderr); }
    // 26 pnpm member with a UI dependency and the workspaces object form
    { const r = run(mkrepo({ ...ALWAYS, "pnpm-workspace.yaml": "packages:\n  - 'pkgs/*'\n", "pkgs/web/package.json": pkg({ dependencies: { vue: "1" } }) }));
      add("ui-pnpm-member", "a pnpm-workspace member with a UI dependency makes the UI signal hold", has(r, "DESIGN.md", "PRODUCT.md"), r.stdout + r.stderr);
      const o = run(mkrepo({ ...ALWAYS, "package.json": pkg({ workspaces: { packages: ["apps/*"] } }), "apps/web/package.json": pkg({ dependencies: { svelte: "1" } }) }));
      add("ui-workspaces-object", "the workspaces {packages: [...]} form is read", has(o, "DESIGN.md", "PRODUCT.md"), o.stdout + o.stderr); }
    // 27 add validation and folder entries
    { for (const [id, entry] of [["add-dotdot", "../x"], ["add-abs", "/abs"]]) {
        const r = run(mkrepo({ ...ALWAYS, "REVIEW.md": block(`add: ["${entry}"]`) }));
        add(id, `add ${entry} is unreadable`, String(r.json?.source).startsWith("unreadable (") && finding(r, "required-docs-block-unreadable"), r.stdout + r.stderr); }
      const miss = run(mkrepo({ ...ALWAYS, "REVIEW.md": block("add: [foo/]") }));
      add("add-folder-missing", "a folder add entry is missing when the folder is absent", has(miss, "foo/"), miss.stdout + miss.stderr);
      const there = run(mkrepo({ ...ALWAYS, "REVIEW.md": block("add: [foo/]"), "foo/a.md": "# a\n" }));
      add("add-folder-present", "a folder add entry is present when the folder holds a tracked file", hasNot(there, "foo/") && there.status === 0, there.stdout + there.stderr); }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { skipped, results } = runRequiredDocsCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  const bad = results.filter((r) => !r.ok);
  for (const r of bad) console.log(`FAIL ${r.id}: expected ${r.expect}${r.reason ? ` - ${r.reason}` : ""}`);
  console.log(`${results.length - bad.length}/${results.length} cases pass`);
  process.exit(bad.length ? 1 : 0);
}
