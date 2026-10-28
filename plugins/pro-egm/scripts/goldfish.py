#!/usr/bin/env python3
"""Resolve the inputs for an Elephant-Goldfish review of a spec or plan.

    goldfish.py resolve --stage spec|plan --target PATH [--repo ROOT] [--accept --token HEX]
    goldfish.py init [--repo ROOT]

`resolve` prints JSON: target, semanticTarget, reviewers, standards, context and
newOrChanged. It reads the repo's `.egm/goldfish.json` when present and the plugin's
own defaults otherwise. Every path it prints must be a regular file inside the repo
(no symlink in any component, never under .git/); reviewers and standards from a
config must be an EGM shortname or sit under .egm/. A root reading-list doc (REVIEW.md,
CLAUDE.md, AGENTS.md) may be a symlink when it resolves to a regular file inside the
repo; it is listed once under its resolved path. A violation exits 2 with the entry named.
`init` is the only writer: it creates files under .egm/ and never overwrites.
The sha256 of each custom reviewer and standard is kept in <git dir>/egm-seen.json
so a changed file is listed before the run with its claimed author, commit and signature status. `.egm/goldfish.json` is tracked the same way.
`resolve` prints `acceptToken`, the sha256 of the printed newOrChanged list; `--accept`
records the files only when `--token` matches the current list. Standard library only, no network.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile

PLUGIN = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
STARTERS = os.path.join(PLUGIN, "goldfish")
CAP = 64 * 1024
SEEN = "egm-seen.json"
STAGES = ("spec", "plan")
ROOT_DOCS = ("REVIEW.md", "CLAUDE.md", "AGENTS.md")
CONFIG_REL = ".egm/goldfish.json"
FIELD_CAP = 120
# EGM's own shortnames. Anything else must be a path under .egm/.
REVIEWER_NAMES = frozenset({
    "zoom_out", "design_critic", "structural", "style", "comprehension",
    "implementation_readiness", "codebase_details",
})
STANDARD_NAMES = frozenset({
    "zoom-out-standard", "feature-spec-standard", "implementation-readiness-standard",
    "heilmeier-standard", "re-implementation-standard",
})
CONTROL = re.compile(r"[\x00-\x1f\x7f-\x9f\u2028\u2029]")


class Refuse(Exception):
    pass


class Usage(Exception):
    pass


# ---------------------------------------------------------------- path checks


def repo_root(arg: str | None) -> str:
    if arg:
        return os.path.realpath(arg)
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError) as exc:
        raise Usage(f"cannot run git ({exc})")
    if out.returncode != 0 or not out.stdout.strip():
        raise Usage("not inside a git repo; pass --repo ROOT")
    return os.path.realpath(out.stdout.strip())


def check_rel(repo: str, entry: object, label: str, under: str | None = None) -> str:
    """Validate a repo-relative file path and return its normalised form.

    Refuses anything but a plain relative path to a regular file whose every
    component is a real (non-symlink) entry inside the repo and not under .git/.
    """
    if not isinstance(entry, str) or not entry or "\0" in entry:
        raise Refuse(f"{label}: {entry!r} is not a usable path")
    if os.path.isabs(entry) or entry.startswith("~"):
        raise Refuse(f"{label}: {entry!r} is an absolute path; use a repo-relative path")
    parts = [p for p in entry.replace("\\", "/").split("/") if p not in ("", ".")]
    if not parts or ".." in parts:
        raise Refuse(f"{label}: {entry!r} has an empty or '..' component")
    if parts[0].lower() == ".git":
        raise Refuse(f"{label}: {entry!r} is under .git/")
    if under is not None and parts[0] != under:
        raise Refuse(f"{label}: {entry!r} is outside {under}/")
    cur = repo
    for i, part in enumerate(parts):
        cur = os.path.join(cur, part)
        try:
            st = os.lstat(cur)
        except FileNotFoundError:
            raise Refuse(f"{label}: {entry!r} does not exist")
        except OSError as exc:
            raise Refuse(f"{label}: {entry!r} cannot be inspected ({exc})")
        if stat.S_ISLNK(st.st_mode):
            raise Refuse(f"{label}: {entry!r} goes through a symlink ({'/'.join(parts[: i + 1])})")
        last = i == len(parts) - 1
        if last and not stat.S_ISREG(st.st_mode):
            raise Refuse(f"{label}: {entry!r} is not a regular file")
        if not last and not stat.S_ISDIR(st.st_mode):
            raise Refuse(f"{label}: {entry!r} has a non-folder component")
    real = os.path.realpath(cur)
    if real != cur or not (real + os.sep).startswith(repo + os.sep):
        raise Refuse(f"{label}: {entry!r} resolves outside the repo")
    return "/".join(parts)


def check_name(repo: str, entry: object, label: str, known: frozenset) -> str:
    """A reviewer or standard: one of EGM's shortnames in `known` or a path under .egm/."""
    if isinstance(entry, str) and entry in known:
        return entry
    return check_rel(repo, entry, label, under=".egm")


def check_root_doc(repo: str, name: str) -> str:
    """A root reading-list doc. A symlink is fine when it resolves to a regular file inside the repo.

    Returns the repo-relative path of the resolved file so a link and its target list once.
    """
    path = os.path.join(repo, name)
    try:
        st = os.lstat(path)
    except OSError as exc:
        raise Refuse(f"reading list: {name!r} cannot be inspected ({exc})")
    if not stat.S_ISLNK(st.st_mode):
        return check_rel(repo, name, "reading list")
    real = os.path.realpath(path)
    if not (real + os.sep).startswith(repo + os.sep):
        raise Refuse(f"reading list: {name!r} is a symlink that resolves outside the repo")
    rel = os.path.relpath(real, repo)
    try:
        return check_rel(repo, rel, "reading list")
    except Refuse as exc:
        raise Refuse(f"reading list: {name!r} is a symlink and its target is refused ({exc})")


def check_starter(path: str, label: str) -> str:
    try:
        st = os.lstat(path)
    except OSError as exc:
        raise Refuse(f"{label}: starter file {path} is missing ({exc})")
    if not stat.S_ISREG(st.st_mode):
        raise Refuse(f"{label}: starter file {path} is not a regular file")
    return path


def read_capped(path: str, label: str) -> bytes:
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
    except OSError as exc:
        raise Refuse(f"{label}: cannot open {path} ({exc})")
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise Refuse(f"{label}: {path} is not a regular file")
        data = os.read(fd, CAP + 1)
    finally:
        os.close(fd)
    if len(data) > CAP:
        raise Refuse(f"{label}: {path} is larger than {CAP // 1024} KiB")
    return data


# -------------------------------------------------------------------- config


def default_stage(stage: str) -> dict:
    def s(name: str) -> str:
        return os.path.join(STARTERS, name)

    if stage == "spec":
        reviewers = ["zoom_out", "design_critic", s("policy.md"), s("scope.md")]
        standards = {
            "zoom_out": "zoom-out-standard",
            "design_critic": "feature-spec-standard",
            s("policy.md"): s("policy-standard.md"),
            s("scope.md"): s("scope-standard.md"),
        }
    else:
        reviewers = ["implementation_readiness", "codebase_details", s("scope.md")]
        standards = {
            "implementation_readiness": "implementation-readiness-standard",
            "codebase_details": "implementation-readiness-standard",
            s("scope.md"): s("scope-standard.md"),
        }
    return {"reviewers": reviewers, "standards": standards, "context": [], "starter": True}


def load_config(repo: str) -> dict | None:
    rel = CONFIG_REL
    if not os.path.lexists(os.path.join(repo, ".egm", "goldfish.json")):
        return None
    check_rel(repo, rel, rel)
    data = read_capped(os.path.join(repo, rel), rel)
    try:
        cfg = json.loads(data.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise Refuse(f"{rel}: not valid JSON ({exc})")
    if not isinstance(cfg, dict):
        raise Refuse(f"{rel}: top level must be an object")
    return cfg


def stage_from_config(repo: str, cfg: dict, stage: str) -> dict | None:
    sec = cfg.get(stage)
    if sec is None:
        return None
    label = f".egm/goldfish.json {stage}"
    if not isinstance(sec, dict):
        raise Refuse(f"{label}: must be an object")
    reviewers = sec.get("reviewers", [])
    standards = sec.get("standards", {})
    context = sec.get("context", [])
    if not isinstance(reviewers, list) or not reviewers:
        raise Refuse(f"{label}.reviewers: must be a non-empty list")
    if not isinstance(standards, dict):
        raise Refuse(f"{label}.standards: must be an object")
    if not isinstance(context, list):
        raise Refuse(f"{label}.context: must be a list")
    out_rev = [check_name(repo, r, f"{label}.reviewers", REVIEWER_NAMES) for r in reviewers]
    out_std = {}
    for k, v in standards.items():
        key = check_name(repo, k, f"{label}.standards key", REVIEWER_NAMES)
        if key not in out_rev:
            raise Refuse(f"{label}.standards: {k!r} is not in reviewers")
        out_std[key] = check_name(repo, v, f"{label}.standards[{k}]", STANDARD_NAMES)
    out_ctx = [check_rel(repo, c, f"{label}.context") for c in context]
    return {"reviewers": out_rev, "standards": out_std, "context": out_ctx, "starter": False}


# ----------------------------------------------------------- change tracking


def git_dir(repo: str) -> str:
    try:
        out = subprocess.run(["git", "rev-parse", "--git-dir"], cwd=repo, capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError) as exc:
        raise Usage(f"cannot run git ({exc})")
    if out.returncode != 0 or not out.stdout.strip():
        raise Usage("not a git repo")
    p = out.stdout.strip()
    return p if os.path.isabs(p) else os.path.normpath(os.path.join(repo, p))


def load_seen(gdir: str) -> dict:
    path = os.path.join(gdir, SEEN)
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
    except OSError:
        return {}
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            return {}
        data = os.read(fd, 4 * CAP)
    finally:
        os.close(fd)
    try:
        seen = json.loads(data.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return {}
    if not isinstance(seen, dict):
        return {}
    return {k: v for k, v in seen.items() if isinstance(k, str) and isinstance(v, str)}


def save_seen(gdir: str, seen: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=gdir, prefix=".egm-seen.")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(seen, fh, indent=2, sort_keys=True)
            fh.write("\n")
        os.replace(tmp, os.path.join(gdir, SEEN))
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def clean(value: str) -> str:
    """Make a value safe to print in a prompt: no control characters, at most FIELD_CAP characters."""
    text = " ".join(CONTROL.sub(" ", value).split())
    return text if len(text) <= FIELD_CAP else text[: FIELD_CAP - 3] + "..."


# git's %G? letter to a plain word. Only G counts as good.
SIGNATURE = {"G": "good", "N": "unsigned", "B": "bad", "R": "bad", "X": "bad", "Y": "bad", "U": "unknown", "E": "unknown"}


def last_commit(repo: str, rel: str) -> tuple[str, str, str]:
    """Return (author as 'name <email>', short hash, signature) of the last commit touching rel.

    The author is what the commit claims; anyone can set it. signature is good, unsigned,
    bad or unknown (from git's %G?), and only good says anything about who made the commit.
    """
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%an%x00%ae%x00%h%x00%G?", "--", rel],
            cwd=repo, capture_output=True, text=True, timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return "unknown", "", "unknown"
    parts = out.stdout.strip("\n").split("\0") if out.returncode == 0 else []
    if len(parts) != 4 or not parts[0]:
        return "uncommitted", "", "unsigned"
    return (clean(f"{clean(parts[0])} <{clean(parts[1])}>"), clean(parts[2]),
            SIGNATURE.get(parts[3].strip(), "unknown"))


def token_for(changed: list) -> str:
    blob = json.dumps(changed, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def digest(repo: str, rel: str) -> str:
    return hashlib.sha256(read_capped(os.path.join(repo, rel), rel)).hexdigest()


# ------------------------------------------------------------------- resolve


def to_repo_rel(repo: str, target: str) -> str:
    absolute = target if os.path.isabs(target) else os.path.join(os.getcwd(), target)
    absolute = os.path.normpath(absolute)
    # realpath the parent only: a symlinked target must still be caught by check_rel
    head, tail = os.path.split(absolute)
    real = os.path.join(os.path.realpath(head), tail)
    if not (real + os.sep).startswith(repo + os.sep):
        raise Refuse(f"target: {target!r} is outside the repo")
    return os.path.relpath(real, repo)


def cmd_resolve(args: argparse.Namespace) -> int:
    repo = repo_root(args.repo)
    target = check_rel(repo, to_repo_rel(repo, args.target), "target")
    cfg = load_config(repo)
    sect = stage_from_config(repo, cfg, args.stage) if cfg else None
    if sect is None:
        sect = default_stage(args.stage)
        for path in sect["reviewers"] + list(sect["standards"].values()):
            if os.path.isabs(path):
                check_starter(path, "default")

    reading: list[str] = []
    tdir = os.path.dirname(target)

    def sibling(name: str) -> str:
        return f"{tdir}/{name}" if tdir else name

    names = [sibling("intent.md")]
    if args.stage == "plan":
        names.append(sibling("spec.md"))
    names.extend(ROOT_DOCS)
    for name in names:
        if not os.path.lexists(os.path.join(repo, name)):
            continue
        if name in ROOT_DOCS:
            reading.append(check_root_doc(repo, name))
        else:
            reading.append(check_rel(repo, name, "reading list"))
    context = list(dict.fromkeys(reading + sect["context"]))

    custom = {
        p for p in sect["reviewers"] + list(sect["standards"].values())
        if p not in REVIEWER_NAMES and p not in STANDARD_NAMES and not os.path.isabs(p)
    }
    if cfg is not None:
        custom.add(CONFIG_REL)
    custom = sorted(custom)
    gdir = git_dir(repo)
    seen = load_seen(gdir)
    hashes = {p: digest(repo, p) for p in custom}
    changed = []
    for p in custom:
        if seen.get(p) != hashes[p]:
            author, commit, signature = last_commit(repo, p)
            changed.append({"path": clean(p), "author": author, "commit": commit, "signature": signature, "sha256": hashes[p]})
    if args.accept:
        if not args.token:
            raise Refuse("--accept needs --token <acceptToken from the previous resolve>")
        if args.token != token_for(changed):
            raise Refuse("--accept token does not match the current newOrChanged list; run resolve again and ask again")
        seen.update(hashes)
        save_seen(gdir, seen)
        changed = []

    print(json.dumps({
        "target": target,
        "semanticTarget": "full file",
        "reviewers": sect["reviewers"],
        "standards": sect["standards"],
        "context": context,
        "newOrChanged": changed,
        "acceptToken": token_for(changed),
    }, indent=2))
    return 0


# ---------------------------------------------------------------------- init


def ensure_dir(repo: str, parts: list[str]) -> str:
    cur = repo
    for part in parts:
        cur = os.path.join(cur, part)
        try:
            st = os.lstat(cur)
        except FileNotFoundError:
            os.mkdir(cur, 0o755)
            st = os.lstat(cur)
        if stat.S_ISLNK(st.st_mode) or not stat.S_ISDIR(st.st_mode):
            raise Refuse(f"{os.path.relpath(cur, repo)} is a symlink or not a folder; refusing to write under it")
        if os.path.realpath(cur) != cur:
            raise Refuse(f"{os.path.relpath(cur, repo)} resolves elsewhere; refusing to write under it")
    return cur


def create_new(path: str, data: bytes) -> str:
    """Create `path` without overwriting. Returns created, exists or symlink."""
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
    except FileExistsError:
        return "symlink" if stat.S_ISLNK(os.lstat(path).st_mode) else "exists"
    except OSError:
        return "symlink" if os.path.islink(path) else "error"
    with os.fdopen(fd, "wb") as fh:
        fh.write(data)
    return "created"


def init_config() -> dict:
    r = ".egm/reviewers/"
    s = ".egm/standards/"
    return {
        "spec": {
            "reviewers": ["zoom_out", "design_critic", r + "policy.md", r + "scope.md"],
            "standards": {
                "zoom_out": "zoom-out-standard",
                "design_critic": "feature-spec-standard",
                r + "policy.md": s + "policy-standard.md",
                r + "scope.md": s + "scope-standard.md",
            },
            "context": [],
        },
        "plan": {
            "reviewers": ["implementation_readiness", "codebase_details", r + "scope.md"],
            "standards": {
                "implementation_readiness": "implementation-readiness-standard",
                "codebase_details": "implementation-readiness-standard",
                r + "scope.md": s + "scope-standard.md",
            },
            "context": [],
        },
    }


def cmd_init(args: argparse.Namespace) -> int:
    repo = repo_root(args.repo)
    ensure_dir(repo, [".egm"])
    ensure_dir(repo, [".egm", "reviewers"])
    ensure_dir(repo, [".egm", "standards"])
    plan = [
        ("reviewers/policy.md", "policy.md"),
        ("reviewers/scope.md", "scope.md"),
        ("standards/policy-standard.md", "policy-standard.md"),
        ("standards/scope-standard.md", "scope-standard.md"),
    ]
    bad = False
    for dest, src in plan:
        data = read_capped(check_starter(os.path.join(STARTERS, src), src), src)
        res = create_new(os.path.join(repo, ".egm", dest), data)
        bad |= res in ("symlink", "error")
        say(f".egm/{dest}", res)
    cfg = (json.dumps(init_config(), indent=2) + "\n").encode()
    res = create_new(os.path.join(repo, ".egm", "goldfish.json"), cfg)
    bad |= res in ("symlink", "error")
    say(".egm/goldfish.json", res)
    return 2 if bad else 0


def say(rel: str, res: str) -> None:
    text = {
        "created": "created",
        "exists": "already exists, left alone",
        "symlink": "is a symlink, refused and left alone",
        "error": "could not be created",
    }[res]
    print(f"{rel}: {text}")


# ---------------------------------------------------------------------- main


class Parser(argparse.ArgumentParser):
    def error(self, message: str):  # usage errors exit 1; exit 2 means a refused path
        raise Usage(message)


def main(argv: list[str]) -> int:
    ap = Parser(prog="goldfish.py", description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True, parser_class=Parser)
    r = sub.add_parser("resolve")
    r.add_argument("--stage", required=True, choices=STAGES)
    r.add_argument("--target", required=True)
    r.add_argument("--repo")
    r.add_argument("--accept", action="store_true")
    r.add_argument("--token")
    i = sub.add_parser("init")
    i.add_argument("--repo")
    try:
        args = ap.parse_args(argv)
        return cmd_resolve(args) if args.cmd == "resolve" else cmd_init(args)
    except Refuse as exc:
        print(f"goldfish: refused: {exc}", file=sys.stderr)
        return 2
    except Usage as exc:
        print(f"goldfish: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
