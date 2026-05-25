#!/usr/bin/env python3
"""PreToolUse Bash safety hook for pro-core.

Reads {"tool_input": {"command": "..."}} from stdin. When the command matches
a known-dangerous pattern, prints `BLOCKED: <reason>` to stderr and exits 2
(Claude Code's BLOCK exit code). Otherwise exits 0. Malformed payloads
default to allow so a parser glitch can never wedge the session.

The denylist is intentionally small — it covers irreversible mistakes
(force-push to a protected branch, rm -rf on root/home, secret leaks,
privilege escalation) without blocking common safe variants. Edge cases
err on the side of allowing; this is a guard rail, not a sandbox.
"""
from __future__ import annotations

import json
import re
import sys
from typing import Callable, Optional


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
    return re.sub(r"\s+", " ", cmd.strip())


def _segments(cmd: str) -> list[str]:
    return [s.strip() for s in re.split(r"&&|\|\||;|\|", cmd) if s.strip()]


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
    return 0


if __name__ == "__main__":
    sys.exit(main())
