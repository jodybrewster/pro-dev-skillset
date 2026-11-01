# ADR-0018: Codex is an advisory second reviewer on high-tier PRs

Date: 2026-10-30

## Status

proposed

Decided by: the maintainer (at sign-off).
Source: intent/2026-10-30-codex-second-reviewer/.

## Context

One model family reviews every PR here.
`code-reviewer` already has a Codex twin from Codex parity, a four-field handoff (ADR-0012) and a tier from the classifier (ADR-0015), but nothing runs the twin.
A read from a second model family catches some of what the first misses, at the cost of about a minute and about 40,000 tokens per high-tier PR (spike on PR 76).
Running it sends the diff to a second vendor, OpenAI.
The Codex CLI needs its own install and login, which no script can do for the person.
The engine registry (ADR-0006) knows only kinds that install with an argv while every row owner ships its own `/<plugin>:install`.
Two plugins want the same runner: pro-ship for this review and pro-ai-sdlc for the doubt-driven step.
Plugins cannot import each other (ADR-0003).

## Decision

- On a PR whose tier is high, `/pro-ship:pr-check` runs the Codex twin of `code-reviewer` in parallel with the Claude reviewers, from the same four-field handoff and nothing else.
  `REVIEW.md` may set `codex-review: always | high | never`; the default is `high`.
- The Codex review is advisory.
  It is recorded as an optional `reviewers.codex` in the stamp with `blocking` always 0, `schema` stays 1 and the result rule reads only the code and security reviewers.
  A Codex outage, a missing CLI or a missing login is shown as one line and never changes `result`.
- Agreement is decided by a script: two findings agree when they name the same file and their line ranges overlap after each is widened by five lines.
  A matched pair rated differently is a dispute and both views are shown as written.
  No model call merges, ranks or settles findings.
- One runner, `codex-run.py`, runs Codex: consent, binary and login checks, then `codex exec -s read-only --ephemeral` with the instructions and the prompt on stdin, a timeout and one `could-not-run: <reason>: <detail>` line with a nonzero exit on any failure.
  It names no plugin, so a second plugin carries a byte-identical copy that a check keeps equal.
- Consent is the `codex` answer `yes` in the repo's `.claude/pro-dev.json`, given through `/pro-dev install`; the runner refuses without it.
- Codex is a registry row of a new detect-only kind, `manual-cli`: detected by a PATH lookup, never executed by `/pro-dev`, with printed manual install lines and no install or update argv.
  The row is owned by pro-core, whose installer is `/pro-dev`, so it applies to every repo that runs `/pro-dev` whichever plugin uses it.
  This amends ADR-0006 for that kind and that owner.
- Codex loads `AGENTS.md` files by itself; that is accepted as the same policy and personal instructions a Claude subagent loads, not session context.

## Consequences

A person sees two independent reads on the riskiest PRs and can judge over the first several whether the second read earns its time and usage.
The gate behaves as before, so a person without Codex loses nothing but the second read.
A finding both models raise is visible as such; a lone Codex finding never blocks.
The consent answer is per repo, so one yes covers every teammate whose Codex is logged in.
A future runner change has to land in both copies in one commit.
The five-line window can pair two different bugs that sit close together or miss one bug cited far apart; both are shown, so the cost is a wrong tag, not a lost finding.

What must stay true:

- The Codex run gets the four handoff fields and no other text.
- The run is read-only and never edits, commits, approves, comments or pushes.
- Nothing the Codex reviewer reports changes `result` or blocks a merge until this ADR is revisited.
- No model decides agreement.
- No diff leaves the machine for Codex without the repo's opt-in answer.

Revisit when the first several high-tier PRs show whether Codex finds what Claude missed: drop it if it adds nothing or let an agreed Important finding block if it proves reliable.
Revisit the consent unit when the scaling block brings teams.

## Alternatives considered

- `codex exec review`: runs Codex's own review prompt and layout, so the lenses, the handoff and the tally line cannot be carried.
- Passing the instructions as a `-c` config value: repo text in an argv, visible in a process list.
- Codex's GitHub PR review integration: needs CI and reads no handoff; kept as a later option.
- A model call that merges the two reports: it would pick winners, which the intent rules out.
- A Codex Important that blocks: Codex is not calibrated here yet and an outage must not block a merge.
- pro-ship as the row owner: a pro-ai-sdlc user without pro-ship could never opt in.
- A runner in pro-core called by path: pro-ship and pro-ai-sdlc would depend on pro-core's install path, which ADR-0006 avoids.

## Where it is enforced

- `plugins/pro-ship/scripts/codex-run.py`, the runner, with `tests/codex-run.mjs` and its stub `codex`.
- `plugins/pro-ship/scripts/pr-check.py` (`codex-trigger`, `agree`, `stamp`) and `tests/ship-check.mjs`.
- `plugins/pro-ship/skills/pr-check/SKILL.md` and `pr-body.md`.
- `docs/pr-check-stamp.md` and `tests/fixtures/pr-check-stamp/valid-pass-codex.json`.
- `plugins/pro-core/registry/engines.json` (the `codex` row), `plugins/pro-core/scripts/pro-dev.py` and the `registry` and `installers` checks in `tests/check.mjs`.
- The `agent-twins` check in `tests/check.mjs`, which keeps `code-reviewer.md` and its `.toml` equal.
