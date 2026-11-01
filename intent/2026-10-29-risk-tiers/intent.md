---
source: idea
kind: change
status: done
risk: high
created: 2026-10-29T19:00:00-0400
author: Jody Brewster
---

# Intent: risk classifier and approval tiers

Author: Jody Brewster (pro-dev-skillset).
Source: idea, item 4 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md), from the pro-ship brainstorm ([risk gate](../2026-10-28-pro-ship-scope/brainstorm.md#risk-based-approval-gate-with-a-classifier) and [approval at one-person scale](../2026-10-28-pro-ship-scope/brainstorm.md#approval-at-one-person-scale)).
Status: done; shipped in #88.
Created: 2026-10-29.

## Problem

Every pull request gets the same treatment today, whatever it touches.
A one-line docs fix and a change to `.github/workflows/` or a hook script go through the same merge step.
Nothing in the repo says which of them a person must read.
Jody asked for this directly: "maybe have a risk based approval gate with a classifier?"
The `risk:` line in an intent's front matter is the only signal.
The author writes it before the code exists.
Nothing compares it with what the diff turned out to be, so an intent that says `low` can ship a change to auth or migrations without anyone noticing.
Without tiers the gate has two bad settings: run every check and every reviewer on every PR, which is slow and expensive, or run few of them and let the risky change through.
An agent can also say "approved" in a PR comment or a summary.
Nothing marks that as different from Jody reading the evidence.
This happens on every PR in every repo that installs the plugins.

## Proposed outcome

Every diff gets a tier of low, medium or high from what it changes.
The tier is printed with the signals that set it, so a wrong tier can be argued with.
The signals are the paths it touches, the security and legal surface it hits, dependency manifest changes, tests deleted or weakened, code changed with no test change, its size and the number of areas it spans.
The intent's declared risk can only raise the tier.
A diff that classifies higher than its intent declared is reported as a finding.
The tier sets what the PR gate demands: low merges on green checks, medium and high need Jody, an agent's approval never counts and an approval covers one HEAD commit.
A high tier asks locally before the merge runs and the PR is labelled `risk:high`.
A repo can override the default tier table and its risky paths in `REVIEW.md`.
A repo with no such section gets the defaults.

## Affected users and systems

Jody and any agent session in a repo that installs the plugin that owns the classifier.
pro-ship (the likely home: a script, a skill, a hook, `hooks/hooks.json`, Codex parity files, manifests and marketplace entry).
`pro-security` and `pro-legal`, whose `security_surface.py` and `legal_surface.py` are the existing diff classifiers; they are read, not changed.
pro-ai-sdlc's `REVIEW.md` template, which gains the optional tier-table section (shared with the review-policy intent).
`/merge-pr`, which lives in the user-level commands folder and not in this repo.
The sibling intents being drafted now: the PR gate (it records the tier in its stamp), the code reviewer (it receives the tier and its signals) and the review policy.
`docs/roadmap.md`, routing cases and `tests/check.mjs`.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
The classifier is deterministic and written in Python with the standard library only, like every hook here.
Jody ruled out Rust on 2026-10-29 because a compiled binary would have to be committed per platform or built on the user's machine.
An LLM may break ties inside the skill but never inside a hook (brainstorm).
The change sets the tier and the author's declared `risk:` can only raise it; an agent's approval never counts as Jody's; an approval covers one HEAD sha and a new commit needs it again (brainstorm, taken as they are).
The classifier prints the signals that set the tier.
"Could not run" must never read as low.
It reads only the diff from the branch point, so it stays fast.
Plugins install separately and cannot import each other, so a classifier in one plugin cannot rely on the other two being present.
The design must not hard-code one person: the tier table and risky paths are data.
The scaling dials of the brainstorm's "Built to scale up" stay possible later (the dials themselves are out of scope).
The hook starts in warn mode behind the `mode` file, like the other gates.
Follows REVIEW.md pass 1 and pass 2 because it is a hook.
The declared risk of this intent is high: it adds a merge gate and its own rules would class a diff that touches hook scripts as high.

## Out of scope

`pr-check`, its stamp and the `gh pr create` hook: the PR gate intent (this intent supplies the tier they record).
The code reviewer and what it does with the tier: the code-reviewer intent.
The `REVIEW.md` template upgrade as a whole: the review-policy intent (this intent adds only the optional tier-table section and coordinates with it).
The `REVIEW.md` scaling block, rulesets, CODEOWNERS, two-person approval, trusted-author paths and repo-hygiene (roadmap items 21 and 31).
The architect review itself; the classifier only flags architecture signals for it.
Codex as a second reviewer on high.
Switching the hook to enforce mode.

## Success looks like

On a run over this repo's recent merged PRs the classifier puts docs-only and test-only changes in low and puts changes to `.github/workflows/`, hook scripts and `hooks.json` in high.
Jody agrees with each tier or can read the signal that is wrong.
A diff that touches auth, a workflow or a migration under an intent that declared `low` is reported as a finding.
A medium or high merge cannot run without Jody answering a prompt that shows the signals and the commit.
A new commit after approval brings the prompt back.
In warn mode over a couple of weeks of normal work the hook raises no prompt Jody thinks was wrong.

## Open questions

- Which plugin owns the classifier: pro-ship (where the roadmap puts the PR gate), pro-quality (in the starter, beside the reviewer) or code shared with `pro-security` and `pro-legal`, which already have diff classifiers (recommendation: pro-ship, with its own small path rules and an optional read of the two existing classifiers when installed, because plugins cannot import each other).
- Whether a person can override the tier down and where that is recorded: the PR body or the stamp (recommendation: Jody only, recorded in the stamp against one HEAD sha and echoed in the PR body, never by an agent).
- Whether the tier table lives in `REVIEW.md` per repo with the brainstorm's table as the default (recommendation: yes, as an optional section, with the approval column fixed until the scaling block exists).
- The size thresholds for files, lines and areas: the brainstorm names the signals and no numbers (recommendation: configurable, with starting values calibrated against this repo's merged PRs before they are fixed).
- How a medium tier gets Jody's approval locally: the hook's `ask` prompt, `/merge-pr` showing the evidence and asking, or both (recommendation: both, with the hook as the only step an agent cannot answer).
- Whether `ask` still prompts when the session runs with permission checks bypassed (to verify; recommendation: deny instead of allowing when it cannot prompt).
- Likely needs an ADR: the tier model and the rule that an agent's approval never counts are rules every gate in the marketplace will follow; the tier table's home is hard to move once repos depend on it.

## Evidence

None; this is an idea.
Source text: the pro-ship brainstorm sections named above and `docs/roadmap.md`, item 4.
Existing classifiers: `plugins/pro-security/scripts/security_surface.py` and `plugins/pro-legal/scripts/legal_surface.py`.
Related: `intent: 2026-10-29-constraint-floor` (its guard names weakened tests and suppressions; the classifier's test signals are independent so the two plugins stand alone).
