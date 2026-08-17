#!/usr/bin/env python3
"""Stop hook - flag this project when memory consolidation falls due.

Fires when a session ends its turn. All it does is compare the project's
`.last-dream` marker against the interval and, when consolidation is overdue,
drop a small pending flag under ~/.claude/pro-dev/dream/. It never blocks the
stop, never prints, and never spawns anything.

`dream-nudge.py` consumes the flag at the start of the next session, so
consolidation runs inside a session the user is present for, with that session's
own permissions. Upstream instead launched a detached `claude -p` with write
access to every project on the machine; a marketplace plugin does not get to do
that on someone else's box.

Silent no-op when: the feature is disabled, this project has no auto-memory
directory, that directory holds no notes beyond the MEMORY.md index,
consolidation is not yet due, or anything at all goes wrong.
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys


def load_timer():
    """Import dream-timer.py by path - the hyphen makes it unimportable by name."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dream-timer.py")
    spec = importlib.util.spec_from_file_location("pro_dev_dream_timer", path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_payload() -> dict:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw and raw.strip() else {}
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def main() -> int:
    payload = read_payload()

    # Set on the continuation turn a blocking hook caused. This hook never
    # blocks, but staying inert there keeps it out of another hook's loop.
    if payload.get("stop_hook_active"):
        return 0

    timer = load_timer()
    if timer is None or timer.disabled():
        return 0

    cwd = payload.get("cwd")
    if not isinstance(cwd, str) or not cwd:
        cwd = os.getcwd()

    state = timer.evaluate(cwd)
    if state["due"]:
        timer.write_flag(state)
    elif state["memory_dir"]:
        # Consolidation has since run (or the interval was widened), so retire a
        # flag left over from an earlier exit rather than nudge for nothing.
        timer.clear_flag(cwd)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # A memory chore must never fail a user's turn.
