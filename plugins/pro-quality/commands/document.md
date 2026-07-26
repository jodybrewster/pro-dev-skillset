---
description: Document a change from the code that actually shipped - routes to the right documentation subagent and writes from repository evidence.
argument-hint: '[what to document, or a path]'
---

Produce or update documentation for `$ARGUMENTS`. If `$ARGUMENTS` is empty, document what changed in this session's working tree.

First, work out which surface is affected, then dispatch the matching subagent:

- Consumer-facing API surface (routes, handlers, schemas, OpenAPI specs, SDK contracts) → the `api-documenter` subagent.
- Docs that drifted from the code, a setup or onboarding path that no longer works, doc structure or cross-reference problems → the `documentation-engineer` subagent.
- Release notes, migration guides, changelog entries, README prose for a change that just landed → the `technical-writer` subagent.

More than one can apply. An API change that also breaks the quickstart needs both `api-documenter` and `documentation-engineer`, dispatched in parallel in a single turn since they touch different surfaces.

If no harness subagent mechanism is available, read the corresponding file under `agents/` in this plugin and follow it directly in the main session.

Give each subagent the actual diff or file paths, not your summary of them. These agents are built to work from repository evidence, and a secondhand description defeats the point.

Before accepting the result, check that every command, flag, and path it published exists. Report any doc/implementation mismatch it surfaced as a finding, not just as a correction - those are usually real bugs.
