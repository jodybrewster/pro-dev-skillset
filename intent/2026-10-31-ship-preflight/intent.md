---
source: idea
kind: idea
status: draft
risk: medium
created: 2026-10-31T12:00:00-0400
author: Jody Brewster
---

# Intent: `/ship` preflight with a go/no-go verdict, for every way a project ships

Author: Jody Brewster (pro-dev-skillset).
Source: idea, item 15 of the ranked list in [docs/roadmap.md](../../docs/roadmap.md) and feature 18 of the [pro-ship brainstorm](../2026-10-28-pro-ship-scope/brainstorm.md); on 2026-10-31 Jody asked to "design for multiple scenarios, we'll also use it in mieruka".
Status: draft.
Created: 2026-10-31.

## Problem

Every PR now goes through `pr-check`, but nothing looks at a release as a whole before it reaches users.
A release is often several PRs.
The questions at that moment are different from the ones a PR review asks.
Does a new env var exist in production?
Can the migration be undone?
Is there a changelog entry?
What do we do if it breaks?
How long does going back take?
Nobody answers these in one place today.
Nothing says go or no-go.

Projects ship in different ways, so one fixed checklist does not fit.
A Vercel app ships when a PR merges to main.
This marketplace and mieruka ship when a tag and a GitHub Release are cut (mieruka's `v7.1.0-changes`).
Some projects deploy by hand (`vercel --prod`, `fly deploy`).
mieruka also ships an Electron desktop app, where going back means publishing the previous version, not flipping a switch.
A package publish to npm cannot be taken back at all.

The router and README have listed `shipping-and-launch` for the Ship phase since the start.
`../agent-skills` has a `/ship` (`commands/ship.toml`) that fans out to three reviewers and writes a GO or NO-GO report with a rollback plan.
Its review half repeats what `pr-check` already does for every PR here.

mieruka will use this too, both as a project that ships and as the UI that shows it.
mieruka's Deliver section already has a Ship page whose deploy panel shows deploy records and is otherwise a placeholder.

## Proposed outcome

`/pro-ship:ship` answers one question for the current project: is what is about to reach users ready? If not, how do we go back?

- It works out how the project ships and what is about to ship: the PR being merged, everything since the last tag or everything since the last production deploy.
  A project can ship more than one way (mieruka: a tagged release that carries a web app, a CLI and a desktop app).
  Each target gets its own section.
- It does not review code again.
  It reads the `pr-check` stamp of each PR in that range and names any commit no passing check covered; only those get reviewed.
- It checks what only matters at release time: new env vars and config, migrations and whether they can be undone, monitoring and health checks, feature flags, the changelog and docs, version numbers and, where pro-legal is installed, its release review.
- It writes a rollback plan for each target, with what signals a rollback, the steps and how long it takes.
- It ends in GO or NO-GO with the agent-skills layout: Blockers, Recommended fixes, Acknowledged risks, Rollback plan and the evidence it read.
  A Blocker means NO-GO unless Jody explicitly accepts the risk.
  There is no GO without a rollback plan.
- The result is a report a person reads and a machine-readable record bound to HEAD, so the existing gates and mieruka can both read it.
  The gate that guards the release (the merge gate for a deploy on merge, the tag, release and deploy commands otherwise) warns when there is no fresh GO for HEAD.

## Affected users and systems

Jody and any agent session in a repo with pro-ship installed, which is every pro-dev-starter repo since pr-gate shipped.
`pro-ship`: the new `ship` skill and its script, a reference file adapted from agent-skills' `shipping-and-launch` and `commands/ship.toml` (MIT, with attribution in `docs/licenses.md`) and the merge gate if it reads the record.
`pro-ai-sdlc`'s `production-gate`, which already flags tags, releases, publishes and production deploys; pro-ai-sdlc is opt-in, so the release warning cannot depend on it alone.
`pro-legal`'s release gate where it is installed.
`pro-quality`'s `code-reviewer` and pro-security's review, called only for commits no stamp covers.
The `pr-check` stamp contract in [docs/pr-check-stamp.md](../../docs/pr-check-stamp.md), read and not changed.
mieruka ([jodybrewster/mieruka](https://github.com/jodybrewster/mieruka)): as a project, its release flow in `docs/plans/2026-10-23-releases.md`; as a UI, its Ship page and its deploy records.
The `using-pro-dev` router and the README's Ship row.

## Constraints

It reuses `pr-check`, the stamp, the risk tiers, the code reviewer and the security review and never duplicates them (pro-ship brainstorm, "pro-ship calls into the existing plugins and never rebuilds them").
No new hook if an existing gate can carry the warning (brainstorm, "Release gate: no new hook"); one warning per release action, not three.
Warn mode first, under ADR-0016.
How a project ships is read from the repo (deploy config, tags, release workflows, package manifests) with an override in the repo's own config.
It is never assumed from one stack.
The machine-readable record is a documented contract like the stamp, so mieruka can read it without importing pro-ship code.
Agent-skills' skip rule (2 files, 50 lines) is replaced by the risk tiers.
Agent-skills' three reviewers are not run at ship time, because `pr-check` ran them per PR.
The verdict informs Jody and an agent's GO never counts as his approval, as with every other gate.
Codex parity, the version-bump law and the hook-loading law apply.

## Out of scope

Running deploys, cutting tags or publishing; `/ship` judges readiness and the person or another command acts.
`pipeline` (item 16) and the CI version of this check.
Staged rollout, feature-flag systems and automatic rollback (item 31).
Mobile store releases (EAS), until a project needs them.
Building mieruka's Ship page; this intent only makes sure there is a contract it can read.
The mieruka work is its own intent in that repo.

## Success looks like

In a Vercel app, `/ship` before merging a high-tier PR reports GO or NO-GO for that PR, names a new env var missing from the production config as a Blocker and gives Vercel's instant rollback as the plan.
In this marketplace, `/ship` before a release covers every PR since the last tag, flags a merged commit with no passing stamp and checks the version-bump law and the changelog.
In mieruka, one run reports separate sections for the web app, the CLI and the desktop app.
The desktop section's rollback plan is publishing the previous version.
A release action with no fresh GO for HEAD prints one warning.
mieruka can show the verdict, blockers and rollback plan from the record alone.

## Open questions

- Which shipping scenarios v1 covers: deploy on merge, tag and release, manual deploy, desktop app and package publish are the candidates; recommended: the first three plus desktop for mieruka, with package publish as a Blocker-only check.
- Where the record lives and its name: recommended `.pro-dev/ship/preflight.json` beside `preflight.md`, with a contract page like `docs/pr-check-stamp.md`.
- Which gate carries the warning when pro-ai-sdlc is not installed: the pro-ship merge gate for deploy on merge and a pro-ship check on tag, release and deploy commands otherwise, with `production-gate` reading the same record when it is installed.
- How "the last production deploy" is found: a deploy record, the platform's CLI or the last release tag.
- Whether mieruka's existing deploy records (`spdd_record_deploy`) and this record should share a shape; to settle with the mieruka intent.
- Likely needs an ADR for the record contract, as the stamp did (ADR-0014).

## Evidence

None; an idea.
Prior art read on 2026-10-31: `../agent-skills/commands/ship.toml` and `../agent-skills/skills/shipping-and-launch/SKILL.md` (release 0.6.14, commit `eb07f19`) plus mieruka's `apps/web/src/app/ship/page.tsx` and `apps/web/src/features/ship/DeployPanel.tsx`.
