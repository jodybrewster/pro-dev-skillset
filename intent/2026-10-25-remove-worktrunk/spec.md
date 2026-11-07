---
intent: intent.md
intent-status: accepted
status: draft
created: 2026-11-07T10:36:35-05:00
author: the maintainer
---

# Spec: remove worktrunk from the stack

Built from `intent.md` in this folder (commit 45c6672).
Status: draft.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `docs/decisions/0002-version-bump-law.md`, `docs/decisions/0004-codex-parity.md`, `docs/decisions/0013-plugin-layering.md`, `.claude-plugin/marketplace.json`, `templates/install-companions.sh`, `plugins/pro-core/skills/using-pro-dev/SKILL.md`, `plugins/pro-execution/skills/using-git-worktrees/SKILL.md`.

## Summary

The marketplace carries no reference to worktrunk as a tool to install or a skill to route to, so parallel work routes to `using-git-worktrees` alone and `install-companions.sh` installs only the three `claude-plugins-official` companions.
A survey of the repo on 2026-11-07 found that this end state already holds: there is no `worktrunk` literal and no standalone `wt` token anywhere under `plugins/`, `templates/`, `README.md` or `.claude-plugin/`.
This spec therefore records the removal as a verification of the end state rather than fresh deletion work, and flags that the intent's premise has been overtaken by later changes.

## Assumptions

Marked unconfirmed; nobody was available to answer.

1. Stack: a Claude Code plugin marketplace with a Codex-parity sibling per plugin, no app, no server, no database.
2. The only tool a user installs for parallel work is the harness-native worktree support that `using-git-worktrees` points at; worktrunk is not installed by anything this repo ships.
3. The cross-marketplace allowlist (`allowCrossMarketplaceDependenciesOn`) should name only `claude-plugins-official`.
4. Historical mentions of worktrunk outside the grep scope (`CLAUDE.md` "things Claude gets wrong", `docs/troubleshooting.md`, the comment in `tests/check.mjs`, past intents) stay, because they record why the `*` cross-marketplace check exists.
5. The developer removes the `worktrunk@worktrunk` plugin, its marketplace and the Homebrew formula from the machine by hand after merge; that is out of this repo's reach.

## Requirements

### Functional

- R1. `rg -n -i 'worktrunk|\bwt\b' plugins templates README.md .claude-plugin` returns no match (intent "Success looks like", first line).
- R2. The `using-pro-dev` router sends parallel work only to `using-git-worktrees` and names no worktrunk route (intent "Proposed outcome", second line).
- R3. `templates/install-companions.sh` installs the three `claude-plugins-official` companions (`vercel`, `figma`, `playwright`) and no worktrunk block (intent "Proposed outcome", third line).
- R4. `.claude-plugin/marketplace.json` lists only `claude-plugins-official` under `allowCrossMarketplaceDependenciesOn` (intent "Problem", the cross-marketplace allowlist).
- R5. The `using-git-worktrees` skill in pro-execution stays in place and harness-neutral (intent "Constraints").

### Non-functional

- N1. `node tests/check.mjs && node tests/eval.mjs --dry` pass (intent "Success looks like").
- N2. `claude plugin validate . --strict` and the per-plugin validation loop pass (intent "Success looks like").

### Policy constraints applied

- Version-bump law (ADR-0002): a content change under `plugins/<name>/` bumps that plugin in both manifests and its marketplace entry plus `metadata.version` in the same commit; if planning finds no content change left to make, there is nothing to bump and the law does not fire.
- Codex parity (ADR-0004): any edit to a skill keeps harness-neutral prose and a version-aligned `.codex-plugin/plugin.json`; `using-git-worktrees` and `using-pro-dev` are already neutral and nothing here changes that.
- Layering (ADR-0013): `using-git-worktrees` stays in pro-execution and the router stays in pro-core; no skill moves.

### Boundaries

Always: read the repo to confirm the end state, run the check and validate commands.
Ask first: any version bump or manifest edit, since the survey shows no content deletion is outstanding.
Never: remove, rewrite or weaken `using-git-worktrees`; strip historical worktrunk mentions from `CLAUDE.md`, `docs/`, `tests/` or past intents; touch pro-starter's dependency list (separate intent).

## Design

### User experience

No user-facing surface changes.
A user asking for parallel work is routed to `using-git-worktrees`, which already holds for every path the router lists.
A user running `install-companions.sh` installs `vercel`, `figma` and `playwright` only, with no silent worktrunk failure on a fresh machine.

### System

The survey on 2026-11-07 (ripgrep over `plugins/`, `templates/`, `README.md`, `.claude-plugin/`) found:

- No `/worktrunk` command in pro-execution; the plugin has no `commands/` directory and its only worktree surface is `skills/using-git-worktrees/SKILL.md`.
- No `wt` route in `plugins/pro-core/skills/using-pro-dev/SKILL.md`; parallel work routes to `using-git-worktrees` at line 31.
- No worktrunk prerequisite or table row in `README.md`.
- `allowCrossMarketplaceDependenciesOn` in `.claude-plugin/marketplace.json` holds only `claude-plugins-official`.
- `templates/install-companions.sh` installs `vercel`, `figma` and `playwright` and nothing else.

Each removal the intent lists was already made by later changes (the rename and simplify work that moved pro-execution to 0.7.2 and pro-core to 0.25.0, both past the 0.4.0 and 0.15.3 targets the intent named).
Planning should confirm the above against the live tree, run the check and validate commands and, finding nothing left to delete, close the intent as already satisfied with no code change and no version bump.
If planning instead finds a stray reference the survey missed, it removes that reference and applies the version-bump law to the plugin it sits in.

### Alternatives considered

- Delete-then-bump as the intent's version targets imply (pro-execution to 0.4.0, pro-core to 0.15.3): rejected, those versions are already behind the live tree and there is nothing left to delete.
- Rewrite the intent to a fresh survey-and-close task: rejected, the intent stands as written and the spec records the overtaken premise under Flagged concerns instead.

## Flagged concerns

ADR needed: no, the change sets no rule other work must follow and reverses nothing expensive; the removal is already in the tree.

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The intent's premise is overtaken: every worktrunk/`wt` reference it set out to remove is already gone from `plugins/`, `templates/`, `README.md` and `.claude-plugin/`. | the maintainer | open, surfaced here; planning should confirm the survey and close the intent as already satisfied rather than schedule deletions. |
| 2 | The intent targets pro-execution 0.4.0 and pro-core 0.15.3; the live tree is at 0.7.2 and 0.25.0, so those bump targets are stale and the version-bump law has nothing to fire on if no content changes. | ADR-0002, the maintainer | open, surfaced here; apply the law only if planning finds a real content change. |

## Open questions

- From the intent: none were left open.
- New, raised here: should the intent be closed as already satisfied once the survey and the check/validate commands pass, or held open pending a deliberate verification PR? Waiting on the maintainer.

## Acceptance criteria

- AC1. `rg -n -i 'worktrunk|\bwt\b' plugins templates README.md .claude-plugin` returns no match.
- AC2. The `using-pro-dev` router names only `using-git-worktrees` for parallel work and no worktrunk route.
- AC3. `templates/install-companions.sh` installs `vercel`, `figma` and `playwright` and no worktrunk block.
- AC4. `allowCrossMarketplaceDependenciesOn` in `.claude-plugin/marketplace.json` lists only `claude-plugins-official`.
- AC5. `node tests/check.mjs && node tests/eval.mjs --dry`, `claude plugin validate . --strict` and the per-plugin validation loop all pass.

## Out of scope

- Uninstalling the `worktrunk@worktrunk` plugin, its marketplace and the Homebrew formula from the developer's machine.
- Trimming pro-starter's dependency list to a stack-agnostic set (separate intent).
- Removing historical worktrunk mentions in `CLAUDE.md`, `docs/troubleshooting.md`, `tests/check.mjs` or past intents.

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
