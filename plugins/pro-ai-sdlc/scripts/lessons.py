#!/usr/bin/env python3
"""lessons - the finding ledger and review lessons behind /review's "Learning from repeats".

  lessons.py add --ref <pr or branch> --head <40 hex> --class <slug> --file <path>   (claim on stdin)
  lessons.py classes
  lessons.py repeats
  lessons.py mark <class> proposed|accepted|declined [--file CLAUDE.md|AGENTS.md]    (line on stdin)

The ledger is .pro-dev/review/findings.jsonl, one line per finding, never read by mieruka. A lesson
is a review-lesson manifest as docs/loop-records.md describes it, written through evidence.py.

The claim and the line come from text a reviewed diff can shape, so both arrive on stdin and
never on a command line. The line goes into an agent file that every later session reads, so
mark refuses anything but one short plain line.

Python 3 standard library only. No network calls.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import evidence  # noqa: E402
from evidence import Refuse  # noqa: E402

LEDGER = os.path.join(".pro-dev", "review", "findings.jsonl")
LESSON_DIR = "review/lessons"
SHA = re.compile(r"^[0-9a-f]{40}$")
AGENT_FILES = ("CLAUDE.md", "AGENTS.md")
STATES = ("proposed", "accepted", "declined")
STATUS_OF = {"proposed": "info", "accepted": "pass", "declined": "partial"}
MAX_LINE = 200
MAX_CLAIM = 300
MAX_REF = 200


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def read_stdin() -> str:
    try:
        return sys.stdin.read()
    except (OSError, UnicodeDecodeError):
        raise Refuse("lessons: stdin could not be read as text")


def need_root() -> str:
    root = evidence.repo_root()
    if not root:
        raise Refuse("lessons: not inside a git repository")
    return root


def read_ledger(root: str) -> list[dict]:
    """Every readable ledger line; a damaged line is skipped, never fatal."""
    rows = []
    try:
        text = open(os.path.join(root, LEDGER), encoding="utf-8").read()
    except OSError:
        return rows
    for ln in text.splitlines():
        try:
            row = json.loads(ln)
        except ValueError:
            continue
        if isinstance(row, dict) and evidence.safe_key(row.get("class")) and isinstance(row.get("ref"), str):
            rows.append(row)
    return rows


def lesson_path(root: str, cls: str) -> str:
    return os.path.join(root, ".pro-dev", LESSON_DIR, f"review-lesson-{cls}.json")


def read_lesson(root: str, cls: str) -> dict | None:
    """The detail of an existing lesson, or None."""
    try:
        rec = json.load(open(lesson_path(root, cls), encoding="utf-8"))
        detail = json.loads(rec["detail_json"])
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return detail if isinstance(detail, dict) else None


def clean_path(text: str) -> str:
    if (not text or len(text) > 300 or os.path.isabs(text) or ".." in text.replace("\\", "/").split("/")
            or any(ord(c) < 32 for c in text)):
        raise Refuse(f"lessons: refusing the file {text[:60]!r}: it must be a short relative path inside the repo")
    return text


def cmd_add(a) -> dict:
    root = need_root()
    if not evidence.safe_key(a.cls):
        raise Refuse(f"lessons: refusing the class {a.cls!r}: only a-z, 0-9 and - are allowed, not starting with -")
    if not SHA.match(a.head):
        raise Refuse("lessons: --head must be 40 lowercase hex characters")
    # A branch name is chosen by whoever opened the PR, so only plain characters pass.
    if not a.ref or len(a.ref) > MAX_REF or not re.fullmatch(r"[A-Za-z0-9._/-]+", a.ref):
        raise Refuse("lessons: --ref must be a branch name of A-Z, a-z, 0-9, ., _, / and - only (use pr-<number> otherwise)")
    clean_path(a.file)
    claim = " ".join(read_stdin().split())
    if not claim:
        raise Refuse("lessons: the claim on stdin is empty")
    claim = claim[:MAX_CLAIM]
    for row in read_ledger(root):
        if row["class"] == a.cls and row["ref"] == a.ref:
            return {"path": LEDGER, "mieruka": None, "why": "", "stored": False, "class": a.cls}
    row = {"ref": a.ref, "head": a.head, "class": a.cls, "file": a.file, "claim": claim, "created": now()}
    path = os.path.join(root, LEDGER)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    evidence.ensure_excluded(root)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")
    return {"path": LEDGER, "mieruka": None, "why": "", "stored": True, "class": a.cls}


def cmd_classes(a) -> dict:
    root = need_root()
    counts: dict[str, set] = {}
    for row in read_ledger(root):
        counts.setdefault(row["class"], set()).add(row["ref"])
    return {"classes": [{"class": c, "refs": len(r)} for c, r in sorted(counts.items())]}


def cmd_repeats(a) -> dict:
    """Classes on two or more distinct refs whose lesson is not accepted or declined. A proposed one is asked again."""
    root = need_root()
    seen: dict[str, list[dict]] = {}
    for row in read_ledger(root):
        seen.setdefault(row["class"], []).append(row)
    out = []
    for cls, rows in sorted(seen.items()):
        if len({r["ref"] for r in rows}) < 2:
            continue
        lesson = read_lesson(root, cls)
        if lesson and lesson.get("state") in ("accepted", "declined"):
            continue
        out.append({"class": cls, "refs": sorted({r["ref"] for r in rows}),
                    "claims": [r.get("claim", "") for r in rows], "state": lesson.get("state") if lesson else None})
    return {"repeats": out}


def check_line(line: str) -> str:
    line = line[:-1] if line.endswith("\n") else line
    if line.endswith("\r"):
        line = line[:-1]
    if not line.strip():
        raise Refuse("lessons: the line on stdin is empty")
    if "\n" in line or "\r" in line:
        raise Refuse("lessons: refusing a line with a newline: it must be one line")
    if "```" in line or "~~~" in line:
        raise Refuse("lessons: refusing a line with a code fence")
    if len(line) > MAX_LINE:
        raise Refuse(f"lessons: refusing a line of {len(line)} characters: the limit is {MAX_LINE}")
    if any(ord(c) < 32 or ord(c) == 127 for c in line):
        raise Refuse("lessons: refusing a line with control characters")
    return line


def cmd_mark(a) -> dict:
    root = need_root()
    if not evidence.safe_key(a.cls):
        raise Refuse(f"lessons: refusing the class {a.cls!r}: only a-z, 0-9 and - are allowed, not starting with -")
    if a.file not in AGENT_FILES:
        raise Refuse("lessons: --file must be CLAUDE.md or AGENTS.md")
    rows = [r for r in read_ledger(root) if r["class"] == a.cls]
    if not rows:
        raise Refuse(f"lessons: the class {a.cls!r} is not in the ledger: add a finding first")
    old = read_lesson(root, a.cls) or {}
    if a.state == "declined" and sys.stdin.isatty():
        raw = ""
    else:
        raw = read_stdin()
    if a.state == "declined" and not raw.strip():
        line = old.get("line") if isinstance(old.get("line"), str) else f"declined: {a.cls}"
    else:
        line = check_line(raw)
    seen = [{"ref": r["ref"], "head": r.get("head"), "file": r.get("file"), "claim": r.get("claim")} for r in rows]
    detail = {"class": a.cls, "state": a.state, "line": line, "file": a.file, "seen": seen,
              "created": old.get("created") or now()}
    record = {
        "schema": 1,
        "evidence_key": f"review-lesson-{a.cls}",
        "kind": "review",
        "artifact_kind": "review-lesson",
        "artifact_key": a.cls,
        "status": STATUS_OF[a.state],
        "summary": line,
        "detail_json": json.dumps(detail),
        "produced_by": f"pro-ai-sdlc:review@{evidence.plugin_version()}",
    }
    res = evidence.write_record(root, LESSON_DIR, record)
    res.update({"evidence_key": record["evidence_key"], "state": a.state, "status": record["status"]})
    return res


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="lessons.py", description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("add")
    s.add_argument("--ref", required=True)
    s.add_argument("--head", required=True)
    s.add_argument("--class", dest="cls", required=True)
    s.add_argument("--file", required=True)
    s.set_defaults(fn=cmd_add)
    sub.add_parser("classes").set_defaults(fn=cmd_classes)
    sub.add_parser("repeats").set_defaults(fn=cmd_repeats)
    s = sub.add_parser("mark")
    s.add_argument("cls", metavar="class")
    s.add_argument("state", choices=STATES)
    s.add_argument("--file", default="CLAUDE.md")
    s.set_defaults(fn=cmd_mark)
    args = p.parse_args(argv)
    try:
        out = args.fn(args)
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 1
    except (OSError, UnicodeError) as e:
        print(f"lessons: {e}", file=sys.stderr)
        return 1
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
