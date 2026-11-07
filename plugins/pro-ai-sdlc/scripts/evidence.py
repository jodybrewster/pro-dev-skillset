#!/usr/bin/env python3
"""evidence - the shared record writer for incident.py, lessons.py and visual.py.

Each record is a mieruka evidence manifest as docs/loop-records.md describes it. The local
copy goes to .pro-dev/<subdir>/<evidence_key>.json (kept out of the tree through the repo's
info/exclude file) and, when the repo has a .mieruka/ folder that ignores the manifest's own
path, a copy goes to .mieruka/evidence/<evidence_key>/evidence.json.

The mieruka drop is the rule of pro-ship's ship.py mieruka_copy; plugins do not import each
other (ADR-0003), so this is a copy. When one changes, change the other and
docs/ship-preflight.md in the same commit.

A record may carry an optional top-level change_id, the id of the change it is about
(docs/loop-records.md). change_id_of reads it from an intent's id: line; write_record drops any
value that does not match ID_RE, so a branch name or an id: line a diff shaped never reaches mieruka.

Python 3 standard library only. No network calls.
"""

from __future__ import annotations

import json
import os
import re
import subprocess

from ids import ID_RE, id_of

KINDS = ("review", "qa_run", "deploy", "a11y", "visual_drift", "doc")
STATUSES = ("pass", "fail", "partial", "info")
SAFE_KEY = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class Refuse(Exception):
    """A refusal or failure the person should read; exits 1 with the message on stderr."""


def sh(args: list[str], cwd: str, timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def repo_root(cwd: str | None = None) -> str | None:
    cwd = cwd or os.getcwd()
    try:
        r = sh(["git", "rev-parse", "--show-toplevel"], cwd)
        if r.returncode == 0 and r.stdout.strip():
            return os.path.realpath(r.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        pass
    return None


def git_lines(root: str, *args: str) -> list[str]:
    try:
        r = sh(["git", *args], root)
    except (OSError, subprocess.SubprocessError):
        return []
    return [ln for ln in r.stdout.splitlines() if ln.strip()] if r.returncode == 0 else []


def rev(root: str, ref: str) -> str | None:
    try:
        r = sh(["git", "rev-parse", "--verify", "-q", ref + "^{commit}"], root)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None


def valid_change_id(value) -> str | None:
    """The value when it is a whole change id such as PDS-50, else None."""
    return value if isinstance(value, str) and ID_RE.fullmatch(value) else None


def default_tip(root: str) -> str:
    """origin/HEAD, origin/main or origin/master; HEAD with no remote. The rule of factory.default_tip."""
    try:
        r = sh(["git", "symbolic-ref", "-q", "refs/remotes/origin/HEAD"], root)
        ref = r.stdout.strip()[len("refs/remotes/"):] if r.returncode == 0 and r.stdout.strip().startswith("refs/remotes/") else ""
    except (OSError, subprocess.SubprocessError):
        ref = ""
    for cand in ([ref] if ref else []) + ["origin/main", "origin/master"]:
        if rev(root, cand):
            return cand
    return "HEAD"


def change_id_of(root: str, intent_dir: str) -> str | None:
    """The id: of <intent_dir>/intent.md when it is a valid change id, else None.

    The working tree is read first; the default tip only when the working tree has no intent.md.
    """
    full = intent_dir if os.path.isabs(intent_dir) else os.path.join(root, intent_dir)
    path = os.path.join(full, "intent.md")
    text = None
    if os.path.isfile(path):
        try:
            text = open(path, encoding="utf-8").read()
        except (OSError, UnicodeError):
            text = None
    else:
        rel = os.path.relpath(os.path.realpath(full), root).replace(os.sep, "/")
        if not rel.startswith("../") and rel != "..":
            try:
                r = sh(["git", "show", f"{default_tip(root)}:{rel}/intent.md"], root)
                text = r.stdout if r.returncode == 0 else None
            except (OSError, subprocess.SubprocessError):
                text = None
    return valid_change_id(id_of(text)) if text else None


def ensure_excluded(root: str) -> None:
    """Keep .pro-dev/ out of the tree through the repo's local exclude file."""
    probe = sh(["git", "check-ignore", "-q", ".pro-dev/x"], root)
    if probe.returncode == 0:
        return
    r = sh(["git", "rev-parse", "--git-path", "info/exclude"], root)
    path = r.stdout.strip()
    if not path:
        return
    if not os.path.isabs(path):
        path = os.path.join(root, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        existing = open(path, encoding="utf-8").read()
    except OSError:
        existing = ""
    if ".pro-dev/" not in existing.splitlines():
        with open(path, "a", encoding="utf-8") as f:
            f.write(("" if not existing or existing.endswith("\n") else "\n") + ".pro-dev/\n")


def write_atomic(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def plugin_version() -> str:
    here = os.path.dirname(os.path.realpath(__file__))
    try:
        data = json.load(open(os.path.join(here, "..", ".claude-plugin", "plugin.json"), encoding="utf-8"))
    except (OSError, ValueError):
        return "unknown"
    v = data.get("version") if isinstance(data, dict) else None
    return v if isinstance(v, str) and v else "unknown"


def safe_key(text) -> bool:
    return isinstance(text, str) and bool(SAFE_KEY.match(text))


def mieruka_copy(root: str, key: str, text: str) -> tuple[str | None, str]:
    """(path written, why not). Only when .mieruka/ exists and git ignores the manifest's own path."""
    if not os.path.isdir(os.path.join(root, ".mieruka")):
        return None, "no .mieruka/ folder at the repo root"
    rel = os.path.join(".mieruka", "evidence", key, "evidence.json")
    if git_lines(root, "ls-files", "--", os.path.join(".mieruka", "evidence", key)):
        return None, f".mieruka/evidence/{key}/ is tracked by git, so nothing was written there"
    probe = sh(["git", "check-ignore", "-q", rel], root)
    if probe.returncode == 128:  # git refuses the path, for example beyond a symbolic link
        why = (probe.stderr or "").strip().splitlines()
        return None, f"git could not check {rel} ({why[-1] if why else 'exit 128'}), so nothing was written there"
    if probe.returncode != 0:
        return None, ".mieruka/evidence/ is not ignored by git, so nothing was written there (add it to .gitignore to get the copy)"
    write_atomic(os.path.join(root, rel), text)
    return rel, ""


def write_record(root: str, subdir: str, record: dict) -> dict:
    """Validate a manifest against docs/loop-records.md's shared rules, write it locally and drop it for mieruka."""
    key = record.get("evidence_key")
    if not safe_key(key):
        raise Refuse(f"evidence: refusing the key {key!r}: only a-z, 0-9 and - are allowed, not starting with -")
    if record.get("kind") not in KINDS:
        raise Refuse(f"evidence: refusing the kind {record.get('kind')!r}: mieruka accepts only {', '.join(KINDS)}")
    if record.get("status") not in STATUSES:
        raise Refuse(f"evidence: refusing the status {record.get('status')!r}: mieruka accepts only {', '.join(STATUSES)}")
    if not isinstance(record.get("detail_json"), str):
        raise Refuse("evidence: detail_json must be a JSON-encoded string")
    if not safe_key(subdir.replace("/", "-")):
        raise Refuse(f"evidence: refusing the folder {subdir!r}")
    if "change_id" in record and not valid_change_id(record["change_id"]):
        record = {k: v for k, v in record.items() if k != "change_id"}
    text = json.dumps(record, indent=2) + "\n"
    local = os.path.join(root, ".pro-dev", subdir, key + ".json")
    os.makedirs(os.path.dirname(local), exist_ok=True)
    ensure_excluded(root)
    write_atomic(local, text)
    dropped, why = mieruka_copy(root, key, text)
    return {"path": os.path.relpath(local, root), "mieruka": dropped, "why": why}
