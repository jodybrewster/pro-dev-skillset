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

## Registered by pro-core

`pro-core` registers a `PreToolUse` hook on `Bash` that runs `scripts/git-safe.py` with a 10 second timeout.
Its regex rules exit 2 on the dangerous commands they name.
Its refspec parser flags the other pushes that would update or delete a protected branch under the `protected-push` mode key, which reads only `mode.protected-push` and starts in warn ([enforce-mode.md](./enforce-mode.md)).
The same `Bash` matcher also runs `scripts/delete-outside.py` with a 5 second timeout.
It flags `rm`, `rmdir`, `unlink`, `find -delete`, `find -exec rm` and `git clean` whose target resolves outside the project root under the `delete-outside` mode key, which reads only `mode.delete-outside` and starts in warn.
The shared helper `scripts/guardlib.py` is imported, not registered.

`pro-core` registers a SessionStart hook that runs `scripts/pro-dev-nudge.py` with a 10 second timeout.
It prints one line asking for `/pro-dev update` when the registry has moved on and changes nothing.

## Registered by pro-security

`pro-security` registers a `PreToolUse` hook on `Bash` that runs `scripts/push-gate.py` with a 15 second timeout.
It holds a `git push` or `gh pr create` whose diff touches security surface once per distinct diff.

`pro-security` registers `scripts/key-literal.py` twice, as a `PreToolUse` and a `PostToolUse` hook on `Edit|Write|MultiEdit`, each with a 5 second timeout.
Before the write it flags a live-looking key under the `key-literal` mode key, which reads only `mode.key-literal` and starts in warn; after the write it reads the one file written and informs only.
It has no `Bash` matcher, so it never sees a push the push gate holds.

## Registered by pro-ship

`pro-ship` registers a `PreToolUse` hook on `Bash` that runs `scripts/pr-gate.py` with a 15 second timeout.
It acts only on `gh pr create` and reads the stamp described in [pr-check-stamp.md](./pr-check-stamp.md).
