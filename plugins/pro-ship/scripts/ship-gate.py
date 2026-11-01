#!/usr/bin/env python3
"""PreToolUse Bash hook - the ship gate.

Before something ships (`git tag <name>` that creates a tag, `gh release create`, a package
publish, a production deploy) it reads `.pro-dev/ship/preflight.json` under the repo root
and checks that the record /pro-ship:ship wrote is a fresh GO for the commit being shipped.
The freshness rule and the causes (missing, unreadable, stale, no-go) are in
docs/ship-preflight.md. The commit is the one the command names (`git tag <name> <commit>`,
`gh release create --target <sha>`) and HEAD otherwise. A compound command is checked
shipping command by shipping command, each in its own directory (`-C`, `cd`) and the
most severe cause leads the message.

A fresh GO passes with no output. Without one the mode decides: mode.ship-gate, then mode,
in CLAUDE_GUARD_DIR or ~/.claude/hooks (default warn).
  warn     one line in warn.log and a message, once per commit per session; allows.
  enforce  denies once per commit per session with the cause and "Run /pro-ship:ship";
           the identical retry passes.
It never asks. When it cannot decide (unreadable payload, no git, no repo, a git timeout) it
logs could-not-run and allows.

Reads one file, runs one `git rev-parse`, makes no network calls and executes nothing taken
from the payload. It writes only warn.log and its session state file.
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

HOOK = "ship-gate"
RECORD = os.path.join(".pro-dev", "ship", "preflight.json")
SEVERITY = ("no-go", "stale", "unreadable", "missing")  # most severe first

# ---------------------------------------------------------------------------
# Mode lookup and warn.log writer.
# Copied from plugins/pro-ai-sdlc/scripts/guard.py (guard_dir, mode, log) via pr-gate.py.
# Plugins install separately and cannot import each other (ADR-0003), so keep the copies
# in step by hand.
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
# Copied from plugins/pro-ship/scripts/pr-gate.py (strip_heredocs, split_segments, _tokens,
# _resolve, skip_wrappers, substitutions), itself copied from
# plugins/pro-quality/scripts/floor-guard.py. Text inside quotes, echo and heredoc bodies
# never matches.
# ---------------------------------------------------------------------------

HEREDOC_RE = re.compile(r"(?<!<)<<(?!<)-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
SHELLS = {"bash", "sh", "zsh", "dash"}
SHELL_C_RE = re.compile(r"^-[A-Za-z]*c[A-Za-z]*$")


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


# Cheap pre-filter: a command with none of these words cannot be a shipping command.
SIGNALS = ("tag", "release", "publish", "upload", "push", "deploy", "vercel", "electron-builder")



# ---------------------------------------------------------------------------
# What counts as shipping.
# The tag-create, publish and deploy matching is adapted from
# plugins/pro-legal/scripts/release-gate.py (_is_tag_create, classify) and extended to the
# full list in the spec. --dry-run, --help, tag list/delete/verify never match.
# ---------------------------------------------------------------------------

TAG_VALUE_FLAGS = {"-m", "-F", "-u", "--message", "--file", "--local-user", "--cleanup", "--sort", "--format",
                   "--points-at", "--contains", "--no-contains", "--merged", "--no-merged"}
TAG_NOT_CREATE = {"--list", "--delete", "--verify", "--contains", "--no-contains", "--points-at",
                  "--merged", "--no-merged"}
VERCEL_VALUE = {"--target", "-e", "--env", "-b", "--build-env", "-m", "--meta", "--scope", "-t", "--token",
                "--cwd", "-A", "--local-config", "-S"}
GH_VALUE = {"-R", "--repo", "-t", "--title", "-n", "--notes", "-F", "--notes-file", "--target", "--discussion-category",
            "--notes-start-tag"}
SHA_RE = re.compile(r"[0-9a-fA-F]{7,64}")
UNWRAP = {"npx", "bunx", "pnpx"}
UNWRAP_SUB = {"dlx", "exec", "x"}


def positional(args: list[str], value_flags: set[str]) -> list[str]:
    out: list[str] = []
    i = 0
    while i < len(args):
        t = args[i]
        if t in value_flags:
            i += 2
            continue
        if not t.startswith("-"):
            out.append(t)
        i += 1
    return out


def tag_args(rest: list[str]) -> tuple[bool, str | None]:
    """(creates a tag, the commit it names) for the args after `git tag`."""
    skip = False
    pos: list[str] = []
    for tok in rest:
        if skip:
            skip = False
            continue
        if tok in TAG_NOT_CREATE or any(tok.startswith(f + "=") for f in TAG_NOT_CREATE):
            return False, None
        if tok in TAG_VALUE_FLAGS:
            skip = True
        elif tok.startswith("--"):
            continue
        elif tok.startswith("-") and len(tok) > 1:
            if tok[1:].isdigit():
                return False, None
            for k, ch in enumerate(tok[1:]):
                if ch in "mFu":
                    skip = k == len(tok) - 2  # the value is the next arg unless it is attached
                    break
                if ch in "ldvn":
                    return False, None
        else:
            pos.append(tok)
    if not pos:
        return False, None
    return True, pos[1] if len(pos) > 1 else None


def classify(toks: list[str]) -> tuple[str, str | None, str | None] | None:
    """(kind, commit ref or None for HEAD, git -C directory or None) for a shipping command."""
    if not toks:
        return None
    name = os.path.basename(toks[0])
    args = toks[1:]
    if name in UNWRAP:
        j = 0
        while j < len(args) and args[j].startswith("-"):
            j += 2 if args[j] in ("-p", "--package", "-c", "--call") else 1
        return classify(args[j:])
    if name in ("pnpm", "yarn", "npm", "bun") and args and args[0] in UNWRAP_SUB:
        j = 1
        while j < len(args) and args[j].startswith("-"):
            j += 1
        return classify(args[j:])
    if any(a in ("--help", "-h", "--dry-run") or a.startswith("--dry-run=") for a in args):
        return None
    pos = positional(args, set())
    if name == "git":
        i, gdir = 0, None
        while i < len(args) and args[i].startswith("-"):
            if args[i] == "-C" and i + 1 < len(args):
                gdir = args[i + 1]
                i += 2
            elif args[i] in ("-c", "--git-dir", "--work-tree", "--namespace") and i + 1 < len(args):
                i += 2
            else:
                i += 1
        if i < len(args) and args[i] == "tag":
            creates, ref = tag_args(args[i + 1 :])
            return ("tag", ref, gdir) if creates else None
        return None
    if name == "gh":
        p = positional(args, GH_VALUE)
        if p[:2] != ["release", "create"]:
            return None
        ref = None
        for k, a in enumerate(args):
            val = a.split("=", 1)[1] if a.startswith("--target=") else (args[k + 1] if a == "--target" and k + 1 < len(args) else None)
            if val and SHA_RE.fullmatch(val):
                ref = val
        return "release", ref, None
    if name in ("npm", "pnpm", "yarn", "bun") and (pos[:1] == ["publish"] or (name == "yarn" and pos[:2] == ["npm", "publish"])):
        return "publish", None, None
    if name in ("cargo", "uv", "poetry") and pos[:1] == ["publish"]:
        return "publish", None, None
    if (name == "gem" and pos[:1] == ["push"]) or (name == "twine" and pos[:1] == ["upload"]):
        return "publish", None, None
    if name.startswith("python") and args[:2] == ["-m", "twine"] and "upload" in args[2:]:
        return "publish", None, None
    if name == "electron-forge" and pos[:1] == ["publish"]:
        return "publish", None, None
    if name == "electron-builder":
        for k, a in enumerate(args):
            if a == "--publish=always" or (a in ("--publish", "-p") and k + 1 < len(args) and args[k + 1] == "always"):
                return "publish", None, None
        return None
    if name == "vercel":
        prod = "--prod" in args or "--production" in args
        for k, a in enumerate(args):
            if a == "--target=production" or (a == "--target" and k + 1 < len(args) and args[k + 1] == "production"):
                prod = True
        p = positional(args, VERCEL_VALUE)
        return ("deploy", None, None) if prod and p[:1] in ([], ["deploy"]) else None
    if name == "netlify" and pos[:1] == ["deploy"] and any(a in ("--prod", "-p", "--prod-if-unlocked") for a in args):
        return "deploy", None, None
    if name in ("fly", "flyctl", "wrangler") and pos[:1] == ["deploy"]:
        return "deploy", None, None
    return None


def actions(command: str, base: str | None) -> list[tuple[str | None, str | None, str]]:
    """(directory, commit ref, kind) of each shipping command (directory None: unknown).

    The directory follows `cd <path>`, `git -C <path>` and bash/sh -c. A target that cannot
    be resolved (a variable, pushd) comes back as None.
    """
    cur = base
    found: list[tuple[str | None, str | None, str]] = []
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
        hit = classify(toks[i:])
        if hit:
            kind, ref, gdir = hit
            found.append((_resolve(cur, gdir) if gdir else cur, ref, kind))
    return found


# ---------------------------------------------------------------------------
# git, record, state
# ---------------------------------------------------------------------------


class CouldNotRun(Exception):
    pass


def repo_and_commit(directory: str, ref: str | None) -> tuple[str, str]:
    """(repo root, commit sha) from one git call; the commit is `ref`, or HEAD."""
    try:
        r = subprocess.run(
            ["git", "-C", directory, "rev-parse", "--show-toplevel", (ref or "HEAD") + "^{commit}"],
            capture_output=True, text=True, timeout=5, errors="replace",
            env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
        )
    except subprocess.TimeoutExpired:
        raise CouldNotRun("git timed out")
    except Exception:
        raise CouldNotRun("git could not be run")
    lines = r.stdout.split("\n")
    if r.returncode != 0 or len(lines) < 2 or not lines[0] or not re.fullmatch(r"[0-9a-f]{40,64}", lines[1].strip()):
        raise CouldNotRun("not a git repo, or the commit does not resolve")
    return lines[0], lines[1].strip()


def record_cause(root: str, commit: str) -> str | None:
    """None for a fresh GO, else missing, unreadable, stale or no-go.

    The rule is R31 in docs/ship-preflight.md: an object, schema 1, produced_by starting
    pro-ship:ship, a string head and status, head equal to the commit, status pass or partial. Keep this copy in step
    with the one in the merge gate and ship.py by hand (ADR-0003).
    """
    path = os.path.join(root, RECORD)
    if not os.path.exists(path):
        return "missing"
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return "unreadable"
    if (not isinstance(data, dict) or isinstance(data.get("schema"), bool) or data.get("schema") != 1
            or not isinstance(data.get("produced_by"), str) or not data["produced_by"].startswith("pro-ship:ship")
            or not isinstance(data.get("head"), str) or not isinstance(data.get("status"), str)):
        return "unreadable"
    if data["head"] != commit:
        return "stale"
    return None if data.get("status") in ("pass", "partial") else "no-go"


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
    if not isinstance(command, str) or not any(s in command for s in SIGNALS):
        return 0
    cwd = payload.get("cwd") if isinstance(payload.get("cwd"), str) and payload.get("cwd") else os.getcwd()
    hits = actions(command, cwd)
    if not hits:
        return 0
    # Every shipping command in a compound command is checked against its own directory.
    problems: list[tuple[str, str, str, str]] = []  # (cause, kind, root, commit)
    for directory, ref, kind in hits:
        try:
            if directory is None:
                raise CouldNotRun("the directory of the shipping command could not be resolved")
            root, commit = repo_and_commit(directory, ref)
        except CouldNotRun as e:
            log(HOOK, "could-not-run", f"{e} (allowed)", cwd)
            continue
        cause = record_cause(root, commit)
        if cause is not None:
            problems.append((cause, kind, root, commit))
    if not problems:
        return 0

    enforcing = mode(HOOK) == "enforce"
    key = "ship_denied" if enforcing else "ship_warned"  # not pr-gate's keys: same file, own lists
    fresh: list[tuple[str, str, str, str]] = []
    states: dict[str, tuple[str, dict]] = {}
    for prob in problems:
        root, commit = prob[2], prob[3]
        if root not in states:
            path = state_path(str(payload.get("session_id") or "nosession"), root)
            states[root] = (path, load_state(path))
        state = states[root][1]
        seen = state.get(key)
        seen = seen if isinstance(seen, list) else []
        if commit in seen or any(f[2:] == prob[2:] for f in fresh):
            continue
        state[key] = seen[-50:] + [commit]
        fresh.append(prob)
    if not fresh:
        return 0
    for path, state in states.values():
        if not save_state(path, state):
            log(HOOK, "could-not-run", "session state not writable (allowed)", cwd)
            return 0

    fresh.sort(key=lambda f: SEVERITY.index(f[0]))  # the most severe cause leads; ties keep command order
    named = ", ".join(f"{c[:8]} ({cause})" for cause, _k, _r, c in fresh)
    why = f"[{HOOK}] no fresh GO for {named}. Run /pro-ship:ship."
    if enforcing:
        for cause, kind, root, commit in fresh:
            log(HOOK, "deny", f"{kind} {cause} {commit[:8]}", root)
        reason = f"{why} The identical command passes if you run it again."
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                                 "permissionDecision": "deny",
                                                 "permissionDecisionReason": reason}}))
    else:
        for cause, kind, root, commit in fresh:
            log(HOOK, "warn", f"{kind} {cause} {commit[:8]}", root)
        msg = f"{why} (warn mode: allowed)"
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
