#!/usr/bin/env python3
"""PreToolUse Bash hook - the constraint floor.

Before `git push` or `gh pr create`, reads the outgoing diff and names every move that
lowers the bar: a new suppression comment, a test made easier or deleted, unfinished
work, a loosened rule in CONSTRAINTS.md or a new exception there.

It works with or without a CONSTRAINTS.md. Mode follows mode.floor-guard, then mode, in
CLAUDE_GUARD_DIR or ~/.claude/hooks (default warn). Warn logs to warn.log, tells the user
and the model, and allows. Enforce denies with the findings and both ways to clear them:
fix the code, or put `floor-allow: <rule-id> <reason>` on a line of a commit message in
the range. A run that could not happen (no git, no merge base, a timeout) allows and says
the floor was not checked. It never says "clean" for a run that did not happen.

The same rules run from a shell:
  python3 floor-guard.py --check [--base <ref>] [--worktree]
Exit 0 clean, 1 findings, 2 could not run.

Read-only: it never edits the repo, makes no network calls and executes nothing taken
from the payload. It writes only to warn.log.
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
import shlex
import subprocess
import sys
import time

HOOK = "floor-guard"
RULES = (
    "silenced-checker", "test-made-easier", "test-deleted", "assertion-removed",
    "unfinished-work", "rule-loosened", "new-exception",
)
MAX_LINE = 120
MAX_UNTRACKED = 2_000_000
PUSH_RE = re.compile(r"\bgit\b.*\bpush\b|\bgh\b.*\bpr\b.*\bcreate\b", re.DOTALL)

# ---------------------------------------------------------------------------
# Mode lookup and warn.log writer.
# Copied from plugins/pro-ai-sdlc/scripts/guard.py (guard_dir, mode, log). Plugins
# install separately and cannot import each other (ADR-0003), so keep the two in step
# by hand.
# State lives in GUARD_DIR (default ~/.claude/hooks, override with CLAUDE_GUARD_DIR):
#   mode               warn or enforce for every hook (default warn)
#   mode.<hook-name>   per-hook override, same values
#   warn.log           one tab-separated line per flagged call
# ---------------------------------------------------------------------------


def guard_dir() -> str:
    return os.environ.get("CLAUDE_GUARD_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "hooks")


def mode(hook: str) -> str:
    d = guard_dir()
    for name in ("mode." + hook, "mode"):
        try:
            with open(os.path.join(d, name), encoding="utf-8") as fh:
                value = fh.readline().strip()
        except OSError:
            continue
        return "enforce" if value == "enforce" else "warn"
    return "warn"


def log(hook: str, action: str, detail: str, cwd: str) -> None:
    detail = detail.replace("\n", " ").replace("\t", " ")
    if len(detail) > 300:
        detail = detail[:300] + "..."
    try:
        os.makedirs(guard_dir(), exist_ok=True)
        with open(os.path.join(guard_dir(), "warn.log"), "a", encoding="utf-8") as fh:
            fh.write("\t".join([time.strftime("%Y-%m-%dT%H:%M:%S%z"), hook, action, detail, cwd]) + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------------------
# git
# ---------------------------------------------------------------------------


class CouldNotRun(Exception):
    pass


GIT_ENV = {**os.environ, "GIT_OPTIONAL_LOCKS": "0"}


def git(repo: str, *args: str) -> tuple[bool, str]:
    """Run git inside repo. Bounded, never raises, no shell, no index refresh."""
    try:
        r = subprocess.run(
            ["git", "-C", repo, "-c", "core.quotepath=off", *args],
            capture_output=True, text=True, timeout=10, errors="replace", env=GIT_ENV,
        )
        return r.returncode == 0, r.stdout
    except subprocess.TimeoutExpired:
        raise CouldNotRun("a git command timed out")
    except Exception:
        raise CouldNotRun("git could not be run")


# ---------------------------------------------------------------------------
# Command parsing, first written for the removed docs-before-push hook and extended to gh pr create.
# ---------------------------------------------------------------------------

HEREDOC_RE = re.compile(r"(?<!<)<<(?!<)-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
SHELLS = {"bash", "sh", "zsh", "dash"}
SHELL_C_RE = re.compile(r"^-[A-Za-z]*c[A-Za-z]*$")


def strip_heredocs(command: str) -> str:
    """Drop heredoc bodies: they are data (a commit message), not commands to follow."""
    out: list[str] = []
    pending: list[str] = []
    for line in command.split("\n"):
        if pending:
            if line.strip() == pending[0]:
                pending.pop(0)
            continue
        out.append(line)
        pending.extend(m.group(2) for m in HEREDOC_RE.finditer(line))
    return "\n".join(out)


def split_segments(command: str) -> list[str]:
    """Split on && || ; | and newlines that are outside quotes."""
    segments: list[str] = []
    buf: list[str] = []
    quote = ""
    i = 0
    n = len(command)
    while i < n:
        ch = command[i]
        if ch == "\\" and quote != "'" and i + 1 < n:
            buf.append(command[i : i + 2])
            i += 2
            continue
        if quote:
            if ch == quote:
                quote = ""
            buf.append(ch)
            i += 1
            continue
        if ch in "'\"":
            quote = ch
            buf.append(ch)
            i += 1
            continue
        if command.startswith(("&&", "||"), i):
            segments.append("".join(buf))
            buf = []
            i += 2
            continue
        if ch in ";|\n":
            segments.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    segments.append("".join(buf))
    return segments


def _tokens(segment: str) -> list[str]:
    try:
        return shlex.split(segment.strip().lstrip("("))
    except ValueError:
        return segment.split()


def _resolve(cur: str | None, path: str) -> str | None:
    """cur joined with path, or None when the path cannot be known statically."""
    if cur is None or any(c in path for c in "$`*?"):
        return None
    return os.path.abspath(os.path.join(cur, os.path.expanduser(path)))


def skip_wrappers(toks: list[str]) -> int:
    """Index of the real command after VAR=val, env, command and timeout N."""
    i = 0
    while i < len(toks):
        t = toks[i]
        if "=" in t and not t.startswith(("-", "=")):
            i += 1
        elif t == "env":
            i += 1
            while i < len(toks) and (toks[i].startswith("-") or "=" in toks[i]):
                i += 2 if toks[i] in ("-u", "-S") else 1
        elif t == "command":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 1
        elif t == "timeout":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] in ("-k", "-s") else 1
            i += 1  # the duration
        else:
            break
    return i


def push_spec(args: list[str]):
    """What a `git push` sends: None (the current branch), ("ref", name) or ("skip", why)."""
    pos: list[str] = []
    i = 0
    while i < len(args):
        t = args[i]
        if t in ("--all", "--branches", "--mirror", "--tags", "--prune", "--delete", "-d", "--follow-tags"):
            return ("skip", f"git push {t} sends refs the guard cannot resolve")
        if t in ("--repo", "--receive-pack", "--exec", "-o", "--push-option", "--signed"):
            i += 2
            continue
        if t.startswith("-"):
            i += 1
            continue
        pos.append(t)
        i += 1
    if len(pos) <= 1:
        return None
    if len(pos) > 2:
        return ("skip", "git push names several refspecs")
    src = pos[1].lstrip("+").split(":")[0]
    if not src or src == "HEAD":
        return None if src == "HEAD" else ("skip", "the push deletes a remote ref")
    if src.startswith("refs/tags/") or "*" in src:
        return ("skip", f"the pushed ref {src} cannot be resolved")
    return ("ref", src)


def actions(command: str, base: str | None) -> list[tuple[str, str | None, tuple | None]]:
    """(kind, directory, push spec) for each git push or gh pr create in the command.

    kind is "push" or "pr". The directory follows `cd <path>`, `git -C <path>` and the
    wrappers env, command, timeout and bash/sh -c. A target that cannot be resolved (a
    variable, pushd) comes back as None: the guard cannot know which repo is meant.
    Dry runs are skipped. Text inside quotes, echo and heredoc bodies never matches.
    """
    cur = base
    found: list[tuple[str, str | None, tuple | None]] = []
    for segment in split_segments(strip_heredocs(command)):
        toks = _tokens(segment)
        if not toks:
            continue
        if toks[0] == "cd":
            cur = _resolve(cur, toks[1]) if len(toks) > 1 and toks[1] != "-" else cur
            continue
        if toks[0] in ("pushd", "popd"):
            cur = None
            continue
        i = skip_wrappers(toks)
        if i >= len(toks):
            continue
        name = os.path.basename(toks[i])
        if name in SHELLS:
            for j in range(i + 1, len(toks) - 1):
                if SHELL_C_RE.match(toks[j]):
                    found.extend(actions(toks[j + 1], cur))
                    break
            continue
        if name == "gh":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] in ("-R", "--repo") else 1
            if i + 1 < len(toks) and toks[i] == "pr" and toks[i + 1] == "create":
                found.append(("pr", cur, None))
            continue
        if name != "git":
            continue
        i += 1
        where = cur
        while i < len(toks) and toks[i].startswith("-"):
            if toks[i] == "-C" and i + 1 < len(toks):
                where = _resolve(where, toks[i + 1])
                i += 2
            elif toks[i] in ("-c", "--exec-path", "--git-dir", "--work-tree", "--namespace"):
                i += 2
            else:
                i += 1
        if i < len(toks) and toks[i] == "push":
            if any(t in ("--dry-run", "-n") for t in toks[i + 1 :]):
                continue
            found.append(("push", where, push_spec(toks[i + 1 :])))
    return found


# ---------------------------------------------------------------------------
# Range
# ---------------------------------------------------------------------------


def resolves(repo: str, ref: str) -> bool:
    return git(repo, "rev-parse", "--verify", "--quiet", ref + "^{commit}")[0]


def merge_base(repo: str, kind: str, override: str | None, tip: str = "HEAD") -> str:
    """Merge base of HEAD with the comparison ref.

    push: upstream, then origin/HEAD, origin/main, main, origin/master, master.
    pr (and --check): origin/HEAD, origin/main, main, origin/master, master, never the upstream, so a branch
    that was already pushed still has its PR diff judged.
    """
    if override:
        candidates = [override]
    else:
        candidates = [tip + "@{u}" if tip != "HEAD" else "@{u}"] if kind == "push" else []
        candidates += ["origin/HEAD", "origin/main", "main", "origin/master", "master"]
    for ref in candidates:
        if resolves(repo, ref):
            ok, out = git(repo, "merge-base", tip, ref)
            if ok and out.strip():
                return out.strip()
            raise CouldNotRun(f"no merge base between {tip} and {ref}")
    raise CouldNotRun("no base branch found to compare against")


# ---------------------------------------------------------------------------
# Diff parsing
# ---------------------------------------------------------------------------

HUNK_RE = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


def _clean_path(p: str, prefix: str) -> str | None:
    p = p.rstrip("\t")
    if p == "/dev/null":
        return None
    if len(p) >= 2 and p[0] == '"' and p[-1] == '"':
        p = p[1:-1]
    return p[2:] if p.startswith(prefix) else p


def parse_diff(text: str) -> list[dict]:
    """Files with their added and removed lines from `git diff -U0`. One pass."""
    files: list[dict] = []
    cur: dict | None = None
    in_header = False
    old_ln = new_ln = 0
    for line in text.split("\n"):
        if line.startswith("diff --git "):
            h = line[11:]
            half = (len(h) - 1) // 2
            path = h[2:half] if len(h) % 2 == 1 and h[:half].startswith("a/") else h.split(" b/")[-1]
            cur = {"path": path, "old": path, "deleted": False, "new": False, "added": [], "removed": []}
            files.append(cur)
            in_header = True
            continue
        if cur is None:
            continue
        if in_header:
            if line.startswith("deleted file mode"):
                cur["deleted"] = True
            elif line.startswith("new file mode"):
                cur["new"] = True
            elif line.startswith("rename from "):
                cur["old"] = line[12:]
            elif line.startswith("rename to "):
                cur["path"] = line[10:]
            elif line.startswith("--- "):
                p = _clean_path(line[4:], "a/")
                if p:
                    cur["old"] = p
            elif line.startswith("+++ "):
                p = _clean_path(line[4:], "b/")
                if p:
                    cur["path"] = p
            if not line.startswith("@@"):
                continue
            in_header = False
        m = HUNK_RE.match(line)
        if m:
            old_ln, new_ln = int(m.group(1)), int(m.group(3))
            continue
        if line.startswith("+"):
            cur["added"].append((new_ln, line[1:]))
            new_ln += 1
        elif line.startswith("-"):
            cur["removed"].append((old_ln, line[1:]))
            old_ln += 1
    return files


def untracked_files(repo: str) -> list[dict]:
    ok, out = git(repo, "ls-files", "--others", "--exclude-standard", "-z")
    files: list[dict] = []
    if not ok:
        return files
    for rel in filter(None, out.split("\0")):
        full = os.path.join(repo, rel)
        try:
            if os.path.islink(full) or os.path.getsize(full) > MAX_UNTRACKED:
                continue
            with open(full, "rb") as fh:
                data = fh.read()
        except OSError:
            continue
        if b"\0" in data:
            continue
        lines = data.decode("utf-8", errors="replace").split("\n")
        if lines and lines[-1] == "":
            lines.pop()
        files.append({"path": rel, "old": rel, "deleted": False, "new": True,
                      "added": list(enumerate(lines, 1)), "removed": []})
    return files


# ---------------------------------------------------------------------------
# Redaction and formatting
# ---------------------------------------------------------------------------

SECRET_RE = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----"
    r"|\bsk-ant-[A-Za-z0-9_\-]*"
    r"|\bgithub_pat_[A-Za-z0-9_]*"
    r"|\bgh[pousr]_[A-Za-z0-9]*"
    r"|\bA[KS]IA[A-Z0-9]*"
    r"|\bxox[bpa]-[A-Za-z0-9\-]*"
    r"|\bxapp-[A-Za-z0-9\-]*"
)


def show(text: str) -> str:
    """Redact credentials first, then trim, so a cut token never leaks."""
    text = SECRET_RE.sub("[redacted]", text.replace("\t", " ").strip())
    return text[:MAX_LINE]


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

SILENCED_RE = re.compile(
    r"@ts-ignore|@ts-nocheck|eslint-disable|biome-ignore|#\s*noqa|#\s*type:\s*ignore"
    r"|#\s*pyright:\s*ignore|istanbul ignore|c8 ignore|nosemgrep|gitleaks:allow|Stryker disable"
)
SKIP_RE = re.compile(
    r"\.skip\(|\.todo\(|\bxit\(|\bxdescribe\(|@pytest\.mark\.skip|\bpytest\.skip\(|\bt\.Skip\("
)
STUB_RE = re.compile(
    r"throw new \w*Error\([^)\n]*not implemented|raise NotImplementedError|\btodo!\(\)|\bunimplemented!\(\)"
    r"|\bcatch\s*(?:\(\s*\w*\s*\))?\s*\{\s*\}|\bexcept\s*:\s*pass\b",
    re.IGNORECASE,
)
MAX_SCAN = 2000
ASSERT_RE = re.compile(r"\b(?:expect|assert|should)")
TEST_DIRS = {"tests", "test", "__tests__"}
TEST_NAMES = ("*.test.*", "*.spec.*", "*_test.*", "test_*.py")


def glob_re(g: str) -> re.Pattern:
    out = ""
    i = 0
    while i < len(g):
        if g.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
        elif g.startswith("**", i):
            out += ".*"
            i += 2
        elif g[i] == "*":
            out += "[^/]*"
            i += 1
        elif g[i] == "?":
            out += "[^/]"
            i += 1
        else:
            out += re.escape(g[i])
            i += 1
    return re.compile("^" + out + "$")


def make_is_test(extra_globs: list[str]):
    extras = [(glob_re(g), "/" in g) for g in extra_globs]

    def is_test(path: str) -> bool:
        parts = path.split("/")
        base = parts[-1]
        if any(d in TEST_DIRS for d in parts[:-1]):
            return True
        if any(fnmatch.fnmatchcase(base, p) for p in TEST_NAMES):
            return True
        for rx, has_slash in extras:
            if rx.match(path) or (not has_slash and rx.match(base)):
                return True
        return False

    return is_test


def is_constraints(path: str) -> bool:
    # Only the file at the repo root is the bar; a copy elsewhere (a template) is not.
    return path == "CONSTRAINTS.md"


# CONSTRAINTS.md parsing ----------------------------------------------------

HEADING_RE = re.compile(r"^#{1,6}\s+(.*?)\s*$")
BULLET_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+(.*\S)\s*$")
SEP_CELL_RE = re.compile(r"^:?-{2,}:?$|^:?-+:?$")
HEADER_FIRST = {"dimension", "id", "metric"}


def _section(title: str) -> str:
    t = title.strip().lower()
    for key in ("floor", "enforced", "measured", "exceptions"):
        if t.startswith(key):
            return key
    return "other"


def _cells(line: str) -> list[str]:
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def parse_constraints(text: str) -> dict:
    """{section: [(line, key, rule_text, row_text)]} for Floor, Enforced and Exceptions."""
    out: dict[str, list] = {"floor": [], "enforced": [], "exceptions": []}
    section = "other"
    for ln, line in enumerate(text.split("\n"), 1):
        h = HEADING_RE.match(line)
        if h and line.lstrip().startswith("##"):
            section = _section(h.group(1))
            continue
        if section == "floor":
            b = BULLET_RE.match(line)
            if b:
                body = b.group(1)
                out["floor"].append((ln, body.split(":")[0].strip().lower(), body, body))
        elif section in ("enforced", "exceptions") and line.lstrip().startswith("|"):
            cells = _cells(line)
            if not cells or all(SEP_CELL_RE.match(c) or not c for c in cells):
                continue
            if cells[0].lower() in HEADER_FIRST:
                continue
            if not any(re.search(r"[A-Za-z0-9]", c) for c in cells):
                continue
            rule_text = cells[1] if len(cells) > 1 else cells[0]
            out[section].append((ln, cells[0].lower(), rule_text, " | ".join(cells)))
    return out


def test_globs(text: str) -> list[str]:
    m = re.search(r"^\s*Test files:\s*(.+?)\s*$", text, re.MULTILINE)
    if not m:
        return []
    return [g.strip().strip("`") for g in m.group(1).split(",") if g.strip().strip("`")]


MIN_BEFORE = re.compile(r"(>=|>|≥|at least|minimum|\bmin\b|no less than|not fall|not drop)\s*$")
MAX_BEFORE = re.compile(r"(<=|<|≤|at most|maximum|\bmax\b|no more than|under|below|not grow|not exceed)\s*$")
MIN_AFTER = re.compile(r"^\s*\S*\s*(?:\|\s*)?(or more|or higher|must not fall|must not drop)")
MAX_AFTER = re.compile(r"^\s*\S*\s*(?:\|\s*)?(or less|or lower|must not grow|must not exceed)")


def thresholds(text: str) -> list[tuple[float, str | None]]:
    out = []
    for m in re.finditer(r"\d+(?:\.\d+)?", text):
        before = text[max(0, m.start() - 24) : m.start()].lower()
        after = text[m.end() : m.end() + 40].lower()
        if MIN_BEFORE.search(before) or MIN_AFTER.search(after):
            d = "min"
        elif MAX_BEFORE.search(before) or MAX_AFTER.search(after):
            d = "max"
        else:
            d = None
        out.append((float(m.group(0)), d))
    return out


def loosened(old_text: str, new_text: str) -> bool:
    """True when a threshold moved the loosening way or disappeared.

    A minimum loosens downward, a maximum upward. A number whose direction cannot be
    read is reported on any change. Numbers pair by position within their direction.
    A number with no partner left is only forgiven when the new text carries a number
    of the same value that no pair used (it gained or lost direction words).
    """
    before, after = thresholds(old_text), thresholds(new_text)
    spare: list[float] = []
    unmatched: list[float] = []
    for d in ("min", "max", None):
        was = [v for v, x in before if x == d]
        now = [v for v, x in after if x == d]
        for i, b in enumerate(was):
            if i >= len(now):
                unmatched.append(b)
                continue
            n = now[i]
            if n == b:
                continue
            if d == "min" and n > b:
                continue
            if d == "max" and n < b:
                continue
            return True
        spare += now[len(was) :]
    for b in unmatched:
        if b in spare:
            spare.remove(b)
        else:
            return True
    return False


def _group(rows: list) -> dict:
    out: dict = {}
    for r in rows:
        out.setdefault(r[1], []).append(r)
    return out


def _digitless(text: str) -> str:
    return re.sub(r"\d+(?:\.\d+)?", "#", text.lower())


def _pair(old_rows: list, new_rows: list) -> list[tuple]:
    """Pair rows that share a key: same number-stripped text first, then in order."""
    left = list(new_rows)
    paired: list[tuple] = []
    rest = []
    for o in old_rows:
        hit = next((n for n in left if _digitless(n[2]) == _digitless(o[2])), None)
        if hit is not None:
            left.remove(hit)
            paired.append((o, hit))
        else:
            rest.append(o)
    for o in rest:
        paired.append((o, left.pop(0) if left else None))
    return paired


def constraints_findings(path: str, old: str, new: str) -> list[tuple]:
    """rule-loosened and new-exception findings for one CONSTRAINTS.md."""
    found: list[tuple] = []
    o, n = parse_constraints(old), parse_constraints(new)
    for sec in ("floor", "enforced"):
        new_groups = _group(n[sec])
        for key, old_rows in _group(o[sec]).items():
            for (ln, _, rule, row), hit in _pair(old_rows, new_groups.get(key, [])):
                if hit is None:
                    found.append(("rule-loosened", path, ln, f"removed: {row}"))
                elif sec == "enforced" and loosened(rule, hit[2]):
                    found.append(("rule-loosened", path, hit[0], f"{row}  ->  {hit[3]}"))
    gone = [g for g in test_globs(old) if g not in test_globs(new)]
    if gone:
        at = next((i for i, t in enumerate(old.split("\n"), 1) if re.match(r"\s*Test files:", t)), 1)
        found.append(("rule-loosened", path, at, f"removed from the Test files line: {', '.join(gone)}"))
    old_rows = {row.lower() for _, _, _, row in o["exceptions"]}
    for ln, key, rule, row in n["exceptions"]:
        if row.lower() not in old_rows:
            found.append(("new-exception", path, ln, row))
    return found


# Diff rules -----------------------------------------------------------------


def diff_findings(files: list[dict], is_test) -> list[tuple]:
    found: list[tuple] = []
    for f in files:
        path = f["path"]
        md = path.endswith(".md")
        test = is_test(path)
        if f["deleted"]:
            if is_test(f["old"]):
                found.append(("test-deleted", f["old"], 0, "file deleted"))
            continue
        if f["old"] != path and is_test(f["old"]) and not test:
            found.append(("test-deleted", f["old"], 0, f"renamed to {path}, which is not a test path"))
        for ln, text in f["added"]:
            if md:
                continue
            text = text[:MAX_SCAN]  # a minified line is not worth scanning past its head
            if SILENCED_RE.search(text):
                found.append(("silenced-checker", path, ln, text))
            if test and SKIP_RE.search(text):
                found.append(("test-made-easier", path, ln, text))
            if STUB_RE.search(text):
                found.append(("unfinished-work", path, ln, text))
        if test and not f["new"]:
            gone = [(ln, t) for ln, t in f["removed"] if ASSERT_RE.search(t)]
            came = sum(1 for _, t in f["added"] if ASSERT_RE.search(t))
            if len(gone) > came:
                ln, t = gone[0]
                found.append(("assertion-removed", path, ln, f"(net -{len(gone) - came}) {t.strip()}"))
    return found


# ---------------------------------------------------------------------------
# One run
# ---------------------------------------------------------------------------

ALLOW_RE = re.compile(r"^[ \t]*floor-allow:[ \t]+([a-z][a-z-]*)[ \t]+(\S.*?)[ \t]*$", re.MULTILINE)


def analyze(repo: str, kind: str, override: str | None = None, worktree: bool = False, tip: str = "HEAD"):
    """(findings, allowances). findings: (rule, file, line, text). Raises CouldNotRun."""
    ok, top = git(repo, "rev-parse", "--show-toplevel")
    if not ok or not top.strip():
        raise CouldNotRun("not inside a git repository")
    top = top.strip()
    if tip != "HEAD" and not resolves(top, tip):
        raise CouldNotRun(f"the pushed ref {tip} could not be resolved")
    mb = merge_base(top, kind, override, tip)
    ok, diff = git(top, "diff", "-U0", "--no-color", mb if worktree else f"{mb}..{tip}", "--")
    if not ok:
        raise CouldNotRun("could not read the diff")
    files = parse_diff(diff)
    if worktree:
        files += untracked_files(top)

    def read_new(path: str) -> str:
        if worktree:
            try:
                with open(os.path.join(top, path), encoding="utf-8", errors="replace") as fh:
                    return fh.read()
            except OSError:
                return ""
        ok2, out = git(top, "show", f"{tip}:{path}")
        return out if ok2 else ""

    cons = [f for f in files if is_constraints(f["path"]) or is_constraints(f["old"])]
    globs = test_globs(read_new("CONSTRAINTS.md")) if (cons or os.path.exists(os.path.join(top, "CONSTRAINTS.md"))) else []
    ok2, old_c = git(top, "show", f"{mb}:CONSTRAINTS.md")
    if ok2:  # the old globs count too, so one commit cannot drop a glob and delete its tests
        globs += [g for g in test_globs(old_c) if g not in globs]
    is_test = make_is_test(globs)
    findings = diff_findings(files, is_test)
    for f in cons:
        old = ""
        if not f["new"]:
            ok2, out = git(top, "show", f"{mb}:{f['old']}")
            old = out if ok2 else ""
        new = "" if f["deleted"] else read_new(f["path"])
        findings.extend(constraints_findings(f["path"], old, new))

    allowances: dict[str, str] = {}
    ok, msgs = git(top, "log", "--format=%B%x00", f"{mb}..{tip}")
    if ok:
        for rule, reason in ALLOW_RE.findall(msgs):
            if rule in RULES and reason.strip():
                allowances.setdefault(rule, reason.strip())
    kept = []
    cleared: dict[str, int] = {}
    for fnd in findings:
        if fnd[0] in allowances:
            cleared[fnd[0]] = cleared.get(fnd[0], 0) + 1
        else:
            kept.append((fnd[0], fnd[1], fnd[2], show(fnd[3])))
    return kept, [(r, allowances[r], c) for r, c in cleared.items()]


def render(findings, allowances) -> str:
    lines = [f"  {rule}  {file}:{line}  {text}" for rule, file, line, text in findings]
    for rule, reason, count in allowances:
        lines.append(f"  floor-allow  {rule}  ({count} finding{'s' if count != 1 else ''} allowed)  {show(reason)}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Hook
# ---------------------------------------------------------------------------


def emit(event_extra: dict, message: str, context: bool = True) -> None:
    out: dict = {"systemMessage": message}
    hso = {"hookEventName": "PreToolUse", **event_extra}
    if context:
        hso["additionalContext"] = message
    out["hookSpecificOutput"] = hso
    print(json.dumps(out))


def main_hook() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else None
    except Exception:
        payload = None
    if not isinstance(payload, dict):
        log(HOOK, "parse-error", "empty or invalid payload", os.getcwd())
        return 0
    tool_input = payload.get("tool_input")
    command = tool_input.get("command") if isinstance(tool_input, dict) else None
    tool = payload.get("tool_name")
    if not isinstance(command, str) or (tool not in (None, "Bash")) or not PUSH_RE.search(command):
        return 0
    cwd = payload.get("cwd")
    base = cwd if isinstance(cwd, str) and cwd else os.getcwd()
    targets = list(dict.fromkeys(actions(command, base)))
    if not targets:
        return 0

    findings: list = []
    allowances: list = []
    problems: list[str] = []
    for kind, repo, spec in targets:
        if repo is None:
            problems.append("the target repository could not be worked out from the command")
            continue
        if spec and spec[0] == "skip":
            problems.append(f"{spec[1]}, so the floor was not checked for it")
            continue
        try:
            f, a = analyze(repo, kind, tip=spec[1] if spec else "HEAD")
        except CouldNotRun as e:
            problems.append(str(e))
            continue
        findings += [x for x in f if x not in findings]
        allowances += a

    if problems and not findings:
        why = "; ".join(dict.fromkeys(problems))
        log(HOOK, "could-not-run", why, base)
        msg = f"[{HOOK}] could not check the floor: {why}. The outgoing diff was not checked (allowed)."
        emit({}, msg)
        return 0
    if not findings and not allowances:
        return 0

    body = render(findings, allowances)
    note = ""
    if problems:
        note = f"\nPart of this command was not checked: {'; '.join(dict.fromkeys(problems))}."
    if not findings:
        emit({}, f"[{HOOK}] floor findings allowed by floor-allow lines in the commit messages:\n{body}{note}", context=False)
        return 0

    n = len(findings)
    plural = "s" if n != 1 else ""
    detail = "; ".join(f"{r} {f}:{ln}" for r, f, ln, _ in findings)
    if mode(HOOK) == "enforce":
        log(HOOK, "deny", detail, base)
        reason = (
            f"[{HOOK}] enforce mode: {n} floor finding{plural} in the outgoing diff, so this command was denied.\n{body}{note}\n"
            'To clear them, fix the code, or add a line "floor-allow: <rule-id> <reason>" to a commit message '
            "in the range and run the command again."
        )
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}))
        return 0
    log(HOOK, "would-deny", detail, base)
    emit({}, (
        f"[{HOOK}] warn mode: {n} floor finding{plural} in the outgoing diff (allowed, logged to warn.log)\n{body}{note}\n"
        'Fix it, or add "floor-allow: <rule-id> <reason>" to a commit message.'
    ))
    return 0


# ---------------------------------------------------------------------------
# --check
# ---------------------------------------------------------------------------


def main_check(argv: list[str]) -> int:
    override = None
    if "--base" in argv:
        i = argv.index("--base")
        if i + 1 >= len(argv):
            print("floor-guard: --base needs a ref", file=sys.stderr)
            return 2
        override = argv[i + 1]
    try:
        findings, allowances = analyze(os.getcwd(), "pr", override, "--worktree" in argv)
    except CouldNotRun as e:
        print(f"floor-guard: could not check the floor: {e}. Nothing was checked.", file=sys.stderr)
        return 2
    if findings:
        print(f"floor-guard: {len(findings)} floor finding{'s' if len(findings) != 1 else ''}")
        print(render(findings, allowances))
        return 1
    print("floor-guard: clean" + (f"\n{render([], allowances)}" if allowances else ""))
    return 0


def main() -> int:
    if "--check" in sys.argv[1:]:
        return main_check(sys.argv[1:])
    try:
        return main_hook()
    except Exception as e:  # never crash the turn
        log(HOOK, "could-not-run", f"internal error: {e}", os.getcwd())
        print(json.dumps({"systemMessage": f"[{HOOK}] could not check the floor: internal error. The outgoing diff was not checked (allowed)."}))
        return 0


if __name__ == "__main__":
    sys.exit(main())
