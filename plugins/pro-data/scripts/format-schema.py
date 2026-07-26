#!/usr/bin/env python3
"""PostToolUse Write|Edit hook - keep Prisma schemas canonically formatted.

When an edit touches a `.prisma` file, runs `prisma format` on it so the
schema stays in Prisma's canonical shape (aligned attributes, sorted blocks)
instead of drifting with whatever the edit happened to produce.

Advisory only: always exits 0. A missing Prisma CLI, an offline `npx`, or a
schema that does not parse yet are all normal mid-edit states, not failures
worth interrupting the session over.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys


def edited_path(payload: dict) -> str:
    tool_input = payload.get("tool_input") or {}
    for key in ("file_path", "path", "notebook_path"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def prisma_command() -> list[str] | None:
    if shutil.which("prisma"):
        return ["prisma"]
    if shutil.which("npx"):
        return ["npx", "--no-install", "prisma"]
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    path = edited_path(payload)
    if not path.endswith(".prisma") or not os.path.exists(path):
        return 0

    base = prisma_command()
    if not base:
        return 0  # No Prisma CLI reachable - nothing to do.

    try:
        subprocess.run(
            base + ["format", "--schema", path],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.path.dirname(path) or None,
        )
    except Exception:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
