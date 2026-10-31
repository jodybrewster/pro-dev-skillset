# Enforce mode

Every gate in this marketplace ships in warn mode.
This page is the one list of what still stands between each gate and enforce mode, who owns it and the commands that read the evidence.
It is maintainer documentation and ships in no plugin.

## The rule

[ADR-0016](./decisions/0016-gate-enforce-rule.md) sets the rule.
Every gate defaults to warn and is switched per machine with a `mode.<gate>` file holding `enforce` in the guard folder.
A gate moves only on a written decision record with at least seven days of warn-mode lines from two repos behind it.
Jody makes each call.
A false denial in enforce sends the gate back to warn the same day.

The guard folder is `CLAUDE_GUARD_DIR` when set and the `hooks` folder under `~/.claude` otherwise.
The state folder of the push gate is `PRO_DEV_STATE_DIR` when set and the `pro-dev` folder under `~/.claude` otherwise.

## Gates

Open blockers have an owner in brackets.
Accepted limits carry the reason they are accepted.

| Gate | Plugin | Hook script | Mode file | Open blockers (owner) | Accepted, with a reason |
|---|---|---|---|---|---|
| floor guard | pro-quality | `floor-guard.py` | `mode.floor-guard` | The warn-mode week in two repos (Jody). | Doc freshness is no longer a hook: it moved to a Should-fix step in `pr-check` (ADR-0021). |
| pr-gate | pro-ship | `pr-gate.py` | `mode.pr-gate` | The warn-mode week in two repos (Jody). | A forged stamp passes a local guardrail ([ADR-0014](./decisions/0014-gate-stamp.md)): the stamp is a convenience check and CI is the hard gate. |
| merge gate | pro-ship | `merge-gate.py` | `mode.merge-gate` | The warn-mode week in two repos (Jody). Interactive ask check per permission mode (Jody). | A low merge is not pinned so a push between the gate and the merge goes through: a wrong-branch merge has not shown in the log yet. The headless probe of `ask` per permission mode is a proxy for a person at the terminal: a hook `ask` was denied under `--permission-prompts none` in every mode on Claude Code 2.1.314 and `NO_PROMPT_MODES` still holds `bypassPermissions`, `dontAsk` and `auto` (fail closed): the set shrinks only after the interactive ask check per mode. `export GH_REPO=o/r` carries to later segments of one command but a `GH_REPO` set in a subshell or earlier call is not seen (accepted: it fails safe to the current repo's PR or could-not-run). A `-R` repo that is not `origin` whose head is not local reads high: it fails safe and `production-gate.py` asks a second time in enforce. |
| push gate | pro-security | `push-gate.py` | none, no warn mode | The count of gated diffs in the week (Jody). | It denies once per diff and lets the identical retry through: the retry is the person's yes. |

Closed since the P0 review: the merge gate resolves the PR it is given through `gh pr view` and fetches the head when it is not local, it gates `gh api` merges and holds `--auto` merges to the pin, the size thresholds carry their measured ranges and the router names `pr-check` and `risk-tiers`.
The user-level `/merge-pr` command passes `--match-head-commit <headRefOid>` since 2026-10-30; that edit lives outside this repo and its call is documented in the risk-tiers skill.

## Evidence per gate

Every gate needs the conditions of ADR-0016: no open blocker in its row, seven days in two repos counted from the day its current version is installed in both and every finding in the period read.
Each gate adds one condition.

- Floor guard: findings that are mostly cleared with `floor-allow:` mean a rule is too broad and the rule is loosened first (ADR-0010).
- pr-gate and merge gate: no `could-not-run` line caused by the gate's own limits (a missing `gh`, a timeout, a head that cannot be fetched, a stamp that cannot be read).
  A could-not-run line caused by the machine, such as being offline, is read and set aside with a note.
- Push gate: every gated diff did touch security surface.

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
awk -F'\t' -v since="$SINCE" '$1 >= since && $2 ~ /^(floor-guard|pr-gate|merge-gate)$/ {n[$2 "\t" $3]++} END {for (k in n) print k "\t" n[k]}' "$GUARD/warn.log" | sort
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
Findings Jody agrees with: <count>
Findings he would have overridden: <count and the rule or bug behind each>
Could-not-run lines from the gate's own limits: <count and reasons>
The call: <enforce, stay in warn or loosen a rule first>
Date: <date>
Jody's words: <one or two sentences>
```
