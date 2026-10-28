#!/usr/bin/env node
// Behaviour test for pro-core's /pro-dev machinery: scripts/pro-dev.py (status,
// run, answer, plugins update, plugins swap-starter, stale) and the SessionStart
// nudge scripts/pro-dev-nudge.py.
//
// check.mjs asserts the content contract (registry rows are well formed, the
// hook is registered). This file drives the real scripts, one process per case,
// with a fake `claude` and a fake `npx` first on PATH that record their argv and
// working folder to a log file, a temp HOME and temp repos. It never touches the
// real HOME, never installs anything and never calls the network.
//
//   node tests/pro-dev.mjs
//   node tests/pro-dev.mjs --only=stale            # substring filter on case id
//   node tests/pro-dev.mjs --plugin-root=/abs/path # run against an installed copy
//
// Skips cleanly (the caller treats `skipped` as a warning, never a failure) when
// python3 or git is not on PATH or the scripts are not on disk.

import {
  mkdtempSync, mkdirSync, rmSync, existsSync, realpathSync, symlinkSync,
  writeFileSync, readFileSync, readdirSync, chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLUGIN_ROOT = resolve(HERE, "..", "plugins", "pro-core");

const FAKE_CLAUDE = `#!/usr/bin/env python3
import json, os, sys
argv = sys.argv[1:]
log = os.environ.get("FAKE_LOG")
if log:
    with open(log, "a") as f:
        f.write(json.dumps({"tool": "claude", "cwd": os.getcwd(), "argv": argv}) + "\\n")
lst = os.environ.get("FAKE_PLUGIN_LIST")
if argv[:2] == ["plugin", "list"]:
    sys.stdout.write(open(lst).read() if lst and os.path.exists(lst) else "[]")
    sys.exit(0)
mp = os.environ.get("FAKE_MP_ADD")
if argv[:3] == ["plugin", "marketplace", "add"] and mp:
    spec = json.load(open(mp))
    kp = os.path.join(os.path.expanduser("~"), ".claude", "plugins", "known_marketplaces.json")
    data = json.load(open(kp)) if os.path.exists(kp) else {}
    data[spec["name"]] = spec["entry"]
    json.dump(data, open(kp, "w"))
    sys.exit(0)
fm = os.environ.get("FAKE_FAIL_MATCH")
if fm and fm in " ".join(argv):
    sys.stderr.write("boom\\n")
    sys.exit(1)
nv = os.environ.get("FAKE_NEW_VERSION")
if argv[:2] == ["plugin", "update"] and nv and lst and os.path.exists(lst):
    data = json.load(open(lst))
    for e in data:
        if e.get("id") == argv[2]:
            e["version"] = nv
    json.dump(data, open(lst, "w"))
def write_spec(name):
    spec = os.environ.get(name)
    if spec:
        path, content = spec.split("|", 1)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "w").write(content)
if argv[:2] == ["plugin", "update"]:
    write_spec("FAKE_UPDATE_WRITE")
if argv[:3] == ["plugin", "marketplace", "update"]:
    write_spec("FAKE_MPUPDATE_WRITE")
ip = os.environ.get("FAKE_INSTALL_PATH")
if argv[:2] == ["plugin", "install"]:
    write_spec("FAKE_INSTALL_WRITE")
    if ip and lst:
        data = json.load(open(lst)) if os.path.exists(lst) else []
        data.append({"id": argv[2], "scope": "project", "projectPath": os.getcwd(), "installPath": ip,
                     "version": "1.0.0", "enabled": True})
        json.dump(data, open(lst, "w"))
if argv[:2] == ["plugin", "disable"] and lst and os.path.exists(lst):
    data = json.load(open(lst))
    for e in data:
        if e.get("id") == argv[2]:
            e["enabled"] = False
    json.dump(data, open(lst, "w"))
sys.exit(0)
`;

const FAKE_NPX = `#!/usr/bin/env python3
import json, os, sys
argv = sys.argv[1:]
log = os.environ.get("FAKE_LOG")
if log:
    with open(log, "a") as f:
        f.write(json.dumps({"tool": "npx", "cwd": os.getcwd(), "argv": argv}) + "\\n")
fm = os.environ.get("FAKE_FAIL_MATCH")
if fm and fm in " ".join(argv):
    sys.stderr.write("boom\\n")
    sys.exit(1)
for rel in filter(None, os.environ.get("FAKE_NPX_FILES", "").split(":")):
    if "@@" in rel:
        want, rel = rel.split("@@", 1)
        if want not in " ".join(argv):
            continue
    path = os.path.join(os.getcwd(), rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write("---\\nname: fake\\n---\\n")
sys.exit(0)
`;

const QA_FILES = ["qa-do", "qa-start", "playwright-automation", "visual-testing", "api-testing",
  "contract-testing", "test-reliability", "test-strategy", "risk-based-testing", "test-planning",
  "qa-project-context"].map((n) => `.claude/skills/${n}/SKILL.md`);
const LAVISH_FILE = ".claude/skills/lavish/SKILL.md";
const MS = "pro-dev-skillset";

function read(p) { return readFileSync(p, "utf8"); }
function json(p) { return JSON.parse(read(p)); }

function buildSandbox(pluginRoot) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pro-dev-test-")));
  const home = join(root, "home");
  const repo = join(root, "repo");
  const tools = join(root, "tools");
  mkdirSync(join(home, ".claude", "plugins"), { recursive: true });
  mkdirSync(repo, { recursive: true });
  mkdirSync(tools, { recursive: true });
  execFileSync("git", ["init", "-q", repo]);
  for (const t of ["python3", "git"]) {
    const found = spawnSync("sh", ["-c", `command -v ${t}`], { encoding: "utf8" }).stdout.trim();
    symlinkSync(found, join(tools, t));
  }
  const bins = {};
  const makeBin = (name, { claude = true, npx = true } = {}) => {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    if (claude) { writeFileSync(join(dir, "claude"), FAKE_CLAUDE); chmodSync(join(dir, "claude"), 0o755); }
    if (npx) { writeFileSync(join(dir, "npx"), FAKE_NPX); chmodSync(join(dir, "npx"), 0o755); }
    return dir;
  };
  bins.both = makeBin("bin-both");
  bins.noNpx = makeBin("bin-no-npx", { npx: false });
  bins.noClaude = makeBin("bin-no-claude", { claude: false });
  const logPath = join(root, "calls.log");
  const listPath = join(root, "plugin-list.json");
  let script = join(pluginRoot, "scripts", "pro-dev.py");
  const nudge = join(pluginRoot, "scripts", "pro-dev-nudge.py");

  const setPlugins = (entries) => writeFileSync(listPath, JSON.stringify(entries.map((e) => ({
    version: "1.0.0", enabled: true, installPath: join(root, "cache", e.id.split("@")[0]), ...e,
  }))));
  const entry = (name, scope, projectPath, extra = {}) => ({
    id: `${name}@${MS}`, scope, ...(projectPath ? { projectPath } : {}), ...extra,
  });
  let installTarget = null; // where the fake `claude plugin install` says the plugin landed
  const env = (bin, extra = {}) => ({
    PATH: `${bins[bin ?? "both"]}:${tools}`, HOME: home, FAKE_LOG: logPath, FAKE_PLUGIN_LIST: listPath,
    ...(installTarget ? { FAKE_INSTALL_PATH: installTarget } : {}), ...extra,
  });
  const run = (args, { bin, extra, cwd } = {}) => {
    const r = spawnSync("python3", [script, "--repo", repo, ...args], {
      encoding: "utf8", env: env(bin, extra), cwd: cwd ?? repo,
    });
    return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? ""), stdout: r.stdout ?? "" };
  };
  const status = (opts) => JSON.parse(run(["status", "--json"], opts).stdout);
  const engine = (st, id) => st.engines.find((e) => e.id === id);
  const calls = (tool) => (existsSync(logPath) ? read(logPath).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [])
    .filter((c) => !(c.tool === "claude" && c.argv[0] === "plugin" && c.argv[1] === "list"))
    .filter((c) => !tool || c.tool === tool);
  // a copy of the script beside a registry holding only these rows, for the marketplace and surface cases
  const useRows = (rows) => {
    const pc = join(root, "pc");
    mkdirSync(join(pc, "scripts"), { recursive: true });
    mkdirSync(join(pc, "registry"), { recursive: true });
    writeFileSync(join(pc, "scripts", "pro-dev.py"), read(join(pluginRoot, "scripts", "pro-dev.py")));
    writeFileSync(join(pc, "registry", "engines.json"), JSON.stringify({ version: 1, engines: rows }));
    script = join(pc, "scripts", "pro-dev.py");
  };
  const answersPath = join(repo, ".claude", "pro-dev.json");
  const installedFile = join(home, ".claude", "plugins", "installed_plugins.json");
  return { root, home, repo, tools, bins, run, status, engine, calls, setPlugins, entry, env, logPath, listPath,
    answersPath, installedFile, nudge, get script() { return script; }, useRows, setInstallTarget: (p) => { installTarget = p; } };
}

const ok = (detail = "") => ({ ok: true, detail });
const bad = (detail) => ({ ok: false, detail });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function registry(pluginRoot) { return json(join(pluginRoot, "registry", "engines.json")); }


// --- marketplace and surface fixtures ------------------------------------------

const EGM_SRC = "google/elephant-goldfish-model";
const EGM_ENTRY = { source: { source: "github", repo: EGM_SRC }, installLocation: "" };

function egmRow(extra = {}) {
  return {
    id: "egm", owner: "pro-egm", bridges: [], kind: "claude-plugin", default: true,
    detect: { plugin: "egm@egm" },
    install: ["claude", "plugin", "install", "egm@egm", "--scope", "project"],
    update: ["claude", "plugin", "update", "egm@egm", "--scope", "project"],
    marketplace: { name: "egm", source: EGM_SRC },
    why: "test row", ...extra,
  };
}

// a plugin folder: two agents, one skill, one hook file; commands are { name: { allowed, body } }
function writePlugin(dir, { agents = { a: "Read, Grep", b: "Read, Glob" }, skills = { s: null }, hooks = { hooks: {} },
  manifest = {}, commands = {} } = {}) {
  for (const [n, c] of Object.entries(commands)) {
    mkdirSync(join(dir, "commands"), { recursive: true });
    writeFileSync(join(dir, "commands", `${n}.md`), `---\ndescription: ${n}\n${c.allowed ? `allowed-tools: ${c.allowed}\n` : ""}---\n${c.body ?? "body"}\n`);
  }
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "egm", ...manifest }));
  for (const [n, tools] of Object.entries(agents)) {
    mkdirSync(join(dir, "agents"), { recursive: true });
    writeFileSync(join(dir, "agents", `${n}.md`), `---\nname: ${n}\n${tools ? `tools: ${tools}\n` : ""}---\nbody\n`);
  }
  for (const [n, allowed] of Object.entries(skills)) {
    mkdirSync(join(dir, "skills", n), { recursive: true });
    writeFileSync(join(dir, "skills", n, "SKILL.md"), `---\nname: ${n}\n${allowed ? `allowed-tools: ${allowed}\n` : ""}---\nbody\n`);
  }
  if (hooks) {
    mkdirSync(join(dir, "hooks"), { recursive: true });
    writeFileSync(join(dir, "hooks", "hooks.json"), JSON.stringify(hooks));
  }
}

function writeKnown(s, entry) {
  writeFileSync(join(s.home, ".claude", "plugins", "known_marketplaces.json"), JSON.stringify({ egm: entry }));
}

// A marketplace clone holding the plugin at its root (source "./"), registered from the right repo.
// The pin is taken from the plugin itself, the way the orchestrator fills it from a real install.
function egmWorld(s, { plugin = {}, rowExtra = {}, source = "./", pin = true } = {}) {
  const clone = join(s.root, "mp", "clone");
  mkdirSync(join(clone, ".claude-plugin"), { recursive: true });
  writeFileSync(join(clone, ".claude-plugin", "marketplace.json"), JSON.stringify({ name: "egm", plugins: [{ name: "egm", source }] }));
  writePlugin(clone, plugin);
  writeKnown(s, { ...EGM_ENTRY, installLocation: clone });
  const inst = join(s.root, "mp", "inst");
  writePlugin(inst, plugin);
  s.useRows([egmRow()]);
  s.setInstallTarget(inst);
  s.setPlugins([s.entry("pro-egm", "project", s.repo), { id: "egm@egm", scope: "project", projectPath: s.repo, installPath: inst }]);
  let surface = null;
  if (pin) {
    surface = JSON.parse(s.run(["surface", "egm"]).stdout);
    s.useRows([egmRow({ surface, ...rowExtra })]);
  }
  s.setPlugins([s.entry("pro-egm", "project", s.repo)]);
  return { clone, inst, surface };
}

const installCalls = (s) => s.calls("claude").filter((c) => c.argv[1] === "install");
const growth = (s, w) => {
  const r = s.run(["run", "egm", "install"]);
  if (r.code === 0 || installCalls(s).length) return bad(`row was installed past the pin: ${r.out}`);
  return r.out.includes(w) ? ok() : bad(`no "${w}" in: ${r.out}`);
};

const CASES = [
  {
    id: "marketplace/add-when-absent",
    run: (s) => {
      s.useRows([egmRow()]);
      s.setPlugins([s.entry("pro-egm", "project", s.repo)]);
      const spec = join(s.root, "mp-add.json");
      writeFileSync(spec, JSON.stringify({ name: "egm", entry: { ...EGM_ENTRY, installLocation: join(s.root, "none") } }));
      const r = s.run(["run", "egm", "install"], { extra: { FAKE_MP_ADD: spec } });
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      if (!same(a, [`plugin marketplace add ${EGM_SRC}`, "plugin install egm@egm --scope project"])) return bad(`calls ${JSON.stringify(a)}`);
      return /user-wide/.test(r.out) ? ok() : bad(`no user-wide note: ${r.out}`);
    },
  },
  {
    id: "marketplace/already-registered-matching-repo-any-case",
    run: (s) => {
      s.useRows([egmRow()]);
      s.setPlugins([s.entry("pro-egm", "project", s.repo)]);
      writeKnown(s, { source: { source: "github", repo: EGM_SRC.toUpperCase() }, installLocation: "/x" });
      const r = s.run(["run", "egm", "install"]);
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      return r.code === 0 && same(a, ["plugin install egm@egm --scope project"]) ? ok() : bad(`exit ${r.code} calls ${JSON.stringify(a)}: ${r.out}`);
    },
  },
  {
    id: "marketplace/mismatched-repo-is-refused-and-names-both",
    run: (s) => {
      s.useRows([egmRow()]);
      s.setPlugins([s.entry("pro-egm", "project", s.repo)]);
      writeKnown(s, { source: { source: "github", repo: "evil/egm" }, installLocation: "/x" });
      const r = s.run(["run", "egm", "install"]);
      if (r.code !== 1 || s.calls("claude").length) return bad(`exit ${r.code}, calls ${JSON.stringify(s.calls("claude"))}`);
      return r.out.includes("evil/egm") && r.out.includes(EGM_SRC) ? ok() : bad(`both sources not printed: ${r.out}`);
    },
  },
  {
    id: "marketplace/non-github-source-is-refused",
    run: (s) => {
      s.useRows([egmRow()]);
      s.setPlugins([s.entry("pro-egm", "project", s.repo)]);
      writeKnown(s, { source: { source: "git", url: "https://example.com/egm.git" }, installLocation: "/x" });
      const r = s.run(["run", "egm", "install"]);
      return r.code === 1 && !s.calls("claude").length && r.out.includes("example.com") ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "marketplace/unreadable-known-file-is-refused",
    run: (s) => {
      s.useRows([egmRow()]);
      s.setPlugins([s.entry("pro-egm", "project", s.repo)]);
      writeFileSync(join(s.home, ".claude", "plugins", "known_marketplaces.json"), "{not json");
      const r = s.run(["run", "egm", "install"]);
      return r.code === 1 && !s.calls("claude").length && /unreadable/.test(r.out) ? ok() : bad(`exit ${r.code}, calls ${s.calls("claude").length}: ${r.out}`);
    },
  },
  {
    id: "marketplace/mismatch-on-an-already-detected-row",
    run: (s) => {
      s.useRows([egmRow()]);
      s.setPlugins([s.entry("pro-egm", "project", s.repo), { id: "egm@egm", scope: "project", projectPath: s.repo }]);
      writeKnown(s, { source: { source: "github", repo: "evil/egm" }, installLocation: "/x" });
      const r = s.run(["run", "egm", "install"]);
      if (r.code !== 1 || /already installed/.test(r.out)) return bad(`detected row skipped the check: exit ${r.code}: ${r.out}`);
      const all = s.run(["run", "all", "install"]);
      if (all.code !== 1 || /already installed/.test(all.out)) return bad(`run all skipped the check: ${all.out}`);
      writeKnown(s, { source: { source: "github", repo: EGM_SRC }, installLocation: "/x" });
      const fine = s.run(["run", "egm", "install"]);
      return fine.code === 0 && /already installed/.test(fine.out) ? ok() : bad(`matching row: ${fine.out}`);
    },
  },
  {
    id: "marketplace/status-shows-the-mismatch",
    run: (s) => {
      s.useRows([egmRow()]);
      s.setPlugins([s.entry("pro-egm", "project", s.repo)]);
      writeKnown(s, { source: { source: "github", repo: "evil/egm" }, installLocation: "/x" });
      const e = s.engine(s.status(), "egm");
      if (!e.marketplaceProblem || !e.marketplaceProblem.includes("evil/egm")) return bad(`no marketplaceProblem: ${JSON.stringify(e)}`);
      return e.wantsInstall === false ? ok() : bad("wantsInstall stayed true");
    },
  },
  {
    id: "marketplace/update-is-checked-too",
    run: (s) => {
      s.useRows([egmRow()]);
      s.setPlugins([s.entry("pro-egm", "project", s.repo), { id: "egm@egm", scope: "project", projectPath: s.repo }]);
      writeKnown(s, { source: { source: "github", repo: "evil/egm" }, installLocation: "/x" });
      const r = s.run(["run", "egm", "update"]);
      return r.code === 1 && !s.calls("claude").length ? ok() : bad(`exit ${r.code}, calls ${JSON.stringify(s.calls("claude"))}`);
    },
  },
  {
    id: "marketplace/rows-without-marketplace-or-surface-are-unchanged",
    run: (s) => {
      s.setPlugins([s.entry("pro-design", "project", s.repo)]);
      writeFileSync(join(s.home, ".claude", "plugins", "known_marketplaces.json"), "{not json");
      const r = s.run(["run", "figma", "install"]);
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      return r.code === 0 && same(a, ["plugin install figma@claude-plugins-official --scope project"]) && !/surface/.test(r.out)
        ? ok() : bad(`exit ${r.code} calls ${JSON.stringify(a)}: ${r.out}`);
    },
  },
  {
    id: "surface/matching-surface-installs-and-prints-one-line",
    run: (s) => {
      egmWorld(s);
      const r = s.run(["run", "all", "install"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      if (!r.out.includes("egm: 2 agents, 1 skills, tools Glob Grep Read, hooks/MCP hash matches pin")) return bad(`no surface line: ${r.out}`);
      if (installCalls(s).length !== 1) return bad("not installed");
      const ans = existsSync(s.answersPath) ? read(s.answersPath) : "";
      return /surface/i.test(ans) ? bad(`surface written to the answers file: ${ans}`) : ok();
    },
  },
  {
    id: "surface/command-prints-the-pin-shape",
    run: (s) => {
      const { surface } = egmWorld(s, { plugin: { skills: { s: "Bash(git status:*), Write" } } });
      const keys = Object.keys(surface).sort().join();
      if (keys !== "agents,hooksMcpSha256,skills,tools") return bad(`keys ${keys}`);
      if (!/^[0-9a-f]{64}$/.test(surface.hooksMcpSha256)) return bad(`hash ${surface.hooksMcpSha256}`);
      const want = { "agents/a.md": ["Grep", "Read"], "agents/b.md": ["Glob", "Read"], "skills/s": ["Bash(git status:*)", "Write"] };
      return same(surface.tools, want) ? ok() : bad(`tools ${JSON.stringify(surface.tools)}`);
    },
  },
  {
    id: "surface/smaller-surface-proceeds",
    run: (s) => {
      const { clone } = egmWorld(s);
      rmSync(join(clone, "agents", "b.md"));
      const r = s.run(["run", "egm", "install"]);
      return r.code === 0 && installCalls(s).length === 1 && r.out.includes("1 agents") ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "surface/added-tool-becomes-a-question",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { agents: { a: "Read, Grep, Bash", b: "Read, Glob" } });
      const g = growth(s, "agents/a.md: tools not in the pin: Bash");
      if (!g.ok) return g;
      const e = s.engine(s.status(), "egm");
      return e.needsQuestion === true && e.wantsInstall === false && e.surfaceProblem?.length ? ok() : bad(`status ${JSON.stringify(e)}`);
    },
  },
  {
    id: "surface/more-agents-or-skills-become-a-question",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { agents: { a: "Read, Grep", b: "Read, Glob", c: "Read" }, skills: { s: null, t: null } });
      return growth(s, "3 agents, pinned 2");
    },
  },
  {
    id: "surface/agent-with-no-tools-line-counts-as-every-tool",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { agents: { a: "Read, Grep", b: null } });
      return growth(s, "agents/b.md: tools not in the pin: *");
    },
  },
  {
    id: "surface/same-counts-different-hook-hash",
    run: (s) => {
      const { clone } = egmWorld(s);
      writeFileSync(join(clone, "hooks", "hooks.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "run-something-else" }] }] } }));
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/inline-hook-in-plugin-json-is-counted",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { manifest: { hooks: { Stop: [{ hooks: [{ type: "command", command: "x" }] }] } } });
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/inline-mcp-in-the-marketplace-entry-is-counted",
    run: (s) => {
      const { clone } = egmWorld(s);
      writeFileSync(join(clone, ".claude-plugin", "marketplace.json"), JSON.stringify({
        plugins: [{ name: "egm", source: "./", mcpServers: { x: { command: "other" } } }],
      }));
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/symlinked-hooks-file-is-unknown",
    run: (s) => {
      const { clone } = egmWorld(s);
      writeFileSync(join(s.root, "outside.json"), JSON.stringify({ hooks: {} }));
      rmSync(join(clone, "hooks", "hooks.json"));
      symlinkSync(join(s.root, "outside.json"), join(clone, "hooks", "hooks.json"));
      return growth(s, "surface unknown");
    },
  },
  {
    id: "surface/fifo-hooks-file-is-unknown-and-does-not-hang",
    run: (s) => {
      const { clone } = egmWorld(s);
      rmSync(join(clone, "hooks", "hooks.json"));
      if (spawnSync("mkfifo", [join(clone, "hooks", "hooks.json")]).status !== 0) return ok("skipped: no mkfifo");
      return growth(s, "surface unknown");
    },
  },
  {
    id: "surface/marketplace-source-that-escapes-its-clone-is-unknown",
    run: (s) => {
      egmWorld(s, { source: "../.." });
      return growth(s, "surface unknown");
    },
  },
  {
    id: "surface/marketplace-source-url-is-unknown-not-a-crash",
    run: (s) => {
      egmWorld(s, { source: "https://example.com/egm.git" });
      return growth(s, "surface unknown");
    },
  },
  {
    id: "surface/missing-manifest-is-unknown-not-a-crash",
    run: (s) => {
      const { clone } = egmWorld(s);
      rmSync(join(clone, ".claude-plugin", "plugin.json"));
      return growth(s, "surface unknown");
    },
  },
  {
    id: "surface/update-of-a-grown-install-is-disabled-and-fails",
    run: (s) => {
      const { inst } = egmWorld(s);
      s.setPlugins([s.entry("pro-egm", "project", s.repo), { id: "egm@egm", scope: "project", projectPath: s.repo, installPath: inst }]);
      if (s.engine(s.status(), "egm").surfaceGrew) return bad("grew before the update");
      const grown = "---\nname: c\ntools: Bash\n---\n";
      const r = s.run(["run", "egm", "update"], { extra: { FAKE_UPDATE_WRITE: `${join(inst, "agents", "c.md")}|${grown}` } });
      if (r.code === 0) return bad(`exit 0: ${r.out}`);
      if (!r.out.includes("beyond the pin") || !r.out.includes("agents/c.md")) return bad(`output: ${r.out}`);
      const off = s.calls("claude").map((c) => c.argv.join(" "));
      if (!off.includes("plugin disable egm@egm --scope project")) return bad(`no disable: ${JSON.stringify(off)}`);
      const live = json(s.listPath).filter((e) => e.id === "egm@egm" && e.enabled !== false);
      return live.length === 0 ? ok() : bad(`still enabled: ${JSON.stringify(live)}`);
    },
  },
  {
    id: "surface/update-refreshes-the-clone-and-runs-when-it-matches",
    run: (s) => {
      const { inst } = egmWorld(s);
      s.setPlugins([s.entry("pro-egm", "project", s.repo), { id: "egm@egm", scope: "project", projectPath: s.repo, installPath: inst }]);
      const r = s.run(["run", "egm", "update"]);
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      return same(a, ["plugin marketplace update egm", "plugin update egm@egm --scope project"]) ? ok() : bad(`calls ${JSON.stringify(a)}`);
    },
  },
  {
    id: "surface/update-blocked-by-a-grown-clone-never-runs-update",
    run: (s) => {
      const { clone, inst } = egmWorld(s);
      s.setPlugins([s.entry("pro-egm", "project", s.repo), { id: "egm@egm", scope: "project", projectPath: s.repo, installPath: inst }]);
      // the clone only grows when the marketplace refresh runs, as it does for real
      const grown = "---\nname: c\ntools: Bash\n---\n";
      const r = s.run(["run", "egm", "update"], { extra: { FAKE_MPUPDATE_WRITE: `${join(clone, "agents", "c.md")}|${grown}` } });
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      if (r.code === 0) return bad(`exit 0: ${r.out}`);
      if (a.some((x) => x.startsWith("plugin update "))) return bad(`update ran: ${JSON.stringify(a)}`);
      if (a.some((x) => x.startsWith("plugin disable"))) return bad(`disabled: ${JSON.stringify(a)}`);
      if (!a.includes("plugin marketplace update egm")) return bad(`no refresh: ${JSON.stringify(a)}`);
      return /new entry agents\/c\.md/.test(r.out) && /not updated/.test(r.out) ? ok() : bad(`output: ${r.out}`);
    },
  },
  {
    id: "surface/update-with-an-unreadable-clone-is-a-question",
    run: (s) => {
      const { clone, inst } = egmWorld(s);
      s.setPlugins([s.entry("pro-egm", "project", s.repo), { id: "egm@egm", scope: "project", projectPath: s.repo, installPath: inst }]);
      rmSync(join(clone, ".claude-plugin", "plugin.json"));
      const r = s.run(["run", "egm", "update"]);
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      return r.code !== 0 && /surface unknown/.test(r.out) && !a.some((x) => x.startsWith("plugin update ")) ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "surface/install-that-drifts-from-the-clone-is-disabled-and-fails",
    run: (s) => {
      const { inst } = egmWorld(s);
      const grown = "---\nname: c\ntools: Bash\n---\n";
      const r = s.run(["run", "egm", "install"], { extra: { FAKE_INSTALL_WRITE: `${join(inst, "agents", "c.md")}|${grown}` } });
      if (r.code === 0) return bad(`exit 0: ${r.out}`);
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      if (!a.includes("plugin disable egm@egm --scope project")) return bad(`no disable: ${JSON.stringify(a)}`);
      const live = json(s.listPath).filter((e) => e.id === "egm@egm" && e.enabled !== false);
      return live.length === 0 && r.out.includes("agents/c.md") ? ok() : bad(`still enabled or no name: ${r.out}`);
    },
  },
  {
    id: "surface/tools-are-pinned-per-entry-not-as-a-union",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { agents: { a: "Read, Grep, Glob", b: "Read" } }); // Glob moved from b to a: same union
      return growth(s, "agents/a.md: tools not in the pin: Glob");
    },
  },
  {
    id: "surface/removed-entries-and-tools-are-fine",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { agents: { a: "Read" } });
      rmSync(join(clone, "agents", "b.md"));
      const r = s.run(["run", "egm", "install"]);
      return r.code === 0 && installCalls(s).length === 1 ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "surface/command-allowed-tools-are-in-the-map",
    run: (s) => {
      const { surface, clone } = egmWorld(s, { plugin: { commands: { go: { allowed: "Bash(git:*), Read" } } } });
      if (!same(surface.tools["commands/go.md"], ["Bash(git:*)", "Read"])) return bad(`tools ${JSON.stringify(surface.tools)}`);
      writePlugin(clone, { commands: { go: { allowed: "Bash(git:*), Read, Write" } } });
      return growth(s, "commands/go.md: tools not in the pin: Write");
    },
  },
  {
    id: "surface/command-shell-line-change-moves-the-hash",
    run: (s) => {
      const { clone } = egmWorld(s, { plugin: { commands: { go: { allowed: "Read", body: "text\n!echo one" } } } });
      writePlugin(clone, { commands: { go: { allowed: "Read", body: "text\n!echo two" } } });
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/command-prose-change-does-not-move-the-hash",
    run: (s) => {
      const { clone } = egmWorld(s, { plugin: { commands: { go: { allowed: "Read", body: "text\n!echo one" } } } });
      writePlugin(clone, { commands: { go: { allowed: "Read", body: "other prose\n!echo one" } } });
      const r = s.run(["run", "egm", "install"]);
      return r.code === 0 ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "surface/lsp-declarations-are-counted",
    run: (s) => {
      const { clone } = egmWorld(s);
      writeFileSync(join(clone, ".lsp.json"), JSON.stringify({ x: { command: "other-lsp" } }));
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/inline-lsp-in-plugin-json-is-counted",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { manifest: { lspServers: { x: { command: "other-lsp" } } } });
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/inline-lsp-in-the-marketplace-entry-is-counted",
    run: (s) => {
      const { clone } = egmWorld(s);
      writeFileSync(join(clone, ".claude-plugin", "marketplace.json"), JSON.stringify({
        plugins: [{ name: "egm", source: "./", lspServers: { x: { command: "other" } } }],
      }));
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/frontmatter-hooks-in-skill-and-agent-are-counted",
    run: (s) => {
      const { clone } = egmWorld(s);
      writeFileSync(join(clone, "skills", "s", "SKILL.md"), "---\nname: s\nhooks:\n  PreToolUse:\n    - command: other\n---\nbody\n");
      const g = growth(s, "hooks/MCP declarations differ from the pin");
      if (!g.ok) return g;
      writePlugin(clone, {});
      writeFileSync(join(clone, "agents", "a.md"), "---\nname: a\ntools: Read, Grep\nhooks:\n  Stop:\n    - command: other\n---\nbody\n");
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/custom-skills-and-agents-paths-are-read",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { manifest: { skills: ["./extra"], agents: ["./more"] } });
      mkdirSync(join(clone, "extra", "z"), { recursive: true });
      writeFileSync(join(clone, "extra", "z", "SKILL.md"), "---\nname: z\nallowed-tools: Bash\n---\n");
      mkdirSync(join(clone, "more"), { recursive: true });
      writeFileSync(join(clone, "more", "m.md"), "---\nname: m\n---\n");
      const r = s.run(["run", "egm", "install"]);
      if (r.code === 0) return bad(`installed: ${r.out}`);
      return /new entry extra\/z \(tools Bash\)/.test(r.out) && /new entry more\/m\.md \(tools \*\)/.test(r.out) ? ok() : bad(`output: ${r.out}`);
    },
  },
  {
    id: "surface/custom-skills-path-does-not-hide-the-default-folder",
    run: (s) => {
      const { clone } = egmWorld(s, { plugin: { skills: { one: null, two: null } } });
      writePlugin(clone, { skills: { one: null, two: "Bash" }, manifest: { skills: ["./skills/one"] } });
      return growth(s, "skills/two: tools not in the pin: Bash");
    },
  },
  {
    id: "surface/moving-a-declared-path-moves-the-hash",
    run: (s) => {
      const { clone } = egmWorld(s, { plugin: { manifest: { skills: ["./skills"] } } });
      writePlugin(clone, { manifest: { skills: ["./skills/"] } });
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/marketplace-entry-agents-path-is-read",
    run: (s) => {
      const { clone } = egmWorld(s);
      mkdirSync(join(clone, "extra"), { recursive: true });
      writeFileSync(join(clone, "extra", "x.md"), "---\nname: x\n---\n");
      writeFileSync(join(clone, ".claude-plugin", "marketplace.json"), JSON.stringify({
        plugins: [{ name: "egm", source: "./", agents: ["./extra"] }],
      }));
      const g = growth(s, "new entry extra/x.md (tools *)");
      if (!g.ok) return g;
      writeFileSync(join(clone, ".claude-plugin", "marketplace.json"), JSON.stringify({
        plugins: [{ name: "egm", source: "./", agents: ["../../elsewhere"] }],
      }));
      return growth(s, "surface unknown");
    },
  },
  {
    id: "surface/skill-shell-line-change-moves-the-hash",
    run: (s) => {
      const { clone } = egmWorld(s);
      writeFileSync(join(clone, "skills", "s", "SKILL.md"), "---\nname: s\n---\nbody\n!`echo one`\n");
      return growth(s, "hooks/MCP declarations differ from the pin");
    },
  },
  {
    id: "surface/update-checks-every-covering-install-not-the-first",
    run: (s) => {
      const { inst } = egmWorld(s);
      const old = join(s.root, "mp", "old");
      writePlugin(old, {});
      s.setPlugins([
        s.entry("pro-egm", "project", s.repo),
        { id: "egm@egm", scope: "user", installPath: old },
        { id: "egm@egm", scope: "project", projectPath: s.repo, installPath: inst },
      ]);
      const grown = "---\nname: c\ntools: Bash\n---\n";
      const r = s.run(["run", "egm", "update"], { extra: { FAKE_UPDATE_WRITE: `${join(inst, "agents", "c.md")}|${grown}` } });
      if (r.code === 0) return bad(`exit 0, the older user copy masked the grown one: ${r.out}`);
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      if (!a.includes("plugin disable egm@egm --scope project")) return bad(`no project-scope disable: ${JSON.stringify(a)}`);
      if (a.includes("plugin disable egm@egm --scope user")) return bad(`disabled the clean user copy: ${JSON.stringify(a)}`);
      return r.out.includes("agents/c.md") ? ok() : bad(`output: ${r.out}`);
    },
  },
  {
    id: "surface/custom-path-outside-the-plugin-is-unknown",
    run: (s) => {
      const { clone } = egmWorld(s);
      writePlugin(clone, { manifest: { skills: "../../elsewhere" } });
      return growth(s, "surface unknown");
    },
  },
  {
    id: "surface/last-key-wins-and-quoted-keys-are-read",
    run: (s) => {
      const { clone } = egmWorld(s);
      writeFileSync(join(clone, "agents", "a.md"), "---\nname: a\ntools: Read\ntools: Read, Grep, Bash\n---\nbody\n");
      const g = growth(s, "agents/a.md: tools not in the pin: Bash");
      if (!g.ok) return g;
      writeFileSync(join(clone, "agents", "a.md"), "---\nname: a\n\"tools\": Read, Grep, Write\n---\nbody\n");
      return growth(s, "agents/a.md: tools not in the pin: Write");
    },
  },
  {
    id: "status/owner-installed-or-not",
    run: (s) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo)]);
      const st = s.status();
      if (s.engine(st, "lavish").state !== "missing") return bad(`lavish: ${s.engine(st, "lavish").state}, want missing`);
      if (s.engine(st, "qa-skills").state !== "not-applicable") return bad(`qa-skills: ${s.engine(st, "qa-skills").state}, want not-applicable`);
      return ok();
    },
  },
  {
    id: "status/disabled-owner-is-not-applicable",
    run: (s) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo, { enabled: false })]);
      return s.engine(s.status(), "lavish").state === "not-applicable" ? ok() : bad("a disabled owner counted");
    },
  },
  {
    id: "status/user-scope-owner-covers-repo",
    run: (s) => {
      s.setPlugins([s.entry("pro-design", "user")]);
      const e = s.engine(s.status(), "impeccable");
      return e.state === "missing" ? ok() : bad(`impeccable: ${e.state}`);
    },
  },
  {
    id: "status/lavish-user-copy-does-not-count",
    run: (s) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo)]);
      mkdirSync(join(s.home, ".claude", "skills", "lavish"), { recursive: true });
      writeFileSync(join(s.home, ".claude", "skills", "lavish", "SKILL.md"), "x");
      if (s.engine(s.status(), "lavish").state !== "missing") return bad("a user-scope lavish copy satisfied detect");
      mkdirSync(join(s.repo, ".claude", "skills", "lavish"), { recursive: true });
      writeFileSync(join(s.repo, LAVISH_FILE), "x");
      return s.engine(s.status(), "lavish").state === "installed" ? ok() : bad("the project-local lavish copy was not detected");
    },
  },
  {
    id: "status/user-scope-impeccable-counts",
    run: (s) => {
      s.setPlugins([s.entry("pro-design", "user")]);
      mkdirSync(join(s.home, ".claude", "skills", "impeccable"), { recursive: true });
      writeFileSync(join(s.home, ".claude", "skills", "impeccable", "SKILL.md"), "x");
      return s.engine(s.status(), "impeccable").state === "installed" ? ok() : bad("user-scope impeccable not detected");
    },
  },
  {
    id: "status/nested-install-counts-other-repo-does-not",
    run: (s) => {
      const nested = join(s.repo, "demo", "app");
      const other = join(s.root, "other-repo");
      mkdirSync(nested, { recursive: true });
      mkdirSync(other, { recursive: true });
      s.setPlugins([s.entry("pro-pdd", "project", nested), s.entry("pro-testing", "project", other)]);
      const st = s.status();
      if (s.engine(st, "lavish").state !== "missing") return bad(`demo/app install did not count: ${s.engine(st, "lavish").state}`);
      if (s.engine(st, "qa-skills").state !== "not-applicable") return bad(`other-repo install counted: ${s.engine(st, "qa-skills").state}`);
      const p = st.plugins.find((x) => x.name === "pro-testing");
      return p && p.covers === false ? ok() : bad("other-repo plugin should report covers false");
    },
  },
  {
    id: "status/lagging-plugin-flagged-from-local-marketplace",
    run: (s) => {
      const loc = join(s.root, "mp");
      mkdirSync(join(loc, ".claude-plugin"), { recursive: true });
      writeFileSync(join(loc, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins: [{ name: "pro-pdd", version: "2.0.0" }] }));
      writeFileSync(join(s.home, ".claude", "plugins", "known_marketplaces.json"), JSON.stringify({ [MS]: { installLocation: loc } }));
      s.setPlugins([s.entry("pro-pdd", "user", null, { version: "1.0.0" })]);
      const p = s.status().plugins[0];
      return p.lagging && p.latest === "2.0.0" ? ok() : bad(`lagging=${p.lagging} latest=${p.latest}`);
    },
  },
  {
    id: "status/works-without-claude-reads-installed-file",
    run: (s) => {
      writeFileSync(s.installedFile, JSON.stringify({ version: 2, plugins: { [`pro-pdd@${MS}`]: [{ scope: "project", projectPath: s.repo, version: "1.0.0" }] } }));
      const st = s.status({ bin: "noClaude" });
      if (st.source !== "installed_plugins.json") return bad(`source ${st.source}`);
      return s.engine(st, "lavish").state === "missing" ? ok() : bad("fallback file install not used");
    },
  },
  {
    id: "status/list-without-projectPath-falls-back-to-file",
    run: (s) => {
      s.setPlugins([s.entry("pro-pdd", "project", null)]);
      writeFileSync(s.installedFile, JSON.stringify({ version: 2, plugins: { [`pro-pdd@${MS}`]: [{ scope: "project", projectPath: s.repo, version: "1.0.0" }] } }));
      const st = s.status();
      return st.source === "installed_plugins.json" && s.engine(st, "lavish").state === "missing" ? ok() : bad(`source ${st.source}`);
    },
  },
  {
    id: "status/declined-and-needs-question",
    run: (s) => {
      s.setPlugins([s.entry("pro-design", "project", s.repo)]);
      let e = s.engine(s.status(), "taste-skill");
      if (!(e.state === "missing" && e.needsQuestion)) return bad("unanswered optional row should need a question");
      const a = s.run(["answer", "taste-skill", "no"]);
      if (a.code !== 0) return bad(`answer exited ${a.code}: ${a.out}`);
      e = s.engine(s.status(), "taste-skill");
      if (e.state !== "declined" || e.needsQuestion) return bad(`after no: ${e.state} needsQuestion=${e.needsQuestion}`);
      const f = json(s.answersPath);
      return f.answers["taste-skill"].answer === "no" && Number.isInteger(f.answers["taste-skill"].registryVersion)
        ? ok() : bad("answer not saved with its registry version");
    },
  },
  {
    id: "answer/default-or-unknown-rows-are-refused",
    run: (s) => {
      if (s.run(["answer", "lavish", "yes"]).code === 0) return bad("a default row accepted an answer");
      if (s.run(["answer", "nope", "yes"]).code === 0) return bad("an unknown id accepted an answer");
      return existsSync(s.answersPath) ? bad("a refused answer wrote the file") : ok();
    },
  },
  {
    id: "run/install-records-registry-argv-in-repo-and-is-idempotent",
    run: (s, pr) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo)]);
      const extra = { FAKE_NPX_FILES: LAVISH_FILE };
      const r = s.run(["run", "lavish", "install"], { extra });
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      const npx = s.calls("npx");
      const want = registry(pr).engines.find((e) => e.id === "lavish").install.slice(1);
      if (npx.length !== 1 || !same(npx[0].argv, want)) return bad(`npx argv ${JSON.stringify(npx.map((c) => c.argv))}`);
      if (realpathSync(npx[0].cwd) !== s.repo) return bad(`cwd ${npx[0].cwd}`);
      const again = s.run(["run", "lavish", "install"], { extra });
      if (s.calls("npx").length !== 1) return bad("second install ran npx again");
      return again.out.includes("already installed") ? ok() : bad(`second run said: ${again.out}`);
    },
  },
  {
    id: "run/update-needs-an-installed-engine",
    run: (s) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo)]);
      s.run(["run", "lavish", "update"]);
      if (s.calls("npx").length) return bad("update ran on a missing engine");
      mkdirSync(join(s.repo, ".claude", "skills", "lavish"), { recursive: true });
      writeFileSync(join(s.repo, LAVISH_FILE), "x");
      s.run(["run", "lavish", "update"]);
      const npx = s.calls("npx");
      return npx.length === 1 && npx[0].argv.includes("kunchenguid/lavish-axi") ? ok() : bad("update did not run the update argv");
    },
  },
  {
    id: "run/owner-missing-is-skipped",
    run: (s) => {
      s.setPlugins([]);
      const r = s.run(["run", "lavish", "install"]);
      return r.code === 0 && !s.calls().length && r.out.includes("skipped") ? ok() : bad(`code ${r.code}, calls ${s.calls().length}, out ${r.out}`);
    },
  },
  {
    id: "run/all-install-carries-on-after-a-failure",
    run: (s) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo), s.entry("pro-testing", "project", s.repo)]);
      const r = s.run(["run", "all", "install"], { extra: { FAKE_FAIL_MATCH: "kunchenguid", FAKE_NPX_FILES: QA_FILES.join(":") } });
      if (r.code !== 1) return bad(`exit ${r.code}, want 1`);
      const argvs = s.calls("npx").map((c) => c.argv.join(" "));
      if (!argvs.some((a) => a.includes("kunchenguid"))) return bad("lavish never ran");
      if (!argvs.some((a) => a.includes("petrkindlmann"))) return bad("run stopped after the failure");
      if (!r.out.includes("Retry")) return bad(`no retry line: ${r.out}`);
      const st = s.status();
      return s.engine(st, "qa-skills").state === "installed" && s.engine(st, "lavish").state === "missing" ? ok() : bad("states after the run are wrong");
    },
  },
  {
    id: "run/all-install-twice-changes-nothing-and-asks-nothing",
    run: (s, pr) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo), s.entry("pro-design", "project", s.repo)]);
      const extra = { FAKE_NPX_FILES: [LAVISH_FILE, ".claude/skills/impeccable/SKILL.md"].join(":") };
      const r1 = s.run(["run", "all", "install"], { extra });
      if (r1.code !== 0) return bad(`first run exit ${r1.code}: ${r1.out}`);
      const first = read(s.answersPath);
      if (json(s.answersPath).registryVersion !== registry(pr).version) return bad("registryVersion not recorded");
      const n = s.calls().length;
      const homeBefore = readdirSync(join(s.home, ".claude")).sort().join();
      const r2 = s.run(["run", "all", "install"], { extra });
      if (r2.code !== 0) return bad(`second run exit ${r2.code}`);
      if (s.calls().length !== n) return bad("second run called an installer");
      if (read(s.answersPath) !== first) return bad("second run rewrote pro-dev.json");
      if (readdirSync(join(s.home, ".claude")).sort().join() !== homeBefore) return bad("run touched HOME");
      return s.status().engines.some((e) => e.needsQuestion && e.default) ? bad("default row asks a question") : ok();
    },
  },
  {
    id: "run/optional-yes-installs-and-optional-unanswered-does-not",
    run: (s) => {
      s.setPlugins([s.entry("pro-design", "project", s.repo)]);
      s.run(["answer", "taste-skill", "yes"]);
      s.run(["run", "all", "install"], { extra: { FAKE_NPX_FILES: "impeccable@@.claude/skills/impeccable/SKILL.md:taste-skill@@.claude/skills/design-taste-frontend/SKILL.md" } });
      const argvs = s.calls("npx").map((c) => c.argv.join(" "));
      if (!argvs.some((a) => a.includes("Leonxlnx/taste-skill"))) return bad("answered-yes row was not installed");
      if (argvs.some((a) => a.includes("MengTo/Skills"))) return bad("an unanswered optional row was installed");
      return ok();
    },
  },
  {
    id: "run/hostile-answers-file-is-never-executed",
    run: (s) => {
      const evil = "yes; touch PWNED #";
      s.setPlugins([s.entry("pro-pdd", "project", s.repo), s.entry("pro-design", "project", s.repo)]);
      mkdirSync(join(s.repo, ".claude"), { recursive: true });
      writeFileSync(s.answersPath, JSON.stringify({
        registryVersion: "$(touch PWNED)",
        answers: { "taste-skill": { answer: evil }, "../../x; touch PWNED": { answer: "yes" }, lavish: { answer: "$(touch PWNED)" } },
      }));
      const r = s.run(["run", "all", "install"], { extra: { FAKE_NPX_FILES: [LAVISH_FILE, ".claude/skills/impeccable/SKILL.md"].join(":") } });
      if (existsSync(join(s.repo, "PWNED")) || existsSync(join(s.root, "PWNED"))) return bad("hostile text ran as a command");
      const all = s.calls().map((c) => c.argv.join(" ")).join("\n");
      if (all.includes("PWNED") || all.includes("touch")) return bad("hostile text reached an argv");
      if (all.includes("Leonxlnx")) return bad("a non-yes answer installed taste-skill");
      return r.code === 0 ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "answers/malformed-file-is-not-overwritten",
    run: (s) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo)]);
      mkdirSync(join(s.repo, ".claude"), { recursive: true });
      writeFileSync(s.answersPath, "{not json");
      const r = s.run(["answer", "taste-skill", "yes"]);
      const r2 = s.run(["run", "all", "install"], { extra: { FAKE_NPX_FILES: LAVISH_FILE } });
      if (r.code === 0 || r2.code === 0) return bad(`accepted: ${r.code} ${r2.code}`);
      if (read(s.answersPath) !== "{not json") return bad("malformed file was overwritten");
      if (existsSync(`${s.answersPath}.bak`)) return bad("a .bak was created");
      return /fix or delete/i.test(r.out) ? ok() : bad(`message: ${r.out}`);
    },
  },
  {
    id: "answers/symlinked-file-is-refused-and-target-untouched",
    run: (s) => {
      const outside = join(s.root, "outside-zshrc");
      writeFileSync(outside, "export SECRET=1\n");
      mkdirSync(join(s.repo, ".claude"), { recursive: true });
      symlinkSync(outside, s.answersPath);
      s.setPlugins([s.entry("pro-pdd", "project", s.repo)]);
      const r1 = s.run(["answer", "taste-skill", "yes"]);
      if (!/not a regular file/.test(r1.out)) return bad(`message: ${r1.out}`);
      const r2 = s.run(["run", "all", "install"], { extra: { FAKE_NPX_FILES: LAVISH_FILE } });
      if (r1.code === 0) return bad("answer accepted a symlinked file");
      if (r2.code === 0) return bad("run did not report the refusal");
      if (read(outside) !== "export SECRET=1\n") return bad("outside file changed");
      if (existsSync(`${s.answersPath}.bak`)) return bad("a .bak copy was made");
      const st = s.status();
      return st.answersFileMalformed === true ? ok() : bad("status did not flag the unsafe file");
    },
  },
  {
    id: "answers/symlinked-claude-dir-is-refused",
    run: (s) => {
      const elsewhere = join(s.root, "elsewhere");
      mkdirSync(elsewhere);
      symlinkSync(elsewhere, join(s.repo, ".claude"));
      const r = s.run(["answer", "taste-skill", "yes"]);
      if (r.code === 0) return bad("accepted a symlinked .claude");
      return readdirSync(elsewhere).length === 0 ? ok() : bad(`wrote ${readdirSync(elsewhere)}`);
    },
  },
  {
    id: "answers/oversized-file-reads-as-malformed",
    run: (s) => {
      mkdirSync(join(s.repo, ".claude"), { recursive: true });
      writeFileSync(s.answersPath, JSON.stringify({ pad: "x".repeat(70 * 1024) }));
      return s.status().answersFileMalformed === true ? ok() : bad("not flagged");
    },
  },
  {
    id: "run/missing-npx-gives-a-clear-message",
    run: (s) => {
      s.setPlugins([s.entry("pro-pdd", "project", s.repo)]);
      const r = s.run(["run", "lavish", "install"], { bin: "noNpx" });
      return r.code === 1 && /npx is not on PATH/.test(r.out) ? ok() : bad(`code ${r.code}: ${r.out}`);
    },
  },
  {
    id: "run/claude-plugin-companion-uses-claude-argv",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo)]);
      s.run(["answer", "vercel", "yes"]);
      s.run(["run", "vercel", "install"]);
      const c = s.calls("claude");
      return c.length === 1 && same(c[0].argv, ["plugin", "install", "vercel@claude-plugins-official", "--scope", "project"]) ? ok() : bad(JSON.stringify(c));
    },
  },
  {
    id: "plugins/update-runs-per-scope-from-each-install-folder",
    run: (s) => {
      const nested = join(s.repo, "demo", "app");
      const other = join(s.root, "other-repo");
      mkdirSync(nested, { recursive: true });
      mkdirSync(other, { recursive: true });
      s.setPlugins([
        s.entry("pro-quality", "user", null, { version: "0.1.0" }),
        s.entry("pro-quality", "project", nested, { version: "0.1.0" }),
        s.entry("pro-core", "project", other, { version: "0.1.0" }),
        { id: "figma@claude-plugins-official", scope: "user" },
      ]);
      const r = s.run(["plugins", "update"], { extra: { FAKE_NEW_VERSION: "0.2.0" } });
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      const c = s.calls("claude");
      if (!same(c[0].argv, ["plugin", "marketplace", "update", MS])) return bad(`first call ${JSON.stringify(c[0])}`);
      const ups = c.filter((x) => x.argv[1] === "update" && x.argv[0] === "plugin");
      if (ups.length !== 2) return bad(`${ups.length} plugin updates, want 2`);
      const user = ups.find((x) => x.argv.includes("user"));
      const proj = ups.find((x) => x.argv.includes("project"));
      if (!user || realpathSync(user.cwd) !== s.repo) return bad("user-scope update not run from the repo");
      if (!proj || realpathSync(proj.cwd) !== nested) return bad(`project update cwd ${proj?.cwd}`);
      if (ups.some((x) => x.argv.some((a) => a.includes("other") || a.includes("figma")))) return bad("updated an install outside the repo");
      return /0\.1\.0 -> 0\.2\.0/.test(r.out) ? ok() : bad(`no before/after line: ${r.out}`);
    },
  },
  {
    id: "plugins/update-survives-a-failed-step",
    run: (s) => {
      s.setPlugins([s.entry("pro-quality", "user"), s.entry("pro-pdd", "user")]);
      const r = s.run(["plugins", "update"], { extra: { FAKE_FAIL_MATCH: "pro-quality@" } });
      const ups = s.calls("claude").filter((x) => x.argv[1] === "update" && x.argv[0] === "plugin");
      return r.code === 1 && ups.length === 2 && /Retry/.test(r.out) ? ok() : bad(`code ${r.code}, updates ${ups.length}, out ${r.out}`);
    },
  },
  {
    id: "plugins/swap-starter-installs-stack-first-then-uninstalls",
    run: (s) => {
      s.setPlugins([s.entry("pro-starter", "project", s.repo), s.entry("pro-nextjs", "project", s.repo)]);
      const r = s.run(["plugins", "swap-starter"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      const want = [
        `plugin install pro-nextjs@${MS} --scope project`,
        `plugin install pro-dev-starter@${MS} --scope project`,
        `plugin uninstall pro-starter@${MS} --scope project`,
      ];
      return same(a, want) ? ok() : bad(JSON.stringify(a));
    },
  },
  {
    id: "plugins/swap-starter-skips-a-disabled-shim",
    run: (s) => {
      s.setPlugins([s.entry("pro-starter", "user", null, { enabled: false })]);
      const r = s.run(["plugins", "swap-starter"]);
      return r.code === 0 && !s.calls("claude").length && /pro-starter user: disabled, skipped/.test(r.out) ? ok() : bad(`code ${r.code}, calls ${s.calls().length}, out ${r.out}`);
    },
  },
  {
    id: "plugins/swap-starter-leaves-a-disabled-dep-alone",
    run: (s) => {
      s.setPlugins([s.entry("pro-starter", "project", s.repo), s.entry("pro-nextjs", "project", s.repo), s.entry("pro-astro", "project", s.repo, { enabled: false })]);
      const r = s.run(["plugins", "swap-starter"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      const want = [
        `plugin install pro-nextjs@${MS} --scope project`,
        `plugin install pro-dev-starter@${MS} --scope project`,
        `plugin uninstall pro-starter@${MS} --scope project`,
      ];
      return same(a, want) ? ok() : bad(JSON.stringify(a));
    },
  },
  {
    id: "plugins/swap-starter-keeps-the-shim-when-the-install-fails",
    run: (s) => {
      s.setPlugins([s.entry("pro-starter", "project", s.repo)]);
      const r = s.run(["plugins", "swap-starter"], { extra: { FAKE_FAIL_MATCH: "pro-dev-starter@" } });
      const a = s.calls("claude").map((c) => c.argv.join(" "));
      return r.code === 1 && !a.some((x) => x.includes("uninstall")) ? ok() : bad(`code ${r.code}, calls ${JSON.stringify(a)}`);
    },
  },
  {
    id: "plugins/swap-starter-does-nothing-without-the-shim",
    run: (s) => {
      s.setPlugins([s.entry("pro-core", "user")]);
      const r = s.run(["plugins", "swap-starter"]);
      return r.code === 0 && !s.calls().length ? ok() : bad(`code ${r.code}, calls ${s.calls().length}`);
    },
  },
  {
    id: "stale/lists-only-dead-pro-dev-entries",
    run: (s) => {
      const live = join(s.root, "live");
      mkdirSync(live);
      const doc = { version: 2, plugins: {
        [`pro-quality@${MS}`]: [{ scope: "project", projectPath: join(s.root, "gone"), version: "1" }, { scope: "project", projectPath: live, version: "1" }],
        "figma@claude-plugins-official": [{ scope: "project", projectPath: join(s.root, "gone2"), version: "1" }],
        [`pro-core@${MS}`]: [{ scope: "user", version: "1" }],
      } };
      writeFileSync(s.installedFile, JSON.stringify(doc, null, 2));
      const before = read(s.installedFile);
      const r = s.run(["stale"]);
      const lines = r.out.split("\n").filter((l) => l.startsWith("stale:"));
      if (lines.length !== 1 || !lines[0].includes("pro-quality")) return bad(`listed ${JSON.stringify(lines)}`);
      return read(s.installedFile) === before ? ok() : bad("listing changed the file");
    },
  },
  {
    id: "stale/skips-entries-on-unmounted-volumes",
    run: (s) => {
      const doc = { version: 2, plugins: {
        [`pro-quality@${MS}`]: [
          { scope: "project", projectPath: "/Volumes/pro-dev-test-no-such-drive/work/app", version: "1" },
          { scope: "project", projectPath: join(s.root, "gone"), version: "1" },
        ],
      } };
      writeFileSync(s.installedFile, JSON.stringify(doc));
      const r = s.run(["stale"]);
      const lines = r.out.split("\n").filter((l) => l.startsWith("stale:"));
      if (lines.length !== 1 || lines[0].includes("/Volumes/")) return bad(`listed ${JSON.stringify(lines)}`);
      if (!/unmounted drives are skipped/.test(r.out)) return bad("no skip note in output");
      const r2 = s.run(["stale", "--remove"]);
      return json(s.installedFile).plugins[`pro-quality@${MS}`].some((e) => e.projectPath.startsWith("/Volumes/"))
        ? ok() : bad(`--remove dropped the unmounted entry: ${r2.out}`);
    },
  },
  {
    id: "stale/remove-writes-backup-and-removes-only-dead-entries",
    run: (s) => {
      const live = join(s.root, "live");
      mkdirSync(live);
      const doc = { version: 2, plugins: {
        [`pro-quality@${MS}`]: [{ scope: "project", projectPath: join(s.root, "gone"), version: "1" }, { scope: "project", projectPath: live, version: "1" }],
        [`pro-pdd@${MS}`]: [{ scope: "project", projectPath: join(s.root, "gone"), version: "1" }],
        "figma@claude-plugins-official": [{ scope: "project", projectPath: join(s.root, "gone2"), version: "1" }],
        [`pro-core@${MS}`]: [{ scope: "user", version: "1" }],
      } };
      const original = JSON.stringify(doc, null, 2);
      writeFileSync(s.installedFile, original);
      const r = s.run(["stale", "--remove"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      const dir = dirname(s.installedFile);
      const baks = readdirSync(dir).filter((f) => f.startsWith("installed_plugins.json.bak-"));
      if (baks.length !== 1) return bad(`${baks.length} backups`);
      if (read(join(dir, baks[0])) !== original) return bad("backup differs from the original");
      const now = json(s.installedFile);
      const want = { version: 2, plugins: {
        [`pro-quality@${MS}`]: [{ scope: "project", projectPath: live, version: "1" }],
        "figma@claude-plugins-official": doc.plugins["figma@claude-plugins-official"],
        [`pro-core@${MS}`]: doc.plugins[`pro-core@${MS}`],
      } };
      return same(now, want) ? ok() : bad(`result ${JSON.stringify(now)}`);
    },
  },
  {
    id: "stale/remove-refuses-an-unknown-shape",
    run: (s) => {
      for (const body of [
        JSON.stringify({ version: 3, plugins: { [`pro-quality@${MS}`]: [{ scope: "project", projectPath: join(s.root, "gone") }] } }),
        JSON.stringify({ version: 2, plugins: [] }),
        JSON.stringify({ version: 2, plugins: { [`pro-quality@${MS}`]: { scope: "project" } } }),
        "{broken",
      ]) {
        writeFileSync(s.installedFile, body);
        const r = s.run(["stale", "--remove"]);
        if (r.code === 0) return bad(`accepted ${body}`);
        if (read(s.installedFile) !== body) return bad(`changed ${body}`);
        if (readdirSync(dirname(s.installedFile)).some((f) => f.includes(".bak-"))) return bad("wrote a backup for an unknown shape");
      }
      return ok();
    },
  },
  {
    id: "stale/missing-file-is-not-an-error",
    run: (s) => {
      const r = s.run(["stale", "--remove"]);
      return r.code === 0 ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
];

// The nudge: needs the plugin root's registry version, so it computes a matching and a differing one.
function nudgeCase(id, setup, expectLine, { payload = {}, cwdKey = "repo" } = {}) {
  return {
    id: `nudge/${id}`,
    run: (s, pr) => {
      const current = registry(pr).version;
      const dir = setup(s, current) ?? s[cwdKey];
      const r = spawnSync("python3", [s.nudge], {
        encoding: "utf8", env: { PATH: s.env().PATH, HOME: s.home }, cwd: dir,
        input: JSON.stringify({ cwd: dir, source: "startup", ...payload }),
      });
      if (r.status !== 0) return bad(`exit ${r.status}: ${r.stderr}`);
      const out = r.stdout.trim();
      if (expectLine) {
        return out.split("\n").length === 1 && (() => { try { return JSON.parse(out).hookSpecificOutput.additionalContext.endsWith("pro-dev plugins changed since the last /pro-dev run: run /pro-dev update"); } catch { return false; } })()
          ? ok() : bad(`stdout ${JSON.stringify(out)}`);
      }
      return out === "" ? ok() : bad(`should be silent, printed ${JSON.stringify(out)}`);
    },
  };
}
const writeSaved = (s, v) => {
  mkdirSync(join(s.repo, ".claude"), { recursive: true });
  writeFileSync(s.answersPath, typeof v === "string" ? v : JSON.stringify(v));
};
CASES.push(
  nudgeCase("version-mismatch-prints-one-line", (s, cur) => writeSaved(s, { registryVersion: cur + 1 }), true),
  nudgeCase("older-saved-version-prints-one-line", (s, cur) => writeSaved(s, { registryVersion: cur - 1 }), true),
  nudgeCase("match-is-silent", (s, cur) => writeSaved(s, { registryVersion: cur }), false),
  nudgeCase("missing-file-is-silent", () => {}, false),
  nudgeCase("malformed-file-is-silent-and-exits-zero", (s) => writeSaved(s, "{nope"), false),
  nudgeCase("non-object-json-is-silent", (s) => writeSaved(s, "[1,2]"), false),
  nudgeCase("non-integer-version-is-silent", (s) => writeSaved(s, { registryVersion: "1" }), false),
  nudgeCase("file-without-version-is-silent", (s) => writeSaved(s, { answers: {} }), false),
  nudgeCase("compaction-is-silent", (s, cur) => writeSaved(s, { registryVersion: cur + 1 }), false, { payload: { source: "compact" } }),
  nudgeCase("subfolder-of-the-repo-still-prints", (s, cur) => {
    writeSaved(s, { registryVersion: cur + 1 });
    const sub = join(s.repo, "pkg", "web");
    mkdirSync(sub, { recursive: true });
    return sub;
  }, true),
  nudgeCase("outside-a-git-repo-is-silent", (s, cur) => {
    const plain = join(s.root, "plain");
    mkdirSync(join(plain, ".claude"), { recursive: true });
    writeFileSync(join(plain, ".claude", "pro-dev.json"), JSON.stringify({ registryVersion: cur + 1 }));
    return plain;
  }, false),
  {
    id: "nudge/fifo-at-the-path-is-silent-and-quick",
    run: (s) => {
      mkdirSync(join(s.repo, ".claude"), { recursive: true });
      const m = spawnSync("mkfifo", [s.answersPath]);
      if (m.error || m.status !== 0) return ok("skipped: mkfifo unavailable");
      const t0 = Date.now();
      const r = spawnSync("python3", [s.nudge], { encoding: "utf8", env: { PATH: s.env().PATH, HOME: s.home }, cwd: s.repo, input: "{}", timeout: 5000 });
      if (r.error) return bad(`hung or failed: ${r.error.message}`);
      if (Date.now() - t0 > 3000) return bad("too slow");
      return r.status === 0 && r.stdout.trim() === "" ? ok() : bad(`status ${r.status}, stdout ${JSON.stringify(r.stdout)}`);
    },
  },
  {
    id: "nudge/symlink-to-dev-zero-is-silent",
    run: (s) => {
      if (!existsSync("/dev/zero")) return ok("skipped: no /dev/zero");
      mkdirSync(join(s.repo, ".claude"), { recursive: true });
      symlinkSync("/dev/zero", s.answersPath);
      const r = spawnSync("python3", [s.nudge], { encoding: "utf8", env: { PATH: s.env().PATH, HOME: s.home }, cwd: s.repo, input: "{}", timeout: 5000 });
      if (r.error) return bad(`hung or failed: ${r.error.message}`);
      return r.status === 0 && r.stdout.trim() === "" ? ok() : bad(`status ${r.status}, stdout ${JSON.stringify(r.stdout)}`);
    },
  },
  {
    id: "nudge/garbage-stdin-still-exits-zero",
    run: (s) => {
      const r = spawnSync("python3", [s.nudge], { encoding: "utf8", env: { PATH: s.env().PATH, HOME: s.home }, cwd: s.repo, input: "not json at all" });
      return r.status === 0 ? ok() : bad(`exit ${r.status}`);
    },
  },
  {
    id: "nudge/never-writes",
    run: (s, pr) => {
      writeSaved(s, { registryVersion: registry(pr).version + 1 });
      const before = read(s.answersPath);
      spawnSync("python3", [s.nudge], { encoding: "utf8", env: { PATH: s.env().PATH, HOME: s.home }, cwd: s.repo, input: "{}" });
      return read(s.answersPath) === before && !s.calls().length ? ok() : bad("nudge changed a file or ran a tool");
    },
  },
);

// --- gitExclude (R31) ----------------------------------------------------------

const GX_DIR = ".claude/skills/deploy-to-vercel/";
const GX_FILE = `${GX_DIR}SKILL.md`;
function gxRow(paths = [GX_DIR]) {
  return {
    id: "gx", owner: "pro-ship", bridges: [], kind: "skills-cli", default: true,
    detect: { all: [{ file: "skills/deploy-to-vercel/SKILL.md", scopes: ["project"] }] },
    install: ["npx", "skills", "add", "x/y", "-a", "claude-code", "-y", "-s", "deploy-to-vercel"],
    update: ["npx", "skills", "add", "x/y", "-a", "claude-code", "-y", "-s", "deploy-to-vercel"],
    gitExclude: paths, why: "test row",
  };
}
const gxWorld = (s, paths) => {
  s.useRows([gxRow(paths)]);
  s.setPlugins([s.entry("pro-ship", "project", s.repo)]);
  return { extra: { FAKE_NPX_FILES: GX_FILE } };
};
const gitIn = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf8" });
const excludeFile = (repo) => join(repo, ".git", "info", "exclude");
const excludeText = (repo) => (existsSync(excludeFile(repo)) ? read(excludeFile(repo)) : "");
const gxCount = (text) => text.split("\n").filter((l) => l === GX_DIR).length;

CASES.push(
  {
    id: "gitExclude/already-installed-still-gets-the-exclude",
    run: (s) => {
      const o = gxWorld(s);
      mkdirSync(join(s.repo, GX_DIR), { recursive: true });
      writeFileSync(join(s.repo, GX_FILE), "# hand install\n");
      const r = s.run(["run", "gx", "install"], o);
      if (!/already installed/.test(r.out)) return bad(`not reported installed: ${r.out}`);
      return gxCount(excludeText(s.repo)) === 1 ? ok() : bad(`exclude: ${JSON.stringify(excludeText(s.repo))}`);
    },
  },
  {
    id: "gitExclude/tracked-folder-is-named",
    run: (s) => {
      const o = gxWorld(s);
      mkdirSync(join(s.repo, GX_DIR), { recursive: true });
      writeFileSync(join(s.repo, GX_FILE), "# committed\n");
      gitIn(s.repo, ["add", "-f", GX_FILE]);
      const r = s.run(["run", "gx", "install"], o);
      return /already committed/.test(r.out) && /git rm -r --cached/.test(r.out) ? ok() : bad(`no warning: ${r.out}`);
    },
  },
  {
    id: "gitExclude/added-once-across-install-and-update",
    run: (s) => {
      const o = gxWorld(s);
      const a = s.run(["run", "gx", "install"], o);
      const b = s.run(["run", "gx", "update"], o);
      if (a.code !== 0 || b.code !== 0) return bad(`exit ${a.code}/${b.code}: ${a.out} ${b.out}`);
      if (gxCount(excludeText(s.repo)) !== 1) return bad(`want one line, file: ${JSON.stringify(excludeText(s.repo))}`);
      if (!/added/.test(a.out) || !/already in/.test(b.out)) return bad(`messages: ${a.out} | ${b.out}`);
      return ok();
    },
  },
  {
    id: "gitExclude/git-add-all-leaves-the-folder-untracked",
    run: (s) => {
      const o = gxWorld(s);
      s.run(["run", "gx", "install"], o);
      writeFileSync(join(s.repo, "keep.txt"), "x");
      gitIn(s.repo, ["add", "-A"]);
      const staged = gitIn(s.repo, ["diff", "--cached", "--name-only"]).stdout.split("\n");
      if (!staged.includes("keep.txt")) return bad(`keep.txt not staged: ${staged}`);
      if (staged.some((f) => f.startsWith(".claude/skills/"))) return bad(`skill folder staged: ${staged}`);
      const tracked = gitIn(s.repo, ["ls-files", "--", GX_DIR]).stdout.trim();
      return tracked === "" && existsSync(join(s.repo, GX_FILE)) ? ok() : bad(`tracked: ${tracked}`);
    },
  },
  {
    id: "gitExclude/bad-paths-are-refused-and-nothing-written",
    run: (s) => {
      for (const badPath of ["../x", "/abs/path", "docs/x", ".claude/skills/../../x", ".claude/skills/", ".claude/skills/a\nb/"]) {
        const o = gxWorld(s, [badPath]);
        const r = s.run(["run", "gx", "install"], o);
        if (!/refused/.test(r.out)) return bad(`${JSON.stringify(badPath)} not refused: ${r.out}`);
        const text = excludeText(s.repo);
        if (text.includes("x") && /(^|\n)(\.\.\/x|\/abs\/path|docs\/x)/.test(text)) return bad(`wrote ${badPath}: ${text}`);
        if (/skills\/\.\.|(^|\n)\.claude\/skills\/(\n|$)|a\nb/.test(text)) return bad(`wrote ${JSON.stringify(badPath)}: ${JSON.stringify(text)}`);
        rmSync(join(s.repo, ".claude"), { recursive: true, force: true });
      }
      return ok();
    },
  },
  {
    id: "gitExclude/good-path-written-beside-a-refused-one",
    run: (s) => {
      const o = gxWorld(s, ["../x", GX_DIR]);
      const r = s.run(["run", "gx", "install"], o);
      const text = excludeText(s.repo);
      return /refused/.test(r.out) && gxCount(text) === 1 && !text.includes("../x") ? ok() : bad(`${r.out} | ${JSON.stringify(text)}`);
    },
  },
  {
    id: "gitExclude/not-a-git-repo-is-skipped-with-a-note",
    run: (s) => {
      rmSync(join(s.repo, ".git"), { recursive: true, force: true });
      const o = gxWorld(s);
      const r = s.run(["run", "gx", "install"], o);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      return /not a git work tree/.test(r.out) && !existsSync(join(s.repo, ".git")) ? ok() : bad(`out: ${r.out}`);
    },
  },
  {
    id: "gitExclude/symlinked-exclude-file-is-refused",
    run: (s) => {
      const o = gxWorld(s);
      const victim = join(s.root, "victim.txt");
      writeFileSync(victim, "keep\n");
      mkdirSync(join(s.repo, ".git", "info"), { recursive: true });
      rmSync(excludeFile(s.repo), { force: true });
      symlinkSync(victim, excludeFile(s.repo));
      const r = s.run(["run", "gx", "install"], o);
      return /symlink/.test(r.out) && read(victim) === "keep\n" ? ok() : bad(`victim: ${JSON.stringify(read(victim))} out: ${r.out}`);
    },
  },
  {
    id: "gitExclude/linked-worktree-writes-the-file-git-reads",
    run: (s) => {
      gitIn(s.repo, ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init"]);
      const wt = join(s.root, "linked");
      const add = gitIn(s.repo, ["worktree", "add", "-q", "-b", "side", wt]);
      if (add.status !== 0) return bad(`worktree add: ${add.stderr}`);
      s.useRows([gxRow()]);
      s.setPlugins([s.entry("pro-ship", "project", wt)]);
      const r = spawnSync("python3", [s.script, "--repo", wt, "run", "gx", "install"], {
        encoding: "utf8", env: s.env("both", { FAKE_NPX_FILES: GX_FILE }), cwd: wt,
      });
      if (r.status !== 0) return bad(`exit ${r.status}: ${r.stdout}${r.stderr}`);
      const want = gitIn(wt, ["rev-parse", "--git-path", "info/exclude"]).stdout.trim();
      const wantAbs = want.startsWith("/") ? want : join(wt, want);
      if (!existsSync(wantAbs) || gxCount(read(wantAbs)) !== 1) return bad(`not in ${wantAbs}: ${r.stdout}`);
      const ign = gitIn(wt, ["check-ignore", "-q", GX_FILE]);
      return ign.status === 0 ? ok() : bad(`git check-ignore exit ${ign.status}`);
    },
  },
);

export function runProDevCases({ pluginRoot = DEFAULT_PLUGIN_ROOT, only = null } = {}) {
  const selected = only ? CASES.filter((c) => c.id.includes(only)) : CASES;
  const out = { skipped: null, selected, results: [] };
  for (const p of ["scripts/pro-dev.py", "scripts/pro-dev-nudge.py", "registry/engines.json"]) {
    if (!existsSync(join(pluginRoot, p))) return { ...out, skipped: `${join(pluginRoot, p)} not found` };
  }
  for (const t of ["python3", "git"]) {
    if (spawnSync(t, ["--version"], { stdio: "ignore" }).error) return { ...out, skipped: `${t} not found on PATH` };
  }
  for (const c of selected) {
    const s = buildSandbox(pluginRoot);
    let result;
    try { result = c.run(s, pluginRoot); }
    catch (err) { result = { ok: false, detail: `threw: ${(err && err.stack) || err}` }; }
    finally { rmSync(s.root, { recursive: true, force: true }); }
    out.results.push({ id: c.id, ok: !!result.ok, detail: result.detail || "" });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.slice(7) ?? null;
  const root = args.find((a) => a.startsWith("--plugin-root="))?.slice(14);
  const { skipped, selected, results } = runProDevCases({ only, ...(root ? { pluginRoot: resolve(root) } : {}) });
  if (skipped) { console.log(`skipped: ${skipped}`); return 0; }
  if (!selected.length) { console.log("no cases match"); return 1; }
  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id}${r.ok ? "" : `\n     ${r.detail}`}`);
    if (!r.ok) failed++;
  }
  console.log(`\n${failed ? "✗" : "✓"} ${results.length} cases · ${failed} failures`);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
