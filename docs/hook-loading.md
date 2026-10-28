# The hook-loading law (non-negotiable)

Moved from `CLAUDE.md`, which keeps a one-line rule.
The decision is [ADR-0003](./decisions/0003-one-hooks-json-per-plugin.md).

Claude Code auto-loads exactly one hook file per plugin: `hooks/hooks.json`.
Any other filename in `hooks/` is silently ignored - no warning, no validation error, `claude plugin validate --strict` still passes.

This bit this repo hard.
Eight hook files across `pro-core`, `pro-data` and `pro-quality` sat completely dead because they were named per-concern (`git-safe.json`, `validation-handoff.json`, ...) instead of being merged into `hooks/hooks.json`.
One of them also pointed at a script that was never written.
Nothing failed; the hooks just never ran.

So:

- One `hooks/hooks.json` per plugin, holding every event that plugin registers.
  Group by event, not by file.
- A plugin may declare additional files via a `hooks` field in `plugin.json` (string or array of paths), but prefer the single file - fewer ways to be wrong.
- Every `${CLAUDE_PLUGIN_ROOT}` script a hook shells out to must exist and be tracked by git.
- Event names are case-sensitive: `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `PreCompact`.

`node tests/check.mjs hooks` mechanizes these rules.
It fails loudly on an unloaded hook file, a missing script and an unknown event name.
A referenced script that exists locally but is not tracked by git warns during development and fails when `CI` is set, since a fresh CI checkout holds tracked files only.

## Blocking on Stop

A hook that returns `{"decision":"block","reason":"..."}` on `Stop` forces the session to keep working with `reason` injected as instruction.
That is the only deterministic way to make something happen at end-of-turn.
Always guard it: check `stop_hook_active` so the continuation turn passes through, and track per-session progress so the work the block causes cannot re-trigger the block.
`plugins/pro-quality/scripts/user-validation.py` is the reference implementation in its `block` mode (`PRO_DEV_VALIDATION=block`).
Its default mode only prints a `systemMessage` and never blocks.
