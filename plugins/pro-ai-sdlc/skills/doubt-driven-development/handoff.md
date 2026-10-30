# Doubt handoff

Fill the four fields below and send them after the full text of `doubt-instructions.md` with no other text.
The reviewer reads the files and the diff itself.
This is pro-ai-sdlc's own copy of the four-field template in pro-quality's `requesting-code-review/handoff.md` (ADR-0012, ADR-0019); `tests/check.mjs` holds the two to the same field names.

Paths in every field are relative to the repo root.
The reviewer runs with the repo root as its working directory.

## Fields

- `range`: `<sha before the step>..<head of the step>`, the step's committed range. Never a description of the step or a list of changed files.
- `brief`: the paths to the plan with the step number, the spec and the intent. Never a paraphrase or an excerpt.
- `policy`: the paths to `REVIEW.md`, to the agent file such as `CLAUDE.md` or `AGENTS.md` and to `CONSTRAINTS.md` when each exists. Never a copy of the rules.
- `risk`: the classifier tier and its signal ids when it ran, else `unclassified`. Never the author's own view of how risky the step is.

Nothing else goes in any field: no claim, no author description, no reasoning, no session summary and no earlier findings.
