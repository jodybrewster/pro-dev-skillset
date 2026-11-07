#!/usr/bin/env python3
"""Stop hook: code changed but no plan did, or a plan's ## Done is stale.

A plan is intent/*/plan.md, intent/*/plan-<id>.md or plans/*.md.
When the working tree has changes outside docs and intent folders, a plan exists
and none of the plans changed, remind the session that a departure from the plan
is recorded in the same commit (mode key plan-sync).
When a plan this branch or the working tree changed has `Done as of <sha>` in its
## Done section and files outside docs and intent folders changed since that sha,
report that ## Done is stale (mode key stale-done). A plan without that line is
not checked.
warn mode (default): log and tell the session, never block.
enforce mode: block once; a second stop (stop_hook_active) always passes.
The stale-done check enforces only when a mode.stale-done file says enforce: the
global mode file and CLAUDE_GUARD_MODE leave it in warn until its own evidence period.
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
STALE_HOOK = "stale-done"
IGNORED_PREFIXES = ("intent/", "plans/", "specs/", "docs/")
IGNORED_FILES = ("CLAUDE.md", "AGENTS.md", "REVIEW.md", "README.md")
PLAN_NAME = re.compile(r"^plan(?:-[A-Za-z0-9._-]+)?\.md$")
DONE_AS_OF = re.compile(r"^\s*(?:[-*+]\s+)?Done as of\s+`?([0-9a-f]{7,40})`?(?![0-9A-Za-z])")
BASE_REFS = ("refs/remotes/origin/HEAD", "origin/main", "origin/master", "main", "master")


def git(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=10)


def is_code(path):
    return not path.startswith(IGNORED_PREFIXES) and path not in IGNORED_FILES


def is_plan(path):
    """plan.md or plan-<id>.md in a folder, or any .md under plans/."""
    if path.startswith("plans/") and path.endswith(".md"):
        return True
    return "/" in path and bool(PLAN_NAME.match(path.rsplit("/", 1)[1]))


def plan_files(top):
    found = glob.glob(os.path.join(top, "intent", "*", "plan.md")) + glob.glob(os.path.join(top, "intent", "*", "plan-*.md"))
    found += glob.glob(os.path.join(top, "plans", "*.md"))
    return [os.path.relpath(p, top).replace(os.sep, "/") for p in found]


def stale_mode():
    """enforce only when mode.stale-done says so; the global mode and the env never enforce it."""
    try:
        with open(os.path.join(guard.guard_dir(), "mode." + STALE_HOOK), encoding="utf-8") as fh:
            return "enforce" if fh.readline().strip() == "enforce" else "warn"
    except OSError:
        return "warn"


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
    """The sha of a `Done as of <sha>` line anywhere in the ## Done section, else None."""
    inside = False
    for line in text.split("\n"):
        if line.startswith("## "):
            if inside:
                return None
            inside = line.strip() == "## Done"
            continue
        if inside:
            m = DONE_AS_OF.match(line)
            if m:
                return m.group(1)
    return None


def stale_done(top, paths):
    """[(plan, written at, head)] for each changed plan whose ## Done is older than a code change."""
    written = {}
    for plan in plan_files(top):
        try:
            with open(os.path.join(top, plan), encoding="utf-8") as fh:
                sha = done_sha(fh.read())
        except (OSError, UnicodeError):
            continue
        if sha:
            written[plan] = sha
    if not written:
        return []
    head = full_sha(top, "HEAD")
    if not head:
        return []
    changed = set(paths) | set(branch_paths(top, head))
    untracked = None
    found = []
    for plan in sorted(changed.intersection(written)):
        at = full_sha(top, written[plan])
        if not at or at == head:
            continue
        r = git(top, "diff", "--name-only", at)
        if r.returncode != 0:
            continue
        if untracked is None:
            untracked = git(top, "ls-files", "--others", "--exclude-standard").stdout.split()
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
    plans_changed = [p for p in paths if is_plan(p)]
    # (hook, mode, summary, detail, reason) per finding
    findings = []
    if code and not plans_changed and plan_files(top):
        findings.append((HOOK, guard.mode(HOOK), "stop with code changed and no plan.md touched",
                         f"{len(code)} changed files, first {code[0]}",
                         "Files outside the docs changed this session, yet no plan.md was touched. "
                         "If the work strayed from the approved plan, write down how under Departures from plan, "
                         "then stop. If it followed the plan, say that and stop."))
    try:
        stale = stale_done(top, paths)
    except Exception:
        stale = []
    for plan, at, head in stale:
        line = f"## Done is stale (written at {at}, head is {head})"
        findings.append((STALE_HOOK, stale_mode(), line, f"{plan}: {line}",
                         f"{plan}: {line}. Code changed after ## Done was filled in. "
                         "Rerun the checks, update ## Done with what they show and its Done as of line, then stop."))
    if not findings:
        sys.exit(0)
    messages, reasons = [], []
    for hook, mode, summary, detail, reason in findings:
        if mode == "warn":
            guard.log(hook, "would-block", detail, cwd)
            messages.append(f"[{hook}] warn mode: would block {summary} (logged to warn.log, allowed)")
        else:
            guard.log(hook, "block", detail, cwd)
            reasons.append(reason)
    out_json = {}
    if messages:
        # A Stop hook's warn output is a message to the user only, never feedback to the model.
        out_json["systemMessage"] = " ".join(messages)
    if reasons:
        out_json.update({"decision": "block", "reason": " ".join(reasons)})
    print(json.dumps(out_json))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
