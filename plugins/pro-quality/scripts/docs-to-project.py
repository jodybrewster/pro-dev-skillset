#!/usr/bin/env python3
"""PreToolUse Write/Edit hook - block plan/doc saves outside the project.

Reads {"tool_input": {"file_path": "..."}} from stdin. Blocks writes to
~/.claude/ (except the auto-memory directory) and doc files that belong to
some other repository or to no repository at all. Exits 2 (BLOCK) with a
redirect message; exits 0 otherwise.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

# A PreToolUse hook sits in front of the user's turn, so every git call is bounded.
GIT_TIMEOUT_SECONDS = 2


class GitUnavailable(Exception):
    """git could not be consulted at all - missing binary, timeout, or crash."""


def common_git_dir(start_dir: str) -> str | None:
    """The repository start_dir belongs to, identified by its shared common dir.

    Every linked worktree of a repository reports the same --git-common-dir while
    each has its own --git-dir, so the common dir is the identity to compare on.
    Returns None when git answers that start_dir is not inside a repository.
    """
    try:
        proc = subprocess.run(
            ["git", "-C", start_dir, "rev-parse", "--git-common-dir"],
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise GitUnavailable(str(exc)) from exc

    out = proc.stdout.strip()
    if proc.returncode != 0 or not out:
        return None
    # Older git reports this relative to the -C directory rather than absolute.
    return os.path.realpath(os.path.join(start_dir, out))


def nearest_existing_dir(path: str) -> str:
    """Deepest existing ancestor directory - the target file may not exist yet."""
    candidate = path if os.path.isdir(path) else os.path.dirname(path)
    while not os.path.isdir(candidate):
        parent = os.path.dirname(candidate)
        if parent == candidate:
            return os.sep
        candidate = parent
    return candidate


def is_within(path: str, root: str) -> bool:
    """Directory containment, not string prefix, so /foo-bar is not inside /foo."""
    try:
        return os.path.commonpath([path, root]) == root
    except ValueError:
        return False


def belongs_to_session_repository(target: str, cwd: str) -> bool:
    """True when target lives in the same repository as the session.

    Fails open: when git cannot be consulted the answer is True, because a hook
    that blocks legitimate edits on a broken or slow git is worse than one that
    lets an edit past.
    """
    try:
        session_repo = common_git_dir(cwd)
        if session_repo is None:
            return False
        target_repo = common_git_dir(nearest_existing_dir(target))
    except GitUnavailable:
        return True
    return target_repo is not None and target_repo == session_repo


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or ""
    if not file_path:
        return 0

    home = os.path.expanduser("~")
    claude_dir = os.path.join(home, ".claude")
    # abspath, not normpath: a relative file_path has to resolve against the session
    # cwd rather than fall through the containment check as "outside the project".
    expanded = os.path.abspath(os.path.expanduser(file_path))
    cwd = os.getcwd()

    if expanded.startswith(claude_dir):
        # Allow writes to the auto-memory directory (intentional system behavior)
        if os.sep + "memory" + os.sep in expanded or expanded.endswith(os.sep + "memory"):
            return 0
        if "MEMORY.md" in expanded:
            return 0
        print(
            f"BLOCKED: Plans, analysis, and documentation must be saved in the project "
            f"directory, not in ~/.claude/.\n"
            f"Save to docs/ or docs/plans/ within the current project ({cwd}).\n"
            f"Example: docs/plans/YYYY-MM-DD-<feature-name>.md",
            file=sys.stderr,
        )
        return 2

    # Block .md/.txt/.rst files written anywhere outside the project tree
    ext = os.path.splitext(expanded)[1].lower()
    if ext in {".md", ".txt", ".rst"} and not is_within(expanded, cwd):
        # A linked git worktree sits outside cwd but is the same repository, and
        # editing its docs is first-class work, so ask git rather than trust paths.
        if belongs_to_session_repository(expanded, cwd):
            return 0
        print(
            f"BLOCKED: Documentation files must be saved within the project directory.\n"
            f"Save to docs/ or docs/plans/ within {cwd}.",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
