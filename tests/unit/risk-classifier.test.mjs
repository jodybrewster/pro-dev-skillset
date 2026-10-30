// Unit cases for plugins/pro-ship/scripts/risk-classify.py (intent 2026-10-29-risk-tiers, step 2 onward).
// A fixture is a JSON file under tests/fixtures/risk/ with a base tree and a head tree as
// {path: content} maps, so no risky-looking path is a real directory in this repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, cpSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "plugins", "pro-ship", "scripts", "risk-classify.py");
const FIXTURES = join(ROOT, "tests", "fixtures", "risk");

const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env: ENV });

function writeTree(repo, tree) {
  for (const [path, content] of Object.entries(tree)) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    if (content === null) rmSync(full, { force: true });
    else writeFileSync(full, content);
  }
}

// main holds the base tree, feat (checked out) holds the head tree on top of it.
export function buildRepo(fixture, { onFeat = true } = {}) {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "risk-")));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "t");
  git(repo, "config", "user.email", "t@example.com");
  writeTree(repo, { ".gitkeep": "", ...(fixture.base || {}) });
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  if (onFeat) {
    git(repo, "checkout", "-q", "-b", "feat");
    writeTree(repo, fixture.head || {});
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "head");
  }
  return repo;
}

export const loadFixture = (name) => JSON.parse(readFileSync(join(FIXTURES, name + ".json"), "utf8"));

export function classify(repo, args = []) {
  const r = spawnSync("python3", [SCRIPT, "--repo", repo, ...args], { encoding: "utf8", env: ENV, timeout: 30_000 });
  let json = null;
  if (args.includes("--json")) { try { json = JSON.parse(r.stdout); } catch { /* not json */ } }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function withFixture(name, fn, opts) {
  const repo = buildRepo(loadFixture(name), opts);
  try { return fn(repo); } finally { rmSync(repo, { recursive: true, force: true }); }
}

const ids = (j) => j.signals.map((s) => s.id);

test("a README-only diff is low", () => withFixture("readme-only", (repo) => {
  const r = classify(repo, ["--json"]);
  assert.equal(r.status, 0);
  assert.equal(r.json.tier, "low");
  assert.deepEqual(r.json.signals, []);
}));

test("a workflow change is high with a workflows signal", () => withFixture("workflow-change", (repo) => {
  const r = classify(repo, ["--json"]);
  assert.equal(r.status, 4);
  assert.equal(r.json.tier, "high");
  const s = r.json.signals.find((x) => x.id === "workflows");
  assert.ok(s, "workflows signal");
  assert.equal(s.floor, "high");
  assert.equal(s.strength, "strong");
}));

test("a new dependency name is medium with dependencies", () => withFixture("new-dependency", (repo) => {
  const r = classify(repo, ["--json"]);
  assert.equal(r.status, 3);
  assert.equal(r.json.tier, "medium");
  assert.ok(ids(r.json).includes("dependencies"));
}));

test("the JSON carries every field of the contract", () => withFixture("readme-only", (repo) => {
  const j = classify(repo, ["--json"]).json;
  for (const k of ["tier", "signals", "declared", "findings", "tie", "architecture", "demands", "base", "head", "policy", "notes"]) {
    assert.ok(k in j, `missing ${k}`);
  }
  assert.match(j.head, /^[0-9a-f]{40}$/);
  assert.match(j.base, /^[0-9a-f]{40}$/);
}));

test("--base overrides the default base", () => withFixture("readme-only", (repo) => {
  // A second commit on feat adds a workflow; with --base HEAD~1 only that commit is read.
  writeTree(repo, { ".github/workflows/x.yml": "on: push\n" });
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "wf");
  const all = classify(repo, ["--json"]);
  assert.equal(all.json.tier, "high");
  const first = git(repo, "rev-parse", "HEAD~1").stdout.trim();
  const r = classify(repo, ["--json", "--base", first]);
  assert.equal(r.json.base, first);
  assert.equal(r.json.tier, "high");
  // base at HEAD is an empty range
  const empty = classify(repo, ["--json", "--base", "HEAD"]);
  assert.equal(empty.status, 2);
}));

test("a repo with no merge base exits 2", () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "risk-")));
  try {
    git(repo, "init", "-q", "-b", "other");
    git(repo, "config", "user.name", "t");
    git(repo, "config", "user.email", "t@example.com");
    writeFileSync(join(repo, "a.txt"), "a\n");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "a");
    const r = classify(repo);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /could not run/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("a non-git directory exits 2", () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "risk-")));
  try {
    const r = classify(dir, ["--json"]);
    assert.equal(r.status, 2);
    assert.equal(r.json.could_not_run, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an empty range on main exits 2 and never reads low", () => withFixture("readme-only", (repo) => {
  git(repo, "checkout", "-q", "main");
  const r = classify(repo, ["--json"]);
  assert.equal(r.status, 2);
  assert.match(r.json.reason, /empty range/);
  assert.notEqual(r.json.tier, "low");
}));

test("text output starts with risk: <tier>", () => withFixture("workflow-change", (repo) => {
  const r = classify(repo);
  assert.equal(r.stdout.split("\n")[0], "risk: high");
  assert.match(r.stdout, /workflows/);
}));

test("an unknown flag is a usage error", () => withFixture("readme-only", (repo) => {
  assert.equal(classify(repo, ["--nope"]).status, 64);
}));

// Table-driven fixture cases: fixture name, expected tier, signal ids that must be present and absent.
function table(title, rows) {
  for (const [fixture, tier, has = [], lacks = []] of rows) {
    test(`${title}: ${fixture} is ${tier}`, () => withFixture(fixture, (repo) => {
      const r = classify(repo, ["--json"]);
      assert.equal(r.json.tier, tier, JSON.stringify(r.json.signals));
      assert.equal(r.status, { low: 0, medium: 3, high: 4 }[tier]);
      for (const id of has) assert.ok(ids(r.json).includes(id), `expected ${id} in ${ids(r.json)}`);
      for (const id of lacks) assert.ok(!ids(r.json).includes(id), `did not expect ${id}`);
    }));
  }
}

// Step 3: path signals and the documentation rule (R5, R6)
table("path signals", [
  ["workflow-change", "high", ["workflows"]],
  ["path-iac-dockerfile", "high", ["iac"]],
  ["path-iac-tf", "high", ["iac"]],
  ["path-iac-docs-quiet", "low", [], ["iac"]],
  ["path-hook-hooksjson", "high", ["hook-scripts"]],
  ["path-hook-dir", "high", ["hook-scripts"]],
  ["path-hook-husky", "high", ["hook-scripts"]],
  ["path-hook-claude-settings", "high", ["hook-scripts"]],
  ["path-hook-tracked-script", "high", ["hook-scripts"]],
  ["path-hook-untracked-script", "low", [], ["hook-scripts"]],
  ["path-auth", "high", ["auth"]],
  ["path-payments", "high", ["payments"]],
  ["path-pay-quiet", "low", [], ["payments"]],
  ["path-migrations", "high", ["migrations"]],
  ["path-sql-quiet", "low", [], ["migrations"]],
  ["path-env-local", "high", ["env-config"]],
  ["path-env-example-quiet", "low", [], ["env-config"]],
  ["docs-only", "low"],
  ["md-under-workflows", "high", ["workflows"]],
  ["md-under-hooks", "high", ["hook-scripts"]],
  ["md-under-claude-hooks", "high", ["hook-scripts"]],
]);

test("the hook-scripts evidence names the script a tracked hooks.json runs", () => withFixture("path-hook-tracked-script", (repo) => {
  const s = classify(repo, ["--json"]).json.signals.find((x) => x.id === "hook-scripts");
  assert.deepEqual(s.evidence, ["plugin/scripts/gate.py"]);
}));

// Step 4: dependencies and test signals (R7, R8)
table("dependencies and tests", [
  ["new-dependency", "medium", ["dependencies"]],
  ["dep-requirements", "medium", ["dependencies"]],
  ["dep-pyproject", "medium", ["dependencies"]],
  ["dep-gomod", "medium", ["dependencies"]],
  ["dep-cargo", "medium", ["dependencies"]],
  ["dep-gemfile", "medium", ["dependencies"]],
  ["dep-version-bump", "low", [], ["dependencies"]],
  ["dep-lockfile-churn", "low", [], ["dependencies"]],
  ["dep-scripts-key-quiet", "low", [], ["dependencies"]],
  ["test-deleted", "medium", ["test-deleted"]],
  ["assertion-removed", "medium", ["assertion-removed"], ["test-deleted"]],
  ["assertion-rewritten-quiet", "low", [], ["assertion-removed"]],
  ["no-test-change", "medium", ["no-test-change"]],
  ["no-test-change-with-test", "low", [], ["no-test-change"]],
  ["test-pattern-dot-test", "medium", ["test-deleted"]],
  ["test-pattern-dot-spec", "medium", ["test-deleted"]],
  ["test-pattern-underscore-test", "medium", ["test-deleted"]],
  ["test-pattern-test-py", "medium", ["test-deleted"]],
  ["test-pattern-tests-dir", "medium", ["test-deleted"]],
  ["test-pattern-test-dir", "medium", ["test-deleted"]],
  ["test-pattern-dunder-tests", "medium", ["test-deleted"]],
  ["test-pattern-not-a-test", "low", [], ["test-deleted"]],
  ["test-only-change", "low"],
  ["small-source-with-test", "low"],
]);

test("no-test-change is weak and the tie is reported", () => withFixture("no-test-change", (repo) => {
  const j = classify(repo, ["--json"]).json;
  assert.equal(j.signals.find((s) => s.id === "no-test-change").strength, "weak");
  assert.deepEqual(j.tie, ["low", "medium"]);
}));

test("a deleted test is strong and has no tie", () => withFixture("test-deleted", (repo) => {
  const j = classify(repo, ["--json"]).json;
  assert.equal(j.signals.find((s) => s.id === "test-deleted").strength, "strong");
  assert.equal(j.tie, null);
}));

// Step 5: size and areas (R9, R18)
table("size and areas", [
  ["size-files-medium", "medium", ["size"]],
  ["size-files-high", "high", ["size"]],
  ["size-files-at-threshold-quiet", "low", [], ["size", "areas"]],
  ["size-lines-medium", "medium", ["size"]],
  ["size-lines-high", "high", ["size"]],
  ["areas-four", "medium", ["areas"]],
  ["areas-three-quiet", "low", [], ["areas"]],
  ["areas-plugins-four", "medium", ["areas"]],
  ["areas-one-plugin-quiet", "low", [], ["areas"]],
  ["docs-and-locks-not-counted", "low", [], ["size", "areas"]],
]);

test("size and areas are weak", () => withFixture("size-files-high", (repo) => {
  const j = classify(repo, ["--json"]).json;
  assert.equal(j.signals.find((s) => s.id === "size").strength, "weak");
  assert.deepEqual(j.tie, ["medium", "high"]);
}));

test("the size thresholds are named placeholder constants", () => {
  const src = readFileSync(SCRIPT, "utf8");
  for (const n of ["FILES_MEDIUM", "FILES_HIGH", "LINES_MEDIUM", "LINES_HIGH", "AREAS_MEDIUM", "NO_TEST_LINES"]) {
    assert.match(src, new RegExp(`^.*\\b${n}\\b.*=`, "m"));
  }
  assert.match(src, /placeholders, unmeasured/);
});

// Step 6: surface signals and the module lookup (R10, R11, AC7)
table("surface signals", [
  ["legal-gpl-dependency", "medium", ["legal-dependency-license"]],
  ["security-api-route", "medium", ["security-api-route"]],
  ["security-auth-path", "high", ["security-auth", "auth"]],
]);

test("the surface modules are found in a repo checkout, so no note is printed", () => withFixture("readme-only", (repo) => {
  assert.deepEqual(classify(repo, ["--json"]).json.notes, []);
}));

// AC7: the scripts folder copied alone, HOME empty, no PRO_SHIP_SURFACE_DIR: both modules are unavailable.
function isolatedClassify(repo, args, extraEnv = {}) {
  const box = realpathSync(mkdtempSync(join(tmpdir(), "risk-iso-")));
  try {
    cpSync(join(ROOT, "plugins", "pro-ship", "scripts"), join(box, "pro-ship", "scripts"), { recursive: true });
    mkdirSync(join(box, "home"));
    const env = { ...ENV, HOME: join(box, "home") };
    delete env.PRO_SHIP_SURFACE_DIR;
    delete env.CLAUDE_CODE_PLUGIN_CACHE_DIR;
    Object.assign(env, extraEnv);
    const r = spawnSync("python3", [join(box, "pro-ship", "scripts", "risk-classify.py"), "--repo", repo, "--json", ...args],
      { encoding: "utf8", env, timeout: 30_000 });
    return { status: r.status, json: JSON.parse(r.stdout), box };
  } finally { rmSync(box, { recursive: true, force: true }); }
}

test("AC7: with both modules hidden each is noted and the path fixtures keep their tiers", () => {
  for (const [name, tier, id] of [["readme-only", "low"], ["workflow-change", "high", "workflows"],
    ["security-auth-path", "high", "auth"], ["path-migrations", "high", "migrations"], ["new-dependency", "medium", "dependencies"]]) {
    withFixture(name, (repo) => {
      const r = isolatedClassify(repo, []);
      assert.equal(r.json.tier, tier, name);
      assert.ok(r.json.notes.includes("surface-unavailable: security_surface"), name);
      assert.ok(r.json.notes.includes("surface-unavailable: legal_surface"), name);
      if (id) assert.ok(ids(r.json).includes(id), name);
    });
  }
});

test("PRO_SHIP_SURFACE_DIR is the last place the lookup tries", () => withFixture("security-api-route", (repo) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "risk-surf-")));
  try {
    cpSync(join(ROOT, "plugins", "pro-security", "scripts", "security_surface.py"), join(dir, "security_surface.py"));
    cpSync(join(ROOT, "plugins", "pro-legal", "scripts", "legal_surface.py"), join(dir, "legal_surface.py"));
    const r = isolatedClassify(repo, [], { PRO_SHIP_SURFACE_DIR: dir });
    assert.deepEqual(r.json.notes, []);
    assert.ok(ids(r.json).includes("security-api-route"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test("the newest cached copy of a sibling plugin is used", () => withFixture("security-api-route", (repo) => {
  const box = realpathSync(mkdtempSync(join(tmpdir(), "risk-cache-")));
  try {
    for (const [plugin, file] of [["pro-security", "security_surface.py"], ["pro-legal", "legal_surface.py"]]) {
      for (const v of ["0.9.0", "0.10.0"]) {
        mkdirSync(join(box, "cache", "mkt", plugin, v, "scripts"), { recursive: true });
        // the older version is a stub that would hide every hit; the newest is the real module
        if (v === "0.9.0") writeFileSync(join(box, "cache", "mkt", plugin, v, "scripts", file), "def diff_files(*a, **k):\n    return {}\n");
        else cpSync(join(ROOT, "plugins", plugin === "pro-security" ? "pro-security" : "pro-legal", "scripts", file), join(box, "cache", "mkt", plugin, v, "scripts", file));
      }
    }
    const r = isolatedClassify(repo, [], { CLAUDE_CODE_PLUGIN_CACHE_DIR: box });
    assert.deepEqual(r.json.notes, []);
    assert.ok(ids(r.json).includes("security-api-route"));
  } finally { rmSync(box, { recursive: true, force: true }); }
}));

// security_surface.py's own auth rule matches auth\w*, so author.js reads as a security-auth hit when the
// module is present. The classifier's own path rule stays quiet; with the modules hidden the diff is low.
test("author.js does not fire the auth path signal", () => withFixture("path-author-quiet", (repo) => {
  assert.ok(!ids(classify(repo, ["--json"]).json).includes("auth"));
  const r = isolatedClassify(repo, []);
  assert.equal(r.json.tier, "low");
  assert.deepEqual(r.json.signals, []);
}));

// Step 7: architecture, tie, declared risk and demands (R12 to R15, AC5)
const run = (name, args = []) => withFixture(name, (repo) => classify(repo, ["--json", ...args]).json);

test("a Dockerfile change sets architecture", () => assert.equal(run("path-iac-dockerfile").architecture, true));
test("a README change leaves architecture false", () => assert.equal(run("readme-only").architecture, false));

test("a new env var read is a weak medium signal and sets architecture", () => {
  const j = run("env-var-new");
  const s = j.signals.find((x) => x.id === "env-var-read");
  assert.ok(s);
  assert.equal(s.floor, "medium");
  assert.equal(s.strength, "weak");
  assert.deepEqual(s.evidence, ["src/app.js", "src/app.py", "src/cfg.py"]);
  assert.equal(j.architecture, true);
  assert.equal(j.tier, "medium");
  assert.deepEqual(j.tie, ["low", "medium"]);
});

test("an env var listed in .env.example is not new", () => {
  const j = run("env-var-in-example-quiet");
  assert.ok(!ids(j).includes("env-var-read"));
  assert.equal(j.architecture, false);
});

test("size and areas alone print a tie", () => {
  const j = run("tie-size-areas");
  assert.deepEqual(ids(j).sort(), ["areas", "size"]);
  assert.equal(j.tier, "high");
  assert.deepEqual(j.tie, ["medium", "high"]);
  const text = withFixture("tie-size-areas", (repo) => classify(repo).stdout);
  assert.match(text, /^tie: \[medium, high\]/m);
});

test("a strong signal at the top tier means no tie", () => {
  assert.equal(run("workflow-change").tie, null);
  assert.equal(run("readme-only").tie, null);
});

test("declared low with a workflow change is underdeclared and high", () => {
  const j = run("declared-low-workflow");
  assert.equal(j.tier, "high");
  assert.equal(j.declared, "low");
  assert.equal(j.findings.length, 1);
  assert.match(j.findings[0], /^risk-underdeclared: declared low, computed high \(.*workflows/);
  assert.ok(ids(j).includes("declared-risk"));
});

test("declared medium with a workflow change is also underdeclared", () => {
  const j = run("declared-medium-workflow");
  assert.equal(j.tier, "high");
  assert.match(j.findings[0], /declared medium, computed high/);
});

test("declared high on a docs-only diff is high with no finding", () => {
  const j = run("declared-high-docs");
  assert.equal(j.tier, "high");
  assert.equal(j.declared, "high");
  assert.deepEqual(j.findings, []);
  assert.equal(j.tie, null);
});

test("declared low on a docs change stays low", () => {
  const j = run("declared-low-docs");
  assert.equal(j.tier, "low");
  assert.deepEqual(j.findings, []);
});

test("no intent, an empty risk and an unknown risk print declared none and no finding", () => {
  for (const name of ["readme-only", "declared-empty", "declared-banana", "declared-no-front-matter"]) {
    const j = run(name);
    assert.equal(j.declared, "none", name);
    assert.deepEqual(j.findings, [], name);
    assert.equal(j.tier, "low", name);
  }
  assert.match(withFixture("readme-only", (repo) => classify(repo).stdout), /^declared: none$/m);
});

test("two intents in the diff take the highest and name both", () => {
  const j = run("declared-two-intents");
  assert.equal(j.declared, "medium");
  const s = j.signals.find((x) => x.id === "declared-risk");
  assert.deepEqual(s.evidence, ["intent/2026-10-30-x/intent.md", "intent/2026-10-30-y/intent.md"]);
});

test("--intent names the intent file and wins over the diff", () => withFixture("readme-only", (repo) => {
  const f = join(repo, "..", "intent-" + Date.now() + ".md");
  writeFileSync(f, "---\nrisk: high\n---\n");
  try {
    const j = classify(repo, ["--json", "--intent", f]).json;
    assert.equal(j.declared, "high");
    assert.equal(j.tier, "high");
    const missing = classify(repo, ["--json", "--intent", f + ".nope"]).json;
    assert.equal(missing.declared, "none");
  } finally { rmSync(f, { force: true }); }
}));

test("demands follow the tier table", () => {
  const low = run("readme-only").demands;
  assert.deepEqual(low, { checks: ["build", "lint", "typecheck", "tests"], reviewers: [], approval: "none", local_decision: "allow", label: "none" });
  const med = run("new-dependency").demands;
  assert.deepEqual(med.reviewers, ["code-reviewer"]);
  assert.equal(med.approval, "Jody");
  assert.equal(med.local_decision, "ask");
  assert.equal(med.label, "none");
  const high = run("workflow-change").demands;
  assert.deepEqual(high.reviewers, ["code-reviewer", "security-architect"]);
  assert.equal(high.label, "risk:high");
});

// Step 8: REVIEW.md overrides (R16, R17, AC6). The policy is read from the merge base, so a pull
// request cannot loosen its own tier by editing REVIEW.md.
const policyOf = (name) => run(name);

test("paths.high lands a path high", () => {
  for (const name of ["policy-paths-high", "policy-paths-high-inline"]) {
    const j = policyOf(name);
    assert.equal(j.tier, "high", name);
    assert.ok(ids(j).includes("policy-high"), name);
    assert.equal(j.policy, "REVIEW.md");
  }
});

test("paths.medium lands a glob medium and * stays inside one directory", () => {
  const j = policyOf("policy-paths-medium");
  assert.equal(j.tier, "medium");
  assert.ok(ids(j).includes("policy-medium"));
  assert.equal(policyOf("policy-paths-medium-miss").tier, "low");
});

test("changed thresholds move size", () => {
  const a = policyOf("policy-thresholds");
  assert.equal(a.tier, "medium");
  assert.ok(ids(a).includes("size"));
  assert.equal(a.policy, "REVIEW.md");
  const b = policyOf("policy-thresholds-lines");
  assert.ok(ids(b).includes("size"));
  assert.ok(!ids(b).includes("no-test-change"));
});

test("tiers.<tier>.checks and reviewers change demands, never approval or local decision", () => {
  const j = policyOf("policy-tiers-reviewers");
  assert.deepEqual(j.demands.reviewers, ["code-reviewer"]);
  assert.equal(j.demands.approval, "none");
  assert.equal(j.demands.local_decision, "allow");
  assert.equal(j.policy, "REVIEW.md");
});

test("paths.low cannot lower workflows or hook-scripts", () => {
  const j = policyOf("policy-low-cannot-lower");
  assert.equal(j.tier, "high");
  assert.ok(ids(j).includes("workflows"));
  assert.ok(ids(j).includes("hook-scripts"));
  assert.equal(policyOf("policy-low-hook-script").tier, "high");
});

test("paths.low excuses the other path signals", () => {
  const j = withFixture("policy-low-excuses-auth", (repo) => isolatedClassify(repo, []).json);
  assert.ok(!ids(j).includes("auth"));
  assert.equal(j.tier, "low");
});

test("an unreadable block is ignored as a whole with the default tier", () => {
  const cases = {
    "policy-bad-syntax": /not a key/, "policy-bad-unknown-key": /unknown key weird\.key/,
    "policy-bad-threshold": /thresholds\.files_medium.*whole number/, "policy-bad-approval": /unknown key tiers\.medium\.approval/,
    "policy-bad-local-decision": /unknown key tiers\.high\.local_decision/, "policy-bad-nested": /not a key/
  };
  for (const [name, why] of Object.entries(cases)) {
    const j = policyOf(name);
    assert.match(j.policy, /^unreadable \(/, name);
    assert.match(j.policy, why, name);
    assert.equal(j.tier, "medium", name);
    assert.ok(!ids(j).includes("policy-high"), name);
    assert.equal(j.demands.approval, "Jody", name);
  }
  assert.match(withFixture("policy-bad-syntax", (repo) => classify(repo).stdout), /^policy: unreadable \(/m);
});

test("no section, no block comment and no REVIEW.md print policy: defaults", () => {
  assert.equal(policyOf("policy-no-section").policy, "defaults");
  assert.equal(policyOf("policy-commented-out").policy, "defaults");
  assert.equal(policyOf("policy-commented-out").tier, "medium");
  assert.equal(policyOf("readme-only").policy, "defaults");
  assert.match(policyOf("policy-no-block").policy, /^unreadable \(no fenced block/);
});

test("a REVIEW.md added in the same diff does not count", () => withFixture("readme-only", (repo) => {
  writeTree(repo, { "REVIEW.md": "## Risk tiers\n\n```yaml\npaths.high: [README.md]\n```\n", "README.md": "# changed\n" });
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "review");
  const j = classify(repo, ["--json"]).json;
  assert.equal(j.policy, "defaults");
  assert.equal(j.tier, "low");
}));

// Step 9: determinism and speed (N1 to N4, AC8)
const ALL_FIXTURES = ["tie-size-areas", "declared-two-intents", "env-var-new", "legal-gpl-dependency", "security-auth-path", "policy-paths-high"];

test("AC8: two runs on one fixture are byte-identical in text and JSON", () => {
  for (const name of ALL_FIXTURES) {
    withFixture(name, (repo) => {
      for (const args of [[], ["--json"]]) {
        const a = classify(repo, args), b = classify(repo, args);
        assert.equal(a.stdout, b.stdout, name);
        assert.equal(a.status, b.status, name);
      }
    });
  }
});

test("AC8: lists in the output are sorted by a fixed key", () => withFixture("declared-two-intents", (repo) => {
  const j = classify(repo, ["--json"]).json;
  assert.deepEqual(j.signals.map((s) => s.id), [...j.signals.map((s) => s.id)].sort());
  for (const s of j.signals) assert.deepEqual(s.evidence, [...s.evidence].sort());
}));

test("AC8: a run with the network pointed at a closed port gives the same output", () => {
  for (const name of ["legal-gpl-dependency", "tie-size-areas"]) {
    withFixture(name, (repo) => {
      const plain = classify(repo, ["--json"]);
      const env = { ...ENV, http_proxy: "http://127.0.0.1:9", https_proxy: "http://127.0.0.1:9", HTTP_PROXY: "http://127.0.0.1:9", HTTPS_PROXY: "http://127.0.0.1:9" };
      const r = spawnSync("python3", [SCRIPT, "--repo", repo, "--json"], { encoding: "utf8", env, timeout: 30_000 });
      assert.equal(r.stdout, plain.stdout, name);
    });
  }
});

test("N2: a 1000-line diff with both surface modules present is fast and finds both modules", () => {
  const head = {};
  for (let f = 0; f < 10; f++) head[`src/m${f}/file.js`] = Array.from({ length: 100 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
  head["tests/m.test.js"] = "expect(1)\n";
  withFixture("readme-only", (repo) => {
    writeTree(repo, head);
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "big");
    classify(repo, ["--json"]); // warm run
    const t0 = process.hrtime.bigint();
    const r = classify(repo, ["--json"]);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.deepEqual(r.json.notes, [], "both surface modules must be present for this timing to mean anything");
    assert.ok(ids(r.json).includes("size"));
    const limit = process.env.CI ? 6000 : 2000;
    assert.ok(ms < limit, `took ${ms.toFixed(0)} ms, limit ${limit}`);
  });
});

test("N4: a run leaves the repo exactly as it found it", () => withFixture("legal-gpl-dependency", (repo) => {
  const before = git(repo, "status", "--porcelain").stdout;
  const heads = git(repo, "for-each-ref").stdout;
  classify(repo, ["--json"]);
  assert.equal(git(repo, "status", "--porcelain").stdout, before);
  assert.equal(git(repo, "for-each-ref").stdout, heads);
  assert.equal(before, "");
}));

test("N1 and N3: the script names no network or model module and one git diff call feeds every rule", () => {
  const src = readFileSync(SCRIPT, "utf8");
  assert.equal((src.match(/urllib|requests|anthropic|http\.client|socket/g) || []).length, 0);
  assert.equal((src.match(/"diff",/g) || []).length, 1);
  assert.match(src, /GIT_TIMEOUT = 10/);
});

test("an unusually named file in the diff does not crash the run", () => withFixture("readme-only", (repo) => {
  writeTree(repo, { "weird name é.js": "x\n", "dir with space/a b.js": "y\n" });
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "weird");
  const r = classify(repo, ["--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
}));

// The shipped pro-ai-sdlc REVIEW.md template, read through the classifier from the merge base (R16, R28).
const TEMPLATE = readFileSync(join(ROOT, "plugins", "pro-ai-sdlc", "templates", "REVIEW.md"), "utf8");
const uncommentRisk = (t) => t.replace(/<!-- (Risk tiers:[\s\S]*?)\n-->\n/, "$1\n");

function templateRepo(reviewMd) {
  const files = {};
  for (let i = 0; i < 4; i++) files[`src/f${i}.js`] = "x\n";
  return buildRepo({
    base: { "REVIEW.md": reviewMd },
    head: { ...files, "ops/deploy/run.sh": "echo hi\n" },
  });
}

test("template block uncommented: policy is REVIEW.md and a changed threshold and an added high path both apply", () => {
  const edited = uncommentRisk(TEMPLATE)
    .replace("thresholds.files_medium: 10", "thresholds.files_medium: 3")
    .replace("paths.high: []", "paths.high: [ops/deploy/**]");
  assert.notEqual(edited, TEMPLATE);
  const repo = templateRepo(edited);
  try {
    const r = classify(repo, ["--json"]);
    assert.equal(r.json.policy, "REVIEW.md", r.stdout + r.stderr);
    assert.ok(ids(r.json).includes("size"), "files_medium 3 crossed by 5 files (the default 10 is not)");
    assert.ok(ids(r.json).includes("policy-high"), "added high path matched");
    assert.equal(r.json.tier, "high");
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("template block left commented: policy is defaults", () => {
  const repo = templateRepo(TEMPLATE);
  try {
    const r = classify(repo, ["--json"]);
    assert.equal(r.json.policy, "defaults", r.stdout + r.stderr);
    assert.ok(!ids(r.json).includes("policy-high"));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("template risk-tiers block has no em dash and no comma-and", () => {
  const block = TEMPLATE.slice(TEMPLATE.indexOf("<!-- Risk tiers"), TEMPLATE.indexOf("## Output format"));
  assert.doesNotMatch(block, /—|, and/);
});
