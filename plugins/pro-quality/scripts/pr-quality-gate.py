#!/usr/bin/env python3
"""
PR quality gate — fires PostToolUse on mcp__github__create_pull_request.

Runs description validation, lint, and tests, then injects additionalContext
instructing Claude to dispatch the code reviewer subagent.
"""

import json
import os
import subprocess
import sys


def run(cmd, timeout, cwd=None):
    """Run a shell command; return (success, output_tail)."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd or os.getcwd(),
        )
        output = (result.stdout + result.stderr).strip()
        tail = "\n".join(output.splitlines()[-20:]) if output else ""
        return result.returncode == 0, tail
    except subprocess.TimeoutExpired:
        return False, f"timed out after {timeout}s"
    except Exception as e:
        return False, str(e)


def git_sha(cmd):
    ok, out = run(cmd, timeout=5)
    return out.splitlines()[0].strip() if ok and out else ""


def has_npm_script(name):
    pkg = os.path.join(os.getcwd(), "package.json")
    if not os.path.exists(pkg):
        return False
    try:
        with open(pkg) as f:
            data = json.load(f)
        return name in data.get("scripts", {})
    except Exception:
        return False


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except Exception:
        payload = {}

    tool_input = payload.get("tool_input", {})
    title = tool_input.get("title", "").strip()
    body = tool_input.get("body", "").strip()

    checks = []
    blocking = []

    # 1. PR description
    if len(body) < 50:
        checks.append("Description: FAIL — too short (must be >50 chars)")
        blocking.append("Add a substantive PR description explaining what changed and why.")
    else:
        checks.append("Description: PASS")

    # 2. Lint
    if has_npm_script("lint"):
        ok, out = run("npm run lint --silent 2>&1", timeout=30)
        if ok:
            checks.append("Lint: PASS")
        else:
            snippet = out[:400] if out else "no output"
            checks.append(f"Lint: FAIL\n    {snippet}")
            blocking.append("Fix lint errors before merging.")
    else:
        checks.append("Lint: SKIPPED (no lint script in package.json)")

    # 3. Tests
    if has_npm_script("test"):
        ok, out = run("npm test --silent 2>&1", timeout=60)
        if ok:
            checks.append("Tests: PASS")
        else:
            snippet = out[:600] if out else "no output"
            checks.append(f"Tests: FAIL\n    {snippet}")
            blocking.append("Fix failing tests before merging.")
    else:
        checks.append("Tests: SKIPPED (no test script in package.json)")

    # 4. Git SHAs for code reviewer
    base_sha = (
        git_sha("git merge-base origin/main HEAD")
        or git_sha("git merge-base origin/master HEAD")
        or git_sha("git rev-parse HEAD~1")
    )
    head_sha = git_sha("git rev-parse HEAD")

    # Build additionalContext
    check_summary = "\n".join(f"  - {c}" for c in checks)

    if blocking:
        blocking_text = (
            "BLOCKING — fix before proceeding:\n"
            + "\n".join(f"  {i+1}. {b}" for i, b in enumerate(blocking))
            + "\n\n"
        )
    else:
        blocking_text = ""

    description_for_reviewer = title or "PR changes"
    plan_for_reviewer = (body[:500] + "…") if len(body) > 500 else body or "See PR description."

    context = (
        f"PR quality gate — \"{title}\"\n\n"
        f"Quality checks:\n{check_summary}\n\n"
        f"{blocking_text}"
        f"Now dispatch the code reviewer subagent using the requesting-code-review skill "
        f"(template: requesting-code-review/code-reviewer.md) with:\n"
        f"  DESCRIPTION: {description_for_reviewer}\n"
        f"  PLAN_OR_REQUIREMENTS: {plan_for_reviewer}\n"
        f"  BASE_SHA: {base_sha}\n"
        f"  HEAD_SHA: {head_sha}\n\n"
        f"Act on Critical and Important findings before marking the PR ready for review."
    )

    output = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": context,
        }
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
