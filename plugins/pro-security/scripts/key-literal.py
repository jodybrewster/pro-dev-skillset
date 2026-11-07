#!/usr/bin/env python3
"""PreToolUse and PostToolUse hook on Edit, Write and MultiEdit: live-looking keys.

The push gate stops a security-sensitive diff from leaving the machine. This
guard stops a credential from reaching a file at all:

  PreToolUse   reads the text of the edit (Write `content`, Edit `new_string`,
               each MultiEdit `edits[].new_string`) and flags a key before it
               is written. Warn by default; deny only when `mode.key-literal`
               in the guard folder holds `enforce` (ADR-0016).
  PostToolUse  reads the one file the tool wrote (under 1 MB, no NUL byte) and
               tells the agent about a key already on disk. It never blocks.

A finding names the kind of credential, the file's basename and the line
numbers, never the value or any part of the line. A line that reads from the
environment or holds an obvious stand-in word is not a finding, and neither is
a key whose own word holds `<` or `...` once markup tags around it are removed.
The uncommitted value files (`.env`, `.env.local`, `.env.*.local`, `.dev.vars`,
`.dev.vars.<env>`) are never checked: they are where the key belongs. The
committed templates (`.env.example` and the like) are.

It has no Bash matcher, so it never sees a `git push` that push-gate.py gates.
Its own errors never block: anything unexpected exits 0 with no output.

State lives in the guard folder (CLAUDE_GUARD_DIR, or ~/.claude/hooks):
  mode.key-literal   enforce turns the PreToolUse deny on; the global `mode`
                     file and CLAUDE_GUARD_MODE leave it in warn
  warn.log           one tab-separated line per finding
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from typing import List, Optional, Tuple

HOOK = "key-literal"
MAX_BYTES = 1024 * 1024
MAX_LINES = 5

# A subset of CREDENTIALS in plugins/pro-ai-sdlc/scripts/incident.py, which copies
# the REDACT list of plugins/pro-ship/scripts/pr-check.py; plugins/pro-quality/
# scripts/floor-guard.py keeps its own copy too. Plugins do not import each other
# (ADR-0003, ADR-0013), so keep the four in step by hand. Here `xox[a-z]` is
# narrowed to `xox[bpa]` and `sk-ant-`, `xox?-` and `xapp-` need 20 characters
# after the prefix, so prose that names a prefix is not a finding.
PATTERNS: List[Tuple[str, "re.Pattern[str]"]] = [
    ("AWS key id", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{12,}")),
    ("Anthropic key", re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    ("GitHub token", re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}")),
    ("GitHub token", re.compile(r"github_pat_[A-Za-z0-9_]{20,}")),
    ("Slack token", re.compile(r"\bxox[bpa]-[A-Za-z0-9\-]{20,}")),
    ("Slack token", re.compile(r"\bxapp-[A-Za-z0-9\-]{20,}")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
]

# A line that reads the value from the environment is the right pattern.
SAFE = ("process.env", "import.meta.env", "os.environ", "getenv", "deno.env", "system.getenv", "env[", "${{ secrets.")
# Obvious stand-ins: templates and docs hold these on purpose.
STAND_IN = ("your_", "your-", "xxxx", "placeholder", "example", "changeme", "dummy", "fake", "redacted")
TAG = re.compile(r"<[a-zA-Z/][^>]*>")
KEY_CHAR = r"[A-Za-z0-9_\-]"
GLUED_TAG = re.compile(KEY_CHAR + r"<[a-zA-Z/][^>]*>" + KEY_CHAR)
VALUE_FILE = re.compile(r"^(?:\.env|\.env\.local|\.env\..+\.local|\.dev\.vars|\.dev\.vars\.(?!(?:example|sample|template)$)[^.]+)$")


# ---------------------------------------------------------------------------
# Mode and warn.log, copied from plugins/pro-core/scripts/guardlib.py (itself a
# copy of plugins/pro-ai-sdlc/scripts/guard.py). pro-security cannot import
# pro-core (ADR-0003); keep the copies in step by hand.

def guard_dir() -> str:
    return os.environ.get("CLAUDE_GUARD_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "hooks")


def own_mode() -> str:
    """enforce only when mode.key-literal says so; the global mode file and the env never enforce it."""
    try:
        with open(os.path.join(guard_dir(), "mode." + HOOK), encoding="utf-8") as fh:
            return "enforce" if fh.readline().strip() == "enforce" else "warn"
    except (OSError, ValueError):
        return "warn"


def log(action: str, detail: str, cwd: str) -> None:
    detail = detail.replace("\n", " ").replace("\t", " ")
    if len(detail) > 300:
        detail = detail[:300] + "..."
    try:
        os.makedirs(guard_dir(), exist_ok=True)
        with open(os.path.join(guard_dir(), "warn.log"), "a", encoding="utf-8") as fh:
            fh.write("\t".join([time.strftime("%Y-%m-%dT%H:%M:%S%z"), HOOK, action, detail, cwd]) + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Finding keys

def stand_in_token(line: str, start: int, end: int) -> bool:
    """True when the space-separated word around the match is an obvious stand-in.

    Markup tags around the key (`<code>KEY</code>`) are stripped first. A tag
    glued between key characters (`...KEY<x>KEY...`) is a stand-in marker, as is
    a `<` or `...` still left in the word after the strip.
    """
    ts = start
    while ts > 0 and not line[ts - 1].isspace():
        ts -= 1
    te = end
    while te < len(line) and not line[te].isspace():
        te += 1
    token = line[ts:te]
    if GLUED_TAG.search(token):
        return True
    token = TAG.sub("", token)
    return "<" in token or "..." in token


def line_kind(line: str) -> Optional[str]:
    low = line.lower()
    if any(s in low for s in SAFE) or any(w in low for w in STAND_IN):
        return None
    for kind, pattern in PATTERNS:
        for m in pattern.finditer(line):
            if not stand_in_token(line, m.start(), m.end()):
                return kind
    return None


def scan(text: str) -> List[Tuple[int, str]]:
    """(line number, kind) for the first MAX_LINES lines that hold a key."""
    hits: List[Tuple[int, str]] = []
    for n, line in enumerate(text.splitlines(), 1):
        kind = line_kind(line)
        if kind:
            hits.append((n, kind))
            if len(hits) == MAX_LINES:
                break
    return hits


def is_value_file(path: str) -> bool:
    return bool(VALUE_FILE.match(os.path.basename(path)))


def _kinds(kinds: List[str]) -> str:
    seen: List[str] = []
    for k in kinds:
        if k not in seen:
            seen.append(k)
    if len(seen) == 1:
        article = "an" if seen[0][0] in "AEIOU" else "a"
        return f"{article} {seen[0]}"
    return "credentials (" + ", ".join(seen) + ")"


def describe(where: List[Tuple[str, str]], name: str) -> str:
    """`an AWS key id at line 3 of config.ts`: kinds and places, never a value.

    A place is a line number, or `edit <i> line <n>` for a MultiEdit.
    """
    places = [w for w, _ in where]
    if places[0].isdigit():
        at = ("line " if len(places) == 1 else "lines ") + ", ".join(places)
    else:
        at = ", ".join(places)
    return f"{_kinds([k for _, k in where])} at {at} of {name}"


ADVICE = (
    "Do not print or repeat the value. Move it to the local dotenv file (.env.local, which git ignores), "
    "read it from the environment where it is used and add only the key name to .env.example. "
    "If it is a stand-in, make that obvious (your_ or example in the value) and retry."
)


# ---------------------------------------------------------------------------
# The two events

def pre_text(tool: str, ti: dict) -> List[Tuple[str, str]]:
    """[(label prefix, text)]: one entry for Write and Edit, one per edit for MultiEdit."""
    if tool == "Write":
        c = ti.get("content")
        return [("", c)] if isinstance(c, str) else []
    if tool == "Edit":
        c = ti.get("new_string")
        return [("", c)] if isinstance(c, str) else []
    if tool == "MultiEdit":
        out = []
        edits = ti.get("edits")
        if isinstance(edits, list):
            for i, e in enumerate(edits, 1):
                if isinstance(e, dict) and isinstance(e.get("new_string"), str):
                    out.append((f"edit {i} ", e["new_string"]))
        return out
    return []


def pre(tool: str, path: str, ti: dict, cwd: str) -> None:
    where: List[Tuple[str, str]] = []
    for prefix, text in pre_text(tool, ti):
        for n, kind in scan(text):
            where.append((f"{prefix}line {n}" if prefix else str(n), kind))
        if len(where) >= MAX_LINES:
            where = where[:MAX_LINES]
            break
    if not where:
        return
    name = os.path.basename(path)
    if tool == "Edit":
        name = f"the edit to {name}"
    summary = describe(where, name)
    if own_mode() == "enforce":
        log("deny", summary, cwd)
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"[{HOOK}] Blocked: {summary}. {ADVICE}",
        }}))
        return
    log("would-deny", summary, cwd)
    msg = f"[{HOOK}] warn mode: would deny {summary} (logged to warn.log, allowed). {ADVICE}"
    print(json.dumps({"systemMessage": msg, "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": msg}}))


def post(path: str, cwd: str) -> None:
    try:
        if os.path.getsize(path) > MAX_BYTES:
            return
        with open(path, "rb") as fh:
            raw = fh.read(MAX_BYTES + 1)
    except OSError:
        return
    if b"\0" in raw:
        return
    hits = scan(raw.decode("utf-8", errors="replace"))
    if not hits:
        return
    summary = describe([(str(n), k) for n, k in hits], os.path.basename(path))
    log("found-on-disk", summary, cwd)
    msg = f"[{HOOK}] found {summary} on disk. {ADVICE}"
    print(json.dumps({"systemMessage": msg, "hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": msg}}))


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        if not isinstance(payload, dict):
            return 0
        ti = payload.get("tool_input")
        tool = payload.get("tool_name")
        if not isinstance(ti, dict) or tool not in ("Edit", "Write", "MultiEdit"):
            return 0
        path = ti.get("file_path")
        if not isinstance(path, str) or not path or is_value_file(path):
            return 0
        cwd = payload.get("cwd") if isinstance(payload.get("cwd"), str) else os.getcwd()
        event = payload.get("hook_event_name")
        if event == "PostToolUse":
            post(path, cwd)
        elif event == "PreToolUse":
            pre(tool, path, ti, cwd)
    except Exception:
        pass  # a broken guard never blocks unrelated work
    return 0


if __name__ == "__main__":
    sys.exit(main())


# Adapted from super-board hooks/guard-key-literals.py (MIT, Copyright (c) 2026
# Eric Tech); see docs/licenses.md.
