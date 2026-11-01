#!/usr/bin/env node
// Behaviour test for pro-ai-sdlc's visual.py (intent/2026-11-01-after-build-loop, AC7).
// Every case drives the script as a subprocess in a throwaway git repo under the OS temp dir.
//
//   node tests/visual.mjs
//
// Also exported as runVisualCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VISUAL = join(ROOT, "plugins", "pro-ai-sdlc", "scripts", "visual.py");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake image body")]);

export function runVisualCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "visual-")));
  const env = {
    ...process.env, HOME: join(sandbox, "home"), PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  };
  mkdirSync(env.HOME, { recursive: true });
  let n = 0;
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 500) });
  const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8", env });
  const mkrepo = () => {
    const repo = join(sandbox, `repo${++n}`);
    mkdirSync(join(repo, "intent", "2026-01-01-demo"), { recursive: true });
    mkdirSync(join(repo, "mocks"), { recursive: true });
    writeFileSync(join(repo, "intent", "2026-01-01-demo", "plan.md"), "plan\n");
    writeFileSync(join(repo, "mocks", "home.png"), PNG);
    git(repo, "init", "-q", "-b", "main");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "init");
    writeFileSync(join(repo, "shot.png"), PNG);
    return repo;
  };
  const visual = (repo, args) => {
    const r = spawnSync("python3", [VISUAL, "record", "--intent", "intent/2026-01-01-demo", ...args], { cwd: repo, encoding: "utf8", timeout: 60000, env });
    return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
  };
  const base = ["--step", "2", "--viewport", "desktop", "--shot", "shot.png", "--url", "http://localhost:3000/home"];
  const KEY = "visual-2026-01-01-demo-step-2-desktop";
  const keyFile = (repo, ext) => join(repo, ".pro-dev", "visual", KEY + ext);
  const pngs = (repo) => existsSync(join(repo, ".pro-dev", "visual")) && existsSync(keyFile(repo, ".png"));

  try {
    // A pass copies the PNG and writes the record.
    {
      const repo = mkrepo();
      const r = visual(repo, [...base, "--status", "pass", "--title", "Home", "--mock", "mocks/home.png", "--console-warnings", "1"]);
      let rec = null;
      try { rec = JSON.parse(readFileSync(keyFile(repo, ".json"), "utf8")); } catch { /* checked below */ }
      const d = rec ? JSON.parse(rec.detail_json) : {};
      add("record/pass writes the manifest", "exit 0, visual_drift / ui-step", r.status === 0 && rec && rec.kind === "visual_drift" && rec.artifact_kind === "ui-step" && rec.artifact_key === "2026-01-01-demo" && rec.evidence_key === KEY && rec.status === "pass" && rec.schema === 1 && typeof rec.detail_json === "string" && /^pro-ai-sdlc:execute@/.test(rec.produced_by), r.stderr + JSON.stringify(rec));
      add("record/detail fields", "step, viewport, mock, screenshot, url, console, differences, head", d.step === 2 && d.viewport?.width === 1280 && d.mock === "mocks/home.png" && d.screenshot === `.pro-dev/visual/${KEY}.png` && d.url === "http://localhost:3000/home" && d.console?.errors === 0 && d.console?.warnings === 1 && Array.isArray(d.differences) && /^[0-9a-f]{40}$/.test(d.head || "") && d.title === "Home", JSON.stringify(d));
      add("record/the PNG is copied", "same bytes beside the record", pngs(repo) && readFileSync(keyFile(repo, ".png")).equals(PNG), "");
      add("record/the tree stays clean", "git status empty", git(repo, "status", "--porcelain").stdout.trim() === "?? shot.png", git(repo, "status", "--porcelain").stdout);
    }
    // Mobile key and width.
    {
      const repo = mkrepo();
      const r = visual(repo, ["--step", "2", "--viewport", "mobile", "--status", "fail", "--shot", "shot.png", "--url", "http://127.0.0.1:5173/"]);
      const f = join(repo, ".pro-dev", "visual", "visual-2026-01-01-demo-step-2-mobile.json");
      const d = existsSync(f) ? JSON.parse(JSON.parse(readFileSync(f, "utf8")).detail_json) : {};
      add("record/mobile is 390 wide", "key ends -mobile, width 390", r.status === 0 && d.viewport?.name === "mobile" && d.viewport?.width === 390, r.stderr);
    }
    // Differences file.
    {
      const repo = mkrepo();
      writeFileSync(join(repo, "d.json"), JSON.stringify(["header is 8px taller", "no empty state"]));
      const r = visual(repo, [...base, "--status", "partial", "--differences", "d.json"]);
      const d = JSON.parse(JSON.parse(readFileSync(keyFile(repo, ".json"), "utf8")).detail_json);
      add("record/differences are kept", "two strings", r.status === 0 && d.differences.length === 2, r.stderr);
      writeFileSync(join(repo, "bad.json"), JSON.stringify({ a: 1 }));
      const r2 = visual(repo, [...base, "--status", "partial", "--differences", "bad.json"]);
      add("record/differences must be a list of strings", "exit 1", r2.status === 1, r2.stdout + r2.stderr);
    }
    // Refusals on the shot.
    {
      const repo = mkrepo();
      writeFileSync(join(repo, "notes.txt"), "secret=1\n");
      const r = visual(repo, ["--step", "2", "--viewport", "desktop", "--status", "pass", "--shot", "notes.txt", "--url", "http://localhost:3000/"]);
      add("shot/not a PNG is refused", "exit 1, nothing written", r.status === 1 && /PNG signature/.test(r.stderr) && !existsSync(join(repo, ".pro-dev", "visual")), r.stderr);
      add("shot/the refusal does not print the file", "no content in output", !/secret=1/.test(r.stdout + r.stderr), r.stderr);
      writeFileSync(join(repo, "big.png"), Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]));
      const r2 = visual(repo, [...base.slice(0, 2), "--viewport", "desktop", "--status", "pass", "--shot", "big.png", "--url", "http://localhost:3000/"]);
      add("shot/over 10 MB is refused", "exit 1", r2.status === 1 && /10 MB/.test(r2.stderr) && !pngs(repo), r2.stderr);
      symlinkSync(join(repo, "shot.png"), join(repo, "link.png"));
      const r3 = visual(repo, ["--step", "2", "--viewport", "desktop", "--status", "pass", "--shot", "link.png", "--url", "http://localhost:3000/"]);
      add("shot/a symbolic link is refused", "exit 1", r3.status === 1 && /symbolic link/.test(r3.stderr) && !pngs(repo), r3.stderr);
      const r4 = visual(repo, ["--step", "2", "--viewport", "desktop", "--status", "pass", "--shot", "nope.png", "--url", "http://localhost:3000/"]);
      add("shot/a missing file is refused", "exit 1", r4.status === 1, r4.stderr);
      const r5 = visual(repo, ["--step", "2", "--viewport", "desktop", "--status", "pass", "--url", "http://localhost:3000/"]);
      add("shot/pass without a shot is refused", "exit 1", r5.status === 1 && /--shot is required/.test(r5.stderr), r5.stderr);
    }
    // Info needs no shot.
    {
      const repo = mkrepo();
      const r = visual(repo, ["--step", "3", "--viewport", "desktop", "--status", "info", "--title", "browser not isolated"]);
      const f = join(repo, ".pro-dev", "visual", "visual-2026-01-01-demo-step-3-desktop.json");
      const rec = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
      const d = rec.detail_json ? JSON.parse(rec.detail_json) : {};
      add("info/no shot is allowed", "status info, screenshot null", r.status === 0 && rec.status === "info" && d.screenshot === null, r.stderr);
    }
    // URL and mock rules.
    {
      const repo = mkrepo();
      for (const [label, u] of [["a remote host", "https://example.com/"], ["a look-alike host", "http://localhost.evil.com/"], ["a file url", "file:///etc/passwd"], ["userinfo", "http://localhost@evil.com/"], ["a bare word", "localhost:3000"]]) {
        const r = visual(repo, ["--step", "2", "--viewport", "desktop", "--status", "pass", "--shot", "shot.png", "--url", u]);
        add(`url/${label} is refused`, "exit 1", r.status === 1 && !pngs(repo), r.stderr);
      }
      for (const u of ["http://localhost:3000/a", "https://127.0.0.1:8443/", "http://[::1]:3000/x"]) {
        const r = visual(repo, ["--step", "2", "--viewport", "desktop", "--status", "pass", "--shot", "shot.png", "--url", u]);
        add(`url/${u} is accepted`, "exit 0", r.status === 0, r.stderr);
      }
      for (const [label, m] of [["an absolute path", "/etc/passwd"], ["a parent path", "../outside.png"], ["a file url", "file:///etc/passwd"], ["a home path", "~/x.png"]]) {
        const r = visual(repo, [...base, "--status", "pass", "--mock", m]);
        add(`mock/${label} is refused`, "exit 1", r.status === 1, r.stderr);
      }
      const r = visual(repo, [...base, "--status", "pass", "--mock", "https://example.com/mock.png"]);
      add("mock/an https URL is accepted", "exit 0", r.status === 0, r.stderr);
    }
    // The console rule.
    {
      const repo = mkrepo();
      const r = visual(repo, [...base, "--status", "pass", "--console-errors", "2"]);
      add("console/pass with errors is refused", "exit 1, nothing written", r.status === 1 && /console error/.test(r.stderr) && !pngs(repo), r.stderr);
      const r2 = visual(repo, [...base, "--status", "partial", "--console-errors", "2"]);
      add("console/partial with errors is recorded", "exit 0", r2.status === 0, r2.stderr);
    }
    // Intent folder and mieruka drop.
    {
      const repo = mkrepo();
      const r = spawnSync("python3", [VISUAL, "record", "--intent", "/tmp", "--step", "1", "--viewport", "desktop", "--status", "info"], { cwd: repo, encoding: "utf8", env });
      add("intent/a folder outside the repo is refused", "exit 1", r.status === 1, r.stderr);
      const mk = mkrepo();
      mkdirSync(join(mk, ".mieruka"), { recursive: true });
      writeFileSync(join(mk, ".gitignore"), ".mieruka/evidence/\n");
      git(mk, "add", "-A"); git(mk, "commit", "-q", "-m", "ignore");
      const r2 = visual(mk, [...base, "--status", "pass"]);
      const drop = join(mk, ".mieruka", "evidence", KEY, "evidence.json");
      add("mieruka/the manifest is dropped when ignored, the PNG is not", "evidence.json only", r2.status === 0 && existsSync(drop) && !existsSync(join(mk, ".mieruka", "evidence", KEY, KEY + ".png")), r2.stderr);
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runVisualCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} visual cases passed`);
  process.exit(bad ? 1 : 0);
}
