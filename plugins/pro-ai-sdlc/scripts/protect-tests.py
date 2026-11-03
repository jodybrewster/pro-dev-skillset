#!/usr/bin/env python3
"""PreToolUse hook on Edit|Write|MultiEdit.

When the project has a .claude/fix-mode marker (found by walking up from the
edited file), edits to *.test.*, *.spec.*, tests/**, e2e/** and __tests__/**
are flagged, so a fix cannot weaken the failing test it has to pass.
A .claude/test-lock file (one path per line, relative to the root) written by
/execute freezes the listed test files the same way; new test files stay free.
warn mode (default): log, tell the session, allow. enforce mode: exit 2.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guard  # noqa: E402

HOOK = "protect-tests"


MARKERS = ("fix-mode", ".fix-task")  # .fix-task is the sample repo's marker name


def find_root(path: str, cwd: str):
    d = os.path.dirname(path)
    while True:
        if any(os.path.isfile(os.path.join(d, ".claude", m)) for m in MARKERS):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            # SDLC_TASK_KIND=fix in the session environment also turns the lock on.
            return cwd if os.environ.get("SDLC_TASK_KIND") == "fix" else None
        d = parent


def locked(root: str, path: str) -> bool:
    try:
        with open(os.path.join(root, ".claude", "test-lock"), encoding="utf-8") as fh:
            lines = [ln.strip() for ln in fh if ln.strip()]
    except OSError:
        return False
    target = os.path.realpath(path)
    return any(os.path.realpath(os.path.join(root, ln)) == target for ln in lines)


def find_lock_root(path: str):
    d = os.path.dirname(path)
    while True:
        if os.path.isfile(os.path.join(d, ".claude", "test-lock")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def flagged(root: str, path: str):
    base = os.path.basename(path)
    if ".test." in base or ".spec." in base or base.endswith(("_test.py", "_test.go")):
        return "test file " + base
    rel = "/" + os.path.relpath(path, root).replace(os.sep, "/")
    if any(seg in rel for seg in ("/tests/", "/test/", "/e2e/", "/__tests__/")):
        return "file under a test directory"
    return None


def main() -> None:
    data = guard.read_payload(HOOK)
    cwd = data.get("cwd") or os.getcwd()
    ti = data.get("tool_input")
    path = ti.get("file_path") if isinstance(ti, dict) else None
    if not isinstance(path, str) or not path:
        sys.exit(0)
    path = path.replace("\\", "/")
    if not os.path.isabs(path):
        path = os.path.join(cwd, path)
    root = find_root(path, cwd)
    found = flagged(root, path) if root else None
    if not found:
        lock_root = find_lock_root(path)
        if lock_root and locked(lock_root, path):
            root, found = lock_root, "locked test file " + os.path.basename(path)
    if not root:
        sys.exit(0)
    if not found:
        sys.exit(0)
    detail = f"{found} :: {path}"
    if guard.mode(HOOK) == "warn":
        guard.warn(HOOK, "PreToolUse", "block", "an edit to " + found, detail, cwd)
    guard.log(HOOK, "block", detail, cwd)
    print(
        f"protect-tests: blocked an edit to {path} (rule: in fix mode the failing test is frozen; "
        f"make it pass by changing the code). fix mode is on for {root}. "
        "If the test itself is wrong, stop and say why; the person removes the marker or edits the test.",
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
