#!/usr/bin/env python3
"""pro-dev.py - the deterministic half of /pro-dev.

Reads the engine registry (registry/engines.json) and the plugin installs that
`claude plugin list --json` reports, then installs, updates and reports on the
external engines the bridge skills route to. The /pro-dev command owns the
questions and the file drafting; everything else lives here so it also works
from a plain terminal with no Claude session.

Subcommands:
  status [--json]                  plugins covering the repo, engine states, answers
  run <id|all> install|update      run one engine row, or every row that applies
  answer <id> yes|no               save an answer for an optional row
  plugins update                   refresh the marketplace, update covering installs
  plugins swap-starter             replace pro-starter with pro-dev-starter
  stale [--remove]                 list (or remove) installs whose folder is gone
  surface <id>                     print the computed surface of an installed claude-plugin row

Rules this script keeps:
  - registry argv run through subprocess with no shell; nothing read from the
    repo, the answers file or a plugin payload is ever put into a command
  - a failed step is reported and the run carries on
  - writes stay inside the repo, except stale --remove, which edits
    installed_plugins.json after writing a backup beside it, plus a row's
    `marketplace` step: `claude plugin marketplace add` is a user-wide write that
    outlives the plugin (accepted by ADR-0007), run only when no marketplace of that
    name is registered and refused when the registered one has another source
  - a claude-plugin row may pin the `surface` it was reviewed with (agent and skill
    counts, the tools of each agent, skill and command, a hash of every hook, MCP and
    LSP declaration); a plugin beyond the pin, or one whose surface cannot be read, is
    never installed by this script and status names it. An update first refreshes the
    marketplace clone and is refused when the clone is beyond the pin. After any install
    or update the installed copy is checked again and, if it is beyond the pin, disabled
    at project scope and reported as a failure. Nothing about surfaces is written to
    the repo, so a repo change cannot raise the baseline. Plugin files are third-party
    input: only regular files that stay inside the plugin folder are opened, each
    read is capped and any failure reads as "surface unknown"
  - only python3 and the standard library
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile

MARKETPLACE = "pro-dev-skillset"
SCOPES = ("user", "project", "local")
ANSWERS_FILE = os.path.join(".claude", "pro-dev.json")
PLUGIN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9][A-Za-z0-9._-]*$")
ENGINE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
STARTER_DEPS = ("pro-nextjs", "pro-astro")


# --- environment --------------------------------------------------------------

def config_dir() -> str:
    base = os.environ.get("CLAUDE_CONFIG_DIR")
    if base:
        return base
    return os.path.join(os.path.expanduser("~"), ".claude")


def registry_path() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "registry", "engines.json")


def installed_plugins_path() -> str:
    return os.path.join(config_dir(), "plugins", "installed_plugins.json")


def find_repo(explicit: str | None) -> str:
    if explicit:
        return os.path.realpath(explicit)
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True,
                             text=True, timeout=15, stdin=subprocess.DEVNULL)
        top = out.stdout.strip()
        if out.returncode == 0 and top:
            return os.path.realpath(top)
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.realpath(os.getcwd())


def load_registry() -> dict:
    with open(registry_path(), "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict) or not isinstance(data.get("engines"), list):
        raise ValueError("registry/engines.json has an unexpected shape")
    return data


def say(msg: str = "") -> None:
    print(msg, flush=True)


# --- plugin installs ----------------------------------------------------------

def is_inside(path: str, root: str) -> bool:
    try:
        return os.path.commonpath([os.path.realpath(path), root]) == root
    except ValueError:
        return False


def covers_repo(entry: dict, repo: str) -> bool:
    """R10: user scope, or a projectPath that is the repo root or inside it."""
    if entry.get("scope") == "user":
        return True
    pp = entry.get("projectPath")
    return isinstance(pp, str) and bool(pp) and is_inside(pp, repo)


def read_installed_file() -> list[dict] | None:
    """Fallback: installed_plugins.json, read only."""
    try:
        with open(installed_plugins_path(), "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    plugins = data.get("plugins") if isinstance(data, dict) else None
    if not isinstance(plugins, dict):
        return None
    out = []
    for pid, items in plugins.items():
        if not isinstance(items, list):
            continue
        for it in items:
            if not isinstance(it, dict):
                continue
            out.append({
                "id": pid, "scope": it.get("scope"), "version": it.get("version"),
                "projectPath": it.get("projectPath"), "installPath": it.get("installPath"),
                "enabled": True,
            })
    return out


def read_installs() -> tuple[list[dict], str]:
    """Return (installs, source). Prefer `claude plugin list --json`."""
    exe = shutil.which("claude")
    if exe:
        try:
            res = subprocess.run([exe, "plugin", "list", "--json"], capture_output=True, text=True,
                                 timeout=120, stdin=subprocess.DEVNULL)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                if isinstance(data, list):
                    items = [d for d in data if isinstance(d, dict) and isinstance(d.get("id"), str)]
                    project_missing = any(d.get("scope") in ("project", "local") and not d.get("projectPath")
                                          for d in items)
                    if not project_missing:
                        return items, "claude plugin list --json"
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    fallback = read_installed_file()
    if fallback is not None:
        return fallback, "installed_plugins.json"
    return [], "none"


def pro_dev_installs(installs: list[dict]) -> list[dict]:
    return [i for i in installs if isinstance(i.get("id"), str) and i["id"].endswith("@" + MARKETPLACE)]


def name_of(pid: str) -> str:
    return pid.split("@", 1)[0]


def latest_versions() -> dict:
    """Marketplace versions from the local clone, no network."""
    try:
        with open(os.path.join(config_dir(), "plugins", "known_marketplaces.json"), "r", encoding="utf-8") as fh:
            known = json.load(fh)
        loc = known[MARKETPLACE]["installLocation"]
        with open(os.path.join(loc, ".claude-plugin", "marketplace.json"), "r", encoding="utf-8") as fh:
            mp = json.load(fh)
        return {p["name"]: p.get("version") for p in mp.get("plugins", []) if isinstance(p, dict) and "name" in p}
    except (OSError, ValueError, KeyError, TypeError):
        return {}


def owner_active(installs: list[dict], owner: str, repo: str) -> bool:
    pid = f"{owner}@{MARKETPLACE}"
    return any(i.get("id") == pid and i.get("enabled") is not False and covers_repo(i, repo) for i in installs)


# --- answers ------------------------------------------------------------------

class AnswersError(ValueError):
    """The answers file or its folder cannot be trusted; nothing was written."""


MAX_ANSWERS_BYTES = 64 * 1024


def answers_problem(repo: str) -> str | None:
    """Return why the answers file is unsafe to read or write, or None.

    `.claude/pro-dev.json` is repo-controlled, so a symlink there (or a symlinked
    `.claude` folder) must never be followed. Absent is fine; a regular file is fine.
    """
    path = os.path.join(repo, ANSWERS_FILE)
    claude_dir = os.path.join(repo, ".claude")
    want = os.path.join(os.path.realpath(repo), ".claude")
    try:
        os.lstat(claude_dir)
    except FileNotFoundError:
        return None
    except OSError as exc:
        return f"cannot inspect {claude_dir} ({exc})"
    if os.path.realpath(os.path.dirname(path)) != want:
        return f"{claude_dir} is a symlink or resolves outside the repo; refusing to touch {ANSWERS_FILE}"
    try:
        st = os.lstat(path)
    except FileNotFoundError:
        return None
    except OSError as exc:
        return f"cannot inspect {path} ({exc})"
    if not stat.S_ISREG(st.st_mode):
        return f"{path} is not a regular file (symlink or special file); refusing to touch it"
    return None


def read_answers(repo: str) -> tuple[dict, bool]:
    """Return (data, malformed). A missing file is an empty record, not malformed.

    An unsafe path (symlink, special file, symlinked folder) reads as malformed and is never opened.
    """
    path = os.path.join(repo, ANSWERS_FILE)
    if answers_problem(repo):
        return {}, True
    if not os.path.lexists(path):
        return {}, False
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
        with os.fdopen(fd, "rb") as fh:
            raw = fh.read(MAX_ANSWERS_BYTES + 1)
        if len(raw) > MAX_ANSWERS_BYTES:
            return {}, True
        data = json.loads(raw.decode("utf-8"))
    except (OSError, ValueError):
        return {}, True
    if not isinstance(data, dict):
        return {}, True
    return data, False


def saved_answer(data: dict, engine_id: str) -> str | None:
    answers = data.get("answers")
    if not isinstance(answers, dict):
        return None
    entry = answers.get(engine_id)
    value = entry.get("answer") if isinstance(entry, dict) else None
    return value if value in ("yes", "no") else None  # anything else is ignored, never run


def write_answers(repo: str, data: dict) -> bool:
    """Write only when the content changes. Returns True when a write happened.

    Raises AnswersError, writing nothing, for an unsafe path or a malformed existing file.
    """
    problem = answers_problem(repo)
    if problem:
        raise AnswersError(problem)
    path = os.path.join(repo, ANSWERS_FILE)
    existing, malformed = read_answers(repo)
    if malformed:
        raise AnswersError(f"{path} is not valid JSON. Fix or delete it, then retry; nothing was written.")
    text = json.dumps(data, indent=2, sort_keys=True) + "\n"
    if os.path.lexists(path) and json.dumps(existing, indent=2, sort_keys=True) + "\n" == text:
        return False
    claude_dir = os.path.dirname(path)
    os.makedirs(claude_dir, exist_ok=True)
    if answers_problem(repo):  # re-check after creating the folder
        raise AnswersError(f"{claude_dir} changed while writing; nothing was written.")
    fd, tmp = tempfile.mkstemp(dir=claude_dir, prefix=".pro-dev.json.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return True


# --- marketplaces -------------------------------------------------------------

MARKETPLACE_SOURCE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9._-]+$")


def known_marketplaces_path() -> str:
    return os.path.join(config_dir(), "plugins", "known_marketplaces.json")


def read_known_marketplaces() -> tuple[dict | None, str]:
    """Return (registered marketplaces, problem). A missing file is an empty record."""
    path = known_marketplaces_path()
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return {}, ""
    except (OSError, ValueError) as exc:
        return None, f"{path} is unreadable ({type(exc).__name__}); refusing to trust it"
    if not isinstance(data, dict):
        return None, f"{path} has an unexpected shape; refusing to trust it"
    return data, ""


def source_text(entry) -> str:
    src = entry.get("source") if isinstance(entry, dict) else None
    return json.dumps(src, sort_keys=True)[:200] if src is not None else "unknown"


def check_marketplace(mp: dict, repo: str, allow_add: bool) -> tuple[str, str]:
    """Return (kind, text): kind is ok, absent or bad.

    The registered source must be github with the row's owner/repo (any case), read from
    known_marketplaces.json after any add. Another source kind, another repo or an
    unreadable file is bad and the row is never installed.
    """
    name, source = mp.get("name"), mp.get("source")
    if not (isinstance(name, str) and ENGINE_ID_RE.match(name) and isinstance(source, str)
            and MARKETPLACE_SOURCE_RE.match(source)):
        return "bad", "registry row has an invalid marketplace object"
    known, why = read_known_marketplaces()
    if known is None:
        return "bad", why
    if name not in known:
        if not allow_add:
            return "absent", f"marketplace {name} is not registered (expected github {source})"
        say(f"registering marketplace {name} from {source} (a user-wide change that stays after the plugin is removed)")
        ok, detail = run_argv(["claude", "plugin", "marketplace", "add", source], repo)
        if not ok:
            return "bad", f"marketplace add {source} failed ({detail})"
        known, why = read_known_marketplaces()
        if known is None:
            return "bad", why
        if name not in known:
            return "bad", f"marketplace add {source} exited 0 but {name} is still not registered"
    entry = known[name]
    src = entry.get("source") if isinstance(entry, dict) else None
    if (isinstance(src, dict) and src.get("source") == "github" and isinstance(src.get("repo"), str)
            and src["repo"].lower() == source.lower()):
        return "ok", ""
    return "bad", (f"marketplace {name} is registered from {source_text(entry)} but this row expects "
                   f"github {source}; refusing to use it")


# --- plugin surface -----------------------------------------------------------

class SurfaceError(Exception):
    """A plugin file could not be read safely; the surface is unknown."""


def read_plugin_file(root: str, path: str, required: bool = False) -> bytes | None:
    """Read one file of a plugin folder. None when it is absent and not required.

    Plugin files are third-party input: only a regular file (no symlink, FIFO or device)
    whose real path stays inside the plugin folder is opened; the read is capped.
    """
    rel = os.path.relpath(path, root)
    try:
        st = os.lstat(path)
    except (FileNotFoundError, NotADirectoryError):
        if required:
            raise SurfaceError(f"{rel} is missing")
        return None
    except OSError as exc:
        raise SurfaceError(f"cannot inspect {rel} ({type(exc).__name__})")
    if not stat.S_ISREG(st.st_mode):
        raise SurfaceError(f"{rel} is not a regular file")
    if not is_inside(path, root):
        raise SurfaceError(f"{rel} resolves outside the plugin folder")
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
        with os.fdopen(fd, "rb") as fh:
            if not stat.S_ISREG(os.fstat(fh.fileno()).st_mode):
                raise SurfaceError(f"{rel} is not a regular file")
            raw = fh.read(MAX_ANSWERS_BYTES + 1)
    except OSError as exc:
        raise SurfaceError(f"cannot read {rel} ({type(exc).__name__})")
    if len(raw) > MAX_ANSWERS_BYTES:
        raise SurfaceError(f"{rel} is larger than {MAX_ANSWERS_BYTES} bytes")
    return raw


def list_plugin_dir(root: str, path: str) -> list[str]:
    """Sorted entry names of a real (not symlinked) folder inside the plugin; [] when absent."""
    rel = os.path.relpath(path, root)
    try:
        st = os.lstat(path)
    except (FileNotFoundError, NotADirectoryError):
        return []
    except OSError as exc:
        raise SurfaceError(f"cannot inspect {rel} ({type(exc).__name__})")
    if not stat.S_ISDIR(st.st_mode) or not is_inside(path, root):
        raise SurfaceError(f"{rel} is not a plain folder inside the plugin")
    try:
        return sorted(os.listdir(path))
    except OSError as exc:
        raise SurfaceError(f"cannot list {rel} ({type(exc).__name__})")


def parse_plugin_json(raw: bytes, label: str):
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, RecursionError):
        raise SurfaceError(f"{label} is not valid JSON")


def split_tools(value: str) -> list[str]:
    """Split a tools line on commas outside parentheses, so Bash(a, b) stays whole."""
    out, depth, cur = [], 0, ""
    for ch in value:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [t.strip().strip("\"'") for t in out if t.strip().strip("\"'")]


def frontmatter_head(text: str) -> list[str]:
    """The lines between the opening and closing `---` of a file, [] when there is no frontmatter."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return []
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    return [] if end is None else lines[1:end]


def key_match(line: str, key: str):
    """Match `key: value` or a quoted `"key": value` at the start of a frontmatter line."""
    return re.match(rf"^[\"']?{re.escape(key)}[\"']?\s*:\s*(.*)$", line)


def frontmatter_tools(text: str, key: str) -> list[str] | None:
    """The tools named by `key` in a file's frontmatter (the last occurrence wins), or None when absent."""
    head = frontmatter_head(text)
    found = [i for i, line in enumerate(head) if key_match(line, key)]
    if not found:
        return None
    i = found[-1]
    val = key_match(head[i], key).group(1).strip()
    if val:
        if val.startswith("[") and val.endswith("]"):
            val = val[1:-1]
        return split_tools(val)
    items = []
    for nxt in head[i + 1:]:
        if nxt.strip().startswith("- "):
            items.extend(split_tools(nxt.strip()[2:]))
        elif nxt.strip() and nxt[:1] not in " \t":
            break
    return items


def frontmatter_block(text: str, key: str) -> str | None:
    """The raw text of a frontmatter key and its indented lines (the last occurrence), or None."""
    head = frontmatter_head(text)
    found = [i for i, line in enumerate(head) if key_match(line, key)]
    if not found:
        return None
    out = [head[found[-1]].rstrip()]
    for nxt in head[found[-1] + 1:]:
        if nxt.strip() and nxt[:1] not in " \t-":
            break
        out.append(nxt.rstrip())
    return "\n".join(out)


def command_shell_digest(text: str) -> str | None:
    """sha256 of the body lines of a command that run shell (start with `!` or hold a !`...` call)."""
    lines = text.splitlines()
    if lines and lines[0].strip() == "---":
        end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
        if end is not None:
            lines = lines[end + 1:]
    bang = [ln for ln in lines if ln.lstrip().startswith("!") or "!`" in ln]
    return hashlib.sha256("\n".join(bang).encode("utf-8")).hexdigest() if bang else None


def declared_paths(root: str, obj: dict, key: str, site: str = "plugin.json") -> list[str]:
    """Paths a manifest or marketplace entry gives for agents, skills or commands; each must stay inside the plugin."""
    spec = obj.get(key)
    if spec is None:
        return []
    items = [spec] if isinstance(spec, str) else spec
    if not isinstance(items, list) or not all(isinstance(i, str) for i in items):
        raise SurfaceError(f"{site} {key} has an unexpected shape")
    out = []
    for item in items:
        path = os.path.normpath(os.path.join(root, item))
        if not is_inside(path, root):
            raise SurfaceError(f"{site} {key} path {item} resolves outside the plugin folder")
        out.append(path)
    return out


def all_declared(root: str, manifest: dict, entry: dict, key: str) -> list[str]:
    """Custom paths from plugin.json and the marketplace entry together."""
    return declared_paths(root, manifest, key) + declared_paths(root, entry, key, "marketplace")


def is_plain_dir(path: str) -> bool:
    try:
        return stat.S_ISDIR(os.lstat(path).st_mode)
    except OSError:
        return False


def md_files(root: str, manifest: dict, entry: dict, key: str) -> list[str]:
    """Every agent or command file: the default folder always, plus every path a manifest or entry gives.

    A custom path never replaces the default folder: over-counting is safe and under-counting is not.
    """
    base = os.path.join(root, key)
    out = [os.path.join(base, n) for n in list_plugin_dir(root, base) if n.endswith(".md")]
    for path in all_declared(root, manifest, entry, key):
        if is_plain_dir(path):
            out.extend(os.path.join(path, n) for n in list_plugin_dir(root, path) if n.endswith(".md"))
        else:
            out.append(path)
    return list(dict.fromkeys(out))


def skill_dirs(root: str, manifest: dict, entry: dict) -> list[str]:
    """Every skill folder: skills/<name> always, plus the folders a manifest or entry gives (and their subfolders)."""
    base = os.path.join(root, "skills")
    out = [os.path.join(base, n) for n in list_plugin_dir(root, base)]
    for path in all_declared(root, manifest, entry, "skills"):
        if not is_plain_dir(path):
            raise SurfaceError(f"skills path {os.path.relpath(path, root)} is not a folder")
        out.append(path)
        out.extend(os.path.join(path, n) for n in list_plugin_dir(root, path))
    return list(dict.fromkeys(out))


def declaration_refs(value) -> list[str]:
    """Paths a hooks or mcpServers value points at instead of declaring inline."""
    items = value if isinstance(value, list) else [value]
    return [i for i in items if isinstance(i, str)]


def compute_surface(folder: str, market_entry: dict | None = None) -> tuple[dict | None, str]:
    """Return (surface, reason) for a plugin folder; surface is None when it cannot be read.

    surface is {"agents", "skills", "tools", "hooksMcpSha256"}. tools maps each agent file,
    skill folder and command file (path from the plugin root) to its sorted tools: an agent
    with no `tools` line inherits every tool and reads ["*"], a skill or command reads its
    `allowed-tools`. The hash covers hooks/hooks.json, .mcp.json, .lsp.json, the hooks,
    mcpServers and lspServers declared inline in plugin.json and in the plugin's marketplace
    entry (with any file those point at), `hooks` in agent, skill and command frontmatter
    and a digest of the shell lines (`!`) of each command and skill. The default folders
    are always scanned, whatever custom paths plugin.json or the marketplace entry add, and
    the raw agents, skills and commands values are hashed too.
    """
    try:
        return _surface(folder, market_entry), ""
    except SurfaceError as exc:
        return None, str(exc)
    except Exception as exc:  # a crash here must never block every claude-plugin row
        return None, f"{type(exc).__name__} while reading the plugin"


def _surface(folder: str, market_entry: dict | None) -> dict:
    root = os.path.realpath(folder)
    if not os.path.isdir(root):
        raise SurfaceError("plugin folder is missing")
    raw = read_plugin_file(root, os.path.join(root, ".claude-plugin", "plugin.json"), required=True)
    manifest = parse_plugin_json(raw, "plugin.json")
    if not isinstance(manifest, dict):
        raise SurfaceError("plugin.json is not an object")
    if market_entry is not None and not isinstance(market_entry, dict):
        raise SurfaceError("the marketplace entry is not an object")
    entry = market_entry or {}
    declared: dict = {}
    tools: dict[str, list[str]] = {}
    for site, obj in (("plugin.json", manifest), ("marketplace", entry)):
        for key in ("agents", "skills", "commands"):  # moving a path changes the hash
            if key in obj:
                declared[f"{site}:{key}-paths"] = obj[key]

    def rel_of(path: str) -> str:
        return os.path.relpath(path, root).replace(os.sep, "/")

    def fold_hooks(rel: str, text: str) -> None:
        block = frontmatter_block(text, "hooks")
        if block is not None:
            declared[f"frontmatter-hooks:{rel}"] = block

    agents = md_files(root, manifest, entry, "agents")
    for path in agents:
        text = read_plugin_file(root, path, required=True).decode("utf-8", "replace")
        listed = frontmatter_tools(text, "tools")
        tools[rel_of(path)] = ["*"] if listed is None else sorted(set(listed))
        fold_hooks(rel_of(path), text)
    skills = 0
    for sdir in skill_dirs(root, manifest, entry):
        raw = read_plugin_file(root, os.path.join(sdir, "SKILL.md"))
        if raw is None:
            continue
        skills += 1
        text = raw.decode("utf-8", "replace")
        tools[rel_of(sdir)] = sorted(set(frontmatter_tools(text, "allowed-tools") or []))
        fold_hooks(rel_of(sdir), text)
        digest = command_shell_digest(text)
        if digest is not None:
            declared[f"skill-shell:{rel_of(sdir)}"] = digest
    for path in md_files(root, manifest, entry, "commands"):
        text = read_plugin_file(root, path, required=True).decode("utf-8", "replace")
        tools[rel_of(path)] = sorted(set(frontmatter_tools(text, "allowed-tools") or []))
        fold_hooks(rel_of(path), text)
        digest = command_shell_digest(text)
        if digest is not None:
            declared[f"command-shell:{rel_of(path)}"] = digest
    for rel in ("hooks/hooks.json", ".mcp.json", ".lsp.json"):
        raw = read_plugin_file(root, os.path.join(root, *rel.split("/")))
        if raw is not None:
            declared[rel] = parse_plugin_json(raw, rel)
    for site, obj in (("plugin.json", manifest), ("marketplace", entry)):
        for key in ("hooks", "mcpServers", "lspServers"):
            if key not in obj:
                continue
            declared[f"{site}:{key}"] = obj[key]
            for ref in declaration_refs(obj[key]):
                path = os.path.normpath(os.path.join(root, ref))
                declared["file:" + os.path.relpath(path, root)] = parse_plugin_json(
                    read_plugin_file(root, path, required=True), ref)
    digest = hashlib.sha256(json.dumps(declared, sort_keys=True).encode("utf-8")).hexdigest()
    return {"agents": len(agents), "skills": skills, "tools": tools, "hooksMcpSha256": digest}


def clone_plugin(mp_name: str, plugin: str) -> tuple[str, dict]:
    """The plugin folder and marketplace entry inside a registered marketplace's local clone."""
    known, why = read_known_marketplaces()
    if known is None:
        raise SurfaceError(why)
    entry = known.get(mp_name)
    loc = entry.get("installLocation") if isinstance(entry, dict) else None
    if not isinstance(loc, str) or not os.path.isabs(loc):
        raise SurfaceError(f"marketplace {mp_name} has no local clone")
    loc = os.path.realpath(loc)
    raw = read_plugin_file(loc, os.path.join(loc, ".claude-plugin", "marketplace.json"), required=True)
    listing = parse_plugin_json(raw, "marketplace.json")
    plugins = listing.get("plugins") if isinstance(listing, dict) else None
    found = next((p for p in plugins if isinstance(p, dict) and p.get("name") == plugin), None) \
        if isinstance(plugins, list) else None
    if found is None:
        raise SurfaceError(f"marketplace.json has no entry for {plugin}")
    source = found.get("source")
    if not isinstance(source, str) or "://" in source or source.startswith(("/", "~", "git@")):
        raise SurfaceError("the marketplace entry points outside its clone, so the plugin cannot be read before install")
    folder = os.path.realpath(os.path.join(loc, source))
    if not is_inside(folder, loc):
        raise SurfaceError("the marketplace entry source resolves outside its clone")
    return folder, found


def row_plugin(row: dict) -> tuple[str, str] | None:
    det = row.get("detect")
    pid = det.get("plugin") if isinstance(det, dict) else None
    if row.get("kind") != "claude-plugin" or not isinstance(pid, str) or "@" not in pid:
        return None
    name, mp_name = pid.split("@", 1)
    return name, mp_name


def row_surface(row: dict, repo: str, installs: list[dict], installed: bool) -> tuple[dict | None, str]:
    """An installed row reads its installPath; a row not yet installed reads the marketplace clone."""
    name, mp_name = row_plugin(row)
    try:
        if installed:
            pid = f"{name}@{mp_name}"
            path = next((i.get("installPath") for i in installs if i.get("id") == pid
                         and i.get("enabled") is not False and covers_repo(i, repo)
                         and isinstance(i.get("installPath"), str)), None)
            if path is None:
                raise SurfaceError("no install path is recorded for it")
            try:
                _, entry = clone_plugin(mp_name, name)
            except SurfaceError:
                entry = None
            return compute_surface(path, entry)
        folder, entry = clone_plugin(mp_name, name)
    except SurfaceError as exc:
        return None, str(exc)
    return compute_surface(folder, entry)


def surface_diff(pin: dict, surface: dict) -> list[str]:
    """What the surface has beyond the pin; empty when it is equal or smaller.

    Tools are compared per entry: a new entry, or a tool added to an existing one, is growth.
    Removed entries and removed tools are not.
    """
    diffs = []
    for key in ("agents", "skills"):
        want = pin.get(key)
        if not isinstance(want, int) or isinstance(want, bool):
            diffs.append(f"the pin has no {key} count")
        elif surface[key] > want:
            diffs.append(f"{surface[key]} {key}, pinned {want}")
    pinned = pin.get("tools")
    if not isinstance(pinned, dict):
        diffs.append("the pin has no per-entry tools map")
        pinned = {}
    for entry, have in sorted(surface["tools"].items()):
        if entry not in pinned:
            diffs.append(f"new entry {entry} (tools {' '.join(have) or 'none'})")
            continue
        want = pinned[entry] if isinstance(pinned[entry], list) else []
        extra = sorted(set(have) - set(want))
        if extra:
            diffs.append(f"{entry}: tools not in the pin: " + " ".join(extra))
    if surface["hooksMcpSha256"] != pin.get("hooksMcpSha256"):
        diffs.append("hooks/MCP declarations differ from the pin")
    return diffs


def surface_report(row: dict, repo: str, installs: list[dict], installed: bool) -> tuple[str, list[str]]:
    """Return (line to print, differences). No differences means the row may proceed."""
    pin = row["surface"]
    surface, reason = row_surface(row, repo, installs, installed)
    if surface is None:
        return f"{row['id']}: surface unknown ({reason})", [f"surface unknown ({reason})"]
    match = "matches" if surface["hooksMcpSha256"] == pin.get("hooksMcpSha256") else "differs from"
    union = sorted({t for have in surface["tools"].values() for t in have})
    line = (f"{row['id']}: {surface['agents']} agents, {surface['skills']} skills, "
            f"tools {' '.join(union) or 'none'}, hooks/MCP hash {match} pin")
    return line, surface_diff(pin, surface)


def has_pin(row: dict) -> bool:
    return isinstance(row.get("surface"), dict) and row_plugin(row) is not None


# --- engine state -------------------------------------------------------------

def skill_root(scope: str, repo: str) -> str | None:
    if scope == "project":
        return os.path.join(repo, ".claude")
    if scope == "user":
        return config_dir()
    return None


def detected(row: dict, repo: str, installs: list[dict]) -> bool:
    det = row.get("detect")
    if not isinstance(det, dict):
        return False
    if isinstance(det.get("plugin"), str):
        return any(i.get("id") == det["plugin"] and i.get("enabled") is not False and covers_repo(i, repo)
                   for i in installs)
    needed = det.get("all")
    if not isinstance(needed, list) or not needed:
        return False
    for item in needed:
        ok = False
        for scope in item.get("scopes", []):
            root = skill_root(scope, repo)
            if root and os.path.isfile(os.path.join(root, *item["file"].split("/"))):
                ok = True
                break
        if not ok:
            return False
    return True


def engine_state(row: dict, repo: str, installs: list[dict], answers: dict) -> dict:
    owner = row["owner"]
    ans = saved_answer(answers, row["id"])
    if not owner_active(installs, owner, repo):
        state = "not-applicable"
    elif detected(row, repo, installs):
        state = "installed"
    elif not row.get("default") and ans == "no":
        state = "declined"
    else:
        state = "missing"
    return {
        "id": row["id"], "owner": owner, "kind": row.get("kind"), "default": bool(row.get("default")),
        "bridges": row.get("bridges", []), "state": state, "answer": ans,
        "why": row.get("why", ""),
        "needsQuestion": state == "missing" and not row.get("default") and ans is None,
        "wantsInstall": state == "missing" and (bool(row.get("default")) or ans == "yes"),
    }


# --- running commands ---------------------------------------------------------

def tool_missing(argv: list[str]) -> str | None:
    exe = argv[0]
    if shutil.which(exe):
        return None
    if exe == "claude":
        return "claude is not on PATH. Install Claude Code, then retry."
    if exe == "npx":
        return "npx is not on PATH. Install Node.js (it ships npx), then retry."
    return f"{exe} is not on PATH."


# The repo is the cwd on purpose: project-scope skills installs need it. The repo's own
# .npmrc and node_modules/.bin can influence what npx resolves, which is the same trust
# the person already gives the repo by opening it.
def run_argv(argv: list[str], cwd: str) -> tuple[bool, str]:
    missing = tool_missing(argv)
    if missing:
        return False, missing
    try:
        res = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=900,
                             stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError) as exc:
        return False, f"{type(exc).__name__}: {exc}"
    tail = (res.stdout + res.stderr).strip().splitlines()[-3:]
    return res.returncode == 0, " | ".join(tail)


def valid_argv(value) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(a, str) for a in value)


def retry_line(engine_id: str, action: str) -> str:
    return f"python3 {os.path.abspath(__file__)} run {engine_id} {action}"


def exclude_path_problem(path) -> str | None:
    """Why a gitExclude path is refused, or None when it is fine."""
    if not isinstance(path, str) or not path:
        return "is not a string"
    if any(ord(c) < 32 or ord(c) == 127 or c == "\\" for c in path):
        return "has a control character or a backslash"
    if path.startswith("/"):
        return "starts with /"
    parts = path.split("/")
    if ".." in parts:
        return "has a .. component"
    if not path.startswith(".claude/skills/") or not any(parts[2:]):
        return "is not under .claude/skills/"
    return None


def git_out(args: list[str], repo: str) -> tuple[bool, str]:
    try:
        res = subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True,
                             timeout=15, stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        return False, ""
    return res.returncode == 0, res.stdout.strip()


def apply_git_exclude(row: dict, repo: str) -> list[str]:
    """After a good install or update: add the row's gitExclude paths to the repo's local exclude file."""
    paths = row.get("gitExclude")
    if paths is None:
        return []
    eid = row["id"]
    if not isinstance(paths, list):
        return [f"{eid}: gitExclude is not a list, nothing written"]
    ok_tree, inside = git_out(["rev-parse", "--is-inside-work-tree"], repo)
    if not ok_tree or inside != "true":
        return [f"{eid}: not a git work tree, skipped gitExclude"]
    lines: list[str] = []
    good: list[str] = []
    for path in paths:
        problem = exclude_path_problem(path)
        if problem:
            lines.append(f"{eid}: gitExclude path {path!r} refused, it {problem}")
        else:
            good.append(path)
    if not good:
        return lines
    ok_path, where = git_out(["rev-parse", "--git-path", "info/exclude"], repo)
    if not ok_path or not where:
        return lines + [f"{eid}: could not find the git exclude file, nothing written"]
    target = where if os.path.isabs(where) else os.path.join(repo, where)
    folder = os.path.dirname(target)
    try:
        if os.path.islink(folder):
            return lines + [f"{eid}: {folder} is a symlink, gitExclude refused"]
        if os.path.lexists(target) and stat.S_ISLNK(os.lstat(target).st_mode):
            return lines + [f"{eid}: {target} is a symlink, gitExclude refused"]
        os.makedirs(folder, exist_ok=True)
        have: list[str] = []
        needs_newline = False
        if os.path.lexists(target):
            with open(target, "rb") as fh:
                raw = fh.read()
            have = raw.decode("utf-8", errors="replace").splitlines()
            needs_newline = bool(raw) and not raw.endswith(b"\n")
        fresh = [p for p in good if p not in have]
        if fresh:
            fd = os.open(target, os.O_WRONLY | os.O_APPEND | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o644)
            with os.fdopen(fd, "a", encoding="utf-8") as fh:
                fh.write(("\n" if needs_newline else "") + "".join(p + "\n" for p in fresh))
    except OSError as exc:
        return lines + [f"{eid}: could not write {target} ({type(exc).__name__}: {exc})"]
    for path in good:
        lines.append(f"{eid}: {'added' if path in fresh else 'already in'} {target}: {path}")
        ok, tracked = git_out(["ls-files", "--", path], repo)
        if ok and tracked.strip():  # an exclude line never untracks a committed folder
            lines.append(f"{eid}: {path} is already committed, so the exclude does nothing for it; "
                         f"remove it from the index with: git rm -r --cached {path}")
    return lines


def run_engine(row: dict, action: str, repo: str, installs: list[dict], answers: dict) -> tuple[str, str]:
    """Return (outcome, message). outcome: done, skipped, failed, question."""
    st = engine_state(row, repo, installs, answers)
    eid = row["id"]
    if st["state"] == "not-applicable":
        return "skipped", f"{eid}: skipped, owner {row['owner']} is not installed and enabled for this repo"
    if action == "update" and st["state"] != "installed":
        return "skipped", f"{eid}: not installed, nothing to update"
    installed = st["state"] == "installed"
    mp = row.get("marketplace")
    if isinstance(mp, dict):  # before everything else, even for a row that is already detected
        kind, text = check_marketplace(mp, repo, allow_add=action == "install" and not installed)
        if kind != "ok":
            return "failed", f"{eid}: {text}"
    if action == "install" and installed:
        for line in apply_git_exclude(row, repo):  # a hand-installed copy needs the exclude too
            say(line)
        return "skipped", f"{eid}: already installed"
    pinned = has_pin(row)
    pid = "@".join(row_plugin(row)) if pinned else ""
    if pinned:
        if action == "update":  # read what the update would bring: refresh the clone, then check it
            mp_name = mp["name"] if isinstance(mp, dict) else row_plugin(row)[1]
            ok, detail = run_argv(["claude", "plugin", "marketplace", "update", mp_name], repo)
            if not ok:
                return "failed", f"{eid}: marketplace update failed ({detail}). Retry: {retry_line(eid, action)}"
        line, diffs = surface_report(row, repo, installs, False)
        say(line)
        if diffs:
            say(f"{eid}: surface beyond the pin: {'; '.join(diffs)}")
            return "question", (f"{eid}: not {'installed' if action == 'install' else 'updated'}. Review the surface above, then raise the pin in "
                                f"registry/engines.json or leave the row alone")
    argv = row.get(action)
    if not valid_argv(argv):
        return "failed", f"{eid}: registry row has no valid {action} argv"
    ok, detail = run_argv(argv, repo)
    if not ok:
        return "failed", f"{eid}: {action} failed ({detail}). Retry: {retry_line(eid, action)}"
    if not detected(row, repo, installs) and row.get("kind") != "claude-plugin":
        after = detected(row, repo, read_installs()[0])
        if not after:
            return "failed", f"{eid}: {action} exited 0 but the engine is still not detected. Retry: {retry_line(eid, action)}"
    if pinned:  # the copy on disk is what runs: check every install that covers the repo, not the first
        after = read_installs()[0]
        mine = [i for i in after if i.get("id") == pid and i.get("enabled") is not False and covers_repo(i, repo)]
        bad_scopes: list[tuple[str, str, list[str]]] = []
        for inst in mine or [None]:
            _, diffs = surface_report(row, repo, [inst] if inst else after, True)
            if diffs:
                scope = inst.get("scope") if inst else argv_scope(argv)
                bad_scopes.append((scope if scope in ("user", "project", "local") else "project", install_cwd(inst, repo) or repo if inst else repo, diffs))
        states = []
        for scope, cwd, diffs in bad_scopes:
            off, off_detail = run_argv(["claude", "plugin", "disable", pid, "--scope", scope], cwd)
            states.append(("disabled it" if off else f"could not disable it ({off_detail}); run: claude plugin disable {pid} --scope {scope}")
                          + f" at {scope} scope: {'; '.join(diffs)}")
        if states:
            return "failed", f"{eid}: {action} left a surface beyond the pin, " + " | ".join(states)
    for line in apply_git_exclude(row, repo):
        say(line)
    return "done", f"{eid}: {action} ok"


# --- subcommands --------------------------------------------------------------

def row_findings(row: dict, repo: str, installs: list[dict], st: dict) -> dict:
    """Extra status fields for a row with a marketplace or a surface pin; reads only, adds nothing.

    marketplaceProblem: the registered source is not the row's. surfaceGrew: an installed
    plugin is beyond its pin. surfaceProblem: a plugin about to be installed is beyond
    its pin or unreadable, so the row needs a decision and is not installed.
    """
    out: dict = {}
    if st["state"] == "not-applicable":
        return out
    installed = st["state"] == "installed"
    mp = row.get("marketplace")
    mp_ok = True
    if isinstance(mp, dict):
        kind, text = check_marketplace(mp, repo, allow_add=False)
        if kind == "bad" or (kind == "absent" and installed):
            out["marketplaceProblem"] = text
        mp_ok = kind == "ok"
    if has_pin(row) and mp_ok:
        _, diffs = surface_report(row, repo, installs, installed)
        if diffs and installed:
            out["surfaceGrew"] = diffs
        elif diffs:
            out["surfaceProblem"] = diffs
    if "marketplaceProblem" in out or "surfaceProblem" in out:
        out["wantsInstall"] = False
    if "surfaceProblem" in out:
        out["needsQuestion"] = True
    return out


def cmd_status(args, repo: str) -> int:
    reg = load_registry()
    installs, source = read_installs()
    data, malformed = read_answers(repo)
    latest = latest_versions()
    plugins = []
    for i in pro_dev_installs(installs):
        name = name_of(i["id"])
        cov = covers_repo(i, repo)
        lag = bool(cov and latest.get(name) and i.get("version") != latest[name])
        plugins.append({
            "id": i["id"], "name": name, "scope": i.get("scope"), "version": i.get("version"),
            "latest": latest.get(name), "projectPath": i.get("projectPath"),
            "installPath": i.get("installPath"), "enabled": i.get("enabled") is not False,
            "covers": cov, "lagging": lag,
        })
    engines = []
    for r in reg["engines"]:
        e = engine_state(r, repo, installs, data)
        e.update(row_findings(r, repo, installs, e))
        engines.append(e)
    sdlc = next((p["installPath"] for p in plugins if p["name"] == "pro-ai-sdlc" and p["covers"]
                 and p["installPath"]), None)
    starter = [{"scope": p["scope"], "projectPath": p["projectPath"]} for p in plugins
               if p["name"] == "pro-starter" and p["covers"]]
    out = {
        "repo": repo, "registryVersion": reg.get("version"), "source": source,
        "tools": {"claude": bool(shutil.which("claude")), "npx": bool(shutil.which("npx"))},
        "answersFileMalformed": malformed, "savedRegistryVersion": data.get("registryVersion"),
        "plugins": plugins, "engines": engines, "aiSdlcInstallPath": sdlc, "starterShim": starter,
        "staleCount": len(find_stale()[0]),
    }
    if args.json:
        say(json.dumps(out, indent=2))
        return 0
    say(f"repo: {repo}")
    say(f"registry version: {out['registryVersion']} (last run: {out['savedRegistryVersion']})")
    say("plugins:")
    for p in plugins:
        mark = "" if p["covers"] else " (other repo, left alone)"
        lag = f" lags {p['latest']}" if p["lagging"] else ""
        say(f"  {p['name']} {p['scope']} {p['version']}{lag}{mark}")
    say("engines:")
    for e in engines:
        say(f"  {e['id']}: {e['state']}")
        if e.get("marketplaceProblem"):
            say(f"    marketplace: {e['marketplaceProblem']}")
        for d in e.get("surfaceProblem", []) + e.get("surfaceGrew", []):
            say(f"    surface: {d}")
    return 0


def write_run_version(repo: str, reg: dict) -> bool:
    data, malformed = read_answers(repo)
    if malformed:
        say(f"answers file not updated: {answers_problem(repo) or 'it is not valid JSON, fix or delete it'}")
        return False
    if data.get("registryVersion") != reg.get("version"):
        data["registryVersion"] = reg.get("version")
        try:
            write_answers(repo, data)
        except AnswersError as exc:
            say(f"answers file not updated: {exc}")
            return False
    return True


def cmd_run(args, repo: str) -> int:
    reg = load_registry()
    rows = {r["id"]: r for r in reg["engines"] if isinstance(r, dict) and "id" in r}
    installs, _ = read_installs()
    data, _ = read_answers(repo)
    action = args.action
    failures: list[str] = []

    if args.id != "all":
        if args.id not in rows or not ENGINE_ID_RE.match(args.id):
            say(f"unknown engine id: {args.id}")
            return 2
        outcome, msg = run_engine(rows[args.id], action, repo, installs, data)
        say(msg)
        return 1 if outcome in ("failed", "question") else 0

    # all: update every installed row (update only), then install what is missing
    if action == "update":
        for row in rows.values():
            if engine_state(row, repo, installs, data)["state"] == "installed":
                outcome, msg = run_engine(row, "update", repo, installs, data)
                say(msg)
                if outcome in ("failed", "question"):
                    failures.append(msg)
    installs, _ = read_installs()
    for row in rows.values():
        st = engine_state(row, repo, installs, data)
        if st["wantsInstall"]:
            say(f"{row['id']}: installing")
            outcome, msg = run_engine(row, "install", repo, installs, data)
            say(msg)
            if outcome in ("failed", "question"):
                failures.append(msg)
        elif st["state"] == "installed" and action == "install":
            outcome, msg = run_engine(row, "install", repo, installs, data)  # still checks its marketplace
            say(msg)
            if outcome == "failed":
                failures.append(msg)
    if not write_run_version(repo, reg):
        failures.append("answers file not updated")
    if failures:
        say("")
        say(f"{len(failures)} step(s) failed. Retry each with the command shown:")
        for f in failures:
            say(f"  {f}")
        return 1
    return 0


def cmd_answer(args, repo: str) -> int:
    reg = load_registry()
    rows = {r["id"]: r for r in reg["engines"] if isinstance(r, dict) and "id" in r}
    if args.id not in rows:
        say(f"unknown engine id: {args.id}")
        return 2
    if rows[args.id].get("default"):
        say(f"{args.id} is a default engine and is not asked about")
        return 2
    data, malformed = read_answers(repo)
    if malformed:
        say(f"cannot save the answer: {answers_problem(repo) or ANSWERS_FILE + ' is not valid JSON. Fix or delete it, then retry'}")
        return 1
    answers = data.get("answers") if isinstance(data.get("answers"), dict) else {}
    answers[args.id] = {"answer": args.value, "registryVersion": reg.get("version")}
    data["answers"] = answers
    try:
        changed = write_answers(repo, data)
    except AnswersError as exc:
        say(f"cannot save the answer: {exc}")
        return 1
    say(f"{args.id}: {args.value}" + ("" if changed else " (unchanged)"))
    return 0


def cmd_surface(args, repo: str) -> int:
    reg = load_registry()
    row = next((r for r in reg["engines"] if isinstance(r, dict) and r.get("id") == args.id), None)
    if row is None or row_plugin(row) is None:
        say(f"{args.id}: not a claude-plugin row")
        return 2
    installs, _ = read_installs()
    surface, reason = row_surface(row, repo, installs, True)
    if surface is None:
        say(f"{args.id}: surface unknown ({reason})")
        return 1
    say(json.dumps(surface, indent=2, sort_keys=True))
    return 0


def argv_scope(argv) -> str | None:
    """The value after --scope in a registry argv, or None."""
    if isinstance(argv, list) and "--scope" in argv:
        i = argv.index("--scope")
        return argv[i + 1] if i + 1 < len(argv) else None
    return None


def valid_plugin_id(pid) -> bool:
    return isinstance(pid, str) and bool(PLUGIN_ID_RE.match(pid)) and pid.endswith("@" + MARKETPLACE)


def install_cwd(entry: dict, repo: str) -> str | None:
    if entry.get("scope") == "user":
        return repo
    pp = entry.get("projectPath")
    if isinstance(pp, str) and os.path.isdir(pp):
        return pp
    return None


def cmd_plugins_update(args, repo: str) -> int:
    failures: list[str] = []
    ok, detail = run_argv(["claude", "plugin", "marketplace", "update", MARKETPLACE], repo)
    say("marketplace refresh: ok" if ok else f"marketplace refresh failed ({detail}). Retry: claude plugin marketplace update {MARKETPLACE}")
    if not ok:
        failures.append("marketplace refresh")
    installs, _ = read_installs()
    targets = [i for i in pro_dev_installs(installs) if covers_repo(i, repo) and valid_plugin_id(i["id"])
               and i.get("scope") in SCOPES]
    before = {(i["id"], i.get("scope"), i.get("projectPath")): i.get("version") for i in targets}
    for i in targets:
        cwd = install_cwd(i, repo)
        if cwd is None:
            say(f"{i['id']} {i['scope']}: project folder is missing, skipped (see stale)")
            continue
        ok, detail = run_argv(["claude", "plugin", "update", i["id"], "--scope", i["scope"]], cwd)
        if not ok:
            failures.append(i["id"])
            say(f"{i['id']} {i['scope']}: update failed ({detail}). Retry from {cwd}: claude plugin update {i['id']} --scope {i['scope']}")
    after_installs, _ = read_installs()
    after = {(i["id"], i.get("scope"), i.get("projectPath")): i.get("version") for i in pro_dev_installs(after_installs)}
    for key, old in before.items():
        new = after.get(key, old)
        note = "unchanged" if new == old else f"{old} -> {new}"
        say(f"{key[0]} {key[1]}: {note}")
    if failures:
        say(f"{len(failures)} step(s) failed.")
        return 1
    return 0


def cmd_swap_starter(args, repo: str) -> int:
    installs, _ = read_installs()
    shims = [i for i in pro_dev_installs(installs) if i["id"] == f"pro-starter@{MARKETPLACE}" and covers_repo(i, repo)
             and i.get("scope") in SCOPES]
    if not shims:
        say("pro-starter is not installed for this repo, nothing to swap")
        return 0
    failed = False
    for s in shims:
        if s.get("enabled") is False:
            say(f"pro-starter {s['scope']}: disabled, skipped")
            continue
        cwd = install_cwd(s, repo)
        if cwd is None:
            say(f"pro-starter {s['scope']}: project folder is missing, skipped")
            continue
        scope = s["scope"]
        steps = []
        for dep in STARTER_DEPS:
            has = any(i.get("id") == f"{dep}@{MARKETPLACE}" and i.get("scope") == scope
                      and i.get("enabled") is not False and i.get("projectPath") == s.get("projectPath") for i in installs)
            if has:
                steps.append(["claude", "plugin", "install", f"{dep}@{MARKETPLACE}", "--scope", scope])
        steps.append(["claude", "plugin", "install", f"pro-dev-starter@{MARKETPLACE}", "--scope", scope])
        steps.append(["claude", "plugin", "uninstall", f"pro-starter@{MARKETPLACE}", "--scope", scope])
        for argv in steps:
            ok, detail = run_argv(argv, cwd)
            if not ok:
                say(f"{' '.join(argv)} failed ({detail}). Stopped; pro-starter is left in place for this scope.")
                failed = True
                break
            say(f"ok: {' '.join(argv)}")
    return 1 if failed else 0


def skip_unreachable(pp: str) -> bool:
    """True for a path on an unmounted /Volumes drive or under an unreadable ancestor."""
    parts = pp.split("/")
    if pp.startswith("/Volumes/") and len(parts) > 3 and parts[2]:
        mount = "/Volumes/" + parts[2]
        # /Volumes/<boot disk> is a symlink to /, which counts as present
        if not (os.path.ismount(mount) or (os.path.islink(mount) and os.path.realpath(mount) == "/")):
            return True
    cur = pp
    while not os.path.exists(cur):
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    return not os.access(cur, os.R_OK)


def find_stale() -> tuple[list[dict], dict | None, str | None]:
    """Return (stale entries, parsed file or None, problem or None)."""
    path = installed_plugins_path()
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return [], None, None
    except (OSError, ValueError):
        return [], None, "installed_plugins.json is not valid JSON"
    if (not isinstance(data, dict) or data.get("version") != 2 or not isinstance(data.get("plugins"), dict)
            or any(not isinstance(v, list) or any(not isinstance(e, dict) for e in v)
                   for v in data["plugins"].values())):
        return [], None, "installed_plugins.json has a shape this script does not know"
    stale = []
    for pid, items in data["plugins"].items():
        if not pid.endswith("@" + MARKETPLACE):
            continue
        for e in items:
            pp = e.get("projectPath")
            if isinstance(pp, str) and pp and not os.path.isdir(pp) and not skip_unreachable(pp):
                stale.append({"id": pid, "scope": e.get("scope"), "projectPath": pp})
    return stale, data, None


def cmd_stale(args, repo: str) -> int:
    stale, data, problem = find_stale()
    if problem:
        say(f"{problem}. Nothing changed.")
        return 1
    if not stale:
        say("no stale installs (entries on unmounted drives are skipped)")
        return 0
    for s in stale:
        say(f"stale: {s['id']} {s['scope']} {s['projectPath']}")
    if not args.remove:
        say(f"{len(stale)} stale install(s). Run stale --remove to clean them. Entries on unmounted drives are skipped.")
        return 0
    path = installed_plugins_path()
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = f"{path}.bak-{stamp}"
    try:
        shutil.copy2(path, backup)
        gone = {(s["id"], s["scope"], s["projectPath"]) for s in stale}
        for pid in list(data["plugins"].keys()):
            kept = [e for e in data["plugins"][pid] if (pid, e.get("scope"), e.get("projectPath")) not in gone]
            if kept:
                data["plugins"][pid] = kept
            else:
                del data["plugins"][pid]
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".installed_plugins.")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
            fh.write("\n")
        os.replace(tmp, path)
    except OSError as exc:
        say(f"could not edit installed_plugins.json ({exc}). Backup, if written: {backup}")
        return 1
    say(f"removed {len(stale)} stale install(s). Backup: {backup}")
    return 0


# --- entry --------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="pro-dev.py", description=__doc__.split("\n")[0])
    p.add_argument("--repo", help="repo root (default: git toplevel of the current folder)")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("status")
    s.add_argument("--json", action="store_true")
    r = sub.add_parser("run")
    r.add_argument("id")
    r.add_argument("action", choices=["install", "update"])
    a = sub.add_parser("answer")
    a.add_argument("id")
    a.add_argument("value", choices=["yes", "no"])
    pl = sub.add_parser("plugins")
    pl.add_argument("what", choices=["update", "swap-starter"])
    st = sub.add_parser("stale")
    st.add_argument("--remove", action="store_true")
    sf = sub.add_parser("surface")
    sf.add_argument("id")
    return p


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    repo = find_repo(args.repo)
    try:
        if args.cmd == "status":
            return cmd_status(args, repo)
        if args.cmd == "run":
            return cmd_run(args, repo)
        if args.cmd == "answer":
            return cmd_answer(args, repo)
        if args.cmd == "plugins":
            return cmd_plugins_update(args, repo) if args.what == "update" else cmd_swap_starter(args, repo)
        if args.cmd == "stale":
            return cmd_stale(args, repo)
        if args.cmd == "surface":
            return cmd_surface(args, repo)
    except (OSError, ValueError) as exc:
        say(f"pro-dev.py: {type(exc).__name__}: {exc}")
        return 1
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
