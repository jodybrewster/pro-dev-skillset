#!/usr/bin/env python3
"""Change ids for the SDLC loop: <shortcode>-<n>, allocated from git and never reused.

  python3 ids.py next                 print the next id for a new intent
  python3 ids.py backfill [--write]   number every intent that has no id: line

The shortcode comes from intent/project.json ({"shortcode": "PDS"}).
`next` runs `git fetch --quiet origin` with a 10 second timeout, then reads the id: line of every
intent/*/intent.md committed on each refs/remotes/origin/* ref and each local refs/heads/* branch,
plus the working tree, and prints the highest number plus one. Every intent counts whatever its
status, so a dropped change keeps its id. When the fetch fails it still prints the id from the refs
it has and says so on stderr. An intent left uncommitted in another worktree or unpushed in another
clone is on no ref it reads; the change-ids check catches that duplicate on the second pull request.

`backfill` lists every intent with no id: line in created: order (compared in UTC, a date-only value
read as 00:00 UTC, the folder name as the tiebreak) and numbers them from the highest existing id
plus one. It prints the table and writes nothing; --write inserts `id: <id>` as the first
frontmatter line of each such intent.md and changes nothing else.

Exit 0 on success, 1 with a one-line reason on stderr. Stdlib only, Python 3.9.
"""
import glob
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

SHORTCODE_RE = re.compile(r"^[A-Z]{2,6}$")
ID_RE = re.compile(r"^([A-Z]{2,6})-([1-9][0-9]*)$")
INTENT_PATH_RE = re.compile(r"^intent/[^/]+/intent\.md$")
FETCH_TIMEOUT = 10
GIT_TIMEOUT = 60
CREATED_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})"
    r"(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$")


class Refuse(Exception):
    pass


def git(root, *args, timeout=GIT_TIMEOUT, data=None):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    return subprocess.run(["git", "-C", root, *args], input=data, capture_output=True, timeout=timeout, env=env)


def repo_root():
    try:
        r = git(os.getcwd(), "rev-parse", "--show-toplevel")
    except (OSError, subprocess.SubprocessError):
        r = None
    if r is None or r.returncode != 0 or not r.stdout.strip():
        raise Refuse("ids: not inside a git repository")
    return os.path.realpath(r.stdout.decode("utf-8", "replace").strip())


def frontmatter(text):
    """Plain `key: value` lines between the first two --- lines, read like factory.frontmatter."""
    lines = (text or "").replace("\r\n", "\n").split("\n")
    if not lines or lines[0].strip() != "---":
        return {}
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
            return fm
    return {}


def id_of(text):
    """The id: value of an intent's frontmatter, or None."""
    return frontmatter(text).get("id") or None


def shortcode(root):
    path = os.path.join(root, "intent", "project.json")
    if not os.path.isfile(path):
        raise Refuse("ids: no intent/project.json")
    try:
        with open(path, encoding="utf-8") as f:
            code = json.load(f).get("shortcode")
    except (OSError, ValueError, AttributeError):
        code = None
    if not isinstance(code, str) or not SHORTCODE_RE.match(code):
        raise Refuse("ids: intent/project.json needs a shortcode matching ^[A-Z]{2,6}$")
    return code


def fetch(root):
    """None when origin was fetched, else the offline line for stderr."""
    try:
        ok = git(root, "fetch", "--quiet", "origin", timeout=FETCH_TIMEOUT).returncode == 0
    except (OSError, subprocess.SubprocessError):
        ok = False
    if ok:
        return None
    when = "never"
    try:
        p = git(root, "rev-parse", "--git-path", "FETCH_HEAD").stdout.decode().strip()
        p = p if os.path.isabs(p) else os.path.join(root, p)
        if os.path.isfile(p):
            when = datetime.fromtimestamp(os.path.getmtime(p)).astimezone().isoformat(timespec="seconds")
    except (OSError, subprocess.SubprocessError, ValueError):
        pass
    return f"ids: offline, allocated from the last fetch ({when})"


def committed_texts(root):
    """The text of every intent/*/intent.md on refs/remotes/origin/* and refs/heads/*, read once per blob."""
    refs = git(root, "for-each-ref", "--format=%(refname)", "refs/remotes/origin", "refs/heads")
    blobs = set()
    for ref in refs.stdout.decode("utf-8", "replace").split() if refs.returncode == 0 else []:
        if ref.endswith("/HEAD"):
            continue
        r = git(root, "ls-tree", "-r", ref, "--", "intent/")
        if r.returncode != 0:
            continue
        for line in r.stdout.decode("utf-8", "replace").splitlines():
            meta, _, path = line.partition("\t")
            parts = meta.split()
            if len(parts) == 3 and parts[1] == "blob" and INTENT_PATH_RE.match(path):
                blobs.add(parts[2])
    if not blobs:
        return []
    out = git(root, "cat-file", "--batch", data="\n".join(sorted(blobs)).encode() + b"\n")
    texts, buf = [], out.stdout if out.returncode == 0 else b""
    while buf:
        head, _, rest = buf.partition(b"\n")
        parts = head.split()
        if len(parts) != 3:
            break
        size = int(parts[2])
        texts.append(rest[:size].decode("utf-8", "replace"))
        buf = rest[size + 1:]
    return texts


def working_tree(root):
    """{folder: text} for every intent/*/intent.md on disk."""
    found = {}
    for p in sorted(glob.glob(os.path.join(root, "intent", "*", "intent.md"))):
        try:
            with open(p, encoding="utf-8") as f:
                found[os.path.basename(os.path.dirname(p))] = f.read()
        except (OSError, UnicodeDecodeError):
            continue
    return found


def highest(code, texts):
    best = 0
    for text in texts:
        m = ID_RE.match(id_of(text) or "")
        if m and m.group(1) == code:
            best = max(best, int(m.group(2)))
    return best


def cmd_next(root):
    code = shortcode(root)
    offline = fetch(root)
    texts = committed_texts(root) + list(working_tree(root).values())
    top = highest(code, texts)
    print(f"{code}-{top + 1}")
    if offline:
        print(offline, file=sys.stderr)
    elif top:
        print(f"ids: {code}-{top} is the highest id on origin, the local branches and the working tree", file=sys.stderr)
    else:
        print(f"ids: no {code} id yet on origin, the local branches or the working tree", file=sys.stderr)
    return 0


def created_utc(value):
    m = CREATED_RE.match((value or "").strip())
    if not m:
        return None
    y, mo, d, hh, mm, ss, off = m.groups()
    try:
        t = datetime(int(y), int(mo), int(d), int(hh or 0), int(mm or 0), int(ss or 0), tzinfo=timezone.utc)
    except ValueError:
        return None
    if off and off != "Z":
        sign = 1 if off[0] == "+" else -1
        digits = off[1:].replace(":", "")
        t -= sign * timedelta(hours=int(digits[:2]), minutes=int(digits[2:]))
    return t


def cmd_backfill(root, write):
    code = shortcode(root)
    tree = working_tree(root)
    top = highest(code, committed_texts(root) + list(tree.values()))
    todo, bad = [], []
    for folder, text in tree.items():
        if id_of(text):
            continue
        created = frontmatter(text).get("created", "")
        when = created_utc(created)
        if when is None:
            bad.append(folder)
        elif not text.startswith("---"):
            bad.append(folder)
        else:
            todo.append((when, folder, created))
    if bad:
        raise Refuse("ids: no readable created: in the frontmatter of " + ", ".join(f"intent/{b}/intent.md" for b in sorted(bad))
                     + "; fix it before numbering, nothing was written")
    if not todo:
        print("ids: nothing to backfill, every intent has an id")
        return 0
    todo.sort()
    rows = [(f"{code}-{top + i}", folder, created) for i, (_, folder, created) in enumerate(todo, 1)]
    print("| id | folder | created |")
    print("|---|---|---|")
    for cid, folder, created in rows:
        print(f"| {cid} | `{folder}` | `{created}` |")
    if write:
        for cid, folder, _ in rows:
            path = os.path.join(root, "intent", folder, "intent.md")
            with open(path, encoding="utf-8", newline="") as f:
                text = f.read()
            first, nl, rest = text.partition("\n")
            eol = "\r\n" if first.endswith("\r") else "\n"
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(first + nl + f"id: {cid}" + eol + rest)
        print(f"ids: wrote {len(rows)} id lines", file=sys.stderr)
    return 0


def main(argv):
    try:
        if argv[:1] == ["next"] and len(argv) == 1:
            return cmd_next(repo_root())
        if argv[:1] == ["backfill"] and argv[1:] in ([], ["--write"]):
            return cmd_backfill(repo_root(), argv[1:] == ["--write"])
        print("ids: usage: ids.py next | backfill [--write]", file=sys.stderr)
        return 2
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 1
    except (OSError, subprocess.SubprocessError) as e:
        print(f"ids: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
