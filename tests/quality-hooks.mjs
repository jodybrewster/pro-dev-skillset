#!/usr/bin/env node
// Behaviour test for the pro-quality Stop hook, user-validation.py. Drives the
// script the way Claude Code does (one process per case, the JSON payload on
// stdin) against a throwaway git repo and a throwaway JSONL transcript, with
// HOME pointed at a temp dir so the real ~/.claude state is never touched.
//
//   node tests/quality-hooks.mjs
//
// Also exported as runQualityHookCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync, realpathSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "plugins", "pro-quality", "scripts", "user-validation.py");

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
}

// ---------------------------------------------------------------------------
// floor-guard.py cases. Every rule that can deny has one case that fires and one
// that stays quiet (AC4). Ids are f<number>; the table lists the pair per rule.
//
//   rule                 fires                  quiet
//   silenced-checker     f30, f31               f32, f33
//   test-made-easier     f40, f41               f42, f43, f44, f45
//   test-deleted         f50                    f51
//   assertion-removed    f55                    f56, f57
//   unfinished-work      f60                    f61, f62
//   rule-loosened        f80-f86b, f89          f87, f88, f92-f94b, f96, f97
//   new-exception        f95                    f90, f91, f96
//   marker rules vs .md  f35 (source file)      f34 (.md file)
//   floor-allow (R9)     f100 (clears)          f101, f102, f103a, f104 (do not clear)
//   bare TODO (R5)       none                   f36, f62
//   mode and range       f12/f13 range, f14 warn, f15 enforce, f16/f17 override
//   --check              f111 (exit 1)          f110 (exit 0), f112 (exit 2)
// ---------------------------------------------------------------------------
const FLOOR = join(ROOT, "plugins", "pro-quality", "scripts", "floor-guard.py");

function floorCases(sandbox, out) {
  const home = join(sandbox, "fhome");
  mkdirSync(home, { recursive: true });
  const env0 = { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  delete env0.CLAUDE_GUARD_DIR;
  let n = 0;
  const sh = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env: env0 });
  const put = (repo, files) => {
    for (const [p, c] of Object.entries(files)) {
      const f = join(repo, p);
      if (c === null) { rmSync(f, { force: true }); continue; }
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, c);
    }
  };
  const commit = (repo, files, msg) => { put(repo, files); sh(repo, "add", "-A"); sh(repo, "commit", "-q", "-m", msg); };
  const BASE = { "README.md": "hi\n", "src/app.js": "export const a = 1;\n", "src/b.js": "export const b = 2;\n" };
  // main with BASE, then branch feat with the commits applied. remote adds a bare origin
  // with main pushed; pushFirst pushes feat after its first commit so it tracks origin/feat.
  const scen = ({ base = BASE, commits = [], remote = false, pushFirst = false } = {}) => {
    const repo = join(sandbox, `fr${++n}`);
    mkdirSync(repo, { recursive: true });
    sh(repo, "init", "-q", "-b", "main");
    sh(repo, "config", "user.name", "t");
    sh(repo, "config", "user.email", "t@example.com");
    commit(repo, base, "init");
    if (remote) {
      const bare = join(sandbox, `fb${n}.git`);
      sh(sandbox, "init", "-q", "--bare", bare);
      sh(repo, "remote", "add", "origin", bare);
      sh(repo, "push", "-q", "origin", "main");
    }
    sh(repo, "checkout", "-q", "-b", "feat");
    commits.forEach((c, i) => {
      commit(repo, c.files, c.msg || `c${i}`);
      if (remote && pushFirst && i === 0) sh(repo, "push", "-q", "-u", "origin", "feat");
    });
    return repo;
  };
  const one = (files, msg) => scen({ commits: [{ files, msg }] });

  const run = (command, { cwd, mode, modeFloor, raw = null, payload = null } = {}) => {
    const gdir = join(sandbox, `fg${++n}`);
    mkdirSync(gdir, { recursive: true });
    if (mode) writeFileSync(join(gdir, "mode"), mode + "\n");
    if (modeFloor) writeFileSync(join(gdir, "mode.floor-guard"), modeFloor + "\n");
    const input = raw !== null ? raw : JSON.stringify(payload || { tool_name: "Bash", cwd, tool_input: { command } });
    const t0 = Date.now();
    const r = spawnSync("python3", [FLOOR], { input, encoding: "utf8", timeout: 30_000, env: { ...env0, CLAUDE_GUARD_DIR: gdir } });
    let json = null;
    try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* not json */ }
    let log = "";
    try { log = readFileSync(join(gdir, "warn.log"), "utf8"); } catch { /* none */ }
    const h = json?.hookSpecificOutput || {};
    const text = json?.systemMessage ?? h.permissionDecisionReason ?? "";
    const found = [...text.matchAll(/^ {2}([a-z-]+) {2}(\S+):(\d+) {2}(.*)$/gm)].map((m) => ({ rule: m[1], file: m[2], line: Number(m[3]), text: m[4] }));
    return { status: r.status, json, stdout: r.stdout, stderr: r.stderr, log, text, found, ctx: h.additionalContext || "", deny: h.permissionDecision === "deny", ms: Date.now() - t0 };
  };
  const push = (repo, o = {}) => run("git push", { cwd: repo, ...o });
  const rules = (r) => r.found.map((f) => f.rule);
  const has = (r, rule, file) => r.found.some((f) => f.rule === rule && (!file || f.file === file));
  const quiet = (r) => r.status === 0 && !r.stdout.trim();
  const add = (id, expect, r, ok) => out.results.push({ id, expect, actual: ok ? expect : "other", ok, reason: ok ? "" : `status ${r.status} stdout ${String(r.stdout).slice(0, 300)} stderr ${String(r.stderr).slice(0, 200)}` });
  const BAD = { "src/app.js": "export const a = 1;\n// eslint-disable-next-line no-console\nconsole.log(a);\n" };

  // ---- step 1: gating, range, mode, output, could-not-run -------------------
  let repo = one(BAD, "add log");
  let r = run("git commit -m x", { cwd: repo });
  add("f1 git commit is silent", "silent", r, quiet(r));
  r = run("git push --dry-run", { cwd: repo });
  add("f2 git push --dry-run is silent", "silent", r, quiet(r));
  r = run("git push -n origin feat", { cwd: repo });
  add("f2b git push -n is silent", "silent", r, quiet(r));
  r = run("ls -la", { cwd: repo });
  add("f3 ls is silent", "silent", r, quiet(r));
  r = run("git commit -F - <<'EOF'\nthen git push and gh pr create\nEOF", { cwd: repo });
  add("f4 a heredoc body that mentions git push is silent", "silent", r, quiet(r));
  r = run("echo gh pr create && echo git push", { cwd: repo });
  add("f4b echo of the words is silent", "silent", r, quiet(r));
  r = run('git commit -m "gh pr create"', { cwd: repo });
  add("f4c a commit message with the words is silent", "silent", r, quiet(r));
  r = push(one({ "src/app.js": "export const a = 2;\n" }, "clean"));
  add("f5 a clean diff is silent", "silent", r, quiet(r));
  r = push(one({ "README.md": "hi there\n// eslint-disable-next-line\n" }, "docs"));
  add("f6 a README-only diff is silent", "silent", r, quiet(r));

  r = push(repo);
  add("f7 git push acts", "fired", r, r.status === 0 && has(r, "silenced-checker", "src/app.js"));
  r = run("gh pr create --title x --body y", { cwd: repo });
  add("f8 gh pr create acts", "fired", r, r.status === 0 && has(r, "silenced-checker"));
  r = run(`cd ${repo} && git push origin feat`, { cwd: sandbox });
  add("f9 cd <path> && git push acts on that repo", "fired", r, has(r, "silenced-checker"));
  r = run(`git -C ${repo} push`, { cwd: sandbox });
  add("f10 git -C <path> push acts on that repo", "fired", r, has(r, "silenced-checker"));
  r = run(`bash -c "git push"`, { cwd: repo });
  add("f11 bash -c \"git push\" acts", "fired", r, has(r, "silenced-checker"));
  r = run("cd $SOMEWHERE && git push", { cwd: repo });
  add("f11b an unresolvable target allows and says the floor was not checked", "not checked", r, r.status === 0 && !r.deny && /not checked/i.test(r.text));

  // range: upstream for push, default branch for gh pr create
  repo = scen({ remote: true, pushFirst: true, commits: [{ files: BAD, msg: "bad" }, { files: { "src/b.js": "export const b = 3;\n" }, msg: "clean" }] });
  r = push(repo, { mode: "enforce" });
  add("f12 git push judges upstream..HEAD, so an already pushed finding is not judged", "silent", r, quiet(r));
  r = run("gh pr create --fill", { cwd: repo, mode: "enforce" });
  add("f13 gh pr create judges against the default branch, never the upstream", "denied", r, r.deny && has(r, "silenced-checker"));
  repo = scen({ remote: true, pushFirst: true, commits: [{ files: BAD, msg: "bad" }] });
  r = run("gh pr create --fill", { cwd: repo });
  add("f13b a branch whose upstream equals HEAD still has its PR diff judged", "fired", r, has(r, "silenced-checker"));
  r = push(repo);
  add("f13c git push on that same branch has an empty upstream range", "silent", r, quiet(r));

  // mode and output
  repo = one(BAD, "bad");
  r = push(repo);
  add("f14 warn is the default: systemMessage, additionalContext, warn.log, allowed", "warn", r,
    r.status === 0 && !r.deny && /warn mode/.test(r.text) && r.ctx.includes("silenced-checker") && /silenced-checker/.test(r.log) && /floor-guard/.test(r.log)
    && /src\/app\.js:2/.test(r.text) && /floor-allow:/.test(r.text));
  r = push(repo, { mode: "enforce" });
  add("f15 mode=enforce denies naming the finding and both ways to clear it", "deny", r,
    r.status === 0 && r.deny && r.text.includes("silenced-checker") && r.text.includes("src/app.js") && /floor-allow:/.test(r.text) && /fix/i.test(r.text));
  r = push(repo, { mode: "enforce", modeFloor: "warn" });
  add("f16 mode.floor-guard=warn overrides mode=enforce", "warn", r, r.status === 0 && !r.deny && /warn mode/.test(r.text));
  r = push(repo, { mode: "warn", modeFloor: "enforce" });
  add("f17 mode.floor-guard=enforce overrides mode=warn", "deny", r, r.deny);
  r = run("gh pr create --fill", { cwd: repo, mode: "enforce" });
  add("f17b enforce denies gh pr create too", "deny", r, r.deny);

  // could not run
  const orphan = one({ "src/a.js": "x\n" }, "c");
  sh(orphan, "checkout", "-q", "--orphan", "lone");
  commit(orphan, { "z.js": "// eslint-disable-line\n" }, "lone commit");
  r = push(orphan, { mode: "enforce" });
  add("f18 no merge base allows and says the floor was not checked", "not checked", r, r.status === 0 && !r.deny && /not checked/i.test(r.text) && !/clean/i.test(r.text) && /could-not-run/.test(r.log));
  const plain = join(sandbox, "notgit");
  mkdirSync(plain, { recursive: true });
  r = push(plain, { mode: "enforce" });
  add("f19 a non-git cwd allows and says the floor was not checked", "not checked", r, r.status === 0 && !r.deny && /not checked/i.test(r.text));
  r = run(null, { raw: "not json" });
  add("f20 a malformed payload exits 0 with no output", "silent", r, quiet(r));
  r = run(null, { raw: "" });
  add("f20b an empty payload exits 0 with no output", "silent", r, quiet(r));
  r = run(null, { payload: { tool_name: "Bash", tool_input: { command: 42 } } });
  add("f20c a non-string command exits 0 with no output", "silent", r, quiet(r));

  // ---- step 2: the diff rules that need no CONSTRAINTS.md -------------------
  const MARKERS = ["// @ts-ignore", "// @ts-nocheck", "/* eslint-disable */", "// biome-ignore lint: x", "x = 1  # noqa", "y = 2  # type: ignore",
    "z = 3  # pyright: ignore", "/* istanbul ignore next */", "/* c8 ignore next */", "// nosemgrep", "key  // gitleaks:allow", "// Stryker disable all"];
  r = push(one({ "src/m.js": MARKERS.join("\n") + "\n" }, "markers"));
  add("f30 every silenced-checker marker fires", "12 findings", r, rules(r).filter((x) => x === "silenced-checker").length === MARKERS.length);
  r = push(one({ "src/app.js": "export const a = 1;\n// eslint-disable-next-line no-console\n" }, "m"));
  add("f31 silenced-checker reports the new-side line number", "line 2", r, r.found.some((f) => f.rule === "silenced-checker" && f.line === 2));
  r = push(one({ "src/m.js": "// we never disable lint here\nconst ignoreList = [];\n" }, "m"));
  add("f32 prose near the markers stays quiet", "silent", r, quiet(r));
  r = push(one({ "src/app.js": "export const a = 1;\n" }, "m"));
  add("f33 a changed line with no marker stays quiet", "silent", r, quiet(r));
  r = push(one({ "docs/a.md": "Use `eslint-disable` sparingly. `it.skip(` and raise NotImplementedError are named here.\n", "SKILL.md": "# x\n.skip( and # noqa\n", "tests/NOTES.md": "xit( and .skip(\n" }, "docs"));
  add("f34 a .md file naming the markers is not reported by the marker rules (R4a)", "silent", r, quiet(r));
  r = push(one({ "src/a.js": "// eslint-disable-line\nraise NotImplementedError\n", "tests/a.test.js": "it.skip('x', () => {});\n" }, "src"));
  add("f35 the same text in source files is reported by all three marker rules", "3 rules", r,
    ["silenced-checker", "unfinished-work", "test-made-easier"].every((x) => has(r, x)));
  r = push(one({ "src/app.js": "export const a = 1;\n// TODO: tidy this up\n// FIXME later\n" }, "todo"));
  add("f36 a bare TODO never fires", "silent", r, quiet(r));

  const SKIPS = ["it.skip('a', f);", "it.todo('b');", "xit('c', f);", "xdescribe('d', f);", "@pytest.mark.skip(reason='x')", "pytest.skip('y')", "t.Skip(\"z\")", "describe.skip('e', f);"];
  r = push(one({ "tests/s.test.js": SKIPS.join("\n") + "\n" }, "skips"));
  add("f40 every test-made-easier marker fires in a test file", "8 findings", r, rules(r).filter((x) => x === "test-made-easier").length === SKIPS.length);
  const testPaths = ["a.test.ts", "b.spec.ts", "c_test.go", "test_d.py", "tests/e.js", "test/f.js", "__tests__/g.js", "pkg/tests/deep/h.js"];
  r = push(one(Object.fromEntries(testPaths.map((p) => [p, "foo.skip('x')\n"])), "paths"));
  add("f41 every kind of test path counts as a test file", "8 files", r, testPaths.every((p) => has(r, "test-made-easier", p)));
  r = push(one({ "src/protest.js": "foo.skip('x')\n", "testing/x.js": "foo.skip('x')\n", "src/latest_tests.js": "foo.skip('x')\n" }, "nontest"));
  add("f42 paths that only look like tests do not count", "silent", r, quiet(r));
  r = push(one({ "tests/a.test.js": "it('works', () => {});\n" }, "unskipped"));
  add("f43 an unskipped test stays quiet", "silent", r, quiet(r));
  r = push(one({ "src/a.js": "const o = { skip(x) {} };\nit.skip('x')\n" }, "src skip"));
  add("f44 .skip( in a non-test file is not test-made-easier", "no rule", r, !has(r, "test-made-easier"));
  r = push(one({ "tests/a.test.js": "// skipping nothing\nconst skipped = 1;\n" }, "words"));
  add("f45 the word skip without a marker stays quiet", "silent", r, quiet(r));

  const T0 = { ...BASE, "tests/a.test.js": "it('a', () => {\n  expect(1).toBe(1);\n  expect(2).toBe(2);\n});\n", "tests/gone.test.js": "x\n" };
  repo = scen({ base: T0, commits: [{ files: { "tests/gone.test.js": null }, msg: "rm test" }] });
  r = push(repo);
  add("f50 a deleted test file fires test-deleted", "fired", r, has(r, "test-deleted", "tests/gone.test.js"));
  repo = scen({ base: T0, commits: [{ files: { "src/b.js": null }, msg: "rm src" }] });
  r = push(repo);
  add("f51 a deleted source file stays quiet", "silent", r, quiet(r));

  repo = scen({ base: T0, commits: [{ files: { "tests/a.test.js": "it('a', () => {\n});\n" }, msg: "drop asserts" }] });
  r = push(repo);
  add("f55 removed assertions with no replacement fire at the old-side line", "fired", r,
    r.found.some((f) => f.rule === "assertion-removed" && f.file === "tests/a.test.js" && f.line === 2) && /2/.test(r.text));
  repo = scen({ base: T0, commits: [{ files: { "tests/a.test.js": "it('a', () => {\n  expect(1).toEqual(1);\n  expect(2).toEqual(2);\n});\n" }, msg: "rewrite" }] });
  r = push(repo);
  add("f56 assertions rewritten to the same count stay quiet", "silent", r, quiet(r));
  repo = scen({ base: { ...BASE, "src/check.js": "assert(x);\nexpect(y);\n" }, commits: [{ files: { "src/check.js": "run();\n" }, msg: "src" }] });
  r = push(repo);
  add("f57 a removed assertion in a non-test file stays quiet", "silent", r, quiet(r));

  const STUBS = ["throw new Error('Not implemented');", "raise NotImplementedError", "todo!();", "unimplemented!();", "try { f(); } catch {}", "try { f(); } catch (e) {}", "except: pass"];
  r = push(one({ "src/stub.js": STUBS.join("\n") + "\n" }, "stubs"));
  add("f60 every unfinished-work form fires", "7 findings", r, rules(r).filter((x) => x === "unfinished-work").length === STUBS.length);
  r = push(one({ "src/real.js": "throw new Error('bad input');\ntry { f(); } catch (e) { log(e); }\n" }, "real"));
  add("f61 real error handling stays quiet", "silent", r, quiet(r));
  r = push(one({ "src/real.js": "// TODO\n/* TODO: later */\n" }, "todo"));
  add("f62 a TODO comment stays quiet", "silent", r, quiet(r));

  // secrets and trimming (AC6): tokens are built at run time
  const ghTok = ["gh", "p_", "aB3dE6".repeat(6)].join("");
  const antTok = ["sk", "-ant-", "api03-", "Zz9Yy8".repeat(5)].join("");
  const awsTok = ["AK", "IA", "IOSFODNN7EXAMPLE"].join("");
  r = push(one({ "src/k.js": `// eslint-disable-line ${ghTok}\n// eslint-disable-line ${antTok}\n// eslint-disable-line ${awsTok}\n` }, "keys"));
  add("f70 credentials print as [redacted] and never as the token", "redacted", r,
    r.found.length === 3 && (r.text.match(/\[redacted\]/g) || []).length === 3 && !r.text.includes(ghTok) && !r.text.includes(antTok) && !r.text.includes(awsTok) && !r.log.includes(ghTok) && !r.ctx.includes(ghTok));
  const longLine = "// eslint-disable-next-line " + "y".repeat(200);
  r = push(one({ "src/long.js": longLine + "\n" }, "long"));
  add("f71 a line is trimmed to 120 characters", "trimmed", r, r.found.length === 1 && r.found[0].text === longLine.slice(0, 120));
  r = push(one({ "src/k.js": `// eslint-disable-line ${ghTok}\n` }, "k"), { mode: "enforce" });
  add("f72 the deny reason redacts too", "redacted", r, r.deny && r.text.includes("[redacted]") && !r.text.includes(ghTok));

  // ---- step 3: CONSTRAINTS.md -----------------------------------------------
  const CBASE = (o = {}) => o.text ?? [
    "# Constraints", "", "Read this before writing code. Do not weaken it to make a change pass.", "",
    "## Floor", "", "- No secrets in tracked files: gitleaks and the push gate", "- Tests stay: never delete a test to pass", "",
    "## Enforced with numbers", "", "| Dimension | Rule | Checked by | Runs at |", "|---|---|---|---|",
    `| Coverage | ${o.cov ?? ">= 80% lines"} | npm test | CI |`, `| Bundle | ${o.bundle ?? "<= 200 KB"} | npm run size | CI |`,
    `| Cycles | ${o.cycles ?? "5 allowed"} | npm run cycles | CI |`, `| Complexity | ${o.cx ?? "at most 10 per function"} | lint | CI |`, ...(o.extraRow ? [o.extraRow] : []), "",
    "## Measured, not yet enforced", "", "| Metric | Today | Direction |", "|---|---|---|", `| Lint warnings | ${o.warn ?? "12"} | down |`, "",
    "## Exceptions", "", "| ID | Rule | Path | Reason | Owner | Expires |", "|---|---|---|---|---|---|", ...(o.exc ?? ["| E1 | silenced-checker | src/x.ts | legacy | maintainer | 2026-12-31 |"]), "",
    ...(o.testFiles ? [`Test files: ${o.testFiles}`, ""] : []),
  ].join("\n");
  const cscen = (before, after) => scen({ base: { ...BASE, "CONSTRAINTS.md": CBASE(before) }, commits: [{ files: { "CONSTRAINTS.md": CBASE(after) }, msg: "constraints" }] });
  const loosens = (before, after) => has(push(cscen(before, after)), "rule-loosened", "CONSTRAINTS.md");
  const silentC = (before, after) => { const x = push(cscen(before, after)); return !has(x, "rule-loosened") && !has(x, "new-exception") && quiet(x); };
  r = push(cscen({}, { cov: ">= 70% lines" }));
  add("f80 a minimum moved down fires rule-loosened", "fired", r, has(r, "rule-loosened", "CONSTRAINTS.md") && /Coverage/.test(r.text));
  add("f81 a maximum moved up fires", "fired", r, loosens({}, { bundle: "<= 300 KB" }));
  add("f82 'at most' moved up fires", "fired", r, loosens({}, { cx: "at most 15 per function" }));
  add("f83 a number with no readable direction fires when it rises", "fired", r, loosens({}, { cycles: "9 allowed" }));
  add("f84 a number with no readable direction fires when it falls", "fired", r, loosens({}, { cycles: "2 allowed" }));
  add("f85 a threshold deleted fires", "fired", r, loosens({}, { cov: "lines covered" }));
  r = push(cscen({}, { text: CBASE({}).replace("- Tests stay: never delete a test to pass\n", "") }));
  add("f86 a removed Floor bullet fires", "fired", r, has(r, "rule-loosened") && /Tests stay/.test(r.text));
  r = push(cscen({}, { text: CBASE({}).replace(/\| Bundle .*\n/, "") }));
  add("f86b a removed numbered row fires", "fired", r, has(r, "rule-loosened") && /Bundle/.test(r.text));
  add("f87 a minimum moved up is silent (tightening)", "silent", r, silentC({}, { cov: ">= 90% lines" }));
  add("f88 a maximum moved down is silent", "silent", r, silentC({}, { bundle: "<= 150 KB", cx: "at most 5 per function" }));
  add("f89 'or more' read after the number counts as a minimum", "fired", r, loosens({ cov: "80% or more" }, { cov: "60% or more" }));
  add("f90 a new numbered rule is silent", "silent", r, silentC({}, { extraRow: "| Types | 0 errors, at most 0 any | tsc | CI |" }));
  add("f91 a removed Exceptions row is silent", "silent", r, silentC({}, { exc: [] }));
  add("f92 a reorder of rows is silent", "silent", r, silentC({}, { text: CBASE({}).replace(/(\| Coverage .*\n)(\| Bundle .*\n)/, "$2$1") }));
  add("f93 a reworded row with the same number is silent", "silent", r, silentC({}, { cov: ">= 80% of lines covered" }));
  add("f94 a number that gains direction words is silent", "silent", r, silentC({ cycles: "5 allowed" }, { cycles: "at most 5 allowed" }));
  add("f94b a measured number changing is silent", "silent", r, silentC({}, { warn: "40" }));
  r = push(cscen({}, { exc: ["| E1 | silenced-checker | src/x.ts | legacy | maintainer | 2026-12-31 |", "| E2 | test-deleted | tests/y.test.ts | flaky | maintainer | 2026-11-30 |"] }));
  add("f95 an added Exceptions row fires new-exception", "fired", r, has(r, "new-exception", "CONSTRAINTS.md") && /E2/.test(r.text));
  r = push(one({ "templates/CONSTRAINTS.md": CBASE({ exc: ["| E1 | silenced-checker | src/x.ts | legacy | maintainer | 2026-12-31 |", "| E2 | test-deleted | tests/y.test.ts | flaky | maintainer | 2026-11-30 |"] }) }, "a template copy"));
  add("f95b a CONSTRAINTS.md below the repo root is not the bar and stays quiet", "silent", r, quiet(r));
  r = push(cscen({}, { warn: "11" }));
  add("f96 an unrelated CONSTRAINTS.md edit stays quiet", "silent", r, quiet(r));
  r = push(cscen({}, { text: CBASE({}).replace("Read this before", "Please read this before") }));
  add("f97 a changed header sentence stays quiet", "silent", r, quiet(r));
  // R4a with CONSTRAINTS.md: marker words in it are not silenced-checker, yet its rules are still read
  r = push(cscen({}, { text: CBASE({ cov: ">= 70% lines" }) + "\nNote: eslint-disable needs an exception row.\n" }));
  add("f98 CONSTRAINTS.md is read by rule-loosened but skipped by the marker rules", "mixed", r, has(r, "rule-loosened") && !has(r, "silenced-checker"));
  r = push(one({ "src/app.js": "// eslint-disable-line\n" }, "no constraints file"));
  add("f99 with no CONSTRAINTS.md the floor still applies and the CONSTRAINTS rules cannot fire", "floor only", r, rules(r).join() === "silenced-checker");
  repo = scen({ base: { ...BASE, "CONSTRAINTS.md": CBASE({ testFiles: "a/**, b/*.x" }) }, commits: [{ files: { "a/deep/foo.js": "m.skip('x')\n", "b/q.x": "m.skip('x')\n", "c/z.js": "m.skip('x')\n", "b/sub/r.x": "m.skip('x')\n" }, msg: "files" }] });
  r = push(repo);
  add("f99b a Test files: line makes those paths test files", "globs", r, has(r, "test-made-easier", "a/deep/foo.js") && has(r, "test-made-easier", "b/q.x") && !has(r, "test-made-easier", "c/z.js") && !has(r, "test-made-easier", "b/sub/r.x"));

  // ---- step 4: floor-allow ---------------------------------------------------
  r = push(one({ "src/a.js": "// eslint-disable-line\nraise NotImplementedError\n" }, "wip\n\nfloor-allow: silenced-checker legacy file we cannot touch"), { mode: "enforce" });
  add("f100 an allowance with a reason clears its rule only and lists the reason", "partial", r,
    r.deny && !has(r, "silenced-checker") && has(r, "unfinished-work") && /legacy file we cannot touch/.test(r.text));
  r = push(one({ "src/a.js": "// eslint-disable-line\n" }, "x\n\nfloor-allow: silenced-checker legacy"), { mode: "enforce" });
  add("f100b a fully allowed diff is not denied and lists the allowance", "allowed", r, r.status === 0 && !r.deny && /legacy/.test(r.text) && !has(r, "silenced-checker"));
  r = push(one({ "src/a.js": "// eslint-disable-line\n" }, "x\n\nfloor-allow: silenced-checker"), { mode: "enforce" });
  add("f101 an allowance with no reason clears nothing", "denied", r, r.deny && has(r, "silenced-checker"));
  r = push(one({ "src/a.js": "// eslint-disable-line\n" }, "x\n\nfloor-allow: unfinished-work not this one"), { mode: "enforce" });
  add("f102 an allowance for a different rule clears nothing", "denied", r, r.deny && has(r, "silenced-checker"));
  repo = scen({ commits: [{ files: { "src/a.js": "// eslint-disable-line\n" }, msg: "first\n\nfloor-allow: silenced-checker approved by owner" }, { files: { "src/b.js": "export const b = 5;\n" }, msg: "second" }] });
  r = push(repo, { mode: "enforce" });
  add("f103a an allowance in any commit of the range counts", "allowed", r, !r.deny && r.status === 0 && /approved by owner/.test(r.text));
  r = push(one({ "src/a.js": "// eslint-disable-line\n" }, "x\n\nfloor-allow:silenced-checker nospace"), { mode: "enforce" });
  add("f104 floor-allow needs the line form: no space after the colon clears nothing", "denied", r, r.deny);

  // ---- step 13: the shipped template is read by the parser it ships with ----
  {
    const tpl = readFileSync(join(ROOT, "plugins", "pro-quality", "templates", "CONSTRAINTS.md"), "utf8");
    const loose = tpl
      .replace("minimum 80% line coverage", "minimum 70% line coverage")
      .replace(/^- test-deleted:.*\n/m, "")
      .replace(/(\| EX-1 .*\n)/, "$1| EX-2 | test-deleted | `e2e/flaky.spec.ts` | Flaky until the fixture lands | @owner | 2026-11-30 |\n");
    const tplRepo = scen({ base: { ...BASE, "CONSTRAINTS.md": tpl }, commits: [{ files: { "CONSTRAINTS.md": loose }, msg: "loosen" }] });
    r = push(tplRepo);
    const tf = r.found.filter((x) => x.file === "CONSTRAINTS.md");
    add("f121 the shipped CONSTRAINTS.md template: a loosened number, a removed Floor bullet and a new exception all fire", "three findings", r,
      tf.filter((x) => x.rule === "rule-loosened").length === 2 && tf.filter((x) => x.rule === "new-exception").length === 1 && tf.length === 3
      && tf.some((x) => /80%/.test(x.text) && /70%/.test(x.text)) && tf.some((x) => /test-deleted/.test(x.text) && /removed/.test(x.text)) && tf.some((x) => /EX-2/.test(x.text)));
    add("f121b the unchanged shipped template is silent", "silent", r, quiet(push(scen({ base: { ...BASE, "CONSTRAINTS.md": tpl }, commits: [{ files: { "src/n.js": "export const n = 3;\n" }, msg: "n" }] }))));
  }

  // ---- review fixes: f130-f143 ------------------------------------------------
  {
    // f130: a minified single-line file must not make the hook crawl
    const minLine = Array.from({ length: 6500 }, (_, i) => `function f${i}(a){if(!a)throw new Error("bad input ${i}");return a}`).join("");
    r = push(one({ "src/min.js": minLine + "\n" }, "minified"));
    const lim = process.env.CI ? 9000 : 3000;
    add(`f130 a 400 KB single-line file finishes under ${lim} ms`, `<${lim}ms`, r, r.status === 0 && quiet(r) && r.ms < lim);

    // f131-f132: a lowered minimum is not hidden by its old value elsewhere in the row
    const lh = (t) => `| Quality | ${t} | lighthouse | CI |`;
    r = push(cscen({ extraRow: lh("Lighthouse performance >= 90, accessibility >= 90") }, { extraRow: lh("Lighthouse performance >= 80, accessibility >= 90") }));
    add("f131 one of two equal minimums lowered fires", "fired", r, has(r, "rule-loosened", "CONSTRAINTS.md"));
    r = push(cscen({ extraRow: lh("line >= 80, branch >= 70") }, { extraRow: lh("line >= 70, branch >= 80") }));
    add("f132 swapped minimums (one lowered) fire", "fired", r, has(r, "rule-loosened", "CONSTRAINTS.md"));
    add("f132b a swap where both stay put and one is raised is silent", "silent", r, silentC({ extraRow: lh("line >= 80, branch >= 70") }, { extraRow: lh("line >= 80, branch >= 75") }));
    add("f132c a pair of tightened minimums is silent", "silent", r, silentC({ extraRow: lh("Lighthouse performance >= 80, accessibility >= 80") }, { extraRow: lh("Lighthouse performance >= 90, accessibility >= 85") }));

    // f133-f134: rows with the same Dimension are each checked
    const perf = (a, b) => [`| Performance | LCP <= ${a} s | lighthouse | CI |`, `| Performance | TBT <= ${b} ms | lighthouse | CI |`].join("\n");
    r = push(cscen({ extraRow: perf(2, 200) }, { extraRow: perf(2, 400) }));
    add("f133 the second of two Performance rows loosened fires", "fired", r, has(r, "rule-loosened", "CONSTRAINTS.md") && /TBT/.test(r.text));
    add("f133b the same two rows unchanged are silent", "silent", r, silentC({ extraRow: perf(2, 200) }, { extraRow: perf(2, 200) }));
    const sec = (a, b) => [`| Security | ${a} | audit | CI |`, `| Security | ${b} | scan | CI |`].join("\n");
    r = push(cscen({ extraRow: sec("0 high vulns", "0 secrets") }, { extraRow: `| Security | 0 high vulns | audit | CI |` }));
    add("f134 the second of two Security rows deleted fires", "fired", r, has(r, "rule-loosened", "CONSTRAINTS.md") && /secrets/.test(r.text));

    // f135-f135b: renames
    const tbody = "describe('a', () => {\n  it('works', () => {\n    expect(1).toEqual(1);\n    expect(2).toEqual(2);\n  });\n});\n";
    repo = scen({ base: { ...BASE, "tests/a.test.js": tbody }, commits: [{ files: { "tests/a.test.js": null, "old/a.js": tbody }, msg: "rename out" }] });
    r = push(repo);
    add("f135 a test file renamed to a non-test path fires test-deleted on the old path", "fired", r, has(r, "test-deleted", "tests/a.test.js"));
    repo = scen({ base: { ...BASE, "tests/a.test.js": tbody }, commits: [{ files: { "tests/a.test.js": null, "tests/b.test.js": tbody }, msg: "rename within" }] });
    r = push(repo);
    add("f135b a test-to-test rename is silent", "silent", r, quiet(r));

    // f136-f137: dropping a Test files glob
    const ebody = "x\n";
    repo = scen({ base: { ...BASE, "CONSTRAINTS.md": CBASE({ testFiles: "e2e/**" }), "e2e/x.js": ebody }, commits: [{ files: { "CONSTRAINTS.md": CBASE({}), "e2e/x.js": null }, msg: "drop glob and test" }] });
    r = push(repo);
    add("f136 deleting a file covered only by a dropped glob is test-deleted", "fired", r, has(r, "test-deleted", "e2e/x.js"));
    add("f137 removing a glob from the Test files line is rule-loosened", "fired", r, has(r, "rule-loosened", "CONSTRAINTS.md") && /e2e/.test(r.text));
    r = push(cscen({ testFiles: "a/**, b/**" }, { testFiles: "a/**, b/**, c/**" }));
    add("f137b adding a glob is silent", "silent", r, quiet(r));

    // f138-f139: git push <remote> <branch> judges the pushed branch
    const onMain = (files) => { const rp = one(files, "x"); sh(rp, "branch", "-m", "feat", "bad"); sh(rp, "checkout", "-q", "main"); return rp; };
    repo = onMain({ "src/app.js": "export const a = 1;\n# noqa\n" });
    r = run("git push origin bad", { cwd: repo });
    add("f138 git push origin <branch> from main judges that branch (warn)", "fired", r, r.status === 0 && !r.deny && has(r, "silenced-checker", "src/app.js"));
    r = run("git push origin bad", { cwd: repo, mode: "enforce" });
    add("f138b the same in enforce mode denies", "denied", r, r.deny && has(r, "silenced-checker"));
    r = run("git push -u origin bad:bad", { cwd: repo, mode: "enforce" });
    add("f138c src:dst judges the source ref", "denied", r, r.deny && has(r, "silenced-checker"));
    r = run("git push origin main", { cwd: repo, mode: "enforce" });
    add("f138d pushing a clean branch while another is bad is silent", "silent", r, quiet(r));
    for (const [id, cmd] of [["f139", "git push origin bad main"], ["f139b", "git push --all origin"], ["f139c", "git push --mirror origin"], ["f139d", "git push --tags origin"]]) {
      r = run(cmd, { cwd: repo, mode: "enforce" });
      add(`${id} ${cmd}: not resolvable, allowed with a not-checked note`, "allowed", r, r.status === 0 && !r.deny && /not checked/.test(r.text) && !/clean/i.test(r.text));
    }

    // f140: master as the default branch
    {
      const rp = join(sandbox, `fr${++n}`);
      mkdirSync(rp, { recursive: true });
      sh(rp, "init", "-q", "-b", "master");
      sh(rp, "config", "user.name", "t");
      sh(rp, "config", "user.email", "t@example.com");
      commit(rp, BASE, "init");
      sh(rp, "checkout", "-q", "-b", "feat");
      commit(rp, BAD, "bad");
      r = run("gh pr create --title x --body y", { cwd: rp });
      add("f140 a repo whose default branch is master is checked on gh pr create", "fired", r, has(r, "silenced-checker"));
      r = push(rp);
      add("f140b and on git push", "fired", r, has(r, "silenced-checker"));
    }
  }

  // ---- step 5: --check -------------------------------------------------------
  const check = (cwd, ...args) => {
    const c = spawnSync("python3", [FLOOR, "--check", ...args], { cwd, encoding: "utf8", timeout: 30_000, env: env0 });
    return { status: c.status, stdout: c.stdout, stderr: c.stderr };
  };
  let c = check(one({ "src/app.js": "export const a = 2;\n" }, "clean"));
  add("f110 --check exits 0 on a clean branch", "0", c, c.status === 0);
  repo = scen({ commits: [{ files: BAD, msg: "bad" }, { files: { "src/b.js": "export const b = 9;\n" }, msg: "clean" }] });
  c = check(repo);
  add("f111 --check exits 1 with a finding and names it", "1", c, c.status === 1 && /silenced-checker/.test(c.stdout) && /src\/app\.js:2/.test(c.stdout));
  c = check(plain);
  add("f112 --check exits 2 outside a git repo", "2", c, c.status === 2 && /not checked|could not|nothing was checked/i.test(c.stderr + c.stdout));
  c = check(orphan);
  add("f112b --check exits 2 with no merge base", "2", c, c.status === 2);
  c = check(repo, "--base", "HEAD~1");
  add("f113 --base changes the range", "0", c, c.status === 0);
  c = check(repo, "--base", "HEAD~2");
  add("f113b --base two commits back sees the finding", "1", c, c.status === 1);
  repo = one({ "src/b.js": "export const b = 4;\n" }, "clean");
  put(repo, { "src/app.js": "export const a = 1;\n// eslint-disable-line\n", "src/new.js": "// @ts-ignore\n" });
  c = check(repo);
  add("f114 the default range misses uncommitted and untracked changes", "0", c, c.status === 0);
  c = check(repo, "--worktree");
  add("f114b --worktree adds the uncommitted change and the untracked file", "1", c, c.status === 1 && /src\/app\.js/.test(c.stdout) && /src\/new\.js/.test(c.stdout));
  c = check(plain, "--worktree");
  add("f115 --check never claims clean for a run that did not happen", "no clean", c, c.status === 2 && !/clean/i.test(c.stdout));

  // N4: the repo is byte-identical after the hook and --check --worktree
  const snap = (rp) => [sh(rp, "status", "--porcelain=v1", "-uall").stdout, sh(rp, "rev-parse", "HEAD").stdout, readFileSync(join(rp, ".git", "index")).toString("hex"), readFileSync(join(rp, "src/app.js"), "utf8")].join("|");
  const before = snap(repo);
  push(repo, { mode: "enforce" });
  check(repo, "--worktree");
  add("f116 the guard never edits the repo", "identical", { status: 0, stdout: "", stderr: "" }, before === snap(repo));

  // ---- step 6: timing ----------------------------------------------------------
  const big = Array.from({ length: 1000 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n// eslint-disable-line\n";
  repo = one({ "src/big.js": big }, "big");
  push(repo); // warm
  r = push(repo);
  const limit = process.env.CI ? 6000 : 2000;
  add(`f120 a 1000-line diff finishes under ${limit} ms (warm)`, `<${limit}ms`, r, r.status === 0 && has(r, "silenced-checker") && r.ms < limit);
}

export function runQualityHookCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "quality-sandbox-")));
  try {
    const home = join(sandbox, "home");
    const repo = join(sandbox, "repo");
    const elsewhere = join(sandbox, "elsewhere");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(repo, "src"), { recursive: true });
    mkdirSync(elsewhere, { recursive: true });
    writeFileSync(join(repo, "app.js"), "1\n");
    writeFileSync(join(repo, "dirty.txt"), "1\n");
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.name", "t");
    git(repo, "config", "user.email", "t@example.com");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "init");
    // A dirty file the session never touches: block mode must not list it.
    writeFileSync(join(repo, "dirty.txt"), "2\n");

    let n = 0;
    const fresh = () => {
      const id = `s${++n}`;
      const transcript = join(sandbox, `${id}.jsonl`);
      writeFileSync(transcript, "");
      return { id, transcript };
    };
    const tool = (name, input) => JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name, input }] } }) + "\n";
    const say = () => JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hello" }] } }) + "\n";
    const write = (s, name, file) => appendFileSync(s.transcript, tool(name, { file_path: file }));
    const touch = (file) => writeFileSync(file, `${Date.now()}${Math.random()}\n`);

    const stop = (s, extra = {}) => ({ cwd: repo, session_id: s.id, transcript_path: s.transcript, hook_event_name: "Stop", ...extra });
    const run = (payload, { env = {}, raw = null } = {}) => {
      const r = spawnSync("python3", [SCRIPT], {
        input: raw !== null ? raw : JSON.stringify(payload), encoding: "utf8", timeout: 30_000,
        env: { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: "/dev/null", PRO_DEV_VALIDATION: "", ...env },
      });
      let json = null;
      try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* not json */ }
      return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
    };
    const add = (id, expect, r, ok) => out.results.push({ id, expect, actual: ok ? expect : "other", ok, reason: ok ? "" : `status ${r.status} stdout ${r.stdout.slice(0, 160)} stderr ${r.stderr.slice(0, 120)}` });
    const silent = (r) => r.status === 0 && !r.stdout.trim();
    const nudged = (r) => r.status === 0 && typeof r.json?.systemMessage === "string" && !("decision" in r.json) && /\/validate/.test(r.json.systemMessage);

    // R3: nothing counted
    let s = fresh();
    appendFileSync(s.transcript, say());
    let r = run(stop(s));
    add("q1 a conversation-only transcript is silent", "silent", r, silent(r));

    // R1: path filter
    s = fresh();
    write(s, "Write", join(elsewhere, "note.md"));
    r = run(stop(s));
    add("q2 a write outside the repo is silent", "silent", r, silent(r));

    s = fresh();
    write(s, "Write", join(repo, ".pro-dev", "validation", "latest.md"));
    r = run(stop(s));
    add("q3 a write inside .pro-dev/ is silent", "silent", r, silent(r));

    // R4: nudge
    s = fresh();
    touch(join(repo, "app.js"));
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s));
    add("q4 an edit inside the repo nudges with a systemMessage and no decision", "nudge", r, nudged(r) && /repo/.test(r.json.systemMessage) && /1 file/.test(r.json.systemMessage));

    // R5: once per distinct change set
    r = run(stop(s));
    add("q5 a second stop with no new writes is silent", "silent", r, silent(r));
    touch(join(repo, "src", "b.js"));
    write(s, "Write", join(repo, "src", "b.js"));
    r = run(stop(s));
    add("q6 a second stop after a new repo write nudges again", "nudge", r, nudged(r) && /2 files/.test(r.json.systemMessage));

    // R1: relative paths and a cwd inside a subdirectory resolve against the repo
    s = fresh();
    appendFileSync(s.transcript, tool("Edit", { file_path: "../app.js" }));
    r = run(stop(s, { cwd: join(repo, "src") }));
    add("q7 a relative path from a subdirectory cwd counts", "nudge", r, nudged(r));

    // R1: a symlinked temp alias of the repo still matches the real root
    s = fresh();
    const alias = join(sandbox, "alias");
    spawnSync("ln", ["-s", repo, alias]);
    write(s, "Edit", join(alias, "app.js"));
    r = run(stop(s));
    add("q8 a path through a symlink to the repo counts", "nudge", r, nudged(r));

    // R1: apply_patch is not a counted tool
    s = fresh();
    appendFileSync(s.transcript, tool("apply_patch", { file_path: join(repo, "app.js") }));
    r = run(stop(s));
    add("q9 apply_patch is not counted", "silent", r, silent(r));

    // R2: git commit
    s = fresh();
    appendFileSync(s.transcript, tool("Bash", { command: "git commit -m x" }));
    r = run(stop(s));
    add("q10 a Bash git commit with no file writes nudges", "nudge", r, nudged(r));

    // R6: off
    s = fresh();
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s), { env: { PRO_DEV_VALIDATION: "off" } });
    add("q11 PRO_DEV_VALIDATION=off is silent", "silent", r, silent(r));

    // R7, R8: block
    s = fresh();
    touch(join(repo, "app.js"));
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s), { env: { PRO_DEV_VALIDATION: "block" } });
    const reason = r.json?.reason ?? "";
    add("q12 block mode blocks with a reason that lists the written file and not an unrelated dirty one", "block", r,
      r.status === 0 && r.json?.decision === "block" && reason.includes("app.js") && !reason.includes("dirty.txt"));

    // R8: a commit with no written paths must not fall back to the whole tree
    s = fresh();
    appendFileSync(s.transcript, tool("Bash", { command: "git commit -am x" }));
    r = run(stop(s), { env: { PRO_DEV_VALIDATION: "block" } });
    add("q12b block mode with only a Bash git commit does not report unrelated dirty files", "no dirty file", r,
      r.status === 0 && !r.stdout.includes("dirty.txt"));

    // ignored files do not count
    s = fresh();
    writeFileSync(join(repo, ".gitignore"), "ignored.log\n");
    touch(join(repo, "ignored.log"));
    write(s, "Write", join(repo, "ignored.log"));
    r = run(stop(s));
    add("q12c a write to a gitignored file in the repo is silent", "silent", r, silent(r));

    s = fresh();
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s, { stop_hook_active: true }), { env: { PRO_DEV_VALIDATION: "block" } });
    add("q13 block mode with stop_hook_active passes", "silent", r, silent(r));

    // R9: unknown value is nudge
    s = fresh();
    write(s, "Edit", join(repo, "app.js"));
    r = run(stop(s), { env: { PRO_DEV_VALIDATION: "bogus" } });
    add("q14 an unknown PRO_DEV_VALIDATION value behaves as nudge", "nudge", r, nudged(r));

    // R10: bad payloads
    r = run(null, { raw: "not json" });
    add("q15 a non-JSON payload exits 0 with no output", "silent", r, silent(r));
    r = run({});
    add("q16 an empty object exits 0 with no output", "silent", r, silent(r));
    r = run(null, { raw: "" });
    add("q17 an empty payload exits 0 with no output", "silent", r, silent(r));

    floorCases(sandbox, out);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runQualityHookCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} quality hook cases passed`);
  process.exit(bad ? 1 : 0);
}
