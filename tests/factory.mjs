#!/usr/bin/env node
// Behaviour test for plugins/pro-ai-sdlc/scripts/factory.py, the host side of the software
// factory: which intent runs next, the caps and the lock, the host checks on a brief PR and a
// build PR, the record states and a whole run to a merge. Docker and gh are stubs in a temp dir
// (FACTORY_DOCKER and FACTORY_GH); the repos are disposable with a bare origin and
// GIT_CONFIG_GLOBAL=/dev/null so the real user config never leaks in. A pull request is a
// commit pushed to refs/pull/<n>/head on the bare origin plus a JSON file the gh stub reads.
// No Docker, network or model is used.
//
//   node tests/factory.mjs
//
// Also exported as runFactoryCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync, realpathSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FACTORY = join(ROOT, "plugins", "pro-ai-sdlc", "scripts", "factory.py");
const CLASSIFY = join(ROOT, "plugins", "pro-ship", "scripts", "risk-classify.py");
const GENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const FOLDER = "2026-01-02-greeting";
const DIR = `intent/${FOLDER}`;

const DOCKER_STUB = `#!/bin/sh
echo "$@" >> "$STUB/docker.log"
echo "token=$GH_TOKEN" >> "$STUB/docker.env"
case "$1" in image) [ -f "$STUB/no-image" ] && exit 1; exit 0 ;; build|kill) exit 0 ;; esac
phase=""; last=""
for a in "$@"; do phase=$last; last=$a; done
# the phase is the second to last argument
[ -f "$STUB/$phase.sleep" ] && exec sleep "$(cat "$STUB/$phase.sleep")"
# a container whose token pushes to the default branch
[ -f "$STUB/$phase.push" ] && git --git-dir="$(cat "$STUB/origin.txt")" update-ref refs/heads/main "$(cat "$STUB/$phase.push")"
[ -f "$STUB/$phase.out" ] && cat "$STUB/$phase.out"
[ -f "$STUB/$phase.rc" ] && exit "$(cat "$STUB/$phase.rc")"
exit 0
`;

const GH_STUB = `#!/usr/bin/env python3
import json, os, subprocess, sys
stub = os.environ["STUB"]
a = sys.argv[1:]
with open(os.path.join(stub, "gh.log"), "a") as f:
    f.write(" ".join(a) + " | GH_TOKEN=" + os.environ.get("GH_TOKEN", "") + "\\n")
def rd(name, default=None):
    p = os.path.join(stub, name)
    return open(p).read() if os.path.exists(p) else default
if a[:2] == ["auth", "token"]:
    print("broad-token-xyz")
elif a[:2] == ["api", "user"]:
    print(rd("user.json", '{"login":"factory-bot"}'))
elif a[0] == "api" and "/rules/branches/" in a[1]:
    print(rd("rules.json", '[{"type":"pull_request"}]'))
elif a[0] == "api" and a[1].endswith("/protection"):
    out = rd("protection.json")
    if out is None:
        sys.stderr.write("Branch not protected (HTTP 404)\\n")
        sys.exit(1)
    print(out)
elif a[:2] == ["pr", "view"]:
    n = a[2]
    d = json.loads(rd("pr-%s.json" % n))
    roll = rd("checks-%s.json" % n, '[{"name":"ci","status":"COMPLETED","conclusion":"SUCCESS"}]')
    d["statusCheckRollup"] = [] if roll == "none" else json.loads(roll)
    if os.path.exists(os.path.join(stub, "merged-%s" % n)):
        d["state"] = "MERGED"
        d["mergeCommit"] = {"oid": rd("merged-%s" % n).strip()}
    print(json.dumps(d))
elif a[:2] == ["pr", "ready"]:
    d = json.loads(rd("pr-%s.json" % a[2]))
    d["isDraft"] = False
    open(os.path.join(stub, "pr-%s.json" % a[2]), "w").write(json.dumps(d))
elif a[:2] == ["pr", "merge"]:
    n = a[2]
    if os.path.exists(os.path.join(stub, "merge-fail")):
        sys.stderr.write("merge refused\\n")
        sys.exit(1)
    origin = rd("origin.txt").strip()
    sha = json.loads(rd("pr-%s.json" % n))["headRefOid"]
    subprocess.run(["git", "--git-dir=" + origin, "update-ref", "refs/heads/main", sha], check=True)
    open(os.path.join(stub, "merged-%s" % n), "w").write(sha + "\\n")
else:
    sys.stderr.write("gh stub: unhandled " + " ".join(a) + "\\n")
    sys.exit(9)
`;

function git(cwd, ...args) {
  return spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: GENV });
}
function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

const REVIEW = "# Review\n\n## Roles\n\n```yaml\nroles:\n  product_owner: [t]\n  engineer: [t]\n  lead: [t]\n  policy_owner: [t]\n  platform_owner: [t]\n```\n";
const intentText = ({ status = "accepted", risk = "low", author = "t", source = "idea", level = "", body = "Fix the greeting typo on the home page." } = {}) =>
  `---\nsource: ${source}\nkind: bug\nstatus: ${status}\nrisk: ${risk}\n${level ? `level: ${level}\n` : ""}created: 2026-01-02T10:00:00-0500\nauthor: ${author}\n---\n\n# Intent: greeting\n\n## Problem\n\n${body}\n`;
const SPEC = (concerns = "") => `---\nstatus: accepted\n---\n\n# Spec\n\n## Flagged concerns\n\n| # | Concern | Policy or owner | Resolution |\n|---|---|---|---|\n${concerns}\n## Open questions\n\nNone.\n`;
const PLAN = ({ status = "approved", stop = "none", approver = "factory (unattended level 1)" } = {}) =>
  `# Plan\n\nStatus: ${status}.\nApprover: ${approver}.\nStop-list categories: ${stop}.\n`;

// A checkout on main with a bare origin. `intents` maps a folder to its files; each folder is its own commit.
function repoWithOrigin(sandbox, name, intents, extra = {}) {
  const origin = join(sandbox, `${name}-origin.git`);
  const repo = join(sandbox, name);
  git(sandbox, "init", "-q", "--bare", "-b", "main", origin);
  mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  write(join(repo, "REVIEW.md"), REVIEW);
  write(join(repo, "README.md"), "demo\n");
  for (const [p, t] of Object.entries(extra)) write(join(repo, p), t);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  for (const [folder, files] of Object.entries(intents)) {
    for (const [p, t] of Object.entries(files.files ?? files)) write(join(repo, "intent", folder, p), t);
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", files.message ?? `intent: ${folder}`);
  }
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-q", "-u", "origin", "main");
  return { repo, origin };
}

// Stubs and the env every factory.py call gets.
function makeStub(sandbox, name, origin) {
  const dir = join(sandbox, `${name}-stub`);
  mkdirSync(dir);
  write(join(dir, "docker"), DOCKER_STUB);
  write(join(dir, "gh"), GH_STUB);
  chmodSync(join(dir, "docker"), 0o755);
  chmodSync(join(dir, "gh"), 0o755);
  write(join(dir, "origin.txt"), origin);
  const cache = join(dir, "cache");
  mkdirSync(cache);
  return {
    dir,
    env: { ...GENV, STUB: dir, FACTORY_DOCKER: join(dir, "docker"), FACTORY_GH: join(dir, "gh"), FACTORY_CHECKS_WAIT: "0", FACTORY_CHECKS_POLL: "0",
      FACTORY_GH_TOKEN: "scoped-token-abc", CLAUDE_CODE_PLUGIN_CACHE_DIR: cache, ANTHROPIC_API_KEY: "k" },
    read: (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : ""),
    put: (f, t) => write(join(dir, f), t),
  };
}

// A PR: commits on top of `parent` pushed to refs/pull/<n>/head, and the JSON the gh stub serves.
function makePr(sandbox, fx, stub, n, commits, parent = "origin/main", opts = {}) {
  const phase = opts.phase ?? (commits.some((c) => Object.keys(c.files).some((p) => p.startsWith("src/") || p.startsWith("tests/") || p.endsWith(".json") || p.endsWith(".js") || p.endsWith(".toml") || p.endsWith(".ini") || p.endsWith(".cfg"))) ? "build" : "brief");
  const clone = join(sandbox, `prclone-${fx.repo.split("/").pop()}-${n}`);
  git(sandbox, "clone", "-q", fx.origin, clone);
  git(clone, "checkout", "-q", "--detach", parent.startsWith("origin/") ? parent : parent);
  for (const c of commits) {
    for (const [p, t] of Object.entries(c.files)) {
      if (t === null) git(clone, "rm", "-q", "-f", p);
      else write(join(clone, p), t);
    }
    git(clone, "add", "-A");
    git(clone, "commit", "-q", "-m", (c.msg ?? "change") + (c.raw ? "" : `\n\nFactory-Run: ${phase} ${FOLDER}`));
  }
  const sha = git(clone, "rev-parse", "HEAD").stdout.trim();
  git(clone, "push", "-q", "--force", "origin", `HEAD:refs/pull/${n}/head`);
  const slug = FOLDER.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  stub.put(`pr-${n}.json`, JSON.stringify({ state: "OPEN", baseRefName: "main", headRefOid: sha, isCrossRepository: false,
    headRefName: opts.branch ?? (phase === "brief" ? `${slug}-brief` : slug), isDraft: opts.draft ?? false, author: { login: opts.author ?? "factory-bot" } }));
  return sha;
}

const briefFiles = (o = {}) => ({ [`${DIR}/spec.md`]: o.spec ?? SPEC(), [`${DIR}/plan.md`]: o.plan ?? PLAN(), ...(o.extra ?? {}) });
const buildFiles = () => ({ "src/greet.js": "export const greet = () => 'hello';\n", "tests/greet.test.js": "import { greet } from '../src/greet.js';\nif (greet() !== 'hello') throw new Error('bad');\n" });

export function runFactoryCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "factory-sandbox-")));
  const add = (id, expect, ok, why = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : why });
  const py = (args, cwd, env) => {
    const r = spawnSync("python3", ["-I", FACTORY, ...args], { cwd, encoding: "utf8", timeout: 120_000, env });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  };
  const brief = (r) => `status ${r.status} stdout ${r.stdout.slice(0, 300)} stderr ${r.stderr.slice(0, 300)}`;
  const jsonOf = (r) => { try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch { return null; } };
  const record = (fx, folder = FOLDER) => {
    const p = join(fx.repo, ".pro-dev", "factory", `factory-${folder}.json`);
    if (!existsSync(p)) return null;
    const j = JSON.parse(readFileSync(p, "utf8"));
    return { ...j, detail: JSON.parse(j.detail_json) };
  };
  try {
    // ── next ──
    {
      const fx = repoWithOrigin(sandbox, "next1", {
        "2026-01-01-has-spec": { "intent.md": intentText(), "spec.md": SPEC() },
        "2026-01-02-bad_Name": { "intent.md": intentText() },
        "2026-01-03-medium": { "intent.md": intentText({ risk: "medium" }) },
        "2026-01-04-draft": { "intent.md": intentText({ status: "draft" }) },
        "2026-01-05-fed": { "intent.md": intentText(), message: "intent: accepted by the factory\n\nFactory-Run: 2026-01-04-x" },
        "2026-01-06-good": { "intent.md": intentText() },
        "2026-01-07-later": { "intent.md": intentText() },
      });
      const stub = makeStub(sandbox, "next1", fx.origin);
      let r = py(["next", "--repo", fx.repo], fx.repo, stub.env);
      add("n1 next picks the oldest accepted level 1 intent without a spec and skips the rest", "intent/2026-01-06-good",
        r.status === 0 && r.stdout.trim() === "intent/2026-01-06-good", brief(r));
      mkdirSync(join(fx.repo, ".pro-dev", "factory"), { recursive: true });
      writeFileSync(join(fx.repo, ".pro-dev", "factory", "factory-2026-01-06-good.json"), JSON.stringify({ detail_json: "{}" }));
      r = py(["next", "--repo", fx.repo], fx.repo, stub.env);
      add("n2 an intent with a factory record is skipped", "intent/2026-01-07-later", r.stdout.trim() === "intent/2026-01-07-later", brief(r));
      writeFileSync(join(fx.repo, ".pro-dev", "factory", "daily.json"), JSON.stringify({ date: new Date().toLocaleDateString("sv"), runs: 10, cost_usd: 0 }));
      r = py(["next", "--repo", fx.repo], fx.repo, stub.env);
      add("n3 the daily run cap stops next", "nothing", r.status === 0 && r.stdout.trim() === "", brief(r));
      writeFileSync(join(fx.repo, ".pro-dev", "factory", "daily.json"), JSON.stringify({ date: new Date().toLocaleDateString("sv"), runs: 1, cost_usd: 40 }));
      r = py(["next", "--repo", fx.repo], fx.repo, stub.env);
      add("n4 the daily dollar cap stops next", "nothing", r.stdout.trim() === "", brief(r));
      writeFileSync(join(fx.repo, ".pro-dev", "factory", "daily.json"), JSON.stringify({ date: "2020-01-01", runs: 99, cost_usd: 999 }));
      r = py(["next", "--repo", fx.repo], fx.repo, stub.env);
      add("n5 yesterday's counters do not count", "intent/2026-01-07-later", r.stdout.trim() === "intent/2026-01-07-later", brief(r));

      const only = repoWithOrigin(sandbox, "next2", { "2026-01-05-fed": { "intent.md": intentText(), message: "intent: accepted\n\nFactory-Run: 2026-01-04-x" } });
      r = py(["next", "--repo", only.repo], only.repo, stub.env);
      add("n6 an intent accepted in a Factory-Run commit is never picked", "nothing", r.status === 0 && r.stdout.trim() === "", brief(r));
      r = py(["run", "intent/2026-01-05-fed", "--repo", only.repo], only.repo, stub.env);
      add("n7 run refuses it by name", "refused", r.status === 1 && /Factory-Run/.test(r.stderr), brief(r));
      r = py(["run", "intent/2026-01-02-bad_Name", "--repo", fx.repo], fx.repo, stub.env);
      add("n8 run refuses a folder name outside the pattern", "refused", r.status === 1 && /must match/.test(r.stderr), brief(r));
      r = py(["run", "intent/2026-01-03-medium", "--repo", fx.repo], fx.repo, stub.env);
      add("n9 run refuses a level 2 intent", "refused", r.status === 1 && /level is not 1/.test(r.stderr), brief(r));
    }

    // ── record ──
    {
      const fx = repoWithOrigin(sandbox, "rec", { [FOLDER]: { "intent.md": intentText() } });
      const stub = makeStub(sandbox, "rec", fx.origin);
      let r = py(["record", DIR, "--repo", fx.repo, "--state", "queued"], fx.repo, stub.env);
      let rec = record(fx);
      add("r1 queued is info with the keys docs/loop-records.md names", "info", r.status === 0 && rec?.status === "info" && rec.kind === "doc" && rec.artifact_kind === "factory-run"
        && rec.evidence_key === `factory-${FOLDER}` && rec.artifact_key === FOLDER && typeof rec.detail_json === "string" && rec.detail.level_at_intake === 1 && !!rec.detail.started, brief(r));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "build", "--pr", "https://github.com/o/r/pull/9", "--cost", "1.5"], fx.repo, stub.env);
      rec = record(fx);
      add("r2 build keeps started, sets build_pr and cost", "info", rec?.status === "info" && rec.detail.build_pr === "https://github.com/o/r/pull/9" && rec.detail.cost_usd === 1.5 && rec.detail.state === "build", brief(r));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "merged", "--sha", "abcdef1234567890", "--unread-lines", "42"], fx.repo, stub.env);
      rec = record(fx);
      add("r3 merged is pass and says deploy is yours with the unread lines", "pass", rec?.status === "pass" && rec.summary === "level 1: merged abcdef123456, deploy is yours, unread diff: 42 lines", brief(r) + (rec?.summary ?? ""));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "stopped", "--reason", "tier medium", "--level-now", "2"], fx.repo, stub.env);
      rec = record(fx);
      add("r4 stopped is partial with the level raised", "partial", rec?.status === "partial" && rec.detail.level_now === 2 && /raised to 2 \(tier medium\)/.test(rec.summary), brief(r));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "error", "--reason", "docker died"], fx.repo, stub.env);
      rec = record(fx);
      add("r5 error is fail", "fail", rec?.status === "fail" && /docker died/.test(rec.summary), brief(r));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "bogus"], fx.repo, stub.env);
      add("r6 an unknown state is a usage error", "64", r.status === 64, brief(r));
      r = py(["record", "intent/2026-01-02-Bad", "--repo", fx.repo, "--state", "queued"], fx.repo, stub.env);
      add("r7 a bad folder name is refused", "refused", r.status === 1, brief(r));
    }

    // ── verify brief ──
    {
      const fx = repoWithOrigin(sandbox, "vb", { [FOLDER]: { "intent.md": intentText() } });
      const stub = makeStub(sandbox, "vb", fx.origin);
      const check = (id, expect, n, files, want) => {
        makePr(sandbox, fx, stub, n, [{ files }]);
        const r = py(["verify", "brief", DIR, "--pr", String(n), "--repo", fx.repo, "--json"], fx.repo, stub.env);
        const j = jsonOf(r);
        add(id, expect, want === "pass" ? r.status === 0 && j?.result === "pass" : r.status === 3 && j?.level === 2 && want.test((j?.reasons ?? []).join(";")), brief(r));
      };
      check("b1 a brief PR of exactly spec and plan passes", "pass", 1, briefFiles(), "pass");
      check("b2 a third file fails", "level 2", 2, briefFiles({ extra: { "REVIEW.md": REVIEW + "\nmore\n" } }), /exactly/);
      check("b3 a missing plan fails", "level 2", 3, { [`${DIR}/spec.md`]: SPEC() }, /exactly/);
      check("b4 a plan that is not approved fails", "level 2", 4, briefFiles({ plan: PLAN({ status: "draft" }) }), /not Status: approved/);
      check("b5 a stop-list category fails", "level 2", 5, briefFiles({ plan: PLAN({ stop: "secrets" }) }), /Stop-list categories: none/);
      check("b6 an approver that is not the factory fails", "level 2", 6, briefFiles({ plan: PLAN({ approver: "the maintainer" }) }), /Approver/);
      check("b7 a flagged concern row fails", "level 2", 7, briefFiles({ spec: SPEC("| 1 | Writes a token | security | open |\n") }), /flagged concern/);
      check("b8 a spec with no Flagged concerns section fails", "level 2", 8, briefFiles({ spec: "# Spec\n\n## Summary\n\nx\n" }), /Flagged concerns section/);
      check("b9 a second Approver line fails", "level 2", 9, briefFiles({ plan: PLAN() + "Approver: the maintainer.\n" }), /exactly one Approver: line \(found 2\)/);
      check("b10 a second Status line fails", "level 2", 10, briefFiles({ plan: PLAN() + "Status: draft.\n" }), /exactly one Status: line/);
      check("b11 a second Stop-list line fails", "level 2", 11, briefFiles({ plan: PLAN() + "Stop-list categories: none.\n" }), /exactly one Stop-list categories: line/);
      const specWith = (body) => `# Spec\n\n## Flagged concerns\n\n${body}\n\n## Open questions\n\nNone.\n`;
      check("b12 a bullet under Flagged concerns is a concern", "level 2", 12, briefFiles({ spec: specWith("- the copy may need translating") }), /flagged concern/);
      check("b13 prose under Flagged concerns is a concern", "level 2", 13, briefFiles({ spec: specWith("Possibly touches the home page copy.") }), /flagged concern/);
      check("b14 None found passes", "pass", 14, briefFiles({ spec: specWith("None found.") }), "pass");
      check("b15 an empty Flagged concerns section fails", "level 2", 15, briefFiles({ spec: specWith("") }), /neither None found/);
      check("b16 None found with sources and the ADR line passes", "pass", 16,
        briefFiles({ spec: specWith("None found. Sources read: `intent.md`, `REVIEW.md`.\n\nADR needed: no, a one-line fix.\n\n| # | Concern | Policy or owner | Resolution |\n|---|---|---|---|") }), "pass");
      const bind = (id, n, opts, re, files = briefFiles(), msg) => {
        makePr(sandbox, fx, stub, n, [{ files, ...(msg ? { msg, raw: true } : {}) }], "origin/main", opts);
        const r = py(["verify", "brief", DIR, "--pr", String(n), "--repo", fx.repo, "--json"], fx.repo, stub.env);
        add(id, "raise", r.status === 3 && re.test((jsonOf(r)?.reasons ?? []).join(";")), brief(r));
      };
      bind("b16 a PR from another branch name is refused", 16, { branch: "other" }, /head branch is 'other', not 'greeting-brief'/);
      bind("b17 a draft brief PR is refused", 17, { draft: true }, /brief PR is a draft/);
      bind("b18 a PR by another user is refused", 18, { author: "mallory" }, /author is 'mallory'/);
      bind("b19 a commit with no Factory-Run trailer is refused", 19, {}, /without a Factory-Run: brief/, briefFiles(), "brief: greeting");
    }

    // ── verify build ──
    {
      const fx = repoWithOrigin(sandbox, "vbd", { [FOLDER]: { "intent.md": intentText(), "spec.md": SPEC(), "plan.md": PLAN() } },
        { "package.json": JSON.stringify({ name: "demo", scripts: { test: "node tests/greet.test.js" } }, null, 2) + "\n", "tests/old.test.js": "// old\n" });
      const stub = makeStub(sandbox, "vbd", fx.origin);
      let n = 0;
      const check = (id, expect, commits, want, env = stub.env, setup) => {
        n += 1;
        makePr(sandbox, fx, stub, n, commits);
        if (setup) setup(n);
        const r = py(["verify", "build", DIR, "--pr", String(n), "--repo", fx.repo, "--json"], fx.repo, env);
        const j = jsonOf(r);
        const ok = want === "pass" ? r.status === 0 && j?.result === "pass" && j.tier === "low"
          : r.status === 3 && j?.level === want.level && want.re.test((j?.reasons ?? []).join(";"));
        add(id, expect, ok, brief(r));
        return j;
      };
      const good = [{ files: buildFiles(), msg: "build: greeting" }];
      const j = check("v1 a clean build PR passes at low and counts the unread lines", "pass", good, "pass");
      add("v2 the unread diff is the changed lines", "positive", (j?.unread_lines ?? 0) >= 3, JSON.stringify(j));
      check("v3 an edit to its own intent folder is allowed", "pass", [{ files: { ...buildFiles(), [`${DIR}/plan.md`]: PLAN() + "\nDone.\n" } }], "pass");
      check("v4 REVIEW.md in the diff is a policy path", "level 3", [{ files: { ...buildFiles(), "REVIEW.md": REVIEW + "\nx\n" } }], { level: 3, re: /policy paths changed: REVIEW\.md/ });
      check("v5 a nested CLAUDE.md is a policy path", "level 3", [{ files: { ...buildFiles(), "docs/CLAUDE.md": "x\n" } }], { level: 3, re: /policy paths/ });
      check("v6 .claude and .github are policy paths", "level 3", [{ files: { ...buildFiles(), ".claude/settings.json": "{}\n", ".github/workflows/x.yml": "on: push\n" } }], { level: 3, re: /\.claude\/settings\.json/ });
      check("v7 another intent folder is a policy path", "level 3", [{ files: { ...buildFiles(), "intent/2026-02-02-other/intent.md": "x\n" } }], { level: 3, re: /other\/intent\.md/ });
      check("v8 a test edited after the commit that added it", "level 2", [
        { files: buildFiles(), msg: "add test" },
        { files: { "tests/greet.test.js": "// weakened\n" }, msg: "edit test" },
      ], { level: 2, re: /changed after the commit that added it: tests\/greet\.test\.js/ });
      check("v9 a changed package.json test script", "level 2", [{ files: { ...buildFiles(), "package.json": JSON.stringify({ name: "demo", scripts: { test: "true" } }, null, 2) + "\n" } }], { level: 2, re: /test config changed: package\.json/ });
      check("v10 a jest config file", "level 2", [{ files: { ...buildFiles(), "jest.config.js": "module.exports = {};\n" } }], { level: 2, re: /test config changed/ });
      check("v11 a floor-allow line in a commit message", "level 2", [{ files: buildFiles(), msg: "build\n\nfloor-allow: risk tier" }], { level: 2, re: /floor-allow/ });
      check("v12 a classifier tier above low", "level 3", [{ files: { ...buildFiles(), "src/auth/login.js": "export const login = () => 1;\n" } }], { level: 3, re: /risk tier high/ });
      check("v13 failing PR checks", "level 2", good, { level: 2, re: /checks failed: ci/ }, stub.env, (k) => stub.put(`checks-${k}.json`, '[{"name":"ci","status":"COMPLETED","conclusion":"FAILURE"}]'));
      check("v14 pending PR checks", "level 2", good, { level: 2, re: /still pending/ }, stub.env, (k) => stub.put(`checks-${k}.json`, '[{"name":"ci","status":"IN_PROGRESS","conclusion":""}]'));
      stub.put("verify.rc", "1");
      check("v15 no checks and a failing verify command in a fresh container", "level 2", good, { level: 2, re: /verify command failed/ }, stub.env, (k) => stub.put(`checks-${k}.json`, "none"));
      stub.put("verify.rc", "0");
      check("v16 no checks and a passing verify command", "pass", good, "pass", stub.env, (k) => stub.put(`checks-${k}.json`, "none"));
      check("v17 a PR head that moved after the fetch", "level 2", good, { level: 2, re: /head moved/ }, stub.env, (k) => {
        const d = JSON.parse(stub.read(`pr-${k}.json`));
        d.headRefOid = "0".repeat(40);
        stub.put(`pr-${k}.json`, JSON.stringify(d));
      });
      for (const [id, file] of [["v20", "vite.config.ts"], ["v21", "vitest.config.mts"], ["v22", "playwright.config.ts"], ["v23", "pytest.ini"], ["v24", "tox.ini"]]) {
        check(`${id} ${file} counts as test config`, "level 2", [{ files: { ...buildFiles(), [file]: "x\n" } }], { level: 2, re: new RegExp(`test config changed: ${file.replace(".", "\\.")}`) });
      }
      const pkg = (o) => JSON.stringify({ name: "demo", ...o }, null, 2) + "\n";
      check("v25 any new package.json scripts key counts", "level 2", [{ files: { ...buildFiles(), "package.json": pkg({ scripts: { test: "node tests/greet.test.js", lint: "true" } }) } }], { level: 2, re: /test config changed: package\.json/ });
      check("v26 a package.json jest field counts", "level 2", [{ files: { ...buildFiles(), "package.json": pkg({ scripts: { test: "node tests/greet.test.js" }, jest: { testMatch: [] } }) } }], { level: 2, re: /test config changed: package\.json/ });
      check("v27 a pytest section in setup.cfg counts", "level 2", [{ files: { ...buildFiles(), "setup.cfg": "[tool:pytest]\naddopts = -x\n" } }], { level: 2, re: /test config changed: setup\.cfg/ });
      check("v28 a pytest section in pyproject.toml counts", "level 2", [{ files: { ...buildFiles(), "pyproject.toml": "[tool.pytest.ini_options]\naddopts = \"-x\"\n" } }], { level: 2, re: /test config changed: pyproject\.toml/ });
      check("v29 a deleted test is a floor-guard hit", "level 2", [{ files: { ...buildFiles(), "tests/old.test.js": null } }], { level: 2, re: /floor-guard found/ });
      check("v30 floor-guard missing stops", "level 2", good, { level: 2, re: /floor-guard unavailable/ }, { ...stub.env, FACTORY_FLOOR_GUARD: join(sandbox, "nope.py") });
      const ob = check("v31 a draft build PR passes the checks and says it is a draft", "pass", good, "pass", stub.env, (k) => {
        const d = JSON.parse(stub.read(`pr-${k}.json`)); d.isDraft = true; stub.put(`pr-${k}.json`, JSON.stringify(d));
      });
      add("v32 the result carries draft so the host can mark it ready", "draft", ob?.draft === true, JSON.stringify(ob));
      check("v33 a build PR from a branch that is not the slug", "level 3", good, { level: 3, re: /head branch is 'other', not 'greeting'/ }, stub.env, (k) => {
        const d = JSON.parse(stub.read(`pr-${k}.json`)); d.headRefName = "other"; stub.put(`pr-${k}.json`, JSON.stringify(d));
      });
      check("v34 a build commit without the trailer", "level 2", [{ files: buildFiles(), msg: "build: greeting", raw: true }], { level: 2, re: /without a Factory-Run: build/ });
      check("v35 skipped and neutral check runs pass", "pass", good, "pass", stub.env, (k) => stub.put(`checks-${k}.json`, '[{"name":"a","status":"COMPLETED","conclusion":"SKIPPED"},{"name":"b","status":"COMPLETED","conclusion":"NEUTRAL"}]'));
      check("v36 a failing commit status", "level 2", good, { level: 2, re: /checks failed: ci\/x/ }, stub.env, (k) => stub.put(`checks-${k}.json`, '[{"context":"ci/x","state":"FAILURE"}]'));
      // surface-unavailable: a classifier copy with no pro-security beside it and an empty plugin cache
      const lone = join(sandbox, "lone", "pro-ship", "scripts");
      mkdirSync(lone, { recursive: true });
      copyFileSync(CLASSIFY, join(lone, "risk-classify.py"));
      check("v18 security surface unavailable stops the merge", "level 2", good, { level: 2, re: /surface-unavailable: security_surface/ },
        { ...stub.env, FACTORY_RISK_CLASSIFY: join(lone, "risk-classify.py") });
      // bare gh failure: a PR the stub does not know
      const r = py(["verify", "build", DIR, "--pr", "999", "--repo", fx.repo], fx.repo, stub.env);
      add("v19 a PR that cannot be fetched is could-not-run, never a pass", "exit 2", r.status === 2, brief(r));
    }

    // ── no CI is decided from the tip, never from "no checks reported" ──
    {
      const mk = (name, workflow) => {
        const fx = repoWithOrigin(sandbox, name, { [FOLDER]: { "intent.md": intentText(), "spec.md": SPEC(), "plan.md": PLAN() } },
          { "package.json": JSON.stringify({ name: "demo", scripts: { test: "true" } }, null, 2) + "\n", ...(workflow ? { ".github/workflows/ci.yml": workflow } : {}) });
        return { fx, stub: makeStub(sandbox, name, fx.origin) };
      };
      let k = 0;
      const verifyBuild = ({ fx, stub }, rollup) => {
        k += 1;
        const sha = makePr(sandbox, fx, stub, k, [{ files: buildFiles() }]);
        if (rollup) stub.put(`checks-${k}.json`, rollup);
        const r = py(["verify", "build", DIR, "--pr", String(k), "--repo", fx.repo, "--json"], fx.repo, stub.env);
        return { r, j: jsonOf(r), sha };
      };
      const withCi = mk("ci1", "name: ci\non:\n  pull_request:\n    branches: [main]\njobs: {}\n");
      let o = verifyBuild(withCi, "none");
      add("c1 a pull_request workflow and no checks reported is a stop, not a pass", "level 2", o.r.status === 3 && /no checks were reported within/.test((o.j?.reasons ?? []).join()) && !existsSync(join(withCi.stub.dir, "docker.log")), brief(o.r));
      o = verifyBuild(withCi, '[{"name":"ci","status":"IN_PROGRESS","conclusion":""}]');
      add("c2 checks that never finish are a stop", "level 2", o.r.status === 3 && /did not finish in time, still pending: ci/.test((o.j?.reasons ?? []).join()), brief(o.r));
      o = verifyBuild(withCi);
      add("c3 a pull_request workflow with finished green checks passes", "pass", o.r.status === 0 && o.j?.result === "pass", brief(o.r));
      const pushOnly = mk("ci2", "name: ci\non: [push]\njobs: {}\n");
      pushOnly.stub.put("verify.rc", "0");
      o = verifyBuild(pushOnly, "none");
      const dl = pushOnly.stub.read("docker.log");
      add("c4 a workflow that only runs on push is no CI: the verify container runs on the verified sha", "container", o.r.status === 0 && o.j?.result === "pass" && dl.includes(`FACTORY_HEAD=${o.sha}`) && /--name factory-.*-verify-\d+/.test(dl), brief(o.r) + dl);
      const inline = mk("ci3", "name: ci\non: [push, pull_request_target]\njobs: {}\n");
      o = verifyBuild(inline, "none");
      add("c5 on: [push, pull_request_target] counts as CI", "level 2", o.r.status === 3 && /no checks were reported/.test((o.j?.reasons ?? []).join()), brief(o.r));
      const review = mk("ci4", "name: ci\non:\n  pull_request_review:\njobs:\n  a:\n    if: github.event.pull_request.number\n    runs-on: x\n");
      review.stub.put("verify.rc", "0");
      o = verifyBuild(review, "none");
      add("c6 pull_request_review and event fields are not a pull_request trigger", "container", o.r.status === 0 && review.stub.read("docker.log").includes("FACTORY_HEAD="), brief(o.r));
    }

    // ── session.sh: the mode file and the PR found by branch name ──
    {
      const fx = repoWithOrigin(sandbox, "sh", { [FOLDER]: { "intent.md": intentText() } });
      const bin = join(sandbox, "sh-bin");
      mkdirSync(bin);
      write(join(bin, "claude"), "#!/bin/sh\nexit 0\n");
      write(join(bin, "gh"), '#!/bin/sh\nh=""\nwhile [ $# -gt 0 ]; do [ "$1" = --head ] && h=$2; shift; done\n[ -f "$STUB/head-$h" ] && cat "$STUB/head-$h"\nexit 0\n');
      chmodSync(join(bin, "claude"), 0o755);
      chmodSync(join(bin, "gh"), 0o755);
      const stubDir = join(sandbox, "sh-stub");
      mkdirSync(stubDir);
      write(join(stubDir, "head-greeting-brief"), "7\n");
      const SESSION = join(ROOT, "plugins", "pro-ai-sdlc", "factory", "session.sh");
      const runSh = (phase) => {
        const home = join(sandbox, `sh-home-${phase}`);
        mkdirSync(home, { recursive: true });
        const env = { PATH: `${bin}:${process.env.PATH}`, HOME: home, STUB: stubDir, FACTORY_WORK: join(sandbox, `sh-work-${phase}`), GH_TOKEN: "t" };
        const r = spawnSync("sh", [SESSION, fx.origin, "main", phase, DIR], { encoding: "utf8", env });
        return { ...r, home };
      };
      let r = runSh("brief");
      add("s1 session.sh finds the brief PR by its branch name", "pr 7", r.status === 0 && /^factory: pr 7$/m.test(r.stdout), `${r.status} ${r.stdout} ${r.stderr}`);
      add("s2 session.sh writes enforce into the container's own hooks mode file", "enforce", existsSync(join(r.home, ".claude", "hooks", "mode")) && readFileSync(join(r.home, ".claude", "hooks", "mode"), "utf8").trim() === "enforce", r.stderr);
      r = runSh("build");
      add("s3 the build phase looks for the slug branch and never falls back to another PR", "no pr", r.status === 1 && !/factory: pr/.test(r.stdout) && /branch greeting/.test(r.stderr), `${r.status} ${r.stdout} ${r.stderr}`);
    }

    // ── run, end to end ──
    const scenario = (name, { token = true, broad = false, extra = {} } = {}) => {
      const fx = repoWithOrigin(sandbox, name, { [FOLDER]: { "intent.md": intentText() } },
        { "package.json": JSON.stringify({ name: "demo", scripts: { test: "true" } }, null, 2) + "\n" });
      const stub = makeStub(sandbox, name, fx.origin);
      const env = { ...stub.env, ...extra };
      if (!token) delete env.FACTORY_GH_TOKEN;
      const b = makePr(sandbox, fx, stub, 1, [{ files: briefFiles() }]);
      const d = makePr(sandbox, fx, stub, 2, [{ files: buildFiles() }], b);
      stub.put("brief.out", '{"type":"result","total_cost_usd":0.5}\nfactory: pr 1\n');
      stub.put("build.out", '{"type":"result","total_cost_usd":1.25}\nfactory: pr 2\n');
      return { fx, stub, env, b, d, args: ["run", DIR, "--repo", fx.repo, ...(broad ? ["--allow-broad-token"] : [])] };
    };
    {
      const s = scenario("run1");
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      const merges = s.stub.read("gh.log").split("\n").filter((l) => l.startsWith("pr merge"));
      add("e1 a run reaches merged, prints each state change and ends with deploy is yours", "exit 0",
        r.status === 0 && /factory: brief pr 1\n/.test(r.stdout) && /factory: build pr 2\n/.test(r.stdout)
        && /factory: merged [0-9a-f]{12}, deploy is yours, unread diff: \d+ lines\n$/.test(r.stdout), brief(r));
      add("e2 the record is pass with the cost and both PRs", "pass", rec?.status === "pass" && rec.detail.state === "merged" && rec.detail.cost_usd === 1.75
        && rec.detail.brief_pr === 1 && rec.detail.build_pr === 2 && /deploy is yours/.test(rec.summary) && rec.detail.broad_token !== true, JSON.stringify(rec));
      add("e3 the host merged both PRs with --squash and --match-head-commit on the head it verified", "2 merges",
        merges.length === 2 && merges[0].includes(`--match-head-commit ${s.b}`) && merges[1].includes(`--match-head-commit ${s.d}`) && merges.every((m) => m.includes("--squash")), merges.join("\n"));
      add("e4 the merge carries a Factory-Run trailer", "trailer", merges.every((m) => m.includes(`Factory-Run: ${FOLDER}`)), merges.join("\n"));
      const dlog = s.stub.read("docker.log").split("\n").filter((l) => l.startsWith("run "));
      add("e5 docker ran two phases with enforce mode and the token by name only", "2 runs",
        dlog.length === 2 && dlog.every((l) => l.includes("CLAUDE_GUARD_MODE=enforce") && !l.includes("scoped-token-abc") && /-e GH_TOKEN /.test(l)) && /brief intent/.test(dlog[0]) && /build intent/.test(dlog[1]), dlog.join("\n"));
      add("e6 the container got the scoped token in its environment", "scoped", s.stub.read("docker.env").includes("token=scoped-token-abc"), s.stub.read("docker.env"));
      add("e7 the build budget is what the brief left", "6.50", /FACTORY_BUDGET_USD=8\.00/.test(dlog[0]) && /FACTORY_BUDGET_USD=7\.50/.test(dlog[1]), dlog.join("\n"));
      const daily = JSON.parse(readFileSync(join(s.fx.repo, ".pro-dev", "factory", "daily.json"), "utf8"));
      add("e8 the daily counters moved", "1 run", daily.runs === 1 && daily.cost_usd === 1.75, JSON.stringify(daily));
      add("e9 the lock is gone after the run", "no lock", !existsSync(join(s.fx.repo, ".pro-dev", "factory", `${FOLDER}.lock`)), "");
      const again = py(s.args, s.fx.repo, s.env);
      add("e10 running it again is refused: it has a record", "refused", again.status === 1 && /record|spec\.md/.test(again.stderr), brief(again));
    }
    {
      const s = scenario("run2", { token: false });
      let r = py(s.args, s.fx.repo, s.env);
      add("e11 no scoped token and no flag is refused", "refused", r.status === 1 && /FACTORY_GH_TOKEN/.test(r.stderr) && !existsSync(join(s.stub.dir, "docker.log")), brief(r));
      r = py([...s.args, "--allow-broad-token"], s.fx.repo, s.env);
      const rec = record(s.fx);
      add("e12 --allow-broad-token uses gh auth token and the record notes it", "broad", r.status === 0 && rec?.detail.broad_token === true && s.stub.read("docker.env").includes("token=broad-token-xyz"), brief(r));
    }
    {
      const s = scenario("run3");
      mkdirSync(join(s.fx.repo, ".pro-dev", "factory"), { recursive: true });
      writeFileSync(join(s.fx.repo, ".pro-dev", "factory", `${FOLDER}.lock`), String(process.pid));
      let r = py(s.args, s.fx.repo, s.env);
      add("e13 a live lock refuses the run", "refused", r.status === 1 && /already running/.test(r.stderr), brief(r));
      writeFileSync(join(s.fx.repo, ".pro-dev", "factory", `${FOLDER}.lock`), "999999999");
      writeFileSync(join(s.fx.repo, ".pro-dev", "factory", "daily.json"), JSON.stringify({ date: new Date().toLocaleDateString("sv"), runs: 10, cost_usd: 0 }));
      r = py(s.args, s.fx.repo, s.env);
      add("e14 the daily cap refuses the run", "refused", r.status === 1 && /daily cap/.test(r.stderr) && !existsSync(join(s.stub.dir, "docker.log")), brief(r));
      writeFileSync(join(s.fx.repo, ".pro-dev", "factory", "daily.json"), "{}");
      r = py(["run", DIR, "--repo", s.fx.repo, "--dry-run"], s.fx.repo, s.env);
      add("e15 a dry run changes nothing and starts nothing", "no docker", r.status === 0 && /dry run/.test(r.stdout) && !existsSync(join(s.stub.dir, "docker.log")) && record(s.fx) === null, brief(r));
      r = py(["run", "--next", "--repo", s.fx.repo, "--dry-run"], s.fx.repo, s.env);
      add("e16 run --next picks the intent", "dry run", r.status === 0 && r.stdout.includes(DIR), brief(r));
      r = py(["run", DIR, "--repo", s.fx.repo, "--max-runs", "3"], s.fx.repo, s.env);
      const daily = JSON.parse(readFileSync(join(s.fx.repo, ".pro-dev", "factory", "daily.json"), "utf8"));
      add("e17 a stale lock is taken over and --max-runs is saved", "ran", r.status === 0 && daily.max_runs === 3 && daily.runs === 1, brief(r) + JSON.stringify(daily));
    }
    {
      const s = scenario("run4", { extra: {} });
      makePr(sandbox, s.fx, s.stub, 1, [{ files: briefFiles({ extra: { "CLAUDE.md": "new rules\n" } }) }]);
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      const dlog = s.stub.read("docker.log").split("\n").filter((l) => l.startsWith("run "));
      add("e18 a brief that fails the host check stops at level 2 with a partial record and no merge", "stopped",
        r.status === 3 && /factory: stopped level 2 \(/.test(r.stdout) && rec?.status === "partial" && rec.detail.level_now === 2 && dlog.length === 1 && !s.stub.read("gh.log").includes("pr merge"), brief(r) + JSON.stringify(rec));
    }
    {
      const s = scenario("run5");
      makePr(sandbox, s.fx, s.stub, 2, [{ files: { ...buildFiles(), "src/auth/login.js": "export const x = 1;\n" } }], s.b);
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      const merges = s.stub.read("gh.log").split("\n").filter((l) => l.startsWith("pr merge"));
      add("e19 a build PR above low stops at level 3 after the brief merged, and is not merged", "stopped 3",
        r.status === 3 && /factory: stopped level 3 \(risk tier high/.test(r.stdout) && rec?.status === "partial" && rec.detail.level_now === 3 && merges.length === 1, brief(r));
    }
    {
      const s = scenario("run6");
      s.stub.put("brief.out", "nothing useful\n");
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      add("e20 a session that opens no PR is an error record", "error", r.status === 2 && rec?.status === "fail" && /no pull request/.test(rec.summary), brief(r));
    }
    {
      const s = scenario("run7");
      s.stub.put("brief.out", "boom\n");
      s.stub.put("brief.rc", "3");
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      add("e21 a container that exits non-zero with no PR is an error record", "error", r.status === 2 && rec?.status === "fail" && /exited 3/.test(rec.summary), brief(r));
    }
    {
      const s = scenario("run8");
      s.stub.put("merge-fail", "1");
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      add("e22 a refused merge is an error record", "error", r.status === 2 && rec?.status === "fail" && /refused/.test(rec.summary), brief(r));
    }
    {
      const s = scenario("run9");
      const r = py(["run", "--next", "--repo", s.fx.repo], s.fx.repo, s.env);
      add("e23 run --next runs the intent next picks", "merged", r.status === 0 && /deploy is yours/.test(r.stdout), brief(r));
    }

    {
      const s = scenario("run10");
      spawnSync("git", ["--git-dir=" + s.fx.origin, "update-ref", "refs/heads/main", s.b], { env: GENV });
      const d2 = JSON.parse(s.stub.read("pr-2.json"));
      d2.isDraft = true;
      s.stub.put("pr-2.json", JSON.stringify(d2));
      py(["record", DIR, "--repo", s.fx.repo, "--state", "build", "--build-pr", "2", "--cost", "1.5"], s.fx.repo, s.env);
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      const gl = s.stub.read("gh.log").split("\n");
      const ready = gl.findIndex((l) => l.startsWith("pr ready 2"));
      const merge = gl.findIndex((l) => l.startsWith("pr merge 2"));
      add("e24 a run on a folder with an open build PR resumes: no container, host checks, then merged", "merged",
        r.status === 0 && /resuming build pr 2/.test(r.stdout) && !s.stub.read("docker.log").split("\n").some((l) => l.startsWith("run ")) && rec?.status === "pass" && rec.detail.cost_usd === 1.5, brief(r) + s.stub.read("docker.log"));
      add("e25 a draft build PR is marked ready after the checks and right before the merge", "ready then merge", ready > 0 && merge > ready, gl.join("\n"));
      const daily = JSON.parse(readFileSync(join(s.fx.repo, ".pro-dev", "factory", "daily.json"), "utf8"));
      add("e26 a resume does not count a new run or the old cost again", "0", daily.runs === 0 && daily.cost_usd === 0, JSON.stringify(daily));
    }
    {
      const s = scenario("run11");
      s.stub.put("brief.push", s.b);
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      add("e27 a session whose token moved the default branch is an error and nothing is merged", "error",
        r.status === 2 && rec?.status === "fail" && /default branch moved during the session/.test(rec.summary) && !s.stub.read("gh.log").includes("pr merge"), brief(r));
    }
    {
      const s = scenario("run12");
      s.stub.put("rules.json", "[]");
      let r = py(s.args, s.fx.repo, s.env);
      add("e28 an unprotected default branch refuses the run before any container", "refused", r.status === 1 && /not protected/.test(r.stderr) && !existsSync(join(s.stub.dir, "docker.log")), brief(r));
      s.stub.put("protection.json", '{"required_pull_request_reviews":{"required_approving_review_count":1}}');
      r = py(s.args, s.fx.repo, s.env);
      add("e29 branch protection with required PR reviews is accepted", "merged", r.status === 0, brief(r));
      const t = scenario("run13");
      t.stub.put("rules.json", "[]");
      r = py([...t.args, "--allow-unprotected"], t.fx.repo, t.env);
      add("e30 --allow-unprotected runs and the record notes it", "unprotected", r.status === 0 && record(t.fx)?.detail.unprotected === true, brief(r));
    }
    {
      const s = scenario("run14");
      s.stub.put("brief.sleep", "5");
      const r = py([...s.args, "--timeout-min", "0.02"], s.fx.repo, s.env);
      const rec = record(s.fx);
      const dl = s.stub.read("docker.log");
      const daily = JSON.parse(readFileSync(join(s.fx.repo, ".pro-dev", "factory", "daily.json"), "utf8"));
      add("e31 the container is named then killed by that name on a timeout", "kill", new RegExp(`run --rm --name (factory-${FOLDER}-brief-\\d+) `).test(dl) && new RegExp(`kill factory-${FOLDER}-brief-\\d+`).test(dl), dl);
      add("e32 a timeout is an error record", "error", r.status === 2 && rec?.status === "fail" && /timed out/.test(rec.summary), brief(r));
      add("e33 with no result event the phase budget is counted in daily.json", "8", daily.cost_usd === 8, JSON.stringify(daily));
    }
    {
      const s = scenario("run15", { extra: { ANTHROPIC_API_KEY: "sk-ant-secret-123" } });
      s.stub.put("brief.out", '{"type":"result","total_cost_usd":0.5}\nleak sk-ant-secret-123 scoped-token-abc\nfactory: pr 1\n');
      py(s.args, s.fx.repo, s.env);
      const log = readFileSync(join(s.fx.repo, ".pro-dev", "factory", `${FOLDER}-brief.log`), "utf8");
      add("e34 the saved log redacts the GitHub token and the API key", "redacted", !log.includes("scoped-token-abc") && !log.includes("sk-ant-secret-123") && log.includes("leak *** ***"), log);
      const dl = s.stub.read("docker.log");
      add("e35 the image is tagged with the plugin version", "tag", /run --rm .* pro-dev-factory:\d+\.\d+\.\d+ \/opt\/factory\/session\.sh/.test(dl), dl);
    }
    {
      const s = scenario("run16");
      s.stub.put("no-image", "1");
      py(s.args, s.fx.repo, s.env);
      add("e36 a missing image tag is built", "build", /build -t pro-dev-factory:\d+\.\d+\.\d+ /.test(s.stub.read("docker.log")), s.stub.read("docker.log"));
    }
    {
      const s = scenario("run17");
      writeFileSync(join(s.fx.repo, ".pro-dev-tmp"), "");
      mkdirSync(join(s.fx.repo, ".pro-dev", "factory"), { recursive: true });
      writeFileSync(join(s.fx.repo, ".pro-dev", "factory", "daily.json"), JSON.stringify({ date: new Date().toLocaleDateString("sv"), runs: 5, cost_usd: 0 }));
      let r = py([...s.args, "--max-runs", "5"], s.fx.repo, s.env);
      add("e37 --max-runs is applied before the cap check", "refused", r.status === 1 && /daily cap of 5 runs/.test(r.stderr), brief(r));
      r = py([...s.args, "--max-daily-usd", "0"], s.fx.repo, s.env);
      add("e38 --max-daily-usd is applied before the cap check", "refused", r.status === 1 && /daily cap of \$0/.test(r.stderr), brief(r));
    }

    // ── level and roles through the CLI ──
    {
      const fx = repoWithOrigin(sandbox, "lv", { [FOLDER]: { "intent.md": intentText() }, "2026-01-03-risky": { "intent.md": intentText({ body: "Rotate the API key and log the password." }) } });
      const stub = makeStub(sandbox, "lv", fx.origin);
      let r = py(["level", DIR, "--repo", fx.repo, "--json"], fx.repo, stub.env);
      add("l1 level prints JSON with the contract's keys", "level 1", r.status === 0 && jsonOf(r)?.level === 1 && "history_max" in jsonOf(r) && "reasons" in jsonOf(r), brief(r));
      r = py(["roles", "--repo", fx.repo, "--json"], fx.repo, stub.env);
      add("l2 roles prints the map", "five keys", r.status === 0 && Object.keys(jsonOf(r) ?? {}).length === 5, brief(r));
      r = py(["level", "intent/2026-01-03-risky", "--repo", fx.repo, "--write"], fx.repo, stub.env);
      add("l3 level --write raises the file and exits 3", "raised", r.status === 3 && /level: 3/.test(r.stdout) && /^level: 3$/m.test(readFileSync(join(fx.repo, "intent", "2026-01-03-risky", "intent.md"), "utf8")), brief(r));
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runFactoryCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} factory cases passed`);
  process.exit(bad ? 1 : 0);
}
