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

Python 3 standard library only. The only network calls are the gh calls in scope and
coverage, each with a timeout. Nothing here deploys, tags, publishes or pushes.
"""
from __future__ import annotations

import glob
import json
import os
import re
import signal
import subprocess
import sys
from datetime import datetime

GH_TIMEOUT = 30
PULLS_LOOKUP_CAP = 60
KINDS = ("deploy-on-merge", "tag-release", "manual-deploy", "desktop", "publish")
SHA = re.compile(r"^[0-9a-f]{40}$")
MARKER = re.compile(
    r"<!--\s*pro-ship:pr-check\s+head=([0-9a-f]{40})\s+result=([a-z]+)\s+tier=([a-z]+)\s*-->")
SEMVER_TAG = re.compile(r"(?:^|[^0-9A-Za-z.])v?\d+\.\d+\.\d+")
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

def release_tag(root: str, head: str, pattern: str | None = None) -> str | None:
    """The newest release tag reachable from HEAD, as a commit sha."""
    for tag in release_tags(root, pattern, "--merged", head, "--sort=-creatordate"):
        sha = rev(root, tag)
        if sha:
            return sha
    return None


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
    if not deploy_kind:
        base = release_tag(root, head, pattern)
        source = "tag" if base else "none"
        kind = "tag"
    else:
        kind = "deploy"
        if wanted == "ask":
            source = "ask"
        else:
            order = [wanted] if wanted in ("github", "tag") else ["github", "tag"]
            for src in order:
                cand = github_deploy(root) if src == "github" else release_tag(root, head, pattern)
                if cand and rev(root, cand):
                    base, source = rev(root, cand), src
                    break
    return {"kind": kind, "base": base, "head": head, "range": f"{base}..{head}" if base else None,
            "last_deploy_source": source, "targets": tg}


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
