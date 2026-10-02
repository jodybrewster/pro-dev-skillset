#!/usr/bin/env python3
"""UserPromptSubmit hook - nudge legal thinking while an idea is still cheap to change.

When a prompt looks like planning/ideation AND touches legal surface, add a short
additionalContext reminder. Never blocks. Nudges at most once per distinct category
set per session so it does not repeat on every message about the same topic.
"""
from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import legal_surface as ss  # noqa: E402

PLANNING_RE = re.compile(
    r"\b(?:plan|planning|design|architect\w*|approach|ideas?|how should (?:i|we)|"
    r"what(?:'|’)?s the best way|spec|proposal|build an?|brainstorm\w*)\b"
    r"|\badd an? .* (?:feature|flow|endpoint|integration)\b"
    r"|\blet(?:'|’)?s implement\b",
    re.I,
)


def main() -> int:
    payload = ss.read_payload()
    if payload is None:
        return 0
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return 0
    stripped = prompt.lstrip()
    if stripped.startswith("/") and not re.match(r"/plan\b", stripped):
        return 0
    if not PLANNING_RE.search(prompt):
        return 0
    hits = ss.text_hits(prompt)
    if not hits:
        return 0
    sp, state = ss.session_state(payload)
    seen = state.get("nudged")
    seen = seen if isinstance(seen, list) else []
    key = ",".join(hits)
    if key in seen:
        return 0
    seen.append(key)
    state["nudged"] = seen[-100:]
    ss.save_state(sp, state)
    ss.emit({"hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": (
            f"Legal note: this idea touches {', '.join(hits)}. Before agreeing to an approach, flag the "
            "legal questions it raises (licenses and attribution, personal data and consent, platform and "
            "API terms, who owns the result) and say what the design must include to cover them. "
            "For a written plan, dispatch the `software-counsel` subagent on it and add a `## Legal review` "
            "section before approval; a section you write yourself does not satisfy the gate."
        ),
    }})
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
