# Plan m3: key literals and delete outside

Built from `spec-m3.md` (written in the same commit) and `intent.md` in this folder.
Status: approved (pre-approved on 2026-11-07).
Approver: the maintainer, as the security lead for two guards that read credentials and deletions.
Dated: 2026-11-07.

One pull request, built in its own worktree off `origin/main` once m2 has merged.
It bumps pro-security from 0.3.1 to 0.4.0 and pro-core from 0.27.0 to 0.28.0 in both manifests and their marketplace entries.
`metadata.version` moves once, to the next minor at merge time.
Steps 1 to 3 (pro-security) and steps 4 to 6 (pro-core) touch separate files and can be built in parallel worktrees, then joined for step 7.

## Files that change

- `plugins/pro-security/scripts/key-literal.py` (new): PreToolUse and PostToolUse handling, the copied credential subset with a keep-in-step comment naming `incident.py`, `floor-guard.py` and `pr-check.py`, its own copy of the mode lookup and `warn.log` writer and an attribution footer for super-board.
- `plugins/pro-security/hooks/hooks.json` (modified): a PreToolUse and a PostToolUse entry, matcher `Edit|Write|MultiEdit`, timeout 5.
- `plugins/pro-security/LICENSE` (modified): the super-board upstream and its copyright line.
- `plugins/pro-security/.claude-plugin/plugin.json`, `plugins/pro-security/.codex-plugin/plugin.json` (modified): 0.3.1 to 0.4.0 and the description names the key-literal guard.
- `plugins/pro-core/scripts/delete-outside.py` (new): the guard, on `guardlib.py`, with an attribution footer.
- `plugins/pro-core/hooks/hooks.json` (modified): a PreToolUse Bash entry, timeout 5.
- `plugins/pro-core/LICENSE` (modified): the adapted file named.
- `plugins/pro-core/.claude-plugin/plugin.json`, `plugins/pro-core/.codex-plugin/plugin.json` (modified): 0.27.0 to 0.28.0 and the description names the delete-outside guard.
- `.claude-plugin/marketplace.json` (modified): both plugin versions and descriptions and `metadata.version`.
- `tests/guards.mjs` (modified): the key-literal and delete-outside cases.
- `docs/enforce-mode.md` (modified): `key-literal` and `delete-outside` rows.
- `docs/hook-loading.md` (modified): a "Registered by pro-security" section and a pro-core line.
- `docs/licenses.md` (modified): adapted rows for both scripts.
- `docs/roadmap.md` (modified): items 34 and 43 ticked with the PR.

## Order of work

1. Add failing key-literal cases to `tests/guards.mjs`, every fixture key assembled from parts at run time: a Write per R2 kind as `warn` and under `mode.key-literal` enforce as `block`; the AC2 allows; the AC2 `.env.example` finding and `.env.local` pass; the AC2a value-file writes passing, the `<your-key>` and `...` stand-ins passing and the `<code>`, JSX and ellipsis lines flagged; a MultiEdit with the key in its second edit; a PostToolUse on a fixture file with the key on line 7; the R19 no-leak assertion over stdout, stderr and `warn.log`; the global-mode case; malformed payloads (size S; R18, R19, AC1, AC2, AC2a, AC3, AC4, AC7, AC8)
2. Write `key-literal.py` PreToolUse: the R2 patterns, the R3 safe and stand-in filters (markup tags stripped from the token first, then stand-in `<` and `...` only inside it), the R4 skip of the uncommitted value files (templates still checked), text from Write, Edit and MultiEdit, the first five lines, own-key mode routing and messages that name kind, basename and lines (size M; R1 to R6, R8, R9, N1)
3. Add the PostToolUse path: read the one written file under 1 MB with no NUL byte, log `found-on-disk`, print the context message, never deny; register both entries in `plugins/pro-security/hooks/hooks.json` (size S; R1, R7)
   Checkpoint: `node tests/guards.mjs --only=key-literal` passes; `/usr/bin/python3 -m py_compile plugins/pro-security/scripts/key-literal.py` is clean; `claude plugin validate plugins/pro-security --strict` passes.
4. Add failing delete-outside cases, with `CLAUDE_PROJECT_DIR` and `cwd` set to a fixture folder and `HOME`, `TMPDIR` and `PRO_DEV_STATE_DIR` set per case: each AC5 command as `warn` and under `mode.delete-outside` enforce as `block`; each AC6 allow and the two AC6 findings; the global-mode case; malformed payloads (size S; R18, AC5 to AC8)
5. Write `delete-outside.py` on `guardlib.segments()`: operands of `rm`, `rmdir` and `unlink`, `find` starting paths when it deletes, the `git clean` directory, `cd` tracking, variable expansion with unknown words skipped, the inside test on normal and real paths, the exemptions and own-key mode routing with the R16 message (size M; R10 to R17, N1)
6. Register the hook in `plugins/pro-core/hooks/hooks.json` (size XS; R10)
   Checkpoint: `node tests/guards.mjs` all green; `node tests/git-safe.mjs` still green; `/usr/bin/python3 -m py_compile plugins/pro-core/scripts/delete-outside.py` is clean.
7. Docs and versions: the `key-literal` row (mode file `mode.key-literal`, blocker "the warn-mode week in two repos", accepted: the stand-in filter and that PostToolUse informs only) and the `delete-outside` row (mode file `mode.delete-outside`, accepted: unknown words are skipped, a double deny with `git-safe.py` on `rm -rf ~`, sibling worktrees are flagged), the `docs/hook-loading.md` lines, the `docs/licenses.md` rows, both `LICENSE` files, the footers, both bumps in both manifests and the marketplace with `metadata.version`, the roadmap ticks for 34 and 43 (size S; N2, AC9)
   Checkpoint: the proof of done below passes; the PR opens.

No step is irreversible.

## Tests that prove it

- `tests/guards.mjs` covers each credential kind before and after the write, the safe and stand-in lines, the value files and the templates, MultiEdit, the no-leak assertion, each delete form inside and outside the root, the exemptions, the guard folder as a finding, both modes and malformed payloads.
- `node tests/check.mjs` runs them through the `guards` check.
- A mutation run proves the cases bite: drop `ASIA` from the AWS pattern and the `ASIA` case fails; remove the `cd` tracking in `delete-outside.py` and `cd .. && rm -rf other` stops being a finding; restore both.

## Risks

Step 2 is the most likely to go wrong: a pattern or filter error either misses keys or warns on every edit of a doc that names a key prefix.
R2's 20-character floor and the stand-in filter address the second; the cases cover both directions.
Step 5 resolves paths from shell words without running them so a quoting or `cd` mistake could flag a delete inside the repo; it starts in warn and unknown words are skipped.
Damage reach: every Edit, Write and MultiEdit in repos with pro-security and every Bash call in repos with pro-core, bounded by fail-open and the warn start.

Stop-list categories: secrets, steps 1 to 3; the guard reads text that may hold a credential and the plan names it here as consent under the approver above.

## Options not taken

- A Bash matcher on the key-literal guard: overlaps `push-gate.py` and flags heredocs that quote a pattern.
- Blocking from PostToolUse: the file is already written.
- Two PRs: each half is small and the docs rows land together.

## Proof of done

```
node tests/guards.mjs                       # all cases pass, including key-literal and delete-outside
node tests/git-safe.mjs                     # unchanged, all pass
node tests/check.mjs                        # 0 failures
node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict           # Validation passed
claude plugin validate plugins/pro-security --strict
claude plugin validate plugins/pro-core --strict
/usr/bin/python3 -m py_compile plugins/pro-security/scripts/key-literal.py plugins/pro-core/scripts/delete-outside.py
# mutation: drop ASIA from the AWS pattern, run node tests/guards.mjs --only=key-literal, see the ASIA case fail, restore
```

## Done

Done as of 6c258a4e5e73.

- Build commit: 6c258a4e5e73 on `build/guard-hardening-m3`, [#194](https://github.com/jodybrewster/pro-dev-skillset/pull/194)
- Checks run: `node tests/guards.mjs` 118 cases, 0 failures; `node tests/git-safe.mjs` 148 cases, 0 failures; `node tests/security-hooks.mjs` 50 cases, 0 failures; `node tests/check.mjs` 49 checks, 0 failures, 13 warnings; `node tests/eval.mjs --dry` 99 cases reference real skills; `node tests/route-lexical.mjs --min-rank1 70` rank-1 80/98 (81.6%); `node --test tests/unit/*.test.mjs` pass 198, fail 0; `claude plugin validate . --strict` and for `plugins/pro-core` and `plugins/pro-security` all passed; `/usr/bin/python3 -m py_compile` (3.9.6) clean on both scripts.
- Mutations: dropping `ASIA` fails the two `aws-asia` cases; removing the `cd` tracking fails `cd-then-rm` (warn and enforce), `cd-absolute` and `pushd`. Both restored.
- Definition of done: met. A pr-check stamp was not run; the pr-gate warned and allowed the PR.
- Visual: none
- Doubt: none. A fresh-context security-architect review of the diff found 0 blocking and 2 should-fix items, both folded in (see Departures).
- AC1: all 14 kinds warn with the kind and line 3 and deny under `mode.key-literal` enforce.
- AC2: the env read, `AKIA` plus `EXAMPLE...` and the `example` line pass; `.env.example` is a finding; `.env.local` passes.
- AC2a: `.env.local`, `.env.development.local` and `.dev.vars` pass before and after the write; the `<x>`, `<your-key>` and `...` stand-ins pass; `<code>`, JSX and ellipsis-elsewhere lines are findings; `.dev.vars.example` is a finding.
- AC3: `post/line-7` names line 7 in both modes and never denies.
- AC4: `no-leak/full-length-key` passes and every key-literal case asserts the key is in no output or `warn.log` line.
- AC5: the six commands warn and deny under `mode.delete-outside` enforce, naming the resolved path and the root.
- AC6: the six allows pass with no line; `rm -rf /tmp` and the guard-folder mode file are findings.
- AC7: the global `mode` file leaves both guards in warn.
- AC8: malformed payloads exit 0 with no output for both scripts.
- AC9: the checks above pass.
- Sign-off:

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 2: R3 strips every markup tag from the key's word before it looks for `<`, but `<x>` and `<your-key>` match the same tag pattern, so the literal rule would strip the stand-in it is meant to catch. The guard treats a tag glued between two key characters (`KEY<x>KEY`) as a stand-in and strips only the tags around the key (`<code>KEY</code>`), then reads a `<` or `...` still in the word as a stand-in. The AC2a cases pin both directions.
- Step 2: an Edit's line numbers count within `new_string`, so its message reads `line 2 of the edit to config.ts`; a MultiEdit's reads `edit 2 line 1 of config.ts`.
- Steps 3 and 6: each plugin's version bump lands in the commit that first changes its content, as the version-bump law asks, not in step 7.
- Step 5: `guardlib.warn()` gains an optional `advice` argument so the warn message carries R16's way forward; `guardlib.py` was not in the file list. Existing callers are unchanged.
- Step 5: a variable the hook's environment does not hold is unknown and skipped like an assigned one, where super-board expands it to an empty string; a `cd -` makes later relative words unknown. A `find` that deletes with no starting path checks the current directory, `-ok` and `-okdir` count like `-exec`, `git clean -n` and `--dry-run` are not deletions and redirect targets (`2> /dev/null`) are not operands.
- Step 4: the delete-outside fixtures use a project root, `HOME` and `TMPDIR` under `/srv` that need not exist, because the guard only resolves words; a root under the system temp folder would make every sibling exempt on macOS.
- Review fix, R3: the environment-read skip is dropped. A line that only reads a key from the environment holds no key, so the skip hid only lines that also held one: `os.environ["KEY"] = "<key>"` and `process.env.KEY || "<key>"` passed even in enforce. Both are findings now and AC2's plain read still passes. The stand-in word filter stays.
- Review fix, R12: only `HOME`, `TMPDIR`, `PWD`, `USER`, `CLAUDE_PROJECT_DIR` and `PRO_DEV_STATE_DIR` are expanded. Any other variable makes the word unknown, because the resolved path goes into the message and `warn.log` and `rm -rf ../cache-$GITHUB_TOKEN` would have printed the token. A case plants a variable value and asserts it appears nowhere.
- Review fix, R13: inside and exempt are decided on the real path only (the parent resolved, the last part kept unless the word ends in `/`), with the root and the exemptions taken in both their written and real forms. A symlink in the repo that points out of it is now outside; deleting the link itself stays inside. The message names the real path.
- Review fix, R11 and R12: `pushd` is tracked like `cd` and a wrapper's flags are skipped (`sudo -u someone rm -rf ../z`).
- Review fix, N1: PreToolUse scans at most 1 MB of text and the first 20 matches per pattern on a line, so a 58 KB one-line write of key-shaped words beside `<` takes about 1 second, inside the 5 second timeout.

## Noticed but not touched

- A `cd` inside a subshell carries to the commands after it, since `guardlib.segments()` drops the parentheses: `(cd /tmp/a && make); rm -rf ../sibling` resolves under `/tmp` and passes. Tracking subshell depth in the tokenizer would be a small follow-up for both guards that track `cd`.
- `find ../y -name '*.o' | xargs rm` and `git --work-tree=../w clean -fd` pass; the spec does not list them and `xargs rm` would need the find's paths carried across the pipe.
- R4 skips a bare `.env`, but some templates (create-vite) ignore only `*.local` and commit `.env`; a key written there gets no warning.
- Single-quoted `'$HOME/x'` is expanded like `$HOME/x`, because `guardlib.segments()` does not mark single-quoted text the way super-board's tokenizer does; it can only make a word look outside, never hide one.
