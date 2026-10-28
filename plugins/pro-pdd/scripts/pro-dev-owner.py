#!/usr/bin/env python3
"""Run pro-core's pro-dev.py for this plugin's own engine rows and nothing else.

The same file ships byte-identical in every plugin that owns registry rows. The owner
is the plugin's own name. No argument, flag or environment variable overrides the
owner, the marketplace check, the path check or the version floor.
"""
import json
import os
import re
import subprocess
import sys

MARKETPLACE = "pro-dev-skillset"
TRUSTED_REPO = "jodybrewster/pro-dev-skillset"
PRO_CORE = f"pro-core@{MARKETPLACE}"
MIN_VERSION = (0, 19, 0)
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
RANK = {"local": 0, "project": 1, "user": 2}


def die(msg):
    print(msg, file=sys.stderr, flush=True)
    sys.exit(2)


def inside(path, root):
    try:
        return os.path.commonpath([path, root]) == root
    except ValueError:
        return False


def argv_ok(a):
    return (a in (["status", "--json"], ["status"], ["run", "all", "install"], ["run", "all", "update"])
            or (len(a) == 3 and a[0] == "answer" and a[2] in ("yes", "no") and bool(ID_RE.match(a[1]))))


def find_repo():
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True,
                             timeout=15, stdin=subprocess.DEVNULL)
        if out.returncode == 0 and out.stdout.strip():
            return os.path.realpath(out.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.realpath(os.getcwd())


def covers_repo(entry, repo):
    if entry.get("scope") == "user":
        return True
    pp = entry.get("projectPath")
    return isinstance(pp, str) and bool(pp) and inside(os.path.realpath(pp), repo)


def marketplace_trusted(cfg):
    try:
        with open(os.path.join(cfg, "plugins", "known_marketplaces.json"), encoding="utf-8") as fh:
            row = json.load(fh).get(MARKETPLACE)
        src = row.get("source")
        return src.get("source") == "github" and src.get("repo").lower() == TRUSTED_REPO
    except (OSError, ValueError, AttributeError, TypeError):
        return False


def list_plugins(repo):
    fail = "cannot read plugin installs: claude plugin list --json failed; run it to see why"
    try:
        out = subprocess.run(["claude", "plugin", "list", "--json"], capture_output=True, text=True,
                             timeout=60, stdin=subprocess.DEVNULL, cwd=repo)
        data = json.loads(out.stdout) if out.returncode == 0 else None
    except (OSError, ValueError, subprocess.SubprocessError):
        data = None
    if not isinstance(data, list):
        die(fail)
    return [e for e in data if isinstance(e, dict)]


def pick_pro_core(entries, repo):
    cands = [e for e in entries if e.get("id") == PRO_CORE and e.get("scope") in RANK and covers_repo(e, repo)]
    if not cands:
        die(f"pro-core is not installed for this repo; install it with claude plugin install {PRO_CORE}")
    exact = lambda e: 0 if os.path.realpath(e.get("projectPath") or "") == repo else 1
    best = min((RANK[e["scope"]], exact(e)) for e in cands)
    top = [e for e in cands if (RANK[e["scope"]], exact(e)) == best]
    if len({e.get("installPath") for e in top}) > 1:
        die("more than one pro-core install covers this repo with different paths; "
            "remove one with claude plugin uninstall or disable it")
    if top[0].get("enabled") is not True:
        die(f"pro-core is disabled for this repo; enable it with claude plugin enable {PRO_CORE}")
    return top[0]


def main():
    args = sys.argv[1:]
    if not argv_ok(args):
        die("usage: pro-dev-owner.py status [--json] | answer <id> yes|no | run all install|update")
    here = os.path.dirname(os.path.abspath(__file__))
    try:
        with open(os.path.join(here, "..", ".claude-plugin", "plugin.json"), encoding="utf-8") as fh:
            owner = json.load(fh)["name"]
    except (OSError, ValueError, KeyError, TypeError):
        owner = None
    if not isinstance(owner, str) or not ID_RE.match(owner):
        die("cannot read this plugin's name from .claude-plugin/plugin.json")
    cfg = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude")
    if not marketplace_trusted(cfg):
        die(f"{MARKETPLACE} is not the trusted marketplace {TRUSTED_REPO}; refusing to run its pro-core")
    repo = find_repo()
    entry = pick_pro_core(list_plugins(repo), repo)
    ip = entry.get("installPath")
    script = os.path.realpath(os.path.join(ip, "scripts", "pro-dev.py")) if isinstance(ip, str) and ip else ""
    cache = os.path.realpath(os.path.join(cfg, "plugins", "cache", MARKETPLACE, "pro-core"))
    why = None
    if not script or not os.path.isfile(script):
        why = "not a regular file"
    elif not inside(script, cache):
        why = f"outside {cache}"
    elif inside(script, repo):
        why = f"inside the repo {repo}"
    if why:
        die(f"refusing to run {script or ip}: {why}")
    found = str(entry.get("version"))
    m = re.match(r"^(\d+)\.(\d+)\.(\d+)", found)
    if not m or tuple(int(x) for x in m.groups()) < MIN_VERSION:
        floor = ".".join(map(str, MIN_VERSION))
        die(f"pro-core {found} is older than {floor}; update it with /pro-dev update or claude plugin update {PRO_CORE}")
    print(f"pro-core {found} at {script}", file=sys.stderr, flush=True)
    sys.stdout.flush()
    os.chdir(repo)
    os.execv(sys.executable, [sys.executable, "-I", script, "--owner", owner, *args])


if __name__ == "__main__":
    main()
