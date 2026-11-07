#!/usr/bin/env python3
"""lessons - the finding ledger and review lessons behind /review's "Learning from repeats".

  lessons.py add --ref <pr or branch> --head <40 hex> --class <slug> --file <path>   (claim on stdin)
  lessons.py classes
  lessons.py repeats
  lessons.py mark <class> proposed|accepted|declined [--file CLAUDE.md|AGENTS.md]    (line on stdin)

  lessons.py raise --ref <ref> --base <40 hex> --head <40 hex> --pass <pass> --severity important|nit|pre-existing
                   --class <slug> --file <path> --line <n>                            (claim on stdin)
  lessons.py grade --ref <ref> --head <40 hex> <id> fixed|not-fixed|no-longer-applies --evidence <path:line>
  lessons.py table --ref <ref> [--tally]
  lessons.py round --ref <ref> --base <40 hex> --head <40 hex> --round <n> --fresh ran|skipped

The ledger is .pro-dev/review/findings.jsonl, one line per finding, never read by mieruka. A lesson
is a review-lesson manifest as docs/loop-records.md describes it, written through evidence.py.

The findings table (ADR-0027) is .pro-dev/review/<key>.json, one per ref, where <key> is the ref
with every / written as --. Each row has a stable id (F1, F2 and so on, never reused), a
file:line and a status: open, fixed, not fixed or no longer applies. A row never holds a failure
scenario or reasoning, so only grade mode reads it and the fresh pass never does. A round
writes a review-round manifest to .pro-dev/review/rounds/.

The claim and the line come from text a reviewed diff can shape, so both arrive on stdin and
never on a command line. The line goes into an agent file that every later session reads, so
mark refuses anything but one short plain line.

Python 3 standard library only. No network calls.
"""

from __future__ import annotations

import argparse
import hashlib
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
ROUND_DIR = "review/rounds"
SEVERITIES = ("important", "nit", "pre-existing")
GRADES = {"fixed": "fixed", "not-fixed": "not fixed", "no-longer-applies": "no longer applies"}
STATUSES = ("open", "fixed", "not fixed", "no longer applies")
LIVE = ("open", "not fixed")
FID = re.compile(r"^F([1-9][0-9]{0,5})$")


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
    check_ref(a.ref)
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


def check_ref(ref: str) -> str:
    # A branch name is chosen by whoever opened the PR, so only plain characters pass.
    if not ref or len(ref) > MAX_REF or not re.fullmatch(r"[A-Za-z0-9._/-]+", ref):
        raise Refuse("lessons: --ref must be a branch name of A-Z, a-z, 0-9, ., _, / and - only (use pr-<number> otherwise)")
    return ref


def check_sha(text: str, flag: str) -> str:
    if not SHA.match(text or ""):
        raise Refuse(f"lessons: {flag} must be 40 lowercase hex characters")
    return text


def read_claim() -> str:
    claim = " ".join("".join(c if ord(c) >= 32 and ord(c) != 127 else " " for c in read_stdin()).split())
    if not claim:
        raise Refuse("lessons: the claim on stdin is empty")
    return claim[:MAX_CLAIM]


def table_path(root: str, ref: str) -> str:
    return os.path.join(root, ".pro-dev", "review", ref.replace("/", "--") + ".json")


def fid_num(fid: str) -> int:
    m = FID.match(fid)
    return int(m.group(1)) if m else 0


def row_ok(key, row) -> bool:
    """A row that raise and grade can trust: its id is its key and it names a file, a class, a severity and a status."""
    return (bool(FID.match(key)) and isinstance(row, dict) and row.get("id") == key and row.get("status") in STATUSES
            and row.get("severity") in SEVERITIES and isinstance(row.get("file"), str) and isinstance(row.get("class"), str))


def read_table(root: str, ref: str) -> dict:
    """The table for a ref, or an empty one. A table that cannot be parsed is set aside as .bad."""
    path = table_path(root, ref)
    empty = {"schema": 1, "ref": ref, "base": None, "head": None, "round": 0, "findings": {}}
    try:
        text = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        return empty
    except ValueError:  # UnicodeDecodeError: bytes that are not UTF-8 are a damaged table too
        text = None
    try:
        data = json.loads(text) if text is not None else None
        ok = (isinstance(data, dict) and isinstance(data.get("findings"), dict)
              and all(row_ok(k, v) for k, v in data["findings"].items()))
    except ValueError:
        ok = False
    if not ok:
        bad = path + ".bad"
        os.replace(path, bad)
        print(f"lessons: warning: {os.path.relpath(bad, root)} could not be read as a findings table; "
              "it was set aside and this round runs as a first review", file=sys.stderr)
        return empty
    if data.get("ref") != ref:
        raise Refuse(f"lessons: {os.path.relpath(path, root)} belongs to the ref {data.get('ref')!r}, not {ref!r}: "
                     "two refs share a key once / is written as --, so use pr-<number> for this one")
    return data


def write_table(root: str, table: dict) -> str:
    path = table_path(root, table["ref"])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    evidence.ensure_excluded(root)
    table["findings"] = dict(sorted(table["findings"].items(), key=lambda kv: fid_num(kv[0])))
    evidence.write_atomic(path, json.dumps(table, indent=2) + "\n")
    return os.path.relpath(path, root)


def cmd_raise(a) -> dict:
    """Add a finding with the next free id, unless an open or not fixed row has the same file and class.
    The match is always against the live table, after this round's grades, never a caller's earlier copy."""
    root = need_root()
    ref = check_ref(a.ref)
    check_sha(a.base, "--base")
    check_sha(a.head, "--head")
    if not evidence.safe_key(a.cls):
        raise Refuse(f"lessons: refusing the class {a.cls!r}: only a-z, 0-9 and - are allowed, not starting with -")
    if not evidence.safe_key(a.pass_):
        raise Refuse(f"lessons: refusing the pass {a.pass_!r}: only a-z, 0-9 and - are allowed, not starting with -")
    clean_path(a.file)
    if a.line < 1:
        raise Refuse("lessons: --line must be a positive line number")
    claim = read_claim()
    table = read_table(root, ref)
    rows = table["findings"]
    same = sorted((r for r in rows.values() if r.get("file") == a.file and r.get("class") == a.cls),
                  key=lambda r: fid_num(r.get("id", "")))
    live = [r for r in same if r.get("status") in LIVE]
    table["base"], table["head"] = a.base, a.head
    if live:
        # A fresh Important finding on a live nit row raises that row to Important; a nit never lowers a row.
        row = live[0]
        raised = a.severity == "important" and row.get("severity") == "nit"
        if raised:
            row["severity"] = "important"
        path = write_table(root, table)
        return {"id": row["id"], "stored": False, "reopened_from": None, "severity_raised": raised,
                "severity": row["severity"], "table": path}
    graded = [r for r in same if r.get("status") in ("fixed", "no longer applies")]
    reopened = graded[-1]["id"] if graded else None
    fid = f"F{max([fid_num(k) for k in rows] + [0]) + 1}"
    rows[fid] = {"id": fid, "file": a.file, "line": a.line, "pass": a.pass_, "class": a.cls, "severity": a.severity,
                 "claim": claim, "status": "open", "raised_at": a.head, "graded_at": None, "evidence": None,
                 "reopened_from": reopened}
    path = write_table(root, table)
    return {"id": fid, "stored": True, "reopened_from": reopened, "table": path}


def check_evidence(text: str) -> str:
    path, sep, line = (text or "").rpartition(":")
    if not sep or not re.fullmatch(r"[1-9][0-9]{0,6}", line):
        raise Refuse("lessons: --evidence must be path:line, a repo-relative path, a colon and a positive line number")
    clean_path(path)
    return text


def cmd_grade(a) -> dict:
    root = need_root()
    ref = check_ref(a.ref)
    check_sha(a.head, "--head")
    if a.evidence is None:
        raise Refuse("lessons: grade needs --evidence path:line; a reply, a commit message or a resolved thread is never evidence")
    check_evidence(a.evidence)
    table = read_table(root, ref)
    row = table["findings"].get(a.id)
    if row is None:
        raise Refuse(f"lessons: the finding {a.id!r} is not in the table for {ref!r}")
    row.update({"status": GRADES[a.grade], "graded_at": a.head, "evidence": a.evidence})
    table["head"] = a.head
    path = write_table(root, table)
    return {"id": a.id, "status": row["status"], "table": path}


def tally(rows: dict, head) -> list[str]:
    """The summary line and the grade line. The summary counts the live rows (open or not fixed) by
    severity, so after grading and the fresh pass's raises it is the round's total. The grade line
    counts this round's grades only: the rows graded at the head the table last saw."""
    live = [r for r in rows.values() if r.get("status") in LIVE]
    n = {s: sum(1 for r in live if r.get("severity") == s) for s in SEVERITIES}
    graded = [r for r in rows.values() if head and r.get("graded_at") == head]
    by = {s: sum(1 for r in graded if r.get("status") == s) for s in STATUSES}
    return [f"important: {n['important']}  nits: {n['nit']}  pre-existing: {n['pre-existing']}  skipped: 0",
            f"graded: fixed {by['fixed']} not fixed {by['not fixed']} no longer applies {by['no longer applies']}"]


def cmd_table(a):
    root = need_root()
    ref = check_ref(a.ref)
    table = read_table(root, ref)
    if a.tally:
        return "\n".join(tally(table["findings"], table.get("head")))
    if not os.path.exists(table_path(root, ref)):
        return {"findings": {}}
    table["findings"] = dict(sorted(table["findings"].items(), key=lambda kv: fid_num(kv[0])))
    return table


def cmd_round(a) -> dict:
    """Write the review-round manifest for one round, after its grades and raises."""
    root = need_root()
    ref = check_ref(a.ref)
    check_sha(a.base, "--base")
    check_sha(a.head, "--head")
    if a.round < 1:
        raise Refuse("lessons: --round must be 1 or more")
    table = read_table(root, ref)
    table.update({"base": a.base, "head": a.head, "round": a.round})
    write_table(root, table)
    rows = list(table["findings"].values())
    counts = {s.replace(" ", "_"): sum(1 for r in rows if r.get("status") == s) for s in STATUSES}
    blocking = [r for r in rows if r.get("severity") == "important" and r.get("status") in LIVE]
    findings = [{k: r.get(k) for k in ("id", "file", "line", "class", "severity", "status")} for r in rows]
    detail = {"ref": ref, "base": a.base, "head": a.head, "round": a.round, "range": f"{a.base}..{a.head}",
              "fresh": a.fresh, "counts": counts, "findings": findings, "created": now()}
    summary = (f"round {a.round}: {len(blocking)} important open or not fixed, {counts['fixed']} fixed, "
               f"fresh pass {a.fresh}")
    record = {
        "schema": 1,
        # Two refs can reach the same head and round (a branch /review and a /ship), so the key names the ref too.
        "evidence_key": f"review-round-{a.head[:12]}-{a.round}-{hashlib.sha1(ref.encode()).hexdigest()[:8]}",
        "kind": "review",
        "artifact_kind": "review-round",
        "artifact_key": ref,
        "status": "fail" if blocking else "pass",
        "summary": summary,
        "detail_json": json.dumps(detail),
        "produced_by": f"pro-ai-sdlc:review@{evidence.plugin_version()}",
    }
    res = evidence.write_record(root, ROUND_DIR, record)
    res.update({"evidence_key": record["evidence_key"], "status": record["status"]})
    return res


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
    s = sub.add_parser("raise")
    s.add_argument("--ref", required=True)
    s.add_argument("--base", required=True)
    s.add_argument("--head", required=True)
    s.add_argument("--pass", dest="pass_", required=True)
    s.add_argument("--severity", required=True, choices=SEVERITIES)
    s.add_argument("--class", dest="cls", required=True)
    s.add_argument("--file", required=True)
    s.add_argument("--line", required=True, type=int)
    s.set_defaults(fn=cmd_raise)
    s = sub.add_parser("grade")
    s.add_argument("--ref", required=True)
    s.add_argument("--head", required=True)
    s.add_argument("--evidence")
    s.add_argument("id")
    s.add_argument("grade", choices=tuple(GRADES))
    s.set_defaults(fn=cmd_grade)
    s = sub.add_parser("table")
    s.add_argument("--ref", required=True)
    s.add_argument("--tally", action="store_true")
    s.set_defaults(fn=cmd_table)
    s = sub.add_parser("round")
    s.add_argument("--ref", required=True)
    s.add_argument("--base", required=True)
    s.add_argument("--head", required=True)
    s.add_argument("--round", required=True, type=int)
    s.add_argument("--fresh", required=True, choices=("ran", "skipped"))
    s.set_defaults(fn=cmd_round)
    args = p.parse_args(argv)
    try:
        out = args.fn(args)
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 1
    except (OSError, UnicodeError) as e:
        print(f"lessons: {e}", file=sys.stderr)
        return 1
    print(out if isinstance(out, str) else json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
