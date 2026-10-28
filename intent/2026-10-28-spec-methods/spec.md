---
intent: intent/2026-10-28-spec-methods/intent.md
intent-status: proposed
status: draft
created: 2026-10-28T10:30:00-0400
author: Jody Brewster
---

# Spec: swappable spec methods, starting with Elephant-Goldfish

Built from `intent.md` in this folder (commit 1e6668d).
Status: draft, reworked on 2026-10-28 after Jody's direction: "EGM should really be its own plugin. We should figure out a way to use it with larger sdlcs like the ai-sdlc plugin. I'd like to add a review step maybe and be able to customize the goldfish."
Jody then took the recommended shape: EGM stays Google's own plugin, a goldfish review is offered at both `/spec` and `/plan` and goldfish are customized per repo.
Jody tries EGM through the built pro-egm plugin rather than by hand (2026-10-28); the name stays in the `pro-*` family.
Policies and skills consulted: `CLAUDE.md`, `AGENTS.md`, `REVIEW.md`, `RELEASING.md`, `docs/decisions/0001` to `0006` (ADR-0006 in particular), `docs/version-bump-law.md`, `docs/codex-parity.md`, `docs/licenses.md`, the umbrella intent `intent/2026-10-27-pro-dev-simplify/intent.md`, the sibling intent `intent/2026-10-28-pro-speckit/intent.md` and the finished example `intent/2026-10-28-pro-dev-setup/spec.md`.
Code read to ground the design: `plugins/pro-core/registry/engines.json` (the three `kind: claude-plugin` companion rows), `plugins/pro-core/scripts/pro-dev.py` (`detected`, `engine_state`, `run_engine`, `covers_repo`), `plugins/pro-core/commands/pro-dev.md`, `plugins/pro-ai-sdlc/` (the `intent`, `spec`, `plan`, `review` and `execute` commands at HEAD, `templates/spec.md`, README and both manifests), `plugins/pro-spdd/` (manifest, commands and skills list), `plugins/pro-dev-starter/.claude-plugin/plugin.json`, `templates/install-companions.sh`, `tests/check.mjs` (the `bridges`, `registry` and `pro-dev-starter` checks and the `BRIDGES` and `OPT_IN` lists), `tests/cases/routing.jsonl`, `.claude-plugin/marketplace.json` and the shape of `claude plugin list --json`.
No `DESIGN.md`, `SECURITY.md` or compliance skill under `.claude/skills/` exists in this repo.
Upstream facts verified on GitHub on 2026-10-28 (README, `.claude-plugin/plugin.json`, `LICENSE`, `skills/egm-review/SKILL.md`, `skills/egm-review-loop/SKILL.md`, `skills/egm-draft/SKILL.md`, `.claude-plugin/agents/design_critic.md`):
- the plugin and marketplace are both named `egm`; install is `claude plugin marketplace add google/elephant-goldfish-model` then `claude plugin install egm@egm`; Codex install is `codex plugin marketplace add google/elephant-goldfish-model` then `codex plugin add egm@egm`;
- the license is Apache-2.0 with no copyright line of its own; the manifest has `"version": "0.1.0"`, nine agents and no hooks or MCP servers;
- skills are `egm-brainstorm`, `egm-draft`, `egm-resolve`, `egm-bootstrap`, `egm-review`, `egm-review-loop` and `egm-drift-report`, called as `/egm:<skill>` in Claude Code; its agents declare `model: inherit`;
- `egm-review-loop` takes `TargetFile`, `SemanticTarget`, `Reviewers`, `Standards` and `GoldfishContext`, asks only for missing inputs and confirms them before it starts;
- a reviewer or standard name containing a `/` is read as an absolute or workspace-relative path, so a repo can supply its own goldfish persona and standard files;
- each round it saves `goldfish_review_report.md`, applies the fixes the person approves to `TargetFile` and stops after two clean rounds or a cap of five.

## Summary

EGM stays Google's plugin, `egm@egm`, installed as Google ships it.
Each spec-driven method is its own opt-in plugin.
A method plugin ships one small `sdlc-method.json` that names where it hands off in the loop.
pro-ai-sdlc reads those files from whichever pro-dev-skillset plugins are installed for the repo and offers the hand-offs at its stages.
It never runs them on its own.
With no method installed it prints nothing new.
A new `pro-egm` plugin holds only the glue: an `egm-bridge` skill, a `/goldfish` command, two starter goldfish and its `sdlc-method.json`.
`/goldfish` runs EGM's `egm-review-loop` on our own `spec.md` or `plan.md` with the reviewers a repo picks for that stage.
`/spec` offers it on the draft spec before the commit and `/plan` offers it on the draft plan.
A repo customizes its goldfish in `.egm/`: persona and standard files plus a `goldfish.json` naming the reviewers for each stage.
A registry row lets `/pro-dev install` install `egm@egm`, registering its marketplace first and saying what the plugin carries.
pro-spdd gains its own `sdlc-method.json` so it is reachable from the same table without changing its commands.
No EGM design doc replaces or stands beside `spec.md`.

## Requirements

### Functional

- R1. A new plugin `plugins/pro-egm/` ships `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` at the same version, `skills/egm-bridge/SKILL.md`, `commands/goldfish.md`, `scripts/goldfish.py`, `goldfish/policy.md`, `goldfish/scope.md`, `goldfish/policy-standard.md`, `goldfish/scope-standard.md`, `sdlc-method.json` and a marketplace entry; it has no hooks and no agents. (Jody: "EGM should really be its own plugin"; intent: "A new pro-egm bridge plugin carries a thin skill")
- R2. `egm-bridge` says when to reach for a goldfish review (a spec or plan with real design choices), how it fits the loop, how to customize goldfish in `.egm/`, that `/pro-dev install` installs `egm@egm` in Claude Code and the two Codex install commands for the person to run; it quotes no EGM skill text. (intent: "a thin skill", constraint "no EGM text in this repo")
- R3. `plugins/pro-core/registry/engines.json` gains one row: `id` `egm`, `owner` `pro-egm`, `bridges` `["egm-bridge"]`, `kind` `claude-plugin`, `default` `true`, `detect` `{ "plugin": "egm@egm" }`, `install` `["claude", "plugin", "install", "egm@egm", "--scope", "project"]` and `update` `["claude", "plugin", "update", "egm@egm", "--scope", "project"]`; the registry `version` goes up by one. (intent: "a registry row so /pro-dev install installs egm@egm")
- R4. A registry row may carry an optional `marketplace` object `{ "name": "<name>", "source": "<owner>/<repo>" }`.
  Before running that row's `install`, `pro-dev.py` runs `claude plugin marketplace add <source>` when no marketplace of that name is registered.
  When one of that name is registered with a different source, it refuses the row and prints both sources.
  The `egm` row sets `{ "name": "egm", "source": "google/elephant-goldfish-model" }`. (Flagged concern 1; security challenge)
- R5. The `registry` check in `tests/check.mjs` fails when a `marketplace` object lacks a string `name` or has a `source` not of the form `owner/repo`.
- R6. Before `/pro-dev install` or `update` runs a `claude-plugin` row that is not yet installed, it prints the plugin's surface from its manifest: agents, skills, hooks and MCP servers, by count.
  The row pins the reviewed surface (counts, the tools of each agent, skill and command and a hash of every hook, MCP, LSP and `!` line declaration); a surface beyond the pin, or one that cannot be read, turns the install or update into a question; `/pro-dev check` names an installed plugin that has grown past it. (security challenge, required change 2; plan security challenge, changes 1 to 4)
- R7. A method plugin's `sdlc-method.json` holds `method` (a short id), `requires` (a plugin id such as `egm@egm`, or `null`) and `handoffs`, a list of `{ "stage", "when", "offer" }` where `stage` is one of `intent`, `spec`, `plan` or `review` and `offer` is a slash command with an optional `{target}` placeholder for the file the stage just drafted. (intent: "routes to them at defined points")
- R8. pro-ai-sdlc ships `scripts/methods.py`.
  Given `--stage <stage>`, `--target <path>` and the repo root, it reads `claude plugin list --json`, keeps enabled `*@pro-dev-skillset` installs that cover the repo (user scope, or a `projectPath` at or under the repo root), reads `sdlc-method.json` from each `installPath` and prints one line per hand-off for that stage, with `{target}` replaced by the given path. (intent: "it checks which methods are installed... with no edits needed when one is added or removed")
- R9. When a method's `requires` plugin is not installed and enabled for the repo, `methods.py` prints that method's line as "needs <plugin>: run /pro-dev install" in place of its offers.
- R10. `intent.md`, `spec.md`, `plan.md` and `review.md` in pro-ai-sdlc each call `methods.py` for their stage; when it prints hand-offs they offer each one to the person once as a yes or no question at the point named in R11 or R16; on no or with nothing printed they run exactly as today. (intent: "pro-ai-sdlc stays the default loop and becomes the coordinator")
- R11. pro-egm's `sdlc-method.json` declares `requires` `egm@egm` and two hand-offs:
  - `spec`: after `spec.md` is drafted and before it is committed, offer `/pro-egm:goldfish {target} --stage spec`.
  - `plan`: after `plan.md` is drafted and before it is committed, offer `/pro-egm:goldfish {target} --stage plan`.
  (Jody: "add a review step maybe"; settled 2026-10-28 as both stages)
- R12. `/pro-egm:goldfish <file> [--stage spec|plan]` runs `goldfish.py resolve`, shows the resolved reviewers, standards and reading list and then runs `/egm:egm-review-loop` with `TargetFile` the file, `SemanticTarget` `full file` and the resolved `Reviewers`, `Standards` and `GoldfishContext`, so EGM asks for nothing it already has.
  When `--stage` is omitted it is `spec` for a file named `spec.md` and `plan` for `plan.md`; any other file needs `--stage`.
- R13. `goldfish.py resolve --stage <stage> --target <path>` prints the review inputs as JSON.
  When `.egm/goldfish.json` exists at the repo root it uses that stage's `reviewers`, `standards` and `context` from it.
  Otherwise it uses pro-egm's defaults:
  - `spec`: `zoom_out` (`zoom-out-standard`), `design_critic` (`feature-spec-standard`) and the starter `policy` and `scope` goldfish.
  - `plan`: `implementation_readiness` (`implementation-readiness-standard`), `codebase_details` (`implementation-readiness-standard`) and the starter `scope` goldfish.
  The reading list is always the target's sibling `intent.md`, `spec.md` when the target is a plan and whichever of `REVIEW.md`, `CLAUDE.md` and `AGENTS.md` exist at the root. (Jody: "be able to customize the goldfish")
- R14. In `.egm/goldfish.json`, a reviewer or standard is either an EGM shortname (lowercase letters, digits, `_` and `-`) or a repo-relative path to a regular file under `.egm/`; `goldfish.py` refuses an absolute path, a path with `..`, a symlink or a file outside `.egm/` and names the bad entry. (security challenge, required change 4 carried to the new paths)
- R15. `/pro-egm:goldfish init` copies the starter goldfish and their standards into `.egm/reviewers/` and `.egm/standards/` and writes a `.egm/goldfish.json` that lists the defaults with those copies in place of the plugin's; it never overwrites an existing file.
- R16. The starter goldfish are this repo's own text.
  `policy` reads the target with no history and reports each place it conflicts with the reading list's REVIEW.md, CLAUDE.md or AGENTS.md.
  `scope` reports each requirement, step or file that does not trace to a line of the sibling `intent.md` and each line of the intent that nothing covers.
- R17. After a goldfish review, `/spec` and `/plan` keep the fixes EGM applied to the draft, list each open Blocker or Major finding under the spec's Flagged concerns or the plan's Risks and commit only the spec or plan as today; `goldfish_review_report.md` is left untracked where EGM wrote it and the command names its path. (intent success line: "the review's findings land beside the spec")
- R18. pro-spdd ships `sdlc-method.json` with `method` `spdd`, `requires` `null` and one `intent` hand-off: for a client or team-facing structured spec, offer `/spdd-story`; no pro-spdd command or skill changes. (intent: "pro-spdd keeps its own flow and is reachable from the same routing table")
- R19. `tests/check.mjs` gains a `methods` check that fails when an `sdlc-method.json` is not valid JSON, has a `stage` outside the four, an `offer` that does not start with `/` or a `requires` that is neither `null` nor a `name@marketplace` string.
- R20. `tests/` gains behavior cases, run with a fake `claude` on `PATH` and a temp `HOME` like `tests/pro-dev.mjs`:
  - for `methods.py`: no method installed prints nothing; pro-egm with `egm@egm` prints its offer for `spec` and `plan` with the target filled in and nothing for `intent`; pro-egm without `egm@egm` prints the needs line; a disabled or uncovering install is ignored; a non-pro-dev-skillset plugin with an `sdlc-method.json` is ignored; malformed JSON is skipped with one warning line;
  - for `goldfish.py`: defaults per stage; a valid `.egm/goldfish.json` is used; each refused path form in R14 fails with the entry named; `init` writes the files and leaves an existing one untouched.
- R21. `egm-bridge` is added to `BRIDGES` and `pro-egm` to `OPT_IN` in `tests/check.mjs`; pro-egm is not a dependency of pro-dev-starter.
- R22. `docs/licenses.md` gains the row `pro-egm | egm-bridge | google/elephant-goldfish-model | Apache-2.0 | no copyright line in the upstream LICENSE | bridged`.
- R23. `tests/cases/routing.jsonl` gains at least one case expecting `egm-bridge`; the `using-pro-dev` router names pro-egm beside the pro-spdd branch.
- R24. pro-egm, pro-ai-sdlc, pro-spdd, pro-core and pro-dev-starter bump per the version-bump law; pro-egm starts at `0.1.0`.

### Non-functional

- N1. With only pro-ai-sdlc installed, the four commands' output differs from today by nothing: `methods.py` prints nothing and the command prose adds no line. (intent: "pro-ai-sdlc must work unchanged when no other method is installed")
- N2. `methods.py` exits 0 and prints nothing when `claude` is missing, `claude plugin list --json` fails or its output is not the expected shape, so a broken listing never breaks the loop.
- N3. `methods.py` and `goldfish.py` need only `python3` and the standard library, run no network call and finish in under two seconds on a machine with 50 installed plugins; `methods.py` writes nothing and `goldfish.py` writes only under `.egm/` during `init`.
- N4. Offers are text the person accepts; no hand-off runs without a yes; no hook runs one.
  The offer says the review runs several subagents on the session model.
- N5. `sdlc-method.json` content is treated as data: `methods.py` prints only the `method`, `when` and `offer` fields, trimmed to one line each; it never executes them.

### Policy constraints applied

- Version-bump law (ADR-0002): pro-core (registry row, `pro-dev.py`), pro-ai-sdlc (commands, script), pro-spdd (new file), pro-dev-starter (dependencies bumped) and the new pro-egm each bump both manifests and their marketplace entries, plus `metadata.version` once; pro-ai-sdlc and pro-core take a minor bump, pro-spdd and pro-dev-starter a patch.
- Hook-loading law (ADR-0003): no hook is added; pro-egm ships no `hooks/hooks.json`.
- Codex parity (ADR-0004): pro-egm is skill-bearing, so it ships a version-aligned `.codex-plugin/plugin.json` and harness-neutral skill prose; `/goldfish` and the pro-ai-sdlc hand-offs are Claude Code only; the skill tells a Codex user how to call `egm-review-loop` with the `.egm/` files (Flagged concern 3).
- ADR-0006 engine registry: EGM is a registry row in pro-core, pro-egm ships no install command and `egm@egm` installs only when the person runs `/pro-dev`.
- No hard dependency on another marketplace (PR 44): `egm@egm` appears in a registry row and in `requires`, never in a manifest `dependencies` array.
- Bridges over vendoring: pro-egm links EGM and names its skills and shortnames; the starter goldfish are original text, so it needs no plugin `LICENSE`.
- REVIEW.md pass 2: `methods.py` reads only `*@pro-dev-skillset` manifests (N5, R8); `goldfish.py` confines custom paths to `.egm/` (R14); no command gains a broad `allowed-tools` pattern.
- REVIEW.md pass 3: `docs/licenses.md` gains the bridged row (R22); the method contract comes with an ADR (Flagged concerns).
- RELEASING.md: each bumped plugin gets its `docs/releases.md` row and a tag after merge.
- Writing rules from `CLAUDE.md`: skill, command and doc prose has no em dashes, no Oxford comma and straight quotes.

## Design

### User experience

A site that wants goldfish review installs pro-egm, then runs `/pro-dev install`.
`/pro-dev` lists `egm` with its why line and what it carries ("9 agents, 7 skills, no hooks, no MCP servers"), registers the `egm` marketplace if needed and installs `egm@egm` at project scope.
From then on `/spec`, after its draft and before its commit, asks: "Run a goldfish review of this spec? It runs several subagents on the session model."
On yes, `/pro-egm:goldfish` shows the reviewers it will use and EGM runs its loop: fresh reviewers read only the spec and its reading list, the person accepts or contests each finding and EGM edits the spec in place.
`/spec` then lists any open Blocker or Major finding under Flagged concerns, commits the spec and says where the report is.
`/plan` makes the same offer for the plan, with reviewers that check the plan against the real code.
To change the reviewers, the person runs `/pro-egm:goldfish init`, edits `.egm/reviewers/policy.md` or adds a new persona file and lists it in `.egm/goldfish.json`.
`/pro-egm:goldfish <file>` also works on its own, outside the loop, on any Markdown file.
If pro-egm is installed but `egm@egm` is not, `/spec` and `/plan` print one line: "pro-egm needs egm@egm: run /pro-dev install".
Uninstall pro-egm and none of these lines appear.
pro-spdd sites see one offer at `/intent` for client or team-facing structured work.

A `.egm/goldfish.json` after `init`:

```json
{
  "spec": {
    "reviewers": ["zoom_out", "design_critic", ".egm/reviewers/policy.md", ".egm/reviewers/scope.md"],
    "standards": {
      "zoom_out": "zoom-out-standard",
      "design_critic": "feature-spec-standard",
      ".egm/reviewers/policy.md": ".egm/standards/policy-standard.md",
      ".egm/reviewers/scope.md": ".egm/standards/scope-standard.md"
    },
    "context": []
  },
  "plan": {
    "reviewers": ["implementation_readiness", "codebase_details", ".egm/reviewers/scope.md"],
    "standards": {
      "implementation_readiness": "implementation-readiness-standard",
      "codebase_details": "implementation-readiness-standard",
      ".egm/reviewers/scope.md": ".egm/standards/scope-standard.md"
    },
    "context": []
  }
}
```

`context` adds files to the reading list that R13 always builds.

### System

New:

- `plugins/pro-egm/`: two manifests, `skills/egm-bridge/SKILL.md`, `commands/goldfish.md`, `scripts/goldfish.py`, the four starter files under `goldfish/`, `sdlc-method.json` and a marketplace entry.
- `plugins/pro-ai-sdlc/scripts/methods.py`: the discovery script (R8, R9, N2 to N5).
- `plugins/pro-spdd/sdlc-method.json` (R18).
- A `methods` check in `tests/check.mjs` and case tables for `methods.py` and `goldfish.py` in `tests/` (R19, R20).

Changed:

- `plugins/pro-core/registry/engines.json`: the `egm` row and a version bump (R3, R4).
- `plugins/pro-core/scripts/pro-dev.py`: the marketplace step with its source check (R4) and the plugin surface line and new-surface warning (R6); cases in `tests/pro-dev.mjs` cover both.
- `plugins/pro-ai-sdlc/commands/{intent,spec,plan,review}.md`: one call to `methods.py` and one short step each for the offer (R10, R17); `allowed-tools` gains the exact `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/methods.py"` pattern, as `/execute` does for its scripts.
- `plugins/pro-ai-sdlc/README.md`: a "Spec methods" section naming the contract.
- `tests/check.mjs` lists (R21), `tests/cases/routing.jsonl` and the `using-pro-dev` router (R23), `docs/licenses.md` (R22), `docs/releases.md`, `README.md`.

`/spec` and `/plan` call `methods.py` after their draft exists, since the offer needs the target path; `/intent` and `/review` call it in their Context block.
`methods.py` repeats the small covers-the-repo rule from `pro-dev.py` rather than importing it, since pro-ai-sdlc does not depend on pro-core and the script path differs per install.
`claude plugin list --json` already gives `id`, `scope`, `enabled`, `projectPath` and `installPath`, so no cache folder is walked.
`goldfish.py` passes the starter goldfish to EGM as absolute paths under the pro-egm `installPath` when the repo has no `.egm/goldfish.json`, which EGM reads as custom paths.
The `egm` row defaults to `true` because installing pro-egm is the opt-in; R6 makes what it installs visible instead of asking a second time.
EGM's agents declare `model: inherit`, so its goldfish run on the session's model, which for `/spec` and `/plan` is Opus under the model split.

Intent E's pro-speckit adds its own `sdlc-method.json` with no change to pro-ai-sdlc, which is the test of R8.

### Alternatives considered

- A routing table inside pro-ai-sdlc listing every method: simple to read, but adding or removing a method edits pro-ai-sdlc, which the intent rules out.
- Detecting methods from the skill list the session already shows: needs no script, but the model decides what counts as installed, so the "behaves as today" line cannot be tested.
- Letting an EGM design doc stand in for `spec.md`, the first draft of this spec: it kept two documents for one decision and needed `design:` path rules in `/plan` and `/review`; reviewing our own spec and plan gets EGM's value with one document.
- Moving EGM's report files into the intent folder and committing them, the first draft of this spec: the move needed a root snapshot and file rules to avoid committing unrelated reports, while the findings that matter already land in the spec or plan.
- Running `/egm:egm-review`, the full nine-persona pipeline, at `/spec`: thorough, but its fixed stages ignore a repo's custom goldfish and cost far more than a focused loop.
- Forking EGM to add our own personas: `egm-review-loop` already reads persona and standard files by path, so a fork buys nothing and loses upstream updates.
- Brainstorm at `/intent` and drift report at `/review`, in the first draft of this spec: both tie the loop to an EGM design doc, which this version drops; either can come back as a later hand-off.
- A manifest `dependencies` entry on `egm@egm`: ruled out by PR 44.
- Running the goldfish review automatically in `/spec`: it spends several subagent runs every time and the intent asks for an offer.

## Flagged concerns

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | `egm@egm` lives in its own marketplace, which a registry row cannot register: a row has one `install` argv and the existing `claude-plugin` rows lean on `templates/install-companions.sh` to add `claude-plugins-official`. Without a fix `/pro-dev install` fails on the `egm` row on every fresh machine. | ADR-0006, `plugins/pro-core/scripts/pro-dev.py`, Jody | settled 2026-10-28 (Jody took the recommendations): the optional `marketplace` row field (R4, R5) with `source` limited to `owner/repo` and checked against a registered marketplace of the same name, recorded in the new ADR as an amendment to ADR-0006's row shape. |
| 2 | The intent lets an EGM design or spec-kit spec "stand in for spec.md", but `/spec` exists to check the change against the repo's policies and `/plan` finds its input by the presence of `spec.md`. | `plugins/pro-ai-sdlc/commands/spec.md`, REVIEW.md pass 3, Jody | settled 2026-10-28: no stand-in; EGM reviews our own `spec.md` and `plan.md` (R11, R12). Intent E decides separately how a spec-kit spec relates. |
| 3 | pro-ai-sdlc is Claude Code only, so the hand-offs never appear in Codex, while EGM also ships for Codex and `/pro-dev` installs only through `claude plugin install`. | ADR-0004, umbrella item G, Jody | settled 2026-10-28: the bridge prints the two Codex install commands and how to pass the `.egm/` files to `egm-review-loop` (R2); registry install for Codex waits on item G. |
| 4 | EGM writes `goldfish_review_report.md` in the working directory, while `/spec` and `/plan` commit only their one file. | intent success line, `plugins/pro-ai-sdlc/commands/spec.md` step 5, Jody | settled 2026-10-28: the report stays untracked; open findings are copied into the spec or plan (R17), so no command stages another file. |
| 5 | EGM's goldfish agents declare `model: inherit` and a loop runs up to five rounds of several reviewers, while the model split asks for an explicit model on every subagent and Jody watches weekly usage. | `~/.claude/CLAUDE.md` model split, `CLAUDE.md` Model split, Jody | settled 2026-10-28: accept `inherit` (it is Opus in `/spec` and `/plan`, the reviewer role) and say in the offer that it runs several subagents on the session model (N4). |
| 6 | `RELEASING.md` says a meta-plugin is bumped when a plugin it depends on is bumped, but PR 63 bumped pro-ai-sdlc without bumping the starter; this change bumps pro-ai-sdlc and pro-core, both pro-dev-starter dependencies. | RELEASING.md, Jody | settled 2026-10-28: bump pro-dev-starter by a patch in the same PR (R24). |
| 7 | A repo's custom goldfish are prompt files EGM hands to subagents; on a contributor's branch `.egm/` could carry a persona that tells a reviewer to read secrets or a path that points outside the repo. | REVIEW.md pass 2, Jody | settled 2026-10-28: paths are confined to `.egm/` (R14) and the resolved list is shown before the run (R12); the review is only offered at `/spec` and `/plan`, on the author's own draft, never at `/review` on someone else's PR. |

ADR needed: yes, it sets the contract every future method plugin follows and widens ADR-0006's row shape with a third-party `marketplace` field.
Drafted as [ADR-0007](../../docs/decisions/0007-spec-method-plugins.md) (proposed).
It would decide that a spec method is an opt-in plugin shipping an `sdlc-method.json` of stage hand-offs, discovered at run time, offered and never run on its own and never replacing `spec.md`.
It would also decide that a registry row may name a third-party marketplace to register before install, that `/pro-dev` shows a third-party plugin's surface before installing it and that intent E is the second method that must fit without touching pro-ai-sdlc.

## Security challenge

From a fresh-context `security-architect` challenge of the first draft of this spec on 2026-10-28.
The rework above changes the design it reviewed, so each item carries a note on where it now stands.

Verdict: proceed with required changes.

### Required changes

- [7/10] R11 of the first draft moved report files from the repo root into the intent folder and committed them, which could sweep in an unrelated gitignored report. Now: dropped; no report is moved or staged (R17, Flagged concern 4).
- [7/10] The `egm` row is `default: true`, so `/pro-dev install` installs a third-party plugin with no question and `/pro-dev update` pulls upstream with no pin. Now: kept `default: true` because installing pro-egm is the opt-in, with R6 printing the plugin's surface before install and flagging a new hook or MCP server after an update; the ADR records the choice.
- [6/10] R4 checked only the marketplace name. Now: the registered source must match the row (R4).
- [6/10] `design:` let a PR point `/plan` and `/review` at any local path. Now: `design:` is gone; the same rule applies to the new custom goldfish paths (R14).
- [6/10] The report move needed a broad `mv` in `allowed-tools`. Now: nothing is moved and `allowed-tools` gains only the exact `methods.py` pattern.

### Open questions from the challenge

- What tools do EGM's goldfish agents declare? Now: the review runs only on the author's own draft, never on a PR (Flagged concern 7); the agents' tools are listed in the plan and shown by R6.
- `claude plugin marketplace add` writes user-wide config, while `pro-dev.py` says its writes stay inside the repo. The ADR accepts it for rows that name a marketplace and the script's docstring says so.
- N5 trims `when` and `offer` to one line, but that text still lands in the model's prompt; only `*@pro-dev-skillset` plugins can supply it; the ADR states that limit (R20 keeps the "non-pro-dev-skillset plugin is ignored" case).

A second challenge runs on the plan, since `goldfish.py` and the custom goldfish paths are new since this one.

## Open questions

1. Needs intent B's registry; does C wait for B? Answered: no wait. B merged in PR 65 (commit 97558ea, marketplace 1.51.0) and `engines.json`, `pro-dev.py` and the `kind: claude-plugin` rows exist on `main`.
2. The exact hand-off points. Answered 2026-10-28: a goldfish review at `/spec` and at `/plan` (R11) plus the `/spdd-story` offer at `/intent` for pro-spdd (R18).
3. Where an EGM design doc lives relative to `intent/<date>-<slug>/`. Answered 2026-10-28: there is no separate EGM design doc; EGM reviews `spec.md` and `plan.md` in place.
4. Likely needs an ADR: answered yes; drafted as ADR-0007 with Jody's reversal condition.
5. The default reviewers per stage (R13) and the starter goldfish (R16): built as specified; Jody tunes them in `.egm/goldfish.json` after first use through pro-egm. Candidates already raised: a `docs` goldfish at the plan stage and an optional security goldfish. Owner: Jody.

## Acceptance criteria

- AC1. With only pro-dev-starter installed in a temp repo, `/intent`, `/spec`, `/plan` and `/review` print nothing about methods and `methods.py --stage spec` prints nothing.
- AC2. After installing pro-egm at project scope and running `/pro-dev install` on a machine without the `egm` marketplace, `/pro-dev` printed the plugin's surface, `claude plugin marketplace list` shows `egm`, `claude plugin list --json` shows `egm@egm` enabled for the repo and `/pro-dev check` reports `egm` installed.
- AC3. In that repo `/spec` offers the goldfish review; on yes EGM runs with the default spec reviewers without asking for inputs, the committed spec carries the accepted fixes and lists any open Blocker or Major finding and `goldfish_review_report.md` is untracked.
- AC4. `/plan` in that repo offers the review with the plan reviewers.
- AC5. After `/pro-egm:goldfish init` and an edit to `.egm/goldfish.json` that drops `zoom_out`, the next `/spec` review runs without it; an entry of `../x.md` is refused with that entry named.
- AC6. With pro-egm installed and `egm@egm` uninstalled, `/spec` prints "pro-egm needs egm@egm: run /pro-dev install" and otherwise runs as today.
- AC7. After `claude plugin uninstall pro-egm@pro-dev-skillset`, `/spec` makes no goldfish offer and no other file changed.
- AC8. With pro-spdd installed, `methods.py --stage intent` prints the `/spdd-story` offer.
- AC9. `node tests/check.mjs && node tests/eval.mjs --dry`, `claude plugin validate . --strict` and the per-plugin strict loop pass, with the `methods` check listed and the R20 cases green.
- AC10. No text in `plugins/pro-egm` is copied from the upstream skills or agents; `docs/licenses.md` has the pro-egm row.

## Out of scope

- The pro-speckit plugin and its `sdlc-method.json` (intent E).
- Any change to pro-spdd's commands or skills.
- Choosing one method over another or making any method the default in place of pro-ai-sdlc.
- EGM's brainstorm, draft and drift-report flows inside the loop; they stay available as `/egm:` commands.
- Installing EGM for Codex from the registry (umbrella item G).

<!-- Accepting this spec is the signal to start planning. Leave the plan to plan.md. -->
