#!/usr/bin/env python3
"""visual - record one visual check of a UI step for /execute.

  visual.py record --intent <dir> --step <n> --viewport desktop|mobile --status pass|fail|partial|info
                   [--shot <png>] [--url <url>] [--differences <json file>] [--console-errors N]
                   [--console-warnings N] [--title T] [--mock M]

Writes the visual_drift / ui-step manifest of docs/loop-records.md "The visual check" through
evidence.py: .pro-dev/visual/<evidence_key>.json with the screenshot beside it as <evidence_key>.png.
The screenshot is copied after it is checked, so what is recorded is a PNG this script has read,
never a path the caller named. Only the manifest goes to .mieruka/; the PNG can show real data
and stays local.

Exit 0 on success, 1 on a refusal (message on stderr). Python 3 standard library only. No network calls.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import stat
import sys
from urllib.parse import urlsplit

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import evidence  # noqa: E402
from evidence import Refuse  # noqa: E402

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_SHOT = 10 * 1024 * 1024
MAX_DIFFERENCES = 1024 * 1024
WIDTHS = {"desktop": 1280, "mobile": 390}
LOCAL_HOSTS = ("localhost", "127.0.0.1", "::1")


def check_url(url: str) -> str:
    try:
        p = urlsplit(url)
        host = p.hostname
        p.port  # noqa: B018 - raises on a bad port
    except ValueError:
        raise Refuse(f"visual: refusing the url {url!r}: it does not parse")
    if p.scheme not in ("http", "https") or host not in LOCAL_HOSTS or "@" in p.netloc:
        raise Refuse(f"visual: refusing the url {url!r}: only http(s) on localhost, 127.0.0.1 or [::1] can be captured")
    return url


def check_mock(root: str, mock: str) -> str:
    if mock.lower().startswith(("http://", "https://")):
        try:
            p = urlsplit(mock)
            ok = bool(p.hostname) and "@" not in p.netloc
        except ValueError:
            ok = False
        if not ok:
            raise Refuse(f"visual: refusing the mock {mock!r}: it is not a plain http(s) URL")
        return mock
    if "://" in mock or os.path.isabs(mock) or mock.startswith("~"):
        raise Refuse(f"visual: refusing the mock {mock!r}: use a repo-relative path or an http(s) URL")
    full = os.path.realpath(os.path.join(root, mock))
    if full != root and not full.startswith(root + os.sep):
        raise Refuse(f"visual: refusing the mock {mock!r}: it resolves outside the repo")
    return mock


def read_shot(path: str) -> bytes:
    try:
        st = os.lstat(path)
    except OSError as e:
        raise Refuse(f"visual: cannot read the screenshot {path!r}: {e.strerror}")
    if stat.S_ISLNK(st.st_mode):
        raise Refuse(f"visual: refusing the screenshot {path!r}: it is a symbolic link")
    if not stat.S_ISREG(st.st_mode):
        raise Refuse(f"visual: refusing the screenshot {path!r}: it is not a regular file")
    if st.st_size > MAX_SHOT:
        raise Refuse(f"visual: refusing the screenshot {path!r}: over 10 MB")
    try:
        with open(path, "rb") as f:
            data = f.read(MAX_SHOT + 1)
    except OSError as e:
        raise Refuse(f"visual: cannot read the screenshot {path!r}: {e.strerror}")
    if len(data) > MAX_SHOT:
        raise Refuse(f"visual: refusing the screenshot {path!r}: over 10 MB")
    if not data.startswith(PNG_SIGNATURE):
        raise Refuse(f"visual: refusing the screenshot {path!r}: it does not start with the PNG signature")
    return data


def read_differences(path: str) -> list[str]:
    try:
        if os.path.getsize(path) > MAX_DIFFERENCES:
            raise Refuse("visual: refusing the differences file: over 1 MB")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except OSError as e:
        raise Refuse(f"visual: cannot read the differences file {path!r}: {e.strerror}")
    except ValueError:
        raise Refuse(f"visual: the differences file {path!r} is not valid JSON")
    if not isinstance(data, list) or not all(isinstance(x, str) for x in data):
        raise Refuse("visual: the differences file must hold a JSON list of strings")
    return data


def record(a: argparse.Namespace) -> int:
    root = evidence.repo_root()
    if not root:
        raise Refuse("visual: not inside a git repository")
    folder = os.path.realpath(a.intent)
    if not os.path.isdir(folder):
        raise Refuse(f"visual: the intent folder {a.intent!r} does not exist")
    if not folder.startswith(root + os.sep):
        raise Refuse(f"visual: the intent folder {a.intent!r} is not inside the repo")
    name = os.path.basename(folder)
    if a.step < 1:
        raise Refuse("visual: --step must be 1 or more")
    if a.console_errors < 0 or a.console_warnings < 0:
        raise Refuse("visual: the console counts cannot be negative")
    if a.status == "pass" and a.console_errors > 0:
        raise Refuse(f"visual: refusing pass with {a.console_errors} console error(s): zero errors is required, so fix them or record partial")
    if a.status != "info" and not a.shot:
        raise Refuse("visual: --shot is required unless the status is info")
    if a.status != "info" and not a.url:
        raise Refuse("visual: --url is required unless the status is info")
    url = check_url(a.url) if a.url else None
    mock = check_mock(root, a.mock) if a.mock else None
    diffs = read_differences(a.differences) if a.differences else []
    png = read_shot(a.shot) if a.shot else None

    width = WIDTHS[a.viewport]
    key = f"visual-{name}-step-{a.step}-{a.viewport}"
    if not evidence.safe_key(key):
        raise Refuse(f"visual: the intent folder name {name!r} cannot make a record key (only a-z, 0-9 and -)")
    shot_rel = None
    if png is not None:
        shot_rel = os.path.join(".pro-dev", "visual", key + ".png")
        evidence.ensure_excluded(root)
        dest = os.path.join(root, shot_rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest + ".tmp", "wb") as f:
            f.write(png)
        os.replace(dest + ".tmp", dest)
    detail = {
        "step": a.step,
        "title": a.title or "",
        "viewport": {"name": a.viewport, "width": width},
        "mock": mock,
        "screenshot": shot_rel,
        "url": url,
        "console": {"errors": a.console_errors, "warnings": a.console_warnings},
        "differences": diffs,
        "head": evidence.rev(root, "HEAD"),
        "created": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    rec = {
        "schema": 1,
        "evidence_key": key,
        "kind": "visual_drift",
        "artifact_kind": "ui-step",
        "artifact_key": name,
        "status": a.status,
        "summary": f"step {a.step} at {a.viewport} ({width}): {a.status}",
        "detail_json": json.dumps(detail),
        "produced_by": f"pro-ai-sdlc:execute@{evidence.plugin_version()}",
    }
    out = evidence.write_record(root, "visual", rec)
    print(json.dumps({**out, "status": a.status, "evidence_key": key, "screenshot": shot_rel}))
    return 0


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="visual.py")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("record")
    r.add_argument("--intent", required=True)
    r.add_argument("--step", type=int, required=True)
    r.add_argument("--viewport", choices=sorted(WIDTHS), required=True)
    r.add_argument("--status", choices=evidence.STATUSES, required=True)
    r.add_argument("--shot")
    r.add_argument("--url")
    r.add_argument("--differences")
    r.add_argument("--console-errors", type=int, default=0)
    r.add_argument("--console-warnings", type=int, default=0)
    r.add_argument("--title")
    r.add_argument("--mock")
    a = p.parse_args(argv)
    try:
        return record(a)
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
