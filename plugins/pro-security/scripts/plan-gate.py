#!/usr/bin/env python3
"""PreToolUse ExitPlanMode hook - make the security-architect challenge a plan precondition.

If the plan touches security surface and has no `## Security challenge` section,
deny ExitPlanMode and tell Claude to run the challenge and fold it into the plan.
The plan is found through the session transcript (ExitPlanMode's tool_input is
empty), never by looking at other sessions' plan files. Escape hatch: after two
denials in a session the gate stays open, so it can never wedge the session.
Fails open on any error.
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import security_surface as ss  # noqa: E402

MAX_DENIES = 2
MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024
WRITE_TOOLS = {"Write", "Edit", "MultiEdit"}
# The plan-mode attachment names the harness-assigned plan file; pro-pdd and
# pro-quality steer plans into the project instead, so those count too.
PLAN_PATH_RE = re.compile(r"[^\s`\"'()]*(?:\.claude/plans|docs/plans|docs/superpowers/specs)/[\w.\-]+\.md")


def _read(path: str) -> str:
    try:
        with open(os.path.expanduser(path), errors="replace") as fh:
            return fh.read()
    except Exception:
        return ""


def _blocks(entry: dict) -> list:
    msg = entry.get("message")
    content = msg.get("content") if isinstance(msg, dict) else None
    return content if isinstance(content, list) else []


def scan_transcript(path: str) -> tuple[str | None, dict[str, str]]:
    """Return (last plan path mentioned, {file_path: last Write content}) for this session.

    ExitPlanMode reaches PreToolUse with an empty tool_input, so the session's own
    transcript is the only reliable record of which plan is being submitted. Never
    look at other sessions' files: a stale plan from elsewhere gives a wrong verdict.
    """
    last_path: str | None = None
    written: dict[str, str] = {}
    try:
        if not path or os.path.getsize(path) > MAX_TRANSCRIPT_BYTES:
            return None, {}
        with open(path, errors="replace") as fh:
            for line in fh:
                if "plans/" not in line and "specs/" not in line:
                    continue
                try:
                    entry = json.loads(line)
                except Exception:
                    continue
                for block in _blocks(entry):
                    if not isinstance(block, dict) or block.get("type") != "tool_use":
                        continue
                    inp = block.get("input") or {}
                    fp = inp.get("file_path") if isinstance(inp, dict) else None
                    if block.get("name") in WRITE_TOOLS and isinstance(fp, str) and PLAN_PATH_RE.search(fp):
                        last_path = fp
                        if block.get("name") == "Write" and isinstance(inp.get("content"), str):
                            written[fp] = inp["content"]
                if entry.get("type") == "attachment" or "attachment" in entry:
                    m = PLAN_PATH_RE.findall(json.dumps(entry.get("attachment", entry)))
                    if m:
                        last_path = m[-1]
    except Exception:
        return None, {}
    return last_path, written


def find_plan(payload: dict) -> tuple[str, str | None]:
    """Return (plan_text, plan_path_or_None) for the plan this session is submitting."""
    tool_input = payload.get("tool_input")
    tool_input = tool_input if isinstance(tool_input, dict) else {}
    plan = tool_input.get("plan")
    if isinstance(plan, str) and plan.strip():
        return plan, None
    for key in ("planFilePath", "plan_file_path", "planPath"):
        p = tool_input.get(key)
        if isinstance(p, str) and p:
            text = _read(p)
            if text.strip():
                return text, p
    path, written = scan_transcript(str(payload.get("transcript_path") or ""))
    if not path:
        return "", None
    cwd = payload.get("cwd") or os.getcwd()
    full = path if os.path.isabs(os.path.expanduser(path)) else os.path.join(cwd, path)
    text = _read(full)
    if text.strip():
        return text, full
    # The write may have been blocked by another hook; judge what Claude wrote.
    text = written.get(path, "")
    return (text, None) if text.strip() else ("", None)


def main() -> int:
    payload = ss.read_payload()
    if payload is None:
        return 0
    text, path = find_plan(payload)
    if not text:
        return 0
    hits = ss.text_hits(text)
    if not hits:
        return 0
    has_section = bool(ss.PLAN_SECTION_RE.search(text))
    if has_section and ss.architect_ran(payload.get("transcript_path")):
        return 0
    sp, state = ss.session_state(payload)
    denies = int(state.get("plan_denies", 0))
    if denies >= MAX_DENIES:
        return 0
    state["plan_denies"] = denies + 1
    ss.save_state(sp, state)
    where = f"the plan file {path}" if path else "the full plan text"
    self_review = ss.SELF_REVIEW_NOTE if has_section else ""
    ss.deny_pretool(
        f"This plan touches security surface: {', '.join(hits)}. {self_review}Before exiting plan mode, "
        f"{ss.AGENT_HINT[0].lower()}{ss.AGENT_HINT[1:]} in challenge mode with {where}. "
        "Fold its output into the plan as the `## Security challenge` section, resolve every "
        "Blocking item in the plan itself, then call ExitPlanMode again."
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
