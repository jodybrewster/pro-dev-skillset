#!/usr/bin/env python3
"""Print the spec-method hand-offs installed for one SDLC stage.

    methods.py --stage intent|spec|plan|review [--target PATH] [--repo ROOT]

Reads `claude plugin list --json`, keeps enabled `*@pro-dev-skillset` installs that
cover the repo, reads `sdlc-method.json` from each install folder and prints one line
per hand-off for the stage. The files are data: only `method`, `when` and `offer` are
printed, each trimmed to one line; nothing in them is ever executed. Any failure to
list or read prints nothing and exits 0, so the loop never breaks. Standard library only.
"""
import argparse
import json
import os
import re
import shutil
import stat
import subprocess
import sys

MARKETPLACE = "pro-dev-skillset"
TRUSTED_REPO = "jodybrewster/pro-dev-skillset"
STAGES = ("intent", "spec", "plan", "review")
MAX_BYTES = 64 * 1024
PLUGIN_ID = re.compile(r"^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$")


def config_dir() -> str:
    base = os.environ.get("CLAUDE_CONFIG_DIR")
    if base:
        return base
    return os.path.join(os.path.expanduser("~"), ".claude")


def is_inside(path: str, root: str) -> bool:
    try:
        return os.path.commonpath([os.path.realpath(path), root]) == root
    except ValueError:
        return False


def covers_repo(entry: dict, repo: str) -> bool:
    if entry.get("scope") == "user":
        return True
    pp = entry.get("projectPath")
    return isinstance(pp, str) and bool(pp) and is_inside(pp, repo)


def find_repo(explicit):
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


def list_installs():
    exe = shutil.which("claude")
    if not exe:
        return None
    try:
        res = subprocess.run([exe, "plugin", "list", "--json"], capture_output=True, text=True,
                             timeout=20, stdin=subprocess.DEVNULL)
        if res.returncode != 0:
            return None
        data = json.loads(res.stdout)
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    if not isinstance(data, list):
        return None
    return [d for d in data if isinstance(d, dict) and isinstance(d.get("id"), str)]


def marketplace_trusted() -> bool:
    path = os.path.join(config_dir(), "plugins", "known_marketplaces.json")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return False
    row = data.get(MARKETPLACE) if isinstance(data, dict) else None
    src = row.get("source") if isinstance(row, dict) else None
    if not isinstance(src, dict) or src.get("source") != "github":
        return False
    repo = src.get("repo")
    return isinstance(repo, str) and repo.lower() == TRUSTED_REPO


def read_method_file(install_path):
    """Return parsed JSON, or None when absent or unsafe. Raises ValueError on bad JSON."""
    if not isinstance(install_path, str) or not install_path:
        return None
    path = os.path.join(install_path, "sdlc-method.json")
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except OSError:
        return None
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            return None
        raw = os.read(fd, MAX_BYTES + 1)
    except OSError:
        return None
    finally:
        os.close(fd)
    if len(raw) > MAX_BYTES:
        return None
    return json.loads(raw.decode("utf-8"))


def one_line(value: str) -> str:
    return " ".join(re.sub(r"[\x00-\x1f\x7f]", " ", value).split())


def valid_method(doc):
    """Return (method, requires, handoffs) or None when the shape is wrong."""
    if not isinstance(doc, dict):
        return None
    method, requires, handoffs = doc.get("method"), doc.get("requires"), doc.get("handoffs")
    if not isinstance(method, str) or not one_line(method):
        return None
    if requires is not None and not (isinstance(requires, str) and PLUGIN_ID.match(requires)):
        return None
    if not isinstance(handoffs, list):
        return None
    good = []
    for h in handoffs:
        if not (isinstance(h, dict) and h.get("stage") in STAGES
                and isinstance(h.get("when"), str) and isinstance(h.get("offer"), str)
                and h["offer"].lstrip().startswith("/")):
            return None
        good.append(h)
    return method, requires, good


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True, choices=STAGES)
    ap.add_argument("--target", default="")
    ap.add_argument("--repo", default=None)
    args = ap.parse_args()

    installs = list_installs()
    if not installs:
        return 0
    repo = find_repo(args.repo)
    live = [i for i in installs if i.get("enabled") is not False and covers_repo(i, repo)]
    if not live:
        return 0
    live_ids = {i["id"] for i in live}
    ours = [i for i in live if i["id"].endswith("@" + MARKETPLACE)]
    if not ours or not marketplace_trusted():
        return 0

    target = one_line(args.target)
    seen = set()
    for inst in ours:
        try:
            doc = read_method_file(inst.get("installPath"))
        except ValueError:
            sys.stderr.write("methods: skipped %s, sdlc-method.json is not valid JSON\n"
                             % one_line(inst["id"]))
            continue
        parsed = valid_method(doc) if doc is not None else None
        if parsed is None:
            continue
        method, requires, handoffs = parsed
        mine = [h for h in handoffs if h["stage"] == args.stage]
        if not mine or method in seen:
            continue
        seen.add(method)
        name = one_line(method)
        if requires is not None and requires not in live_ids:
            print("%s needs %s: run /pro-dev install" % (name, requires))
            continue
        for h in mine:
            print("%s: %s -> %s" % (name, one_line(h["when"]),
                                    one_line(h["offer"]).replace("{target}", target)))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
