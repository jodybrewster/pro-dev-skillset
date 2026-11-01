#!/usr/bin/env node
// Behaviour test for pro-ship's ship.py: targets, scope, coverage, record and check
// (intent/2026-10-31-ship-preflight, AC1 to AC6). Every case drives the script as a
// subprocess in a throwaway git repo under the OS temp dir. `gh` is a stub script on PATH
// that prints fixed JSON, so nothing touches the network.
//
//   node tests/ship-preflight.mjs
//
// Also exported as runShipPreflightCases() for tests/check.mjs. Case ids for the record
// fixtures are `check/<fixture file>` and `check/missing`; the preflight-contract check reads them.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync, readdirSync, chmodSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHIP = join(ROOT, "plugins", "pro-ship", "scripts", "ship.py");
const PLUGIN_JSON = join(ROOT, "plugins", "pro-ship", ".claude-plugin", "plugin.json");
const FIX = join(ROOT, "tests", "fixtures", "ship-preflight");

const baseEnv = (sandbox) => ({
  ...process.env,
  HOME: join(sandbox, "home"),
  PYTHONDONTWRITEBYTECODE: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
});

// A gh that prints canned output from $GH_STUB_DIR. GH_STUB_FAIL=1 makes every call fail.
const GH_STUB = `#!/bin/sh
d="$GH_STUB_DIR"
if [ -n "$GH_STUB_FAIL" ]; then echo "HTTP 502: bad gateway" >&2; exit 1; fi
case "$1 $2" in
  "pr list") cat "$d/pr-list.json" ;;
  "pr view") cat "$d/pr-view.json" ;;
  "api user") if [ -f "$d/user.txt" ]; then cat "$d/user.txt"; else echo me; fi ;;
  "api repos/{owner}/{repo}/compare/"*) cat "$d/compare.txt" ;;
  "api repos/{owner}/{repo}/deployments?"*) cat "$d/deployments.json" ;;
  "api repos/{owner}/{repo}/deployments/"*) cat "$d/status-$(echo "$2" | sed 's|.*/deployments/\\([0-9]*\\)/.*|\\1|').json" ;;
  "api repos/{owner}/{repo}/collaborators/"*)
    u="\${2#repos/\\{owner\\}/\\{repo\\}/collaborators/}"; u="\${u%/permission}"
    if [ -f "$d/perm-$u.txt" ]; then cat "$d/perm-$u.txt"; else echo read; fi ;;
  "api repos/{owner}/{repo}/commits/"*)
    s="\${2#repos/\\{owner\\}/\\{repo\\}/commits/}"; s="\${s%/pulls}"
    if [ -f "$d/pulls-$s.json" ]; then cat "$d/pulls-$s.json"; else echo "[]"; fi ;;
  *) echo "gh stub: no canned answer for: $*" >&2; exit 2 ;;
esac
`;

export function runShipPreflightCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "ship-preflight-")));
  const env = baseEnv(sandbox);
  mkdirSync(env.HOME, { recursive: true });
  const stubBin = join(sandbox, "bin");
  mkdirSync(stubBin, { recursive: true });
  writeFileSync(join(stubBin, "gh"), GH_STUB);
  chmodSync(join(stubBin, "gh"), 0o755);
  let repoN = 0;
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 500) });

  const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env });
  const put = (repo, files) => {
    for (const [p, c] of Object.entries(files)) {
      const f = join(repo, p);
      if (c === null) { rmSync(f, { force: true }); continue; }
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, c);
    }
  };
  const commit = (repo, files, msg = "c") => { put(repo, files); git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", msg); return git(repo, "rev-parse", "HEAD").stdout.trim(); };
  const mkrepo = (files = {}) => {
    const repo = join(sandbox, `repo${++repoN}`);
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    put(repo, { ".gitkeep": "", ...files });
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "init");
    return repo;
  };
  // Copy a fixture tree into a fresh git repo.
  const treeRepo = (name, mutate) => {
    const repo = join(sandbox, `repo${++repoN}`);
    mkdirSync(repo, { recursive: true });
    spawnSync("cp", ["-R", join(FIX, "repos", name) + "/.", repo]);
    if (mutate) mutate(repo);
    git(repo, "init", "-q", "-b", "main");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "init");
    return repo;
  };
  const ship = (repo, args, opts = {}) => {
    const r = spawnSync("python3", [SHIP, ...args], {
      cwd: repo, encoding: "utf8", timeout: 60000,
      env: { ...env, PATH: `${stubBin}:${process.env.PATH}`, ...(opts.env || {}) },
    });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", json };
  };
  const head = (repo) => git(repo, "rev-parse", "HEAD").stdout.trim();
  const stubDir = (files) => {
    const d = join(sandbox, `stub${++repoN}`);
    mkdirSync(d, { recursive: true });
    for (const [n, c] of Object.entries(files)) writeFileSync(join(d, n), typeof c === "string" ? c : JSON.stringify(c));
    return d;
  };
  const marker = (h, result = "pass", tier = "medium") => `## Testing\n\nall green\n\n<!-- pro-ship:pr-check head=${h} result=${result} tier=${tier} -->\n`;

  try {
    targetCases();
    coverageCases();
    scopeCases();
    recordCases();
    checkCases();
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;

  // AC1: how a repo ships, from files alone.
  function targetCases() {
    const kinds = (r) => (r.json || []).map((t) => t.kind);
    let repo = treeRepo("vercel-app");
    let r = ship(repo, ["targets"]);
    add("targets/vercel-app is one deploy-on-merge target", "one deploy-on-merge target",
      r.status === 0 && r.json.length === 1 && r.json[0].kind === "deploy-on-merge" && r.json[0].evidence.includes("vercel.json"), r.stdout + r.stderr);

    repo = treeRepo("tag-only");
    r = ship(repo, ["targets"]);
    add("targets/tag-only is one tag-release target", "one tag-release target", r.status === 0 && kinds(r).join() === "tag-release", r.stdout + r.stderr);

    repo = treeRepo("npm-package");
    r = ship(repo, ["targets", "--root", repo]);
    add("targets/npm-package is one publish target", "one publish target", r.status === 0 && kinds(r).join() === "publish", r.stdout + r.stderr);

    repo = treeRepo("fly-manual");
    r = ship(repo, ["targets"]);
    add("targets/fly-manual is one manual-deploy target", "one manual-deploy target", r.status === 0 && kinds(r).join() === "manual-deploy", r.stdout + r.stderr);

    repo = treeRepo("mieruka-like");
    r = ship(repo, ["targets"]);
    add("targets/mieruka-like with a Ship block is one tag-release target with three packages and no publish",
      "one tag-release target, three packages, no publish",
      r.status === 0 && r.json.length === 1 && r.json[0].kind === "tag-release" && r.json[0].packages?.length === 3
        && !kinds(r).includes("publish") && r.json[0].rollback?.steps?.length === 1 && r.json[0].evidence[0] === "AGENTS.md", r.stdout + r.stderr);

    repo = treeRepo("mieruka-like", (d) => rmSync(join(d, "AGENTS.md")));
    r = ship(repo, ["targets"]);
    add("targets/mieruka-like without the block finds the web and cli publish targets and the desktop app",
      "publish x2 and desktop", r.status === 0 && kinds(r).sort().join() === "desktop,publish,publish", r.stdout + r.stderr);

    // A deploy workflow on push to main beats fly.toml; a tag workflow is a tag-release; v* tags count.
    repo = mkrepo({ "fly.toml": "app = 'x'\n", ".github/workflows/d.yml": "on:\n  push:\n    branches: [main]\njobs:\n  d:\n    runs-on: ubuntu-latest\n    steps:\n      - run: flyctl deploy\n" });
    r = ship(repo, ["targets"]);
    add("targets/a push-to-main deploy workflow with fly.toml is deploy-on-merge", "deploy-on-merge", r.status === 0 && kinds(r).join() === "deploy-on-merge", r.stdout + r.stderr);
    repo = mkrepo({ "x.txt": "1\n" });
    git(repo, "tag", "v1.0.0");
    r = ship(repo, ["targets"]);
    add("targets/an existing v* tag is a tag-release target", "tag-release", r.status === 0 && kinds(r).join() === "tag-release", r.stdout + r.stderr);
    for (const tag of ["pro-ship--v0.9.2", "1.2.3", "name@1.2.3", "v1.2.3-rc.1", "release_v2.0.0"]) {
      repo = mkrepo({ "x.txt": "1\n" });
      git(repo, "tag", tag);
      r = ship(repo, ["targets"]);
      add(`targets/a ${tag} tag is a tag-release target`, "tag-release", r.status === 0 && kinds(r).join() === "tag-release", r.stdout + r.stderr);
    }
    for (const tag of ["v1", "latest", "release1.2.3", "v1.2", "stable-2024"]) {
      repo = mkrepo({ "x.txt": "1\n" });
      git(repo, "tag", tag);
      r = ship(repo, ["targets"]);
      add(`targets/a ${tag} tag is not a release tag`, "no targets", r.status === 0 && r.json.length === 0, r.stdout + r.stderr);
    }
    const patternBlock = (pat) => `## Ship\n\n\`\`\`yaml\ntag_pattern: "${pat}"\n\`\`\`\n`;
    repo = mkrepo({ "AGENTS.md": patternBlock("rel-*") });
    git(repo, "tag", "rel-5");
    r = ship(repo, ["targets"]);
    add("targets/a Ship block with only tag_pattern uses it to find tag-release", "tag-release", r.status === 0 && kinds(r).join() === "tag-release", r.stdout + r.stderr);
    repo = mkrepo({ "AGENTS.md": patternBlock("rel-*") });
    git(repo, "tag", "v1.0.0");
    r = ship(repo, ["targets"]);
    add("targets/tag_pattern overrides the semver rule", "no targets", r.status === 0 && r.json.length === 0, r.stdout + r.stderr);
    repo = mkrepo({ "AGENTS.md": patternBlock("-x") });
    r = ship(repo, ["targets"]);
    add("targets/a tag_pattern that looks like an option is refused", "exit 1", r.status === 1 && /tag_pattern/.test(r.stderr), r.stdout + r.stderr);
    // This marketplace's own Ship block: one tag-release target, per-plugin tags.
    r = ship(ROOT, ["targets", "--root", ROOT]);
    add("targets/this repo's CLAUDE.md declares one tag-release target with a rollback and a tag_pattern",
      "marketplace tag-release, rollback steps, evidence CLAUDE.md",
      r.status === 0 && r.json.length === 1 && r.json[0].id === "marketplace" && r.json[0].kind === "tag-release"
        && r.json[0].rollback?.steps?.length >= 1 && r.json[0].evidence[0] === "CLAUDE.md"
        && /^\s*tag_pattern: "\*--v\*"$/m.test(readFileSync(join(ROOT, "CLAUDE.md"), "utf8")), r.stdout + r.stderr);
    repo = mkrepo({ "x.txt": "1\n" });
    r = ship(repo, ["targets"]);
    add("targets/a repo with nothing to ship has no targets", "empty list", r.status === 0 && Array.isArray(r.json) && r.json.length === 0, r.stdout + r.stderr);
    repo = mkrepo({ "AGENTS.md": "## Ship\n\n```yaml\ntargets:\n  - id: a\n    kind: nonsense\n```\n" });
    r = ship(repo, ["targets"]);
    add("targets/a Ship block with an unknown kind is refused, not guessed", "exit 1 naming the block", r.status === 1 && /Ship block/.test(r.stderr), r.stdout + r.stderr);
  }

  // AC3: coverage through a stubbed gh.
  function coverageCases() {
    const repo = mkrepo({ "a.txt": "0\n" });
    const base = head(repo);
    const branch = (name, n) => {
      git(repo, "checkout", "-q", "-b", name, "main");
      const shas = [];
      for (let i = 1; i <= n; i++) shas.push(commit(repo, { [`${name}-${i}.txt`]: `${i}\n` }, `${name} ${i}`));
      git(repo, "checkout", "-q", "main");
      return shas;
    };
    const merge = (name) => { git(repo, "merge", "--no-ff", "-q", "-m", `merge ${name}`, name); return head(repo); };
    const [p1a] = branch("pr1", 1);
    const m1 = merge("pr1");
    const [p2a, p2b] = branch("pr2", 2);
    const m2 = merge("pr2");
    const direct = commit(repo, { "direct.txt": "d\n" }, "direct push");
    const squash = commit(repo, { "squash.txt": "s\n" }, "pr3 (#3)");
    const squashPartial = commit(repo, { "squash2.txt": "s\n" }, "pr4 (#4)");
    const r1 = commit(repo, { "r1.txt": "1\n" }, "rebased 1");
    const r2 = commit(repo, { "r2.txt": "2\n" }, "rebased 2");
    const nomark = branch("pr6", 1);
    const m6 = merge("pr6");
    const tip = head(repo);
    const oid = (s) => ({ oid: s });
    // Every PR below is by the current gh user ("me") from a branch in this repo unless a case says otherwise.
    const own = { author: { login: "me" }, authorAssociation: "NONE", isCrossRepository: false };
    const list = [
      { number: 1, headRefOid: p1a, mergeCommit: oid(m1), body: marker(p1a) },
      { number: 2, headRefOid: p2b, mergeCommit: oid(m2), body: marker(p2a) },
      { number: 3, headRefOid: "3".repeat(40), mergeCommit: oid(squash), body: marker("3".repeat(40)) },
      { number: 4, headRefOid: p2b, mergeCommit: oid(squashPartial), body: marker(p2a) },
      { number: 5, headRefOid: "5".repeat(40), mergeCommit: oid(r2), body: marker("5".repeat(40)) },
      { number: 6, headRefOid: nomark[0], mergeCommit: oid(m6), body: "no marker here" },
    ].map((p) => ({ ...own, ...p }));
    const dir = stubDir({
      "pr-list.json": list,
      [`pulls-${r1}.json`]: [{ number: 5, merged_at: "2026-11-01T00:00:00Z", body: marker("5".repeat(40)), merge_commit_sha: r2,
        user: { login: "me" }, author_association: "NONE", head: { sha: "5".repeat(40), repo: { full_name: "o/r" } }, base: { repo: { full_name: "o/r" } } }],
    });
    const r = ship(repo, ["coverage", base, tip], { env: { GH_STUB_DIR: dir } });
    const unc = new Set(r.json?.uncovered || []), cov = new Set(r.json?.covered || []);
    const want = { covered: [p1a, m1, p2a, squash, r1, r2], uncovered: [p2b, m2, direct, squashPartial, nomark[0], m6] };
    const ok = r.status === 0 && want.covered.every((s) => cov.has(s)) && want.uncovered.every((s) => unc.has(s))
      && unc.size === want.uncovered.length && cov.size === want.covered.length;
    add("coverage/merge, squash, rebase, partial marker, no marker and a direct push", "only the later commit and the merge commit of PR 2, the partial squash, the unmarked PR and the direct push are uncovered",
      ok, `${r.stderr} uncovered=${[...unc].map((s) => s.slice(0, 7))} covered=${[...cov].map((s) => s.slice(0, 7))}`);
    const byNum = Object.fromEntries((r.json?.prs || []).map((p) => [p.number, p]));
    add("coverage/the PR records say which PR is covered and carry the marker", "PR 1 covered, PR 2 not, marker head shown",
      byNum[1]?.covered === true && byNum[2]?.covered === false && byNum[2]?.marker?.head === p2a && byNum[6]?.marker === null && byNum[5]?.covered === true,
      JSON.stringify(r.json?.prs));

    // Who wrote the marker matters: it is the PR author's word.
    const covers = (label, expectCovered, over, extraFiles = {}) => {
      const d = stubDir({ "pr-list.json": [{ ...own, number: 1, headRefOid: p1a, mergeCommit: oid(m1), body: marker(p1a), ...over }], ...extraFiles });
      const x = ship(repo, ["coverage", base, m1], { env: { GH_STUB_DIR: d } });
      const got = x.status === 0 && x.json.covered.includes(m1) && x.json.covered.includes(p1a);
      add(`coverage/${label}`, expectCovered ? "covered" : "uncovered", x.status === 0 && got === expectCovered && (expectCovered || x.json.covered.length === 0), x.stdout + x.stderr);
    };
    covers("a marker on a PR by the current gh user covers", true, {});
    covers("a pass marker on a fork PR covers nothing, even from the current gh user", false, { isCrossRepository: true });
    covers("a pass marker on a PR by an outside contributor covers nothing", false, { author: { login: "stranger" }, authorAssociation: "CONTRIBUTOR" });
    covers("a pass marker on a PR by a first-time contributor covers nothing", false, { author: { login: "stranger" }, authorAssociation: "FIRST_TIME_CONTRIBUTOR" });
    covers("a PR by a collaborator is covered", true, { author: { login: "mate" }, authorAssociation: "COLLABORATOR" });
    covers("a PR by a member is covered", true, { author: { login: "mate" }, authorAssociation: "MEMBER" });
    covers("a PR by the owner is covered", true, { author: { login: "boss" }, authorAssociation: "OWNER" });
    covers("a PR with no author data covers nothing", false, { author: null, authorAssociation: undefined });
    // Real \`gh pr list\` prints no authorAssociation, so the login's push permission decides.
    covers("a PR by a login with write permission is covered", true, { author: { login: "mate2" }, authorAssociation: undefined }, { "perm-mate2.txt": "write" });
    covers("a PR by a login with read permission covers nothing", false, { author: { login: "reader" }, authorAssociation: undefined }, { "perm-reader.txt": "read" });
    covers("a PR by a bot login covers nothing", false, { author: { login: "app/dependabot" }, authorAssociation: undefined });
    covers("a PR with no cross-repository flag covers nothing", false, { isCrossRepository: undefined });
    covers("two markers in one body cover nothing", false, { body: marker(p1a) + marker(p1a) });
    covers("a pass marker followed by a forged second one covers nothing", false, { body: marker(p1a) + marker(p1a, "pass", "low") });

    // A non-pass marker and a marker for a different head cover nothing.
    const bad = stubDir({ "pr-list.json": [
      { number: 1, headRefOid: p1a, mergeCommit: oid(m1), body: marker(p1a, "incomplete") },
    ] });
    const r2c = ship(repo, ["coverage", base, m1], { env: { GH_STUB_DIR: bad } });
    add("coverage/a marker with result=incomplete covers nothing", "all uncovered", r2c.status === 0 && r2c.json.covered.length === 0 && r2c.json.uncovered.includes(m1), r2c.stdout + r2c.stderr);
    const other = stubDir({ "pr-list.json": [
      { number: 1, headRefOid: p1a, mergeCommit: oid(m1), body: marker("9".repeat(40)) },
    ] });
    const r3c = ship(repo, ["coverage", base, m1], { env: { GH_STUB_DIR: other } });
    add("coverage/a marker whose head is not on the PR's branch covers nothing", "all uncovered", r3c.status === 0 && r3c.json.covered.length === 0, r3c.stdout + r3c.stderr);

    // gh failing is reported, never a pass.
    const fail = ship(repo, ["coverage", base, tip], { env: { GH_STUB_DIR: dir, GH_STUB_FAIL: "1" } });
    add("coverage/a gh failure exits 1 with the reason and prints no covered list", "exit 1, stderr names gh, empty stdout",
      fail.status === 1 && /gh exited 1/.test(fail.stderr) && fail.stdout.trim() === "", fail.stdout + fail.stderr);
    // A failed pulls lookup leaves the commit uncovered and says so.
    const half = stubDir({ "pr-list.json": [] });
    const hr = ship(repo, ["coverage", base, m1], { env: { GH_STUB_DIR: half } });
    add("coverage/with no PRs listed every commit is uncovered", "everything uncovered", hr.status === 0 && hr.json.covered.length === 0 && hr.json.uncovered.length > 0, hr.stdout + hr.stderr);
  }

  function scopeCases() {
    // --pr: the merge base comes from the compare call.
    let repo = mkrepo({ "a.txt": "1\n" });
    const h = head(repo);
    let dir = stubDir({ "pr-view.json": { baseRefName: "main", headRefOid: h }, "compare.txt": "b".repeat(40) + "\n" });
    let r = ship(repo, ["scope", "--pr", "7"], { env: { GH_STUB_DIR: dir } });
    add("scope/--pr gives the merge base to the PR head", "kind pr, base from compare",
      r.status === 0 && r.json.kind === "pr" && r.json.base === "b".repeat(40) && r.json.head === h && r.json.range === `${"b".repeat(40)}..${h}`, r.stdout + r.stderr);

    // deploy-on-merge: the newest successful production deployment.
    repo = mkrepo({ "vercel.json": "{}\n" });
    const deployed = head(repo);
    commit(repo, { "b.txt": "2\n" });
    dir = stubDir({
      "deployments.json": [{ id: 11, sha: "c".repeat(40) }, { id: 10, sha: deployed }],
      "status-11.json": [{ state: "failure" }], "status-10.json": [{ state: "success" }],
    });
    r = ship(repo, ["scope"], { env: { GH_STUB_DIR: dir } });
    add("scope/a deploy-on-merge repo starts at the last successful production deploy", "base is the deployed sha, source github",
      r.status === 0 && r.json.kind === "deploy" && r.json.base === deployed && r.json.last_deploy_source === "github" && r.json.targets[0].kind === "deploy-on-merge", r.stdout + r.stderr);

    // No deployment found: fall back to the release tag.
    git(repo, "tag", "v1.0.0", deployed);
    dir = stubDir({ "deployments.json": [] });
    r = ship(repo, ["scope"], { env: { GH_STUB_DIR: dir } });
    add("scope/with no deployment it falls back to the newest release tag", "base is the tag, source tag",
      r.status === 0 && r.json.base === deployed && r.json.last_deploy_source === "tag", r.stdout + r.stderr);

    // A tag-release repo needs no gh at all and starts at the newest reachable v* tag.
    repo = treeRepo("tag-only");
    const t1 = head(repo);
    git(repo, "tag", "v0.1.0");
    commit(repo, { "n.txt": "1\n" });
    r = ship(repo, ["scope"], { env: { GH_STUB_FAIL: "1" } });
    add("scope/a tag-release repo starts at the newest reachable tag without calling gh", "kind tag, base is the tag",
      r.status === 0 && r.json.kind === "tag" && r.json.base === t1 && r.json.last_deploy_source === "tag", r.stdout + r.stderr);

    // Per-plugin tags (name--vX.Y.Z) and bare semver tags are release tags; tag_pattern narrows them.
    for (const tag of ["pro-ship--v0.9.2", "1.2.3", "name@1.2.3"]) {
      repo = treeRepo("tag-only");
      const at = head(repo);
      git(repo, "tag", tag);
      commit(repo, { "n.txt": "1\n" });
      r = ship(repo, ["scope"]);
      add(`scope/the ${tag} tag is the base`, "base is the tag", r.status === 0 && r.json.base === at && r.json.last_deploy_source === "tag", r.stdout + r.stderr);
    }
    repo = treeRepo("tag-only");
    const early = head(repo);
    git(repo, "tag", "pro-ship--v0.9.2");
    commit(repo, { "n.txt": "1\n" });
    git(repo, "tag", "v2.0.0");
    commit(repo, { "n2.txt": "1\n" });
    put(repo, { "CLAUDE.md": "# x\n\n## Ship\n\n```yaml\ntargets:\n  - id: market\n    kind: tag-release\n    rollback:\n      steps: [revert]\ntag_pattern: \"*--v*\"\nlast_deploy: tag\n```\n" });
    git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", "ship block");
    r = ship(repo, ["scope"]);
    add("scope/tag_pattern in the Ship block picks the base and skips other tags", "base is the pattern tag, not v2.0.0", r.status === 0 && r.json.base === early, r.stdout + r.stderr);

    // Nothing to start from: base null, source none; the skill asks.
    repo = treeRepo("tag-only");
    r = ship(repo, ["scope"]);
    add("scope/with no tag there is no base and the source is none", "base null, source none", r.status === 0 && r.json.base === null && r.json.range === null && r.json.last_deploy_source === "none", r.stdout + r.stderr);

    // last_deploy: ask in the Ship block.
    repo = mkrepo({ "AGENTS.md": "## Ship\n\n```yaml\ntargets:\n  - id: web\n    kind: deploy-on-merge\nlast_deploy: ask\n```\n" });
    r = ship(repo, ["scope"], { env: { GH_STUB_FAIL: "1" } });
    add("scope/last_deploy ask in the Ship block makes no gh call and leaves the base to the person", "source ask, base null", r.status === 0 && r.json.last_deploy_source === "ask" && r.json.base === null, r.stdout + r.stderr);

    // A gh failure is reported.
    repo = mkrepo({ "vercel.json": "{}\n" });
    r = ship(repo, ["scope"], { env: { GH_STUB_FAIL: "1" } });
    add("scope/a gh failure exits 1", "exit 1", r.status === 1 && /gh exited/.test(r.stderr), r.stdout + r.stderr);
  }

  // AC4 and AC5: the record.
  function recordCases() {
    const version = JSON.parse(readFileSync(PLUGIN_JSON, "utf8")).version;
    const rollback = { triggers: ["error rate above 2 percent"], steps: ["roll back to the previous deploy"], rto: "5 minutes" };
    const report = (h, b, extra = {}) => ({
      verdict: "GO", head: h, base: b,
      scope: { kind: "tag", range: `${b}..${h}`, prs: [1], uncovered: [], last_deploy_source: "tag" },
      blockers: [], fixes: [{ text: "Add a changelog line", evidence: "CHANGELOG.md" }], risks: [],
      checks: [{ section: "security", item: "dependency audit", status: "pass", evidence: "0 vulnerabilities" }],
      legal: { status: "not-installed", verdict: null, base: null, head: null, blocking: 0, required: 0 },
      targets: [{ id: "web", kind: "tag-release", env: "production", url: null, commit: h, rollback }],
      report_md: "# Ship decision\n\nGO\n", ...extra,
    });
    const mk = () => { const repo = mkrepo({ "a.txt": "1\n" }); const b = head(repo); const h = commit(repo, { "a.txt": "2\n" }); return { repo, b, h }; };
    const rec = (repo, rep, name = "report.json") => {
      const p = join(sandbox, `${name}-${++repoN}`);
      writeFileSync(p, JSON.stringify(rep));
      return ship(repo, ["record", p]);
    };
    const manifestOk = (m, h) => ["evidence_key", "kind", "artifact_kind", "artifact_key", "status", "summary", "detail_json", "produced_by"].every((k) => typeof m[k] === "string")
      && m.schema === 1 && m.head === h && m.kind === "review" && m.artifact_kind === "ship-preflight" && m.artifact_key === h.slice(0, 12)
      && m.evidence_key === `ship-preflight-${h.slice(0, 12)}` && m.produced_by === `pro-ship:ship@${version}`;

    const cases = [
      ["GO", (h, b) => report(h, b), "pass", /^GO: 0 Blockers, 1 recommended fix, 1 target/],
      ["GO with accepted risks", (h, b) => report(h, b, { risks: [{ text: "r", mitigation: "m", accepted_by: "the maintainer", accepted_at: "2026-11-01T09:00:00-04:00" }] }), "partial", /^GO: 0 Blockers.*1 accepted risk/],
      ["GO with an unaccepted risk", (h, b) => report(h, b, { risks: [{ text: "r", mitigation: "m", accepted_by: null, accepted_at: null }] }), "pass", /^GO:/],
      ["NO-GO", (h, b) => report(h, b, { verdict: "NO-GO", blockers: [{ text: "STRIPE_KEY missing", evidence: "vercel env ls" }] }), "fail", /^NO-GO: 1 Blocker,/],
    ];
    for (const [label, make, status, summary] of cases) {
      const { repo, b, h } = mk();
      const r = rec(repo, make(h, b));
      const f = join(repo, ".pro-dev", "ship", "preflight.json");
      let m = null;
      try { m = JSON.parse(readFileSync(f, "utf8")); } catch { /* checked below */ }
      let detail = null;
      try { detail = JSON.parse(m.detail_json); } catch { /* checked below */ }
      add(`record/${label} writes a manifest with status ${status}`, `status ${status}, every manifest field, string detail_json`,
        r.status === 0 && m && manifestOk(m, h) && m.status === status && summary.test(m.summary) && detail?.head === h && detail.legal?.status === "not-installed"
          && !("report_md" in detail) && typeof detail.created === "string" && detail.targets[0].rollback.steps.length === 1, r.stdout + r.stderr + JSON.stringify(m));
      if (label === "GO") {
        const md = readFileSync(join(repo, ".pro-dev", "ship", "preflight.md"), "utf8");
        const excl = readFileSync(join(repo, ".git", "info", "exclude"), "utf8");
        add("record/the report lands in preflight.md and .pro-dev/ is excluded so the tree stays clean", "md equals report_md, exclude lists .pro-dev/, status clean",
          md === "# Ship decision\n\nGO\n" && excl.split("\n").includes(".pro-dev/") && git(repo, "status", "--short").stdout.trim() === "" && git(repo, "rev-parse", "HEAD").stdout.trim() === h,
          md + excl + git(repo, "status", "--short").stdout);
        const c = ship(repo, ["check", h]);
        add("record/a fresh record passes check", "fresh true, cause null", c.json?.fresh === true && c.json.cause === null && c.json.status === "pass", c.stdout + c.stderr);
      }
    }

    // Refusals.
    let t = mk();
    let r = rec(t.repo, report(t.h, t.b, { blockers: [{ text: "x", evidence: "y" }] }));
    add("record/refuses a GO with blockers", "exit 1, no file", r.status === 1 && /blockers/.test(r.stderr) && !existsSync(join(t.repo, ".pro-dev", "ship", "preflight.json")), r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { targets: [{ id: "web", kind: "tag-release", env: null, url: null, commit: t.h, rollback: { triggers: [], steps: [], rto: null } }] }));
    add("record/refuses a GO whose target has no rollback steps", "exit 1, no file", r.status === 1 && /rollback/.test(r.stderr) && !existsSync(join(t.repo, ".pro-dev", "ship", "preflight.json")), r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { verdict: "NO-GO", targets: [{ id: "web", kind: "tag-release", env: null, url: null, commit: t.h, rollback: null }], blockers: [{ text: "no rollback", evidence: "web" }] }));
    add("record/accepts a NO-GO whose cause is a missing rollback", "exit 0, status fail", r.status === 0 && r.json.status === "fail", r.stdout + r.stderr);
    t = mk();
    put(t.repo, { "a.txt": "dirty\n" });
    r = rec(t.repo, report(t.h, t.b));
    add("record/refuses a dirty tracked tree", "exit 1 telling to commit", r.status === 1 && /uncommitted/.test(r.stderr) && !existsSync(join(t.repo, ".pro-dev", "ship", "preflight.json")), r.stdout + r.stderr);
    t = mk();
    put(t.repo, { "untracked.txt": "x\n" });
    r = rec(t.repo, report(t.h, t.b));
    add("record/ignores untracked files", "exit 0", r.status === 0, r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report("f".repeat(40), t.b));
    add("record/refuses a report for another commit", "exit 1", r.status === 1 && /another commit/.test(r.stderr), r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { verdict: "GO with acknowledged risks" }));
    add("record/refuses the verdict GO with acknowledged risks (an accepted risk is a risk with accepted_by)", "exit 1", r.status === 1 && /GO or NO-GO/.test(r.stderr), r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { targets: [] }));
    add("record/refuses a GO with no targets", "exit 1, no file", r.status === 1 && /no target/.test(r.stderr) && !existsSync(join(t.repo, ".pro-dev", "ship", "preflight.json")), r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { verdict: "NO-GO", targets: [], blockers: [{ text: "nothing ships", evidence: "targets" }] }));
    add("record/accepts a NO-GO with no targets", "exit 0, status fail", r.status === 0 && r.json.status === "fail", r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { legal: { status: "done", verdict: "Ship", base: t.b, head: t.b, blocking: 0, required: 0 } }));
    add("record/refuses a done legal review of another commit", "exit 1, no file", r.status === 1 && /legal\.head/.test(r.stderr) && !existsSync(join(t.repo, ".pro-dev", "ship", "preflight.json")), r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { legal: { status: "done", verdict: "Ship", base: t.b, head: null, blocking: 0, required: 0 } }));
    add("record/refuses a done legal review with no head", "exit 1", r.status === 1 && /legal\.head/.test(r.stderr), r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { legal: { status: "done", verdict: "Ship", base: t.b, head: t.h, blocking: 0, required: 0 } }));
    add("record/accepts a done legal review of this commit", "exit 0", r.status === 0, r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { legal: { status: "could-not-run", verdict: null, base: null, head: null, blocking: 0, required: 0 } }));
    add("record/a legal review that did not run needs no head", "exit 0", r.status === 0, r.stdout + r.stderr);
    t = mk();
    r = rec(t.repo, report(t.h, t.b, { verdict: "MAYBE" }));
    add("record/refuses a verdict that is not GO or NO-GO", "exit 1", r.status === 1, r.stdout + r.stderr);

    // AC5: the mieruka drop.
    t = mk();
    put(t.repo, { ".gitignore": ".mieruka/evidence/\n", ".mieruka/config.json": "{}\n" });
    git(t.repo, "add", "-A"); git(t.repo, "commit", "-q", "-m", "mieruka");
    t.h = head(t.repo);
    r = rec(t.repo, report(t.h, t.b));
    const dropped = join(t.repo, ".mieruka", "evidence", `ship-preflight-${t.h.slice(0, 12)}`, "evidence.json");
    add("record/an ignored .mieruka/evidence/ gets the same manifest", "identical bytes at .mieruka/evidence/<key>/evidence.json",
      r.status === 0 && existsSync(dropped) && readFileSync(dropped, "utf8") === readFileSync(join(t.repo, ".pro-dev", "ship", "preflight.json"), "utf8")
        && r.json.written.includes(`.mieruka/evidence/ship-preflight-${t.h.slice(0, 12)}/evidence.json`) && git(t.repo, "status", "--short").stdout.trim() === "", r.stdout + r.stderr);

    t = mk();
    put(t.repo, { ".mieruka/evidence/old/evidence.json": "{}\n" });
    git(t.repo, "add", "-A"); git(t.repo, "commit", "-q", "-m", "tracked evidence");
    t.h = head(t.repo);
    r = rec(t.repo, report(t.h, t.b));
    add("record/a tracked .mieruka/evidence/ gets nothing and the output says why", "no file there, skipped message says why",
      r.status === 0 && !existsSync(join(t.repo, ".mieruka", "evidence", `ship-preflight-${t.h.slice(0, 12)}`)) && /tracked|not ignored/.test(JSON.stringify(r.json.skipped)), r.stdout + r.stderr);

    // mieruka itself ignores .mieruka/ but force-adds a few screenshots under evidence/.
    t = mk();
    put(t.repo, { ".gitignore": ".mieruka/\n", ".mieruka/evidence/shot.png": "png\n" });
    git(t.repo, "add", "-f", ".gitignore", ".mieruka/evidence/shot.png"); git(t.repo, "commit", "-q", "-m", "force-added screenshot");
    t.h = head(t.repo);
    r = rec(t.repo, report(t.h, t.b));
    add("record/an ignored folder with force-added files still gets the manifest", "written, tree clean",
      r.status === 0 && existsSync(join(t.repo, ".mieruka", "evidence", `ship-preflight-${t.h.slice(0, 12)}`, "evidence.json"))
        && git(t.repo, "status", "--short").stdout.trim() === "", r.stdout + r.stderr);

    t = mk();
    put(t.repo, { ".mieruka/config.json": "{}\n" });
    git(t.repo, "add", "-A"); git(t.repo, "commit", "-q", "-m", "mieruka, nothing ignored");
    t.h = head(t.repo);
    r = rec(t.repo, report(t.h, t.b));
    add("record/a .mieruka/ whose evidence folder is not ignored gets nothing and the output says why", "no file there, skipped message names ignored",
      r.status === 0 && !existsSync(join(t.repo, ".mieruka", "evidence")) && /not ignored/.test(JSON.stringify(r.json.skipped)), r.stdout + r.stderr);

    t = mk();
    r = rec(t.repo, report(t.h, t.b));
    add("record/with no .mieruka/ nothing is dropped and the output says why", "skipped message names the missing folder",
      r.status === 0 && !existsSync(join(t.repo, ".mieruka")) && /no \.mieruka/.test(JSON.stringify(r.json.skipped)), r.stdout + r.stderr);
  }

  // AC6: check, per fixture and for a missing record.
  function checkCases() {
    const expected = JSON.parse(readFileSync(join(FIX, "expect.json"), "utf8"));
    const files = readdirSync(FIX).filter((f) => f.endsWith(".json") && f !== "expect.json");
    for (const name of Object.keys(expected)) {
      if (!files.includes(name)) { add(`check/${name}`, "a fixture file", false, "expect.json lists a file that is missing"); continue; }
      const repo = mkrepo({ "a.txt": "1\n" });
      const tagged = head(repo);
      git(repo, "tag", "v1.0.0");
      const h = commit(repo, { "a.txt": "2\n" });
      const text = readFileSync(join(FIX, name), "utf8").split("HEAD").join(h).split("BASE").join(tagged);
      mkdirSync(join(repo, ".pro-dev", "ship"), { recursive: true });
      writeFileSync(join(repo, ".pro-dev", "ship", "preflight.json"), text);
      const r = ship(repo, ["check", h]);
      const want = expected[name].check;
      const ok = r.status === 0 && r.json && (want === "fresh" ? r.json.fresh === true && r.json.cause === null : r.json.fresh === false && r.json.cause === want);
      add(`check/${name}`, `cause ${want}`, ok, r.stdout + r.stderr);
    }
    const repo = mkrepo({ "a.txt": "1\n" });
    const r = ship(repo, ["check", head(repo)]);
    add("check/missing", "cause missing", r.status === 0 && r.json.fresh === false && r.json.cause === "missing", r.stdout + r.stderr);
    // A directory where the file should be is unreadable, not missing.
    const d = mkrepo({ "a.txt": "1\n" });
    mkdirSync(join(d, ".pro-dev", "ship", "preflight.json"), { recursive: true });
    const rd = ship(d, ["check", head(d)]);
    add("check/a record that cannot be read is unreadable", "cause unreadable", rd.json?.cause === "unreadable", rd.stdout + rd.stderr);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runShipPreflightCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} ship preflight cases passed`);
  process.exit(bad ? 1 : 0);
}
