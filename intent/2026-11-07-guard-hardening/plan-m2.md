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

Done as of c647481f3fa0

- Build commit: c647481f3fa0 on `build/guard-hardening-m2` over `origin/main` at 3af9bdd, with the three review rounds of #193, PR [#193](https://github.com/jodybrewster/pro-dev-skillset/pull/193).
- Checks run: `node tests/guards.mjs` 326 cases (9 mode, 65 key-literal, 54 delete-outside, 180 secret-read, 18 env-check), 0 failures; `node tests/git-safe.mjs` 148 cases (83 must block, 36 must warn, 29 must pass), 0 failures; `node tests/check.mjs` 50 checks, 0 failures, 13 warnings; `node tests/eval.mjs --dry` 99 cases reference real skills; `node tests/route-lexical.mjs --min-rank1 70` rank-1 80/98 (81.6%); `node --test tests/unit/*.test.mjs` pass 200, fail 0; `claude plugin validate . --strict` and `plugins/pro-core --strict` each Validation passed; `/usr/bin/python3 -m py_compile` (3.9.6) on `secret-read.py`, `env-check.py` and `guardlib.py` clean; a Bash call with no secret name takes about 40 ms with interpreter start.
- Mutations: with `.npmrc` out of `secret_kind()`, `--only=npmrc` shows 7 failures of 9; with the pattern-word skip dropped, `sr-bash-allow/grep-pattern-names-env` and `sr-bash-allow/rg-pattern-names-env` fail; with the mode lookup reading the global `mode` file, all 4 `sr-global-mode` cases fail; with a glob in the folder part turning the check off again, `--only=folder` shows 5 failures of 7; with no brace expansion cap, 3 of the 4 `sr-brace-bomb` cases run past their 3 second budget (the fourth holds no secret hint so it is never parsed); with a shell counted only in the first stage of a heredoc line, `heredoc-piped-to-bash` and `heredoc-after-cd-bash` fail; with the first brace group ending expansion again, `brace-after-var` and `xargs-brace-after-placeholder` fail. All seven restored and green.
- Hand proof: a temp `.env` holding a random value, then Read, `cat .env` and Grep path `.env` in warn, `head -1 .env` under `mode.secret-read` enforce and `env-check.py OPENAI_API_KEY EMPTY NOPE` (`present`, `empty`, `missing`, exit 1); `grep -c` of the value in the hook output, warn.log and the env-check output gave 0 each.
- Definition of done: (pro-ai-sdlc references/definition-of-done.md; a repo's CONSTRAINTS.md or REVIEW.md wins where it says more) tests written first and seen failing (140 of 149 failed with neither script on disk, the 9 mode cases passing), laws checked by `tests/check.mjs`, attribution footers on both scripts, the pro-core `LICENSE` and the `docs/licenses.md` row extended.
- Visual: none
- Doubt: none; no step is hard to undo and the guard starts in warn.
- AC1: `sr-read/*` 14 kinds exit 0 with a `secret-read` `would-deny` line, for example `[secret-read] warn mode: would deny reading a dotenv file (.env) (logged to warn.log, allowed)`.
- AC2: `sr-read-allow/*` 10 names, among them `.env.example`, `.env.sample`, `id_ed25519.pub` and `src/env.ts`, exit 0 with no line.
- AC3: the six AC3 reads warn (`sr-bash/cat-env`, `head-env-local`, `grep-key-env`, `sed-npmrc`, `redirect-spaced`, `xargs-cat`); `grep -r ".env" src/`, `cp .env.example .env`, `source .env` and `ls -la .env` pass.
- AC4: `sr-grep/path-env` and `sr-grep/glob-env-star` warn; `sr-grep-allow/glob-ts` and `glob-json` pass.
- AC4a: `cat *`, `cat ~/.ssh/id_*.pub`, `src/auth/credentials.ts` and `scripts/id_helpers.py` pass; `cat ~/.ssh/id_*`, `cat certs/*.pem`, `head *.pem`, Grep `glob: "id_*"` and `config/credentials.yml` warn. Review cases: `cat apps/*/.env`, `cat */.env.local`, `cat {.env,.env.local}`, Grep `glob: "**/.env"` and `"{.env,.env.local}"`, `grep -rn KEY --include='.env*' .` and `echo "$(cat .env)"` warn; `cat apps/*/README.md`, `grep -A 3 .env src/` and a heredoc doc line naming `cat .env` pass. Round 2: `cat apps/{web/.env,api/.env}`, `cat {README.md,apps/.env}`, `cat <<'EOF' | bash`, `cd app && bash <<'EOF'`, `FOO=1 bash <<'EOF'` and `sudo sh <<EOF` bodies naming `cat .env` and a `"$(cat .env)"` after a quoted heredoc holding an apostrophe warn; five brace groups of thirty options return within the 3 second budget. Round 3: `cat ${APP_DIR}/.env{,.local}`, `xargs -I{} cat {}/.env{,.local}`, `cat {.env,a1,...,a70}`, `sudo -u deploy cat /srv/app/.env`, `nice -n 10 cat .env`, `env -u FOO cat .env` and a `cat .env` body under `cat <<'EOF' | sudo -u deploy bash` warn.
- AC5: `sr-enforce/*` 16 findings print `permissionDecision: deny` with a `deny` line; `sr-global-mode/*` 4 cases stay in warn.
- AC6: `env-check/set-empty-missing` prints the three lines and exits 1; `env-check/bad-key-exit-64` exits 64; the sentinel is absent from stdout and stderr in all 18 env-check cases.
- AC7: `sr-bash/env-check-plain` passes; `sr-bash/env-check-piped-to-cat-env` warns.
- AC8: `sr-malformed/*` 9 payloads exit 0 with no output.
- AC9: see Checks run.
- Sign-off: pending, the maintainer on the PR.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 5: R13 wants the way forward in the warn message too and the m1 helper printed only the summary. m3 (#194) merged first with an optional `advice` argument on `guardlib.warn()` that joins the advice after the summary with ". "; this change uses it and adds nothing to `guardlib.py`.
- Step 5: only the pattern-first commands (`sed`, `grep`, `egrep`, `fgrep`, `rg`) read `-e`, `-f`, `--regexp`, `--file` and `--expression` as the pattern option; on `cat -e .env` or `tail -f .env` the flag takes no word and the file is still a finding. Leading `VAR=value` words and `command`, `exec`, `nohup` and `time` are skipped before the command name.
- Step 2: `env-check.py` also reads `KEY = value` with blanks around `=`, counts `KEY= # note` as empty as dotenv does and exits 64 on an unknown option, as the super-board script does.
- Step 1: the env-check case ids start with `env-check/` so the step 2 checkpoint `--only=env-check` selects them (it also selects the `sr-bash/env-check-*` cases).
- Step 7: `docs/licenses.md` extends the existing pro-core super-board row with the two files and their upstream files in place of two new rows, since that row already lists files from the same upstream.
- Review of #193: the last path component decides on its own, so a glob in a folder part (`cat apps/*/.env`, Grep `glob: "**/.env"`) no longer turns the check off; R2 applies when the last component is concrete and R3 when it holds a glob. Brace alternatives (`{.env,.env.local}`, `.env{,.local}`) are expanded and each is judged as a last component, in place of adding `{` and `}` to the glob characters.
- Review of #193: for the pattern-first commands, the values of `--include`, `-g` and `--glob` (with `=` or spaced) are file words judged like any other and never the pattern; `-A`, `-B`, `-C`, `-m`, `--max-count`, `--exclude`, `--exclude-dir`, `-t`, `--type` and `--type-not` consume their value. `-T` is left out because it takes no value in grep.
- Review of #193: the text of each `$(...)` and backtick substitution outside single quotes runs through the same Bash check, so `echo "$(cat .env)"` and `` echo `cat .env` `` are findings.
- Review of #193: heredoc body lines between a `<<WORD`, `<<'WORD'` or `<<-WORD` marker and its terminator are skipped, so a doc line that names `cat .env` is not a finding. A heredoc fed to a shell (`bash <<EOF`) keeps its body, since the shell runs it, and a herestring `<<<` is not a heredoc marker.
- Review round 2 of #193: brace expansion counts as it goes and stops at 64 words with at most 64 pending, so five groups of thirty options return at once; brace lists are expanded on the whole word before the basename is taken, so `cat apps/{web/.env,api/.env}` and `cat {README.md,apps/.env}` are findings.
- Review round 2 of #193: a heredoc body is kept whenever any stage of its line runs a shell once `VAR=value`, `sudo`, `env`, `nice`, `nohup`, `time`, `command` and `exec` (with their flags) are skipped, so `cat <<'EOF' | bash`, `cd app && bash <<'EOF'`, `FOO=1 bash <<'EOF'` and `sudo sh <<EOF` have their bodies checked. The same prefix list now applies before a reader command.
- Review round 2 of #193: substitutions are read from the raw command and from the command with heredoc bodies dropped, so an apostrophe in a quoted heredoc body cannot hide a later `"$(cat .env)"`.
- Review round 3 of #193: a brace group with no comma (`${APP_DIR}`, the xargs `{}`) no longer ends expansion, so `cat ${APP_DIR}/.env{,.local}` and `xargs -I{} cat {}/.env{,.local}` are findings; when the cap is reached the first alternatives are kept, so `cat {.env,a1,...,a70}` is a finding.
- Review round 3 of #193: runner flags that take a value consume it (`sudo -u`, `-g`, `-h`, `-p`, `-C`, `-D`, `-r`, `-t`, `-U`, `-T` and their long forms, `env -u`, `-C`, `-S`, `nice -n`, `time -o`, `-f`), so `sudo -u deploy cat /srv/app/.env`, `nice -n 10 cat .env`, `env -u FOO cat .env` and the body of `cat <<'EOF' | sudo -u deploy bash` are findings.
- Versions: #191, #194 and #192 merged first and took pro-core 0.27.0 and 0.28.0 and `metadata.version` up to 1.97.0, so this change bumps pro-core 0.28.0 to 0.29.0 and `metadata.version` 1.97.0 to 1.98.0; the `secret-read` row in `docs/enforce-mode.md` counts from 0.29.0.

## Noticed but not touched

- `.dev.vars.example` is a finding: R2 exempts only the three dotenv templates. A Cloudflare repo that checks in `.dev.vars.example` would warn on reading it.
- A quoted string holding `<.env`, such as `echo 'a<.env'`, reads as an input redirect after tokenizing and warns; the tokenizer drops the quotes before the redirect check.
- Substitutions are read from the whole command before heredoc bodies are dropped, so a quoted heredoc (`<<'EOF'`) whose body holds a literal `$(cat .env)` still warns.
- A user-level env guard on this machine also warned on a fixture write into a temp `.env` during the hand proof, the double message the spec accepts in concern 5.
- A `#` comment that holds an apostrophe puts the shared tokenizer (`_chunks` here and `guardlib.segments`) into single-quote state for the rest of the command, so a later read can pass unflagged. A shared fix belongs in `guardlib` and touches every pro-core guard.
