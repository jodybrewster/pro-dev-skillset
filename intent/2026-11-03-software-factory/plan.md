# Plan: a very simple software factory

Built from `spec.md` and `intent.md` in this folder; the background with path:line references is `design.md`, whose sections 3 and 9 this plan supersedes where they differ.
Status: approved.
Approver: the maintainer, who set the factory build as the goal for this work; this solo repo fills the lead and policy-owner roles with the same person; the security-architect challenge below ran before the build.
Dated: 2026-11-03.

## How it works in one breath

The session proposes, the runner decides.
`factory.py run` (on the host) picks an accepted level 1 intent, starts a Docker container with a fresh clone and a fresh plugin install; there it runs `claude -p "/pro-ai-sdlc:auto brief <dir>"`.
That session writes `spec.md` and `plan.md` and opens one pull request.
The runner checks the PR diff is exactly those two files with the expected lines and merges it.
A second container session runs `/pro-ai-sdlc:auto build <dir>`, which runs `/execute` and `/review` and leaves the build PR open.
The runner checks the build PR (CI green, `risk-classify.py` low with security surface available, tests unchanged since added, no test config, no `floor-allow:`, no policy paths) and merges with `--match-head-commit`.
Anything else raises the level, writes the record and stops.
Deploy is the person's.

## Interfaces every part builds against

`plugins/pro-ai-sdlc/scripts/factory.py`, Python standard library only, no model calls, every subprocess an argv list:

```
factory.py level <intent dir> [--repo DIR] [--json] [--write]
    Level = max(computed level, every value of `level:` in the default branch history of
    that intent.md, the file's current value). Policy (REVIEW.md) from the default branch
    tip (origin/<default>, else HEAD with no remote). Intent from the tip when tracked
    there, else the working tree. --write raises the file's level only.
    Prints "level: <n> (<reason>; <reason>)" or JSON
    {"level": n, "file_level": n|null, "history_max": n|null, "reasons": [..], "raised": bool}.
    Exit 0 unchanged, 3 raised, 2 could not run, 64 usage.
factory.py roles [--repo DIR] [--json]
    The canonical parser of the `## Roles` block (fenced yaml subset: `roles:` then
    five keys, each an inline list or `- item` lines; comments stripped; unknown keys
    are an error). Prints the map or exits 2. Mieruka calls this.
factory.py next [--repo DIR]
    Oldest intent on the default branch tip with status: accepted, level 1 by `level`,
    no spec.md, no record, folder matching ^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$ and
    whose accepting commit (the commit that introduced `status: accepted`) carries no
    `Factory-Run:` trailer. Prints the dir or nothing. Respects the daily caps.
factory.py run (<intent dir> | --next) [--repo DIR] [--max-cost-usd 8] [--model opus]
               [--image NAME] [--allow-broad-token] [--dry-run]
    Daily caps from .pro-dev/factory/daily.json (default 10 runs, $40; flags to set).
    Lock .pro-dev/factory/<folder>.lock. For each phase (brief, build):
      docker run --rm -e CLAUDE_GUARD_MODE=enforce -e ANTHROPIC_API_KEY -e GH_TOKEN=<token>
        <image> sh -c <fixed script in the image> with argv: repo URL, ref, phase, dir
      the in-container script clones, installs the plugins from the marketplace,
      runs: claude -p "/pro-ai-sdlc:auto <phase> <dir>" --model opus
        --permission-mode bypassPermissions --setting-sources user
        --max-budget-usd <remaining> --max-turns 200
        --disallowedTools WebFetch WebSearch "Bash(curl:*)" "Bash(wget:*)"
          "Bash(gh api:*)" "Bash(gh repo:*)" "Bash(gh secret:*)" "Bash(gh release:*)"
          "Bash(gh pr merge:*)" "Bash(git tag:*)" "Bash(claude:*)"
        --output-format stream-json --verbose
      and prints the PR number it opened as `factory: pr <n>`.
    Then the host verifies (below) and merges or stops. The token is FACTORY_GH_TOKEN;
    without it the run refuses unless --allow-broad-token (uses `gh auth token`, noted
    in the record). Records are written only by the runner.
factory.py record <intent dir> --state S [--reason TEXT] [--pr URL] [--cost USD] ...
    Writes the record through evidence.write_record.
factory.py verify brief|build <intent dir> --pr N [--repo DIR] [--json] [--checks-timeout-min N]
    The host-side checks on its own fetch of the PR head; exit 0 pass, 3 raise, 2 could not run.
```

Host checks:

| Phase | Check | Fail means |
|---|---|---|
| brief | diff is exactly `intent/<dir>/spec.md` and `plan.md`; plan has exactly one `Status:` line (`approved`), exactly one `Stop-list categories:` line (`none`) and exactly one `Approver:` line that starts with `factory`; the spec's `Flagged concerns` section says `None found` or is a table header with no data row (bullets or prose count as concerns) | raise to 2 |
| both | the PR is bound to the run: head branch is `<slug>-brief` (brief) or `<slug>` (build, the branch `/execute` creates), the author is the token's own user (`gh api user`), the brief PR is not a draft and every commit in the range carries `Factory-Run: <phase> <folder>` | raise to 3 (branch, author) or 2 (draft, trailer) |
| build | checks read from `gh pr view --json statusCheckRollup`; when the default branch tip has a workflow on `pull_request` or `pull_request_target`, wait up to the checks timeout (default 20 min) for checks to appear and finish, then all must pass; only when no such workflow exists run the repo's verify command in a fresh container on the verified sha | stop, level 2 |
| build | `risk-classify.py --base origin/<default> --head <fetched head> --intent <dir> --json` exit 0 and no `surface-unavailable` note | raise to the tier |
| build | no path under `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, `CONSTRAINTS.md`, `.claude/`, `.pro-dev/`, `.github/`, `intent/` outside its own folder | raise to 3 |
| build | each test file in the range unchanged after the commit that added it; no change to test config (`vite`, `vitest`, `jest` and `playwright` config files, `pytest.ini`, `tox.ini`, `[tool.pytest*]` in `pyproject.toml`, `[tool:pytest]` in `setup.cfg`, any `package.json` `scripts` key and its `jest` or `vitest` fields) | raise to 2 |
| build | pro-quality's `floor-guard.py --check --base <merge base>` run on the verified head in a throwaway worktree finds nothing | raise to 2 |
| build | no `floor-allow:` line in any commit message of the range | raise to 2 |
| both | the PR head equals the head fetched for the checks; a draft is marked ready by the host after its checks pass; merge with `--match-head-commit` | stop |
| run | the default branch on origin is the same before and after each session (`git ls-remote`); a move is state error `default branch moved during the session` | error, no merge |
| run | the default branch requires a pull request (ruleset `pull_request` rule or branch protection with required PR reviews) | refuse before the run |

Level rules (computed level = highest that applies):

| Rule | Level |
|---|---|
| no readable `## Roles` block, or `author:` not under `product_owner` or `engineer` | 2 |
| `source:` other than `idea` or `incident <id>` | 2 |
| `risk: medium`, or new-dependency words | 2 |
| `risk: high`, or stop-list words (auth, login, password, oauth, session, permission, migration, schema change, payment, billing, stripe, deploy, release, secret, token, credential, api key, environment variable, env var, `.env`, personal data, export) | 3 |
| otherwise | 1 |

Records: factory run record (`kind` doc, `artifact_kind` factory-run, `evidence_key` `factory-<folder>`), status info running, pass merged, partial stopped with the level raised, fail error; `detail_json` `level_at_intake`, `level_now`, `state` (queued, brief, build, verify, merged, stopped, error), `reason`, `brief_pr`, `build_pr`, `cost_usd`, `unread_lines`, `broad_token`, `started`, `updated`.
Summary of a merged run: `level 1: merged <sha>, deploy is yours, unread diff: <n> lines`.

`guard.py` reads `CLAUDE_GUARD_MODE` from the environment before any mode file.
`/execute` treats `Approver:` starting with `factory` as no consent for a stop-list step and writes `.claude/test-lock`; `protect-tests.py` flags edits to locked files (defense in depth; the host check is authoritative).

## Files that change

- `plugins/pro-ai-sdlc/scripts/factory.py` (new), `plugins/pro-ai-sdlc/factory/Dockerfile` and `factory/session.sh` (new): runner, image, in-container script.
- `plugins/pro-ai-sdlc/commands/auto.md` (new): `brief` and `build` phases.
- `plugins/pro-ai-sdlc/templates/intent.md`, `templates/REVIEW.md` (modified): `level:` and `## Roles`.
- `plugins/pro-ai-sdlc/commands/intent.md`, `spec.md`, `plan.md` (modified): `factory.py level --write`.
- `plugins/pro-ai-sdlc/commands/execute.md` (modified): test lock; factory approver is no consent.
- `plugins/pro-ai-sdlc/scripts/protect-tests.py`, `guard.py` (modified): test-lock marker; env mode.
- `plugins/pro-ship/scripts/risk-classify.py` (modified): `policy-files` signal (R19), mirrored in `skills/risk-tiers/SKILL.md`.
- `plugins/pro-core/commands/pro-dev.md` (modified): `/pro-dev install` fills `## Roles`; check prints it.
- `docs/loop-records.md`, `tests/mieruka-sync.mjs`: the factory run record.
- `tests/unit/factory-level.test.mjs`, `tests/factory.mjs`, `tests/sdlc-hooks.mjs`, `tests/ship-check.mjs` or the risk test: new cases.
- `tests/e2e-sdlc.mjs`, `tests/e2e-sdlc/` (new): e2e and shared checks.
- `docs/factory.md`, `docs/factory-demo.md`, `docs/README.md`, `docs/evals.md`, `docs/roadmap.md`.
- Manifests and marketplace entries for pro-ai-sdlc, pro-ship and pro-core.

## Order of work

1. pro-ai-sdlc 0.14.0: factory.py, image, `/auto`, templates, command hooks, test lock, guard env mode, record contract, tests (size L; R1 to R11, R13, R20, R21; AC1 to AC4).
   Checkpoint: `node tests/check.mjs`, `node --test tests/unit/*.test.mjs`, `node tests/factory.mjs`, `node tests/sdlc-hooks.mjs`.
2. pro-ship 0.12.0: the `policy-files` signal (size S; R19). In parallel with 1.
3. pro-core: `/pro-dev install` fills `## Roles` (size S; R5). In parallel with 1.
4. `tests/e2e-sdlc.mjs` (size L; R14, R15; AC5). Skeleton in parallel with 1; live runs after 1 to 3 merge.
5. Live proof: a demo repo with two level 1 intents run headless and one larger intent left for the maintainer to review (AC2, AC3).
6. Guide and demo docs (R16; AC7); ADR-0024 accepted at sign-off.
7. Mieruka: intent, spec, plan, build (R17, R18; AC6), then the twin and Chrome checks.

## Tests that prove it

- `tests/unit/factory-level.test.mjs`: each level rule; history max; tip not tree; folder regex; roles parser.
- `tests/factory.mjs`: `run` with a stub docker that prints `factory: pr <n>` and a stub gh; caps; lock; each host check passing and failing; the record states; `Factory-Run:` refusal.
- `tests/sdlc-hooks.mjs`: test lock warn and enforce; `CLAUDE_GUARD_MODE` beats the mode file.
- pro-ship risk test: `REVIEW.md`, `.claude/commands/x.md` and another intent's `intent.md` read high.
- `tests/e2e-sdlc.mjs` live.

## Risks

Step 1 is the riskiest: an unattended run merges to the default branch.
The merge needs every host check and the low tier; it is reversible with `git revert`; nothing deploys.
The session's token can push branches and open PRs on one repo; with `--allow-broad-token` it can reach more, which is why that flag is demo only.

Stop-list categories: secrets (steps 1, 4: a GitHub token and the API key enter a container), deploys (step 4 pushes a tag to a throwaway repo).

## Security challenge

The security-architect ran in challenge mode on the spec and design on 2026-11-03.
Its verdict: proceed with required changes; four blocking items.
Its output is kept verbatim in `security-challenge.md` beside this plan.

### How each item is met

| Item | Met by |
|---|---|
| Gates live in files the session can write | container on a fresh clone with its own plugin install; `CLAUDE_GUARD_MODE` from env; the host decides every merge |
| The model makes the merge decision and reports its own result | the session never merges (`gh pr merge` disallowed); host verify and merge; record from `gh pr view`, written by the runner |
| Markdown-only PRs rewrite policy at low | brief diff must be exactly spec and plan; build path denylist; `policy-files` high signal in risk-classify |
| The factory feeds itself | `Factory-Run:` trailer refused by `next`; daily run and dollar caps |
| Deny-once gates under enforce | not relied on; the host checks are the gate |
| Test lock bypasses | host check that each test file is unchanged after it was added and test config untouched |
| `/execute` trusts the brief plan as consent | `Approver: factory` is no consent; host checks `Stop-list categories: none` |
| PR comments feed the session | `/auto` does not run `/pr-babysit` and acts on no comment; failing checks stop at level 2 |
| pro-security missing | installed in the image; `surface-unavailable` stops |
| production-gate stands down | unchanged; no delegation |
| Only raised not enforced against history | history max in `level`; mieruka calls `factory.py` |
| Forged records | dedicated clone; runner writes records |
| Mieruka writes REVIEW.md | edits only the working tree behind a same-origin check; no effect until a person merges |
| Folder names reach a shell | regex and argv |
| Cost cap | `--max-budget-usd` plus daily cap |
| e2e token | host creates and deletes an explicit `sdlc-e2e-<stamp>`; scoped token or the demo flag |
| Mieruka identity self-asserted | ADR-0024 and spec: routing, not authorization; same-origin checks |
| Open: exit 2 | no run |
| Open: canonical parser | `factory.py roles` |
| Open: names or logins | git names for solo; logins for teams later (ADR-0024) |
| Open: unread diff | the record says `unread diff: <n> lines` |

Accepted with reason: deny-once gates stay deny-once for interactive sessions; the factory does not rely on them.

## Options not taken

- Separate PRs for the runner and the commands: both edit `factory.py` and the same version.
- Hardening every gate's deny-once for headless use: four plugins changed for a check the host already does.
- A GitHub App identity: right for teams, too much setup for a solo demo; the scoped token is the step toward it.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/factory.mjs && node tests/sdlc-hooks.mjs
claude plugin validate . --strict
node tests/e2e-sdlc.mjs --scenario 1,2,3 --allow-broad-token
```

## Done

Filled in when the build is finished.

## Departures from plan

- Plugins install at user scope in the container, with `--setting-sources user`, so the clone stays clean and the repo's own settings are ignored.
- `run` and `roles` take extra flags: `--marketplace-ref`, `--timeout-min`, `--worktree` (roles), `--allow-unprotected` and `--checks-timeout-min` (also on `verify`).
- Only the security surface note stops a build (`surface-unavailable: security_surface`); other `surface-unavailable` notes do not.
- Review fixes, as one commit:
  - The container token cannot move the default branch: the host records the origin sha before each session and stops with state error when it moved; it refuses to run unless the default branch requires a pull request (`--allow-unprotected` is demo only and the record notes `unprotected: true`); `session.sh` writes `enforce` into the container's own `~/.claude/hooks/mode` so every plugin's gates run in enforce.
  - "No checks reported" is no longer "no CI": no CI is decided from the tip's workflows. With workflows the host waits for checks to appear and finish (a timeout is a stop). Checks come from `statusCheckRollup` because the host's gh 2.21 has no `pr checks --json`.
  - The PR is bound to the run (branch, author, trailers). `session.sh` finds the PR by the expected head branch and has no newest-PR fallback. `/execute` opens the build PR as a draft, so a draft build PR is accepted and the host marks it ready right before the merge.
  - The brief checks are strict (one line each, `Flagged concerns` rules) and the test-config list is wider.
  - `floor-guard.py --check` runs on the build range on the host (the CLI exists; no new check was added).
  - Each container is named `factory-<folder>-<phase>-<epoch>` and killed on timeout; a phase with no result event counts its whole budget in `daily.json`.
  - The verify container checks out the sha the host verified (`FACTORY_HEAD`); saved logs redact the API key as well as the token; the image is tagged `pro-dev-factory:<plugin version>` and built when the tag is missing; `--max-runs` and `--max-daily-usd` apply before the cap check.
  - `run <dir>` resumes a folder whose record has an open build PR: no new session, the host checks and the merge only, no new run counted.
  - `commands/auto.md` allows `.claude/test-lock` (written by `/execute`, git-excluded) and nothing else under `.claude/`.
