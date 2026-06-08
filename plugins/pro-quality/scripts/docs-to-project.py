#!/usr/bin/env python3
"""PreToolUse Write/Edit hook — block plan/doc saves outside the project.

Reads {"tool_input": {"file_path": "..."}} from stdin. Blocks writes to
~/.claude/ (except the auto-memory directory) and other paths outside the
working directory. Exits 2 (BLOCK) with a redirect message; exits 0 otherwise.
"""
from __future__ import annotations

import json
import os
import sys


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
    expanded = os.path.normpath(os.path.expanduser(file_path))
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
    if not expanded.startswith(cwd):
        ext = os.path.splitext(file_path)[1].lower()
        if ext in {".md", ".txt", ".rst"}:
            print(
                f"BLOCKED: Documentation files must be saved within the project directory.\n"
                f"Save to docs/ or docs/plans/ within {cwd}.",
                file=sys.stderr,
            )
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
