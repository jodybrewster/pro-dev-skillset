#!/usr/bin/env python3
"""Say which env keys are set, never what they hold.

  python3 env-check.py [--file <dotenv>] KEY [KEY ...]

The secret-read guard flags `cat .env`, `grep KEY .env` and the Read tool on a
dotenv file, because each one puts the values in the transcript. This script is
the way to ask whether a key is set: it reads the file itself and prints one
word per key, so no value reaches stdout, stderr or the transcript. The guard
allows a plain call to it.

--file defaults to the first of .env.local and .env that exists in the working
directory; with neither, every key is missing. It reads `KEY=value` and
`export KEY=value` lines, skips lines whose first non-blank character is `#` and
counts a value that is blank once quotes and blanks are trimmed as empty. The
last assignment of a key wins.

Stdout, one line per key:  KEY present | KEY empty | KEY missing
Exit: 0 every key present, 1 any key empty or missing, 64 usage.
An unreadable file reads as every key missing (exit 1) with one stderr line
that names the path and nothing from the file.

Standard library only (Python 3.9).
"""
from __future__ import annotations

import os
import re
import sys
from typing import Dict, List, Optional, Tuple

USAGE = "usage: env-check.py [--file <dotenv>] KEY [KEY ...]"
KEY_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\Z")
LINE_RE = re.compile(r"(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=(.*)\Z")
DEFAULTS = (".env.local", ".env")


def usage(problem: str) -> int:
    print(f"env-check: {problem}", file=sys.stderr)
    print(USAGE, file=sys.stderr)
    return 64


def parse_args(argv: List[str]) -> Tuple[Optional[str], List[str], Optional[str]]:
    """Return (file, keys, problem). problem names only the user's own argument."""
    path: Optional[str] = None
    keys: List[str] = []
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--file":
            if i + 1 >= len(argv) or not argv[i + 1]:
                return None, [], "--file needs a path"
            path = argv[i + 1]
            i += 2
            continue
        if arg.startswith("--file="):
            path = arg[len("--file="):]
            if not path:
                return None, [], "--file needs a path"
        elif arg.startswith("-"):
            return None, [], f"unknown option: {arg}"
        elif not KEY_RE.match(arg):
            return None, [], f"invalid key name: {arg}"
        else:
            keys.append(arg)
        i += 1
    if not keys:
        return None, [], "no key names given"
    return path, keys, None


def state_of(raw: str) -> str:
    """present or empty for the text after `=`. Only the word leaves this function."""
    if re.match(r"[ \t]+#", raw):
        return "empty"  # `KEY= # note`: dotenv reads an inline comment as no value
    value = raw.strip(" \t\r\n\"'")
    return "present" if value else "empty"


def read_states(path: str) -> Dict[str, str]:
    states: Dict[str, str] = {}
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.lstrip(" \t")
            if not line or line.startswith("#"):
                continue
            m = LINE_RE.match(line.rstrip("\r\n"))
            if m:
                states[m.group(1)] = state_of(m.group(2))
    return states


def main(argv: List[str]) -> int:
    if argv and argv[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0
    path, keys, problem = parse_args(argv)
    if problem:
        return usage(problem)
    if path is None:
        path = next((p for p in DEFAULTS if os.path.isfile(p)), None)
    states: Dict[str, str] = {}
    if path is not None:
        try:
            states = read_states(path)
        except (OSError, ValueError):
            print(f"env-check: cannot read {path}", file=sys.stderr)
            states = {}
    rc = 0
    for key in keys:
        state = states.get(key, "missing")
        print(f"{key} {state}")
        if state != "present":
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))


# Adapted from super-board scripts/super-board-env-check.sh, MIT,
# Copyright (c) 2026 Eric Tech. See docs/licenses.md.
