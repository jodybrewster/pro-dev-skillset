#!/usr/bin/env python3
"""The design file of a change: where it is, who reviewed it and who approved which version.

  python3 design.py status   <intent>            what the change has and what it still needs, as JSON
  python3 design.py link     <intent> <path>     write `design: <path>` into the intent's frontmatter
  python3 design.py context  <intent>            the reading list for a review of the design, as JSON
  python3 design.py reviewed <intent> --open N   record a review of the design's current version
  python3 design.py approve  <intent> --role R   record an approval of the design's current version
  python3 design.py check    <intent>            exit 0 when the design may be built, 1 with the reasons

<intent> is a change id (TDO-3), a folder name, intent/<folder> or a path to a file inside it.

A feature has one design file under docs/designs/ that stays true as changes land (EGM's file).
An intent names it in a `design:` frontmatter line.
Reviews and approvals are kept beside the intent in design-record.json and are bound to the
sha256 of the design file, so an edit to the design voids them without anyone clearing a field.
The record is beside the intent, not in the design file, so EGM's file stays EGM's and two
changes to one feature keep separate records.

Approvals by level (the level is the intent's `level:` line, read as 2 when it is missing or 1):
  2  product_owner and engineer
  3  product_owner, engineer and lead
The approver is `git config user.name` and must be listed under that role in REVIEW.md's Roles
block on the default branch.
A design with an open row under `## Flagged concerns` is never buildable.

Exit 0 on success, 1 when `check` says no, 2 on a refused argument.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import factory  # noqa: E402
import ids  # noqa: E402

RECORD = "design-record.json"
ID_RE = re.compile(r"^[A-Z]{2,6}-[1-9][0-9]*$")
ROOT_DOCS = ("REVIEW.md", "CLAUDE.md", "AGENTS.md", "PRODUCT.md", "DESIGN.md", "ARCHITECTURE.md", "SECURITY.md")
REQUIRED = {2: ("product_owner", "engineer"), 3: ("product_owner", "engineer", "lead")}
CLOSED_RE = re.compile(r"^(closed|resolved|accepted|done|n/?a)\b", re.I)


class Refuse(Exception):
    pass


def repo_root(arg):
    start = os.path.abspath(arg or os.getcwd())
    top = factory.git(start, "rev-parse", "--show-toplevel")
    if top.returncode != 0 or not top.stdout.strip():
        raise Refuse(f"design: {start} is not inside a git repository")
    return os.path.realpath(top.stdout.strip())


def resolve_intent(root, arg):
    """(folder name, repo-relative dir) from an id, a folder name, a dir or a file inside the dir."""
    arg = (arg or "").strip()
    if not arg:
        raise Refuse("design: name the intent: a change id, a folder under intent/ or a path inside one")
    base = os.path.join(root, "intent")
    if ID_RE.match(arg):
        hits = sorted(d for d in (os.listdir(base) if os.path.isdir(base) else []) if d.startswith(arg + "-"))
        if len(hits) > 1:
            raise Refuse(f"design: {len(hits)} folders under intent/ start with {arg}-: " + ", ".join(hits)
                         + "; name the folder, or give one a new id with ids.py renumber")
        if not hits:
            raise Refuse(f"design: no folder under intent/ starts with {arg}-")
        arg = os.path.join(base, hits[0])
    elif os.sep not in arg and "/" not in arg and os.path.isdir(os.path.join(base, arg)):
        arg = os.path.join(base, arg)
    path = arg if os.path.isabs(arg) else os.path.join(os.getcwd(), arg)
    if not os.path.exists(path):
        path = os.path.join(root, arg)
    if os.path.isfile(path):
        path = os.path.dirname(path)
    try:
        return factory.folder_of(root, path)
    except factory.Refuse as e:
        raise Refuse(str(e).replace("factory:", "design:"))


def read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except (OSError, UnicodeError):
        return None


def check_design_path(root, value):
    """A repo-relative Markdown file inside the repo, never a symlink, never under .git."""
    value = (value or "").strip().strip("'\"")
    if not value:
        raise Refuse("design: the design path is empty")
    if os.path.isabs(value) or value.startswith("~"):
        raise Refuse(f"design: {value!r} must be relative to the repo root")
    parts = value.replace("\\", "/").split("/")
    if ".." in parts or "" in parts or "." in parts:
        raise Refuse(f"design: {value!r} must be a plain repo-relative path")
    if parts[0] == ".git":
        raise Refuse(f"design: {value!r} is under .git")
    if not value.lower().endswith(".md"):
        raise Refuse(f"design: {value!r} is not a Markdown file")
    walk = root
    for part in parts:
        walk = os.path.join(walk, part)
        if os.path.islink(walk):
            raise Refuse(f"design: {value!r} passes through a symlink")
    return "/".join(parts)


def intent_fields(root, rel):
    text = read(os.path.join(root, rel, "intent.md"))
    if text is None:
        raise Refuse(f"design: no readable intent.md in {rel}")
    fm, _body = factory.frontmatter(text)
    return fm, text


def level_of(fm):
    """The level the approvals follow: the file's level, never below 2 once a design is involved."""
    return max(factory.level_of(fm.get("level")) or 2, 2)


def clean_in_git(root, rel):
    """True when the file is tracked and has no uncommitted change."""
    if factory.git(root, "ls-files", "--error-unmatch", "--", rel).returncode != 0:
        return False
    return not factory.git(root, "status", "--porcelain", "--", rel).stdout.strip()


def sha_of(path):
    try:
        with open(path, "rb") as fh:
            return hashlib.sha256(fh.read()).hexdigest()
    except OSError:
        return None


def open_concerns(text):
    """(count of open rows under ## Flagged concerns, problem or None).

    The section holds `None found` or a table whose last cell says the row's status.
    A row counts as open unless that cell starts with closed, resolved, accepted, done or n/a."""
    clean = re.sub(r"<!--.*?-->", "", text or "", flags=re.S)
    heads = list(re.finditer(r"^##[ \t]+Flagged concerns[ \t]*$", clean, re.M | re.I))
    if len(heads) != 1:
        return 0, ("the design has no Flagged concerns section" if not heads else "the design has two Flagged concerns sections")
    body = clean[heads[0].end():]
    nxt = re.search(r"^## ", body, re.M)
    body = body[:nxt.start()] if nxt else body
    rows = [ln.strip() for ln in body.splitlines() if ln.strip().startswith("|")]
    rows = [r for r in rows[1:] if not re.fullmatch(r"\|[\s:|-]+\|?", r)]
    count = 0
    for row in rows:
        cells = [c.strip() for c in row.strip("|").split("|")]
        if not any(cells):
            continue
        if not CLOSED_RE.match(cells[-1]):
            count += 1
    return count, None


def load_record(root, rel):
    raw = read(os.path.join(root, rel, RECORD))
    if raw is None:
        return {"reviews": [], "approvals": []}
    try:
        data = json.loads(raw)
    except ValueError:
        raise Refuse(f"design: {rel}/{RECORD} is not valid JSON")
    if not isinstance(data, dict):
        raise Refuse(f"design: {rel}/{RECORD} must hold an object")
    for key in ("reviews", "approvals"):
        if not isinstance(data.get(key, []), list):
            raise Refuse(f"design: {rel}/{RECORD} {key} must be a list")
        data[key] = [e for e in data.get(key, []) if isinstance(e, dict)]
    return data


def save_record(root, rel, record):
    path = os.path.join(root, rel, RECORD)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(record, indent=2, ensure_ascii=False) + "\n")


def roles_of(root):
    tip, _name = factory.default_tip(root)
    text = factory.show(root, tip, "REVIEW.md")
    if text is None:
        raise Refuse(f"design: no REVIEW.md on {tip}; /pro-core:pro-dev install writes one with a Roles block")
    try:
        return factory.parse_roles(text)
    except factory.Refuse as e:
        raise Refuse(str(e).replace("factory:", "design:"))


def now():
    return datetime.datetime.now().astimezone().replace(microsecond=0).isoformat()


def state(root, arg):
    """Everything known about the change's design, with the reasons it may not be built yet."""
    folder, rel = resolve_intent(root, arg)
    fm, _text = intent_fields(root, rel)
    level = level_of(fm)
    out = {"intent_dir": rel, "folder": folder, "id": fm.get("id") or None, "level": level,
           "design": None, "sha": None, "committed": False, "review": None, "open_findings": None,
           "open_concerns": 0, "required": list(REQUIRED[min(level, 3)]), "approved": [], "missing": [],
           "reasons": []}
    for shared, folders in ids.duplicates(root) if out["id"] else []:
        if shared == out["id"]:
            out["reasons"].append(ids.duplicate_line(shared, folders).replace("ids: ", "", 1))
    raw = fm.get("design", "").strip()
    if not raw:
        out["reasons"].append("the intent names no design file; /pro-ai-sdlc-egm:design writes one")
        out["missing"] = out["required"]
        return out
    design = check_design_path(root, raw)
    out["design"] = design
    path = os.path.join(root, design)
    sha = sha_of(path)
    if sha is None:
        out["reasons"].append(f"{design} does not exist")
        out["missing"] = out["required"]
        return out
    out["sha"] = sha
    out["committed"] = clean_in_git(root, design)
    if not out["committed"]:
        out["reasons"].append(f"{design} has changes that are not committed")
    concerns, problem = open_concerns(read(path))
    out["open_concerns"] = concerns
    if problem:
        out["reasons"].append(problem)
    if concerns:
        out["reasons"].append(f"{concerns} flagged concern(s) still open in {design}")
    record = load_record(root, rel)
    review = next((r for r in reversed(record["reviews"]) if r.get("sha") == sha), None)
    out["review"] = review
    if review is None:
        stale = " (a review exists for an earlier version)" if record["reviews"] else ""
        out["reasons"].append("no review is recorded for this version of the design" + stale)
    else:
        out["open_findings"] = review.get("open", 0)
    approved = {}
    for entry in record["approvals"]:
        if entry.get("sha") == sha and entry.get("role") in out["required"]:
            approved[entry["role"]] = entry.get("name")
    out["approved"] = [{"role": r, "name": approved[r]} for r in out["required"] if r in approved]
    out["missing"] = [r for r in out["required"] if r not in approved]
    if out["missing"]:
        stale = " (earlier approvals were for another version)" if record["approvals"] and not approved else ""
        out["reasons"].append("not approved by: " + ", ".join(out["missing"]) + stale)
    if os.path.exists(os.path.join(root, rel, RECORD)) and not clean_in_git(root, f"{rel}/{RECORD}"):
        out["reasons"].append(f"{rel}/{RECORD} has changes that are not committed")
    return out


def cmd_status(args):
    print(json.dumps(state(repo_root(args.repo), args.intent), indent=2))
    return 0


def cmd_pending(args):
    """Intent folders still missing a design or a plan, newest first. Prints nothing when there are none."""
    try:
        root = repo_root(args.repo)
    except Refuse:
        return 0
    base = os.path.join(root, "intent")
    names = sorted((n for n in os.listdir(base) if os.path.isdir(os.path.join(base, n))), reverse=True) \
        if os.path.isdir(base) else []
    for name in names:
        folder = os.path.join(base, name)
        intent = os.path.join(folder, "intent.md")
        if not os.path.isfile(intent) or os.path.exists(os.path.join(folder, "plan.md")):
            continue
        if args.missing == "design" and re.search(r"^design:[ \t]*\S", read(intent), re.M):
            continue
        print(f"intent/{name}/")
    return 0


def cmd_check(args):
    st = state(repo_root(args.repo), args.intent)
    if st["reasons"]:
        for reason in st["reasons"]:
            print(f"design: {reason}", file=sys.stderr)
        return 1
    names = ", ".join(f"{a['name']} ({a['role']})" for a in st["approved"])
    print(json.dumps({"design": st["design"], "sha": st["sha"], "level": st["level"], "approved_by": names}))
    return 0


def cmd_link(args):
    root = repo_root(args.repo)
    _folder, rel = resolve_intent(root, args.intent)
    design = check_design_path(root, args.path)
    path = os.path.join(root, rel, "intent.md")
    text = read(path)
    if text is None:
        raise Refuse(f"design: no readable intent.md in {rel}")
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        raise Refuse(f"design: {rel}/intent.md has no frontmatter to write the design into")
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if end is None:
        raise Refuse(f"design: {rel}/intent.md frontmatter is not closed")
    at = next((i for i in range(1, end) if re.match(r"^design:", lines[i])), None)
    if at is None:
        lines.insert(end, f"design: {design}")
    elif lines[at].strip() == f"design: {design}":
        print(f"design: {rel}/intent.md already names {design}")
        return 0
    else:
        lines[at] = f"design: {design}"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(f"design: {rel}/intent.md now names {design}")
    return 0


def cmd_context(args):
    root = repo_root(args.repo)
    _folder, rel = resolve_intent(root, args.intent)
    fm, _text = intent_fields(root, rel)
    reading = [f"{rel}/intent.md"]
    brief = fm.get("brief", "").strip()
    if brief:
        try:
            reading.append(check_design_path(root, brief))
        except Refuse:
            pass
    target = check_design_path(root, fm["design"]) if fm.get("design", "").strip() else None
    for name in ROOT_DOCS:
        if os.path.isfile(os.path.join(root, name)) and not os.path.islink(os.path.join(root, name)):
            reading.append(name)
    reading = [p for p in dict.fromkeys(reading) if p != target and os.path.isfile(os.path.join(root, p))]
    print(json.dumps({"target": target, "context": reading}, indent=2))
    return 0


def need_current(root, arg):
    st = state(root, arg)
    if not st["design"] or not st["sha"]:
        raise Refuse("design: " + st["reasons"][0])
    if not st["committed"]:
        raise Refuse(f"design: commit {st['design']} first; a review or approval is recorded against a committed version")
    return st


def cmd_reviewed(args):
    root = repo_root(args.repo)
    st = need_current(root, args.intent)
    if args.open < 0:
        raise Refuse("design: --open cannot be negative")
    record = load_record(root, st["intent_dir"])
    record["design"] = st["design"]
    record["reviews"] = [r for r in record["reviews"] if r.get("sha") != st["sha"]]
    reviewers = [r.strip() for r in (args.reviewers or "").split(",") if r.strip()]
    record["reviews"].append({"sha": st["sha"], "date": now(), "open": args.open, "reviewers": reviewers})
    save_record(root, st["intent_dir"], record)
    print(f"design: review recorded for {st['design']} at {st['sha'][:12]}, {args.open} finding(s) left open")
    return 0


def cmd_approve(args):
    root = repo_root(args.repo)
    st = need_current(root, args.intent)
    if st["review"] is None:
        raise Refuse("design: no review is recorded for this version of the design; run the review first")
    if st["open_concerns"]:
        raise Refuse(f"design: {st['open_concerns']} flagged concern(s) still open; the policy owner closes them first")
    roles = roles_of(root)
    name = (args.name or factory.git(root, "config", "user.name").stdout).strip()
    if not name:
        raise Refuse("design: no approver name; set git config user.name")
    held = [r for r in st["required"] if name.lower() in {n.lower() for n in roles.get(r, [])}]
    if args.role == "all":
        wanted = held
        if not wanted:
            raise Refuse(f"design: {name} holds none of the roles this level needs ({', '.join(st['required'])})")
    else:
        if args.role not in st["required"]:
            raise Refuse(f"design: level {st['level']} needs {', '.join(st['required'])}, not {args.role}")
        if args.role not in held:
            raise Refuse(f"design: {name} is not listed as {args.role} in REVIEW.md")
        wanted = [args.role]
    record = load_record(root, st["intent_dir"])
    record["design"] = st["design"]
    for role in wanted:
        record["approvals"] = [a for a in record["approvals"] if not (a.get("role") == role and a.get("sha") == st["sha"])]
        record["approvals"].append({"role": role, "name": name, "sha": st["sha"], "date": now(), "level": st["level"]})
    save_record(root, st["intent_dir"], record)
    after = state(root, args.intent)
    left = ", ".join(after["missing"]) or "nobody"
    print(f"design: {name} approved {st['design']} at {st['sha'][:12]} as {', '.join(wanted)}; still waiting on {left}")
    return 0


def main(argv):
    p = argparse.ArgumentParser(prog="design.py", description="The design file of a change and its approvals.")
    p.add_argument("--repo", help="a path inside the repo (default: the current directory)")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn in (("status", cmd_status), ("check", cmd_check), ("context", cmd_context)):
        s = sub.add_parser(name)
        s.add_argument("intent")
        s.set_defaults(fn=fn)
    s = sub.add_parser("pending")
    s.add_argument("--missing", choices=("design", "plan"), required=True)
    s.set_defaults(fn=cmd_pending)
    s = sub.add_parser("link")
    s.add_argument("intent")
    s.add_argument("path")
    s.set_defaults(fn=cmd_link)
    s = sub.add_parser("reviewed")
    s.add_argument("intent")
    s.add_argument("--open", type=int, required=True, help="Blocker and Major findings left open after the fixes")
    s.add_argument("--reviewers", help="comma-separated names of the reviewers that ran")
    s.set_defaults(fn=cmd_reviewed)
    s = sub.add_parser("approve")
    s.add_argument("intent")
    s.add_argument("--role", required=True, help="product_owner, engineer, lead or all (every needed role the person holds)")
    s.add_argument("--name", help="the approver (default: git config user.name)")
    s.set_defaults(fn=cmd_approve)
    args = p.parse_args(argv)
    try:
        return args.fn(args)
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
