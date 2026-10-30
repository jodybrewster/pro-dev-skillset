---
name: pr-check
description: Use before opening a pull request, or when asked to "check this", "is this ready for a PR" or "pre-PR check" - runs the repo's own build, lint, typecheck and test commands, the floor guard and a mutation check, dispatches a fresh-context code review (and a security review when the diff touches security surface), writes a stamp bound to HEAD that the PR gate reads and drafts the PR body. Not a replacement for reviewing a diff on request (requesting-code-review) or for merging (merge-pr).
---

# pr-check

Run this on a committed branch before `gh pr create`.
It writes `.pro-dev/ship/pr-check.json` for HEAD and a PR body draft at `.pro-dev/ship/pr-body.md`.
It never opens the PR.
The stamp contract is `docs/pr-check-stamp.md` in the marketplace repo.

Run it before the first push too.
The push gate then reuses the security review in the stamp and does not ask for a second one.

## Setup

Set `CHECK` to this plugin's own script.
`pr-check.py find` is for sibling plugins' files, not for finding pr-check itself:

```bash
CHECK="${CLAUDE_PLUGIN_ROOT}/scripts/pr-check.py"
```

If `${CLAUDE_PLUGIN_ROOT}` is empty or not substituted, or the file does not exist, go to "No script" below.
Every subcommand prints JSON and is run from the repo root.

1. Refuse on a dirty tree.
   `git status --porcelain --untracked-files=no` must be empty.
   If it is not, say "commit first, the stamp is bound to a commit" and stop.
2. Find the base: `git merge-base origin/main HEAD` (use the default branch the repo has).
   Record base and head shas with `git rev-parse`.
3. Check the required documents (ADR-0020).
   Find pro-quality's script the way the floor guard is found:

   ```bash
   DOCS=$(python3 "$CHECK" find pro-quality required-docs.py)
   ```

   When `find` reports `not-installed`, print `documents   not-installed` and say the required-documents check did not run.
   Never read that as none missing.
   Otherwise run `python3 "$DOCS" --json --policy-ref <base>` from the repo root, so a PR cannot loosen its own set.
   Exit 0 prints `documents   pass`.
   Exit 3 prints `documents   missing <n>` and one `Should-fix: <doc> (<rule>)` line for each entry in `missing`.
   Exit 2 prints `documents   could-not-run <reason>` and never reads as none missing.
   When `REVIEW.md` is among the missing documents, point to `/pro-dev install`.
   A missing document is Should-fix.
   It never changes `result`, never stops the run and never blocks.

## Classify

Run the risk classifier before any check, so every later step sees the tier.
It sits next to this script:

```bash
RISK="${CLAUDE_PLUGIN_ROOT}/scripts/risk-classify.py"
python3 "$RISK" --json --base <base> > .pro-dev/ship/risk.json
```

Make `.pro-dev/ship/` first when it does not exist.
Read the exit code and the JSON together:

- Exit 0, 3 or 4 means low, medium or high.
  The JSON holds `tier`, `signals`, `declared`, `findings`, `tie`, `architecture` and `demands`.
- Exit 2 means the classifier could not run.
  The JSON is `{"could_not_run": true, "reason": ..., "tier": "high"}`.
  Treat the tier as `high`, say why in the report and never read it as low.
- A missing `$RISK` file means the classifier is not installed.
  The tier is `unclassified` and the run goes on as before.

Print `risk: <tier>` and one line per signal in the report.
A `tie` of `[top, one below]` is settled only as the `risk-tiers` skill says.
A `risk-underdeclared` entry in `findings` is shown in the handoff and the PR body.
It never fails the run.
When `demands.checks` or `demands.reviewers` name more than this skill runs by default, run or dispatch them.

## Run

1. `python3 "$CHECK" discover` prints the commands and where each came from.
   [discovery.md](./discovery.md) has the order.
2. For each discovered step, one call per step: `python3 "$CHECK" run --step <name>`.
   Use the host's longest command timeout for the call, because one step can take up to 300 seconds.
   A repo raises the per-command limit with a line `pr-check timeout: <seconds>` in `CLAUDE.md` or `AGENTS.md`.
3. Then `python3 "$CHECK" run --step floor`.
   The script finds pro-quality's floor guard and records `pass`, `findings`, `could-not-run` or `not-installed`.
4. Stop on the first step with status `fail`.
   Print the failed command and its output tail and dispatch no reviewer.
   Still run `stamp` so the stamp records `fail` for this HEAD and an older passing stamp cannot stand in for it.
   A step with status `timeout` does not stop the run; it makes the result `incomplete`.
5. Mutation check: `python3 "$CHECK" run --step mutation`.
   It runs when the diff touches non-test code and the tier is not `low`.
   Pass the classified tier with `--tier <low|medium|high>`, which is `high` when the classifier could not run.
   With `unclassified` it runs whenever non-test code changed.
   The script inverts one condition, reruns the related tests and restores the file.
   Confirm `git status --porcelain --untracked-files=no` is empty afterwards.
   If it is not, run `git checkout -- <file>` for each listed file and report it.
   `survived` makes the result `incomplete` until the person confirms.
   Ask once.
   On a yes, add `--accept-mutation` to the stamp call.

## Reviews

### Security surface

Classify the diff with pro-security's classifier:

```bash
SURFACE=$(python3 "$CHECK" find pro-security security_surface.py)
git diff <base>...HEAD | python3 "$SURFACE"
```

Any output means security surface.
`find` reporting `not-installed` means the security reviewer is recorded `not-installed`.
No surface means it is recorded `skipped-no-surface`.

### Handoff

Fill the one template in `plugins/pro-quality/skills/requesting-code-review/handoff.md`.
Do not write a second template.
The four fields are:

- `range`: `<base>..<head>` as full shas.
- `brief`: the intent, spec and plan paths for this work, when they exist.
- `policy`: `REVIEW.md`, `CLAUDE.md` or `AGENTS.md` plus `CONSTRAINTS.md` when present.
- `risk`: the tier, its signals (id, floor and evidence, one per line) and any `risk-underdeclared` finding, plus the path `.pro-dev/ship/run.json`, which holds this run's `mutation` record (the stamp is written only after the reviewers return).
  For a tier of `high` that came from a run that could not classify, write `high (classifier could not run: <reason>)`.
  Write `unclassified` only when the classifier is not installed.
  Never add your own view of how risky the change is.

Send that text and nothing else.
Never add a summary of the work, the session's reasoning, your own opinion of the diff or earlier findings.

### Codex second review

After the handoff is filled, ask whether a second review from Codex applies:

```bash
python3 "$CHECK" codex-trigger --tier <tier> --base <base>
```

It prints `{run, setting, reason}`.
The setting comes from a `codex-review: always | high | never` line in the base branch's `REVIEW.md`, never the working tree, so a PR cannot turn off its own second look; the default is `high`.
When `run` is false, record `reviewers.codex` as `skipped` with that reason and go on.

When `run` is true:

1. Write the filled handoff, the same four fields the Claude reviewer gets and nothing else, to `.pro-dev/ship/handoff.md`.
   The handoff text is never put into a command line.
2. Find the instructions and the runner:

   ```bash
   CODEXRUN="${CLAUDE_PLUGIN_ROOT}/scripts/codex-run.py"
   TWIN=$(python3 "$CHECK" find pro-quality .codex-plugin/agents/code-reviewer.toml)
   ```

   When `$TWIN` is `not-installed` or `$CODEXRUN` does not exist, record `not-installed` with the reason `runner or instructions missing`.
3. Run it with stdout to a file and keep the exit code:

   ```bash
   python3 "$CODEXRUN" --instructions "$TWIN" --prompt .pro-dev/ship/handoff.md --consent-ref <base> > .pro-dev/ship/review-codex.md
   ```

   Start it in the same turn as the subagent dispatches below, as a background shell command when the host offers one.
   Give it the host's longest command timeout.
   The runner stops by itself after 540 seconds.

The runner checks consent, the `codex` binary and the login itself.
It never sends anything unless the repo answered yes for `codex` through `/pro-dev install`.
`--consent-ref <base>` reads that answer from the base branch, so a PR cannot add its own opt-in.
A Codex finding never blocks the merge and never makes `result` `incomplete`.

### Dispatch

Dispatch both reviewers in one turn so they run in parallel.
Choose from the agents the host offers:

- Code review: `pro-quality:code-reviewer` (plus every other reviewer in `demands.reviewers`), else `pro-ai-sdlc:reviewer`, else record `not-installed` (not `could-not-run`) in `--reviewers`.
- Security review, only on surface: `pro-security:security-architect` in diff mode.

Save the code reviewer's report verbatim to `.pro-dev/ship/review-code.md`.

When the host cannot dispatch subagents, say so.
Apply each reviewer's own skill in this session instead, record the reviewer as `inline` and note that the context was not fresh.
An `inline` security review does not satisfy the push gate.

### Tally lines

Read one count line from each report and match it as a whole line.
A missing line or a mismatch records `could-not-run` for that reviewer.

- Code reviewer, first line: `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>`.
  Set both `blocking` and `important` to the `important` number: for the code reviewer every Important finding blocks.
- Security reviewer, last line: `blocking: <n>  should-fix: <n>  notes: <n>`.
  `blocking` takes `blocking` and `important` takes `should-fix`.

Codex report: when the Codex run was started, read its first line with the same code reviewer pattern, then map the run to `reviewers.codex`:

- Trigger false: `skipped`, with the trigger's reason.
- `$TWIN` is `not-installed` or the runner file is missing: `not-installed`, reason `runner or instructions missing`.
- Runner exit 3: `not-installed`, reason the runner's word (`not-opted-in`, `not-installed` or `not-logged-in`).
  For `not-opted-in` say to run `/pro-dev install`, which asks for the consent even when the codex command is already on PATH.
- Runner exit 0 with the tally line first: `done`, `important` from the tally.
- Runner exit 0 without that line, exit 2, exit 4 or any other exit: `could-not-run`, reason the runner's word (`timeout`, `exit-<n>`, `empty-output`, `usage`) or `no tally line`.

When Codex is `done`, run `python3 "$CHECK" agree --code .pro-dev/ship/review-code.md --codex .pro-dev/ship/review-codex.md` and take `agreed` and `disputed` from its `counts`.
When either report file is missing or empty the step refuses with an error: the Codex section then shows `could-not-run` with that error as the reason and `agreed` and `disputed` stay 0.
The `codex` record holds `agent` (`codex:code-reviewer` or null), `status`, `reason`, `blocking` (always 0), `important`, `agreed`, `disputed` and `range`.
A Codex run that never started has `important`, `agreed` and `disputed` at 0.

Build the `--reviewers` JSON with keys `code` and `security`, plus `codex` when the trigger was asked.
Each of `code` and `security` holds `agent`, `status`, `blocking`, `important` and `range`.
`docs/pr-check-stamp.md` lists the allowed values.

### Convergence

Read the last stamp's `head`.
When it is an ancestor of HEAD (`git merge-base --is-ancestor`), this is a later round.
Put `since <sha>` in `range` for the reviewers, the Codex run included, so they review only the new commits.
Drop findings the person has already seen or fixed.
Stop after the third round and ask the person to rethink the approach (ADR-0011).
Every round counts, including rounds that only fixed failing checks.

## Stamp and report

1. `python3 "$CHECK" stamp --reviewers '<json>' --risk .pro-dev/ship/risk.json`, plus `--accept-mutation` when confirmed.
   The stamp records the tier and a `risk` field from that file.
   Leave `--risk` out when the classifier is not installed.
   It refuses on a dirty tree.
2. Write `.pro-dev/ship/pr-body.md` from [pr-body.md](./pr-body.md).
3. Print the report in the order things ran, then the result, the stamp path and the draft path:

```
pr-check on 3f9c2ab (base 81d04e7)
  build       pass   pnpm run build
  test        pass   pnpm test
  floor       pass   floor-guard.py --check
  documents   missing 1  Should-fix: ARCHITECTURE.md
  mutation    killed src/gate.ts
  code review done   reviewer: 0 blocking, 2 important
  codex       done   codex: 3 important, 1 agreed, 1 disputed
  security    skipped-no-surface
result: pass
stamp: .pro-dev/ship/pr-check.json
PR body draft: .pro-dev/ship/pr-body.md
```

The `codex` line is `codex       done   codex: <n> important, <a> agreed, <d> disputed` or `codex       <status> (<reason>)`.
It changes nothing in `result`.
Print the draft body.
Never run `gh pr create`.
When the person opens the PR with `gh pr create` at high tier, apply the label right after it succeeds:

```bash
gh label create risk:high --force --description "High-risk change, see the PR body" --color B60205
gh pr edit <number> --add-label risk:high
```

Another tier gets no label.
Say "confirm" for every claim in the draft that was not checked.
A `not-installed` code reviewer, a `could-not-run`, a timeout or a surviving mutation makes the result `incomplete`. The report says which.

## No script

When the script is missing (Codex ships only skills, or the plugin path is not substituted), run the checks by hand.

1. Read the verify block in `CLAUDE.md` or `AGENTS.md`, else the repo's build, lint, typecheck and test commands ([discovery.md](./discovery.md)).
2. Run each command once from the repo root and report its result and output tail.
3. Review inline as above and record it as not fresh.
4. Draft the PR body.
5. The Codex review is skipped: no script.
6. Run `required-docs.py` from pro-quality when it can be found, and otherwise report "required documents: not checked".
7. Say "no stamp was written", because the stamp hooks run in Claude Code only and the script writes the stamp.
