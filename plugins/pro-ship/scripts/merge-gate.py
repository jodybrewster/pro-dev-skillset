#!/usr/bin/env python3
"""PreToolUse Bash hook - the merge gate.

Before `gh pr merge` it classifies the local HEAD of the repo the command targets with
risk-classify.py (a sibling script) and decides by tier. It never reads a tier from a
stamp or a label.
  low          allows with no output.
  medium/high  needs `--match-head-commit <sha>` (full sha or a prefix of 7 or more hex
               characters) that matches HEAD. Without it: enforce denies and names the flag;
               warn allows with a message. With it: enforce returns permissionDecision "ask"
               with the tier, signals, findings and HEAD sha; warn logs, shows the same text
               as a systemMessage and allows.
  could not run (no git, no merge base, empty range, timeout, deadline) counts as high and
               logs could-not-run; enforce asks, warn says the tier is unknown.
  NO_PROMPT_MODES  in enforce, medium and high deny instead of ask, because an ask may not
               prompt there. Nothing else (env var, flag, file, stamp) clears an ask.
Mode: mode.merge-gate, then mode, in CLAUDE_GUARD_DIR or ~/.claude/hooks (default warn).
A malformed payload exits 0 with no output. No network calls; nothing from the payload is
executed. The gate answers within 20 seconds, before the hook's 30 second timeout.
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
# permission_mode values in which a hook "ask" is not known to prompt. Checked against Claude
# Code docs on 2026-10-30: the docs do not say, so these deny (step 15 may relax this).
NO_PROMPT_MODES = {"bypassPermissions", "dontAsk", "auto"}
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


def actions(command: str, base: str | None) -> list[tuple[str | None, list[str]]]:
    """(directory, args after `merge`) for each `gh pr merge` in the command.

    A directory that cannot be resolved statically (a variable, pushd) is None.
    A help request is skipped.
    """
    cur = base
    found: list[tuple[str | None, list[str]]] = []
    command, bodies = substitutions(strip_heredocs(command))
    for body in bodies:
        found.extend(actions(body, cur))
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
        i = skip_wrappers(toks)
        if i >= len(toks):
            continue
        name = os.path.basename(toks[i])
        if name in SHELLS:
            for j in range(i + 1, len(toks) - 1):
                if SHELL_C_RE.match(toks[j]):
                    found.extend(actions(toks[j + 1], cur))
                    break
            continue
        if name == "eval":
            found.extend(actions(" ".join(toks[i + 1 :]), cur))
            continue
        if name == "xargs":
            j = i + 1
            while j < len(toks) and toks[j].startswith("-"):
                j += 2 if toks[j] in XARGS_VALUE else 1
            if j < len(toks):
                found.extend(actions(shlex.join(toks[j:]), cur))
            continue
        if name != "gh":
            continue
        i += 1
        while i < len(toks) and toks[i].startswith("-"):
            i += 2 if toks[i] in ("-R", "--repo") else 1
        if i + 1 < len(toks) and toks[i] == "pr" and toks[i + 1] == "merge":
            args = toks[i + 2 :]
            if not any(a in ("--help", "-h") for a in args):
                found.append((cur, args))
    return found


def pinned_shas(args: list[str]) -> list[str]:
    """Every value given to --match-head-commit, in order (empty string when the value is missing)."""
    found: list[str] = []
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


def classify_dir(directory: str | None) -> dict:
    if directory is None:
        raise CouldNotRun("the directory of gh pr merge could not be resolved")
    if not os.path.isdir(directory):
        raise CouldNotRun("the target directory does not exist")
    try:
        r = subprocess.run(["git", "-C", directory, "rev-parse", "--show-toplevel"], capture_output=True,
                           text=True, timeout=5, errors="replace", env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"})
    except subprocess.TimeoutExpired:
        raise CouldNotRun("git timed out")
    except Exception:
        raise CouldNotRun("git could not be run")
    root = r.stdout.strip()
    if r.returncode != 0 or not root:
        raise CouldNotRun("not a git repository")
    mod = load_classifier()
    try:
        return mod.classify(root, None, "HEAD")
    except getattr(mod, "CouldNotRun") as e:
        raise CouldNotRun(str(e) or "classifier could not run")


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
def decide(directory: str | None, args: list[str], enforcing: bool, permission_mode: str, cwd: str) -> tuple[int, str]:
    unknown = None
    res = None
    try:
        res = classify_dir(directory)
    except CouldNotRun as e:
        unknown = str(e)
    if res is not None and res.get("tier") == "low":
        return 0, ""

    no_prompt = permission_mode in NO_PROMPT_MODES
    if unknown is not None:
        log(HOOK, "could-not-run", f"{unknown} (treated as high)", cwd)
        head_note = ""
        body = f"tier unknown, treated as high: the classifier could not run ({unknown})."
        tier = "high"
    else:
        tier = res["tier"]
        head = res["head"]
        pins = pinned_shas(args)
        if len({p.lower() for p in pins}) > 1:
            msg = (f"[{HOOK}] {tier} risk merge has several different --match-head-commit values ({', '.join(pins)}); "
                   f"gh uses the last one. Give one, --match-head-commit {head}. {summary(res)}")
            if enforcing:
                log(HOOK, "deny", f"{tier} several pins", cwd)
                return 3, msg
            log(HOOK, "warn", f"{tier} several pins", cwd)
            return 1, msg + " (warn mode: allowed)"
        sha = pins[-1] if pins else None
        valid = (sha is not None and re.fullmatch(r"[0-9a-fA-F]{7,64}", sha) is not None
                 and head.startswith(sha.lower()))
        flag = f"--match-head-commit {head}"
        if not valid:
            why = "has no --match-head-commit" if sha is None else f"has --match-head-commit {sha!r}, which is not HEAD {head[:8]}"
            msg = f"[{HOOK}] {tier} risk merge {why}. Add {flag} so GitHub refuses the merge if the PR has moved. {summary(res)}"
            if enforcing:
                log(HOOK, "deny", f"{tier} pin {head[:8]}", cwd)
                return 3, msg
            log(HOOK, "warn", f"{tier} pin missing {head[:8]}", cwd)
            return 1, msg + " (warn mode: allowed)"
        head_note = f" HEAD {head}."
        body = summary(res)

    text = f"[{HOOK}] {body}{head_note} This approval covers this commit only."
    if unknown is not None:
        text = f"[{HOOK}] {body} This approval covers whatever the PR head is when it merges."
    if enforcing:
        if no_prompt:
            log(HOOK, "deny", f"{tier} {permission_mode}", cwd)
            return 3, (f"[{HOOK}] {tier} risk merge: approval needs a prompt and this session cannot show one "
                       f"(permission_mode {permission_mode}). Rerun in default mode or merge by hand after review. {text}")
        log(HOOK, "ask", f"{tier}", cwd)
        return 2, text
    log(HOOK, "warn", f"{tier}" + (" unknown" if unknown else ""), cwd)
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
    if not isinstance(command, str) or "gh" not in command or "merge" not in command:
        return 0
    cwd = payload.get("cwd") if isinstance(payload.get("cwd"), str) and payload.get("cwd") else os.getcwd()
    hits = actions(command, cwd)
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
        for directory, args in hits:
            got = decide(directory, args, enforcing, pm, cwd)
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
