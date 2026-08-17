#!/usr/bin/env python3
"""SessionStart hook - ask a live session to consolidate memory when it is due.

`dream-flag.py` leaves a pending flag when a project's auto-memory has gone
unconsolidated past the interval. This hook consumes that flag at session start
and injects a short instruction to run the `dream` skill, dry run first. That is
the supervised half of the auto-trigger: the work happens in a session the user
is watching, under that session's permissions.

The flag is cleared as soon as the nudge is emitted, so one nudge per due window
rather than a prompt on every session forever. If the user ignores it and
consolidation is still overdue when that session exits, the Stop hook re-flags
the project, which makes the whole thing self-healing.

Only a real session start qualifies - see NUDGE_SOURCES. Auto-compaction arrives
on this same event, and nudging there would interrupt work already in flight, so
those are passed over with the flag left where it is.

Prints nothing at all unless there is a flag to act on.
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys

# SessionStart fires on more than session starts. The documented sources are
# `startup`, `resume`, `clear`, `compact`, and `fork`, and the test for nudging
# is whether a person deliberately arrived at a prompt and will read the nudge
# before typing. `startup` and `clear` land them in empty context, so a memory
# chore cannot derail work that does not exist. `resume` and `fork` restore
# prior context, but both are user-initiated and both come to rest at a prompt.
# `compact` fires mid-task during auto-compaction: the user perceives no session
# boundary, a nudge there tells the model to go consolidate memory instead of
# finishing their work, and it spends the one-per-window flag on an event they
# never saw. An unknown or missing source is treated like `compact` - stay
# silent and leave the flag alone - so a source this list has not caught up with
# switches the nudge off rather than firing it at the wrong moment.
NUDGE_SOURCES = frozenset({"startup", "resume", "clear", "fork"})


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


def build_context(timer, state: dict) -> str:
    elapsed = state.get("elapsed_seconds")
    if elapsed is None:
        when = "no consolidation has run for it yet"
    else:
        when = f"the last one was {timer.describe_elapsed(elapsed)} ago"
    return (
        f"Memory consolidation is due for this project ({when}). "
        "Use the `dream` skill to fold recent session findings into this project's "
        "auto-memory files. Run its dry run first and show the user the proposed "
        "edits before rewriting any memory file."
    )


def main() -> int:
    payload = read_payload()

    source = payload.get("source")
    if not isinstance(source, str) or source.strip().lower() not in NUDGE_SOURCES:
        return 0  # Before anything touches the flag, so a real start still gets it.

    timer = load_timer()
    if timer is None or timer.disabled():
        return 0

    cwd = payload.get("cwd")
    if not isinstance(cwd, str) or not cwd:
        cwd = os.getcwd()

    if timer.read_flag(cwd) is None:
        return 0

    state = timer.evaluate(cwd)
    # Consume the flag either way: a nudge is worth one session start, and a flag
    # can outlive its reason (memory directory deleted, or the user already ran
    # the skill by hand since the flag was written).
    timer.clear_flag(cwd)
    if not state["due"]:
        return 0

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": build_context(timer, state),
        }
    }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # A memory chore must never fail a user's session start.
