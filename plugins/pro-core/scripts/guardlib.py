"""Shared helpers for the pro-core guards. Imported, not executed.

State lives in the guard folder (CLAUDE_GUARD_DIR, or ~/.claude/hooks when unset):
  mode.<key>   enforce turns that one guard on; anything else, or no file, is warn
  warn.log     one tab-separated line per finding: time, guard, action, detail, cwd

A pro-core guard enforces only when its own mode file says so. The global `mode`
file and CLAUDE_GUARD_MODE leave it in warn: a new guard cannot enforce before
its own evidence period (ADR-0016, the same rule as `stale-done` in pro-ai-sdlc).

guard_dir() and log() are copied from plugins/pro-ai-sdlc/scripts/guard.py and
own_mode() follows stale_mode() in plugins/pro-ai-sdlc/scripts/plan-sync.py.
Plugins install separately and cannot import each other (ADR-0003). Keep the
copies in step by hand.

Every helper is standard library only (Python 3.9) and never raises on a missing
or unreadable file.
"""
from __future__ import annotations

import json
import os
import time
from typing import List


def guard_dir() -> str:
    return os.environ.get("CLAUDE_GUARD_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "hooks")


def own_mode(key: str) -> str:
    """enforce only when mode.<key> says so; the global mode file and the env never enforce it."""
    try:
        with open(os.path.join(guard_dir(), "mode." + key), encoding="utf-8") as fh:
            return "enforce" if fh.readline().strip() == "enforce" else "warn"
    except (OSError, ValueError):
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


def warn(hook: str, summary: str, detail: str, cwd: str, advice: str = "") -> None:
    """Warn mode: log a would-deny line, tell the user and the model, allow (the caller exits 0)."""
    log(hook, "would-deny", detail, cwd)
    msg = f"[{hook}] warn mode: would deny {summary} (logged to warn.log, allowed)"
    if advice:
        msg += ". " + advice
    print(json.dumps({
        "systemMessage": msg,
        "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": msg},
    }))


def deny(hook: str, reason: str, detail: str, cwd: str) -> None:
    """Enforce mode: log a deny line and print a PreToolUse deny (the caller exits 0)."""
    log(hook, "deny", detail, cwd)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"[{hook}] {reason}",
        },
    }))


def segments(command: str) -> List[List[str]]:
    """Split a shell command into simple-command token lists. Quotes are honoured; nothing runs.

    Operators (; | & && || newline and parentheses) end a simple command. A quoted
    string stays one token: `bash -c "..."` is a shell with one argument here.
    """
    out: List[List[str]] = []
    tokens: List[str] = []
    cur = ""
    has = False
    quote = ""
    i = 0
    n = len(command)
    while i < n:
        c = command[i]
        if quote:
            if c == quote:
                quote = ""
            elif c == "\\" and quote == '"' and i + 1 < n:
                i += 1
                cur += command[i]
            else:
                cur += c
        elif c in "'\"":
            quote = c
            has = True
        elif c == "\\" and i + 1 < n:
            i += 1
            if command[i] != "\n":
                cur += command[i]
                has = True
        elif c in " \t\r":
            if has:
                tokens.append(cur)
            cur, has = "", False
        elif c in ";\n|&()":
            if has:
                tokens.append(cur)
            cur, has = "", False
            if tokens:
                out.append(tokens)
            tokens = []
        else:
            cur += c
            has = True
        i += 1
    if has:
        tokens.append(cur)
    if tokens:
        out.append(tokens)
    return out


# The tokenizer in segments() is adapted from super-board hooks/guard-protected-push.py
# (MIT, Copyright (c) 2026 Eric Tech); see docs/licenses.md.
