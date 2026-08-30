#!/usr/bin/env python3
"""Shared timer for the dream memory-consolidation hooks.

Answers exactly one question: is memory consolidation due for the project in a
given working directory? `dream-flag.py` (Stop) and `dream-nudge.py`
(SessionStart) both import this module. It is also runnable by hand for
diagnostics:

    python3 dream-timer.py --status     # human-readable state (also the default)
    python3 dream-timer.py --json       # same state as JSON
    python3 dream-timer.py --check      # exit 0 when due, 1 when not

Anything else is a usage error and exits 2.

The timer is per project state directory on purpose. Consolidation state lives
next to the project's own auto-memory, at
~/.claude/projects/<slug>/memory/.last-dream, so projects that map to different
state directories keep independent timers. Upstream searched every project
directory and stopped at the first marker it found, which let one project's
timestamp gate consolidation for all of them.

Per state directory is not the same as per path, because <slug> is lossy. Claude
Code flattens punctuation, so `.../t/c/a/b` and `.../t/c/a.b` both reduce to
`-t-c-a-b`: two distinct projects, one memory directory, one marker, and
consolidating either satisfies both. Their pending flags are keyed by resolved
path instead, so they still nudge separately. This module reads the harness's own
naming rather than inventing a private scheme, so that collision is inherited
from Claude Code, not introduced here.

The trigger is time-based only: due when the interval has elapsed since the last
successful consolidation, and only for a project that has memory notes to fold
in. Neither the MEMORY.md index nor the daily/ session ledger is notes - one is
what consolidation writes, the other records where signal is rather than what it
says - so a directory holding nothing else is never due. There is no session
counting.

Environment:
    PRO_DEV_DREAM_INTERVAL_HOURS   interval override, float hours (default 24)
    PRO_DEV_DREAM_DISABLED         1/true/yes turns the whole feature off

This module only ever reads `.last-dream`; the `dream` skill writes it. The
contract on the write side is that every completed non-dry-run consolidation
stamps the marker, including one that found nothing worth changing, because the
work was still done. Without that rule a project whose memory never changes falls
due again at every interval and nudges forever.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sys
import time
from typing import Any

DEFAULT_INTERVAL_HOURS = 24.0
DISABLE_ENV = "PRO_DEV_DREAM_DISABLED"
INTERVAL_ENV = "PRO_DEV_DREAM_INTERVAL_HOURS"
TRUTHY = {"1", "true", "yes"}
# 9999-12-31. Above this time.localtime raises rather than formats, and no real
# marker is out there anyway.
MAX_EPOCH = 253402300799

# Expanded at call time, not import time, so a test harness can point HOME
# somewhere disposable.
PROJECTS_HOME = "~/.claude/projects"
STATE_HOME = "~/.claude/pro-dev/dream"
MARKER_NAME = ".last-dream"
INDEX_NAME = "MEMORY.md"
DAILY_DIR_NAME = "daily"


def disabled() -> bool:
    return (os.environ.get(DISABLE_ENV) or "").strip().lower() in TRUTHY


def interval_seconds() -> float:
    """Configured interval, falling back to the default on anything unusable."""
    hours = DEFAULT_INTERVAL_HOURS
    raw = os.environ.get(INTERVAL_ENV)
    if raw:
        try:
            parsed = float(raw.strip())
        except ValueError:
            parsed = 0.0
        # An infinite interval would park the timer forever and, worse, reach
        # --json as `Infinity`, which no strict JSON parser accepts.
        if parsed > 0 and math.isfinite(parsed):
            hours = parsed
    return hours * 3600.0


def slug_candidates(project_dir: str) -> list[str]:
    """Possible names for this project's state directory under ~/.claude/projects.

    Claude Code flattens the project's absolute path into a single segment. The
    documented form replaces every '/' with '-'; some releases also flatten dots
    and other punctuation. A directory reached through a symlink also has more
    than one valid absolute path, and the state directory is named after the one
    the session used - so try the logical path from $PWD too, and let the
    filesystem decide which candidate exists.
    """
    paths = [os.path.abspath(project_dir), os.path.realpath(project_dir)]
    logical = os.environ.get("PWD")
    if logical and os.path.isabs(logical):
        try:
            if os.path.samefile(logical, project_dir):
                paths.insert(0, logical)
        except OSError:
            pass

    out: list[str] = []
    for path in paths:
        for slug in (path.replace("/", "-"), re.sub(r"[^A-Za-z0-9]", "-", path)):
            if slug and slug not in out:
                out.append(slug)
    return out


def memory_dir(project_dir: str) -> str | None:
    """This project's auto-memory directory, or None when it is not in use."""
    projects = os.path.expanduser(PROJECTS_HOME)
    for slug in slug_candidates(project_dir):
        candidate = os.path.join(projects, slug, "memory")
        if os.path.isdir(candidate):
            return candidate
    return None


def has_memory_content(mem_dir: str) -> bool:
    """True when there is at least one memory note worth consolidating.

    Two things in this directory do not count, for the same reason: neither is
    something a consolidation can fold in.

    MEMORY.md is the index a consolidation writes, not input it reads, so a
    directory holding only the index has nothing to do. Counting it left such a
    project due forever: it nudged, the run had nothing to do, and the next
    session start nudged again. The name is compared case-insensitively because
    case-insensitive filesystems hand back memory.md for the same file.

    The `daily/` ledger written by daily-log.py is an index of which sessions
    ran and where their transcripts were. It records where signal is, not what
    was learned, so promoting it yields nothing and it would reintroduce exactly
    the same forever-nudge. Only the top-level ledger directory is pruned, so a
    real note filed deeper under that name still counts.

    Narrowing what counts as content can only ever make a project quieter, never
    noisier.
    """
    index = INDEX_NAME.lower()
    root_dir = os.path.abspath(mem_dir)
    try:
        for root, dirs, files in os.walk(mem_dir):
            if os.path.abspath(root) == root_dir:
                dirs[:] = [d for d in dirs if d != DAILY_DIR_NAME]
            for name in files:
                if name.endswith(".md") and name.lower() != index:
                    return True
    except OSError:
        return False
    return False


def coerce_epoch(value: Any) -> int | None:
    """Positive, formattable epoch seconds from an untrusted value, or None.

    Both `.last-dream` and the pending flag are ordinary files a user can edit,
    truncate, or fill with JSON of any shape, so nothing read out of either may
    reach time.localtime unchecked. bool is rejected on its own because it is an
    int subclass, and the upper bound keeps a wild value from raising inside a
    caller that only wanted to print it.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        seconds = int(float(value))
    except (TypeError, ValueError, OverflowError):
        return None
    return seconds if 0 < seconds <= MAX_EPOCH else None


def read_last_dream(mem_dir: str) -> int | None:
    """Epoch seconds from the marker, or None when it is missing or unusable.

    Unparseable contents count as never consolidated. The cost of being wrong
    that way is one extra consolidation, which rewrites the marker correctly.
    """
    try:
        with open(os.path.join(mem_dir, MARKER_NAME), errors="replace") as fh:
            raw = fh.read(64).strip()
    except OSError:
        return None
    return coerce_epoch(raw)


def describe_elapsed(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    if seconds < 3600:
        return f"{int(seconds // 60)} minutes"
    if seconds < 48 * 3600:
        return f"{int(seconds // 3600)} hours"
    return f"{int(seconds // 86400)} days"


def evaluate(project_dir: str, now: float | None = None) -> dict[str, Any]:
    """Full state for one project. `due` is the only field callers must honour."""
    now = time.time() if now is None else now
    state: dict[str, Any] = {
        "project_dir": os.path.abspath(project_dir),
        "disabled": disabled(),
        "interval_hours": interval_seconds() / 3600.0,
        "memory_dir": None,
        "has_memory_content": False,
        "last_dream": None,
        "elapsed_seconds": None,
        "due": False,
        "reason": "",
    }
    if state["disabled"]:
        state["reason"] = f"{DISABLE_ENV} is set"
        return state

    mem = memory_dir(project_dir)
    if not mem:
        state["reason"] = "auto-memory is not in use for this project"
        return state
    state["memory_dir"] = mem

    # Read the marker before the content gate so diagnostics still report when
    # this project last consolidated, even when it is not due.
    last = read_last_dream(mem)
    state["last_dream"] = last
    elapsed = None if last is None else now - last
    state["elapsed_seconds"] = elapsed

    if not has_memory_content(mem):
        state["reason"] = "no memory notes to consolidate (the MEMORY.md index is not notes)"
        return state
    state["has_memory_content"] = True

    if last is None:
        state["due"] = True
        state["reason"] = "no usable .last-dream marker"
        return state

    if elapsed < 0:
        # A marker dated in the future would otherwise park the timer forever.
        state["due"] = True
        state["reason"] = "marker timestamp is in the future"
    elif elapsed >= interval_seconds():
        state["due"] = True
        state["reason"] = f"{describe_elapsed(elapsed)} since the last consolidation"
    else:
        state["reason"] = f"last consolidation was {describe_elapsed(elapsed)} ago"
    return state


# ---------------------------------------------------------------------------
# Pending flag. Written by the Stop hook, consumed by the SessionStart hook.
# Keyed by resolved project path so both hooks agree without sharing state.


def flag_path(project_dir: str) -> str:
    key = hashlib.sha256(os.path.realpath(project_dir).encode()).hexdigest()[:16]
    return os.path.join(os.path.expanduser(STATE_HOME), f"{key}.json")


def write_flag(state: dict[str, Any]) -> None:
    path = flag_path(state.get("project_dir") or os.getcwd())
    payload = {
        "project_dir": state.get("project_dir"),
        "memory_dir": state.get("memory_dir"),
        "last_dream": state.get("last_dream"),
        "reason": state.get("reason"),
        "flagged_at": int(time.time()),
    }
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.tmp"
        with open(tmp, "w") as fh:
            json.dump(payload, fh)
        os.replace(tmp, path)  # atomic, so a reader never sees a half-written flag
    except OSError:
        pass  # The flag is an optimisation; never fail a turn over it.


def read_flag(project_dir: str) -> dict[str, Any] | None:
    try:
        with open(flag_path(project_dir)) as fh:
            flag = json.load(fh)
    except (OSError, ValueError):
        return None
    return flag if isinstance(flag, dict) else None


def clear_flag(project_dir: str) -> None:
    try:
        os.unlink(flag_path(project_dir))
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Diagnostics

KNOWN_FLAGS = ("--status", "--json", "--check")
USAGE = "usage: dream-timer.py [--status | --json | --check | --help]"


def _report(state: dict[str, Any]) -> str:
    lines = [
        f"project:   {state['project_dir']}",
        f"memory:    {state['memory_dir'] or '(none - auto-memory not in use here)'}",
        f"interval:  {state['interval_hours']:g}h",
    ]
    last = state["last_dream"]
    if last is None:
        lines.append("last dream: (never)")
    else:
        stamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(last))
        elapsed = state["elapsed_seconds"]
        ago = f" ({describe_elapsed(elapsed)} ago)" if elapsed is not None else ""
        lines.append(f"last dream: {stamp}{ago}")
    lines.append(f"due:       {'yes' if state['due'] else 'no'} - {state['reason']}")
    flag = read_flag(state["project_dir"])
    if flag is None:
        lines.append("flag:      none pending")
    else:
        # An empty dict is still a pending flag to dream-nudge.py, so report it
        # as one; and flagged_at is whatever the file happened to contain.
        flagged = coerce_epoch(flag.get("flagged_at"))
        if flagged is None:
            lines.append("flag:      pending (timestamp unreadable)")
        else:
            stamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(flagged))
            lines.append(f"flag:      pending since {stamp}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if "--help" in argv or "-h" in argv:
        print(__doc__.strip())
        return 0
    # /dream status and /pro-dev-doctor both shell out to --status by name, so a
    # typo has to fail instead of falling through to the default report.
    unknown = [arg for arg in argv if arg not in KNOWN_FLAGS]
    if unknown:
        print(f"dream-timer.py: unrecognised argument: {unknown[0]}", file=sys.stderr)
        print(USAGE, file=sys.stderr)
        return 2
    state = evaluate(os.getcwd())
    if "--json" in argv:
        print(json.dumps(state, indent=2, sort_keys=True))
        return 0
    if "--check" in argv:
        return 0 if state["due"] else 1
    print(_report(state))  # --status, and the documented no-argument default
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
