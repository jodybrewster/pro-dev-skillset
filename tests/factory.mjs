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
const intentText = ({ status = "accepted", risk = "low", author = "t", source = "idea", level = "", body = "Fix the greeting typo on the home page.", sections = "" } = {}) =>
  `---\nsource: ${source}\nkind: bug\nstatus: ${status}\nrisk: ${risk}\n${level ? `level: ${level}\n` : ""}created: 2026-01-02T10:00:00-0500\nauthor: ${author}\n---\n\n# Intent: greeting\n\n## Problem\n\n${body}\n${sections}`;
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
  mkdirSync(join(dir, "guard"));
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
      FACTORY_GH_TOKEN: "scoped-token-abc", CLAUDE_CODE_PLUGIN_CACHE_DIR: cache, ANTHROPIC_API_KEY: "k", CLAUDE_GUARD_DIR: join(dir, "guard") },
    read: (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : ""),
    put: (f, t) => write(join(dir, f), t),
  };
}

// A PR: commits on top of `parent` pushed to refs/pull/<n>/head, and the JSON the gh stub serves.
// A build PR's body ends with the pr-check marker /execute appends (spec-m2 R17) unless opts.body says otherwise.
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
    git(clone, "commit", "-q", "-m", (c.msg ?? "change") + (c.raw ? "" : `\n\nFactory-Run: ${phase} ${opts.folder ?? FOLDER}`));
  }
  const sha = git(clone, "rev-parse", "HEAD").stdout.trim();
  git(clone, "push", "-q", "--force", "origin", `HEAD:refs/pull/${n}/head`);
  const slug = (opts.folder ?? FOLDER).replace(/^(?:\d{4}-\d{2}-\d{2}|[A-Z]{2,6}-[0-9]+)-/, "");
  stub.put(`pr-${n}.json`, JSON.stringify({ state: "OPEN", baseRefName: "main", headRefOid: sha, isCrossRepository: false,
    headRefName: opts.branch ?? (phase === "brief" ? `${slug}-brief` : slug), isDraft: opts.draft ?? false, author: { login: opts.author ?? "factory-bot" },
    body: opts.body ?? (phase === "build" ? `Build.\n\n<!-- pro-ship:pr-check head=${sha} result=pass tier=low model=opus host=claude -->\n` : "Brief.\n") }));
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
        && rec.evidence_key === `factory-${FOLDER}` && rec.artifact_key === FOLDER && typeof rec.detail_json === "string" && rec.detail.level_at_intake === 1 && !!rec.detail.started
        && !("change_id" in rec), brief(r));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "build", "--pr", "https://github.com/o/r/pull/9", "--cost", "1.5"], fx.repo, stub.env);
      rec = record(fx);
      add("r2 build keeps started, sets build_pr and cost", "info", rec?.status === "info" && rec.detail.build_pr === "https://github.com/o/r/pull/9" && rec.detail.cost_usd === 1.5 && rec.detail.state === "build", brief(r));
      const mainSha = git(fx.repo, "rev-parse", "HEAD").stdout.trim();
      r = py(["record", DIR, "--repo", fx.repo, "--state", "merged", "--sha", mainSha, "--unread-lines", "42"], fx.repo, stub.env);
      rec = record(fx);
      add("r3 merged is pass and says deploy is yours with the unread lines", "pass", rec?.status === "pass" && rec.summary === `level 1: merged ${mainSha.slice(0, 12)}, deploy is yours, unread diff: 42 lines`, brief(r) + (rec?.summary ?? ""));
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
        { "package.json": JSON.stringify({ name: "demo", scripts: { test: "node tests/greet.test.js" } }, null, 2) + "\n", "tests/old.test.js": "// old\n", "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n### Security\n\n- Old fix\n" });
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
      const LOG = "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n### Security\n\n- Old fix\n";
      check("r1 a build that rewrites its own intent frontmatter", "level 2", [{ files: { ...buildFiles(), [`${DIR}/intent.md`]: intentText().replace("kind: bug", "kind: idea") } }], { level: 2, re: /changed the frontmatter of intent/ });
      check("r2 a build that changes the intent body only passes", "pass", [{ files: { ...buildFiles(), [`${DIR}/intent.md`]: intentText({ body: "Fix the greeting typo on the home page. More." }) } }], "pass");
      check("r3 a build that sets a manifest version", "level 2", [{ files: { ...buildFiles(), "package.json": JSON.stringify({ name: "demo", version: "9.0.0", scripts: { test: "node tests/greet.test.js" } }, null, 2) + "\n" } }], { level: 2, re: /changed the version in package\.json/ });
      check("r4 a build that bumps a Cargo version", "level 2", [{ files: { ...buildFiles(), "Cargo.toml": "[package]\nname = \"d\"\nversion = \"2.0.0\"\n" } }], { level: 2, re: /changed the version in Cargo\.toml/ });
      check("r5 a new Unreleased line passes", "pass", [{ files: { ...buildFiles(), "CHANGELOG.md": LOG.replace("## [Unreleased]\n", "## [Unreleased]\n\n### Fixed\n\n- The greeting\n") } }], "pass");
      check("r6 a deleted past entry", "level 2", [{ files: { ...buildFiles(), "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n" } }], { level: 2, re: /CHANGELOG\.md outside Unreleased/ });
      check("r7 a version heading written ahead of time", "level 2", [{ files: { ...buildFiles(), "CHANGELOG.md": LOG.replace("## [Unreleased]\n", "## [Unreleased]\n\n## [9.0.0] - 2026-02-02\n") } }], { level: 2, re: /CHANGELOG\.md outside Unreleased/ });
      check("r8 an added generator marker", "level 2", [{ files: { ...buildFiles(), "cliff.toml": "x\n" } }], { level: 2, re: /generator marker: cliff\.toml/ });
      check("r9 a generated first line", "level 2", [{ files: { ...buildFiles(), "CHANGELOG.md": "<!-- generated, do not edit -->\n" + LOG } }], { level: 2, re: /marked CHANGELOG\.md as generated/ });
      check("r10 a removed Unreleased heading", "level 2", [{ files: { ...buildFiles(), "CHANGELOG.md": "# Changelog\n\n## [1.0.0] - 2026-01-01\n\n### Security\n\n- Old fix\n" } }], { level: 2, re: /removed the Unreleased heading/ });
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
      // spec-m2 R18 (AC9): the pr-check marker in the build PR's body and the reviewer's model.
      const withBody = (body) => (k) => { const d = JSON.parse(stub.read(`pr-${k}.json`)); d.body = typeof body === "function" ? body(d.headRefOid) : body; stub.put(`pr-${k}.json`, JSON.stringify(d)); };
      const mk = (extra) => (h) => `Build.\n\n<!-- pro-ship:pr-check head=${h} result=pass tier=low${extra} -->\n`;
      check("v37 no pr-check marker in the body with pr-check.py found", "level 2", good, { level: 2, re: /no pr-check marker/ }, stub.env, withBody("Build.\n"));
      check("v37b two markers in the body", "level 2", good, { level: 2, re: /more than one pr-check marker/ }, stub.env, withBody((h) => mk(" model=opus host=claude")(h) + mk(" model=opus host=claude")(h)));
      const noPc = { ...stub.env, FACTORY_PR_CHECK: join(sandbox, "no-pr-check.py") };
      let jn = check("v38 pr-check.py not found and no marker passes with the note", "pass", good, "pass", noPc, withBody("Build.\n"));
      add("v38b the note says pr-check is not installed", "note", JSON.stringify(jn?.notes) === JSON.stringify(["pr-check not installed, reviewer model not checked"]), JSON.stringify(jn));
      jn = check("v39 a Sonnet marker in warn passes with the mismatch note", "pass", good, "pass", stub.env, withBody(mk(" model=sonnet host=claude")));
      add("v39b the note names the family and the rule", "note", (jn?.notes ?? []).includes("the review ran on sonnet, REVIEW.md names opus"), JSON.stringify(jn));
      stub.put("guard/mode.review-model", "enforce\n");
      check("v40 a Sonnet marker in enforce raises to level 2", "level 2", good, { level: 2, re: /the review ran on sonnet, REVIEW\.md names opus/ }, stub.env, withBody(mk(" model=sonnet host=claude")));
      check("v40b an Opus marker in enforce passes", "pass", good, "pass", stub.env);
      jn = check("v40c an old marker with no model passes with a note", "pass", good, "pass", stub.env, withBody(mk("")));
      add("v40d the note says the marker records no model", "note", (jn?.notes ?? []).includes("the pr-check marker records no reviewer model"), JSON.stringify(jn));
      stub.put("guard/mode.review-model", "warn\n");
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

    // ── release fields on a base with manifests and no changelog ──
    {
      const fx = repoWithOrigin(sandbox, "vrf", { [FOLDER]: { "intent.md": intentText(), "spec.md": SPEC(), "plan.md": PLAN() } },
        { "pyproject.toml": "[project]\nname = \"d\"\nversion = \"1.0.0\"\n", "Cargo.toml": "[package]\nname = \"d\"\nversion = \"1.0.0\"\n", ".changeset/config.json": "{}\n" });
      const stub = makeStub(sandbox, "vrf", fx.origin);
      let n = 0;
      const check = (id, expect, files, want) => {
        n += 1;
        makePr(sandbox, fx, stub, n, [{ files: { ...buildFiles(), ...files }, msg: "build: greeting" }]);
        const r = py(["verify", "build", DIR, "--pr", String(n), "--repo", fx.repo, "--json"], fx.repo, stub.env);
        const j = jsonOf(r);
        add(id, expect, want === "pass" ? r.status === 0 && j?.result === "pass" : r.status === 3 && j?.level === want.level && want.re.test((j?.reasons ?? []).join(";")), brief(r));
      };
      check("f1 a pyproject version bump", "level 2", { "pyproject.toml": "[project]\nname = \"d\"\nversion = \"2.0.0\"\n" }, { level: 2, re: /changed the version in pyproject\.toml/ });
      check("f2 a Cargo version bump", "level 2", { "Cargo.toml": "[package]\nname = \"d\"\nversion = \"2.0.0\"\n" }, { level: 2, re: /changed the version in Cargo\.toml/ });
      check("f3 another Cargo key leaves the version alone", "pass", { "Cargo.toml": "[package]\nname = \"e\"\nversion = \"1.0.0\"\n" }, "pass");
      check("f4 a new changelog holding only Unreleased passes", "pass", { "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- The greeting\n" }, "pass");
      check("f5 a new changelog with a version heading", "level 2", { "CHANGELOG.md": "## [Unreleased]\n\n## [9.0.0] - 2026-02-02\n\n- forged\n" }, { level: 2, re: /created CHANGELOG\.md with a version heading/ });
      check("f6 a new changelog marked generated", "level 2", { "CHANGELOG.md": "<!-- generated -->\n" }, { level: 2, re: /marked CHANGELOG\.md as generated/ });
      check("f7 a routine changeset in a changesets repo passes", "pass", { ".changeset/brave-lions.md": "x\n" }, "pass");
      check("f8 a manifest under tests/ is not a release manifest", "pass", { "tests/fixtures/app/package.json": "{\"version\":\"0.1.0\"}\n" }, "pass");
      check("f9 a .releaserc folder is a marker", "level 2", { ".releaserc/x": "x\n" }, { level: 2, re: /generator marker/ });
      const sess = readFileSync(join(ROOT, "plugins", "pro-ai-sdlc", "factory", "session.sh"), "utf8");
      add("f10 session.sh marks a factory session", "exported", /^export FACTORY_SESSION=1$/m.test(sess), "no export");
      add("f11 the commit hook replaces a trailer a session wrote itself", "replace", /interpret-trailers --in-place --if-exists replace/.test(sess), "not replace");
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

    // ── reviewmodel.py marker: /execute stage 8 finds pro-ship's pr-check.py and prints the marker (spec-m2 R17) ──
    {
      const RMP = join(ROOT, "plugins", "pro-ai-sdlc", "scripts", "reviewmodel.py");
      const repo = join(sandbox, "rmmarker");
      mkdirSync(repo);
      git(repo, "init", "-q", "-b", "main");
      write(join(repo, "a.txt"), "1\n");
      git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", "init");
      const sha = git(repo, "rev-parse", "HEAD").stdout.trim();
      const stamp = JSON.parse(readFileSync(join(ROOT, "tests", "fixtures", "pr-check-stamp", "valid-pass.json"), "utf8").split("HEAD").join(sha));
      write(join(repo, ".pro-dev", "ship", "pr-check.json"), JSON.stringify(stamp));
      const env = { ...GENV, CLAUDE_CODE_PLUGIN_CACHE_DIR: join(sandbox, "rm-cache") };
      const runRm = (e) => spawnSync("python3", ["-I", RMP, "marker"], { cwd: repo, encoding: "utf8", env: e });
      let r = runRm(env);
      add("k1 reviewmodel.py marker runs pro-ship's pr-check.py marker from pro-ai-sdlc", "the marker line",
        r.status === 0 && r.stdout === `<!-- pro-ship:pr-check head=${sha} result=pass tier=unclassified model=opus host=claude -->\n`, `${r.status} ${r.stdout} ${r.stderr}`);
      r = runRm({ ...env, FACTORY_PR_CHECK: join(sandbox, "none.py") });
      add("k2 with pro-ship not found it prints not-installed and exits 3", "not-installed, 3", r.status === 3 && r.stdout.trim() === "not-installed", `${r.status} ${r.stdout} ${r.stderr}`);
    }

    // ── session.sh: the mode file and the PR found by branch name ──
    {
      const fx = repoWithOrigin(sandbox, "sh", {
        [FOLDER]: { "intent.md": intentText() },
        "TST-4-demo": { "intent.md": intentText().replace("---\nsource:", "---\nid: TST-4\nsource:") },
        "2026-01-03-dated": { "intent.md": intentText().replace("---\nsource:", "---\nid: TST-3\nsource:") },
      });
      const lastHead = () => { const p = join(stubDir, "heads.log"); return existsSync(p) ? readFileSync(p, "utf8").trim().split("\n").pop() : ""; };
      const bin = join(sandbox, "sh-bin");
      mkdirSync(bin);
      write(join(bin, "claude"), "#!/bin/sh\nexit 0\n");
      write(join(bin, "gh"), '#!/bin/sh\nh=""\nwhile [ $# -gt 0 ]; do [ "$1" = --head ] && h=$2; shift; done\necho "$h" >> "$STUB/heads.log"\nf=$(echo "$h" | tr / _)\n[ -f "$STUB/head-$f" ] && cat "$STUB/head-$f"\nexit 0\n');
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
      add("s1b AC4 an intent with no id passes --head greeting-brief to gh", "greeting-brief", lastHead() === "greeting-brief", lastHead());
      add("s2 session.sh writes enforce into the container's own hooks mode file", "enforce", existsSync(join(r.home, ".claude", "hooks", "mode")) && readFileSync(join(r.home, ".claude", "hooks", "mode"), "utf8").trim() === "enforce", r.stderr);
      r = runSh("build");
      add("s3 the build phase looks for the slug branch and never falls back to another PR", "no pr", r.status === 1 && !/factory: pr/.test(r.stdout) && /branch greeting/.test(r.stderr), `${r.status} ${r.stdout} ${r.stderr}`);
      // An id-named folder (spec-m1 R9, R10): accepted by the argument checks, its slug drops the id prefix.
      const runDir = (name, dir) => {
        const home = join(sandbox, `sh-home-${name}`);
        mkdirSync(home, { recursive: true });
        const env = { PATH: `${bin}:${process.env.PATH}`, HOME: home, STUB: stubDir, FACTORY_WORK: join(sandbox, `sh-work-${name}`), GH_TOKEN: "t" };
        return spawnSync("sh", [SESSION, fx.origin, "main", "brief", dir], { encoding: "utf8", env });
      };
      write(join(stubDir, "head-demo-brief"), "8\n");
      r = runDir("id", "intent/TST-1-demo");
      add("s4 session.sh accepts intent/TST-1-demo and looks for the brief PR on demo-brief", "pr 8", r.status === 0 && /^factory: pr 8$/m.test(r.stdout), `${r.status} ${r.stdout} ${r.stderr}`);
      // traceable-ids m2 R6, AC4: an intent with an id: line is looked up on <id>/brief and <id>/build.
      write(join(stubDir, "head-TST-4_brief"), "9\n");
      r = runDir("idb", "intent/TST-4-demo");
      add("s10 AC4 session.sh passes --head TST-4/brief for an intent with id TST-4", "pr 9", r.status === 0 && /^factory: pr 9$/m.test(r.stdout) && lastHead() === "TST-4/brief", `${r.status} ${r.stdout} ${r.stderr} ${lastHead()}`);
      r = runDir("idd", "intent/2026-01-03-dated");
      add("s11 a date folder with a backfilled id is looked up on its id branch", "TST-3/brief", lastHead() === "TST-3/brief", `${r.status} ${r.stderr} ${lastHead()}`);
      {
        const home = join(sandbox, "sh-home-idbuild");
        mkdirSync(home, { recursive: true });
        const env = { PATH: `${bin}:${process.env.PATH}`, HOME: home, STUB: stubDir, FACTORY_WORK: join(sandbox, "sh-work-idbuild"), GH_TOKEN: "t" };
        r = spawnSync("sh", [SESSION, fx.origin, "main", "build", "intent/TST-4-demo"], { encoding: "utf8", env });
        add("s12 the build phase of an intent with an id looks for <id>/build", "TST-4/build", r.status === 1 && lastHead() === "TST-4/build" && /branch TST-4\/build/.test(r.stderr), `${r.status} ${r.stderr} ${lastHead()}`);
      }
      for (const [i, bad] of [["5", "intent/TST-1-Demo"], ["6", "intent/tst-1-demo-X"], ["7", "intent/TST-01-demo"], ["8", "intent/TOOLONG-1-demo"], ["9", "intent/2026-01-02-Greeting"]]) {
        r = runDir(`bad${i}`, bad);
        add(`s${i} session.sh refuses ${bad}`, "exit 64", r.status === 64 && /refusing intent dir/.test(r.stderr), `${r.status} ${r.stdout} ${r.stderr}`);
      }
    }

    // ── an id-named intent folder (spec-m1 R9, R10, R12, AC7) ──
    {
      const ID_FOLDER = "TST-1-demo";
      const fx = repoWithOrigin(sandbox, "idf", {
        [ID_FOLDER]: { "intent.md": intentText().replace("---\nsource:", "---\nid: TST-1\nsource:") },
        "TST-2-Bad": { "intent.md": intentText() },
      });
      const stub = makeStub(sandbox, "idf", fx.origin);
      let r = py(["level", `intent/${ID_FOLDER}`, "--repo", fx.repo, "--json"], fx.repo, stub.env);
      add("i1 level runs on intent/TST-1-demo", "level 1", r.status === 0 && jsonOf(r)?.level === 1, brief(r));
      r = py(["record", `intent/${ID_FOLDER}`, "--repo", fx.repo, "--state", "queued"], fx.repo, stub.env);
      const p = join(fx.repo, ".pro-dev", "factory", "factory-tst-1-demo.json");
      const rec = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
      add("i2 record writes factory-tst-1-demo.json with a lowercased key and the folder as written", "factory-tst-1-demo",
        r.status === 0 && rec?.evidence_key === "factory-tst-1-demo" && rec?.artifact_key === ID_FOLDER && jsonOf(r)?.evidence_key === "factory-tst-1-demo", brief(r) + JSON.stringify(rec));
      r = py(["next", "--repo", fx.repo], fx.repo, stub.env);
      add("i3 next skips the id-named folder once it has a record", "nothing", r.status === 0 && r.stdout.trim() === "", brief(r));
      rmSync(join(fx.repo, ".pro-dev"), { recursive: true, force: true });
      r = py(["next", "--repo", fx.repo], fx.repo, stub.env);
      add("i4 next picks an accepted id-named folder and skips one outside the pattern", `intent/${ID_FOLDER}`, r.status === 0 && r.stdout.trim() === `intent/${ID_FOLDER}`, brief(r));
      for (const [i, bad] of [["5", "TST-2-Bad"], ["6", "TST-02-demo"], ["7", "tst-1-demo"]]) {
        mkdirSync(join(fx.repo, "intent", bad), { recursive: true });
        r = py(["record", `intent/${bad}`, "--repo", fx.repo, "--state", "queued"], fx.repo, stub.env);
        add(`i${i} record refuses intent/${bad}`, "must match", r.status === 1 && /must match/.test(r.stderr), brief(r));
      }
      const order = repoWithOrigin(sandbox, "idorder", { "TST-10-b": { "intent.md": intentText() }, "TST-9-a": { "intent.md": intentText() } });
      r = py(["next", "--repo", order.repo], order.repo, makeStub(sandbox, "idorder", order.origin).env);
      add("i9 next takes TST-9-a before TST-10-b: id folders sort by number, not as text", "intent/TST-9-a", r.status === 0 && r.stdout.trim() === "intent/TST-9-a", brief(r));
      // A repo holding both forms (traceable-ids m1 review): every date folder comes before any id folder.
      const mixed = repoWithOrigin(sandbox, "idmixed", {
        "TST-2-b": { "intent.md": intentText() },
        "2026-01-09-dated": { "intent.md": intentText() },
        "TST-1-a": { "intent.md": intentText() },
      });
      const mixedEnv = makeStub(sandbox, "idmixed", mixed.origin).env;
      r = py(["next", "--repo", mixed.repo], mixed.repo, mixedEnv);
      add("i10 next picks the date folder before the id folders in a mixed repo", "intent/2026-01-09-dated", r.status === 0 && r.stdout.trim() === "intent/2026-01-09-dated", brief(r));
      mkdirSync(join(mixed.repo, ".pro-dev", "factory"), { recursive: true });
      writeFileSync(join(mixed.repo, ".pro-dev", "factory", "factory-2026-01-09-dated.json"), JSON.stringify({ detail_json: "{}" }));
      r = py(["next", "--repo", mixed.repo], mixed.repo, mixedEnv);
      add("i11 then the lowest id folder", "intent/TST-1-a", r.status === 0 && r.stdout.trim() === "intent/TST-1-a", brief(r));
      const slug = spawnSync("python3", ["-I", "-c", "import sys; sys.path.insert(0, sys.argv[1]); import factory; print(' '.join(factory.slug_of(f) for f in sys.argv[2:]))",
        dirname(FACTORY), "TST-1-demo", "PDS-51-fix-greeting", "2026-01-02-greeting", "AB-123-x"], { encoding: "utf8", env: stub.env });
      add("i8 slug_of strips a date or an id prefix", "demo fix-greeting greeting x", slug.stdout.trim() === "demo fix-greeting greeting x", slug.stdout + slug.stderr);
    }

    // ── change_id on the factory record (traceable-ids spec-m3 R2, R6, R14, AC3) ──
    {
      const withId = (id) => intentText().replace("---\nsource:", `---\nid: ${id}\nsource:`);
      const fx = repoWithOrigin(sandbox, "cid", {
        [FOLDER]: { "intent.md": withId("TST-1") },
        "2026-01-03-lower": { "intent.md": withId("lower-1") },
        "2026-01-04-tiponly": { "intent.md": withId("TST-4") },
      });
      const stub = makeStub(sandbox, "cid", fx.origin);
      let r = py(["record", DIR, "--repo", fx.repo, "--state", "queued"], fx.repo, stub.env);
      let rec = record(fx);
      add("c1 an intent with id: TST-1 gives change_id TST-1 and the key factory-<folder>", "TST-1",
        r.status === 0 && rec?.change_id === "TST-1" && rec.evidence_key === `factory-${FOLDER}` && rec.artifact_key === FOLDER, brief(r) + JSON.stringify(rec));
      r = py(["record", "intent/2026-01-03-lower", "--repo", fx.repo, "--state", "queued"], fx.repo, stub.env);
      rec = record(fx, "2026-01-03-lower");
      add("c2 an id that fails the pattern (lower-1) leaves change_id out", "absent", r.status === 0 && rec && !("change_id" in rec), brief(r) + JSON.stringify(rec));
      rmSync(join(fx.repo, "intent", "2026-01-04-tiponly", "intent.md"));
      r = py(["record", "intent/2026-01-04-tiponly", "--repo", fx.repo, "--state", "queued"], fx.repo, stub.env);
      rec = record(fx, "2026-01-04-tiponly");
      add("c3 with no intent.md in the working tree the id comes from the default tip", "TST-4", r.status === 0 && rec?.change_id === "TST-4", brief(r) + JSON.stringify(rec));
      write(join(fx.repo, DIR, "intent.md"), withId("TST-5"));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "build"], fx.repo, stub.env);
      rec = record(fx);
      add("c4 the working tree wins over the default tip", "TST-5", r.status === 0 && rec?.change_id === "TST-5", brief(r) + JSON.stringify(rec));
    }

    // ── binding for an intent with an id (traceable-ids m2 R7, AC4) ──
    {
      const IDF = "TST-4-demo";
      const fx = repoWithOrigin(sandbox, "idbind", { [IDF]: { "intent.md": intentText().replace("---\nsource:", "---\nid: TST-4\nsource:") } });
      const stub = makeStub(sandbox, "idbind", fx.origin);
      const files = { [`intent/${IDF}/spec.md`]: SPEC(), [`intent/${IDF}/plan.md`]: PLAN() };
      makePr(sandbox, fx, stub, 1, [{ files }], "origin/main", { folder: IDF, phase: "brief", branch: "TST-4/brief" });
      let r = py(["verify", "brief", `intent/${IDF}`, "--pr", "1", "--repo", fx.repo, "--json"], fx.repo, stub.env);
      add("bi1 AC4 a brief PR on TST-4/brief binds to an intent with id TST-4", "pass", r.status === 0 && jsonOf(r)?.result === "pass", brief(r));
      makePr(sandbox, fx, stub, 2, [{ files }], "origin/main", { folder: IDF, phase: "brief", branch: "demo-brief" });
      r = py(["verify", "brief", `intent/${IDF}`, "--pr", "2", "--repo", fx.repo, "--json"], fx.repo, stub.env);
      add("bi2 the old <slug>-brief name is refused once the intent has an id", "level 3", r.status === 3 && /head branch is 'demo-brief', not 'TST-4\/brief'/.test((jsonOf(r)?.reasons ?? []).join(";")), brief(r));
      const head = makePr(sandbox, fx, stub, 3, [{ files: buildFiles() }], "origin/main", { folder: IDF, phase: "build", branch: "TST-4/build" });
      git(fx.repo, "fetch", "-q", "origin", "refs/pull/3/head");
      const base = git(fx.repo, "rev-parse", "origin/main").stdout.trim();
      const bind = (branch) => spawnSync("python3", ["-I", "-c",
        "import sys, json; sys.path.insert(0, sys.argv[1]); import factory; print(json.dumps(factory.binding_reasons(sys.argv[2], 'build', sys.argv[3], {'headRefName': sys.argv[4], 'author': {'login': 'factory-bot'}}, sys.argv[5], sys.argv[6], 't')))",
        dirname(FACTORY), fx.repo, IDF, branch, base, head], { encoding: "utf8", env: stub.env, cwd: fx.repo });
      r = bind("TST-4/build");
      add("bi3 AC4 a build PR on TST-4/build binds to an intent with id TST-4", "[]", r.stdout.trim() === "[]", r.stdout + r.stderr);
      r = bind("demo");
      add("bi4 the bare slug is refused for the build of an intent with an id", "level 3", /\[3, "the PR head branch is 'demo', not 'TST-4\/build'"\]/.test(r.stdout), r.stdout + r.stderr);
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
      const handed = s.stub.read("gh.log").split("\n").filter((l) => l.startsWith("pr comment 2"));
      add("e19b a stopped build PR is handed to a person with a comment naming the level and the reason", "one comment",
        handed.length === 1 && /level 3/.test(handed[0]), s.stub.read("gh.log"));
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
    for (const [id, text] of [["plain", "factory: stopped level 2 (the test needs a person)\n"], ["stream-json", JSON.stringify({ type: "result", result: "Done.\n\nfactory: stopped level 2 (the test needs a person)" }) + "\n"]]) {
      const s = scenario(`runstop-${id}`);
      s.stub.put("brief.out", text + "factory: no pull request found for branch x\n");
      s.stub.put("brief.rc", "1");
      const r = py(s.args, s.fx.repo, s.env);
      const rec = record(s.fx);
      add(`e21b a session's own stop (${id}) is a stopped record, not an error`, "stopped", r.status === 3 && rec?.status === "partial" && /the test needs a person/.test(rec.summary), brief(r));
    }
    {
      const s = scenario("runstop-low");
      s.stub.put("brief.out", "factory: stopped level 1 (claims low)\n");
      s.stub.put("brief.rc", "1");
      const r = py(s.args, s.fx.repo, s.env);
      add("e21c a stop never reads below level 2", "level 2", r.status === 3 && /level raised to 2/.test(record(s.fx)?.summary ?? ""), brief(r));
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
      const fx = repoWithOrigin(sandbox, "lv", { [FOLDER]: { "intent.md": intentText() }, "2026-01-03-risky": { "intent.md": intentText({ sections: "\n## Proposed outcome\n\nRotate the API key and log the password.\n" }) } });
      const stub = makeStub(sandbox, "lv", fx.origin);
      let r = py(["level", DIR, "--repo", fx.repo, "--json"], fx.repo, stub.env);
      add("l1 level prints JSON with the contract's keys", "level 1", r.status === 0 && jsonOf(r)?.level === 1 && "history_max" in jsonOf(r) && "reasons" in jsonOf(r), brief(r));
      r = py(["roles", "--repo", fx.repo, "--json"], fx.repo, stub.env);
      add("l2 roles prints the map", "five keys", r.status === 0 && Object.keys(jsonOf(r) ?? {}).length === 5, brief(r));
      r = py(["level", "intent/2026-01-03-risky", "--repo", fx.repo, "--write"], fx.repo, stub.env);
      add("l3 level --write raises the file and exits 3", "raised", r.status === 3 && /level: 3/.test(r.stdout) && /^level: 3$/m.test(readFileSync(join(fx.repo, "intent", "2026-01-03-risky", "intent.md"), "utf8")), brief(r));
    }

    // ── level reads stop-list words only in the requirement sections ──
    {
      const fx = repoWithOrigin(sandbox, "lvs", {
        "2026-01-04-oos": { "intent.md": intentText({ body: "Users think the auth page shows a deploy banner.", sections: "\n## Proposed outcome\n\nThe greeting reads Hello.\n\n## Out of scope\n\nAny auth change.\n\n## Risk\n\nA release note is not needed.\n" }) },
        "2026-01-05-po": { "intent.md": intentText({ sections: "\n## Proposed outcome\n\nThe auth page greets the user.\n\n## Out of scope\n\nNothing.\n" }) },
        "2026-01-06-cons": { "intent.md": intentText({ sections: "\n## Affected users and systems\n\nNobody.\n\n## Constraints\n\nNo password is logged and no deploy happens.\n" }) },
        "2026-01-07-code": { "intent.md": intentText({ sections: "\n## Proposed outcome\n\nThe `auth` helper keeps its name.\n\n```\nexport TOKEN=1\n```\n\n<!-- deploy later -->\n" }) },
        "2026-01-08-kept": { "intent.md": intentText({ level: "3", sections: "\n## Out of scope\n\nAny auth change.\n" }) },
      });
      const stub = makeStub(sandbox, "lvs", fx.origin);
      const lv = (folder) => { const r = py(["level", `intent/${folder}`, "--repo", fx.repo, "--json"], fx.repo, stub.env); return { r, j: jsonOf(r) }; };
      let o = lv("2026-01-04-oos");
      add("l4 a stop-list word only under Problem, Out of scope and Risk leaves level 1", "level 1", o.r.status === 0 && o.j?.level === 1 && !/stop-list/.test((o.j?.reasons ?? []).join(";")), brief(o.r));
      o = lv("2026-01-05-po");
      add("l5 the same word under Proposed outcome is level 3 and the reason names the section", "level 3", o.r.status === 3 && o.j?.level === 3 && (o.j?.reasons ?? []).includes("stop-list words in Proposed outcome: auth"), brief(o.r));
      o = lv("2026-01-06-cons");
      add("l6 words under Constraints count and name that section", "level 3", o.j?.level === 3 && (o.j?.reasons ?? []).includes("stop-list words in Constraints: password, deploy"), brief(o.r));
      o = lv("2026-01-07-code");
      add("l7 backticked spans, fenced blocks and HTML comments are not read", "level 1", o.j?.level === 1, brief(o.r));
      o = lv("2026-01-08-kept");
      add("l8 a recorded level 3 stays 3 when the words moved out of the requirement sections", "level 3", o.r.status === 0 && o.j?.level === 3 && o.j?.file_level === 3, brief(o.r));
    }

    // ── record --state merged checks the sha is on the default branch ──
    {
      const fx = repoWithOrigin(sandbox, "recm", { [FOLDER]: { "intent.md": intentText() } });
      const stub = makeStub(sandbox, "recm", fx.origin);
      const onMain = git(fx.repo, "rev-parse", "HEAD").stdout.trim();
      git(fx.repo, "checkout", "-q", "-b", "side");
      write(join(fx.repo, "side.txt"), "side\n");
      git(fx.repo, "add", "-A");
      git(fx.repo, "commit", "-q", "-m", "side");
      const offMain = git(fx.repo, "rev-parse", "HEAD").stdout.trim();
      git(fx.repo, "checkout", "-q", "main");
      let r = py(["record", DIR, "--repo", fx.repo, "--state", "merged", "--sha", offMain], fx.repo, stub.env);
      add("m1 merged with a sha off the default branch exits 2 and writes no record", "refused", r.status === 2 && record(fx) === null, brief(r));
      add("m2 the refusal names the sha, the tip and the branch", "named", r.stderr.includes(offMain.slice(0, 12)) && r.stderr.includes("origin/main") && /\bmain\b/.test(r.stderr.replace("origin/main", "")), brief(r));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "merged"], fx.repo, stub.env);
      add("m3 merged with no sha exits 2 and writes no record", "refused", r.status === 2 && record(fx) === null, brief(r));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "merged", "--sha", "0123456789abcdef0123456789abcdef01234567"], fx.repo, stub.env);
      add("m4 merged with a sha the repo does not have exits 2", "refused", r.status === 2 && record(fx) === null, brief(r));
      r = py(["record", DIR, "--repo", fx.repo, "--state", "merged", "--sha", onMain], fx.repo, stub.env);
      add("m5 merged with a sha on the default branch writes the record", "pass", r.status === 0 && record(fx)?.status === "pass" && record(fx)?.detail.merged_sha === onMain, brief(r));
      git(fx.repo, "remote", "remove", "origin");
      rmSync(join(fx.repo, ".pro-dev"), { recursive: true, force: true });
      r = py(["record", DIR, "--repo", fx.repo, "--state", "merged", "--sha", onMain], fx.repo, stub.env);
      add("m6 merged with no remote exits 2 with no remote to verify the base", "refused", r.status === 2 && record(fx) === null && /no remote to verify the base/.test(r.stderr), brief(r));
      // The tests/mieruka-sync.mjs fixture: a plain git init, then a bare origin pushed and fetched.
      const plain = join(sandbox, "recm-plain");
      mkdirSync(join(plain, "intent", FOLDER), { recursive: true });
      git(plain, "init", "-q");
      write(join(plain, "intent", FOLDER, "plan.md"), "plan\n");
      git(plain, "add", "-A");
      git(plain, "commit", "-q", "-m", "fixture");
      const plainHead = git(plain, "rev-parse", "HEAD").stdout.trim();
      git(sandbox, "init", "-q", "--bare", join(sandbox, "recm-plain-origin.git"));
      git(plain, "remote", "add", "origin", join(sandbox, "recm-plain-origin.git"));
      git(plain, "push", "-q", "origin", "HEAD:refs/heads/main");
      git(plain, "fetch", "-q", "origin");
      r = py(["record", DIR, "--repo", plain, "--state", "merged", "--sha", plainHead, "--unread-lines", "42"], plain, stub.env);
      add("m7 a plain git init with a pushed and fetched bare origin writes the merged record", "pass", r.status === 0 && record({ repo: plain })?.status === "pass", brief(r));
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
