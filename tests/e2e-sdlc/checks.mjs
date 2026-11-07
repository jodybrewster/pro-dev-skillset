// Deterministic checks for tests/e2e-sdlc.mjs. Every check takes (repoDir, scenario) through
// checkScenario() and returns [{ name, pass, detail }]. They use only git, gh and file reads,
// never a model, so mieruka's twin can import this module and run the same checks on its fixture.
//
//   import { checkScenario, CHECKS } from ".../tests/e2e-sdlc/checks.mjs";
//   const results = checkScenario(repoDir, scenario);
//
// `scenario` is the scenario JSON (its `checks` array names what to run) plus an optional
// `runtime` object the driver fills in. Every runtime key is optional:
//   intentDir     the scenario's own intent folder, else found by `intentHint` or the newest one
//   startSha      the default branch commit before the scenario began (bounds the history read)
//   local         true when there is no GitHub: checks that need gh pass as skipped
//   ghRepo        "owner/name" for gh -R, else gh reads the origin of repoDir
//   defaultBranch "main" unless set
//   transcriptDir where the driver kept the session transcripts
//   buildPr       the build pull request number
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// ---- small helpers --------------------------------------------------------

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
};

function context(repo, sc) {
  const rt = sc.runtime || {};
  const branch = rt.defaultBranch || "main";
  run("git", ["fetch", "-q", "--tags", "origin"], repo);
  const hasRemote = run("git", ["rev-parse", "--verify", "-q", `origin/${branch}`], repo).code === 0;
  const c = { repo, sc, rt, branch, ref: hasRemote ? `origin/${branch}` : "HEAD", local: !!rt.local };
  c.git = (...a) => run("git", a, repo);
  c.show = (path, ref = c.ref) => {
    const r = c.git("show", `${ref}:${path}`);
    return r.code === 0 ? r.out : null;
  };
  c.gh = (...a) => run("gh", [...a, ...(rt.ghRepo ? ["-R", rt.ghRepo] : [])], repo);
  c.ghJson = (...a) => {
    const r = c.gh(...a);
    if (r.code !== 0) return null;
    try { return JSON.parse(r.out); } catch { return null; }
  };
  c.since = rt.startSha ? `${rt.startSha}..${c.ref}` : c.ref;
  c.intentDir = resolveIntentDir(c);
  c.file = (name) => (c.intentDir ? `${c.intentDir}/${name}` : name);
  return c;
}

// An intent folder is named by its date or by its change id (spec-m1 R9): intent/2026-01-02-slug or intent/PDS-51-slug.
export const INTENT_DIR_RE = /^intent\/(?:\d{4}-\d{2}-\d{2}|[A-Z]{2,6}-[1-9][0-9]*)-[a-z0-9-]+$/;

// The intent folders in an `ls-tree --name-only intent/` listing.
export function intentDirsOf(listing) {
  return String(listing ?? "").split("\n").map((s) => s.replace(/\/$/, "")).filter((p) => INTENT_DIR_RE.test(p));
}

function intentDirs(c) {
  return intentDirsOf(c.git("ls-tree", "--name-only", c.ref, "intent/").out);
}

function resolveIntentDir(c) {
  if (c.rt.intentDir) return c.rt.intentDir.replace(/\/$/, "");
  const dirs = intentDirs(c);
  const hint = c.sc.intentHint && dirs.filter((d) => d.includes(c.sc.intentHint));
  if (hint && hint.length) return hint[hint.length - 1];
  return dirs.length ? dirs[dirs.length - 1] : null;
}

export function frontmatter(text) {
  const m = String(text || "").match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

// The `## Roles` block of REVIEW.md: a fenced yaml subset, `roles:` then five keys, each an
// inline list or `- item` lines. Returns { role: [names] } or null.
export function parseRoles(reviewText) {
  const text = String(reviewText || "");
  const at = text.search(/^## Roles[ \t]*$/m);
  if (at < 0) return null;
  const rest = text.slice(at).replace(/^## Roles[^\n]*\n/, "");
  const sec = [rest.split(/^## /m)[0]];
  const fence = sec[0].match(/```(?:ya?ml)?\n([\s\S]*?)```/);
  if (!fence) return null;
  const roles = {};
  let key = null;
  for (const raw of fence[1].split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").replace(/^#.*$/, "");
    if (!line.trim() || /^roles:\s*$/.test(line.trim())) continue;
    const inline = line.match(/^\s+([a-z_]+):\s*\[(.*)\]\s*$/);
    const head = line.match(/^\s+([a-z_]+):\s*$/);
    const item = line.match(/^\s+-\s+(.+?)\s*$/);
    if (inline) roles[inline[1]] = inline[2].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    else if (head) { key = head[1]; roles[key] = []; }
    else if (item && key) roles[key].push(item[1].replace(/^["']|["']$/g, ""));
  }
  return Object.keys(roles).length ? roles : null;
}

const roleNames = (c) => parseRoles(c.show("REVIEW.md")) || {};
const skip = (c, why = "no GitHub in --local") => ({ pass: true, detail: `skipped: ${why}` });
const levelOf = (text) => { const v = frontmatter(text).level; return v === undefined ? null : Number(v); };

function mergedPrs(c) {
  const list = c.ghJson("pr", "list", "--state", "merged", "--limit", "50", "--json", "number,title,body,files,commits,mergeCommit,headRefOid,mergedBy,headRefName");
  if (!list) return null;
  const inRange = new Set(c.git("rev-list", c.since).out.split("\n").filter(Boolean));
  return list.filter((p) => p.mergeCommit && inRange.has(p.mergeCommit.oid));
}

const filesOf = (p) => (p.files || []).map((f) => f.path);
const isBrief = (c, p) => {
  const f = filesOf(p).sort();
  return f.length === 2 && f[0] === c.file("plan.md") && f[1] === c.file("spec.md");
};
const buildPrs = (c, prs) => prs.filter((p) => !isBrief(c, p) && filesOf(p).some((f) => !f.startsWith("intent/")));

function record(c) {
  if (!c.intentDir) return null;
  const folder = c.intentDir.split("/").pop();
  const path = join(c.repo, ".pro-dev", "factory", `factory-${folder.toLowerCase()}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

const commitAuthors = (c, path) => c.git("log", c.ref, "--format=%an", "--", path).out.split("\n").filter(Boolean);
const transcript = (c, label) => {
  const dir = c.rt.transcriptDir;
  if (!dir || !existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => n.includes(label) && n.endsWith(".jsonl"));
  return f ? readFileSync(join(dir, f), "utf8") : null;
};

// ---- the checks -----------------------------------------------------------
// Each entry: { gh: needs GitHub, run: (c) => { pass, detail } }.

export const CHECKS = {
  "level": {
    run(c) {
      const want = c.sc.expectedLevel;
      const got = levelOf(c.show(c.file("intent.md")));
      return { pass: got === want, detail: `level ${got} in intent.md, expected ${want}` };
    },
  },
  "level-monotonic": {
    run(c) {
      const revs = c.git("log", c.ref, "--reverse", "--format=%H", "--", c.file("intent.md")).out.split("\n").filter(Boolean);
      const seen = revs.map((r) => levelOf(c.show(c.file("intent.md"), r))).filter((v) => v !== null);
      const ok = seen.every((v, i) => i === 0 || v >= seen[i - 1]);
      return { pass: ok && seen.length > 0, detail: `levels over history: ${seen.join(" ") || "none"}` };
    },
  },
  "brief-pr-merged": {
    gh: true,
    run(c) {
      if (c.local) return skip(c);
      const prs = mergedPrs(c);
      if (!prs) return { pass: false, detail: "could not list merged pull requests" };
      const brief = prs.filter((p) => isBrief(c, p));
      return { pass: brief.length === 1, detail: `${brief.length} merged PR with exactly spec.md and plan.md` };
    },
  },
  "brief-plan-approved": {
    run(c) {
      const plan = c.show(c.file("plan.md")) || "";
      const spec = c.show(c.file("spec.md")) || "";
      const parts = [
        [/^Status:\s*approved/im.test(plan), "plan Status approved"],
        [/^Approver:\s*factory/im.test(plan), "Approver starts with factory"],
        [/Stop-list categories:\s*none/i.test(plan), "Stop-list categories none"],
        [!/\|\s*\d+\s*\|[^|]*\|[^|]*\|\s*\|/.test(spec.split(/^## Flagged concerns/m)[1] || ""), "no open flagged concern rows"],
      ];
      return { pass: parts.every((p) => p[0]), detail: parts.map((p) => `${p[0] ? "ok" : "MISSING"} ${p[1]}`).join("; ") };
    },
  },
  "build-pr-merged": {
    gh: true,
    run(c) {
      if (c.local) return skip(c);
      const prs = mergedPrs(c);
      if (!prs) return { pass: false, detail: "could not list merged pull requests" };
      const b = buildPrs(c, prs);
      return { pass: b.length === 1, detail: `${b.length} merged build PR (one build branch)${b[0] ? `, #${b[0].number}` : ""}` };
    },
  },
  "build-pr-merged-by-lead": {
    gh: true,
    run(c) {
      if (c.local) return skip(c);
      const prs = mergedPrs(c);
      if (!prs) return { pass: false, detail: "could not list merged pull requests" };
      const b = buildPrs(c, prs);
      if (b.length !== 1) return { pass: false, detail: `${b.length} merged build PRs` };
      const lead = (roleNames(c).lead || [])[0];
      const gates = (c.rt.gates || []).find((g) => g.label === "merge");
      const pinned = !gates || gates.matchHeadCommit === b[0].headRefOid;
      return { pass: pinned, detail: `PR #${b[0].number} merged as ${lead || "the lead"}${gates ? `, pin ${pinned ? "equals" : "differs from"} the PR head` : ""}` };
    },
  },
  "main-first-parent": {
    gh: true,
    run(c) {
      if (c.local) return skip(c);
      const prs = mergedPrs(c);
      if (!prs) return { pass: false, detail: "could not list merged pull requests" };
      const merges = new Set(prs.map((p) => p.mergeCommit.oid));
      const stray = [];
      for (const sha of c.git("rev-list", "--first-parent", c.since).out.split("\n").filter(Boolean)) {
        if (merges.has(sha)) continue;
        const files = c.git("show", "--name-only", "--format=", sha).out.split("\n").filter(Boolean);
        if (!files.every((f) => f.startsWith("intent/"))) stray.push(sha.slice(0, 8));
      }
      return { pass: stray.length === 0, detail: stray.length ? `commits on main outside a PR squash and the intent files: ${stray.join(" ")}` : "every code change reached main through a PR squash" };
    },
  },
  "build-pr-stamp": {
    gh: true,
    run(c) {
      if (c.local) return skip(c);
      const prs = mergedPrs(c);
      const b = prs ? buildPrs(c, prs)[0] : null;
      if (!b) return { pass: false, detail: "no merged build PR" };
      const m = String(b.body || "").match(/pr-check[^>]*?result=(\w+)/);
      return { pass: !!m && m[1] === "pass", detail: m ? `pr-check marker result=${m[1]}` : "no pr-check marker in the PR body" };
    },
  },
  "record-pass": {
    run(c) {
      if (c.local) return skip(c, "the factory does not run in --local");
      const r = record(c);
      if (!r) return { pass: false, detail: "no factory record" };
      let d = {};
      try { d = JSON.parse(r.detail_json || "{}"); } catch { /* leave empty */ }
      const ok = r.status === "pass" && /deploy is yours/.test(r.summary || "") && /unread diff: \d+ lines/.test(r.summary || "") && d.state === "merged";
      return { pass: ok, detail: `status ${r.status}, state ${d.state}, summary "${r.summary}"` };
    },
  },
  "no-tag": {
    run(c) {
      if (c.local) return skip(c);
      const tags = c.git("ls-remote", "--tags", "origin").out.trim();
      return { pass: tags === "", detail: tags ? "a tag exists on origin" : "no tag on origin, deploy is the person's" };
    },
  },
  "no-would-lines": {
    run(c) {
      const dir = c.rt.transcriptDir;
      if (!dir || !existsSync(dir)) return { pass: true, detail: "skipped: no transcripts" };
      const hits = readdirSync(dir).filter((n) => /factory.*\.(txt|jsonl)$/.test(n)).filter((n) => /\bwould-(block|deny|have|warn)/.test(readFileSync(join(dir, n), "utf8")));
      return { pass: hits.length === 0, detail: hits.length ? `warn-mode lines in ${hits.join(", ")}` : "no would- line in the factory transcripts, the session ran in enforce" };
    },
  },
  "first-commit-test-only": {
    gh: true,
    run(c) {
      if (c.local) return skip(c);
      const prs = mergedPrs(c);
      const b = prs ? buildPrs(c, prs)[0] : null;
      if (!b) return { pass: false, detail: "no merged build PR" };
      c.git("fetch", "-q", "origin", `pull/${b.number}/head`);
      const first = (b.commits || [])[0]?.oid;
      if (!first) return { pass: false, detail: "build PR has no commits" };
      const files = c.git("show", "--name-only", "--format=", first).out.split("\n").filter(Boolean);
      const tests = files.filter((f) => f.startsWith("test/"));
      const src = files.filter((f) => f.startsWith("src/"));
      return { pass: tests.length > 0 && src.length === 0, detail: `first build commit ${first.slice(0, 8)}: ${tests.length} test file, ${src.length} src file` };
    },
  },
  "tests-unchanged-after-added": {
    gh: true,
    run(c) {
      if (c.local) return skip(c);
      const prs = mergedPrs(c);
      const b = prs ? buildPrs(c, prs)[0] : null;
      if (!b) return { pass: false, detail: "no merged build PR" };
      c.git("fetch", "-q", "origin", `pull/${b.number}/head`);
      const added = [];
      const touched = {};
      for (const { oid } of b.commits || []) {
        for (const line of c.git("show", "--name-status", "--format=", oid).out.split("\n").filter(Boolean)) {
          const [st, path] = line.split("\t");
          if (!path || !path.startsWith("test/")) continue;
          if (st === "A") added.push(path);
          touched[path] = (touched[path] || 0) + 1;
        }
      }
      const edited = added.filter((p) => touched[p] > 1);
      return { pass: added.length > 0 && edited.length === 0, detail: `${added.length} test files added in the PR, edited again after: ${edited.join(" ") || "none"}` };
    },
  },
  "spec-flagged-concern": {
    run(c) {
      const hist = c.git("log", c.ref, "--reverse", "--format=%H", "--", c.file("spec.md")).out.split("\n").filter(Boolean);
      const first = hist.length ? c.show(c.file("spec.md"), hist[0]) || "" : "";
      const flagged = (first.split(/^## Flagged concerns/m)[1] || "").split(/^## /m)[0];
      const rows = flagged.split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l));
      return { pass: rows.length > 0, detail: `${rows.length} flagged concern row in the first committed spec` };
    },
  },
  "gate-authors": {
    run(c) {
      const roles = roleNames(c);
      const name = (r) => (roles[r] || [])[0];
      const need = [
        ["intent.md", "engineer"],
        ["spec.md", "engineer"], ["spec.md", "policy_owner"], ["spec.md", "product_owner"],
        ["plan.md", "engineer"], ["plan.md", "lead"],
      ];
      const miss = need.filter(([f, r]) => !name(r) || !commitAuthors(c, c.file(f)).includes(name(r)));
      const distinct = new Set(["product_owner", "engineer", "lead", "policy_owner"].map(name)).size === 4;
      return { pass: miss.length === 0 && distinct, detail: miss.length ? `missing author commits: ${miss.map(([f, r]) => `${f} by ${r}`).join(", ")}` : `each gate commit has its role map name; four distinct names ${distinct}` };
    },
  },
  "plan-two-approvers": {
    run(c) {
      const plan = c.show(c.file("plan.md")) || "";
      const line = (plan.match(/^Approver:.*$/m) || [""])[0];
      const roles = roleNames(c);
      const both = [(roles.engineer || [])[0], (roles.lead || [])[0]].filter(Boolean);
      return { pass: both.length === 2 && both.every((n) => line.includes(n)) && /^Status:\s*approved/im.test(plan), detail: line || "no Approver line" };
    },
  },
  "engineer-merge-refused": {
    gh: true,
    run(c) {
      if (c.local) return skip(c);
      const t = transcript(c, "merge-attempt");
      if (!t) return { pass: false, detail: "no merge-attempt transcript" };
      const refused = /merge-gate|production-gate|requires? (an )?approv|not (mergeable|approved)|blocked/i.test(t);
      const b = c.rt.buildPr ? c.ghJson("pr", "view", String(c.rt.buildPr), "--json", "state,mergedBy") : null;
      const lead = (roleNames(c).lead || [])[0];
      const mergedByLead = !b || b.state !== "MERGED" || (c.rt.gates || []).some((g) => g.label === "merge" && g.role === "lead");
      return { pass: refused && mergedByLead, detail: `${refused ? "gate text in the transcript" : "no gate text"}; the merge came from the lead step${lead ? ` (${lead})` : ""}` };
    },
  },
  "tag-on-origin": {
    run(c) {
      if (c.local) return skip(c);
      const out = c.git("ls-remote", "--tags", "origin", "v1.1.0").out;
      return { pass: /refs\/tags\/v1\.1\.0/.test(out), detail: out.trim() || "no v1.1.0 on origin" };
    },
  },
  "preflight-go": {
    run(c) {
      const path = join(c.repo, ".pro-dev", "ship", "preflight.json");
      if (!existsSync(path)) return { pass: false, detail: "no preflight.json" };
      let r = {};
      try { r = JSON.parse(readFileSync(path, "utf8")); } catch { return { pass: false, detail: "unreadable preflight.json" }; }
      const tagged = c.git("rev-parse", "v1.1.0^{commit}").out.trim();
      return { pass: ["pass", "partial"].includes(r.status) && (!tagged || r.head === tagged), detail: `status ${r.status}, head ${String(r.head).slice(0, 8)}${tagged ? `, tag ${tagged.slice(0, 8)}` : ""}` };
    },
  },
  "deploy-record-pass": {
    run(c) {
      const dir = join(c.repo, ".pro-dev", "ship", "deploys");
      if (!existsSync(dir)) return { pass: false, detail: "no deploys folder" };
      const recs = readdirSync(dir).filter((n) => n.endsWith(".json")).map((n) => { try { return JSON.parse(readFileSync(join(dir, n), "utf8")); } catch { return null; } }).filter(Boolean);
      const ok = recs.filter((r) => r.status === "pass");
      return { pass: ok.length > 0, detail: `${recs.length} deploy record, ${ok.length} with status pass` };
    },
  },
  "incident-record": {
    run(c) {
      const files = c.git("ls-tree", "-r", "--name-only", "HEAD", "intent/").out.split("\n").filter((f) => /\/incident\.md$/.test(f));
      return { pass: files.length > 0, detail: files.join(" ") || "no intent/<folder>/incident.md at HEAD" };
    },
  },
  "incident-intent": {
    run(c) {
      const dirs = intentDirsOf(c.git("ls-tree", "--name-only", "HEAD", "intent/").out);
      const before = new Set(c.rt.intentDirsBefore || []);
      const found = dirs.filter((d) => !before.has(d) && d !== c.intentDir).map((d) => ({ d, fm: frontmatter(c.show(`${d}/intent.md`, "HEAD")) })).filter((x) => /^incident\b/.test(x.fm.source || ""));
      const lv = found.map((x) => Number(x.fm.level));
      return { pass: found.length > 0 && lv.every((v) => v >= 2), detail: found.length ? found.map((x) => `${x.d} source ${x.fm.source} level ${x.fm.level}`).join("; ") : `no new intent with source incident (${dirs.length} intent folders)` };
    },
  },
};

// ---- entry points ---------------------------------------------------------

export function checkNames(scenario) {
  return (scenario.checks || []).slice();
}

// The one function the twin calls. A check that throws becomes a failed result.
export function checkScenario(repoDir, scenario) {
  const c = context(repoDir, scenario);
  const out = [];
  for (const name of checkNames(scenario)) {
    const def = CHECKS[name];
    if (!def) { out.push({ name, pass: false, detail: "unknown check" }); continue; }
    try {
      const r = def.run(c);
      out.push({ name, pass: !!r.pass, detail: String(r.detail || "") });
    } catch (e) {
      out.push({ name, pass: false, detail: `threw: ${e.message}` });
    }
  }
  return out;
}
