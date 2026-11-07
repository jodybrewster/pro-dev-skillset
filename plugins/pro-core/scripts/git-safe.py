#!/usr/bin/env python3
"""PreToolUse Bash safety hook for pro-core.

Reads {"tool_input": {"command": "..."}} from stdin. When the command matches
a known-dangerous pattern, prints `BLOCKED: <reason>` to stderr and exits 2
(Claude Code's BLOCK exit code). Otherwise exits 0. Malformed payloads
default to allow so a parser glitch can never wedge the session.

The denylist is intentionally small - it covers irreversible mistakes
(force-push to a protected branch, rm -rf on root/home, secret leaks,
privilege escalation) without blocking common safe variants. Edge cases
err on the side of allowing; this is a guard rail, not a sandbox.

After those rules, when nothing blocked, a refspec parser reads each `git push`
for the forms the regexes miss: a delete of a protected branch, `:main`,
`refs/heads/main`, `HEAD` or a bare push while a protected branch is checked
out, `git -C dir push`, `--all`, `--mirror` and `--branches`. The protected set
is main, master, the default branch from `refs/remotes/<remote>/HEAD` and each
name in a `protected-branches` file in the guard folder. These are
`protected-push` findings: warn by default, deny only when `mode.protected-push`
in the guard folder holds `enforce` (ADR-0016). The parser never exits 2, runs
git only for a `git push` (local reads, 5 second timeout) and allows on its own
errors.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from typing import Callable, List, Optional, Set, Tuple

guardlib = None  # loaded by protected_push() only when the command holds a push (N1)


# ---------------------------------------------------------------------------
# rm -rf on root / home

_DANGER_TARGETS = (
    r"(?:"
    r"/(?:\s|$|\*)"                            # /, / followed by space/end/*
    r"|~(?:\s|$|/\*?\s|/\*?$)"                 # bare ~, ~/, ~/*
    r"|\$HOME(?:\s|$|/\*?\s|/\*?$)"            # $HOME, $HOME/, $HOME/*
    r"|\$\{HOME\}(?:\s|$|/\*?\s|/\*?$)"
    r'|"\$HOME"'
    r"|'\$HOME'"
    r")"
)
_RM_PRESENT = re.compile(r"\brm\s+")
_RM_RECURSIVE = re.compile(r"(?:\s|^)(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive\b)")
_RM_FORCE = re.compile(r"(?:\s|^)(?:-[a-zA-Z]*[fF][a-zA-Z]*|--force\b)")
_DANGER_RE = re.compile(_DANGER_TARGETS)


def _check_rm_rf(seg: str) -> Optional[str]:
    if not _RM_PRESENT.search(seg):
        return None
    if not (_RM_RECURSIVE.search(seg) and _RM_FORCE.search(seg)):
        return None
    if _DANGER_RE.search(seg):
        return "rm -rf on root, home, or $HOME"
    return None


# ---------------------------------------------------------------------------
# git push: --force without --force-with-lease, or push to main/master

_GIT_PUSH_FORCE = re.compile(
    r"\bgit\s+push\b(?=.*?\s(?:--force(?!-with-lease|-if-includes)\b|-f\b))"
)
_GIT_PUSH_PROTECTED = re.compile(
    r"\bgit\s+push\s+(?:[^\s]+\s+)*?(?:origin\s+)?\+?(?:main|master)\b"
    r"|\bgit\s+push\b[^&;|]*:(?:main|master)\b"
)
_GIT_PUSH_DELETE = re.compile(r"--delete\b|\s:(?:main|master)\b")


def _check_git_push_force(seg: str) -> Optional[str]:
    return "git push --force (use --force-with-lease)" if _GIT_PUSH_FORCE.search(seg) else None


def _check_git_push_protected(seg: str) -> Optional[str]:
    if _GIT_PUSH_PROTECTED.search(seg) and not _GIT_PUSH_DELETE.search(seg):
        return "direct push to protected branch (main/master)"
    return None


# ---------------------------------------------------------------------------
# Other dangerous git invocations

_GIT_RESET_HARD_BARE = re.compile(r"\bgit\s+reset\s+--hard\s*$")
_GIT_CLEAN_X = re.compile(
    r"\bgit\s+clean\s+-\S*[xX]\S*\b|\bgit\s+clean\b[^&;|]*\s-[xX]\b"
)
_GIT_CHECKOUT_DOT = re.compile(r"\bgit\s+checkout\s+\.\s*$")
_GIT_RESTORE_DOT = re.compile(r"\bgit\s+restore\s+\.\s*$")


# ---------------------------------------------------------------------------
# Secrets, privilege, world-writable, untrusted pipe-to-shell

_ENV_REDIRECT = re.compile(r">>?\s*\.env(?:\.[a-zA-Z0-9_.-]+)?(?:\s|$)")
_PIPE_TO_SHELL = re.compile(
    r"\b(?:curl|wget|fetch)\b[^|]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh|ksh)\b"
)
_SUDO = re.compile(r"^sudo\b")
_CHMOD_DANGER = re.compile(r"\bchmod\s+(?:-R\s+)?(?:0?777|a\+rwx|a=rwx)\b")


def _simple(pattern: re.Pattern, reason: str) -> Callable[[str], Optional[str]]:
    def _f(seg: str) -> Optional[str]:
        return reason if pattern.search(seg) else None
    return _f


SEGMENT_RULES: list[Callable[[str], Optional[str]]] = [
    _check_rm_rf,
    _check_git_push_force,
    _check_git_push_protected,
    _simple(_GIT_RESET_HARD_BARE, "git reset --hard with no target (drops uncommitted work)"),
    _simple(_GIT_CLEAN_X, "git clean with -x / -X (removes ignored files, including .env)"),
    _simple(_GIT_CHECKOUT_DOT, "git checkout . (silently discards uncommitted changes)"),
    _simple(_GIT_RESTORE_DOT, "git restore . (silently discards uncommitted changes)"),
    _simple(_ENV_REDIRECT, "redirect to .env file (set secrets manually, not via shell)"),
    _simple(_SUDO, "sudo (run privileged commands manually, not via Claude)"),
    _simple(_CHMOD_DANGER, "chmod 777 / a+rwx (world-writable)"),
]
FULL_RULES: list[Callable[[str], Optional[str]]] = [
    _simple(_PIPE_TO_SHELL, "piping remote content to a shell (curl|bash)"),
]


def _normalize(cmd: str) -> str:
    # Bash splices a trailing-backslash line into the next one before it parses
    # anything, so splice here too. Otherwise splitting on newlines would put
    # `rm -rf \` and its target in different segments and neither half would
    # match on its own - a hole, not a false positive.
    spliced = re.sub(r"\\\r?\n", " ", cmd)
    # Collapse horizontal whitespace only; newlines survive for _segments.
    return re.sub(r"[^\S\n]+", " ", spliced).strip()


def _segments(cmd: str) -> list[str]:
    # A newline separates commands in bash exactly like `;` does. Splitting only
    # on operators joined a safe `rm -rf ./some/path` to every following line, so
    # any later `/ ` (even inside an echo string) tripped the rm -rf root rule
    # that neither line trips alone.
    #
    # Heredoc bodies stay in scope on purpose: `bash <<EOF` and `ssh host <<EOF`
    # execute their body, so treating heredoc text as inert data would be a hole.
    # Over-blocking a heredoc that merely quotes a dangerous command is the
    # cheaper mistake.
    return [s.strip() for s in re.split(r"&&|\|\||;|\||\n", cmd) if s.strip()]


def evaluate(command: str) -> Optional[str]:
    if not command or not command.strip():
        return None
    full = _normalize(command)
    for rule in FULL_RULES:
        why = rule(full)
        if why:
            return why
    for seg in _segments(full):
        for rule in SEGMENT_RULES:
            why = rule(seg)
            if why:
                return why
    return None


# ---------------------------------------------------------------------------
# protected-push: the refspec parser. Runs only after evaluate() found nothing,
# so a push the regex rules block is never reported twice and nothing here can
# turn an allow into exit 2.

PP_HOOK = "protected-push"
_PUSH_WORD = re.compile(r"\bpush\b")
_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
_REDIRECT = re.compile(r"^\d*[<>]")
_REMOTE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")
_WRAPPERS = ("sudo", "env", "command")
_PUSH_VALUE_OPTS = ("--repo", "--receive-pack", "--exec", "-o", "--push-option")
_FORCE_FLAG = re.compile(r"^(?:--force|--force-with-lease(?:=.*)?|--force-if-includes)$")
_EVERY = ("--all", "--mirror", "--branches")
_GIT_TIMEOUT = 5


def _join(base: str, path: str) -> str:
    return os.path.normpath(os.path.join(base, os.path.expanduser(path)))


def parse_pushes(command: str, cwd: str) -> List[dict]:
    """Each `git push` in the command: its directory, git options, flags and positional words."""
    found: List[dict] = []
    d = cwd
    for tokens in guardlib.segments(command):
        while tokens and (_ASSIGN.match(tokens[0]) or tokens[0] in _WRAPPERS):
            tokens = tokens[1:]
        if not tokens:
            continue
        cmd, args = tokens[0], tokens[1:]
        if cmd == "cd":
            if args and args[0] != "-" and "$" not in args[0] and "`" not in args[0]:
                d = _join(d, args[0])
            continue
        if os.path.basename(cmd) != "git":
            continue
        git_dir, extra, i = d, [], 0
        while i < len(args) and args[i].startswith("-"):
            a = args[i]
            if a == "-C" and i + 1 < len(args):
                git_dir = _join(git_dir, args[i + 1])
                i += 2
            elif a in ("--git-dir", "--work-tree") and i + 1 < len(args):
                extra += [a, _join(git_dir, args[i + 1])]
                i += 2
            elif a.startswith(("--git-dir=", "--work-tree=")):
                key, value = a.split("=", 1)
                extra += [key, _join(git_dir, value)]
                i += 1
            elif a == "-c":
                i += 2
            else:
                i += 1
        if i >= len(args) or args[i] != "push":
            continue
        flags: List[str] = []
        letters: Set[str] = set()
        positional: List[str] = []
        j = i + 1
        while j < len(args):
            a = args[j]
            if a == "--":
                positional += [x for x in args[j + 1:] if not _REDIRECT.match(x)]
                break
            if a in _PUSH_VALUE_OPTS:
                j += 2
                continue
            if a.startswith("--"):
                flags.append(a)
            elif a.startswith("-") and len(a) > 1:
                for k, ch in enumerate(a[1:]):
                    if ch == "o":  # -o takes a value, attached or next
                        if k == len(a) - 2:
                            j += 1
                        break
                    letters.add(ch)
            elif not _REDIRECT.match(a):
                positional.append(a)
            j += 1
        found.append({"dir": git_dir, "extra": extra, "flags": flags, "letters": letters, "positional": positional})
    return found


def _git(git_dir: str, extra: List[str], *args: str) -> Optional[str]:
    """A local git read. None when it fails, times out or prints nothing: unknown."""
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env["GIT_OPTIONAL_LOCKS"] = "0"
    try:
        r = subprocess.run(["git", "-C", git_dir, *extra, *args], capture_output=True, text=True,
                           timeout=_GIT_TIMEOUT, env=env, errors="replace")
    except Exception:
        return None
    out = r.stdout.strip()
    return out if r.returncode == 0 and out else None


def protected_set(git_dir: str, extra: List[str], remote: str) -> Set[str]:
    names = {"main", "master"}
    if _REMOTE_NAME.match(remote):
        ref = _git(git_dir, extra, "symbolic-ref", "-q", "--short", f"refs/remotes/{remote}/HEAD")
        if ref and ref.startswith(remote + "/") and len(ref) > len(remote) + 1:
            names.add(ref[len(remote) + 1:])
    try:
        with open(os.path.join(guardlib.guard_dir(), "protected-branches"), encoding="utf-8") as fh:
            for line in fh:
                name = line.strip()
                if name and not name.startswith("#"):
                    names.add(name)
    except (OSError, ValueError):
        pass
    return names


def _branch(name: str) -> str:
    return name[len("refs/heads/"):] if name.startswith("refs/heads/") else name


def protected_findings(push: dict) -> Optional[Tuple[str, str, Set[str]]]:
    """(kind, branch, protected set) for a push that would update or delete a protected branch."""
    flags, letters, positional = push["flags"], push["letters"], push["positional"]
    if "--dry-run" in flags or "n" in letters:
        return None
    every = next((f for f in flags if f in _EVERY), None)
    remote = positional[0] if positional else "origin"
    protected = protected_set(push["dir"], push["extra"], remote)
    if every:
        return "every branch", every, protected
    force = "f" in letters or any(_FORCE_FLAG.match(f) for f in flags)
    deleting = "--delete" in flags or "d" in letters
    current: List[Optional[str]] = []

    def checked_out() -> Optional[str]:
        if not current:
            current.append(_git(push["dir"], push["extra"], "branch", "--show-current"))
        return current[0]

    specs = positional[1:]
    if not specs:
        if deleting or "--tags" in flags:
            return None
        cur = checked_out()
        if cur in protected:
            return ("force push" if force else "direct push"), cur, protected
        return None
    for spec in specs:
        plus = spec.startswith("+")
        body = spec[1:] if plus else spec
        if deleting:
            src, dst = "", body
        elif ":" in body:
            src, dst = body.split(":", 1)
        else:
            src, dst = body, body
        if dst in ("HEAD", "@"):
            dst = checked_out() or ""
        dst = _branch(dst)
        if not dst or dst not in protected:
            continue
        if deleting or (":" in body and src == ""):
            kind = "delete"
        elif force or plus:
            kind = "force push"
        else:
            kind = "direct push"
        return kind, dst, protected
    return None


def _summary(kind: str, branch: str) -> str:
    if kind == "every branch":
        return f"push to every branch ({branch})"
    if kind == "delete":
        return f"delete of {branch}"
    return f"{kind} to {branch}"


def protected_push(command: str, cwd: str) -> None:
    """Warn on a push onto a protected branch, or deny it under its own enforce mode."""
    global guardlib
    if not _PUSH_WORD.search(command):
        return
    sys.dont_write_bytecode = True
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import guardlib as lib  # an import error is caught by main(), after the regex rules ran
    guardlib = lib
    for push in parse_pushes(command, cwd):
        hit = protected_findings(push)
        if not hit:
            continue
        kind, branch, protected = hit
        summary = _summary(kind, branch)
        if guardlib.own_mode(PP_HOOK) == "enforce":
            guardlib.deny(
                PP_HOOK,
                f"Blocked: {summary}. Protected branches change only through a reviewed pull request. "
                "Push a feature branch and open a PR instead (git push -u origin <feature-branch>), "
                "or ask the person to run this push themselves. "
                f"Protected here: {', '.join(sorted(protected))}.",
                summary, cwd,
            )
        else:
            guardlib.warn(PP_HOOK, summary, summary, cwd)
        return


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    if not isinstance(payload, dict):
        return 0
    tool_input = payload.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        return 0
    command = tool_input.get("command") or ""
    if not isinstance(command, str):
        return 0
    reason = evaluate(command)
    if reason:
        print(f"BLOCKED: {reason}", file=sys.stderr)
        return 2
    try:
        cwd = payload.get("cwd")
        if not (isinstance(cwd, str) and os.path.isdir(cwd)):
            cwd = os.getcwd()
        protected_push(command, cwd)
    except Exception:
        pass  # the protected-push code allows on its own errors
    return 0


if __name__ == "__main__":
    sys.exit(main())


# The protected-push parser (parse_pushes and protected_findings) is adapted from
# super-board hooks/guard-protected-push.py, MIT, Copyright (c) 2026 Eric Tech.
# See docs/licenses.md.
