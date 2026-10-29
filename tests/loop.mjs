#!/usr/bin/env node
// End-to-end test of the pro-ai-sdlc loop with pro-egm, in a Linux container.
// Installs both plugins from the GitHub marketplace at a branch, scaffolds the tiny-tasks
// fixture repo with an accepted intent and runs /spec, /plan and /execute in real
// `claude -p` sessions, approving the spec and plan in between as a person would.
// Spends tokens (about $3 to $5), so it is on demand only.
//
//   node tests/loop.mjs                    # the current branch, which must be pushed
//   node tests/loop.mjs --ref main
//   node tests/loop.mjs --max-cost-usd 6
//
// Needs Docker, ANTHROPIC_API_KEY and a GitHub token (GH_TOKEN, else `gh auth token`),
// since the marketplace repo is private. Transcripts land in tests/loop-results/.
// It runs /pro-egm:install first, which installs Google's egm@egm through pro-core, then
// says yes to the Goldfish review at /spec and /plan. `--no-egm` skips egm@egm and checks
// only that the review is offered.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAFFOLD = "plugins/pro-ai-sdlc/evals/spec-from-intent/scaffold.sh";
const INTENT = "intent/2026-01-05-due-dates";

export function parseArgs(argv) {
  const o = { ref: null, maxCostUsd: 12, model: "sonnet", inside: false, out: null, egm: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ref") o.ref = argv[++i];
    else if (a === "--no-egm") o.egm = false;
    else if (a === "--max-cost-usd") o.maxCostUsd = Number(argv[++i]);
    else if (a === "--model") o.model = argv[++i];
    else if (a === "--inside") o.inside = true;
    else if (a === "--out") o.out = argv[++i];
    else throw new Error(`unknown flag ${a}`);
  }
  if (!Number.isFinite(o.maxCostUsd) || o.maxCostUsd <= 0) throw new Error("--max-cost-usd needs a positive number");
  return o;
}

// The reply or transcript offers the Goldfish review, or says egm@egm is missing.
export function offersGoldfish(text) {
  return /pro-egm:goldfish|pro-egm needs egm@egm/i.test(text);
}

// With egm@egm installed: the review itself is offered, not the install line.
export function offersReview(text) {
  return /\/pro-egm:goldfish \S+ --stage (spec|plan)/.test(text) && !/pro-egm needs egm@egm/.test(text);
}

// The goldfish command ran and resolved its reviewers.
export function ranGoldfish(text) {
  return /pro-egm:goldfish/.test(text) && /goldfish\.py\\?"? resolve/.test(text);
}

// Flips the first `Status: <from>` line and any `status: <from>` frontmatter key.
export function setStatus(text, from, to) {
  return text
    .replace(new RegExp(`^Status:[ \\t]*${from}\\.?[ \\t]*$`, "m"), `Status: ${to}.`)
    .replace(new RegExp(`^status:[ \\t]*${from}[ \\t]*$`, "m"), `status: ${to}`);
}

// Pass count from `node --test` output.
export function passCount(out) {
  const m = String(out).match(/^# pass (\d+)/m) || String(out).match(/^ℹ pass (\d+)/m);
  return m ? Number(m[1]) : 0;
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

// ---- host side ------------------------------------------------------------

function currentBranch() {
  return sh("git", ["-C", ROOT, "branch", "--show-current"]).out.trim();
}

function host(opts) {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("needs ANTHROPIC_API_KEY set"); return 1; }
  const token = process.env.GH_TOKEN || sh("gh", ["auth", "token"]).out.trim();
  if (!token) { console.error("needs GH_TOKEN or a logged-in gh"); return 1; }
  const ref = opts.ref || currentBranch();
  if (!opts.ref) {
    const ahead = sh("git", ["-C", ROOT, "rev-list", "--count", `origin/${ref}..HEAD`]);
    if (ahead.code !== 0) { console.error(`branch ${ref} is not on origin; push it or pass --ref`); return 1; }
    if (ahead.out.trim() !== "0") console.log(`note: ${ref} has unpushed commits; the test installs what origin has`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = join(ROOT, "tests", "loop-results", stamp);
  mkdirSync(out, { recursive: true });
  const b = spawnSync("docker", ["build", "-q", "-t", "pro-dev-evals", join(ROOT, "tests", "docker")], { stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) { console.error(`docker build failed (exit ${b.status}); is Docker running?`); return 1; }
  console.log(`loop test: marketplace ref ${ref}, model ${opts.model}, cap $${opts.maxCostUsd}`);
  const r = spawnSync("docker", [
    "run", "--rm", "-e", "ANTHROPIC_API_KEY", "-e", "GH_TOKEN",
    "-v", `${ROOT}:/repo:ro`, "-v", `${out}:/out`, "pro-dev-evals",
    "node", "tests/loop.mjs", "--inside", "--ref", ref, "--model", opts.model,
    "--max-cost-usd", String(opts.maxCostUsd), "--out", "/out", ...(opts.egm ? [] : ["--no-egm"]),
  ], { stdio: "inherit", env: { ...process.env, GH_TOKEN: token } });
  console.log(`transcripts: ${out}`);
  return r.status ?? 1;
}

// ---- container side -------------------------------------------------------

function inside(opts) {
  const work = "/home/evals/work", repo = join(work, "tiny-tasks");
  const checks = [];
  let cost = 0;
  const check = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
  const git = (...a) => sh("git", ["-C", repo, ...a]);
  const report = () => {
    writeFileSync(join(opts.out, "checks.json"), JSON.stringify({ ref: opts.ref, model: opts.model, costUsd: cost, checks }, null, 2));
    const failed = checks.filter((c) => !c.ok).length;
    console.log(`\n${checks.length - failed}/${checks.length} checks passed, cost $${cost.toFixed(2)}`);
    return failed ? 1 : 0;
  };

  // Each step is one `claude -p` turn; a resumed turn continues the same session.
  const claude = (label, prompt, resume) => {
    if (cost >= opts.maxCostUsd) { check(`${label}: within the cost cap`, false, `spent $${cost.toFixed(2)}`); return null; }
    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions",
      "--model", opts.model, "--max-turns", "80", ...(resume ? ["--resume", resume] : [])];
    const r = spawnSync("claude", args, { cwd: repo, encoding: "utf8", timeout: 40 * 60 * 1000, maxBuffer: 256 * 1024 * 1024 });
    const transcript = r.stdout || "";
    writeFileSync(join(opts.out, `${label}.jsonl`), transcript);
    let result = null;
    const turns = [];
    for (const line of transcript.split("\n")) {
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.type === "result") result = e;
      else if (e.type !== "system") turns.push(line); // the init event lists every command, goldfish included
    }
    cost += Number(result?.total_cost_usd) || 0;
    console.log(`-- ${label}: ${result ? `$${Number(result.total_cost_usd).toFixed(2)}, ${result.num_turns} turns` : `no result (exit ${r.status})`}`);
    return { transcript: turns.join("\n"), text: result?.result || "", session: result?.session_id };
  };
  const tracked = (path) => git("ls-files", "--error-unmatch", path).code === 0 && !git("status", "--porcelain", "--", path).out.trim();

  // Plugins from the marketplace, so methods.py sees a trusted install.
  sh("git", ["config", "--global", "url.https://x-access-token:" + process.env.GH_TOKEN + "@github.com/.insteadOf", "https://github.com/"]);
  const add = sh("claude", ["plugin", "marketplace", "add", `jodybrewster/pro-dev-skillset#${opts.ref}`]);
  check("marketplace added", add.code === 0, add.code ? add.out.trim().split("\n").pop() : opts.ref);
  for (const p of ["pro-core", "pro-ai-sdlc", "pro-egm"]) {
    const r = sh("claude", ["plugin", "install", `${p}@pro-dev-skillset`]);
    check(`${p} installed`, r.code === 0);
  }
  if (checks.some((c) => !c.ok)) return report();

  // The fixture repo with an accepted intent and a local origin.
  mkdirSync(repo, { recursive: true });
  const scaffold = sh("bash", [join("/repo", SCAFFOLD)], { cwd: repo });
  check("fixture scaffolded", scaffold.code === 0, scaffold.code ? scaffold.out.trim().slice(-200) : "");
  sh("git", ["init", "-q", "--bare", join(work, "origin.git")]);
  git("remote", "add", "origin", join(work, "origin.git"));
  git("push", "-q", "-u", "origin", "main");
  git("remote", "set-head", "origin", "main");

  // pro-egm's own installer brings in Google's egm@egm, as a person would run it.
  if (opts.egm) {
    const egmInstalled = () => {
      try { return JSON.parse(sh("claude", ["plugin", "list", "--json"], { cwd: repo }).out).some((p) => p.id === "egm@egm" && p.enabled !== false); }
      catch { return false; }
    };
    let r = claude("0-install", "/pro-egm:install");
    const replies = ["Yes to egm.", "Yes, install it."];
    for (let i = 0; i < replies.length && r && !egmInstalled(); i++) r = claude(`0${"bc"[i]}-install`, replies[i], r.session);
    check("/pro-egm:install installed egm@egm", egmInstalled());
    if (!egmInstalled()) return report();
  }

  // One stage: run the command, answer its questions as the person would until the file
  // is committed, and with egm@egm installed say yes to the Goldfish review.
  const stage = (n, name, command, file) => {
    const replies = opts.egm
      ? ["Yes, run the Goldfish review.", `Apply the fixes the review recommends, then commit the ${name}.`, `Commit the ${name} now.`]
      : [`No Goldfish review this time. Commit the ${name}.`];
    let r = claude(`${n}-${name}`, command);
    if (!r) return false;
    const transcripts = [r.transcript];
    for (let i = 0; i < replies.length && !tracked(file); i++) {
      r = claude(`${n}${"bcd"[i]}-${name}`, replies[i], r.session);
      if (!r) break;
      transcripts.push(r.transcript);
    }
    const all = transcripts.join("\n");
    // Only the first turn: the goldfish command's own text, loaded after the yes, quotes the install line.
    check(`/${name} offers the Goldfish review`, opts.egm ? offersReview(transcripts[0]) : offersGoldfish(all));
    if (opts.egm) {
      check(`Goldfish review ran on the ${name}`, ranGoldfish(all));
      const rep = join(repo, "goldfish_review_report.md");
      check(`Goldfish wrote its report on the ${name}`, existsSync(rep));
      if (existsSync(rep)) { writeFileSync(join(opts.out, `goldfish-${name}.md`), readFileSync(rep)); sh("rm", [rep]); }
    }
    check(`/${name} wrote and committed ${name}.md`, tracked(file));
    return existsSync(join(repo, file));
  };

  // /spec.
  const spec = `${INTENT}/spec.md`;
  if (!stage(1, "spec", `/pro-ai-sdlc:spec ${INTENT}`, spec)) return report();
  check("spec has numbered requirements", /^- R1\b/m.test(readFileSync(join(repo, spec), "utf8")));

  // The person accepts the spec.
  writeFileSync(join(repo, spec), setStatus(readFileSync(join(repo, spec), "utf8"), "draft", "accepted"));
  git("commit", "-qam", "spec: accepted");

  // /plan.
  const plan = `${INTENT}/plan.md`;
  if (!stage(2, "plan", `/pro-ai-sdlc:plan ${spec}`, plan)) return report();

  // The person approves the plan.
  writeFileSync(join(repo, plan), setStatus(readFileSync(join(repo, plan), "utf8"), "draft", "approved"));
  git("commit", "-qam", "plan: approved");
  const mainBefore = git("rev-parse", "main").out.trim();

  // /execute builds it.
  const e = claude("3-execute", `/pro-ai-sdlc:execute ${plan}`);
  if (!e) return report();
  const branches = git("for-each-ref", "--format=%(refname:short)", "refs/heads").out.split("\n").filter((b) => b && b !== "main");
  check("/execute made a branch", branches.length === 1, branches.join(", ") || "none");
  check("main was not touched", git("rev-parse", "main").out.trim() === mainBefore);
  const branch = branches[0];
  if (!branch) return report();
  check("branch pushed to origin", sh("git", ["-C", join(work, "origin.git"), "rev-parse", "--verify", `refs/heads/${branch}`]).code === 0);
  const wt = git("worktree", "list", "--porcelain").out.split("\n").filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9)).find((d) => d !== repo);
  check("/execute built in its own worktree", !!wt, wt || "none");
  const dir = wt || repo;
  const changed = sh("git", ["-C", dir, "diff", "--name-only", `${mainBefore}..${branch}`]).out.split("\n").filter(Boolean);
  check("the build changed src/ and test/", changed.some((f) => f.startsWith("src/")) && changed.some((f) => f.startsWith("test/")), changed.join(" "));
  const t = sh("npm", ["test"], { cwd: dir });
  check("npm test passes on the branch", t.code === 0, `${passCount(t.out)} tests pass`);
  check("the build added tests", passCount(t.out) > 3);
  const builtPlan = sh("git", ["-C", dir, "show", `${branch}:${plan}`]).out;
  check("plan Done section filled in", /Build commit:\s*`?[0-9a-f]{7,}/i.test(builtPlan));
  return report();
}

export function main(argv) {
  const opts = parseArgs(argv);
  return opts.inside ? inside(opts) : host(opts);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { console.error(e.message); process.exit(1); }
}
