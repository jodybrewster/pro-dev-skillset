#!/usr/bin/env python3
"""PreToolUse Bash hook - the PR gate.

Before `gh pr create` (not a draft, not --help) it reads `.pro-dev/ship/pr-check.json`
under the repo root and checks the stamp that /pro-ship:pr-check wrote. The validity rule
and the causes (missing, unreadable, stale, not-passing) are in docs/pr-check-stamp.md.

A valid stamp passes with no output. An invalid one follows the mode: mode.pr-gate, then
mode, in CLAUDE_GUARD_DIR or ~/.claude/hooks (default warn).
  warn     one line in warn.log and a message, once per HEAD per session; allows.
  enforce  denies once per HEAD per session with the cause and "run /pro-ship:pr-check";
           the identical retry passes.
When it cannot decide (unreadable payload, no git, no repo, a git timeout) it logs
could-not-run and allows. It never says a stamp was checked when it was not.

Reads one file, runs one `git rev-parse`, makes no network calls and executes nothing
taken from the payload. It writes only warn.log and its session state file.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import time

HOOK = "pr-gate"
STAMP = os.path.join(".pro-dev", "ship", "pr-check.json")

# ---------------------------------------------------------------------------
# Mode lookup and warn.log writer.
# Copied from plugins/pro-ai-sdlc/scripts/guard.py (guard_dir, mode, log). Plugins
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
# Command parsing.
# Copied from plugins/pro-quality/scripts/floor-guard.py (strip_heredocs, split_segments,
# _tokens, _resolve, skip_wrappers, actions), cut down to gh pr create. Text inside
# quotes, echo and heredoc bodies never matches.
# ---------------------------------------------------------------------------

HEREDOC_RE = re.compile(r"(?<!<)<<(?!<)-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
SHELLS = {"bash", "sh", "zsh", "dash"}
SHELL_C_RE = re.compile(r"^-[A-Za-z]*c[A-Za-z]*$")
# gh pr create flags that take a value, so a value such as "-d" is not read as a flag.
VALUE_FLAGS = {"-t", "--title", "-b", "--body", "-F", "--body-file", "-B", "--base", "-H", "--head",
               "-a", "--assignee", "-l", "--label", "-m", "--milestone", "-p", "--project",
               "-r", "--reviewer", "-R", "--repo", "--template", "--recover"}


def strip_heredocs(command: str) -> str:
    out: list[str] = []
    pending: list[str] = []
    for line in command.split("\n"):
        if pending:
            if line.strip() == pending[0]:
                pending.pop(0)
            continue
        out.append(line)
        pending.extend(m.group(2) for m in HEREDOC_RE.finditer(line))
    return "\n".join(out)


def split_segments(command: str) -> list[str]:
    """Split on && || ; | and newlines that are outside quotes."""
    segments: list[str] = []
    buf: list[str] = []
    quote = ""
    i = 0
    n = len(command)
    while i < n:
        ch = command[i]
        if ch == "\\" and quote != "'" and i + 1 < n:
            buf.append(command[i : i + 2])
            i += 2
            continue
        if quote:
            if ch == quote:
                quote = ""
            buf.append(ch)
            i += 1
            continue
        if ch in "'\"":
            quote = ch
            buf.append(ch)
            i += 1
            continue
        if command.startswith(("&&", "||"), i):
            segments.append("".join(buf))
            buf = []
            i += 2
            continue
        if ch == "&" and not (i + 1 < n and command[i + 1] == ">") and not (i > 0 and command[i - 1] in "<>"):
            segments.append("".join(buf))  # a single & backgrounds the left side and starts a new command
            buf = []
            i += 1
            continue
        if ch in ";|\n":
            segments.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    segments.append("".join(buf))
    return segments


def _tokens(segment: str) -> list[str]:
    try:
        return shlex.split(segment.strip().lstrip("("))
    except ValueError:
        return segment.split()


def _resolve(cur: str | None, path: str) -> str | None:
    """cur joined with path, or None when the path cannot be known statically."""
    if cur is None or any(c in path for c in "$`*?"):
        return None
    return os.path.abspath(os.path.join(cur, os.path.expanduser(path)))


KEYWORDS = {"{", "!", "then", "do", "else", "elif", "if", "while", "until", "time", "exec", "nohup", "builtin"}
XARGS_VALUE = {"-a", "-d", "-E", "-I", "-L", "-n", "-P", "-s", "--arg-file", "--delimiter", "--max-args", "--max-procs"}
SUDO_VALUE = {"-u", "-g", "-p", "-C", "-D", "-R", "-T", "-U", "-h"}


def skip_wrappers(toks: list[str]) -> int:
    """Index of the real command after VAR=val, env, command, time, nohup, sudo and the like."""
    i = 0
    while i < len(toks):
        t = toks[i]
        if "=" in t and not t.startswith(("-", "=")):
            i += 1
        elif t in KEYWORDS:
            i += 1
            while t == "time" and i < len(toks) and toks[i].startswith("-"):
                i += 1
        elif t == "env":
            i += 1
            while i < len(toks) and (toks[i].startswith("-") or "=" in toks[i]):
                i += 2 if toks[i] in ("-u", "-S") else 1
        elif t == "command":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 1
        elif t == "sudo":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] in SUDO_VALUE else 1
        elif t == "nice":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] == "-n" else 1
        elif t == "timeout":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] in ("-k", "-s") else 1
            i += 1  # the duration
        else:
            break
    return i


def substitutions(command: str) -> tuple[str, list[str]]:
    """Pull out $(...), <(...), >(...) and backtick bodies that the shell would run.

    Returns the command with each one replaced by a placeholder and the list of bodies.
    Single-quoted text is literal. Double-quoted text still runs a substitution.
    """
    out: list[str] = []
    bodies: list[str] = []
    quote = ""
    i, n = 0, len(command)
    while i < n:
        ch = command[i]
        if ch == "\\" and quote != "'" and i + 1 < n:
            out.append(command[i : i + 2])
            i += 2
            continue
        if quote == "'":
            if ch == "'":
                quote = ""
            out.append(ch)
            i += 1
            continue
        if ch == "'" and quote == "":
            quote = "'"
            out.append(ch)
            i += 1
            continue
        if ch == '"':
            quote = "" if quote == '"' else '"'
            out.append(ch)
            i += 1
            continue
        if ch == "`":
            j = i + 1
            while j < n and command[j] != "`":
                j += 2 if command[j] == "\\" else 1
            bodies.append(command[i + 1 : j])
            out.append("SUBST")
            i = j + 1
            continue
        if ch == "(" and i > 0 and command[i - 1] in "$<>" and (command[i - 1] == "$" or quote == ""):
            depth, j, q = 1, i + 1, ""
            while j < n and depth:
                c = command[j]
                if c == "\\" and q != "'":
                    j += 2
                    continue
                if q:
                    q = "" if c == q else q
                elif c in "'\"":
                    q = c
                elif c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                j += 1
            bodies.append(command[i + 1 : j - 1 if depth == 0 else j])
            out.pop()  # the $ < > before the paren
            out.append("SUBST")
            i = j
            continue
        out.append(ch)
        i += 1
    return "".join(out), bodies


SHORT_VALUE = {f[1] for f in VALUE_FLAGS if len(f) == 2}


def exempt(args: list[str]) -> bool:
    """True for a draft or a help request: those pass without a stamp."""
    i = 0
    while i < len(args):
        t = args[i]
        if t in ("--help", "--draft", "--draft=true", "--draft=1"):
            return True
        if t in VALUE_FLAGS:
            i += 2
            continue
        if re.fullmatch(r"-[A-Za-z]+", t):
            # Combined short flags such as -dt: read left to right until one takes a value.
            for k, ch in enumerate(t[1:]):
                if ch in "dh":
                    return True
                if ch in SHORT_VALUE:
                    # The rest of the token is its value, or the next arg when it ends the token.
                    i += 2 if k == len(t) - 2 else 1
                    break
            else:
                i += 1
            continue
        i += 1
    return False


def actions(command: str, base: str | None) -> list[str | None]:
    """The directory of each non-draft `gh pr create` in the command (None: unknown).

    The directory follows `cd <path>` and bash/sh -c. A target that cannot be resolved
    (a variable, pushd) comes back as None.
    """
    cur = base
    found: list[str | None] = []
    command, bodies = substitutions(strip_heredocs(command))
    for body in bodies:
        found.extend(actions(body, cur))
    for segment in split_segments(command):
        toks = _tokens(segment)
        if not toks:
            continue
        if toks[0] == "cd":
            cur = _resolve(cur, toks[1]) if len(toks) > 1 and toks[1] != "-" else cur
            continue
        if toks[0] in ("pushd", "popd"):
            cur = None
            continue
        i = skip_wrappers(toks)
        if i >= len(toks):
            continue
        name = os.path.basename(toks[i])
        if name in SHELLS:
            for j in range(i + 1, len(toks) - 1):
                if SHELL_C_RE.match(toks[j]):
                    found.extend(actions(toks[j + 1], cur))
                    break
            continue
        if name == "eval":
            found.extend(actions(" ".join(toks[i + 1 :]), cur))
            continue
        if name == "xargs":
            j = i + 1
            while j < len(toks) and toks[j].startswith("-"):
                j += 2 if toks[j] in XARGS_VALUE else 1
            if j < len(toks):
                found.extend(actions(shlex.join(toks[j:]), cur))
            continue
        if name != "gh":
            continue
        i += 1
        while i < len(toks) and toks[i].startswith("-"):
            i += 2 if toks[i] in ("-R", "--repo") else 1
        if i + 1 < len(toks) and toks[i] == "pr" and toks[i + 1] in ("create", "new"):
            if not exempt(toks[i + 2 :]):
                found.append(cur)
    return found


# ---------------------------------------------------------------------------
# git, stamp, state
# ---------------------------------------------------------------------------


class CouldNotRun(Exception):
    pass


def repo_and_head(directory: str) -> tuple[str, str]:
    """(repo root, HEAD sha) from one git call."""
    try:
        r = subprocess.run(
            ["git", "-C", directory, "rev-parse", "--show-toplevel", "HEAD"],
            capture_output=True, text=True, timeout=5, errors="replace",
            env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
        )
    except subprocess.TimeoutExpired:
        raise CouldNotRun("git timed out")
    except Exception:
        raise CouldNotRun("git could not be run")
    lines = r.stdout.split("\n")
    if r.returncode != 0 or len(lines) < 2 or not lines[0] or not re.fullmatch(r"[0-9a-f]{40,64}", lines[1].strip()):
        raise CouldNotRun("not a git repo with a commit")
    return lines[0], lines[1].strip()


def stamp_cause(root: str, head: str) -> str | None:
    """None when the stamp is valid, else missing, unreadable, stale or not-passing."""
    path = os.path.join(root, STAMP)
    if not os.path.exists(path):
        return "missing"
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return "unreadable"
    if (not isinstance(data, dict) or data.get("schema") != 1 or not isinstance(data.get("schema"), int)
            or isinstance(data.get("schema"), bool)
            or not isinstance(data.get("head"), str) or not isinstance(data.get("result"), str)):
        return "unreadable"
    if data["head"] != head:
        return "stale"
    return None if data["result"] == "pass" else "not-passing"


def state_path(session_id: str, root: str) -> str:
    # Keyed as security_surface.state_path, under a ship folder.
    home = os.environ.get("PRO_DEV_STATE_DIR") or os.path.expanduser("~/.claude/pro-dev")
    key = hashlib.sha256(f"{session_id}:{root}".encode()).hexdigest()[:16]
    return os.path.join(home, "ship", f"{key}.json")


def load_state(path: str) -> dict:
    try:
        with open(path) as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_state(path: str, state: dict) -> bool:
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
        with os.fdopen(fd, "w") as fh:
            json.dump(state, fh)
        os.replace(tmp, path)
        return True
    except Exception:
        return False


CAUSE_TEXT = {
    "missing": "there is no pr-check stamp",
    "unreadable": "the pr-check stamp is unreadable",
    "stale": "the pr-check stamp is for an older commit",
    "not-passing": "the pr-check stamp does not say pass",
}


def main_hook() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        return 0
    try:
        payload = json.loads(raw)
    except Exception:
        payload = None
    if not isinstance(payload, dict):
        log(HOOK, "could-not-run", "unreadable hook payload (allowed)", os.getcwd())
        return 0
    inp = payload.get("tool_input")
    command = inp.get("command") if isinstance(inp, dict) else None
    if not isinstance(command, str) or "gh" not in command or "pr" not in command:
        return 0
    cwd = payload.get("cwd") if isinstance(payload.get("cwd"), str) and payload.get("cwd") else os.getcwd()
    hits = actions(command, cwd)
    if not hits:
        return 0
    try:
        if hits[0] is None:
            raise CouldNotRun("the directory of gh pr create could not be resolved")
        root, head = repo_and_head(hits[0])
    except CouldNotRun as e:
        log(HOOK, "could-not-run", f"{e} (allowed)", cwd)
        return 0
    cause = stamp_cause(root, head)
    if cause is None:
        return 0

    enforcing = mode(HOOK) == "enforce"
    path = state_path(str(payload.get("session_id") or "nosession"), root)
    state = load_state(path)
    seen = state.get("denied" if enforcing else "warned")
    seen = seen if isinstance(seen, list) else []
    if head in seen:
        return 0
    state["denied" if enforcing else "warned"] = seen[-50:] + [head]
    if not save_state(path, state):
        log(HOOK, "could-not-run", "session state not writable (allowed)", root)
        return 0

    why = f"[{HOOK}] {CAUSE_TEXT[cause]} ({cause}) for commit {head[:8]}."
    if enforcing:
        log(HOOK, "deny", f"{cause} {head[:8]}", root)
        reason = f"{why} Run /pro-ship:pr-check, then create the PR. The identical command passes if you run it again."
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                                 "permissionDecision": "deny",
                                                 "permissionDecisionReason": reason}}))
    else:
        log(HOOK, "warn", f"{cause} {head[:8]}", root)
        msg = f"{why} Run /pro-ship:pr-check before opening the PR (warn mode: allowed)."
        print(json.dumps({"systemMessage": msg,
                          "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": msg}}))
    return 0


def main() -> int:
    try:
        return main_hook()
    except Exception as e:  # never crash the turn
        log(HOOK, "could-not-run", f"internal error: {e}", os.getcwd())
        return 0


if __name__ == "__main__":
    sys.exit(main())
