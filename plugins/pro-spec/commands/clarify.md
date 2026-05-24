---
description: Interrogate an existing spec for ambiguities — asks up to 5 targeted questions and writes the answers back into the spec.
argument-hint: '[spec file or topic]'
---

Use the `clarifying-specs` skill. If `$ARGUMENTS` is provided, treat it as the spec file path or topic to clarify. If `$ARGUMENTS` is empty, scan the current branch for spec files under `docs/specs/` (or other conventional locations) and clarify the most recently modified one — confirm the target with the user before starting the questioning loop.
