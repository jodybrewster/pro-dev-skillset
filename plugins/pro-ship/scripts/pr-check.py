#!/usr/bin/env python3
"""pr-check - the deterministic half of /pro-ship:pr-check.

Subcommands (all print JSON, none edits a tracked file except the mutation step, which
restores it before it returns):
  discover                         the build, lint, typecheck and test commands for this repo
  run [--step NAME] [--base REF] [--tier TIER]
                                   run one step (or all), merge the record into
                                   .pro-dev/ship/run.json keyed by HEAD. NAME is a discovered
                                   step, `floor` or `mutation`.
  find PLUGIN FILE                 print the path of a sibling plugin's script, or not-installed.
                                   FILE with a `/` is a path inside the plugin (for example
                                   .codex-plugin/agents/code-reviewer.toml); an absolute path, a
                                   `..` part or a backslash prints not-installed.
  codex-trigger --tier TIER [--base REF]
                                   print {run, setting, reason}: whether the Codex second review
                                   runs, from the `codex-review:` line of REVIEW.md as the base
                                   branch has it, never the working tree (ADR-0018)
  agree --code FILE --codex FILE   pair the findings of two review reports by file and nearby
                                   lines; prints each side's findings and the agreed, disputed,
                                   code_only and codex_only lists. No model takes part.
  stamp [--base REF] [--tier TIER] [--risk FILE] [--reviewers JSON] [--accept-mutation]
                                   write .pro-dev/ship/pr-check.json from run.json and the
                                   reviewer records. The contract is docs/pr-check-stamp.md.
                                   --risk reads the classifier JSON: it sets `tier` and the
                                   `risk` field; an unreadable file gives tier high, never low.
  marker                           print the one-line PR body marker from the stamp, for
                                   /ship to find later: <!-- pro-ship:pr-check head=<sha>
                                   result=<result> tier=<tier> -->. Exit 1 when there is no stamp.

Python 3 standard library only. No network calls. It runs the commands the repo names in its
own CLAUDE.md, AGENTS.md, package.json or Makefile, which is the same trust as running the
repo's tests by hand.
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
import signal
import subprocess
import sys
from datetime import datetime

DEFAULT_TIMEOUT = 300
STANDARD = ("build", "lint", "typecheck", "test")
TAIL = 20
REDACT = [
    re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"sk-ant-[A-Za-z0-9_\-]+"),
    re.compile(r"\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_\-]+"),
    re.compile(r"\bsk-[A-Za-z0-9]{32,}"),
    re.compile(r"\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}"),
    re.compile(r"\bnpm_[A-Za-z0-9]{20,}"),
    re.compile(r"\bglpat-[A-Za-z0-9_\-]{16,}"),
    re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{12,}"),
    re.compile(r"\bxox[a-z]-[A-Za-z0-9\-]+"),
    re.compile(r"\bxapp-[A-Za-z0-9\-]+"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
]
# Same patterns as plugins/pro-quality/scripts/floor-guard.py (TEST_DIRS, TEST_NAMES). Plugins
# cannot import each other (ADR-0003), so keep the two in step by hand.
TEST_DIRS = {"tests", "test", "__tests__"}
TEST_NAMES = ("*.test.*", "*.spec.*", "*_test.*", "test_*.py")


class Refuse(Exception):
    """A refusal the person should read; exits 1 with the message on stderr."""


# ---------------------------------------------------------------------------
# git helpers
# ---------------------------------------------------------------------------

def sh(args: list[str], cwd: str, timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def repo_root(cwd: str | None = None) -> str:
    cwd = cwd or os.getcwd()
    try:
        r = sh(["git", "rev-parse", "--show-toplevel"], cwd)
        if r.returncode == 0 and r.stdout.strip():
            return os.path.realpath(r.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.realpath(cwd)


def rev(root: str, ref: str) -> str | None:
    try:
        r = sh(["git", "rev-parse", "--verify", "-q", ref + "^{commit}"], root)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None


def dirty_tracked(root: str) -> list[str]:
    r = sh(["git", "status", "--porcelain", "--untracked-files=no"], root)
    return [ln[3:] for ln in r.stdout.splitlines() if ln.strip()]


def require_clean(root: str) -> None:
    files = dirty_tracked(root)
    if files:
        shown = ", ".join(files[:5]) + (" and more" if len(files) > 5 else "")
        raise Refuse(f"pr-check: tracked files have uncommitted changes ({shown}). Commit or discard them first, because the result is bound to a commit.")


def merge_base(root: str, ref: str) -> str | None:
    """The merge base of REF and HEAD, so a base given as origin/main matches the reviewer range."""
    tip = rev(root, ref)
    if not tip:
        return None
    r = sh(["git", "merge-base", tip, "HEAD"], root)
    mb = r.stdout.strip()
    return mb if r.returncode == 0 and mb else tip


def default_base(root: str) -> str | None:
    """Merge base of HEAD with the default branch; None when there is none or HEAD is on it."""
    head = rev(root, "HEAD")
    for cand in ("origin/HEAD", "origin/main", "main", "origin/master", "master"):
        if not rev(root, cand):
            continue
        r = sh(["git", "merge-base", "HEAD", cand], root)
        mb = r.stdout.strip()
        if r.returncode == 0 and mb and mb != head:
            return mb
    return None


def ensure_excluded(root: str) -> None:
    """R15: keep .pro-dev/ out of the tree through the repo's local exclude file."""
    probe = sh(["git", "check-ignore", "-q", ".pro-dev/ship/x"], root)
    if probe.returncode == 0:
        return
    r = sh(["git", "rev-parse", "--git-path", "info/exclude"], root)
    path = r.stdout.strip()
    if not path:
        return
    if not os.path.isabs(path):
        path = os.path.join(root, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        existing = open(path, encoding="utf-8").read()
    except OSError:
        existing = ""
    if ".pro-dev/" not in existing.splitlines():
        with open(path, "a", encoding="utf-8") as f:
            f.write(("" if not existing or existing.endswith("\n") else "\n") + ".pro-dev/\n")


def ship_dir(root: str) -> str:
    d = os.path.join(root, ".pro-dev", "ship")
    os.makedirs(d, exist_ok=True)
    ensure_excluded(root)
    return d


# ---------------------------------------------------------------------------
# discover (R3)
# ---------------------------------------------------------------------------

def read(path: str) -> str:
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def agent_files(root: str) -> list[str]:
    return [t for t in (read(os.path.join(root, n)) for n in ("CLAUDE.md", "AGENTS.md")) if t]


def timeout_for(root: str) -> int:
    for text in agent_files(root):
        m = re.search(r"^\s*pr-check timeout:\s*(\d+)\s*$", text, re.M | re.I)
        if m and int(m.group(1)) > 0:
            return int(m.group(1))
    return DEFAULT_TIMEOUT


def verify_block(root: str) -> list[str] | None:
    """The first fenced bash block under a heading that starts with "Verif"."""
    for text in agent_files(root):
        in_section = False
        lines = text.splitlines()
        i = 0
        while i < len(lines):
            ln = lines[i]
            if re.match(r"^#{1,6}\s", ln):
                in_section = bool(re.match(r"^#{1,6}\s+verif", ln, re.I))
            elif in_section and re.match(r"^```\s*bash\s*$", ln):
                body = []
                i += 1
                while i < len(lines) and not lines[i].startswith("```"):
                    body.append(lines[i])
                    i += 1
                joined, cur = [], ""
                for b in body:
                    t = b.rstrip()
                    if t.endswith("\\") and (len(t) - len(t.rstrip("\\"))) % 2 == 1:
                        cur += t[:-1].strip() + " "
                        continue
                    joined.append((cur + b.strip()).strip() if cur else b)
                    cur = ""
                if cur.strip():
                    joined.append(cur.strip())
                cmds = [b.strip() for b in joined if b.strip() and not b.strip().startswith("#")]
                if cmds:
                    return cmds
            i += 1
    return None


def package_manager(root: str) -> str:
    if os.path.exists(os.path.join(root, "pnpm-lock.yaml")):
        return "pnpm"
    if os.path.exists(os.path.join(root, "bun.lock")) or os.path.exists(os.path.join(root, "bun.lockb")):
        return "bun"
    if os.path.exists(os.path.join(root, "yarn.lock")):
        return "yarn"
    return "npm"


def from_package_json(root: str) -> dict[str, str]:
    path = os.path.join(root, "package.json")
    if not os.path.exists(path):
        return {}
    try:
        data = json.loads(read(path))
        scripts = data.get("scripts") or {}
    except (ValueError, AttributeError):
        return {}
    pm = package_manager(root)
    found = {s: f"{pm} run {s}" for s in STANDARD if isinstance(scripts, dict) and s in scripts}
    if "typecheck" not in found and os.path.exists(os.path.join(root, "tsconfig.json")):
        found["typecheck"] = {"pnpm": "pnpm exec tsc --noEmit", "bun": "bunx tsc --noEmit",
                              "yarn": "yarn exec tsc --noEmit", "npm": "npx tsc --noEmit"}[pm]
    return found


def from_python(root: str) -> dict[str, str]:
    pyproject = read(os.path.join(root, "pyproject.toml"))
    has = lambda n: os.path.exists(os.path.join(root, n))
    if not pyproject and not any(has(n) for n in ("ruff.toml", ".ruff.toml", "mypy.ini", "pyrightconfig.json", "pytest.ini", "setup.cfg")):
        return {}
    found = {}
    if "[tool.ruff" in pyproject or has("ruff.toml") or has(".ruff.toml"):
        found["lint"] = "ruff check"
    if "[tool.mypy" in pyproject or has("mypy.ini"):
        found["typecheck"] = "mypy ."
    elif "[tool.pyright" in pyproject or has("pyrightconfig.json"):
        found["typecheck"] = "pyright"
    has_tests = any(os.path.isdir(os.path.join(root, d)) for d in ("tests", "test")) or any(
        fnmatch.fnmatch(n, "test_*.py") or fnmatch.fnmatch(n, "*_test.py") for n in os.listdir(root))
    if has_tests:
        found["test"] = "pytest"
    return found


def from_makefile(root: str) -> dict[str, str]:
    text = read(os.path.join(root, "Makefile")) or read(os.path.join(root, "makefile"))
    if not text:
        return {}
    targets = set(re.findall(r"^([A-Za-z0-9_.-]+)\s*:(?!=)", text, re.M))
    return {t: f"make {t}" for t in (*STANDARD, "check", "verify") if t in targets}


def discover(root: str) -> dict:
    timeout = timeout_for(root)
    block = verify_block(root)
    if block is not None:
        steps = [{"step": f"verify:{i}", "command": c} for i, c in enumerate(block, 1)]
        return {"root": root, "source": "verify-block", "timeout": timeout, "steps": steps}
    sources = [("package.json", from_package_json(root)), ("python", from_python(root)), ("makefile", from_makefile(root))]
    steps, used = [], []
    chosen = {}
    for s in STANDARD:
        for name, found in sources:
            if s in found:
                chosen[s] = found[s]
                if name not in used:
                    used.append(name)
                break
    mk = sources[2][1]
    if any(s not in chosen for s in STANDARD):
        for extra in ("check", "verify"):
            if extra in mk:
                chosen[extra] = mk[extra]
                if "makefile" not in used:
                    used.append("makefile")
    for s in (*STANDARD, "check", "verify"):
        if s in chosen:
            steps.append({"step": s, "command": chosen[s]})
        elif s in STANDARD:
            steps.append({"step": s, "command": None, "status": "not-found"})
    return {"root": root, "source": "+".join(used) or "none", "timeout": timeout, "steps": steps}


# ---------------------------------------------------------------------------
# run (R4, N5): one command at a time, killed by process group on timeout
# ---------------------------------------------------------------------------

def redact(text: str) -> str:
    for rx in REDACT:
        text = rx.sub("[redacted]", text)
    return text


def tail(text: str) -> list[str]:
    lines = [redact(ln.rstrip("\r")) for ln in text.splitlines()]
    return lines[-TAIL:]


def exec_cmd(command: str | list[str], root: str, timeout: int) -> tuple[str, int | None, str]:
    """Run once from the repo root. Returns (status, exit_code, output); status is pass, fail or timeout."""
    shell = isinstance(command, str)
    proc = subprocess.Popen(command, shell=shell, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            stdin=subprocess.DEVNULL, text=True, errors="replace", start_new_session=True)
    try:
        try:
            out, _ = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            kill_group(proc)
            try:
                out, _ = proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                out = ""
            return "timeout", None, out or ""
        return ("pass" if proc.returncode == 0 else "fail"), proc.returncode, out or ""
    finally:
        # Also covers SIGTERM (turned into SystemExit) and Ctrl-C: nothing is left running.
        if proc.poll() is None:
            kill_group(proc)


def kill_group(proc: subprocess.Popen) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            proc.kill()
        except OSError:
            pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def check_record(step: str, command: str | None, root: str, timeout: int) -> dict:
    if not command:
        return {"step": step, "command": None, "status": "not-found", "exit_code": None, "output_tail": []}
    status, code, out = exec_cmd(command, root, timeout)
    return {"step": step, "command": redact(command), "status": status, "exit_code": code, "output_tail": tail(out)}


def run_path(root: str) -> str:
    return os.path.join(root, ".pro-dev", "ship", "run.json")


def load_run(root: str, head: str) -> dict:
    try:
        data = json.loads(read(run_path(root)))
        if isinstance(data, dict) and data.get("head") == head:
            return data
    except ValueError:
        pass
    return {"head": head, "checks": []}


def save_run(root: str, data: dict) -> None:
    ship_dir(root)
    with open(run_path(root), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def flag(args: list[str], name: str) -> str | None:
    if name in args:
        i = args.index(name)
        if i + 1 >= len(args):
            raise Refuse(f"pr-check: {name} needs a value")
        return args[i + 1]
    return None


def cmd_run(root: str, args: list[str]) -> dict:
    recover(root)
    require_clean(root)
    head = rev(root, "HEAD")
    if not head:
        raise Refuse("pr-check: this repo has no commits")
    step = flag(args, "--step")
    base = flag(args, "--base")
    tier = flag(args, "--tier") or "unclassified"
    disc = discover(root)
    timeout = disc["timeout"]
    by_name = {s["step"]: s["command"] for s in disc["steps"]}
    known = [*by_name, "floor", "mutation"]
    names = [step] if step else known
    for n in names:
        if n not in known:
            raise Refuse(f"pr-check: unknown step {n}. Steps here: {', '.join(known)}")
    data = load_run(root, head)
    for n in names:
        if n == "floor":
            floor, source = run_floor(root, base, timeout)
            data["floor"] = floor
            data.setdefault("sources", {})["floor-guard"] = source
        elif n == "mutation":
            data["mutation"] = run_mutation(root, base, tier, disc, timeout)
        else:
            rec = check_record(n, by_name[n], root, timeout)
            order = list(by_name)
            checks = [c for c in data["checks"] if c["step"] != n] + [rec]
            data["checks"] = sorted(checks, key=lambda c: order.index(c["step"]) if c["step"] in order else 99)
        save_run(root, data)
    # Print only what this call ran; run.json holds the cumulative record.
    shown: dict = {"head": head}
    ran = [n for n in names if n not in ("floor", "mutation")]
    if ran:
        shown["checks"] = [c for c in data["checks"] if c["step"] in ran]
    if "floor" in names:
        shown["floor"] = data["floor"]
        shown["sources"] = data.get("sources", {})
    if "mutation" in names:
        shown["mutation"] = data["mutation"]
    return shown


# ---------------------------------------------------------------------------
# find: a sibling plugin's script (plan, "Sibling lookup")
# ---------------------------------------------------------------------------

OWN_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))


def plugins_root() -> str:
    env = os.environ.get("CLAUDE_CODE_PLUGIN_CACHE_DIR")
    return env if env else os.path.join(os.path.expanduser("~"), ".claude", "plugins")


def read_installed() -> dict:
    try:
        data = json.loads(read(os.path.join(plugins_root(), "installed_plugins.json")))
        plugins = data.get("plugins") if isinstance(data, dict) else None
        return plugins if isinstance(plugins, dict) else {}
    except ValueError:
        return {}


def own_marketplace(installed: dict) -> str | None:
    parts = OWN_ROOT.split(os.sep)
    # cache/<marketplace>/<plugin>/<version>
    if len(parts) >= 4 and parts[-4] == "cache":
        return parts[-3]
    for key, recs in installed.items():
        if key.startswith("pro-ship@") and isinstance(recs, list):
            for r in recs:
                if isinstance(r, dict) and r.get("installPath") and os.path.realpath(str(r["installPath"])) == OWN_ROOT:
                    return key.split("@", 1)[1]
    return None


def is_under(path: str, ancestor: str) -> bool:
    return path == ancestor or path.startswith(ancestor.rstrip(os.sep) + os.sep)


def find_sibling(root: str, plugin: str, filename: str) -> str:
    """Path of <plugin>/scripts/<filename> (or <plugin>/<filename> when it holds a `/`), or "not-installed". Order: in-place sibling, install
    record (project or local record for this repo or an ancestor, then user), the repo's own
    plugins/ folder when its marketplace lists the plugin."""
    parts = filename.replace("\\", "/").split("/")
    if filename.startswith("/") or ".." in parts or "\\" in filename:
        return "not-installed"
    rel = filename if "/" in filename else os.path.join("scripts", filename)
    inplace = os.path.join(os.path.dirname(OWN_ROOT), plugin, rel)
    if os.path.isfile(inplace):
        return inplace
    installed = read_installed()
    mkt = own_marketplace(installed)
    scoped, user = [], []
    for key, recs in installed.items():
        name, _, m = key.partition("@")
        if name != plugin or (mkt and m != mkt) or not isinstance(recs, list):
            continue
        for r in recs:
            if not isinstance(r, dict) or not r.get("installPath"):
                continue
            cand = os.path.join(str(r["installPath"]), rel)
            if not os.path.isfile(cand):
                continue
            if r.get("scope") in ("project", "local") and r.get("projectPath"):
                pp = os.path.realpath(str(r["projectPath"]))
                if is_under(root, pp):
                    scoped.append((len(pp), cand))
            elif r.get("scope") == "user":
                user.append(cand)
    if scoped:
        return max(scoped, key=lambda t: t[0])[1]
    if user:
        return user[-1]
    try:
        market = json.loads(read(os.path.join(root, ".claude-plugin", "marketplace.json")))
        listed = any(isinstance(p, dict) and p.get("name") == plugin for p in market.get("plugins", []))
    except (ValueError, AttributeError):
        listed = False
    own = os.path.join(root, "plugins", plugin, rel)
    if listed and os.path.isfile(own):
        return own
    return "not-installed"


def run_floor(root: str, base: str | None, timeout: int) -> tuple[str, str]:
    guard = find_sibling(root, "pro-quality", "floor-guard.py")
    if guard == "not-installed":
        return "not-installed", "not-installed"
    cmd = [sys.executable, guard, "--check"] + (["--base", base] if base else [])
    status, code, _ = exec_cmd(cmd, root, timeout)
    if status == "timeout":
        return "could-not-run", guard
    return {0: "pass", 1: "findings"}.get(code, "could-not-run"), guard


# ---------------------------------------------------------------------------
# mutation check (R29): the only code here that edits a tracked file. `run` refuses a dirty
# tree, so the restore (write the original bytes in `finally`, then git checkout) can never
# discard the person's own work.
# ---------------------------------------------------------------------------

CODE_EXT = {".py", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".rb", ".c", ".cc",
            ".cpp", ".h", ".hpp", ".cs", ".kt", ".swift", ".php", ".sh"}
# Comparisons count only with whitespace on both sides, so JSX (`return <Spinner />`), generics
# (`Array<string>`) and arrows never get flipped into code that does not parse.
OPS = re.compile(r"(?<=\s)(?:===|!==|==|!=|<=|>=|<|>)(?=\s)|&&|\|\||\band\b|\bor\b")
FLIP = {"===": "!==", "!==": "===", "==": "!=", "!=": "==", "<": ">=", ">=": "<", ">": "<=", "<=": ">",
        "&&": "||", "||": "&&", "and": "or", "or": "and"}
COMPARE = {"<", ">", "<=", ">="}
KEYWORD = re.compile(r"\b(?:if|elif|while|return|assert)\b")


def is_test_path(path: str) -> bool:
    parts = path.split("/")
    return any(d in TEST_DIRS for d in parts[:-1]) or any(fnmatch.fnmatchcase(parts[-1], p) for p in TEST_NAMES)


def mask_strings(line: str) -> str:
    """Same length as the line with quoted text blanked, so operators in strings are never flipped."""
    return re.sub(r"""(["'`])(?:\\.|(?!\1).)*\1""", lambda m: " " * len(m.group(0)), line)


def mutate_line(line: str) -> str | None:
    """Flip one operator, else negate an if or while condition; None when the line has neither."""
    stripped = line.strip()
    if not stripped or stripped.startswith(("#", "//", "*", "/*")):
        return None
    masked = mask_strings(line)
    for m in OPS.finditer(masked):
        op = m.group(0)
        if op in COMPARE and not KEYWORD.search(masked):
            continue
        new = line[:m.start()] + FLIP[op] + line[m.end():]
        return new if new != line else None
    m = re.match(r"^(\s*(?:el)?(?:if|while)\s+)(.+?)(\s*:\s*)$", line)
    if m and not m.group(2).startswith("("):
        return f"{m.group(1)}not ({m.group(2)}){m.group(3)}"
    m = re.match(r"^(.*?\b(?:if|while)\s*)\((.*)\)(\s*\{?\s*)$", line)
    if m:
        return f"{m.group(1)}(!({m.group(2)})){m.group(3)}"
    return None


def added_lines(root: str, base_sha: str) -> list[tuple[str, int, str]]:
    # Bytes, split on newline only: git counts lines that way, and str.splitlines would also split
    # on form feed, \x1c-\x1e, \x85, U+2028 and lone CR and shift every line number after them.
    r = subprocess.run(["git", "diff", "-U0", "--no-color", "--no-ext-diff", "--no-renames", base_sha, "HEAD"],
                       cwd=root, capture_output=True, timeout=60)
    out, path, lineno = [], None, 0
    for raw in r.stdout.split(b"\n"):
        ln = raw.decode("utf-8", errors="surrogateescape")
        if ln.startswith("+++ "):
            path = None if ln == "+++ /dev/null" else ln[6:] if ln.startswith("+++ b/") else ln[4:]
        elif ln.startswith("@@"):
            m = re.search(r"\+(\d+)", ln)
            lineno = int(m.group(1)) if m else 0
        elif ln.startswith("+") and path:
            out.append((path, lineno, ln[1:]))
            lineno += 1
    return out


def changed_files(root: str, base_sha: str) -> list[str]:
    r = sh(["git", "diff", "--name-only", "--no-renames", base_sha, "HEAD"], root, 60)
    return [p for p in r.stdout.split("\n") if p]


def mutation_result(status, reason=None, file=None) -> dict:
    return {"status": status, "reason": reason, "file": file, "accepted": False}


def test_command(disc: dict) -> str | None:
    steps = {s["step"]: s["command"] for s in disc["steps"]}
    if steps.get("test"):
        return steps["test"]
    for s in disc["steps"]:
        if s["step"].startswith("verify:") and s["command"] and "test" in s["command"].lower():
            return s["command"]
    return None


SIGNALS = {signal.SIGTERM, signal.SIGHUP, signal.SIGINT}


def marker_path(root: str) -> str:
    return os.path.join(root, ".pro-dev", "ship", "restore.json")


def write_marker(root: str, path: str, blob: str) -> str:
    """Record what to put back before a tracked file is mutated, so a SIGKILL or a crash that no
    handler can catch is still recoverable by the next run or stamp."""
    ship_dir(root)
    mp = marker_path(root)
    tmp = mp + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"path": path, "blob": blob}, f)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, mp)
    return mp


def remove_marker(mp: str) -> None:
    try:
        os.remove(mp)
    except OSError:
        pass


def recover(root: str) -> None:
    """Restore a file a killed mutation step left mutated, then drop the marker. Runs before the
    dirty-tree refusal. The marker names a path and a git blob: HEAD's content for that path."""
    mp = marker_path(root)
    if not os.path.exists(mp):
        return
    try:
        rec = json.loads(read(mp))
        path, blob = rec["path"], rec["blob"]
        full = os.path.realpath(os.path.join(root, path))
        if not (isinstance(path, str) and isinstance(blob, str) and re.fullmatch(r"[0-9a-f]{40,64}", blob)
                and not os.path.isabs(path) and is_under(full, os.path.realpath(root))):
            raise ValueError("bad marker")
        data = subprocess.run(["git", "cat-file", "blob", blob], cwd=root, capture_output=True, timeout=30)
        if data.returncode != 0:
            raise ValueError("blob not found")
        with open(full, "wb") as f:
            f.write(data.stdout)
        print(f"pr-check: restored {path} left mutated by an interrupted run", file=sys.stderr)
    except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError):
        pass
    remove_marker(mp)


def run_mutation(root: str, base: str | None, tier: str, disc: dict, timeout: int) -> dict:
    if tier == "low":
        return mutation_result("skipped", "low tier")
    base_sha = merge_base(root, base) if base else default_base(root)
    if not base_sha:
        return mutation_result("could-not-run", "no merge base")
    files = changed_files(root, base_sha)
    code = [f for f in files if os.path.splitext(f)[1] in CODE_EXT and not is_test_path(f)]
    if files and not any(not is_test_path(f) for f in files):
        return mutation_result("skipped", "test-only diff")
    target = None
    for path, lineno, text in added_lines(root, base_sha):
        if path in code and os.path.isfile(os.path.join(root, path)):
            new = mutate_line(text)
            if new is not None:
                target = (path, lineno, new, text)
                break
    if not target:
        return mutation_result("skipped", "no condition found")
    path, lineno, new_line, old_line = target
    stem = os.path.splitext(os.path.basename(path))[0]
    tracked = sh(["git", "ls-files"], root, 60).stdout.splitlines()
    if not any(is_test_path(t) and stem in read(os.path.join(root, t)) for t in tracked):
        return mutation_result("skipped", "no related tests", path)
    cmd = test_command(disc)
    if not cmd:
        return mutation_result("could-not-run", "no runnable test command", path)
    full = os.path.join(root, path)
    with open(full, "rb") as f:
        original = f.read()
    lines = original.split(b"\n")
    if lineno < 1 or lineno > len(lines) or lines[lineno - 1].decode("utf-8", errors="surrogateescape") != old_line:
        return mutation_result("could-not-run", "changed line not found in the file", path)
    lines[lineno - 1] = new_line.encode("utf-8", errors="surrogateescape")
    mutated = b"\n".join(lines)
    blob = sh(["git", "rev-parse", f"HEAD:{path}"], root).stdout.strip()
    marker = write_marker(root, path, blob)
    try:
        with open(full, "wb") as f:
            f.write(mutated)
        status, _, _ = exec_cmd(cmd, root, timeout)
    finally:
        # A second signal must not cut the restore short.
        old_mask = signal.pthread_sigmask(signal.SIG_BLOCK, SIGNALS)
        try:
            with open(full, "wb") as f:
                f.write(original)
            sh(["git", "checkout", "--", path], root)
            remove_marker(marker)
        finally:
            signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)
    if status == "timeout":
        return mutation_result("could-not-run", "test command timed out", path)
    return mutation_result("survived" if status == "pass" else "killed", None, path)


# ---------------------------------------------------------------------------
# stamp (R11 to R15): the one writer of .pro-dev/ship/pr-check.json. The contract is
# docs/pr-check-stamp.md; pr-gate.py and pro-security's push gate read the file.
# ---------------------------------------------------------------------------

REVIEWER_STATUS = ("done", "inline", "skipped-no-surface", "not-installed", "could-not-run")


def count(v, name: str) -> int:
    if isinstance(v, bool) or not isinstance(v, int) or v < 0:
        raise Refuse(f"pr-check: reviewer {name} must be an integer of 0 or more")
    return v


def reviewer_record(raw, which: str) -> dict:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise Refuse(f"pr-check: reviewers.{which} must be an object")
    status = raw.get("status", "could-not-run")
    if status not in REVIEWER_STATUS:
        raise Refuse(f"pr-check: reviewers.{which}.status must be one of {', '.join(REVIEWER_STATUS)}")
    if status == "skipped-no-surface" and which != "security":
        raise Refuse("pr-check: skipped-no-surface is only valid for the security reviewer")
    agent, rng = raw.get("agent"), raw.get("range")
    if agent is not None and not isinstance(agent, str) or rng is not None and not isinstance(rng, str):
        raise Refuse(f"pr-check: reviewers.{which} agent and range must be strings or null")
    return {"agent": agent, "status": status, "blocking": count(raw.get("blocking", 0), "blocking"),
            "important": count(raw.get("important", 0), "important"), "range": rng}


# ---------------------------------------------------------------------------
# Codex second review (ADR-0018): trigger, agreement and the stamp record
# ---------------------------------------------------------------------------

# Two findings in the same file match when their line ranges, each widened by NEAR lines on both
# sides, overlap. Five catches one bug cited a few lines apart; tune it after the first high-tier
# PRs (ADR-0018).
NEAR = 5
CODEX_STATUS = ("done", "skipped", "not-installed", "could-not-run")
# A heading is the keyword alone, with an optional "findings", a colon or markdown emphasis. A line
# with more after the keyword ("Ignored from the handoff: none", the tally line) is not a heading.
SECTION_RE = re.compile(r"^\s*#*\s*\**\s*(important|nits?|pre-existing|skipped|ignored)\b(\s+findings)?\s*:?\s*\**\s*$", re.I)
INLINE_SEV_RE = re.compile(r"\b(important|nits?)\b", re.I)
ITEM_RE = re.compile(r"^\s*(?:-|\d+\.)\s")
# Brackets, parentheses and @ are path characters too (Next.js routes such as app/[id]/page.tsx).
LOC_RE = re.compile(r"`?([A-Za-z0-9_./@+~()\[\]-]+):(\d+)(?:-(\d+))?`?")
PAIRS = {"(": ")", "[": "]"}


def base_review_md(root: str, base_arg: str | None) -> str:
    """REVIEW.md as the base branch has it, so a PR cannot switch off its own second look.
    Empty when there is no base or the base has no REVIEW.md."""
    base = merge_base(root, base_arg) if base_arg else default_base(root)
    if not base:
        return ""
    r = sh(["git", "show", f"{base}:REVIEW.md"], root)
    return r.stdout if r.returncode == 0 else ""


def cmd_codex_trigger(root: str, args: list[str]) -> dict:
    tier = flag(args, "--tier") or "unclassified"
    setting, note = "high", ""
    for ln in base_review_md(root, flag(args, "--base")).splitlines():
        m = re.match(r"^\s*codex-review:\s*(\S+)\s*$", ln, re.I)
        if m:
            value = m.group(1).lower()
            if value in ("always", "high", "never"):
                setting = value
            else:
                note = f"unknown codex-review value {m.group(1)!r} read as high; "
            break
    if setting == "never":
        return {"run": False, "setting": setting, "reason": "codex-review: never"}
    if setting == "always":
        return {"run": True, "setting": setting, "reason": "codex-review: always"}
    if tier == "high":
        return {"run": True, "setting": setting, "reason": note + "tier high"}
    return {"run": False, "setting": setting, "reason": note + f"tier {tier}"}


def norm_path(path: str, root: str | None) -> str:
    """./a/b.py and an absolute path under the repo root both become a/b.py. An opening bracket
    with no partner, as in "(src/a.py:10)", is prose and is dropped."""
    while path and path[0] in PAIRS and path.count(path[0]) > path.count(PAIRS[path[0]]):
        path = path[1:]
    if root and os.path.isabs(path):
        for r in {root, os.path.realpath(root)}:
            if path.startswith(r.rstrip(os.sep) + os.sep):
                path = os.path.relpath(path, r)
                break
    return os.path.normpath(path) if path else path


def parse_findings(text: str, root: str | None = None) -> list[dict]:
    """Findings of one review report: list items with a path:line location, tagged by the
    nearest Important, Nits or Pre-existing heading above them (read inline when no heading set
    one). Items under a Skipped or Ignored heading are not findings."""
    out, severity = [], "unknown"
    for line in text.splitlines():
        if ITEM_RE.match(line):
            m = LOC_RE.search(line)
            if m and severity not in ("skipped", "ignored"):
                start = int(m.group(2))
                end = int(m.group(3)) if m.group(3) else start
                sev = severity
                if sev == "unknown":
                    w = INLINE_SEV_RE.search(line)
                    sev = ("nit" if w.group(1).lower().startswith("nit") else "important") if w else "unknown"
                out.append({"severity": sev, "path": norm_path(m.group(1), root), "start": start, "end": max(start, end), "text": line.strip()})
            continue
        h = SECTION_RE.match(line)
        if h:
            word = h.group(1).lower()
            severity = "nit" if word.startswith("nit") else word
    return out


def near(a: dict, b: dict) -> bool:
    return a["path"] == b["path"] and a["start"] - NEAR <= b["end"] + NEAR and b["start"] - NEAR <= a["end"] + NEAR


def cmd_agree(args: list[str], root: str | None = None) -> dict:
    code_path, codex_path = flag(args, "--code"), flag(args, "--codex")
    if not code_path or not codex_path:
        raise Refuse("pr-check: usage: agree --code FILE --codex FILE")
    texts = []
    for label, path in (("code", code_path), ("codex", codex_path)):
        try:
            text = read(path)
        except (Refuse, OSError):
            text = ""
        if not text.strip():
            raise Refuse(f"pr-check: the {label} report {path} is missing or empty, so there is nothing to compare")
        texts.append(text)
    code, codex = parse_findings(texts[0], root), parse_findings(texts[1], root)
    taken: set[int] = set()
    agreed, disputed = [], []
    for i, c in enumerate(code):
        for j, x in enumerate(codex):
            if j not in taken and near(c, x):
                taken.add(j)
                (agreed if c["severity"] == x["severity"] else disputed).append([i, j])
                break
    paired_code = {i for i, _ in agreed + disputed}
    return {"code": code, "codex": codex, "agreed": agreed, "disputed": disputed,
            "code_only": [i for i in range(len(code)) if i not in paired_code],
            "codex_only": [j for j in range(len(codex)) if j not in taken],
            "counts": {"agreed": len(agreed), "disputed": len(disputed)}}


MALFORMED_CODEX = {"agent": None, "status": "could-not-run", "reason": "malformed codex record", "blocking": 0,
                   "important": 0, "agreed": 0, "disputed": 0, "range": None}


def codex_record(raw) -> dict:
    """reviewers.codex: informational, never blocking and never read by the result rule.
    Only a nonzero blocking is refused; any other malformed record is recorded as could-not-run."""
    if not isinstance(raw, dict):
        return dict(MALFORMED_CODEX)
    blocking = raw.get("blocking", 0)
    if isinstance(blocking, int) and not isinstance(blocking, bool) and blocking > 0:
        raise Refuse("pr-check: reviewers.codex.blocking must be 0, a Codex finding never blocks")
    status = raw.get("status", "could-not-run")
    agent, reason, rng = raw.get("agent"), raw.get("reason"), raw.get("range")
    try:
        if status not in CODEX_STATUS or any(v is not None and not isinstance(v, str) for v in (agent, reason, rng)):
            raise Refuse("malformed")
        counts = [count(raw.get(k, 0), k) for k in ("blocking", "important", "agreed", "disputed")]
    except Refuse:
        return dict(MALFORMED_CODEX)
    return {"agent": agent, "status": status, "reason": reason, "blocking": 0,
            "important": counts[1], "agreed": counts[2], "disputed": counts[3], "range": rng}


def compute_result(checks: list, floor: str, mutation: dict, reviewers: dict, missing: list | None = None) -> str:
    """The result rule of docs/pr-check-stamp.md; the first match wins."""
    if (any(c.get("status") == "fail" for c in checks) or floor == "findings"
            or any(reviewers[k]["blocking"] > 0 for k in ("code", "security"))):
        return "fail"
    if missing:
        return "incomplete"
    mutation_ok = mutation.get("status") in ("killed", "skipped") or (
        mutation.get("status") == "survived" and mutation.get("accepted") is True)
    if (all(c.get("status") in ("pass", "not-found") for c in checks)
            and floor in ("pass", "not-installed", "not-found")
            and mutation_ok
            and reviewers["code"]["status"] in ("done", "inline")
            and reviewers["security"]["status"] in ("done", "inline", "skipped-no-surface")):
        return "pass"
    return "incomplete"


def risk_from_file(path: str, head: str | None = None) -> tuple[str, dict]:
    """Return (tier, risk) from the classifier's JSON. Anything unusable is high, never low.

    A risk file written for another commit than the current HEAD is stale and counts as could not run."""
    def failed(reason: str) -> tuple[str, dict]:
        return "high", {"tier": "high", "could_not_run": True, "reason": reason}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        return failed(f"risk file unreadable: {type(e).__name__}")
    if not isinstance(data, dict):
        return failed("risk file is not a JSON object")
    if data.get("could_not_run") is True:
        risk = dict(data)
        risk["tier"] = "high"
        if not isinstance(risk.get("reason"), str) or not risk["reason"]:
            risk["reason"] = "the classifier could not run"
        return "high", risk
    if data.get("tier") not in ("low", "medium", "high"):
        return failed("risk file has no valid tier")
    if head and data.get("head") != head:
        return failed("risk file head does not match the current HEAD (stale risk file)")
    return data["tier"], data


def cmd_stamp(root: str, args: list[str]) -> dict:
    recover(root)
    require_clean(root)
    head = rev(root, "HEAD")
    if not head:
        raise Refuse("pr-check: this repo has no commits")
    base_arg = flag(args, "--base")
    base = merge_base(root, base_arg) if base_arg else default_base(root)
    if not base:
        raise Refuse("pr-check: cannot find the base commit. Pass --base <ref>.")
    tier = flag(args, "--tier") or "unclassified"
    risk_path = flag(args, "--risk")
    risk = None
    if risk_path:
        tier, risk = risk_from_file(risk_path, head)
    raw = flag(args, "--reviewers")
    try:
        revs = json.loads(raw) if raw else {}
    except ValueError as e:
        raise Refuse(f"pr-check: --reviewers is not valid JSON ({e})")
    if not isinstance(revs, dict):
        raise Refuse("pr-check: --reviewers must be a JSON object with code and security")
    reviewers = {k: reviewer_record(revs.get(k), k) for k in ("code", "security")}
    if "codex" in revs:
        reviewers["codex"] = codex_record(revs["codex"])
    try:
        run = json.loads(read(run_path(root)))
    except ValueError:
        run = None
    if not isinstance(run, dict):
        raise Refuse("pr-check: no run record. Run the steps first (pr-check.py run).")
    if run.get("head") != head:
        raise Refuse("pr-check: the run record is for another commit. Run the steps again on this HEAD.")
    checks = run.get("checks") if isinstance(run.get("checks"), list) else []
    have = {c.get("step") for c in checks if isinstance(c, dict)}
    missing = [s["step"] for s in discover(root)["steps"] if s["step"] not in have]
    if not isinstance(run.get("floor"), str):
        missing.append("floor")
    if not isinstance(run.get("mutation"), dict):
        missing.append("mutation")
    if missing:
        print(f"pr-check: incomplete, no record for: {', '.join(missing)}. Run those steps on this HEAD.", file=sys.stderr)
    floor = run.get("floor") if isinstance(run.get("floor"), str) else "could-not-run"
    mutation = dict(run["mutation"]) if isinstance(run.get("mutation"), dict) else mutation_result("could-not-run", "mutation step not run")
    mutation = {"status": mutation.get("status", "could-not-run"), "reason": mutation.get("reason"),
                "file": mutation.get("file"), "accepted": False}
    if "--accept-mutation" in args and mutation["status"] == "survived":
        mutation["accepted"] = True
    stamp = {
        "schema": 1,
        "head": head,
        "base": base,
        "created": datetime.now().astimezone().isoformat(timespec="seconds"),
        "tier": tier,
        "checks": checks,
        "floor": floor,
        "mutation": mutation,
        "reviewers": reviewers,
        "result": compute_result(checks, floor, mutation, reviewers, missing),
        "sources": run.get("sources") if isinstance(run.get("sources"), dict) else {"floor-guard": "not-installed"},
    }
    if risk is not None:
        stamp["risk"] = risk
    path = os.path.join(ship_dir(root), "pr-check.json")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(stamp, f, indent=2)
        f.write("\n")
    os.replace(tmp, path)
    return stamp


def cmd_marker(root: str) -> str:
    """The R9 line, taken from the stamp just written. The stamp contract does not change."""
    try:
        stamp = json.loads(read(os.path.join(root, ".pro-dev", "ship", "pr-check.json")))
    except ValueError:
        stamp = None
    if not isinstance(stamp, dict) or not stamp.get("head") or not stamp.get("result"):
        raise Refuse("pr-check: no readable stamp at .pro-dev/ship/pr-check.json. Run the stamp step first.")
    head, result, tier = stamp["head"], stamp["result"], stamp.get("tier") or "unclassified"
    if not (isinstance(head, str) and re.fullmatch(r"[0-9a-f]{40}", head)
            and result in ("pass", "fail", "incomplete") and re.fullmatch(r"[a-z]+", str(tier))):
        raise Refuse("pr-check: the stamp holds values the marker cannot carry. Run the stamp step again.")
    return f"<!-- pro-ship:pr-check head={head} result={result} tier={tier} -->"


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def emit(obj) -> None:
    print(json.dumps(obj, indent=2))


def main(argv: list[str]) -> int:
    # SIGTERM, SIGHUP (terminal closed) and SIGINT all unwind through the finally blocks, which
    # restore the mutated file and kill the test child's process group.
    for sig in SIGNALS:
        signal.signal(sig, lambda n, _f: sys.exit(128 + n))
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0 if argv else 2
    cmd, rest = argv[0], argv[1:]
    try:
        if cmd == "discover":
            emit(discover(repo_root()))
            return 0
        if cmd == "stamp":
            emit(cmd_stamp(repo_root(), rest))
            return 0
        if cmd == "marker":
            print(cmd_marker(repo_root()))
            return 0
        if cmd == "find":
            if len(rest) != 2:
                raise Refuse("pr-check: usage: find <plugin> <file>")
            print(find_sibling(repo_root(), rest[0], rest[1]))
            return 0
        if cmd == "codex-trigger":
            emit(cmd_codex_trigger(repo_root(), rest))
            return 0
        if cmd == "agree":
            emit(cmd_agree(rest, repo_root()))
            return 0
        if cmd == "run":
            emit(cmd_run(repo_root(), rest))
            return 0
        print(f"pr-check: unknown subcommand {cmd}", file=sys.stderr)
        return 2
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
