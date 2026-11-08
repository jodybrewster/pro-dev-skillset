# Enforce mode

Every gate in this marketplace ships in warn mode.
This page is the one list of what still stands between each gate and enforce mode, who owns it and the commands that read the evidence.
It is maintainer documentation and ships in no plugin.

## The rule

[ADR-0016](./decisions/0016-gate-enforce-rule.md) sets the rule.
Every gate defaults to warn and is switched per machine with a `mode.<gate>` file holding `enforce` in the guard folder.
A gate moves only on a written decision record with at least seven days of warn-mode lines from two repos behind it.
The maintainer makes each call.
A false denial in enforce sends the gate back to warn the same day.

The guard folder is `CLAUDE_GUARD_DIR` when set and the `hooks` folder under `~/.claude` otherwise.
The state folder of the push gate is `PRO_DEV_STATE_DIR` when set and the `pro-dev` folder under `~/.claude` otherwise.

## Gates

Open blockers have an owner in brackets.
Accepted limits carry the reason they are accepted.

| Gate | Plugin | Hook script | Mode file | Open blockers (owner) | Accepted, with a reason |
|---|---|---|---|---|---|
| floor guard | pro-quality | `floor-guard.py` | `mode.floor-guard` | The warn-mode week in two repos. | Doc freshness is no longer a hook: it moved to a Should-fix step in `pr-check` (ADR-0021). |
| pr-gate | pro-ship | `pr-gate.py` | `mode.pr-gate` | The warn-mode week in two repos. | A forged stamp passes a local guardrail ([ADR-0014](./decisions/0014-gate-stamp.md)): the stamp is a convenience check and CI is the hard gate. |
| merge gate | pro-ship | `merge-gate.py` | `mode.merge-gate` | The warn-mode week in two repos. Interactive ask check per permission mode. | A low merge is not pinned so a push between the gate and the merge goes through: a wrong-branch merge has not shown in the log yet. The headless probe of `ask` per permission mode is a proxy for a person at the terminal: a hook `ask` was denied under `--permission-prompts none` in every mode on Claude Code 2.1.314 and `NO_PROMPT_MODES` still holds `bypassPermissions`, `dontAsk` and `auto` (fail closed): the set shrinks only after the interactive ask check per mode. `export GH_REPO=o/r` carries to later segments of one command but a `GH_REPO` set in a subshell or earlier call is not seen (accepted: it fails safe to the current repo's PR or could-not-run). A `-R` repo that is not `origin` whose head is not local reads high: it fails safe and `production-gate.py` asks a second time in enforce. |
| ship-gate | pro-ship | `ship-gate.py` | `mode.ship-gate` | The warn-mode week in two repos, starting from the first release that ships it. | It warns once per commit per session when a tag, release, publish or production deploy has no fresh GO from `/pro-ship:ship`. The record is a local guardrail like the stamp ([ADR-0022](./decisions/0022-ship-preflight-record.md)) and a forged one passes. |
| confirmation | pro-ship | `merge-gate.py` | `mode.confirmation` | The warn-mode week in two repos, counted from the day pro-ship 0.21.0 is installed in both. | Only `mode.confirmation` holding `enforce` turns on its deny: neither the global `mode` file nor `mode.merge-gate` reaches it. It acts at medium and high when the fresh preflight for the PR head lists a check left at `confirm` or a PR-scope confirmation, re-reads the recorded reply with one `gh pr view` inside the gate's deadline and denies a missing one once per head per session. A session holding the person's `gh` token could post the `confirmed` reply itself: accepted for a local guardrail, the skills never post a reply and a GitHub identity for the factory would close it. A label or a reaction never counts. |
| stale-done | pro-ai-sdlc | `plan-sync.py` | `mode.stale-done` | Its own warn-mode week in two repos, counted from the day pro-ai-sdlc 0.16.0 is installed in both. | Only `mode.stale-done` holding `enforce` turns it on: the global `mode` file and `CLAUDE_GUARD_MODE` leave it in warn, so it cannot enforce before its evidence period. A plan with no `Done as of <sha>` line is not checked. Its `warn.log` lines carry the gate name `stale-done` and `## Done is stale` in the detail. |
| change-id | pro-ai-sdlc | `change-id.py` | `mode.change-id` | Its own warn-mode week in two repos, counted from the day pro-ai-sdlc 0.22.0, which ships it, is installed in both. | Only `mode.change-id` holding `enforce` turns it on: the global `mode` file and `CLAUDE_GUARD_MODE` leave it in warn until its own evidence period. It reads only a `-m` or `--message` subject, or the first line of a heredoc that value opens; a commit whose message comes from an editor, `-F`, `-C`, `--no-edit` or `--amend` without `-m` passes unread. It never looks at a branch whose name does not start with an id, so the default branch is checked through the pull request title a squash merge carries. Its `warn.log` lines carry the gate name `change-id`. |
| protected-push | pro-core | `git-safe.py` | `mode.protected-push` | The warn-mode week in two repos, counted from the day pro-core 0.26.0 is installed in both. | Only `mode.protected-push` holding `enforce` turns it on: the global `mode` file and `CLAUDE_GUARD_MODE` leave it in warn until its own evidence period. It covers only the push forms the hard-blocking regex rules of `git-safe.py` miss; those rules still exit 2 on their own, outside any mode. A git state the guard cannot read (no repo, a detached head, a failed or timed-out call) never makes a finding. With pro-ai-sdlc installed `production-gate.py` may add a second message for the same push: each names its own gate and a deny wins over an ask. The regex false positives stay: `git push origin main-fix` and `git push origin master.bak` exit 2 and a case pins it; loosening a hard block needs its own change. The protected list is the `protected-branches` file in the guard folder, never a repo file the watched agent could edit. |
| delete-outside | pro-core | `delete-outside.py` | `mode.delete-outside` | The warn-mode week in two repos, counted from the day pro-core 0.28.0 is installed in both. | Only `mode.delete-outside` holding `enforce` turns it on. It resolves shell words without running them and expands only `HOME`, `TMPDIR`, `PWD`, `USER`, `CLAUDE_PROJECT_DIR` and `PRO_DEV_STATE_DIR`: a word with `$(`, a backtick or any other variable is skipped, so no secret reaches its message or log and it catches the literal mistakes, not every one. A `cd` inside a subshell carries past the `)`. In enforce it and the hard block of `git-safe.py` can both deny `rm -rf ~`: each names the same fix and `git-safe.py` keeps its exit 2. Sibling worktrees sit beside the checkout, so `rm -rf ../<repo>-<slug>` is a finding; worktrees are removed with `git worktree remove`, which it does not read. The guard folder is not exempt, so deleting a `mode.<gate>` file shows in the log. |
| key-literal | pro-security | `key-literal.py` | `mode.key-literal` | The warn-mode week in two repos, counted from the day pro-security 0.4.0 is installed in both. | Only `mode.key-literal` holding `enforce` turns on the deny before a write. The stand-in filter lets a real key through when its line also holds a word such as `example` or `your_`: the floor guard and the push gate still see the diff before it leaves. The PostToolUse check informs only, in either mode, since the file is already written. Its `warn.log` lines name the kind, the basename and the line numbers, never the value. |
| secret-read | pro-core | `secret-read.py` | `mode.secret-read` | The warn-mode week in two repos, counted from the day pro-core 0.29.0 is installed in both. | Only `mode.secret-read` holding `enforce` turns it on: the global `mode` file and `CLAUDE_GUARD_MODE` leave it in warn until its own evidence period. It matches names and never opens a file, so a recursive `grep -r KEY .` or a broad glob such as `cat *` can still reach a secret file: it flags only a concrete secret path or a glob with a literal secret prefix or `.pem` suffix, since it is a guard rail and not a sandbox. `source .env` and `. .env` pass because dev servers and scripts need them, so `source .env && echo $KEY` prints a value unflagged. A machine with its own user-level env guard sees two messages for one `cat .env`: each names its own guard and the user-level one is the person's own choice. `.env.example`, `.env.sample` and `.env.template` stay readable and a plain `python3 env-check.py KEY` call always passes. Its `warn.log` lines carry the tool, the kind of file and its basename, never a value. |
| review-model | pro-ship, pro-ai-sdlc | `pr-check.py stamp`, `ship.py` (coverage and record) and `factory.py verify` | `mode.review-model` | Its own warn-mode week in two repos, counted from the day pro-ship 0.20.0 and pro-ai-sdlc 0.21.0 are installed in both. | Only `mode.review-model` holding `enforce` turns it on: the global `mode` file and `CLAUDE_GUARD_MODE` leave it in warn. Enforce makes the stamp `incomplete`, uncovers the PR in `/ship`, refuses a GO and raises a factory build to level 2. The model is self-reported by the caller and the reviewer's closing line: a false one passes as a forged stamp does ([ADR-0014](./decisions/0014-gate-stamp.md)). A host with no rule in `REVIEW.md` is recorded and never refused. Its `warn.log` lines carry the gate name `review-model` and the warn line in the detail; only `pr-check.py stamp` writes them. |
| push gate | pro-security | `push-gate.py` | none, no warn mode | The count of gated diffs in the week. | It denies once per diff and lets the identical retry through: the retry is the person's yes. |

Closed since the P0 review: the merge gate resolves the PR it is given through `gh pr view` and fetches the head when it is not local, it gates `gh api` merges and holds `--auto` merges to the pin, the size thresholds carry their measured ranges and the router names `pr-check` and `risk-tiers`.
The user-level `/merge-pr` command passes `--match-head-commit <headRefOid>` since 2026-10-30; that edit lives outside this repo and its call is documented in the risk-tiers skill.

## Evidence per gate

Every gate needs the conditions of ADR-0016: no open blocker in its row, seven days in two repos counted from the day its current version is installed in both and every finding in the period read.
Each gate adds one condition.

- Floor guard: findings that are mostly cleared with `floor-allow:` mean a rule is too broad and the rule is loosened first (ADR-0010).
- pr-gate and merge gate: no `could-not-run` line caused by the gate's own limits (a missing `gh`, a timeout, a head that cannot be fetched, a stamp that cannot be read).
  A could-not-run line caused by the machine, such as being offline, is read and set aside with a note.
- Push gate: every gated diff did touch security surface.
- review-model: every `warn` line names a review that really ran on another model than `REVIEW.md` names, not a caller that forgot to pass one.

A gate with no line in the period was not exercised and stays in warn.

## Summary commands

Set the guard folder and the first day of the period.
The commands read it from `warn.log`, one tab-separated line per event: time, gate, action, detail, working directory.

```bash
GUARD="${CLAUDE_GUARD_DIR:-$HOME/.claude/hooks}"
SINCE=2026-11-01
```

Counts per gate and action:

```bash
awk -F'\t' -v since="$SINCE" '$1 >= since && $2 ~ /^(floor-guard|pr-gate|merge-gate|protected-push|delete-outside|key-literal|secret-read|review-model|change-id)$/ {n[$2 "\t" $3]++} END {for (k in n) print k "\t" n[k]}' "$GUARD/warn.log" | sort
```

The could-not-run reasons for the two gates that can have them:

```bash
awk -F'\t' -v since="$SINCE" '$1 >= since && $3 == "could-not-run" && $2 ~ /^(pr-gate|merge-gate)$/ {print $2 "\t" $4}' "$GUARD/warn.log" | sort | uniq -c
```

The push gate writes no `warn.log` line.
Its gated diffs sit in its state files, one per session and repo:

```bash
find "${PRO_DEV_STATE_DIR:-$HOME/.claude/pro-dev}/security" -name '*.json' -newermt "$SINCE" -print0 \
  | xargs -0 python3 -c 'import json,sys; print(sum(len(json.load(open(f)).get("gated_diffs", [])) for f in sys.argv[1:]))'
```

The state files keep the last 200 diffs per session, so the sum is a floor for a long session.

## Decision record template

Copy it to the intent folder of the review and fill one per gate.
The first record is [intent/2026-10-30-p0-hardening/enforce-decision.md](../intent/2026-10-30-p0-hardening/enforce-decision.md).

```markdown
# Enforce decision: <gate>

Gate: <floor guard, pr-gate, merge gate or push gate>
Plugin version installed: <name and version in each repo>
Period: <start date> to <end date>
Repos: <the two repos>
Lines by action: <the summary command output>
Findings read: <count>
Findings the maintainer agrees with: <count>
Findings the maintainer would have overridden: <count and the rule or bug behind each>
Could-not-run lines from the gate's own limits: <count and reasons>
The call: <enforce, stay in warn or loosen a rule first>
Date: <date>
Maintainer note: <one or two sentences>
```
