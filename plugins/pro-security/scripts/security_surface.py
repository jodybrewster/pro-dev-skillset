#!/usr/bin/env python3
"""Shared security-surface classifier for the pro-security push gate.

Two pure functions do the classification:

  diff_files(diff) -> {category: [paths]} for a unified diff
  diff_hits(diff)  -> sorted unique categories matched in a unified diff

push-gate.py imports this module (it puts its own directory on sys.path).
Below the classifier sit a few small I/O helpers (state file, git root, hook
output). They are kept apart so the classifier stays pure.

The classifier errs toward silence: a hook that cries wolf gets turned off, so
documentation, lockfiles and example env files never count.

Manual testing:
  git diff origin/main...HEAD | python3 security_surface.py
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

# ---------------------------------------------------------------------------
# Diff classifier

_DOC_EXT = (".md", ".mdx", ".txt", ".rst")
_LOCKFILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock",
    "poetry.lock", "cargo.lock", "go.sum", "gemfile.lock", "uv.lock", "composer.lock",
}


def _is_doc_like(path: str) -> bool:
    p = path.lower()
    base = p.rsplit("/", 1)[-1]
    if p.endswith(_DOC_EXT) or base in _LOCKFILES:
        return True
    return p.startswith("docs/") or "/docs/" in p


_EXT_ROUTE = r"\.(?:[cm]?[jt]sx?|py|rb|go|rs|php|java|kt|cs|ex|exs)$"
_PATH_RULES: list[tuple[str, re.Pattern]] = [
    ("auth", re.compile(r"(?:^|/)(?:auth\w*|login\w*|sign-?(?:in|up)\w*|oauth\w*|sessions?)(?:/|\.[a-z]+$)")),
    ("authz", re.compile(r"(?:^|/)(?:permissions?|rbac|acl|policies|policy|middleware)(?:/|\.[a-z]+$)")),
    ("api-route", re.compile(r"(?:^|/)(?:app/api|pages/api|api|routes)/.+" + _EXT_ROUTE)),
    ("webhooks", re.compile(r"(?:^|/)webhooks?(?:/|[.\-_/])|webhooks?\.[a-z]+$|[\-_]webhooks?\.[a-z]+$")),
    ("uploads", re.compile(r"(?:^|/)uploads?(?:/|\.[a-z]+$)|[\-_]uploads?\.[a-z]+$")),
    ("payments", re.compile(r"(?:^|/)(?:payments?|billing|stripe)(?:/|\.[a-z]+$)|[\-_](?:payments?|billing|stripe)\.[a-z]+$")),
    ("crypto", re.compile(r"(?:^|/)(?:crypto|encryption)(?:/|\.[a-z]+$)")),
    ("ci-infra", re.compile(r"(?:^|/)\.github/workflows/|(?:^|/)dockerfile[^/]*$|\.tf$|(?:^|/)docker-compose[^/]*$|(?:^|/)(?:k8s|kubernetes|helm)/")),
]
_ENV_RE = re.compile(r"(?:^|/)\.env(?:\.[\w.\-]+)?$")
_ENV_SAFE = re.compile(r"\.(?:example|sample|template|dist)$")

_DEP_FILES = {"package.json", "requirements.txt", "pyproject.toml", "go.mod", "cargo.toml", "gemfile"}
_NOT_DEP_KEYS = {
    "version", "name", "edition", "python", "requires-python", "rust-version", "description",
    "license", "authors", "readme", "ruby", "main", "module", "types", "type", "private",
    "homepage", "repository", "node", "npm", "engines", "packageManager", "go", "toolchain",
}
_SEMVERISH = re.compile(
    r"^(?:[\^~<>=]*\s*\d[\w.\-+ <>=|^~*]*|(?:workspace|npm|file|link|github|git\+?\w*|https?):.*|latest|\*)$"
)


def _dep_names(basename: str, line: str) -> str | None:
    """Return the dependency name an added line declares, or None."""
    s = line.strip()
    if not s or s.startswith(("#", "//")):
        return None
    if basename == "package.json":
        m = re.match(r'^"([@\w./\-]+)"\s*:\s*"([^"]*)"\s*,?$', s)
        if m and m.group(1) not in _NOT_DEP_KEYS and _SEMVERISH.match(m.group(2)):
            return m.group(1)
    elif basename == "requirements.txt":
        m = re.match(r"^([A-Za-z0-9][\w.\-]*)(?:\[[^\]]*\])?\s*(?:[<>=~!]=?.*)?$", s)
        if m:
            return m.group(1).lower()
    elif basename == "pyproject.toml":
        m = re.match(r'^"([A-Za-z0-9][\w.\-]*)(?:\[[^\]]*\])?\s*[<>=~!]=?[^"]*",?$', s)
        if m:
            return m.group(1).lower()
        m = re.match(r'^([A-Za-z0-9][\w.\-]*)\s*=\s*(?:"([^"]*)"|\{.*\})\s*,?$', s)
        if m and m.group(1) not in _NOT_DEP_KEYS and (m.group(2) is None or _SEMVERISH.match(m.group(2))):
            return m.group(1).lower()
    elif basename == "go.mod":
        m = re.match(r"^(?:require\s+)?([\w.\-]+\.[a-z]+/[\w./\-~]+)\s+v\d", s)
        if m:
            return m.group(1)
    elif basename == "cargo.toml":
        m = re.match(r'^([A-Za-z0-9][\w\-]*)\s*=\s*(?:"([^"]*)"|\{.*\})\s*,?$', s)
        if m and m.group(1) not in _NOT_DEP_KEYS and (m.group(2) is None or _SEMVERISH.match(m.group(2))):
            return m.group(1).lower()
    elif basename == "gemfile":
        m = re.match(r"""^gem\s+['"]([\w.\-]+)['"]""", s)
        if m:
            return m.group(1).lower()
    return None


_Q = r"""["'`]"""
_SQL_KW = r"(?:SELECT\s[^\n]{0,200}?\sFROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)"
_CONTENT_RULES: list[tuple[str, re.Pattern]] = [
    ("injection", re.compile(r"(?<![.\w])eval\s*\(")),
    ("injection", re.compile(r"(?<![.\w])exec\s*\(")),
    ("injection", re.compile(r"\bchild_process\b|\bos\.system\s*\(|\bshell\s*=\s*True\b")),
    ("xss", re.compile(r"dangerouslySetInnerHTML|\.innerHTML\s*=|\bv-html\b|\bhtml_safe\b|\bmark_safe\b")),
    ("injection", re.compile(r"`\s*" + _SQL_KW + r"[^`]*\$\{", re.I)),
    ("injection", re.compile(r"\bf[\"']\s*" + _SQL_KW + r"[^\"']*\{", re.I)),
    ("injection", re.compile(_Q + r"\s*" + _SQL_KW + r"[^\"'`]*" + _Q + r"\s*\+", re.I)),
    ("auth", re.compile(r"\bjsonwebtoken\b|\bjwt\b", re.I)),
    ("crypto", re.compile(r"\bbcrypt\w*|\bargon2\w*|createHmac|createCipher(?:iv)?\b")),
    ("secrets", re.compile(r"process\.env\.\w*(?:SECRET|KEY|TOKEN)\w*|os\.environ(?:\[|\.get\()\s*[\"']\w*(?:SECRET|KEY|TOKEN)")),
    ("web-headers", re.compile(r"Access-Control-Allow-Origin|\bcors\s*\(", re.I)),
    ("crypto", re.compile(r"\bverify\s*=\s*False\b|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED")),
    ("ssrf-urls", re.compile(
        r"(?:\bfetch|\baxios(?:\.\w+)?|\brequests\.\w+|\bhttpx\.\w+|\burlopen)\(\s*"
        r"(?:`[^`]*\$\{[^}]*\b(?:req|request|params|query|body)\b"
        r"|[^\"'`\s)][^)]*\b(?:req|request|params|query|body)\b[.\[])"
    )),
    ("injection", re.compile(r"\bpickle\.loads?\(|\byaml\.load\(|\bMarshal\.load\b")),
    ("llm", re.compile(
        r"(?:system[_ ]?prompt|systemPrompt|\bsystem)\s*[:=]\s*(?:f[\"'][^\"']*\{|`[^`]*\$\{)", re.I)),
    ("llm", re.compile(
        r"role[\"']?\s*:\s*[\"']system[\"'][^}\n]*content[\"']?\s*:\s*(?:f[\"'][^\"']*\{|`[^`]*\$\{)")),
]


def diff_files(diff_text: str) -> dict[str, list[str]]:
    """Map category -> sorted unique file paths for a unified diff."""
    found: dict[str, set[str]] = {}

    def add(cat: str, path: str) -> None:
        found.setdefault(cat, set()).add(path)

    files: list[dict] = []
    cur: dict | None = None
    in_hunk = False
    for line in (diff_text or "").splitlines():
        if line.startswith("diff --git "):
            m = re.search(r" b/(.+)$", line)
            cur = {"path": m.group(1) if m else "", "added": [], "removed": [], "deleted": False}
            files.append(cur)
            in_hunk = False
            continue
        if not in_hunk:
            if line.startswith("deleted file mode") and cur:
                cur["deleted"] = True
            elif line.startswith("+++ "):
                p = line[4:].strip()
                if p == "/dev/null":
                    continue
                p = p[2:] if p.startswith("b/") else p
                if cur is None or not cur["path"]:
                    cur = {"path": p, "added": [], "removed": [], "deleted": False}
                    files.append(cur)
            elif line.startswith("@@") and cur is not None:
                in_hunk = True
            continue
        if line.startswith("@@"):
            continue
        if cur is None:
            continue
        if line.startswith("+"):
            cur["added"].append(line[1:])
        elif line.startswith("-"):
            cur["removed"].append(line[1:])

    for f in files:
        path = f["path"]
        if not path or f["deleted"]:
            continue
        low = path.lower()
        base = low.rsplit("/", 1)[-1]
        docish = _is_doc_like(path)
        if not docish:
            for cat, rx in _PATH_RULES:
                if rx.search(low):
                    add(cat, path)
            if _ENV_RE.search(low) and not _ENV_SAFE.search(low):
                add("secrets", path)
            if base in _DEP_FILES:
                removed = {_dep_names(base, r) for r in f["removed"]} - {None}
                for a in f["added"]:
                    name = _dep_names(base, a)
                    if name and name not in removed:
                        add("dependencies", path)
                        break
            for a in f["added"]:
                for cat, rx in _CONTENT_RULES:
                    if rx.search(a):
                        add(cat, path)
    return {k: sorted(v) for k, v in found.items()}


def diff_hits(diff_text: str) -> list[str]:
    """Categories matched in a unified diff. Sorted, unique."""
    return sorted(diff_files(diff_text))


# ---------------------------------------------------------------------------
# Shared hook helpers (I/O). Not part of the pure classifier above.

AGENT_HINT = (
    "Dispatch the `security-architect` subagent "
    "(if subagents are unavailable, apply the security-architect skill yourself)"
)


def read_payload() -> dict | None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def run_git(args: list[str], cwd: str, timeout: int = 10) -> tuple[bool, str]:
    try:
        r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True,
                           timeout=timeout, errors="replace")
        return r.returncode == 0, r.stdout
    except Exception:
        return False, ""


def key_root(cwd: str) -> str:
    ok, out = run_git(["rev-parse", "--show-toplevel"], cwd)
    return out.strip() if ok and out.strip() else cwd


def state_path(session_id: str, root: str) -> str:
    home = os.environ.get("PRO_DEV_STATE_DIR") or os.path.expanduser("~/.claude/pro-dev")
    key = hashlib.sha256(f"{session_id}:{root}".encode()).hexdigest()[:16]
    return os.path.join(home, "security", f"{key}.json")


def load_state(path: str) -> dict:
    try:
        with open(path) as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_state(path: str, state: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(state, fh)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except Exception:
            pass
        raise


def session_state(payload: dict) -> tuple[str, dict]:
    cwd = payload.get("cwd") or os.getcwd()
    path = state_path(str(payload.get("session_id") or "nosession"), key_root(cwd))
    return path, load_state(path)


def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


def deny_pretool(reason: str) -> None:
    emit({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                 "permissionDecision": "deny",
                                 "permissionDecisionReason": reason}})


if __name__ == "__main__":
    print("\n".join(diff_hits(sys.stdin.read())))
