# Plan: Codex as a second reviewer on high-risk PRs

Built from `spec.md` (draft, committed with this plan) and `intent.md` in this folder.
Status: approved.
Approver: the maintainer (approved 2026-10-30 in the batch; flagged concerns 3 and 9 decided as the spec recommends).
Dated: 2026-10-30.

The maintainer approves because the change sends diffs to a second vendor, adds a field to the gate's stamp contract and a new kind to the engine registry.
It does not suit auto mode: AC9 and AC10 need a real high-tier PR and a person reading the result.
The ADR ships in this PR as `docs/decisions/0018-codex-second-reviewer.md` (proposed) with its row in `docs/decisions/README.md`; the Done sign-off moves it to accepted.

Version readings on 2026-10-30, to be read again from `main` at build time: pro-ship 0.4.0, pro-core 0.20.0, pro-quality 0.15.0 and `metadata.version` 1.64.0.
The registry `version` in `plugins/pro-core/registry/engines.json` is 4.

Every builder step below runs from the repo root of its worktree.
Each step names its spec requirements in brackets.

## Files that change

In pro-ship:

- `plugins/pro-ship/scripts/codex-run.py` (new): the Codex runner [R1 to R8].
- `plugins/pro-ship/scripts/pr-check.py` (modified): `find` with a plugin-relative path, `codex-trigger`, `agree`, `stamp` with `reviewers.codex` and `compute_result` reading only `code` and `security` [R13, R14, R19, R20].
- `plugins/pro-ship/skills/pr-check/SKILL.md` (modified): the Codex run, the status mapping and the report line [R15 to R18].
- `plugins/pro-ship/skills/pr-check/pr-body.md` (modified): the `## Reviews` section [R21].
- `plugins/pro-ship/.claude-plugin/plugin.json` and `plugins/pro-ship/.codex-plugin/plugin.json` (modified): minor bump.

In pro-core:

- `plugins/pro-core/registry/engines.json` (modified): the `codex` row and `version` 4 to 5 [R9].
- `plugins/pro-core/scripts/pro-dev.py` (modified): the `manual-cli` kind [R11].
- `plugins/pro-core/commands/pro-dev.md` (modified): how `check` and `install` show a `manual-cli` row [R12].
- `plugins/pro-core/.claude-plugin/plugin.json` and `plugins/pro-core/.codex-plugin/plugin.json` (modified): minor bump.

In pro-quality:

- `plugins/pro-quality/agents/code-reviewer.md` and `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml` (modified): one location sentence, bodies kept identical [R23].
- `plugins/pro-quality/.claude-plugin/plugin.json` and `plugins/pro-quality/.codex-plugin/plugin.json` (modified): patch bump.

At the root:

- `tests/codex-run.mjs` (new): runner cases against a stub `codex` [R25].
- `tests/check.mjs` (modified): the `codex-run` check, the `manual-cli` rules in `registry`, the pro-core skip in `installers` and the new `agent-twins` check [R10, R24, R25].
- `tests/ship-check.mjs` (modified): cases for `find`, `codex-trigger`, `agree` and `stamp` [R13, R14, R19, R20].
- `tests/pro-dev.mjs` (modified): cases for the `manual-cli` kind [R11].
- `tests/fixtures/pr-check-stamp/valid-pass-codex.json` (new) and `tests/fixtures/pr-check-stamp/expect.json` (modified) [R22].
- `docs/pr-check-stamp.md` (modified): `reviewers.codex` [R22].
- `docs/decisions/0006-engine-registry-and-pro-dev.md` (modified): one amended line naming ADR-0018.
- `docs/decisions/0018-codex-second-reviewer.md` and `docs/decisions/README.md`: already written with the spec; no build change except the status at sign-off.
- `README.md` (modified): one sentence in the pro-ship paragraph (around line 286) naming the optional Codex second review.
- `docs/releases.md` (modified): rows for pro-ship, pro-core and pro-quality and the marketplace version line.
- `.claude-plugin/marketplace.json` (modified): the three entries and `metadata.version`.

Not changed: `plugins/pro-ship/scripts/pr-gate.py`, `plugins/pro-security/scripts/push-gate.py`, `plugins/pro-security/scripts/security_surface.py`, `plugins/pro-ship/scripts/merge-gate.py`, every `hooks/hooks.json` and everything under `plugins/pro-ai-sdlc/`.

## Order of work

Steps 1 and 2 (runner), 3 to 5 (pr-check.py), 8 to 11 (pro-core) and 12 (pro-quality) touch separate files and can run as parallel subagents in separate worktrees.
Steps 6 and 7 need steps 3 to 5.
Step 14 (versions) comes last so the numbers are read from `main` at build time.
Commit at each checkpoint with the step numbers in the message.

### The runner

1. Write `tests/codex-run.mjs` first and see it fail. [R25, AC2, AC3] (S)
   - Shape: follow `tests/ship-check.mjs`: an exported `runCodexRunCases()` returning `{ skipped, results: [{ id, expect, ok, reason }] }` and a `main` that prints each case and exits 1 on any failure when run directly.
   - Skip (return `skipped` with a reason) when `python3`, `git` or `/bin/sh` is missing.
   - Sandbox: a temp folder from `mkdtempSync`, `HOME` and `CODEX_HOME` inside it, `GIT_CONFIG_GLOBAL=/dev/null` and a git author set in env as in `ship-check.mjs`.
   - The stub: write `<sandbox>/bin/codex` as a `#!/bin/sh` script with mode 755.
     On `login status` it exits with `$STUB_LOGIN` (default 0) and prints "Logged in" or "Not logged in".
     On `exec` it appends each argument on its own line to `$STUB_LOG.argv`, copies stdin to `$STUB_LOG.stdin`, finds the value after `-o` and then acts on `$STUB_MODE`: `ok` writes `important: 1  nits: 0  pre-existing: 0  skipped: 0` and a finding line to that file and exits 0; `empty` writes nothing and exits 0; `fail` prints "boom" on stderr and exits 1; `sleep` runs `sleep 30`.
   - PATH: `<sandbox>/bin`, then the folders of `python3` and `git` (from `command -v`), then `/usr/bin:/bin`.
     Before the cases, assert that `command -v codex` under that PATH prints the stub path; if not, fail the run with "real codex shadows the stub".
     For the not-installed case use the same PATH without `<sandbox>/bin` and assert `command -v codex` prints nothing.
   - The repo: `git init` a temp repo, commit `.claude/pro-dev.json` holding `{"answers":{"codex":{"answer":"yes"}}}`, an instructions file `review.md` with frontmatter and a body and a prompt file `handoff.md` holding `range: aaa..bbb` and a unique marker string.
   - Cases, each one process of `python3 plugins/pro-ship/scripts/codex-run.py --instructions <repo>/review.md --prompt <repo>/handoff.md --cwd <repo>` unless it says otherwise:
     - `ok`: exit 0, stdout starts with the tally line, the argv log holds `exec`, `-s`, `read-only`, `--ephemeral`, `--color`, `never`, `-C` and `-o` and ends with `-`; the stdin log starts with `# Instructions` and holds the instructions body without its frontmatter, `# Handoff` and the marker; no argv line holds the marker; `git status --porcelain` in the repo is empty afterwards.
     - `toml`: instructions from a `.toml` with `developer_instructions = """..."""`; stdin holds that text; skip this one case with a warning when `python3 -c "import tomllib"` fails.
     - `agent`: `--agent rev` with `<repo>/.codex/agents/rev.toml` present resolves it; `--agent ../x` exits 2 with a line starting `could-not-run: usage:`.
     - `not-opted-in`: answer `no`, then no file, then `.claude/pro-dev.json` as a symlink; each exits 3 with `could-not-run: not-opted-in:` and the argv log stays empty.
     - `not-installed`: PATH without the stub, exit 3, `could-not-run: not-installed:`.
     - `not-logged-in`: `STUB_LOGIN=1`, exit 3, `could-not-run: not-logged-in:`, no `exec` in the argv log.
     - `timeout`: `STUB_MODE=sleep` and `--timeout 1`, exit 4, `could-not-run: timeout:`, finishes in under 10 seconds.
     - `fail`: `STUB_MODE=fail`, exit 4, `could-not-run: exit-1:`, stderr holds "boom".
     - `empty`: `STUB_MODE=empty`, exit 4, `could-not-run: empty-output:`.
     - `usage`: a missing prompt file exits 2 with `could-not-run: usage:`; `--timeout 0` exits 2.
     - `check`: `--check` prints `ready` and exits 0 with no `exec` in the argv log; with `STUB_LOGIN=1` it exits 3.
     - `copy`: copy the script to `<sandbox>/elsewhere/scripts/codex-run.py` and run the `ok` case from there with the same result (AC3).
     - `one line`: in every failure case stdout is exactly one line.
   - Add to `tests/check.mjs`: `import { runCodexRunCases } from "./codex-run.mjs";` and a check `checks["codex-run"]` shaped like `checks["ship-check"]` (warning on `skipped`, failure per failed case, failure when no cases ran).
   - Verify: `node tests/codex-run.mjs` fails because the script does not exist.
2. Write `plugins/pro-ship/scripts/codex-run.py` until the cases pass. [R1 to R8, N1, N3] (S)
   - Module docstring: usage, the exit codes and "Python 3 standard library only"; no plugin name anywhere in the file.
   - `argparse` with a mutually exclusive required group `--instructions` and `--agent`, required `--prompt`, `--cwd`, `--timeout` (int, default 540, 1 to 3600) and `--check`; on argparse error print `could-not-run: usage: <message>` and exit 2 (override `ArgumentParser.error`).
   - Instructions: `.toml` through `tomllib` (`ImportError` is a usage error naming Python 3.11), the `developer_instructions` string; `.md` the text after a leading `---` frontmatter block; other files as text; empty after strip is a usage error.
   - `--agent`: validate the name, then try `<cwd>/.codex/agents/<name>.toml` and `os.path.join(os.environ.get("CODEX_HOME") or os.path.join(os.path.expanduser("~"), ".codex"), "agents", f"{name}.toml")`.
   - `--cwd` default: `git rev-parse --show-toplevel` with a 15-second timeout, else `os.getcwd()`.
   - Consent: copy the logic of `answers_problem` and `read_answers` from `plugins/pro-core/scripts/pro-dev.py` (lstat on `.claude`, realpath check, `O_NOFOLLOW`, 64 KiB cap) and require `answers.codex.answer == "yes"`.
   - Binary: `shutil.which("codex")`; login: `subprocess.run([codex, "login", "status"], stdin=DEVNULL, capture_output=True, timeout=30)` with return code 0.
   - Run: `tempfile.mkdtemp()`, `-o <tmp>/last.txt`, `subprocess.Popen` with an argv list, `cwd=<cwd>`, `stdin=PIPE`, `stdout=PIPE`, `stderr=PIPE`, `start_new_session=True`; `communicate(input=<composed>, timeout=<timeout>)`; on `TimeoutExpired` kill the process group with `os.killpg(proc.pid, signal.SIGKILL)` as `kill_group` in `pr-check.py` does; install SIGTERM, SIGHUP and SIGINT handlers that raise `SystemExit` so the `finally` kills the group and removes the temp folder.
   - Output: exactly R6 and R7; stderr tail is the last five non-empty lines of Codex's stderr.
   - Verify: `node tests/codex-run.mjs` and `node tests/check.mjs codex-run` pass; `wc -l plugins/pro-ship/scripts/codex-run.py` is under 250; `grep -n "pro-ship\|pro-quality\|pro-core" plugins/pro-ship/scripts/codex-run.py` prints nothing.

Checkpoint A: commit steps 1 and 2 ("codex-run: runner and its stub tests").

### pr-check.py

3. Add the failing cases to `tests/ship-check.mjs`. [R13, R14, R19, R20, AC6] (S)
   - `find`: in a throwaway repo whose `.claude-plugin/marketplace.json` lists `pro-quality` and holds `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml`, `pr-check.py find pro-quality .codex-plugin/agents/code-reviewer.toml` prints that path; `find pro-quality ../x.toml` and `find pro-quality /etc/passwd` print `not-installed`; the bare form `find pro-quality floor-guard.py` keeps working.
   - `codex-trigger`: a table over setting (no `REVIEW.md` line, `always`, `high`, `never`, `CODEX-REVIEW: Never`, `sometimes`) by tier (`low`, `medium`, `high`, `unclassified`), checking `run`, `setting` and that `reason` is a non-empty string; `sometimes` reads as `high` and its reason names the unknown value.
   - `agree`: write two report files and check the lists:
     - a Claude bullet `- [correctness] src/a.py:10 - x` under `Important` and a Codex numbered item in the spike's layout (`1. `, a bold label `Correctness · Pass 1 · Important`, an em dash written as the escape `\u2014` in the JS string, then `` `src/a.py:12` `` and the claim) under `Important findings:` are `agreed`;
     - the same location rated `nit` on one side and Important on the other is `disputed`;
     - `src/a.py:10` against `src/a.py:30` gives one `code_only` and one `codex_only`;
     - `src/a.py:10-20` against `src/a.py:24` agree (window of five);
     - a line with no location is not a finding;
     - one Codex finding near two Claude findings pairs only once.
   - `stamp`: with the existing `GOOD_REV` plus `codex: {agent: "codex:code-reviewer", status: "could-not-run", reason: "timeout", blocking: 0, important: 3, agreed: 0, disputed: 0, range: null}` the result stays `pass` and `reviewers.codex` is written with all eight keys; `codex.blocking: 1` exits 1; `codex.status: "inline"` exits 1; `GOOD_REV` alone writes no `reviewers.codex`.
   - Verify: `node tests/ship-check.mjs` fails on the new cases only.
4. Implement `find` with a relative path and `codex-trigger` in `pr-check.py`. [R13, R14] (XS)
   - `find_sibling`: when `filename` contains `/`, refuse an absolute path, a `..` part or a backslash with `not-installed` and use `filename` as the plugin-relative path in place of `scripts/<filename>`.
   - `codex-trigger --tier T`: read `REVIEW.md` at the repo root, match `^\s*codex-review:\s*(\S+)\s*$` case-insensitive, apply R13 and print the JSON with `emit`.
   - Update the module docstring with both subcommands.
5. Implement `agree` and the `codex` stamp record in `pr-check.py`. [R19, R20] (S)
   - `NEAR = 5` as a module constant with a comment pointing to ADR-0018.
   - The parser: section headings match `^\s*#*\s*\**\s*(important|nits?|pre-existing)\b` case-insensitive; findings match `^\s*(?:-|\d+\.)\s` and the first location `` `?([A-Za-z0-9_./-]+):(\d+)(?:-(\d+))?`? ``; record `{severity, path, start, end, text}`.
   - Pairing: for each Claude finding in order take the first unpaired Codex finding with the same path and overlapping widened ranges.
   - Output: `{"code": [...], "codex": [...], "agreed": [[i, j]], "disputed": [[i, j]], "code_only": [i], "codex_only": [j], "counts": {"agreed": n, "disputed": n}}`.
   - `codex_record(raw)`: validate per R20 and refuse with `Refuse` messages in the style of `reviewer_record`.
   - `cmd_stamp`: when `revs` has `codex`, add `reviewers["codex"] = codex_record(...)`; change `compute_result` to read `reviewers["code"]` and `reviewers["security"]` only, in both the blocking test and the pass test.
   - Verify: `node tests/ship-check.mjs` and `node tests/check.mjs ship-check` pass.

Checkpoint B: commit steps 3 to 5 ("pr-check: codex-trigger, agree, find by path and reviewers.codex").

6. Update the stamp contract. [R22, AC7] (XS)
   - `docs/pr-check-stamp.md`: in the Fields table change `reviewers` to "the keys `code` and `security`, plus an optional `codex`"; add a "The codex reviewer" subsection with the R20 fields and values; say the result rule and both readers ignore it; leave "The validity rule" and "The push-gate acceptance rule" word for word.
   - `tests/fixtures/pr-check-stamp/valid-pass-codex.json`: a copy of `valid-pass.json` plus `reviewers.codex` `{agent: null, status: "could-not-run", reason: "timeout", blocking: 0, important: 2, agreed: 0, disputed: 0, range: null}`.
   - `tests/fixtures/pr-check-stamp/expect.json`: add `"valid-pass-codex.json": {"pr_gate": {"valid": true, "cause": null}, "push_gate": "accept"}`.
   - Verify: `node tests/check.mjs stamp-contract` passes and `git diff --stat main -- plugins/pro-ship/scripts/pr-gate.py plugins/pro-security/scripts` is empty.
7. Update the pr-check skill and the body template. [R15 to R18, R21] (S)
   - `SKILL.md`, in "Reviews" after "Handoff": a new "Codex second review" subsection.
     It runs `python3 "$CHECK" codex-trigger --tier <tier>`, writes the filled handoff to `.pro-dev/ship/handoff.md` when `run` is true, sets `CODEXRUN="${CLAUDE_PLUGIN_ROOT}/scripts/codex-run.py"` and `TWIN=$(python3 "$CHECK" find pro-quality .codex-plugin/agents/code-reviewer.toml)` and runs `python3 "$CODEXRUN" --instructions "$TWIN" --prompt .pro-dev/ship/handoff.md > .pro-dev/ship/review-codex.md`, recording the exit code.
     Say to start it in the same turn as the subagent dispatches, as a background shell command when the host offers one, with the host's longest command timeout.
     Say the handoff text is never put into a command line.
   - `SKILL.md`, in "Dispatch": save the code reviewer's report verbatim to `.pro-dev/ship/review-code.md`.
   - `SKILL.md`, in "Tally lines": the Codex report's first line is read with the same code reviewer pattern; then the R16 mapping as a list; then `python3 "$CHECK" agree --code .pro-dev/ship/review-code.md --codex .pro-dev/ship/review-codex.md` when Codex is `done`, taking `agreed` and `disputed` from `counts`; build the `codex` key of `--reviewers` per R20.
   - `SKILL.md`, in "Convergence": the Codex run gets the same `since <sha>` range.
   - `SKILL.md`, in the report example: the `codex` line from R17; and a sentence that a Codex finding never blocks and never makes the result incomplete.
   - `SKILL.md`, in "No script": "The Codex review is skipped: no script."
   - `pr-body.md`: a `## Reviews` section between Testing and Risk with the four groups of R21, the tag format `[Claude, <severity>]` or `[Codex, <severity>]` (or `[Claude, Codex]` for agreed), the one-line skip form and "Never say which side of a dispute is right."
   - Keep the prose harness-neutral (no `Task` or `TodoWrite`) for the `codex-parity` check.
   - Verify: `node tests/check.mjs` passes the `codex-parity`, `references` and `frontmatter` checks.

Checkpoint C: commit steps 6 and 7 ("pr-check: Codex second review in the skill, body and stamp contract").

### pro-core

8. Add the `codex` row, see the check fail, then teach the check. [R9, R10, AC4] (S)
   - In `plugins/pro-core/registry/engines.json` add after the last row: `{"id": "codex", "owner": "pro-core", "bridges": [], "kind": "manual-cli", "default": false, "detect": {"bin": "codex"}, "manual": ["npm install -g @openai/codex", "codex login"], "why": "The Codex CLI runs a second code review on high-tier PRs; yes also agrees to send the diff to OpenAI when it runs.", "note": "Detect-only (ADR-0018): pro-dev never installs, updates, logs in to or runs it. The review runner checks the login when it runs."}` and set `version` to 5.
   - Run `node tests/check.mjs registry installers` and see it fail on the kind, the missing argv and the pro-core installer.
   - In `checks.registry`: allow `manual-cli` in the kind list and its message; for that kind require `detect` to have exactly the key `bin` with a string matching `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`, `manual` to be a non-empty array of strings and no `install` or `update` key; skip the `install` and `update` argv test for it only.
   - In `checks.installers`: skip owner `pro-core` with a comment that `/pro-dev` is its installer (ADR-0018).
   - Verify: `node tests/check.mjs registry installers` passes; add `"install": ["x"]` to the row, see `registry` fail, remove it.
9. Add the failing `manual-cli` cases to `tests/pro-dev.mjs`. [R11, AC5] (S)
   - Follow the cases near line 171 that write a registry copy holding only chosen rows; use one row equal to the `codex` row of step 8.
   - Put a stub `codex` (a `#!/bin/sh` script that appends its argv to a log and exits 0) in a stub folder for the installed case; leave it out for the missing case.
   - Cases: status JSON shows `state` `installed` with the stub on PATH and `missing` without it, both with `kind` `manual-cli` and the `manual` list; `answer codex yes` then `run all install` with the binary missing prints a line starting `codex: install it yourself:` that holds both manual lines, exits 0 and leaves the stub log empty; `run all update` with the binary present prints `codex: update it yourself:` and exits 0; `run codex install` without an answer yes and with the binary missing prints the same install-it-yourself line (the row is the person's explicit ask).
   - Check every existing case still passes with the real registry, which now holds a pro-core row that asks a question; fix any case that counted rows by hand.
   - Verify: `node tests/pro-dev.mjs --only=manual` fails on the new cases.
10. Implement the `manual-cli` kind in `pro-dev.py`. [R11] (S)
    - `detected`: when `detect` has a string `bin`, return `shutil.which(det["bin"]) is not None`.
    - `engine_state`: when `row.get("kind") == "manual-cli"`, add `"manual": row.get("manual", [])` to the output.
    - `run_engine`: right after the `not-applicable` check, for `manual-cli` return `("skipped", ...)` with the R11 messages and never reach the marketplace, pin or argv code.
    - `cmd_run`: do not print `<id>: installing` for a `manual-cli` row.
    - `cmd_status` text output: under a `manual-cli` row that is missing, print `    install by hand: <lines joined by "; then ">`.
    - Update the module docstring's rules with one line for the kind.
    - Verify: `node tests/pro-dev.mjs` passes in full and `node tests/check.mjs` passes `pro-dev` and `registry`.
11. Update `plugins/pro-core/commands/pro-dev.md`. [R12, AC13] (XS)
    - In "1. check", Engines: a `manual-cli` row reads `installed` (on PATH; login is checked when a review runs), `missing` with its `manual` lines or `declined`; never run the CLI.
    - In "2. install", step 3: list a wanted `manual-cli` row as "install by hand" with its `manual` lines; when asking about `codex`, say the yes is consent to send diffs to OpenAI when a review runs.
    - Verify: `node tests/check.mjs` passes and `python3 plugins/pro-core/scripts/pro-dev.py status --json` shows the `codex` row with `kind` `manual-cli`.

Checkpoint D: commit steps 8 to 11 ("pro-core: manual-cli kind and the codex row").

### pro-quality and docs

12. Add the `agent-twins` check, then the location sentence. [R23, R24, AC8] (XS)
    - In `tests/check.mjs` add `checks["agent-twins"]`: read `plugins/pro-quality/agents/code-reviewer.md`, take the text after the closing frontmatter `---`, read `developer_instructions` from the `.toml` (the text between `developer_instructions = """` and the closing `"""`), trim both and fail with the first differing line number when they differ.
    - Run `node tests/check.mjs agent-twins` and see it pass on the current files.
    - Add to both files, in Findings after the first paragraph, the same sentence: "Write each finding as one list item that starts with `- ` and names its location as `path:line` or `path:start-end`."
    - Verify: `node tests/check.mjs agent-twins` passes; change one word in the `.toml`, see it fail, revert.
13. Docs. (XS)
    - `docs/decisions/0006-engine-registry-and-pro-dev.md`: under Status, add "Amended 2026-10-30 by ADR-0018: a detect-only `manual-cli` row has no install or update argv and a row owned by pro-core is installed through `/pro-dev`."
    - `README.md`, the pro-ship paragraph: after the sentence on `/pro-ship:pr-check`, add "On a high-tier PR it can also run Codex as an advisory second reviewer when the repo opted in through `/pro-dev install`."
    - Verify: `node tests/check.mjs references` passes.
14. Bump versions. [AC11, ADR-0002] (XS)
    - Read the current versions from `main`.
    - pro-ship: next minor (0.4.0 to 0.5.0 today); pro-core: next minor (0.20.0 to 0.21.0 today); pro-quality: next patch (0.15.0 to 0.15.1 today); each in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry.
    - `metadata.version`: next minor, once (1.64.0 to 1.65.0 today).
    - `docs/releases.md`: update each plugin's row (version, date, what shipped, "this PR") and the marketplace version line, per `RELEASING.md`.
    - Verify: `node tests/check.mjs versions codex-manifests` passes.

Checkpoint E: commit steps 12 to 14 ("codex-second-reviewer: twin check, docs and versions").

15. Run the proof of done, then the two live runs. [AC1, AC9, AC10] (S)
    - Run every command under "Proof of done" and paste the real output into Done.
    - AC9: in this repo, on the build branch (a high-tier change because it touches gate scripts), answer `codex` yes with `python3 plugins/pro-core/scripts/pro-dev.py answer codex yes`, run `/pro-ship:pr-check`, then paste the report line, `reviewers.codex` from the stamp and the Reviews section into the PR.
      Do not commit the answers file unless the maintainer says so.
    - AC10: run the same with `PATH` set so `codex` is not found for the runner and confirm the one skip line, the skip line in the body and an unchanged `result`.

## Tests that prove it

- `tests/codex-run.mjs` (run by the `codex-run` check) covers AC2 and AC3: argv, stdin layout, the prompt kept out of argv, every exit code, the one-line failure form, `--check`, `--agent` and a copied script.
- `tests/ship-check.mjs` covers AC6: `find` by path, the trigger table, agreement and the `codex` stamp record that never changes `result`.
- `node tests/check.mjs stamp-contract` with `valid-pass-codex.json` covers AC7.
- `tests/pro-dev.mjs` covers AC5: detection by PATH, the `manual` list and a run that executes nothing.
- `node tests/check.mjs registry installers` and the add-then-remove `install` edit cover AC4.
- `node tests/check.mjs agent-twins` and the one-word edit cover AC8.
- `node tests/check.mjs versions` covers AC11.
- The live runs in step 15 cover AC9 and AC10; the full proof of done covers AC1.
- `grep -n "pro-ship\|pro-quality\|pro-core" plugins/pro-ship/scripts/codex-run.py` printing nothing covers AC3.

## Risks

What might this break?
`compute_result` decides every stamp; reading named keys in place of `values()` is the one edit to it and the existing `s3*` cases in `tests/ship-check.mjs` guard it.
The registry gains a pro-core row that asks a question, so every `/pro-dev install` now asks about Codex once and `tests/pro-dev.mjs` cases that count questions or rows may need an update (step 9).
The registry `version` moves to 5, so the SessionStart nudge suggests `/pro-dev update` once in every repo; that is how a new row reaches people.
A changed `find` could break the floor-guard and security classifier lookups; the bare-name form keeps its code path and its existing cases.

Which step is the most likely to go wrong?
Step 5, the `agree` parser: report layouts vary between models and runs, so a finding can be missed or mis-sectioned.
The damage is limited to a wrong tag in the PR body, never a lost finding or a changed result, since both full reports stay in `.pro-dev/ship/`.
Step 2 is next: a process-group kill that misses a child would leave Codex running after a timeout; the `timeout` case checks the wall time.

What was left out on purpose?
Showing Codex findings in `merge-gate.py` (flagged concern 9), a per-person consent (flagged concern 3), the pro-ai-sdlc copy of the runner and its byte-identity check (doubt-driven-execute) and any Codex model or effort setting (Codex's own config decides).

Open flagged concerns 3 and 9 are the maintainer's call; the plan builds the recommended options.
Nothing here is irreversible: the stamp field is optional, the row is opt-in and the runner is new.

## Options not taken

- `codex exec review`: cannot carry the agent's lenses, the handoff or the tally line (spike).
- Instructions through `-c developer_instructions=...`: repo text in an argv.
- A shared runner in pro-core called by path: pro-ship and pro-ai-sdlc would depend on pro-core's install path.
- Consent checked only in pr-check: the doubt-driven caller would need its own copy.
- pro-ship as the row owner: pro-ai-sdlc users without pro-ship could not opt in.
- Agreement by exact range overlap: misses one bug cited a few lines apart.

## Proof of done

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
node tests/codex-run.mjs
node tests/ship-check.mjs
node tests/pro-dev.mjs
grep -n "pro-ship\|pro-quality\|pro-core" plugins/pro-ship/scripts/codex-run.py
git diff --stat main -- plugins/pro-ship/scripts/pr-gate.py plugins/pro-security/scripts
```

Finished means: `check.mjs` prints 0 failures with the warning count no higher than on `main` (the new checks add none), `eval.mjs --dry` and `route-lexical.mjs` print as in `CLAUDE.md`, the unit tests pass, `✔ Validation passed` prints once for the marketplace and once per plugin, the three behaviour files pass every case, the grep prints nothing and the last diff is empty.
AC9 and AC10 are pasted into the PR.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: 9afc3e1 (last code commit on `feat/codex-second-reviewer`; the plan edit that fills this section follows it).
- Checks run, from the worktree on 2026-10-30:
  - `node tests/check.mjs`: 35 checks, 0 failures, 12 warnings (the same 12 as the baseline before the first edit).
  - `node tests/eval.mjs --dry`: 88 cases reference real skills, 98 skills in catalog and 7 distractors.
  - `node tests/route-lexical.mjs --min-rank1 70`: rank-1 70/87 (80.5%), top-k 83/87, notOneOf failures 3, exit 0.
  - `node --test tests/unit/*.test.mjs`: pass 165, fail 0.
  - `claude plugin validate . --strict`: Validation passed.
  - The per-plugin strict loop: Validation passed for all 20 plugins.
  - `node tests/codex-run.mjs`: 25/25. `node tests/ship-check.mjs`: 170/170. `node tests/pro-dev.mjs`: 195 cases, 0 failures.
  - `grep -n "pro-ship\|pro-quality\|pro-core" plugins/pro-ship/scripts/codex-run.py`: no output. `git diff --stat origin/main -- plugins/pro-ship/scripts/pr-gate.py plugins/pro-security/scripts`: empty.
  - `wc -l plugins/pro-ship/scripts/codex-run.py`: 246 (after review round 2).
  - One live smoke run of `codex-run.py` against the real Codex with a tiny prompt in a scratch repo: stdout `ok`, exit 0, 10 seconds, no file written under the repo beyond the scratch files.
- AC1 to AC13:
  - AC1 pass. AC2 pass (`tests/codex-run.mjs`). AC3 pass (the grep prints nothing and case c12 runs a copy from another folder).
  - AC4 pass (`registry` check passes; adding `install` to the row failed it with "a manual-cli row must not have install" and removing it restored the pass).
  - AC5 pass (`manual/` cases in `tests/pro-dev.mjs`). AC6 pass (cases k1 to k4 in `tests/ship-check.mjs`).
  - AC7 pass (`stamp-contract` with `valid-pass-codex.json`; the gate and push-gate diff is empty).
  - AC8 pass (`agent-twins` passes; changing one word in the `.toml` failed it at body line 3 and the revert restored the pass; both files hold the location sentence).
  - AC9 pass in part: the runner ran the real Codex (0.166.0) on this PR's own diff (#99) with a local, uncommitted opt-in, exit 0 in 1 min 46 s, tally line `important: 1  nits: 0  pre-existing: 0  skipped: 2` first.
    Its one Important finding was real (bracketed route paths broke the location parser) and is fixed with tests k3h2 to k3h4.
    The full `/pro-ship:pr-check` flow with the stamp and the Reviews section was not run, because this repo has not opted in on main.
  - AC10 pass for the runner: with `--consent-ref origin/main` the real runner printed `could-not-run: not-opted-in: no .claude/pro-dev.json at origin/main` and exited 3, which pr-check records as `not-installed` and never as a clean review.
  - AC11 pass (`versions` and `codex-manifests` checks; pro-ship 0.5.0, pro-core 0.21.0, pro-quality 0.15.1, `metadata.version` 1.67.0 after rebasing onto #97 and #98, rows in `docs/releases.md`).
  - AC12 pass (ADR-0018 is proposed with its README row, ADR-0006 carries the amended line, `docs/pr-check-stamp.md` documents `reviewers.codex`).
  - AC13 pass with one note: the `codex` row shows `kind` `manual-cli` and the `manual` list, with `state` `not-applicable` here because pro-core is not installed for this repo; `pro-dev.md` names both `check` and `install` forms.
- Sign-off: pending, the maintainer's words and the date.

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0018 from `proposed` to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 1, test PATH: `python3` and `git` are symlinked into a folder of their own (`<sandbox>/tools`) in place of putting their own folders on PATH, so a real `codex` installed beside either cannot shadow the stub or break the not-installed case.
  The "stub shadows any real one" assertion still runs first.
- Step 2, `--check`: `--prompt` and `--instructions` or `--agent` are not required with `--check`, because the check runs R3 only.
- Step 2, `--check` and `--cwd`: `--cwd` is resolved with `realpath` before use.
- Step 3, test layout: the `find` cases run a copy of `pr-check.py` placed in a throwaway `plugins/pro-ship/scripts` folder, so the in-place sibling lookup does not find this repo's own `plugins/pro-quality`.
- Step 8, `registry` check: the `manual-cli` rules also reject a `detect` object with extra keys and an empty `manual` string.
- Step 11, AC13: in this worktree `pro-dev.py status --json` shows the `codex` row with `kind` `manual-cli` and a `manual` list but `state` `not-applicable`, because pro-core is not installed for this repo.
- Step 14, `docs/releases.md`: the table was behind (marketplace line 1.59.1, pro-ship 0.2.0, pro-core 0.20.0 dated 2026-10-28, pro-quality 0.12.0).
  The three rows and the marketplace line now carry the new versions.
  Each row says earlier releases were not listed.
- Commits: steps 12 and 13 are one commit and step 14 is a second, in place of the single Checkpoint E commit.

- Review round 1 fixes:
  A `manual-cli` row now asks for consent whenever it has no answer, also when its binary is already on PATH.
  `codex-run.py` prints exactly one `could-not-run:` line for a signal (`signal`) or an unexpected exception (`error`), installs its signal handler before preflight and writes the report as UTF-8 bytes.
  `codex-trigger` reads `codex-review:` from the base branch's `REVIEW.md` through `--base`, so a PR cannot turn off its own second look.
  A malformed `reviewers.codex` record is written as `could-not-run` with the reason `malformed codex record`; only a nonzero `blocking` is refused.
  `agree` skips items under Skipped and Ignored headings and normalizes `./` and absolute-under-repo paths.
  The stamp doc now says `important` is not checked against `status`, as the fixture shows.

- Review round 2 fixes:
  A line is a section heading in `agree` only when nothing but an optional "findings", a colon or emphasis follows the keyword, so `Ignored from the handoff: none` and the tally line no longer hide the items after them; with no heading the severity is read from an inline Important or nit word.
  `agree` refuses when either report file is missing or empty, and the pr-check SKILL says the Codex section then shows could-not-run.
  Consent comes from the base: `codex-run.py` takes an optional `--consent-ref REF` and reads the answer from `git show REF:.claude/pro-dev.json`, and the pr-check SKILL passes `--consent-ref <base>`.
  Without the flag it still reads the working tree, for the later pro-ai-sdlc copy on the person's own branch.
  This closes the first former follow-up (a PR adding its own opt-in).
  `codex-run.py` is trimmed to 246 lines.
  The `agent-twins` check also fails when the twinned body holds a backslash, because tomllib would process it as an escape.
- Live Codex finding: the AC9 run found that `LOC_RE` cut paths at `[` and `(`, so `app/users/[id]/page.tsx` and `app/orders/[id]/page.tsx` both read as `/page.tsx` and falsely agreed.
  The character class now takes brackets, parentheses, `@`, `+` and `~`, and `norm_path` drops an unpaired opening bracket from prose.

## Follow-ups

- For a pro-security follow-up: Codex loads the branch's `AGENTS.md` and `.codex/` config, so the branch under review can steer its own second reviewer.
