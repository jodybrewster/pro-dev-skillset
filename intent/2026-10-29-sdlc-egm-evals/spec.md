---
intent: intent/2026-10-29-sdlc-egm-evals/intent.md
intent-status: accepted
status: accepted
created: 2026-10-29T15:40:00-0400
author: Jody Brewster
---

# Spec: evals for pro-ai-sdlc and pro-egm

Built from `intent.md` in this folder.
Status: accepted by Jody on 2026-10-29 ("yes have evals for this and the EGM plugin").
Read: `plugins/pro-ai-sdlc/` (the seven commands, four agents, templates and README), `plugins/pro-egm/` (the `goldfish` and `install` commands, `egm-bridge`, `goldfish-reviewer`, `scripts/goldfish.py`), `docs/evals.md`, the scaffolded verification case in `plugins/pro-quality/evals/` and the plugin eval docs (graders `tool_used`, `regex`, `llm` with `focus` of `last_message`, `trace`, `files` or one file; `scaffold_script` in `case.yaml`).
Stacked on PR 77, since all of them move the marketplace version.

## Requirements

### pro-ai-sdlc

- R1. `plugins/pro-ai-sdlc/.claude-plugin/plugin.json` sets `"experimental": {"evals": "evals"}` and the cases live under `plugins/pro-ai-sdlc/evals/`.
- R2. One shared fixture repo is built by each case's `scaffold_script`: a small Node project with `REVIEW.md`, `CLAUDE.md`, a passing `npm test` and an `intent/2026-01-05-<slug>/` folder holding whatever the case needs (an intent only, an intent and spec, or all three with a plan whose status the case sets).
- R3. `spec-from-intent`: a natural request to write the spec for the fixture intent.
  Graders: the `/spec` command fired (`tool_used: Skill` matching `pro-ai-sdlc:spec`) and an `llm` judge on the written `spec.md` (`focus` on that file) passes only when the requirements are numbered statements a command, a grep or a file can check, each traceable to the intent, with nothing the intent asks for dropped.
- R4. `plan-from-spec`: a natural request to plan the work for the fixture spec.
  Graders: `/plan` fired and an `llm` judge on `plan.md` passes only when every step cites the R statements it satisfies and the plan names the tests that prove it.
- R5. `review-finds-planted-bug`: the fixture branch carries a diff with one planted bug and one breach of a rule in the fixture's `REVIEW.md`; a natural request to review the branch.
  Graders: `/review` or the `reviewer` agent was used and an `llm` judge passes only when both the bug and the rule breach are reported as blocking.
- R6. `execute-refuses-draft-plan`: `/pro-ai-sdlc:execute <plan.md>` on a plan whose status is draft.
  Graders: no `git worktree add` and no commit ran (`tool_used: Bash` with `max: 0` on those patterns) and the reply says the plan is not approved; single arm, since the command is named.
- R7. `verifier-after-build` and `researcher-for-wide-question`: natural prompts after which the main session should hand work to the `verifier` (a build just finished, confirm it works) and the `researcher` (where a flow runs across many files); each grades a `Task` call for that agent.
- R8. Stays-quiet cases: `spec-stays-quiet` (a question about what a spec is), `review-stays-quiet` (explain what a diff does) and `intent-stays-quiet` (a one-line typo fix), each with `min: 0`, `max: 0`, `arm: both` on the command it must not pull in.
- R9. `tests/cases/routing.jsonl` gains at least one case for each of `researcher`, `reviewer`, `verifier` and `simplifier`; the keyless gate still passes at its floor.

### pro-egm

- R10. `plugins/pro-egm/.claude-plugin/plugin.json` sets `"experimental": {"evals": "evals"}`.
- R11. `egm-bridge-fires`: "run a Goldfish review of this spec" with a spec in the fixture; graders: `egm-bridge` fired and the reply points to `/pro-egm:goldfish` (or the install line when `egm@egm` is missing).
- R12. `egm-bridge-stays-quiet`: a plain code review request on a diff; `egm-bridge` stays at 0 fires in both arms.
- R13. `goldfish-init`: `/pro-egm:goldfish init` in the fixture writes `.egm/goldfish.json` naming the starter reviewers; graded on the file.
- R14. `goldfish-needs-egm`: `/pro-egm:goldfish <spec.md> --stage spec` with no `egm@egm` installed prints "pro-egm needs egm@egm: run /pro-dev install" and makes no change (`regex` plus `tool_used: Write|Edit` at `max: 0`).
- R15. `goldfish-reviewer-read-only`: the main session runs the `goldfish-reviewer` agent with the starter `scope` persona and standard on the fixture spec; graders: a `Task` call for that agent, no `Write` or `Edit` in the run and an `llm` judge that every finding cites the standard.

### Records and checks

- R16. `node tests/check.mjs evals` passes for both plugins and `claude plugin validate --strict` passes for both.
- R17. A first baseline at 3 runs per case and arm (Sonnet pinned), recorded in a "Measured changes" entry in `docs/evals.md`; gate cases (R6, R13, R14) are expected at 3 of 3 and every stays-quiet case at 0 fires. Any miss is reported as a finding, not tuned away in this change.
- R18. pro-ai-sdlc and pro-egm bump per the version-bump law with their `docs/releases.md` rows.
- R19. Eval spend for this change stays under $15 by `costUsd`.

### Component coverage and the runner

Added 2026-10-29 at Jody's request: "can we have it so we run each sdlc plugin to make sure that agents, skills, commands, hooks, etc are all firing appropriately?" and "and have a runner to run through each sdlc?".

- R20. Every plugin eval case declares what it covers in `prompt.md` frontmatter as `tags`, each `<kind>:<name>` with kind `skill`, `command`, `agent` or `hook`; a stays-quiet case prefixes `quiet:`.
- R21. pro-ai-sdlc gains `hook-production-gate`, `hook-protect-tests` and `hook-plan-sync`, each triggering its hook in the scaffold repo and grading the effect.
- R22. A `component-coverage` check in `tests/check.mjs` lists every skill, command, agent and hook (by script name) in the workflow plugins (pro-ai-sdlc, pro-egm, pro-spdd, pro-speckit and pro-pdd) and fails when one has no case tagged for it, unless it is listed in `tests/cases/components-uncovered.json` with a reason; a listed entry that is now covered or gone also fails.
  The list starts with every component of pro-spdd, pro-speckit and pro-pdd, plus `command:install` and `command:pr-babysit` with their reasons.
- R23. `tests/run-evals.mjs [plugin...] [--sdlc] [--runs n] [--model m] [--max-cost-usd n] [--dry-run]` runs `claude plugin eval` on each named plugin, or each workflow plugin with `--sdlc`. It adds `--scaffold` and `--allow-tools Bash Write Edit` only when a plugin has a case with a `scaffold_script` or a tool-using case. It stops before a plugin when the running total passes the cap.
  It prints one table per plugin: component, case, fired or passed out of runs with the plugin, the same without it and Δ.
  `--dry-run` prints the plan and the uncovered components and spends nothing.
- R24. `docs/evals.md` documents the runner and the coverage check; `tests/unit/` covers the tag parsing, the coverage diff and the runner's flag choice.

## Out of scope

- Changing any pro-ai-sdlc or pro-egm command, agent or skill to pass a case; misses are findings for a later change.
- Running `egm@egm`'s own review loop, which needs Google's plugin installed.
- `/adr`, `/intent` output quality and `/pr-babysit`, which needs a live PR; they can follow once these cases prove the pattern.
