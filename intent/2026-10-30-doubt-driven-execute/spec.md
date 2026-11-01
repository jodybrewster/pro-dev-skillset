---
intent: intent/2026-10-30-doubt-driven-execute/intent.md
intent-status: draft
status: draft
created: 2026-10-30T11:47:14-0400
author: the maintainer
---

# Spec: doubt-driven step in /execute

Built from `intent.md` in this folder (commit a7049dc).
Status: draft.
Policies and skills consulted: `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, ADRs 0002, 0003, 0004, 0011, 0012, 0013 and 0015 in `docs/decisions/`, `docs/codex-parity.md`, `docs/licenses.md`, `tests/check.mjs` (the `handoff`, `sdlc-contract`, `codex-manifests`, `codex-parity` and `component-coverage` checks), `tests/lib/components.mjs`, `tests/cases/routing.jsonl`, `tests/cases/components-uncovered.json`, `plugins/pro-ai-sdlc/commands/execute.md`, `commands/spec.md`, `commands/plan.md`, the pro-ai-sdlc templates, `plugins/pro-quality/skills/requesting-code-review/handoff.md` and `SKILL.md`, `plugins/pro-quality/agents/code-reviewer.md`, `plugins/pro-ship/scripts/risk-classify.py`, the sibling intents [sdlc-loop-upgrades](../2026-10-30-sdlc-loop-upgrades/intent.md) and [codex-second-reviewer](../2026-10-30-codex-second-reviewer/intent.md), the shipped [code-reviewer spec](../2026-10-29-code-reviewer/spec.md) and upstream `skills/doubt-driven-development/SKILL.md` in agent-skills at `eb07f19`.
No `DESIGN.md`, `SECURITY.md` or `CONSTRAINTS.md` exists in this repo.
The one project skill (`.claude/skills/skill-creator`) does not touch compliance, security, privacy or design.

Written against the outcomes of two intents that merge first.
sdlc-loop-upgrades adds a stop list, a "noticed but not touching" note, step-scoped staging and two PR body parts to `/execute`, plus step sizes, checkpoints and a definition of done to `/plan`.
codex-second-reviewer ships the Codex runner at `plugins/pro-ship/scripts/codex-run.py`.
Where this spec names a section added by either, it names it by heading and the plan reads it after a rebase.

## Summary

pro-ai-sdlc gains a `doubt-driven-development` skill and `/execute` gains a doubt section beside its stop list.
When `/execute` finishes a step that the plan marks irreversible, it sends the step's committed diff to a fresh-context reviewer before the next step starts.
The reviewer gets a fixed adversarial instruction text and the four handoff fields of ADR-0012, all of them paths or shas.
It never gets the author's claim or reasoning.
The session reads each finding against the diff, fixes the real ones, records accepted trade-offs and runs again, for at most three rounds.
When pro-ship is installed, `/execute` also runs the risk classifier on each step's commit and offers a doubt round on a high tier.
In an interactive run the person can ask for a Codex second opinion each round, confirmed per run through a copy of the shared runner.
A non-interactive run skips Codex and says so.
`/plan` can mark a step irreversible in the same field style as its size marker.
The plan's Done section gets one line per doubted step.
A check in `tests/check.mjs` proves the reviewer's prompt has no slot for a claim and that the two runner copies match.
It reaches the maintainer and any session that runs `/execute` with pro-ai-sdlc installed.

## Requirements

### Functional

- R1. `plugins/pro-ai-sdlc/skills/doubt-driven-development/SKILL.md` exists and is tracked, with frontmatter `name: doubt-driven-development` and a `description` that says when to use it (a hard-to-undo build decision) and when not to (mechanical edits, renames, one-line changes, specs and plans). (Intent: Proposed outcome, Out of scope.)
- R2. The skill defines a hard-to-undo step as one that changes a data migration, a public API, an auth rule, a deploy or infrastructure config or deletes a file other code depends on.
  It names the steps it skips: mechanical edits, renames, formatting and one-line changes. (Intent: Problem, Out of scope.)
- R3. The skill runs in the main session only.
  It says a subagent must not run it, because a subagent cannot dispatch another.
  A builder subagent's step is doubted by the main session after the subagent returns. (Intent: Constraints.)
- R4. The skill's cycle has five named stages: claim, extract, doubt, reconcile and stop.
  The claim is written by the session for its own use in two or three lines and is never sent to the reviewer. (Intent: Evidence, upstream cycle.)
- R5. `skills/doubt-driven-development/doubt-instructions.md` holds the reviewer's fixed instruction text: find what is wrong, assume the author is overconfident, look for unstated assumptions, unhandled edge cases, hidden coupling, contract violations, broken conventions and failure under unexpected input, do not validate and do not summarize.
  When nothing is found after a thorough read it says so plainly.
  It also says to read the diff and the brief and policy files itself, never to open, read or quote env files and to report each finding with file, line and a failure scenario.
  It has no placeholder of any kind. (Intent: Proposed outcome, Constraints.)
- R6. `skills/doubt-driven-development/handoff.md` is pro-ai-sdlc's own copy of the four-field template (the accepted exception to ADR-0012) and holds the four fields of ADR-0012 under a `## Fields` heading, in this order: `range`, `brief`, `policy` and `risk`, each with what goes in it and what never does.
  `range` is `<sha before the step>..<head of the step>`.
  `brief` is the paths to the plan (with the step number), the spec and the intent.
  `policy` is the paths to `REVIEW.md`, the agent file and `CONSTRAINTS.md` when each exists.
  `risk` is the classifier tier and its signal ids when it ran, else `unclassified`. (Intent: Open questions, contract mapping.)
- R7. A dispatch is the full text of `doubt-instructions.md` followed by the filled `handoff.md` fields and nothing else: no claim, no author description, no session summary, no plan excerpt and no earlier findings. (Intent: Constraints.)
- R8. The reviewer is a fresh subagent started with that dispatch, never a fork of the session, on Opus at high effort, named explicitly at dispatch.
  Under Codex the skill says to start a fresh agent run with the same text. (Intent: Constraints; CLAUDE.md model split.)
- R9. Reconcile reads each finding against the diff and puts it in the first class that fits, in this order: brief or policy gap (a path the handoff lacked; add the path and re-run), real and actionable (fix it in a new commit), real trade-off (accept it and record why) and noise (record it and move on).
  A finding is never accepted or rejected only because the reviewer said so. (Intent: Proposed outcome.)
- R10. The session keeps the list of findings already raised for the step and drops repeats.
  That list is never passed to the reviewer. (Intent: Constraints; ADR-0011.)
- R11. A step gets at most three rounds.
  The loop stops early when a round returns only repeats or nothing substantive.
  It also stops when the person says to go on.
  A round is never run on an unchanged diff, except a re-run after a brief or policy gap.
  After three rounds with substantive findings still open, an interactive run stops at that step, prints the open findings in its own words and waits for the person.
  An unattended run finishes the build, opens the pull request as a draft (`gh pr create --draft`) and lists the open findings under "Potential concerns" in the PR body; it does not stop the build.
  A large step is split, never given a fourth round. (Intent: Constraints; ADR-0011.)
- R12. When two rounds in a row raise substantive findings and the session classes none of them as actionable, the skill treats that as validating instead of doubting and stops to ask the person in an interactive run.
  An unattended run treats those findings as open, finishes the build and opens the pull request with `--draft`, listing them under "Potential concerns" as R11 does. (Intent: Evidence, upstream red flag.)
- R13. In an interactive run, after each single-model round and before reconcile, the skill offers a Codex second opinion as a yes or no question.
  The question shows the exact command it would run.
  A yes covers that one command only.
  The person can say no for the rest of the step. (Intent: Constraints.)
- R14. The Codex run writes the filled fields to a prompt file inside the git directory (`$(git rev-parse --git-dir)/doubt/`), so the file can never be staged.
  It then calls `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/codex-run.py"` with `doubt-instructions.md` (by its `${CLAUDE_PLUGIN_ROOT}/skills/doubt-driven-development/` path) as the instruction file, that prompt file and `--consent-ref origin/<default_branch>`, matching the runner's usage line and pro-ship's `pr-check`.
  The runner checks the binary and the login, pipes the prompt through stdin into `codex exec` in a read-only sandbox with a timeout and never puts the prompt in a shell argument. (Intent: Constraints.)
- R15. A Codex failure (missing binary, no login, timeout, nonzero exit or empty output) is shown to the person as "Codex could not run: <reason>" with a choice to retry or skip.
  It is recorded as could-not-run and never as a clean review. (Intent: Constraints.)
- R16. Codex findings go through the same reconcile as Claude's, each tagged with its source.
  A non-interactive run skips the offer and prints "Cross-model skipped: non-interactive run." in the step's output and in the Done line.
  The skill decides it is non-interactive when no person can answer: a headless run, a scheduled run or a loop. (Intent: Constraints.)
- R17. `plugins/pro-ai-sdlc/scripts/codex-run.py` is a byte-identical copy of `plugins/pro-ship/scripts/codex-run.py` and is tracked by git.
  No hook runs it. (Intent: Open questions, the runner; sibling intent codex-second-reviewer.)
- R18. `commands/execute.md` gains a `## Doubt` section beside the stop list section that says when a step is doubted, that the skill runs in this session after the step's commit and before the next step.
  It also says how a doubted step is recorded.
  Step 5 of the task points at it, the stage lines gain "step N doubted (R rounds)" and the report names the doubted steps. (Intent: Affected systems.)
- R19. A step the plan marks irreversible is doubted with no question, since the person approved the plan with that marker. (Intent: Open questions, offer or automatic.)
- R20. `/execute` does not classify each step, because a per-step run prompts every time and is denied headless.
  The classifier runs only at the checkpoints that already exist (step 5 and the stop list's risk-tiers checkpoint), with no `--intent`, so the intent's declared risk does not raise every step.
  The doubt decision classifies only the group's own range (since the previous checkpoint), never the cumulative range, which stays for the stop-list pause.
  A tier `high` that comes from the size signal alone does not pick steps.
  When that range reads tier `high`, every step in that range that has not been doubted gets the doubt review before the next group of steps starts.
  An interactive run pauses once and offers it naming the tier and signal ids; a non-interactive run runs the single-model round with no question.
  Steps marked `irreversible` are still doubted at the step.
  A classifier run that did not happen (denied, exit 2 or pro-ship missing) prints "classifier could not run: <reason>" and is listed under "Potential concerns"; it is never silent.
  The step goes on with the plan marker alone. (Intent: Open questions, what counts as hard to undo; ADR-0013.)
- R21. `templates/plan.md` lets a step carry an `irreversible` marker in the same field style as the size marker sdlc-loop-upgrades adds, with a few words on what cannot be undone.
  `commands/plan.md` tells the planner to mark a step irreversible when it fits R2 and to name it under Risks. (Intent: Open questions.)
- R22. The plan's `## Done` section gains one `Doubt:` line per doubted step in the session's own words: the step, the trigger (plan marker or classifier with the tier), the rounds used, whether Codex ran, was skipped or could not run plus how each finding was settled (fixed, trade-off with its reason or noise).
  No reviewer output is pasted.
  With nothing doubted the line reads `Doubt: none`.
  A step the person declined to doubt is recorded as declined. (Intent: Success looks like; Open questions, what the plan records.)
- R23. The skill names its relation to the goldfish review: goldfish reviews specs and plans through pro-egm, this skill reviews a build decision.
  The two do not share a loop. (Intent: Open questions.)
- R24. `tests/check.mjs` gains a `doubt` check that fails when:
  - `SKILL.md`, `doubt-instructions.md` or `handoff.md` in the skill folder is missing;
  - `doubt-instructions.md` contains any placeholder in braces or angle brackets;
  - `doubt-instructions.md` lacks the words "Do not validate";
  - `SKILL.md` does not say "three rounds" or does not say the claim is never sent to the reviewer;
  - the skill's `handoff.md` does not match pro-quality's four fields and closing line (R25);
  - `commands/execute.md` lacks a `## Doubt` heading or does not name `doubt-driven-development`;
  - either copy of `codex-run.py` exists without the other or the two differ by a byte.
  (Intent: Success looks like, a check can confirm.)
- R25. The `handoff` check also bars placeholders named `claim` or `reasoning` in every `handoff.md`.
  The `doubt` check also fails when the doubt `handoff.md` does not name the same four fields in the same order as pro-quality's or lacks its closing "Nothing else goes in any field" line, the same pattern as the runner copy check. (Intent: Constraints; ADR-0012.)
- R26. `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` gains `"skills": "./skills/"`.
  The skill prose is harness-neutral and names the Codex fallback for the dispatch. (ADR-0004.)
- R27. `tests/cases/routing.jsonl` gains one case that expects `doubt-driven-development` and has `egm-bridge` and `requesting-code-review` as `notOneOf`.
  `tests/cases/components-uncovered.json` gains `pro-ai-sdlc/skill:doubt-driven-development` with a reason, since a behavioral eval needs a live build with a subagent. (Test coverage rules.)
- R28. `SKILL.md` and `doubt-instructions.md` end with the footer "Adapted from agent-skills (skills/doubt-driven-development/SKILL.md at eb07f19), MIT, Copyright (c) 2025 Addy Osmani."
  `docs/licenses.md` gains a pro-ai-sdlc row for the skill and `plugins/pro-ai-sdlc/LICENSE` carries the agent-skills copyright line. (Intent: Constraints.)

### Non-functional

- N1. A step that is neither marked nor raised by the classifier runs with no pause and no extra dispatch.
  The classifier adds no run beyond the checkpoints that already exist.
- N2. Nothing leaves the machine unless the person says yes to a Codex run; the yes is also consent to send that step's diff and file paths to a second vendor.
- N3. `SKILL.md` stays under 200 lines; detail that does not fit moves to a sidecar in the same folder.
- N4. All prose follows the repo's writing rules: one sentence per line, no em dash, no Oxford comma and straight quotes.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-ai-sdlc takes one minor bump over whatever `main` holds after sdlc-loop-upgrades, in both manifests and its marketplace entry, with `metadata.version` bumped once in the same commit.
- Hook-loading law (ADR-0003): no hook is added; `codex-run.py` is called from a skill only and is tracked by git.
- Codex parity (ADR-0004): R26 adds the skills path; the skill has standard frontmatter, harness-neutral prose and a Codex dispatch fallback; no agent is added, so no `.toml`.
- Layering (ADR-0013): pro-ai-sdlc declares no dependency on pro-ship or pro-quality; the classifier is used when present and the runner is copied in.
- Fresh-context handoff (ADR-0012): four fields, no author prose; the fixed instruction text is the same on every run and carries nothing about the change.
- Review convergence (ADR-0011): three rounds, the session dedupes and the reviewer is not given earlier findings.
- Risk tiers (ADR-0015): the classifier's tier and signals are read, never lowered; doubt adds no merge rule.
- `/execute` Secrets section: the reviewer is told never to open env files and the prompt file holds only paths and shas.
- `REVIEW.md` pass 3 and `docs/licenses.md`: footer, LICENSE line and licenses row (R28).
- CLAUDE.md: no home-directory path in any new file; reviewers on Opus.

## Design

### User experience

A plan step reads, for example, `3. (S, irreversible: drops the legacy column) Migrate orders to the new schema`.
`/execute` builds and commits step 3 and prints `step 3 of 6 built`.
It writes a claim for itself, fills the four fields and dispatches the reviewer.
It prints `step 3 doubt round 1: 2 findings`.
In an interactive run it asks:

```
Single-model round done. Want a Codex second opinion on step 3?
I would run: python3 <plugin root>/scripts/codex-run.py <instructions file> <prompt file>
(sends this step's diff and the listed file paths to OpenAI)  yes / no / no for this step
```

On yes the runner's output joins the round with each finding tagged `codex`.
On failure it prints `Codex could not run: codex not logged in` and asks retry or skip.
The session fixes one finding in a new commit, records one trade-off and runs round 2 on the new head.
Round 2 returns only a repeat, so the loop stops and prints `step 3 doubted (2 rounds)`.
The Done section later reads:

```
- Doubt: step 3 (plan marker), 2 rounds, Codex ran in round 1; null customer id now rejected before the copy (fixed); row lock held for the whole copy accepted because the table is small; one note on naming was noise.
```

A step the classifier raises to tier high in an interactive run gets one question first: `step 5 touches auth (tier high: path-auth). Doubt it before going on? yes / no`.

### System

New in pro-ai-sdlc: `skills/doubt-driven-development/SKILL.md`, `doubt-instructions.md`, `handoff.md` and `scripts/codex-run.py`.
Changed in pro-ai-sdlc: `commands/execute.md`, `commands/plan.md`, `templates/plan.md`, `LICENSE`, both manifests (version, description and the Codex skills path).
Changed at the root: `.claude-plugin/marketplace.json`, `tests/check.mjs` (the `doubt` check and the `handoff` check's barred names), `tests/cases/routing.jsonl`, `tests/cases/components-uncovered.json`, `docs/licenses.md`, `README.md` (the pro-ai-sdlc lines), `docs/roadmap.md` (item 12) and `docs/decisions/` (ADR-0019 and its row).

Reuse: the four fields and their wording follow pro-quality's `handoff.md`; the `handoff` check already covers any `handoff.md` under `plugins/*/`; the classifier's JSON contract is read as documented at the top of `risk-classify.py`; the runner is copied, not rewritten.
The doubt round runs on a committed step because the classifier and `git diff <a>..<b>` both need fixed shas.
Step-scoped staging from sdlc-loop-upgrades makes the step's commit hold only its own files.
"Before it stands" means before the next step for a marked step, before the next group for a classifier-raised step and before the push.

### Alternatives considered

- Dispatch pro-quality's `code-reviewer`: its prompt ignores any text outside the four fields (code-reviewer spec R3), so the adversarial wording would be dropped; pro-ai-sdlc also cannot depend on pro-quality.
- Doubt the uncommitted diff: the session keeps editing while the reviewer reads, the classifier cannot read a working tree and a fix would have no clean range.
- Doubt a step on a strong signal at medium tier: a strong medium signal such as a new dependency says nothing about reversibility.
- Pre-approve `codex-run.py` in `/execute`'s allowed tools: it would turn the per-run confirmation into a one-time grant.
- Put the runner in pro-core: pro-ai-sdlc would still need to find it in another plugin's folder; a checked copy has no lookup.
- Let a non-interactive run skip doubt on classifier-raised steps: an unattended run is where an unreviewed risky step costs most; the single-model round sends nothing off the machine.

## Flagged concerns

Sources read: the policies listed at the top.

ADR needed: yes, a hard-to-undo step in `/execute` gets a fresh-context adversarial review before the next step, which every plan and build must follow; pro-ai-sdlc also keeps a checked copy of the shared Codex runner; drafted as [ADR-0019](../../docs/decisions/0019-doubt-before-irreversible-steps.md) (proposed).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | ADR-0012 says there is one handoff template that callers reference and never copy, but pro-ai-sdlc cannot depend on pro-quality (ADR-0013). | ADR-0012, ADR-0013 | resolved (the recommendations were approved on 2026-10-30): the skill keeps its own `handoff.md` with the same four fields, held by the same `handoff` check (R6, R25); ADR-0019 records the exception |
| 2 | The intent recommends the `code-reviewer` agent or a plain subagent, but `code-reviewer` ignores text outside the four fields and so would drop the adversarial wording. | code-reviewer spec R3 | resolved: a plain fresh subagent on Opus (R8); a departure from the first half of the recommendation |
| 3 | `/execute` says to copy its Secrets section into every subagent prompt, while ADR-0012 bars any text beyond the four fields. | `commands/execute.md` Secrets; ADR-0012 | resolved: `doubt-instructions.md` carries the env-file rule as fixed text that never varies with the change (R5) |
| 4 | Two copies of `codex-run.py` can drift. | codex-second-reviewer; ADR-0013 | resolved: the `doubt` check fails on any byte difference (R24); a runner change edits both copies in one commit |
| 5 | A Codex run sends the step's diff to a second vendor. | N2 | resolved: per-run yes that shows the command and names the vendor (R13); never in a non-interactive run (R16) |
| 6 | Stopping a non-interactive build after three open rounds breaks `/execute`'s run-to-PR promise. | `commands/execute.md`; ADR-0011 | resolved (2026-10-30): an unattended run finishes the build and opens a draft PR with the open findings under "Potential concerns"; only an interactive run stops (R11) |
| 7 | sdlc-loop-upgrades, untrusted-input-safety and required-documents may also bump pro-ai-sdlc and `metadata.version`. | ADR-0002 | resolved: take the next minor over `main` at build time and rebase first |
| 8 | The doubt section's place and the plan marker's syntax depend on sdlc-loop-upgrades, which is not merged. | sdlc-loop-upgrades | resolved: the plan names sections by heading and reads the marker style after a rebase; it stops if the sections are missing |

## Open questions

1. What counts as hard to undo: answered, the plan marker set by `/plan` and approved by the person, with the classifier as a backstop on a high tier when pro-ship is installed (R19 to R21).
2. Offer or automatic: answered, a marked step runs with no question and a classifier-raised step pauses and offers in an interactive run (R19, R20).
   A non-interactive run doubts a classifier-raised step with no question.
3. How the contract maps onto the four fields: answered, `brief`, `policy` and `risk` as they are and `range` as the step's committed range (R6).
   The template needs no note for a decision that is not code, because a migration plan or a config choice lands in the step's commit as a file the range covers.
4. Which reviewer: answered, a plain fresh subagent with the adversarial text verbatim (R8, flagged concern 2).
5. The Codex runner: answered, codex-second-reviewer ships it in pro-ship and this change copies it byte-identical into pro-ai-sdlc with a check (R14, R17, R24).
   Where Codex sits as an engine row in `/pro-dev install` belongs to codex-second-reviewer.
6. Home of the skill: answered, pro-ai-sdlc, with no hard dependency on another plugin (R1, R17).
7. What the plan records: answered, one `Doubt:` line per step under Done in the session's own words (R22).
8. Goldfish and doubt share a loop: answered, no; the skill names the link (R23).
9. Likely needs an ADR: answered, yes, ADR-0019.

## Acceptance criteria

- AC1. `node tests/check.mjs`, `node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70`, `node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC2. `git ls-files plugins/pro-ai-sdlc/skills/doubt-driven-development plugins/pro-ai-sdlc/scripts/codex-run.py` lists `SKILL.md`, `doubt-instructions.md`, `handoff.md` and `codex-run.py`.
- AC3. Adding `{claim}` or `<claim>` to `doubt-instructions.md` makes `node tests/check.mjs doubt` fail; adding a `claim` field to the skill's `handoff.md` makes `node tests/check.mjs handoff` fail; both pass once restored.
- AC4. Changing one byte of `plugins/pro-ai-sdlc/scripts/codex-run.py` makes `node tests/check.mjs doubt` fail; it passes once restored.
- AC5. `commands/execute.md` has a `## Doubt` section that names the skill, the plan marker, the classifier backstop, the three-round stop and the Done line; `templates/plan.md` shows the `irreversible` marker and the `Doubt:` line; `commands/plan.md` tells the planner when to mark a step.
- AC6. A trial `/execute` run on a throwaway repo whose plan marks one step irreversible (a migration that drops a column some code still reads) doubts that step, shows the reviewer's findings and records a `Doubt:` line; the other steps run with no pause.
  The dispatch text, captured from the run, contains the instructions and four fields and no claim.
  Run once by hand and summarized in the PR.
- AC7. In the same trial, a yes to the Codex offer runs the runner once and its findings are tagged `codex`; with `codex` removed from `PATH` the run prints "Codex could not run" and the Done line says could not run.
- AC8. `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` has `"skills": "./skills/"` and the `codex-manifests` check passes.
- AC9. `tests/cases/routing.jsonl` has a case expecting `doubt-driven-development` and `node tests/eval.mjs --dry` counts it.
- AC10. `docs/licenses.md` has the pro-ai-sdlc row for the skill, `plugins/pro-ai-sdlc/LICENSE` carries "Copyright (c) 2025 Addy Osmani" and both skill files end with the footer.
- AC11. pro-ai-sdlc's version is equal in both manifests and its marketplace entry and `metadata.version` is bumped once.
- AC12. `docs/decisions/0019-doubt-before-irreversible-steps.md` exists with its row in `docs/decisions/README.md`.

## Out of scope

Doubting every step, specs or plans.
Replacing the verifier, `/review` or the code-reviewer.
Codex as a second reviewer on PRs, the Codex engine row and installing or logging in to Codex.
Gemini or any other second model.
A hook that blocks a commit until a doubt round has run.
Changing the runner's interface, which codex-second-reviewer owns.
