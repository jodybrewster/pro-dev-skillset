# Review handoff

Fill the four fields below and send them to the reviewer with no other text.
The reviewer reads the files and the diff itself.

## Fields

- `range`: the base sha and the head sha of the change, for example `<base-sha>..<head-sha>`. Never a branch description or a list of changed files.
- `brief`: the paths to the intent, the spec, the plan or the issue that asked for the change. Never a paraphrase of what they say.
- `policy`: the paths to `REVIEW.md`, to the agent file such as `CLAUDE.md` or `AGENTS.md` and to `CONSTRAINTS.md` when it exists. Never a copy of the rules.
- `risk`: the tier, or `unclassified` when there is none, plus the stamp path `.pro-dev/ship/pr-check.json` when that file exists. Never the author's own view of how risky the change is.

Nothing else goes in any field: no author description, no PR body, no session summary and no earlier findings.
