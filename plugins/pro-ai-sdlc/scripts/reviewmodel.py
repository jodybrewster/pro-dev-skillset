#!/usr/bin/env python3
"""reviewmodel - the model REVIEW.md names for reviews, per host (intent/2026-11-07-reaching-done, spec-m2).

  reviewmodel.py [--host claude|codex]   print {host, required, source}, the same JSON as pro-ship's
                                         `pr-check.py review-model`: the rule from REVIEW.md on the
                                         default branch tip, never the working tree.

  reviewmodel.py marker                  print the pr-check marker line through pro-ship's pr-check.py,
                                         found in the repo layout or the plugin cache; not-installed
                                         and exit 3 without pro-ship (/execute stage 8)

factory.py and lessons.py import it; /review, the doubt step and /execute run it. pro-ship's pr-check.py and ship.py hold the same block, because
plugins do not import each other; the review-model check in tests/check.mjs keeps the copies equal.

Python 3 standard library only. No network calls.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

# --- review model: begin (spec-m2 R2, R3, R8, R10) ---------------------------------------------
# One copy each in pro-ship's pr-check.py and ship.py and in pro-ai-sdlc's reviewmodel.py, because
# plugins do not import each other (ADR-0003). The review-model check in tests/check.mjs holds the
# copies byte for byte to one block and runs each on tests/fixtures/review-model/cases.json.
REVIEW_HOSTS = ("claude", "codex")
FAMILIES = ("opus", "sonnet", "haiku", "fable")
MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@\[\]-]{0,99}$")
DEFAULT_RULES = {"claude": "opus"}
TIP_REFS = ("origin/HEAD", "origin/main", "main", "origin/master", "master")
# The PR body marker `pr-check.py marker` prints (docs/pr-check-stamp.md). model= and host= are
# optional: a marker written before spec-m2 has neither (R14).
MARKER = re.compile(
    r"<!--\s*pro-ship:pr-check\s+head=([0-9a-f]{40})\s+result=([a-z]+)\s+tier=([a-z]+)"
    r"(?:\s+model=([A-Za-z0-9][A-Za-z0-9._:/@\[\]-]{0,99})\s+host=([a-z]+))?\s*-->")


def family(model):
    """The Claude family a model id names: the first of opus, sonnet, haiku and fable it contains."""
    if not isinstance(model, str):
        return None
    low = model.lower()
    return next((f for f in FAMILIES if f in low), None)


def parse_review_model(text):
    """{host: rule} from the fenced yaml block under `## Review model`; None when there is none to read."""
    if not isinstance(text, str):
        return None
    lines = text.splitlines()
    start = next((i for i, ln in enumerate(lines) if re.match(r"^##\s+review model\s*$", ln.strip(), re.I)), None)
    if start is None:
        return None
    rules, inside = {}, False
    for ln in lines[start + 1:]:
        s = ln.strip()
        if not inside:
            if s.startswith("#") and not s.startswith("```"):
                return None
            inside = bool(re.match(r"^```\s*ya?ml\s*$", s, re.I))
            continue
        if s.startswith("```"):
            return rules or None
        s = s.split("#", 1)[0].strip()
        m = re.match(r"^([A-Za-z]+)\s*:\s*[\"']?([^\"'\s]+)[\"']?$", s)
        if m and m.group(1).lower() in REVIEW_HOSTS and MODEL_ID.match(m.group(2)):
            rules[m.group(1).lower()] = m.group(2)
    return None


def review_rules(root, refs=TIP_REFS):
    """(rules, source): `## Review model` of REVIEW.md on the default branch tip, never the working tree
    or the branch under review. No tip, no file or no readable section gives the default rules."""
    for ref in refs:
        try:
            r = subprocess.run(["git", "rev-parse", "--verify", "-q", ref + "^{commit}"], cwd=root,
                               capture_output=True, text=True, timeout=30)
            if r.returncode != 0:
                continue
            r = subprocess.run(["git", "show", ref + ":REVIEW.md"], cwd=root, capture_output=True, text=True, timeout=30)
        except (OSError, subprocess.SubprocessError):
            break
        rules = parse_review_model(r.stdout) if r.returncode == 0 else None
        if rules is not None:
            return rules, ref + ":REVIEW.md"
        break
    return dict(DEFAULT_RULES), "default"


def model_ok(host, model, rules):
    """True when the model meets the host's rule, False when it misses it or is missing, None when the
    host has no rule. A claude rule compares families; a codex rule is `any` or an exact id."""
    rule = rules.get(host) if isinstance(rules, dict) else None
    if rule is None:
        return None
    if not isinstance(model, str) or not model or model == "none":
        return False
    if rule.lower() == "any":
        return True
    if host == "claude":
        return family(model) is not None and family(model) == (family(rule) or rule.lower())
    return model == rule


def model_mode():
    """warn or enforce, from `mode.review-model` in the guard folder alone; warn by default (ADR-0016)."""
    d = os.environ.get("CLAUDE_GUARD_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "hooks")
    try:
        with open(os.path.join(d, "mode.review-model"), encoding="utf-8") as fh:
            return "enforce" if fh.readline().strip() == "enforce" else "warn"
    except OSError:
        return "warn"
# --- review model: end -------------------------------------------------------------------------


def cmd_marker():
    """/execute stage 8 (spec-m2 R17): find pro-ship's pr-check.py as factory.py finds it, in the repo
    layout or the plugin cache; print its marker line. not-installed and exit 3 when it is absent."""
    sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
    import factory  # imported here, since factory imports this module
    script = factory.find_script("FACTORY_PR_CHECK", "pro-ship", "pr-check.py")
    if not script:
        print("not-installed")
        return 3
    r = subprocess.run([sys.executable, script, "marker"], capture_output=True, text=True, timeout=60)
    sys.stdout.write(r.stdout)
    sys.stderr.write(r.stderr)
    return r.returncode


def main(argv):
    if argv == ["marker"]:
        return cmd_marker()
    host = "claude"
    if argv[:1] == ["--host"] and len(argv) == 2:
        host = argv[1]
    elif argv:
        print("reviewmodel: usage: reviewmodel.py [--host claude|codex] | marker", file=sys.stderr)
        return 2
    if host not in REVIEW_HOSTS:
        print(f"reviewmodel: --host must be one of {', '.join(REVIEW_HOSTS)}", file=sys.stderr)
        return 1
    try:
        root = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=30).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        root = ""
    rules, source = review_rules(root or os.getcwd())
    print(json.dumps({"host": host, "required": rules.get(host), "source": source}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
