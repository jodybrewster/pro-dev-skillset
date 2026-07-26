#!/usr/bin/env python3
"""PreToolUse Bash hook — enforce doc freshness before git push.

When the command is a git push, checks that any existing key documentation
files (README.md, AGENTS.md, CLAUDE.md, ARCHITECTURE.md, PRODUCT.md, DESIGN.md) were
updated alongside code changes. Blocks push if stale docs are detected.

Exits 2 (BLOCK) with a remediation message; exits 0 otherwise.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

KEY_DOCS = ["README.md", "AGENTS.md", "CLAUDE.md", "ARCHITECTURE.md", "PRODUCT.md", "DESIGN.md"]
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

    # Find key docs that exist in the project but weren't updated.
    # A symlinked doc (AGENTS.md -> CLAUDE.md is the common case) never shows up
    # in `git diff --name-only` under its own name, so resolve links and count a
    # doc as fresh when its target moved. Without this the gate is unsatisfiable
    # and blocks every push forever.
    changed_set = set(changed)
    changed_real = {os.path.realpath(os.path.join(cwd, f)) for f in changed}
    stale = [
        doc for doc in KEY_DOCS
        if os.path.exists(os.path.join(cwd, doc))
        and doc not in changed_set
        and os.path.realpath(os.path.join(cwd, doc)) not in changed_real
    ]

    if not stale:
        return 0

    stale_list = "\n".join(f"  - {d}" for d in stale)
    code_sample = ", ".join(code_changed[:5]) + ("…" if len(code_changed) > 5 else "")
    print(
        f"BLOCKED: Code changed ({code_sample}) but these docs were not updated:\n"
        f"{stale_list}\n\n"
        f"Fix it, don't just acknowledge it. Run /document to have the technical-writer "
        f"subagent draft the updates from the actual diff, or dispatch it directly. "
        f"It writes from repository evidence, so give it the changed paths above.\n\n"
        f"If a doc genuinely needs no change, say which one and why in the PR description "
        f"before re-running the push. Do not edit a doc cosmetically to clear this gate.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
