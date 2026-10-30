#!/usr/bin/env python3
"""Reproduce the risk classifier calibration over merged PRs #60 to #89.

Run from the repo root (it needs git history and an authenticated gh):

    python3 intent/2026-10-30-p0-hardening/calibrate.py            # the table and the count
    python3 intent/2026-10-30-p0-hardening/calibrate.py --sweep    # plus the threshold sweep

For each PR it classifies the squash commit against its first parent with
plugins/pro-ship/scripts/risk-classify.py and counts the code files, lines and areas the way
size_signals does (excused and test paths left out). With --sweep it moves one threshold at a
time, the others at their defaults, and prints the contiguous range of values around the
default that changes no PR's tier, then the PRs that change at the first value outside it.
Python 3 standard library only. Not run in CI: it needs gh and history.
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys

FIRST, LAST = 60, 89
CLASSIFIER = os.path.join("plugins", "pro-ship", "scripts", "risk-classify.py")


def load():
    spec = importlib.util.spec_from_file_location("risk_classify", CLASSIFIER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def memoize(mod, name):
    fn = getattr(mod, name)
    cache = {}

    def wrapped(*args):
        # arguments that are dicts, sets or lists come from other memoized calls, so they are the
        # same objects every time and their identity is a safe key
        key = tuple(id(a) if isinstance(a, (dict, set, list)) else a for a in args)
        if key not in cache:
            cache[key] = fn(*args)
        return cache[key]

    setattr(mod, name, wrapped)


def merged_prs():
    out = subprocess.run(["gh", "pr", "list", "--state", "merged", "--limit", "200", "--json",
                          "number,title,mergeCommit"], capture_output=True, text=True, check=True).stdout
    prs = [p for p in json.loads(out) if FIRST <= p["number"] <= LAST and p.get("mergeCommit")]
    return sorted(prs, key=lambda p: p["number"])


def measure(mod, repo, base_sha, head_sha):
    files, _patch = mod.read_diff(repo, base_sha, head_sha)
    counted = {p: f for p, f in files.items() if not mod.excused(p) and not mod.is_test(p)}
    lines = sum(len(f["added"]) + len(f["removed"]) for f in counted.values())
    return len(counted), lines, len({mod.area(p) for p in counted})


def classify_all(mod, prs, repo, **override):
    base = mod.default_thresholds()
    mod.default_thresholds = lambda: {**base, **override}
    try:
        return {p["number"]: mod.classify(repo, p["mergeCommit"]["oid"] + "^1", p["mergeCommit"]["oid"]) for p in prs}
    finally:
        mod.default_thresholds = lambda: base


def main():
    sweep = "--sweep" in sys.argv[1:]
    repo = os.getcwd()
    mod = load()
    for name in ("read_diff", "surface_signals", "env_var_signals", "tree_paths", "show", "read_policy", "resolve",
                 "find_base", "hook_script_paths", "dependency_signals", "policy_signals",
                 "declared_risk"):
        memoize(mod, name)
    defaults = mod.default_thresholds()
    prs = merged_prs()
    base_results = classify_all(mod, prs, repo)
    counts = {"low": 0, "medium": 0, "high": 0}
    rows = []
    measures = {}
    for p in prs:
        n, oid = p["number"], p["mergeCommit"]["oid"]
        res = base_results[n]
        counts[res["tier"]] += 1
        measures[n] = measure(mod, repo, mod.resolve(repo, oid + "^1"), oid)
        files, lines, areas = measures[n]
        ids = ", ".join(sorted({s["id"] for s in res["signals"]})) or "none"
        title = p["title"].replace("|", "/")
        rows.append(f"| {n} | {title} | {res['tier']} | {ids} | {files} | {lines} | {areas} |")
    print("# Risk classifier calibration, PRs #60 to #89\n")
    print("Thresholds in use: " + ", ".join(f"{k}={v}" for k, v in defaults.items()) + "\n")
    print("| PR | Title | Tier | Signals | Files | Lines | Areas |")
    print("|---|---|---|---|---|---|---|")
    print("\n".join(rows))
    print(f"\n{len(prs)} PRs: {counts['low']} low, {counts['medium']} medium and {counts['high']} high.\n")
    if not sweep:
        return 0
    baseline = {n: r["tier"] for n, r in base_results.items()}
    observed = {"files_medium": 0, "files_high": 1, "lines_medium": 1, "lines_high": 1, "areas_medium": 2, "no_test_lines": 1}
    print("## Sweep, one threshold at a time\n")
    print("| Threshold | Value | Tier-neutral range | First value outside it, PRs that move |")
    print("|---|---|---|---|")
    for key in mod.THRESHOLD_KEYS:
        metric = {"files_medium": 0, "files_high": 0, "lines_medium": 1, "lines_high": 1, "areas_medium": 2,
                  "no_test_lines": 1}[key]
        values = {m[metric] for m in measures.values()}
        cands = set()
        for v in values:
            cands.update({v - 1, v, v + 1})
        # a tier can only change when a threshold crosses an observed value, so the observed values
        # and their neighbours are exact boundaries; whole numbers are added where the metric is small
        if key == "no_test_lines":
            cands.update(range(0, 101))
        elif metric != 1:
            cands.update(range(1, 41))
        cands.add(defaults[key])
        cands = sorted(c for c in cands if c >= 0)
        moved = {}
        for c in cands:
            if c == defaults[key]:
                moved[c] = {}
                continue
            got = classify_all(mod, prs, repo, **{key: c})
            moved[c] = {n: f"{baseline[n]} to {r['tier']}" for n, r in got.items() if r["tier"] != baseline[n]}
        d = cands.index(defaults[key])
        lo = d
        while lo > 0 and not moved[cands[lo - 1]]:
            lo -= 1
        hi = d
        while hi < len(cands) - 1 and not moved[cands[hi + 1]]:
            hi += 1
        outside = []
        if lo > 0:
            outside.append(f"{cands[lo - 1]}: " + ", ".join(f"#{n} {t}" for n, t in moved[cands[lo - 1]].items()))
        if hi < len(cands) - 1:
            outside.append(f"{cands[hi + 1]}: " + ", ".join(f"#{n} {t}" for n, t in moved[cands[hi + 1]].items()))
        rng = ("any value" if hi == len(cands) - 1 and lo == 0 else
            f"{cands[lo]} and up" if hi == len(cands) - 1 else (
                f"{cands[lo]} or less to {cands[hi]}" if lo == 0 else f"{cands[lo]} to {cands[hi]}"))
        print(f"| {key} | {defaults[key]} | {rng} | {'; '.join(outside) or 'none in the values tried'} |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
