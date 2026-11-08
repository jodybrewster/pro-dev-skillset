#!/usr/bin/env python3
"""Gate for /execute: may this plan be built?

  python3 execute-gate.py <path to plan.md>

Passes when the plan is tracked by git with no uncommitted changes, reads
"Status: approved", its Done section has no build commit yet and no branch
for the build exists locally or on origin.
The branch is <id>/build for plan.md and <id>/build-<module> for plan-<module>.md when the
intent's frontmatter holds an id: line (ADR-0026) and the slug when it does not.
Pass: exit 0 and one JSON line with slug, branch, change_id (null with no id), intent_dir
and default_branch.
Stop: exit 1 and a one-line reason on stderr.
"""
import json
import os
import re
import subprocess
import sys


def git(top, *args):
    return subprocess.run(["git", "-C", top, *args], capture_output=True, text=True, timeout=60)


def stop(reason):
    print(f"execute-gate: {reason}", file=sys.stderr)
    sys.exit(1)


def default_branch(top):
    r = git(top, "symbolic-ref", "--short", "refs/remotes/origin/HEAD")
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip().split("/", 1)[-1]
    for name in ("main", "master"):
        if git(top, "show-ref", "--verify", "--quiet", f"refs/remotes/origin/{name}").returncode == 0:
            return name
    return "main"


ID_RE = re.compile(r"^[A-Z]{2,6}-[1-9][0-9]*$")


def change_id(intent_md):
    """The id: value in the intent's frontmatter, or None when it is missing or malformed."""
    try:
        with open(intent_md, encoding="utf-8") as fh:
            lines = fh.read().replace("\r\n", "\n").split("\n")
    except (OSError, UnicodeDecodeError):
        return None
    if not lines or lines[0].strip() != "---":
        return None
    for ln in lines[1:]:
        if ln.strip() == "---":
            return None
        m = re.match(r"^id:\s*['\"]?([^'\"\s#]*)['\"]?\s*(?:#.*)?$", ln)
        if m:
            return m.group(1) if ID_RE.match(m.group(1)) else None
    return None


def main():
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        stop("usage: execute-gate.py <path to plan.md>")
    plan = os.path.abspath(sys.argv[1])
    if not os.path.isfile(plan):
        here = git(os.getcwd(), "rev-parse", "--show-toplevel").stdout.strip()
        plan = os.path.join(here, sys.argv[1]) if here else plan
    if not os.path.isfile(plan):
        stop(f"no plan at {sys.argv[1]}")

    top = git(os.path.dirname(plan), "rev-parse", "--show-toplevel").stdout.strip()
    if not top:
        stop(f"{sys.argv[1]} is not inside a git repository")
    top = os.path.realpath(top)
    rel = os.path.relpath(os.path.realpath(plan), top)

    if git(top, "ls-files", "--error-unmatch", "--", rel).returncode != 0:
        stop(f"{rel} is not tracked by git; commit the plan first")
    if git(top, "status", "--porcelain", "--", rel).stdout.strip():
        stop(f"{rel} has uncommitted changes; commit the plan first")

    with open(plan, encoding="utf-8") as fh:
        text = fh.read()
    status = re.search(r"^Status:\s*(.+?)\s*$", text, re.M)
    value = status.group(1).rstrip(".").strip() if status else "missing"
    if value != "approved":
        stop(f"plan Status is {value}, not approved; approve it in {rel} and commit")

    done = re.search(r"^## Done\s*$(.*?)(?=^## |\Z)", text, re.M | re.S)
    built = re.search(r"^-[ \t]*(?:\*\*)?Build commit:(?:\*\*)?[ \t]*(.*?)[ \t]*$", done.group(1), re.M) if done else None
    if built and built.group(1) and not built.group(1).startswith("<"):
        stop(f"plan was already built (Build commit: {built.group(1)})")

    intent_dir = os.path.dirname(rel)
    # The folder name without its date or change id prefix: PDS-51-fix-greeting gives fix-greeting.
    slug = re.sub(r"^(?:\d{4}-\d{2}-\d{2}|[A-Z]{2,6}-[0-9]+)-", "", os.path.basename(intent_dir), count=1)
    if not slug:
        stop(f"cannot name a branch from {intent_dir or 'the repo root'}")
    cid = change_id(os.path.join(top, intent_dir, "intent.md"))
    module = re.match(r"^plan-(.+)\.md$", os.path.basename(rel))
    branch = slug if not cid else f"{cid}/build-{module.group(1)}" if module else f"{cid}/build"
    if git(top, "show-ref", "--verify", "--quiet", f"refs/heads/{branch}").returncode == 0:
        stop(f"branch {branch} already exists locally")
    if git(top, "remote", "get-url", "origin").returncode != 0:
        stop("no origin remote; /execute pushes the branch and opens a pull request there")
    remote = git(top, "ls-remote", "--exit-code", "--heads", "origin", f"refs/heads/{branch}")
    if remote.returncode == 0:
        stop(f"branch {branch} already exists on origin")
    if remote.returncode != 2:
        stop("could not reach origin to check the branch name")

    print(json.dumps({"slug": slug, "branch": branch, "change_id": cid, "intent_dir": intent_dir,
                      "default_branch": default_branch(top)}))


if __name__ == "__main__":
    main()
