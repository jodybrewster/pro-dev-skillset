#!/usr/bin/env python3
"""Stop hook - keep a dated ledger of the sessions that ran in this project.

`dream` consolidates by scanning recent session transcripts. Finding them is the
weak link: transcripts are named by session id, they rotate, and a session that
ran three days ago is indistinguishable from one that ran three months ago
without opening it. This hook writes down what ran, when, and where its
transcript was, at the moment it was still there.

That gives consolidation a deterministic gather phase, and it gives the project
a short-term memory tier that survives transcript rotation.

What this is NOT: a summary. A shell hook has no model, so it cannot say what a
session decided or learned, and inventing that would be fabricated provenance.
It records where the signal is, not what the signal says. Consolidation still
does the reading.

That distinction is also why the ledger does not count as consolidation input in
`dream-timer.has_memory_content`. If it did, any project with a memory directory
would fall due every interval, `dream` would find a list of session ids and
nothing to promote, and the nudge would fire forever - which is the exact failure
the timer's content gate was written to prevent.

Writes to <memory_dir>/daily/YYYY-MM-DD.md, and only when that memory directory
already exists. A project not using auto-memory stays untouched: this hook never
creates a memory directory, so it can never turn a quiet project into a nudging
one.

Environment:
    PRO_DEV_DAILY_LOG_DISABLED   1/true/yes turns the ledger off
    PRO_DEV_DREAM_DISABLED       also honoured; it turns the whole feature off
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import time

TRUTHY = {"1", "true", "yes"}
DISABLE_ENV = "PRO_DEV_DAILY_LOG_DISABLED"
DREAM_DISABLE_ENV = "PRO_DEV_DREAM_DISABLED"

DAILY_DIR_NAME = "daily"
MAX_LEDGER_BYTES = 512 * 1024  # a day file past this is corrupt, not busy

# `- `<session id>` HH:MM-HH:MM, N turns`
ENTRY = re.compile(r"^- `([^`]+)` (\d{2}:\d{2})-(\d{2}:\d{2}), (\d+) turns?\s*$")


def _load(name: str):
    """Import a sibling script by path - the hyphen makes it unimportable by name."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
    spec = importlib.util.spec_from_file_location(f"pro_dev_{name[:-3].replace('-', '_')}", path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def disabled() -> bool:
    for name in (DISABLE_ENV, DREAM_DISABLE_ENV):
        if (os.environ.get(name) or "").strip().lower() in TRUTHY:
            return True
    return False


def read_payload() -> dict:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw and raw.strip() else {}
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def parse(text: str) -> "dict[str, dict]":
    """Existing entries keyed by session id, in file order.

    Anything that is not a recognised entry - the header, a stray note someone
    typed in - is dropped on rewrite. The ledger is generated, so tolerating
    arbitrary content would mean preserving it forever without knowing what it
    means. The header is rebuilt from scratch each time.
    """
    entries: dict[str, dict] = {}
    current = None
    for line in text.splitlines():
        match = ENTRY.match(line)
        if match:
            sid, start, end, turns = match.groups()
            current = {"start": start, "end": end, "turns": int(turns), "cwd": "", "transcript": ""}
            entries[sid] = current
            continue
        if current is None or not line.startswith("  - "):
            continue
        key, sep, value = line[4:].partition(":")
        if sep and key.strip() in ("cwd", "transcript"):
            current[key.strip()] = value.strip().strip("`")
    return entries


def render(day: str, entries: "dict[str, dict]") -> str:
    lines = [
        f"# Sessions {day}",
        "",
        "<!-- Written by pro-core's daily-log.py at each turn end. One entry per session. -->",
        "<!-- Short-term memory: an index of what ran, so `dream` can find the right",
        "     transcripts. It records where the signal is, not what was learned, so it is",
        "     not consolidation input on its own and does not make a project fall due. -->",
        "",
    ]
    for sid, entry in entries.items():
        turns = entry["turns"]
        lines.append(f"- `{sid}` {entry['start']}-{entry['end']}, {turns} turn{'' if turns == 1 else 's'}")
        if entry.get("cwd"):
            lines.append(f"  - cwd: `{entry['cwd']}`")
        if entry.get("transcript"):
            lines.append(f"  - transcript: `{entry['transcript']}`")
    return "\n".join(lines) + "\n"


def write_atomic(path: str, text: str) -> None:
    tmp = f"{path}.tmp{os.getpid()}"  # pid-suffixed so concurrent sessions never share one
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(text)
    os.replace(tmp, path)


def main() -> int:
    if disabled():
        return 0

    payload = read_payload()
    # Set on the continuation turn a blocking hook caused. Counting that as a
    # separate turn would inflate the ledger for something the user never did.
    if payload.get("stop_hook_active"):
        return 0

    timer = _load("dream-timer.py")
    if timer is None or timer.disabled():
        return 0

    cwd = payload.get("cwd")
    if not isinstance(cwd, str) or not cwd:
        cwd = os.getcwd()

    mem_dir = timer.memory_dir(cwd)
    if not mem_dir:
        return 0  # auto-memory is not in use here; never create the directory

    session_id = payload.get("session_id")
    if not isinstance(session_id, str) or not session_id.strip():
        return 0  # without an id every turn would append a new anonymous entry
    # Backticks would break out of the code span the entry is rendered in.
    session_id = session_id.strip().replace("`", "")[:64]

    transcript = payload.get("transcript_path")
    transcript = transcript if isinstance(transcript, str) else ""

    now = time.localtime()
    day = time.strftime("%Y-%m-%d", now)
    clock = time.strftime("%H:%M", now)

    daily_dir = os.path.join(mem_dir, DAILY_DIR_NAME)
    path = os.path.join(daily_dir, f"{day}.md")

    existing = ""
    try:
        if os.path.getsize(path) <= MAX_LEDGER_BYTES:
            with open(path, encoding="utf-8", errors="replace") as fh:
                existing = fh.read()
    except OSError:
        existing = ""

    entries = parse(existing)
    entry = entries.get(session_id)
    if entry is None:
        # Insertion order puts new sessions at the end, so the file reads
        # chronologically without needing to sort.
        entries[session_id] = {
            "start": clock, "end": clock, "turns": 1,
            "cwd": cwd, "transcript": transcript,
        }
    else:
        entry["end"] = clock
        entry["turns"] = entry.get("turns", 0) + 1
        entry["cwd"] = entry.get("cwd") or cwd
        # Fill a path that was missing earlier, but never blank one we already had.
        entry["transcript"] = transcript or entry.get("transcript", "")

    # Two sessions in the same project can read-modify-write this file at once,
    # and the loser of that race loses one entry. It self-heals: every Stop
    # rewrites that session's own entry, so the next turn restores it. Worth far
    # less than the complexity of a lock file that can be left stale on a crash.
    os.makedirs(daily_dir, exist_ok=True)
    write_atomic(path, render(day, entries))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # A memory chore must never fail a user's turn.
