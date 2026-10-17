#!/usr/bin/env python3
"""Stop hook: code changed but no plan.md did.

When the working tree has changes outside docs and intent folders, a plan exists
(intent/*/plan.md or plans/*.md) and none of the plans changed, remind the
session that a departure from the plan is recorded in the same commit.
warn mode (default): log and tell the session, never block.
enforce mode: block once; a second stop (stop_hook_active) always passes.
"""
import glob
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guard  # noqa: E402

HOOK = "plan-sync"
IGNORED_PREFIXES = ("intent/", "plans/", "specs/", "docs/")
IGNORED_FILES = ("CLAUDE.md", "AGENTS.md", "REVIEW.md", "README.md")


def main() -> None:
    data = guard.read_payload(HOOK)
    if data.get("stop_hook_active"):
        sys.exit(0)
    cwd = data.get("cwd") or os.getcwd()
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=all"],
            cwd=cwd, capture_output=True, text=True, timeout=10,
        )
        top = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=cwd, capture_output=True, text=True, timeout=10,
        ).stdout.strip()
    except Exception:
        sys.exit(0)
    if out.returncode != 0 or not top:
        sys.exit(0)
    paths = [line[3:].split(" -> ")[-1].strip().strip('"') for line in out.stdout.splitlines() if len(line) > 3]
    code = [p for p in paths if not p.startswith(IGNORED_PREFIXES) and p not in IGNORED_FILES]
    plans_changed = [p for p in paths if p.endswith("/plan.md") or p.startswith("plans/")]
    has_plan = glob.glob(os.path.join(top, "intent", "*", "plan.md")) or glob.glob(os.path.join(top, "plans", "*.md"))
    if not code or plans_changed or not has_plan:
        sys.exit(0)
    summary = "stop with code changed and no plan.md touched"
    detail = f"{len(code)} changed files, first {code[0]}"
    if guard.mode(HOOK) == "warn":
        guard.warn(HOOK, "Stop", "block", summary, detail, cwd)
    guard.log(HOOK, "block", detail, cwd)
    print(json.dumps({
        "decision": "block",
        "reason": "Files outside the docs changed this session, yet no plan.md was touched. "
                  "If the work strayed from the approved plan, write down how under Departures from plan, "
                  "then stop. If it followed the plan, say that and stop.",
    }))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
