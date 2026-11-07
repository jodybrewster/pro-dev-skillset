#!/usr/bin/env python3
"""PreToolUse(Read|Grep|Bash) guard: flag a read of a file that holds secrets.

A read of a dotenv file, a private SSH key, a .pem file, .npmrc, a credentials
file or a service-account JSON puts its values in the transcript. This guard
watches the Read tool's file_path, the Grep tool's path and glob and, on Bash,
the reader commands (cat, less, more, head, tail, sed, grep, egrep, fgrep, rg),
input redirects and xargs pipelines that feed a reader.

It flags under its own `secret-read` mode key (guardlib.own_mode): warn by
default, deny only when `mode.secret-read` in the guard folder says enforce.
The global `mode` file and CLAUDE_GUARD_MODE leave it in warn (ADR-0016).

Always allowed: .env.example, .env.sample and .env.template (how an agent
learns the key names), `source` and `.` of a dotenv file (they load values
without printing them) and a plain call to env-check.py, which says whether a
key is set and never prints its value.

It matches names only: a glob is never expanded, a broad glob such as `*` or
`*.json` is not a finding and the guard opens no file but its own mode file.
It runs no subprocess, makes no network call, logs only the tool, the kind of
file and its basename and exits 0 with no output on a malformed payload or any
error of its own.

Standard library only (Python 3.9).
"""
from __future__ import annotations

import json
import os
import re
import sys
from typing import List, Optional, Tuple

HOOK = "secret-read"
ENV_CHECK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "env-check.py")

READERS = {"cat", "less", "more", "head", "tail", "sed", "grep", "egrep", "fgrep", "rg"}
PATTERN_FIRST = {"sed", "grep", "egrep", "fgrep", "rg"}
# Options that supply the pattern or script, so no positional word is the pattern.
PATTERN_OPTS = {"-e", "-f", "--regexp", "--file", "--expression"}
PREFIXES = {"command", "exec", "nohup", "time", "sudo", "env", "nice"}
# Runner flags that take the next word as their value: `sudo -u deploy`, `nice -n 10`.
RUNNER_VALUE_FLAGS = {
    "sudo": {"-u", "-g", "-h", "-p", "-C", "-D", "-r", "-t", "-U", "-T", "--user", "--group", "--host",
             "--prompt", "--close-from", "--chdir", "--role", "--type", "--other-user", "--command-timeout"},
    "env": {"-u", "-C", "-S", "--unset", "--chdir", "--split-string"},
    "nice": {"-n", "--adjustment"},
    "time": {"-o", "-f", "--output", "--format"},
}
DOTENV_TEMPLATES = {".env.example", ".env.sample", ".env.template"}
CREDENTIAL_EXTS = {"json", "yml", "yaml", "ini", "toml", "txt"}
GLOB_CHARS = "*?["
BRACE = re.compile(r"\{([^{}]*)\}")
# grep and rg options whose value is a file glob (judged like a file word) and
# options that take a value that is neither the pattern nor a file.
GLOB_OPTS = {"--include", "-g", "--glob"}
VALUE_OPTS = {"-A", "-B", "-C", "-m", "--max-count", "--exclude", "--exclude-dir", "-t", "--type", "--type-not"}
SHELLS = {"bash", "sh", "zsh", "dash", "ksh"}
# Cheap pre-filter (N1): a Bash command that holds none of these is never parsed.
HINTS = (".env", ".dev.vars", "id_", ".pem", ".npmrc", "credentials", "service-account")
ASSIGN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*=")
ENV_CHECK_CALL = re.compile(r"\s*(?:\S*/)?python3?\s+\S*env-check\.py(?:\s|$)|\s*\S*env-check\.py(?:\s|$)")


def basename(path: str) -> str:
    return path.rstrip("/").rsplit("/", 1)[-1]


def _ext(name: str) -> Optional[str]:
    """The text after the last dot, or None when the name has no extension."""
    stem = name.lstrip(".")
    return stem.rsplit(".", 1)[1].lower() if "." in stem else None


def secret_kind(path: str) -> Optional[str]:
    """R2: the kind of secret file a concrete path names, or None."""
    name = basename(path)
    if not name:
        return None
    if name == ".env" or (name.startswith(".env.") and name not in DOTENV_TEMPLATES):
        return "a dotenv file"
    if name == ".dev.vars" or name.startswith(".dev.vars."):
        return "a dev vars file"
    if name.startswith("id_") and "." not in name:
        return "a private SSH key"
    if name.lower().endswith(".pem"):
        return "a PEM file"
    if name == ".npmrc":
        return "an .npmrc file"
    if name.startswith("credentials") and ("." not in name or _ext(name) in CREDENTIAL_EXTS):
        return "a credentials file"
    if "service-account" in name and name.lower().endswith(".json"):
        return "a service-account file"
    return None


def glob_kind(word: str) -> Optional[str]:
    """R3: the kind a glob names when its last component has a literal secret prefix or suffix."""
    name = basename(word)
    first = min(name.find(c) for c in GLOB_CHARS if c in name)
    last = max(name.rfind(c) for c in GLOB_CHARS)
    prefix, suffix = name[:first], name[last + 1:]
    suffix_ext = suffix.rsplit(".", 1)[1].lower() if "." in suffix else None
    if prefix == ".env" or prefix.startswith(".env."):
        return "a dotenv file"
    if prefix.startswith(".dev.vars"):
        return "a dev vars file"
    if prefix.startswith("id_") and "." not in prefix + suffix:
        return "a private SSH key"
    if prefix.startswith("credentials") and (suffix_ext is None or suffix_ext in CREDENTIAL_EXTS):
        if "." not in prefix or _ext(prefix) in CREDENTIAL_EXTS:
            return "a credentials file"
    if suffix.lower().endswith(".pem"):
        return "a PEM file"
    return None


BRACE_LIMIT = 64


def _alternatives(word: str) -> List[str]:
    """Expand brace alternatives: `.env{,.local}` is `.env` and `.env.local`.

    Expansion counts as it goes and stops at BRACE_LIMIT words and as many
    pending ones, so five groups of thirty options never expand in full.
    """
    out: List[str] = []
    todo = [word]
    while todo and len(out) < BRACE_LIMIT:
        cur = todo.pop()
        # A group with no comma (`${APP_DIR}`, xargs `{}`) is not a list: look past it.
        m = next((g for g in BRACE.finditer(cur) if "," in g.group(1)), None)
        if not m:
            out.append(cur)
            continue
        room = max(BRACE_LIMIT - len(todo), 1)
        alts = m.group(1).split(",")[:room]  # keep the first alternatives when capped
        for alt in reversed(alts):
            todo.append(cur[: m.start()] + alt + cur[m.end():])
    return out


def word_kind(word: str) -> Optional[str]:
    """The last path component decides on its own: R2 when it is concrete, R3 when it is a glob.

    A glob in a folder part, such as `apps/*/.env` or `**/.env`, does not change
    the call; brace alternatives are each judged as a last component.
    """
    if not word:
        return None
    for alt in _alternatives(word):  # a brace list may hold a slash: expand, then take the basename
        name = basename(alt)
        kind = glob_kind(name) if any(c in name for c in GLOB_CHARS) else secret_kind(name)
        if kind:
            return kind
    return None


# ── Bash ────────────────────────────────────────────────────────────────────

def _chunks(command: str) -> List[str]:
    """Split at ; && || & and newlines outside quotes, keeping each pipeline whole."""
    out: List[str] = []
    cur = ""
    quote = ""
    i, n = 0, len(command)
    while i < n:
        c = command[i]
        if quote:
            if c == quote:
                quote = ""
            elif c == "\\" and quote == '"' and i + 1 < n:
                cur += c
                i += 1
                c = command[i]
            cur += c
        elif c in "'\"":
            quote = c
            cur += c
        elif c == "\\" and i + 1 < n:
            cur += c + command[i + 1]
            i += 1
        elif c in ";\n":
            out.append(cur)
            cur = ""
        elif c == "|" and i + 1 < n and command[i + 1] == "|":
            out.append(cur)
            cur = ""
            i += 1
        elif c == "&":
            prev = command[i - 1] if i else ""
            nxt = command[i + 1] if i + 1 < n else ""
            if nxt == "&":
                out.append(cur)
                cur = ""
                i += 1
            elif prev in "<>|" or nxt == ">":
                cur += c  # 2>&1, >&2, |& and &> are redirects, not separators
            else:
                out.append(cur)
                cur = ""
        else:
            cur += c
        i += 1
    out.append(cur)
    return [c for c in out if c.strip()]


def _strip_prefix(tokens: List[str]) -> List[str]:
    """Skip `VAR=value` words and runners such as sudo, env and nohup with their flags."""
    i = 0
    while i < len(tokens):
        if ASSIGN.match(tokens[i]):
            i += 1
        elif basename(tokens[i]) in PREFIXES:
            takes = RUNNER_VALUE_FLAGS.get(basename(tokens[i]), set())
            i += 1
            while i < len(tokens) and tokens[i].startswith("-"):
                i += 2 if tokens[i] in takes else 1
        else:
            break
    return tokens[i:]


def _is_redirect(tok: str) -> bool:
    return bool(re.match(r"\d*(?:<|>)", tok))


def _input_redirects(tokens: List[str]) -> List[str]:
    """R7: the targets of `<` and `0<`, spaced or attached; heredocs and herestrings are not."""
    targets: List[str] = []
    for i, tok in enumerate(tokens):
        m = re.search(r"(?:^|[^<0-9])(?:0)?<(?!<)(.*)$", tok)
        if not m or "<<" in tok:
            continue
        rest = m.group(1)
        if rest.startswith("("):
            continue  # process substitution: its command is its own segment
        if rest:
            targets.append(rest)
        elif i + 1 < len(tokens):
            targets.append(tokens[i + 1])
    return targets


def _file_words(tokens: List[str]) -> List[str]:
    """R6: the words of a reader command that name files."""
    cmd = basename(tokens[0])
    words: List[str] = []
    globs: List[str] = []  # option values that name files: never the pattern
    pattern_given = False
    skip_next = False
    glob_next = False
    flags_done = False
    for tok in tokens[1:]:
        if glob_next:
            glob_next = False
            globs.append(tok)
            continue
        if skip_next:
            skip_next = False
            continue
        if _is_redirect(tok):
            skip_next = bool(re.fullmatch(r"\d*(?:<|>|>>|<<<?|&>|>&)", tok))
            continue
        if not flags_done and tok == "--":
            flags_done = True
            continue
        if not flags_done and tok.startswith("-") and tok != "-":
            if cmd not in PATTERN_FIRST:
                continue  # cat -e, tail -f: a flag of a plain reader never takes the pattern
            name, eq, value = tok.partition("=")
            if name in GLOB_OPTS:
                if eq:
                    globs.append(value)
                else:
                    glob_next = True
            elif name in VALUE_OPTS:
                skip_next = not eq
            elif tok in PATTERN_OPTS:
                pattern_given = True
                skip_next = True
            elif tok.startswith(("--regexp=", "--file=", "--expression=")) or re.match(r"-[A-Za-z]*[ef].", tok):
                pattern_given = True
            elif re.fullmatch(r"-[A-Za-z]*[ef]", tok):
                pattern_given = True  # `-ie KEY`: the last letter takes the next word
                skip_next = True
            continue
        words.append(tok)
    if cmd in PATTERN_FIRST and not pattern_given and words:
        words = words[1:]
    return words + globs


def _plain_env_check(command: str) -> bool:
    """R9: one env-check.py call with nothing chained, piped, redirected or substituted."""
    if any(s in command for s in ("|", ";", "&", "<", ">", "`", "$(", "\n")):
        return False
    return bool(ENV_CHECK_CALL.match(command))


def _substitutions(command: str) -> List[str]:
    """The text of each $(...) and backtick substitution outside single quotes, quoted or not."""
    out: List[str] = []
    quote = ""
    i, n = 0, len(command)
    while i < n:
        c = command[i]
        if quote == "'":
            if c == "'":
                quote = ""
        elif c == "\\" and i + 1 < n:
            i += 1
        elif c == "'" and not quote:
            quote = "'"
        elif c == '"':
            quote = "" if quote == '"' else '"'
        elif c == "$" and command[i + 1:i + 2] == "(" and command[i + 2:i + 3] != "(":
            depth, j = 1, i + 2
            while j < n and depth:
                depth += {"(": 1, ")": -1}.get(command[j], 0)
                j += 1
            out.append(command[i + 2:j - 1] if not depth else command[i + 2:])
            i = j - 1
        elif c == "`":
            j = command.find("`", i + 1)
            out.append(command[i + 1:] if j < 0 else command[i + 1:j])
            i = n if j < 0 else j
        i += 1
    return out


HEREDOC = re.compile(r"(?<!<)<<(-?)[ \t]*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\2")


def _drop_heredoc_bodies(command: str) -> str:
    """Remove the body lines of each heredoc: they are text for the command, not commands.

    A heredoc on a line where any stage runs a shell (`bash <<EOF`,
    `cat <<EOF | bash`, `cd app && sudo sh <<EOF`) keeps its body, since the
    shell runs it.
    """
    import guardlib

    lines = command.split("\n")
    out: List[str] = []
    ends: List[Tuple[str, bool]] = []
    for line in lines:
        if ends:
            word, dash = ends[0]
            if (line.lstrip("\t") if dash else line).rstrip("\r") == word:
                ends.pop(0)
            continue
        out.append(line)
        if "<<" not in line:
            continue
        stages = [_strip_prefix(t) for t in guardlib.segments(line)]
        if any(t and basename(t[0]) in SHELLS for t in stages):
            continue
        ends = [(m.group(3), m.group(1) == "-") for m in HEREDOC.finditer(line)]
    return "\n".join(out)


def bash_finding(command: str, depth: int = 0) -> Optional[Tuple[str, str]]:
    if not any(h in command for h in HINTS):
        return None
    if _plain_env_check(command):
        return None
    import guardlib  # segments() lives in the shared helper

    dropped = _drop_heredoc_bodies(command)
    if depth < 4:
        # Both texts: an apostrophe in a quoted heredoc body must not hide a later $(...).
        inners = _substitutions(command)
        inners += [t for t in _substitutions(dropped) if t not in inners]
        for inner in inners:
            hit = bash_finding(inner, depth + 1)
            if hit:
                return hit
    command = dropped
    for chunk in _chunks(command):
        stages = [_strip_prefix(t) for t in guardlib.segments(chunk)]
        stages = [s for s in stages if s]
        for tokens in stages:
            for target in _input_redirects(tokens):
                kind = word_kind(target)
                if kind:
                    return kind, basename(target)
            if basename(tokens[0]) in READERS:
                for word in _file_words(tokens):
                    kind = word_kind(word)
                    if kind:
                        return kind, basename(word)
        # R8: xargs feeding a reader reads whatever the pipeline names.
        feeds_reader = any(
            basename(t[0]) == "xargs" and any(basename(w) in READERS for w in t[1:]) for t in stages
        )
        if feeds_reader:
            for tokens in stages:
                for word in tokens:
                    kind = word_kind(word)
                    if kind:
                        return kind, basename(word)
    return None


# ── payload ─────────────────────────────────────────────────────────────────

def finding(payload: dict) -> Optional[Tuple[str, str, str]]:
    """(tool, kind, basename) for the first secret the call reads, or None."""
    tool = payload.get("tool_name")
    ti = payload.get("tool_input")
    if not isinstance(ti, dict):
        return None
    if tool == "Read":
        path = ti.get("file_path")
        if isinstance(path, str):
            kind = word_kind(path)
            if kind:
                return tool, kind, basename(path)
    elif tool == "Grep":
        for key in ("path", "glob"):
            word = ti.get(key)
            if isinstance(word, str):
                kind = word_kind(word)
                if kind:
                    return tool, kind, basename(word)
    elif tool == "Bash":
        command = ti.get("command")
        if isinstance(command, str):
            hit = bash_finding(command)
            if hit:
                return (tool,) + hit
    return None


def way_forward() -> str:
    return (
        "Its values would land in the transcript. "
        "Read .env.example for the key names, "
        f"run python3 {ENV_CHECK} KEY [KEY ...] to learn whether a key is set "
        "(it prints present, empty or missing and never a value), "
        "or ask the person to run the command themselves."
    )


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "null")
        if not isinstance(payload, dict):
            return 0
        sys.dont_write_bytecode = True
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        hit = finding(payload)
        if not hit:
            return 0
        tool, kind, name = hit
        import guardlib

        cwd = payload.get("cwd")
        if not isinstance(cwd, str):
            cwd = os.getcwd()
        summary = f"reading {kind} ({name})"
        detail = f"{tool} {kind} {name}"
        if guardlib.own_mode(HOOK) == "enforce":
            guardlib.deny(HOOK, f"Blocked: {summary}. {way_forward()}", detail, cwd)
        else:
            guardlib.warn(HOOK, summary, detail, cwd, way_forward())
    except Exception:
        pass  # fail open: the guard's own error never blocks a tool call
    return 0


if __name__ == "__main__":
    sys.exit(main())


# The secret path set and the plain env-check exemption are adapted from
# super-board hooks/guard-secrets.py, MIT, Copyright (c) 2026 Eric Tech.
# See docs/licenses.md.
