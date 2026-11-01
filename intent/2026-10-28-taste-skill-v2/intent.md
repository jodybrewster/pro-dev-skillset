---
source: idea
kind: bug
status: draft
risk: low
created: 2026-10-28T09:30:00-0400
author: the maintainer
---

# Intent: bring taste-skills-bridge in line with taste-skill v2

Author: the maintainer.
Source: idea, found by the bridge install smoke run during intent B (`intent/2026-10-28-pro-dev-setup/`).
Status: draft.
Created: 2026-10-28.

## Problem

`taste-skills-bridge` in pro-design routes to a catalog of 13 Leonxlnx skills: `design-taste-frontend`, `design-taste-frontend-v1`, `gpt-taste`, `image-to-code`, `redesign-existing-projects`, `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `stitch-design-taste`, `full-output-enforcement`, `imagegen-frontend-web`, `imagegen-frontend-mobile` and `brandkit`.
Upstream `Leonxlnx/taste-skill` is now v2 and ships one skill, `design-taste-frontend`, which covers landing pages, marketing sites and app screens in one place.
So the bridge sends an agent to twelve skills that no install can provide.
The agent either fails to find them or falls back without saying why.
`tests/bridge-install-smoke.mjs` expects all 13 names, so its weekly run fails on this target until the table changes.
Anyone who asks for a brutalist style, image-to-code, a brand kit or a GPT-specific variant hits it.

## Proposed outcome

The bridge routes only to skills the upstream actually ships.
Each ask that used to name a retired skill lands somewhere real: `design-taste-frontend`, another pro-design skill or a plain statement that the upstream no longer covers it.
The smoke test's expected names match what `npx skills add` installs and its weekly run is green for this target.
The `taste-skill` row in the `/pro-dev` engine registry detects the install by the skill that exists.

## Affected users and systems

Sites with pro-design installed that use the taste bridge.
pro-design (`skills/taste-skills-bridge/SKILL.md`, plus any other skill or router line that names a retired install name), pro-core's `using-pro-dev` router and `registry/engines.json` if their wording or detect list needs it, `tests/bridge-install-smoke.mjs` and the README row for the bridge.

## Constraints

The version-bump law, the hook-loading law and Codex parity in this repo's `CLAUDE.md`.
Bridges over vendoring: nothing from the upstream is copied in.
Builds on intent B: the bridge names `/pro-dev`, not `/taste-skills`, so this starts after PR 1 of intent B merges.
Users who installed the v1 skills before v2 still have them on disk; the bridge should not break for them.

## Out of scope

Replacing the retired skills with forks or new skills of our own.
Changing any other bridge.

## Success looks like

`npx skills add https://github.com/Leonxlnx/taste-skill -l` and the bridge's catalog list the same install names.
`node tests/bridge-install-smoke.mjs` reports the taste target as passing.
A routing case for one retired ask (for example a brutalist landing page) resolves to a skill that exists.

## Open questions

- Should the bridge keep the v1 names as "if already installed" fallbacks for older sites, or drop them entirely? Owner: the maintainer.
- Do any retired asks (brand kit, image-to-code, mobile image generation) belong with another pro-design skill or bridge, or just get a "no longer covered upstream" line? Owner: the maintainer, at spec time.
- Is v2 a lasting reshape or will upstream split it again? Check the upstream changelog at spec time; the registry row already installs with `-s '*'` so a later split installs everything.

## Evidence

On 2026-10-28, `npx skills add https://github.com/Leonxlnx/taste-skill -l` reported "Found 1 skill": `design-taste-frontend` (tasteskill v2).
The GitHub contents API listed one folder under `skills/`, `taste-skill`.
An install with `-a claude-code -y -s '*' --full-depth` in an empty repo installed only `design-taste-frontend`.
The smoke run on branch `feat/pro-dev-setup` reported `taste-skills-bridge 13 documented skill(s) · 12 missing/invalid`.

<!--
Lifecycle:
  draft     the person corrects what the interview got wrong
  accepted  the person accepts it in person; a spec pass can start
  rejected  dropped; the reason is written into the file
Location: intent/<YYYY-MM-DD>-<slug>/intent.md, with spec.md and plan.md beside it.
-->
