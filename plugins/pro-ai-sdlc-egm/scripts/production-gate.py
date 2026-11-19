#!/usr/bin/env python3
"""PreToolUse hook on Bash: flag production actions.

Flags a git push to the default branch, vercel with a production flag,
npm/pnpm/yarn publish, a PR merge (also through gh api) and a release create.
warn mode (default): log, tell the session, allow.
enforce mode: permissionDecision "ask", unless RELEASE_APPROVAL=1 is set in the
environment the session started with. --dry-run and --help are never flagged.
"""
import json
import os
import re
import shlex
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guard  # noqa: E402

HOOK = "production-gate"
PROD = {"main", "master", "refs/heads/main", "refs/heads/master"}
WRAPPERS = {"sudo", "env", "command", "exec", "time", "nohup", "builtin"}


def segments(command: str):
    for part in re.split(r"\n|;|&&|\|\||\||&", command):
        try:
            toks = shlex.split(part, comments=True)
        except ValueError:
            toks = part.split()
        while toks and (toks[0] in WRAPPERS or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[0])):
            toks = toks[1:]
        if toks:
            yield toks


def current_branch(cwd: str) -> str:
    try:
        return subprocess.run(["git", "-C", cwd, "branch", "--show-current"],
                              capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        return ""


def check_push(t, cwd):
    i = 1
    while i < len(t) and t[i].startswith("-"):
        i += 2 if t[i] in ("-C", "-c") else 1
    if i >= len(t) or t[i] != "push":
        return None
    args = t[i + 1:]
    if any(a in ("-n", "--dry-run") for a in args):
        return None
    if any(a in ("--all", "--mirror", "--branches") for a in args):
        return "git push --all (includes the default branch)"
    pos = [a for a in args if not a.startswith("-")]
    refs = pos[1:]
    if not refs:
        if "--tags" in args:
            return None
        b = current_branch(cwd)
        return f"git push while on {b}" if b in PROD else None
    for r in refs:
        dst = r.lstrip("+").split(":")[-1]
        if dst in ("HEAD", "@"):
            dst = current_branch(cwd)
        if dst in PROD:
            return "git push to " + dst.replace("refs/heads/", "")
    return None


def check(t, cwd):
    if any(a in ("--help", "-h") for a in t):
        return None
    cmd = os.path.basename(t[0])
    if cmd in ("npx", "bunx", "pnpx") and len(t) > 1:
        rest = t[1:]
        while rest and rest[0].startswith("-"):
            rest = rest[1:]
        return check(rest, cwd) if rest else None
    if cmd == "git":
        return check_push(t, cwd)
    if cmd == "vercel":
        for n, a in enumerate(t):
            if a in ("--prod", "--prod=true", "--production", "--target=production"):
                return "vercel " + a
            if a == "--target" and n + 1 < len(t) and t[n + 1] == "production":
                return "vercel --target production"
    if cmd in ("npm", "pnpm", "yarn") and "publish" in t[1:3] and "--dry-run" not in t:
        return cmd + " publish"
    if cmd == "gh" and len(t) > 2:
        if t[1] == "pr" and t[2] == "merge":
            return "gh pr merge"
        if t[1] == "release" and t[2] == "create":
            return "gh release create"
        if t[1] == "api" and any(re.search(r"/pulls/\d+/merge|mergePullRequest|enablePullRequestAutoMerge", a) for a in t[2:]):
            return "gh api merge"
    return None


def main() -> None:
    data = guard.read_payload(HOOK)
    cwd = data.get("cwd") or os.getcwd()
    ti = data.get("tool_input")
    command = ti.get("command") if isinstance(ti, dict) else None
    if not isinstance(command, str) or not command:
        sys.exit(0)
    found = None
    for t in segments(command):
        found = check(t, cwd)
        if found:
            break
    if not found:
        sys.exit(0)
    detail = f"{found} :: {command}"
    approved = os.environ.get("RELEASE_APPROVAL") == "1"
    if guard.mode(HOOK) == "warn":
        if approved:
            guard.log(HOOK, "would-allow-release-approval", detail, cwd)
            sys.exit(0)
        guard.warn(HOOK, "PreToolUse", "ask", "before " + found, detail, cwd)
    if approved:
        guard.log(HOOK, "allow-release-approval", detail, cwd)
        sys.exit(0)
    guard.log(HOOK, "ask", detail, cwd)
    reason = (f"production-gate: {found} is a production action and needs your approval "
              "(rule: production actions are approved by hand). Approve this prompt to run it once. "
              "For a release session, start Claude Code with RELEASE_APPROVAL=1.")
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                      "permissionDecision": "ask", "permissionDecisionReason": reason}}))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
