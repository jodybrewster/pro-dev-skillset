#!/usr/bin/env python3
"""PreToolUse Bash hook for pro-core: a delete whose target is outside the project.

Reads {"tool_input": {"command": ...}, "cwd": ...} from stdin and flags `rm`,
`rmdir` and `unlink` operands, the starting paths of a `find` that deletes
(`-delete`, or `-exec`/`-execdir` running rm, rmdir or unlink) and the directory
of a `git clean` (from `git -C <dir>` or the current directory) that resolve
outside the project root.

Paths are resolved without running anything: from the payload `cwd`, through
each `cd <dir>` segment, with `~`, `$HOME`, `${HOME}`, `$TMPDIR` and the few
other variables in EXPANDABLE expanded. A word holding
`$(`, a backtick, a variable assigned earlier in the same command or any other
variable is unknown and skipped, since its value could be a secret that the
message and warn.log would print: the guard catches the literal mistakes, not
every one. `pushd` is tracked like `cd`.

The project root is CLAUDE_PROJECT_DIR, or the payload `cwd` when unset. A
target is inside when its real path is the root or under it (the root in its
written or real form), so a symlink in the repo that points out of it is outside. Targets
below (never equal to) /tmp, /private/tmp, /var/folders, /private/var/folders,
$TMPDIR or the pro-dev state folder (PRO_DEV_STATE_DIR, or ~/.claude/pro-dev)
are exempt; the guard folder is not.

A finding is `delete-outside`: warn by default, deny only when
`mode.delete-outside` in the guard folder holds `enforce` (ADR-0016). It reads no
file but its mode file, writes only its warn.log line, runs no subprocess and
exits 0 with no output on its own errors. git-safe.py still blocks `rm -rf` of
/, ~ and $HOME with exit 2 on its own.
"""
from __future__ import annotations

import json
import os
import re
import sys
from typing import Dict, List, Optional, Set, Tuple

HOOK = "delete-outside"
RM_CMDS = ("rm", "rmdir", "unlink")
TEMP_ROOTS = ("/tmp", "/private/tmp", "/var/folders", "/private/var/folders")
WRAPPERS = ("sudo", "command", "nice", "nohup", "time", "env")
WRAPPER_VALUE_FLAGS = ("-u", "-g", "-n", "-C", "-p")  # sudo -u <user>, nice -n <n> and the like
# Only these are expanded. Any other variable may hold a secret and the resolved
# path is printed and logged, so a word that uses one is unknown and skipped.
EXPANDABLE = ("HOME", "TMPDIR", "PWD", "USER", "CLAUDE_PROJECT_DIR", "PRO_DEV_STATE_DIR")
DECLARE = ("export", "local", "declare", "typeset", "readonly", "read", "for")
_PREFILTER = re.compile(r"\b(?:rm|rmdir|unlink|find|clean)\b")
_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*")
_VAR = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)")
_REDIRECT = re.compile(r"^\d*[<>]")
_BARE_REDIRECT = re.compile(r"^\d*[<>]+&?$")
ADVICE = "Delete inside the repo or a temp folder (under /tmp or $TMPDIR), or ask the person to run it themselves."


def expand(word: str, env: Dict[str, str], local: Set[str]) -> Optional[str]:
    """The word as the shell would see it, or None when its value cannot be known before it runs."""
    if "$(" in word or "`" in word:
        return None
    s = word
    if s == "~" or s.startswith("~/"):
        home = env.get("HOME")
        if not home:
            return None
        s = home + s[1:]
    unknown: List[str] = []

    def var(m: "re.Match[str]") -> str:
        name = m.group(1) or m.group(2)
        if name in local or name not in env or name not in EXPANDABLE:
            unknown.append(name)
            return ""
        return env[name]

    s = _VAR.sub(var, s)
    if unknown or "$" in s or not s:
        return None
    return s


def operands(args: List[str]) -> List[str]:
    """Words that are not flags or redirects; everything after `--` is an operand."""
    out: List[str] = []
    end = skip = False
    for a in args:
        if skip:
            skip = False
        elif not end and a == "--":
            end = True
        elif _BARE_REDIRECT.match(a):
            skip = True
        elif _REDIRECT.match(a):
            continue
        elif end or not (a.startswith("-") and len(a) > 1):
            out.append(a)
    return out


def find_deletes(args: List[str]) -> bool:
    if "-delete" in args:
        return True
    for i, a in enumerate(args[:-1]):
        if a in ("-exec", "-execdir", "-ok", "-okdir") and os.path.basename(args[i + 1]) in RM_CMDS:
            return True
    return False


def targets(command: str, cwd: str, env: Dict[str, str], segments) -> List[Tuple[str, str, Optional[str]]]:
    """[(command name, word as written, resolved path or None)] for each deletion target."""
    found: List[Tuple[str, str, Optional[str]]] = []
    d: Optional[str] = cwd
    local: Set[str] = set()

    def resolve(word: str, base: Optional[str]) -> Optional[str]:
        ex = expand(word, env, local)
        if ex is None:
            return None
        if not os.path.isabs(ex):
            if base is None:
                return None
            ex = os.path.join(base, ex)
        return os.path.normpath(ex)

    for tokens in segments(command):
        while tokens and (_ASSIGN.match(tokens[0]) or tokens[0] in WRAPPERS):
            if _ASSIGN.match(tokens[0]):
                local.add(tokens[0].split("=", 1)[0])
            tokens = tokens[1:]
            while tokens and tokens[0].startswith("-") and len(tokens[0]) > 1:
                flag = tokens[0]
                tokens = tokens[2:] if flag in WRAPPER_VALUE_FLAGS else tokens[1:]
        if not tokens:
            continue
        cmd, args = os.path.basename(tokens[0]), tokens[1:]
        if cmd in DECLARE:
            for t in args:
                m = _NAME.match(t)
                if m:
                    local.add(m.group(0))
            continue
        if cmd in ("cd", "pushd"):
            words = operands(args)
            if not words:
                d = env.get("HOME") or None
            elif words[0] == "-":
                d = None
            else:
                d = resolve(words[0], d)
            continue
        if cmd in RM_CMDS:
            for w in operands(args):
                found.append((cmd, w, resolve(w, d)))
        elif cmd == "find" and find_deletes(args):
            starts: List[str] = []
            i = 0
            while i < len(args) and args[i] in ("-H", "-L", "-P"):
                i += 1
            for w in args[i:]:
                if w.startswith("-") or w in ("!", "(", ")"):
                    break
                starts.append(w)
            for w in starts or ["."]:
                found.append(("find", w, resolve(w, d)))
        elif cmd == "git":
            git_dir, i = d, 0
            while i < len(args) and args[i].startswith("-"):
                if args[i] == "-C" and i + 1 < len(args):
                    git_dir = resolve(args[i + 1], git_dir)
                    i += 2
                elif args[i] in ("-c", "--git-dir", "--work-tree", "--namespace"):
                    i += 2
                else:
                    i += 1
            if i < len(args) and args[i] == "clean":
                rest = args[i + 1:]
                if "-n" in rest or "--dry-run" in rest:
                    continue
                found.append(("git clean", git_dir or ".", git_dir))
    return found


def _under(path: str, root: str) -> bool:
    return path == root or path.startswith(root.rstrip(os.sep) + os.sep)


def _below(path: str, root: str) -> bool:
    root = root.rstrip(os.sep) or os.sep
    return path != root and _under(path, root)


def _real(path: str, word: str) -> str:
    """The real path. A plain last part keeps its name: deleting a symlink removes the link,
    not its target. A trailing slash follows the link, as rm does."""
    if word.endswith("/"):
        return os.path.realpath(path)
    return os.path.join(os.path.realpath(os.path.dirname(path)), os.path.basename(path))


def outside(path: str, word: str, root: str, env: Dict[str, str]) -> bool:
    """Decided on the real path only, so a symlink inside the repo that points out of it
    is outside. The root and the exemptions count in both their written and real forms."""
    real = _real(path, word)
    if any(_under(real, r) for r in (root, os.path.realpath(root))):
        return False
    exempt = list(TEMP_ROOTS)
    if env.get("TMPDIR"):
        exempt.append(os.path.normpath(env["TMPDIR"]))
    state = env.get("PRO_DEV_STATE_DIR")
    if state:
        exempt.append(os.path.normpath(state))
    elif env.get("HOME"):
        exempt.append(os.path.join(os.path.normpath(env["HOME"]), ".claude", "pro-dev"))
    exempt += [os.path.realpath(e) for e in exempt]
    return not any(_below(real, e) for e in exempt)


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        if not isinstance(payload, dict):
            return 0
        ti = payload.get("tool_input")
        if not isinstance(ti, dict):
            return 0
        command = ti.get("command")
        if not isinstance(command, str) or not _PREFILTER.search(command):
            return 0
        cwd = payload.get("cwd")
        if not (isinstance(cwd, str) and os.path.isabs(cwd)):
            cwd = os.getcwd()
        cwd = os.path.normpath(cwd)
        root = os.path.normpath(os.environ.get("CLAUDE_PROJECT_DIR") or cwd)
        env = dict(os.environ)

        sys.dont_write_bytecode = True
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import guardlib

        for cmd, word, resolved in targets(command, cwd, env, guardlib.segments):
            if resolved is None or not outside(resolved, word, root, env):
                continue
            summary = f"{cmd} of {word}, which resolves to {_real(resolved, word)} outside {root}"
            if guardlib.own_mode(HOOK) == "enforce":
                guardlib.deny(HOOK, f"Blocked: {summary}. {ADVICE}", summary, cwd)
            else:
                guardlib.warn(HOOK, summary, summary, cwd, ADVICE)
            return 0
    except Exception:
        pass  # a broken guard never blocks unrelated work
    return 0


if __name__ == "__main__":
    sys.exit(main())


# Adapted from super-board hooks/guard-delete-outside.py (MIT, Copyright (c) 2026
# Eric Tech); see docs/licenses.md.
