# CLAUDE.md — pro-dev-skillset

Working notes for Claude Code (and Codex) when editing this marketplace repo itself. Not user-facing — see [README.md](./README.md) for that.

## What this repo is

`pro-dev-skillset` is a private Claude Code plugin marketplace — a standalone collection of skills, hooks, commands, and agents that a user installs into their Claude Code setup. It is **not an app**. It has no UI, no server, and no database. It ships workflow intelligence to Claude Code sessions.

A user installs skills from this repo once, and those skills become available in every project they work on. The skills are independent — they work in any repo without requiring any other tool.

**How it relates to Mieruka:** Mieruka is a separate Storybook-like app that installs into a user's target repo as `.mieruka/` (similar to how Storybook installs as `.storybook/`). If a user has both `pro-dev-skillset` skills installed in Claude Code and Mieruka installed in their working repo, the skills can communicate with Mieruka via MCP tools or by writing to the `.mieruka/` directory. But the two systems are independent by design — skills work without Mieruka, and Mieruka works without these skills.

This repo hosts a private plugin marketplace with 10+ plugins and 20+ skills. Skills are forked from MIT-licensed upstreams (`obra/superpowers`, `Owl-Listener/designer-skills`, `PaulRBerg/agent-skills`, etc.) with per-file attribution footers. Manifests, templates, hooks, CI, and scripts in this repo are original.

The plugins are **skills-only by design** — historically. Hooks, commands, and agents are now being layered in where deterministic triggering beats description-matching.

## What this repo is experimenting with

This marketplace is actively testing multiple workflow layers — `pro-gstack` (GStack), `pro-core`/`pro-execution`/`pro-quality`/`pro-pdd` (Superpowers-derived), and `pro-spdd` (SPDD) — to answer two different real-world questions:

**Use case 1: Solo developer building a full application.**
A single developer uses GStack's persona-driven planning and review workflows combined with Superpowers-derived execution and optional PDD skills. GStack handles structured thinking — office hours, CEO/engineering/design reviews, QA, ship readiness. `pro-execution` handles the implementation muscle. `pro-pdd` is opt-in when conversational brainstorming and written implementation plans are desired.

**Use case 2: Consulting team delivering for a client.**
A team of consultants uses SPDD's structured prompt-driven workflow — story decomposition, REASONS canvas, analysis, prompt-driven generation, and code review — to align a client on what is being built before anything is implemented. The structure gives clients visibility and consultants a shared artifact trail.

**The Mieruka bridge.** In both use cases, one of this repo's jobs is to communicate with a Mieruka MCP server running in the client's or developer's working repo. Skills write workstream status, stories, structured prompts, and canvas artifacts to `.mieruka/` or call Mieruka MCP tools directly. This lets Mieruka surface live progress to clients — saved stories, REASONS canvases, approval gates, and daily progress summaries — without requiring them to read code or talk to Claude directly.

The client/team frameworks are opt-in (`pro-spdd`, `pro-gstack`, and `pro-pdd` are separate plugins). The default stack (`pro-core`, `pro-execution`, `pro-quality`, `pro-design`, `pro-data`, `pro-testing`) works without them.

## Use subagents to parallelize — aggressively

This repo has many plugins. Almost any cross-plugin task (add a hook to N plugins, draft commands for M skills, audit drift, port an upstream change) is **embarrassingly parallel**. Default to subagents whenever the work splits cleanly:

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

**Model: dispatch these subagents on Sonnet** (`claude-sonnet-4-6`) — it's the right cost/quality tier for repo edits, drafting, validation, and code search. Reserve Opus for the orchestrating turn (planning, synthesis, judgment); use Haiku only for the `pro-research` skill's bounded fetch-and-extract research agents. Default to Sonnet subagents and parallelize whenever the work splits cleanly.

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

## Pre-commit install test (required before every commit + push)

Run all four steps. All must pass — don't commit if any fail.

```bash
# 1. Static checks: manifests, frontmatter, version-bump law, routing cases
node tests/check.mjs && node tests/eval.mjs --dry

# 2. Full marketplace + strict validation
claude plugin validate . --strict

# 3. Install into demo/app and build + vitest
./demo/setup.sh

# 4. Test pro-starter (the user-facing meta-install) from inside demo/app
cd demo/app
claude plugin install pro-starter@pro-dev-skillset --scope project
```

Step 4 installs `pro-starter` on top of the individual plugins already put down by `setup.sh`. It exercises the dependency resolution cascade (`pro-core`, `pro-design`, `pro-nextjs`, `pro-mieruka`, etc.) and confirms that the meta-plugin resolves cleanly without loader rejection. Verify the output shows all plugins loaded with no errors.

If step 4 fails, check: version-bump law violated, `*` version constraint on a cross-marketplace dep (they report `"unknown"` — drop the hard dep instead), or a missing sidecar file.

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
- Cross-marketplace dependency problems? The marketplace allowlists `claude-plugins-official`, and official dependencies use object-form entries in `plugin.json` (`name`, `marketplace`, `version`). If auto-install misbehaves on a Claude Code version, use `templates/install-companions.sh` as the explicit fallback.
- `claude plugin validate --strict` failing on a freshly-forked skill? Likely an unrecognized frontmatter key or a missing sidecar `@reference`.
