#!/usr/bin/env python3
"""pro-dev.py - the deterministic half of /pro-dev.

Reads the engine registry (registry/engines.json) and the plugin installs that
`claude plugin list --json` reports, then installs, updates and reports on the
external engines the bridge skills route to. The /pro-dev command owns the
questions and the file drafting; everything else lives here so it also works
from a plain terminal with no Claude session.

Subcommands:
  status [--json]                  plugins covering the repo, engine states, answers
  run <id|all> install|update      run one engine row, or every row that applies
  answer <id> yes|no               save an answer for an optional row
  plugins update                   refresh the marketplace, update covering installs
  plugins swap-starter             replace pro-starter with pro-dev-starter
  stale [--remove]                 list (or remove) installs whose folder is gone

Rules this script keeps:
  - registry argv run through subprocess with no shell; nothing read from the
    repo, the answers file or a plugin payload is ever put into a command
  - a failed step is reported and the run carries on
  - writes stay inside the repo, except stale --remove, which edits
    installed_plugins.json after writing a backup beside it
  - only python3 and the standard library
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile

MARKETPLACE = "pro-dev-skillset"
SCOPES = ("user", "project", "local")
ANSWERS_FILE = os.path.join(".claude", "pro-dev.json")
PLUGIN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9][A-Za-z0-9._-]*$")
ENGINE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
STARTER_DEPS = ("pro-nextjs", "pro-astro")


# --- environment --------------------------------------------------------------

def config_dir() -> str:
    base = os.environ.get("CLAUDE_CONFIG_DIR")
    if base:
        return base
    return os.path.join(os.path.expanduser("~"), ".claude")


def registry_path() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "registry", "engines.json")


def installed_plugins_path() -> str:
    return os.path.join(config_dir(), "plugins", "installed_plugins.json")


def find_repo(explicit: str | None) -> str:
    if explicit:
        return os.path.realpath(explicit)
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True,
                             text=True, timeout=15, stdin=subprocess.DEVNULL)
        top = out.stdout.strip()
        if out.returncode == 0 and top:
            return os.path.realpath(top)
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.realpath(os.getcwd())


def load_registry() -> dict:
    with open(registry_path(), "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict) or not isinstance(data.get("engines"), list):
        raise ValueError("registry/engines.json has an unexpected shape")
    return data


def say(msg: str = "") -> None:
    print(msg, flush=True)


# --- plugin installs ----------------------------------------------------------

def is_inside(path: str, root: str) -> bool:
    try:
        return os.path.commonpath([os.path.realpath(path), root]) == root
    except ValueError:
        return False


def covers_repo(entry: dict, repo: str) -> bool:
    """R10: user scope, or a projectPath that is the repo root or inside it."""
    if entry.get("scope") == "user":
        return True
    pp = entry.get("projectPath")
    return isinstance(pp, str) and bool(pp) and is_inside(pp, repo)


def read_installed_file() -> list[dict] | None:
    """Fallback: installed_plugins.json, read only."""
    try:
        with open(installed_plugins_path(), "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    plugins = data.get("plugins") if isinstance(data, dict) else None
    if not isinstance(plugins, dict):
        return None
    out = []
    for pid, items in plugins.items():
        if not isinstance(items, list):
            continue
        for it in items:
            if not isinstance(it, dict):
                continue
            out.append({
                "id": pid, "scope": it.get("scope"), "version": it.get("version"),
                "projectPath": it.get("projectPath"), "installPath": it.get("installPath"),
                "enabled": True,
            })
    return out


def read_installs() -> tuple[list[dict], str]:
    """Return (installs, source). Prefer `claude plugin list --json`."""
    exe = shutil.which("claude")
    if exe:
        try:
            res = subprocess.run([exe, "plugin", "list", "--json"], capture_output=True, text=True,
                                 timeout=120, stdin=subprocess.DEVNULL)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                if isinstance(data, list):
                    items = [d for d in data if isinstance(d, dict) and isinstance(d.get("id"), str)]
                    project_missing = any(d.get("scope") in ("project", "local") and not d.get("projectPath")
                                          for d in items)
                    if not project_missing:
                        return items, "claude plugin list --json"
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    fallback = read_installed_file()
    if fallback is not None:
        return fallback, "installed_plugins.json"
    return [], "none"


def pro_dev_installs(installs: list[dict]) -> list[dict]:
    return [i for i in installs if isinstance(i.get("id"), str) and i["id"].endswith("@" + MARKETPLACE)]


def name_of(pid: str) -> str:
    return pid.split("@", 1)[0]


def latest_versions() -> dict:
    """Marketplace versions from the local clone, no network."""
    try:
        with open(os.path.join(config_dir(), "plugins", "known_marketplaces.json"), "r", encoding="utf-8") as fh:
            known = json.load(fh)
        loc = known[MARKETPLACE]["installLocation"]
        with open(os.path.join(loc, ".claude-plugin", "marketplace.json"), "r", encoding="utf-8") as fh:
            mp = json.load(fh)
        return {p["name"]: p.get("version") for p in mp.get("plugins", []) if isinstance(p, dict) and "name" in p}
    except (OSError, ValueError, KeyError, TypeError):
        return {}


def owner_active(installs: list[dict], owner: str, repo: str) -> bool:
    pid = f"{owner}@{MARKETPLACE}"
    return any(i.get("id") == pid and i.get("enabled") is not False and covers_repo(i, repo) for i in installs)


# --- answers ------------------------------------------------------------------

class AnswersError(ValueError):
    """The answers file or its folder cannot be trusted; nothing was written."""


MAX_ANSWERS_BYTES = 64 * 1024


def answers_problem(repo: str) -> str | None:
    """Return why the answers file is unsafe to read or write, or None.

    `.claude/pro-dev.json` is repo-controlled, so a symlink there (or a symlinked
    `.claude` folder) must never be followed. Absent is fine; a regular file is fine.
    """
    path = os.path.join(repo, ANSWERS_FILE)
    claude_dir = os.path.join(repo, ".claude")
    want = os.path.join(os.path.realpath(repo), ".claude")
    try:
        os.lstat(claude_dir)
    except FileNotFoundError:
        return None
    except OSError as exc:
        return f"cannot inspect {claude_dir} ({exc})"
    if os.path.realpath(os.path.dirname(path)) != want:
        return f"{claude_dir} is a symlink or resolves outside the repo; refusing to touch {ANSWERS_FILE}"
    try:
        st = os.lstat(path)
    except FileNotFoundError:
        return None
    except OSError as exc:
        return f"cannot inspect {path} ({exc})"
    if not stat.S_ISREG(st.st_mode):
        return f"{path} is not a regular file (symlink or special file); refusing to touch it"
    return None


def read_answers(repo: str) -> tuple[dict, bool]:
    """Return (data, malformed). A missing file is an empty record, not malformed.

    An unsafe path (symlink, special file, symlinked folder) reads as malformed and is never opened.
    """
    path = os.path.join(repo, ANSWERS_FILE)
    if answers_problem(repo):
        return {}, True
    if not os.path.lexists(path):
        return {}, False
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
        with os.fdopen(fd, "rb") as fh:
            raw = fh.read(MAX_ANSWERS_BYTES + 1)
        if len(raw) > MAX_ANSWERS_BYTES:
            return {}, True
        data = json.loads(raw.decode("utf-8"))
    except (OSError, ValueError):
        return {}, True
    if not isinstance(data, dict):
        return {}, True
    return data, False


def saved_answer(data: dict, engine_id: str) -> str | None:
    answers = data.get("answers")
    if not isinstance(answers, dict):
        return None
    entry = answers.get(engine_id)
    value = entry.get("answer") if isinstance(entry, dict) else None
    return value if value in ("yes", "no") else None  # anything else is ignored, never run


def write_answers(repo: str, data: dict) -> bool:
    """Write only when the content changes. Returns True when a write happened.

    Raises AnswersError, writing nothing, for an unsafe path or a malformed existing file.
    """
    problem = answers_problem(repo)
    if problem:
        raise AnswersError(problem)
    path = os.path.join(repo, ANSWERS_FILE)
    existing, malformed = read_answers(repo)
    if malformed:
        raise AnswersError(f"{path} is not valid JSON. Fix or delete it, then retry; nothing was written.")
    text = json.dumps(data, indent=2, sort_keys=True) + "\n"
    if os.path.lexists(path) and json.dumps(existing, indent=2, sort_keys=True) + "\n" == text:
        return False
    claude_dir = os.path.dirname(path)
    os.makedirs(claude_dir, exist_ok=True)
    if answers_problem(repo):  # re-check after creating the folder
        raise AnswersError(f"{claude_dir} changed while writing; nothing was written.")
    fd, tmp = tempfile.mkstemp(dir=claude_dir, prefix=".pro-dev.json.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return True


# --- engine state -------------------------------------------------------------

def skill_root(scope: str, repo: str) -> str | None:
    if scope == "project":
        return os.path.join(repo, ".claude")
    if scope == "user":
        return config_dir()
    return None


def detected(row: dict, repo: str, installs: list[dict]) -> bool:
    det = row.get("detect")
    if not isinstance(det, dict):
        return False
    if isinstance(det.get("plugin"), str):
        return any(i.get("id") == det["plugin"] and i.get("enabled") is not False and covers_repo(i, repo)
                   for i in installs)
    needed = det.get("all")
    if not isinstance(needed, list) or not needed:
        return False
    for item in needed:
        ok = False
        for scope in item.get("scopes", []):
            root = skill_root(scope, repo)
            if root and os.path.isfile(os.path.join(root, *item["file"].split("/"))):
                ok = True
                break
        if not ok:
            return False
    return True


def engine_state(row: dict, repo: str, installs: list[dict], answers: dict) -> dict:
    owner = row["owner"]
    ans = saved_answer(answers, row["id"])
    if not owner_active(installs, owner, repo):
        state = "not-applicable"
    elif detected(row, repo, installs):
        state = "installed"
    elif not row.get("default") and ans == "no":
        state = "declined"
    else:
        state = "missing"
    return {
        "id": row["id"], "owner": owner, "kind": row.get("kind"), "default": bool(row.get("default")),
        "bridges": row.get("bridges", []), "state": state, "answer": ans,
        "why": row.get("why", ""),
        "needsQuestion": state == "missing" and not row.get("default") and ans is None,
        "wantsInstall": state == "missing" and (bool(row.get("default")) or ans == "yes"),
    }


# --- running commands ---------------------------------------------------------

def tool_missing(argv: list[str]) -> str | None:
    exe = argv[0]
    if shutil.which(exe):
        return None
    if exe == "claude":
        return "claude is not on PATH. Install Claude Code, then retry."
    if exe == "npx":
        return "npx is not on PATH. Install Node.js (it ships npx), then retry."
    return f"{exe} is not on PATH."


# The repo is the cwd on purpose: project-scope skills installs need it. The repo's own
# .npmrc and node_modules/.bin can influence what npx resolves, which is the same trust
# the person already gives the repo by opening it.
def run_argv(argv: list[str], cwd: str) -> tuple[bool, str]:
    missing = tool_missing(argv)
    if missing:
        return False, missing
    try:
        res = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=900,
                             stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError) as exc:
        return False, f"{type(exc).__name__}: {exc}"
    tail = (res.stdout + res.stderr).strip().splitlines()[-3:]
    return res.returncode == 0, " | ".join(tail)


def valid_argv(value) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(a, str) for a in value)


def retry_line(engine_id: str, action: str) -> str:
    return f"python3 {os.path.abspath(__file__)} run {engine_id} {action}"


def run_engine(row: dict, action: str, repo: str, installs: list[dict], answers: dict) -> tuple[str, str]:
    """Return (outcome, message). outcome: done, skipped, failed."""
    st = engine_state(row, repo, installs, answers)
    eid = row["id"]
    if st["state"] == "not-applicable":
        return "skipped", f"{eid}: skipped, owner {row['owner']} is not installed and enabled for this repo"
    if action == "install" and st["state"] == "installed":
        return "skipped", f"{eid}: already installed"
    if action == "update" and st["state"] != "installed":
        return "skipped", f"{eid}: not installed, nothing to update"
    argv = row.get(action)
    if not valid_argv(argv):
        return "failed", f"{eid}: registry row has no valid {action} argv"
    ok, detail = run_argv(argv, repo)
    if not ok:
        return "failed", f"{eid}: {action} failed ({detail}). Retry: {retry_line(eid, action)}"
    if not detected(row, repo, installs) and row.get("kind") != "claude-plugin":
        after = detected(row, repo, read_installs()[0])
        if not after:
            return "failed", f"{eid}: {action} exited 0 but the engine is still not detected. Retry: {retry_line(eid, action)}"
    return "done", f"{eid}: {action} ok"


# --- subcommands --------------------------------------------------------------

def cmd_status(args, repo: str) -> int:
    reg = load_registry()
    installs, source = read_installs()
    data, malformed = read_answers(repo)
    latest = latest_versions()
    plugins = []
    for i in pro_dev_installs(installs):
        name = name_of(i["id"])
        cov = covers_repo(i, repo)
        lag = bool(cov and latest.get(name) and i.get("version") != latest[name])
        plugins.append({
            "id": i["id"], "name": name, "scope": i.get("scope"), "version": i.get("version"),
            "latest": latest.get(name), "projectPath": i.get("projectPath"),
            "installPath": i.get("installPath"), "enabled": i.get("enabled") is not False,
            "covers": cov, "lagging": lag,
        })
    engines = [engine_state(r, repo, installs, data) for r in reg["engines"]]
    sdlc = next((p["installPath"] for p in plugins if p["name"] == "pro-ai-sdlc" and p["covers"]
                 and p["installPath"]), None)
    starter = [{"scope": p["scope"], "projectPath": p["projectPath"]} for p in plugins
               if p["name"] == "pro-starter" and p["covers"]]
    out = {
        "repo": repo, "registryVersion": reg.get("version"), "source": source,
        "tools": {"claude": bool(shutil.which("claude")), "npx": bool(shutil.which("npx"))},
        "answersFileMalformed": malformed, "savedRegistryVersion": data.get("registryVersion"),
        "plugins": plugins, "engines": engines, "aiSdlcInstallPath": sdlc, "starterShim": starter,
        "staleCount": len(find_stale()[0]),
    }
    if args.json:
        say(json.dumps(out, indent=2))
        return 0
    say(f"repo: {repo}")
    say(f"registry version: {out['registryVersion']} (last run: {out['savedRegistryVersion']})")
    say("plugins:")
    for p in plugins:
        mark = "" if p["covers"] else " (other repo, left alone)"
        lag = f" lags {p['latest']}" if p["lagging"] else ""
        say(f"  {p['name']} {p['scope']} {p['version']}{lag}{mark}")
    say("engines:")
    for e in engines:
        say(f"  {e['id']}: {e['state']}")
    return 0


def write_run_version(repo: str, reg: dict) -> bool:
    data, malformed = read_answers(repo)
    if malformed:
        say(f"answers file not updated: {answers_problem(repo) or 'it is not valid JSON, fix or delete it'}")
        return False
    if data.get("registryVersion") != reg.get("version"):
        data["registryVersion"] = reg.get("version")
        try:
            write_answers(repo, data)
        except AnswersError as exc:
            say(f"answers file not updated: {exc}")
            return False
    return True


def cmd_run(args, repo: str) -> int:
    reg = load_registry()
    rows = {r["id"]: r for r in reg["engines"] if isinstance(r, dict) and "id" in r}
    installs, _ = read_installs()
    data, _ = read_answers(repo)
    action = args.action
    failures: list[str] = []

    if args.id != "all":
        if args.id not in rows or not ENGINE_ID_RE.match(args.id):
            say(f"unknown engine id: {args.id}")
            return 2
        outcome, msg = run_engine(rows[args.id], action, repo, installs, data)
        say(msg)
        return 1 if outcome == "failed" else 0

    # all: update every installed row (update only), then install what is missing
    if action == "update":
        for row in rows.values():
            if engine_state(row, repo, installs, data)["state"] == "installed":
                outcome, msg = run_engine(row, "update", repo, installs, data)
                say(msg)
                if outcome == "failed":
                    failures.append(msg)
    installs, _ = read_installs()
    for row in rows.values():
        st = engine_state(row, repo, installs, data)
        if st["wantsInstall"]:
            say(f"{row['id']}: installing")
            outcome, msg = run_engine(row, "install", repo, installs, data)
            say(msg)
            if outcome == "failed":
                failures.append(msg)
        elif st["state"] == "installed" and action == "install":
            say(f"{row['id']}: already installed")
    if not write_run_version(repo, reg):
        failures.append("answers file not updated")
    if failures:
        say("")
        say(f"{len(failures)} step(s) failed. Retry each with the command shown:")
        for f in failures:
            say(f"  {f}")
        return 1
    return 0


def cmd_answer(args, repo: str) -> int:
    reg = load_registry()
    rows = {r["id"]: r for r in reg["engines"] if isinstance(r, dict) and "id" in r}
    if args.id not in rows:
        say(f"unknown engine id: {args.id}")
        return 2
    if rows[args.id].get("default"):
        say(f"{args.id} is a default engine and is not asked about")
        return 2
    data, malformed = read_answers(repo)
    if malformed:
        say(f"cannot save the answer: {answers_problem(repo) or ANSWERS_FILE + ' is not valid JSON. Fix or delete it, then retry'}")
        return 1
    answers = data.get("answers") if isinstance(data.get("answers"), dict) else {}
    answers[args.id] = {"answer": args.value, "registryVersion": reg.get("version")}
    data["answers"] = answers
    try:
        changed = write_answers(repo, data)
    except AnswersError as exc:
        say(f"cannot save the answer: {exc}")
        return 1
    say(f"{args.id}: {args.value}" + ("" if changed else " (unchanged)"))
    return 0


def valid_plugin_id(pid) -> bool:
    return isinstance(pid, str) and bool(PLUGIN_ID_RE.match(pid)) and pid.endswith("@" + MARKETPLACE)


def install_cwd(entry: dict, repo: str) -> str | None:
    if entry.get("scope") == "user":
        return repo
    pp = entry.get("projectPath")
    if isinstance(pp, str) and os.path.isdir(pp):
        return pp
    return None


def cmd_plugins_update(args, repo: str) -> int:
    failures: list[str] = []
    ok, detail = run_argv(["claude", "plugin", "marketplace", "update", MARKETPLACE], repo)
    say("marketplace refresh: ok" if ok else f"marketplace refresh failed ({detail}). Retry: claude plugin marketplace update {MARKETPLACE}")
    if not ok:
        failures.append("marketplace refresh")
    installs, _ = read_installs()
    targets = [i for i in pro_dev_installs(installs) if covers_repo(i, repo) and valid_plugin_id(i["id"])
               and i.get("scope") in SCOPES]
    before = {(i["id"], i.get("scope"), i.get("projectPath")): i.get("version") for i in targets}
    for i in targets:
        cwd = install_cwd(i, repo)
        if cwd is None:
            say(f"{i['id']} {i['scope']}: project folder is missing, skipped (see stale)")
            continue
        ok, detail = run_argv(["claude", "plugin", "update", i["id"], "--scope", i["scope"]], cwd)
        if not ok:
            failures.append(i["id"])
            say(f"{i['id']} {i['scope']}: update failed ({detail}). Retry from {cwd}: claude plugin update {i['id']} --scope {i['scope']}")
    after_installs, _ = read_installs()
    after = {(i["id"], i.get("scope"), i.get("projectPath")): i.get("version") for i in pro_dev_installs(after_installs)}
    for key, old in before.items():
        new = after.get(key, old)
        note = "unchanged" if new == old else f"{old} -> {new}"
        say(f"{key[0]} {key[1]}: {note}")
    if failures:
        say(f"{len(failures)} step(s) failed.")
        return 1
    return 0


def cmd_swap_starter(args, repo: str) -> int:
    installs, _ = read_installs()
    shims = [i for i in pro_dev_installs(installs) if i["id"] == f"pro-starter@{MARKETPLACE}" and covers_repo(i, repo)
             and i.get("scope") in SCOPES]
    if not shims:
        say("pro-starter is not installed for this repo, nothing to swap")
        return 0
    failed = False
    for s in shims:
        cwd = install_cwd(s, repo)
        if cwd is None:
            say(f"pro-starter {s['scope']}: project folder is missing, skipped")
            continue
        scope = s["scope"]
        steps = []
        for dep in STARTER_DEPS:
            has = any(i.get("id") == f"{dep}@{MARKETPLACE}" and i.get("scope") == scope
                      and i.get("projectPath") == s.get("projectPath") for i in installs)
            if has:
                steps.append(["claude", "plugin", "install", f"{dep}@{MARKETPLACE}", "--scope", scope])
        steps.append(["claude", "plugin", "install", f"pro-dev-starter@{MARKETPLACE}", "--scope", scope])
        steps.append(["claude", "plugin", "uninstall", f"pro-starter@{MARKETPLACE}", "--scope", scope])
        for argv in steps:
            ok, detail = run_argv(argv, cwd)
            if not ok:
                say(f"{' '.join(argv)} failed ({detail}). Stopped; pro-starter is left in place for this scope.")
                failed = True
                break
            say(f"ok: {' '.join(argv)}")
    return 1 if failed else 0


def skip_unreachable(pp: str) -> bool:
    """True for a path on an unmounted /Volumes drive or under an unreadable ancestor."""
    parts = pp.split("/")
    if pp.startswith("/Volumes/") and len(parts) > 3 and parts[2]:
        mount = "/Volumes/" + parts[2]
        # /Volumes/<boot disk> is a symlink to /, which counts as present
        if not (os.path.ismount(mount) or (os.path.islink(mount) and os.path.realpath(mount) == "/")):
            return True
    cur = pp
    while not os.path.exists(cur):
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    return not os.access(cur, os.R_OK)


def find_stale() -> tuple[list[dict], dict | None, str | None]:
    """Return (stale entries, parsed file or None, problem or None)."""
    path = installed_plugins_path()
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return [], None, None
    except (OSError, ValueError):
        return [], None, "installed_plugins.json is not valid JSON"
    if (not isinstance(data, dict) or data.get("version") != 2 or not isinstance(data.get("plugins"), dict)
            or any(not isinstance(v, list) or any(not isinstance(e, dict) for e in v)
                   for v in data["plugins"].values())):
        return [], None, "installed_plugins.json has a shape this script does not know"
    stale = []
    for pid, items in data["plugins"].items():
        if not pid.endswith("@" + MARKETPLACE):
            continue
        for e in items:
            pp = e.get("projectPath")
            if isinstance(pp, str) and pp and not os.path.isdir(pp) and not skip_unreachable(pp):
                stale.append({"id": pid, "scope": e.get("scope"), "projectPath": pp})
    return stale, data, None


def cmd_stale(args, repo: str) -> int:
    stale, data, problem = find_stale()
    if problem:
        say(f"{problem}. Nothing changed.")
        return 1
    if not stale:
        say("no stale installs (entries on unmounted drives are skipped)")
        return 0
    for s in stale:
        say(f"stale: {s['id']} {s['scope']} {s['projectPath']}")
    if not args.remove:
        say(f"{len(stale)} stale install(s). Run stale --remove to clean them. Entries on unmounted drives are skipped.")
        return 0
    path = installed_plugins_path()
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = f"{path}.bak-{stamp}"
    try:
        shutil.copy2(path, backup)
        gone = {(s["id"], s["scope"], s["projectPath"]) for s in stale}
        for pid in list(data["plugins"].keys()):
            kept = [e for e in data["plugins"][pid] if (pid, e.get("scope"), e.get("projectPath")) not in gone]
            if kept:
                data["plugins"][pid] = kept
            else:
                del data["plugins"][pid]
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".installed_plugins.")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
            fh.write("\n")
        os.replace(tmp, path)
    except OSError as exc:
        say(f"could not edit installed_plugins.json ({exc}). Backup, if written: {backup}")
        return 1
    say(f"removed {len(stale)} stale install(s). Backup: {backup}")
    return 0


# --- entry --------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="pro-dev.py", description=__doc__.split("\n")[0])
    p.add_argument("--repo", help="repo root (default: git toplevel of the current folder)")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("status")
    s.add_argument("--json", action="store_true")
    r = sub.add_parser("run")
    r.add_argument("id")
    r.add_argument("action", choices=["install", "update"])
    a = sub.add_parser("answer")
    a.add_argument("id")
    a.add_argument("value", choices=["yes", "no"])
    pl = sub.add_parser("plugins")
    pl.add_argument("what", choices=["update", "swap-starter"])
    st = sub.add_parser("stale")
    st.add_argument("--remove", action="store_true")
    return p


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    repo = find_repo(args.repo)
    try:
        if args.cmd == "status":
            return cmd_status(args, repo)
        if args.cmd == "run":
            return cmd_run(args, repo)
        if args.cmd == "answer":
            return cmd_answer(args, repo)
        if args.cmd == "plugins":
            return cmd_plugins_update(args, repo) if args.what == "update" else cmd_swap_starter(args, repo)
        if args.cmd == "stale":
            return cmd_stale(args, repo)
    except (OSError, ValueError) as exc:
        say(f"pro-dev.py: {type(exc).__name__}: {exc}")
        return 1
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
