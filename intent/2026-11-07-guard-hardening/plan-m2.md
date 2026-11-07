# Plan m2: secret read

Built from `spec-m2.md` (written in the same commit) and `intent.md` in this folder.
Status: approved (pre-approved on 2026-11-07).
Approver: the maintainer, as the security lead for a guard on secret files.
Dated: 2026-11-07.

One pull request, built in its own worktree off `origin/main` once m1 has merged.
It bumps pro-core from 0.26.0 to 0.27.0 in both manifests and its marketplace entry.
`metadata.version` moves once, to the next minor at merge time.

## Files that change

- `plugins/pro-core/scripts/secret-read.py` (new): the guard, on `guardlib.py`, with an attribution footer for super-board.
- `plugins/pro-core/scripts/env-check.py` (new): prints `present`, `empty` or `missing` per key, with an attribution footer.
- `plugins/pro-core/hooks/hooks.json` (modified): a PreToolUse entry, matcher `Read|Grep|Bash`, timeout 5.
- `plugins/pro-core/LICENSE` (modified): the two adapted files named.
- `plugins/pro-core/.claude-plugin/plugin.json`, `plugins/pro-core/.codex-plugin/plugin.json` (modified): 0.26.0 to 0.27.0 and the description names the secret-read guard and `env-check.py`.
- `.claude-plugin/marketplace.json` (modified): the pro-core version and description and `metadata.version`.
- `tests/guards.mjs` (modified): the secret-read and env-check cases.
- `docs/enforce-mode.md` (modified): a `secret-read` row with its accepted limits.
- `docs/hook-loading.md` (modified): a "Registered by pro-core" line for `secret-read.py`.
- `docs/licenses.md` (modified): adapted rows for `secret-read.py` and `env-check.py`.
- `docs/roadmap.md` (modified): item 33 ticked with the PR.

## Order of work

1. Add failing `env-check.py` cases to `tests/guards.mjs`: a fixture dotenv with `SET=<sentinel>`, `EMPTY=` and `export QUOTED="<sentinel>"`, a commented `# MISSING=x`; assert each line of output, the exit codes 0, 1 and 64 and that the sentinel is absent from stdout and stderr in every case, including an unreadable `--file` (size S; R15 to R19, AC6)
2. Write `env-check.py` (size S; R15 to R19)
   Checkpoint: `node tests/guards.mjs --only=env-check` passes; `/usr/bin/python3 -m py_compile plugins/pro-core/scripts/env-check.py` is clean.
3. Add failing `secret-read` cases: each AC1 Read as `warn`, each AC2 Read as `allow`, the AC3 Bash commands both ways, the AC4 and AC4a payloads (`*.json`, `cat *`, `credentials.ts` passing; `id_*`, `*.pem` and `cat ~/.ssh/id_*` flagged), the AC5 enforce and global-mode cases, the AC7 env-check calls and the AC8 malformed payloads (size S; R20, AC1 to AC5, AC4a, AC7, AC8)
4. Write `secret-read.py`: `is_secret()` for the R2 kinds, `glob_is_secret()` for R3, then Read and Grep (size S; R2 to R5, R14)
5. Add the Bash rules on `guardlib.segments()`: reader commands with the pattern-word exception, input redirects, `xargs` pipelines, the plain `env-check.py` call and `source`; then the mode routing and messages with the absolute `env-check.py` path (size M; R6 to R13, N1, N2)
   Checkpoint: `node tests/guards.mjs` all green; `node tests/git-safe.mjs` still green; `/usr/bin/python3 -m py_compile plugins/pro-core/scripts/secret-read.py` is clean.
6. Register the hook in `plugins/pro-core/hooks/hooks.json` (size XS; R1)
7. Docs and versions: the `secret-read` row (mode file `mode.secret-read`, blocker "the warn-mode week in two repos", accepted: recursive grep and broad globs, `source`, a user-level env guard), the `docs/hook-loading.md` line, the `docs/licenses.md` rows, `plugins/pro-core/LICENSE`, the footers, the pro-core bump in both manifests and the marketplace with `metadata.version`, the roadmap tick for 33 (size S; N3, AC9)
   Checkpoint: the proof of done below passes; the PR opens.

No step is irreversible.
Steps 1 and 2 and steps 3 to 5 touch separate scripts and could run in parallel worktrees.

## Tests that prove it

- `tests/guards.mjs` covers every R2 kind on Read, the allows (`.env.example`, `.pub`, `credentials.ts`, `*.json`, `cat *`), the secret globs (`id_*`, `*.pem`), the Bash readers and their non-reading neighbors, Grep path and glob, both modes, the plain env-check call and malformed payloads.
- The env-check cases assert the sentinel never reaches stdout or stderr.
- `node tests/check.mjs` runs both through the `guards` check.
- A mutation run proves the cases bite: remove `.npmrc` from `is_secret()` and the `.npmrc` cases fail; drop the pattern-word skip for `grep` and `grep -r ".env" src/` turns into a finding; restore both.

## Risks

Step 5 is the most likely to go wrong: a Bash rule that is too broad would warn on everyday commands that only name `.env`, such as `cp .env.example .env` or `git check-ignore .env`.
The non-reading neighbors in AC3 are cases for that and the guard starts in warn so the cost of a miss is a log line.
A rule that is too narrow lets a read through, which is today's state.
Damage reach: every Read, Grep and Bash call in every repo with pro-core, bounded by fail-open.

Stop-list categories: secrets, steps 1 to 5; the guard and the helper read the names of secret files and `env-check.py` reads one so the plan names it here as consent under the approver above.

## Options not taken

- Deny any mention of a secret name: flags commands that read nothing.
- A shell `env-check`: Python is the runtime every install already has.
- Add the rules to `git-safe.py`: it would need Read and Grep matchers and a second mode key in one script.

## Proof of done

```
node tests/guards.mjs                       # all cases pass, including secret-read and env-check
node tests/git-safe.mjs                     # unchanged, all pass
node tests/check.mjs                        # 0 failures
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict           # Validation passed
claude plugin validate plugins/pro-core --strict
/usr/bin/python3 -m py_compile plugins/pro-core/scripts/secret-read.py plugins/pro-core/scripts/env-check.py
# mutation: remove .npmrc from is_secret(), run node tests/guards.mjs --only=npmrc, see it fail, restore
```

## Done

Filled in when the build is finished, before sign-off.

- Build commit:
- Checks run:
- Definition of done: (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more)
- Visual: none
- Doubt:
- AC1:
- AC2:
- AC3:
- AC4:
- AC5:
- AC6:
- AC7:
- AC8:
- AC9:
- Sign-off:

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

## Noticed but not touched
