#!/usr/bin/env python3
"""
PR quality gate - fires PostToolUse after a pull request is created.

Two triggers share this script:
  - the mcp__github__create_pull_request MCP tool (title and body in tool_input);
  - the Bash tool, when a command segment is `gh pr create` (after wrappers such
    as env assignments or `cd x &&`, never inside a heredoc body or a quoted
    string) and the output holds a https://github.com/<owner>/<repo>/pull/<n>
    URL. Title and body are read from --title/-t and --body/-b/--body-file/-F.
    A body from stdin (-F -), --fill or an unreadable file makes the description
    check report SKIPPED instead of failing. Any other Bash command, or a failed
    create, prints nothing.

Runs description validation, lint and tests (in the payload cwd when present),
then injects additionalContext instructing Claude to dispatch the code reviewer
subagent.
"""

import json
import os
import re
import shlex
import subprocess
import sys

PR_URL_RE = re.compile(r"https://github\.com/[^/\s]+/[^/\s]+/pull/\d+")


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


def git_sha(cmd, cwd=None):
    ok, out = run(cmd, timeout=5, cwd=cwd)
    return out.splitlines()[0].strip() if ok and out else ""


def has_npm_script(name, cwd=None):
    pkg = os.path.join(cwd or os.getcwd(), "package.json")
    if not os.path.exists(pkg):
        return False
    try:
        with open(pkg) as f:
            data = json.load(f)
        return name in data.get("scripts", {})
    except Exception:
        return False

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


def gh_pr_create_tokens(command):
    """Tokens after `gh pr create` for the first such segment, else None."""
    for seg in split_segments(strip_heredocs(command)):
        toks = _tokens(seg)
        i = skip_wrappers(toks)
        if i >= len(toks) or toks[i] != "gh":
            continue
        i += 1
        while i < len(toks) and toks[i] in ("-R", "--repo"):
            i += 2
        if toks[i : i + 2] == ["pr", "create"]:
            return toks[i + 2 :]
    return None


def flag_value(toks, long, short):
    """Value of --long X, --long=X, -short X or -shortX; None when absent."""
    for i, t in enumerate(toks):
        if t == "--" + long or t == "-" + short:
            return toks[i + 1] if i + 1 < len(toks) else None
        if t.startswith("--" + long + "="):
            return t.split("=", 1)[1]
        if len(t) > 2 and t.startswith("-" + short) and not t.startswith("--"):
            return t[2:]
    return None


def response_text(resp):
    if isinstance(resp, str):
        return resp
    if isinstance(resp, dict):
        return "\n".join(response_text(v) for v in resp.values() if isinstance(v, (str, dict, list)))
    if isinstance(resp, list):
        return "\n".join(response_text(v) for v in resp)
    return ""


def bash_pr(payload, cwd):
    """(title, body) for a successful `gh pr create` Bash call; None otherwise.
    body is None when it cannot be read from the command."""
    command = payload.get("tool_input", {}).get("command", "")
    if not isinstance(command, str) or "gh" not in command:
        return None
    toks = gh_pr_create_tokens(command)
    if toks is None:
        return None
    if not PR_URL_RE.search(response_text(payload.get("tool_response"))):
        return None
    title = (flag_value(toks, "title", "t") or "").strip()
    body = flag_value(toks, "body", "b")
    if body is not None and ("$(" in body or "<<" in body):
        body = None
    if body is None:
        path = flag_value(toks, "body-file", "F")
        if path and path != "-":
            try:
                with open(os.path.join(cwd or os.getcwd(), os.path.expanduser(path))) as f:
                    body = f.read()
            except Exception:
                body = None
    return title, (body.strip() if body is not None else None)


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except Exception:
        payload = {}

    cwd = payload.get("cwd") if isinstance(payload.get("cwd"), str) and os.path.isdir(payload.get("cwd")) else None

    if payload.get("tool_name") == "Bash":
        found = bash_pr(payload, cwd)
        if found is None:
            return
        title, body = found
    else:
        tool_input = payload.get("tool_input", {})
        title = tool_input.get("title", "").strip()
        body = tool_input.get("body", "").strip()

    checks = []
    blocking = []

    # 1. PR description
    if body is None:
        checks.append("Description: SKIPPED (body not readable from the command)")
        body = ""
    elif len(body) < 50:
        checks.append("Description: FAIL — too short (must be >50 chars)")
        blocking.append("Add a substantive PR description explaining what changed and why.")
    else:
        checks.append("Description: PASS")

    # 2. Lint
    if has_npm_script("lint", cwd):
        ok, out = run("npm run lint --silent 2>&1", timeout=30, cwd=cwd)
        if ok:
            checks.append("Lint: PASS")
        else:
            snippet = out[:400] if out else "no output"
            checks.append(f"Lint: FAIL\n    {snippet}")
            blocking.append("Fix lint errors before merging.")
    else:
        checks.append("Lint: SKIPPED (no lint script in package.json)")

    # 3. Tests
    if has_npm_script("test", cwd):
        ok, out = run("npm test --silent 2>&1", timeout=60, cwd=cwd)
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
        git_sha("git merge-base origin/main HEAD", cwd)
        or git_sha("git merge-base origin/master HEAD", cwd)
        or git_sha("git rev-parse HEAD~1", cwd)
    )
    head_sha = git_sha("git rev-parse HEAD", cwd)

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

    context = (
        f"PR quality gate — \"{title}\"\n\n"
        f"Quality checks:\n{check_summary}\n\n"
        f"{blocking_text}"
        f"Now dispatch the pro-quality:code-reviewer agent using the requesting-code-review skill "
        f"(template: requesting-code-review/handoff.md) with these four fields and no other text:\n"
        f"  range: {base_sha}..{head_sha}\n"
        f"  brief: paths to the intent, spec, plan or issue for this PR\n"
        f"  policy: REVIEW.md, the agent file and CONSTRAINTS.md when present\n"
        f"  risk: the tier or \"unclassified\", plus .pro-dev/ship/pr-check.json when it exists\n\n"
        f"Act on Important findings before marking the PR ready for review."
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
