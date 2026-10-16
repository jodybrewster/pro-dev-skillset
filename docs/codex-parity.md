# Codex parity is a hard requirement

Moved from `CLAUDE.md`, which keeps a one-line rule.
The decision is [ADR-0004](./decisions/0004-codex-parity.md); [RELEASING.md](../RELEASING.md) has the manual smoke test.

The README claims forked SKILL.md files load under OpenAI Codex via the Agent Skills standard.
When editing skill bodies, sidecars and command prose, scan for:

- Hard-coded Claude-Code-only tool names (`Task`, `TodoWrite`) → rewrite as harness-neutral ("dispatch a subagent", "update your task tracker") or explicitly include the Codex/fresh-agent fallback.
- Missing sidecars referenced by `@filename.md` or "see `filename.md`" - every reference must exist in the same directory.
- Non-standard skill frontmatter keys - Agent Skills only guarantees `name`, `description`, optional `tags`/`tools`/`model`.
- Missing or stale `.codex-plugin/plugin.json` files - every concrete skill-bearing plugin needs one, with `skills: "./skills/"`.

## Agents

Subagents are a second parity surface.
Claude auto-discovers `agents/*.md`; Codex does not read them at all, and does not auto-spawn custom subagents even when present.
Every `agents/<n>.md` should ship a `.codex-plugin/agents/<n>.toml` counterpart (`name`, `description`, `developer_instructions`), which a user installs by copying into `~/.codex/agents/` or `.codex/agents/`.
`node tests/check.mjs agents` warns on a missing counterpart and fails on name/file mismatch or a malformed `.toml`.
`pro-research`'s four agents predate this rule and are still Claude-only.

When porting an agent from an upstream collection, read the Codex `.toml` variant before the Claude `.md` one.
In `VoltAgent/awesome-*-subagents` the `.toml` bodies are markedly better: the `.md` versions are undifferentiated bullet lists carrying invented metrics (`readability_score: 68`, `user_satisfaction: 92%`) and a "delivery notification" template that instructs the agent to state outcome numbers it never measured.
That directly contradicts `verification-before-completion`, so it must be stripped rather than reworded.
