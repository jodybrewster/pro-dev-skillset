#!/usr/bin/env python3
"""Stop hook: code changed but no plan.md did, or a plan's ## Done is stale.

When the working tree has changes outside docs and intent folders, a plan exists
(intent/*/plan.md or plans/*.md) and none of the plans changed, remind the
session that a departure from the plan is recorded in the same commit.
When a plan this branch or the working tree changed opens its ## Done with
`Done as of <sha>` and files outside docs and intent folders changed since that
sha, report that ## Done is stale. A plan without that line is not checked.
warn mode (default): log and tell the session, never block.
enforce mode: block once; a second stop (stop_hook_active) always passes.
Reads plan files and git output only; writes nothing but the guard log.
"""
import glob
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guard  # noqa: E402

HOOK = "plan-sync"
IGNORED_PREFIXES = ("intent/", "plans/", "specs/", "docs/")
IGNORED_FILES = ("CLAUDE.md", "AGENTS.md", "REVIEW.md", "README.md")
DONE_AS_OF = re.compile(r"^Done as of ([0-9a-f]{7,40})\b")
BASE_REFS = ("refs/remotes/origin/HEAD", "origin/main", "origin/master", "main", "master")


def git(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=10)


def is_code(path):
    return not path.startswith(IGNORED_PREFIXES) and path not in IGNORED_FILES


def is_plan(path):
    return path.endswith("/plan.md") or (path.startswith("plans/") and path.endswith(".md"))


def full_sha(top, ref):
    r = git(top, "rev-parse", "--verify", "-q", ref + "^{commit}")
    return r.stdout.strip() if r.returncode == 0 else ""


def branch_paths(top, head):
    """Paths the commits on this branch changed since it left the default branch."""
    for ref in BASE_REFS:
        base = full_sha(top, ref)
        if not base:
            continue
        if base == head:
            return []
        r = git(top, "diff", "--name-only", base + "..." + head)
        return r.stdout.split() if r.returncode == 0 else []
    return []


def done_sha(text):
    """The sha on the first non-blank line under ## Done, when it reads `Done as of <sha>`."""
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if line.strip() == "## Done":
            for after in lines[i + 1:]:
                if after.strip():
                    m = DONE_AS_OF.match(after.strip())
                    return m.group(1) if m else None
            return None
    return None


def stale_done(top, paths):
    """[(plan, written at, head)] for each changed plan whose ## Done is older than a code change."""
    head = full_sha(top, "HEAD")
    if not head:
        return []
    untracked = git(top, "ls-files", "--others", "--exclude-standard").stdout.split()
    found = []
    for plan in sorted(set(p for p in paths + branch_paths(top, head) if is_plan(p))):
        try:
            with open(os.path.join(top, plan), encoding="utf-8") as fh:
                written = done_sha(fh.read())
        except (OSError, UnicodeError):
            continue
        if not written:
            continue
        at = full_sha(top, written)
        if not at or at == head:
            continue
        r = git(top, "diff", "--name-only", at)
        if r.returncode != 0:
            continue
        if any(is_code(p) for p in r.stdout.split() + untracked):
            found.append((plan, at[:12], head[:12]))
    return found


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
    code = [p for p in paths if is_code(p)]
    plans_changed = [p for p in paths if p.endswith("/plan.md") or p.startswith("plans/")]
    has_plan = glob.glob(os.path.join(top, "intent", "*", "plan.md")) or glob.glob(os.path.join(top, "plans", "*.md"))
    summaries, details, reasons = [], [], []
    if code and not plans_changed and has_plan:
        summaries.append("stop with code changed and no plan.md touched")
        details.append(f"{len(code)} changed files, first {code[0]}")
        reasons.append("Files outside the docs changed this session, yet no plan.md was touched. "
                       "If the work strayed from the approved plan, write down how under Departures from plan, "
                       "then stop. If it followed the plan, say that and stop.")
    try:
        stale = stale_done(top, paths)
    except Exception:
        stale = []
    for plan, at, head in stale:
        line = f"## Done is stale (written at {at}, head is {head})"
        summaries.append(line)
        details.append(f"{plan}: {line}")
        reasons.append(f"{plan}: {line}. Code changed after ## Done was filled in. "
                       "Rerun the checks, update ## Done with what they show and its Done as of line, then stop.")
    if not summaries:
        sys.exit(0)
    summary = "; ".join(summaries)
    detail = "; ".join(details)
    if guard.mode(HOOK) == "warn":
        guard.warn(HOOK, "Stop", "block", summary, detail, cwd)
    guard.log(HOOK, "block", detail, cwd)
    print(json.dumps({"decision": "block", "reason": " ".join(reasons)}))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
