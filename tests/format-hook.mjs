#!/usr/bin/env node
// Behaviour test for pro-quality's format-on-edit.py (intent/2026-11-01-after-build-loop,
// R15 to R22, N3 and AC4). Every case drives the script as a subprocess in a throwaway git
// repo under the OS temp dir. Formatters and linters are stub scripts in the repo's untracked
// node_modules/.bin/ that record their argv; an npx stub on PATH fails the run if it is called.
//
//   node tests/format-hook.mjs
//
// Also exported as runFormatHookCases() for tests/check.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync, chmodSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = join(ROOT, "plugins", "pro-quality", "scripts", "format-on-edit.py");

// Appends a line to the last argument (the file) and records its argv.
const FORMATTER = `#!/bin/sh
printf '%s\\n' "$@" >> "$STUB_REC"
for a; do f="$a"; done
echo "// formatted" >> "$f"
`;
// Prints one ESLint error as JSON for the last argument and exits 1, like ESLint with errors.
const ESLINT = `#!/bin/sh
printf '%s\\n' "$@" >> "$STUB_REC"
for a; do f="$a"; done
printf '[{"filePath":"%s","messages":[{"ruleId":"no-unused-vars","severity":2,"message":"x is unused","line":1,"column":7}]}]' "$f"
exit 1
`;
const NPX = `#!/bin/sh
echo called >> "$STUB_NPX"
exit 1
`;

function sh(cwd, cmd, ...args) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" } });
}

function write(root, rel, text, exec = false) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  if (exec) chmodSync(p, 0o755);
}

export function runFormatHookCases() {
  const results = [];
  const add = (id, expect, ok, reason = "") => results.push({ id, expect, ok: !!ok, reason: ok ? "" : String(reason).slice(0, 400) });
  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "format-hook-")));
  const npxDir = join(sandbox, "npxbin");
  write(sandbox, "npxbin/npx", NPX, true);
  for (const n of ["pnpm", "bunx", "uvx", "pipx"]) write(sandbox, `npxbin/${n}`, NPX, true);
  const npxFlag = join(sandbox, "npx-called");

  // A repo with a Prettier config, a Prettier stub and an ESLint stub, node_modules ignored.
  const mkrepo = (name, { eslint = true, prettier = true, configs = true } = {}) => {
    const repo = join(sandbox, name);
    mkdirSync(repo, { recursive: true });
    sh(repo, "git", "init", "-q");
    write(repo, ".gitignore", "node_modules/\nignored.ts\n");
    write(repo, "a.ts", "const x = 1\n");
    write(repo, "src/b.ts", "const y = 2\n");
    write(repo, "ignored.ts", "const z = 3\n");
    write(repo, "notes.txt", "hello\n");
    if (configs) {
      write(repo, "package.json", JSON.stringify({ name: "t", prettier: {} }));
      write(repo, "eslint.config.js", "export default [];\n");
    }
    if (prettier) write(repo, "node_modules/.bin/prettier", FORMATTER, true);
    if (eslint) write(repo, "node_modules/.bin/eslint", ESLINT, true);
    sh(repo, "git", "add", "-A");
    sh(repo, "git", "commit", "-qm", "init");
    return repo;
  };

  // guard: a CLAUDE_GUARD_DIR with an optional mode file. Returns {status, stdout, stderr, rec, log}.
  const hook = (repo, payload, { guard = "warn", pathExtra = "", raw, allow = true, gdir: gdirIn } = {}) => {
    const gdir = gdirIn ?? join(repo, "..", `guard-${guard}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(gdir, { recursive: true });
    // The opt-in lives in the guard dir, outside the repo; most cases run opted in.
    if (allow) writeFileSync(join(gdir, "format-on-edit.allow"), realpathSync(repo) + "\n");
    if (guard === "enforce") writeFileSync(join(gdir, "mode.format-on-edit"), "enforce\n");
    const rec = join(repo, "..", `rec-${Math.random().toString(36).slice(2)}`);
    const env = { ...process.env, HOME: join(sandbox, "home"), CLAUDE_GUARD_DIR: gdir, STUB_REC: rec, STUB_NPX: npxFlag,
      PYTHONDONTWRITEBYTECODE: "1", PATH: [npxDir, pathExtra, process.env.PATH].filter(Boolean).join(":") };
    const r = spawnSync("python3", [HOOK], { input: raw ?? JSON.stringify(payload), encoding: "utf8", env, cwd: repo, timeout: 60000 });
    const logPath = join(gdir, "warn.log");
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, rec: existsSync(rec) ? readFileSync(rec, "utf8") : "", log: existsSync(logPath) ? readFileSync(logPath, "utf8") : "" };
  };
  const edit = (repo, file) => ({ tool_name: "Edit", tool_input: { file_path: file }, cwd: repo });
  const ctx = (r) => { try { return JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch { return ""; } };

  try {
    // Formats a .ts file with Prettier and reports lint findings from ESLint (AC4).
    {
      const repo = mkrepo("main");
      const file = join(repo, "a.ts");
      const r = hook(repo, edit(repo, file));
      const lines = r.rec.split("\n");
      add("prettier/formats the file", "file rewritten by the stub", readFileSync(file, "utf8").includes("// formatted"), r.stderr);
      add("prettier/argv", "--write, then --, then the absolute path", lines.includes("--write") && lines.indexOf("--") > lines.indexOf("--write") && lines.includes(file), r.rec);
      add("prettier/reports a reread", "context says reformatted and read again", /prettier reformatted a\.ts/.test(ctx(r)) && /Read the file again/.test(ctx(r)), r.stdout);
      add("eslint/reports findings in warn", "exit 0 and the finding in context", r.status === 0 && /x is unused/.test(ctx(r)) && /no-unused-vars/.test(ctx(r)), r.stdout + r.stderr);
      add("eslint/never gets --fix", "no --fix in any argv", !r.rec.includes("--fix"), r.rec);
      add("warn/logs the flag", "warn.log has format-on-edit flag", /format-on-edit\tflag/.test(r.log), r.log);
    }
    // A relative file_path resolves against the payload cwd.
    {
      const repo = mkrepo("relative");
      const r = hook(repo, { tool_input: { file_path: "src/b.ts" }, cwd: repo });
      add("path/relative resolves against cwd", "src/b.ts formatted", readFileSync(join(repo, "src/b.ts"), "utf8").includes("// formatted"), r.stderr + r.stdout);
    }
    // Enforce: lint errors block with exit 2; formatting alone never blocks.
    {
      const repo = mkrepo("enforce");
      const r = hook(repo, edit(repo, join(repo, "a.ts")), { guard: "enforce" });
      add("enforce/lint errors block", "exit 2 with the finding on stderr", r.status === 2 && /x is unused/.test(r.stderr), `${r.status} ${r.stderr}`);
      const f = mkrepo("enforce-format", { eslint: false });
      const rf = hook(f, edit(f, join(f, "a.ts")), { guard: "enforce" });
      add("enforce/formatting never blocks", "exit 0 and the file formatted", rf.status === 0 && readFileSync(join(f, "a.ts"), "utf8").includes("// formatted"), `${rf.status} ${rf.stderr}`);
    }
    // No formatter config: nothing runs and nothing is recorded (N3 fast path).
    {
      const repo = mkrepo("noconfig", { configs: false });
      const r = hook(repo, edit(repo, join(repo, "a.ts")));
      add("noconfig/no tool runs", "exit 0, no argv recorded, no output", r.status === 0 && r.rec === "" && r.stdout === "", r.rec + r.stdout);
      const m = mkrepo("txt");
      const rt = hook(m, edit(m, join(m, "notes.txt")));
      add("noconfig/unknown extension is skipped", "exit 0, no argv recorded", rt.status === 0 && rt.rec === "", rt.rec);
    }
    // Paths the hook must not touch.
    {
      const repo = mkrepo("paths");
      const outside = join(sandbox, "outside");
      mkdirSync(outside, { recursive: true });
      write(outside, "o.ts", "const o = 1\n");
      const skip = (id, file, payloadExtra = {}) => {
        const r = hook(repo, { tool_input: { file_path: file }, cwd: repo, ...payloadExtra });
        add(id, "exit 0, no tool run", r.status === 0 && r.rec === "" && r.stdout === "", `${r.status} ${r.rec} ${r.stdout}`);
      };
      skip("skip/file outside the repo", join(outside, "o.ts"));
      skip("skip/ignored file", join(repo, "ignored.ts"));
      skip("skip/file under .git", join(repo, ".git", "x.ts"));
      write(repo, "node_modules/pkg/index.ts", "const p = 1\n");
      skip("skip/file under node_modules", join(repo, "node_modules", "pkg", "index.ts"));
      symlinkSync(join(repo, "a.ts"), join(repo, "link.ts"));
      skip("skip/symlinked file", join(repo, "link.ts"));
      symlinkSync(outside, join(repo, "linked"));
      skip("skip/symlinked parent folder to outside", join(repo, "linked", "o.ts"));
      symlinkSync(join(repo, "src"), join(repo, "alias"));
      skip("skip/symlinked parent folder inside the repo", join(repo, "alias", "b.ts"));
      skip("skip/missing file", join(repo, "nope.ts"));
      add("skip/outside file untouched", "o.ts unchanged", readFileSync(join(outside, "o.ts"), "utf8") === "const o = 1\n");
    }
    // A tool path git tracks is refused (stub committed to a stranger's repo).
    {
      const repo = mkrepo("tracked", { eslint: false });
      sh(repo, "git", "add", "-f", "node_modules/.bin/prettier");
      sh(repo, "git", "commit", "-qm", "track the stub");
      const r = hook(repo, edit(repo, join(repo, "a.ts")));
      add("tool/tracked stub is refused", "exit 0, stub never ran", r.status === 0 && r.rec === "" && !readFileSync(join(repo, "a.ts"), "utf8").includes("// formatted"), r.rec + r.stderr);
    }
    // A tool on a relative PATH entry is dropped; one outside node_modules is not found.
    {
      const repo = mkrepo("relpath", { prettier: false, eslint: false });
      write(repo, "bin/prettier", FORMATTER, true);
      const r = hook(repo, edit(repo, join(repo, "a.ts")), { pathExtra: "./bin:bin" });
      add("tool/relative PATH entry is dropped", "exit 0, stub never ran", r.status === 0 && r.rec === "", r.rec);
      const abs = mkrepo("abspath", { prettier: false, eslint: false });
      write(sandbox, "tools/prettier", FORMATTER, true);
      const ra = hook(abs, edit(abs, join(abs, "a.ts")), { pathExtra: join(sandbox, "tools") });
      add("tool/absolute PATH entry outside the repo is used", "stub ran", ra.rec.includes("--write"), ra.rec + ra.stderr);
    }
    // A node_modules that links out of the repo is not trusted.
    {
      const repo = mkrepo("nmlink", { prettier: false, eslint: false });
      write(sandbox, "elsewhere/.bin/prettier", FORMATTER, true);
      symlinkSync(join(sandbox, "elsewhere"), join(repo, "node_modules"));
      const r = hook(repo, edit(repo, join(repo, "a.ts")));
      add("tool/node_modules linking outside is refused", "exit 0, stub never ran", r.status === 0 && r.rec === "", r.rec);
    }
    // A Format block in CLAUDE.md is ignored: the marker command never runs.
    {
      const repo = mkrepo("formatblock", { prettier: false, eslint: false });
      const marker = join(sandbox, "format-block-ran");
      write(repo, "CLAUDE.md", `## Format\n\n    format: {"*.ts": "sh -c 'touch ${marker}'"}\n`);
      write(repo, "AGENTS.md", `format: {"*.ts": "touch ${marker}"}\n`);
      const r = hook(repo, edit(repo, join(repo, "a.ts")));
      add("format block/is ignored", "exit 0 and the marker never created", r.status === 0 && !existsSync(marker) && r.rec === "", r.stderr);
    }
    // Broken payloads exit 0.
    {
      const repo = mkrepo("broken");
      for (const [id, raw] of [["not json", "{nope"], ["empty", ""], ["array", "[]"], ["no file_path", "{\"tool_input\":{}}"],
        ["file_path not a string", "{\"tool_input\":{\"file_path\":7}}"], ["tool_input a string", "{\"tool_input\":\"x\"}"], ["null", "null"]]) {
        const r = hook(repo, null, { raw });
        add(`payload/${id}`, "exit 0, no output", r.status === 0 && r.stdout === "" && r.rec === "", `${r.status} ${r.stderr}`);
      }
    }
    // Prettier and ESLint are opt-in per repo, kept outside the repo; Biome and Ruff are not.
    {
      const repo = mkrepo("unopted");
      const file = join(repo, "a.ts");
      const gdir = join(sandbox, "guard-unopted");
      const r = hook(repo, edit(repo, file), { allow: false, gdir });
      add("optin/un-opted repo runs neither prettier nor eslint", "no argv, file unchanged", r.status === 0 && r.rec === "" && !readFileSync(file, "utf8").includes("// formatted"), r.rec);
      add("optin/un-opted repo gets a note naming the command", "context has --allow", /--allow/.test(ctx(r)) && /Prettier/.test(ctx(r)), r.stdout);
      const r2 = hook(repo, edit(repo, file), { allow: false, gdir });
      add("optin/the note comes once a day", "second run is silent", r2.stdout === "" && r2.rec === "", r2.stdout);

      const cli = (args, g) => spawnSync("python3", [HOOK, ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, CLAUDE_GUARD_DIR: g, PYTHONDONTWRITEBYTECODE: "1" } });
      const g2 = join(sandbox, "guard-cli");
      const allowFile = join(g2, "format-on-edit.allow");
      const a = cli(["--allow", "--root", join(repo, "src")], g2);
      add("optin/--allow refuses without a terminal", "exit 1, nothing written", a.status === 1 && /terminal/.test(a.stderr) && !existsSync(allowFile), `${a.status} ${a.stderr}`);
      mkdirSync(g2, { recursive: true });
      writeFileSync(allowFile, repo + "\n");
      const rr = hook(repo, edit(repo, file), { allow: false, gdir: g2 });
      add("optin/with the allow line prettier runs", "stub ran", rr.rec.includes("--write"), rr.rec + rr.stderr);
      const d = cli(["--disallow"], g2);
      add("optin/--disallow removes the line", "file empty", d.status === 0 && readFileSync(allowFile, "utf8") === "", d.stderr);
      add("optin/the note tells the model to pass the command to the person", "never run it", /never run it/.test(ctx(r)), ctx(r));
    }
    // Prettier 3.5+ TypeScript configs are code too: matched by name prefix.
    {
      const repo = mkrepo("ts-cfg", { configs: false });
      write(repo, ".prettierrc.json", "{}\n");
      sh(repo, "git", "add", "-A");
      sh(repo, "git", "commit", "-qm", "cfg");
      write(repo, "sub/.prettierrc.mts", "import { execSync } from 'node:child_process'; execSync('touch pwned');\n");
      write(repo, "sub/c.ts", "const c = 1\n");
      const r = hook(repo, edit(repo, join(repo, "sub/c.ts")));
      add("cfg/untracked sub/.prettierrc.mts does not let prettier run", "no argv, no pwned", r.rec === "" && !existsSync(join(repo, "pwned")), r.rec + r.stdout);
      const r2 = hook(repo, edit(repo, join(repo, "sub/.prettierrc.mts")));
      add("cfg/editing .prettierrc.mts itself runs nothing", "no argv", r2.rec === "", r2.rec);
    }
    // Opted in, a config the session wrote or changed does not run.
    {
      const repo = mkrepo("untracked-cfg", { configs: false });
      write(repo, "package.json", JSON.stringify({ name: "t", prettier: {} }));
      sh(repo, "git", "add", "-A");
      sh(repo, "git", "commit", "-qm", "pkg");
      write(repo, "eslint.config.mjs", "import { execSync } from 'node:child_process'; execSync('touch pwned');\n");
      const r = hook(repo, edit(repo, join(repo, "eslint.config.mjs")));
      add("cfg/untracked eslint.config.mjs written by the session does not run", "no argv, no output", r.status === 0 && r.rec === "" && !existsSync(join(repo, "pwned")), r.rec + r.stdout);
      const r2 = hook(repo, edit(repo, join(repo, "a.ts")));
      add("cfg/untracked config blocks the stub for another file", "no argv", r2.rec === "", r2.rec);
      const m = mkrepo("modified-cfg");
      write(m, "eslint.config.js", "export default [{}];\n");
      const rm = hook(m, edit(m, join(m, "a.ts")));
      add("cfg/modified tracked config does not run", "no argv", rm.rec === "", rm.rec);
      const staged = mkrepo("staged-cfg");
      write(staged, "package.json", JSON.stringify({ name: "t", prettier: { x: 1 } }));
      sh(staged, "git", "add", "package.json");
      const rs = hook(staged, edit(staged, join(staged, "a.ts")));
      add("cfg/staged package.json change does not run", "no argv", rs.rec === "", rs.rec);
      const e = mkrepo("edit-cfg");
      const re = hook(e, edit(e, join(e, "eslint.config.js")));
      add("cfg/editing the config file itself does not run", "no argv", re.rec === "", re.rec);
      const ep = hook(e, edit(e, join(e, "package.json")));
      add("cfg/editing package.json does not run", "no argv", ep.rec === "", ep.rec);
      const n = mkrepo("nested-cfg");
      write(n, "src/.prettierrc.js", "module.exports = {};\n");
      const rn = hook(n, edit(n, join(n, "src", "b.ts")));
      add("cfg/untracked nested prettier config does not run", "no argv", rn.rec === "", rn.rec);
    }
    // Ruff and Biome stay automatic without the opt-in.
    {
      const repo = mkrepo("ruff-biome", { configs: false, prettier: false, eslint: false });
      write(repo, "ruff.toml", "");
      write(repo, "m.py", "x=1\n");
      write(repo, "biome.json", "{}");
      write(repo, ".gitignore", "node_modules/\n.venv/\n");
      write(repo, ".venv/bin/ruff", FORMATTER, true);
      write(repo, "node_modules/.bin/biome", FORMATTER, true);
      sh(repo, "git", "add", "-A");
      sh(repo, "git", "commit", "-qm", "cfg");
      const rp = hook(repo, edit(repo, join(repo, "m.py")), { allow: false });
      add("optin/ruff runs without the opt-in", "stub ran", rp.rec.includes("format"), rp.rec + rp.stderr);
      const rb = hook(repo, edit(repo, join(repo, "a.ts")), { allow: false });
      add("optin/biome runs without the opt-in", "stub ran", rb.rec.includes("format"), rb.rec + rb.stderr);
    }
    // No case may ever call npx or its siblings.
    add("never/npx pnpm bunx uvx pipx called", "flag file absent", !existsSync(npxFlag));
  } finally {
    try { rmSync(sandbox, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  return { skipped: null, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { skipped, results } = runFormatHookCases();
  if (skipped) { console.log(`skipped: ${skipped}`); process.exit(0); }
  let bad = 0;
  for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.id}: expected ${r.expect} - ${r.reason}`); } }
  console.log(`${results.length - bad}/${results.length} format hook cases passed`);
  process.exit(bad ? 1 : 0);
}
