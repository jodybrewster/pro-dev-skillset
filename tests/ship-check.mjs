#!/usr/bin/env node
// Behaviour test for pro-ship's pr-check.py: discover, run, find, the floor step, the
// mutation check and stamp. Every case drives the script the way the skill does (one
// process per call, cwd at a throwaway git repo) with HOME, the plugin cache dir and git
// config pointed at temp folders so nothing on the real machine leaks in.
//
//   node tests/ship-check.mjs
//
// Also exported as runShipCheckCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRCHECK = join(ROOT, "plugins", "pro-ship", "scripts", "pr-check.py");
const FIXTURES = join(ROOT, "tests", "fixtures", "pr-check-stamp");

const baseEnv = (sandbox) => ({
  ...process.env,
  HOME: join(sandbox, "home"),
  PYTHONDONTWRITEBYTECODE: "1",
  CLAUDE_CODE_PLUGIN_CACHE_DIR: join(sandbox, "plugroot"),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
});

export function runShipCheckCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "ship-check-")));
  const env = baseEnv(sandbox);
  mkdirSync(env.HOME, { recursive: true });
  mkdirSync(env.CLAUDE_CODE_PLUGIN_CACHE_DIR, { recursive: true });
  let repoN = 0;
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 400) });

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
  // Run pr-check.py; `script` lets a case run a copy placed in a chosen plugin layout.
  const pc = (repo, args, opts = {}) => {
    const r = spawnSync("python3", [opts.script || PRCHECK, ...args], { cwd: repo, encoding: "utf8", env: { ...env, ...(opts.env || {}) }, timeout: 60000 });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", json };
  };
  const bytes = (f) => readFileSync(f);

  try {
    discoverCases();
    runCases();
    findFloorCases();
    mutationCases();
    stampCases();
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;

  // -------------------------------------------------------------------------
  // Step 2: discover (R3, AC3). Prints JSON and never writes.
  // -------------------------------------------------------------------------
  function discoverCases() {
    const cmds = (r) => Object.fromEntries((r.json?.steps || []).map((s) => [s.step, s.command]));
    const pkg = (scripts) => JSON.stringify({ name: "x", scripts });
    const four = { build: "b", lint: "l", typecheck: "t", test: "x" };
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    let repo = mkrepo({ "package.json": pkg(four), "pnpm-lock.yaml": "" });
    let r = pc(repo, ["discover"]);
    add("d1 package.json with pnpm-lock names pnpm run for all four", "pnpm run build, lint, typecheck, test",
      eq(cmds(r), { build: "pnpm run build", lint: "pnpm run lint", typecheck: "pnpm run typecheck", test: "pnpm run test" }), r.stdout + r.stderr);
    add("d1b discover writes nothing", "empty git status and no .pro-dev", git(repo, "status", "--short").stdout.trim() === "" && !existsSync(join(repo, ".pro-dev")), git(repo, "status", "--short").stdout);

    repo = mkrepo({ "package.json": pkg({ build: "b", test: "x" }), "tsconfig.json": "{}", "pnpm-lock.yaml": "" });
    r = pc(repo, ["discover"]);
    add("d2 tsconfig with no typecheck script gives tsc --noEmit through the package manager", "pnpm exec tsc --noEmit",
      cmds(r).typecheck === "pnpm exec tsc --noEmit" && cmds(r).lint === null, JSON.stringify(cmds(r)));

    repo = mkrepo({ "package.json": pkg(four), "bun.lock": "" });
    r = pc(repo, ["discover"]);
    add("d3 bun.lock gives bun run", "bun run build", cmds(r).build === "bun run build", JSON.stringify(cmds(r)));
    repo = mkrepo({ "package.json": pkg(four), "yarn.lock": "" });
    r = pc(repo, ["discover"]);
    add("d4 yarn.lock gives yarn run", "yarn run test", cmds(r).test === "yarn run test", JSON.stringify(cmds(r)));
    repo = mkrepo({ "package.json": pkg(four) });
    r = pc(repo, ["discover"]);
    add("d5 no lockfile gives npm run", "npm run lint", cmds(r).lint === "npm run lint", JSON.stringify(cmds(r)));

    repo = mkrepo({ "pyproject.toml": "[tool.ruff]\nline-length = 100\n[tool.mypy]\nstrict = true\n", "tests/test_a.py": "def test_a(): pass\n" });
    r = pc(repo, ["discover"]);
    add("d6 pyproject with ruff, mypy and tests", "ruff check, mypy ., pytest",
      cmds(r).lint === "ruff check" && cmds(r).typecheck === "mypy ." && cmds(r).test === "pytest" && cmds(r).build === null, JSON.stringify(cmds(r)));

    repo = mkrepo({ Makefile: "check:\n\techo ok\n" });
    r = pc(repo, ["discover"]);
    add("d7 a Makefile with only check gives make check", "make check, the four standard steps not-found",
      cmds(r).check === "make check" && cmds(r).build === null && cmds(r).test === null, JSON.stringify(cmds(r)));
    repo = mkrepo({ Makefile: "build:\n\ttrue\ntest:\n\ttrue\n" });
    r = pc(repo, ["discover"]);
    add("d7b Makefile build and test targets", "make build and make test", cmds(r).build === "make build" && cmds(r).test === "make test" && cmds(r).lint === null, JSON.stringify(cmds(r)));

    repo = mkrepo({});
    r = pc(repo, ["discover"]);
    add("d8 an empty repo reports four not-found", "build, lint, typecheck, test all not-found",
      (r.json?.steps || []).length === 4 && r.json.steps.every((s) => s.command === null && s.status === "not-found"), r.stdout + r.stderr);

    repo = mkrepo({
      "package.json": pkg(four), "pnpm-lock.yaml": "",
      "CLAUDE.md": "# X\n\n## Verifying your work\n\n```bash\n# a comment\nnode tests/check.mjs\nmake lint\n```\n",
    });
    r = pc(repo, ["discover"]);
    add("d9 a CLAUDE.md verify block is the whole list and skips package.json", "verify:1 and verify:2 only",
      eq((r.json?.steps || []).map((s) => [s.step, s.command]), [["verify:1", "node tests/check.mjs"], ["verify:2", "make lint"]]), r.stdout + r.stderr);
    repo = mkrepo({ "AGENTS.md": "## Verification\n\n```sh\nnot this\n```\n```bash\nmake t\n```\n" });
    r = pc(repo, ["discover"]);
    add("d9b AGENTS.md is read and the first bash block wins", "verify:1 make t", eq((r.json?.steps || []).map((s) => s.command), ["make t"]), r.stdout + r.stderr);
    repo = mkrepo({ "CLAUDE.md": "## Verify\n\n```bash\ntrue\n```\n\npr-check timeout: 900\n" });
    r = pc(repo, ["discover"]);
    add("d10 the pr-check timeout line is reported", "timeout 900", r.json?.timeout === 900, r.stdout);
    repo = mkrepo({ "CLAUDE.md": "## Verify\n\n```bash\necho one \\\n  two \\\n  three\necho four\n```\n" });
    r = pc(repo, ["discover"]);
    add("d11 a backslash continuation joins into one step", "two steps, the first holds one two three",
      (r.json?.steps || []).length === 2 && /^echo one\s+two\s+three$/.test(r.json.steps[0].command) && r.json.steps[1].command === "echo four", r.stdout + r.stderr);
    repo = mkrepo({});
    r = pc(repo, ["discover"]);
    add("d10b the default timeout is 300", "timeout 300", r.json?.timeout === 300, r.stdout);
  }

  // -------------------------------------------------------------------------
  // Step 3: run, one step per call (R4, N5, AC4).
  // -------------------------------------------------------------------------
  function runCases() {
    const verify = (cmds, extra = "") => ({ "CLAUDE.md": `## Verify\n\n\`\`\`bash\n${cmds.join("\n")}\n\`\`\`\n${extra}` });
    const runJson = (repo) => { try { return JSON.parse(readFileSync(join(repo, ".pro-dev", "ship", "run.json"), "utf8")); } catch { return null; } };
    const check = (repo, step) => (runJson(repo)?.checks || []).find((c) => c.step === step);

    let repo = mkrepo(verify(["echo hello", "sh -c 'echo boom; exit 3'", "echo third"]));
    let head = git(repo, "rev-parse", "HEAD").stdout.trim();
    let r = pc(repo, ["run", "--step", "verify:1"]);
    let c = check(repo, "verify:1");
    add("r1 a passing command records pass, exit 0 and its output", "status pass, exit_code 0, tail [hello]",
      r.status === 0 && c?.status === "pass" && c.exit_code === 0 && c.command === "echo hello" && JSON.stringify(c.output_tail) === '["hello"]', r.stdout + r.stderr);
    add("r1b run.json is keyed by HEAD", "head equals HEAD", runJson(repo)?.head === head, JSON.stringify(runJson(repo)));
    add("r1c .pro-dev is excluded and the tree stays clean", "git status empty",
      git(repo, "status", "--short").stdout.trim() === "", git(repo, "status", "--short").stdout);
    r = pc(repo, ["run", "--step", "verify:2"]);
    c = check(repo, "verify:2");
    add("r2 a failing command records fail and its exit code", "status fail, exit_code 3",
      c?.status === "fail" && c.exit_code === 3 && c.output_tail.includes("boom"), r.stdout + r.stderr);
    add("r2b a second --step merges into run.json", "both records present", !!check(repo, "verify:1") && !!check(repo, "verify:2") && runJson(repo)?.checks.length === 2, JSON.stringify(runJson(repo)));
    pc(repo, ["run", "--step", "verify:1"]);
    add("r2c rerunning a step replaces its record", "still two records", runJson(repo)?.checks.length === 2, JSON.stringify(runJson(repo)));
    r = pc(repo, ["run", "--step", "nonsense"]);
    add("r2d an unknown step name is refused", "non-zero exit", r.status !== 0, r.stdout);

    const pidFile = join(sandbox, "sleeper.pid");
    repo = mkrepo(verify([`sh -c 'sleep 30 & echo $! > ${pidFile}; wait'`], "\npr-check timeout: 1\n"));
    const t0 = Date.now();
    r = pc(repo, ["run", "--step", "verify:1"]);
    c = check(repo, "verify:1");
    add("r3 a sleeping command is killed at the limit and records timeout", "status timeout, exit_code null, under 15 s",
      c?.status === "timeout" && c.exit_code === null && Date.now() - t0 < 15000, r.stdout + r.stderr);
    let alive = true;
    try { process.kill(Number(readFileSync(pidFile, "utf8").trim()), 0); } catch { alive = false; }
    add("r3b the whole process group is killed on timeout", "the grandchild sleeper is gone", !alive, `pid ${readFileSync(pidFile, "utf8")}`);

    repo = mkrepo(verify(["seq 1 50"]));
    pc(repo, ["run", "--step", "verify:1"]);
    c = check(repo, "verify:1");
    add("r4 output longer than 20 lines is tailed to 20", "20 lines, 31 to 50", c?.output_tail.length === 20 && c.output_tail[0] === "31" && c.output_tail[19] === "50", JSON.stringify(c));

    const tokens = ["ghp_" + "a1B2".repeat(9), "sk-ant-" + "api03-" + "Zz9".repeat(10), "AKIA" + "IOSFODNN7EXAMPLE"];
    repo = mkrepo(verify(tokens.map((t) => `echo token=${t}`)));
    for (let i = 1; i <= 3; i++) pc(repo, ["run", "--step", `verify:${i}`]);
    const all = JSON.stringify(runJson(repo));
    add("r5 ghp_, sk-ant- and AKIA tokens in output become [redacted]", "no token survives and [redacted] appears",
      tokens.every((t) => !all.includes(t)) && (all.match(/\[redacted\]/g) || []).length >= 3, all);

    // Tokens are built at run time so no literal credential sits in this file.
    const rep = (a, n) => a.repeat(n);
    const tokens2 = ["sk-proj-" + rep("Ab1_", 10), "npm_" + rep("aB3", 12), "sk_live_" + rep("Z9y", 10), "sk_test_" + rep("Q8w", 10),
      "xoxb-" + rep("1234-", 4) + "abcd", "glpat-" + rep("x1", 12), "ghs_" + rep("a1B2", 9), "github_pat_" + rep("Aa1_", 12)];
    repo = mkrepo(verify(tokens2.map((t) => `echo token=${t}`)));
    for (let i = 1; i <= tokens2.length; i++) pc(repo, ["run", "--step", `verify:${i}`]);
    const all2 = JSON.stringify(runJson(repo));
    add("r5b sk-proj-, npm_, sk_live_, sk_test_, xoxb-, glpat-, ghs_ and github_pat_ tokens are redacted", "no token survives",
      tokens2.every((t) => !all2.includes(t.slice(0, 14))) && (all2.match(/\[redacted\]/g) || []).length >= tokens2.length, all2);

    repo = mkrepo(verify(["echo hi"]));
    writeFileSync(join(repo, ".gitkeep"), "changed\n");
    r = pc(repo, ["run", "--step", "verify:1"]);
    add("r6 run refuses a dirty tree and names the file", "exit 1, message names .gitkeep, no run.json",
      r.status === 1 && /\.gitkeep/.test(r.stderr) && /commit/i.test(r.stderr) && !existsSync(join(repo, ".pro-dev", "ship", "run.json")), r.stdout + r.stderr);
    writeFileSync(join(repo, ".gitkeep"), "");
    r = pc(repo, ["run", "--step", "verify:1"]);
    add("r6b the same run passes on a clean tree", "exit 0", r.status === 0, r.stderr);

    repo = mkrepo(verify(["echo one", "echo two"]));
    r = pc(repo, ["run"]);
    add("r7 run with no step runs every discovered step and the floor", "two checks and a floor entry",
      r.status === 0 && runJson(repo)?.checks.length === 2 && typeof runJson(repo)?.floor === "string", r.stdout + r.stderr);
    repo = mkrepo({});
    pc(repo, ["run", "--step", "build"]);
    c = check(repo, "build");
    add("r8 a step with no command records not-found", "not-found, command null, empty tail",
      c?.status === "not-found" && c.command === null && c.exit_code === null && c.output_tail.length === 0, JSON.stringify(runJson(repo)));
  }
  // -------------------------------------------------------------------------
  // Step 4: sibling lookup and the floor step (R5, R28).
  // -------------------------------------------------------------------------
  function findFloorCases() {
    const FAKE = "import os, sys\nprint('fake floor-guard', sys.argv[1:])\nsys.exit(int(os.environ.get('FAKE_FLOOR', '0')))\n";
    let layN = 0;
    // A copy of pr-check.py in a chosen layout: "cache" is cache/mkt/pro-ship/0.3.0, "place" is plugins/pro-ship.
    const layout = (kind, { sibling = false } = {}) => {
      const base = join(sandbox, `lay${++layN}`);
      const own = kind === "cache" ? join(base, "cache", "mkt", "pro-ship", "0.3.0") : join(base, "plugins", "pro-ship");
      mkdirSync(join(own, "scripts"), { recursive: true });
      copyFileSync(PRCHECK, join(own, "scripts", "pr-check.py"));
      if (sibling) {
        mkdirSync(join(base, "plugins", "pro-quality", "scripts"), { recursive: true });
        writeFileSync(join(base, "plugins", "pro-quality", "scripts", "floor-guard.py"), FAKE);
      }
      return { base, script: join(own, "scripts", "pr-check.py") };
    };
    const install = (name) => { const d = join(sandbox, "inst", `${name}${++layN}`); mkdirSync(join(d, "scripts"), { recursive: true }); writeFileSync(join(d, "scripts", "floor-guard.py"), FAKE); return d; };
    const records = (obj) => writeFileSync(join(env.CLAUDE_CODE_PLUGIN_CACHE_DIR, "installed_plugins.json"), JSON.stringify({ version: 2, plugins: obj }));
    const none = () => rmSync(join(env.CLAUDE_CODE_PLUGIN_CACHE_DIR, "installed_plugins.json"), { force: true });
    const find = (repo, lay) => pc(repo, ["find", "pro-quality", "floor-guard.py"], { script: lay.script }).stdout.trim();

    const repo = mkrepo({});
    const userDir = install("user"), projDir = install("proj"), otherDir = install("other"), foreign = install("foreign");

    let lay = layout("place", { sibling: true });
    records({ "pro-quality@mkt": [{ scope: "user", installPath: userDir, version: "1" }] });
    add("f1 an in-place sibling folder wins over any record", "the plugins/pro-quality path",
      find(repo, lay) === join(lay.base, "plugins", "pro-quality", "scripts", "floor-guard.py"), find(repo, lay));

    lay = layout("cache");
    records({ "pro-quality@mkt": [{ scope: "user", installPath: userDir, version: "1" }, { scope: "project", projectPath: repo, installPath: projDir, version: "2" }] });
    add("f2 a project record for this repo beats the user record", "the project install", find(repo, lay) === join(projDir, "scripts", "floor-guard.py"), find(repo, lay));

    records({ "pro-quality@mkt": [{ scope: "user", installPath: userDir, version: "1" }, { scope: "project", projectPath: join(sandbox, "elsewhere"), installPath: otherDir, version: "3" }] });
    add("f3 a project record for another repo is ignored and the user record is used", "the user install", find(repo, lay) === join(userDir, "scripts", "floor-guard.py"), find(repo, lay));

    records({ "pro-quality@mkt": [{ scope: "user", installPath: userDir, version: "1" }, { scope: "local", projectPath: sandbox, installPath: projDir, version: "2" }] });
    add("f3b a local record for an ancestor of the repo counts", "the local install", find(repo, lay) === join(projDir, "scripts", "floor-guard.py"), find(repo, lay));

    records({ "pro-quality@other": [{ scope: "user", installPath: foreign, version: "1" }] });
    add("f3c a record from another marketplace is ignored", "not-installed", find(repo, lay) === "not-installed", find(repo, lay));

    records({ "pro-quality@mkt": [{ scope: "user", installPath: join(sandbox, "gone"), version: "1" }] });
    add("f3d a record whose install folder lacks the script is skipped", "not-installed", find(repo, lay) === "not-installed", find(repo, lay));

    none();
    add("f4 no installed_plugins.json gives not-installed", "not-installed", find(repo, lay) === "not-installed", find(repo, lay));

    const dog = mkrepo({ ".claude-plugin/marketplace.json": JSON.stringify({ name: "m", plugins: [{ name: "pro-quality", source: "./plugins/pro-quality" }] }), "plugins/pro-quality/scripts/floor-guard.py": FAKE });
    add("f5 the repo's own plugins/ copy is used when its marketplace lists the plugin", "the repo path", find(dog, lay) === join(dog, "plugins", "pro-quality", "scripts", "floor-guard.py"), find(dog, lay));
    const unlisted = mkrepo({ ".claude-plugin/marketplace.json": JSON.stringify({ name: "m", plugins: [] }), "plugins/pro-quality/scripts/floor-guard.py": FAKE });
    add("f5b a plugins/ copy the marketplace does not list is not used", "not-installed", find(unlisted, lay) === "not-installed", find(unlisted, lay));

    // run --step floor maps exit 0, 1 and 2 (R5).
    lay = layout("place", { sibling: true });
    const floorRepo = mkrepo({});
    const floorOf = (code) => {
      const r = pc(floorRepo, ["run", "--step", "floor"], { script: lay.script, env: { FAKE_FLOOR: String(code) } });
      return r.json;
    };
    add("f6 floor exit 0 is pass and the path used is recorded", "pass with sources.floor-guard",
      floorOf(0)?.floor === "pass" && floorOf(0).sources["floor-guard"] === join(lay.base, "plugins", "pro-quality", "scripts", "floor-guard.py"), JSON.stringify(floorOf(0)));
    add("f6b floor exit 1 is findings", "findings", floorOf(1)?.floor === "findings", JSON.stringify(floorOf(1)));
    add("f6c floor exit 2 is could-not-run", "could-not-run", floorOf(2)?.floor === "could-not-run", JSON.stringify(floorOf(2)));
    add("f6d a crash with another exit code is could-not-run", "could-not-run", floorOf(7)?.floor === "could-not-run", JSON.stringify(floorOf(7)));
    lay = layout("cache");
    const r = pc(floorRepo, ["run", "--step", "floor"], { script: lay.script });
    add("f7 a missing guard is not-installed", "not-installed in floor and sources",
      r.json?.floor === "not-installed" && r.json.sources["floor-guard"] === "not-installed", r.stdout + r.stderr);
    add("f7b the floor step leaves the tree clean", "empty git status", git(floorRepo, "status", "--short").stdout.trim() === "", git(floorRepo, "status", "--short").stdout);
  }
  // -------------------------------------------------------------------------
  // Step 5: the mutation check (R29, AC14, AC15). After every case the tree is clean and
  // the changed file is byte-identical to HEAD.
  // -------------------------------------------------------------------------
  function mutationCases() {
    const LIB0 = "def f(x):\n    return 0\n";
    const LIB1 = "def f(x):\n    if x > 5:\n        return 1\n    return 0\n";
    const TEST_NOASSERT = "import lib\nprint('ok')\n";
    const TEST_ASSERT = "import lib\nassert lib.f(10) == 1\nassert lib.f(0) == 0\nprint('ok')\n";
    const VERIFY = "## Verify\n\n```bash\npython3 test_lib.py\n```\n";
    // main holds `before`; a feature commit applies `after`. Returns the repo and the base sha.
    const scenario = (before, after, extra = "") => {
      const repo = mkrepo({ "CLAUDE.md": VERIFY + extra, ...before });
      const baseSha = git(repo, "rev-parse", "HEAD").stdout.trim();
      git(repo, "checkout", "-q", "-b", "feat");
      commit(repo, after, "feature");
      return { repo, baseSha };
    };
    const mutate = (s, extraArgs = [], opts = {}) => pc(s.repo, ["run", "--step", "mutation", "--base", s.baseSha, ...extraArgs], opts);
    const intact = (s, file) => {
      const committed = spawnSync("git", ["show", `HEAD:${file}`], { cwd: s.repo, env });
      return git(s.repo, "status", "--short").stdout.trim() === "" && Buffer.compare(bytes(join(s.repo, file)), committed.stdout) === 0;
    };
    const mut = (r) => r.json?.mutation;

    let s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_NOASSERT }, { "lib.py": LIB1 });
    let r = mutate(s);
    add("m1 an added untested condition survives", "survived on lib.py, accepted false, reason null",
      mut(r)?.status === "survived" && mut(r).file === "lib.py" && mut(r).reason === null && mut(r).accepted === false, r.stdout + r.stderr);
    add("m1b the tree is clean and lib.py matches HEAD", "clean and identical", intact(s, "lib.py"), git(s.repo, "status", "--short").stdout);

    s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_ASSERT }, { "lib.py": LIB1 });
    r = mutate(s);
    add("m2 the same condition with a test that covers it is killed", "killed on lib.py", mut(r)?.status === "killed" && mut(r).file === "lib.py", r.stdout + r.stderr);
    add("m2b the tree is clean and lib.py matches HEAD", "clean and identical", intact(s, "lib.py"), git(s.repo, "status", "--short").stdout);

    s = scenario({ "lib.py": LIB1, "test_lib.py": TEST_NOASSERT }, { "test_lib.py": TEST_ASSERT });
    r = mutate(s);
    add("m3 a test-only diff is skipped", "skipped, test-only diff, file null", mut(r)?.status === "skipped" && mut(r).reason === "test-only diff" && mut(r).file === null, r.stdout + r.stderr);

    s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_NOASSERT }, { "lib.py": LIB1 });
    r = mutate(s, ["--tier", "low"]);
    add("m4 tier low is skipped", "skipped, low tier", mut(r)?.status === "skipped" && mut(r).reason === "low tier", r.stdout + r.stderr);
    add("m4b low tier left the tree clean", "clean and identical", intact(s, "lib.py"), "");

    s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_NOASSERT }, { "lib.py": "def f(x):\n    y = 3\n    return 0\n" });
    r = mutate(s);
    add("m5 a diff with no condition is skipped", "skipped, no condition found", mut(r)?.status === "skipped" && mut(r).reason === "no condition found", r.stdout + r.stderr);

    s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_NOASSERT }, { "lib.py": LIB1 });
    git(s.repo, "rm", "-q", "CLAUDE.md");
    git(s.repo, "commit", "-q", "-m", "drop verify block");
    r = mutate(s);
    add("m6 no runnable test command is could-not-run", "could-not-run, no runnable test command", mut(r)?.status === "could-not-run" && mut(r).reason === "no runnable test command", r.stdout + r.stderr);
    add("m6b could-not-run left the tree clean", "clean and identical", intact(s, "lib.py"), "");

    s = scenario({ "lib2.py": LIB0, "test_lib.py": TEST_NOASSERT }, { "lib2.py": LIB1 });
    r = mutate(s);
    add("m7 a changed file no test names is skipped", "skipped, no related tests", mut(r)?.status === "skipped" && mut(r).reason === "no related tests", r.stdout + r.stderr);

    // An operator flip on a plain comparison and an && in JavaScript.
    s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_ASSERT }, { "lib.py": "def f(x):\n    return 1 if x > 5 and x < 100 else 0\n" });
    r = mutate(s);
    add("m7b an operator flip on a one-line conditional is killed by a covering test", "killed", mut(r)?.status === "killed", r.stdout + r.stderr);
    add("m7c the tree is clean after the operator flip", "clean and identical", intact(s, "lib.py"), "");

    // A test command that outlives the limit: killed mid-run, file restored.
    const SLOW = "## Verify\n\n```bash\nsh -c 'sleep 30; python3 test_lib.py'\n```\n\npr-check timeout: 1\n";
    s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_ASSERT }, { "lib.py": LIB1, "CLAUDE.md": SLOW });
    r = mutate(s);
    add("m8 a test command killed mid-run is could-not-run", "could-not-run, test command timed out", mut(r)?.status === "could-not-run" && mut(r).reason === "test command timed out", r.stdout + r.stderr);
    add("m8b the file is restored after the kill", "clean and identical", intact(s, "lib.py"), git(s.repo, "status", "--short").stdout);

    // The script itself is terminated mid-run: the finally path restores the file.
    const SLOW2 = "## Verify\n\n```bash\nsh -c 'sleep 30; python3 test_lib.py'\n```\n";
    s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_ASSERT }, { "lib.py": LIB1, "CLAUDE.md": SLOW2 });
    spawnSync("sh", ["-c", `python3 "$0" run --step mutation --base ${s.baseSha} >/dev/null 2>&1 & p=$!; sleep 2; kill -TERM $p; wait $p`, PRCHECK], { cwd: s.repo, env, timeout: 30000 });
    add("m9 the script killed with SIGTERM mid-run leaves the tree clean", "clean and identical", intact(s, "lib.py"), git(s.repo, "status", "--short").stdout);

    // JSX and generics: only operators with a space on both sides are flipped.
    s = scenario({ "lib.tsx": "export const f = (a, b) => 0;\n", "test_lib.py": "import sys\nsrc = open('lib.tsx').read()\nsys.exit(0 if 'return <Spinner />' in src else 1)\n" },
      { "lib.tsx": "export const f = (a, b) => {\n  return <Spinner />;\n  if (a < b) { return 1; }\n};\n" });
    r = mutate(s);
    add("m13 a JSX line is never mutated, the spaced comparison is", "survived (a mutated JSX line would break the test and read killed)", mut(r)?.status === "survived" && mut(r).file === "lib.tsx", r.stdout + r.stderr);
    s = scenario({ "lib.tsx": "export const f = (a, b) => 0;\n", "test_lib.py": "print('ok')\n" },
      { "lib.tsx": "export const f = (a: Array<string>) => {\n  return <Spinner />;\n};\n" });
    r = mutate(s);
    add("m13b a diff whose only angle brackets touch a letter is skipped", "skipped, no condition found", mut(r)?.status === "skipped" && mut(r).reason === "no condition found", r.stdout + r.stderr);

    {
      const v = mkrepo({ "CLAUDE.md": "## Verify\n\n```bash\necho a\necho b\n```\n" });
      let x = pc(v, ["run", "--step", "verify:1"]);
      x = pc(v, ["run", "--step", "verify:2"]);
      add("m15 run prints only the step just run", "one check, verify:2, and the head", x.json?.checks?.length === 1 && x.json.checks[0].step === "verify:2" && typeof x.json.head === "string", x.stdout + x.stderr);
    }

    // Line numbers come from git (newlines only); a form feed must not shift the mutated line.
    s = scenario({ "lib.py": "X = 1\x0c\ndef f(x):\n    return 0\n", "test_lib.py": TEST_NOASSERT }, { "lib.py": "X = 1\x0c\ndef f(x):\n    if x > 5:\n        return 1\n    return 0\n" });
    r = mutate(s);
    add("m10 a form feed before the changed line does not shift the mutation", "survived (a wrong line would break the file and read killed)", mut(r)?.status === "survived", r.stdout + r.stderr);
    add("m10b the bytes are restored exactly", "clean and identical", intact(s, "lib.py"), git(s.repo, "status", "--short").stdout);

    // A signal mid-run restores the file and kills the test child. SIGKILL cannot be caught, so a
    // restore marker is left and the next run recovers from it before the dirty-tree refusal.
    for (const sig of ["HUP", "INT"]) {
      const pidf = join(sandbox, `m11-${sig}.pid`);
      const SLOWP = `## Verify\n\n\`\`\`bash\nsh -c 'sleep 30 & echo $! > ${pidf}; wait; python3 test_lib.py'\n\`\`\`\n`;
      s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_ASSERT }, { "lib.py": LIB1, "CLAUDE.md": SLOWP });
      spawnSync("sh", ["-c", `python3 "$0" run --step mutation --base ${s.baseSha} >/dev/null 2>&1 & p=$!; sleep 2; kill -${sig} $p; wait $p`, PRCHECK], { cwd: s.repo, env, timeout: 30000 });
      add(`m11 SIG${sig} mid-run leaves the tree clean`, "clean and identical", intact(s, "lib.py"), git(s.repo, "status", "--short").stdout);
      let alive = true;
      try { process.kill(Number(readFileSync(pidf, "utf8").trim()), 0); } catch { alive = false; }
      add(`m11b SIG${sig} mid-run kills the test child`, "the sleeper is gone", !alive, `pid ${readFileSync(pidf, "utf8")}`);
      add(`m11c SIG${sig} leaves no restore marker`, "no marker", !existsSync(join(s.repo, ".pro-dev", "ship", "restore.json")), "");
    }
    {
      const SLOWK = "## Verify\n\n```bash\nsh -c 'sleep 4; python3 test_lib.py'\n```\n";
      s = scenario({ "lib.py": LIB0, "test_lib.py": TEST_ASSERT }, { "lib.py": LIB1, "CLAUDE.md": SLOWK });
      spawnSync("sh", ["-c", `python3 "$0" run --step mutation --base ${s.baseSha} >/dev/null 2>&1 & p=$!; sleep 1.5; kill -KILL $p; wait $p`, PRCHECK], { cwd: s.repo, env, timeout: 30000 });
      add("m12 after SIGKILL the file is left mutated with a restore marker", "dirty and a marker", git(s.repo, "status", "--short").stdout.includes("lib.py") && existsSync(join(s.repo, ".pro-dev", "ship", "restore.json")), git(s.repo, "status", "--short").stdout);
      spawnSync("sleep", ["4"]);
      r = pc(s.repo, ["run", "--step", "verify:1"]);
      add("m12b the next run restores the file, removes the marker and proceeds", "exit 0, clean and identical, no marker",
        r.status === 0 && intact(s, "lib.py") && !existsSync(join(s.repo, ".pro-dev", "ship", "restore.json")), r.stdout + r.stderr + git(s.repo, "status", "--short").stdout);
    }
  }
  // -------------------------------------------------------------------------
  // Step 6: stamp (R11 to R15, AC8, AC9, AC16). The contract is docs/pr-check-stamp.md.
  // -------------------------------------------------------------------------
  function stampCases() {
    const fixture = JSON.parse(readFileSync(join(FIXTURES, "valid-pass.json"), "utf8"));
    const passCheck = (step) => ({ step, command: `make ${step}`, status: "pass", exit_code: 0, output_tail: [] });
    const GOOD_RUN = { checks: ["build", "lint", "typecheck", "test"].map(passCheck), floor: "pass",
      mutation: { status: "killed", reason: null, file: "src/index.ts", accepted: false }, sources: { "floor-guard": "/x/floor-guard.py" } };
    const rv = (status, extra = {}) => ({ agent: status === "done" ? "pro-quality:code-reviewer" : null, status, blocking: 0, important: 0, range: null, ...extra });
    const GOOD_REV = { code: rv("done", { range: "BASE..HEAD" }), security: rv("skipped-no-surface") };

    // A repo with a base on main and one feature commit; run.json is written for HEAD with `over` applied.
    const prep = (over = {}) => {
      const repo = mkrepo({ "a.txt": "1\n" });
      const baseSha = git(repo, "rev-parse", "HEAD").stdout.trim();
      git(repo, "checkout", "-q", "-b", "feat");
      const head = commit(repo, { "a.txt": "2\n" }, "feature");
      mkdirSync(join(repo, ".pro-dev", "ship"), { recursive: true });
      writeFileSync(join(repo, ".pro-dev", "ship", "run.json"), JSON.stringify({ head, ...JSON.parse(JSON.stringify(GOOD_RUN)), ...over }));
      return { repo, baseSha, head };
    };
    const stamp = (p, rev = GOOD_REV, extra = []) => pc(p.repo, ["stamp", "--base", p.baseSha, "--reviewers", JSON.stringify(rev), ...extra]);
    const result = (r) => r.json?.result;
    const written = (p) => { try { return JSON.parse(readFileSync(join(p.repo, ".pro-dev", "ship", "pr-check.json"), "utf8")); } catch { return null; } };
    const keys = (o) => Object.keys(o || {}).sort().join(",");

    let p = prep();
    let r = stamp(p);
    const st = written(p);
    add("s1 a passing run and two reviewer records give result pass", "pass", r.status === 0 && result(r) === "pass" && st?.result === "pass", r.stdout + r.stderr);
    add("s1b the stamp has every field of the contract with the right shapes", "same keys as valid-pass.json at each level",
      keys(st) === keys(fixture) && keys(st?.checks?.[0]) === keys(fixture.checks[0]) && keys(st?.mutation) === keys(fixture.mutation)
      && keys(st?.reviewers) === keys(fixture.reviewers) && keys(st?.reviewers?.code) === keys(fixture.reviewers.code) && keys(st?.reviewers?.security) === keys(fixture.reviewers.security),
      `${keys(st)} vs ${keys(fixture)}`);
    add("s1c schema, head, base, tier and created are right", "1, HEAD sha, base sha, unclassified, ISO with offset",
      st?.schema === 1 && st.head === p.head && st.base === p.baseSha && st.tier === "unclassified" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(st.created) && /^[0-9a-f]{40}$/.test(st.base), JSON.stringify(st));
    add("s1d sources and the four checks are carried over", "floor-guard path and 4 checks", st?.sources?.["floor-guard"] === "/x/floor-guard.py" && st.checks.length === 4, JSON.stringify(st));
    add("s1e the tree is clean and .pro-dev/ is in the exclude file", "git status empty, exclude lists .pro-dev/",
      git(p.repo, "status", "--short").stdout.trim() === "" && readFileSync(resolve(p.repo, git(p.repo, "rev-parse", "--git-path", "info/exclude").stdout.trim()), "utf8").split("\n").includes(".pro-dev/"), git(p.repo, "status", "--short").stdout);

    const withRun = (over, rev = GOOD_REV, extra = []) => { const q = prep(over); return stamp(q, rev, extra); };
    const failing = { ...passCheck("test"), status: "fail", exit_code: 1 };
    add("s2 a failing check gives fail", "fail", result(withRun({ checks: [passCheck("build"), failing] })) === "fail", "");
    add("s2b floor findings give fail", "fail", result(withRun({ floor: "findings" })) === "fail", "");
    add("s2c a reviewer with blocking above 0 gives fail", "fail", result(withRun({}, { ...GOOD_REV, code: rv("done", { blocking: 2, important: 2 }) })) === "fail", "");
    add("s2d a failing check wins over reviewers that could not run", "fail", result(withRun({ checks: [failing] }, { code: rv("could-not-run"), security: rv("could-not-run") })) === "fail", "");

    const inc = (id, name, r) => add(id, "incomplete", result(r) === "incomplete", `${name}: ${r.stdout}${r.stderr}`);
    inc("s3 a code reviewer not-installed gives incomplete (AC9)", "code not-installed", withRun({}, { ...GOOD_REV, code: rv("not-installed") }));
    inc("s3b a floor of could-not-run gives incomplete (AC9)", "floor", withRun({ floor: "could-not-run" }));
    inc("s3c mutation survived gives incomplete (AC16)", "survived", withRun({ mutation: { status: "survived", reason: null, file: "a.py", accepted: false } }));
    inc("s3d mutation could-not-run gives incomplete (AC16)", "mutation cnr", withRun({ mutation: { status: "could-not-run", reason: "no runnable test command", file: null, accepted: false } }));
    inc("s3e a check that timed out gives incomplete", "timeout", withRun({ checks: [{ ...passCheck("test"), status: "timeout", exit_code: null }] }));
    inc("s3f a security reviewer not-installed gives incomplete", "security", withRun({}, { ...GOOD_REV, security: rv("not-installed") }));
    inc("s3g a reviewer that could not run gives incomplete", "code cnr", withRun({}, { ...GOOD_REV, code: rv("could-not-run") }));
    inc("s3h reviewers left out give incomplete", "no --reviewers", (() => { const q = prep(); return pc(q.repo, ["stamp", "--base", q.baseSha]); })());

    add("s4 --accept-mutation turns survived into pass and records accepted", "pass with accepted true",
      (() => { const q = prep({ mutation: { status: "survived", reason: null, file: "a.py", accepted: false } }); const x = stamp(q, GOOD_REV, ["--accept-mutation"]); return result(x) === "pass" && written(q)?.mutation.accepted === true; })(), "");
    add("s4b --accept-mutation does not accept a could-not-run", "incomplete and accepted false",
      (() => { const q = prep({ mutation: { status: "could-not-run", reason: "x", file: null, accepted: false } }); const x = stamp(q, GOOD_REV, ["--accept-mutation"]); return result(x) === "incomplete" && written(q)?.mutation.accepted === false; })(), "");
    add("s5 a floor of not-installed and a code reviewer run inline still pass", "pass",
      result(withRun({ floor: "not-installed" }, { code: rv("inline", { agent: "pro-ai-sdlc:reviewer" }), security: rv("inline", { agent: "pro-security:security-architect" }) })) === "pass", "");
    add("s5b an empty repo of not-found checks passes this line", "pass",
      result(withRun({ checks: ["build", "lint", "typecheck", "test"].map((s) => ({ step: s, command: null, status: "not-found", exit_code: null, output_tail: [] })) })) === "pass", "");

    // --base REF resolves to the merge base, not the tip of REF.
    {
      const q = prep();
      git(q.repo, "checkout", "-q", "main");
      git(q.repo, "commit", "-q", "--allow-empty", "-m", "main moved");
      git(q.repo, "checkout", "-q", "feat");
      const x = pc(q.repo, ["stamp", "--base", "main", "--reviewers", JSON.stringify(GOOD_REV)]);
      add("m14 stamp --base main records the merge base when main moved ahead", "base equals the branch point", x.json?.base === q.baseSha, x.stdout + x.stderr);
    }
    // A stamp needs a record for every discovered step, a floor and a mutation record.
    {
      const q = prep({ checks: [] });
      const x = stamp(q);
      add("s9 a run that skipped every discovered step is incomplete and names them", "incomplete, stderr names build and test",
        result(x) === "incomplete" && /build/.test(x.stderr) && /test/.test(x.stderr), x.stdout + x.stderr);
      const q2 = prep({ checks: ["build", "lint", "typecheck"].map(passCheck) });
      const x2 = stamp(q2);
      add("s9b one missing step makes it incomplete", "incomplete naming test", result(x2) === "incomplete" && /test/.test(x2.stderr), x2.stdout + x2.stderr);
      const q3 = prep();
      const rj = JSON.parse(readFileSync(join(q3.repo, ".pro-dev", "ship", "run.json"), "utf8"));
      delete rj.floor; delete rj.mutation;
      writeFileSync(join(q3.repo, ".pro-dev", "ship", "run.json"), JSON.stringify(rj));
      const x3 = stamp(q3);
      add("s9c a missing floor and mutation record is incomplete and named", "incomplete naming floor and mutation",
        result(x3) === "incomplete" && /floor/.test(x3.stderr) && /mutation/.test(x3.stderr), x3.stdout + x3.stderr);
    }
    // stamp recovers a left-over restore marker too.
    {
      const q = prep();
      const blob = git(q.repo, "rev-parse", "HEAD:a.txt").stdout.trim();
      writeFileSync(join(q.repo, ".pro-dev", "ship", "restore.json"), JSON.stringify({ path: "a.txt", blob }));
      writeFileSync(join(q.repo, "a.txt"), "mutated\n");
      const x = stamp(q);
      add("s10 stamp restores a marked file before the dirty-tree refusal", "pass, file restored, marker gone",
        x.status === 0 && readFileSync(join(q.repo, "a.txt"), "utf8") === "2\n" && !existsSync(join(q.repo, ".pro-dev", "ship", "restore.json")), x.stdout + x.stderr);
    }

    p = prep();
    commit(p.repo, { "a.txt": "3\n" }, "later");
    r = stamp(p);
    add("s6 a run.json for another HEAD is refused", "exit 1, message names run, no stamp", r.status === 1 && /run/i.test(r.stderr) && written(p) === null, r.stdout + r.stderr);
    p = prep();
    writeFileSync(join(p.repo, "a.txt"), "dirty\n");
    r = stamp(p);
    add("s6b a modified tracked file is refused with a message to commit", "exit 1, names a.txt and commit", r.status === 1 && /a\.txt/.test(r.stderr) && /commit/i.test(r.stderr) && written(p) === null, r.stdout + r.stderr);
    p = prep();
    rmSync(join(p.repo, ".pro-dev", "ship", "run.json"));
    r = stamp(p);
    add("s6c no run.json is refused", "exit 1 and no stamp", r.status === 1 && written(p) === null, r.stdout + r.stderr);
    p = prep();
    r = pc(p.repo, ["stamp", "--base", p.baseSha, "--reviewers", "{not json"]);
    add("s6d malformed --reviewers JSON is refused", "exit 1", r.status === 1 && written(p) === null, r.stdout + r.stderr);
    r = pc(p.repo, ["stamp", "--base", p.baseSha, "--reviewers", JSON.stringify({ code: rv("skipped-no-surface"), security: rv("done") })]);
    add("s6e skipped-no-surface on the code reviewer is refused", "exit 1", r.status === 1, r.stdout + r.stderr);

    // A linked worktree keeps info/exclude outside its own .git folder.
    p = prep();
    const wt = join(sandbox, `wt${++repoN}`);
    git(p.repo, "worktree", "add", "-q", "-b", "wtb", wt, p.head);
    mkdirSync(join(wt, ".pro-dev", "ship"), { recursive: true });
    writeFileSync(join(wt, ".pro-dev", "ship", "run.json"), JSON.stringify({ head: p.head, ...GOOD_RUN }));
    r = pc(wt, ["stamp", "--base", p.baseSha, "--reviewers", JSON.stringify(GOOD_REV)]);
    add("s7 in a linked worktree the stamp is written and the tree stays clean", "pass and empty status",
      r.status === 0 && result(r) === "pass" && git(wt, "status", "--short").stdout.trim() === "", r.stdout + r.stderr + git(wt, "status", "--short").stdout);

    // End to end: real run steps (with the fake floor sibling layout), then stamp.
    const lay = { base: join(sandbox, "e2e"), script: null };
    mkdirSync(join(lay.base, "plugins", "pro-ship", "scripts"), { recursive: true });
    mkdirSync(join(lay.base, "plugins", "pro-quality", "scripts"), { recursive: true });
    copyFileSync(PRCHECK, join(lay.base, "plugins", "pro-ship", "scripts", "pr-check.py"));
    writeFileSync(join(lay.base, "plugins", "pro-quality", "scripts", "floor-guard.py"), "import sys\nsys.exit(0)\n");
    lay.script = join(lay.base, "plugins", "pro-ship", "scripts", "pr-check.py");
    const e = mkrepo({ "CLAUDE.md": "## Verify\n\n```bash\necho built\n```\n", "a.txt": "1\n" });
    const eBase = git(e, "rev-parse", "HEAD").stdout.trim();
    git(e, "checkout", "-q", "-b", "feat");
    commit(e, { "a.txt": "2\n" }, "feature");
    const o = { script: lay.script };
    pc(e, ["run", "--step", "verify:1"], o);
    pc(e, ["run", "--step", "floor"], o);
    pc(e, ["run", "--step", "mutation", "--base", eBase], o);
    r = pc(e, ["stamp", "--base", eBase, "--reviewers", JSON.stringify(GOOD_REV)], o);
    add("s8 run steps then stamp give a passing stamp that names the floor script", "pass, skipped mutation, floor pass",
      r.json?.result === "pass" && r.json.floor === "pass" && r.json.mutation.status === "skipped" && r.json.sources["floor-guard"].endsWith("floor-guard.py"), r.stdout + r.stderr);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runShipCheckCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} ship check cases passed`);
  process.exit(bad ? 1 : 0);
}
