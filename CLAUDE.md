# CLAUDE.md - pro-dev-skillset

Working notes for Claude Code and Codex when editing this marketplace repo itself.
`AGENTS.md` mirrors this file for Codex's project-instruction discovery.
Not user-facing - see [README.md](./README.md) for that.

## What this repo is

`pro-dev-skillset` is a private Claude Code plugin marketplace - a standalone collection of skills, hooks, commands and agents that a user installs into their Claude Code setup.
It is not an app.
It has no UI, no server and no database.
It ships workflow intelligence to Claude Code sessions.
The longer version, the Mieruka bridge and the two use cases it is testing are in [docs/overview.md](./docs/overview.md).

Work enters through an intent: `intent/<date>-<slug>/` holds `intent.md`, `spec.md` and `plan.md` ([intent/README.md](./intent/README.md)).
A PR is reviewed against [REVIEW.md](./REVIEW.md) and released per [RELEASING.md](./RELEASING.md).

## How work flows here

The AI-native SDLC playbook is the guide and `pro-ai-sdlc` is where it is encoded, so the whole loop works from Claude Code alone in any repo with the plugin installed (it is opt-in and not part of `pro-dev-starter`).
Mieruka is only a UI over it and reads the plugin's templates and rules.

## Model split

- Opus runs the orchestrating session: planning, synthesis and judgment.
- Sonnet runs the subagents: per-plugin edits, drafting, validation and code search, dispatched in parallel in one turn with self-contained prompts ([docs/subagents.md](./docs/subagents.md)).
- Haiku runs the bounded fetch-and-extract agents of `pro-research` and the read-only `researcher` of `pro-ai-sdlc`.
- Every agent declares `model:` for its role in frontmatter: readers and explorers on haiku, builders on sonnet, reviewers on opus.
- One exception: `pro-ai-sdlc`'s `/execute` runs on Opus as the builder and dispatches subagents when a step needs one (Jody, 2026-10-28).

## The three laws

- Version-bump law: a content change under `plugins/<name>/` bumps that plugin in both manifests and its marketplace entry, plus `metadata.version`, in the same commit ([ADR-0002](./docs/decisions/0002-version-bump-law.md), [detail](./docs/version-bump-law.md)).
- Hook-loading law: every hook a plugin registers lives in its one `hooks/hooks.json` and every script a hook runs exists and is tracked by git ([ADR-0003](./docs/decisions/0003-one-hooks-json-per-plugin.md), [detail](./docs/hook-loading.md)).
- Codex parity: every skill-bearing plugin also loads under Codex, with harness-neutral prose, standard frontmatter, a version-aligned `.codex-plugin/plugin.json` and a `.toml` per agent ([ADR-0004](./docs/decisions/0004-codex-parity.md), [detail](./docs/codex-parity.md)).

Other decisions are in [docs/decisions/](./docs/decisions/README.md).

## Plugin layout cheatsheet

```
plugins/<name>/
  .claude-plugin/plugin.json     # name, version, description, dependencies
  .codex-plugin/plugin.json      # Codex plugin manifest, version-aligned
  skills/<slug>/SKILL.md         # frontmatter: name, description; body is the skill
  skills/<slug>/*.md             # optional sidecars referenced from SKILL.md
  commands/<name>.md             # slash commands (frontmatter: description, argument-hint)
  agents/<name>.md               # subagents (frontmatter: description, tools)
  hooks/hooks.json               # ALL hook configs for the plugin, one file (see the hook-loading law)
  .codex-plugin/agents/<n>.toml  # Codex counterpart for each agents/<n>.md (see docs/codex-parity.md)
  LICENSE                        # required when content is forked
```

The `pro-dev-starter` meta-plugin intentionally has no `skills/` - it exists as a dependency aggregator.
Forked content keeps its footer and its row in [docs/licenses.md](./docs/licenses.md).

## Verifying your work

Run before every commit and push.
All must pass - do not commit if any fail.

```bash
# 1. Static checks: manifests, frontmatter, version-bump law, routing cases,
#    Codex parity (codex-parity + codex-manifests checks run automatically)
node tests/check.mjs && node tests/eval.mjs --dry

# 2. Full marketplace + strict validation (Claude)
claude plugin validate . --strict

# 3. Every plugin, strict (the loop CI runs); the subshell exits 1 on the first failure
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
```

Expected output, from a real run on 2026-10-28 (the 38 warnings are skills and agents with no routing case):

```
✓ 27 checks · 0 failures · 38 warnings
✓ 80 cases reference real skills · 94 skills in catalog + 7 distractors
(skipped live routing: no ANTHROPIC_API_KEY. Set ANTHROPIC_API_KEY to run the model.)
✔ Validation passed
```

Step 2 prints `✔ Validation passed` once and step 3 prints it once per plugin directory, 20 times.
CI runs these automatically on PR (see `.github/workflows/`).
All must pass before tagging.
The full install test (demo app, `pro-dev-starter` install, Codex smoke test) is in [docs/install-test.md](./docs/install-test.md).

## Things Claude gets wrong

- Editing plugin content without a version bump.
  The plugin cache serves the stale copy on update and nothing warns; bump per the version-bump law.
- Declaring a pro-core dependency on a plugin that owns registry rows, which re-enables a pro-core the person disabled; the installer checks for pro-core instead.
- Naming a hook file per concern.
  Eight hook files in pro-core, pro-data and pro-quality never ran until 8597453 (PR 34) merged them into `hooks/hooks.json`.
- Declaring a hard dependency on a plugin from another marketplace.
  The `worktrunk@worktrunk` dependency blocked pro-execution and pro-starter from loading until 4337f0a (PR 44) dropped it, because an upstream with no `version` resolves to `unknown` and a `*` constraint cannot match it.
  Companions are optional rows in the `/pro-dev` engine registry and `/pro-dev install` asks about them.
  `templates/install-companions.sh` still works standalone.
- Adding a bridge skill without a row in `plugins/pro-core/registry/engines.json`.
  The `registry` check fails and the row needs a pro-core bump per [ADR-0006](./docs/decisions/0006-engine-registry-and-pro-dev.md).
- Returning `block` from a `Stop` hook without checking `stop_hook_active`, which loops the session ([docs/hook-loading.md](./docs/hook-loading.md)).
- Running `claude plugin install` over an install the person disabled, which turns it back on.
  `plugins swap-starter` did that until pro-core 0.18.1 learned to skip disabled installs.
- Calling a third-party skill that sets `disable-model-invocation` through the Skill tool, which refuses it.
  `/pro-egm:goldfish` 0.1.0 shipped that way and could not start EGM's review loop until 0.1.1 read the skill's `SKILL.md` and followed it, as EGM's own guide says.
- Writing a home-directory path into a command or doc; use a path relative to the repo root.

More symptoms and fixes: [docs/troubleshooting.md](./docs/troubleshooting.md).
Private repo gotchas (bootstrap through `gh api`, headless folder trust): [docs/private-repo.md](./docs/private-repo.md).
Everything else under `docs/` is indexed in [docs/README.md](./docs/README.md).
