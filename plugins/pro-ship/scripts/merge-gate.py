#!/usr/bin/env python3
"""PreToolUse Bash hook - the merge gate.

Before `gh pr merge` it classifies the PR the command names with risk-classify.py (a sibling
script) and decides by tier. It never reads a tier from a stamp or a label. It also gates
`gh api .../pulls/<n>/merge` (unless the method is GET) and treats `gh api graphql` with
mergePullRequest or enablePullRequestAutoMerge as could not run, since a node id names no PR.
The PR is read with `gh pr view [selector] --json number,headRefOid,baseRefName,headRepository`
(5 second timeout, -R from -R, --repo, GH_REPO= or GH_REPO) so the tier is the PR's even from
main. When the head is not in the local clone it runs `git fetch --no-tags origin
pull/<n>/head` (8 second timeout), the one write the gate makes, objects and FETCH_HEAD only.
  low          allows with no output (a low merge is not pinned).
  medium/high  needs `--match-head-commit <sha>` (full sha or a prefix of 7 or more hex
               characters) that matches the PR head; a gh api merge needs `-f sha=<sha>`.
               Without it: enforce denies and names the flag; warn allows with a message.
               With it: enforce returns permissionDecision "ask" with the tier, signals,
               findings, PR number and head sha; warn logs, shows the same text as a
               systemMessage and allows. With --auto the pin is held the same way.
  could not run (no git, no gh, gh failing, timing out or not answering in JSON, a head that
               cannot be fetched, no merge base, empty range, timeout, deadline) counts as
               high and logs could-not-run with the reason; enforce asks, warn says the tier
               is unknown. An unresolved PR is never low.
  NO_PROMPT_MODES  in enforce, medium and high deny instead of ask, because an ask may not
               prompt there. Nothing else (env var, flag, file, stamp) clears an ask.
Mode: mode.merge-gate, then mode, in CLAUDE_GUARD_DIR or ~/.claude/hooks (default warn).
A malformed payload exits 0 with no output. A command with no merge in it makes no call;
nothing from the payload is executed. The gate answers within 20 seconds, before the hook's
30 second timeout, with both calls inside it.
"""
from __future__ import annotations

import importlib.util
import os
import re
import shlex
import signal
import subprocess
import sys
import time

HOOK = "merge-gate"
# permission_mode values in which a hook "ask" is not known to prompt; in enforce these deny.
# Fail closed: the set shrinks only after an interactive ask check per mode (Jody, 2026-10-30).
# Evidence, probed headless on 2026-10-30, Claude Code 2.1.314: `claude -p` with --permission-prompts none
# under each --permission-mode, a PreToolUse hook answering "ask" for one echo command. The ask
# denied the command in every mode (the hook logged these permission_mode values): auto, default
# (the flag value manual), acceptEdits, plan, dontAsk and bypassPermissions. A plain echo ran
# under bypassPermissions, dontAsk and auto, so the denial came from the ask. plan is not
# conclusive on its own (the mode may stop Bash itself) and was never in this set. The probe is a
# proxy for a person at the terminal, so it does not shrink this set on its own.
NO_PROMPT_MODES: set[str] = {"bypassPermissions", "dontAsk", "auto"}
DEADLINE = 20
try:  # test hook: a shorter deadline for the slow-module case
    DEADLINE = float(os.environ.get("PRO_SHIP_MERGE_GATE_DEADLINE") or DEADLINE)
except ValueError:
    pass
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Mode lookup and warn.log writer.
# Copied from plugins/pro-ai-sdlc/scripts/guard.py (guard_dir, mode, log), as pr-gate.py does.
# Plugins cannot import each other (ADR-0003), so keep the copies in step by hand.
# ---------------------------------------------------------------------------


def guard_dir() -> str:
    return os.environ.get("CLAUDE_GUARD_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "hooks")


def mode(hook: str) -> str:
    d = guard_dir()
    for name in ("mode." + hook, "mode"):
        try:
            with open(os.path.join(d, name), encoding="utf-8") as fh:
                value = fh.readline().strip()
        except OSError:
            continue
        return "enforce" if value == "enforce" else "warn"
    return "warn"


def log(hook: str, action: str, detail: str, cwd: str) -> None:
    detail = detail.replace("\n", " ").replace("\t", " ")
    if len(detail) > 300:
        detail = detail[:300] + "..."
    try:
        os.makedirs(guard_dir(), exist_ok=True)
        with open(os.path.join(guard_dir(), "warn.log"), "a", encoding="utf-8") as fh:
            fh.write("\t".join([time.strftime("%Y-%m-%dT%H:%M:%S%z"), hook, action, detail, cwd]) + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Command parsing.
# Same approach as pr-gate.py (strip_heredocs, split_segments, skip_wrappers, substitutions,
# actions), matching `gh pr merge`. Text inside quotes, echo and heredoc bodies never matches.
# ---------------------------------------------------------------------------

HEREDOC_RE = re.compile(r"(?<!<)<<(?!<)-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
SHELLS = {"bash", "sh", "zsh", "dash"}
SHELL_C_RE = re.compile(r"^-[A-Za-z]*c[A-Za-z]*$")


def strip_heredocs(command: str) -> str:
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
    segments: list[str] = []
    buf: list[str] = []
    quote = ""
    i, n = 0, len(command)
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
        if ch == "&" and not (i + 1 < n and command[i + 1] == ">") and not (i > 0 and command[i - 1] in "<>"):
            segments.append("".join(buf))  # a single & backgrounds the left side and starts a new command
            buf = []
            i += 1
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
    if cur is None or any(c in path for c in "$`*?"):
        return None
    return os.path.abspath(os.path.join(cur, os.path.expanduser(path)))


KEYWORDS = {"{", "!", "then", "do", "else", "elif", "if", "while", "until", "time", "exec", "nohup", "builtin"}
XARGS_VALUE = {"-a", "-d", "-E", "-I", "-L", "-n", "-P", "-s", "--arg-file", "--delimiter", "--max-args", "--max-procs"}
SUDO_VALUE = {"-u", "-g", "-p", "-C", "-D", "-R", "-T", "-U", "-h"}


def skip_wrappers(toks: list[str]) -> int:
    i = 0
    while i < len(toks):
        t = toks[i]
        if "=" in t and not t.startswith(("-", "=")):
            i += 1
        elif t in KEYWORDS:
            i += 1
            while t == "time" and i < len(toks) and toks[i].startswith("-"):
                i += 1
        elif t == "env":
            i += 1
            while i < len(toks) and (toks[i].startswith("-") or "=" in toks[i]):
                i += 2 if toks[i] in ("-u", "-S") else 1
        elif t == "command":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 1
        elif t == "sudo":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] in SUDO_VALUE else 1
        elif t == "nice":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] == "-n" else 1
        elif t == "timeout":
            i += 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] in ("-k", "-s") else 1
            i += 1
        else:
            break
    return i


def substitutions(command: str) -> tuple[str, list[str]]:
    out: list[str] = []
    bodies: list[str] = []
    quote = ""
    i, n = 0, len(command)
    while i < n:
        ch = command[i]
        if ch == "\\" and quote != "'" and i + 1 < n:
            out.append(command[i : i + 2])
            i += 2
            continue
        if quote == "'":
            if ch == "'":
                quote = ""
            out.append(ch)
            i += 1
            continue
        if ch == "'" and quote == "":
            quote = "'"
            out.append(ch)
            i += 1
            continue
        if ch == '"':
            quote = "" if quote == '"' else '"'
            out.append(ch)
            i += 1
            continue
        if ch == "`":
            j = i + 1
            while j < n and command[j] != "`":
                j += 2 if command[j] == "\\" else 1
            bodies.append(command[i + 1 : j])
            out.append("SUBST")
            i = j + 1
            continue
        if ch == "(" and i > 0 and command[i - 1] in "$<>" and (command[i - 1] == "$" or quote == ""):
            depth, j, q = 1, i + 1, ""
            while j < n and depth:
                c = command[j]
                if c == "\\" and q != "'":
                    j += 2
                    continue
                if q:
                    q = "" if c == q else q
                elif c in "'\"":
                    q = c
                elif c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                j += 1
            bodies.append(command[i + 1 : j - 1 if depth == 0 else j])
            out.pop()
            out.append("SUBST")
            i = j
            continue
        out.append(ch)
        i += 1
    return "".join(out), bodies


MERGE_VALUE_FLAGS = {"-b", "--body", "-F", "--body-file", "-t", "--subject", "-A", "--author-email",
                     "--match-head-commit", "-R", "--repo"}


def repo_flag(args: list[str]) -> str | None:
    """The value of -R or --repo (space or = form) anywhere in args, the last one winning."""
    found = None
    for k, a in enumerate(args):
        if a in ("-R", "--repo") and k + 1 < len(args):
            found = args[k + 1]
        elif a.startswith("--repo="):
            found = a.split("=", 1)[1]
    return found


def merge_selector(args: list[str]) -> str:
    """The first positional argument of `gh pr merge`, skipping flag values ("" when there is none)."""
    k = 0
    while k < len(args):
        a = args[k]
        if a in MERGE_VALUE_FLAGS:
            k += 2
        elif a.startswith("-"):
            k += 1
        else:
            return a
    return ""


API_VALUE_FLAGS = {"-X", "--method", "-f", "--raw-field", "-F", "--field", "-H", "--header", "-q", "--jq",
                   "-t", "--template", "--input", "--hostname", "--cache", "-p", "--preview"}
API_MERGE_RE = re.compile(r"(?:^|/)repos/([^/]+)/([^/]+)/pulls/(\d+)/merge(?:[/?]|$)")
GRAPHQL_MERGES = ("mergePullRequest", "enablePullRequestAutoMerge")


def api_parts(args: list[str]) -> tuple[str, list[str], str | None]:
    """(endpoint path, every other argument, explicit method) of a `gh api` call."""
    path, rest, method, k = "", [], None, 0
    while k < len(args):
        a = args[k]
        if a in ("-X", "--method") and k + 1 < len(args):
            method = args[k + 1].upper()
            k += 2
        elif a.startswith("--method="):
            method = a.split("=", 1)[1].upper()
            k += 1
        elif a.startswith("-X") and len(a) > 2:
            method = a[2:].upper()
            k += 1
        elif a in API_VALUE_FLAGS:
            rest.extend(args[k : k + 2])
            k += 2
        elif a.startswith("-"):
            rest.append(a)
            k += 1
        else:
            if not path:
                path = a
            else:
                rest.append(a)
            k += 1
    return path, rest, method


def actions(command: str, base: str | None, env_repo: str | None = None) -> list[dict]:
    """One dict per merge in the command: dir, args, repo, selector and kind.

    kind is pr-merge (`gh pr merge`), api-merge (`gh api .../pulls/<n>/merge`, not an explicit GET)
    or graphql-merge (`gh api graphql` with a merge mutation). dir is None when the directory cannot
    be resolved statically (a variable, pushd). A help request is skipped.
    """
    cur = base
    found: list[dict] = []
    command, bodies = substitutions(strip_heredocs(command))
    for body in bodies:
        found.extend(actions(body, cur, env_repo))
    for segment in split_segments(command):
        toks = _tokens(segment)
        if not toks:
            continue
        if toks[0] == "cd":
            cur = _resolve(cur, toks[1]) if len(toks) > 1 and toks[1] != "-" else cur
            continue
        if toks[0] in ("pushd", "popd"):
            cur = None
            continue
        if toks[0] == "export":  # `export GH_REPO=o/r && gh pr merge 42` carries to the later segments
            for t in toks[1:]:
                if t.startswith("GH_REPO=") and t.split("=", 1)[1]:
                    env_repo = t.split("=", 1)[1]
            continue
        i = skip_wrappers(toks)
        if i >= len(toks):
            continue
        seg_repo = env_repo
        for t in toks[:i]:
            if t.startswith("GH_REPO="):
                seg_repo = t.split("=", 1)[1] or env_repo
        name = os.path.basename(toks[i])
        if name in SHELLS:
            for j in range(i + 1, len(toks) - 1):
                if SHELL_C_RE.match(toks[j]):
                    found.extend(actions(toks[j + 1], cur, seg_repo))
                    break
            continue
        if name == "eval":
            found.extend(actions(" ".join(toks[i + 1 :]), cur, seg_repo))
            continue
        if name == "xargs":
            j = i + 1
            while j < len(toks) and toks[j].startswith("-"):
                j += 2 if toks[j] in XARGS_VALUE else 1
            if j < len(toks):
                found.extend(actions(shlex.join(toks[j:]), cur, seg_repo))
            continue
        if name != "gh":
            continue
        i += 1
        pre_repo = None
        while i < len(toks) and toks[i].startswith("-"):
            if toks[i] in ("-R", "--repo") and i + 1 < len(toks):
                pre_repo = toks[i + 1]
            elif toks[i].startswith("--repo="):
                pre_repo = toks[i].split("=", 1)[1]
            i += 2 if toks[i] in ("-R", "--repo") else 1
        if i + 1 < len(toks) and toks[i] == "pr" and toks[i + 1] == "merge":
            args = toks[i + 2 :]
            if not any(a in ("--help", "-h") for a in args):
                found.append({"dir": cur, "args": args, "kind": "pr-merge", "selector": merge_selector(args),
                              "repo": repo_flag(args) or pre_repo or seg_repo})
        elif i < len(toks) and toks[i] == "api":
            args = toks[i + 1 :]
            path, rest, method = api_parts(args)
            if path == "graphql":
                if any(m in a for a in rest for m in GRAPHQL_MERGES):
                    found.append({"dir": cur, "args": args, "kind": "graphql-merge", "selector": "", "repo": None})
                continue
            m = API_MERGE_RE.search(path)
            if m and method != "GET":
                owner, name_, number = m.groups()
                repo = None if (owner, name_) == ("{owner}", "{repo}") else f"{owner}/{name_}"
                found.append({"dir": cur, "args": rest, "kind": "api-merge", "selector": number,
                              "repo": repo or pre_repo or seg_repo})
    return found


def pinned_shas(args: list[str], kind: str = "pr-merge") -> list[str]:
    """Every pin given to the merge, in order (empty string when the value is missing).

    `gh pr merge` pins with --match-head-commit; a `gh api` merge pins with a sha field.
    """
    found: list[str] = []
    if kind == "api-merge":
        for k, a in enumerate(args):
            if a in ("-f", "-F", "--field", "--raw-field") and k + 1 < len(args) and args[k + 1].startswith("sha="):
                found.append(args[k + 1][4:])
            elif a.startswith(("--field=", "--raw-field=")) and a.split("=", 1)[1].startswith("sha="):
                found.append(a.split("=", 2)[2])
        return found
    for k, a in enumerate(args):
        if a == "--match-head-commit":
            found.append(args[k + 1] if k + 1 < len(args) else "")
        elif a.startswith("--match-head-commit="):
            found.append(a.split("=", 1)[1])
    return found


# ---------------------------------------------------------------------------
# Classifier and decision
# ---------------------------------------------------------------------------


class CouldNotRun(Exception):
    pass


class Deadline(BaseException):
    """BaseException so no `except Exception` on the way (surface loader, classifier) swallows it."""


def load_classifier():
    path = os.path.join(HERE, "risk-classify.py")
    try:
        spec = importlib.util.spec_from_file_location("risk_classify", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception as e:
        raise CouldNotRun(f"classifier not loadable: {type(e).__name__}")


def run_git(root: str, *args: str, timeout: float = 5) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", root, *args], capture_output=True, text=True, timeout=timeout,
                          errors="replace", env={**os.environ, "GIT_OPTIONAL_LOCKS": "0", "GIT_TERMINAL_PROMPT": "0"})


def repo_root(directory: str | None) -> str:
    if directory is None:
        raise CouldNotRun("the directory of gh pr merge could not be resolved")
    if not os.path.isdir(directory):
        raise CouldNotRun("the target directory does not exist")
    try:
        r = run_git(directory, "rev-parse", "--show-toplevel")
    except subprocess.TimeoutExpired:
        raise CouldNotRun("git timed out")
    except Exception:
        raise CouldNotRun("git could not be run")
    root = r.stdout.strip()
    if r.returncode != 0 or not root:
        raise CouldNotRun("not a git repository")
    return root


def resolve_pr(root: str, selector: str, repo: str | None) -> tuple[str, str, int]:
    """(base, head, number) of the PR the merge names, read through `gh pr view`."""
    cmd = ["gh", "pr", "view"] + ([selector] if selector else []) + [
        "--json", "number,headRefOid,baseRefName,baseRefOid,headRepository"] + (["-R", repo] if repo else [])
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=5, errors="replace", cwd=root,
                           env={**os.environ, "GH_PROMPT_DISABLED": "1"})
    except subprocess.TimeoutExpired:
        raise CouldNotRun("gh timed out")
    except OSError:
        raise CouldNotRun("gh not found")
    if r.returncode != 0:
        raise CouldNotRun(f"gh exited {r.returncode}")
    import json
    try:
        data = json.loads(r.stdout)
    except ValueError:
        raise CouldNotRun("gh output not JSON")
    head = data.get("headRefOid") if isinstance(data, dict) else None
    number = data.get("number") if isinstance(data, dict) else None
    base_name = data.get("baseRefName") if isinstance(data, dict) else None
    if (not isinstance(head, str) or not re.fullmatch(r"[0-9a-fA-F]{40,64}", head)
            or isinstance(number, bool) or not isinstance(number, int)
            or not isinstance(base_name, str) or not base_name):
        raise CouldNotRun("PR head missing")
    head = head.lower()
    try:
        if run_git(root, "cat-file", "-e", f"{head}^{{commit}}").returncode != 0:
            # the one write this gate makes: objects and FETCH_HEAD, never the tree or the branch
            try:
                f = run_git(root, "fetch", "--no-tags", "origin", f"pull/{number}/head", timeout=8)
            except subprocess.TimeoutExpired:
                raise CouldNotRun("fetch failed")
            if f.returncode != 0:
                raise CouldNotRun("fetch failed")
            if run_git(root, "cat-file", "-e", f"{head}^{{commit}}").returncode != 0:
                raise CouldNotRun("head not found after fetch")
        base_oid = data.get("baseRefOid")
        if isinstance(base_oid, str) and re.fullmatch(r"[0-9a-fA-F]{40,64}", base_oid):
            # classify against the base tip GitHub reports, never a stale local copy of the base
            base_oid = base_oid.lower()
            if run_git(root, "cat-file", "-e", f"{base_oid}^{{commit}}").returncode != 0:
                try:
                    f = run_git(root, "fetch", "--no-tags", "origin", f"refs/heads/{base_name}", timeout=8)
                except subprocess.TimeoutExpired:
                    raise CouldNotRun("base fetch failed")
                if f.returncode != 0 or run_git(root, "cat-file", "-e", f"{base_oid}^{{commit}}").returncode != 0:
                    raise CouldNotRun("base fetch failed")
            return base_oid, head, number
        for cand in (f"origin/{base_name}", base_name):
            if run_git(root, "rev-parse", "--verify", "-q", f"{cand}^{{commit}}").returncode == 0:
                return cand, head, number
    except subprocess.TimeoutExpired:
        raise CouldNotRun("git timed out")
    raise CouldNotRun(f"base {base_name} not found")


def classify_dir(directory: str | None, selector: str = "", repo: str | None = None, kind: str = "pr-merge") -> dict:
    if kind == "graphql-merge":
        raise CouldNotRun("a GraphQL merge names its PR by node id and cannot be read")
    root = repo_root(directory)
    base, head, number = resolve_pr(root, selector, repo)
    mod = load_classifier()
    try:
        res = mod.classify(root, base, head)
    except getattr(mod, "CouldNotRun") as e:
        raise CouldNotRun(str(e) or "classifier could not run")
    res["pr"] = number
    return res


def summary(res: dict) -> str:
    lines = [f"tier {res['tier']}"]
    for s in res.get("signals", []):
        ev = ", ".join(s.get("evidence", [])[:3])
        lines.append(f"signal {s['id']} ({s['floor']}, {s['strength']}) {ev}: {s['reason']}")
    for f in res.get("findings", []):
        lines.append(f"finding: {f}")
    if res.get("tie"):
        lines.append(f"tie: {res['tie']}")
    return "; ".join(lines)


# rank: 0 allow quiet, 1 message (warn), 2 ask, 3 deny
def decide(hit: dict, enforcing: bool, permission_mode: str, cwd: str) -> tuple[int, str]:
    args = hit["args"]
    unknown = None
    res = None
    try:
        res = classify_dir(hit["dir"], hit["selector"], hit["repo"], hit["kind"])
    except CouldNotRun as e:
        unknown = str(e)
    if res is not None and res.get("tier") == "low":
        return 0, ""

    no_prompt = permission_mode in NO_PROMPT_MODES
    if unknown is not None:
        log(HOOK, "could-not-run", f"{unknown} (treated as high)", cwd)
        head_note = ""
        ident = ""
        body = f"tier unknown, treated as high: the classifier could not run ({unknown})."
        tier = "high"
    else:
        tier = res["tier"]
        head = res["head"]
        pins = pinned_shas(args, hit["kind"])
        flag = f"-f sha={head}" if hit["kind"] == "api-merge" else f"--match-head-commit {head}"
        what = "sha field" if hit["kind"] == "api-merge" else "--match-head-commit"
        if len({p.lower() for p in pins}) > 1:
            msg = (f"[{HOOK}] {tier} risk merge of PR {res['pr']} has several different pins ({', '.join(pins)}); "
                   f"the last one wins. Give one, {flag}. {summary(res)}")
            if enforcing:
                log(HOOK, "deny", f"{tier} several pins PR {res['pr']} {head[:8]}", cwd)
                return 3, msg
            log(HOOK, "warn", f"{tier} several pins PR {res['pr']} {head[:8]}", cwd)
            return 1, msg + " (warn mode: allowed)"
        sha = pins[-1] if pins else None
        valid = (sha is not None and re.fullmatch(r"[0-9a-fA-F]{7,64}", sha) is not None
                 and head.startswith(sha.lower()))
        if not valid:
            why = f"has no {what}" if sha is None else f"has {what} {sha!r}, which is not the head of PR {res['pr']} ({head[:8]})"
            auto = " With --auto, GitHub refuses the merge if a later push changes the head." if "--auto" in args else ""
            msg = f"[{HOOK}] {tier} risk merge of PR {res['pr']} {why}. Add {flag} so GitHub refuses the merge if the PR has moved.{auto} {summary(res)}"
            if enforcing:
                log(HOOK, "deny", f"{tier} PR {res['pr']} pin {head[:8]}", cwd)
                return 3, msg
            log(HOOK, "warn", f"{tier} PR {res['pr']} pin missing {head[:8]}", cwd)
            return 1, msg + " (warn mode: allowed)"
        ident = f" PR {res['pr']} {head[:8]}"
        head_note = f" PR {res['pr']} head {head}."
        body = summary(res)

    text = f"[{HOOK}] {body}{head_note} This approval covers this commit only."
    if unknown is not None:
        text = f"[{HOOK}] {body} This approval covers whatever the PR head is when it merges."
    if enforcing:
        if no_prompt:
            log(HOOK, "deny", f"{tier} {permission_mode}{ident}", cwd)
            return 3, (f"[{HOOK}] {tier} risk merge: approval needs a prompt and this session cannot show one "
                       f"(permission_mode {permission_mode}). Rerun in default mode or merge by hand after review. {text}")
        log(HOOK, "ask", f"{tier}{ident}", cwd)
        return 2, text
    log(HOOK, "warn", f"{tier}" + (" unknown" if unknown else "") + ident, cwd)
    return 1, text + " (warn mode: allowed)"


def emit(rank: int, text: str) -> None:
    if rank == 3 or rank == 2:
        print(json_dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                                 "permissionDecision": "deny" if rank == 3 else "ask",
                                                 "permissionDecisionReason": text}}))
    elif rank == 1:
        print(json_dumps({"systemMessage": text,
                          "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": text}}))


def json_dumps(o) -> str:
    import json
    return json.dumps(o)


def main_hook() -> int:
    import json
    raw = sys.stdin.read()
    if not raw.strip():
        return 0
    try:
        payload = json.loads(raw)
    except Exception:
        payload = None
    if not isinstance(payload, dict):
        log(HOOK, "could-not-run", "unreadable hook payload (allowed)", os.getcwd())
        return 0
    inp = payload.get("tool_input")
    command = inp.get("command") if isinstance(inp, dict) else None
    if not isinstance(command, str) or "gh" not in command or "merge" not in command.lower():
        return 0
    cwd = payload.get("cwd") if isinstance(payload.get("cwd"), str) and payload.get("cwd") else os.getcwd()
    hits = actions(command, cwd, os.environ.get("GH_REPO") or None)
    if not hits:
        return 0
    pm = payload.get("permission_mode")
    pm = pm if isinstance(pm, str) else ""
    enforcing = mode(HOOK) == "enforce"

    def on_alarm(signum, frame):
        raise Deadline()

    signal.signal(signal.SIGALRM, on_alarm)
    signal.setitimer(signal.ITIMER_REAL, DEADLINE)
    best = (0, "")
    try:
        for hit in hits:
            got = decide(hit, enforcing, pm, cwd)
            if got[0] > best[0]:
                best = got
    except Deadline:
        log(HOOK, "could-not-run", "deadline reached (treated as high)", cwd)
        text = f"[{HOOK}] tier unknown, treated as high: the classifier took longer than {DEADLINE} seconds."
        if enforcing and pm in NO_PROMPT_MODES:
            best = (3, f"[{HOOK}] high risk merge: approval needs a prompt and this session cannot show one "
                       f"(permission_mode {pm}). Rerun in default mode or merge by hand after review. {text}")
        else:
            best = (2, text) if enforcing else (1, text + " (warn mode: allowed)")
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
    emit(*best)
    return 0


def main() -> int:
    try:
        return main_hook()
    except Exception as e:  # never crash the turn
        log(HOOK, "could-not-run", f"internal error: {e}", os.getcwd())
        return 0


if __name__ == "__main__":
    sys.exit(main())
