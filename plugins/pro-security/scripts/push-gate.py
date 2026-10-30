#!/usr/bin/env python3
"""PreToolUse Bash hook - run a security diff review before a push / PR creation.

Detects `git push` and `gh pr create` in a Bash command, computes the diff that
would leave the machine (`git diff <upstream>...HEAD`), and if it touches security
surface denies once per distinct diff per session, asking Claude to dispatch the
security-architect subagent in diff mode on that diff and nothing else. The
identical retry passes. A valid, fresh, passing pr-check stamp whose security
review ran (docs/pr-check-stamp.md) passes with no output instead. `git commit` is never gated, `git push --dry-run` is not
gated and Markdown-only changes never trigger (see security_surface.diff_files).
Fails open on any error.
"""
from __future__ import annotations

import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import security_surface as ss  # noqa: E402

OPS = {"&&", "||", ";", "|", "\n", "&"}
BASE_REFS = ("origin/HEAD", "origin/main", "main")


def tokenize(cmd: str) -> list[list[str]]:
    """Split a shell command into segments of tokens, respecting quotes."""
    segs: list[list[str]] = [[]]
    buf: list[str] = []
    has = False
    quote = ""
    i, n = 0, len(cmd)

    def flush() -> None:
        nonlocal buf, has
        if has:
            segs[-1].append("".join(buf))
        buf, has = [], False

    while i < n:
        c = cmd[i]
        if quote:
            if c == quote:
                quote = ""
            elif c == "\\" and quote == '"' and i + 1 < n:
                i += 1
                buf.append(cmd[i])
            else:
                buf.append(c)
        elif c in "'\"":
            quote, has = c, True
        elif c == "\\" and i + 1 < n:
            i += 1
            if cmd[i] != "\n":
                buf.append(cmd[i])
                has = True
        elif c in " \t\r":
            flush()
        elif c in "\n;|&":
            flush()
            op = c
            if c in "|&" and i + 1 < n and cmd[i + 1] == c:
                op = c + c
                i += 1
            if segs[-1]:
                segs.append([])
        else:
            buf.append(c)
            has = True
        i += 1
    flush()
    return [s for s in segs if s]


def classify(tokens: list[str]) -> dict | None:
    """Return {"kind": "push"|"pr", "dir": str|None, "dry_run": bool} or None."""
    t = list(tokens)
    while t and "=" in t[0] and t[0].split("=", 1)[0].replace("_", "").isalnum():
        t.pop(0)
    if not t:
        return None
    if t[0] == "gh":
        return {"kind": "pr", "dir": None, "dry_run": False} if t[1:3] == ["pr", "create"] else None
    if t[0] != "git":
        return None
    i, gdir = 1, None
    while i < len(t) and t[i].startswith("-"):
        if t[i] == "-C" and i + 1 < len(t):
            gdir = t[i + 1]
            i += 2
        elif t[i] in ("-c", "--git-dir", "--work-tree", "--namespace") and i + 1 < len(t):
            i += 2
        else:
            i += 1
    if i >= len(t) or t[i] != "push":
        return None
    dry_run = any(tok == "--dry-run" or (tok.startswith("-") and not tok.startswith("--") and "n" in tok[1:])
                  for tok in t[i + 1:])
    return {"kind": "push", "dir": gdir, "dry_run": dry_run}


def resolve_base(root: str, use_upstream: bool) -> str | None:
    """The ref the diff is taken against: @{upstream} when asked for and set, else the first BASE_REFS hit."""
    if use_upstream:
        ok, out = ss.run_git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], root)
        if ok and out.strip():
            return out.strip()
    for ref in BASE_REFS:
        if ss.run_git(["rev-parse", "--verify", "--quiet", ref + "^{commit}"], root)[0]:
            return ref
    return None


def main() -> int:
    payload = ss.read_payload()
    if payload is None:
        return 0
    tool_input = payload.get("tool_input")
    cmd = tool_input.get("command") if isinstance(tool_input, dict) else None
    if not isinstance(cmd, str) or not cmd.strip():
        return 0
    if "push" not in cmd and "pr" not in cmd:
        return 0
    op = None
    for seg in tokenize(cmd):
        op = classify(seg)
        if op:
            break
    if not op or op["dry_run"]:
        return 0

    cwd = payload.get("cwd") or os.getcwd()
    if op["dir"]:
        cwd = os.path.normpath(os.path.join(cwd, os.path.expanduser(op["dir"])))
    if not os.path.isdir(cwd):
        return 0
    ok, top = ss.run_git(["rev-parse", "--show-toplevel"], cwd)
    if not ok or not top.strip():
        return 0
    root = top.strip()

    base = resolve_base(root, op["kind"] == "push")
    if not base:
        return 0
    gargs = ["diff", f"{base}...HEAD"]
    what = "push" if op["kind"] == "push" else "PR"
    ok, diff = ss.run_git(["--no-pager", *gargs, "--no-color", "--no-ext-diff"], root)
    if not ok or not diff.strip():
        return 0
    files = ss.diff_files(diff)
    if not files:
        return 0
    ok, head = ss.run_git(["rev-parse", "HEAD"], root)
    stamp = ss.read_stamp(root, head.strip()) if ok and head.strip() else None
    # This push touches security surface by this gate's own classifier, so a stamp that says
    # skipped-no-surface does not count; only a review that ran (status done) does.
    sec = ((stamp or {}).get("reviewers") or {}).get("security")
    if ss.security_review_done(stamp) and isinstance(sec, dict) and sec.get("status") == "done":
        return 0
    cats = sorted(files)
    h = hashlib.sha256(diff.encode("utf-8", "replace")).hexdigest()
    sp, state = ss.session_state(payload)
    gated = state.get("gated_diffs")
    gated = gated if isinstance(gated, list) else []
    if h in gated:
        return 0
    gated.append(h)
    state["gated_diffs"] = gated[-200:]
    ss.save_state(sp, state)
    paths = sorted({p for ps in files.values() for p in ps})
    shown = ", ".join(paths[:5]) + (f" (+{len(paths) - 5} more)" if len(paths) > 5 else "")
    repro = "git -C {} {}".format(root, " ".join(gargs))
    ss.deny_pretool(
        f"This {what} touches security surface: {', '.join(cats)} in {shown}. "
        f"{ss.AGENT_HINT} in diff mode on this diff and nothing else (reproduce it with `{repro}`). "
        "Fix Blocking findings, or tell the user what you are knowingly shipping, then retry the same command."
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
