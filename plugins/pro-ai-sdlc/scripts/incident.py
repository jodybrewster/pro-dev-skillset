#!/usr/bin/env python3
"""incident - the record writer and credential check for /incident.

  incident.py prepare <folder>      make the excluded .pro-dev/incidents/incident-<folder>/ for raw pastes
  incident.py record <intent dir>   read incident.md's frontmatter and write the incident manifest
  incident.py check <intent dir>    refuse an incident.md or intent.md that holds a credential, naming the line

The record is the one docs/loop-records.md describes ("The incident record"): kind doc,
artifact_kind incident, status fail while open, partial once mitigated, pass once resolved.
Writing goes through evidence.py. Raw pasted evidence lives under .pro-dev/incidents/<key>/,
never in the tracked files, so check scans incident.md and intent.md.

Prints one JSON object on success. A refusal goes to stderr with exit 1; usage errors exit 2.
Python 3 standard library only. No network calls. File text is read as data and never executed.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import evidence  # noqa: E402
from evidence import Refuse  # noqa: E402

STATES = {"open": "fail", "mitigated": "partial", "resolved": "pass"}
SEVERITIES = ("sev1", "sev2")
KEYS = ("id", "state", "severity", "detected", "resolved", "commit", "deploy", "regression_test")
SHA = re.compile(r"^[0-9a-f]{40}$")

# The REDACT list of plugins/pro-ship/scripts/pr-check.py plus bearer headers and URLs with a
# password. Plugins do not import each other (ADR-0003), so this is a copy: change both together.
CREDENTIALS = [
    ("GitHub token", re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}")),
    ("GitHub token", re.compile(r"github_pat_[A-Za-z0-9_]{20,}")),
    ("Anthropic key", re.compile(r"sk-ant-[A-Za-z0-9_\-]+")),
    ("API key", re.compile(r"\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_\-]+")),
    ("API key", re.compile(r"\bsk-[A-Za-z0-9]{32,}")),
    ("Stripe key", re.compile(r"\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}")),
    ("npm token", re.compile(r"\bnpm_[A-Za-z0-9]{20,}")),
    ("GitLab token", re.compile(r"\bglpat-[A-Za-z0-9_\-]{16,}")),
    ("AWS key id", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{12,}")),
    ("Slack token", re.compile(r"\bxox[a-z]-[A-Za-z0-9\-]+")),
    ("Slack token", re.compile(r"\bxapp-[A-Za-z0-9\-]+")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("bearer header", re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=\-]{16,}")),
    ("basic auth header", re.compile(r"(?i)\bauthorization\s*:\s*basic\s+[A-Za-z0-9+/]{8,}={0,2}")),
    ("JSON web token", re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}")),
    ("Google API key", re.compile(r"\bAIza[A-Za-z0-9_\-]{30,}")),
    ("AWS secret key", re.compile(r"(?i)aws_secret_access_key\s*[=:]\s*\S{20,}")),
    # key = value, key: value or "key": "value", as in query strings, env files, YAML and JSON logs;
    # the value needs a digit or 16 characters so prose such as "token: expired" passes.
    ("password or key in a setting", re.compile(
        r"(?i)[\"']?\b(?:\w*password|passwd|pwd|\w*secret|api[_-]?key|x-api-key|\w*_token|access[_-]?token|token)[\"']?"
        r"\s*[:=]\s*[\"']?(?:(?=[^\s&\"',}]*\d)[^\s&\"',}]{6,}|[^\s&\"',}]{16,})")),
    ("URL with a password", re.compile(r"[A-Za-z][A-Za-z0-9+.\-]*://[^\s/:@]+:[^\s/@]+@")),
]


def intent_dir(arg: str, root: str) -> str:
    path = os.path.realpath(arg if os.path.isabs(arg) else os.path.join(os.getcwd(), arg))
    base = os.path.join(root, "intent") + os.sep
    if not path.startswith(base) or not os.path.isdir(path):
        raise Refuse(f"incident: {arg} is not a folder under intent/")
    if not os.path.isfile(os.path.join(path, "incident.md")):
        raise Refuse(f"incident: no incident.md in {os.path.relpath(path, root)}")
    return path


def read_text(path: str) -> str:
    try:
        return open(path, encoding="utf-8").read()
    except (OSError, UnicodeError) as e:
        raise Refuse(f"incident: cannot read {path}: {e}")


def frontmatter(text: str) -> tuple[dict, str]:
    """(keys, body). Plain `key: value` lines between the first two --- lines; values are data."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise Refuse("incident: incident.md has no frontmatter")
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            fm = {}
            for ln in lines[1:i]:
                m = re.match(r"^([a-z_]+):\s*(.*)$", ln)
                if m:
                    v = m.group(2).strip()
                    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                        v = v[1:-1]
                    fm[m.group(1)] = v
            return fm, "\n".join(lines[i + 1:])
    raise Refuse("incident: incident.md frontmatter is not closed")


def summary_line(body: str) -> str:
    """First non-empty line under ## Summary, trimmed; empty when the section is missing."""
    grab = False
    for ln in body.splitlines():
        if re.match(r"^##\s+Summary\s*$", ln):
            grab = True
            continue
        if grab:
            if ln.startswith("#"):
                break
            s = ln.strip()
            if s and not s.startswith("<!--") and not s.startswith("```") and not s.startswith("~~~"):
                return s[:200].rstrip(".")
    return ""


def cmd_check(arg: str) -> dict:
    root = evidence.repo_root()
    if not root:
        raise Refuse("incident: not inside a git repository")
    d = intent_dir(arg, root)
    paths = [os.path.join(d, "incident.md")] + [p for p in [os.path.join(d, "intent.md")] if os.path.isfile(p)]
    for path in paths:  # both files are committed together, so both are scanned
        for n, ln in enumerate(read_text(path).splitlines(), 1):
            for what, rx in CREDENTIALS:
                if rx.search(ln):
                    # Name the line and the kind, never the secret itself.
                    raise Refuse(f"incident: {os.path.relpath(path, root)} line {n} looks like a {what}; "
                                 "move the raw text to .pro-dev/incidents/ and keep only a summary here")
    return {"path": os.path.relpath(paths[0], root), "scanned": [os.path.relpath(p, root) for p in paths], "clean": True}


def cmd_prepare(folder: str) -> dict:
    """Make the excluded evidence folder before any paste is saved, so a broad `git add` never picks one up."""
    root = evidence.repo_root()
    if not root:
        raise Refuse("incident: not inside a git repository")
    key = "incident-" + folder
    if "/" in folder or not evidence.safe_key(key):
        raise Refuse(f"incident: the folder name {folder!r} cannot make a key: only a-z, 0-9 and - are allowed")
    d = os.path.join(root, ".pro-dev", "incidents", key)
    os.makedirs(d, exist_ok=True)
    evidence.ensure_excluded(root)
    if evidence.sh(["git", "check-ignore", "-q", os.path.relpath(d, root) + "/x"], root).returncode != 0:
        raise Refuse("incident: .pro-dev/ is not ignored by git here, so pastes would not stay out of the tree")
    return {"path": os.path.relpath(d, root), "evidence_key": key}


def cmd_record(arg: str) -> dict:
    root = evidence.repo_root()
    if not root:
        raise Refuse("incident: not inside a git repository")
    d = intent_dir(arg, root)
    folder = os.path.basename(d)
    fm, body = frontmatter(read_text(os.path.join(d, "incident.md")))
    state, sev = fm.get("state"), fm.get("severity")
    if state not in STATES:
        raise Refuse(f"incident: refusing the state {state!r}: use {', '.join(STATES)}")
    if sev not in SEVERITIES:
        raise Refuse(f"incident: refusing the severity {sev!r}: use {', '.join(SEVERITIES)}")
    if fm.get("id") != folder:
        raise Refuse(f"incident: frontmatter id {fm.get('id')!r} must be the folder name {folder!r}")
    if fm.get("commit") and not SHA.match(fm["commit"]):
        raise Refuse("incident: commit must be a full 40-character sha or empty")
    key = "incident-" + folder
    if not evidence.safe_key(key):
        raise Refuse(f"incident: the folder name {folder!r} cannot make a key: only a-z, 0-9 and - are allowed")
    what = summary_line(body) or "no summary written"
    detail = {k: fm.get(k, "") for k in KEYS}
    detail["intent"] = os.path.relpath(d, root)
    detail["created"] = datetime.now().astimezone().isoformat(timespec="seconds")
    record = {
        "schema": 1,
        "evidence_key": key,
        "kind": "doc",
        "artifact_kind": "incident",
        "artifact_key": folder,
        "status": STATES[state],
        "summary": f"{sev} {state}: {what}",
        "detail_json": json.dumps(detail),
        "produced_by": f"pro-ai-sdlc:incident@{evidence.plugin_version()}",
    }
    out = evidence.write_record(root, "incidents", record)
    return {**out, "status": record["status"], "evidence_key": key}


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0 if argv else 2
    if len(argv) != 2 or argv[0] not in ("prepare", "record", "check"):
        print("incident: usage: incident.py prepare <folder> | record|check <intent dir>", file=sys.stderr)
        return 2
    try:
        out = {"prepare": cmd_prepare, "record": cmd_record, "check": cmd_check}[argv[0]](argv[1])
        print(json.dumps(out))
        return 0
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
