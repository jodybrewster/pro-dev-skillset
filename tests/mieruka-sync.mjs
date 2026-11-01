#!/usr/bin/env node
// On-demand check for AC13 of intent/2026-10-31-ship-preflight and AC8 of
// intent/2026-11-01-after-build-loop: a record that `ship.py record` writes and one of each
// record of docs/loop-records.md (deploy, incident, review lesson, visual check) is loaded by
// mieruka's own evidence sync with no error.
//
//   MIERUKA_ROOT=<path to a mieruka checkout> node tests/mieruka-sync.mjs
//
// It builds a throwaway repo shaped like mieruka (`.mieruka/` ignored), records a NO-GO there
// with ship.py and writes one record of each loop type with its real writer, then drops one vitest file into the mieruka checkout that runs mieruka's real
// `syncFromFilesystem` against the throwaway root on an in-memory database. The vitest file is
// removed afterwards and the sync writes only inside the throwaway root, so the mieruka checkout
// is left as it was. Skips (exit 0) when MIERUKA_ROOT is unset or has no installed web app.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHIP = join(ROOT, "plugins", "pro-ship", "scripts", "ship.py");
const SDLC = join(ROOT, "plugins", "pro-ai-sdlc", "scripts");
const FOLDER = "2026-11-02-checkout-500s";
const SHIP_BLOCK = "# x\n\n## Ship\n\n```yaml\ntargets:\n  - id: web\n    kind: deploy-on-merge\n    env: production\n    rollback:\n      triggers: [\"error rate above 2%\"]\n      steps: [\"redeploy the previous build\"]\n      rto: \"10 minutes\"\n```\n";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake image body")]);
const MIERUKA = process.env.MIERUKA_ROOT;
const WEB = MIERUKA ? join(MIERUKA, "apps", "web") : "";

if (!MIERUKA || !existsSync(join(WEB, "src", "service", "spdd-evidence.ts")) || !existsSync(join(MIERUKA, "node_modules", ".bin", "vitest"))) {
  console.log("mieruka sync check skipped: set MIERUKA_ROOT to a mieruka checkout with its packages installed");
  process.exit(0);
}

const run = (cmd, args, cwd, env = {}) => spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
const git = (cwd, ...a) => run("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...a], cwd);

const repo = realpathSync(mkdtempSync(join(tmpdir(), "ship-mieruka-")));
const work = realpathSync(mkdtempSync(join(tmpdir(), "ship-mieruka-report-")));
const testFile = join(WEB, "tests", "service", `zz-pro-loop-records-${process.pid}.test.ts`);
const cleanup = () => {
  rmSync(testFile, { force: true });
  rmSync(repo, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
};
// An interrupt must not leave the vitest file in the mieruka checkout.
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { cleanup(); process.exit(130); });
let ok = false;
main: try {
  git(repo, "init", "-q");
  writeFileSync(join(repo, ".gitignore"), ".mieruka/\n");
  mkdirSync(join(repo, ".mieruka"), { recursive: true });
  writeFileSync(join(repo, ".mieruka", "config.json"), "{}\n");
  writeFileSync(join(repo, "README.md"), "fixture\n");
  writeFileSync(join(repo, "AGENTS.md"), SHIP_BLOCK);
  mkdirSync(join(repo, "intent", FOLDER), { recursive: true });
  writeFileSync(join(repo, "intent", FOLDER, "plan.md"), "plan\n");
  writeFileSync(join(repo, "intent", FOLDER, "incident.md"), `---\nid: ${FOLDER}\nstate: open\nseverity: sev2\ndetected: 2026-11-02T10:00:00+00:00\nresolved:\ncommit:\ndeploy:\nregression_test:\n---\n\n# Incident: checkout\n\n## Summary\n\nCheckout returned 500 for 40 minutes.\n`);
  writeFileSync(join(repo, "shot.png"), PNG);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "fixture");
  const head = git(repo, "rev-parse", "HEAD").stdout.trim();
  const report = {
    verdict: "NO-GO", head, base: head,
    scope: { kind: "tag", range: `${head}..${head}`, prs: [], uncovered: [], last_deploy_source: "none" },
    blockers: [{ text: "Fixture record for the mieruka sync check.", evidence: "tests/mieruka-sync.mjs" }],
    fixes: [], risks: [], checks: [],
    legal: { status: "not-installed", verdict: null, base: null, head: null, blocking: 0, required: 0 },
    targets: [{ id: "fixture", kind: "tag-release", env: null, url: null, commit: head,
      rollback: { triggers: ["the release breaks"], steps: ["Check out the previous tag."], rto: "minutes" } }],
    report_md: "# Ship decision: NO-GO (1 Blocker)\n",
  };
  const reportPath = join(work, "report.json");
  writeFileSync(reportPath, JSON.stringify(report));
  const rec = run("python3", [SHIP, "record", reportPath, "--root", repo], repo);
  const out = rec.status === 0 ? JSON.parse(rec.stdout) : null;
  const key = out?.evidence_key;
  if (!key || !out.written.some((w) => w.startsWith(".mieruka/evidence/"))) {
    console.error(`ship.py record did not drop the mieruka copy:\n${rec.stdout}${rec.stderr}`);
    break main;
  }

  // One record of each loop type, from the real writers. Each prints its evidence_key, as JSON or in its progress line.
  const loop = {};
  const write = (name, script, args, input) => {
    const r = spawnSync("python3", ["-I", script, ...args], { cwd: repo, encoding: "utf8", input, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* reported below */ }
    if (r.status !== 0) { console.error(`${name} writer failed (exit ${r.status}):\n${r.stdout}${r.stderr}`); return false; }
    loop[name] = j?.evidence_key || (r.stdout.match(/(?:deploy|incident|review-lesson|visual)-[a-z0-9-]+/) || [])[0];
    return true;
  };
  const lessonAdd = (ref) => write("-", join(SDLC, "lessons.py"), ["add", "--ref", ref, "--head", head, "--class", "unchecked-timeout", "--file", "src/x.py"], "no timeout on the call");
  const written = write("deploy", SHIP, ["deployed", "--target", "web", "--env", "production", "--url", "https://example.test"])
    && write("incident", join(SDLC, "incident.py"), ["record", `intent/${FOLDER}`])
    && lessonAdd("11") && lessonAdd("12")
    && write("lesson", join(SDLC, "lessons.py"), ["mark", "unchecked-timeout", "accepted"], "Give every subprocess call a timeout.")
    && write("visual", join(SDLC, "visual.py"), ["record", "--intent", `intent/${FOLDER}`, "--step", "1", "--viewport", "desktop", "--status", "pass", "--shot", "shot.png", "--url", "http://localhost:3000/"]);
  if (!written) break main;
  for (const [name, key] of Object.entries(loop).filter(([n]) => n !== "-")) {
    if (!key) { console.error(`${name} writer printed no evidence_key`); break main; }
  }
  const expected = [
    [loop.deploy, "deploy", "deploy"],
    [loop.incident, "doc", "incident"],
    [loop.lesson, "review", "review-lesson"],
    [loop.visual, "visual_drift", "ui-step"],
  ];

  writeFileSync(testFile, `import { it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@/lib/db';

const SYNC_ROOT = ${JSON.stringify(repo)};
vi.mock('@/lib/get-db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/get-db')>();
  return { ...orig, projectRoot: () => SYNC_ROOT };
});
import { syncFromFilesystem, listEvidence, getEvidence } from '@/service/spdd-evidence';

it('loads a pro-ship preflight record with no sync error', () => {
  const db = new Database(':memory:');
  runMigrations(db);
  const r = syncFromFilesystem(db, SYNC_ROOT);
  expect(r.records).toBe(5);
  expect(r.errors ?? []).toEqual([]);
  const rec = getEvidence(db, ${JSON.stringify(key)});
  expect(rec).toBeTruthy();
  expect(rec!.kind).toBe('review');
  expect(rec!.artifactKind).toBe('ship-preflight');
  expect(rec!.status).toBe('fail');
  expect(JSON.parse(rec!.detailJson!).verdict).toBe('NO-GO');
  expect(listEvidence(db, { artifactKind: 'ship-preflight' } as never).map((e) => e.evidenceKey)).toContain(${JSON.stringify(key)});
});

it.each(${JSON.stringify(expected)})('loads %s as %s / %s with no sync error', (evidenceKey, kind, artifactKind) => {
  const db = new Database(':memory:');
  runMigrations(db);
  const r = syncFromFilesystem(db, SYNC_ROOT);
  expect(r.errors ?? []).toEqual([]);
  const rec = getEvidence(db, evidenceKey);
  expect(rec).toBeTruthy();
  expect(rec!.kind).toBe(kind);
  expect(rec!.artifactKind).toBe(artifactKind);
});
`);
  const v = run(join(MIERUKA, "node_modules", ".bin", "vitest"), ["run", testFile], WEB);
  ok = v.status === 0;
  const tail = (v.stdout + v.stderr).split("\n").filter((l) => /Test Files|Tests |FAIL|Error|expected/.test(l)).join("\n");
  console.log(ok ? `mieruka sync check passed: ${key} loaded as review / ship-preflight, plus ${expected.map((e) => e[2]).join(", ")}` : `mieruka sync check failed\n${tail}`);
} finally {
  cleanup();
}
process.exit(ok ? 0 : 1);
