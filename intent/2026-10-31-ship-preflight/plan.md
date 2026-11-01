# Plan: `/ship` preflight with a go/no-go verdict

Built from `spec.md` (as revised in #123) and `intent.md` in this folder.
Status: approved.
Approver: the maintainer.
It adds a hook to every repo that installs pro-ship, changes the merge gate and pro-legal's release gate and adds two pro-quality agents, so it does not suit auto mode.
The blast radius stays small: the new gate starts in warn, reads one file, makes no network call and fails open.
The merge gate change only adds a line to a message it already shows.
Dated: 2026-11-01.

## Interfaces every part builds against

These are fixed here so the parts can be built in parallel.

`plugins/pro-ship/scripts/ship.py`, Python 3 standard library only:

- `targets(root) -> list[dict]` and `python3 ship.py targets [--root DIR]` printing that list as JSON (R1 to R4).
  Each target: `{"id", "kind", "path", "env", "url", "rollback", "evidence": [files]}`; `env`, `url` and `rollback` are null unless the Ship block sets them.
- `check(root, sha) -> dict` and `python3 ship.py check <sha> [--root DIR]` printing `{"fresh": bool, "cause": null | "missing" | "unreadable" | "stale" | "no-go", "status": ..., "head": ...}` (R31).
  `fresh` is true only with `cause` null.
- `python3 ship.py scope [--pr N] [--root DIR]` printing `{"kind", "base", "head", "range", "last_deploy_source", "targets"}` (R5, R6).
- `python3 ship.py coverage <base> <head> [--root DIR]` printing `{"prs": [{"number", "head", "marker": {...} | null, "covered": bool}], "uncovered": [sha], "covered": [sha]}` (R7, R8).
- `python3 ship.py record <report.json> [--root DIR]` writing the record (R25 to R30) and printing the paths it wrote.

`report.json`, which the skill writes and `record` reads:

```json
{
  "verdict": "GO",
  "head": "<40 hex>", "base": "<40 hex>",
  "scope": {"kind": "pr|tag|deploy", "range": "<base>..<head>", "prs": [12], "uncovered": [], "last_deploy_source": "github|tag|ask|none"},
  "blockers": [{"text": "...", "evidence": "..."}],
  "fixes": [{"text": "...", "evidence": "..."}],
  "risks": [{"text": "...", "mitigation": "...", "accepted_by": "the person's name or null", "accepted_at": "ISO 8601 or null"}],
  "checks": [{"section": "security", "item": "dependency audit", "status": "pass|finding|confirm", "evidence": "..."}],
  "legal": {"status": "done|not-installed|could-not-run", "verdict": "Ship|Ship with changes|Hold|null", "base": "<sha>|null", "head": "<sha>|null", "blocking": 0, "required": 0},
  "targets": [{"id": "web", "kind": "deploy-on-merge", "env": "production", "url": null, "commit": "<sha>", "rollback": {"triggers": ["..."], "steps": ["..."], "rto": "5 minutes"}}],
  "report_md": "<the full Markdown report>"
}
```

`record` refuses a `GO` with a non-empty `blockers` list or a target with no rollback steps (R23).
`status` is `fail` for NO-GO, `partial` for GO with any risk whose `accepted_by` is set and `pass` otherwise.

The record is the R25 manifest.
`detail_json` is `json.dumps` of the report without `report_md`.
`report_md` is written to `.pro-dev/ship/preflight.md`.

The PR body marker (R9): `<!-- pro-ship:pr-check head=<40 hex> result=<pass|fail|incomplete> tier=<tier> -->`, printed by `python3 pr-check.py marker`.

## Files that change

New:

- `docs/ship-preflight.md`: the record contract, the single source for every copy of R31.
- `tests/fixtures/ship-preflight/`: record cases (`go.json`, `go-risks.json`, `no-go.json`, `stale.json`, `corrupt.json`, `wrong-schema.json`, `foreign-producer.json`, `legal-hold.json`, `legal-old-base.json`) with `HEAD` as the sha placeholder, `expect.json` and target-detection trees under `repos/`.
- `plugins/pro-ship/scripts/ship.py` and `plugins/pro-ship/scripts/ship-gate.py`.
- `plugins/pro-ship/skills/ship/SKILL.md`, `release-checks.md`, `rollbacks.md`, `report.md` and `references/{performance,security,observability}-checklist.md`.
- `plugins/pro-quality/agents/test-engineer.md`, `web-performance-auditor.md` and their `.codex-plugin/agents/*.toml`.
- `tests/ship-preflight.mjs`, exported as `runShipPreflightCases()`.

Modified:

- `plugins/pro-ship/hooks/hooks.json` (third hook), `scripts/merge-gate.py` (R32), `scripts/pr-check.py` (`marker`), `skills/pr-check/pr-body.md`.
- `plugins/pro-legal/scripts/release-gate.py` (R19a).
- `tests/ship-hooks.mjs`, `tests/legal-hooks.mjs`, `tests/ship-check.mjs`, `tests/check.mjs` (`preflight-contract` and the runner), `tests/cases/routing.jsonl`, `tests/cases/uncovered.json` if an agent has no routing case.
- `plugins/pro-core/skills/using-pro-dev/SKILL.md`, `README.md`, `RELEASING.md`, `docs/enforce-mode.md`, `docs/licenses.md`, `docs/README.md`, `docs/roadmap.md`, `plugins/pro-quality/LICENSE` if its upstream line is missing.
- Manifests: pro-ship minor, pro-quality minor, pro-legal minor and pro-core patch, in both manifests and the marketplace entry, plus `metadata.version`, once, at integration.

## Order of work

Five builders run in parallel worktrees branched from this plan's commit, each committing on its own branch; the orchestrator merges the branches into `ship/build`, bumps the versions once and opens one PR.

1. Builder A, the record and the script: `docs/ship-preflight.md`, the fixtures, `ship.py` (all five subcommands), `pr-check.py marker` and `pr-body.md`, `tests/ship-preflight.mjs`, the `marker` case in `tests/ship-check.mjs` and the `preflight-contract` check in `tests/check.mjs`.
   Check: AC1 to AC6.
2. Builder B, the ship gate: `ship-gate.py`, its `hooks.json` entry and its cases in `tests/ship-hooks.mjs`, with its own copy of R31 and a comment naming `docs/ship-preflight.md`.
   Check: AC7, AC8, AC10.
3. Builder C, the legal reader: R19a in `release-gate.py` and its cases in `tests/legal-hooks.mjs`.
   Check: AC12a.
4. Builder D, the skill and the specialists: SKILL.md and its sidecars and references, the two pro-quality agents and their Codex twins, the routing case, the router, README, RELEASING.md, enforce-mode, licenses and the docs index.
   Check: AC11, AC14 to AC17, `claude plugin validate --strict` for pro-ship and pro-quality.
5. Builder E, after A merges into `ship/build`: the merge gate's R32 line and its cases in `tests/ship-hooks.mjs`.
   Check: AC9; every existing merge gate case passes unchanged.
6. Integration: merge A to E, bump versions, run "Proof of done", fill Done, open the PR and merge it when green.

## Tests that prove it

- `tests/ship-preflight.mjs`: AC1 to AC6 (targets per fixture tree and the Ship block, coverage with merge, squash, rebase, stale-marker and direct-push commits through a stubbed `gh`, the record for each verdict, the mieruka drop with an ignored and a tracked folder and every `check` cause).
- `tests/ship-hooks.mjs`: AC7 to AC10.
- `tests/legal-hooks.mjs`: AC12a.
- `tests/ship-check.mjs`: the `marker` subcommand.
- `tests/check.mjs`: `preflight-contract`, `names`, the version-bump law and Codex parity (AC12, AC17).
- `node tests/route-lexical.mjs`: AC11.
- By hand: AC13 in mieruka and one run here before a real tag.

## Risks

Most likely to go wrong: coverage (builder A).
Merge, squash and rebase merges map commits to PRs differently, and a force-push can drop the commit a marker names.
Anything it cannot map or prove is uncovered, so a mistake costs extra review and never skips one.

What it might break:

- The merge gate: its added line must never change a decision; any error in the read gives no line.
- pro-legal's gate: a forged or wrong record could skip a legal review; hygiene still runs and the record must name a legal review of the same range.
- Every starter repo warns on a release tag until `/ship` runs there, one line per commit per session.
- The warn-mode week: only the merge gate's script changes, so only its period restarts.

Nothing is irreversible.

## Options not taken

- One builder for everything: about 30 files across four plugins; parallel builders on fixed interfaces finish sooner.
- Five PRs: the parts only make sense together and each would need its own version bump of pro-ship.
- Extending `tests/ship-check.mjs` for `ship.py`: a separate file keeps the pr-check cases readable.
- A standalone `/webperf` command: roadmap item 18.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/ship-preflight.mjs && node tests/ship-hooks.mjs && node tests/legal-hooks.mjs && node tests/ship-check.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

## Done

- Build commit:
- Checks run:
- AC1 to AC17:
- Sign-off:

The sign-off moves the intent and the spec to `done` and ADR-0022 to `accepted`.

## Departures from plan

None yet.
