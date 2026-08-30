#!/usr/bin/env node
// Behaviour test for pro-core's memory hooks: memory-score.py (the BM25 ranker),
// memory-recall.py (UserPromptSubmit), daily-log.py (Stop), and dream-timer.py
// (the shared due/not-due gate, probed directly).
//
// check.mjs asserts the content contract - a hook script exists on disk and is
// wired into hooks/hooks.json. It says nothing about whether the scripts make
// the right call once they run. Memory is the one subsystem in this repo with
// real per-run state (a ledger file that grows across turns, a due/not-due
// timer with a persisted marker) and a real regression already lived here
// silently. This file drives the actual scripts the way Claude Code does - one
// process per case, the documented JSON payload on stdin - against a disposable
// sandbox, and asserts on stdout, exit code, and the files left on disk.
//
//   node tests/memory-hooks.mjs
//   node tests/memory-hooks.mjs --only=ledger              # substring filter on case id
//   node tests/memory-hooks.mjs --plugin-root=/abs/path    # run against an installed copy
//
// The --plugin-root flag is the point of the exercise as much as the cases
// are: the same table runs unmodified against plugins/pro-core/scripts (the
// source tree) and against an installed plugin-cache copy under
// ~/.claude/plugins/cache/pro-dev-skillset/pro-core/<version>/scripts. If a fix
// only lands in one of those two places, this is what notices - which is
// exactly the version-bump law from CLAUDE.md stated as a runnable check
// instead of a rule someone has to remember.
//
// ── the regression this file exists to lock down ────────────────────────────
//
// dream-timer.py's has_memory_content(mem_dir) decides whether a project has
// anything worth folding into memory. dream-nudge.py (SessionStart) and
// dream-flag.py (Stop) both gate on it before ever suggesting consolidation.
//
// daily-log.py's Stop hook writes a per-day session ledger *inside* that same
// memory directory, at <mem_dir>/daily/YYYY-MM-DD.md, so that `dream` has a
// deterministic list of transcripts to go read. That ledger is bookkeeping
// about where the signal is, not the signal itself - no model reads a
// transcript and writes a summary here, it just writes down which session ran
// and when.
//
// If has_memory_content() ever counted that ledger as content, the failure
// mode is silent and permanent: any project that has ever had a single Stop
// hook fire acquires a daily/ file, "has memory content" becomes true forever,
// the timer says due, `dream` runs, `dream` finds a list of session ids and
// nothing actually worth promoting, and the next SessionStart nudges again
// having consolidated nothing. A project would fall due forever with no notes
// ever written and no way for a user to notice why, short of reading this
// python file. The fix - already in dream-timer.py - prunes the *top-level*
// daily/ directory out of the walk before counting real .md notes.
//
// The timer/* cases below probe has_memory_content() directly, across all four
// states that matter: the ledger alone, the ledger plus the MEMORY.md index
// (also not content - it's the index a consolidation writes, not input it
// reads), the ledger plus one real note, and one real note filed a level
// *under* a directory named daily/. That last one matters because the actual
// fix prunes daily/ by removing it from os.walk's dirs list at the top level,
// which is a directory-level prune, not a filename check - worth confirming it
// really only removes the top level and not everything beneath it.
//
// ── the two-slug problem ─────────────────────────────────────────────────────
//
// Both hooks resolve a project's memory directory the way dream-timer.py does:
// ~/.claude/projects/<slug>/memory, where <slug> is the project's absolute path
// with characters flattened. Two flattening rules exist in the wild (slash-only,
// and every non-alphanumeric character), and dream-timer.py tries both, against
// both the raw path and its realpath, because on macOS mkdtemp hands back a path
// under /var/folders/... that resolves to /private/var/folders/... - a different
// string, a different slug. A sandbox that only creates one of those four
// candidate directories is testing whichever slug scheme the sandbox author
// guessed, not the one the hook actually resolves to. buildSandbox() below
// creates the real memory directory once and symlinks every other candidate
// slug at it, so every candidate resolves to the same fixture content and the
// test is independent of which scheme wins.
//
// Zero dependencies, no network, deterministic. Skips cleanly (exit 0
// standalone, and the caller treats `skipped` as a skip, never a failure) when
// python3 is not on PATH or the target scripts are not on disk.

import {
  mkdtempSync, mkdirSync, rmSync, existsSync, realpathSync, symlinkSync,
  writeFileSync, readFileSync, readdirSync, statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PLUGIN_ROOT = join(ROOT, "plugins", "pro-core");

// Deleted from the child env before every spawn, then set to the sandbox HOME.
// Left in place, any of these would let a developer's exported env silently
// change what a case observes - PRO_DEV_RECALL_MIN_SCORE=0 alone would make
// half the "silent" cases fail for a reason that has nothing to do with the
// hook's own logic.
const SCRUB_VARS = [
  "PRO_DEV_DREAM_DISABLED",
  "PRO_DEV_RECALL_DISABLED",
  "PRO_DEV_DAILY_LOG_DISABLED",
  "PRO_DEV_RECALL_MAX",
  "PRO_DEV_RECALL_MIN_SCORE",
  "PRO_DEV_RECALL_BUDGET",
  "PRO_DEV_DREAM_INTERVAL_HOURS",
];

// ── sandbox construction ─────────────────────────────────────────────────────

function slugVariants(absPath) {
  return [absPath.replace(/\//g, "-"), absPath.replace(/[^A-Za-z0-9]/g, "-")];
}

// Every ~/.claude/projects/<slug>/memory path the hooks might resolve to for
// this project directory, across both flattening rules and both the raw path
// and its realpath. Order is not meaningful - callers must not rely on which
// candidate comes first, because the real scripts try their own order.
function candidateMemoryDirs(projectsDir, rawPath, realPath) {
  const slugs = new Set();
  for (const p of [rawPath, realPath]) {
    for (const s of slugVariants(p)) slugs.add(s);
  }
  return [...slugs].map((slug) => join(projectsDir, slug, "memory"));
}

// Creates one real memory directory and symlinks every other candidate slug at
// it, so a fixture written once is visible no matter which slug the script
// resolves to. Returns the canonical (real, non-symlink) path - tests read and
// write through this path only.
function registerMemoryDir(projectsDir, rawPath, realPath) {
  const candidates = candidateMemoryDirs(projectsDir, rawPath, realPath);
  const canonical = candidates[0];
  mkdirSync(canonical, { recursive: true });
  for (const other of candidates.slice(1)) {
    if (existsSync(other)) continue;
    mkdirSync(dirname(other), { recursive: true });
    symlinkSync(canonical, other, "dir");
  }
  return canonical;
}

function buildSandbox() {
  const root = mkdtempSync(join(tmpdir(), "pro-dev-memory-hooks-"));
  const home = join(root, "home");
  const projectsDir = join(home, ".claude", "projects");
  mkdirSync(projectsDir, { recursive: true });

  const projectDir = join(root, "project");
  mkdirSync(projectDir, { recursive: true });
  const projectDirReal = realpathSync(projectDir);
  const memDir = registerMemoryDir(projectsDir, projectDir, projectDirReal);

  // A second project that never gets a memory directory registered, for the
  // "auto-memory is not in use here" cases. Its candidate slugs are recorded
  // so those cases can assert the hooks truly never created one.
  const orphanDir = join(root, "orphan-project");
  mkdirSync(orphanDir, { recursive: true });
  const orphanDirReal = realpathSync(orphanDir);
  const orphanCandidates = candidateMemoryDirs(projectsDir, orphanDir, orphanDirReal);

  return { root, home, projectsDir, projectDir, memDir, orphanDir, orphanCandidates };
}

// ── case context: everything a case's run(ctx) needs ────────────────────────

function makeCtx(scripts, sandbox) {
  const baseEnv = { ...process.env };
  for (const key of SCRUB_VARS) delete baseEnv[key];
  baseEnv.HOME = sandbox.home;

  function resetMemDir() {
    for (const entry of readdirSync(sandbox.memDir)) {
      rmSync(join(sandbox.memDir, entry), { recursive: true, force: true });
    }
  }

  function writeNote(relPath, content) {
    const full = join(sandbox.memDir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }

  function readNote(relPath) {
    const full = join(sandbox.memDir, relPath);
    return existsSync(full) ? readFileSync(full, "utf8") : null;
  }

  // A directory outside the memory-dir/slug machinery entirely, for the timer
  // cases - has_memory_content() takes a bare directory path, so those cases
  // do not need a registered project or a fake HOME at all. Recreated fresh
  // every call so case order never matters.
  function freshDir(name) {
    const dir = join(sandbox.root, "timer-fixture", name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  function runPy(scriptPath, { input = "", env, args = [] } = {}) {
    return spawnSync("python3", [scriptPath, ...args], {
      input,
      encoding: "utf8",
      timeout: 20_000,
      env: env || baseEnv,
    });
  }

  function runRecall(prompt, { cwd = sandbox.projectDir, envExtra } = {}) {
    const payload = JSON.stringify({ prompt, cwd });
    return runPy(scripts.recall, { input: payload, env: envExtra ? { ...baseEnv, ...envExtra } : baseEnv });
  }

  function runRecallRaw(rawStdin, { envExtra } = {}) {
    return runPy(scripts.recall, { input: rawStdin, env: envExtra ? { ...baseEnv, ...envExtra } : baseEnv });
  }

  function runDailyLog(fields, { envExtra } = {}) {
    const payload = JSON.stringify(fields);
    return runPy(scripts.dailyLog, { input: payload, env: envExtra ? { ...baseEnv, ...envExtra } : baseEnv });
  }

  // Imports dream-timer.py by file path in a throwaway subprocess (the hyphen
  // in the filename makes it unimportable by name) and calls
  // has_memory_content(dirPath) directly - no hook payload, no slug
  // resolution, just the function this whole file exists to pin down.
  const HAS_CONTENT_PROBE = [
    "import importlib.util, sys",
    "spec = importlib.util.spec_from_file_location('pro_dev_dream_timer', sys.argv[1])",
    "mod = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(mod)",
    "print('TRUE' if mod.has_memory_content(sys.argv[2]) else 'FALSE')",
  ].join("\n");

  function hasMemoryContent(dirPath) {
    const res = spawnSync("python3", ["-c", HAS_CONTENT_PROBE, scripts.timer, dirPath], {
      encoding: "utf8",
      timeout: 20_000,
      env: baseEnv,
    });
    return { res, value: (res.stdout || "").trim() };
  }

  function todayDayFile() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return join(sandbox.memDir, "daily", `${y}-${m}-${d}.md`);
  }

  return {
    sandbox, scripts, baseEnv,
    resetMemDir, writeNote, readNote, freshDir,
    runPy, runRecall, runRecallRaw, runDailyLog, hasMemoryContent, todayDayFile,
  };
}

// ── shared recall fixtures ───────────────────────────────────────────────────
//
// One active note, one archived note, and an index, reused by most recall/*
// cases via seedRecallFixture(). Query strings are built from their exact
// vocabulary so a hit or a miss is never a coincidence of common words.

const HOOK_NOTE = `---
name: hook not firing diagnosis
description: When a Claude Code hook silently does not run, check that it is registered in hooks/hooks.json before assuming the script itself is broken.
status: active
---
A hook file that exists on disk but is not listed in hooks/hooks.json is never loaded. There is no warning and no validation error. Eight hook files sat dead in this repo because each concern got its own filename instead of being merged into the single hooks/hooks.json Claude Code auto-loads.
`;

const ARCHIVED_NOTE = `---
name: retired parallel execution approach
description: old strategy for running subagents in parallel before the batching rule existed
status: archived
---
This is superseded. The project used to spawn subagents one at a time in a loop instead of batching independent Agent calls into a single turn.
`;

// A unique token that appears nowhere else in the fixture corpus. MEMORY.md is
// filtered out of collect() by filename before it ever reaches the scorer, so
// this token can never legitimately reach stdout - if it ever does, the index
// leaked.
const INDEX_MARKER = "ZQINDEXMARKER771";
const INDEX_NOTE = `# Memory index\n- Hook not firing diagnosis - ${INDEX_MARKER}\n`;

// Only in the body, not in the note's name or description - proves recall
// injects prose, not just the description line.
const BODY_ONLY_PHRASE = "Eight hook files sat dead";

const RELEVANT_PROMPT =
  "Why is my hook not firing after I added it, is there something about hooks.json I'm missing?";
const ARCHIVED_ONLY_PROMPT =
  "what was the old retired parallel execution approach for running subagents in a loop before batching existed";
const UNRELATED_PROMPT =
  "what is a good recipe for banana bread with chocolate chips and walnuts this weekend";

function seedRecallFixture(ctx) {
  ctx.resetMemDir();
  ctx.writeNote("feedback_hook_not_firing.md", HOOK_NOTE);
  ctx.writeNote("archived_retired_parallel.md", ARCHIVED_NOTE);
  ctx.writeNote("MEMORY.md", INDEX_NOTE);
}

function parseHookOutput(stdout) {
  const trimmed = (stdout || "").trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
}

function assertSilent(res, label) {
  if (res.error) return { ok: false, detail: `${label}: spawn error ${res.error.message}` };
  if (res.status !== 0) {
    return { ok: false, detail: `${label}: expected exit 0, got ${res.status}, stderr=${(res.stderr || "").trim()}` };
  }
  const out = (res.stdout || "").trim();
  if (out) return { ok: false, detail: `${label}: expected silence, got stdout: ${out.slice(0, 200)}` };
  return { ok: true, detail: `${label}: silent, exit 0` };
}

// ── shared ledger helpers ────────────────────────────────────────────────────

function turnCountFor(content, sessionId) {
  const escaped = sessionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("`" + escaped + "` \\d{2}:\\d{2}-\\d{2}:\\d{2}, (\\d+) turns?");
  const m = content.match(re);
  return m ? Number(m[1]) : null;
}

// ── the case table ───────────────────────────────────────────────────────────

const CASES = [
  // ── scorer ──────────────────────────────────────────────────────────────
  {
    id: "score/self-test",
    run(ctx) {
      const res = ctx.runPy(ctx.scripts.score, { args: ["--self-test"] });
      const ok = res.status === 0;
      const detail = ok
        ? (res.stdout || "").trim() || "self-test passed"
        : `exit=${res.status} stderr=${(res.stderr || "").trim()}`;
      return { ok, detail };
    },
  },

  // ── recall ──────────────────────────────────────────────────────────────
  {
    id: "recall/relevant-hit",
    run(ctx) {
      seedRecallFixture(ctx);
      const res = ctx.runRecall(RELEVANT_PROMPT);
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status} stderr=${(res.stderr || "").trim()}` };
      let parsed;
      try {
        parsed = parseHookOutput(res.stdout);
      } catch (err) {
        return { ok: false, detail: `stdout was not valid JSON: ${(res.stdout || "").slice(0, 200)}` };
      }
      if (!parsed) return { ok: false, detail: "expected a hit, got silence" };
      const ctxText = parsed.hookSpecificOutput && parsed.hookSpecificOutput.additionalContext;
      const eventName = parsed.hookSpecificOutput && parsed.hookSpecificOutput.hookEventName;
      if (eventName !== "UserPromptSubmit") {
        return { ok: false, detail: `hookEventName was ${JSON.stringify(eventName)}` };
      }
      if (typeof ctxText !== "string" || !ctxText.includes("hook not firing diagnosis")) {
        return { ok: false, detail: `additionalContext missing the expected note: ${JSON.stringify(ctxText).slice(0, 200)}` };
      }
      if (!ctxText.includes("feedback_hook_not_firing.md")) {
        return { ok: false, detail: "additionalContext did not carry the note's file path" };
      }
      return { ok: true, detail: "injected the relevant note by name and path" };
    },
  },
  {
    id: "recall/archived-excluded",
    run(ctx) {
      seedRecallFixture(ctx);
      // Every content word in this prompt comes from the archived note's own
      // name/description/body. If archived status were not excluded from the
      // ranking corpus this would score highest of anything in the fixture -
      // silence here is only explained by the exclusion actually working.
      const res = ctx.runRecall(ARCHIVED_ONLY_PROMPT);
      return assertSilent(res, "archived-only prompt");
    },
  },
  {
    id: "recall/index-never-injected",
    run(ctx) {
      seedRecallFixture(ctx);
      const res = ctx.runRecall(RELEVANT_PROMPT);
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status}` };
      const out = res.stdout || "";
      if (out.includes(INDEX_MARKER)) {
        return { ok: false, detail: `MEMORY.md content leaked into additionalContext (found ${INDEX_MARKER})` };
      }
      if (!out.trim()) return { ok: false, detail: "expected a hit alongside the index check, got silence" };
      return { ok: true, detail: "index marker absent from a real, non-empty hit" };
    },
  },
  {
    id: "recall/injects-body",
    run(ctx) {
      seedRecallFixture(ctx);
      const res = ctx.runRecall(RELEVANT_PROMPT);
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status}` };
      const out = res.stdout || "";
      if (!out.includes(BODY_ONLY_PHRASE)) {
        return { ok: false, detail: `body prose ("${BODY_ONLY_PHRASE}") missing from additionalContext` };
      }
      return { ok: true, detail: "body prose present, not just name/description" };
    },
  },
  {
    id: "recall/unrelated-silent",
    run(ctx) {
      seedRecallFixture(ctx);
      const res = ctx.runRecall(UNRELATED_PROMPT);
      return assertSilent(res, "unrelated prompt");
    },
  },
  {
    id: "recall/short-prompt-silent",
    run(ctx) {
      seedRecallFixture(ctx);
      // "hook broke" shares a token with the note's own name field - long
      // enough content overlap that only the < 12 char length gate explains
      // silence here, not lack of matching material.
      const res = ctx.runRecall("hook broke");
      return assertSilent(res, "short prompt");
    },
  },
  {
    id: "recall/slash-command-silent",
    run(ctx) {
      seedRecallFixture(ctx);
      // Same story: this single-line slash command carries every term the
      // relevant note matches on. Only the slash-command gate explains silence.
      const res = ctx.runRecall("/dream hook not firing hooks.json");
      return assertSilent(res, "slash command");
    },
  },
  {
    id: "recall/disabled-silent",
    run(ctx) {
      seedRecallFixture(ctx);
      const res = ctx.runRecall(RELEVANT_PROMPT, { envExtra: { PRO_DEV_RECALL_DISABLED: "1" } });
      return assertSilent(res, "PRO_DEV_RECALL_DISABLED=1");
    },
  },
  {
    id: "recall/no-memory-dir-silent",
    run(ctx) {
      seedRecallFixture(ctx); // populates the registered project; irrelevant here
      const res = ctx.runRecall(RELEVANT_PROMPT, { cwd: ctx.sandbox.orphanDir });
      return assertSilent(res, "project with no auto-memory directory");
    },
  },
  {
    id: "recall/garbage-stdin-silent",
    run(ctx) {
      seedRecallFixture(ctx);
      const res = ctx.runRecallRaw("{not valid json at all");
      return assertSilent(res, "invalid JSON on stdin");
    },
  },

  // ── ledger ──────────────────────────────────────────────────────────────
  {
    id: "ledger/creates-entry",
    run(ctx) {
      ctx.resetMemDir();
      const res = ctx.runDailyLog({
        session_id: "sess-A", cwd: ctx.sandbox.projectDir,
        transcript_path: "/fake/transcripts/sess-A.jsonl", stop_hook_active: false,
      });
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status}` };
      const content = ctx.readNote(`daily/${dayName()}`);
      if (!content) return { ok: false, detail: "no day file was written" };
      if (!content.includes("`sess-A`")) return { ok: false, detail: "day file has no entry for sess-A" };
      if (turnCountFor(content, "sess-A") !== 1) return { ok: false, detail: `expected 1 turn, got: ${content}` };
      return { ok: true, detail: "day file created with a 1-turn entry" };
    },
  },
  {
    id: "ledger/turn-count-increments",
    run(ctx) {
      ctx.resetMemDir();
      const payload = {
        session_id: "sess-B", cwd: ctx.sandbox.projectDir,
        transcript_path: "/fake/transcripts/sess-B.jsonl", stop_hook_active: false,
      };
      const first = ctx.runDailyLog(payload);
      if (first.status !== 0) return { ok: false, detail: `first call exit=${first.status}` };
      const afterFirst = ctx.readNote(`daily/${dayName()}`);
      const firstCount = afterFirst && turnCountFor(afterFirst, "sess-B");
      if (firstCount !== 1) return { ok: false, detail: `after first Stop expected 1 turn, got ${firstCount}` };

      const second = ctx.runDailyLog(payload);
      if (second.status !== 0) return { ok: false, detail: `second call exit=${second.status}` };
      const afterSecond = ctx.readNote(`daily/${dayName()}`);
      const secondCount = afterSecond && turnCountFor(afterSecond, "sess-B");
      if (secondCount !== 2) return { ok: false, detail: `after second Stop expected 2 turns, got ${secondCount}` };

      return { ok: true, detail: "same session id: 1 turn then 2 turns" };
    },
  },
  {
    id: "ledger/separate-sessions",
    run(ctx) {
      ctx.resetMemDir();
      const runOne = (sid) => ctx.runDailyLog({
        session_id: sid, cwd: ctx.sandbox.projectDir,
        transcript_path: `/fake/transcripts/${sid}.jsonl`, stop_hook_active: false,
      });
      const r1 = runOne("sess-C1");
      const r2 = runOne("sess-C2");
      if (r1.status !== 0 || r2.status !== 0) {
        return { ok: false, detail: `exits: ${r1.status}, ${r2.status}` };
      }
      const content = ctx.readNote(`daily/${dayName()}`) || "";
      const c1 = turnCountFor(content, "sess-C1");
      const c2 = turnCountFor(content, "sess-C2");
      if (c1 !== 1 || c2 !== 1) {
        return { ok: false, detail: `expected two separate 1-turn entries, got sess-C1=${c1} sess-C2=${c2}` };
      }
      return { ok: true, detail: "two sessions produced two independent entries" };
    },
  },
  {
    id: "ledger/stop-hook-active-ignored",
    run(ctx) {
      ctx.resetMemDir();
      const res = ctx.runDailyLog({
        session_id: "sess-D", cwd: ctx.sandbox.projectDir,
        transcript_path: "", stop_hook_active: true,
      });
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status}` };
      if (existsSync(join(ctx.sandbox.memDir, "daily"))) {
        return { ok: false, detail: "daily/ was created on a stop_hook_active continuation turn" };
      }
      return { ok: true, detail: "continuation turn wrote nothing" };
    },
  },
  {
    id: "ledger/no-session-id-ignored",
    run(ctx) {
      ctx.resetMemDir();
      const res = ctx.runDailyLog({
        cwd: ctx.sandbox.projectDir, transcript_path: "", stop_hook_active: false,
      });
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status}` };
      if (existsSync(join(ctx.sandbox.memDir, "daily"))) {
        return { ok: false, detail: "daily/ was created for a payload with no session_id" };
      }
      return { ok: true, detail: "missing session_id wrote nothing" };
    },
  },
  {
    id: "ledger/no-memory-dir-creates-nothing",
    run(ctx) {
      const res = ctx.runDailyLog({
        session_id: "sess-F", cwd: ctx.sandbox.orphanDir,
        transcript_path: "/fake/transcripts/sess-F.jsonl", stop_hook_active: false,
      });
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status}` };
      const created = ctx.sandbox.orphanCandidates.filter((p) => existsSync(p));
      if (created.length) {
        return { ok: false, detail: `hook created a memory directory it must never create: ${created.join(", ")}` };
      }
      return { ok: true, detail: "a project with no auto-memory directory stayed untouched" };
    },
  },
  {
    id: "ledger/disabled-silent",
    run(ctx) {
      ctx.resetMemDir();
      const res = ctx.runDailyLog(
        { session_id: "sess-G", cwd: ctx.sandbox.projectDir, transcript_path: "", stop_hook_active: false },
        { envExtra: { PRO_DEV_DAILY_LOG_DISABLED: "1" } },
      );
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status}` };
      if (existsSync(join(ctx.sandbox.memDir, "daily"))) {
        return { ok: false, detail: "daily/ was created while PRO_DEV_DAILY_LOG_DISABLED=1" };
      }
      return { ok: true, detail: "disabled: wrote nothing" };
    },
  },
  {
    id: "ledger/corrupt-file-rebuilt",
    run(ctx) {
      ctx.resetMemDir();
      const dayPath = ctx.todayDayFile();
      mkdirSync(dirname(dayPath), { recursive: true });
      // Past MAX_LEDGER_BYTES (512 KiB) the file is treated as corrupt rather
      // than busy and is never read back - this is the exact branch that
      // proves the hook rebuilds instead of crashing on unusable content.
      writeFileSync(dayPath, "JUNKMARKERZZZ ".repeat(50_000), "utf8");
      const before = statSync(dayPath).size;
      if (before <= 512 * 1024) return { ok: false, detail: `fixture file too small: ${before} bytes` };

      const res = ctx.runDailyLog({
        session_id: "sess-E", cwd: ctx.sandbox.projectDir,
        transcript_path: "/fake/transcripts/sess-E.jsonl", stop_hook_active: false,
      });
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status} stderr=${(res.stderr || "").trim()}` };

      const content = readFileSync(dayPath, "utf8");
      if (content.includes("JUNKMARKERZZZ")) {
        return { ok: false, detail: "oversized junk content survived the rewrite" };
      }
      if (turnCountFor(content, "sess-E") !== 1) {
        return { ok: false, detail: `rebuilt file missing a clean sess-E entry: ${content.slice(0, 200)}` };
      }
      if (content.length >= before) {
        return { ok: false, detail: "rebuilt file was not smaller than the oversized fixture" };
      }
      return { ok: true, detail: `oversized file (${before} bytes) rebuilt to ${content.length} bytes with a clean entry` };
    },
  },
  {
    id: "ledger/records-transcript-path",
    run(ctx) {
      ctx.resetMemDir();
      const transcript = "/fake/transcripts/sess-H-20260830.jsonl";
      const res = ctx.runDailyLog({
        session_id: "sess-H", cwd: ctx.sandbox.projectDir,
        transcript_path: transcript, stop_hook_active: false,
      });
      if (res.status !== 0) return { ok: false, detail: `exit=${res.status}` };
      const content = ctx.readNote(`daily/${dayName()}`) || "";
      const expected = `  - transcript: \`${transcript}\``;
      if (!content.includes(expected)) {
        return { ok: false, detail: `transcript line not found. content: ${content}` };
      }
      return { ok: true, detail: "transcript path recorded verbatim" };
    },
  },

  // ── timer (has_memory_content, probed directly) ────────────────────────
  {
    id: "timer/ledger-alone-not-content",
    run(ctx) {
      const dir = ctx.freshDir("ledger-alone");
      mkdirSync(join(dir, "daily"), { recursive: true });
      writeFileSync(join(dir, "daily", "2026-08-30.md"), "# Sessions 2026-08-30\n", "utf8");
      const { res, value } = ctx.hasMemoryContent(dir);
      if (res.status !== 0) return { ok: false, detail: `probe exit=${res.status} stderr=${(res.stderr || "").trim()}` };
      if (value !== "FALSE") return { ok: false, detail: `expected False, got ${value}` };
      return { ok: true, detail: "daily/ ledger alone is not content" };
    },
  },
  {
    id: "timer/ledger-plus-index-not-content",
    run(ctx) {
      const dir = ctx.freshDir("ledger-plus-index");
      mkdirSync(join(dir, "daily"), { recursive: true });
      writeFileSync(join(dir, "daily", "2026-08-30.md"), "# Sessions 2026-08-30\n", "utf8");
      writeFileSync(join(dir, "MEMORY.md"), "# Memory index\n", "utf8");
      const { res, value } = ctx.hasMemoryContent(dir);
      if (res.status !== 0) return { ok: false, detail: `probe exit=${res.status}` };
      if (value !== "FALSE") return { ok: false, detail: `expected False (index is not content either), got ${value}` };
      return { ok: true, detail: "ledger plus the MEMORY.md index is still not content" };
    },
  },
  {
    id: "timer/real-note-is-content",
    run(ctx) {
      const dir = ctx.freshDir("real-note");
      mkdirSync(join(dir, "daily"), { recursive: true });
      writeFileSync(join(dir, "daily", "2026-08-30.md"), "# Sessions 2026-08-30\n", "utf8");
      writeFileSync(join(dir, "MEMORY.md"), "# Memory index\n", "utf8");
      writeFileSync(join(dir, "feedback_x.md"), "---\nname: real note\n---\nsome content\n", "utf8");
      const { res, value } = ctx.hasMemoryContent(dir);
      if (res.status !== 0) return { ok: false, detail: `probe exit=${res.status}` };
      if (value !== "TRUE") return { ok: false, detail: `expected True once a real top-level note exists, got ${value}` };
      return { ok: true, detail: "a real top-level note counts as content" };
    },
  },
  {
    id: "timer/note-under-daily-still-counts",
    run(ctx) {
      const dir = ctx.freshDir("note-under-daily");
      mkdirSync(join(dir, "daily", "sub"), { recursive: true });
      writeFileSync(join(dir, "daily", "sub", "note.md"), "not a ledger entry, a real note\n", "utf8");
      const { res, value } = ctx.hasMemoryContent(dir);
      if (res.status !== 0) return { ok: false, detail: `probe exit=${res.status}` };
      if (value !== "TRUE") {
        return {
          ok: false,
          detail:
            `expected True (only the top-level daily/ directory should be pruned, a note nested at ` +
            `daily/sub/note.md is not the auto-generated ledger itself), got ${value}. ` +
            `has_memory_content() prunes 'daily' out of os.walk's dirs list at the top level, which stops ` +
            `os.walk from descending into daily/ at all - that also hides everything under daily/sub/, ` +
            `not just the ledger files directly inside daily/. This is a directory-level prune where a ` +
            `filename-level prune (skip only *.md files whose parent is exactly <mem_dir>/daily) was needed.`,
        };
      }
      return { ok: true, detail: "a note nested under daily/ still counts as content" };
    },
  },
];

function dayName() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}.md`;
}

// ── runner, shared by this CLI and (in principle) tests/check.mjs ──────────
//
// Returns results instead of printing or exiting, so the case table above
// stays the single copy - mirrors runGitSafeCases() in tests/git-safe.mjs.
//
//   { skipped: string|null, selected: Case[], results: [{ id, ok, detail }] }
//
// `skipped` is a reason string when the harness cannot run at all - no python3,
// or one of the four target scripts missing from pluginRoot. Callers must
// treat that as a skip, never a failure: it says nothing about hook behaviour.
export function runMemoryHookCases({ pluginRoot = DEFAULT_PLUGIN_ROOT, only = null } = {}) {
  const selected = only ? CASES.filter((c) => c.id.includes(only)) : CASES;
  const out = { skipped: null, selected, results: [] };

  const scripts = {
    score: join(pluginRoot, "scripts", "memory-score.py"),
    recall: join(pluginRoot, "scripts", "memory-recall.py"),
    dailyLog: join(pluginRoot, "scripts", "daily-log.py"),
    timer: join(pluginRoot, "scripts", "dream-timer.py"),
  };
  for (const p of Object.values(scripts)) {
    if (!existsSync(p)) return { ...out, skipped: `${p} not found` };
  }
  const pyCheck = spawnSync("python3", ["--version"], { stdio: "ignore" });
  if (pyCheck.error) return { ...out, skipped: "python3 not found on PATH" };

  if (selected.length === 0) return out;

  let sandbox = null;
  try {
    sandbox = buildSandbox();
    const ctx = makeCtx(scripts, sandbox);
    for (const c of selected) {
      let result;
      try {
        result = c.run(ctx);
      } catch (err) {
        result = { ok: false, detail: `threw: ${(err && err.stack) || err}` };
      }
      out.results.push({ id: c.id, ok: !!result.ok, detail: result.detail || "" });
    }
  } finally {
    if (sandbox) rmSync(sandbox.root, { recursive: true, force: true });
  }
  return out;
}

// ── standalone CLI ──────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length) : null;
  const rootArg = args.find((a) => a.startsWith("--plugin-root="));
  const pluginRoot = rootArg ? resolve(rootArg.slice("--plugin-root=".length)) : DEFAULT_PLUGIN_ROOT;

  const unknown = args.filter((a) => a !== onlyArg && a !== rootArg);
  if (unknown.length) {
    console.error(`unrecognised argument: ${unknown[0]}`);
    process.exit(2);
  }

  const { skipped, selected, results } = runMemoryHookCases({ pluginRoot, only });
  if (skipped) {
    console.log(`⚬ memory hook tests skipped - ${skipped}`);
    process.exit(0);
  }
  if (selected.length === 0) {
    console.error(`no cases match --only=${only}`);
    process.exit(2);
  }

  const width = Math.max(...results.map((r) => r.id.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(width)}  ${r.detail}`);
  }
  console.log(`\n${failed ? "✗" : "✓"} ${results.length} cases against ${pluginRoot} - ${failed} failures`);
  process.exit(failed ? 1 : 0);
}

// Direct invocation only. Importing this module must not run cases or exit.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
