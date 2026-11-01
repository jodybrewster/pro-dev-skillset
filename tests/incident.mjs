#!/usr/bin/env node
// Behaviour test for pro-ai-sdlc's incident.py: record and check
// (intent/2026-11-01-after-build-loop, AC5). Every case drives the script as a subprocess in a
// throwaway git repo under the OS temp dir. Nothing touches the network.
//
//   node tests/incident.mjs
//
// Also exported as runIncidentCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "plugins", "pro-ai-sdlc", "scripts", "incident.py");
const FOLDER = "2026-11-02-checkout-500s";
const SHA = "a".repeat(40);

const doc = (fm = {}, body = "## Summary\n\nCheckout returned 500 for 40 minutes.\n") => {
  const f = { id: FOLDER, state: "open", severity: "sev2", detected: "2026-11-02T10:00:00+00:00", resolved: "", commit: SHA, deploy: "", regression_test: "", ...fm };
  return `---\n${Object.entries(f).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n# Incident: checkout\n\n${body}`;
};

export function runIncidentCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "incident-")));
  const env = {
    ...process.env, HOME: join(sandbox, "home"), PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  };
  mkdirSync(env.HOME, { recursive: true });
  let n = 0;
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 500) });
  const git = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8", env });
  const mkrepo = (text) => {
    const repo = join(sandbox, `repo${++n}`);
    mkdirSync(join(repo, "intent", FOLDER), { recursive: true });
    git(repo, "init", "-q");
    writeFileSync(join(repo, "README.md"), "x\n");
    if (text !== null) writeFileSync(join(repo, "intent", FOLDER, "incident.md"), text);
    git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", "c");
    return repo;
  };
  const run = (repo, ...args) => {
    const r = spawnSync("python3", ["-I", SCRIPT, ...args], { cwd: repo, encoding: "utf8", env });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* refusals print nothing on stdout */ }
    return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
  };
  const dir = `intent/${FOLDER}`;
  const manifest = (repo) => JSON.parse(readFileSync(join(repo, ".pro-dev", "incidents", `incident-${FOLDER}.json`), "utf8"));

  // record: one status per state and the manifest fields of docs/loop-records.md
  for (const [state, status] of [["open", "fail"], ["mitigated", "partial"], ["resolved", "pass"]]) {
    const repo = mkrepo(doc({ state, resolved: state === "resolved" ? "2026-11-02T12:00:00+00:00" : "" }));
    const r = run(repo, "record", dir);
    let m = null, d = null;
    try { m = manifest(repo); d = JSON.parse(m.detail_json); } catch { /* reported below */ }
    const ok = r.status === 0 && m && r.json?.status === status && m.status === status && m.kind === "doc" && m.artifact_kind === "incident"
      && m.artifact_key === FOLDER && m.evidence_key === `incident-${FOLDER}` && m.summary === `sev2 ${state}: Checkout returned 500 for 40 minutes`
      && typeof m.detail_json === "string" && d.intent === dir && d.state === state && d.commit === SHA && typeof d.created === "string"
      && /^pro-ai-sdlc:incident@/.test(m.produced_by);
    add(`record/${state}`, `status ${status}`, ok, r.stdout + r.stderr + JSON.stringify(m));
  }
  {
    const repo = mkrepo(doc({ state: "open" }));
    run(repo, "record", dir);
    writeFileSync(join(repo, dir, "incident.md"), doc({ state: "resolved" }));
    run(repo, "record", dir);
    add("record/rewrites the record when the state changes", "pass", manifest(repo).status === "pass");
    add("record/keeps .pro-dev out of the tree", "not listed", !git(repo, "status", "--porcelain").stdout.includes(".pro-dev"));
  }
  {
    const repo = mkrepo(doc());
    mkdirSync(join(repo, ".mieruka"), { recursive: true });
    writeFileSync(join(repo, ".gitignore"), ".mieruka/evidence/\n");
    git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", "ignore");
    const r = run(repo, "record", dir);
    add("record/drops a copy in an ignored .mieruka", "copy written", r.status === 0 && existsSync(join(repo, ".mieruka", "evidence", `incident-${FOLDER}`, "evidence.json")), r.stdout + r.stderr);
  }

  // record refusals
  for (const [name, fm] of [["state", { state: "closed" }], ["severity", { severity: "sev3" }], ["id", { id: "other" }], ["commit", { commit: "abc" }]]) {
    const repo = mkrepo(doc(fm));
    const r = run(repo, "record", dir);
    add(`record/refuses an unknown ${name}`, "exit 1, nothing written", r.status === 1 && !existsSync(join(repo, ".pro-dev")), r.stdout + r.stderr);
  }
  {
    const repo = mkrepo("no frontmatter here\n");
    add("record/refuses a file with no frontmatter", "exit 1", run(repo, "record", dir).status === 1);
    const none = mkrepo(null);
    add("record/refuses a folder with no incident.md", "exit 1", run(none, "record", dir).status === 1);
    const outside = run(repo, "record", "README.md");
    add("record/refuses a path outside intent/", "exit 1", outside.status === 1, outside.stderr);
    add("usage/no arguments exits 2", "exit 2", run(repo).status === 2);
  }

  // prepare: the evidence folder exists and is ignored before any paste is saved
  {
    const repo = mkrepo(null);
    const r = run(repo, "prepare", FOLDER);
    writeFileSync(join(repo, ".pro-dev", "incidents", `incident-${FOLDER}`, "01-log.txt"), "token ghp_x\n");
    add("prepare/makes the folder and keeps a paste out of the tree", "not listed",
      r.status === 0 && !git(repo, "status", "--porcelain", "--untracked-files=all").stdout.includes(".pro-dev"), r.stdout + r.stderr);
    add("prepare/refuses a folder name with a slash", "exit 1", run(repo, "prepare", "../x").status === 1);
    add("prepare/refuses an unsafe folder name", "exit 1", run(repo, "prepare", "Bad Name").status === 1);
  }

  // check: a credential in the intent.md committed beside it is refused too
  {
    const repo = mkrepo(doc());
    writeFileSync(join(repo, "intent", FOLDER, "intent.md"), `# Intent: x\n\nCalls with Authorization: Bearer ${"eyJ" + "k".repeat(30)} fail\n`);
    const r = run(repo, "check", dir);
    add("check/a credential in intent.md is refused", "exit 1", r.status === 1 && r.stderr.includes("intent.md"), r.stdout + r.stderr);
  }

  // check: a clean file passes; each credential kind is refused and the secret is not echoed
  {
    const repo = mkrepo(doc());
    const r = run(repo, "check", dir);
    add("check/a clean file passes", "exit 0", r.status === 0 && r.json?.clean === true, r.stdout + r.stderr);
  }
  const tok = (parts) => parts.join("");
  const secrets = {
    "ghp_ token": tok(["ghp_", "A".repeat(36)]),
    "gho_ token": tok(["gho_", "B".repeat(36)]),
    "github_pat_ token": tok(["github_pat_", "C".repeat(40)]),
    "sk-ant- key": tok(["sk-ant-", "api03-", "D".repeat(30)]),
    "sk- key": tok(["sk-", "E".repeat(40)]),
    "AKIA key id": tok(["AKIA", "F".repeat(16)]),
    "xoxb- token": tok(["xoxb-", "123456789-abcdef"]),
    "Bearer header": tok(["Authorization: Bearer ", "eyJhbGciOiJIUzI1NiJ9.abcdefghijkl"]),
    "private key": tok(["-----BEGIN RSA PRIV", "ATE KEY-----"]),
    "URL with a password": tok(["postgres://app:", "hunter2pass@db.internal:5432/main"]),
    "JWT in a cookie": tok(["Cookie: session=", "eyJhbGciOiJIUzI1NiJ9", ".eyJzdWIiOiIxMjM0NTYifQ", ".SflKxwRJSMeKKF2QT4fwpM"]),
    "Basic auth header": tok(["Authorization: Basic ", "dXNlcjpodW50ZXIyMDI2"]),
    "Google API key": tok(["AIza", "G".repeat(35)]),
    "AWS secret key": tok(["aws_secret_access_key = ", "H".repeat(40)]),
    "password in a query": tok(["https://api.test/login?user=a&pass", "word=hunter2026"]),
    "password in a JSON log": tok(['{"user":"a","pass', 'word":"hunter2xyz"}']),
    "password in YAML": tok(["pass", "word: hunter2xyz"]),
    "env password": tok(["DB_PASS", "WORD = hunter2xyz"]),
    "x-api-key header": tok(["x-api-", "key: 3f9a8b7c6d5e4f3a2b1c"]),
  };
  for (const [name, secret] of Object.entries(secrets)) {
    const repo = mkrepo(doc({}, `## Summary\n\nok\n\n## Evidence preserved\n\n\`\`\`\nline before\nlog says ${secret} here\n\`\`\`\n`));
    const r = run(repo, "check", dir);
    const key = secret.split(" ").pop();
    add(`check/refuses ${name}`, "exit 1 naming the line, secret not echoed", r.status === 1 && /line 1[6-9]\b|line 2\d\b/.test(r.stderr) && !r.stderr.includes(key), r.stderr);
  }
  {
    const repo = mkrepo(doc({}, "## Summary\n\nA short bearer token was seen; a URL like https://example.com/path has no password.\nTalk of Bearer tokens in prose is fine.\nLogin failed because basic authentication was disabled.\nThe token: expired after an hour and password reset emails were delayed.\n"));
    const r = run(repo, "check", dir);
    add("check/prose that mentions a bearer token or a plain URL passes", "exit 0", r.status === 0, r.stderr);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runIncidentCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} incident cases passed`);
  process.exit(bad ? 1 : 0);
}
