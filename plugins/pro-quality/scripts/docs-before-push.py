#!/usr/bin/env python3
"""PreToolUse Bash hook - enforce doc freshness before git push.

When the command is a git push, checks that any existing key documentation
files (README.md, AGENTS.md, CLAUDE.md, ARCHITECTURE.md, PRODUCT.md, DESIGN.md) were
updated alongside code changes. Blocks push if stale docs are detected.

It evaluates the repo being pushed (`git -C <path>`, a leading `cd <path> &&`,
else the session cwd) and only the commits that would be pushed. Markdown-only
changes (root *.md, docs/, intent/) need no doc update.
A target that cannot be resolved (a variable, pushd) is allowed.

Exits 2 (BLOCK) with a remediation message; exits 0 otherwise.
"""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys

KEY_DOCS = ["README.md", "AGENTS.md", "CLAUDE.md", "ARCHITECTURE.md", "PRODUCT.md", "DESIGN.md"]
ROOT_FILES = {"LICENSE", ".gitignore", ".gitattributes"}
# Cheap pre-filter only; push_dirs() decides whether a segment really is a push.
PUSH_RE = re.compile(r"\bgit\b.*\bpush\b", re.DOTALL)


def git(repo: str, *args: str) -> tuple[bool, str]:
    """Run git inside repo. Bounded, never raises, no shell."""
    try:
        r = subprocess.run(
            ["git", "-C", repo, *args], capture_output=True, text=True, timeout=10
        )
        return r.returncode == 0, r.stdout.strip()
    except Exception:
        return False, ""


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


def push_dirs(command: str, base: str | None) -> list[str]:
    """Directories in which the command runs a push.

    Follows `cd <path>`, `git -C <path>` and the wrappers env, command, timeout and
    bash/sh -c, so the hook evaluates the repo being pushed, not the repo the session
    happens to be rooted in. A target that cannot be resolved (a variable, pushd) is
    skipped, so the push is allowed: the hook cannot know which repo is meant.
    """
    cur = base
    found: list[str] = []
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
                    found.extend(push_dirs(toks[j + 1], cur))
                    break
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
        if i < len(toks) and toks[i] == "push" and where is not None:
            found.append(where)
    return found


def default_branch_ref(repo: str) -> str | None:
    ok, out = git(repo, "symbolic-ref", "--short", "refs/remotes/origin/HEAD")
    if ok and out:
        return out
    for ref in ("origin/main", "origin/master"):
        if git(repo, "rev-parse", "--verify", "--quiet", ref)[0]:
            return ref
    return None


def changed_files(repo: str) -> list[str]:
    """Files changed by the commits that would be pushed from repo.

    Upstream..HEAD when the branch has an upstream, else the merge-base with the
    remote default branch (a new branch). With no remote to compare against there
    is nothing to evaluate: guessing from the last commit is what used to check
    the wrong history.
    """
    ok, _ = git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    if ok:
        ok, out = git(repo, "diff", "--name-only", "@{u}...HEAD")
        return out.splitlines() if ok and out else []
    ref = default_branch_ref(repo)
    if not ref:
        return []
    ok, base = git(repo, "merge-base", "HEAD", ref)
    if not ok or not base:
        return []
    ok, out = git(repo, "diff", "--name-only", f"{base}..HEAD")
    return out.splitlines() if ok and out else []


def is_doc_only(path: str) -> bool:
    """Root-level Markdown and config, docs/** and intent/**. SKILL.md, commands and
    agents are shipped behavior and stay code."""
    if path.endswith(".lock"):
        return True
    if "/" not in path:
        return path.endswith(".md") or path in ROOT_FILES
    return path.startswith(("docs/", "intent/"))


def stale_docs(repo: str) -> tuple[list[str], list[str], str]:
    """(code files being pushed, key docs left stale, repo root judged)."""
    ok, top = git(repo, "rev-parse", "--show-toplevel")
    if not ok or not top:
        return [], [], repo
    changed = changed_files(top)
    code_changed = [f for f in changed if not is_doc_only(f)]
    if not code_changed:
        return [], [], top  # nothing pushed, or docs/config/Markdown only

    # A symlinked doc (AGENTS.md -> CLAUDE.md is the common case) never shows up
    # in `git diff --name-only` under its own name, so resolve links and count a
    # doc as fresh when its target moved. Without this the gate is unsatisfiable
    # and blocks every push forever.
    changed_set = set(changed)
    changed_real = {os.path.realpath(os.path.join(top, f)) for f in changed}
    stale = [
        doc for doc in KEY_DOCS
        if os.path.exists(os.path.join(top, doc))
        and doc not in changed_set
        and os.path.realpath(os.path.join(top, doc)) not in changed_real
    ]
    return code_changed, stale, top


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool_input = payload.get("tool_input") or {}
    command = tool_input.get("command") or ""
    if not isinstance(command, str) or not PUSH_RE.search(command):
        return 0

    cwd = payload.get("cwd")
    base = cwd if isinstance(cwd, str) and cwd else os.getcwd()
    code_changed: list[str] = []
    stale: list[str] = []
    judged = base
    for repo in dict.fromkeys(push_dirs(command, base)):
        code_changed, stale, judged = stale_docs(repo)
        if stale:
            break
    if not stale:
        return 0

    stale_list = "\n".join(f"  - {d}" for d in stale)
    code_sample = ", ".join(code_changed[:5]) + ("…" if len(code_changed) > 5 else "")
    print(
        f"BLOCKED: Code changed ({code_sample}) but these docs were not updated in {judged}:\n"
        f"{stale_list}\n\n"
        f"Fix it, don't just acknowledge it. Run /document to have the technical-writer "
        f"subagent draft the updates from the actual diff, or dispatch it directly. "
        f"It writes from repository evidence, so give it the changed paths above.\n\n"
        f"If a doc genuinely needs no change, say which one and why in the PR description "
        f"before re-running the push. Do not edit a doc cosmetically to clear this gate.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
