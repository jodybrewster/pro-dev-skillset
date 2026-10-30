---
name: doubt-driven-development
description: Use when /execute or a build session finishes a step that is hard to undo (a data migration, a public API change, an auth rule, a deploy or infrastructure config, or a delete that other code depends on) and the decision should face a fresh-context adversarial reviewer before the next step. Not for mechanical edits, renames, formatting, one-line changes, specs or plans.
---

# doubt-driven-development

A long build session turns its own assumptions into facts.
This skill sends one finished step to a reviewer that has never seen the author's reasoning, before the next step stands on it.

## When to use it

A step is hard to undo when it changes a data migration, a public API, an auth rule or a deploy or infrastructure config, or when it deletes a file that other code depends on.
`/execute` doubts every step the plan marks `irreversible`, with no question.
When pro-ship is installed, `/execute` adds an unmarked step only when the classifier rates that step's diff high tier.
Skip mechanical edits, renames, formatting and one-line changes.
Skip specs and plans: EGM goldfish, through pro-egm, reviews those.
This skill reviews a build decision and shares no loop with goldfish.

## Main session only

Run this skill in the main session.
A subagent must not run it, because a subagent cannot dispatch another.
When a builder subagent built the step, the main session doubts it after the subagent returns.

## The cycle

Five stages: claim, extract, doubt, reconcile and stop.

### Claim

Write two or three lines for yourself: what the step does and why you think it is right.
The claim is never sent to the reviewer.
It exists so you can compare it with what the reviewer finds.

### Extract

The artifact is the step's committed range, from the sha before the step to its head commit.
Doubt runs on a commit because the classifier and the diff both need fixed shas.
A step too big for one read is split into smaller steps, never given extra rounds.

### Doubt

Read `doubt-instructions.md` and `handoff.md` from this folder.
Fill the four fields of `handoff.md`.
Dispatch a fresh subagent with the full text of `doubt-instructions.md` followed by the filled fields and nothing else.
No claim, no author description, no session summary, no plan excerpt and no earlier findings go in.
Never fork the session to be the reviewer.
Name the model and effort at dispatch: Opus at high effort.
Under Codex, start a fresh agent run with the same text.

### Codex offer

This stage runs only in an interactive run, after each single-model round and before reconcile.
A run is non-interactive when no person can answer: a headless run, a scheduled run or a loop.
In a non-interactive run print `Cross-model skipped: non-interactive run.` and record it in the Done line.
Under Codex itself the offer is not made.

Ask as a yes or no question and show the exact command.
Say it sends this step's diff and the listed file paths to OpenAI.
Offer three answers: yes, no and no for the rest of this step.
A yes covers that one command only.

On yes:

1. Write the filled fields to `$(git rev-parse --git-dir)/doubt/step-N-round-R.md`, inside the git directory so it can never be staged.
2. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/codex-run.py" --instructions doubt-instructions.md --prompt <that file>`, with the instructions path resolved inside this skill's folder.
   The runner checks the repo's consent in `.claude/pro-dev.json`, the `codex` binary and the login, runs `codex exec` read-only with a timeout and takes the text on stdin.
   Never put the prompt in a shell argument.
3. Treat its output as findings tagged `codex`.

When the runner prints `could-not-run: <reason>` (not-opted-in, not-installed, not-logged-in, timeout, an exit code or empty output), show "Codex could not run: <reason>" and offer retry or skip.
For not-opted-in, say to run `/pro-dev install`, which asks for the consent.
Record a failure as could-not-run and never as a clean review.

### Reconcile

Read each finding against the diff, Claude's and Codex's alike, tagged with its source.
Put each in the first class that fits:

1. Brief or policy gap: the handoff lacked a path.
   Add the path and run the round again.
2. Real and actionable: fix it in a new commit and stage only that step's files.
3. Real trade-off: accept it and record why.
4. Noise: record it and move on.

Never accept or reject a finding only because the reviewer said so.
Keep a list of findings already raised for the step and drop repeats.
That list is never sent to the reviewer.

### Stop

A step gets at most three rounds.
Stop early when a round returns only repeats or nothing substantive, or when the person says to go on.
Never run a round on an unchanged diff.
Each round after the first runs on the new head, so fix first, commit and then dispatch.

When two rounds in a row raise substantive findings and you class none of them as actionable, you are validating, not doubting.
Stop and ask the person.

After three rounds with substantive findings still open:

- An interactive run stops at that step, prints the open findings in your own words and waits for the person.
- An unattended run does not stop the build.
  It records the open findings for `/execute`, which opens the pull request as a draft and lists them under "Potential concerns".

## Record it

Add one `Doubt:` line per doubted step under `## Done` in plan.md, in your own words.
It names the step, the trigger (plan marker, or classifier with the tier), the rounds used, whether Codex ran, was skipped or could not run, and how each finding was settled.
Never paste reviewer output.
A step the person declined to doubt is recorded as declined.
With nothing doubted the line reads `Doubt: none`.

Example: `Doubt: step 3 (plan marker), 2 rounds, Codex ran in round 1; null customer id now rejected before the copy (fixed); row lock held for the whole copy accepted because the table is small; one naming note was noise.`

Adapted from addyosmani/agent-skills (skills/doubt-driven-development/SKILL.md at eb07f19), MIT, Copyright (c) 2025 Addy Osmani.
