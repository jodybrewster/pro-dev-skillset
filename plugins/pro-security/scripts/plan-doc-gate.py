#!/usr/bin/env python3
"""PostToolUse Write|Edit|MultiEdit hook - catch security-touching plan documents.

When a plan/spec document is written (docs/plans, docs/superpowers/specs,
spdd/analysis, spdd/prompt, or ~/.claude/plans) and it touches security surface
without a `## Security challenge` section, block once per file per session and ask
for the security-architect challenge. Fails open on any error.
"""
from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import security_surface as ss  # noqa: E402

PLAN_PATH_RE = re.compile(
    r"(?:^|/)(?:docs/plans|docs/superpowers/specs|spdd/analysis|spdd/prompt)/[^/]+\.md$"
)


def is_plan_doc(path: str) -> bool:
    norm = path.replace(os.sep, "/")
    if PLAN_PATH_RE.search(norm):
        return True
    if norm.endswith(".md"):
        d = os.path.realpath(ss.plans_dir())
        return os.path.realpath(os.path.dirname(path)) == d
    return False


def main() -> int:
    payload = ss.read_payload()
    if payload is None:
        return 0
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return 0
    fp = tool_input.get("file_path")
    if not isinstance(fp, str) or not fp:
        return 0
    cwd = payload.get("cwd") or os.getcwd()
    if not os.path.isabs(fp):
        fp = os.path.join(cwd, fp)
    if not is_plan_doc(fp):
        return 0
    try:
        with open(fp, errors="replace") as fh:
            text = fh.read()
    except Exception:
        return 0
    hits = ss.text_hits(text)
    if not hits:
        return 0
    has_section = bool(ss.PLAN_SECTION_RE.search(text))
    if has_section and ss.architect_ran(payload.get("transcript_path")):
        return 0
    real = os.path.realpath(fp)
    sp, state = ss.session_state(payload)
    flagged = state.get("flagged_docs")
    flagged = flagged if isinstance(flagged, list) else []
    if real in flagged:
        return 0
    flagged.append(real)
    state["flagged_docs"] = flagged[-200:]
    ss.save_state(sp, state)
    ss.emit({
        "decision": "block",
        "reason": (
            f"{fp} touches security surface: {', '.join(hits)}"
            + (", but no independent security-architect pass has run. " + ss.SELF_REVIEW_NOTE
               if has_section else ", and has no `## Security challenge` section. ")
            + f"{ss.AGENT_HINT} in challenge mode with this file path. "
            "Put its output in that file as the `## Security challenge` section and resolve Blocking items in the plan itself."
        ),
    })
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
