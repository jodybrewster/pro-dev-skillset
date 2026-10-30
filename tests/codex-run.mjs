#!/usr/bin/env node
// Behaviour test for the Codex runner (plugins/pro-ship/scripts/codex-run.py). Every case runs
// the script as one process against a stub `codex` that sits first on a PATH built only from the
// sandbox, so the real Codex is never started and nothing touches the network.
//
//   node tests/codex-run.mjs
//
// Also exported as runCodexRunCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync, copyFileSync, symlinkSync, chmodSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = join(ROOT, "plugins", "pro-ship", "scripts", "codex-run.py");

const STUB = `#!/bin/sh
if [ "$1" = "login" ]; then
  if [ "\${STUB_LOGIN:-0}" = "0" ]; then echo "Logged in using ChatGPT"; else echo "Not logged in"; fi
  exit "\${STUB_LOGIN:-0}"
fi
if [ "$1" = "exec" ]; then
  for a in "$@"; do printf '%s\\n' "$a" >> "$STUB_LOG.argv"; done
  cat > "$STUB_LOG.stdin"
  out=""
  prev=""
  for a in "$@"; do
    if [ "$prev" = "-o" ]; then out="$a"; fi
    prev="$a"
  done
  case "\${STUB_MODE:-ok}" in
    ok)
      echo "STUB-STDERR-MARKER" >&2
      printf 'important: 1  nits: 0  pre-existing: 0  skipped: 0\\n- [correctness] src/a.py:10 - stub finding' > "$out"
      exit 0 ;;
    unicode)
      printf 'important: 0  nits: 0  pre-existing: 0  skipped: 0\ncaf\\303\\251 \\342\\200\\224 \\346\\227\\245\\346\\234\\254\n' > "$out"
      exit 0 ;;
    empty) exit 0 ;;
    fail) echo boom >&2; exit 1 ;;
    sleep) sleep 30; exit 0 ;;
  esac
fi
exit 0
`;

export function runCodexRunCases() {
  const out = { skipped: null, results: [] };
  const which = (bin) => {
    const r = spawnSync("/bin/sh", ["-c", `command -v ${bin}`], { encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : "";
  };
  const python = which("python3");
  const gitBin = which("git");
  if (!python) return { ...out, skipped: "python3 not found on PATH" };
  if (!gitBin) return { ...out, skipped: "git not found on PATH" };
  if (!existsSync("/bin/sh")) return { ...out, skipped: "/bin/sh not found" };
  const hasToml = spawnSync(python, ["-c", "import tomllib"], { stdio: "ignore" }).status === 0;

  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "codex-run-")));
  const add = (id, expect, ok, reason = "") => out.results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 400) });
  const home = join(sandbox, "home");
  const stubDir = join(sandbox, "bin");
  const toolDir = join(sandbox, "tools");
  mkdirSync(home, { recursive: true });
  mkdirSync(stubDir, { recursive: true });
  mkdirSync(toolDir, { recursive: true });
  writeFileSync(join(stubDir, "codex"), STUB);
  chmodSync(join(stubDir, "codex"), 0o755);
  // python3 and git are linked into a folder of their own, so a real codex that lives beside them cannot shadow the stub.
  symlinkSync(python, join(toolDir, "python3"));
  symlinkSync(gitBin, join(toolDir, "git"));
  const PATH_STUB = [stubDir, toolDir, "/usr/bin", "/bin"].join(":");
  const PATH_NONE = [toolDir, "/usr/bin", "/bin"].join(":");
  const baseEnv = {
    HOME: home, CODEX_HOME: join(home, ".codex"), PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  };
  const git = (cwd, ...args) => spawnSync(gitBin, args, { cwd, encoding: "utf8", env: { ...baseEnv, PATH: PATH_NONE } });

  const MARKER = "UNIQUE-PROMPT-MARKER-7f3a";
  const INSTR_BODY = "You are the code reviewer. Stub instruction body.";
  let n = 0;
  const mkrepo = (answersFile = '{"answers":{"codex":{"answer":"yes"}}}') => {
    const repo = join(sandbox, `repo${++n}`);
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    if (answersFile !== null) { mkdirSync(join(repo, ".claude")); writeFileSync(join(repo, ".claude", "pro-dev.json"), answersFile); }
    writeFileSync(join(repo, "review.md"), `---\nname: code-reviewer\ndescription: x\n---\n\n${INSTR_BODY}\n`);
    writeFileSync(join(repo, "agent.toml"), `name = "rev"\ndeveloper_instructions = """\nTOML BODY LINE\n"""\n`);
    writeFileSync(join(repo, "handoff.md"), `range: aaa..bbb\nmarker: ${MARKER}\n`);
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "init");
    return repo;
  };
  // One process per call; `logs` come back so a case can read what the stub saw.
  const run = (repo, args, { env = {}, script = RUNNER, path = PATH_STUB, timeout = 60000 } = {}) => {
    const log = join(sandbox, `log${++n}`);
    const t0 = Date.now();
    const r = spawnSync(python, [script, ...args], { cwd: repo, encoding: "utf8", timeout, env: { ...baseEnv, PATH: path, STUB_LOG: log, ...env } });
    const rd = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
    return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", argv: rd(`${log}.argv`).split("\n").filter(Boolean), stdin: rd(`${log}.stdin`), ms: Date.now() - t0 };
  };
  const std = (repo) => ["--instructions", join(repo, "review.md"), "--prompt", join(repo, "handoff.md"), "--cwd", repo];
  const oneLine = (r) => r.stdout.split("\n").filter((l) => l !== "").length === 1 && r.stdout.endsWith("\n");
  const fails = (id, expect, r, status, prefix, extra = true) => {
    add(id, expect, r.status === status && r.stdout.startsWith(prefix) && oneLine(r) && extra, `${r.status} ${JSON.stringify(r.stdout)} ${r.stderr}`);
  };

  try {
    // The stub must be what the runner finds; the not-installed PATH must find nothing.
    const found = spawnSync("/bin/sh", ["-c", "command -v codex"], { encoding: "utf8", env: { PATH: PATH_STUB } }).stdout.trim();
    const none = spawnSync("/bin/sh", ["-c", "command -v codex"], { encoding: "utf8", env: { PATH: PATH_NONE } }).stdout.trim();
    if (found !== join(stubDir, "codex") || none !== "") {
      add("c0 the stub codex shadows any real one", "stub first on PATH, none without it", false, `real codex shadows the stub: ${found} / ${none}`);
      return out;
    }

    let repo = mkrepo();
    let r = run(repo, std(repo));
    const a = r.argv;
    add("c1 ok: exit 0, the report on stdout", "exit 0, stdout is the stub report plus a newline",
      r.status === 0 && r.stderr === "" && r.stdout === "important: 1  nits: 0  pre-existing: 0  skipped: 0\n- [correctness] src/a.py:10 - stub finding\n", `${r.status} ${JSON.stringify(r.stdout)} ${r.stderr}`);
    add("c1b argv has exec, the sandbox flags, -C and -o and ends with -", "read-only, ephemeral, color never",
      ["exec", "-s", "read-only", "--ephemeral", "--color", "never", "-C", "-o"].every((x) => a.includes(x)) && a[a.length - 1] === "-" && a[a.indexOf("-C") + 1] === repo, a.join(" "));
    add("c1c stdin holds the instructions without frontmatter, the handoff and the marker", "# Instructions ... # Handoff",
      r.stdin.startsWith("# Instructions\n\n") && r.stdin.includes(INSTR_BODY) && !r.stdin.includes("description: x") && r.stdin.includes("\n\n# Handoff\n\n") && r.stdin.includes(MARKER)
      && r.stdin.indexOf(INSTR_BODY) < r.stdin.indexOf("# Handoff"), r.stdin);
    add("c1d neither the prompt nor the instructions are in any argv", "no marker, no body", !a.some((x) => x.includes(MARKER) || x.includes(INSTR_BODY)), a.join(" "));
    add("c1e the repo is untouched afterwards", "git status empty", git(repo, "status", "--porcelain").stdout === "", git(repo, "status", "--porcelain").stdout);

    if (hasToml) {
      r = run(repo, ["--instructions", join(repo, "agent.toml"), "--prompt", join(repo, "handoff.md"), "--cwd", repo]);
      add("c2 a .toml gives its developer_instructions", "stdin holds the toml text", r.status === 0 && r.stdin.includes("TOML BODY LINE") && r.stdin.startsWith("# Instructions"), `${r.status} ${r.stdin} ${r.stdout}`);
      mkdirSync(join(repo, ".codex", "agents"), { recursive: true });
      writeFileSync(join(repo, ".codex", "agents", "rev.toml"), `developer_instructions = """\nAGENT DIR BODY\n"""\n`);
      r = run(repo, ["--agent", "rev", "--prompt", join(repo, "handoff.md"), "--cwd", repo]);
      add("c3 --agent resolves <cwd>/.codex/agents/NAME.toml", "stdin holds the agent text", r.status === 0 && r.stdin.includes("AGENT DIR BODY"), `${r.status} ${r.stdin} ${r.stdout}`);
      r = run(repo, ["--agent", "../x", "--prompt", join(repo, "handoff.md"), "--cwd", repo]);
      fails("c3b --agent ../x is a usage error", "exit 2, could-not-run: usage:", r, 2, "could-not-run: usage:");
    } else {
      console.log("warning: python3 has no tomllib, skipping the .toml and --agent cases");
    }

    // Consent
    for (const [label, answers] of [["answer no", '{"answers":{"codex":{"answer":"no"}}}'], ["no file", null], ["malformed file", "{nope"], ["answer missing", "{}"]]) {
      const q = mkrepo(answers);
      r = run(q, std(q));
      fails(`c4 not-opted-in with ${label}`, "exit 3 and codex exec never started", r, 3, "could-not-run: not-opted-in:", !r.argv.includes("exec"));
    }
    {
      const q = mkrepo(null);
      mkdirSync(join(q, "elsewhere"));
      writeFileSync(join(q, "elsewhere", "pro-dev.json"), '{"answers":{"codex":{"answer":"yes"}}}');
      mkdirSync(join(q, ".claude"));
      symlinkSync(join(q, "elsewhere", "pro-dev.json"), join(q, ".claude", "pro-dev.json"));
      r = run(q, std(q));
      fails("c4b a symlinked answers file is not opted in", "exit 3 not-opted-in", r, 3, "could-not-run: not-opted-in:", r.argv.length === 0);
      const q2 = mkrepo(null);
      mkdirSync(join(q2, "real-claude"));
      writeFileSync(join(q2, "real-claude", "pro-dev.json"), '{"answers":{"codex":{"answer":"yes"}}}');
      symlinkSync(join(q2, "real-claude"), join(q2, ".claude"));
      r = run(q2, std(q2));
      fails("c4c a symlinked .claude folder is not opted in", "exit 3 not-opted-in", r, 3, "could-not-run: not-opted-in:", r.argv.length === 0);
    }

    r = run(repo, std(repo), { path: PATH_NONE });
    fails("c5 not-installed", "exit 3, could-not-run: not-installed:", r, 3, "could-not-run: not-installed:");
    r = run(repo, std(repo), { env: { STUB_LOGIN: "1" } });
    fails("c6 not-logged-in", "exit 3 and no exec", r, 3, "could-not-run: not-logged-in:", !r.argv.includes("exec"));
    r = run(repo, [...std(repo), "--timeout", "1"], { env: { STUB_MODE: "sleep" } });
    fails("c7 timeout", "exit 4 within 10 seconds", r, 4, "could-not-run: timeout:", r.ms < 10000);
    r = run(repo, std(repo), { env: { STUB_MODE: "fail" } });
    fails("c8 a failing codex", "exit 4, exit-1, stderr holds boom", r, 4, "could-not-run: exit-1:", r.stderr.includes("boom"));
    r = run(repo, std(repo), { env: { STUB_MODE: "unicode" } });
    add("c9b a non-ASCII report is written as UTF-8", "exit 0, exact bytes", r.status === 0 && r.stdout === "important: 0  nits: 0  pre-existing: 0  skipped: 0\ncaf\u00e9 \u2014 \u65e5\u672c\n", `${r.status} ${JSON.stringify(r.stdout)} ${r.stderr}`);
    {
      // SIGTERM while the stub sleeps: exactly one could-not-run line, exit 4, no stray child left running.
      const log = join(sandbox, `sig${++n}`);
      const outFile = join(sandbox, `sigout${n}`);
      const quote = (x) => `'${x.replace(/'/g, "'\\''")}'`;
      const script = `${quote(python)} ${quote(RUNNER)} ${std(repo).map(quote).join(" ")} > ${quote(outFile)} & pid=$!
i=0; while [ ! -e ${quote(log + ".stdin")} ] && [ $i -lt 150 ]; do sleep 0.1; i=$((i+1)); done
kill -TERM $pid; wait $pid; echo $?`;
      const sr = spawnSync("/bin/sh", ["-c", script], { cwd: repo, encoding: "utf8", timeout: 30000, env: { ...baseEnv, PATH: PATH_STUB, STUB_LOG: log, STUB_MODE: "sleep" } });
      const code = Number((sr.stdout || "").trim());
      const so = existsSync(outFile) ? readFileSync(outFile, "utf8") : "";
      add("c9c SIGTERM gives one could-not-run: signal line and exit 4", "exit 4, one line",
        code === 4 && so.startsWith("could-not-run: signal:") && so.split("\n").filter(Boolean).length === 1, `${code} ${JSON.stringify(so)}`);
    }
    r = run(repo, std(repo), { env: { STUB_MODE: "empty" } });
    fails("c9 an empty report", "exit 4, empty-output", r, 4, "could-not-run: empty-output:");
    r = run(repo, ["--instructions", join(repo, "review.md"), "--prompt", join(repo, "missing.md"), "--cwd", repo]);
    fails("c10 a missing prompt file is a usage error", "exit 2", r, 2, "could-not-run: usage:");
    r = run(repo, [...std(repo), "--timeout", "0"]);
    fails("c10b --timeout 0 is a usage error", "exit 2", r, 2, "could-not-run: usage:");
    r = run(repo, ["--prompt", join(repo, "handoff.md"), "--cwd", repo]);
    fails("c10c no instructions is a usage error", "exit 2", r, 2, "could-not-run: usage:");

    r = run(repo, ["--check", "--cwd", repo]);
    add("c11 --check prints ready and starts no exec", "ready, exit 0", r.status === 0 && r.stdout === "ready\n" && !r.argv.includes("exec"), `${r.status} ${r.stdout}`);
    r = run(repo, ["--check", "--cwd", repo], { env: { STUB_LOGIN: "1" } });
    fails("c11b --check with no login", "exit 3", r, 3, "could-not-run: not-logged-in:");

    // A byte-identical copy in another layout works unchanged (AC3).
    const copy = join(sandbox, "elsewhere", "scripts", "codex-run.py");
    mkdirSync(dirname(copy), { recursive: true });
    if (existsSync(RUNNER)) copyFileSync(RUNNER, copy);
    const ra = run(repo, std(repo));
    r = run(repo, std(repo), { script: copy });
    add("c12 a copy elsewhere gives the same output", "same stdout, exit 0", r.status === 0 && r.stdout === ra.stdout && r.stdout.startsWith("important:"), `${r.status} ${r.stdout} ${r.stderr}`);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runCodexRunCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} codex-run cases passed`);
  process.exit(bad || !results.length ? 1 : 0);
}
