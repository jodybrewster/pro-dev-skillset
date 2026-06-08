#!/usr/bin/env python3
"""PreToolUse Bash hook — enforce doc freshness before git push.

When the command is a git push, checks that any existing key documentation
files (README.md, CLAUDE.md, ARCHITECTURE.md, PRODUCT.md, DESIGN.md) were
updated alongside code changes. Blocks push if stale docs are detected.

Exits 2 (BLOCK) with a remediation message; exits 0 otherwise.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

KEY_DOCS = ["README.md", "CLAUDE.md", "ARCHITECTURE.md", "PRODUCT.md", "DESIGN.md"]
PUSH_RE = re.compile(r"\bgit\s+push\b")


def run(cmd: str) -> tuple[bool, str]:
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return r.returncode == 0, r.stdout.strip()
    except Exception:
        return False, ""


def changed_files() -> list[str]:
    """Files changed in commits that would be pushed."""
    # Try upstream comparison first
    ok, out = run("git diff --name-only @{u}...HEAD 2>/dev/null")
    if ok and out:
        return out.splitlines()
    # Fall back to last commit vs its parent
    ok, out = run("git diff --name-only HEAD~1 HEAD 2>/dev/null")
    if ok and out:
        return out.splitlines()
    return []


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool_input = payload.get("tool_input") or {}
    command = tool_input.get("command") or ""
    if not isinstance(command, str) or not PUSH_RE.search(command):
        return 0

    cwd = os.getcwd()
    changed = changed_files()
    if not changed:
        return 0  # Nothing staged or can't determine — allow

    # Identify code changes (non-doc, non-config)
    doc_names = set(KEY_DOCS) | {"LICENSE", ".gitignore", ".gitattributes"}
    code_changed = [
        f for f in changed
        if os.path.basename(f) not in doc_names
        and not f.startswith("docs/")
        and not f.endswith(".lock")
    ]
    if not code_changed:
        return 0  # Only docs/config changed — no enforcement needed

    # Find key docs that exist in the project but weren't updated
    changed_set = set(changed)
    stale = [
        doc for doc in KEY_DOCS
        if os.path.exists(os.path.join(cwd, doc)) and doc not in changed_set
    ]

    if not stale:
        return 0

    stale_list = "\n".join(f"  - {d}" for d in stale)
    code_sample = ", ".join(code_changed[:5]) + ("…" if len(code_changed) > 5 else "")
    print(
        f"BLOCKED: Code changed ({code_sample}) but these docs were not updated:\n"
        f"{stale_list}\n\n"
        f"Review each file and update any sections affected by your changes. "
        f"If a file genuinely needs no changes, add a brief comment in the PR description explaining why.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
