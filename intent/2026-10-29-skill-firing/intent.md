---
source: eval
kind: change
status: accepted
risk: low
created: 2026-10-29T14:00:00-0400
author: the maintainer
---

# Intent: make four discipline skills fire and prove it

Author: the maintainer.
Source: the first `claude plugin eval` and behavioral runs from [intent/2026-10-29-evals-three-tiers](../2026-10-29-evals-three-tiers/plan.md) (PR 75).
Options 1 and 2 were chosen, where 2 was rewriting the descriptions that did not fire and sharpening the graders.
Status: accepted on 2026-10-29.
Created: 2026-10-29.

## Problem

On a natural prompt with the plugin loaded, `test-driven-development`, `systematic-debugging`, `verification-before-completion` and `requesting-code-review` did not fire.
Only `writing-plans` fired and changed the reply.
Their descriptions are the short "Use when implementing any feature or bugfix" style inherited from superpowers.
The model handles a pasted bug or a pasted diff on its own instead of reaching for a procedure.
agent-skills hit the same gap and closed most of it by naming the concrete requests in the description and saying the skill applies even when the code is pasted inline.

Three reply graders also passed with and without the plugin (debugging, verification and review).
They grade what a capable model already does, so they cannot show what the skill adds.

Separately, the behavioral run showed `verification-before-completion` does not make the agent run the suite even when the skill is appended to the system prompt: 1 of 4 expectations in both arms.

## Proposed outcome

- Each of the four descriptions names the requests it covers and says it applies to pasted code, while keeping the "Use when" form and the skill boundaries it draws today.
- Each fires case grades the one thing the skill adds that a plain reply skips, with a trap the baseline falls into.
- The verification case runs in a scaffolded repo with a hidden failing test so the agent can run the suite.
- `verification-before-completion` opens with a hard first step: run the project's full check before any completion claim.
- Before and after numbers on three runs per case, pinned to one model and Claude Code version, recorded in `docs/evals.md`.

## Risk

Low.
A broader description can pull a skill into prompts that belong to another one, so every change is measured against the stays-quiet cases and the keyless routing floor.
The four skills are forks of obra/superpowers (MIT); their footers and license rows stay.
