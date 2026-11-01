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
