"""Shared helpers for the pro-ai-sdlc hooks. Imported, not executed.

State lives in GUARD_DIR (default ~/.claude/hooks, override with CLAUDE_GUARD_DIR):
  mode               warn or enforce for every hook (default warn)
  mode.<hook-name>   per-hook override, same values
  warn.log           one tab-separated line per flagged call

A payload that cannot be read never blocks: the hook logs it and allows.
"""
from __future__ import annotations

import json
import os
import sys
import time


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


def read_payload(hook: str) -> dict:
    """Return the hook payload, or exit 0 after logging when it is unusable."""
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else None
    except Exception:
        data = None
    if not isinstance(data, dict):
        log(hook, "parse-error", "empty or invalid payload", os.getcwd())
        sys.exit(0)
    return data


def warn(hook: str, event: str, verb: str, summary: str, detail: str, cwd: str) -> None:
    """Warn-mode output: log, tell the user and the model, allow."""
    log(hook, "would-" + verb, detail, cwd)
    msg = f"[{hook}] warn mode: would {verb} {summary} (logged to warn.log, allowed)"
    print(json.dumps({
        "systemMessage": msg,
        "hookSpecificOutput": {"hookEventName": event, "additionalContext": msg},
    }))
    sys.exit(0)
