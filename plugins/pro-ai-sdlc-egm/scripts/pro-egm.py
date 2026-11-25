#!/usr/bin/env python3
"""Locate the installed pro-egm plugin, so a command in this plugin can follow its steps.

    pro-egm.py [--repo ROOT]

A command here cannot reach pro-egm through `${CLAUDE_PLUGIN_ROOT}`, which points at this
plugin. This prints where pro-egm is instead, as JSON:

  status       ready, absent or unreachable
  root         the install folder of pro-egm, or null
  goldfish     <root>/scripts/goldfish.py, or null
  runningEgm   <root>/skills/egm-bridge/running-egm.md, or null
  commands     each pro-egm command this loop hands work to, mapped to its file or null

ready means the install was found with the two bridge files a step needs. absent means no
enabled pro-egm install covers this repo. unreachable means the install list could not be
read, or an install was found without the files a step needs.

It reads `claude plugin list --json` and nothing else. Every path printed is a regular file
with no symlink in any component, inside the install folder. Nothing is executed and nothing
is written. Standard library only, no network.

Exit 0 always: a command branches on `status`, never on an exit code.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import subprocess
import sys

NAME = "pro-egm"
PREFERRED = "pro-egm@pro-dev-skillset"
COMMANDS = ("brainstorm", "draft", "resolve", "review")
GOLDFISH = os.path.join("scripts", "goldfish.py")
RUNNING = os.path.join("skills", "egm-bridge", "running-egm.md")


def find_repo(explicit: str | None) -> str:
    if explicit:
        return os.path.realpath(explicit)
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True,
                             text=True, timeout=10, stdin=subprocess.DEVNULL)
        if out.returncode == 0 and out.stdout.strip():
            return os.path.realpath(out.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.realpath(os.getcwd())


def covers(entry: dict, repo: str) -> bool:
    if entry.get("scope") == "user":
        return True
    pp = entry.get("projectPath")
    if not isinstance(pp, str) or not pp:
        return False
    real = os.path.realpath(pp)
    return real == repo or real.startswith(repo + os.sep)


def plain_file(base: str, rel: str) -> str | None:
    """A path under base, or None when it is missing, a symlink or not a regular file."""
    path = os.path.join(base, rel)
    try:
        st = os.lstat(path)
    except OSError:
        return None
    if stat.S_ISREG(st.st_mode) and os.path.realpath(path) == path and path.startswith(base + os.sep):
        return path
    return None


def list_installs(repo: str):
    """Every install entry with an id, or None when the list could not be read."""
    exe = shutil.which("claude")
    if not exe:
        return None
    try:
        # enabled is reported for the cwd's project, so list from the repo itself
        res = subprocess.run([exe, "plugin", "list", "--json"], cwd=repo, capture_output=True,
                             text=True, timeout=30, stdin=subprocess.DEVNULL)
        if res.returncode != 0:
            return None
        data = json.loads(res.stdout)
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    if not isinstance(data, list):
        return None
    return [d for d in data if isinstance(d, dict) and isinstance(d.get("id"), str)]


def report(status: str, base: str | None = None) -> dict:
    return {
        "status": status,
        "root": base,
        "goldfish": plain_file(base, GOLDFISH) if base else None,
        "runningEgm": plain_file(base, RUNNING) if base else None,
        "commands": {c: (plain_file(base, os.path.join("commands", c + ".md")) if base else None)
                     for c in COMMANDS},
    }


def resolve(repo: str) -> dict:
    rows = list_installs(repo)
    if rows is None:
        return report("unreachable")
    # The id carries the marketplace, and only this marketplace's pro-egm is accepted. The
    # command reads files from whatever this returns and follows them as instructions under
    # its own allowed-tools, so a plugin that merely shares the name pro-egm must not match.
    mine = [e for e in rows
            if e["id"] == PREFERRED and e.get("enabled") is not False
            and covers(e, repo) and isinstance(e.get("installPath"), str) and e["installPath"]]
    if not mine:
        others = sorted({e["id"] for e in rows
                         if isinstance(e.get("id"), str) and e["id"].split("@")[0] == NAME
                         and e["id"] != PREFERRED})
        if others:
            out = report("unreachable")
            out["foreign"] = others  # named so the command can say which install it declined
            return out
        return report("absent")
    for entry in mine:
        out = report("ready", os.path.realpath(entry["installPath"]))
        if out["goldfish"] and out["runningEgm"]:
            return out
        out["status"] = "unreachable"
        return out  # an install missing a bridge file is not completed by the next one
    return report("absent")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=None)
    args = ap.parse_args()
    print(json.dumps(resolve(find_repo(args.repo)), indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:
        print(json.dumps(report("unreachable"), indent=2))
        sys.exit(0)
