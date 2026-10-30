#!/usr/bin/env python3
"""Work out the documents a repo must have and say which are missing (ADR-0020).

Usage: required-docs.py [--repo <path>] [--json] [--policy-ref <ref>] [--worktree]

  --repo <path>        the repo to check (default: the current directory)
  --json               print {source, signals, rows, missing, findings}
  --policy-ref <ref>   read REVIEW.md from that commit with `git show`, so a pull request
                       cannot loosen its own set; presence is always judged at HEAD. A ref
                       that is not a commit, starts with "-" or cannot be read is could-not-run
  --worktree           count a document as present when the file exists in the working tree,
                       tracked or not (never through a symlink that leaves the repo), so a
                       drafting step cannot overwrite an uncommitted file

The built-in set has eight rows: README.md, CLAUDE.md, AGENTS.md, REVIEW.md and docs/decisions/
always; ARCHITECTURE.md when the code shows more than one module, service or deployable;
PRODUCT.md when the repo has users (today: a UI); DESIGN.md when it has a UI. An optional
`## Required documents` block in REVIEW.md (keys `add` and `remove`) tunes the set.

Unless --worktree is given, a document is present only when tracked at HEAD. The script reads tracked paths and a few
manifests, writes nothing and makes no network call. Every git call is bounded by a timeout.

Without --json it prints `missing  <doc>  (<rule>)` per missing document, then one line per
finding. Exit codes: 0 nothing missing, 3 one or more missing, 2 could not run (not a git repo,
git failed or timed out; stdout then holds {"could_not_run": true, "reason": ...}).
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys

UI_DEPS = {
    "react", "react-dom", "vue", "svelte", "@sveltejs/kit", "@angular/core", "solid-js",
    "preact", "next", "nuxt", "astro", "@remix-run/react", "react-native", "expo", "electron",
}
ARCH_FILES = {"pnpm-workspace.yaml", "lerna.json", "nx.json", "turbo.json", "go.work"}
MANIFESTS = {"package.json", "pyproject.toml", "go.mod", "Cargo.toml"}
IGNORED_SEGMENTS = {
    "tests", "test", "__tests__", "fixtures", "__fixtures__", "examples", "example",
    "node_modules", "vendor", "third_party",
}
ALWAYS = ["README.md", "CLAUDE.md", "AGENTS.md", "REVIEW.md", "docs/decisions/"]
REMOVABLE = {"ARCHITECTURE.md", "PRODUCT.md", "DESIGN.md"}


class NotRunnable(Exception):
    pass


def git(repo, *args, raw=False):
    """Run git in repo. Bounded by a timeout and never raises; (ok, stdout)."""
    try:
        r = subprocess.run(["git", "-C", repo, *args], capture_output=True, timeout=10)
    except Exception:
        return False, ""
    out = r.stdout.decode("utf-8", "replace")
    return r.returncode == 0, out if raw else out.strip()


def ignored(path):
    return any(seg in IGNORED_SEGMENTS for seg in path.split("/")[:-1])


def read_json(repo, rel):
    try:
        with open(os.path.join(repo, rel), encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def read_text(repo, rel):
    try:
        with open(os.path.join(repo, rel), encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return ""


def ui_dep(pkg):
    for key in ("dependencies", "devDependencies"):
        deps = pkg.get(key)
        if isinstance(deps, dict):
            for name in deps:
                if name in UI_DEPS:
                    return name
    return None


def workspace_globs(repo, tracked):
    globs = []
    ws = read_json(repo, "package.json").get("workspaces")
    if isinstance(ws, dict):
        ws = ws.get("packages")
    if isinstance(ws, list):
        globs += [g for g in ws if isinstance(g, str)]
    if "pnpm-workspace.yaml" in tracked:
        in_list = False
        for line in read_text(repo, "pnpm-workspace.yaml").splitlines():
            if re.match(r"^packages\s*:", line):
                in_list = True
                continue
            if in_list:
                m = re.match(r"^\s+-\s*(.+?)\s*$", line)
                if m:
                    globs.append(m.group(1).strip("\"'"))
                elif line.strip() and not line.lstrip().startswith("#"):
                    in_list = False
    return [g.rstrip("/").removeprefix("./") for g in globs if not g.startswith("!")]


def ui_signal(repo, tracked):
    cands = []
    if "package.json" in tracked:
        cands.append("package.json")
    globs = workspace_globs(repo, tracked)
    for p in sorted(tracked):
        if p.endswith("/package.json") and any(fnmatch.fnmatchcase(p.rsplit("/", 1)[0], g) for g in globs):
            cands.append(p)
    for rel in cands:
        hit = ui_dep(read_json(repo, rel))
        if hit:
            return True, f"{hit} in {rel}"
    for p in sorted(tracked):
        if p.split("/")[-1] == "pubspec.yaml" and re.search(r"\bflutter\b", read_text(repo, p)):
            return True, f"flutter in {p}"
    if "DESIGN.md" in tracked:
        return True, "DESIGN.md is tracked"
    return False, ""


def arch_signal(repo, tracked):
    for f in sorted(ARCH_FILES):
        if f in tracked:
            return True, f
    if "workspaces" in read_json(repo, "package.json"):
        return True, "workspaces in package.json"
    if re.search(r"^\[workspace\]", read_text(repo, "Cargo.toml"), re.M):
        return True, "[workspace] in Cargo.toml"
    if re.search(r"^\[tool\.uv\.workspace\]", read_text(repo, "pyproject.toml"), re.M):
        return True, "[tool.uv.workspace] in pyproject.toml"
    dirs = {}
    for p in sorted(tracked):
        if ignored(p):
            continue
        if p.split("/")[-1] in MANIFESTS:
            dirs.setdefault(os.path.dirname(p), p)
    if len(dirs) >= 2:
        return True, "manifests in " + ", ".join(sorted(dirs.values())[:3])
    docker = [p for p in sorted(tracked) if not ignored(p) and p.split("/")[-1].startswith("Dockerfile")]
    if len(docker) >= 2:
        return True, "Dockerfiles " + ", ".join(docker[:3])
    return False, ""


# --- the REVIEW.md block --------------------------------------------------------------
# A second, smaller copy of parse_block/read_policy in pro-ship's risk-classify.py, because
# plugins cannot import each other (ADR-0003). Only the list keys add and remove are kept.

KEY_RE = re.compile(r"([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*:\s*(.*?)\s*\Z")
LIST_KEYS = ("add", "remove")


class BlockError(Exception):
    pass


def unquote(v):
    v = v.strip()
    return v[1:-1] if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'" else v


def parse_block(block):
    policy, pending = {}, None
    for n, raw in enumerate(block.splitlines(), 1):
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indented = raw[:1] in (" ", "\t")
        if indented and stripped.startswith("- ") and pending is not None:
            policy[pending].append(unquote(stripped[2:]))
            continue
        m = None if indented else KEY_RE.match(raw)
        if not m:
            raise BlockError(f"line {n} is not a key: value or list item")
        key, value = m.group(1), m.group(2)
        if key in policy:
            raise BlockError(f"duplicate key {key}")
        pending = None
        if value == "":
            policy[key] = []
            pending = key
        elif value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            policy[key] = [unquote(x) for x in inner.split(",")] if inner else []
        else:
            policy[key] = value
    for key, value in policy.items():
        if key not in LIST_KEYS:
            raise BlockError(f"unknown key {key}")
        if not isinstance(value, list):
            raise BlockError(f"{key} must be a list")
    for doc in policy.get("remove", []):
        if doc not in REMOVABLE:
            raise BlockError(f"remove may name only ARCHITECTURE.md, PRODUCT.md or DESIGN.md, not {doc}")
    for doc in policy.get("add", []):
        if not doc or doc.startswith("/") or ".." in doc.split("/"):
            raise BlockError(f"add holds a path that is not repo-relative: {doc}")
    return policy


def read_policy(text):
    """(policy dict, source) where source is defaults, REVIEW.md or unreadable (<reason>)."""
    if not text:
        return {}, "defaults"
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    m = re.search(r"^##[ \t]+Required documents[ \t]*$", text, re.M | re.I)
    if not m:
        return {}, "defaults"
    rest = text[m.end():]
    nxt = re.search(r"^## ", rest, re.M)
    section = rest[:nxt.start()] if nxt else rest
    fence = re.search(r"^```[^\n]*\n(.*?)^```[ \t]*$", section, re.M | re.S)
    if not fence:
        return {}, "unreadable (no fenced block)"
    try:
        return parse_block(fence.group(1)), "REVIEW.md"
    except BlockError as e:
        return {}, f"unreadable ({e})"


# --- presence -------------------------------------------------------------------------

def is_present(doc, tracked):
    if doc == "docs/decisions/":
        return any(p.startswith("docs/decisions/") or p.startswith("docs/adr/") for p in tracked)
    if doc.endswith("/"):
        return any(p.startswith(doc) for p in tracked)
    return doc in tracked


def is_present_worktree(top, doc):
    """True when the path exists under top, resolving symlinks and refusing any that leave it."""
    root = os.path.realpath(top)

    def inside(rel):
        full = os.path.join(top, rel)
        if not os.path.lexists(full):
            return None
        real = os.path.realpath(full)
        if real != root and not real.startswith(root + os.sep):
            return None
        return real

    if doc == "docs/decisions/":
        return any(inside(d) and os.path.isdir(inside(d)) for d in ("docs/decisions", "docs/adr"))
    real = inside(doc.rstrip("/"))
    if not real:
        return False
    return os.path.isdir(real) if doc.endswith("/") else os.path.isfile(real)


def agent_files_differ(repo, tracked):
    a, c = os.path.join(repo, "AGENTS.md"), os.path.join(repo, "CLAUDE.md")
    if "AGENTS.md" not in tracked or "CLAUDE.md" not in tracked:
        return False
    if os.path.islink(a) or os.path.islink(c) or not os.path.isfile(a) or not os.path.isfile(c):
        return False
    try:
        ba, bc = open(a, "rb").read(), open(c, "rb").read()
    except OSError:
        return False
    if ba == bc:
        return False
    for data, other in ((ba, "CLAUDE.md"), (bc, "AGENTS.md")):
        text = data.decode("utf-8", "replace")
        if len(text.strip().splitlines()) <= 10 and other in text:
            return False
    return True


def check(repo_arg, policy_ref, worktree=False):
    ok, top = git(repo_arg, "rev-parse", "--show-toplevel")
    if not ok or not top:
        raise NotRunnable("not a git repository, or git failed")
    ok, listing = git(top, "ls-files", "-z", raw=True)
    if not ok:
        raise NotRunnable("git ls-files failed or timed out")
    tracked = {p for p in listing.split("\0") if p}

    ui, ui_ev = ui_signal(top, tracked)
    arch, arch_ev = arch_signal(top, tracked)
    signals = {
        "ui": {"holds": ui, "evidence": ui_ev},
        "users": {"holds": ui, "evidence": ui_ev},
        "architecture": {"holds": arch, "evidence": arch_ev},
    }

    if policy_ref:
        if policy_ref.startswith("-"):
            raise NotRunnable("policy ref must not start with -")
        ok, _ = git(top, "cat-file", "-e", f"{policy_ref}^{{commit}}")
        if not ok:
            raise NotRunnable(f"policy ref {policy_ref} is not a readable commit")
        ok, _ = git(top, "cat-file", "-e", f"{policy_ref}:REVIEW.md")
        if ok:
            ok, text = git(top, "show", f"{policy_ref}:REVIEW.md", raw=True)
            if not ok:
                raise NotRunnable(f"could not read REVIEW.md at {policy_ref}")
        else:
            text = ""
    else:
        text = read_text(top, "REVIEW.md")
    policy, source = read_policy(text)
    findings = []
    if source.startswith("unreadable"):
        findings.append("required-docs-block-" + source)

    rows = [{"doc": d, "rule": "always", "applies": True} for d in ALWAYS]
    rows.append({"doc": "ARCHITECTURE.md", "rule": f"more than one module, service or deployable: {arch_ev}", "applies": arch})
    rows.append({"doc": "PRODUCT.md", "rule": f"has users: {ui_ev}", "applies": ui})
    rows.append({"doc": "DESIGN.md", "rule": f"has a UI: {ui_ev}", "applies": ui})
    removed = set(policy.get("remove", []))
    for r in rows:
        if r["doc"] in removed:
            r["applies"] = False
    have = {r["doc"] for r in rows}
    for doc in policy.get("add", []):
        if doc in have:
            for r in rows:
                if r["doc"] == doc:
                    r["rule"], r["applies"] = "REVIEW.md add", True
        else:
            rows.append({"doc": doc, "rule": "REVIEW.md add", "applies": True})
            have.add(doc)
    for r in rows:
        r["present"] = is_present_worktree(top, r["doc"]) if worktree else is_present(r["doc"], tracked)
    missing = [{"doc": r["doc"], "rule": r["rule"]} for r in rows if r["applies"] and not r["present"]]
    if agent_files_differ(top, tracked):
        findings.append("agent-files-differ (AGENTS.md and CLAUDE.md are separate files with different content)")
    return {"source": source, "signals": signals, "rows": rows, "missing": missing, "findings": findings}


def main():
    ap = argparse.ArgumentParser(description="Report the required documents a repo is missing.")
    ap.add_argument("--repo", default=".")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--policy-ref")
    ap.add_argument("--worktree", action="store_true")
    args = ap.parse_args()
    try:
        res = check(args.repo, args.policy_ref, args.worktree)
    except NotRunnable as e:
        print(json.dumps({"could_not_run": True, "reason": str(e)}))
        return 2
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        for m in res["missing"]:
            print(f"missing  {m['doc']}  ({m['rule']})")
        for f in res["findings"]:
            print(f"finding  {f}")
    return 3 if res["missing"] else 0


if __name__ == "__main__":
    sys.exit(main())
