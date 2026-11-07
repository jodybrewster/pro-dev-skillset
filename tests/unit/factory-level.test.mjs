import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// factory.py level and roles against disposable repos: each level rule, the history max, the
// default branch tip beating the working tree, and the Roles parser.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FACTORY = join(ROOT, "plugins", "pro-ai-sdlc", "scripts", "factory.py");
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "factory-level-")));
after(() => rmSync(sandbox, { recursive: true, force: true }));

const git = (cwd, ...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...a], { cwd, encoding: "utf8", env: ENV });
const py = (cwd, ...args) => {
  const r = spawnSync("python3", ["-I", FACTORY, ...args], { cwd, encoding: "utf8", env: ENV });
  return { status: r.status, out: r.stdout, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout); } catch { return null; } })() };
};
const put = (p, t) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, t); };

const ROLES = (body) => `# Review\n\n## Roles\n\n\`\`\`yaml\n${body}\n\`\`\`\n`;
const ALL = "roles:\n  product_owner: [t]\n  engineer: [t, sam]\n  lead: [t]\n  policy_owner: [t]\n  platform_owner: [t]";
const intent = ({ source = "idea", risk = "low", author = "t", level = "", body = "Fix the greeting typo.", outcome = "" } = {}) =>
  `---\nsource: ${source}\nkind: bug\nstatus: accepted\nrisk: ${risk}\n${level ? `level: ${level}\n` : ""}created: 2026-01-02T10:00:00-0500\nauthor: ${author}\n---\n\n# Intent\n\n## Problem\n\n${body}\n${outcome ? `\n## Proposed outcome\n\n${outcome}\n` : ""}`;

let count = 0;
// A repo on main with REVIEW.md and one intent, both committed.
function repo(review, text, folder = "2026-01-02-demo") {
  const dir = join(sandbox, `r${count++}`);
  mkdirSync(dir);
  git(dir, "init", "-q", "-b", "main");
  if (review !== null) put(join(dir, "REVIEW.md"), review);
  put(join(dir, "intent", folder, "intent.md"), text);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
  return { dir, rel: `intent/${folder}` };
}
const level = (r) => py(r.dir, "level", r.rel, "--repo", r.dir, "--json");

test("a clean idea from a product owner at risk low is level 1", () => {
  const r = repo(ROLES(ALL), intent());
  const j = level(r).json;
  assert.equal(j.level, 1);
  assert.equal(j.raised, false);
  assert.match(j.reasons.join(";"), /meets every level 1 rule/);
});

test("an incident source is level 1; a ticket or anything else is level 2", () => {
  assert.equal(level(repo(ROLES(ALL), intent({ source: "incident 2026-11-02-checkout" }))).json.level, 1);
  assert.equal(level(repo(ROLES(ALL), intent({ source: "ticket ABC-1" }))).json.level, 2);
  assert.equal(level(repo(ROLES(ALL), intent({ source: "chat" }))).json.level, 2);
});

test("an author outside product_owner and engineer is level 2", () => {
  const review = ROLES("roles:\n  product_owner: [pat]\n  engineer: [sam]\n  lead: [t]\n  policy_owner: [t]\n  platform_owner: [t]");
  const j = level(repo(review, intent({ author: "t" }))).json;
  assert.equal(j.level, 2);
  assert.match(j.reasons.join(";"), /not a product_owner or engineer/);
  assert.equal(level(repo(review, intent({ author: "SAM" }))).json.level, 1);
});

test("no readable Roles block is level 2", () => {
  assert.equal(level(repo(null, intent())).json.level, 2);
  assert.equal(level(repo("# Review\n\nnothing here\n", intent())).json.level, 2);
  assert.equal(level(repo(ROLES("roles:\n  boss: [t]"), intent())).json.level, 2);
});

test("risk medium or an undeclared risk is level 2 and risk high is level 3", () => {
  assert.equal(level(repo(ROLES(ALL), intent({ risk: "medium" }))).json.level, 2);
  assert.equal(level(repo(ROLES(ALL), intent({ risk: "<low | medium | high>" }))).json.level, 2);
  assert.equal(level(repo(ROLES(ALL), intent({ risk: "high" }))).json.level, 3);
});

test("new-dependency words are level 2", () => {
  for (const body of ["Add a new dependency for dates.", "Run npm install left-pad.", "Use a new library."]) {
    assert.equal(level(repo(ROLES(ALL), intent({ body }))).json.level, 2, body);
  }
});

test("a negated dependency phrase stays level 1", () => {
  for (const body of ["No new dependency.", "Keep it without a new library.", "Do not add a dependency."]) {
    assert.equal(level(repo(ROLES(ALL), intent({ body }))).json.level, 1, body);
  }
});

test("each stop-list word is level 3", () => {
  const words = ["auth", "login", "password", "oauth", "session", "permission", "migration", "schema change", "payment", "billing", "stripe",
    "deploy", "release", "secret", "token", "credential", "api key", "environment variable", "env var", ".env", "personal data", "export"];
  for (const w of words) {
    const j = level(repo(ROLES(ALL), intent({ outcome: `Touches the ${w} handling.` }))).json;
    assert.equal(j.level, 3, w);
  }
  assert.equal(level(repo(ROLES(ALL), intent({ outcome: "Users are Deployed and Sessions end." }))).json.level, 3);
});

test("a stop-list word only under Problem is discussed, not built, and stays level 1", () => {
  assert.equal(level(repo(ROLES(ALL), intent({ body: "Touches the deploy handling." }))).json.level, 1);
});

test("stop-list words match whole words only, and comments are ignored", () => {
  const j = level(repo(ROLES(ALL), intent({ outcome: "The author wrote a tokenizer for greeting text. <!-- password -->" }))).json;
  assert.equal(j.level, 1);
});

test("the level is the highest value the field has had in history", () => {
  const r = repo(ROLES(ALL), intent({ level: "3" }));
  put(join(r.dir, r.rel, "intent.md"), intent({ level: "1" }));
  git(r.dir, "commit", "-qam", "lower the level");
  const j = level(r).json;
  assert.equal(j.level, 3);
  assert.equal(j.history_max, 3);
  assert.equal(j.file_level, 1);
  assert.equal(j.raised, true);
  assert.equal(py(r.dir, "level", r.rel, "--repo", r.dir).status, 3);
});

test("a level in the file above the computed one stands and is not raised", () => {
  const r = repo(ROLES(ALL), intent({ level: "2" }));
  const j = level(r).json;
  assert.equal(j.level, 2);
  assert.equal(j.raised, false);
  assert.equal(py(r.dir, "level", r.rel, "--repo", r.dir).status, 0);
});

test("the default branch tip decides, not the working tree", () => {
  const origin = join(sandbox, `o${count}.git`);
  const r = repo(ROLES(ALL), intent({ risk: "medium" }));
  git(sandbox, "init", "-q", "--bare", "-b", "main", origin);
  git(r.dir, "remote", "add", "origin", origin);
  git(r.dir, "push", "-q", "-u", "origin", "main");
  // The working tree says low and lists a new author; the tip still says medium.
  put(join(r.dir, r.rel, "intent.md"), intent({ risk: "low" }));
  put(join(r.dir, "REVIEW.md"), ROLES(ALL));
  assert.equal(level(r).json.level, 2);
});

test("an untracked intent is read from the working tree", () => {
  const r = repo(ROLES(ALL), intent());
  put(join(r.dir, "intent", "2026-01-03-new", "intent.md"), intent({ risk: "high" }));
  assert.equal(py(r.dir, "level", "intent/2026-01-03-new", "--repo", r.dir, "--json").json.level, 3);
});

test("--write raises the field and never lowers it", () => {
  const r = repo(ROLES(ALL), intent({ risk: "medium" }));
  let res = py(r.dir, "level", r.rel, "--repo", r.dir, "--write");
  assert.equal(res.status, 3);
  assert.match(readFileSync(join(r.dir, r.rel, "intent.md"), "utf8"), /^level: 2$/m);
  put(join(r.dir, r.rel, "intent.md"), intent({ level: "3" }));
  res = py(r.dir, "level", r.rel, "--repo", r.dir, "--write");
  assert.match(readFileSync(join(r.dir, r.rel, "intent.md"), "utf8"), /^level: 3$/m);
  assert.doesNotMatch(readFileSync(join(r.dir, r.rel, "intent.md"), "utf8"), /^level: 1$/m);
});

test("a folder outside intent/ or with a bad name could not run", () => {
  const r = repo(ROLES(ALL), intent());
  assert.equal(py(r.dir, "level", "docs", "--repo", r.dir).status, 2);
  put(join(r.dir, "intent", "2026-01-02-Bad_Name", "intent.md"), intent());
  assert.equal(py(r.dir, "level", "intent/2026-01-02-Bad_Name", "--repo", r.dir).status, 2);
});

const roles = (review) => {
  const dir = repo(review, intent()).dir;
  return py(dir, "roles", "--repo", dir, "--json");
};

test("the roles parser accepts inline lists, dash lists, quotes and comments", () => {
  const r = roles(ROLES([
    "roles:  # who does what",
    "  product_owner: [\"Pat Lee\", sam]",
    "  engineer:",
    "    - t",
    "    - 'Sam Q'  # second engineer",
    "  lead: []",
    "  policy_owner: [t]",
    "  platform_owner:",
    "    - t",
  ].join("\n")));
  assert.equal(r.status, 0, r.err);
  assert.deepEqual(r.json, { product_owner: ["Pat Lee", "sam"], engineer: ["t", "Sam Q"], lead: [], policy_owner: ["t"], platform_owner: ["t"] });
});

test("the roles parser rejects unknown keys, missing keys, a duplicate and a scalar", () => {
  assert.equal(roles(ROLES(`${ALL}\n  boss: [t]`)).status, 2);
  assert.match(roles(ROLES(`${ALL}\n  boss: [t]`)).err, /unknown role 'boss'/);
  assert.match(roles(ROLES("roles:\n  engineer: [t]")).err, /lacks/);
  assert.match(roles(ROLES(`${ALL}\n  lead: [t]`)).err, /duplicate/);
  assert.match(roles(ROLES(ALL.replace("lead: [t]", "lead: t"))).err, /must be a list/);
  assert.match(roles("# Review\n").err, /no ## Roles block/);
});

test("the roles parser ignores a block inside an HTML comment", () => {
  assert.equal(roles(`# Review\n\n<!--\n${ROLES(ALL)}\n-->\n`).status, 2);
});
