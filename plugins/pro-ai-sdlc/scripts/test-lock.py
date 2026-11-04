#!/usr/bin/env python3
"""Freeze test files for the protect-tests hook: test-lock.py <worktree> <path> [<path> ...].

Appends each path, relative to the worktree, to <worktree>/.claude/test-lock once and keeps
that file in the worktree's git exclude file. A script so a run with no one at the keyboard
can do it: shell redirects into .claude/ are refused there, and running a plugin script is not.
Refuses a path that is absolute or leaves the worktree. Python 3 standard library only.
"""
from __future__ import annotations

import os
import subprocess
import sys

LOCK = ".claude/test-lock"


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__.splitlines()[0], file=sys.stderr)
        return 2
    root = os.path.abspath(argv[1])
    paths = argv[2:]
    for p in paths:
        norm = os.path.normpath(p)
        if os.path.isabs(p) or norm == ".." or norm.startswith(".." + os.sep):
            print(f"test-lock: refused {p}: it is outside the worktree", file=sys.stderr)
            return 2
    r = subprocess.run(["git", "rev-parse", "--git-path", "info/exclude"], cwd=root, capture_output=True, text=True, timeout=10)
    if r.returncode != 0 or not r.stdout.strip():
        print("test-lock: not a git worktree", file=sys.stderr)
        return 2
    exclude = r.stdout.strip()
    if not os.path.isabs(exclude):
        exclude = os.path.join(root, exclude)
    os.makedirs(os.path.dirname(exclude), exist_ok=True)
    try:
        lines = open(exclude, encoding="utf-8").read().splitlines()
    except OSError:
        lines = []
    if LOCK not in lines:
        with open(exclude, "a", encoding="utf-8") as f:
            f.write(LOCK + "\n")
    lock = os.path.join(root, LOCK)
    os.makedirs(os.path.dirname(lock), exist_ok=True)
    try:
        have = open(lock, encoding="utf-8").read().splitlines()
    except OSError:
        have = []
    with open(lock, "a", encoding="utf-8") as f:
        for p in paths:
            n = os.path.normpath(p)
            if n not in have:
                f.write(n + "\n")
                have.append(n)
    print(f"test-lock: {len(have)} frozen")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
