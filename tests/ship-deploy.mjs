#!/usr/bin/env node
// Behaviour test for pro-ship's `ship.py deployed` (intent/2026-11-01-after-build-loop,
// R1 to R5, AC1 and AC2 and the deploy items of the plan's security challenge). Every case
// drives the script as a subprocess in a throwaway git repo under the OS temp dir. `gh` is a
// stub script on PATH that prints canned JSON, so nothing touches the network.
//
//   node tests/ship-deploy.mjs
//
// Also exported as runShipDeployCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync, chmodSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHIP = join(ROOT, "plugins", "pro-ship", "scripts", "ship.py");
const PLUGIN_JSON = join(ROOT, "plugins", "pro-ship", ".claude-plugin", "plugin.json");

// A gh that prints canned output from $GH_STUB_DIR and logs each call to $GH_STUB_DIR/calls.log.
const GH_STUB = `#!/bin/sh
d="$GH_STUB_DIR"
echo "$*" >> "$d/calls.log"
if [ -n "$GH_STUB_FAIL" ]; then echo "HTTP 502: bad gateway" >&2; exit 1; fi
case "$1 $2" in
  "api repos/{owner}/{repo}/deployments?"*) cat "$d/deployments.json" ;;
  "api repos/{owner}/{repo}/deployments/"*) cat "$d/statuses.json" ;;
  *) echo "gh stub: no canned answer for: $*" >&2; exit 2 ;;
esac
`;

const SHIP_BLOCK = "# x\n\n## Ship\n\n```yaml\ntargets:\n  - id: web\n    kind: deploy-on-merge\n    env: production\n    rollback:\n      triggers: [\"error rate above 2%\"]\n      steps: [\"redeploy the previous build\"]\n      rto: \"10 minutes\"\n```\n";

export function runShipDeployCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "ship-deploy-")));
  const env = {
    ...process.env, HOME: join(sandbox, "home"), PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  };
  mkdirSync(env.HOME, { recursive: true });
  const stubBin = join(sandbox, "bin");
  mkdirSync(stubBin, { recursive: true });
  writeFileSync(join(stubBin, "gh"), GH_STUB);
  chmodSync(join(stubBin, "gh"), 0o755);
  let n = 0;
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 500) });
  const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env });
  const mkrepo = (files = { "CLAUDE.md": SHIP_BLOCK }) => {
    const repo = join(sandbox, `repo${++n}`);
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    for (const [p, c] of Object.entries({ ".gitkeep": "", ...files })) writeFileSync(join(repo, p), c);
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "init");
    return repo;
  };
  const head = (repo) => git(repo, "rev-parse", "HEAD").stdout.trim();
  const stubDir = (files) => {
    const d = join(sandbox, `stub${++n}`);
    mkdirSync(d, { recursive: true });
    for (const [f, c] of Object.entries(files)) writeFileSync(join(d, f), JSON.stringify(c));
    return d;
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
  const rec = (repo, r) => JSON.parse(readFileSync(join(repo, r.json.path), "utf8"));
  const detail = (repo, r) => JSON.parse(rec(repo, r).detail_json);
  const version = JSON.parse(readFileSync(PLUGIN_JSON, "utf8")).version;
  const noRecord = (repo) => !existsSync(join(repo, ".pro-dev", "ship", "deploys"));
  const SHA = "a".repeat(40);
  const dep = (sha = SHA) => ({ "deployments.json": [{ id: 7, sha, created_at: "2026-11-02T10:00:00Z" }] });
  const st = (state, extra = {}) => ({ "statuses.json": [{ state, created_at: "2026-11-02T10:05:09Z", ...extra }] });

  try {
    manualCases();
    refusalCases();
    preflightCases();
    statusCases();
    githubCases();
    mierukaCases();
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;

  // AC1 and R1: the record, its fields and its name.
  function manualCases() {
    const repo = mkrepo();
    const h = head(repo);
    const r = ship(repo, ["deployed", "--target", "web", "--env", "production", "--url", "https://example.test", "--deployed-at", "2026-11-02T10:15:30+00:00"]);
    const ok = r.status === 0 && r.json;
    const key = `deploy-web-${h.slice(0, 12)}-20261102t101530z`;
    add("deployed/manual prints the path, key and status", "exit 0 and a path", ok && r.json.evidence_key === key && r.json.status === "pass"
      && r.json.path === `.pro-dev/ship/deploys/${key}.json` && r.json.mieruka === null, r.stdout + r.stderr);
    if (!ok) return;
    const rc = rec(repo, r);
    const d = detail(repo, r);
    add("deployed/manual record carries the shared fields", "fields of docs/loop-records.md",
      rc.schema === 1 && rc.kind === "deploy" && rc.artifact_kind === "deploy" && rc.artifact_key === "web" && rc.head === h
        && rc.evidence_key === key && /^[a-z0-9][a-z0-9-]*$/.test(rc.evidence_key) && typeof rc.detail_json === "string"
        && rc.produced_by === `pro-ship:deployed@${version}` && rc.summary === `production: deployed ${h.slice(0, 12)}`, JSON.stringify(rc));
    add("deployed/manual detail_json holds the deploy keys", "target, env, url, commit, source, outcome, preflight, checks, rollback",
      d.target === "web" && d.target_kind === "deploy-on-merge" && d.env === "production" && d.url === "https://example.test"
        && d.commit === h && d.deployed_at === "2026-11-02T10:15:30+00:00" && typeof d.created === "string" && d.source === "manual"
        && d.outcome === "succeeded" && d.preflight.state === "missing" && d.preflight.evidence_key === null
        && Array.isArray(d.checks) && d.checks.length === 0 && d.rollback?.steps?.[0] === "redeploy the previous build" && d.rollback.rto === "10 minutes", JSON.stringify(d));
    add("deployed/the dot-pro-dev folder is excluded so the tree stays clean", "git status is empty", git(repo, "status", "--porcelain").stdout.trim() === "", git(repo, "status", "--porcelain").stdout);

    // A time with an offset is converted to UTC for the key.
    const r2 = ship(repo, ["deployed", "--target", "web", "--env", "staging", "--deployed-at", "2026-11-02T23:59:59-05:00"]);
    add("deployed/the key time is UTC", "20261103t045959z", r2.json?.evidence_key?.endsWith("-20261103t045959z"), r2.stdout + r2.stderr);
    const r3 = ship(repo, ["deployed", "--target", "web", "--env", "production"]);
    add("deployed/no time given uses now", "a key ending in a UTC stamp", /-\d{8}t\d{6}z$/.test(r3.json?.evidence_key || ""), r3.stdout + r3.stderr);
    const r4 = ship(repo, ["deployed", "--target", "web", "--env", "production", "--deployed-at", "2026-11-02T10:15:30"]);
    add("deployed/a time with no offset is refused", "exit 1", r4.status === 1 && /offset/.test(r4.stderr), r4.stdout + r4.stderr);
  }

  // R3 and the security items: the target, the env, the URL.
  function refusalCases() {
    const repo = mkrepo();
    const base = ["deployed", "--target", "web", "--env", "production"];
    let r = ship(repo, ["deployed", "--target", "mobile", "--env", "production"]);
    add("deployed/an unknown target is refused and the ids are listed", "exit 1 naming web", r.status === 1 && /web/.test(r.stderr) && noRecord(repo), r.stdout + r.stderr);
    r = ship(repo, ["deployed", "--target", "../web", "--env", "production"]);
    add("deployed/a target with a path in it is refused", "exit 1", r.status === 1 && noRecord(repo), r.stdout + r.stderr);
    r = ship(repo, ["deployed", "--target", "Web", "--env", "production"]);
    add("deployed/a target with capitals is refused", "exit 1", r.status === 1, r.stdout + r.stderr);
    r = ship(repo, ["deployed", "--env", "production"]);
    add("deployed/no target is a refusal with usage", "exit 1", r.status === 1 && /usage/.test(r.stderr), r.stdout + r.stderr);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://example.test/x", "//example.test", "https://", "https://exa mple.test", "file:///etc/passwd"]) {
      r = ship(repo, [...base, "--url", bad]);
      add(`deployed/url ${bad} is refused`, "exit 1 and no record", r.status === 1 && /http/.test(r.stderr) && noRecord(repo), r.stdout + r.stderr);
    }
    r = ship(repo, [...base, "--url", "http://localhost:3000/app"]);
    add("deployed/an http url is kept", "exit 0", r.status === 0 && detail(repo, r).url === "http://localhost:3000/app", r.stdout + r.stderr);
    for (const bad of ["Prod", "prod uction", "../x", "a&b=c", "-x", "pro/d"]) {
      r = ship(repo, ["deployed", "--target", "web", "--env", bad]);
      add(`deployed/env ${bad} is refused`, "exit 1", r.status === 1 && /--env/.test(r.stderr), r.stdout + r.stderr);
    }
    r = ship(repo, ["deployed", "--target", "web"]);
    add("deployed/manual without --env is refused", "exit 1", r.status === 1 && /--env/.test(r.stderr), r.stdout + r.stderr);
    r = ship(repo, [...base, "--outcome", "great"]);
    add("deployed/an unknown outcome is refused", "exit 1", r.status === 1 && /outcome/.test(r.stderr), r.stdout + r.stderr);
    r = ship(repo, [...base, "--commit", "deadbeef"]);
    add("deployed/a commit the repo does not have is refused", "exit 1", r.status === 1 && /commit/.test(r.stderr), r.stdout + r.stderr);
    r = ship(repo, [...base, "--bogus", "1"]);
    add("deployed/an unknown option is refused", "exit 1", r.status === 1 && /unknown option/.test(r.stderr), r.stdout + r.stderr);
    const bare = join(sandbox, `repo${++n}`);
    mkdirSync(bare, { recursive: true });
    git(bare, "init", "-q", "-b", "main");
    writeFileSync(join(bare, "a.txt"), "1\n");
    git(bare, "add", "-A"); git(bare, "commit", "-q", "-m", "i");
    r = ship(bare, ["deployed", "--target", "web", "--env", "production"]);
    add("deployed/a repo that ships nothing known refuses and says none", "exit 1", r.status === 1 && /none found/.test(r.stderr), r.stdout + r.stderr);
  }

  // R4: preflight.state follows the freshness rule of ship check.
  function preflightCases() {
    const run = (setup) => {
      const repo = mkrepo();
      const h = head(repo);
      setup?.(repo, h);
      const r = ship(repo, ["deployed", "--target", "web", "--env", "production"]);
      return { repo, r, d: r.json ? detail(repo, r) : null, h };
    };
    const put = (repo, text) => {
      mkdirSync(join(repo, ".pro-dev", "ship"), { recursive: true });
      writeFileSync(join(repo, ".pro-dev", "ship", "preflight.json"), text);
    };
    const pre = (h, status = "pass") => JSON.stringify({ schema: 1, head: h, evidence_key: `ship-preflight-${h.slice(0, 12)}`, kind: "review", status, produced_by: "pro-ship:ship@0.1.0" });
    let x = run();
    add("deployed/preflight missing", "missing and no key", x.d?.preflight.state === "missing" && x.d.preflight.evidence_key === null, x.r.stdout + x.r.stderr);
    x = run((repo, h) => put(repo, pre(h)));
    add("deployed/preflight fresh", "fresh and its key", x.d?.preflight.state === "fresh" && x.d.preflight.evidence_key === `ship-preflight-${x.h.slice(0, 12)}`, x.r.stdout + x.r.stderr);
    x = run((repo) => put(repo, pre("b".repeat(40))));
    add("deployed/preflight stale", "stale and its key", x.d?.preflight.state === "stale" && x.d.preflight.evidence_key === `ship-preflight-${"b".repeat(12)}`, x.r.stdout + x.r.stderr);
    x = run((repo, h) => put(repo, pre(h, "fail")));
    add("deployed/preflight no-go", "no-go", x.d?.preflight.state === "no-go", x.r.stdout + x.r.stderr);
    x = run((repo) => put(repo, "{ not json"));
    add("deployed/preflight unreadable", "unreadable and no key", x.d?.preflight.state === "unreadable" && x.d.preflight.evidence_key === null, x.r.stdout + x.r.stderr);
  }

  // R5: the status table and the checks file.
  function statusCases() {
    const repo = mkrepo();
    const file = (name, v) => { const p = join(sandbox, name); writeFileSync(p, typeof v === "string" ? v : JSON.stringify(v)); return p; };
    const go = (extra, t = "2026-11-02T10:00:00Z") => ship(repo, ["deployed", "--target", "web", "--env", "production", "--deployed-at", t, ...extra]);
    const c = (s) => ({ item: `check ${s}`, status: s, evidence: "seen" });
    let r = go(["--checks", file("c1.json", [c("pass"), c("pass")])], "2026-11-02T10:00:01Z");
    add("deployed/succeeded with every check passing is pass", "pass", r.json?.status === "pass" && detail(repo, r).checks.length === 2, r.stdout + r.stderr);
    r = go(["--checks", file("c2.json", [c("pass"), c("confirm")])], "2026-11-02T10:00:02Z");
    add("deployed/a check to confirm makes it partial", "partial and a summary naming it", r.json?.status === "partial" && /production: deployed [0-9a-f]{12}, 1 check to confirm$/.test(rec(repo, r).summary), r.stdout + r.stderr);
    r = go(["--checks", file("c3.json", { checks: [c("finding")] })], "2026-11-02T10:00:03Z");
    add("deployed/a finding makes it partial", "partial", r.json?.status === "partial" && /1 finding/.test(rec(repo, r).summary), r.stdout + r.stderr);
    r = go(["--outcome", "failed", "--checks", file("c4.json", [c("pass")])], "2026-11-02T10:00:04Z");
    add("deployed/a failed deploy is fail", "fail", r.json?.status === "fail" && /^production: deploy failed /.test(rec(repo, r).summary), r.stdout + r.stderr);
    r = go(["--outcome", "rolled-back"], "2026-11-02T10:00:05Z");
    add("deployed/a rolled-back deploy is fail", "fail", r.json?.status === "fail" && detail(repo, r).outcome === "rolled-back" && /rolled back/.test(rec(repo, r).summary), r.stdout + r.stderr);
    r = go(["--checks", file("c5.json", [{ item: "x", status: "ok" }])]);
    add("deployed/a check with an unknown status is refused", "exit 1", r.status === 1, r.stdout + r.stderr);
    r = go(["--checks", file("c6.json", "nope")]);
    add("deployed/a checks file that is not JSON is refused", "exit 1", r.status === 1, r.stdout + r.stderr);
    r = go(["--checks", file("c7.json", [{ item: "x", status: "pass" }])], "2026-11-02T10:00:07Z");
    add("deployed/a check without evidence gets an empty string", "evidence is empty", r.status === 0 && detail(repo, r).checks[0].evidence === "", r.stdout + r.stderr);
  }

  // R2, AC2: the facts from a GitHub deployment, with the security items.
  function githubCases() {
    const repo = mkrepo();
    const base = ["deployed", "--from-github", "--target", "web"];
    let dir = stubDir({ ...dep(), ...st("success", { environment_url: "https://app.example.test" }) });
    let r = ship(repo, base, { env: { GH_STUB_DIR: dir } });
    let d = r.json ? detail(repo, r) : null;
    add("deployed/from-github fills commit, url, time and outcome", "all four and source github",
      r.status === 0 && d.commit === SHA && d.url === "https://app.example.test" && d.outcome === "succeeded" && d.source === "github"
        && d.deployed_at === "2026-11-02T10:05:09+00:00" && d.env === "production" && rec(repo, r).head === SHA
        && r.json.evidence_key === `deploy-web-${SHA.slice(0, 12)}-20261102t100509z`, r.stdout + r.stderr);
    add("deployed/from-github asks for the production environment by default", "environment=production", /environment=production&/.test(readFileSync(join(dir, "calls.log"), "utf8")), readFileSync(join(dir, "calls.log"), "utf8"));
    add("deployed/from-github has preflight stale for a commit the repo has not checked", "missing", d?.preflight.state === "missing", JSON.stringify(d?.preflight));

    dir = stubDir({ ...dep(), ...st("failure") });
    r = ship(repo, [...base, "--env", "staging"], { env: { GH_STUB_DIR: dir } });
    add("deployed/from-github failure state is a failed outcome and a null url", "fail and url null",
      r.json?.status === "fail" && detail(repo, r).outcome === "failed" && detail(repo, r).url === null && detail(repo, r).env === "staging", r.stdout + r.stderr);
    add("deployed/from-github puts the env in the query", "environment=staging", /environment=staging&/.test(readFileSync(join(dir, "calls.log"), "utf8")), readFileSync(join(dir, "calls.log"), "utf8"));

    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.test", "not a url"]) {
      dir = stubDir({ ...dep(), ...st("success", { environment_url: bad }) });
      r = ship(repo, base, { env: { GH_STUB_DIR: dir } });
      add(`deployed/from-github environment_url ${bad} is dropped to null`, "exit 0 and url null", r.status === 0 && detail(repo, r).url === null, r.stdout + r.stderr);
    }
    dir = stubDir({ ...dep(), ...st("success", { environment_url: "https://a.test" }) });
    r = ship(repo, [...base, "--env", "prod&x=1"], { env: { GH_STUB_DIR: dir } });
    add("deployed/from-github refuses an env that needs encoding before any gh call", "exit 1 and no gh call", r.status === 1 && !existsSync(join(dir, "calls.log")), r.stdout + r.stderr);
    r = ship(repo, [...base, "--url", "https://a.test"], { env: { GH_STUB_DIR: dir } });
    add("deployed/from-github with --url is refused", "exit 1", r.status === 1 && /from-github/.test(r.stderr), r.stdout + r.stderr);

    dir = stubDir({ ...dep(), ...st("in_progress") });
    r = ship(repo, base, { env: { GH_STUB_DIR: dir } });
    add("deployed/from-github with an unfinished deploy is refused", "exit 1", r.status === 1 && /in_progress/.test(r.stderr), r.stdout + r.stderr);
    dir = stubDir({ "deployments.json": [], "statuses.json": [] });
    r = ship(repo, base, { env: { GH_STUB_DIR: dir } });
    add("deployed/from-github with no deployment is refused", "exit 1", r.status === 1 && /no deployment/.test(r.stderr), r.stdout + r.stderr);
    dir = stubDir({ ...dep("zz"), ...st("success") });
    r = ship(repo, base, { env: { GH_STUB_DIR: dir } });
    add("deployed/from-github with a bad sha is refused", "exit 1", r.status === 1, r.stdout + r.stderr);
    r = ship(repo, base, { env: { GH_STUB_DIR: dir, GH_STUB_FAIL: "1" } });
    add("deployed/a gh failure is reported and nothing is written", "exit 1", r.status === 1 && /gh exited/.test(r.stderr), r.stdout + r.stderr);
  }

  // R49: the mieruka drop follows the same rule as the preflight record.
  function mierukaCases() {
    let repo = mkrepo({ "CLAUDE.md": SHIP_BLOCK, ".gitignore": ".mieruka/\n" });
    mkdirSync(join(repo, ".mieruka"), { recursive: true });
    let r = ship(repo, ["deployed", "--target", "web", "--env", "production"]);
    const p = r.json?.mieruka;
    add("deployed/an ignored .mieruka copy is written", "the same manifest", r.status === 0 && p === `.mieruka/evidence/${r.json.evidence_key}/evidence.json`
      && readFileSync(join(repo, p), "utf8") === readFileSync(join(repo, r.json.path), "utf8"), r.stdout + r.stderr);
    repo = mkrepo();
    mkdirSync(join(repo, ".mieruka"), { recursive: true });
    r = ship(repo, ["deployed", "--target", "web", "--env", "production"]);
    add("deployed/.mieruka that is not ignored gets no copy and a reason", "mieruka null and why", r.status === 0 && r.json.mieruka === null && /not ignored/.test(r.json.why), r.stdout + r.stderr);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runShipDeployCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} ship deploy cases passed`);
  process.exit(bad ? 1 : 0);
}
