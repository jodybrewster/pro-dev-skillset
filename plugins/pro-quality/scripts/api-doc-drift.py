#!/usr/bin/env python3
"""PostToolUse Write|Edit hook - flag API contract edits that outrun their docs.

When an edit touches a file that defines a consumer-facing contract (an OpenAPI
or GraphQL schema, or a `.proto`), nudges the session toward the api-documenter
subagent so the reference does not silently drift from the implementation.

Deliberately narrow. It matches contract-definition files only, never ordinary
route handlers - a hook that fires on every controller edit gets ignored within
a day, which is worse than no hook. Advisory only: never blocks, always exits 0,
and fires at most once per file per session.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys

# Contract-definition files. Narrow on purpose - see the module docstring.
CONTRACT_PATTERNS = [
    re.compile(r"(^|/)openapi\.(ya?ml|json)$", re.I),
    re.compile(r"(^|/)swagger\.(ya?ml|json)$", re.I),
    re.compile(r"\.openapi\.(ya?ml|json)$", re.I),
    re.compile(r"(^|/)api-spec\.(ya?ml|json)$", re.I),
    re.compile(r"\.graphql$", re.I),
    re.compile(r"\.graphqls$", re.I),
    re.compile(r"(^|/)schema\.graphql$", re.I),
    re.compile(r"\.proto$", re.I),
]
STATE_HOME = os.path.expanduser("~/.claude/pro-dev/api-doc-drift")


def is_contract_file(path: str) -> bool:
    normalized = path.replace(os.sep, "/")
    return any(p.search(normalized) for p in CONTRACT_PATTERNS)


def already_flagged(session_id: str, path: str) -> bool:
    """One nudge per file per session. Repeat nags train people to ignore them."""
    key = hashlib.sha256(f"{session_id}:{os.path.realpath(path)}".encode()).hexdigest()[:16]
    marker = os.path.join(STATE_HOME, key)
    if os.path.exists(marker):
        return True
    try:
        os.makedirs(STATE_HOME, exist_ok=True)
        open(marker, "w").close()
    except Exception:
        pass  # Best-effort: an unwritable state dir means an extra nudge, not a failure.
    return False


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool_input = payload.get("tool_input") or {}
    path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not isinstance(path, str) or not path or not is_contract_file(path):
        return 0
    if already_flagged(payload.get("session_id") or "unknown", path):
        return 0

    name = os.path.basename(path)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": (
                f"`{name}` is a consumer-facing API contract and it just changed. "
                f"Before this session ends, make sure the reference docs still match: "
                f"field types and nullability, status codes, the auth and error models, "
                f"and any deprecation or migration note the change implies. "
                f"Run /api-docs or dispatch the api-documenter subagent against {path}. "
                f"If the change is additive and no published doc describes the affected "
                f"surface, say so and move on - don't invent a doc to satisfy this."
            ),
        }
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
