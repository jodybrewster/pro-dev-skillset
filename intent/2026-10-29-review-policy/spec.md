---
intent: intent/2026-10-29-review-policy/intent.md
intent-status: draft
status: draft
created: 2026-10-29T19:30:00-0400
author: Jody Brewster
---

# Spec: review policy and convergence rules

Built from `intent.md` in this folder (not yet committed).
Status: draft.
Policies and skills consulted: `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, ADRs 0001 to 0009 in `docs/decisions/` (0002 and 0004 bear on this change), `docs/roadmap.md`, the pro-ship brainstorm, `plugins/pro-ai-sdlc/templates/REVIEW.md`, `plugins/pro-ai-sdlc/agents/reviewer.md`, `plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml`, `plugins/pro-ai-sdlc/commands/review.md`, `plugins/pro-ai-sdlc/commands/pr-babysit.md`, the `sdlc-contract` check in `tests/check.mjs` and the sibling spec `intent/2026-10-29-constraint-floor/spec.md`.
No `DESIGN.md` or `SECURITY.md` exists; the one project skill (`.claude/skills/skill-creator`) does not touch compliance, security, privacy or design.

## Summary

pro-ai-sdlc gets a stronger `REVIEW.md` template and review rounds that converge.
The template asks what failure looks like in the repo, lists paths to skip, requires file and line evidence, defines the Pre-existing tag and opens the report with the count.
It offers the design-smell list and the presumptive blockers as optional commented blocks.
The `reviewer` agent, its Codex twin and `/review` apply the rules directly: a range that starts after the last reviewed commit, a Pre-existing tag, a class of bug named once and a report that opens with a count.
`/pr-babysit` stops after three rounds, skips Pre-existing items and never answers one finding twice.
The rules are written so `pr-check` and the `code-reviewer` agent can adopt them unchanged.
Everyone who installs pro-ai-sdlc gets them on the next update; repos with an older `REVIEW.md` get the behavior from the agent and commands.

## Requirements

### Functional

- R1. `plugins/pro-ai-sdlc/templates/REVIEW.md` gains a section "What failure looks like here" with a prompt for two to four concrete failures that matter in this repo and one line saying the reviewer weighs those first. (Intent: Proposed outcome.)
- R2. The template's existing "Leave out" section gains a line for paths to skip (vendored code, build output, lockfiles) beside the generated-output line and keeps its name. (Intent: Proposed outcome.)
- R3. The template gains a section "Evidence" requiring every finding to cite a file and line the reviewer opened and read and to drop or list as skipped any finding that rests on a guess from a name. (Intent: Problem.)
- R4. The template gains a section "Pre-existing" defining the tag: a finding on a line or behavior the diff did not add or change is tagged Pre-existing, is listed apart from the others, never counts toward Important and never blocks. (Intent: Problem; Success looks like.)
- R5. The template's "Output format" section opens the report with the summary line `important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>` and states that when important and nits are both zero the next line is "Nothing to fix."; the closing tally is removed so the count appears once. (Intent: Proposed outcome; Open question 2.)
- R6. The template gains a section "Rounds" with the four convergence rules in plain words: after the first full review later rounds cover only new commits; a finding is never raised twice; a class of bug is named once with every instance listed; Pre-existing findings do not block. (Intent: Proposed outcome.)
- R7. The template carries two optional blocks, each inside an HTML comment with a one-line instruction to uncomment it: the design-smell list and the presumptive blockers, adapted from `skills/code-review-and-quality/SKILL.md` in agent-skills. Neither is active by default. (Intent: Constraints.)
- R8. The template keeps its three passes, severity rule, nit cap, "Learning from repeats" and the headings that `/review` and the checks rely on; it adds no tier table and no sensitive-paths list. (Intent: Out of scope.)
- R9. `plugins/pro-ai-sdlc/agents/reviewer.md` accepts an optional `since <sha>` in its diff spec; with it, the reviewer reviews only `<sha>..HEAD` and reads code outside that range only as context. Without it the review is full. (Intent: Proposed outcome.)
- R10. The reviewer tags a finding Pre-existing when the flagged line is not among the lines the range adds or changes (checked with `git diff` and `git show <base>:<path>`), lists those findings in their own group after the others and excludes them from the important and nit counts. (Intent: Problem; Success looks like.)
- R11. When a finding is a class of bug, the reviewer reports it once with the rule that identifies the class and a list of every file and line where it occurs in the range, never as one entry per instance. (Intent: Problem.)
- R12. The reviewer never lists the same claim under two passes in one report; it keeps the entry under the pass where it is most severe. (Intent: Proposed outcome.)
- R13. The reviewer's report opens with the summary line of R5 and says "Nothing to fix." when important and nits are zero. The reviewer still receives no earlier findings. (Intent: Constraints.)
- R14. `plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml` carries the same instructions as the agent file, word for word apart from the TOML wrapper. (Codex parity.)
- R15. `plugins/pro-ai-sdlc/commands/review.md` accepts `--since <sha>`, passes it to the reviewer in the diff spec and keeps in the calling session the list of findings it has already shown (each as pass, file, class or claim). It drops any new finding that matches an entry, says how many it dropped and never passes earlier findings to the reviewer. (Intent: Constraints; Open question 3.)
- R16. `/review` reports Pre-existing findings in their own group, never counts them as Important and uses the summary-first format of R5. (Intent: Proposed outcome.)
- R17. `plugins/pro-ai-sdlc/commands/pr-babysit.md` changes its cap from five rounds to three in its heading, its Stop step and its Report step and on the cap stops and asks Jody to reconsider the approach, listing what is still open. (Intent: Proposed outcome; Open question 1.)
- R18. `/pr-babysit` does not treat a review thread as needing work when its comment is tagged Pre-existing; it lists such threads in its report. (Intent: Problem.)
- R19. `/pr-babysit` keeps a list of threads and checks it has already addressed, never answers a finding it already answered and never starts a round whose only open items repeat an earlier one. (Intent: Proposed outcome.)
- R20. When several open threads or failures in one round are the same class of problem, `/pr-babysit` fixes every instance in that round and replies once per thread with the same commit. (Intent: Problem.)
- R21. `tests/check.mjs` `sdlc-contract` gains assertions: the template has the headings "What failure looks like here", "Evidence", "Pre-existing" and "Rounds"; `reviewer.md` and `reviewer.toml` both name `Pre-existing` and `since`; `pr-babysit.md` names three rounds and not five. (Policy: REVIEW.md pass 3.)

### Non-functional

- N1. The reviewer stays read-only: its Bash use stays limited to `git diff`, `git log`, `git show`, `git merge-base` and `gh pr view` or `gh pr diff`.
- N2. The new text keeps the repo's writing rules: one sentence per line, no em dashes, no Oxford comma and no comma before "and" joining two clauses.
- N3. The changed command and agent prose stays harness-neutral where Codex reads it.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-ai-sdlc takes the next minor above the version on main when the plan is written (0.7.0 if this lands first, from 0.6.1) in both manifests and its marketplace entry, with `metadata.version` bumped once, all in the same commit.
- Codex parity (ADR-0004): the `reviewer.toml` twin changes with the agent (R14); `pr-babysit` and `review` are commands and have no twin.
- REVIEW.md pass 1: a command or agent that names a path or tag must match the file it points at (AC3).
- REVIEW.md pass 3: any departure from the plan is written into plan.md in the same PR.
- `CLAUDE.md`: no home-directory paths in the template, commands or agent files; text adapted from agent-skills keeps its footer and `docs/licenses.md` gains a row (AC8).
- Skills first (ADR-0001): no new hook is added; the rules are prose the reviewer follows and a test checks they are present.

## Design

### User experience

A review report now reads:

```
important: 1  nits: 2  pre-existing: 1  skipped: 0

Important
- Bugs, scripts/guard.py:88 - the empty payload path exits 1 and wedges the turn. Fails when stdin is empty.

Class: unchecked env var read, 3 places
- scripts/a.py:12, scripts/b.py:40, scripts/c.py:9 - ...

Nits
- ...

Pre-existing (not blocking)
- Bugs, scripts/old.py:31 - ...
```

A clean diff reads:

```
important: 0  nits: 0  pre-existing: 0  skipped: 0

Nothing to fix.
```

A second round on the same PR is `/review <pr> --since <last reviewed sha>`; the session says "2 findings dropped as already raised" when it removes repeats.
`/pr-babysit` ends at round three with the open items and a line asking whether to rethink the approach.

### System

Changed in pro-ai-sdlc: `templates/REVIEW.md`, `agents/reviewer.md`, `.codex-plugin/agents/reviewer.toml`, `commands/review.md`, `commands/pr-babysit.md`, both manifests.
Changed at the root: `.claude-plugin/marketplace.json`, `tests/check.mjs`, `docs/licenses.md` (a row for the adapted lists) and, if listed there, the pro-ai-sdlc description line in `README.md`.
The dedupe lives in the caller because the reviewer must stay fresh (brainstorm: "the reviewer never sees earlier findings"); the reviewer only needs the range and the tag rules.
The since-range is computed by the caller from the sha it recorded after the last round; without a recorded sha `/review` runs a full review and says so.
The rules in the reviewer and commands duplicate the template on purpose, so a repo with an old `REVIEW.md` still converges; the agent says the template wins when the two differ on a repo-specific item.

### Alternatives considered

- Put the rules only in the template: repos installed earlier keep the old file, so their reviews would not change until someone edits it by hand.
- Give the reviewer the earlier findings so it can skip them: breaks the fresh-context rule the brainstorm settles on and anchors its read on the author's fixes.
- A persistent findings file in the repo: needs a store, a format and cleanup; the stamp in the PR gate intent is the better home for cross-session memory.
- Keep five rounds: the brainstorm proposes three and an agent loop that runs longer than that has stopped converging.
- Make Pre-existing findings a nit: they would still count and could still block under a strict reading; a separate group removes the ambiguity.

## Flagged concerns

Sources read: the policies listed at the top.

ADR needed: yes, "a finding is never raised twice, old bugs never block and a fixed round cap" is a rule every reviewer and gate in the marketplace must follow and would be expensive to change once repos depend on it; to be drafted; number assigned when written.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The summary line moves from the end of the report to the start and gains a `pre-existing` field, so anything that parses the old tally breaks (no consumer is known today but `pr-check` and `code-reviewer` will parse it). | roadmap items 2 and 3; the sibling intents | open: change it now while nothing parses it (recommended) and give the sibling specs the exact line to read |
| 2 | The cap changes from five to three, but `/pr-babysit` rounds also fix failing checks and merge conflicts, which can need more than three tries. | brainstorm, Convergence; Jody | open: three for every round as the brainstorm says (recommended), with the report listing what is left so Jody can restart it |
| 3 | `/review` keeps its already-raised list only in the calling session, so a new session repeats findings. | brainstorm (pr-check dedupes against its stamp); intent/2026-10-29-pr-gate | open: accept for now (recommended) and let the stamp carry it across sessions |
| 4 | Pre-existing is judged from the diff and `git show` with no `git blame`, so a line an older commit in the same PR changed can be misread. | reviewer's Bash limits (N1) | open: judge by the range only (recommended); adding `git blame` is a later change |
| 5 | The same rules sit in the template, the agent, the Codex twin and two commands, so they can drift. | ADR-0004; Jody | open: the `check.mjs` assertions of R21 catch the key words (recommended); a shared sidecar is not possible because plugin files cannot be included across an agent file |
| 6 | Older repos keep an old `REVIEW.md` that lacks the new sections while `/review` reads the repo file before the template. | intent, Open question 4; Jody | open: the agent and commands carry the rules (recommended); a refresh offer from `/pro-dev update` is a separate change |
| 7 | The optional design-smell list and presumptive blockers overlap what the `code-reviewer` agent will carry, so the same list lives in two places. | intent/2026-10-29-code-reviewer | open: keep them only as commented optional blocks here (recommended) and let the agent own the active copy |
| 8 | The pro-ai-sdlc version bump collides with the constraint-floor spec, which also names 0.7.0 and metadata 1.60.0. | ADR-0002; Jody | open: whichever merges second takes the next number (recommended); the plan states the numbers at merge time |

## Open questions

1. The round cap: still open, owner Jody; the spec writes three (R17) as recommended.
2. Whether the count moves to the start of the report: answered, yes (R5, R13); confirm with Jody.
3. Where the already-raised list lives: answered, the calling session (R15); cross-session memory belongs to the PR gate intent.
4. Whether `/pro-dev` refreshes an older `REVIEW.md`: still open, owner Jody; left out of this change.
5. Commented blocks or a sidecar for the optional lists: answered, commented blocks (R7).
6. Likely needs an ADR: answered, yes (Flagged concerns).

## Acceptance criteria

- AC1. `node tests/check.mjs`, `node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70`, `node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC2. `grep -c "^## " plugins/pro-ai-sdlc/templates/REVIEW.md` shows the four new headings are present beside the original ones while `grep -c "<!--" plugins/pro-ai-sdlc/templates/REVIEW.md` shows the two optional blocks are commented out.
- AC3. `grep -l "Pre-existing" plugins/pro-ai-sdlc/agents/reviewer.md plugins/pro-ai-sdlc/.codex-plugin/agents/reviewer.toml plugins/pro-ai-sdlc/commands/review.md plugins/pro-ai-sdlc/commands/pr-babysit.md` lists all four files.
- AC4. The instruction text in `reviewer.md` and the `developer_instructions` in `reviewer.toml` differ only in the wrapper, shown by diffing the two bodies.
- AC5. `grep -n "five" plugins/pro-ai-sdlc/commands/pr-babysit.md` prints nothing and `grep -n "three rounds" plugins/pro-ai-sdlc/commands/pr-babysit.md` prints the cap lines.
- AC6. A manual run of `/review` on a fixture diff with one added bug, one bug in an untouched line and one bug repeated in three files prints the summary line first, one Important entry, one class entry listing three locations and one Pre-existing entry that is not in the important count; the run is shown in the PR.
- AC7. A manual second run with `--since <sha>` on the same PR reports nothing from the first range and prints a dropped count for any repeat; a run on a clean diff prints "Nothing to fix."
- AC8. `docs/licenses.md` has a pro-ai-sdlc row naming addyosmani/agent-skills as adapted for the optional lists and the template carries the upstream footer.
- AC9. `git diff --stat` shows `pro-ai-sdlc` at the same new version in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and its marketplace entry, with `metadata.version` bumped once.
- AC10. The `grep -c` checks for a comma before "and" and for the em dash print 0 on every changed file.

## Out of scope

The `code-reviewer` agent in pro-quality and its four-field handoff.
`/pro-ship:pr-check`, its stamp and the `gh pr create` hook.
The risk classifier, approval tiers, tier table and sensitive paths.
`CONSTRAINTS.md` and the floor guard.
The machine-readable scaling block in `REVIEW.md`.
Refreshing the `REVIEW.md` of repos that already have one.
`git blame` in the reviewer.
Cross-session memory of findings.
Later use of these rules: `pr-check` applies the same cap, the same Pre-existing tag and the same class naming then does the cross-round dedupe against its stamp.
`code-reviewer` reads the same `REVIEW.md`.
Each sibling spec owns that wiring.
