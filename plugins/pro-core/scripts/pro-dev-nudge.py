#!/usr/bin/env python3
"""SessionStart hook - tell the person when the pro-dev engine registry has moved on.

`/pro-dev install` and `/pro-dev update` record the registry version they ran
against in `.claude/pro-dev.json` (`registryVersion`). When the installed
pro-core ships a registry with a different `version`, a plugin update brought
new or changed engines and the repo has not run `/pro-dev update` since. This
hook adds one line of session context, the same way dream-nudge.py does, asking
the agent to pass it on.

It only prints. It never installs, updates or writes anything.
It stays silent when the versions match, when the file is missing or malformed, when the
session is not in a git repo and on compaction. It always exits 0 so a broken
file can never block or loop a session start.
"""
from __future__ import annotations

import json
import os
import stat
import sys

LINE = "pro-dev plugins changed since the last /pro-dev run: run /pro-dev update"


def read_payload() -> dict:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw and raw.strip() else {}
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def repo_root(start: str) -> str | None:
    cur = os.path.realpath(start)
    while True:
        if os.path.exists(os.path.join(cur, ".git")):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            return None
        cur = parent


def as_version(value):
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def main() -> int:
    payload = read_payload()
    if str(payload.get("source", "")).strip().lower() == "compact":
        return 0  # mid-task compaction is not a session boundary

    cwd = payload.get("cwd")
    if not isinstance(cwd, str) or not cwd:
        cwd = os.getcwd()
    root = repo_root(cwd)
    if root is None:
        return 0

    # repo-controlled file: never follow a symlink, never open a FIFO or device, cap the read
    answers = os.path.join(root, ".claude", "pro-dev.json")
    try:
        if not stat.S_ISREG(os.lstat(answers).st_mode):
            return 0
        fd = os.open(answers, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
        with os.fdopen(fd, "rb") as fh:
            raw = fh.read(64 * 1024 + 1)
        if len(raw) > 64 * 1024:
            return 0
        saved = as_version(json.loads(raw.decode("utf-8")).get("registryVersion"))
    except Exception:
        return 0

    registry = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "registry", "engines.json")
    try:
        with open(registry, "r", encoding="utf-8") as fh:
            current = as_version(json.load(fh).get("version"))
    except Exception:
        return 0

    if saved is None or current is None or saved == current:
        return 0
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": f"Tell the person, in one line, before anything else: {LINE}",
        }
    }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # a registry nudge must never fail a session start
