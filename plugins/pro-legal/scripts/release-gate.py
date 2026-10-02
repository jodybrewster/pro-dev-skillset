#!/usr/bin/env python3
"""PreToolUse Bash hook - run a software-counsel release review before something ships.

Detects shipping events in a Bash command, computes the diff that would ship and,
if it touches legal surface, denies once per distinct diff per session and asks
Claude to dispatch software-counsel in release mode. The identical retry passes.

Kinds:
  tag          git tag <name> (creating), base = last reachable tag or the empty tree
  release      gh release create, same base
  publish      npm/pnpm/yarn/bun/cargo/uv/poetry publish, twine upload, gem push, same base
  deploy       vercel --prod, netlify deploy --prod, fly deploy, firebase deploy, same base
  pr           gh pr create, diff <base>...HEAD
  commit-deps  git commit, gated only when the staged diff hits dependency-license
               or oss-licensing (LICENSE/NOTICE change, vendored GPL header)

tag, release and publish also run local release hygiene: no LICENSE or COPYING
file at the repo root, or a package.json with no license field, denies even
when the diff itself is clean. Doc-only changes never trigger (see
legal_surface.diff_files). Fails open on any error.
"""
from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import legal_surface as ls  # noqa: E402

MAX_DIFF_BYTES = 8 * 1024 * 1024
GIT_TIMEOUT = 8
OPS = {"&&", "||", ";", "|", "\n", "&"}
VALUE_FLAGS = {"-m", "-F", "-C", "-c", "-t", "--message", "--file", "--author", "--date",
               "--reuse-message", "--reedit-message", "--template", "--cleanup", "--fixup", "--squash"}
VALUE_LETTERS = "mFCct"
TAG_VALUE_FLAGS = {"-m", "-F", "-u", "--message", "--file", "--local-user", "--cleanup", "--sort", "--format",
                   "--points-at", "--contains", "--no-contains", "--merged", "--no-merged"}
TAG_LIST_LONG = {"--list", "--delete", "--verify", "--contains", "--no-contains", "--points-at",
                 "--merged", "--no-merged"}
TAG_LIST_LETTERS = "ldvn"
TAG_VALUE_LETTERS = "mFu"
RUNNERS = {"npx", "bunx", "pnpx", "sudo", "time", "command", "exec"}
HYGIENE_KINDS = {"tag", "release", "publish"}
COMMIT_DEPS_CATS = {"dependency-license", "oss-licensing"}
SIGNALS = ("tag", "release", "publish", "upload", "gem", "deploy", "vercel", "commit", "pr create")


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


def _git_args(t: list[str], start: int) -> tuple[int, str | None]:
    """Skip git's global options from index `start`; return (index of subcommand, -C dir)."""
    i, gdir = start, None
    while i < len(t) and t[i].startswith("-"):
        if t[i] == "-C" and i + 1 < len(t):
            gdir = t[i + 1]
            i += 2
        elif t[i] in ("-c", "--git-dir", "--work-tree", "--namespace") and i + 1 < len(t):
            i += 2
        else:
            i += 1
    return i, gdir


def _is_tag_create(rest: list[str]) -> bool:
    """True for `git tag <name>` forms that create a tag; False for list/delete/verify."""
    skip = False
    positional = 0
    for tok in rest:
        if skip:
            skip = False
            continue
        if tok in TAG_LIST_LONG or any(tok.startswith(f + "=") for f in TAG_LIST_LONG):
            return False
        if tok in TAG_VALUE_FLAGS:
            skip = True
        elif tok.startswith("--"):
            continue
        elif tok.startswith("-") and len(tok) > 1 and tok[1:].isalpha():
            letters = tok[1:]
            if any(ch in TAG_LIST_LETTERS for ch in letters):
                return False
            skip = letters[-1] in TAG_VALUE_LETTERS
        elif tok.startswith("-n") or tok.startswith("-l"):
            return False
        elif tok.startswith("-"):
            continue
        else:
            positional += 1
    return positional >= 1


def classify(tokens: list[str]) -> dict | None:
    """Return {"kind": str, "dir": str|None, "all": bool} for a shipping event, or None."""
    t = list(tokens)
    while t and "=" in t[0] and t[0].split("=", 1)[0].replace("_", "").isalnum():
        t.pop(0)
    while t and t[0] in RUNNERS:
        t.pop(0)
        while t and t[0].startswith("-"):
            t.pop(0)
    if t[:2] == ["pnpm", "dlx"]:
        t = t[2:]
        while t and t[0].startswith("-"):
            t.pop(0)
    if not t:
        return None
    ev = {"dir": None, "all": False}
    bin_ = os.path.basename(t[0])
    if bin_ == "gh":
        if t[1:3] == ["pr", "create"]:
            return {**ev, "kind": "pr"}
        if t[1:3] == ["release", "create"]:
            return {**ev, "kind": "release"}
        return None
    if bin_ == "git":
        i, gdir = _git_args(t, 1)
        if i >= len(t):
            return None
        sub = t[i]
        if sub == "tag":
            return {**ev, "kind": "tag", "dir": gdir} if _is_tag_create(t[i + 1:]) else None
        if sub != "commit":
            return None
        all_flag, skip = False, False
        for tok in t[i + 1:]:
            if skip:
                skip = False
                continue
            if tok == "--all":
                all_flag = True
            elif tok in VALUE_FLAGS:
                skip = True
            elif tok.startswith("--"):
                continue
            elif tok.startswith("-") and len(tok) > 1 and tok[1:].isalpha():
                for ch in tok[1:]:
                    if ch == "a":
                        all_flag = True
                    if ch in VALUE_LETTERS:
                        skip = tok.endswith(ch)
                        break
        return {"kind": "commit-deps", "dir": gdir, "all": all_flag}
    pos = [x for x in t[1:] if not x.startswith("-")]
    if bin_ in ("npm", "pnpm", "yarn", "bun"):
        if pos[:1] == ["publish"] or (bin_ == "yarn" and pos[:2] == ["npm", "publish"]):
            return {**ev, "kind": "publish"}
        return None
    if bin_ in ("cargo", "uv", "poetry") and pos[:1] == ["publish"]:
        return {**ev, "kind": "publish"}
    if bin_ == "gem" and pos[:1] == ["push"]:
        return {**ev, "kind": "publish"}
    if bin_ == "twine" and pos[:1] == ["upload"]:
        return {**ev, "kind": "publish"}
    if bin_.startswith("python") and t[1:3] == ["-m", "twine"] and "upload" in t[3:]:
        return {**ev, "kind": "publish"}
    if bin_ == "vercel" and ("--prod" in t or "--production" in t) and pos[:1] in ([], ["deploy"]):
        return {**ev, "kind": "deploy"}
    if bin_ == "netlify" and pos[:1] == ["deploy"] and ("--prod" in t or "--prod-if-unlocked" in t):
        return {**ev, "kind": "deploy"}
    if bin_ in ("fly", "flyctl", "firebase") and pos[:1] == ["deploy"]:
        return {**ev, "kind": "deploy"}
    return None


def read_diff(root: str, gargs: list[str]) -> tuple[bool, str | None]:
    """Run git diff with a size cap. Returns (ok, text); text is None when over the cap."""
    cmd = ["git", "--no-pager", *gargs, "--no-color", "--no-ext-diff"]
    try:
        p = subprocess.Popen(cmd, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    except Exception:
        return False, ""
    timer = threading.Timer(GIT_TIMEOUT, p.kill)
    timer.start()
    try:
        data = p.stdout.read(MAX_DIFF_BYTES + 1) if p.stdout else b""
        if len(data) > MAX_DIFF_BYTES:
            p.kill()
            p.wait()
            return True, None
        p.wait()
        return p.returncode == 0, data.decode("utf-8", "replace")
    except Exception:
        try:
            p.kill()
        except Exception:
            pass
        return False, ""
    finally:
        timer.cancel()


def release_base(root: str) -> str | None:
    ok, out = ls.run_git(["describe", "--tags", "--abbrev=0"], root, GIT_TIMEOUT)
    if ok and out.strip():
        return out.strip()
    ok, out = ls.run_git(["hash-object", "-t", "tree", "/dev/null"], root, GIT_TIMEOUT)
    return out.strip() if ok and out.strip() else None


def hygiene(root: str) -> list[str]:
    """Cheap local release hygiene findings. Never touches the network."""
    found: list[str] = []
    try:
        names = os.listdir(root)
    except OSError:
        return found
    if not any(n.upper().startswith(("LICENSE", "LICENCE", "COPYING")) and os.path.isfile(os.path.join(root, n))
               for n in names):
        found.append("no LICENSE or COPYING file at the repo root")
    pkg = os.path.join(root, "package.json")
    if os.path.isfile(pkg):
        try:
            import json
            with open(pkg, errors="replace") as fh:
                data = json.load(fh)
            if isinstance(data, dict) and not data.get("license") and not data.get("licenses"):
                found.append("package.json has no license field")
        except Exception:
            pass
    return found


KIND_LABELS = {
    "tag": "tag",
    "release": "GitHub release",
    "publish": "package publish",
    "deploy": "production deploy",
    "pr": "PR",
    "commit-deps": "commit",
}

def main() -> int:
    payload = ls.read_payload()
    if payload is None:
        return 0
    tool_input = payload.get("tool_input")
    cmd = tool_input.get("command") if isinstance(tool_input, dict) else None
    if not isinstance(cmd, str) or not cmd.strip():
        return 0
    if not any(s in cmd for s in SIGNALS):
        return 0
    op = None
    for seg in tokenize(cmd):
        op = classify(seg)
        if op:
            break
    if not op:
        return 0
    kind = op["kind"]

    cwd = payload.get("cwd") or os.getcwd()
    if op["dir"]:
        cwd = os.path.normpath(os.path.join(cwd, os.path.expanduser(op["dir"])))
    if not os.path.isdir(cwd):
        return 0
    ok, top = ls.run_git(["rev-parse", "--show-toplevel"], cwd, GIT_TIMEOUT)
    if not ok or not top.strip():
        return 0
    root = top.strip()

    if kind == "commit-deps":
        gargs = ["diff", "HEAD"] if op["all"] else ["diff", "--cached"]
    elif kind == "pr":
        base = None
        for ref in ("origin/HEAD", "origin/main", "main"):
            if ls.run_git(["rev-parse", "--verify", "--quiet", ref + "^{commit}"], root, GIT_TIMEOUT)[0]:
                base = ref
                break
        if not base:
            return 0
        gargs = ["diff", f"{base}...HEAD"]
    else:
        base = release_base(root)
        if not base:
            return 0
        gargs = ["diff", f"{base}..HEAD"]

    ok, diff = read_diff(root, gargs)
    if not ok:
        return 0
    if diff is None:
        # Too big to read. Judge the file list only.
        ok, out = ls.run_git(["--no-pager", *gargs, "--name-status", "--no-color"], root, GIT_TIMEOUT)
        if not ok:
            return 0
        paths, new = [], []
        for line in out.splitlines():
            parts = line.split("\t")
            if len(parts) >= 2 and not parts[0].startswith("D"):
                paths.append(parts[-1])
                if parts[0].startswith("A"):
                    new.append(parts[-1])
        files = ls.path_files(paths, new)
        digest_src = "\n".join(sorted(paths))
        dep_notes: list[tuple[str, str, str]] = []
    else:
        files = ls.diff_files(diff, root)
        digest_src = diff
        dep_notes = ls.dependency_licenses(diff, root)

    if kind == "commit-deps":
        files = {c: p for c, p in files.items() if c in COMMIT_DEPS_CATS}
    hyg = hygiene(root) if kind in HYGIENE_KINDS else []
    if not files and not hyg:
        return 0

    cats = sorted(files) + (["release-hygiene"] if hyg else [])
    h = hashlib.sha256(f"{kind}\0{digest_src}\0{'|'.join(hyg)}".encode("utf-8", "replace")).hexdigest()
    sp, state = ls.session_state(payload)
    gated = state.get("gated_diffs")
    gated = gated if isinstance(gated, list) else []
    if h in gated:
        return 0
    gated.append(h)
    state["gated_diffs"] = gated[-200:]
    ls.save_state(sp, state)

    paths = sorted({p for ps in files.values() for p in ps})
    shown = ", ".join(paths[:5]) + (f" (+{len(paths) - 5} more)" if len(paths) > 5 else "")
    label = KIND_LABELS.get(kind, kind)
    parts = [f"Legal check before this {label} (kind: {kind}): it touches {', '.join(cats)}"
             + (f" in {shown}" if paths else "") + "."]
    if dep_notes:
        parts.append("Dependency licenses: " + ", ".join(f"{n} ({lic}) in {p}" for p, n, lic in dep_notes[:5]) + ".")
    if hyg:
        parts.append("Release hygiene: " + "; ".join(hyg) + ".")
    if diff is None:
        parts.append("The diff is over 8 MB, so only the file list was judged.")
    repro = "git -C {} {}".format(root, " ".join(gargs))
    parts.append(f"{ls.AGENT_HINT} in release mode on this exact diff (reproduce it with `{repro}`). "
                 "Fix Blocking findings, or tell the user what you are knowingly shipping, then retry the same command.")
    ls.deny_pretool(" ".join(parts))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
