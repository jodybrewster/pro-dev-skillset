#!/usr/bin/env python3
"""Stop hook - suggest a validation checklist when work lands in the repo.

Fires when the session is about to end its turn. If the session wrote files
inside the repo (or ran `git commit`) since the hook last spoke, it says so.
`PRO_DEV_VALIDATION` picks how:

  nudge (default)  one `systemMessage` line suggesting `/validate`; the turn
                   ends normally and the model is told nothing. Spoken once
                   per distinct set of changed files per session.
  block            blocks the stop once and instructs the session to produce a
                   user-validation handoff, written to
                   `.pro-dev/validation/latest.md` and echoed in chat.
  off              silent.

Any other value behaves as nudge. Stays silent (exit 0) when there is nothing
to validate - a conversation-only turn, writes outside the repo or under
`.pro-dev/`, no git working tree, or a change set already reported.

Loop safety, belt and braces (block mode):
  1. `stop_hook_active` is true on the continuation turn the block causes, so
     the second Stop always passes through.
  2. Transcript progress is recorded per session before any decision, so the
     writes the handoff itself performs can never trigger another handoff.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys

# File-mutating tools and the input key that names their target. A turn that
# touched none of these inside the repo produced nothing the user needs to
# validate, so the hook stays quiet. Bash is deliberately absent (most Bash
# calls are read-only); `git commit` is picked up separately.
MUTATING_TOOLS = {
    "Write": "file_path",
    "Edit": "file_path",
    "MultiEdit": "file_path",
    "NotebookEdit": "notebook_path",
}
STATE_HOME = os.path.expanduser("~/.claude/pro-dev/user-validation")
OUTPUT_REL = os.path.join(".pro-dev", "validation", "latest.md")
MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024


def run(cmd: list[str], cwd: str) -> tuple[bool, str]:
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=10)
        return r.returncode == 0, r.stdout.strip()
    except Exception:
        return False, ""


def git_root(cwd: str) -> str | None:
    ok, out = run(["git", "rev-parse", "--show-toplevel"], cwd)
    return out if ok and out else None


def state_path(session_id: str, root: str) -> str:
    key = hashlib.sha256(f"{session_id}:{root}".encode()).hexdigest()[:16]
    return os.path.join(STATE_HOME, f"{key}.json")


def load_state(path: str) -> dict:
    try:
        with open(path) as fh:
            return json.load(fh)
    except Exception:
        return {}


def save_state(path: str, state: dict) -> None:
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as fh:
            json.dump(state, fh)
    except Exception:
        pass  # State is an optimisation; never fail the turn over it.


def iter_tool_uses(entry: object):
    """Yield every tool_use block nested anywhere in a transcript entry."""
    if isinstance(entry, dict):
        if entry.get("type") == "tool_use":
            yield entry
        for value in entry.values():
            yield from iter_tool_uses(value)
    elif isinstance(entry, list):
        for value in entry:
            yield from iter_tool_uses(value)


def new_transcript_lines(path: str, already_seen: int) -> tuple[list[str], int]:
    """Return transcript lines not yet consumed, plus the new consumed count."""
    if not path or not os.path.exists(path):
        return [], already_seen
    try:
        if os.path.getsize(path) > MAX_TRANSCRIPT_BYTES:
            return [], already_seen
        with open(path, errors="replace") as fh:
            lines = fh.readlines()
    except Exception:
        return [], already_seen
    if already_seen > len(lines):  # transcript rotated or compacted
        already_seen = 0
    return lines[already_seen:], len(lines)


def repo_relative(raw: str, cwd: str, root: str) -> str | None:
    """Resolve a tool target to a path under root, or None if it is outside.

    realpath on both sides so /tmp vs /private/tmp style aliases and symlinks
    compare equal. Anything under .pro-dev/ is hook state, not work.
    """
    real_root = os.path.realpath(root)
    real = os.path.realpath(raw if os.path.isabs(raw) else os.path.join(cwd, raw))
    if real != real_root and not real.startswith(real_root + os.sep):
        return None
    rel = os.path.relpath(real, real_root)
    if rel == "." or rel == ".pro-dev" or rel.startswith(".pro-dev" + os.sep):
        return None
    return rel


def changed_paths(lines: list[str], cwd: str, root: str) -> tuple[set[str], bool]:
    """Repo-relative paths the session wrote, plus whether it ran `git commit`."""
    paths: set[str] = set()
    committed = False
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except Exception:
            continue
        for block in iter_tool_uses(entry):
            name = block.get("name")
            tool_input = block.get("input") or {}
            if not isinstance(tool_input, dict):
                continue
            if name in MUTATING_TOOLS:
                raw = tool_input.get(MUTATING_TOOLS[name])
                if isinstance(raw, str) and raw:
                    rel = repo_relative(raw, cwd, root)
                    if rel:
                        paths.add(rel)
            elif name == "Bash":
                cmd = tool_input.get("command") or ""
                if isinstance(cmd, str) and "git commit" in cmd:
                    committed = True
    return paths, committed


def change_summary(root: str, paths: list[str]) -> tuple[str, bool]:
    """A compact description of the session's files + recent commits."""
    parts: list[str] = []
    scope = ["--", *paths] if paths else []
    _, status = run(["git", "status", "--porcelain", *scope], root)
    _, stat = run(["git", "diff", "--stat", "HEAD", *scope], root)
    ok_log, log = run(
        ["git", "log", "--oneline", "-5", "--no-decorate", "@{u}..HEAD"], root
    )
    if status:
        parts.append("Uncommitted changes:\n" + status)
    if stat:
        parts.append("Diff vs HEAD:\n" + stat)
    if ok_log and log:
        parts.append("Commits not yet pushed:\n" + log)
    return ("\n\n".join(parts), bool(parts))


def ensure_output_dir(root: str) -> None:
    """Create .pro-dev/ as a self-ignoring directory - no .gitignore edits."""
    base = os.path.join(root, ".pro-dev")
    try:
        os.makedirs(os.path.join(base, "validation"), exist_ok=True)
        marker = os.path.join(base, ".gitignore")
        if not os.path.exists(marker):
            with open(marker, "w") as fh:
                fh.write("# Local session state written by pro-quality. Not source.\n*\n")
    except Exception:
        pass


def build_reason(root: str, summary: str) -> str:
    return f"""Work landed in this session, so hand the user a validation checklist before stopping.

Do NOT start new work, refactor anything, or fix things you notice while writing this. \
Produce the handoff only. Follow the `user-validation` skill.

What changed in {root} (only the files this session wrote):
{summary or "(no git-visible changes detected - describe what you changed from the session instead)"}

Produce two things:

1. Write the handoff to `{OUTPUT_REL}` (the directory already exists and is self-ignoring).
2. Echo a condensed version in chat under a `## Validate on your end` heading.

The handoff covers, in this order:

- **What changed** - one line per user-visible change, in plain language, not file names.
- **What I verified** - the exact commands you ran this session and their real results. \
If you did not run something, say so. Never imply a check you did not perform.
- **What needs your eyes** - a numbered list of concrete steps the user performs. \
Each step names where to go, what to do, and what correct looks like. \
Order by risk: things that would be expensive to discover later go first.
- **What I could not check** - anything needing credentials, real devices, external \
services, visual judgement, or product decisions you cannot make.
- **Known gaps** - shortcuts taken, TODOs left, cases deliberately out of scope.

Keep it short enough to act on. Skip a section rather than pad it. \
Every step must be checkable by the user without reading the diff."""


def nudge_message(root: str, count: int) -> str:
    repo = os.path.basename(root)
    if count:
        noun = "file" if count == 1 else "files"
        return (
            f"pro-quality: this session changed {count} {noun} in {repo}. "
            "Run /validate for a checklist."
        )
    return f"pro-quality: this session committed changes in {repo}. Run /validate for a checklist."


def main() -> int:
    mode = (os.environ.get("PRO_DEV_VALIDATION") or "").strip().lower()
    if mode == "off":
        return 0

    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    if not isinstance(payload, dict):
        return 0

    cwd = payload.get("cwd") or os.getcwd()
    session_id = payload.get("session_id") or "unknown"
    transcript = payload.get("transcript_path") or ""

    root = git_root(cwd)
    if not root:
        return 0  # Not a working tree - nothing meaningful to hand off.

    path = state_path(session_id, root)
    state = load_state(path)
    lines, seen = new_transcript_lines(transcript, int(state.get("lines_seen") or 0))

    new_paths, committed = changed_paths(lines, cwd, root)
    session_paths = sorted(set(state.get("paths") or []) | new_paths)

    # Always record progress first, so the handoff's own writes are consumed
    # and can never trigger a second handoff.
    state["lines_seen"] = seen
    state["paths"] = session_paths
    save_state(path, state)

    if payload.get("stop_hook_active"):
        return 0
    if not new_paths and not committed:
        return 0

    if mode == "block":
        summary, has_changes = change_summary(root, session_paths)
        if not has_changes:
            return 0  # Edits were made but nothing survives in the tree.
        ensure_output_dir(root)
        print(json.dumps({"decision": "block", "reason": build_reason(root, summary)}))
        return 0

    # nudge (the default, and any unrecognised value): once per change set.
    digest = hashlib.sha256("\n".join(session_paths).encode()).hexdigest()[:16]
    if state.get("reported") == digest:
        return 0
    state["reported"] = digest
    save_state(path, state)
    print(json.dumps({"systemMessage": nudge_message(root, len(session_paths))}))
    return 0


def guarded_main() -> int:
    """Run main; any failure ends the turn quietly rather than with a traceback."""
    try:
        return main()
    except Exception:
        return 0


if __name__ == "__main__":
    sys.exit(guarded_main())
