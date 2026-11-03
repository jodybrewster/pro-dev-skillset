#!/usr/bin/env node
// End-to-end test of the software factory and the escalation levels, from an idea to a merged
// pull request, a deploy by tag and an incident. Spends tokens and creates a throwaway private
// GitHub repo, so it is on demand only (docs/evals.md).
//
//   node tests/e2e-sdlc.mjs --dry                         # print every step and check, spend nothing
//   node tests/e2e-sdlc.mjs --scenario 1,2 --allow-broad-token
//   node tests/e2e-sdlc.mjs --local                       # bare remote, no GitHub, stops where a PR is needed
//
// The harness runs on the host. Level 1 work goes through `factory.py run`, which starts its own
// Docker sessions. Role turns (the intent, spec, plan, execute, review, ship and incident
// commands) are `claude -p` turns in the fixture repo with the plugins installed at project scope
// from the marketplace at --ref. A gate answer is a git commit made as the role name.
// The fixture's role map holds four different names; the platform owner is the engineer.
//
// Needs ANTHROPIC_API_KEY (MIERUKA_ANTHROPIC_API_KEY is used when it is unset), Docker for level 1,
// gh logged in with repo create and delete rights and FACTORY_GH_TOKEN (a token scoped to the
// throwaway repos) or --allow-broad-token, which uses `gh auth token` and is for demos only.
// Tokens go through the environment of child processes and are never written to a file or a
// transcript: every output is scrubbed before it is saved.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS, checkScenario } from "./e2e-sdlc/checks.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAFFOLD = join(ROOT, "plugins/pro-ai-sdlc/evals/spec-from-intent/scaffold.sh");
const FACTORY = join(ROOT, "plugins/pro-ai-sdlc/scripts/factory.py");
const SHIP = join(ROOT, "plugins/pro-ship/scripts/ship.py");
const MARKETPLACE = "jodybrewster/pro-dev-skillset";
const PLUGINS = ["pro-core", "pro-ai-sdlc", "pro-ship", "pro-quality", "pro-security"];
const REPO_RE = /^sdlc-e2e-\d{8}-\d{6}$/;

export const ROLES = {
  product_owner: "Priya Product",
  engineer: "Eli Engineer",
  lead: "Lena Lead",
  policy_owner: "Pablo Policy",
  platform_owner: "Eli Engineer",
};

const STEP_KINDS = ["claude", "commit", "patch", "discover", "factory-level", "factory-run", "find-pr", "merge", "git", "tag", "ship-deployed"];

export function parseArgs(argv) {
  const o = { scenarios: [1, 2, 3], ref: null, local: false, allowBroad: false, keep: false, maxCostUsd: 30, dry: false, model: "sonnet", owner: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scenario") o.scenarios = String(argv[++i]).split(",").map((s) => Number(s.trim()));
    else if (a === "--ref") o.ref = argv[++i];
    else if (a === "--local") o.local = true;
    else if (a === "--allow-broad-token") o.allowBroad = true;
    else if (a === "--image") o.image = argv[++i];
    else if (a === "--keep") o.keep = true;
    else if (a === "--max-cost-usd") o.maxCostUsd = Number(argv[++i]);
    else if (a === "--dry") o.dry = true;
    else if (a === "--model") o.model = argv[++i];
    else if (a === "--owner") o.owner = argv[++i];
    else if (a === "--out") o.out = argv[++i];
    else throw new Error(`unknown flag ${a}`);
  }
  if (!o.scenarios.length || o.scenarios.some((n) => ![1, 2, 3].includes(n))) throw new Error("--scenario takes 1, 2 and 3 in a comma list");
  if (!Number.isFinite(o.maxCostUsd) || o.maxCostUsd <= 0) throw new Error("--max-cost-usd needs a positive number");
  return o;
}

export function loadScenario(n) {
  return JSON.parse(readFileSync(join(ROOT, "tests/e2e-sdlc/scenarios", `${n}.json`), "utf8"));
}

// Problems with a scenario file: unknown step kinds or check names. Empty when sound.
export function validateScenario(sc) {
  const bad = [];
  for (const [i, s] of (sc.steps || []).entries()) if (!STEP_KINDS.includes(s.kind)) bad.push(`step ${i + 1}: unknown kind ${s.kind}`);
  for (const n of sc.checks || []) if (!CHECKS[n]) bad.push(`unknown check ${n}`);
  for (const s of sc.steps || []) if (s.role && !ROLES[s.role]) bad.push(`unknown role ${s.role}`);
  return bad;
}

const stepText = (s) => {
  const who = s.role ? ` as ${ROLES[s.role]} (${s.role})` : "";
  const what = s.kind === "claude" ? ` ${String(s.prompt).split(/\. /)[0].slice(0, 90)}`
    : s.kind === "commit" ? ` ${s.file} "${s.message}"`
    : s.kind === "factory-level" ? ` expects level ${s.expect}`
    : s.kind === "git" ? ` git ${s.args.join(" ")}`
    : s.kind === "tag" ? ` ${s.tag}`
    : "";
  return `${s.kind}${who}: ${s.label}${what}${s.github ? "  [needs GitHub]" : ""}`;
};

export function describe(sc) {
  const lines = [`scenario ${sc.id}: ${sc.name}`, `  intent "${sc.intentText}", started by ${sc.role}, level ${sc.expectedLevel}, expected stop: ${sc.expectedStop}`, "  steps:"];
  sc.steps.forEach((s, i) => lines.push(`    ${i + 1}. ${stepText(s)}`));
  lines.push("  checks:");
  for (const n of sc.checks) lines.push(`    - ${n}${CHECKS[n]?.gh ? "  [needs GitHub]" : ""}`);
  return lines;
}

function dry(opts) {
  const scs = opts.scenarios.map(loadScenario);
  let steps = 0, checks = 0, bad = 0;
  console.log(`e2e-sdlc dry run: nothing is spent and GitHub is not touched`);
  console.log(`origin: ${opts.local ? "a local bare remote (--local), steps that need GitHub are skipped" : "a throwaway private GitHub repo sdlc-e2e-<yyyymmdd-hhmmss>, deleted at the end"}`);
  console.log(`roles: ${Object.entries(ROLES).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`install: ${PLUGINS.join(", ")} at project scope from ${MARKETPLACE} at the ref (default: the current branch)\n`);
  for (const sc of scs) {
    const problems = validateScenario(sc);
    for (const l of describe(sc)) console.log(l);
    for (const p of problems) console.log(`  PROBLEM ${p}`);
    console.log("");
    steps += sc.steps.length; checks += sc.checks.length; bad += problems.length;
  }
  console.log(`dry: ${scs.length} scenario${scs.length === 1 ? "" : "s"}, ${steps} steps, ${checks} checks, ${bad} problems, cap $${opts.maxCostUsd}, nothing spent`);
  return bad ? 1 : 0;
}

// ---- helpers --------------------------------------------------------------

function sh(cmd, args, o = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...o });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}`, stdout: r.stdout || "" };
}

const stampNow = () => {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

const expand = (v, rt) => typeof v === "string"
  ? v.replace(/\{role:(\w+)\}/g, (_, r) => ROLES[r]).replace(/\{(intentDir|buildPr|ref)\}/g, (_, k) => String(rt[k] ?? `{${k}}`))
  : Array.isArray(v) ? v.map((x) => expand(x, rt))
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, expand(x, rt)]))
  : v;

// Flips the first `Status: <from>` line and any `status: <from>` frontmatter key.
export function setStatus(text, from, to) {
  return text
    .replace(new RegExp(`^Status:[ \\t]*${from}\\.?[ \\t]*$`, "m"), `Status: ${to}.`)
    .replace(new RegExp(`^status:[ \\t]*${from}[ \\t]*$`, "m"), `status: ${to}`);
}

// Adds a resolution under `## Flagged concerns`, before the next heading.
export function resolveConcerns(text, resolution) {
  const m = text.match(/^## Flagged concerns[^\n]*\n/m);
  if (!m) return `${text.replace(/\n*$/, "\n")}\n## Flagged concerns\n\n${resolution}\n`;
  const start = m.index + m[0].length;
  const next = text.slice(start).search(/^## /m);
  const end = next < 0 ? text.length : start + next;
  return `${text.slice(0, end).replace(/\n*$/, "\n")}\n${resolution}\n\n${text.slice(end)}`;
}

function applyEdit(text, e) {
  if (e.status) {
    const out = setStatus(text, e.status.from, e.status.to);
    if (out === text) throw new Error(`no status ${e.status.from} to flip`);
    return out;
  }
  if (e.replaceLine) {
    const re = new RegExp(e.replaceLine.match, "m");
    if (!re.test(text)) throw new Error(`no line matches ${e.replaceLine.match}`);
    return text.replace(re, e.replaceLine.with);
  }
  if (e.resolveConcerns) return resolveConcerns(text, e.resolveConcerns);
  throw new Error("unknown edit");
}

// ---- the fixture ----------------------------------------------------------

const SHIP_BLOCK = [
  "", "## Ship", "", "```yaml", "targets:", "  - id: app", "    kind: tag-release",
  "    rollback:", "      triggers:", '        - "the export is wrong or empty"', "      steps:",
  '        - "Revert the release commit on main and tag the previous version again."',
  '      rto: "one release cycle"', 'tag_pattern: "v*"', "last_deploy: tag", "```", "",
].join("\n");

const rolesBlock = () => [
  "", "## Roles", "", "```yaml", "roles:",
  ...Object.entries(ROLES).map(([k, v]) => `  ${k}: [${v}]`), "```", "",
].join("\n");

const emailOf = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;

function gitAs(repo, role, args, env) {
  const name = ROLES[role];
  return sh("git", ["-C", repo, "-c", `user.name=${name}`, "-c", `user.email=${emailOf(name)}`, ...args], { env });
}

// ---- the run --------------------------------------------------------------

async function live(opts) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.MIERUKA_ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("needs ANTHROPIC_API_KEY set (MIERUKA_ANTHROPIC_API_KEY also works)"); return 1; }
  for (const bin of ["git", "python3", "claude"]) if (sh(bin, ["--version"]).code === null) { console.error(`needs ${bin} on PATH`); return 1; }

  let token = null;
  if (!opts.local) {
    if (sh("gh", ["--version"]).code === null) { console.error("needs gh on PATH"); return 1; }
    token = process.env.FACTORY_GH_TOKEN || (opts.allowBroad ? sh("gh", ["auth", "token"]).stdout.trim() : "");
    if (!token) { console.error("set FACTORY_GH_TOKEN to a token scoped to the throwaway repos, or pass --allow-broad-token (demo only)"); return 1; }
  }
  const ref = opts.ref || sh("git", ["-C", ROOT, "branch", "--show-current"]).stdout.trim();
  if (!opts.ref) {
    const ahead = sh("git", ["-C", ROOT, "rev-list", "--count", `origin/${ref}..HEAD`]);
    if (ahead.code !== 0) { console.error(`branch ${ref} is not on origin; push it or pass --ref`); return 1; }
    if (ahead.stdout.trim() !== "0") console.log(`note: ${ref} has unpushed commits; the sessions install what origin has`);
  }
  const needDocker = opts.scenarios.some((n) => loadScenario(n).steps.some((s) => s.kind === "factory-run")) && !opts.local;
  if (needDocker && sh("docker", ["info"]).code !== 0) { console.error("level 1 scenarios need Docker running"); return 1; }

  const stamp = stampNow();
  const out = opts.out || join(ROOT, "tests", "e2e-results", stamp);
  mkdirSync(out, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "sdlc-e2e-"));
  const repo = join(work, "repo"), home = join(work, "home");
  mkdirSync(repo); mkdirSync(home);
  const secrets = [token, apiKey].filter(Boolean);
  const scrub = (s) => secrets.reduce((t, x) => t.split(x).join("[redacted]"), String(s));
  const save = (name, text) => writeFileSync(join(out, name), scrub(text));

  const state = { cost: 0, results: [], createdRepo: null, owner: null, rt: {} };
  const record = (r) => { state.results.push(r); console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`); };

  // Environment for the role turns: a private HOME so the host's Claude settings and hook mode
  // files are not touched, git identity and the credential helper through GIT_CONFIG_* so no
  // token lands in a file.
  const turnEnv = (role, extra = {}) => {
    const cfg = [
      ["user.name", ROLES[role]], ["user.email", emailOf(ROLES[role])],
      ["credential.https://github.com.helper", ""], ["credential.https://github.com.helper", "!gh auth git-credential"],
    ];
    const env = { ...process.env, HOME: home, ANTHROPIC_API_KEY: apiKey, GIT_CONFIG_COUNT: String(cfg.length), ...extra };
    cfg.forEach(([k, v], i) => { env[`GIT_CONFIG_KEY_${i}`] = k; env[`GIT_CONFIG_VALUE_${i}`] = v; });
    delete env.FACTORY_GH_TOKEN; delete env.MIERUKA_ANTHROPIC_API_KEY;
    if (token) env.GH_TOKEN = token; else delete env.GH_TOKEN;
    return env;
  };
  const hostEnv = (role) => ({ ...process.env, GIT_TERMINAL_PROMPT: "0", ...(role ? { GIT_AUTHOR_NAME: ROLES[role], GIT_COMMITTER_NAME: ROLES[role], GIT_AUTHOR_EMAIL: emailOf(ROLES[role]), GIT_COMMITTER_EMAIL: emailOf(ROLES[role]) } : {}) });
  const git = (...a) => sh("git", ["-C", repo, ...a], { env: hostEnv() });

  let n = 0;
  const claudeTurn = (label, prompt, role, resume, extraEnv) => {
    if (state.cost >= opts.maxCostUsd) { record({ name: `${label}: within the cost cap`, pass: false, detail: `spent $${state.cost.toFixed(2)}` }); return null; }
    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions", "--model", opts.model, "--max-turns", "80", ...(resume ? ["--resume", resume] : [])];
    const r = spawnSync("claude", args, { cwd: repo, env: turnEnv(role, extraEnv), encoding: "utf8", timeout: 40 * 60 * 1000, maxBuffer: 256 * 1024 * 1024 });
    const raw = r.stdout || "";
    save(`${String(++n).padStart(2, "0")}-${state.rt.scenario}-${label.replace(/\W+/g, "-")}.jsonl`, raw);
    let result = null;
    for (const line of raw.split("\n")) { try { const e = JSON.parse(line); if (e.type === "result") result = e; } catch { /* not json */ } }
    state.cost += Number(result?.total_cost_usd) || 0;
    console.log(`-- ${label}: ${result ? `$${Number(result.total_cost_usd).toFixed(2)}, ${result.num_turns} turns` : `no result (exit ${r.status})`}`);
    return { session: result?.session_id, text: result?.result || "" };
  };

  const tracked = (glob) => git("ls-files", "--", glob).stdout.split("\n").filter(Boolean);
  const pushedBranches = () => sh("git", ["-C", repo, "ls-remote", "--heads", "origin"], { env: hostEnv() }).stdout.split("\n").filter((l) => l && !/refs\/heads\/main$/.test(l));

  const installPlugins = () => {
    const env = turnEnv("lead");
    const add = sh("claude", ["plugin", "marketplace", "add", `${MARKETPLACE}#${ref}`], { cwd: repo, env });
    record({ name: "marketplace added", pass: add.code === 0, detail: add.code ? scrub(add.out).trim().split("\n").pop() : ref });
    for (const p of PLUGINS) {
      const r = sh("claude", ["plugin", "install", `${p}@pro-dev-skillset`, "--scope", "project"], { cwd: repo, env });
      record({ name: `${p} installed at project scope`, pass: r.code === 0, detail: r.code ? scrub(r.out).trim().split("\n").pop() : "" });
    }
  };

  const buildFixture = () => {
    const sc = sh("bash", [SCAFFOLD], { cwd: repo });
    if (sc.code !== 0) { record({ name: "fixture scaffolded", pass: false, detail: sc.out.slice(-200) }); return false; }
    git("rm", "-rqf", "intent/2026-01-05-due-dates");
    const append = (f, text) => writeFileSync(join(repo, f), readFileSync(join(repo, f), "utf8").replace(/\n*$/, "\n") + text);
    append("CLAUDE.md", SHIP_BLOCK);
    append("REVIEW.md", rolesBlock());
    writeFileSync(join(repo, ".gitignore"), "node_modules/\n.pro-dev/\n.mieruka/\n");
    git("add", "-A");
    gitAs(repo, "lead", ["commit", "-qm", "tiny-tasks baseline with ship target and roles"], hostEnv());
    return true;
  };

  const origins = () => {
    if (opts.local) {
      const bare = join(work, "origin.git");
      sh("git", ["init", "-q", "--bare", "-b", "main", bare]);
      return bare;
    }
    const name = `sdlc-e2e-${stamp}`;
    if (!REPO_RE.test(name)) throw new Error(`refusing repo name ${name}`);
    const c = sh("gh", ["repo", "create", `${state.owner}/${name}`, "--private"]);
    if (c.code !== 0) throw new Error(`gh repo create failed: ${scrub(c.out).trim()}`);
    state.createdRepo = name;
    return `https://github.com/${state.owner}/${name}.git`;
  };

  const cleanStale = () => {
    const l = sh("gh", ["repo", "list", state.owner, "--limit", "200", "--json", "name,createdAt"]);
    if (l.code !== 0) { console.log("note: could not list repos to remove stale sdlc-e2e ones"); return; }
    let rows = [];
    try { rows = JSON.parse(l.stdout); } catch { return; }
    for (const r of rows) {
      if (!REPO_RE.test(r.name) || Date.now() - Date.parse(r.createdAt) < 24 * 3600 * 1000) continue;
      const d = sh("gh", ["repo", "delete", `${state.owner}/${r.name}`, "--yes"]);
      console.log(`stale repo ${r.name}: ${d.code === 0 ? "deleted" : `not deleted (${scrub(d.out).trim().split("\n").pop()})`}`);
    }
  };

  let code = 1;
  try {
    console.log(`e2e-sdlc: ref ${ref}, model ${opts.model}, cap $${opts.maxCostUsd}, origin ${opts.local ? "local bare remote" : "throwaway GitHub repo"}`);
    if (!opts.local) {
      state.owner = opts.owner || sh("gh", ["api", "user", "--jq", ".login"]).stdout.trim();
      if (!/^[A-Za-z0-9-]+$/.test(state.owner)) throw new Error("could not resolve the GitHub owner; pass --owner");
      cleanStale();
    }
    git("init", "-q", "-b", "main");
    if (!buildFixture()) throw new Error("fixture failed");
    const remote = origins();
    git("remote", "add", "origin", remote);
    installPlugins();
    git("add", "-A"); // .claude/settings.json from the project-scope installs
    gitAs(repo, "lead", ["commit", "-qm", "project-scope plugin install"], hostEnv());
    const push = sh("git", ["-C", repo, "push", "-q", "-u", "origin", "main"], { env: turnEnv("lead") });
    record({ name: "fixture pushed to origin", pass: push.code === 0, detail: push.code ? scrub(push.out).trim().split("\n").pop() : opts.local ? "local bare" : `${state.owner}/${state.createdRepo}` });
    if (state.results.some((r) => !r.pass)) throw new Error("setup failed");
    git("remote", "set-head", "origin", "main");

    for (const id of opts.scenarios) {
      const sc = loadScenario(id);
      const probs = validateScenario(sc);
      if (probs.length) { record({ name: `scenario ${id} file`, pass: false, detail: probs.join("; ") }); continue; }
      console.log(`\n== scenario ${id}: ${sc.name}`);
      const rt = state.rt = {
        scenario: id, local: opts.local, defaultBranch: "main", transcriptDir: out, gates: [],
        ghRepo: opts.local ? null : `${state.owner}/${state.createdRepo}`,
        startSha: git("rev-parse", "origin/main").stdout.trim(),
        intentDirsBefore: git("ls-tree", "--name-only", "HEAD", "intent/").stdout.split("\n").map((s) => s.replace(/\/$/, "")).filter(Boolean),
      };
      let stop = false;
      for (const [i, raw] of sc.steps.entries()) {
        if (stop) break;
        const s = expand(raw, rt);
        const tag = `s${id}.${i + 1} ${s.label}`;
        if (s.github && opts.local) { console.log(`-- ${tag}: skipped (--local)`); continue; }
        try {
          if (s.kind === "claude") {
            const known = new Set(s.until?.tracked ? tracked(s.until.tracked) : []);
            const met = () => s.until?.tracked ? tracked(s.until.tracked).some((f) => !known.has(f))
              : s.until?.exists ? existsSync(join(repo, s.until.exists))
              : s.until?.branchPushed ? pushedBranches().length > 0 : true;
            let r = claudeTurn(`s${id}-${s.label}`, opts.local && s.promptLocal ? s.promptLocal : s.prompt, s.role, null, s.env);
            for (let k = 0; r && !met() && k < (s.followups || []).length; k++) r = claudeTurn(`s${id}-${s.label}-${k + 2}`, s.followups[k], s.role, r.session, s.env);
            if (s.label !== "merge-attempt" && s.label !== "review") record({ name: `${tag}: produced its output`, pass: met(), detail: s.until ? JSON.stringify(s.until) : "" });
            if (s.label === "execute" || s.label === "ship") git("pull", "-q", "--ff-only", "origin", "main");
            if (!met() && s.label !== "merge-attempt" && s.label !== "review") stop = true;
          } else if (s.kind === "discover") {
            const now = git("ls-files", "--", "intent/*/intent.md").stdout.split("\n").filter(Boolean).map((f) => dirname(f));
            const fresh = now.filter((d) => !rt.intentDirsBefore.includes(d));
            rt.intentDir = fresh[0] || null;
            record({ name: `${tag}`, pass: !!rt.intentDir, detail: rt.intentDir || "no new intent folder" });
            if (!rt.intentDir) stop = true;
          } else if (s.kind === "patch") {
            for (const p of sc.fixture.patches) {
              const f = join(repo, p.file), t = readFileSync(f, "utf8");
              if (!t.includes(p.from)) throw new Error(`patch target not found in ${p.file}`);
              writeFileSync(f, t.replace(p.from, p.to));
            }
            git("add", "-A");
            gitAs(repo, s.role, ["commit", "-qm", sc.fixture.message], hostEnv());
            const pr = sh("git", ["-C", repo, "push", "-q", "origin", "main"], { env: turnEnv(s.role) });
            record({ name: tag, pass: pr.code === 0, detail: scrub(pr.out).trim().split("\n").pop() });
            rt.startSha = git("rev-parse", "HEAD").stdout.trim();
          } else if (s.kind === "commit") {
            git("pull", "-q", "--ff-only", "origin", "main");
            const f = join(repo, s.file);
            let text = readFileSync(f, "utf8");
            for (const e of s.edit) text = applyEdit(text, e);
            writeFileSync(f, text);
            git("add", "--", s.file);
            const c = gitAs(repo, s.role, ["commit", "-qm", s.message], hostEnv());
            const pr = sh("git", ["-C", repo, "push", "-q", "origin", "main"], { env: turnEnv(s.role) });
            const sha = git("rev-parse", "HEAD").stdout.trim();
            rt.gates.push({ label: s.label, role: s.role, sha });
            record({ name: `${tag} (commit as ${ROLES[s.role]})`, pass: c.code === 0 && pr.code === 0, detail: sha.slice(0, 8) });
          } else if (s.kind === "factory-level") {
            const r = sh("python3", [FACTORY, "level", rt.intentDir, "--repo", repo, "--json"], { env: hostEnv() });
            let j = null; try { j = JSON.parse(r.stdout); } catch { /* shown below */ }
            record({ name: tag, pass: !!j && j.level === s.expect, detail: j ? `level ${j.level}, reasons ${(j.reasons || []).join("; ")}` : r.out.trim().slice(0, 200) });
          } else if (s.kind === "factory-run") {
            const left = Math.max(1, Math.min(8, opts.maxCostUsd - state.cost));
            const env = { ...process.env, ANTHROPIC_API_KEY: apiKey, FACTORY_GH_TOKEN: token, FACTORY_MARKETPLACE_REF: ref };
            const args = [FACTORY, "run", rt.intentDir, "--repo", repo, "--max-cost-usd", String(left), "--marketplace-ref", ref, ...(opts.image ? ["--image", opts.image] : []), ...(opts.allowBroad ? ["--allow-broad-token"] : [])];
            const r = spawnSync("python3", args, { env, encoding: "utf8", timeout: 60 * 60 * 1000, maxBuffer: 256 * 1024 * 1024 });
            const text = `${r.stdout || ""}${r.stderr || ""}`;
            save(`${String(++n).padStart(2, "0")}-${id}-factory.txt`, text);
            rt.factoryLines = text.split("\n").filter((l) => /^factory:/.test(l));
            rt.factoryExit = r.status;
            for (const l of rt.factoryLines) console.log(`   ${scrub(l)}`);
            git("pull", "-q", "--ff-only", "origin", "main");
            const rec = join(repo, ".pro-dev", "factory", `factory-${rt.intentDir.split("/").pop()}.json`);
            if (existsSync(rec)) { try { state.cost += Number(JSON.parse(JSON.parse(readFileSync(rec, "utf8")).detail_json).cost_usd) || 0; } catch { /* no cost */ } }
            record({ name: `${tag}: exit 0 and a merged line`, pass: r.status === 0 && rt.factoryLines.some((l) => /merged/.test(l)), detail: `exit ${r.status}, ${rt.factoryLines.length} factory lines` });
          } else if (s.kind === "find-pr") {
            const r = sh("gh", ["pr", "list", "-R", rt.ghRepo, "--state", "open", "--json", "number,headRefOid,headRefName"], { env: turnEnv("engineer") });
            let list = []; try { list = JSON.parse(r.stdout); } catch { /* none */ }
            rt.buildPr = list[0]?.number; rt.buildHead = list[0]?.headRefOid;
            record({ name: tag, pass: !!rt.buildPr, detail: rt.buildPr ? `#${rt.buildPr}` : "no open pull request" });
            if (!rt.buildPr) stop = true;
          } else if (s.kind === "merge") {
            const v = sh("gh", ["pr", "view", String(rt.buildPr), "-R", rt.ghRepo, "--json", "headRefOid"], { env: turnEnv("lead") });
            const oid = JSON.parse(v.stdout).headRefOid;
            const m = sh("gh", ["pr", "merge", String(rt.buildPr), "-R", rt.ghRepo, "--squash", "--match-head-commit", oid], { env: turnEnv("lead") });
            rt.gates.push({ label: "merge", role: "lead", matchHeadCommit: oid });
            record({ name: `${tag} (as ${ROLES.lead})`, pass: m.code === 0, detail: scrub(m.out).trim().split("\n").pop() });
            if (m.code !== 0) stop = true;
          } else if (s.kind === "git") {
            const r = git(...s.args);
            record({ name: tag, pass: r.code === 0, detail: scrub(r.out).trim().split("\n").pop() });
          } else if (s.kind === "tag") {
            const t = gitAs(repo, s.role, ["tag", "-a", s.tag, "-m", s.tag], hostEnv());
            const p = sh("git", ["-C", repo, "push", "-q", "origin", s.tag], { env: turnEnv(s.role) });
            record({ name: tag, pass: t.code === 0 && p.code === 0, detail: scrub(`${t.out}${p.out}`).trim().split("\n").pop() });
          } else if (s.kind === "ship-deployed") {
            const sha = git("rev-parse", "HEAD").stdout.trim();
            const r = sh("python3", [SHIP, "deployed", "--root", repo, "--target", s.target, "--env", s.env, "--commit", sha, "--outcome", "succeeded"], { env: hostEnv() });
            record({ name: tag, pass: r.code === 0, detail: r.out.trim().split("\n").pop() });
          }
        } catch (e) {
          record({ name: tag, pass: false, detail: scrub(e.message) });
          stop = true;
        }
      }
      // The shared checks, on the fixture as it stands now.
      if (!rt.intentDir) rt.intentDir = null;
      for (const r of checkScenario(repo, { ...sc, runtime: rt })) record({ ...r, name: `s${id} ${r.name}` });
    }
    code = state.results.some((r) => !r.pass) ? 1 : 0;
  } catch (e) {
    console.error(scrub(e.message));
    code = 1;
  } finally {
    // Delete only the repo this run created and only under the exact name pattern.
    if (state.createdRepo && REPO_RE.test(state.createdRepo) && state.createdRepo === `sdlc-e2e-${stamp}`) {
      if (opts.keep) console.log(`kept: https://github.com/${state.owner}/${state.createdRepo} (delete it with gh repo delete ${state.owner}/${state.createdRepo})`);
      else {
        const d = sh("gh", ["repo", "delete", `${state.owner}/${state.createdRepo}`, "--yes"]);
        console.log(`repo ${state.createdRepo}: ${d.code === 0 ? "deleted" : `NOT deleted, remove it by hand (${scrub(d.out).trim().split("\n").pop()})`}`);
      }
    }
    if (opts.keep) console.log(`kept work folder: ${work}`); else rmSync(work, { recursive: true, force: true });
    const failed = state.results.filter((r) => !r.pass).length;
    writeFileSync(join(out, "checks.json"), scrub(JSON.stringify({ ref, model: opts.model, local: opts.local, costUsd: state.cost, results: state.results }, null, 2)));
    console.log(`\n${state.results.length - failed}/${state.results.length} checks passed, cost $${state.cost.toFixed(2)}`);
    console.log(`transcripts: ${out}`);
  }
  return code;
}

export async function main(argv) {
  const opts = parseArgs(argv);
  return opts.dry ? dry(opts) : live(opts);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
}
