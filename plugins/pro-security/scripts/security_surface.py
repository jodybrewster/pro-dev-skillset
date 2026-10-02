#!/usr/bin/env python3
"""Shared security-surface classifier for the pro-security hooks.

Two pure functions do the classification:

  text_hits(text)  -> sorted unique categories matched in prose (plans, prompts)
  diff_hits(diff)  -> sorted unique categories matched in a unified diff

The hooks import this module (each script puts its own directory on sys.path).
Below the classifier sit a few small I/O helpers shared by the hooks (state
file, git root, hook output). They are kept apart so the classifier stays pure.

Both classifiers err toward silence: a hook that cries wolf on design or LLM
work gets turned off, so every category needs at least one strong term and
common false friends (design tokens, LLM token budgets, git hashes, session
ledgers) are scrubbed before matching.

Manual testing:
  echo "add magic-link login" | python3 security_surface.py
  git diff --cached | python3 security_surface.py --diff
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
# Prose classifier

_I = re.IGNORECASE

# Phrases that look security-adjacent but are not. Removed before matching.
_SCRUB = [
    r"\bdesign[- ]tokens?\b",
    r"\b(?:colou?r|spacing|typography|type|font|size|radius|shadow|motion|theme|css|brand)[- ]tokens?\b",
    r"\btokens?[- ](?:budgets?|counts?|usage|limits?|costs?|windows?|estimates?|savings?|efficien\w+)\b",
    r"\b(?:input|output|context|prompt|completion|max|total|cached|reasoning|thinking)[- ]tokens?\b",
    r"\btokens? (?:per|used|consumed|spent)\b",
    r"\bcontext windows?\b",
    r"\bsession[- ](?:start|end|ledger|transcript|summary|memory|log|notes?|handoff)\b",
    r"\b(?:this|current|previous|last|claude(?: code)?|agent|coding) sessions?\b",
    r"\bgit (?:commit )?hash(?:es)?\b",
    r"\b(?:content|file|commit|build|cache) hash(?:es)?\b",
]
_SCRUB_RE = re.compile("|".join(_SCRUB), _I)

_CATEGORIES: dict[str, list[str]] = {
    "auth": [
        r"\blogins?\b", r"\blog-in\b", r"\blog in (?:to|as|with)\b",
        r"\bsign[- ]?(?:up|in)s?\b", r"\bsignups?\b",
        r"\bpasswords?\b", r"\bpassphrases?\b", r"\bpasswordless\b",
        r"\bsession (?:cookies?|tokens?|ids?|fixation|hijack\w*|management|store|expiry|timeouts?)\b",
        r"\b(?:user|login|auth(?:enticated)?) sessions?\b",
        r"\bcookies?\b", r"\bJWTs?\b", r"\bOAuth ?2?\b", r"\bOIDC\b", r"\bSSO\b",
        r"\bmagic[- ]?links?\b", r"\bMFA\b", r"\b2FA\b", r"\btwo[- ]factor\b",
        r"\bAPI[- ]keys?\b",
        r"\b(?:access|refresh|bearer|auth|id|api|csrf|personal access) tokens?\b",
        r"\bbearer\b", r"\bauthenticat\w+",
    ],
    "authz": [
        r"\bpermissions?\b", r"\bRBAC\b", r"\broles? and permissions?\b",
        r"\b(?:user|admin|team|org\w*) roles?\b", r"\brole[- ]based\b",
        r"\badmin (?:panel|page|route|role|user|dashboard|only|endpoint|access|area|console)s?\b",
        r"\b(?:an?|the|for|as|by|only) admins?\b", r"\badmins\b", r"\bsuperusers?\b",
        r"\bmulti[- ]?tenan\w+", r"\btenant (?:isolation|boundar\w+|id)\b", r"\btenants?\b",
        r"\bownership (?:check|model|rules?)\b", r"\baccess[- ]control\b", r"\bIDOR\b",
        r"\bauthoriz\w+", r"\bunauthori[sz]ed\b", r"\bunauthenticated\b",
        r"\bpublic (?:API )?endpoints?\b",
        r"\b(?:API )?(?:routes?|endpoints?) that accepts? (?:user|untrusted|external) (?:input|data)\b",
    ],
    "injection": [
        r"\bSQL injection\b", r"\braw (?:SQL|quer(?:y|ies))\b", r"\bdynamic SQL\b",
        r"\bSQL (?:quer(?:y|ies)|strings?|statements?) (?:built|constructed|concatenat\w+)\b",
        r"\bshell (?:commands?|out|exec\w*|injection)\b", r"\bcommand injection\b",
        r"\bexec(?:ute)? (?:a |an |the )?(?:shell|commands?|subprocess)\b",
        r"\bchild_process\b", r"\beval\b", r"\bdeserializ\w+", r"\bunpickl\w+", r"\bpickle\b",
        r"\brender(?:ing)? (?:of )?user (?:input|content|supplied)\b",
        r"\btemplate (?:rendering|injection)\b", r"\bSSTI\b",
        r"\buntrusted (?:input|data|content)\b", r"\buser[- ]supplied\b",
    ],
    "ssrf-urls": [
        r"\bSSRF\b", r"\b(?:user|client)[- ](?:supplied|provided|controlled) URLs?\b",
        r"\bfetch\w* (?:a |the |any )?(?:user|external|arbitrary|remote) URLs?\b",
        r"\bwebhook URLs?\b", r"\bopen redirects?\b", r"\bredirect_uri\b",
        r"\bredirect(?:s|ing)? (?:the user )?(?:to|back to) (?:a |the )?(?:user|url|returnTo|next|callback)\w*",
        r"\bcallback URLs?\b", r"\bproxy(?:ing)? (?:requests?|user|arbitrary)\b",
    ],
    "uploads": [
        r"\bfile[- ]?uploads?\b", r"\bimage uploads?\b", r"\bmultipart\b",
        r"\bpresigned\b", r"\bpre-signed\b",
        r"\busers? upload\w*", r"\buploads? (?:an? |the )?(?:avatar|image|file|photo|document|attachment|csv|pdf)s?\b",
        r"\buploaded (?:files?|images?|documents?)\b",
    ],
    "webhooks": [r"\bwebhooks?\b"],
    "payments": [
        r"\bstripe\b", r"\bcheckout (?:flow|page|session)s?\b", r"\bbilling\b",
        r"\bpayments?\b", r"\bcredit[- ]cards?\b", r"\bcard (?:number|details|data)s?\b", r"\bPCI\b",
    ],
    "pii": [
        r"\bPII\b", r"\bpersonal (?:data|information)\b", r"\bemail addresses\b",
        r"\bphone numbers?\b", r"\b(?:home|street|billing|mailing) address(?:es)?\b",
        r"\bSSNs?\b", r"\bsocial security\b", r"\bGDPR\b", r"\bhealth data\b",
        r"\bHIPAA\b", r"\bmedical records?\b",
    ],
    "secrets": [
        r"\bsecrets?\b", r"\bcredentials?\b", r"(?<![\w/])\.env\b", r"\bprivate keys?\b",
        r"\bencryption keys?\b", r"\bKMS\b", r"\b(?:hashicorp|secrets?) vault\b",
    ],
    "crypto": [
        r"\bencrypt\w*", r"\bdecrypt\w*", r"\bhash(?:ing|ed)? (?:the |user |user's )?passwords?\b",
        r"\bpassword hash\w*", r"\bbcrypt\b", r"\bargon2\b", r"\bscrypt\b", r"\bHMACs?\b",
        r"\b(?:verify|verifying|verification of|sign|signing|validate|validating|check|checking) (?:the |each |request |webhook )*signatures?\b",
        r"\bsignature (?:verification|validation|check)\b", r"\bTLS\b", r"\bSSL\b",
        r"\bcertificates?\b", r"\bcert pinning\b",
    ],
    "web-headers": [
        r"\bCORS\b", r"\bCSP\b", r"\bcontent[- ]security[- ]policy\b", r"\bCSRF\b", r"\bXSS\b",
        r"\bSameSite\b", r"\bHttpOnly\b", r"\bsecurity headers?\b", r"\bclickjacking\b",
    ],
    "llm": [
        r"\bsystem prompts?\b", r"\bprompt[- ]injections?\b", r"\bjailbreak\w*",
        r"\btool[- ]calling\b", r"\btool[- ]use by (?:the )?(?:model|agent)\b",
        r"\bagents? with (?:tool|shell|file|network|browser|filesystem)s?\b",
        r"\bagents? with (?:\w+ )?(?:tool|shell|file|network|browser) access\b",
        r"\bRAG\b", r"\bretrieval[- ]augmented\b",
        r"\b(?:LLM|model|AI) output (?:is |gets |being )?(?:rendered|inserted|injected|executed)\b",
        r"\brender(?:ing)? (?:the )?(?:LLM|model|AI) output\b",
        r"\buser (?:input|content|text) (?:into|in|to) (?:the |a )?(?:system )?prompt\b",
        r"\buntrusted (?:content|input|text) (?:into|in) (?:the )?(?:prompt|context)\b",
    ],
    "ci-infra": [
        r"\bGitHub Actions?\b", r"\.github/workflows\b", r"\bCI secrets?\b", r"\bDockerfiles?\b",
        r"\bTerraform\b", r"\bIAM\b", r"\bKubernetes\b", r"\bk8s\b", r"\bdeploy keys?\b",
        r"\bdocker-compose\b", r"\bpull_request_target\b",
    ],
    "dependencies": [
        r"\b(?:add|adding|install|installing|introduc\w+|pull(?:ing)? in|bring(?:ing)? in|adopt\w*) (?:an? |the |one )?(?:new )?(?:third[- ]party |open[- ]source |npm |pip |pypi |python |node )?(?:dependency|package|library|SDK)\b",
        r"\bnew (?:dependenc(?:y|ies)|packages|librar(?:y|ies)|SDKs?)\b",
    ],
}
_COMPILED = {k: [re.compile(p, _I) for p in v] for k, v in _CATEGORIES.items()}


def text_hits(text: str) -> list[str]:
    """Categories matched in prose. Sorted, unique. Empty for benign text."""
    if not text or not isinstance(text, str):
        return []
    clean = _SCRUB_RE.sub(" ", text)
    return sorted(c for c, pats in _COMPILED.items() if any(p.search(clean) for p in pats))


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

PLAN_SECTION_RE = re.compile(r"^##\s+Security challenge\b", re.I | re.M)
AGENT_HINT = (
    "Dispatch the `security-architect` subagent "
    "(if subagents are unavailable, apply the security-architect skill yourself)"
)


ARCHITECT_TRANSCRIPT_MAX_BYTES = 64 * 1024 * 1024
SELF_REVIEW_NOTE = (
    "A `## Security challenge` section the plan's author wrote does not count: the point is an "
    "independent pass by someone who did not write the plan. "
)


def architect_ran(transcript_path: str | None) -> bool:
    """True when this session dispatched the security-architect subagent or skill.

    Without a readable transcript the gate cannot tell, so it answers True and
    trusts the section heading alone (fail open, never wedge on missing data).
    """
    if not transcript_path:
        return True
    try:
        if os.path.getsize(transcript_path) > ARCHITECT_TRANSCRIPT_MAX_BYTES:
            return True
        with open(transcript_path, errors="replace") as fh:
            for line in fh:
                if "security-architect" not in line and "threat-model" not in line:
                    continue
                try:
                    entry = json.loads(line)
                except Exception:
                    continue
                msg = entry.get("message")
                content = msg.get("content") if isinstance(msg, dict) else None
                for block in content if isinstance(content, list) else []:
                    if not isinstance(block, dict) or block.get("type") != "tool_use":
                        continue
                    inp = block.get("input") if isinstance(block.get("input"), dict) else {}
                    name = block.get("name")
                    if name in ("Agent", "Task") and str(inp.get("subagent_type", "")).endswith("security-architect"):
                        return True
                    if name == "Skill" and any(k in str(inp.get("skill", "")) for k in ("security-architect", "threat-model")):
                        return True
    except OSError:
        return True
    return False


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


def plans_dir() -> str:
    return os.environ.get("PRO_DEV_PLANS_DIR") or os.path.expanduser("~/.claude/plans")


def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


def deny_pretool(reason: str) -> None:
    emit({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                 "permissionDecision": "deny",
                                 "permissionDecisionReason": reason}})


if __name__ == "__main__":
    data = sys.stdin.read()
    hits = diff_hits(data) if "--diff" in sys.argv[1:] else text_hits(data)
    print("\n".join(hits))
