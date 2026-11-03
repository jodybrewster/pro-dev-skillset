---
source: idea
kind: change
status: accepted
risk: high
created: 2026-11-03T16:13:11-0500
author: the maintainer
---

# Intent: a very simple software factory that runs small intents without a person

Source: idea.
Status: accepted.
Created: 2026-11-03.
Related: [after-build-loop](../2026-11-01-after-build-loop/intent.md), which carried the loop to deploys, incidents and lessons; [risk-tiers](../2026-10-29-risk-tiers/intent.md), which set the low, medium and high tiers at merge.

## Problem

Every change goes through the same intent, spec and plan gates, whether it is a one-line bug or a payments change.
A small bug or a small ask waits on a person three times before anything is built.
The risk tiers decide only at merge time, so the front of the loop cannot tell a trivial change from a dangerous one.
The loop has no named roles beyond "the engineer" and "a lead", so whoever wrote an intent can also accept it and an engineer can close a security concern in their own spec.
There is no end-to-end proof that the loop runs from an intent to a deploy, and mieruka has no notion of who may act at a gate.

## Proposed outcome

A small intent, accepted by a named role, runs from intent to a merged pull request with nobody present, and stops at the right person the moment it turns out larger.
A larger intent escalates and the maintainer reviews it at the gates the escalation level names.
Three escalation levels are picked at intake and only ever raised:

| Level | Which changes | Path | Humans |
|---|---|---|---|
| 1 Auto | predicted low, no stop-list category, no new dependency, intent from a named role | short spec and plan in one commit, test-first build, verifier, review, auto-merge | none until deploy |
| 2 Engineer | medium | the full loop | engineer approves plan and merge |
| 3 Escalated | high: auth, data, payments, infra, a public API | the full loop plus the stop list | engineer, lead and policy owner; flagged concerns closed first |

Roles come from the AI-native SDLC playbook (https://claude.com/resources/articles/the-ai-native-sdlc-playbook): product owner, engineer, lead or code owner, policy owner and platform owner, named in a role map in `REVIEW.md`.
A solo repo puts one name in every role.

It works standalone with pro-ai-sdlc, pro-ship and pro-quality installed, and it works in mieruka, which gains a human roles setting and gate buttons that know who may press them.
An end-to-end eval builds a throwaway repo, installs the plugins and runs three intents in different role scenarios through to deploy; a twin of it runs the same scenarios through mieruka.
A step-by-step guide and a demo script let the maintainer learn it, check each step and show it.

## Affected users and systems

- pro-ai-sdlc: intent template, REVIEW.md template, `/intent`, `/spec`, `/plan`, `/execute`, a new `/auto` command, `factory.py`, `protect-tests.py`, `production-gate.py`.
- pro-ship: `risk-classify.py` and `merge-gate.py` are reused as they are.
- pro-core: `/pro-dev install` fills the role map.
- `docs/loop-records.md`, `tests/mieruka-sync.mjs`, a new `tests/e2e-sdlc.mjs`.
- mieruka: settings, gate routes, the card, the Ship page and its e2e suite.

## Constraints

- Very simple: reuse `/execute`, `/review`, `/pr-babysit`, `risk-classify.py`, `merge-gate.py` and the records; add the fewest new commands and no services.
- agent-skills (`../agent-skills`) is the baseline; its steps are adopted in full and a dropped one is written down with a reason.
- A level is set by a script, never by a model, and only goes up.
- Intent text from outside the role map is data and starts at level 2.
- A test is locked once written during a build.
- The agent may act up to the production gate and never pass it: deploy stays a person's step at every level.
- The maintainer's interactive gates stay in warn mode for the warn-mode week; an unattended run uses its own enforce folder.
- pro-dev-skillset first, then mieruka.
- Live evals run only when the maintainer says yes, with the cost named.

## Out of scope

- Auto-deploy, even to staging.
- `claude -p` in CI, the rollback command and tiered detection; they stay deferred intents.
- Skill events in mieruka's session trace.
- Signed commits for team repos.

## Success looks like

- Two small intents, a feature from the product owner and a bug from the engineer, reach merged pull requests with no person in the session, and the record says "deploy is yours".
- A larger intent stops at the policy owner, the engineer and the lead in turn, and cannot merge without them.
- `node tests/e2e-sdlc.mjs` passes its three scenarios and mieruka's twin passes the same checks.
- The maintainer follows the guide on a fresh repo and every validation step shows what the guide says.

## Open questions

- The e2e needs real pull requests to exercise auto-merge; it uses a throwaway private GitHub repo by default and `--local` for a cheaper run that stops at the open PR.
- `production-gate.py` and `merge-gate.py` both fire on `gh pr merge`; the production gate hands merges to the merge gate when pro-ship is installed.
- `author:` is a git name anyone can set; solo repos accept that and team repos need signed commits, recorded in the ADR.
- Mieruka's role map is edited in Settings and written to the same `## Roles` block in `REVIEW.md`, so there is one source.
- Likely needs an ADR: escalation levels and the role map are rules other work follows.

## Evidence

None.
