# ADR-0004: Codex parity is a hard requirement

Date: 2026-05-24 (f689820 and 29c0a98)

## Status

accepted

## Context

The README promises that the skills in this marketplace load under OpenAI Codex as well as Claude Code, through the Agent Skills standard.
Forked skills drifted from that promise in small ways.
Bodies named Claude-only tools such as Task and TodoWrite.
Sidecar files were referenced but missing.
Some frontmatter used keys the standard does not guarantee.
Commit f689820 (2026-05-24, "Phase 3 polish: pro-design 0.3.0 adds shadcn/ui composition + Codex parity docs") wrote the parity docs.
Commit 29c0a98 (2026-05-24, "Phase 3 finish: real skills for testing/data/spec, Codex parity fixes") fixed the drift that had built up.

## Decision

Every skill-bearing plugin must also load under Codex.
Skill prose stays harness-neutral, so Task and TodoWrite need a Codex or fresh-agent fallback or a neutral rewrite.
Every sidecar a skill references exists in the same directory.
Skill frontmatter uses only name, description and the optional tags, tools and model.
Each plugin ships a .codex-plugin/plugin.json with the same name and version as its Claude manifest and skills set to "./skills/".
Every agents/<n>.md ships a .codex-plugin/agents/<n>.toml counterpart with name, description and developer_instructions.

## Consequences

Agent parity came later.
Commit e98db62 (2026-07-26, "feat(pro-quality): documentation subagents, doc hooks, and eval coverage for agents (#40)") added the .toml rule, because Codex does not read agents/*.md and does not auto-spawn custom subagents.
Users install the .toml files by copying them into ~/.codex/agents/ or .codex/agents/.
The four pro-research agents predate that rule and are still Claude-only; they are a known gap.
When porting an agent from an upstream collection, read the Codex .toml variant first.
In VoltAgent/awesome-*-subagents the .toml bodies are better, while the .md versions carry invented metrics and a delivery template that contradicts verification-before-completion.
Each version bump now touches two manifests that must agree.
The long detail lives in docs/codex-parity.md.

## Enforced by

- [`tests/check.mjs`](../../tests/check.mjs) check `codex-parity` scans every plugin .md file and fails on TodoWrite, TaskCreate and TaskUpdate, and warns on "Task tool" or mcp__ names on lines with no fallback wording.
- [`tests/check.mjs`](../../tests/check.mjs) check `codex-manifests` fails on a missing .agents/plugins/marketplace.json entry, a missing .codex-plugin/plugin.json, a name or version mismatch or a missing skills path, and warns when the skills path is not "./skills/".
- [`tests/check.mjs`](../../tests/check.mjs) check `agents` fails on missing name or description, a name that differs from the file, or a .toml with a wrong name or no description or developer_instructions, and warns when the .toml counterpart is missing.
- [`docs/codex-parity.md`](../codex-parity.md) holds the detail.
- [`RELEASING.md`](../../RELEASING.md) lists the recurring scan and the manual Codex smoke test after marketplace or manifest changes.
- [`REVIEW.md`](../../REVIEW.md) is the review bar for these rules.
