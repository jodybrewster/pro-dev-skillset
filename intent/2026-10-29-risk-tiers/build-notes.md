# Build notes for the four parallel tracks (steps 1 and 2)

Preflight (step 1) passed on 2026-10-30: every pr-gate and code-reviewer file is tracked on HEAD, and `node tests/ship-hooks.mjs` passed 82/82 before any change.
The plan's "ADR-0013" for the gate stamp is `docs/decisions/0014-gate-stamp.md`.
This intent's ADR is `docs/decisions/0015-risk-tiers.md` (0013 is plugin layering).
The stamp contract page is `docs/pr-check-stamp.md`.

## Helpers to reuse in `plugins/pro-ship/scripts/pr-check.py`

- `sh(args, cwd, timeout=30)` line 62: subprocess wrapper returning CompletedProcess.
- `repo_root(cwd=None)` line 66, `rev(root, ref)` line 77, `merge_base(root, ref)` line 97, `default_base(root)` line 107 (None on the default branch).
- `flag(args, name)` line 369: value of `--name`, raises `Refuse` when missing.
- `OWN_ROOT` line 426: the plugin root. `plugins_root()` line 429 reads `CLAUDE_CODE_PLUGIN_CACHE_DIR`, else `~/.claude/plugins`.
- `find_sibling(root, plugin, filename)` line 460: path of `<plugin>/scripts/<filename>` or the string `not-installed`. Order: in-place sibling next to `OWN_ROOT`, install record (project/local then user), the repo's `plugins/` folder if its marketplace lists the plugin. It lives in pr-check.py, which has a hyphen in its name, so importing it needs `importlib`. Step 6 may import it that way or write a small locator in `risk-classify.py`.

## Where pr-check.py handles `tier`

- `cmd_run` line 386: `tier = flag(args, "--tier") or "unclassified"`, then `run_mutation(root, base, tier, disc, timeout)` at line ~402.
- `run_mutation` line 651: `if tier == "low": return mutation_result("skipped", "low tier")` is where the mutation check decides to run. Step 16 keeps this and feeds it the real tier.
- `cmd_stamp` line 756: `tier = flag(args, "--tier") or "unclassified"` at line 766, written as `"tier": tier` at line 803. Step 16 adds the classifier JSON input and the `risk` field here.

## How `tests/ship-hooks.mjs` builds throwaway repos

Inside `runShipHookCases()`: `sandbox` temp dir, `env0` (HOME in the sandbox, `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_SYSTEM` set to `/dev/null`), `sh(cwd, ...git args)`, `sha(repo)`, `commit(repo, name)`, `newRepo()` (a `main` branch with one commit `a.txt`), `writeStamp`, `fixture`, `newEnv({mode, modePr})` (fresh `CLAUDE_GUARD_DIR` and `PRO_DEV_STATE_DIR`), `run(command, {cwd, env, raw, session, mode, payload})` which spawns the gate script, `quiet(r)`, `warned(r)`, `add(id, expect, r, ok)`, `enforce()`.
The merge-gate cases of Track B copy this style with a `MERGE_GATE` path constant and a `mode.merge-gate` file in `gdir`.
Unit cases for the classifier use their own helpers in `tests/unit/risk-classifier.test.mjs`: `buildRepo(fixture, {onFeat})`, `loadFixture(name)`, `classify(repo, args)`, exported for reuse.
A fixture is `tests/fixtures/risk/<name>.json` with `base` and `head` as `{path: content}` maps (a null content deletes the path).

## Classifier (`plugins/pro-ship/scripts/risk-classify.py`)

Functions: `classify(repo, base=None, head="HEAD", intent=None) -> dict`, `CouldNotRun`, `main(argv=None) -> int`, `git(repo, *args)` (10 s timeout, raises CouldNotRun), `resolve`, `find_base`, `split_diff`, `read_diff` (the one `git diff` call), `signal(id, floor, strength, evidence, reason)`, `path_signals(files)`, `dependency_signals(files)`, `render(result)`.
`files` is `{path: {"added": [...], "removed": [...], "status": "A"|"D"|"M"}}`.
Threshold constants (placeholders, unmeasured) sit at the top: `FILES_MEDIUM`, `FILES_HIGH`, `LINES_MEDIUM`, `LINES_HIGH`, `AREAS_MEDIUM`, `NO_TEST_LINES`.
Only the `workflows` and `dependencies` rules exist so far; Track A adds the rest as step 3 to 9 say.
Exit codes: 0 low, 3 medium, 4 high, 2 could not run, 64 usage.

## JSON contract

```
{
  "tier": "low" | "medium" | "high",
  "signals": [ {"id": str, "floor": "low"|"medium"|"high", "strength": "strong"|"weak",
                "evidence": [str], "reason": str} ],          sorted by (id, evidence)
  "declared": "low"|"medium"|"high"|"none",
  "findings": [str],                                          e.g. "risk-underdeclared: ..."
  "tie": [top, one_below] | null,
  "architecture": bool,
  "demands": {"checks": [str], "reviewers": [str], "approval": "none"|"maintainer",
              "local_decision": "allow"|"ask", "label": "none"|"risk:high"},
  "base": "<40-char sha of the merge base>",
  "head": "<40-char sha>",
  "policy": "defaults" | "unreadable (<reason>)",
  "notes": [str]                                              e.g. "surface-unavailable: security_surface"
}
```

Could not run with `--json` prints `{"could_not_run": true, "reason": str, "tier": "high"}` on stdout and exits 2.
Without `--json` it prints `risk-classify: could not run: <reason>` on stderr and exits 2.
Reasons so far: `not a git repository or head does not resolve`, `no merge base`, `empty range`, `git timed out`, `git not found`, `git diff failed`, `base <ref> does not resolve`.
Text output: line 1 `risk: <tier>`, then `policy:`, `declared:`, an optional `tie: [a, b]`, one `  <id> <floor> <strength> <evidence>: <reason>` line per signal, then `finding:` and `note:` lines.
Import for the gate: load the file with `importlib.util.spec_from_file_location("risk_classify", path)`, call `classify(repo, base, head)` and catch `CouldNotRun`.

## Helpers in `plugins/pro-ship/scripts/pr-gate.py` for Track B (merge-gate.py)

`guard_dir()` line 42, `mode(hook)` line 46, `log(hook, action, detail, cwd)` line 58 (writes `warn.log`), `strip_heredocs` line 86, `split_segments` line 99, `skip_wrappers` line 157, `substitutions` line 194, `actions(command, base)` line 289 (resolves `cd` and `-C` targets), `repo_and_head(directory)` line 340, `main_hook` line 413.
These match `gh pr create`; merge-gate matches `gh pr merge` the same way.
