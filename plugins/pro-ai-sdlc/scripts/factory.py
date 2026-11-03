#!/usr/bin/env python3
"""factory - the escalation level, the role map and the host-side runner of the software factory.

  factory.py level <intent dir> [--repo DIR] [--json] [--write]
  factory.py roles [--repo DIR] [--json] [--worktree]
  factory.py next [--repo DIR]
  factory.py run (<intent dir> | --next) [--repo DIR] [--max-cost-usd 8] [--model opus] [--image NAME]
                 [--marketplace-ref REF] [--timeout-min N] [--checks-timeout-min N] [--max-runs N]
                 [--max-daily-usd N] [--allow-broad-token] [--allow-unprotected] [--dry-run]
  factory.py record <intent dir> --state S [--reason TEXT] [--pr URL] [--cost USD] ...
  factory.py verify brief|build <intent dir> --pr N [--repo DIR] [--json] [--checks-timeout-min N]

The session proposes and this script decides. `run` starts a Docker container per phase (brief,
then build) on a fresh clone; the session inside writes files and opens a pull request and never
merges. The checks and the merge happen here, on the host, on a head this script fetched itself,
and only the run writes the record. The level rules, the host checks and the record are in
intent/2026-11-03-software-factory/plan.md and docs/loop-records.md.

Exit status. level: 0 unchanged, 3 raised, 2 could not run. verify: 0 pass, 3 raise, 2 could not
run. run: 0 merged, 3 stopped with the level raised, 2 error, 1 refused before it started.
64 for a usage error everywhere.

Python 3 standard library only. No model call. Every subprocess is an argv list.
`run <intent dir>` on a folder whose record shows a build PR that is still open skips the session and
goes straight to the host checks and the merge (resume).
Test hooks: FACTORY_DOCKER, FACTORY_GH, FACTORY_RISK_CLASSIFY and FACTORY_FLOOR_GUARD name other
binaries or scripts; FACTORY_CHECKS_WAIT and FACTORY_CHECKS_POLL set the seconds to wait for PR checks.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import evidence  # noqa: E402
from evidence import Refuse  # noqa: E402

FOLDER_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$")
ROLE_KEYS = ("product_owner", "engineer", "lead", "policy_owner", "platform_owner")
LEVEL1_AUTHORS = ("product_owner", "engineer")
STATES = ("queued", "brief", "build", "verify", "merged", "stopped", "error")
STATUS_OF = {"merged": "pass", "stopped": "partial", "error": "fail"}  # every other state is info
DEFAULT_MAX_RUNS = 10
DEFAULT_MAX_DAILY_USD = 40.0
IMAGE_NAME = "pro-dev-factory"
DEFAULT_CHECKS_TIMEOUT_MIN = 20
GIT_TIMEOUT = 60
GH_TIMEOUT = 120
PHASE_TIMEOUT = 45 * 60
POLICY_NAMES = ("review.md", "claude.md", "agents.md", "constraints.md")
POLICY_DIRS = (".claude", ".pro-dev", ".github")

# Words that put an intent at level 3. Matched as whole words, case-insensitive, with a plural or
# past-tense suffix; `.env` is matched as a file name.
STOP_WORDS = [
    "auth", "authentication", "authorization", "login", "password", "oauth", "session", "permission",
    "migration", "schema change", "payment", "billing", "stripe", "deploy", "release", "secret",
    "token", "credential", "api key", "environment variable", "env var", "personal data", "export",
]
DEP_PHRASES = [
    r"new\s+(?:dependency|dependencies|library|libraries|package|packages)",
    r"add(?:ing)?\s+(?:a|an|the)?\s*(?:dependency|dependencies|library|package|npm package|pip package)",
    r"(?:npm|pnpm|yarn|pip|pip3|cargo|gem)\s+(?:install|add)",
    r"install(?:ing)?\s+(?:a|an|the)\s+(?:library|package|module)",
]


NEGATION_RE = re.compile(r"\b(?:no|not|without|never|avoid|nor)\b[^.\n]{0,40}$", re.I)


def names_dependency(text: str) -> bool:
    """True when the text asks for a new dependency; "No new dependency." does not count.
    The merge-time classifier still flags a manifest that gains one, so this only needs to be fair."""
    for m in DEP_RE.finditer(text):
        if not NEGATION_RE.search(text[max(0, m.start() - 60):m.start()]):
            return True
    return False


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def today() -> str:
    return datetime.now().astimezone().strftime("%Y-%m-%d")


# --- subprocess helpers -----------------------------------------------------------------------

def run_cmd(args, cwd=None, env=None, timeout=GIT_TIMEOUT, stdin=None):
    """CompletedProcess for an argv list; a missing binary or a timeout is a Refuse, never a crash."""
    try:
        return subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout, input=stdin)
    except FileNotFoundError:
        raise Refuse(f"factory: {args[0]} not found")
    except subprocess.TimeoutExpired:
        raise Refuse(f"factory: {os.path.basename(args[0])} timed out after {timeout}s")
    except OSError as e:
        raise Refuse(f"factory: {os.path.basename(args[0])} failed ({e.strerror or e})")


def git(root, *args, timeout=GIT_TIMEOUT):
    return run_cmd(["git", *args], cwd=root, timeout=timeout)


def git_out(root, *args):
    """Stdout of a git call that must succeed, else None."""
    r = git(root, *args)
    return r.stdout if r.returncode == 0 else None


def repo_root(arg):
    path = os.path.realpath(arg or os.getcwd())
    r = git(path, "rev-parse", "--show-toplevel")
    if r.returncode != 0 or not r.stdout.strip():
        raise Refuse(f"factory: {path} is not inside a git repository")
    return os.path.realpath(r.stdout.strip())


def resolve(root, ref):
    r = git(root, "rev-parse", "--verify", "-q", ref + "^{commit}")
    return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None


def show(root, ref, path):
    """Text of <path> at <ref>, or None when it is not there."""
    r = git(root, "show", f"{ref}:{path}")
    return r.stdout if r.returncode == 0 else None


def default_tip(root):
    """(ref to read from, branch name). origin/HEAD, origin/main or origin/master; HEAD with no remote."""
    r = git(root, "symbolic-ref", "-q", "refs/remotes/origin/HEAD")
    if r.returncode == 0 and r.stdout.strip().startswith("refs/remotes/"):
        ref = r.stdout.strip()[len("refs/remotes/"):]
        if resolve(root, ref):
            return ref, ref.split("/", 1)[1]
    for cand in ("origin/main", "origin/master"):
        if resolve(root, cand):
            return cand, cand.split("/", 1)[1]
    return "HEAD", "HEAD"


def folder_of(root, arg):
    """(folder name, repo-relative dir) for an intent dir given absolute or relative; refuses anything else."""
    path = os.path.realpath(arg if os.path.isabs(arg) else os.path.join(os.getcwd(), arg))
    if not os.path.exists(path) and not os.path.isabs(arg):
        alt = os.path.realpath(os.path.join(root, arg))
        path = alt
    rel = os.path.relpath(path, root).replace(os.sep, "/")
    parts = rel.split("/")
    if len(parts) != 2 or parts[0] != "intent":
        raise Refuse(f"factory: {arg} is not a folder under intent/")
    if not FOLDER_RE.match(parts[1]):
        raise Refuse(f"factory: the folder name {parts[1]!r} must match {FOLDER_RE.pattern}")
    return parts[1], rel


# --- frontmatter and the roles block ---------------------------------------------------------

def frontmatter(text):
    """Plain `key: value` lines between the first two --- lines, and the body after them."""
    lines = (text or "").replace("\r\n", "\n").split("\n")
    if not lines or lines[0].strip() != "---":
        return {}, text or ""
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            fm = {}
            for ln in lines[1:i]:
                m = re.match(r"^([a-z_]+):\s*(.*?)\s*$", ln)
                if m:
                    v = re.sub(r"\s+#.*$", "", m.group(2))
                    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                        v = v[1:-1]
                    fm[m.group(1)] = v
            return fm, "\n".join(lines[i + 1:])
    return {}, text


def level_of(value):
    return int(value) if isinstance(value, str) and value.strip() in ("1", "2", "3") else None


def _unquote(v):
    v = v.strip()
    return v[1:-1] if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'" else v


def _strip_comment(line):
    """Drop a trailing # comment that sits outside quotes."""
    quote = None
    for i, c in enumerate(line):
        if quote:
            if c == quote:
                quote = None
        elif c in "\"'":
            quote = c
        elif c == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i]
    return line


def parse_roles(text):
    """The role map from the fenced yaml block under `## Roles`, or a Refuse naming the problem.

    The subset: `roles:` then exactly the five keys, each an inline [a, b] list or `- item` lines."""
    text = re.sub(r"<!--.*?-->", "", text or "", flags=re.S)
    m = re.search(r"^##[ \t]+Roles[ \t]*$", text, re.M | re.I)
    if not m:
        raise Refuse("factory: REVIEW.md has no ## Roles block")
    rest = text[m.end():]
    nxt = re.search(r"^## ", rest, re.M)
    section = rest[:nxt.start()] if nxt else rest
    fence = re.search(r"^```[^\n]*\n(.*?)^```[ \t]*$", section, re.M | re.S)
    if not fence:
        raise Refuse("factory: the ## Roles block has no fenced yaml")
    roles, pending, seen_root = {}, None, False
    for n, raw in enumerate(fence.group(1).splitlines(), 1):
        line = _strip_comment(raw).rstrip()
        if not line.strip():
            continue
        if "\t" in raw[:len(raw) - len(raw.lstrip())]:
            raise Refuse(f"factory: Roles line {n} is indented with a tab")
        indented = line[:1] == " "
        body = line.strip()
        if not seen_root:
            if indented or body != "roles:":
                raise Refuse(f"factory: Roles line {n}: the block must start with `roles:`")
            seen_root = True
            continue
        if not indented:
            raise Refuse(f"factory: Roles line {n}: keys sit under `roles:`")
        if body.startswith("- "):
            if pending is None:
                raise Refuse(f"factory: Roles line {n}: a list item with no key")
            roles[pending].append(_unquote(body[2:]))
            continue
        km = re.match(r"^([A-Za-z_]\w*)\s*:\s*(.*)$", body)
        if not km:
            raise Refuse(f"factory: Roles line {n} is not a key: value or list item")
        key, value = km.group(1), km.group(2).strip()
        if key not in ROLE_KEYS:
            raise Refuse(f"factory: Roles line {n}: unknown role {key!r}; the roles are {', '.join(ROLE_KEYS)}")
        if key in roles:
            raise Refuse(f"factory: Roles line {n}: duplicate role {key}")
        pending = None
        if value == "":
            roles[key] = []
            pending = key
        elif value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            roles[key] = [_unquote(x) for x in inner.split(",") if x.strip()] if inner else []
        else:
            raise Refuse(f"factory: Roles line {n}: {key} must be a list")
    if not seen_root:
        raise Refuse("factory: the ## Roles block is empty")
    missing = [k for k in ROLE_KEYS if k not in roles]
    if missing:
        raise Refuse(f"factory: the ## Roles block lacks {', '.join(missing)}")
    return roles


# --- the level --------------------------------------------------------------------------------

def _word_re(word):
    w = r"\s+".join(re.escape(p) for p in word.split())
    return re.compile(r"(?<![\w])" + w + r"(?:s|es|ed|d|ing)?(?![\w])", re.I)


STOP_RES = [(w, _word_re(w)) for w in STOP_WORDS] + [(".env", re.compile(r"(?<![\w])\.env(?![\w])", re.I))]
DEP_RE = re.compile(r"(?<![\w])(?:" + "|".join(DEP_PHRASES) + r")(?![\w])", re.I)


def stop_words_in(text):
    return [w for w, rx in STOP_RES if rx.search(text)]


def compute(root, tip, rel):
    """(computed level, [(level, reason)], intent text used, tip text or None, working text or None)."""
    path = rel + "/intent.md"
    tip_text = show(root, tip, path)
    work_text = None
    try:
        with open(os.path.join(root, path), encoding="utf-8") as f:
            work_text = f.read()
    except (OSError, UnicodeError):
        pass
    text = tip_text if tip_text is not None else work_text
    if text is None:
        raise Refuse(f"factory: no intent.md at {path} on {tip} or in the working tree")
    fm, body = frontmatter(text)
    reasons = []
    try:
        roles = parse_roles(show(root, tip, "REVIEW.md"))
    except Refuse as e:
        roles = None
        reasons.append((2, "no readable Roles block in REVIEW.md on " + tip + " (" + str(e).replace("factory: ", "") + ")"))
    author = fm.get("author", "").strip()
    if roles is not None:
        allowed = {n.lower() for k in LEVEL1_AUTHORS for n in roles[k]}
        if not author or author.lower() not in allowed:
            reasons.append((2, f"author {author or '(none)'!r} is not a product_owner or engineer"))
    source = fm.get("source", "").strip()
    if not re.fullmatch(r"idea|incident\s+\S+", source):
        reasons.append((2, f"source {source or '(none)'!r} is not idea or incident <id>"))
    risk = fm.get("risk", "").strip().lower()
    if risk == "high":
        reasons.append((3, "risk: high"))
    elif risk != "low":
        reasons.append((2, "risk: " + (risk if risk in ("medium",) else "not declared low")))
    clean = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    hits = stop_words_in(clean)
    if hits:
        reasons.append((3, "stop-list words: " + ", ".join(hits)))
    if names_dependency(clean):
        reasons.append((2, "a new dependency is named"))
    level = max([lv for lv, _ in reasons] or [1])
    return level, reasons, text, tip_text, work_text


def history_max(root, tip, rel):
    """The highest `level:` the intent.md has had on the tip's history, or None."""
    path = rel + "/intent.md"
    r = git(root, "log", "--format=%H", tip, "--", path)
    best = None
    if r.returncode != 0:
        return None
    for sha in r.stdout.split():
        lv = level_of(frontmatter(show(root, sha, path))[0].get("level"))
        if lv is not None and (best is None or lv > best):
            best = lv
    return best


def level_for(root, tip, rel):
    computed, reasons, _text, tip_text, work_text = compute(root, tip, rel)
    tip_lv = level_of(frontmatter(tip_text)[0].get("level")) if tip_text is not None else None
    work_lv = level_of(frontmatter(work_text)[0].get("level")) if work_text is not None else None
    hist = history_max(root, tip, rel)
    seen = [v for v in (tip_lv, work_lv, hist) if v is not None]
    level = max([computed] + seen)
    why = [t for lv, t in reasons if lv == computed and lv > 1] or ([] if computed > 1 else ["meets every level 1 rule"])
    if computed > 1:
        why += [t for lv, t in reasons if lv != computed]
    if work_lv and work_lv > computed:
        why.append(f"the file says level {work_lv}")
    elif tip_lv and tip_lv > computed:
        why.append(f"the file on {tip} says level {tip_lv}")
    if hist and hist > computed and hist != work_lv:
        why.append(f"history had level {hist}")
    file_lv = work_lv if work_lv is not None else tip_lv
    # An absent field reads as the template default, 1, so a computed 2 or 3 counts as a raise.
    raised = level > (file_lv if file_lv is not None else 1)
    return {"level": level, "file_level": file_lv, "history_max": hist, "reasons": why, "raised": raised}


def write_level(root, rel, level):
    """Set `level:` in the working-tree intent.md frontmatter; only ever up. True when the file changed."""
    path = os.path.join(root, rel, "intent.md")
    try:
        text = open(path, encoding="utf-8").read()
    except (OSError, UnicodeError) as e:
        raise Refuse(f"factory: cannot read {rel}/intent.md: {e}")
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        raise Refuse(f"factory: {rel}/intent.md has no frontmatter to write the level into")
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if end is None:
        raise Refuse(f"factory: {rel}/intent.md frontmatter is not closed")
    for i in range(1, end):
        m = re.match(r"^level:\s*(\S*)", lines[i])
        if m:
            cur = level_of(m.group(1))
            if cur is not None and cur >= level:
                return False
            lines[i] = f"level: {level}"
            break
    else:
        at = next((i + 1 for i in range(1, end) if lines[i].startswith("risk:")), end)
        lines.insert(at, f"level: {level}")
    evidence.write_atomic(path, "\n".join(lines))
    return True


def cmd_level(a):
    root = repo_root(a.repo)
    _folder, rel = folder_of(root, a.dir)
    tip, _ = default_tip(root)
    res = level_for(root, tip, rel)
    if a.write:
        write_level(root, rel, res["level"])
    if a.json:
        print(json.dumps(res))
    else:
        print(f"level: {res['level']} ({'; '.join(res['reasons'])})")
    return 3 if res["raised"] else 0


def cmd_roles(a):
    root = repo_root(a.repo)
    tip, _ = default_tip(root)
    if a.worktree:
        try:
            text = open(os.path.join(root, "REVIEW.md"), encoding="utf-8").read()
        except (OSError, UnicodeError) as e:
            raise Refuse(f"factory: cannot read REVIEW.md: {e}")
    else:
        text = show(root, tip, "REVIEW.md")
        if text is None:
            raise Refuse(f"factory: no REVIEW.md on {tip}")
    roles = parse_roles(text)
    if a.json:
        print(json.dumps(roles))
    else:
        for k in ROLE_KEYS:
            print(f"{k}: {', '.join(roles[k])}")
    return 0


# --- daily caps, locks and records -----------------------------------------------------------

def factory_dir(root):
    d = os.path.join(root, ".pro-dev", "factory")
    os.makedirs(d, exist_ok=True)
    evidence.ensure_excluded(root)
    return d


def read_daily(root):
    """Today's counters and caps; a new day, a missing file or a broken one starts again at zero."""
    path = os.path.join(root, ".pro-dev", "factory", "daily.json")
    try:
        data = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        data = None
    if not isinstance(data, dict):
        data = {}
    caps = {"max_runs": data.get("max_runs", DEFAULT_MAX_RUNS), "max_daily_usd": data.get("max_daily_usd", DEFAULT_MAX_DAILY_USD)}
    if data.get("date") != today():
        return {"date": today(), "runs": 0, "cost_usd": 0.0, **caps}
    return {"date": today(), "runs": int(data.get("runs", 0)), "cost_usd": float(data.get("cost_usd", 0.0)), **caps}


def write_daily(root, data):
    evidence.write_atomic(os.path.join(factory_dir(root), "daily.json"), json.dumps(data, indent=2) + "\n")


def caps_left(root, over=None):
    """None when a run may start, else the reason it may not. `over` holds the --max-runs and
    --max-daily-usd flags, applied before the check."""
    d = read_daily(root)
    for k, v in (over or {}).items():
        if v is not None:
            d[k] = v
    if d["runs"] >= d["max_runs"]:
        return f"daily cap of {d['max_runs']} runs reached"
    if d["cost_usd"] >= d["max_daily_usd"]:
        return f"daily cap of ${d['max_daily_usd']:g} reached"
    return None


def pid_alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except OSError:
        return True
    return True


def lock_live(root, folder):
    path = os.path.join(root, ".pro-dev", "factory", folder + ".lock")
    try:
        pid = int(open(path, encoding="utf-8").read().strip())
    except (OSError, ValueError):
        return os.path.exists(path)
    return pid_alive(pid)


def take_lock(root, folder):
    path = os.path.join(factory_dir(root), folder + ".lock")
    for _ in range(2):
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            if lock_live(root, folder):
                raise Refuse(f"factory: {folder} is already running (lock {os.path.relpath(path, root)})")
            os.unlink(path)  # a run that died left it
            continue
        with os.fdopen(fd, "w") as f:
            f.write(str(os.getpid()))
        return path
    raise Refuse(f"factory: could not take the lock for {folder}")


def record_path(root, folder):
    return os.path.join(root, ".pro-dev", "factory", f"factory-{folder}.json")


def read_detail(root, folder):
    try:
        rec = json.load(open(record_path(root, folder), encoding="utf-8"))
        d = json.loads(rec.get("detail_json", "{}"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError, AttributeError):
        return {}


def write_record(root, folder, state, reason="", **fields):
    """Merge the fields into the folder's record and write it; returns the detail dict."""
    if state not in STATES:
        raise Refuse(f"factory: refusing the state {state!r}: use {', '.join(STATES)}")
    d = read_detail(root, folder)
    d.setdefault("intent", "intent/" + folder)
    d.setdefault("started", now())
    for k, v in fields.items():
        if v is not None:
            d[k] = v
    d.update({"state": state, "reason": reason or d.get("reason", "") if state in ("stopped", "error") else "", "updated": now()})
    d.setdefault("level_at_intake", 1)
    d.setdefault("level_now", d["level_at_intake"])
    status = STATUS_OF.get(state, "info")
    if state == "merged":
        summary = f"level 1: merged {str(d.get('merged_sha', ''))[:12]}, deploy is yours, unread diff: {d.get('unread_lines', 0)} lines"
    elif state == "stopped":
        summary = f"stopped: level raised to {d['level_now']} ({d['reason']})"
    elif state == "error":
        summary = f"error: {d['reason']}"
    else:
        summary = f"running: {state}"
    record = {
        "schema": 1, "evidence_key": "factory-" + folder, "kind": "doc", "artifact_kind": "factory-run",
        "artifact_key": folder, "status": status, "summary": summary, "detail_json": json.dumps(d),
        "produced_by": f"pro-ai-sdlc:factory@{evidence.plugin_version()}",
    }
    evidence.write_record(root, "factory", record)
    return d


def cmd_record(a):
    root = repo_root(a.repo)
    folder, _ = folder_of(root, a.dir)
    brief = a.brief_pr or (a.pr if a.state == "brief" else None)
    build = a.build_pr or (a.pr if a.pr and a.state != "brief" else None)
    d = write_record(root, folder, a.state, a.reason or "", cost_usd=a.cost, level_now=a.level_now,
                     level_at_intake=a.level_at_intake, brief_pr=brief, build_pr=build, unread_lines=a.unread_lines,
                     merged_sha=a.sha, broad_token=True if a.broad_token else None)
    print(json.dumps({"evidence_key": "factory-" + folder, "state": d["state"]}))
    return 0


# --- next -------------------------------------------------------------------------------------

def accepting_commit_message(root, tip, rel):
    """Message of the commit that introduced `status: accepted` (the oldest of the latest accepted run)."""
    path = rel + "/intent.md"
    r = git(root, "log", "--format=%H", tip, "--", path)
    sha = None
    for c in (r.stdout.split() if r.returncode == 0 else []):
        if frontmatter(show(root, c, path))[0].get("status") != "accepted":
            break
        sha = c
    if not sha:
        return None
    m = git(root, "show", "-s", "--format=%B", sha)
    return m.stdout if m.returncode == 0 else ""


def eligible(root, tip, folder):
    """None when the intent may be run, else why not."""
    rel = "intent/" + folder
    if not FOLDER_RE.match(folder):
        return f"folder name {folder!r} does not match the pattern"
    text = show(root, tip, rel + "/intent.md")
    if text is None:
        return f"{rel}/intent.md is not on {tip}"
    if frontmatter(text)[0].get("status") != "accepted":
        return "the intent is not accepted"
    if show(root, tip, rel + "/spec.md") is not None:
        return "it already has a spec.md"
    if os.path.exists(record_path(root, folder)):
        return "it already has a factory record"
    msg = accepting_commit_message(root, tip, rel)
    if msg is not None and re.search(r"(?mi)^\s*Factory-Run\s*:", msg):
        return "its accepting commit carries a Factory-Run trailer"
    if msg is None:
        return "no accepting commit found on the tip"
    try:
        if level_for(root, tip, rel)["level"] != 1:
            return "its level is not 1"
    except Refuse as e:
        return str(e).replace("factory: ", "")
    return None


def next_folder(root, tip):
    out = git_out(root, "ls-tree", "--name-only", tip, "intent/")
    if out is None:
        return None
    for name in sorted(p.split("/", 1)[1] for p in out.splitlines() if p.startswith("intent/")):
        if not FOLDER_RE.match(name) or lock_live(root, name):
            continue
        if eligible(root, tip, name) is None:
            return name
    return None


def cmd_next(a):
    root = repo_root(a.repo)
    if caps_left(root):
        return 0
    tip, _ = default_tip(root)
    name = next_folder(root, tip)
    if name:
        print("intent/" + name)
    return 0


# --- verify -----------------------------------------------------------------------------------

def gh_bin():
    return os.environ.get("FACTORY_GH") or "gh"


def gh(root, args, token=None, timeout=GH_TIMEOUT):
    env = dict(os.environ)
    if token:
        env["GH_TOKEN"] = token
    return run_cmd([gh_bin(), *args], cwd=root, env=env, timeout=timeout)


def gh_json(root, args, token=None):
    r = gh(root, args, token)
    if r.returncode != 0:
        raise Refuse(f"factory: gh {' '.join(args[:2])} failed: {(r.stderr or r.stdout).strip()[:200]}")
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise Refuse(f"factory: gh {' '.join(args[:2])} printed no JSON")


def find_risk_classify():
    return find_script("FACTORY_RISK_CLASSIFY", "pro-ship", "risk-classify.py")


def is_test_path(path):
    low = path.lower()
    base = low.rsplit("/", 1)[-1]
    if re.search(r"\.(?:test|spec)\.", base) or re.search(r"_test\.[^.]+$", base) or re.fullmatch(r"test_.*\.py", base):
        return True
    return any(seg in ("tests", "test", "__tests__") for seg in low.split("/")[:-1])


def is_policy_path(path, rel):
    low = path.lower()
    parts = low.split("/")
    if parts[-1] in POLICY_NAMES or any(p in POLICY_DIRS for p in parts[:-1]):
        return True
    return low.startswith("intent/") and not low.startswith(rel.lower() + "/")


TEST_CONFIG_BASE = re.compile(r"^(?:(?:jest|vitest|vite|playwright)\.config\.\w+|vitest\.workspace\.\w+|pytest\.ini|conftest\.py|"
                              r"tox\.ini|\.mocharc(?:\.\w+)?|karma\.conf\.\w+|ava\.config\.\w+)$")


def toml_sections(text, pred):
    """Stripped non-comment lines of every [section] whose name satisfies pred, headers included."""
    out, inside = [], False
    for ln in (text or "").splitlines():
        m = re.match(r"^\s*\[+([^\]]+)\]+\s*$", ln)
        if m:
            inside = bool(pred(m.group(1).strip()))
            if inside:
                out.append(ln.strip())
        elif inside and ln.strip() and not ln.strip().startswith("#"):
            out.append(ln.strip())
    return out


def test_config_changed(root, base, head, path):
    low = path.lower()
    name = low.rsplit("/", 1)[-1]
    if TEST_CONFIG_BASE.match(name):
        return True
    if name == "package.json":
        def pick(sha):
            try:
                d = json.loads(show(root, sha, path) or "{}")
            except ValueError:
                return None
            if not isinstance(d, dict):
                return None
            return [d.get("scripts"), d.get("jest"), d.get("vitest"), d.get("mocha"), d.get("ava")]
        return pick(base) != pick(head)
    if name == "pyproject.toml":
        pred = lambda n: n.lower().startswith("tool.pytest")  # noqa: E731
    elif name == "setup.cfg":
        pred = lambda n: n.lower().startswith("tool:pytest")  # noqa: E731
    else:
        return False
    return toml_sections(show(root, base, path), pred) != toml_sections(show(root, head, path), pred)


def diff_files(root, base, head):
    """[(status letter, path)] for base..head with renames off."""
    out = git_out(root, "diff", "--name-status", "--no-renames", "-z", base, head)
    if out is None:
        raise Refuse("factory: git diff failed")
    toks = out.split("\0")
    return [(toks[i], toks[i + 1]) for i in range(0, len(toks) - 1, 2) if toks[i]]


def fetch_pr_head(root, n):
    """Fetch refs/pull/<n>/head into refs/factory/pr-<n>; the full sha it points at."""
    r = git(root, "fetch", "-q", "origin", f"+refs/pull/{n}/head:refs/factory/pr-{n}", timeout=180)
    if r.returncode != 0:
        raise Refuse(f"factory: could not fetch the head of PR {n}: {(r.stderr or '').strip()[:200]}")
    sha = resolve(root, f"refs/factory/pr-{n}")
    if not sha:
        raise Refuse(f"factory: PR {n} head did not resolve")
    return sha


# "None found" may be followed by the sources checked, as the spec template asks; the template's
# closing "ADR needed:" line is not a concern either.
NONE_FOUND_RE = re.compile(r"^[*_ ]*none found\b", re.I)
ADR_LINE_RE = re.compile(r"^[*_ ]*ADR needed\s*:", re.I)


def flagged_concerns_problem(spec):
    """None when the spec's Flagged concerns section says None found or is a table with no data row."""
    clean = re.sub(r"<!--.*?-->", "", spec, flags=re.S)
    heads = list(re.finditer(r"^##[ \t]+Flagged concerns[ \t]*$", clean, re.M | re.I))
    if len(heads) != 1:
        return "spec.md has no single Flagged concerns section" if not heads else "spec.md has two Flagged concerns sections"
    body = clean[heads[0].end():]
    nxt = re.search(r"^## ", body, re.M)
    body = body[:nxt.start()] if nxt else body
    lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
    table = [ln for ln in lines if ln.startswith("|")]
    sep = [ln for ln in table if re.fullmatch(r"\|[\s:\-|]+\|", ln)]
    other = [ln for ln in lines if not ln.startswith("|") and not NONE_FOUND_RE.match(ln) and not ADR_LINE_RE.match(ln)]
    concerns = max(0, len(table) - len(sep) - 1) + len(other)
    if concerns:
        return f"spec.md lists {concerns} flagged concern(s)"
    if not table and not any(NONE_FOUND_RE.match(ln) for ln in lines):
        return "spec.md Flagged concerns says neither None found nor shows an empty table"
    return None


def check_brief(root, rel, head, base):
    problems = []
    want = {rel + "/spec.md", rel + "/plan.md"}
    files = diff_files(root, base, head)
    got = {p for _, p in files}
    if got != want or any(s != "A" for s, _ in files):
        extra = sorted(got - want)
        problems.append("the diff is not exactly the new spec.md and plan.md" + (f" (also: {', '.join(extra[:5])})" if extra else ""))
        return problems
    plan = show(root, head, rel + "/plan.md") or ""
    spec = show(root, head, rel + "/spec.md") or ""

    def only(key):
        return re.findall(rf"(?mi)^{key}[ \t]*:[^\n]*$", plan)
    st, ap, sl = only("Status"), only("Approver"), only("Stop-list categories")
    for label, found in (("Status:", st), ("Approver:", ap), ("Stop-list categories:", sl)):
        if len(found) != 1:
            problems.append(f"plan.md needs exactly one {label} line (found {len(found)})")
    if len(st) == 1 and not re.fullmatch(r"(?i)Status:\s*approved\.?\s*", st[0]):
        problems.append("plan.md is not Status: approved")
    if len(sl) == 1 and not re.fullmatch(r"(?i)Stop-list categories:\s*none\.?\s*", sl[0]):
        problems.append("plan.md does not say Stop-list categories: none")
    if len(ap) == 1 and not re.match(r"(?i)Approver:\s*factory", ap[0]):
        problems.append("plan.md Approver does not start with factory")
    why = flagged_concerns_problem(spec)
    if why:
        problems.append(why)
    return problems


def classify_check(c):
    """(name, bucket) for one statusCheckRollup item; bucket is pass, fail or pending.
    A check run is a pass when COMPLETED with SUCCESS, SKIPPED or NEUTRAL. A commit status uses state."""
    name = c.get("name") or c.get("context") or "?"
    if "status" not in c and "state" in c:
        st = str(c.get("state") or "").upper()
        return name, "pass" if st == "SUCCESS" else "pending" if st in ("PENDING", "EXPECTED") else "fail"
    if str(c.get("status") or "").upper() != "COMPLETED":
        return name, "pending"
    return name, "pass" if str(c.get("conclusion") or "").upper() in ("SUCCESS", "SKIPPED", "NEUTRAL") else "fail"


def read_checks(root, n, token):
    """[(name, bucket)] from `gh pr view --json statusCheckRollup` (gh 2.21 has no `pr checks --json`)."""
    v = gh_json(root, ["pr", "view", str(n), "--json", "statusCheckRollup"], token)
    roll = v.get("statusCheckRollup")
    if roll is None:
        return []
    if not isinstance(roll, list):
        raise Refuse("factory: gh pr view printed an unexpected statusCheckRollup")
    return [classify_check(c) for c in roll if isinstance(c, dict)]


def wait_checks(root, n, token, timeout_min, require):
    """(checks, timed_out). Polls until checks exist (when `require`) and none is pending, or time is up."""
    env = os.environ.get("FACTORY_CHECKS_WAIT")
    wait = float(env) if env is not None else timeout_min * 60
    poll = float(os.environ.get("FACTORY_CHECKS_POLL", "15"))
    deadline = time.time() + wait
    while True:
        checks = read_checks(root, n, token)
        waiting = (not checks and require) or any(b == "pending" for _, b in checks)
        if not waiting:
            return checks, False
        if time.time() >= deadline:
            return checks, True
        time.sleep(poll)


def has_pr_workflow(root, tip):
    """True when a workflow on the default branch tip runs on pull_request or pull_request_target."""
    out = git_out(root, "ls-tree", "-r", "--name-only", tip, ".github/workflows/")
    for path in (out or "").splitlines():
        if not path.lower().endswith((".yml", ".yaml")):
            continue
        text = "\n".join(ln for ln in (show(root, tip, path) or "").splitlines() if not ln.lstrip().startswith("#"))
        if (re.search(r"(?m)^\s*(?:-\s*)?pull_request(?:_target)?\s*:", text)
                or re.search(r"(?m)^\s*(?:-\s*)?pull_request(?:_target)?\s*$", text)
                or re.search(r"(?m)^[\"']?on[\"']?\s*:.*\bpull_request(?:_target)?\b", text)):
            return True
    return False


def run_container(args, name, env, timeout):
    """(output, exit code, timed_out). A timeout kills the container by its name."""
    try:
        r = subprocess.run(args, env=env, capture_output=True, text=True, timeout=timeout)
        return (r.stdout or "") + (r.stderr or ""), r.returncode, False
    except subprocess.TimeoutExpired as e:
        try:
            subprocess.run([docker_bin(), "kill", name], capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.SubprocessError):
            pass
        raw = e.stdout if isinstance(e.stdout, str) else (e.stdout or b"").decode("utf-8", "replace")
        return raw, 124, True
    except (FileNotFoundError, OSError) as e:
        raise Refuse(f"factory: could not start docker: {e}")


def verify_build_in_container(root, a_img, token, repo_url, pr, folder, head):
    """No workflow runs on pull requests: run the repo's verify command on the verified sha in a fresh
    container with the secrets stripped."""
    name = f"factory-{folder}-verify-{int(time.time())}"
    args = [docker_bin(), "run", "--rm", "--name", name, "-e", "GH_TOKEN", "-e", f"FACTORY_PR={pr}",
            "-e", f"FACTORY_HEAD={head}", a_img, "/opt/factory/session.sh", repo_url, "main", "verify", "intent/" + folder]
    env = dict(os.environ)
    env["GH_TOKEN"] = token or ""
    out, code, _ = run_container(args, name, env, PHASE_TIMEOUT)
    return code == 0, out.strip()[-200:]


def find_script(env_name, plugin, script):
    env = os.environ.get(env_name)
    if env:
        return env if os.path.isfile(env) else None
    here = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(os.path.dirname(here))  # plugins/ in the repo layout, <cache>/<marketplace> in the cache
    rel = os.path.join("scripts", script)
    cands = [os.path.join(parent, plugin, rel)]
    key = lambda n: tuple(int(x) for x in re.findall(r"\d+", n))  # noqa: E731
    cache = os.environ.get("CLAUDE_CODE_PLUGIN_CACHE_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "plugins")
    for d in (os.path.join(parent, plugin), os.path.join(cache, "cache", "pro-dev-skillset", plugin)):
        try:
            names = [n for n in os.listdir(d) if re.match(r"^\d", n)]
        except OSError:
            names = []
        cands += [os.path.join(d, n, rel) for n in sorted(names, key=key, reverse=True)]
    return next((c for c in cands if os.path.isfile(c)), None)


def floor_guard_raises(root, base, head):
    """[(level, reason)] from pro-quality's floor-guard `--check` on the build range, run in a throwaway
    worktree at the verified head. A hit, a missing script or a run that could not happen all stop."""
    script = find_script("FACTORY_FLOOR_GUARD", "pro-quality", "floor-guard.py")
    if not script:
        return [(2, "floor-guard unavailable (pro-quality is not installed next to pro-ai-sdlc)")]
    tmp = tempfile.mkdtemp(prefix="factory-floor-")
    wt = os.path.join(tmp, "wt")
    try:
        r = git(root, "worktree", "add", "--detach", wt, head, timeout=180)
        if r.returncode != 0:
            raise Refuse("factory: could not check out the build range for floor-guard: " + (r.stderr or "").strip()[:160])
        r = run_cmd(["python3", "-I", script, "--check", "--base", base], cwd=wt, timeout=120)
    finally:
        git(root, "worktree", "remove", "--force", wt)
        shutil.rmtree(tmp, ignore_errors=True)
        git(root, "worktree", "prune")
    text = (r.stdout + r.stderr).strip().replace("\n", " ")[:200]
    if r.returncode == 0:
        return []
    if r.returncode == 1:
        return [(2, "floor-guard found: " + text)]
    return [(2, "floor-guard could not run: " + text)]


def check_build(root, rel, head, base, tip, token, pr, image, repo_url, folder, checks_min=DEFAULT_CHECKS_TIMEOUT_MIN):
    """[(level, reason)] for every failed check, plus the tier and unread line count."""
    raises, info = [], {"tier": None, "signals": []}
    # 1. CI. "No CI" is decided from the default branch tip, never from "no checks reported".
    workflows = has_pr_workflow(root, tip)
    checks, timed_out = wait_checks(root, pr, token, checks_min, workflows)
    if not checks and workflows:
        raises.append((2, f"no checks were reported within {checks_min:g} min although {tip} has pull_request workflows"))
    elif not checks:
        ok, tail = verify_build_in_container(root, image, token, repo_url, pr, folder, head)
        if not ok:
            raises.append((2, "no CI workflow and the verify command failed in a fresh container: " + tail[-120:]))
    else:
        bad = [n for n, b in checks if b == "fail"]
        pend = [n for n, b in checks if b == "pending"]
        if bad:
            raises.append((2, "checks failed: " + ", ".join(bad[:5])))
        elif pend:
            raises.append((2, ("checks did not finish in time, still pending: " if timed_out else "checks still pending: ") + ", ".join(pend[:5])))
    # 2. the classifier, run on the intent as it is on the tip
    script = find_risk_classify()
    if not script:
        raise Refuse("factory: risk-classify.py not found (pro-ship is not installed next to pro-ai-sdlc)")
    tip_intent = show(root, tip, rel + "/intent.md")
    with tempfile.TemporaryDirectory(prefix="factory-intent-") as tmp:
        argv = ["python3", "-I", script, "--repo", root, "--base", tip, "--head", head, "--json"]
        if tip_intent is not None:
            p = os.path.join(tmp, "intent.md")
            with open(p, "w", encoding="utf-8") as f:
                f.write(tip_intent)
            argv += ["--intent", p]
        r = run_cmd(argv, cwd=root, timeout=120)
    try:
        res = json.loads(r.stdout)
    except ValueError:
        res = None
    if r.returncode == 2 or not isinstance(res, dict):
        why = res.get("reason") if isinstance(res, dict) else (r.stderr.strip()[:160] or "no output")
        raise Refuse(f"factory: risk-classify could not run: {why}")
    tier = res.get("tier")
    info["tier"] = tier
    info["signals"] = sorted({s.get("id", "?") for s in res.get("signals", []) if s.get("floor") == tier})
    if tier == "medium":
        raises.append((2, "risk tier medium: " + ", ".join(info["signals"])))
    elif tier == "high":
        raises.append((3, "risk tier high: " + ", ".join(info["signals"])))
    elif tier != "low":
        raises.append((3, f"risk tier {tier!r} is not readable"))
    if any(n.startswith("surface-unavailable: security_surface") for n in res.get("notes", [])):
        raises.append((2, "surface-unavailable: security_surface (pro-security is required)"))
    # 3. policy paths
    files = diff_files(root, base, head)
    pol = sorted(p for _, p in files if is_policy_path(p, rel))
    if pol:
        raises.append((3, "policy paths changed: " + ", ".join(pol[:5])))
    # 4. tests unchanged after they were added, and no test config
    rl = git_out(root, "rev-list", "--reverse", "--parents", f"{base}..{head}")
    if rl is None:
        raise Refuse("factory: git rev-list failed")
    added, locked = {}, []
    for line in rl.splitlines():
        parts = line.split()
        sha = parts[0]
        if len(parts) > 2:
            raises.append((2, f"merge commit {sha[:12]} in the range"))
            continue
        d = git_out(root, "diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "--no-renames", "-z", sha)
        toks = (d or "").split("\0")
        for i in range(0, len(toks) - 1, 2):
            st, path = toks[i], toks[i + 1]
            if not is_test_path(path):
                continue
            if path in added and added[path] != sha:
                locked.append(path)
            if st == "A" and path not in added:
                added[path] = sha
    if locked:
        raises.append((2, "a test file changed after the commit that added it: " + ", ".join(sorted(set(locked))[:5])))
    cfg = [p for _, p in files if test_config_changed(root, base, head, p)]
    if cfg:
        raises.append((2, "test config changed: " + ", ".join(cfg[:5])))
    raises += floor_guard_raises(root, base, head)
    # 5. floor-allow
    msgs = git_out(root, "log", "--format=%B", f"{base}..{head}") or ""
    if re.search(r"(?mi)^\s*floor-allow\s*:", msgs):
        raises.append((2, "a commit message carries a floor-allow: line"))
    ns = git_out(root, "diff", "--numstat", base, head) or ""
    lines = 0
    for ln in ns.splitlines():
        f = ln.split("\t")
        if len(f) >= 2 and f[0].isdigit() and f[1].isdigit():
            lines += int(f[0]) + int(f[1])
    info["unread_lines"] = lines
    return raises, info


def missing_trailers(root, base, head, phase, folder):
    """Short shas of commits in base..head with no `Factory-Run: <phase> <folder>` trailer line."""
    out = git_out(root, "log", "-z", "--format=%H%n%B", f"{base}..{head}")
    if out is None:
        raise Refuse("factory: git log failed")
    want = re.compile(rf"(?m)^Factory-Run:[ \t]*{re.escape(phase)}[ \t]+{re.escape(folder)}[ \t]*$")
    return [c.split("\n", 1)[0][:12] for c in out.split("\0") if c.strip() and not want.search(c.split("\n", 1)[1] if "\n" in c else "")]


def binding_reasons(root, phase, folder, view, base, head, token):
    """[(level, reason)] when the PR is not the one this run's session was told to open."""
    reasons = []
    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", folder)
    want = f"{slug}-brief" if phase == "brief" else slug
    if view.get("headRefName") != want:
        reasons.append((3, f"the PR head branch is {view.get('headRefName')!r}, not {want!r}"))
    # /execute opens the build PR as a draft when a step ends doubted; the host marks it ready after its checks.
    if phase == "brief" and view.get("isDraft"):
        reasons.append((2, "the brief PR is a draft"))
    me = gh_json(root, ["api", "user"], token).get("login")
    author = (view.get("author") or {}).get("login") if isinstance(view.get("author"), dict) else None
    if not me or author != me:
        reasons.append((3, f"the PR author is {author!r}, not the token's user {me!r}"))
    bare = missing_trailers(root, base, head, phase, folder)
    if bare:
        reasons.append((2, f"commits without a Factory-Run: {phase} {folder} trailer: " + ", ".join(bare[:5])))
    return reasons


def verify(root, phase, folder, rel, pr, token=None, image=None, checks_min=DEFAULT_CHECKS_TIMEOUT_MIN):
    """The host-side checks. Returns {result, level, head, base, reasons, ...}; a Refuse means could not run."""
    image = image or default_image()
    git(root, "fetch", "-q", "origin", timeout=180)
    tip, branch = default_tip(root)
    if tip == "HEAD":
        raise Refuse("factory: no origin remote or default branch to compare the PR against")
    head = fetch_pr_head(root, pr)
    view = gh_json(root, ["pr", "view", str(pr), "--json",
                          "state,baseRefName,headRefOid,isCrossRepository,headRefName,isDraft,author"], token)
    reasons = []
    if view.get("headRefOid") != head:
        return {"result": "stop", "level": 2, "head": head, "reasons": ["the PR head moved after it was fetched"], "tier": None}
    if view.get("state") != "OPEN":
        reasons.append((2, f"the PR is {view.get('state')}"))
    if view.get("baseRefName") != branch:
        reasons.append((3, f"the PR targets {view.get('baseRefName')}, not {branch}"))
    if view.get("isCrossRepository"):
        reasons.append((3, "the PR comes from another repository"))
    mb = git(root, "merge-base", tip, head)
    base = mb.stdout.strip()
    if mb.returncode != 0 or not base:
        raise Refuse("factory: no merge base between the default branch and the PR head")
    if base == head:
        raise Refuse("factory: the PR has no changes")
    reasons += binding_reasons(root, phase, folder, view, base, head, token)
    info = {"tier": None, "unread_lines": 0}
    if phase == "brief":
        reasons += [(2, p) for p in check_brief(root, rel, head, base)]
    else:
        repo_url = repo_url_of(root)
        more, info = check_build(root, rel, head, base, tip, token, pr, image, repo_url, folder, checks_min)
        reasons += more
    level = max([lv for lv, _ in reasons] or [1])
    return {"result": "raise" if reasons else "pass", "level": level, "head": head, "base": base,
            "reasons": [t for _, t in reasons], "tier": info.get("tier"), "unread_lines": info.get("unread_lines", 0),
            "draft": bool(view.get("isDraft"))}


def cmd_verify(a):
    root = repo_root(a.repo)
    folder, rel = folder_of(root, a.dir)
    res = verify(root, a.phase, folder, rel, a.pr, os.environ.get("FACTORY_GH_TOKEN") or None,
                 checks_min=a.checks_timeout_min)
    if a.json:
        print(json.dumps(res))
    elif res["result"] == "pass":
        print(f"verify {a.phase}: pass ({res['head'][:12]})")
    else:
        print(f"verify {a.phase}: raise to level {res['level']} ({'; '.join(res['reasons'])})")
    return 0 if res["result"] == "pass" else 3


# --- run --------------------------------------------------------------------------------------

def repo_url_of(root):
    r = git(root, "remote", "get-url", "origin")
    url = r.stdout.strip() if r.returncode == 0 else ""
    if not url:
        raise Refuse("factory: the repo has no origin remote")
    m = re.match(r"^(?:ssh://)?git@([^:/]+)[:/](.+)$", url)
    return f"https://{m.group(1)}/{m.group(2)}" if m else url


def docker_bin():
    return os.environ.get("FACTORY_DOCKER") or "docker"


def default_image():
    """pro-dev-factory:<plugin version>, so a new plugin version builds a new image."""
    return f"{IMAGE_NAME}:{evidence.plugin_version()}"


def ensure_image(image):
    r = run_cmd([docker_bin(), "image", "inspect", image], timeout=60)
    if r.returncode == 0:
        return
    ctx = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "factory")
    b = run_cmd([docker_bin(), "build", "-t", image, ctx], timeout=1800)
    if b.returncode != 0:
        raise Refuse("factory: docker build failed: " + (b.stderr or b.stdout).strip()[-200:])


def container_cost(out):
    """Sum of total_cost_usd over the result lines of the session's stream-json; None when none reported one."""
    total, seen = 0.0, False
    for ln in out.splitlines():
        if ln.startswith("{") and "total_cost_usd" in ln:
            try:
                j = json.loads(ln)
            except ValueError:
                continue
            if j.get("type") == "result" and isinstance(j.get("total_cost_usd"), (int, float)):
                total += float(j["total_cost_usd"])
                seen = True
    return total if seen else None


def remote_sha(root, branch):
    """The sha of the default branch on origin, read with `git ls-remote`."""
    r = git(root, "ls-remote", "origin", f"refs/heads/{branch}", timeout=120)
    fields = r.stdout.split() if r.returncode == 0 else []
    if not fields:
        raise Refuse(f"factory: could not read {branch} on origin")
    return fields[0]


def branch_protected(root, branch):
    """True when a ruleset or branch protection on the default branch requires a pull request."""
    if not re.fullmatch(r"[A-Za-z0-9._/-]+", branch) or branch.startswith("-"):
        raise Refuse(f"factory: refusing the default branch name {branch!r}")
    r = gh(root, ["api", "repos/{owner}/{repo}/rules/branches/" + branch])
    if r.returncode == 0:
        try:
            rules = json.loads(r.stdout)
        except ValueError:
            rules = []
        if isinstance(rules, list) and any(isinstance(x, dict) and x.get("type") == "pull_request" for x in rules):
            return True
    r = gh(root, ["api", "repos/{owner}/{repo}/branches/" + branch + "/protection"])
    if r.returncode == 0:
        try:
            d = json.loads(r.stdout)
        except ValueError:
            d = None
        if isinstance(d, dict) and d.get("required_pull_request_reviews"):
            return True
    return False


def session(root, a, token, phase, rel, repo_url, budget):
    """One container run. Returns (pr number or None, cost, log tail, exit code, timed_out)."""
    name = f"factory-{os.path.basename(rel)}-{phase}-{int(time.time())}"
    args = [docker_bin(), "run", "--rm", "--name", name, "-e", "CLAUDE_GUARD_MODE=enforce", "-e", "ANTHROPIC_API_KEY", "-e", "GH_TOKEN",
            "-e", f"FACTORY_BUDGET_USD={budget:.2f}", "-e", f"FACTORY_MODEL={a.model}",
            a.image, "/opt/factory/session.sh", repo_url, a.marketplace_ref, phase, rel]
    env = dict(os.environ)
    env["GH_TOKEN"] = token  # by name in argv so the token never shows in a process list
    out, code, timed_out = run_container(args, name, env, a.timeout_min * 60)
    for secret in (token, os.environ.get("ANTHROPIC_API_KEY")):
        if secret:
            out = out.replace(secret, "***")
    log = os.path.join(factory_dir(root), f"{os.path.basename(rel)}-{phase}.log")
    evidence.write_atomic(log, out)
    prs = re.findall(r"(?m)^factory: pr (\d+)\s*$", out)
    cost = container_cost(out)
    if cost is None:  # no result event: count the whole phase budget
        cost = budget
    return (int(prs[-1]) if prs else None), cost, out.strip()[-200:], code, timed_out


def get_token(root, allow_broad):
    tok = os.environ.get("FACTORY_GH_TOKEN", "").strip()
    if tok:
        return tok, False
    if not allow_broad:
        raise Refuse("factory: set FACTORY_GH_TOKEN to a token scoped to this one repo, or pass --allow-broad-token "
                     "to use your own `gh auth token` (demo only; the record notes it)")
    r = gh(root, ["auth", "token"])
    if r.returncode != 0 or not r.stdout.strip():
        raise Refuse("factory: `gh auth token` gave no token")
    return r.stdout.strip(), True


def merge_pr(root, pr, head, folder, token, draft=False):
    """The merge, by the host: mark a draft ready after its checks passed, then squash, pinned to the
    head it verified. Returns the merge commit sha."""
    if draft:
        r = gh(root, ["pr", "ready", str(pr)], token)
        if r.returncode != 0:
            raise Refuse(f"gh pr ready refused: {(r.stderr or r.stdout).strip()[:200]}")
    r = gh(root, ["pr", "merge", str(pr), "--squash", "--match-head-commit", head, "--body", f"Factory-Run: {folder}"], token)
    if r.returncode != 0:
        raise Refuse(f"gh pr merge refused: {(r.stderr or r.stdout).strip()[:200]}")
    v = gh_json(root, ["pr", "view", str(pr), "--json", "state,mergeCommit"], token)
    if v.get("state") != "MERGED":
        raise Refuse(f"PR {pr} is {v.get('state')} after the merge call")
    mc = v.get("mergeCommit")
    return (mc.get("oid") if isinstance(mc, dict) else None) or head


def sync_checkout(root, branch):
    """Fast-forward the person's checkout to the merge when it sits on the default branch with no
    changes, so tools that read the working tree (mieruka's board) see it. Anything else is left alone."""
    if git_out(root, "rev-parse", "--abbrev-ref", "HEAD") is None:
        return
    current = (git_out(root, "rev-parse", "--abbrev-ref", "HEAD") or "").strip()
    dirty = (git_out(root, "status", "--porcelain", "--untracked-files=no") or "").strip()
    if current != branch or dirty:
        return
    git(root, "fetch", "-q", "origin", timeout=180)
    git(root, "merge", "-q", "--ff-only", f"origin/{branch}", timeout=60)


def hand_over(root, folder, pr, level, reason, token):
    """A stopped build PR goes to a person: out of draft, so it reads as ready for review, with the
    reason as a comment. Best effort; the record already holds the reason."""
    if not pr:
        return
    v = gh_json(root, ["pr", "view", str(pr), "--json", "state,isDraft"], token)
    if v.get("state") != "OPEN":
        return
    if v.get("isDraft"):
        gh(root, ["pr", "ready", str(pr)], token)
    gh(root, ["pr", "comment", str(pr), "--body",
              f"The factory stopped this run at level {level} and hands it to a person: {reason}\n\n"
              f"Review it as the level {level} gates in REVIEW.md say. Factory-Run: {folder}"], token)


class Stop(Exception):
    def __init__(self, state, level, reason):
        super().__init__(reason)
        self.state, self.level, self.reason = state, level, reason


def run_phases(root, a, token, folder, rel, repo_url, branch, resume_pr=None, spent=0.0, resume_phase="build"):
    """Brief then build. When resuming, the open PR of resume_phase goes straight to the host checks
    and the merge; a resumed brief then runs the build session as usual."""
    merged_sha, unread = "", 0
    for phase in (("build",) if resume_pr and resume_phase == "build" else ("brief", "build")):
        if resume_pr and phase == resume_phase:
            pr = resume_pr
            print(f"factory: resuming {phase} pr {pr}: host checks and merge only", flush=True)
        else:
            write_record(root, folder, phase)
            remaining = a.max_cost_usd - spent
            if remaining <= 0.05:
                raise Stop("stopped", 1, "the per-run cost cap is used up")
            before = remote_sha(root, branch)
            pr, cost, tail, code, timed_out = session(root, a, token, phase, rel, repo_url, remaining)
            spent += cost
            write_record(root, folder, phase, cost_usd=round(spent, 4))
            # The container's token must not move the default branch; only the host merges.
            if remote_sha(root, branch) != before:
                raise Stop("error", 1, "default branch moved during the session")
            if timed_out:
                raise Stop("error", 1, f"the {phase} container timed out after {a.timeout_min:g} min and was killed")
            if code != 0 and pr is None:
                raise Stop("error", 1, f"the {phase} container exited {code}: {tail[-120:]}")
            if pr is None:
                raise Stop("error", 1, f"the {phase} session opened no pull request")
            print(f"factory: {phase} pr {pr}", flush=True)
        write_record(root, folder, "verify", **{f"{phase}_pr": pr})
        res = verify(root, phase, folder, rel, pr, token, a.image, a.checks_timeout_min)
        if res["result"] != "pass":
            raise Stop("stopped", res["level"], "; ".join(res["reasons"]))
        if phase == "build":
            unread = res["unread_lines"]
        sha = merge_pr(root, pr, res["head"], folder, token, res.get("draft", False))
        if phase == "build":
            merged_sha = sha
    return spent, merged_sha, unread


def pr_number(value):
    m = re.search(r"(\d+)\D*$", str(value or ""))
    return int(m.group(1)) if m else None


def cmd_run(a):
    root = repo_root(a.repo)
    over = {"max_runs": a.max_runs, "max_daily_usd": a.max_daily_usd}
    a.image = a.image or default_image()
    resume_pr, resume_phase = None, "build"
    if a.next:
        git(root, "fetch", "-q", "origin", timeout=180)
        tip, branch = default_tip(root)
        why = caps_left(root, over)
        if why:
            print(f"factory: not running: {why}")
            return 0
        name = next_folder(root, tip)
        if not name:
            return 0
        folder, rel = name, "intent/" + name
    elif a.dir:
        folder, rel = folder_of(root, a.dir)
        git(root, "fetch", "-q", "origin", timeout=180)
        tip, branch = default_tip(root)
        prior = read_detail(root, folder)
        if prior.get("state") in ("build", "verify", "stopped", "error"):
            resume_pr = pr_number(prior.get("build_pr"))
            if not resume_pr and pr_number(prior.get("brief_pr")):
                resume_pr, resume_phase = pr_number(prior.get("brief_pr")), "brief"
    else:
        raise Refuse("factory: run needs an intent dir or --next")
    if branch == "HEAD":
        raise Refuse("factory: no origin remote or default branch to run against")
    if not resume_pr:
        why = eligible(root, tip, folder)
        if why:
            raise Refuse(f"factory: refusing {rel}: {why}")
        why = caps_left(root, over)
        if why:
            raise Refuse(f"factory: refusing {rel}: {why}")
    elif resume_phase == "build" and (show(root, tip, rel + "/spec.md") is None or show(root, tip, rel + "/plan.md") is None):
        raise Refuse(f"factory: refusing to resume {rel}: the brief is not merged on {tip}")
    repo_url = repo_url_of(root)
    if a.dry_run:
        what = f"would resume {resume_phase} pr {resume_pr}" if resume_pr else "at level 1 would run brief then build"
        print(f"factory: dry run: {rel} {what} in {a.image} for {repo_url}")
        return 0
    token, broad = get_token(root, a.allow_broad_token)
    unprotected = False
    if not branch_protected(root, branch):
        if not a.allow_unprotected:
            raise Refuse(f"factory: {branch} is not protected by a ruleset or branch protection that requires a pull request; "
                         "protect it, or pass --allow-unprotected (demo only; the record notes it)")
        unprotected = True
    if resume_pr:
        v = gh_json(root, ["pr", "view", str(resume_pr), "--json", "state"], token)
        if v.get("state") != "OPEN":
            raise Refuse(f"factory: refusing to resume {rel}: PR {resume_pr} is {v.get('state')}")
    if not os.environ.get("ANTHROPIC_API_KEY") and not resume_pr:
        print("factory: warning: ANTHROPIC_API_KEY is not set, so the session cannot sign in", file=sys.stderr)
    lock = take_lock(root, folder)
    code = 2
    start_cost = float(read_detail(root, folder).get("cost_usd") or 0.0) if resume_pr else 0.0
    try:
        daily = read_daily(root)
        daily.update({k: v for k, v in over.items() if v is not None})
        if not resume_pr:
            daily["runs"] += 1
        write_daily(root, daily)
        if resume_pr:
            write_record(root, folder, "verify", unprotected=True if unprotected else None)
        else:
            write_record(root, folder, "queued", level_at_intake=1, level_now=1, broad_token=broad, cost_usd=0.0,
                         unprotected=True if unprotected else None)
            print(f"factory: queued {rel}", flush=True)
        try:
            ensure_image(a.image)
            spent, sha, unread = run_phases(root, a, token, folder, rel, repo_url, branch, resume_pr, start_cost, resume_phase)
            write_record(root, folder, "merged", merged_sha=sha, unread_lines=unread, cost_usd=round(spent, 4))
            try:
                sync_checkout(root, branch)
            except (Refuse, OSError):
                pass
            print(f"factory: merged {sha[:12]}, deploy is yours, unread diff: {unread} lines", flush=True)
            code = 0
        except Stop as s:
            write_record(root, folder, s.state, s.reason, level_now=s.level)
            if s.state == "stopped":
                try:
                    hand_over(root, folder, pr_number(read_detail(root, folder).get("build_pr")), s.level, s.reason, token)
                except (Refuse, OSError):
                    pass
                print(f"factory: stopped level {s.level} ({s.reason})", flush=True)
                code = 3
            else:
                print(f"factory: error ({s.reason})", flush=True)
        except Refuse as e:
            msg = str(e).replace("factory: ", "")
            write_record(root, folder, "error", msg)
            print(f"factory: error ({msg})", flush=True)
        finally:
            d = read_daily(root)
            now_cost = float(read_detail(root, folder).get("cost_usd") or 0.0)
            d["cost_usd"] = round(d["cost_usd"] + max(0.0, now_cost - start_cost), 4)
            write_daily(root, d)
    finally:
        try:
            os.unlink(lock)
        except OSError:
            pass
    return code


# --- main -------------------------------------------------------------------------------------

def build_parser():
    p = argparse.ArgumentParser(prog="factory.py", description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("level")
    s.add_argument("dir")
    s.add_argument("--repo")
    s.add_argument("--json", action="store_true")
    s.add_argument("--write", action="store_true")
    s = sub.add_parser("roles")
    s.add_argument("--repo")
    s.add_argument("--json", action="store_true")
    s.add_argument("--worktree", action="store_true", help="read REVIEW.md from the working tree instead of the default branch tip")
    s = sub.add_parser("next")
    s.add_argument("--repo")
    s = sub.add_parser("run")
    s.add_argument("dir", nargs="?")
    s.add_argument("--next", action="store_true")
    s.add_argument("--repo")
    s.add_argument("--max-cost-usd", type=float, default=8.0)
    s.add_argument("--model", default="opus")
    s.add_argument("--image", default=None, help="default pro-dev-factory:<plugin version>, built when that tag is missing")
    s.add_argument("--marketplace-ref", default="main")
    s.add_argument("--timeout-min", type=float, default=45, help="per container; the container is killed on timeout")
    s.add_argument("--checks-timeout-min", type=float, default=DEFAULT_CHECKS_TIMEOUT_MIN, help="wait for PR checks to appear and finish")
    s.add_argument("--max-runs", type=int, default=None, help="daily run cap, saved in daily.json")
    s.add_argument("--max-daily-usd", type=float, default=None, help="daily dollar cap, saved in daily.json")
    s.add_argument("--allow-broad-token", action="store_true")
    s.add_argument("--allow-unprotected", action="store_true", help="run although the default branch does not require a PR (demo only)")
    s.add_argument("--dry-run", action="store_true")
    s = sub.add_parser("record")
    s.add_argument("dir")
    s.add_argument("--repo")
    s.add_argument("--state", required=True, choices=STATES)
    s.add_argument("--reason")
    s.add_argument("--pr")
    s.add_argument("--brief-pr")
    s.add_argument("--build-pr")
    s.add_argument("--cost", type=float)
    s.add_argument("--level-now", type=int, choices=(1, 2, 3))
    s.add_argument("--level-at-intake", type=int, choices=(1, 2, 3))
    s.add_argument("--unread-lines", type=int)
    s.add_argument("--sha")
    s.add_argument("--broad-token", action="store_true")
    s = sub.add_parser("verify")
    s.add_argument("phase", choices=("brief", "build"))
    s.add_argument("dir")
    s.add_argument("--pr", type=int, required=True)
    s.add_argument("--repo")
    s.add_argument("--json", action="store_true")
    s.add_argument("--checks-timeout-min", type=float, default=DEFAULT_CHECKS_TIMEOUT_MIN)
    return p


def main(argv):
    try:
        a = build_parser().parse_args(argv)
    except SystemExit as e:
        return 0 if e.code == 0 else 64
    fn = {"level": cmd_level, "roles": cmd_roles, "next": cmd_next, "run": cmd_run, "record": cmd_record,
          "verify": cmd_verify}[a.cmd]
    try:
        return fn(a)
    except Refuse as e:
        print(str(e), file=sys.stderr)
        # level and verify and roles name "could not run" as 2; run and record refusals are 1.
        return 2 if a.cmd in ("level", "verify", "roles", "next") else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
