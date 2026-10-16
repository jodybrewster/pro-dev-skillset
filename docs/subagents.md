# Use subagents to parallelize - aggressively

Moved from `CLAUDE.md`.

This repo has many plugins.
Almost any cross-plugin task (add a hook to N plugins, draft commands for M skills, audit drift, port an upstream change) is embarrassingly parallel.
Default to subagents whenever the work splits cleanly:

- Per-plugin edits: dispatch one subagent per plugin in a single message (multiple Agent tool calls in one assistant turn).
  Don't serialize unless edits depend on each other.
- Independent research: spawn `Explore` subagents in parallel - one per question - instead of grepping sequentially.
- Drafting + validating: while one subagent drafts a hook, another can run `claude plugin validate --strict` on the rest of the marketplace.

Concrete pattern:

```
# Good — one assistant turn, N concurrent subagents
Agent(pro-core hook draft)  Agent(pro-data hook draft)  Agent(pro-quality hook draft)

# Bad — serialized, 3× the wall clock
Agent(pro-core hook draft) → wait → Agent(pro-data) → wait → Agent(pro-quality)
```

When dispatching, give each subagent self-contained context: it can't see your conversation.
State the file path, the exact change, the schema/format to follow and what "done" looks like.
Don't write "based on the discussion, add the hook" - write "add a `PostToolUse` entry to `plugins/pro-data/hooks/hooks.json` with a matcher on `Write|Edit`, running `python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/format-schema.py\"`."

## Model

Dispatch these subagents on Sonnet (`claude-sonnet-4-6`) - it's the right cost/quality tier for repo edits, drafting, validation and code search.
Reserve Opus for the orchestrating turn (planning, synthesis, judgment); use Haiku only for the `pro-research` skill's bounded fetch-and-extract research agents.
Default to Sonnet subagents and parallelize whenever the work splits cleanly.
