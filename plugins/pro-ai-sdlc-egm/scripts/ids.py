#!/usr/bin/env python3
"""Change ids for the SDLC loop: <shortcode>-<n>, allocated from git and never reused.

  python3 ids.py next                 print the next id for a new intent, claiming nothing
  python3 ids.py claim                print the next id and claim it on origin
  python3 ids.py check                exit 1 when two intents in the working tree share an id
  python3 ids.py renumber <folder>    give an intent folder a new claimed id
  python3 ids.py backfill [--write]   number every intent that has no id: line

The shortcode comes from intent/project.json ({"shortcode": "PDS"}).

`next` runs `git fetch --quiet origin` with a 10 second timeout and prints the highest number plus
one from four places: the id: line of every intent/*/intent.md committed on each
refs/remotes/origin/* ref and each local refs/heads/* branch, the working tree, every intent folder
git history ever added on any ref (so a deleted intent keeps its number) and the claims on origin.
Every intent counts whatever its status. When the fetch fails it still prints the id from what it
has and says so on stderr.

`claim` does the same and then takes the id for good: it pushes an empty commit to
refs/change-ids/<id> on origin with a lease that only succeeds when that ref does not exist. Two
people who ask at the same moment cannot both win; the second is given the next number. The claim
holds no file and no name, GitHub shows it nowhere and it is never deleted. When origin cannot be
reached or refuses the push the id is still printed, with a line on stderr saying it is not claimed.

`check` reads the working tree. `renumber` claims a new id, renames the folder when its name starts
with the old id and rewrites the id: line of every Markdown file in it; it commits nothing.

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
INTENT_ADDED_RE = re.compile(r"^intent/([A-Z]{2,6})-([1-9][0-9]*)-[^/]*/intent\.md$")
SUBJECT_IDS_RE = re.compile(r"^((?:[A-Z]{2,6}-[1-9][0-9]*)(?:, (?:[A-Z]{2,6}-[1-9][0-9]*))*): ")
CLAIM_NS = "refs/change-ids"
CLAIM_TRIES = 20
CLAIM_ENV = {"GIT_AUTHOR_NAME": "change-id", "GIT_AUTHOR_EMAIL": "change-id@localhost",
             "GIT_COMMITTER_NAME": "change-id", "GIT_COMMITTER_EMAIL": "change-id@localhost"}
FETCH_TIMEOUT = 10
PUSH_TIMEOUT = 20
GIT_TIMEOUT = 60
CREATED_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})"
    r"(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$")


class Refuse(Exception):
    pass


def git(root, *args, timeout=GIT_TIMEOUT, data=None, extra=None):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", **(extra or {}))
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


def history_top(root, code):
    """The highest number among intent folders git history ever added on any ref, deleted or not, and
    among the ids that open the subject of those commits."""
    r = git(root, "log", "--all", "--diff-filter=A", "--name-only", "--format=%x01%s", "--", "intent")
    best = 0
    for line in r.stdout.decode("utf-8", "replace").splitlines() if r.returncode == 0 else []:
        if line.startswith("\x01"):
            m = SUBJECT_IDS_RE.match(line[1:])
            for cid in m.group(1).split(", ") if m else []:
                c, n = cid.rsplit("-", 1)
                if c == code:
                    best = max(best, int(n))
            continue
        m = INTENT_ADDED_RE.match(line)
        if m and m.group(1) == code:
            best = max(best, int(m.group(2)))
    return best


def claims_top(root, code):
    """The highest number claimed on origin, 0 when there is none or origin cannot be read."""
    try:
        r = git(root, "ls-remote", "origin", f"{CLAIM_NS}/{code}-*", timeout=FETCH_TIMEOUT)
    except (OSError, subprocess.SubprocessError):
        return 0
    best = 0
    for line in r.stdout.decode("utf-8", "replace").splitlines() if r.returncode == 0 else []:
        m = ID_RE.match(line.rpartition("/")[2])
        if m and m.group(1) == code:
            best = max(best, int(m.group(2)))
    return best


def top_of(root, code, online):
    texts = committed_texts(root) + list(working_tree(root).values())
    return max(highest(code, texts), history_top(root, code), claims_top(root, code) if online else 0)


def where(code, top, offline):
    if offline:
        return offline
    if top:
        return f"ids: {code}-{top} is the highest id on origin, the local branches and the working tree"
    return f"ids: no {code} id yet on origin, the local branches or the working tree"


def cmd_next(root):
    code = shortcode(root)
    offline = fetch(root)
    top = top_of(root, code, not offline)
    print(f"{code}-{top + 1}")
    print(where(code, top, offline), file=sys.stderr)
    return 0


def push_claim(root, cid):
    """(True, "") when origin now holds the claim, (False, "taken") when someone else holds it, else
    (False, the reason it could not be pushed)."""
    ref = f"{CLAIM_NS}/{cid}"
    try:
        tree = git(root, "mktree", data=b"")
        if tree.returncode != 0:
            return False, "git mktree failed"
        commit = git(root, "commit-tree", tree.stdout.decode().strip(), "-m", f"claim {cid}\n\n{os.urandom(8).hex()}",
                     extra=CLAIM_ENV)
        if commit.returncode != 0:
            return False, "git commit-tree failed"
        sha = commit.stdout.decode().strip()
        push = git(root, "push", "--quiet", f"--force-with-lease={ref}:", "origin", f"{sha}:{ref}", timeout=PUSH_TIMEOUT)
        if push.returncode == 0:
            return True, ""
        seen = git(root, "ls-remote", "--exit-code", "origin", ref, timeout=FETCH_TIMEOUT)
        if seen.returncode == 0:
            return False, "taken"
        lines = [ln.strip() for ln in push.stderr.decode("utf-8", "replace").splitlines() if ln.strip()]
        return False, (lines[-1] if lines else "the push was refused")[:160]
    except subprocess.TimeoutExpired:
        return False, "origin did not answer in time"
    except (OSError, subprocess.SubprocessError) as e:
        return False, str(e)[:160]


def claim(root):
    """(id, the line for stderr). The id is claimed on origin unless the line says otherwise."""
    code = shortcode(root)
    offline = fetch(root)
    top = top_of(root, code, not offline)
    if offline:
        return f"{code}-{top + 1}", offline + "; the id is not claimed on origin"
    for n in range(top + 1, top + 1 + CLAIM_TRIES):
        cid = f"{code}-{n}"
        ok, why = push_claim(root, cid)
        if ok:
            return cid, f"ids: {cid} is claimed on origin"
        if why != "taken":
            return cid, f"ids: {cid} is not claimed on origin ({why})"
    raise Refuse(f"ids: {CLAIM_TRIES} ids in a row were taken while claiming one; run it again")


def cmd_claim(root):
    cid, line = claim(root)
    print(cid)
    print(line, file=sys.stderr)
    return 0


def duplicates(root):
    """[(id, [folder, ...])] for every id two or more intents in the working tree carry, each list
    oldest first by created: with the folder name as the tiebreak."""
    by_id = {}
    for folder, text in working_tree(root).items():
        cid = id_of(text)
        if cid:
            when = created_utc(frontmatter(text).get("created", ""))
            by_id.setdefault(cid, []).append((when is None, when or datetime.max.replace(tzinfo=timezone.utc), folder))
    return [(cid, [f for _, _, f in sorted(rows)]) for cid, rows in sorted(by_id.items()) if len(rows) > 1]


def duplicate_line(cid, folders):
    later = ", ".join(f"intent/{f}/" for f in folders[1:])
    return (f"ids: {cid} is used by intent/{folders[0]}/ and {later}; "
            f"give the later one a new id with: ids.py renumber intent/{folders[-1]}")


def cmd_check(root):
    found = duplicates(root)
    for cid, folders in found:
        print(duplicate_line(cid, folders), file=sys.stderr)
    return 1 if found else 0


def cmd_renumber(root, arg):
    folder = os.path.basename(os.path.normpath(arg))
    path = os.path.join(root, "intent", folder)
    intent = os.path.join(path, "intent.md")
    if not folder or folder in (".", "..") or not os.path.isfile(intent):
        raise Refuse(f"ids: no intent at intent/{folder}/intent.md")
    with open(intent, encoding="utf-8") as f:
        old = id_of(f.read())
    if not old:
        raise Refuse(f"ids: intent/{folder}/intent.md has no id: line; run ids.py backfill")
    new, line = claim(root)
    for name in sorted(os.listdir(path)):
        if not name.endswith(".md"):
            continue
        file = os.path.join(path, name)
        with open(file, encoding="utf-8", newline="") as f:
            text = f.read()
        lines = text.split("\n")
        if not lines or lines[0].strip() != "---":
            continue
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                break
            if re.match(rf"^id:\s*[\"']?{re.escape(old)}[\"']?\s*(#.*)?\r?$", lines[i]):
                lines[i] = f"id: {new}" + ("\r" if lines[i].endswith("\r") else "")
                with open(file, "w", encoding="utf-8", newline="") as f:
                    f.write("\n".join(lines))
                break
    target = folder
    if folder.startswith(old + "-"):
        target = new + folder[len(old):]
        if os.path.exists(os.path.join(root, "intent", target)):
            raise Refuse(f"ids: intent/{target}/ already exists")
        if git(root, "mv", f"intent/{folder}", f"intent/{target}").returncode != 0:
            os.rename(path, os.path.join(root, "intent", target))
    print(f"{old} -> {new}  intent/{target}/")
    print(line, file=sys.stderr)
    print("ids: nothing is committed; a branch or a commit already named for the old id keeps that name", file=sys.stderr)
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
    top = max(highest(code, committed_texts(root) + list(tree.values())), history_top(root, code))
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
        if argv == ["claim"]:
            return cmd_claim(repo_root())
        if argv == ["check"]:
            return cmd_check(repo_root())
        if argv[:1] == ["renumber"] and len(argv) == 2:
            return cmd_renumber(repo_root(), argv[1])
        if argv[:1] == ["backfill"] and argv[1:] in ([], ["--write"]):
            return cmd_backfill(repo_root(), argv[1:] == ["--write"])
        print("ids: usage: ids.py next | claim | check | renumber <folder> | backfill [--write]", file=sys.stderr)
        return 2
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 1
    except (OSError, subprocess.SubprocessError) as e:
        print(f"ids: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
