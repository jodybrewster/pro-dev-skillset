#!/usr/bin/env python3
"""PostToolUse hook for Write, Edit and MultiEdit - format and lint the edited file.

Runs the repo's own formatter on the one file just edited (Biome, then Prettier, then Ruff,
then gofmt or rustfmt) and its own linter (ESLint, then `ruff check`). It reports that the
file was reformatted, so the session reads it again before the next edit and the first 20
lint findings. The linter never gets --fix. There is no custom command setting.

Prettier and ESLint load their config as code (eslint.config.mjs, prettier.config.js, a
Prettier `plugins` entry) and a session that can edit a file can write that config. So they
are opt-in per repo: `python3 format-on-edit.py --allow [--root DIR]` adds the repo's real path
to format-on-edit.allow in CLAUDE_GUARD_DIR or ~/.claude/hooks (outside the repo, so an edit
cannot grant it) and `--disallow` removes it. Without the opt-in neither tool runs and the hook
adds a one-line note naming the command, at most once per repo per day. Even with the opt-in
they are skipped when the edited file is a tool config or package.json, or when any such
config in the file's folders up to the repo root is untracked or differs from HEAD. The
opt-in trusts the repo's node_modules (a modified module there cannot be told from an install).
Biome, Ruff, gofmt and rustfmt stay automatic: their configs are JSON or TOML and run no code.

Mode follows mode.format-on-edit, then mode, in CLAUDE_GUARD_DIR or ~/.claude/hooks
(default warn). Warn reports lint findings and exits 0. Enforce returns lint errors as
blocking feedback (exit 2). Formatting never blocks.

Safety: it reads only tool_input.file_path (and cwd). It acts on a regular file whose real
path is under the repo root's real path, with no symlink in the path, not under .git/ or
node_modules/ and not ignored by git. A tool runs only when it sits in the repo's untracked
node_modules/ or .venv/ or in an absolute PATH entry outside the repo and git does not track
it. It never downloads a tool (no npx, pnpm dlx, bunx, uvx or pipx) and runs argument lists
with no shell. Each tool gets 15 seconds. Any payload it cannot parse and any tool failure
exits 0. Makes no network calls.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time

HOOK = "format-on-edit"
TOOL_TIMEOUT = 15
MAX_FINDINGS = 20

JS_EXT = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"}
BIOME_EXT = JS_EXT | {".json", ".jsonc"}
PRETTIER_EXT = JS_EXT | {".json", ".jsonc", ".json5", ".css", ".scss", ".less", ".html", ".vue",
                         ".md", ".mdx", ".yaml", ".yml", ".graphql"}
PY_EXT = {".py", ".pyi"}
ALL_EXT = BIOME_EXT | PRETTIER_EXT | PY_EXT | {".go", ".rs"}

BIOME_CONFIGS = ("biome.json", "biome.jsonc")
PRETTIER_CONFIGS = (
    ".prettierrc", ".prettierrc.json", ".prettierrc.yml", ".prettierrc.yaml", ".prettierrc.json5",
    ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.mjs", ".prettierrc.toml",
    "prettier.config.js", "prettier.config.cjs", "prettier.config.mjs", "prettier.config.ts",
)
ESLINT_CONFIGS = (
    "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts",
    "eslint.config.mts", "eslint.config.cts", ".eslintrc", ".eslintrc.js", ".eslintrc.cjs",
    ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml",
)
RUFF_CONFIGS = ("ruff.toml", ".ruff.toml")

# ---------------------------------------------------------------------------
# Mode lookup and warn.log writer.
# Copied from plugins/pro-quality/scripts/floor-guard.py (guard_dir, mode, log). Plugins
# install separately and cannot import each other (ADR-0003), so keep the copies in step
# by hand.
# ---------------------------------------------------------------------------


def guard_dir() -> str:
    return os.environ.get("CLAUDE_GUARD_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "hooks")


def mode(hook: str) -> str:
    d = guard_dir()
    for name in ("mode." + hook, "mode"):
        try:
            with open(os.path.join(d, name), encoding="utf-8") as fh:
                value = fh.readline().strip()
        except OSError:
            continue
        return "enforce" if value == "enforce" else "warn"
    return "warn"


def log(hook: str, action: str, detail: str, cwd: str) -> None:
    detail = detail.replace("\n", " ").replace("\t", " ")
    if len(detail) > 300:
        detail = detail[:300] + "..."
    try:
        os.makedirs(guard_dir(), exist_ok=True)
        with open(os.path.join(guard_dir(), "warn.log"), "a", encoding="utf-8") as fh:
            fh.write("\t".join([time.strftime("%Y-%m-%dT%H:%M:%S%z"), hook, action, detail, cwd]) + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------------------


def under(path: str, base: str) -> bool:
    return path == base or path.startswith(base.rstrip(os.sep) + os.sep)


def find_root(start: str) -> str | None:
    """The repo root above `start`, found by walking up to a .git entry (no subprocess)."""
    d = os.path.realpath(start)
    while True:
        if os.path.exists(os.path.join(d, ".git")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def resolve_file(file_path: str, cwd: str, root: str) -> str | None:
    """The real path of a regular file inside root with no symlink on the way, else None."""
    lexical = os.path.normpath(file_path if os.path.isabs(file_path) else os.path.join(cwd, file_path))
    real = os.path.realpath(lexical)
    if not under(real, root) or real == root or not os.path.isfile(real):
        return None
    # A symlinked file or parent folder changes the path's tail when it resolves.
    rel = os.path.relpath(real, root).split(os.sep)
    if lexical.split(os.sep)[-len(rel):] != rel:
        return None
    if ".git" in rel or "node_modules" in rel:
        return None
    return real


def git_ok(root: str, *args: str) -> int | None:
    try:
        return subprocess.run(["git", "-C", root, *args], capture_output=True, timeout=TOOL_TIMEOUT).returncode
    except (OSError, subprocess.SubprocessError):
        return None


def tracked(root: str, path: str) -> bool:
    """True when git tracks `path` and also when that cannot be told (refuse)."""
    if not under(path, root):
        return False
    return git_ok(root, "ls-files", "--error-unmatch", "--", os.path.relpath(path, root)) != 1


def is_ignored(root: str, path: str) -> bool:
    return git_ok(root, "check-ignore", "-q", "--", path) != 1


def path_dirs() -> list[str]:
    return [p for p in os.environ.get("PATH", "").split(os.pathsep) if p and os.path.isabs(p)]


def find_tool(root: str, name: str, local_dir: str) -> str | None:
    """A runnable `name` from the repo's untracked local_dir, else an absolute PATH entry."""
    local_root = os.path.join(root, local_dir.split("/")[0])
    local = os.path.join(root, *local_dir.split("/"), name)
    cands = [(local, True)] + [(os.path.join(d, name), False) for d in path_dirs()]
    for cand, is_local in cands:
        if not (os.path.isfile(cand) and os.access(cand, os.X_OK)):
            continue
        real = os.path.realpath(cand)
        if is_local:
            if not under(real, local_root):
                continue
        elif under(real, root) and not under(real, os.path.join(root, "node_modules")) \
                and not under(real, os.path.join(root, ".venv")):
            continue
        if tracked(root, cand) or tracked(root, real):
            continue
        return cand
    return None


ALLOW_FILE = "format-on-edit.allow"
NOTED_FILE = "format-on-edit.noted"
CODE_CONFIG_PREFIXES = (".prettierrc", "prettier.config.", "eslint.config.", ".eslintrc")


def is_code_config(name: str) -> bool:
    """A Prettier or ESLint config by name prefix, so new extensions (.mts, .cts) are covered."""
    return name == "package.json" or name.startswith(CODE_CONFIG_PREFIXES)


def read_lines(name: str) -> list[str]:
    try:
        with open(os.path.join(guard_dir(), name), encoding="utf-8") as fh:
            return [ln.rstrip("\n") for ln in fh if ln.strip()]
    except OSError:
        return []


def write_lines(name: str, lines: list[str]) -> None:
    os.makedirs(guard_dir(), exist_ok=True)
    with open(os.path.join(guard_dir(), name), "w", encoding="utf-8") as fh:
        fh.write("".join(ln + "\n" for ln in lines))


def opted_in(root: str) -> bool:
    return root in read_lines(ALLOW_FILE)


def note_due(root: str) -> bool:
    """True once per repo per day; records the day. A write failure means no note."""
    today = time.strftime("%Y-%m-%d")
    rows = [ln for ln in read_lines(NOTED_FILE) if ln.split("\t")[0] != root]
    if root + "\t" + today in read_lines(NOTED_FILE):
        return False
    try:
        write_lines(NOTED_FILE, rows + [root + "\t" + today])
    except OSError:
        return False
    return True


def code_configs_clean(root: str, real: str) -> bool:
    """True when every Prettier or ESLint config and package.json from the file's folder up to
    the root is tracked and equal to HEAD. Anything git cannot tell counts as not clean."""
    d = os.path.dirname(real)
    while under(d, root):
        try:
            names = [n for n in os.listdir(d) if is_code_config(n)]
        except OSError:
            return False
        for name in names:
            cfg = os.path.join(d, name)
            rel = os.path.relpath(cfg, root)
            if git_ok(root, "ls-files", "--error-unmatch", "--", rel) != 0:
                return False
            if git_ok(root, "diff", "--quiet", "HEAD", "--", rel) != 0:
                return False
        if d == root:
            break
        d = os.path.dirname(d)
    return True


def has_file(root: str, names: tuple[str, ...]) -> bool:
    return any(os.path.isfile(os.path.join(root, n)) for n in names)


def package_json_has(root: str, key: str) -> bool:
    try:
        with open(os.path.join(root, "package.json"), encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return False
    return isinstance(data, dict) and key in data


def ruff_configured(root: str) -> bool:
    if has_file(root, RUFF_CONFIGS):
        return True
    try:
        with open(os.path.join(root, "pyproject.toml"), encoding="utf-8") as fh:
            return "[tool.ruff" in fh.read()
    except OSError:
        return False


def run(argv: list[str], root: str, cwd_log: str, what: str):
    env = dict(os.environ)
    env["PATH"] = os.pathsep.join(path_dirs())
    try:
        return subprocess.run(argv, cwd=root, env=env, capture_output=True, text=True,
                              timeout=TOOL_TIMEOUT, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        log(HOOK, "tool-timeout", what, cwd_log)
    except (OSError, ValueError, subprocess.SubprocessError) as e:
        log(HOOK, "tool-failed", what + " " + str(e), cwd_log)
    return None


def pick_formatter(root: str, ext: str, js_ok: bool, gated: list[str]):
    """(label, argv builder) for the first formatter that matches, else None."""
    if ext in BIOME_EXT and has_file(root, BIOME_CONFIGS):
        t = find_tool(root, "biome", "node_modules/.bin")
        if t:
            return "biome", [t, "format", "--write", "--"]
    if ext in PRETTIER_EXT and (has_file(root, PRETTIER_CONFIGS) or package_json_has(root, "prettier")):
        t = find_tool(root, "prettier", "node_modules/.bin")
        if t and js_ok:
            return "prettier", [t, "--write", "--"]
        if t:
            gated.append("Prettier")
    if ext in PY_EXT and ruff_configured(root):
        t = find_tool(root, "ruff", ".venv/bin")
        if t:
            return "ruff format", [t, "format", "--"]
    if ext == ".go":
        t = find_tool(root, "gofmt", ".venv/bin")
        if t:
            return "gofmt", [t, "-w"]
    if ext == ".rs":
        t = find_tool(root, "rustfmt", ".venv/bin")
        if t:
            return "rustfmt", [t]
    return None


def pick_linter(root: str, ext: str, js_ok: bool, gated: list[str]):
    if ext in JS_EXT and (has_file(root, ESLINT_CONFIGS) or package_json_has(root, "eslintConfig")):
        t = find_tool(root, "eslint", "node_modules/.bin")
        if t and js_ok:
            return "eslint", [t, "-f", "json", "--"]
        if t:
            gated.append("ESLint")
    if ext in PY_EXT and ruff_configured(root):
        t = find_tool(root, "ruff", ".venv/bin")
        if t:
            return "ruff check", [t, "check", "--no-fix", "--output-format", "concise", "--"]
    return None


def findings(label: str, proc) -> list[str]:
    out = (proc.stdout or "").strip()
    if label == "eslint":
        try:
            lines = []
            for f in json.loads(out):
                for m in f.get("messages", []):
                    sev = "error" if m.get("severity") == 2 else "warning"
                    rule = m.get("ruleId") or ""
                    lines.append("%s:%s:%s %s %s %s" % (os.path.basename(f.get("filePath", "")),
                                 m.get("line", 0), m.get("column", 0), sev, m.get("message", ""), rule))
            return lines
        except (ValueError, AttributeError, TypeError):
            pass
    text = out or (proc.stderr or "").strip()
    return [ln for ln in text.splitlines() if ln.strip()]


def cli(argv: list[str]) -> int:
    """--allow or --disallow [--root DIR]: add or remove a repo in the opt-in file."""
    try:
        start = argv[argv.index("--root") + 1] if "--root" in argv else os.getcwd()
    except IndexError:
        sys.stderr.write("--root needs a folder\n")
        return 2
    root = find_root(start)
    if not root:
        sys.stderr.write("no git repo at " + start + "\n")
        return 1
    if argv[0] == "--allow" and not sys.stdin.isatty():
        sys.stderr.write("--allow must be run by the person in a terminal (for example with the ! prefix), "
                         "not by a session. Nothing was written.\n")
        return 1
    rows = [ln for ln in read_lines(ALLOW_FILE) if ln != root]
    if argv[0] == "--allow":
        rows.append(root)
    try:
        write_lines(ALLOW_FILE, rows)
    except OSError as e:
        sys.stderr.write("cannot write %s: %s\n" % (ALLOW_FILE, e))
        return 1
    print("%s %s %s" % (HOOK, "allows Prettier and ESLint in" if argv[0] == "--allow" else "no longer runs Prettier or ESLint in", root))
    return 0


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] in ("--allow", "--disallow"):
        return cli(sys.argv[1:])
    try:
        payload = json.load(sys.stdin)
        tool_input = payload.get("tool_input") if isinstance(payload, dict) else None
        file_path = tool_input.get("file_path") if isinstance(tool_input, dict) else None
        cwd = payload.get("cwd") if isinstance(payload.get("cwd"), str) and payload.get("cwd") else os.getcwd()
    except (ValueError, AttributeError, OSError):
        return 0
    if not isinstance(file_path, str) or not file_path:
        return 0
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in ALL_EXT:
        return 0
    try:
        root = find_root(cwd)
        if not root:
            return 0
        real = resolve_file(file_path, cwd, root)
        if not real:
            return 0
        # Prettier and ESLint run repo config as code: opt-in and never on a config edit.
        opted = opted_in(root)
        is_cfg = is_code_config(os.path.basename(real)) or os.path.basename(real) in BIOME_CONFIGS
        js_ok = opted and not is_cfg and code_configs_clean(root, real)
        gated: list[str] = []
        formatter = pick_formatter(root, ext, js_ok, gated)
        linter = pick_linter(root, ext, js_ok, gated)
        if is_ignored(root, real):
            return 0
        rel = os.path.relpath(real, root)
        notes: list[str] = []
        if gated and not opted and not is_cfg and note_due(root):
            notes.append("%s skipped: a repo's config is code the tool runs, so it is off until you opt in. "
                         "Pass this command to the person to run in a terminal (the ! prefix works) and never run it yourself: "
                         "python3 %s --allow --root %s" % (" and ".join(sorted(set(gated))),
                                                         os.path.abspath(__file__), root))
        if not formatter and not linter and not notes:
            return 0
        if formatter:
            label, argv = formatter
            try:
                before = open(real, "rb").read()
            except OSError:
                before = None
            proc = run(argv + [real], root, cwd, label)
            if proc is not None and proc.returncode != 0:
                log(HOOK, "format-failed", "%s exit %s on %s" % (label, proc.returncode, rel), cwd)
            elif proc is not None:
                try:
                    changed = before is not None and open(real, "rb").read() != before
                except OSError:
                    changed = False
                if changed:
                    notes.append("%s reformatted %s. Read the file again before the next edit." % (label, rel))
        found: list[str] = []
        is_error = False
        if linter:
            label, argv = linter
            proc = run(argv + [real], root, cwd, label)
            if proc is not None and proc.returncode in (0, 1):
                found = findings(label, proc)
                is_error = proc.returncode == 1 and bool(found)
            elif proc is not None:
                log(HOOK, "lint-failed", "%s exit %s on %s" % (label, proc.returncode, rel), cwd)
            if found:
                head = "%s found %d issue%s in %s" % (label, len(found), "" if len(found) == 1 else "s", rel)
                if len(found) > MAX_FINDINGS:
                    head += " (first %d shown)" % MAX_FINDINGS
                notes.append(head + ":\n" + "\n".join(found[:MAX_FINDINGS]))
        if not notes:
            return 0
        text = "format-on-edit: " + "\n".join(notes)
        if is_error and mode(HOOK) == "enforce":
            log(HOOK, "block", "lint errors in " + rel, cwd)
            sys.stderr.write(text + "\nFix the lint errors in this file.\n")
            return 2
        if found:
            log(HOOK, "flag", "lint findings in " + rel, cwd)
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": text}}))
        return 0
    except Exception as e:  # a hook never crashes the turn
        log(HOOK, "error", repr(e), cwd)
        return 0


if __name__ == "__main__":
    sys.exit(main())
