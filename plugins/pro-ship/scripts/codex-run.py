#!/usr/bin/env python3
"""codex-run - run one read-only Codex review and print its report.

Usage:
  codex-run.py (--instructions FILE | --agent NAME) --prompt FILE [--cwd DIR] [--timeout SECONDS]
               [--consent-ref REF]
  codex-run.py --check [--cwd DIR] [--consent-ref REF]

Checks, in order: consent (answers.codex.answer == "yes" in .claude/pro-dev.json, read from the
work tree or, with --consent-ref, from `git show REF:.claude/pro-dev.json`), the `codex` binary on
PATH, `codex login status` exit 0. --check runs them only and prints `ready`.

On success the report is on stdout, exit 0. On any failure stdout is one line
`could-not-run: <reason>: <detail>` and stderr has at most five lines of Codex's stderr.
Exit 2 usage, 3 not-opted-in, not-installed or not-logged-in, 4 timeout, exit-<n>, empty-output,
signal or error. The instructions and the prompt go to Codex on stdin. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import stat
import subprocess
import sys
import tempfile

ANSWERS_FILE = os.path.join(".claude", "pro-dev.json")
MAX_ANSWERS_BYTES = 64 * 1024
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def fail(code: int, reason: str, detail: str, stderr_text: str = "") -> None:
    print(f"could-not-run: {reason}: {' '.join(detail.split())}", flush=True)
    tail = [ln for ln in stderr_text.splitlines() if ln.strip()][-5:]
    if tail:
        print("\n".join(tail), file=sys.stderr)
    sys.exit(code)


class Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # type: ignore[override]
        fail(2, "usage", message)


def read_text(path: str, what: str) -> str:
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except (OSError, UnicodeDecodeError) as e:
        fail(2, "usage", f"cannot read the {what} file {path} ({type(e).__name__})")
    if not text.strip():
        fail(2, "usage", f"the {what} file {path} is empty")
    return text


def toml_instructions(path: str) -> str:
    try:
        import tomllib
        with open(path, "rb") as f:
            value = tomllib.load(f).get("developer_instructions")
    except ImportError:
        fail(2, "usage", "reading a .toml file needs Python 3.11 or newer")
    except (OSError, ValueError) as e:
        fail(2, "usage", f"cannot read {path} ({type(e).__name__})")
    if not isinstance(value, str) or not value.strip():
        fail(2, "usage", f"{path} has no developer_instructions string")
    return value


def load_instructions(path: str) -> str:
    if path.endswith(".toml"):
        return toml_instructions(path).strip()
    text = read_text(path, "instructions")
    if path.endswith(".md") and text.startswith("---"):
        m = re.match(r"---[ \t]*\n.*?\n---[ \t]*(?:\n|$)", text, re.S)
        if m:
            text = text[m.end():]
    if not text.strip():
        fail(2, "usage", f"the instructions file {path} has no body")
    return text.strip()


def find_agent(name: str, cwd: str) -> str:
    if not NAME_RE.match(name):
        fail(2, "usage", f"--agent name {name!r} must match {NAME_RE.pattern}")
    home = os.environ.get("CODEX_HOME") or os.path.join(os.path.expanduser("~"), ".codex")
    for base in (os.path.join(cwd, ".codex", "agents"), os.path.join(home, "agents")):
        cand = os.path.join(base, f"{name}.toml")
        if os.path.isfile(cand):
            return cand
    fail(2, "usage", f"no agent file {name}.toml under .codex/agents in the work tree or the Codex home")


def default_cwd() -> str:
    try:
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=15).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        top = ""
    return os.path.realpath(top) if top else os.getcwd()


def answers_problem(repo: str) -> str | None:
    """Why the answers file is unsafe to read, or None. Never follows a symlink."""
    claude_dir = os.path.join(repo, ".claude")
    if not os.path.lexists(claude_dir):
        return None
    if os.path.realpath(claude_dir) != os.path.join(os.path.realpath(repo), ".claude"):
        return ".claude is a symlink or resolves outside the repo"
    try:
        st = os.lstat(os.path.join(repo, ANSWERS_FILE))
    except OSError:
        return None  # missing or unreadable: answers_raw reports it
    return None if stat.S_ISREG(st.st_mode) else f"{ANSWERS_FILE} is not a regular file"


def answers_raw(repo: str, ref: str | None) -> bytes | str:
    """The answers file bytes, or the reason there are none. A ref reads the committed copy."""
    if ref:
        r = subprocess.run(["git", "-C", repo, "show", f"{ref}:{ANSWERS_FILE.replace(os.sep, '/')}"], capture_output=True)
        return r.stdout[:MAX_ANSWERS_BYTES + 1] if r.returncode == 0 else f"no {ANSWERS_FILE} at {ref}"
    problem = answers_problem(repo)
    if problem:
        return problem
    try:
        fd = os.open(os.path.join(repo, ANSWERS_FILE), os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
        with os.fdopen(fd, "rb") as fh:
            return fh.read(MAX_ANSWERS_BYTES + 1)
    except FileNotFoundError:
        return f"no {ANSWERS_FILE} in this repo"
    except OSError:
        return f"{ANSWERS_FILE} cannot be read as JSON"


def opted_in(repo: str, ref: str | None = None) -> str | None:
    """None when the repo answered yes for codex, else the reason it did not."""
    raw = answers_raw(repo, ref)
    if isinstance(raw, str):
        return raw
    if len(raw) > MAX_ANSWERS_BYTES:
        return f"{ANSWERS_FILE} is larger than 64 KiB"
    try:
        data = json.loads(raw.decode("utf-8"))
    except ValueError:
        return f"{ANSWERS_FILE} cannot be read as JSON"
    answers = data.get("answers") if isinstance(data, dict) else None
    entry = answers.get("codex") if isinstance(answers, dict) else None
    if isinstance(entry, dict) and entry.get("answer") == "yes":
        return None
    return f"{ANSWERS_FILE} has no yes for codex; answer it with /pro-dev install"


def preflight(cwd: str, ref: str | None = None) -> str:
    """R3 in order; returns the codex path or exits with the reason."""
    why = opted_in(cwd, ref)
    if why:
        fail(3, "not-opted-in", why)
    codex = shutil.which("codex")
    if not codex:
        fail(3, "not-installed", "the codex command is not on PATH")
    try:
        ok = subprocess.run([codex, "login", "status"], stdin=subprocess.DEVNULL, capture_output=True, timeout=30).returncode == 0
    except (OSError, subprocess.SubprocessError):
        ok = False
    if not ok:
        fail(3, "not-logged-in", "codex login status did not succeed; run codex login")
    return codex


def kill_group(proc: subprocess.Popen) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
        proc.wait(timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        pass


def on_signal(n: int, _frame) -> None:
    fail(4, "signal", f"stopped by signal {n}")


def main(argv: list[str]) -> int:
    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(sig, on_signal)
    try:
        return run(argv)
    except Exception as e:  # SystemExit from fail() passes through
        fail(4, "error", type(e).__name__)


def run(argv: list[str]) -> int:
    ap = Parser(prog="codex-run.py", add_help=True)
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--instructions")
    src.add_argument("--agent")
    ap.add_argument("--prompt")
    ap.add_argument("--cwd")
    ap.add_argument("--timeout", type=int, default=540)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--consent-ref")
    a = ap.parse_args(argv)
    cwd = os.path.realpath(a.cwd) if a.cwd else default_cwd()
    if not 1 <= a.timeout <= 3600 or not os.path.isdir(cwd):
        fail(2, "usage", "--timeout must be an integer from 1 to 3600 and --cwd a folder")
    if a.check:
        preflight(cwd, a.consent_ref)
        print("ready")
        return 0
    if not a.prompt or not (a.instructions or a.agent):
        fail(2, "usage", "give --prompt and one of --instructions or --agent")
    instructions = load_instructions(a.instructions or find_agent(a.agent, cwd))
    prompt = read_text(a.prompt, "prompt")
    codex = preflight(cwd, a.consent_ref)
    composed = f"# Instructions\n\n{instructions}\n\n# Handoff\n\n{prompt}"
    tmp = tempfile.mkdtemp(prefix="codex-run-")
    proc = None
    try:
        out_file = os.path.join(tmp, "last.txt")
        argv_run = [codex, "exec", "-s", "read-only", "--ephemeral", "--color", "never", "-C", cwd, "-o", out_file, "-"]
        proc = subprocess.Popen(argv_run, cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, start_new_session=True)
        try:
            _, err = proc.communicate(input=composed.encode("utf-8"), timeout=a.timeout)
        except subprocess.TimeoutExpired:
            kill_group(proc)
            fail(4, "timeout", f"codex exec did not finish within {a.timeout} seconds")
        err_text = err.decode("utf-8", "replace")
        if proc.returncode != 0:
            fail(4, f"exit-{proc.returncode}", "codex exec exited with an error", err_text)
        report = open(out_file, encoding="utf-8", errors="replace").read() if os.path.exists(out_file) else ""
        if not report.strip():
            fail(4, "empty-output", "codex exec finished with an empty report", err_text)
        sys.stdout.buffer.write((report if report.endswith("\n") else report + "\n").encode("utf-8"))
        sys.stdout.buffer.flush()
        return 0
    finally:
        if proc is not None and proc.poll() is None:
            kill_group(proc)
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
