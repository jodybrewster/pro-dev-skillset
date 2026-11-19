#!/usr/bin/env node
// Behaviour test for pro-ai-sdlc-egm: the level rule for briefs and designs, design.py (the design
// file's reviews and approvals), the design check in execute-gate.py and the runner's open findings
// check. Every case runs in a throwaway todo-list repo with a bare origin under the OS temp dir and
// GIT_CONFIG_GLOBAL=/dev/null, so the real user config never leaks in. No network and no model.
//
// The repo holds one intent per level, so the three paths are walked side by side:
//   TDO-1  a low-risk bug                       level 1  no design, the factory may take it
//   TDO-2  a feature with a design file         level 2  product owner and engineer approve
//   TDO-3  an export of personal data           level 3  the lead approves too
//
//   node tests/sdlc-egm.mjs
//
// Exports runSdlcEgmCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "plugins", "pro-ai-sdlc-egm", "scripts");
const DESIGN = join(SCRIPTS, "design.py");
const FACTORY = join(SCRIPTS, "factory.py");
const GATE = join(SCRIPTS, "execute-gate.py");
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" };

const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, env: ENV, encoding: "utf8", timeout: 120000 });
const git = (cwd, ...args) => run("git", args, cwd);
const py = (cwd, script, ...args) => run("python3", [script, ...args], cwd);

const REVIEW = `# Review

## Roles

\`\`\`yaml
roles:
  product_owner: [Pat Product]
  engineer: [Eve Engineer]
  lead: [Lee Lead]
  policy_owner: [Pol Policy]
  platform_owner: [Eve Engineer]
\`\`\`
`;

const intent = ({ id, title, risk, outcome, extra = "" }) => `---
id: ${id}
source: idea
kind: change
breaking: false
status: accepted
risk: ${risk}
level: 1
created: 2026-11-18T10:00:00+00:00
author: Eve Engineer
${extra}---

# Intent: ${title}

## Problem

Tasks in the todo list are hard to manage.

## Proposed outcome

${outcome}

## Affected users and systems

People who keep a todo list in the browser.

## Constraints

None.

## Out of scope

Everything else.

## Success looks like

The list shows it.

## Open questions

None.

## Evidence

None.
`;

const design = (concerns = "None found. Checked REVIEW.md.") => `# Tasks

## Overview

A todo list in the browser.

## The Problem

People forget when a task is due.

## Goals

- A task can carry a due date.

## Technical Plan (Architecture)

A task gains an optional due field.

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. \`todo.js\` (Modify)

addTask takes an optional due date.

## Flagged concerns

${concerns}
`;

const plan = (id) => `---
id: ${id}
---

# Plan: a change

Status: approved.
Approver: Eve Engineer.

## Order of work

1. Do it (size XS)

## Done

- Build commit: <sha>
`;

function makeRepo() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "sdlc-egm-")));
  const origin = join(base, "origin.git"), repo = join(base, "todo");
  mkdirSync(repo);
  git(base, "init", "-q", "--bare", "-b", "main", origin);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "Eve Engineer");
  git(repo, "config", "user.email", "eve@example.com");
  git(repo, "config", "commit.gpgsign", "false");
  const write = (rel, text) => { mkdirSync(dirname(join(repo, rel)), { recursive: true }); writeFileSync(join(repo, rel), text); };
  write("REVIEW.md", REVIEW);
  write("PRODUCT.md", "# Product\n");
  write("SECURITY.md", "# Security\n");
  write("todo.js", "export const addTask = (list, title) => [...list, { title, done: false }];\n");
  write("intent/project.json", JSON.stringify({ shortcode: "TDO" }) + "\n");
  write("intent/TDO-1-trim-titles/intent.md", intent({ id: "TDO-1", title: "Trim titles", risk: "low", outcome: "A task title has no spaces at its start or end." }));
  write("intent/TDO-2-due-dates/intent.md", intent({ id: "TDO-2", title: "Due dates", risk: "low", outcome: "A task can carry a due date and the list shows it." }));
  write("intent/TDO-3-export-tasks/intent.md", intent({ id: "TDO-3", title: "Export tasks", risk: "low", outcome: "A person can export their tasks, which hold personal data, to a file." }));
  write("intent/TDO-4-medium/intent.md", intent({ id: "TDO-4", title: "Medium", risk: "medium", outcome: "The list sorts by title." }));
  write("intent/TDO-5-from-brief/intent.md", intent({ id: "TDO-5", title: "From a brief", risk: "low", outcome: "The list has a dark theme.", extra: "brief: docs/briefs/2026-11-18-dark-theme.md\n" }));
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "todo list");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-q", "-u", "origin", "main");
  git(repo, "remote", "set-head", "origin", "main");
  const commit = (msg) => { git(repo, "add", "-A"); return git(repo, "commit", "-q", "-m", msg); };
  return { base, repo, write, commit };
}

export function runSdlcEgmCases() {
  for (const tool of ["git", "python3"]) {
    if (run(tool, ["--version"], ROOT).status !== 0) return { skipped: `${tool} not found`, results: [] };
  }
  const results = [];
  const add = (id, expect, ok, reason = "") => results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).trim().slice(0, 300) });
  const { base, repo, write, commit } = makeRepo();
  const level = (folder) => py(repo, FACTORY, "level", `intent/${folder}`, "--repo", repo);
  const d = (...args) => py(repo, DESIGN, "--repo", repo, ...args);
  const status = (who) => { try { return JSON.parse(d("status", who).stdout); } catch { return {}; } };

  try {
    // --- the level a script gives each kind of change -------------------------------------------
    let r = level("TDO-1-trim-titles");
    add("level-1-low-risk-bug", "level: 1", /^level: 1\b/m.test(r.stdout), r.stdout + r.stderr);
    r = level("TDO-4-medium");
    add("level-2-medium-risk", "level: 2", /^level: 2\b/m.test(r.stdout), r.stdout + r.stderr);
    r = level("TDO-5-from-brief");
    add("level-2-from-a-brief", "level: 2 with the brief named", /^level: 2\b.*brief/m.test(r.stdout), r.stdout + r.stderr);
    r = level("TDO-3-export-tasks");
    add("level-3-stop-list", "level: 3 with the stop-list words named", /^level: 3\b.*stop-list/m.test(r.stdout), r.stdout + r.stderr);

    // --- a level 2 change: link, review, approve, build gate ------------------------------------
    r = d("status", "TDO-2");
    add("status-no-design", "names no design file", r.status === 0 && /names no design file/.test(r.stdout), r.stdout + r.stderr);
    r = d("link", "TDO-2", "../outside.md");
    add("link-refuses-dotdot", "exit 2", r.status === 2, r.stdout + r.stderr);
    r = d("link", "TDO-2", "/etc/passwd.md");
    add("link-refuses-absolute", "exit 2", r.status === 2, r.stdout + r.stderr);
    r = d("link", "TDO-2", "docs/designs/tasks.txt");
    add("link-refuses-non-markdown", "exit 2", r.status === 2, r.stdout + r.stderr);
    write("docs/designs/tasks.md", design());
    r = d("link", "TDO-2", "docs/designs/tasks.md");
    add("link-writes-frontmatter", "design: line in intent.md", r.status === 0 && /^design: docs\/designs\/tasks\.md$/m.test(readFileSync(join(repo, "intent/TDO-2-due-dates/intent.md"), "utf8")), r.stdout + r.stderr);
    r = level("TDO-2-due-dates");
    add("level-2-with-a-design", "level: 2 with the design named", /^level: 2\b.*design/m.test(r.stdout), r.stdout + r.stderr);
    py(repo, FACTORY, "level", "intent/TDO-2-due-dates", "--repo", repo, "--write");

    r = d("reviewed", "TDO-2", "--open", "0");
    add("reviewed-refuses-uncommitted", "exit 2 naming the commit", r.status === 2 && /commit/.test(r.stderr), r.stdout + r.stderr);
    commit("TDO-2: design: due-dates");
    r = d("approve", "TDO-2", "--role", "all");
    add("approve-refuses-unreviewed", "exit 2 naming the review", r.status === 2 && /no review/.test(r.stderr), r.stdout + r.stderr);
    r = d("context", "TDO-2");
    let ctx = {}; try { ctx = JSON.parse(r.stdout); } catch { /* reported below */ }
    add("context-reads-product-and-security", "PRODUCT.md and SECURITY.md on the reading list",
      ctx.target === "docs/designs/tasks.md" && ["intent/TDO-2-due-dates/intent.md", "REVIEW.md", "PRODUCT.md", "SECURITY.md"].every((f) => (ctx.context ?? []).includes(f)), r.stdout + r.stderr);
    r = d("reviewed", "TDO-2", "--open", "0", "--reviewers", "zoom_out,design_critic");
    add("reviewed-records", "exit 0", r.status === 0, r.stdout + r.stderr);
    r = d("approve", "TDO-2", "--role", "product_owner");
    add("approve-refuses-wrong-role", "exit 2: Eve is not the product owner", r.status === 2 && /not listed as product_owner/.test(r.stderr), r.stdout + r.stderr);
    r = d("approve", "TDO-2", "--role", "lead", "--name", "Lee Lead");
    add("approve-refuses-unneeded-role", "exit 2: level 2 does not need the lead", r.status === 2, r.stdout + r.stderr);
    r = d("approve", "TDO-2", "--role", "all");
    add("approve-engineer", "exit 0, still waiting on product_owner", r.status === 0 && /waiting on product_owner/.test(r.stdout), r.stdout + r.stderr);
    r = d("check", "TDO-2");
    add("check-needs-product-owner", "exit 1 naming product_owner", r.status === 1 && /product_owner/.test(r.stderr), r.stdout + r.stderr);
    r = d("approve", "TDO-2", "--role", "product_owner", "--name", "Pat Product");
    add("approve-product-owner", "exit 0, waiting on nobody", r.status === 0 && /waiting on nobody/.test(r.stdout), r.stdout + r.stderr);
    r = d("check", "TDO-2");
    add("check-needs-committed-record", "exit 1: the record is not committed", r.status === 1 && /design-record\.json/.test(r.stderr), r.stdout + r.stderr);
    commit("TDO-2: design approved: due-dates");
    r = d("check", "TDO-2");
    add("check-passes-level-2", "exit 0", r.status === 0 && /Pat Product \(product_owner\)/.test(r.stdout), r.stdout + r.stderr);

    write("intent/TDO-2-due-dates/plan.md", plan("TDO-2"));
    commit("TDO-2: plan: due-dates");
    r = py(repo, GATE, "intent/TDO-2-due-dates/plan.md");
    add("gate-passes-approved-design", "exit 0 on TDO-2/build", r.status === 0 && /"branch": "TDO-2\/build"/.test(r.stdout), r.stdout + r.stderr);

    write("docs/designs/tasks.md", design() + "\nA late edit nobody reviewed.\n");
    commit("edit the design after approval");
    r = d("check", "TDO-2");
    add("check-voided-by-an-edit", "exit 1: no review of this version", r.status === 1 && /no review is recorded for this version/.test(r.stderr) && /another version/.test(r.stderr), r.stdout + r.stderr);
    r = py(repo, GATE, "intent/TDO-2-due-dates/plan.md");
    add("gate-stops-edited-design", "exit 1: the design is not ready to build", r.status === 1 && /design is not ready to build/.test(r.stderr), r.stdout + r.stderr);

    // --- a level 3 change to the same design file: the lead signs too, concerns must be closed ---
    write("docs/designs/tasks.md", design("| Concern | Source | Status |\n|---|---|---|\n| The export holds personal data | SECURITY.md | open |"));
    d("link", "TDO-3", "docs/designs/tasks.md");
    py(repo, FACTORY, "level", "intent/TDO-3-export-tasks", "--repo", repo, "--write");
    commit("TDO-3: design: export-tasks");
    add("status-level-3-roles", "product_owner, engineer and lead", JSON.stringify(status("TDO-3").required) === JSON.stringify(["product_owner", "engineer", "lead"]), JSON.stringify(status("TDO-3")));
    d("reviewed", "TDO-3", "--open", "1");
    r = d("approve", "TDO-3", "--role", "all");
    add("approve-refuses-open-concern", "exit 2 naming the policy owner", r.status === 2 && /policy owner/.test(r.stderr), r.stdout + r.stderr);
    write("docs/designs/tasks.md", design("| Concern | Source | Status |\n|---|---|---|\n| The export holds personal data | SECURITY.md | closed: the file never leaves the browser |"));
    commit("TDO-3: close the concern");
    d("reviewed", "TDO-3", "--open", "0");
    d("approve", "TDO-3", "--role", "all");
    d("approve", "TDO-3", "--role", "product_owner", "--name", "Pat Product");
    commit("TDO-3: design approved by two");
    r = d("check", "TDO-3");
    add("check-level-3-needs-lead", "exit 1 naming lead", r.status === 1 && /not approved by: lead/.test(r.stderr), r.stdout + r.stderr);
    d("approve", "TDO-3", "--role", "lead", "--name", "Lee Lead");
    commit("TDO-3: design approved by the lead");
    r = d("check", "TDO-3");
    add("check-passes-level-3", "exit 0", r.status === 0, r.stdout + r.stderr);
    r = d("check", "TDO-2");
    add("two-intents-keep-separate-records", "TDO-2 is still voided while TDO-3 passes", r.status === 1, r.stdout + r.stderr);

    write("docs/designs/tasks.md", design("").replace("## Flagged concerns\n", ""));
    commit("drop the concerns section");
    r = d("check", "TDO-3");
    add("check-needs-concerns-section", "exit 1: no Flagged concerns section", r.status === 1 && /no Flagged concerns section/.test(r.stderr), r.stdout + r.stderr);

    // --- a level 1 change has no design, so the gate is the plan alone ----------------------------
    write("intent/TDO-1-trim-titles/plan.md", plan("TDO-1"));
    commit("TDO-1: plan: trim-titles");
    r = py(repo, GATE, "intent/TDO-1-trim-titles/plan.md");
    add("gate-passes-with-no-design", "exit 0 on TDO-1/build", r.status === 0 && /"branch": "TDO-1\/build"/.test(r.stdout), r.stdout + r.stderr);

    // --- the runner sends a build with an open review finding to an engineer ---------------------
    const findings = (body) => {
      const out = run("python3", ["-c", "import json,sys\nsys.path.insert(0, sys.argv[1])\nimport factory\nprint(json.dumps(factory.findings_reasons(sys.argv[2])))", SCRIPTS, body], repo);
      try { return JSON.parse(out.stdout); } catch { return [[0, out.stderr]]; }
    };
    let f = findings("Built it.\n\nOpen review findings: 0\n");
    add("findings-none-open", "no reason to stop", f.length === 0, JSON.stringify(f));
    f = findings("Built it.\n\nOpen review findings: 2\n- a\n- b\n");
    add("findings-open-stops", "level 2: 2 review finding(s) still open", f.length === 1 && f[0][0] === 2 && /2 review finding/.test(f[0][1]), JSON.stringify(f));
    f = findings("Built it.\n");
    add("findings-missing-stops", "level 2: not stated", f.length === 1 && f[0][0] === 2 && /does not state/.test(f[0][1]), JSON.stringify(f));
    f = findings("Open review findings: 0\nOpen review findings: 3\n");
    add("findings-twice-stops", "level 2: stated twice", f.length === 1 && /twice/.test(f[0][1]), JSON.stringify(f));

    // --- the lists the commands show before they start --------------------------------------------
    write("intent/TDO-9-sort-tasks/intent.md", intent({ id: "TDO-9", title: "Sort tasks", risk: "low", outcome: "Tasks sort by name." }));
    commit("TDO-9: intent: sort-tasks");
    r = d("pending", "--missing", "design");
    let lines = r.stdout.trim().split("\n");
    add("pending-design-lists-new-intent", "TDO-9 listed, TDO-1 (has a plan) and TDO-3 (has a design) not", r.status === 0 && lines.includes("intent/TDO-9-sort-tasks/") && !lines.some((l) => /TDO-1-|TDO-3-/.test(l)), r.stdout + r.stderr);
    r = d("pending", "--missing", "plan");
    lines = r.stdout.trim().split("\n");
    add("pending-plan-lists-newest-first", "TDO-9 first, TDO-1 not listed", r.status === 0 && lines[0] === "intent/TDO-9-sort-tasks/" && !lines.some((l) => /TDO-1-/.test(l)), r.stdout + r.stderr);
    r = py(base, DESIGN, "pending", "--missing", "plan");
    add("pending-outside-a-repo-is-quiet", "exit 0 and no output", r.status === 0 && r.stdout === "", r.stdout + r.stderr);

    // A context line that changes directory through a command substitution, or loops, fails Claude
    // Code's permission check and the command never starts.
    const commands = join(ROOT, "plugins", "pro-ai-sdlc-egm", "commands");
    const bad = [];
    for (const name of readdirSync(commands)) {
      for (const line of readFileSync(join(commands, name), "utf8").split("\n")) {
        const m = line.match(/!`([^`]*)`/);
        if (m && /^- /.test(line) && (/\bcd "?\$\(/.test(m[1]) || /\bfor \w+ in\b/.test(m[1]))) bad.push(`${name}: ${m[1].slice(0, 60)}`);
      }
    }
    add("context-lines-pass-the-permission-check", "no cd through $(...) and no loop in a context line", bad.length === 0, bad.join("; "));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
  return { skipped: null, results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { skipped, results } = runSdlcEgmCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.id}${r.ok ? "" : `: expected ${r.expect} - ${r.reason}`}`);
  const bad = results.filter((r) => !r.ok).length;
  console.log(`${results.length - bad}/${results.length} cases pass`);
  process.exit(bad ? 1 : 0);
}
