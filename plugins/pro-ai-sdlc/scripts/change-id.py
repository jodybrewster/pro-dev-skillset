#!/usr/bin/env python3
"""PreToolUse hook on Bash: a commit on a change branch names the change (ADR-0026).

On a branch whose name starts with a change id (`PDS-51/build`), the subject of a
`git commit -m ...` must start with `PDS-51: `. The subject is the first -m or
--message value, or the first non-empty line of a heredoc that value opens. A
commit whose message comes from an editor, -F, -C or --no-edit is not read.
The branch is read with one `git branch --show-current` in the payload's cwd, moved
by a `cd` earlier in the command or a `git -C <dir>`.

warn mode (default): log, tell the session, allow.
enforce mode: permissionDecision "deny". It reads its own key alone, as stale-done
does: only a mode.change-id file holding enforce turns it on; the global mode file
and CLAUDE_GUARD_MODE leave it in warn until its own evidence period.
Anything it cannot read allows. No network call; nothing in the payload is run.
"""
import json
import os
import re
import shlex
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guard  # noqa: E402

HOOK = "change-id"
BRANCH_ID = re.compile(r"^([A-Z]{2,6}-[1-9][0-9]*)/")
WRAPPERS = {"sudo", "env", "command", "exec", "time", "nohup", "builtin"}
HEREDOC = re.compile(r"<<(-?)\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\2")
# git options before the subcommand that take the next token as their value
GIT_VALUE_OPTS = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"}


def own_mode() -> str:
    """enforce only when mode.change-id says so; the global mode and the env never enforce it."""
    try:
        with open(os.path.join(guard.guard_dir(), "mode." + HOOK), encoding="utf-8") as fh:
            return "enforce" if fh.readline().strip() == "enforce" else "warn"
    except OSError:
        return "warn"


def split_segments(command: str):
    """Split on newlines and ; & | outside quotes. The body of a heredoc that starts at the
    top level is stdin to its command and is dropped; one inside quotes stays in its token."""
    out, cur, i, n = [], [], 0, len(command)
    quote, pending = None, []
    while i < n:
        c = command[i]
        if quote == "'":
            cur.append(c)
            if c == "'":
                quote = None
        elif quote == '"':
            cur.append(c)
            if c == "\\" and i + 1 < n:
                cur.append(command[i + 1])
                i += 1
            elif c == '"':
                quote = None
        elif c == "\\" and i + 1 < n:
            cur.append(c + command[i + 1])
            i += 1
        elif c in "'\"":
            quote = c
            cur.append(c)
        elif c == "<" and command.startswith("<<", i) and not command.startswith("<<<", i):
            m = HEREDOC.match(command, i)
            if m:
                pending.append((m.group(1) == "-", m.group(3)))
                i = m.end()
                continue
            cur.append(c)
        elif c in "\n;&|":
            out.append("".join(cur))
            cur = []
            if c == "\n" and pending:
                # skip each pending heredoc body up to its terminator line
                j = i + 1
                for strip_tabs, word in pending:
                    while j <= n:
                        end = command.find("\n", j)
                        end = n if end < 0 else end
                        line = command[j:end]
                        j = end + 1
                        if (line.lstrip("\t") if strip_tabs else line) == word:
                            break
                pending = []
                i = j
                continue
        else:
            cur.append(c)
        i += 1
    out.append("".join(cur))
    for part in out:
        try:
            toks = shlex.split(part, comments=True)
        except ValueError:
            toks = part.split()
        while toks and (toks[0] in WRAPPERS or toks[0] in ("(", "{") or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[0])):
            toks = toks[1:]
        if toks:
            yield toks


def git_commit(toks, cwd):
    """(directory, args after `commit`) for a git commit, else None."""
    if os.path.basename(toks[0]) != "git":
        return None
    i, where = 1, cwd
    while i < len(toks) and toks[i].startswith("-"):
        if toks[i] in GIT_VALUE_OPTS:
            if toks[i] == "-C" and i + 1 < len(toks):
                where = os.path.join(where, os.path.expanduser(toks[i + 1]))
            i += 2
        else:
            i += 1
    if i >= len(toks) or toks[i] != "commit":
        return None
    return where, toks[i + 1:]


def message(args):
    """The first -m or --message value, or None when the message is not given on the line."""
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--":
            return None
        if a in ("-m", "--message"):
            return args[i + 1] if i + 1 < len(args) else None
        if a.startswith("--message="):
            return a[len("--message="):]
        if a.startswith("-") and not a.startswith("--") and "m" in a[1:]:
            # a short cluster such as -am or -mText: m takes the rest of the cluster or the next token
            k = a.index("m", 1)
            if not any(ch in "FCcSt" for ch in a[1:k]):
                rest = a[k + 1:]
                return rest if rest else (args[i + 1] if i + 1 < len(args) else None)
        i += 1
    return None


def subject(msg):
    m = re.match(r"^\$\(\s*cat\s*<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1[ \t]*\n(.*)$", msg, re.S)
    if m:
        msg = m.group(3)
    for line in msg.split("\n"):
        if line.strip():
            return line.strip()
    return ""


def branch(where):
    try:
        r = subprocess.run(["git", "-C", where, "branch", "--show-current"],
                           capture_output=True, text=True, timeout=3)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def main() -> None:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else None
    except Exception:
        data = None
    ti = data.get("tool_input") if isinstance(data, dict) else None
    command = ti.get("command") if isinstance(ti, dict) else None
    if not isinstance(command, str) or not command:
        guard.log(HOOK, "could-not-parse", "empty or invalid payload, or no command", os.getcwd())
        sys.exit(0)
    if "commit" not in command or "git" not in command:
        sys.exit(0)
    cwd = data.get("cwd") or os.getcwd()
    for toks in split_segments(command):
        if toks[0] == "cd" and len(toks) == 2 and toks[1] != "-":
            cwd = os.path.join(cwd, os.path.expanduser(toks[1]))
            continue
        found = git_commit(toks, cwd)
        if not found:
            continue
        where, args = found
        msg = message(args)
        if msg is None:
            continue
        b = branch(where)
        m = BRANCH_ID.match(b)
        if not m:
            continue
        want = m.group(1) + ": "
        subj = subject(msg)
        if subj.startswith(want):
            continue
        detail = f"branch {b} wants {want!r}, subject {subj[:120]!r}"
        if own_mode() == "warn":
            guard.warn(HOOK, "PreToolUse", "deny", f'a commit whose subject does not start with "{want}" on {b}', detail, where)
        guard.log(HOOK, "deny", detail, where)
        reason = (f'change-id: commit subject must start with "{want}" on branch {b} '
                  f"(ADR-0026). Start the -m subject with \"{want}\" and run the commit again.")
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                          "permissionDecision": "deny", "permissionDecisionReason": reason}}))
        sys.exit(0)
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
