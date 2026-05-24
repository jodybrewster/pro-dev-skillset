# CLAUDE.md — pro-dev-skillset

Working notes for Claude Code (and Codex) when editing this marketplace repo itself. Not user-facing — see [README.md](./README.md) for that.

## What this repo is

A private Claude Code plugin marketplace (`pro-dev-skillset`) hosting 8 plugins, ~23 skills. Skills are forked from MIT-licensed upstreams (`obra/superpowers`, `Owl-Listener/designer-skills`, `PaulRBerg/agent-skills`, etc.) with per-file attribution footers. Manifests, templates, hooks, CI, and scripts in this repo are original.

The plugins are **skills-only by design** — historically. Hooks, commands, and agents are now being layered in where deterministic triggering beats description-matching.

## Use subagents to parallelize — aggressively

This repo has 8 plugins. Almost any cross-plugin task (add a hook to N plugins, draft commands for M skills, audit drift, port an upstream change) is **embarrassingly parallel**. Default to subagents whenever the work splits cleanly:

- **Per-plugin edits**: dispatch one subagent per plugin in a single message (multiple Agent tool calls in one assistant turn). Don't serialize unless edits depend on each other.
- **Independent research**: spawn `Explore` subagents in parallel — one per question — instead of grepping sequentially.
- **Drafting + validating**: while one subagent drafts a hook, another can run `claude plugin validate --strict` on the rest of the marketplace.

Concrete pattern:

```
# Good — one assistant turn, N concurrent subagents
Agent(pro-core hook draft)  Agent(pro-data hook draft)  Agent(pro-quality hook draft)

# Bad — serialized, 3× the wall clock
Agent(pro-core hook draft) → wait → Agent(pro-data) → wait → Agent(pro-quality)
```

When dispatching, give each subagent **self-contained context**: it can't see your conversation. State the file path, the exact change, the schema/format to follow, and what "done" looks like. Don't write "based on the discussion, add the hook" — write "create `plugins/pro-data/hooks/format-schema.json` with a `PostToolUse` matcher on `Write|Edit` targeting `**/schema.prisma`, running `npx prisma format`."

## The version-bump law (non-negotiable)

The Claude Code plugin cache is keyed by `(marketplace, plugin, version)`. Any content edit without a version bump silently serves stale content on `claude plugin update`. So:

- Edit `plugins/<plugin>/.claude-plugin/plugin.json` → bump `version`
- Edit `.claude-plugin/marketplace.json` → bump matching entry + top-level `metadata.version`
- If a dep crosses a minor (e.g. `pro-core 0.3 → 0.4`), every dependent plugin's `^0.3.0` constraint must widen to `^0.4.0` and re-tag.

Full procedure: [RELEASING.md](./RELEASING.md).

## Codex parity is a hard requirement

The README claims forked SKILL.md files load under OpenAI Codex via the Agent Skills standard. When editing skill bodies, scan for:

- Hard-coded Claude-Code-only tool names (`Task`, `TodoWrite`) → rewrite as harness-neutral ("dispatch a subagent", "update your task tracker").
- Missing sidecars referenced by `@filename.md` or "see `filename.md`" — every reference must exist in the same directory.
- Non-standard frontmatter keys (`harness:`, `claude_code:`) — Agent Skills only guarantees `name`, `description`, optional `tags`/`tools`/`model`.

## Plugin layout cheatsheet

```
plugins/<name>/
  .claude-plugin/plugin.json     # name, version, description, dependencies
  skills/<slug>/SKILL.md         # frontmatter: name, description; body is the skill
  skills/<slug>/*.md             # optional sidecars referenced from SKILL.md
  commands/<name>.md             # slash commands (frontmatter: description, argument-hint)
  agents/<name>.md               # subagents (frontmatter: description, tools)
  hooks/<name>.json              # hook configs (PreToolUse/PostToolUse/Stop/SessionStart/UserPromptSubmit)
  LICENSE                        # required when content is forked
```

Empty marker plugins (`pro-nextjs`, `pro-starter`) intentionally have no `skills/` — they exist as category slots / dep aggregators.

## Pre-tag checklist

```bash
claude plugin validate . --strict
claude plugin validate plugins/<plugin> --strict   # per touched plugin
```

CI runs these automatically on PR (see `.github/workflows/`). All must pass before tagging.

## Private repo gotchas

- Bootstrap uses `gh api` (not `curl`) because the repo is private — `raw.githubusercontent.com` 404s without auth.
- `claude -p` (headless) does NOT trigger the folder-trust prompt; CI must either drop `templates/project-settings.json` and run an explicit `claude plugin install`, or pre-trust the directory. See README "Headless / CI gotcha."

## When you're stuck

- Skill not loading after edit? You forgot the version bump.
- Cross-marketplace dep silently disabling a plugin? That's a known Claude Code 2.1.150 bug — keep cross-marketplace deps OUT of `plugin.json` and document them as opt-in companions in README.
- `claude plugin validate --strict` failing on a freshly-forked skill? Likely an unrecognized frontmatter key or a missing sidecar `@reference`.
