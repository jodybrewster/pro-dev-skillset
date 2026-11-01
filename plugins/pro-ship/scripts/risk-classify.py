#!/usr/bin/env python3
"""risk-classify.py - classify a branch diff as low, medium or high risk.

Usage: python3 risk-classify.py [--base REF] [--head REF] [--intent PATH] [--repo PATH] [--json]
Python 3 standard library only. No network, no model call, no edit to the repo.
Also imported by merge-gate.py: classify(repo, base=None, head="HEAD", intent=None) -> dict.

Exit status: 0 low, 3 medium, 4 high, 2 could not run, 64 usage error.
A run that could not happen (no git, no merge base, empty range, timeout) is exit 2 and is
never low. An empty range is not a pull request, so it raises CouldNotRun("empty range").

JSON CONTRACT (--json; classify() returns the same dict)
  {
    "tier": "low" | "medium" | "high",       highest floor among signals and declared risk
    "signals": [                              sorted by (id, evidence)
      {"id": str, "floor": "low"|"medium"|"high", "strength": "strong"|"weak",
       "evidence": [str, ...],                paths, or counts such as "files=12"
       "reason": str}
    ],
    "declared": "low"|"medium"|"high"|"none", from the intent's front matter risk: line
    "findings": [str, ...],                   e.g. "risk-underdeclared: ..."
    "tie": [top, one_below] | null,           set when only weak signals reach the top tier
    "architecture": bool,                     a Dockerfile/infra change or a new env var read
    "demands": {"checks": [str], "reviewers": [str],
                "approval": "none"|"maintainer", "local_decision": "allow"|"ask",
                "label": "none"|"risk:high"},
    "base": str,                              full sha of the merge base
    "head": str,                              full sha of the head
    "policy": "defaults" | "unreadable (<reason>)" | "REVIEW.md",
    "notes": [str, ...]                       e.g. "surface-unavailable: security_surface"
  }
  Could not run, with --json, prints on stdout and exits 2:
    {"could_not_run": true, "reason": str, "tier": "high"}
  and without --json prints "risk-classify: could not run: <reason>" on stderr.
  Text output: first line "risk: <tier>", then "policy: <policy>", "declared: <declared>",
  an optional "tie: [a, b]" line, one "  <id> <floor> <strength> <evidence>: <reason>" line
  per signal, then one "finding: <text>" line per finding and "note: <text>" per note.
"""
import importlib.util
import json
import os
import posixpath
import re
import subprocess
import sys

sys.dont_write_bytecode = True  # importing a surface module must not leave __pycache__ behind

GIT_TIMEOUT = 10  # seconds, every git call
RANK = {"low": 0, "medium": 1, "high": 2}
NAMES = ["low", "medium", "high"]
EXIT = {"low": 0, "medium": 3, "high": 4}

# Size and area thresholds, each inside the range that changed no tier over the 30 merged PRs
# #60 to #89 (intent/2026-10-30-p0-hardening/calibration.md, from calibrate.py). REVIEW.md can
# override each one (R16).
#   FILES_MEDIUM 10: measured on PRs #60 to #89, no tier changes for 6 and up; 5 moves #63.
#   FILES_HIGH 30: no tier changes for 24 and up; 23 moves #70.
#   LINES_MEDIUM 300: no tier changes for 191 and up; 190 moves #63.
#   LINES_HIGH 1000: no tier changes for 968 and up; 967 moves #71.
#   AREAS_MEDIUM 3: the one value the table pins; 2 moves #63, 4 moves #67 and #73.
#   NO_TEST_LINES 50: no tier changes for 0 to 56 source lines added; 57 moves #77.
FILES_MEDIUM, FILES_HIGH = 10, 30
LINES_MEDIUM, LINES_HIGH = 300, 1000
AREAS_MEDIUM = 3
NO_TEST_LINES = 50
THRESHOLD_KEYS = ("files_medium", "files_high", "lines_medium", "lines_high", "areas_medium", "no_test_lines")


def default_thresholds():
    return dict(zip(THRESHOLD_KEYS, (FILES_MEDIUM, FILES_HIGH, LINES_MEDIUM, LINES_HIGH, AREAS_MEDIUM, NO_TEST_LINES)))

DEMANDS = {
    "low": {"checks": ["build", "lint", "typecheck", "tests"], "reviewers": [],
            "approval": "none", "local_decision": "allow", "label": "none"},
    "medium": {"checks": ["all"], "reviewers": ["code-reviewer"],
               "approval": "maintainer", "local_decision": "ask", "label": "none"},
    "high": {"checks": ["all"], "reviewers": ["code-reviewer", "security-architect"],
             "approval": "maintainer", "local_decision": "ask", "label": "risk:high"},
}

MANIFESTS = {"package.json", "requirements.txt", "pyproject.toml", "go.mod", "Cargo.toml", "Gemfile"}
NOT_DEPENDENCY_KEYS = {"name", "version", "description", "main", "module", "types", "license", "type",
                       "author", "homepage", "private", "repository", "bugs", "packageManager"}


class CouldNotRun(Exception):
    """The classifier could not read the diff; the caller treats this as high, never low."""


def git(repo, *args):
    try:
        r = subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True, timeout=GIT_TIMEOUT)
    except FileNotFoundError:
        raise CouldNotRun("git not found")
    except subprocess.TimeoutExpired:
        raise CouldNotRun("git timed out")
    except OSError as e:
        raise CouldNotRun(f"git failed ({e.strerror or e})")
    return r


def resolve(repo, ref):
    r = git(repo, "rev-parse", "--verify", "-q", ref + "^{commit}")
    out = r.stdout.strip()
    return out if r.returncode == 0 and out else None


def find_base(repo, head_sha, base):
    """The merge base with --base, else with the first target branch that resolves.

    The target is origin/HEAD, origin/main, origin/master, main or master. Never the branch's own
    upstream: on a pushed feature branch that is its own remote copy and hides the pushed commits."""
    candidates = [base] if base else ["origin/HEAD", "origin/main", "origin/master", "main", "master"]
    for cand in candidates:
        tip = resolve(repo, cand)
        if not tip:
            if base:
                raise CouldNotRun(f"base {base} does not resolve")
            continue
        r = git(repo, "merge-base", tip, head_sha)
        mb = r.stdout.strip()
        if r.returncode == 0 and mb:
            return mb
        if base:
            raise CouldNotRun(f"no merge base with {base}")
    raise CouldNotRun("no merge base")


def split_diff(patch):
    """{path: {"added": [lines], "removed": [lines], "status": "A"|"D"|"M"}} from one unified diff."""
    files, cur, in_hunk = {}, None, False
    for line in patch.splitlines():
        if line.startswith("diff --git "):
            rest = line[11:]
            n = (len(rest) - 5) // 2  # "a/P b/P" with --no-renames
            path = rest[2:2 + n] if rest.startswith("a/") and not rest.startswith('"') else None
            cur, in_hunk = None, False
            if path:
                cur = {"added": [], "removed": [], "status": "M"}
                files[path] = cur
        elif cur is None:
            continue
        elif not in_hunk and line.startswith("@@"):
            in_hunk = True
        elif not in_hunk and line.startswith("new file mode"):
            cur["status"] = "A"
        elif not in_hunk and line.startswith("deleted file mode"):
            cur["status"] = "D"
        elif in_hunk and line.startswith("+"):
            cur["added"].append(line[1:])
        elif in_hunk and line.startswith("-"):
            cur["removed"].append(line[1:])
    return files


def read_diff(repo, base_sha, head_sha):
    """The one git diff call: returns (files, patch text). Every rule reads this result."""
    r = git(repo, "-c", "core.quotepath=off", "diff", "-U0", "--no-color", "--no-ext-diff", "--no-renames",
            base_sha, head_sha)
    if r.returncode != 0:
        raise CouldNotRun("git diff failed")
    return split_diff(r.stdout), r.stdout


def show(repo, sha, path):
    """Text of <path> at <sha>, or None when it does not exist there."""
    r = git(repo, "show", f"{sha}:{path}")
    return r.stdout if r.returncode == 0 else None


def tree_paths(repo, sha):
    r = git(repo, "ls-tree", "-r", "--name-only", sha)
    return set(r.stdout.splitlines()) if r.returncode == 0 else set()


def signal(sid, floor, strength, evidence, reason):
    return {"id": sid, "floor": floor, "strength": strength, "evidence": sorted(set(evidence)), "reason": reason}


# --- file classes (R6, R8) -------------------------------------------------------------------

DOC_EXT = (".md", ".mdx", ".txt", ".rst")
LOCKFILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock", "poetry.lock",
             "cargo.lock", "go.sum", "gemfile.lock", "uv.lock", "composer.lock"}
AREA_PREFIXES = {"plugins", "packages", "apps", "services"}


def segments(path):
    return path.split("/")


def is_protected(path):
    """Paths whose documentation is not excused (R6)."""
    low = path.lower()
    segs = segments(low)[:-1]
    return low.startswith(".github/workflows/") or "hooks" in segs or ".claude" in segs


def is_doc(path):
    low = path.lower()
    base = low.rsplit("/", 1)[-1]
    if base == "requirements.txt":  # a manifest, not prose (R7), though it ends in .txt
        return False
    return (low.endswith(DOC_EXT) or base in LOCKFILES or low.startswith("docs/") or "/docs/" in low)


def excused(path):
    return is_doc(path) and not is_protected(path)


def is_test(path):
    low = path.lower()
    base = low.rsplit("/", 1)[-1]
    if re.search(r"\.(?:test|spec)\.", base) or re.search(r"_test\.[^.]+$", base) or re.fullmatch(r"test_.*\.py", base):
        return True
    return any(seg in ("tests", "test", "__tests__") for seg in segments(low)[:-1])


FIXTURE_DIRS = {"fixtures", "fixture", "__fixtures__", "testdata", "__snapshots__"}


def is_test_or_fixture(path):
    """A test file, a file under a tests or fixtures directory, or Markdown: path and surface signals skip these."""
    low = path.lower()
    return is_test(path) or low.endswith(DOC_EXT) or any(seg in FIXTURE_DIRS for seg in segments(low)[:-1])


def area(path):
    segs = segments(path)
    if len(segs) == 1:
        return "."
    return "/".join(segs[:2]) if segs[0] in AREA_PREFIXES and len(segs) > 2 else segs[0]


def glob_regex(pattern):
    """** matches across directories, * and ? stay inside one; a trailing / means everything under it."""
    if pattern.endswith("/"):
        pattern += "**"
    out, i = "", 0
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
            continue
        if c == "*":
            if pattern.startswith("**", i):
                out += ".*"
                i += 2
                continue
            out += "[^/]*"
        elif c == "?":
            out += "[^/]"
        else:
            out += re.escape(c)
        i += 1
    return re.compile(out + r"\Z")


def glob_any(patterns, path):
    return any(glob_regex(p).match(path) for p in patterns)


# --- path signals (R5) -----------------------------------------------------------------------

IAC_DIRS = {"k8s", "kubernetes", "helm", "terraform", "pulumi", "cdk"}
AUTH_NAMES = {"auth", "login", "signin", "signup", "oauth", "session", "sessions", "permissions", "rbac",
              "acl", "policies", "middleware"}
PAYMENT_NAMES = {"payments", "payment", "billing", "stripe"}
ENV_SAFE = (".example", ".sample", ".template", ".dist")
SCRIPT_RE = re.compile(r"\.(?:py|sh|js|mjs|cjs|ts|rb|pl|bash|zsh|ps1)$")


def named(path, names):
    """A directory segment or the file's stem (the part before the first dot) is one of names."""
    segs = segments(path.lower())
    return any(s in names for s in segs[:-1]) or segs[-1].split(".")[0] in names


def hook_script_paths(repo, sha, tree):
    """Scripts that a tracked hooks.json in the tree at sha runs, from its command strings."""
    scripts = set()

    def commands(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == "command" and isinstance(v, str):
                    yield v
                else:
                    yield from commands(v)
        elif isinstance(node, list):
            for v in node:
                yield from commands(v)

    for hj in sorted(p for p in tree if p.rsplit("/", 1)[-1] == "hooks.json"):
        text = show(repo, sha, hj)
        try:
            data = json.loads(text or "")
        except ValueError:
            continue
        plugin_dir = posixpath.dirname(posixpath.dirname(hj))
        for cmd in commands(data):
            cmd = cmd.replace("${CLAUDE_PLUGIN_ROOT}", plugin_dir or ".").replace("$CLAUDE_PLUGIN_ROOT", plugin_dir or ".")
            for tok in re.split(r"\s+", cmd):
                tok = posixpath.normpath(tok.strip("\"'"))
                if tok in tree and SCRIPT_RE.search(tok):
                    scripts.add(tok)
    return scripts


def in_hook_dir(path, dirs, hook_dirs):
    """A hooks directory counts when it holds a hooks.json (or is .claude/hooks); src/hooks of a React app does not."""
    for k, seg in enumerate(dirs):
        if seg != "hooks":
            continue
        if "/".join(path.split("/")[:k + 1]) in hook_dirs or (k > 0 and dirs[k - 1] == ".claude"):
            return True
    return False


def path_signals(files, hook_scripts=frozenset(), policy=None, hook_dirs=frozenset()):
    """hook_scripts: scripts hooks.json runs (head and base trees); hook_dirs: directories that hold a hooks.json."""
    policy = policy or {}
    low_globs = policy.get("paths.low", [])
    out, hit = [], {}

    def add(sid, path):
        hit.setdefault(sid, []).append(path)

    for path in files:
        low = path.lower()
        base = low.rsplit("/", 1)[-1]
        segs = segments(low)
        dirs = segs[:-1]
        if excused(path):
            continue
        if low.startswith(".github/workflows/"):
            add("workflows", path)
        if (path in hook_scripts or in_hook_dir(path, dirs, hook_dirs) or base == "hooks.json" or ".husky" in dirs
                or ".githooks" in dirs or re.fullmatch(r"\.?lefthook(?:-local)?\.ya?ml", base)
                or (".claude" in dirs and dirs.index(".claude") == len(dirs) - 1 and re.fullmatch(r"settings.*\.json", base))):
            add("hook-scripts", path)
        if glob_any(low_globs, path):
            continue  # paths.low excuses everything below, never workflows or hook-scripts
        if is_test_or_fixture(path):
            continue  # tests, fixtures and Markdown are not the thing they exercise
        if base.startswith(("dockerfile", "docker-compose")) or base.endswith(".tf") or IAC_DIRS & set(dirs):
            add("iac", path)
        if named(path, AUTH_NAMES):
            add("auth", path)
        if named(path, PAYMENT_NAMES):
            add("payments", path)
        if ("migrations" in dirs or "migrate" in dirs or "drizzle" in dirs or low.endswith("prisma/schema.prisma")
                or base == "schema.sql" or (base.endswith(".sql") and ("db" in dirs or "database" in dirs))):
            add("migrations", path)
        if (re.fullmatch(r"\.env(\..+)?", base) and not base.endswith(ENV_SAFE)) or (
                re.match(r"(?:config|settings|env)\.", base) and (len(segs) == 1 or "config" in dirs)):
            add("env-config", path)
    reasons = {
        "workflows": "CI workflow changed", "hook-scripts": "hook or hook script changed",
        "iac": "infrastructure file changed", "auth": "authentication or access path changed",
        "payments": "payments path changed", "migrations": "database migration or schema changed",
        "env-config": "environment or config file changed",
    }
    for sid, paths in hit.items():
        out.append(signal(sid, "high", "strong", paths, reasons[sid]))
    return out


# Dependency-name parsing mirrors _dep_names in security_surface.py and legal_surface.py so the
# classifier gives the same answer when neither module is installed (R7).
DEP_FILES = {"package.json", "requirements.txt", "pyproject.toml", "go.mod", "cargo.toml", "gemfile"}
NOT_DEP_KEYS = {
    "version", "name", "edition", "python", "requires-python", "rust-version", "description",
    "license", "authors", "readme", "ruby", "main", "module", "types", "type", "private",
    "homepage", "repository", "node", "npm", "engines", "packageManager", "go", "toolchain",
}
SEMVERISH = re.compile(
    r"^(?:[\^~<>=]*\s*\d[\w.\-+ <>=|^~*]*|(?:workspace|npm|file|link|github|git\+?\w*|https?):.*|latest|\*)$"
)


def dep_name(basename, line):
    """The dependency name an added or removed manifest line declares, or None."""
    s = line.strip()
    if not s or s.startswith(("#", "//")):
        return None
    if basename == "package.json":
        m = re.match(r'^"([@\w./\-]+)"\s*:\s*"([^"]*)"\s*,?$', s)
        if m and m.group(1) not in NOT_DEP_KEYS and SEMVERISH.match(m.group(2)):
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
        if m and m.group(1) not in NOT_DEP_KEYS and (m.group(2) is None or SEMVERISH.match(m.group(2))):
            return m.group(1).lower()
    elif basename == "go.mod":
        m = re.match(r"^(?:require\s+)?([\w.\-]+\.[a-z]+/[\w./\-~]+)\s+v\d", s)
        if m:
            return m.group(1)
    elif basename == "cargo.toml":
        m = re.match(r'^([A-Za-z0-9][\w\-]*)\s*=\s*(?:"([^"]*)"|\{.*\})\s*,?$', s)
        if m and m.group(1) not in NOT_DEP_KEYS and (m.group(2) is None or SEMVERISH.match(m.group(2))):
            return m.group(1).lower()
    elif basename == "gemfile":
        m = re.match(r"""^gem\s+['"]([\w.\-]+)['"]""", s)
        if m:
            return m.group(1).lower()
    return None


def dependency_signals(files):
    names, paths = set(), []
    for path, f in files.items():
        base = path.lower().rsplit("/", 1)[-1]
        if base not in DEP_FILES or excused(path):
            continue
        old = {dep_name(base, l) for l in f["removed"]} - {None}
        new = {n for n in (dep_name(base, l) for l in f["added"]) if n and n not in old}
        if new:
            names |= new
            paths.append(path)
    if not names:
        return []
    return [signal("dependencies", "medium", "strong", paths, "new dependency: " + ", ".join(sorted(names)))]


# --- test signals (R8) -----------------------------------------------------------------------

ASSERT_RE = re.compile(r"\b(?:expect|assert|should)", re.I)


def test_signals(files, no_test_lines):
    out, changed_tests, source_added = [], False, 0
    deleted, removed_assert = [], []
    for path, f in files.items():
        if excused(path):
            continue
        if is_test(path):
            changed_tests = True
            if f["status"] == "D":
                deleted.append(path)
            else:
                lost = sum(1 for l in f["removed"] if ASSERT_RE.search(l))
                gained = sum(1 for l in f["added"] if ASSERT_RE.search(l))
                if lost > gained:
                    removed_assert.append(path)
        else:
            source_added += len(f["added"])
    if deleted:
        out.append(signal("test-deleted", "medium", "strong", deleted, "a test file was deleted"))
    if removed_assert:
        out.append(signal("assertion-removed", "medium", "strong", removed_assert,
                          "more assertion lines removed than added"))
    if source_added > no_test_lines and not changed_tests:
        out.append(signal("no-test-change", "medium", "weak", [f"lines={source_added}"],
                          f"{source_added} source lines added and no test file changed"))
    return out


# --- size and areas (R9) ---------------------------------------------------------------------


def size_signals(files, th):
    counted = {p: f for p, f in files.items() if not excused(p) and not is_test(p)}
    n_files = len(counted)
    n_lines = sum(len(f["added"]) + len(f["removed"]) for f in counted.values())
    out = []
    if n_files > th["files_high"] or n_lines > th["lines_high"]:
        floor = "high"
    elif n_files > th["files_medium"] or n_lines > th["lines_medium"]:
        floor = "medium"
    else:
        floor = None
    if floor:
        out.append(signal("size", floor, "weak", [f"files={n_files}", f"lines={n_lines}"],
                          f"{n_files} files and {n_lines} lines changed"))
    areas = {area(p) for p in counted}
    if len(areas) > th["areas_medium"]:
        out.append(signal("areas", "medium", "weak", [f"areas={len(areas)}"],
                          f"change spans {len(areas)} areas: " + ", ".join(sorted(areas))))
    return out


# --- surface signals and the module lookup (R10, R11) -----------------------------------------
# security_surface.py (pro-security) and legal_surface.py (pro-legal) are loaded from their path with
# importlib and never copied. The lookup follows pr-check.py's find_sibling: the sibling plugin
# directory next to this plugin's root, an install record, the newest cached copy, then
# PRO_SHIP_SURFACE_DIR.

OWN_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
SURFACES = (("security_surface", "pro-security"), ("legal_surface", "pro-legal"))
SECURITY_HIGH = {"auth", "authz", "payments", "crypto", "secrets", "webhooks", "uploads", "ci-infra"}


def plugins_root():
    env = os.environ.get("CLAUDE_CODE_PLUGIN_CACHE_DIR")
    return env if env else os.path.join(os.path.expanduser("~"), ".claude", "plugins")


def version_key(name):
    return tuple(int(n) for n in re.findall(r"\d+", name))


def newest_version_dir(plugin_dir):
    try:
        names = [n for n in os.listdir(plugin_dir) if os.path.isdir(os.path.join(plugin_dir, n))]
    except OSError:
        return None
    return os.path.join(plugin_dir, max(names, key=lambda n: (version_key(n), n))) if names else None


def find_surface(module, plugin):
    rel = os.path.join("scripts", module + ".py")
    parent = os.path.dirname(OWN_ROOT)
    cands = [os.path.join(parent, plugin, rel)]  # repo checkout: plugins/<plugin>/scripts
    newest = newest_version_dir(os.path.join(parent, plugin))  # cache: <mkt>/<plugin>/<newest version>
    if newest:
        cands.append(os.path.join(newest, rel))
    try:
        with open(os.path.join(plugins_root(), "installed_plugins.json")) as fh:
            installed = json.load(fh).get("plugins", {})
        for key in sorted(installed):
            recs = installed[key]
            if key.partition("@")[0] == plugin and isinstance(recs, list):
                cands += [os.path.join(str(r["installPath"]), rel) for r in recs
                          if isinstance(r, dict) and r.get("installPath")]
    except (OSError, ValueError, AttributeError):
        pass
    cache = os.path.join(plugins_root(), "cache")
    try:
        for mkt in sorted(os.listdir(cache)):
            newest = newest_version_dir(os.path.join(cache, mkt, plugin))
            if newest:
                cands.append(os.path.join(newest, rel))
    except OSError:
        pass
    env_dir = os.environ.get("PRO_SHIP_SURFACE_DIR")
    if env_dir:
        cands.append(os.path.join(env_dir, module + ".py"))
    return next((c for c in cands if os.path.isfile(c)), None)


def load_surface(module, plugin):
    path = find_surface(module, plugin)
    if not path:
        return None
    try:
        spec = importlib.util.spec_from_file_location("risk_" + module, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod if callable(getattr(mod, "diff_files", None)) else None
    except Exception:
        return None


def surface_signals(repo, patch):
    """(signals, notes). A module that cannot be found or run is noted, never read as no hits."""
    out, notes = [], []
    for module, plugin in SURFACES:
        mod = load_surface(module, plugin)
        hits = None
        if mod:
            try:
                hits = mod.diff_files(patch, repo) if module == "legal_surface" else mod.diff_files(patch)
            except Exception:
                hits = None
        if hits is None:
            notes.append(f"surface-unavailable: {module}")
            continue
        for cat, paths in hits.items():
            paths = [p for p in paths if not is_test_or_fixture(p)]
            if not paths:
                continue
            if module == "legal_surface":
                floor, label = "medium", "legal"
            else:
                floor, label = ("high" if cat in SECURITY_HIGH else "medium"), "security"
            out.append(signal(f"{label}-{cat}", floor, "strong", paths, f"{label} surface: {cat}"))
    return out, notes


# --- architecture (R12) ----------------------------------------------------------------------

ENV_READ_RES = (
    re.compile(r"process\.env\.([A-Za-z_][A-Za-z0-9_]*)"),
    re.compile(r"os\.environ\[\s*[\"']([A-Za-z_][A-Za-z0-9_]*)[\"']\s*\]"),
    re.compile(r"os\.getenv\(\s*[\"']([A-Za-z_][A-Za-z0-9_]*)[\"']"),
)


def env_var_signals(repo, head_sha, files):
    example = show(repo, head_sha, ".env.example") or ""
    known = {m.group(1) for m in re.finditer(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", example, re.M)}
    hit_files, names = [], set()
    for path, f in files.items():
        if excused(path) or is_test_or_fixture(path):
            continue
        found = {m.group(1) for line in f["added"] for rx in ENV_READ_RES for m in rx.finditer(line)} - known
        if found:
            hit_files.append(path)
            names |= found
    if not hit_files:
        return []
    return [signal("env-var-read", "medium", "weak", hit_files, "new environment variable read: " + ", ".join(sorted(names)))]


# --- declared risk (R14) ---------------------------------------------------------------------

INTENT_RE = re.compile(r"intent/[^/]+/intent\.md\Z")


def declared_from(text):
    """The risk: value of a front matter block, or None when absent or not low, medium or high."""
    lines = (text or "").replace("\r\n", "\n").split("\n")
    if not lines or lines[0].strip() != "---":
        return None
    for line in lines[1:]:
        if line.strip() == "---":
            break
        m = re.match(r"risk\s*:\s*[\"']?([A-Za-z]*)[\"']?\s*(?:#.*)?$", line)
        if m:
            v = m.group(1).lower()
            return v if v in RANK else None
    return None


def declared_risk(repo, head_sha, files, intent):
    """(declared, [intent paths]): --intent, else the intents the diff adds or changes, else none."""
    if intent:
        for cand in (intent, os.path.join(repo, intent)):
            try:
                with open(cand, encoding="utf-8", errors="replace") as fh:
                    d = declared_from(fh.read())
                return (d or "none"), ([intent] if d else [])
            except OSError:
                continue
        return "none", []
    found = []
    for path, f in sorted(files.items()):
        if INTENT_RE.search(path) and f["status"] != "D":
            d = declared_from(show(repo, head_sha, path))
            if d:
                found.append((d, path))
    if not found:
        return "none", []
    top = max(RANK[d] for d, _ in found)
    return NAMES[top], [p for _, p in found]


# --- REVIEW.md overrides (R16, R17) ----------------------------------------------------------
# One fenced block under "## Risk tiers", in a restricted YAML subset: flat or dotted keys, whole
# numbers and lists of strings (inline [a, b] or "- item" lines). Nothing else. The approval and
# local decision columns are not keys, so a block that names them is unreadable.

LIST_KEYS = {"paths.high", "paths.medium", "paths.low"} | {
    f"tiers.{t}.{k}" for t in NAMES for k in ("checks", "reviewers")}
INT_KEYS = {f"thresholds.{k}" for k in THRESHOLD_KEYS}
KEY_RE = re.compile(r"([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*:\s*(.*?)\s*\Z")


class PolicyError(Exception):
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
            raise PolicyError(f"line {n} is not a key: value or list item")
        key, value = m.group(1), m.group(2)
        if key in policy:
            raise PolicyError(f"duplicate key {key}")
        pending = None
        if key in INT_KEYS:
            if not re.fullmatch(r"\d+", value):
                raise PolicyError(f"{key} is not a whole number")
            policy[key] = int(value)
        elif value == "":
            policy[key] = []
            pending = key
        elif value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            policy[key] = [unquote(x) for x in inner.split(",")] if inner else []
        else:
            policy[key] = value  # a scalar; rejected below for every known key
    for key, value in policy.items():
        if key not in LIST_KEYS and key not in INT_KEYS:
            raise PolicyError(f"unknown key {key}")
        if key in LIST_KEYS and not isinstance(value, list):
            raise PolicyError(f"{key} must be a list")
    return policy


def read_policy(text):
    """(policy dict, status) where status is defaults, REVIEW.md or unreadable (<reason>)."""
    if not text:
        return {}, "defaults"
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    m = re.search(r"^##[ \t]+Risk tiers[ \t]*$", text, re.M | re.I)
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
    except PolicyError as e:
        return {}, f"unreadable ({e})"


def policy_signals(files, policy):
    out = []
    for key, floor in (("paths.high", "high"), ("paths.medium", "medium")):
        hit = [p for p in files if glob_any(policy.get(key, []), p)]
        if hit:
            out.append(signal(f"policy-{floor}", floor, "strong", hit, f"REVIEW.md {key} matched"))
    return out


def demands_for(tier, policy):
    d = json.loads(json.dumps(DEMANDS[tier]))
    for key in ("checks", "reviewers"):
        if f"tiers.{tier}.{key}" in policy:
            d[key] = list(policy[f"tiers.{tier}.{key}"])
    return d


def tier_of(signals):
    return NAMES[max([RANK[s["floor"]] for s in signals] or [0])]


def tie_of(signals):
    """[one_below, top] when the top tier is set only by weak signals (R13), else None."""
    top = tier_of(signals)
    if top == "low":
        return None
    at_top = [s for s in signals if s["floor"] == top]
    if all(s["strength"] == "weak" for s in at_top):
        return [NAMES[RANK[top] - 1], top]
    return None


def classify(repo, base=None, head="HEAD", intent=None):
    repo = os.path.realpath(repo)
    head_sha = resolve(repo, head)
    if not head_sha:
        raise CouldNotRun("not a git repository or head does not resolve")
    base_sha = find_base(repo, head_sha, base)
    if base_sha == head_sha:
        raise CouldNotRun("empty range")
    # The policy comes from the merge base: a pull request cannot loosen its own tier by editing REVIEW.md.
    policy, policy_status = read_policy(show(repo, base_sha, "REVIEW.md"))
    th = default_thresholds()
    th.update({k[len("thresholds."):]: v for k, v in policy.items() if k in INT_KEYS})
    files, patch = read_diff(repo, base_sha, head_sha)
    tree = tree_paths(repo, head_sha)
    base_tree = tree_paths(repo, base_sha)
    hooks = hook_script_paths(repo, head_sha, tree) | hook_script_paths(repo, base_sha, base_tree)
    hook_dirs = {posixpath.dirname(p) for p in tree | base_tree if p.rsplit("/", 1)[-1] == "hooks.json"}
    signals = (path_signals(files, hooks, policy, hook_dirs) + dependency_signals(files)
               + policy_signals(files, policy)
               + test_signals(files, th["no_test_lines"]) + size_signals(files, th))
    found, notes = surface_signals(repo, patch)
    signals += found
    signals += env_var_signals(repo, head_sha, files)
    architecture = any(x["id"] in ("iac", "env-var-read") for x in signals)
    computed = tier_of(signals)
    declared, intent_paths = declared_risk(repo, head_sha, files, intent)
    findings = []
    docs_only = not intent and all(excused(p) for p in files)  # an explicit --intent is always honored
    if declared != "none" and docs_only:
        notes.append("declared-risk-ignored: the diff holds only Markdown and docs")
    elif declared != "none":
        signals.append(signal("declared-risk", declared, "strong", intent_paths, f"intent declares risk: {declared}"))
        if RANK[computed] > RANK[declared]:
            top = sorted({x["id"] for x in signals if x["floor"] == computed and x["id"] != "declared-risk"})
            findings.append(f"risk-underdeclared: declared {declared}, computed {computed} ({', '.join(top)})")
    signals.sort(key=lambda x: (x["id"], x["evidence"]))
    tier = tier_of(signals)
    return {
        "tier": tier, "signals": signals, "declared": declared, "findings": findings, "tie": tie_of(signals),
        "architecture": architecture, "demands": demands_for(tier, policy), "base": base_sha, "head": head_sha,
        "policy": policy_status, "notes": notes,
    }


def render(result):
    lines = [f"risk: {result['tier']}", f"policy: {result['policy']}", f"declared: {result['declared']}"]
    if result["tie"]:
        weak = sorted({x["id"] for x in result["signals"] if x["floor"] == result["tier"]})
        lines.append("tie: [" + ", ".join(result["tie"]) + "] (weak signals only: " + ", ".join(weak) + ")")
    for s in result["signals"]:
        lines.append(f"  {s['id']} {s['floor']} {s['strength']} {', '.join(s['evidence'])}: {s['reason']}")
    lines += [f"finding: {f}" for f in result["findings"]]
    lines += [f"note: {n}" for n in result["notes"]]
    return "\n".join(lines) + "\n"


def parse_args(argv):
    opts = {"base": None, "head": "HEAD", "intent": None, "repo": os.getcwd(), "json": False}
    value = {"--base": "base", "--head": "head", "--intent": "intent", "--repo": "repo"}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--json":
            opts["json"] = True
        elif a in value and i + 1 < len(argv):
            opts[value[a]] = argv[i + 1]
            i += 1
        else:
            return None
        i += 1
    return opts


def main(argv=None):
    opts = parse_args(sys.argv[1:] if argv is None else argv)
    if opts is None:
        sys.stderr.write("usage: risk-classify.py [--base REF] [--head REF] [--intent PATH] [--repo PATH] [--json]\n")
        return 64
    try:
        result = classify(opts["repo"], opts["base"], opts["head"], opts["intent"])
    except CouldNotRun as e:
        if opts["json"]:
            sys.stdout.write(json.dumps({"could_not_run": True, "reason": str(e), "tier": "high"}, sort_keys=True) + "\n")
        else:
            sys.stderr.write(f"risk-classify: could not run: {e}\n")
        return 2
    sys.stdout.write(json.dumps(result, sort_keys=True, indent=2) + "\n" if opts["json"] else render(result))
    return EXIT[result["tier"]]


if __name__ == "__main__":
    sys.exit(main())
