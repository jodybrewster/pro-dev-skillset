#!/usr/bin/env python3
"""ship - the deterministic half of /pro-ship:ship.

Subcommands (all print JSON except where noted; every one takes --root DIR, default the
repo that holds the current directory):
  targets                          how this repo ships: a JSON list of targets, each
                                   {id, kind, path, env, url, rollback, evidence}. kind is
                                   deploy-on-merge, tag-release, manual-deploy, desktop or
                                   publish. A "Ship" yaml block in CLAUDE.md or AGENTS.md
                                   replaces detection; its tag_pattern (a git glob) picks the
                                   release tags. Reads files and tags only.
  scope [--pr N]                   the review range: {kind, base, head, range,
                                   last_deploy_source, targets}. Uses gh.
  coverage BASE HEAD               map each commit in BASE..HEAD to a merged PR and say
                                   whether a passing pr-check marker covers it:
                                   {prs, uncovered, covered}. Uses gh. A marker counts only
                                   on a PR from this repo whose author is the current gh
                                   user or an OWNER, MEMBER or COLLABORATOR and only when
                                   the body holds exactly one. Anything it cannot prove
                                   covered is uncovered; a gh failure exits 1.
  record REPORT.json               write .pro-dev/ship/preflight.json (a mieruka evidence
                                   manifest), preflight.md and, when the repo has an ignored
                                   .mieruka/evidence/, a copy there. Refuses a dirty tracked
                                   tree, a GO with blockers, a GO with no target, a GO target
                                   with no rollback and a done legal review of another commit.
  check SHA                        the freshness verdict the gates use:
                                   {fresh, cause, status, head}. The contract is
                                   docs/ship-preflight.md.
  version [--target ID] [--base REF]
                                   the next version from the changes since the last release
                                   tag: {state, target, last_tag, last_version, declared, bump,
                                   next, next_if_not_breaking, tag, tag_command, base_candidate,
                                   counts, changes, unclassified, reasons, notes, sentence,
                                   question}. It writes nothing; its one network call is
                                   git ls-remote for tags that collide.
  changelog                        how the changelog is kept: {mode, why, path, unreleased,
                                   groups}. mode is manual, generated or none.
  deployed --target ID --env ENV [--url U] [--commit SHA] [--outcome succeeded|failed|rolled-back]
           [--deployed-at ISO] [--checks FILE]
  deployed --from-github --target ID [--env production]
                                   write the deploy record of docs/loop-records.md to
                                   .pro-dev/ship/deploys/<evidence_key>.json (plus the ignored
                                   mieruka copy) and print {path, mieruka, why, status,
                                   evidence_key}. It records a deploy that happened and never
                                   runs one. --from-github reads the newest deployment and its
                                   newest status for ENV through gh. Only http and https URLs
                                   are kept; ENV is a-z, 0-9 and - and URL-encoded in the query.

Python 3 standard library only. The only network calls are the gh calls in scope,
coverage and deployed --from-github and git ls-remote in version, each with a timeout. Nothing here deploys, tags, publishes or pushes.
"""
from __future__ import annotations

import glob
import json
import os
import re
import shlex
import signal
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import quote, urlparse

GH_TIMEOUT = 30
PULLS_LOOKUP_CAP = 60
KINDS = ("deploy-on-merge", "tag-release", "manual-deploy", "desktop", "publish")
SHA = re.compile(r"^[0-9a-f]{40}$")
MARKER = re.compile(
    r"<!--\s*pro-ship:pr-check\s+head=([0-9a-f]{40})\s+result=([a-z]+)\s+tier=([a-z]+)\s*-->")
SEMVER_TAG = re.compile(r"(?:^|[^0-9A-Za-z.])v?\d+\.\d+\.\d+")
# The whole name of a release tag. git accepts names that hold a command substitution, so a tag
# reaches a command, a gh path or a record only after a full match of this.
RELEASE_TAG = re.compile(r"(?:([a-z0-9][a-z0-9._-]{0,63})(--|@))?(v?)(\d+)\.(\d+)\.(\d+)", re.ASCII)
VERSION = re.compile(r"\d+\.\d+\.\d+", re.ASCII)
INTENT_FOLDER = re.compile(r"\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}", re.ASCII)
CONTROL = re.compile("\x1b\\[[0-?]*[ -/]*[@-~]|\x1b.?|[\x00-\x1f\x7f-\x9f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb\U000e0000-\U000e007f]")
TEXT_CAP = 200
LS_REMOTE_TIMEOUT = 10
TRUSTED_ASSOCIATIONS = ("OWNER", "MEMBER", "COLLABORATOR")
# `gh pr list` cannot print authorAssociation, so a login is checked against the repo's
# collaborator permission instead; these levels can push to the repo.
TRUSTED_PERMISSIONS = ("admin", "maintain", "write")
LOGIN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
DEPLOY_WORDS = re.compile(r"\b(deploy|vercel|netlify|fly|flyctl|wrangler)\b", re.I)
LEGAL_STATUS = ("done", "not-installed", "could-not-run")
SKIP_DIRS = {"node_modules", ".git", ".pro-dev"}


class Refuse(Exception):
    """A refusal or failure the person should read; exits 1 with the message on stderr."""


# ---------------------------------------------------------------------------
# git and gh helpers
# ---------------------------------------------------------------------------

def sh(args: list[str], cwd: str, timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def repo_root(cwd: str | None = None) -> str:
    cwd = cwd or os.getcwd()
    try:
        r = sh(["git", "rev-parse", "--show-toplevel"], cwd)
        if r.returncode == 0 and r.stdout.strip():
            return os.path.realpath(r.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.realpath(cwd)


def git_lines(root: str, *args: str) -> list[str]:
    try:
        r = sh(["git", *args], root)
    except (OSError, subprocess.SubprocessError):
        return []
    return [ln for ln in r.stdout.splitlines() if ln.strip()] if r.returncode == 0 else []


def rev(root: str, ref: str) -> str | None:
    try:
        r = sh(["git", "rev-parse", "--verify", "-q", ref + "^{commit}"], root)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None


def is_ancestor(root: str, a: str, b: str) -> bool:
    """True when A is B or an ancestor of B. Any error, such as an unknown object, is False."""
    try:
        return sh(["git", "merge-base", "--is-ancestor", a, b], root).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def dirty_tracked(root: str) -> list[str]:
    r = sh(["git", "status", "--porcelain", "--untracked-files=no"], root)
    return [ln[3:] for ln in r.stdout.splitlines() if ln.strip()]


def ensure_excluded(root: str) -> None:
    """Keep .pro-dev/ out of the tree through the repo's local exclude file."""
    probe = sh(["git", "check-ignore", "-q", ".pro-dev/ship/x"], root)
    if probe.returncode == 0:
        return
    r = sh(["git", "rev-parse", "--git-path", "info/exclude"], root)
    path = r.stdout.strip()
    if not path:
        return
    if not os.path.isabs(path):
        path = os.path.join(root, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        existing = open(path, encoding="utf-8").read()
    except OSError:
        existing = ""
    if ".pro-dev/" not in existing.splitlines():
        with open(path, "a", encoding="utf-8") as f:
            f.write(("" if not existing or existing.endswith("\n") else "\n") + ".pro-dev/\n")


def ship_dir(root: str) -> str:
    d = os.path.join(root, ".pro-dev", "ship")
    os.makedirs(d, exist_ok=True)
    ensure_excluded(root)
    return d


def gh_run(root: str, args: list[str], what: str) -> str:
    """Run gh with a timeout. Any failure raises Refuse: a gh problem is reported, never a pass."""
    try:
        r = subprocess.run(["gh", *args], cwd=root, capture_output=True, text=True, timeout=GH_TIMEOUT)
    except FileNotFoundError:
        raise Refuse(f"ship: {what}: gh is not installed or not on PATH")
    except subprocess.TimeoutExpired:
        raise Refuse(f"ship: {what}: gh timed out after {GH_TIMEOUT}s")
    except (OSError, subprocess.SubprocessError) as e:
        raise Refuse(f"ship: {what}: gh could not run ({e})")
    if r.returncode != 0:
        why = (r.stderr.strip().splitlines() or ["no message"])[0]
        raise Refuse(f"ship: {what}: gh exited {r.returncode} ({why})")
    return r.stdout


def gh_json(root: str, args: list[str], what: str):
    out = gh_run(root, args, what)
    try:
        return json.loads(out)
    except ValueError:
        raise Refuse(f"ship: {what}: gh printed something that is not JSON")


def read(path: str) -> str:
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def read_json(path: str):
    try:
        return json.loads(read(path))
    except ValueError:
        return None


def flag(args: list[str], name: str) -> str | None:
    if name in args:
        i = args.index(name)
        if i + 1 >= len(args):
            raise Refuse(f"ship: {name} needs a value")
        return args[i + 1]
    return None


# ---------------------------------------------------------------------------
# A small yaml reader for the Ship block (maps, lists, scalars, inline lists)
# ---------------------------------------------------------------------------

def strip_comment(line: str) -> str:
    out, quote = [], ""
    for i, ch in enumerate(line):
        if quote:
            if ch == quote:
                quote = ""
        elif ch in "'\"":
            quote = ch
        elif ch == "#" and (i == 0 or line[i - 1] in " \t"):
            break
        out.append(ch)
    return "".join(out).rstrip()


def scalar(text: str):
    t = text.strip()
    if len(t) >= 2 and t[0] == t[-1] and t[0] in "'\"":
        return t[1:-1]
    if t.startswith("[") and t.endswith("]"):
        inner = t[1:-1].strip()
        return [scalar(p) for p in inner.split(",")] if inner else []
    low = t.lower()
    if low in ("true", "false"):
        return low == "true"
    if low in ("null", "~", ""):
        return None
    if re.fullmatch(r"-?\d+", t):
        return int(t)
    return t


KEY_LINE = re.compile(r"^([A-Za-z0-9_.-]+):(?:\s+(.*))?$")


def parse_yaml(text: str):
    items = []
    for raw in text.splitlines():
        line = strip_comment(raw.replace("\t", "  "))
        if line.strip():
            items.append((len(line) - len(line.lstrip(" ")), line.strip()))
    if not items:
        return {}
    value, i = _node(items, 0, items[0][0])
    if i != len(items):
        raise ValueError("unexpected indentation")
    return value


def _node(items, i, indent):
    if items[i][1] == "-" or items[i][1].startswith("- "):
        return _seq(items, i, indent)
    return _map(items, i, indent)


def _seq(items, i, indent):
    out = []
    while i < len(items) and items[i][0] == indent and (items[i][1] == "-" or items[i][1].startswith("- ")):
        rest = items[i][1][1:].strip()
        if not rest:
            if i + 1 < len(items) and items[i + 1][0] > indent:
                val, i = _node(items, i + 1, items[i + 1][0])
            else:
                val, i = None, i + 1
            out.append(val)
        elif KEY_LINE.match(rest):
            col = indent + (len(items[i][1]) - len(rest))
            items[i] = (col, rest)
            val, i = _map(items, i, col)
            out.append(val)
        else:
            out.append(scalar(rest))
            i += 1
    return out, i


def _map(items, i, indent):
    out = {}
    while i < len(items) and items[i][0] == indent:
        m = KEY_LINE.match(items[i][1])
        if not m:
            raise ValueError(f"cannot read: {items[i][1]}")
        key, rest = m.group(1), (m.group(2) or "").strip()
        if rest:
            out[key] = scalar(rest)
            i += 1
        elif i + 1 < len(items) and (items[i + 1][0] > indent or (
                items[i + 1][0] == indent and items[i + 1][1].startswith("- "))):
            out[key], i = _node(items, i + 1, items[i + 1][0])
        else:
            out[key] = None
            i += 1
    return out, i


# ---------------------------------------------------------------------------
# targets (R1 to R4)
# ---------------------------------------------------------------------------

def ship_block(root: str):
    """The parsed yaml under a heading that starts with Ship, as (data, file), or (None, None)."""
    for name in ("CLAUDE.md", "AGENTS.md"):
        lines = read(os.path.join(root, name)).splitlines()
        i = 0
        while i < len(lines):
            if re.match(r"^#{1,6}\s+Ship\b", lines[i]):
                j = i + 1
                while j < len(lines) and not re.match(r"^#{1,6}\s", lines[j]):
                    if re.match(r"^\s*```ya?ml\s*$", lines[j]):
                        k = j + 1
                        while k < len(lines) and not lines[k].strip().startswith("```"):
                            k += 1
                        try:
                            return parse_yaml("\n".join(lines[j + 1:k])), name
                        except ValueError as e:
                            raise Refuse(f"ship: the Ship block in {name} cannot be read ({e})")
                    j += 1
                i = j
            else:
                i += 1
    return None, None


def block_targets(data, name: str) -> list[dict]:
    raw = data.get("targets") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        raise Refuse(f"ship: the Ship block in {name} has no targets list")
    out = []
    for t in raw:
        if not isinstance(t, dict) or not t.get("id") or t.get("kind") not in KINDS:
            raise Refuse(f"ship: a target in the Ship block in {name} needs an id and a kind of {', '.join(KINDS)}")
        target = {"id": str(t["id"]), "kind": t["kind"], "path": str(t.get("path") or "."),
                  "env": t.get("env"), "url": t.get("url"), "rollback": t.get("rollback"),
                  "evidence": [name]}
        for k, v in t.items():  # extra keys such as packages pass through
            target.setdefault(k, v)
        out.append(target)
    return out


def exists(root: str, rel: str) -> bool:
    return os.path.exists(os.path.join(root, rel))


def workflow_files(root: str) -> list[str]:
    d = os.path.join(root, ".github", "workflows")
    try:
        names = sorted(os.listdir(d))
    except OSError:
        return []
    return [os.path.join(".github", "workflows", n) for n in names if n.endswith((".yml", ".yaml"))]


def workflow_facts(text: str) -> dict:
    """What a workflow triggers on and whether it names a deploy step. Text rules, no yaml engine."""
    lines = [strip_comment(ln) for ln in text.splitlines()]
    facts = {"push_branch": False, "push_tags": False, "release": False, "deploy": False}
    start = next((i for i, ln in enumerate(lines) if re.match(r"^(on|\"on\"|'on'|true)\s*:", ln)), None)
    body = lines
    if start is not None:
        end = start + 1
        while end < len(lines) and (not lines[end].strip() or lines[end].startswith((" ", "\t"))):
            end += 1
        block = lines[start:end]
        body = lines[:start] + lines[end:]
        head = block[0].split(":", 1)[1].strip()
        if head:  # on: push  or  on: [push, release]
            words = re.findall(r"[a-z_]+", head)
            facts["push_branch"] = "push" in words
            facts["release"] = "release" in words
        for n, ln in enumerate(block[1:], 1):
            ind = len(ln) - len(ln.lstrip())
            m = re.match(r"^\s*(push|release)\s*:", ln)
            if not m:
                continue
            if m.group(1) == "release":
                facts["release"] = True
                continue
            sub = []
            for nxt in block[n + 1:]:
                if nxt.strip() and len(nxt) - len(nxt.lstrip()) <= ind:
                    break
                sub.append(nxt)
            keys = {re.match(r"^\s*([a-z-]+)\s*:", s).group(1) for s in sub if re.match(r"^\s*([a-z-]+)\s*:", s)}
            if "tags" in keys:
                facts["push_tags"] = True
            if "branches" in keys:
                names = " ".join(s for s in sub if "branches" in s or re.match(r"^\s*-", s))
                if re.search(r"\b(main|master)\b", names):
                    facts["push_branch"] = True
            elif "tags" not in keys:
                facts["push_branch"] = True
    facts["deploy"] = any(DEPLOY_WORDS.search(ln) for ln in body if re.match(r"^\s*(-\s*)?(run|uses|name)\s*:", ln) or
                          re.match(r"^\s*-\s*(run|uses)\s*:", ln))
    return facts


def repo_workflows(root: str) -> dict:
    found = {"deploy": [], "tag": []}
    for rel in workflow_files(root):
        f = workflow_facts(read(os.path.join(root, rel)))
        if f["push_branch"] and f["deploy"]:
            found["deploy"].append(rel)
        elif f["push_tags"] or f["release"]:
            found["tag"].append(rel)
    return found


def package_json(root: str, rel: str) -> dict:
    data = read_json(os.path.join(root, rel, "package.json")) if exists(root, os.path.join(rel, "package.json")) else None
    return data if isinstance(data, dict) else {}


def workspace_dirs(root: str) -> list[str]:
    patterns = []
    ws = package_json(root, ".").get("workspaces")
    if isinstance(ws, dict):
        ws = ws.get("packages")
    if isinstance(ws, list):
        patterns += [p for p in ws if isinstance(p, str)]
    pnpm = read(os.path.join(root, "pnpm-workspace.yaml"))
    if pnpm:
        try:
            data = parse_yaml(pnpm)
            if isinstance(data, dict) and isinstance(data.get("packages"), list):
                patterns += [p for p in data["packages"] if isinstance(p, str)]
        except ValueError:
            pass
    patterns += ["apps/*", "packages/*"]
    dirs = []
    for pat in patterns:
        if pat.startswith("!"):
            continue
        for hit in sorted(glob.glob(os.path.join(root, pat.rstrip("/")))):
            rel = os.path.relpath(hit, root)
            if (os.path.isdir(hit) and not set(rel.split(os.sep)) & SKIP_DIRS and rel not in dirs):
                dirs.append(rel)
    return dirs


def is_electron(root: str, rel: str) -> list[str]:
    pkg = package_json(root, rel)
    deps = {**(pkg.get("dependencies") or {}), **(pkg.get("devDependencies") or {})}
    ev = []
    if "electron" in deps or "electron-builder" in deps or any(k.startswith("@electron-forge/") for k in deps):
        ev.append(os.path.join(rel, "package.json"))
    for name in ("electron-builder.yml", "electron-builder.yaml", "electron-builder.json", "electron-builder.json5",
                 "electron-builder.js", "electron-builder.toml", "forge.config.js", "forge.config.ts", "forge.config.cjs"):
        if exists(root, os.path.join(rel, name)):
            ev.append(os.path.join(rel, name))
    return ev


def is_publishable(root: str, rel: str) -> list[str]:
    pkg = package_json(root, rel)
    if pkg.get("name") and pkg.get("version") and pkg.get("private") is not True:
        return [os.path.join(rel, "package.json")]
    py = read(os.path.join(root, rel, "pyproject.toml"))
    if re.search(r"^\[project\]", py, re.M):
        return [os.path.join(rel, "pyproject.toml")]
    if re.search(r"^\[package\]", read(os.path.join(root, rel, "Cargo.toml")), re.M):
        return [os.path.join(rel, "Cargo.toml")]
    try:
        gem = [n for n in os.listdir(os.path.join(root, rel)) if n.endswith(".gemspec")]
    except OSError:
        gem = []
    return [os.path.join(rel, gem[0])] if gem else []


def unit_target(root: str, rel: str, is_root: bool, wf: dict, tags: list[str]) -> dict | None:
    """The first matching R2 rule for one unit (the repo root or one workspace package)."""
    def join(p: str) -> str:
        return os.path.normpath(os.path.join(rel, p))
    kind, evidence = None, []
    plat = [p for p in ("vercel.json", os.path.join(".vercel", "project.json"), "netlify.toml") if exists(root, join(p))]
    host = [p for p in ("fly.toml", "wrangler.toml") if exists(root, join(p))]
    if plat:
        kind, evidence = "deploy-on-merge", [join(p) for p in plat]
    elif is_root and wf["deploy"]:
        kind, evidence = "deploy-on-merge", wf["deploy"]
    elif host:
        evidence = [join(p) for p in host]
        kind = "deploy-on-merge" if wf["deploy"] else "manual-deploy"
        evidence += wf["deploy"]
    elif is_root and (wf["tag"] or tags):
        kind, evidence = "tag-release", wf["tag"]
    else:
        ev = is_electron(root, rel)
        if ev:
            kind, evidence = "desktop", ev
        else:
            ev = is_publishable(root, rel)
            if ev:
                kind, evidence = "publish", ev
    if not kind:
        return None
    pkg = package_json(root, rel)
    name = pkg.get("name") if isinstance(pkg.get("name"), str) else None
    ident = os.path.basename(root) if is_root else os.path.basename(rel)
    ident = re.sub(r"[^A-Za-z0-9._-]+", "-", (name or ident)).strip("-") or "app"
    return {"id": ident, "kind": kind, "path": rel, "env": None, "url": None, "rollback": None,
            "evidence": [os.path.normpath(e) for e in evidence]}


def tag_pattern(data) -> str | None:
    """The Ship block's tag_pattern, a git glob that overrides the semver tag rule."""
    pat = data.get("tag_pattern") if isinstance(data, dict) else None
    if pat is None:
        return None
    if not isinstance(pat, str) or not pat.strip() or pat.startswith("-"):
        raise Refuse("ship: tag_pattern in the Ship block must be a git glob such as \"*--v*\"")
    return pat.strip()


def release_tags(root: str, pattern: str | None, *extra: str) -> list[str]:
    """Release tags, newest first when extra sorts them. Without a pattern a tag counts when
    its name holds a semver vX.Y.Z or X.Y.Z, so v1.2.3, 1.2.3, name--v1.2.3 and name@1.2.3 all do."""
    names = git_lines(root, "tag", *extra, "--list", *([pattern] if pattern else []))
    return names if pattern else [t for t in names if SEMVER_TAG.search(t)]


def targets(root: str) -> list[dict]:
    data, name = ship_block(root)
    pattern = tag_pattern(data)
    if data is not None and not (pattern and "targets" not in data):
        return block_targets(data, name)
    wf = repo_workflows(root)
    tags = release_tags(root, pattern)
    found = []
    for rel in workspace_dirs(root):
        t = unit_target(root, rel, False, wf, tags)
        if t:
            found.append(t)
    t = unit_target(root, ".", True, wf, tags)
    if t:
        found.insert(0, t)
    seen = {}
    for t in found:  # ids stay unique when two packages share a name
        n = seen.get(t["id"], 0)
        seen[t["id"]] = n + 1
        if n:
            t["id"] = f"{t['id']}-{n + 1}"
    return found


# ---------------------------------------------------------------------------
# scope (R5, R6)
# ---------------------------------------------------------------------------

def tag_parts(tag: str):
    """(prefix, version tuple) of a valid release tag, or None for any other name."""
    m = RELEASE_TAG.fullmatch(tag)
    if not m:
        return None
    return (m.group(1) or "") + (m.group(2) or "") + m.group(3), tuple(int(m.group(i)) for i in (4, 5, 6))


def tag_series(tag: str) -> str:
    """Which numbering a valid tag belongs to: v1.0.0 and 1.0.0 are one series, name--v1.0.0 another."""
    m = RELEASE_TAG.fullmatch(tag)
    return (m.group(1) or "") + (m.group(2) or "")


def release_base_tag(root: str, head: str, pattern: str | None, ids: list[str] | None = None) -> str | None:
    """The tag a release range starts at: each series' highest version, then the newest of those.

    A later lightweight v0.0.1 or 0.0.1 moves nothing, an invalid name is not a tag and, with no
    tag_pattern, a series no target owns moves nothing while the plain series or a target's exists."""
    tags = [t for t in release_tags(root, pattern, "--merged", head, "--sort=-creatordate") if tag_parts(t)]
    own = {""} | {f"{i}{sep}" for i in (ids or []) for sep in ("--", "@")}
    if not pattern and any(tag_series(t) in own for t in tags):
        tags = [t for t in tags if tag_series(t) in own]
    best: dict[str, str] = {}
    for tag in tags:
        s = tag_series(tag)
        if s not in best or tag_parts(tag)[1] > tag_parts(best[s])[1]:
            best[s] = tag
    for tag in tags:
        if best[tag_series(tag)] == tag and rev(root, tag):
            return tag
    return None


def release_tag(root: str, head: str, pattern: str | None = None, ids: list[str] | None = None) -> str | None:
    """release_base_tag as a commit sha."""
    tag = release_base_tag(root, head, pattern, ids)
    return rev(root, tag) if tag else None


def github_deploy(root: str) -> str | None:
    """The newest production deployment with a success status. gh failures propagate."""
    deps = gh_json(root, ["api", "repos/{owner}/{repo}/deployments?environment=production&per_page=5",
                          "--jq", "[.[]|{id,sha}]"], "reading production deployments")
    if not isinstance(deps, list):
        return None
    for d in deps:
        if not isinstance(d, dict) or not d.get("id") or not isinstance(d.get("sha"), str):
            continue
        st = gh_json(root, ["api", f"repos/{{owner}}/{{repo}}/deployments/{d['id']}/statuses?per_page=1",
                            "--jq", "[.[]|{state}]"], "reading a deployment status")
        if isinstance(st, list) and st and isinstance(st[0], dict) and st[0].get("state") == "success":
            return d["sha"]
    return None


def cmd_scope(root: str, args: list[str]) -> dict:
    tg = targets(root)
    head = rev(root, "HEAD")
    pr = flag(args, "--pr")
    if pr is not None:
        if not pr.isdigit():
            raise Refuse("ship: --pr needs a PR number")
        info = gh_json(root, ["pr", "view", pr, "--json", "baseRefName,headRefOid"], f"reading PR {pr}")
        if not isinstance(info, dict) or not SHA.match(str(info.get("headRefOid"))) or not info.get("baseRefName"):
            raise Refuse(f"ship: PR {pr} came back without a head commit or a base branch")
        tip = info["headRefOid"]
        mb = gh_run(root, ["api", f"repos/{{owner}}/{{repo}}/compare/{info['baseRefName']}...{tip}",
                           "--jq", ".merge_base_commit.sha"], f"finding the merge base of PR {pr}").strip()
        if not SHA.match(mb):
            raise Refuse(f"ship: no merge base for PR {pr}")
        return {"kind": "pr", "base": mb, "head": tip, "range": f"{mb}..{tip}",
                "last_deploy_source": "none", "targets": tg}
    if not head:
        raise Refuse("ship: this repo has no commits")
    data, _ = ship_block(root)
    wanted = data.get("last_deploy") if isinstance(data, dict) else None
    pattern = tag_pattern(data)
    deploy_kind = any(t["kind"] in ("deploy-on-merge", "manual-deploy") for t in tg)
    base, source = None, "none"
    ids = [t["id"] for t in tg if isinstance(t.get("id"), str)]
    base_tag = release_base_tag(root, head, pattern, ids)
    if not deploy_kind:
        base = release_tag(root, head, pattern, ids)
        source = "tag" if base else "none"
        kind = "tag"
    else:
        kind = "deploy"
        if wanted == "ask":
            source = "ask"
        else:
            order = [wanted] if wanted in ("github", "tag") else ["github", "tag"]
            for src in order:
                cand = github_deploy(root) if src == "github" else release_tag(root, head, pattern, ids)
                if cand and rev(root, cand):
                    base, source = rev(root, cand), src
                    break
    return {"kind": kind, "base": base, "base_tag": base_tag if source == "tag" else None, "head": head,
            "range": f"{base}..{head}" if base else None, "last_deploy_source": source, "targets": tg}


# ---------------------------------------------------------------------------
# coverage (R7, R8)
# ---------------------------------------------------------------------------

def parse_marker(body) -> dict | None:
    """The one marker in a PR body. Two or more are ambiguous, so none counts."""
    found = MARKER.findall(body if isinstance(body, str) else "")
    if len(found) != 1:
        return None
    h, result, tier = found[0]
    return {"head": h, "result": result, "tier": tier}


def current_user(root: str) -> str | None:
    """The gh login of the person running this, or None when gh cannot say (nobody is then trusted by name)."""
    try:
        out = gh_run(root, ["api", "user", "--jq", ".login"], "reading the current gh user").strip()
    except Refuse:
        return None
    return out or None


def can_push(root: str, login: str, cache: dict) -> bool:
    """Whether a login can push to this repo, read once per login; any failure means no."""
    if login not in cache:
        try:
            perm = gh_run(root, ["api", f"repos/{{owner}}/{{repo}}/collaborators/{login}/permission",
                                 "--jq", ".permission"], f"reading the permission of {login}").strip()
        except Refuse:
            perm = ""
        cache[login] = perm in TRUSTED_PERMISSIONS
    return cache[login]


def trusted_author(p: dict, me: str | None, root: str | None = None, cache: dict | None = None) -> bool:
    """A marker is the author's word, so it counts only from someone who can write to this repo."""
    if p.get("cross") is not False:
        return False
    login = p.get("author")
    if me and isinstance(login, str) and login == me:
        return True
    if p.get("assoc") in TRUSTED_ASSOCIATIONS:
        return True
    if root is None or cache is None or not isinstance(login, str) or not LOGIN.match(login):
        return False
    return can_push(root, login, cache)


def cmd_coverage(root: str, args: list[str]) -> dict:
    if len(args) != 2:
        raise Refuse("ship: usage: coverage <base> <head>")
    base, head = rev(root, args[0]), rev(root, args[1])
    if not base or not head:
        raise Refuse("ship: coverage: base or head is not a commit in this repo")
    commits = git_lines(root, "rev-list", "--reverse", f"{base}..{head}")
    cset = set(commits)
    listed = gh_json(root, ["pr", "list", "--state", "merged", "--limit", "500",
                            "--json", "number,headRefOid,mergeCommit,body,author,isCrossRepository"], "listing merged PRs")
    if not isinstance(listed, list):
        raise Refuse("ship: coverage: gh pr list did not print a list")
    me = current_user(root)
    prs: dict[int, dict] = {}   # number -> {head, body, type, members, mc, author, assoc, cross}
    claims: dict[str, list[int]] = {}

    def claim(n: int, sha: str) -> None:
        prs[n]["members"].append(sha)
        claims.setdefault(sha, []).append(n)

    for p in listed:
        if not isinstance(p, dict) or not isinstance(p.get("number"), int):
            continue
        mc = (p.get("mergeCommit") or {}).get("oid") if isinstance(p.get("mergeCommit"), dict) else None
        if not isinstance(mc, str) or mc not in cset:
            continue
        parents = git_lines(root, "rev-list", "--parents", "-n", "1", mc)
        merge = bool(parents) and len(parents[0].split()) > 2
        au = p.get("author") if isinstance(p.get("author"), dict) else {}
        prs[p["number"]] = {"head": p.get("headRefOid"), "body": p.get("body"),
                            "type": "merge" if merge else "single", "members": [], "mc": mc,
                            "author": au.get("login"), "assoc": p.get("authorAssociation"),
                            "cross": p["isCrossRepository"] if isinstance(p.get("isCrossRepository"), bool) else None}
        claim(p["number"], mc)
        if merge:
            for b in git_lines(root, "rev-list", f"{mc}^1..{mc}^2"):
                if b in cset and b != mc:
                    claim(p["number"], b)
    # Rebase merges leave commits no PR names; ask GitHub which PR each one belongs to.
    errors = []
    unmapped = [c for c in commits if c not in claims]
    for c in unmapped[:PULLS_LOOKUP_CAP]:
        try:
            found = gh_json(root, ["api", f"repos/{{owner}}/{{repo}}/commits/{c}/pulls"], f"mapping commit {c[:8]}")
        except Refuse as e:
            errors.append(str(e))
            continue
        for p in found if isinstance(found, list) else []:
            if not isinstance(p, dict) or not isinstance(p.get("number"), int) or not p.get("merged_at"):
                continue
            n = p["number"]
            if n not in prs:
                h = p.get("head") if isinstance(p.get("head"), dict) else {}
                hr = h.get("repo") if isinstance(h.get("repo"), dict) else {}
                br = (p.get("base") or {}).get("repo") if isinstance(p.get("base"), dict) else None
                br = br if isinstance(br, dict) else {}
                same = bool(hr.get("full_name")) and hr.get("full_name") == br.get("full_name")
                au = p.get("user") if isinstance(p.get("user"), dict) else {}
                prs[n] = {"head": h.get("sha"), "body": p.get("body"), "type": "single", "members": [],
                          "mc": p.get("merge_commit_sha"), "author": au.get("login"),
                          "assoc": p.get("author_association"), "cross": not same}
            if prs[n]["type"] == "single":
                claim(n, c)
    if len(unmapped) > PULLS_LOOKUP_CAP:
        errors.append(f"ship: coverage: looked up {PULLS_LOOKUP_CAP} of {len(unmapped)} unmapped commits; the rest stay uncovered")

    perm_cache: dict[str, bool] = {}

    def trusted(p: dict) -> bool:
        # Only a PR with a marker needs its author checked, so most PRs cost no lookup.
        return parse_marker(p["body"]) is not None and trusted_author(p, me, root, perm_cache)

    def member_covered(n: int, sha: str) -> bool:
        p = prs[n]
        m = parse_marker(p["body"]) if trusted(p) else None
        tip = p["head"]
        if not (m and m["result"] == "pass" and isinstance(tip, str) and SHA.match(tip)):
            return False
        if m["head"] != tip and not is_ancestor(root, m["head"], tip):
            return False
        if m["head"] == tip:
            return True
        if p["type"] == "merge":  # the merge commit holds the later work too, so it needs a full marker
            return sha != p["mc"] and is_ancestor(root, sha, m["head"])
        return False  # a squash or rebase holds the later work too; a partial marker proves none of it

    covered_set = {c for c in commits if any(member_covered(n, c) for n in claims.get(c, []))}
    out_prs = []
    for n in sorted(prs):
        if not prs[n]["members"]:
            continue
        out_prs.append({"number": n, "head": prs[n]["head"], "trusted": trusted(prs[n]),
                        "marker": parse_marker(prs[n]["body"]),
                        "covered": all(member_covered(n, c) for c in prs[n]["members"])})
    out = {"prs": out_prs, "uncovered": [c for c in commits if c not in covered_set],
           "covered": [c for c in commits if c in covered_set]}
    if errors:
        out["errors"] = errors
    return out


# ---------------------------------------------------------------------------
# record (R25 to R30, R23)
# ---------------------------------------------------------------------------

def plugin_version() -> str:
    here = os.path.dirname(os.path.realpath(__file__))
    data = read_json(os.path.join(here, "..", ".claude-plugin", "plugin.json"))
    v = data.get("version") if isinstance(data, dict) else None
    return v if isinstance(v, str) and v else "unknown"


def plural(n: int, word: str, many: str | None = None) -> str:
    return f"{n} {word if n == 1 else (many or word + 's')}"


def write_atomic(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def validate_report(report, head: str) -> None:
    if not isinstance(report, dict):
        raise Refuse("ship: the report is not a JSON object")
    if report.get("verdict") not in ("GO", "NO-GO"):
        raise Refuse("ship: verdict must be GO or NO-GO")
    if report.get("head") != head:
        raise Refuse("ship: the report is for another commit than HEAD. Run the preflight on this HEAD.")
    if not isinstance(report.get("base"), str) or not report["base"]:
        raise Refuse("ship: the report has no base")
    for k in ("blockers", "fixes", "risks", "checks", "targets"):
        if not isinstance(report.get(k, []), list):
            raise Refuse(f"ship: {k} must be a list")
    if not isinstance(report.get("report_md"), str) or not report["report_md"].strip():
        raise Refuse("ship: the report has no report_md")
    legal = report.get("legal")
    if legal is not None and not (isinstance(legal, dict) and legal.get("status") in LEGAL_STATUS):
        raise Refuse(f"ship: legal.status must be one of {', '.join(LEGAL_STATUS)}")
    if isinstance(legal, dict) and legal.get("status") == "done" and legal.get("head") != head:
        raise Refuse("ship: legal.head is not the commit being shipped. Run the legal review on this HEAD.")
    if report["verdict"] == "GO":
        if report.get("blockers"):
            raise Refuse("ship: refusing to record GO with blockers. Fix them or record NO-GO.")
        if not report.get("targets"):
            raise Refuse("ship: refusing to record GO with no target. List what ships, or record NO-GO.")
        for t in report.get("targets", []):
            rb = t.get("rollback") if isinstance(t, dict) else None
            steps = rb.get("steps") if isinstance(rb, dict) else None
            if not (isinstance(steps, list) and any(isinstance(s, str) and s.strip() for s in steps)):
                tid = t.get("id") if isinstance(t, dict) else "?"
                raise Refuse(f"ship: refusing to record GO: target {tid} has no rollback steps (a missing rollback is a Blocker).")


def mieruka_copy(root: str, key: str, text: str) -> tuple[str | None, str]:
    """(path written, why not). Only when .mieruka/ exists and git ignores the manifest's own path.

    The folder may hold a few force-added files (mieruka tracks some screenshots there); what
    matters is that this manifest is ignored and untracked, so writing it never dirties the tree."""
    if not os.path.isdir(os.path.join(root, ".mieruka")):
        return None, "no .mieruka/ folder at the repo root"
    rel = os.path.join(".mieruka", "evidence", key, "evidence.json")
    if git_lines(root, "ls-files", "--", os.path.join(".mieruka", "evidence", key)):
        return None, f".mieruka/evidence/{key}/ is tracked by git, so nothing was written there"
    probe = sh(["git", "check-ignore", "-q", rel], root)
    if probe.returncode == 128:  # git refuses the path, for example beyond a symbolic link
        why = (probe.stderr or "").strip().splitlines()
        return None, f"git could not check {rel} ({why[-1] if why else 'exit 128'}), so nothing was written there"
    if probe.returncode != 0:
        return None, ".mieruka/evidence/ is not ignored by git, so nothing was written there (add it to .gitignore to get the copy)"
    write_atomic(os.path.join(root, rel), text)
    return rel, ""


def cmd_record(root: str, args: list[str]) -> dict:
    if len(args) != 1:
        raise Refuse("ship: usage: record <report.json>")
    head = rev(root, "HEAD")
    if not head:
        raise Refuse("ship: this repo has no commits")
    try:
        report = json.loads(read(args[0]))
    except ValueError as e:
        raise Refuse(f"ship: {args[0]} is not valid JSON ({e})")
    validate_report(report, head)
    files = dirty_tracked(root)
    if files:
        shown = ", ".join(files[:5]) + (" and more" if len(files) > 5 else "")
        raise Refuse(f"ship: tracked files have uncommitted changes ({shown}). Commit or discard them first, because the record is bound to a commit.")
    verdict = report["verdict"]
    accepted = [r for r in report.get("risks", []) if isinstance(r, dict) and r.get("accepted_by")]
    status = "fail" if verdict == "NO-GO" else ("partial" if accepted else "pass")
    detail = {k: v for k, v in report.items() if k != "report_md"}
    detail["created"] = datetime.now().astimezone().isoformat(timespec="seconds")
    detail.setdefault("legal", {"status": "not-installed", "verdict": None, "base": None, "head": None,
                                "blocking": 0, "required": 0})
    for k in ("blockers", "fixes", "risks", "checks", "targets"):
        detail.setdefault(k, [])
    summary = (f"{verdict}: {plural(len(detail['blockers']), 'Blocker')}, "
               f"{plural(len(detail['fixes']), 'recommended fix', 'recommended fixes')}, "
               f"{plural(len(detail['targets']), 'target')}")
    if accepted:
        summary += f", {plural(len(accepted), 'accepted risk')}"
    key = head[:12]
    record = {
        "schema": 1,
        "head": head,
        "evidence_key": f"ship-preflight-{key}",
        "kind": "review",
        "artifact_kind": "ship-preflight",
        "artifact_key": key,
        "status": status,
        "summary": summary,
        "detail_json": json.dumps(detail),
        "produced_by": f"pro-ship:ship@{plugin_version()}",
    }
    text = json.dumps(record, indent=2) + "\n"
    d = ship_dir(root)
    md = os.path.join(d, "preflight.md")
    js = os.path.join(d, "preflight.json")
    write_atomic(md, report["report_md"].rstrip("\n") + "\n")
    write_atomic(js, text)
    written = [os.path.relpath(js, root), os.path.relpath(md, root)]
    skipped = []
    copy, why = mieruka_copy(root, record["evidence_key"], text)
    if copy:
        written.append(copy)
    else:
        skipped.append(why)
    return {"status": status, "evidence_key": record["evidence_key"], "written": written, "skipped": skipped}


# ---------------------------------------------------------------------------
# check (R31) - the rule is written once in docs/ship-preflight.md
# ---------------------------------------------------------------------------

def check(root: str, sha: str) -> dict:
    full = rev(root, sha) if not SHA.match(sha) else sha
    path = os.path.join(root, ".pro-dev", "ship", "preflight.json")

    def verdict(cause, status=None, head=None):
        return {"fresh": cause is None, "cause": cause, "status": status, "head": head}
    if not os.path.exists(path):
        return verdict("missing")
    try:
        with open(path, encoding="utf-8") as f:
            rec = json.load(f)
    except (OSError, ValueError):
        return verdict("unreadable")
    if (not isinstance(rec, dict) or type(rec.get("schema")) is not int or rec["schema"] != 1
            or not isinstance(rec.get("produced_by"), str) or not rec["produced_by"].startswith("pro-ship:ship")
            or not isinstance(rec.get("head"), str) or not isinstance(rec.get("status"), str)):
        return verdict("unreadable")
    st, hd = rec["status"], rec["head"]
    if hd != full:
        return verdict("stale", st, hd)
    if st not in ("pass", "partial"):
        return verdict("no-go", st, hd)
    return verdict(None, st, hd)


# ---------------------------------------------------------------------------
# deployed - the deploy record after a deploy happened (docs/loop-records.md)
# ---------------------------------------------------------------------------

SAFE_NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")
OUTCOMES = ("succeeded", "failed", "rolled-back")
CHECK_STATUSES = ("pass", "finding", "confirm")
DEPLOY_FLAGS = ("--target", "--env", "--url", "--commit", "--outcome", "--deployed-at", "--checks")
GITHUB_OUTCOMES = {"success": "succeeded", "failure": "failed", "error": "failed"}


def http_url(value) -> str | None:
    """The URL when it is an absolute http or https one without spaces or control characters."""
    if not isinstance(value, str) or not value or len(value) > 2000:
        return None
    if any(ord(c) <= 32 or ord(c) == 127 for c in value):
        return None
    p = urlparse(value)
    return value if p.scheme in ("http", "https") and p.netloc and p.hostname else None


def parse_time(text: str, what: str) -> datetime:
    """An ISO 8601 time with an offset (Z counts as +00:00)."""
    try:
        t = datetime.fromisoformat(text[:-1] + "+00:00" if text.endswith(("Z", "z")) else text)
    except ValueError:
        raise Refuse(f"ship: {what} is not an ISO 8601 time: {text}")
    if t.tzinfo is None:
        raise Refuse(f"ship: {what} needs a UTC offset, for example 2026-11-02T10:15:00Z")
    return t


def read_checks(path: str) -> list[dict]:
    try:
        data = json.loads(read(path))
    except ValueError as e:
        raise Refuse(f"ship: {path} is not valid JSON ({e})")
    if isinstance(data, dict):
        data = data.get("checks")
    if not isinstance(data, list):
        raise Refuse("ship: the checks file must be a JSON array of {item, status, evidence}")
    out = []
    for c in data:
        if (not isinstance(c, dict) or not isinstance(c.get("item"), str) or not c["item"].strip()
                or c.get("status") not in CHECK_STATUSES):
            raise Refuse(f"ship: every check needs an item and a status of {', '.join(CHECK_STATUSES)}")
        ev = c.get("evidence", "")
        if not isinstance(ev, str):
            raise Refuse("ship: a check's evidence must be a string")
        out.append({"item": c["item"], "status": c["status"], "evidence": ev})
    return out


def github_facts(root: str, env: str) -> dict:
    """The newest deployment for env and its newest status, from gh. The env is URL-encoded."""
    deps = gh_json(root, ["api", f"repos/{{owner}}/{{repo}}/deployments?environment={quote(env, safe='')}&per_page=1"],
                   f"reading the {env} deployment")
    dep = deps[0] if isinstance(deps, list) and deps else None
    if not isinstance(dep, dict) or not dep.get("id") or not isinstance(dep.get("sha"), str) or not SHA.match(dep["sha"]):
        raise Refuse(f"ship: GitHub has no deployment for the {env} environment")
    sts = gh_json(root, ["api", f"repos/{{owner}}/{{repo}}/deployments/{int(dep['id'])}/statuses?per_page=1"],
                  "reading the deployment status")
    st = sts[0] if isinstance(sts, list) and sts and isinstance(sts[0], dict) else None
    if not st:
        raise Refuse(f"ship: the {env} deployment has no status yet")
    outcome = GITHUB_OUTCOMES.get(st.get("state"))
    if not outcome:
        raise Refuse(f"ship: the newest {env} deployment status is {st.get('state')}, not a finished deploy")
    when = st.get("created_at") or dep.get("created_at")
    if not isinstance(when, str):
        raise Refuse("ship: the deployment status has no time")
    return {"commit": dep["sha"], "url": http_url(st.get("environment_url")), "outcome": outcome,
            "deployed_at": parse_time(when, "the deployment time")}


def cmd_deployed(root: str, args: list[str]) -> dict:
    rest = [a for a in args if a != "--from-github"]
    from_github = len(rest) != len(args)
    for i, a in enumerate(rest):
        if a.startswith("--") and a not in DEPLOY_FLAGS:
            raise Refuse(f"ship: deployed: unknown option {a}")
    opt = {n[2:].replace("-", "_"): flag(rest, n) for n in DEPLOY_FLAGS}
    tid = opt["target"]
    if not tid:
        raise Refuse("ship: usage: deployed --target <id> --env <env> [--url U] [--commit SHA] "
                     "[--outcome succeeded|failed|rolled-back] [--deployed-at ISO] [--checks FILE] | "
                     "deployed --from-github --target <id> [--env production]")
    known = {t["id"]: t for t in targets(root) if isinstance(t, dict) and isinstance(t.get("id"), str)}
    if not SAFE_NAME.match(tid) or tid not in known:
        listed = ", ".join(sorted(known)) or "none found"
        raise Refuse(f"ship: --target {tid!r} is not a target of this repo. Targets: {listed}")
    env = opt["env"] or ("production" if from_github else None)
    if not env:
        raise Refuse("ship: --env is required (production, staging, preview or another name)")
    if not SAFE_NAME.match(env) or len(env) > 40:
        raise Refuse("ship: --env may use only a-z, 0-9 and - (lowercase)")
    if from_github:
        for n in ("url", "commit", "outcome", "deployed_at"):
            if opt[n]:
                raise Refuse(f"ship: --from-github fills the facts itself; drop --{n.replace('_', '-')}")
        facts = github_facts(root, env)
        source = "github"
    else:
        url = None
        if opt["url"]:
            url = http_url(opt["url"])
            if not url:
                raise Refuse("ship: --url must be an http or https URL")
        commit = rev(root, opt["commit"] or "HEAD")
        if not commit:
            raise Refuse(f"ship: {opt['commit'] or 'HEAD'} is not a commit of this repo")
        outcome = opt["outcome"] or "succeeded"
        if outcome not in OUTCOMES:
            raise Refuse(f"ship: --outcome must be one of {', '.join(OUTCOMES)}")
        when = parse_time(opt["deployed_at"], "--deployed-at") if opt["deployed_at"] else datetime.now().astimezone()
        facts = {"commit": commit, "url": url, "outcome": outcome, "deployed_at": when}
        source = "manual"
    checks = read_checks(opt["checks"]) if opt["checks"] else []
    commit, outcome, when = facts["commit"], facts["outcome"], facts["deployed_at"]
    pre = check(root, commit)
    pre_rec = read_json(os.path.join(root, ".pro-dev", "ship", "preflight.json")) if pre["cause"] != "missing" else None
    pre_key = pre_rec.get("evidence_key") if isinstance(pre_rec, dict) and isinstance(pre_rec.get("evidence_key"), str) else None
    findings = sum(1 for c in checks if c["status"] == "finding")
    confirms = sum(1 for c in checks if c["status"] == "confirm")
    status = "fail" if outcome != "succeeded" else ("partial" if findings or confirms else "pass")
    short = commit[:12]
    if outcome == "succeeded":
        tail = [plural(findings, "finding")] if findings else []
        tail += [plural(confirms, "check") + " to confirm"] if confirms else []
        summary = f"{env}: deployed {short}" + "".join(f", {t}" for t in tail)
    else:
        summary = f"{env}: {'deploy failed' if outcome == 'failed' else 'rolled back'} {short}"
    stamp = when.astimezone(timezone.utc).strftime("%Y%m%dt%H%M%Sz")
    key = f"deploy-{tid}-{short}-{stamp}"
    detail = {
        "target": tid, "target_kind": known[tid].get("kind"), "env": env, "url": facts["url"],
        "commit": commit, "deployed_at": when.isoformat(timespec="seconds"),
        "created": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source": source, "outcome": outcome,
        "preflight": {"state": "fresh" if pre["cause"] is None else pre["cause"], "evidence_key": pre_key},
        "checks": checks, "rollback": known[tid].get("rollback") or None,
    }
    record = {
        "schema": 1, "head": commit, "evidence_key": key, "kind": "deploy", "artifact_kind": "deploy",
        "artifact_key": tid, "status": status, "summary": summary, "detail_json": json.dumps(detail),
        "produced_by": f"pro-ship:deployed@{plugin_version()}",
    }
    text = json.dumps(record, indent=2) + "\n"
    ship_dir(root)
    local = os.path.join(root, ".pro-dev", "ship", "deploys", key + ".json")
    write_atomic(local, text)
    copy, why = mieruka_copy(root, key, text)
    return {"path": os.path.relpath(local, root), "mieruka": copy, "why": why, "status": status, "evidence_key": key}


# ---------------------------------------------------------------------------
# version and changelog (release-versioning R1 to R8, R10)
# ---------------------------------------------------------------------------

NUMBER_WORDS = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten")
GENERATED_LINE = re.compile(r"generated|do not edit|not to be edited|don't edit", re.I)
GENERATOR_WORDS = re.compile(r"release-please|semantic-release")


def clean(text, cap: int = TEXT_CAP) -> str:
    """Repo text on its way to a person or a prompt: no control or escape characters, one line, capped."""
    out = CONTROL.sub(" ", str(text if text is not None else ""))
    out = re.sub(r"\s+", " ", out).strip()
    return out if len(out) <= cap else out[:cap - 3].rstrip() + "..."


def safe_file(root: str, rel: str) -> str | None:
    """The absolute path of a regular file in the repo when no part of the way there is a symlink."""
    here = os.path.realpath(root)
    parts = [p for p in os.path.normpath(rel).split(os.sep) if p not in ("", ".")]
    if ".." in parts or not parts:
        return None
    for part in parts:
        here = os.path.join(here, part)
        if os.path.islink(here):
            return None
    return here if os.path.isfile(here) else None


def show_at(root: str, sha: str, rel: str) -> str | None:
    """A file as git holds it at a commit; never the working tree, so never through a symlink."""
    try:
        r = sh(["git", "show", f"{sha}:{rel}"], root)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 else None


def plain_frontmatter(text: str) -> dict:
    """Plain `key: value` lines between the first two --- lines (the rule factory.py reads by)."""
    lines = (text or "").replace("\r\n", "\n").split("\n")
    if not lines or lines[0].strip() != "---":
        return {}
    out = {}
    for ln in lines[1:]:
        if ln.strip() == "---":
            return out
        m = re.match(r"^([a-z_]+):\s*(.*?)\s*$", ln)
        if m:
            out[m.group(1)] = re.sub(r"\s+#.*$", "", m.group(2)).strip("\"'")
    return {}


def toml_table(text: str, tables: tuple[str, ...]) -> dict:
    """{table: {key: value}} for the named tables. tomllib when it can read the file, else a line read."""
    try:
        import tomllib
        data = tomllib.loads(text)
        out = {}
        for name in tables:
            node = data
            for part in name.split("."):
                node = node.get(part, {}) if isinstance(node, dict) else {}
            out[name] = node if isinstance(node, dict) else {}
        return out
    except Exception:
        pass
    out, current = {}, None
    for ln in text.splitlines():
        head = re.match(r"^\s*\[([^\[\]]+)\]\s*$", ln)
        if head:
            current = head.group(1).strip() if head.group(1).strip() in tables else None
            continue
        kv = re.match(r"^\s*(name|version)\s*=\s*[\"']([^\"']*)[\"']", ln)
        if current and kv:
            out.setdefault(current, {})[kv.group(1)] = kv.group(2)
    return out


def manifest_facts(name: str, text: str) -> tuple[object, object]:
    """(name, version) from the text of a package.json, pyproject.toml or Cargo.toml."""
    if name == "package.json":
        try:
            data = json.loads(text)
        except ValueError:
            return None, None
        return (data.get("name"), data.get("version")) if isinstance(data, dict) else (None, None)
    tables = ("project", "tool.poetry") if name == "pyproject.toml" else ("package",)
    found = toml_table(text, tables)
    for table in tables:
        if isinstance(found.get(table), dict) and found[table].get("version") is not None:
            return found[table].get("name"), found[table].get("version")
    return None, None


def read_manifest(root: str, target: dict | None, notes: list[str]) -> dict | None:
    """The declared version of the target. A symlink is absent; a value that is not X.Y.Z stays out."""
    base = (target or {}).get("path") or "."
    for name in ("package.json", "pyproject.toml", "Cargo.toml"):
        rel = os.path.normpath(os.path.join(base, name))
        if not os.path.lexists(os.path.join(root, rel)):
            continue
        path = safe_file(root, rel)
        if not path:
            notes.append(f"{clean(rel)} is a symlink or leaves the repo, so it was not read")
            continue
        label, version = manifest_facts(name, read(path))
        if version is None:
            continue
        valid = isinstance(version, str) and bool(VERSION.fullmatch(version))
        if not valid:
            notes.append(f"{clean(rel)} declares a version that is not X.Y.Z, so it was not used")
        return {"file": clean(rel), "version": version if valid else None, "valid": valid,
                "name": clean(label, 60) if isinstance(label, str) and label else None}
    return None


def changelog_mode(root: str) -> tuple[str, str, str | None]:
    """(mode, why, path): the Ship block key, then generator markers, then the file itself."""
    data, _ = ship_block(root)
    key = data.get("changelog") if isinstance(data, dict) else None
    if key is not None and key not in ("manual", "generated", "none"):
        raise Refuse("ship: changelog in the Ship block must be manual, generated or none")
    path = "CHANGELOG.md" if safe_file(root, "CHANGELOG.md") else None
    linked = not path and os.path.lexists(os.path.join(root, "CHANGELOG.md"))
    if key:
        return key, "the Ship block's changelog key", path
    if os.path.isdir(os.path.join(root, ".changeset")):
        return "generated", ".changeset/", path
    for marker in ("release-please-config.json", "cliff.toml"):
        if exists(root, marker):
            return "generated", marker, path
    rc = sorted(glob.glob(os.path.join(glob.escape(root), ".releaserc*")))
    if rc:
        return "generated", clean(os.path.basename(rc[0])), path
    for rel in workflow_files(root):
        if GENERATOR_WORDS.search(read(os.path.join(root, rel))):
            return "generated", clean(rel), path
    if not path:
        return "none", "CHANGELOG.md is a symlink or not a file, so it was not read" if linked else "no CHANGELOG.md", None
    text = read(os.path.join(root, path))
    first = next((ln for ln in text.splitlines() if ln.strip()), "")
    if GENERATED_LINE.search(first):
        return "generated", "the first line of CHANGELOG.md", path
    if unreleased_span(text):
        return "manual", "CHANGELOG.md has an Unreleased heading", path
    return "none", "CHANGELOG.md has no Unreleased heading", path


def unreleased_span(text: str) -> tuple[int, int] | None:
    """(heading line, line after the section) of the Unreleased section, or None."""
    lines = text.splitlines()
    start = next((i for i, ln in enumerate(lines) if re.match(r"^##\s+\[?unreleased\]?\s*$", ln.strip(), re.I)), None)
    if start is None:
        return None
    end = next((j for j in range(start + 1, len(lines)) if re.match(r"^##\s", lines[j])), len(lines))
    return start, end


def cmd_changelog(root: str, args: list[str]) -> dict:
    if args:
        raise Refuse("ship: usage: changelog")
    mode, why, path = changelog_mode(root)
    lines, groups = [], []
    if path:
        text = read(os.path.join(root, path))
        span = unreleased_span(text)
        for ln in (text.splitlines()[span[0] + 1:span[1]] if span else []):
            head = re.match(r"^###\s+(.+?)\s*$", ln)
            if head:
                groups.append(clean(head.group(1), 40))
            elif ln.strip():
                lines.append(clean(ln))
    return {"mode": mode, "why": why, "path": path, "unreleased": lines, "groups": groups}


def remote_tags(root: str, notes: list[str]) -> list[str]:
    """Tag names on origin. An unreadable remote is a note, never a failure."""
    if not git_lines(root, "remote"):
        return []
    try:
        r = sh(["git", "ls-remote", "--tags", "origin"], root, timeout=LS_REMOTE_TIMEOUT)
    except (OSError, subprocess.SubprocessError):
        r = None
    if r is None or r.returncode != 0:
        notes.append("the tags on origin could not be read, so only local tags were compared")
        return []
    names = [ln.split("refs/tags/", 1)[1] for ln in r.stdout.splitlines() if "refs/tags/" in ln]
    return [n[:-3] if n.endswith("^{}") else n for n in names]


def choose_target(root: str, wanted: str | None) -> dict | None:
    found = [t for t in targets(root) if isinstance(t, dict)]
    if wanted:
        for t in found:
            if t.get("id") == wanted:
                return t
        raise Refuse(f"ship: --target {clean(wanted, 60)!r} is not a target of this repo")
    return next((t for t in found if t.get("kind") in ("tag-release", "publish", "desktop")), found[0] if found else None)


def target_series(tags: list[str], target: dict | None, others: list[str] | None = None) -> str | None:
    """Which series belongs to the target: its own name, else the plain one, else the newest tag's
    unless another target owns that one."""
    series = [tag_series(t) for t in tags]
    ident = (target or {}).get("id")
    for s in series:
        if ident and s in (f"{ident}--", f"{ident}@"):
            return s
    if "" in series:
        return ""
    owned = {f"{i}{sep}" for i in (others or []) if i != ident for sep in ("--", "@")}
    return next((s for s in series if s not in owned), None)


def new_tag_prefix(data, target: dict | None) -> str:
    pat = tag_pattern(data) or ""
    ident = (target or {}).get("id")
    if "--v" not in pat or not ident:
        return "v"
    if not RELEASE_TAG.fullmatch(f"{ident}--v0.0.0"):
        raise Refuse("ship: this target's id cannot form a release tag; it must start with a lowercase letter or digit and use only a-z, 0-9, ., _ and -")
    return f"{ident}--v"


def bump_to(last: tuple[int, int, int], kind: str, reasons: list[str] | None = None) -> str:
    major, minor, patch = last
    if kind == "breaking" and major == 0:
        if reasons is not None:
            reasons.append("0.x: breaking bumps minor")
        kind = "feature"
    if kind == "breaking":
        return f"{major + 1}.0.0"
    return f"{major}.{minor + 1}.0" if kind == "feature" else f"{major}.{minor}.{patch + 1}"


def bump_name(last: tuple[int, int, int], nxt: str) -> str:
    a, b, _ = (int(x) for x in nxt.split("."))
    return "major" if a != last[0] else ("minor" if b != last[1] else "patch")


def tag_command(tag: str, sha: str, version: str) -> str | None:
    if not RELEASE_TAG.fullmatch(tag) or not SHA.fullmatch(sha) or not VERSION.fullmatch(version):
        return None
    return shlex.join(["git", "tag", "-a", tag, sha, "-m", f"Release {version}"])


def number_word(n: int, word: str, many: str | None = None) -> str:
    said = NUMBER_WORDS[n] if n < len(NUMBER_WORDS) else str(n)
    return f"{said} {word if n == 1 else (many or word + 's')}"


def join_plain(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def intent_facts(root: str, folder: str) -> dict:
    """The most severe kind and breaking value the intent has had on HEAD's history."""
    rel = f"intent/{folder}/intent.md"
    shas = git_lines(root, "log", "--format=%H", "HEAD", "--", rel)
    kinds, ever_breaking, tip_fields, title = set(), False, None, None
    for sha in shas:  # newest first, so the first readable text is the tip
        text = show_at(root, sha, rel)
        if text is None:
            continue
        fm = plain_frontmatter(text)
        if tip_fields is None:
            tip_fields = fm
            head = re.search(r"^#\s+(?:Intent:\s*)?(.+?)\s*$", text, re.M)
            title = clean(head.group(1)) if head else None
        kinds.add(fm.get("kind"))
        ever_breaking = ever_breaking or fm.get("breaking") == "true"
    tip_fields = tip_fields or {}
    base = "feature" if kinds & {"idea", "change"} else ("fix" if "bug" in kinds else "unknown")
    if ever_breaking:
        kind = "breaking"
    elif tip_fields.get("breaking") == "false" and base != "unknown":
        kind = base
    else:
        kind = "unknown"
    return {"kind": kind, "if_not": "feature" if base == "unknown" else base, "subject": title or folder}


def commit_kind(subject: str, body: str) -> tuple[str, str]:
    """(kind, kind when not breaking) from a Conventional Commit subject. Only feat, fix, a bang and a
    BREAKING CHANGE footer say anything; any other subject is unknown, so the person is asked."""
    m = re.match(r"^([a-z]+)(\([^)]*\))?(!)?:", subject)
    if re.search(r"(?m)^BREAKING[ -]CHANGE:", body) or (m and m.group(3)):
        return "breaking", "fix"
    if m and m.group(1) == "feat":
        return "feature", "feature"
    if m and m.group(1) == "fix":
        return "fix", "fix"
    return "unknown", "fix"


SEVERITY = {"breaking": 3, "feature": 2, "fix": 1}
FIELD, RECORD = "\x1f", "\x1e"


def merge_kind(root: str, first: str, sha: str) -> tuple[str, str]:
    """The most severe kind among the commits a merge brought in; the merge's own subject says nothing.
    Fields are split on NUL, which a commit message cannot hold."""
    r = sh(["git", "log", "--no-merges", "--format=%s%x00%b%x00", f"{first}..{sha}"], root, timeout=60)
    parts = r.stdout.split("\0") if r.returncode == 0 else []
    kinds = [commit_kind(parts[i].strip(), parts[i + 1]) for i in range(0, len(parts) - 1, 2)]
    if_not = "feature" if any(i == "feature" for _, i in kinds) else "fix"
    seen = {k for k, _ in kinds}
    if "breaking" in seen:
        return "breaking", if_not
    if not seen or "unknown" in seen:
        return "unknown", if_not
    return max(seen, key=lambda k: SEVERITY[k]), if_not


def release_commit(root: str, parent: str | None, sha: str, files: list[str], manifest: str | None) -> bool:
    """A release change holds the manifest's own version line and maybe the changelog, nothing else.
    A dependency's version line in the same file does not count."""
    if not parent or not manifest or manifest not in files or set(files) - {manifest, "CHANGELOG.md"}:
        return False
    old, new = show_at(root, parent, manifest), show_at(root, sha, manifest)
    if old is None or new is None:
        return False
    name = os.path.basename(manifest)
    was, now = manifest_facts(name, old)[1], manifest_facts(name, new)[1]
    if not isinstance(was, str) or not isinstance(now, str) or was == now:
        return False
    lines = git_lines(root, "diff", "-U0", parent, sha, "--", manifest)
    body = [ln for ln in lines if ln[:1] in "+-" and not ln.startswith(("+++", "---"))]
    return len(body) == 2 and body[0][1:].replace(was, now) == body[1][1:]


def range_changes(root: str, base: str | None, notes: list[str], manifest: str | None = None) -> tuple[list[dict], list[str]]:
    """Each change in base..HEAD along the first parent, so a merge counts as one change.

    A change belongs to an intent when it touches that intent's folder. A commit's own breaking mark
    or feat prefix is never hidden by the intent it touches: the more severe one wins. One git log
    covers the walk, so a long range stays fast."""
    spec = f"{base}..HEAD" if base else "HEAD"
    try:  # no free text in the walk; messages come apart on NUL, which they cannot hold
        r = sh(["git", "log", "--first-parent", "-m", "--name-only", f"--format={RECORD}%H{FIELD}%P{FIELD}", spec], root, timeout=60)
        m = sh(["git", "log", "--first-parent", "--format=%H%x00%s%x00%b%x00", spec], root, timeout=60)
    except (OSError, subprocess.SubprocessError):
        raise Refuse("ship: git log over the release range failed")
    if r.returncode != 0 or m.returncode != 0:
        raise Refuse("ship: git log over the release range failed")
    fields = m.stdout.split("\0")
    messages = {fields[i].strip(): (fields[i + 1], fields[i + 2]) for i in range(0, len(fields) - 2, 3)}
    changes, unclassified, by_folder = [], [], {}
    built: set[str] = set()
    touched: list[str] = []
    for rec in reversed(r.stdout.split(RECORD)):
        if not rec.strip():
            continue
        sha, parents, names = (rec.split(FIELD) + ["", ""])[:3]
        subject, body = messages.get(sha.strip(), ("", ""))
        files = [f for f in names.splitlines() if f.strip()]
        first = parents.split()[0] if parents.split() else None
        if release_commit(root, first, sha, files, manifest):
            continue
        folders = []
        for f in files:
            parts = f.split("/")
            if parts[0] == "intent" and len(parts) > 2 and parts[1] not in folders:
                folders.append(parts[1])
        good = []
        for folder in folders:
            if INTENT_FOLDER.fullmatch(folder):
                good.append(folder)
            else:
                note = f"skipped an intent folder with an invalid name: {clean(folder, 80)}"
                if note not in notes:
                    notes.append(note)
        own, own_if_not = merge_kind(root, first, sha) if len(parents.split()) > 1 else commit_kind(subject, body)
        if any(not f.startswith("intent/") for f in files):
            built.update(good)
        for folder in good:
            if folder not in by_folder:
                f = intent_facts(root, folder)
                by_folder[folder] = {"subject": f["subject"], "kind": f["kind"], "if_not": f["if_not"],
                                     "source": "intent", "intent": folder}
                changes.append(by_folder[folder])
                touched.append(folder)
            change = by_folder[folder]
            if own == "breaking" or (change["kind"] != "unknown" and SEVERITY.get(own, 0) > SEVERITY.get(change["kind"], 0)):
                change["kind"] = own
            if own_if_not == "feature":
                change["if_not"] = "feature"
        if not good and any(not f.startswith("intent/") for f in files):
            label = clean(subject) or sha[:7]
            changes.append({"subject": label, "kind": own, "if_not": own_if_not, "source": "commit", "intent": None})
            if own == "unknown":
                unclassified.append(label)
    for folder in touched:
        if folder not in built:
            notes.append(f"intent {clean(folder, 80)} is in the range but no commit there changes anything outside intent/; it still counts")
    return changes, unclassified


def first_release_candidate(root: str, declared: dict | None, notes: list[str]) -> dict | None:
    """R7: the parent of the oldest commit that added a path under intent/, else the newest commit
    whose manifest holds the declared version. None when neither holds the declared version."""
    head_file = declared["file"] if declared else None
    want = declared["version"] if declared else None

    def holds(sha: str) -> bool:
        if not head_file or not want:
            return True
        text = show_at(root, sha, head_file)
        return bool(text) and manifest_facts(os.path.basename(head_file), text)[1] == want
    added = git_lines(root, "log", "--diff-filter=A", "--format=%H", "--reverse", "--", "intent/")
    sha = rev(root, f"{added[0]}^") if added else None
    if added and not sha:
        notes.append("the oldest intent is in the first commit, so no earlier commit can be the release")
    if sha and not holds(sha):
        notes.append("the commit before the first intent does not hold the declared version")
        return None
    if not sha and not added:
        sha = next((c for c in git_lines(root, "log", "--format=%H", "-n", "200", "HEAD") if holds(c)), None)
    if not sha:
        return None
    line = git_lines(root, "log", "-1", "--format=%h%x00%cs%x00%s", sha)
    short, date, subject = (line[0].split("\0") + ["", "", ""])[:3] if line else ("", "", "")
    return {"sha": sha, "short": clean(short, 12), "date": clean(date, 10), "subject": clean(subject)}


def refuse_collision(next_version: str, tag: str, tags: list[str]) -> None:
    """Refuse a version that is not above every release tag of its series."""
    want = tuple(int(x) for x in next_version.split("."))
    same = [t for t in tags if tag_parts(t) and tag_series(t) == tag_series(tag)]
    top = max(same, key=lambda t: tag_parts(t)[1]) if same else None
    if top and want <= tag_parts(top)[1]:
        raise Refuse(f"ship: the next version {next_version} is not above the existing release tag {top}. "
                     "Fetch the tags and look at what was released.")


def cmd_version(root: str, args: list[str]) -> dict:
    for a in args:
        if a.startswith("--") and a not in ("--target", "--base"):
            raise Refuse(f"ship: version: unknown option {a}")
    head = rev(root, "HEAD")
    if not head:
        raise Refuse("ship: this repo has no commits")
    data, _ = ship_block(root)
    target = choose_target(root, flag(args, "--target"))
    pattern = tag_pattern(data)
    notes: list[str] = []
    every = release_tags(root, pattern)
    bad = [t for t in every if not tag_parts(t)]
    merged = [t for t in release_tags(root, pattern, "--merged", head, "--sort=-creatordate") if tag_parts(t)]
    if bad:
        notes.append(f"{plural(len(bad), 'tag')} with a name that is not a release tag ignored: "
                     + ", ".join(clean(t, 60) for t in bad[:3]))
    series = target_series(merged, target, [t.get("id") for t in targets(root)])
    mine = [t for t in merged if tag_series(t) == series]
    last_tag = max(mine, key=lambda t: tag_parts(t)[1]) if mine else None
    last = tag_parts(last_tag)[1] if last_tag else None
    declared = read_manifest(root, target, notes)
    public_declared = {k: declared[k] for k in ("file", "version", "valid")} if declared else None
    base_arg = flag(args, "--base")
    base = rev(root, base_arg) if base_arg else None
    if base_arg and not base:
        raise Refuse("ship: --base is not a commit of this repo")
    tag_style = tag_parts(last_tag)[0] if last_tag else new_tag_prefix(data, target)
    known = [t for t in every if tag_parts(t)] + [t for t in remote_tags(root, notes) if tag_parts(t)]
    out = {"state": "proposal", "target": (target or {}).get("id"), "last_tag": last_tag,
           "last_version": ".".join(str(x) for x in last) if last else None, "declared": public_declared,
           "bump": None, "next": None, "next_if_not_breaking": None, "tag": None, "tag_command": None,
           "base_candidate": None, "counts": {"breaking": 0, "feature": 0, "fix": 0, "unknown": 0},
           "changes": [], "unclassified": [], "reasons": [], "notes": notes, "sentence": None, "question": None}

    if not last_tag and not base:
        return first_release(root, out, declared, target, tag_style, known, head)

    start = base or rev(root, last_tag)
    if not last and declared and declared["valid"]:
        last = tuple(int(x) for x in declared["version"].split("."))
        out["last_version"] = declared["version"]
    last = last or (0, 0, 0)
    changes, out["unclassified"] = range_changes(root, start, notes, declared["file"] if declared else None)
    out["changes"] = [{k: c[k] for k in ("subject", "kind", "source", "intent")} for c in changes]
    for c in changes:
        out["counts"][c["kind"]] += 1
    counts = out["counts"]
    since = last_tag or (git_lines(root, "log", "-1", "--format=%h", start) or [""])[0]
    if not changes:
        out["state"] = "nothing"
        out["sentence"] = f"Nothing to release since {since}."
        return out
    top = "breaking" if counts["breaking"] or counts["unknown"] else ("feature" if counts["feature"] else "fix")
    out["next"] = bump_to(last, top, out["reasons"])
    out["bump"] = bump_name(last, out["next"])
    if counts["unknown"]:
        rest = [c["if_not"] if c["kind"] == "unknown" else c["kind"] for c in changes]
        low = "breaking" if "breaking" in rest else ("feature" if "feature" in rest else "fix")
        out["next_if_not_breaking"] = bump_to(last, low)
    out["tag"] = f"{tag_style}{out['next']}"
    refuse_collision(out["next"], out["tag"], known)
    # No command while the number still depends on the person's answer.
    out["tag_command"] = None if counts["unknown"] else tag_command(out["tag"], head, out["next"])
    said = []
    if counts["breaking"]:
        said.append(number_word(counts["breaking"], "breaking change"))
    if counts["feature"]:
        said.append(number_word(counts["feature"], "feature"))
    if counts["fix"]:
        said.append(number_word(counts["fix"], "fix", "fixes"))
    if counts["unknown"]:
        said.append(number_word(counts["unknown"], "change") + " that may be breaking")
    out["sentence"] = f"{out['tag']} ({out['bump']}): {join_plain(said)} since {since}"
    if counts["unknown"]:
        names = [c["subject"] for c in changes if c["kind"] == "unknown"]
        shown = join_plain([f'"{clean(n, 60)}"' for n in names[:3]]) + (" and more" if len(names) > 3 else "")
        out["question"] = (f"{shown} {'does' if len(names) == 1 else 'do'} not say whether {'it breaks' if len(names) == 1 else 'they break'} anything. "
                           f"Is any of it breaking? Yes keeps {out['next']}; no makes it {out['next_if_not_breaking']}.")
    return out


def first_release(root: str, out: dict, declared: dict | None, target: dict | None, style: str, known: list[str], head: str) -> dict:
    """R6 to R8: no release tag reachable from HEAD."""
    out["state"] = "first-release"
    usable = declared and declared["valid"]
    version = declared["version"] if usable else "0.1.0"
    out["next"] = version
    out["tag"] = f"{style}{version}"
    refuse_collision(version, out["tag"], known)
    if not usable:
        out["sentence"] = f"{out['tag']}: no earlier release was found, so the whole history is the first release"
        out["tag_command"] = tag_command(out["tag"], head, version)
        out["question"] = f"No earlier release was found. Release the whole history as {out['tag']}?"
        return out
    name = declared.get("name") or clean((target or {}).get("id"), 60) or "This project"
    cand = first_release_candidate(root, declared, out["notes"])
    has_intents = bool(git_lines(root, "log", "--diff-filter=A", "--format=%H", "-n", "1", "--", "intent/"))
    out["base_candidate"] = cand
    if not cand:
        out["sentence"] = f"{name} says {version}, but no commit before the first intent holds that version"
        out["question"] = f"{name} says {version}. Which commit was out as {version}? Pick one by subject or treat the whole history as the first release."
        return out
    out["tag_command"] = tag_command(out["tag"], cand["sha"], version)
    out["sentence"] = f"{name} says {version} and has no release tag yet"
    named = f'{cand["short"]}, {cand["date"]}, "{clean(cand["subject"], 80)}"'
    which = "the commit before the first intent" if has_intents else "the newest commit holding that version"
    out["question"] = (f"{name} says {version}. Tag {which} ({named}) as {out['tag']}, "
                       "pick another commit by subject or treat the whole history as the first release?")
    return out


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def emit(obj) -> None:
    print(json.dumps(obj, indent=2))


def main(argv: list[str]) -> int:
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda n, _f: sys.exit(128 + n))
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0 if argv else 2
    cmd, rest = argv[0], list(argv[1:])
    try:
        given = flag(rest, "--root")
        if given is not None:
            i = rest.index("--root")
            del rest[i:i + 2]
        root = repo_root(given) if given else repo_root()
        if cmd == "targets":
            emit(targets(root))
        elif cmd == "scope":
            emit(cmd_scope(root, rest))
        elif cmd == "coverage":
            emit(cmd_coverage(root, rest))
        elif cmd == "record":
            emit(cmd_record(root, rest))
        elif cmd == "deployed":
            emit(cmd_deployed(root, rest))
        elif cmd == "version":
            emit(cmd_version(root, rest))
        elif cmd == "changelog":
            emit(cmd_changelog(root, rest))
        elif cmd == "check":
            if len(rest) != 1:
                raise Refuse("ship: usage: check <sha>")
            emit(check(root, rest[0]))
        else:
            print(f"ship: unknown subcommand {cmd}", file=sys.stderr)
            return 2
        return 0
    except Refuse as e:
        print(str(e), file=sys.stderr)
        return 1
    except subprocess.TimeoutExpired:
        print("ship: a git command timed out", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
