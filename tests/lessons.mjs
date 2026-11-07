#!/usr/bin/env node
// Behaviour test for pro-ai-sdlc's lessons.py: the finding ledger, repeats and review-lesson
// records (intent/2026-11-01-after-build-loop, AC6). Every case drives the script as a
// subprocess in a throwaway git repo under the OS temp dir.
//
//   node tests/lessons.mjs
//
// Also exported as runLessonsCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LESSONS = join(ROOT, "plugins", "pro-ai-sdlc", "scripts", "lessons.py");
const REVIEW_MD = join(ROOT, "plugins", "pro-ai-sdlc", "commands", "review.md");
const SHA1 = "a".repeat(40);
const SHA2 = "b".repeat(40);

export function runLessonsCases() {
  const out = { skipped: null, results: [] };
  if (spawnSync("python3", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "python3 not found on PATH" };
  if (spawnSync("git", ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: "git not found on PATH" };

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "lessons-")));
  const env = {
    ...process.env, HOME: join(sandbox, "home"), PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  };
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 400) });
  const git = (cwd, ...args) => spawnSync("git", args, { cwd, env, encoding: "utf8" });
  let n = 0;
  const mkrepo = () => {
    const dir = join(sandbox, `repo${n++}`);
    mkdirSync(dir, { recursive: true });
    git(dir, "init", "-q");
    writeFileSync(join(dir, "a.txt"), "1\n");
    git(dir, "add", "."); git(dir, "commit", "-q", "-m", "init");
    return dir;
  };
  const run = (cwd, args, input = "") => {
    const r = spawnSync("python3", [LESSONS, ...args], { cwd, env, encoding: "utf8", input });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
  };
  const addF = (repo, ref, cls, claim = "a claim", head = SHA1) =>
    run(repo, ["add", "--ref", ref, "--head", head, "--class", cls, "--file", "src/x.py"], claim);
  const ledger = (repo) => {
    const p = join(repo, ".pro-dev", "review", "findings.jsonl");
    return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  };
  const lessonFile = (repo, cls) => join(repo, ".pro-dev", "review", "lessons", `review-lesson-${cls}.json`);

  {
    const repo = mkrepo();
    const r1 = addF(repo, "12", "unchecked-timeout", "no timeout on the call");
    add("add/stores a finding", "one ledger line", r1.status === 0 && r1.json?.stored === true && ledger(repo).length === 1, r1.stderr);
    const l = ledger(repo)[0];
    add("add/line fields", "ref head class file claim created", l && l.ref === "12" && l.head === SHA1 && l.class === "unchecked-timeout" && l.file === "src/x.py" && l.claim === "no timeout on the call" && l.created, JSON.stringify(l));
    const r2 = addF(repo, "12", "unchecked-timeout", "again");
    add("add/same ref and class once", "still one line", r2.status === 0 && r2.json?.stored === false && ledger(repo).length === 1, r2.stderr);
    add("add/ledger kept out of the tree", "git status clean", git(repo, "status", "--porcelain").stdout === "", git(repo, "status", "--porcelain").stdout);
    const sh = addF(repo, "13", "other-class", "$(touch pwned) `touch pwned`");
    add("add/claim from stdin is data", "no file made, claim stored", sh.status === 0 && !existsSync(join(repo, "pwned")) && ledger(repo)[1]?.claim.includes("$(touch pwned)"), sh.stderr);
    const multi = addF(repo, "14", "multi-line", "one\ntwo\n\nthree");
    add("add/claim newlines collapse", "single line", multi.status === 0 && ledger(repo)[2]?.claim === "one two three", multi.stderr);
    for (const [id, args] of [
      ["class with a slash", ["--class", "a/b"]], ["class with capitals", ["--class", "Bad"]], ["class starting with dash", ["--class", "-x"]],
      ["short sha", ["--head", "abc123"]], ["absolute file", ["--file", "/etc/passwd"]], ["file with ..", ["--file", "../x"]],
      ["ref with a command substitution", ["--ref", "x$(id)"]], ["ref with a semicolon", ["--ref", "a;b"]],
    ]) {
      const base = { "--ref": "20", "--head": SHA1, "--class": "ok-class", "--file": "src/x.py" };
      for (let i = 0; i < args.length; i += 2) base[args[i]] = args[i + 1];
      const r = run(repo, ["add", ...Object.entries(base).flat()], "claim");
      add(`add/refuses ${id}`, "exit 1 or 2 (usage)", r.status === 1 || r.status === 2, r.stdout + r.stderr);
    }
    const empty = addF(repo, "21", "ok-class", "  \n");
    add("add/refuses an empty claim", "exit 1", empty.status === 1, empty.stderr);
    const nogit = run(sandbox, ["classes"]);
    add("outside a repo", "exit 1", nogit.status === 1, nogit.stderr);
  }

  {
    const repo = mkrepo();
    addF(repo, "1", "alpha"); addF(repo, "1", "beta"); addF(repo, "2", "alpha", "x", SHA2);
    const cl = run(repo, ["classes"]);
    add("classes/lists known classes", "alpha 2 refs and beta 1", cl.json?.classes?.length === 2 && cl.json.classes[0].class === "alpha" && cl.json.classes[0].refs === 2 && cl.json.classes[1].refs === 1, cl.stdout);
    const rp = run(repo, ["repeats"]);
    add("repeats/second ref lists the class", "alpha only", rp.json?.repeats?.length === 1 && rp.json.repeats[0].class === "alpha" && rp.json.repeats[0].refs.length === 2, rp.stdout);
    const m = run(repo, ["mark", "alpha", "proposed"], "Check subprocess calls for a timeout.\n");
    const rec = existsSync(lessonFile(repo, "alpha")) ? JSON.parse(readFileSync(lessonFile(repo, "alpha"), "utf8")) : null;
    const d = rec ? JSON.parse(rec.detail_json) : {};
    add("mark/proposed writes the manifest", "info review-lesson", m.status === 0 && rec?.kind === "review" && rec.artifact_kind === "review-lesson" && rec.artifact_key === "alpha" && rec.evidence_key === "review-lesson-alpha" && rec.status === "info" && rec.schema === 1 && rec.summary === "Check subprocess calls for a timeout." && rec.produced_by.startsWith("pro-ai-sdlc:review@") && typeof rec.detail_json === "string", m.stderr + JSON.stringify(rec));
    add("mark/detail_json fields", "class state line file seen created", d.class === "alpha" && d.state === "proposed" && d.line === rec?.summary && d.file === "CLAUDE.md" && d.seen?.length === 2 && d.seen[0].ref && d.seen[0].head && d.seen[0].claim && d.created, JSON.stringify(d));
    add("mark/proposed is still a repeat", "alpha listed", run(repo, ["repeats"]).json.repeats.length === 1);
    const acc = run(repo, ["mark", "alpha", "accepted", "--file", "AGENTS.md"], "Check subprocess calls for a timeout.");
    const rec2 = JSON.parse(readFileSync(lessonFile(repo, "alpha"), "utf8"));
    add("mark/accepted is pass and keeps created", "pass", acc.status === 0 && rec2.status === "pass" && JSON.parse(rec2.detail_json).created === d.created && JSON.parse(rec2.detail_json).file === "AGENTS.md", acc.stderr);
    add("repeats/accepted not listed", "none", run(repo, ["repeats"]).json.repeats.length === 0);
    git(repo, "status", "--porcelain");
    add("mark/tree stays clean", "git status clean", git(repo, "status", "--porcelain").stdout === "");
  }

  {
    const repo = mkrepo();
    addF(repo, "1", "gamma"); addF(repo, "2", "gamma");
    const dec = run(repo, ["mark", "gamma", "declined"], "");
    const rec = existsSync(lessonFile(repo, "gamma")) ? JSON.parse(readFileSync(lessonFile(repo, "gamma"), "utf8")) : null;
    add("mark/declined needs no line, is partial", "partial", dec.status === 0 && rec?.status === "partial" && JSON.parse(rec.detail_json).state === "declined", dec.stderr);
    addF(repo, "3", "gamma");
    add("repeats/declined never again", "none", run(repo, ["repeats"]).json.repeats.length === 0);
    const noline = run(repo, ["mark", "gamma", "accepted"], "");
    add("mark/accepted requires a line", "exit 1", noline.status === 1, noline.stderr);
  }

  {
    const repo = mkrepo();
    addF(repo, "1", "delta"); addF(repo, "2", "delta");
    const bad = [
      ["a newline", "line one\nline two"], ["a code fence", "use ```rm``` here"], ["a tilde fence", "~~~"],
      ["201 characters", "x".repeat(201)], ["a control character", "bad\u0007bell"], ["an empty line", "\n"],
    ];
    for (const [id, line] of bad) {
      const r = run(repo, ["mark", "delta", "proposed"], line);
      add(`mark/refuses ${id}`, "exit 1, no record", r.status === 1 && !existsSync(lessonFile(repo, "delta")), r.stdout + r.stderr);
    }
    const ok = run(repo, ["mark", "delta", "proposed"], "x".repeat(200));
    add("mark/accepts 200 characters", "exit 0", ok.status === 0, ok.stderr);
    const unknown = run(repo, ["mark", "never-seen", "proposed"], "a line");
    add("mark/refuses a class not in the ledger", "exit 1", unknown.status === 1, unknown.stderr);
    const badKey = run(repo, ["mark", "../x", "proposed"], "a line");
    add("mark/refuses an unsafe class", "exit 1", badKey.status === 1, badKey.stderr);
    const badFile = run(repo, ["mark", "delta", "proposed", "--file", "evil.md"], "a line");
    add("mark/refuses another agent file", "exit 1", badFile.status === 1, badFile.stderr);
  }

  {
    // The findings table (intent/2026-11-07-reaching-done, spec-m1 R1 to R9, AC1, AC2, AC10).
    const repo = mkrepo();
    const tablePath = (ref) => join(repo, ".pro-dev", "review", `${ref.replaceAll("/", "--")}.json`);
    const readTable = (ref) => (existsSync(tablePath(ref)) ? JSON.parse(readFileSync(tablePath(ref), "utf8")) : null);
    const raise = (ref, cls, file, claim = "a claim", opts = {}) => run(repo, ["raise", "--ref", ref, "--base", opts.base ?? SHA1, "--head", opts.head ?? SHA2,
      "--pass", opts.pass ?? "bugs", "--severity", opts.severity ?? "important", "--class", cls, "--file", file, "--line", String(opts.line ?? 12)], claim);
    const grade = (ref, id, g, evidence = "src/x.py:14", head = SHA2) => run(repo, ["grade", "--ref", ref, "--head", head, id, g, ...(evidence === null ? [] : ["--evidence", evidence])]);
    const ref = "feat/table";

    const empty = run(repo, ["table", "--ref", ref]);
    add("table/no file prints an empty object", '{"findings": {}}', empty.status === 0 && JSON.stringify(empty.json) === '{"findings":{}}', empty.stdout + empty.stderr);
    const f1 = raise(ref, "missing-timeout", "src/x.py", "no timeout on the call");
    add("raise/first id is F1", "F1", f1.status === 0 && f1.json?.id === "F1" && f1.json?.stored === true, f1.stdout + f1.stderr);
    add("raise/table file keyed by the ref with / as --", "feat--table.json", existsSync(tablePath(ref)), tablePath(ref));
    const f2 = raise(ref, "off-by-one", "src/y.py", "loop stops one short", { severity: "nit" });
    add("raise/second id is F2", "F2", f2.status === 0 && f2.json?.id === "F2", f2.stdout + f2.stderr);
    const dup = raise(ref, "missing-timeout", "src/x.py", "the same thing again", { line: 40 });
    add("raise/open row with the same file and class is not added again", "F1, no new row", dup.status === 0 && dup.json?.id === "F1" && dup.json?.stored === false && Object.keys(readTable(ref)?.findings ?? {}).length === 2, dup.stdout + dup.stderr);
    const t = readTable(ref);
    const R3 = ["id", "file", "line", "pass", "class", "severity", "claim", "status", "raised_at", "graded_at", "evidence", "reopened_from"];
    add("table/top-level keys", "schema ref base head round findings", t && JSON.stringify(Object.keys(t).sort()) === JSON.stringify(["base", "findings", "head", "ref", "round", "schema"]) && t.schema === 1 && t.ref === ref && t.base === SHA1 && t.head === SHA2, JSON.stringify(t));
    add("table/rows hold only the R3 keys", "exact key set", t && Object.values(t.findings).every((r) => JSON.stringify(Object.keys(r).sort()) === JSON.stringify([...R3].sort())), JSON.stringify(t));
    const r1 = t?.findings?.F1 ?? {};
    add("raise/row fields", "open, raised_at, no grade", r1.status === "open" && r1.raised_at === SHA2 && r1.graded_at === null && r1.evidence === null && r1.reopened_from === null && r1.line === 12 && r1.pass === "bugs" && r1.severity === "important" && r1.claim === "no timeout on the call", JSON.stringify(r1));
    add("raise/tree stays clean", "git status clean", git(repo, "status", "--porcelain").stdout === "", git(repo, "status", "--porcelain").stdout);
    const long = raise(ref, "long-claim", "src/z.py", "x".repeat(400));
    add("raise/claim capped at 300 characters", "300", long.status === 0 && readTable(ref)?.findings?.[long.json?.id]?.claim?.length === 300, long.stdout + long.stderr);

    for (const [id, args] of [
      ["an unknown id", ["F99", "fixed", "--evidence", "src/x.py:3"]],
      ["a missing --evidence", ["F1", "fixed"]],
      ["evidence with no line", ["F1", "fixed", "--evidence", "src/x.py"]],
      ["evidence with line 0", ["F1", "fixed", "--evidence", "src/x.py:0"]],
      ["evidence with an absolute path", ["F1", "fixed", "--evidence", "/etc/passwd:1"]],
      ["evidence with ..", ["F1", "fixed", "--evidence", "../x.py:1"]],
      ["an unknown grade", ["F1", "done", "--evidence", "src/x.py:3"]],
    ]) {
      const r = run(repo, ["grade", "--ref", ref, "--head", SHA2, ...args]);
      add(`grade/refuses ${id}`, "exit 1 or 2, row unchanged", (r.status === 1 || r.status === 2) && readTable(ref)?.findings?.F1?.status === "open", r.stdout + r.stderr);
    }
    const shortHead = grade(ref, "F1", "fixed", "src/x.py:14", "abc123");
    add("grade/refuses a short head", "exit 1", shortHead.status === 1 && readTable(ref)?.findings?.F1?.status === "open", shortHead.stdout + shortHead.stderr);

    const SHA3 = "c".repeat(40);
    const g1 = grade(ref, "F1", "fixed", "src/x.py:14", SHA3);
    const g1row = readTable(ref)?.findings?.F1 ?? {};
    add("grade/fixed sets status, graded_at and evidence", "fixed at src/x.py:14", g1.status === 0 && g1row.status === "fixed" && g1row.graded_at === SHA3 && g1row.evidence === "src/x.py:14", g1.stdout + g1.stderr + JSON.stringify(g1row));
    const g2 = grade(ref, "F2", "not-fixed", "src/y.py:8", SHA3);
    add("grade/not-fixed is stored as not fixed", "not fixed", g2.status === 0 && readTable(ref)?.findings?.F2?.status === "not fixed", g2.stdout + g2.stderr);
    const reopen = raise(ref, "missing-timeout", "src/x.py", "the timeout is gone again", { head: SHA3 });
    const f4 = readTable(ref)?.findings?.[reopen.json?.id] ?? {};
    add("raise/a match with only a fixed row adds a row with reopened_from", "new id, reopened_from F1", reopen.status === 0 && reopen.json?.stored === true && reopen.json?.id === "F4" && f4.reopened_from === "F1" && f4.status === "open", reopen.stdout + reopen.stderr + JSON.stringify(f4));
    const dup2 = raise(ref, "off-by-one", "src/y.py", "still one short", { severity: "nit" });
    add("raise/a not fixed row with the same file and class is not added again", "F2", dup2.status === 0 && dup2.json?.id === "F2" && dup2.json?.stored === false, dup2.stdout + dup2.stderr);
    grade(ref, "F3", "no-longer-applies", "src/z.py:1", SHA3);
    const nla = raise(ref, "long-claim", "src/z.py", "back again");
    add("raise/a match with a no longer applies row and no open match adds a row with reopened_from", "reopened_from F3", nla.status === 0 && nla.json?.stored === true && readTable(ref)?.findings?.[nla.json?.id]?.reopened_from === "F3", nla.stdout + nla.stderr);
    const listed = run(repo, ["table", "--ref", ref]);
    const ids = Object.keys(listed.json?.findings ?? {});
    add("table/rows in id order", "F1 F2 F3 F4 F5", listed.status === 0 && ids.join(" ") === "F1 F2 F3 F4 F5", listed.stdout);

    // R12: the tally of a graded table counts not fixed rows by severity, so an unfixed Important row never reads as clean.
    const ref2 = "pr-77";
    raise(ref2, "missing-guard", "src/a.py", "no guard");
    raise(ref2, "style-thing", "src/b.py", "naming", { severity: "nit" });
    grade(ref2, "F1", "not-fixed", "src/a.py:3");
    grade(ref2, "F2", "fixed", "src/b.py:9");
    const tally = run(repo, ["table", "--ref", ref2, "--tally"]);
    const lines = tally.stdout.split("\n");
    add("table --tally/an unfixed Important row opens with important: 1", "important: 1  nits: 0  pre-existing: 0  skipped: 0", tally.status === 0 && lines[0] === "important: 1  nits: 0  pre-existing: 0  skipped: 0" && lines[1] === "graded: fixed 1 not fixed 1 no longer applies 0", tally.stdout + tally.stderr);
    // After the fresh pass's raises the first line is the round's total: unfixed graded rows plus new rows.
    raise(ref2, "new-thing", "src/c.py", "a new important finding");
    raise(ref2, "new-nit", "src/d.py", "a new nit", { severity: "nit" });
    const total = run(repo, ["table", "--ref", ref2, "--tally"]).stdout.split("\n");
    add("table --tally/after raises the first line is the round total", "important: 2  nits: 1", total[0] === "important: 2  nits: 1  pre-existing: 0  skipped: 0" && total[1] === "graded: fixed 1 not fixed 1 no longer applies 0", total.join(" | "));
    // The graded line counts this round's grades only: rows graded at the head the table last saw.
    const ref5 = "pr-62";
    raise(ref5, "one", "src/e.py", "one"); raise(ref5, "two", "src/f.py", "two");
    grade(ref5, "F1", "fixed", "src/e.py:1", SHA2); grade(ref5, "F2", "not-fixed", "src/f.py:1", SHA2);
    const SHA4 = "d".repeat(40);
    grade(ref5, "F2", "fixed", "src/f.py:3", SHA4);
    const r3 = run(repo, ["table", "--ref", ref5, "--tally"]).stdout.split("\n");
    add("table --tally/round 3 grading one row reads graded: fixed 1", "graded: fixed 1 not fixed 0 no longer applies 0", r3[1] === "graded: fixed 1 not fixed 0 no longer applies 0" && r3[0] === "important: 0  nits: 0  pre-existing: 0  skipped: 0", r3.join(" | "));

    for (const [id, args] of [
      ["a bad severity", ["--severity", "critical"]], ["line 0", ["--line", "0"]], ["a word for a line", ["--line", "ten"]],
      ["a short base", ["--base", "abc"]], ["a ref with a semicolon", ["--ref", "a;b"]], ["a class with capitals", ["--class", "Bad"]],
      ["an absolute file", ["--file", "/etc/passwd"]], ["a pass with a space", ["--pass", "bad pass"]],
    ]) {
      const base = { "--ref": "pr-9", "--base": SHA1, "--head": SHA2, "--pass": "bugs", "--severity": "important", "--class": "ok-class", "--file": "src/x.py", "--line": "3" };
      for (let i = 0; i < args.length; i += 2) base[args[i]] = args[i + 1];
      const r = run(repo, ["raise", ...Object.entries(base).flat()], "claim");
      add(`raise/refuses ${id}`, "exit 1 or 2", r.status === 1 || r.status === 2, r.stdout + r.stderr);
    }
    const emptyClaim = raise("pr-10", "ok-class", "src/x.py", " \n");
    add("raise/refuses an empty claim", "exit 1", emptyClaim.status === 1, emptyClaim.stderr);

    // R9: a damaged table is set aside and the round runs as a first review.
    mkdirSync(dirname(tablePath("pr-55")), { recursive: true });
    writeFileSync(tablePath("pr-55"), "{ not json");
    const damaged = run(repo, ["table", "--ref", "pr-55"]);
    add("table/a damaged file is renamed to .bad", ".bad exists, empty table, warning names it", damaged.status === 0 && JSON.stringify(damaged.json) === '{"findings":{}}' && existsSync(tablePath("pr-55") + ".bad") && !existsSync(tablePath("pr-55")) && damaged.stderr.includes("pr-55.json.bad"), damaged.stdout + damaged.stderr);
    writeFileSync(tablePath("pr-56"), "[1, 2]");
    const fresh = raise("pr-56", "ok-class", "src/x.py", "first claim");
    add("raise/on a damaged table starts fresh at F1", "F1", fresh.status === 0 && fresh.json?.id === "F1" && existsSync(tablePath("pr-56") + ".bad"), fresh.stdout + fresh.stderr);
    writeFileSync(tablePath("pr-57"), Buffer.from([0x7b, 0xff, 0xfe, 0x7d]));
    const undecodable = run(repo, ["table", "--ref", "pr-57"]);
    add("table/an undecodable file is renamed to .bad", ".bad exists, empty table", undecodable.status === 0 && JSON.stringify(undecodable.json) === '{"findings":{}}' && existsSync(tablePath("pr-57") + ".bad"), undecodable.stdout + undecodable.stderr);
    writeFileSync(tablePath("pr-58"), JSON.stringify({ schema: 1, ref: "pr-58", base: SHA1, head: SHA2, round: 1, findings: { F1: { file: "src/x.py", class: "ok-class", status: "open", severity: "nit" } } }));
    const noId = run(repo, ["table", "--ref", "pr-58"]);
    add("table/a live row without an id is treated as damaged", ".bad exists, empty table", noId.status === 0 && JSON.stringify(noId.json) === '{"findings":{}}' && existsSync(tablePath("pr-58") + ".bad"), noId.stdout + noId.stderr);

    // Dedupe is always against the live table (R6): F1 open, graded fixed, the same file and class again is a new row.
    const ref3 = "pr-60";
    const a1 = raise(ref3, "missing-guard", "src/r.py", "no guard");
    grade(ref3, "F1", "fixed", "src/r.py:4");
    const a2 = raise(ref3, "missing-guard", "src/r.py", "no guard again");
    add("raise/after F1 is graded fixed the same file and class gives a new row with reopened_from", "F2 reopened_from F1", a1.json?.id === "F1" && a2.status === 0 && a2.json?.id === "F2" && a2.json?.stored === true && a2.json?.reopened_from === "F1", a2.stdout + a2.stderr);

    // A fresh Important finding that matches a live nit row raises that row to Important.
    const ref4 = "pr-61";
    raise(ref4, "loose-check", "src/s.py", "check is loose", { severity: "nit" });
    grade(ref4, "F1", "not-fixed", "src/s.py:2");
    const up = raise(ref4, "loose-check", "src/s.py", "the loose check now breaks payment", { severity: "important" });
    const upRow = readTable(ref4)?.findings?.F1 ?? {};
    add("raise/an Important match on a live nit row raises its severity", "F1 important, reported", up.status === 0 && up.json?.id === "F1" && up.json?.stored === false && up.json?.severity_raised === true && upRow.severity === "important" && Object.keys(readTable(ref4)?.findings ?? {}).length === 1, up.stdout + up.stderr + JSON.stringify(upRow));
    const same = raise(ref4, "loose-check", "src/s.py", "still loose", { severity: "nit" });
    add("raise/a nit match never lowers an Important row", "still important", same.json?.id === "F1" && same.json?.severity_raised === false && readTable(ref4)?.findings?.F1?.severity === "important", same.stdout + same.stderr);
  }

  {
    // The review round record (spec-m1 R21 to R24, AC6).
    const repo = mkrepo();
    const ref = "feat/round";
    const raise = (cls, file, severity = "important") => run(repo, ["raise", "--ref", ref, "--base", SHA1, "--head", SHA2, "--pass", "bugs", "--severity", severity, "--class", cls, "--file", file, "--line", "5"], "a claim");
    raise("missing-guard", "src/a.py"); raise("naming", "src/b.py", "nit");
    const roundArgs = (n, fresh = "ran", head = SHA2) => ["round", "--ref", ref, "--base", SHA1, "--head", head, "--round", String(n), "--fresh", fresh];
    const r1 = run(repo, roundArgs(1));
    const refHash = (r) => createHash("sha1").update(r).digest("hex").slice(0, 8);
    const key = `review-round-${SHA2.slice(0, 12)}-1-${refHash(ref)}`;
    const recPath = join(repo, ".pro-dev", "review", "rounds", `${key}.json`);
    const rec = existsSync(recPath) ? JSON.parse(readFileSync(recPath, "utf8")) : null;
    const d = rec ? JSON.parse(rec.detail_json) : {};
    add("round/writes the review-round manifest", "review / review-round, fail with an open Important row", r1.status === 0 && r1.json?.evidence_key === key && rec?.kind === "review" && rec.artifact_kind === "review-round" && rec.artifact_key === ref && rec.evidence_key === key && rec.status === "fail" && rec.schema === 1 && typeof rec.detail_json === "string" && rec.produced_by.startsWith("pro-ai-sdlc:review@") && typeof rec.summary === "string" && rec.summary.length > 0, r1.stdout + r1.stderr + JSON.stringify(rec));
    add("round/detail_json fields", "ref base head round range fresh counts findings", d.ref === ref && d.base === SHA1 && d.head === SHA2 && d.round === 1 && d.range === `${SHA1}..${SHA2}` && d.fresh === "ran" && d.counts?.open === 2 && d.findings?.length === 2, JSON.stringify(d));
    add("round/findings carry no claim text", "id file line class severity status only", (d.findings ?? []).every((f) => JSON.stringify(Object.keys(f).sort()) === JSON.stringify(["class", "file", "id", "line", "severity", "status"])) && !rec?.detail_json.includes("a claim"), JSON.stringify(d.findings));
    const roundTable = join(repo, ".pro-dev", "review", "feat--round.json");
    add("round/table records the round", "round 1", existsSync(roundTable) && JSON.parse(readFileSync(roundTable, "utf8")).round === 1);
    const SHA3 = "c".repeat(40);
    run(repo, ["grade", "--ref", ref, "--head", SHA3, "F1", "fixed", "--evidence", "src/a.py:7"]);
    const r2 = run(repo, roundArgs(2, "ran", SHA3));
    const rec2 = r2.json?.path ? JSON.parse(readFileSync(join(repo, r2.json.path), "utf8")) : null;
    add("round/pass once no Important row is open or not fixed", "pass", r2.status === 0 && rec2?.status === "pass" && JSON.parse(rec2.detail_json).fresh === "ran", r2.stdout + r2.stderr);
    const r3 = run(repo, ["round", "--ref", "pr-1", "--base", SHA1, "--head", SHA2, "--round", "1", "--fresh", "skipped"]);
    add("round/a ref with no table writes a pass record", "pass, no findings", r3.status === 0 && r3.json?.path && JSON.parse(readFileSync(join(repo, r3.json.path), "utf8")).status === "pass", r3.stdout + r3.stderr);
    for (const [id, args] of [["round 0", ["--round", "0"]], ["a bad fresh value", ["--fresh", "maybe"]], ["a short head", ["--head", "abc"]]]) {
      const base = { "--ref": ref, "--base": SHA1, "--head": SHA2, "--round": "1", "--fresh": "ran" };
      for (let i = 0; i < args.length; i += 2) base[args[i]] = args[i + 1];
      const r = run(repo, ["round", ...Object.entries(base).flat()]);
      add(`round/refuses ${id}`, "exit 1 or 2", r.status === 1 || r.status === 2, r.stdout + r.stderr);
    }
    const other = run(repo, ["round", "--ref", "ship-aaaaaaaaaaaa", "--base", SHA1, "--head", SHA2, "--round", "1", "--fresh", "ran"]);
    add("round/two refs at the same head and round keep two records", "distinct keys, both files", other.status === 0 && other.json?.evidence_key !== key && existsSync(recPath) && existsSync(join(repo, other.json?.path ?? "missing")), other.stdout + other.stderr);
    add("round/tree stays clean", "git status clean", git(repo, "status", "--porcelain").stdout === "", git(repo, "status", "--porcelain").stdout);
  }

  {
    // review.md allowed-tools: the exact set, no bare Edit or Write.
    const head = readFileSync(REVIEW_MD, "utf8").split("\n---")[0];
    const tools = (head.match(/^allowed-tools: (.*)$/m) || [, ""])[1];
    add("review.md/allows the lessons script", "allowed", tools.includes('Bash(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/lessons.py":*)'), tools);
    // The agent-file edit goes through the permission prompt, so the person sees the exact edit.
    add("review.md/pre-approves no Edit, Write or MultiEdit", "none", !/\b(Edit|Write|MultiEdit)\b/.test(tools), tools);
  }

  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runLessonsCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} lessons cases passed`);
  process.exit(bad ? 1 : 0);
}
