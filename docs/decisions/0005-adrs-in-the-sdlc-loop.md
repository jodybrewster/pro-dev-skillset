# ADR-0005: pro-ai-sdlc carries ADRs through the loop

Date: 2026-10-27

## Status

accepted

## Context

Repos that use pro-ai-sdlc kept decisions in chat or in a spec that nobody reads after the build.
The loop had intent, spec and plan but no place where a lasting decision was written down with its reasons.
A decision recorded at intent time has no options weighed yet.
A decision recorded only after the build drifts away from the change that caused it.
Source: intent/2026-10-27-adrs-in-the-sdlc-loop/.

## Decision

pro-ai-sdlc handles ADRs at four points.
`/intent` flags a likely decision under Open questions and writes no ADR.
`/spec` answers `ADR needed:` in Flagged concerns and, on yes, drafts the ADR as `proposed` in the same commit as the spec.
The Done section of `plan.md` accepts it: the person's sign-off moves the ADR to `accepted`.
`/adr` records a decision with no change behind it, standalone and `accepted`.
The ADR folder is `docs/adr/` if it exists, else `docs/decisions/` if it exists, else a new `docs/adr/`.

## Consequences

Every repo that installs the plugin gets the same ADR path from first flag to acceptance.
This repo's own folder is `docs/decisions/`, so the location rule picks it.
The plugin gained a command, a template and a minor version, so the version-bump law applies to both manifests, the marketplace entry and pro-starter.
Reverse it if the Done sign-off proves too heavy and people stop filling it in.

## Enforced by

- [`plugins/pro-ai-sdlc/commands/spec.md`](../../plugins/pro-ai-sdlc/commands/spec.md) drafts the proposed ADR.
- [`plugins/pro-ai-sdlc/commands/adr.md`](../../plugins/pro-ai-sdlc/commands/adr.md) records standalone decisions.
- [`plugins/pro-ai-sdlc/templates/plan.md`](../../plugins/pro-ai-sdlc/templates/plan.md) holds the Done section.
- [`tests/check.mjs`](../../tests/check.mjs) checks manifests, frontmatter and the version-bump law.
