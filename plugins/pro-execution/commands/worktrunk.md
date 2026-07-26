---
description: "Manage parallel Git worktrees and AI agents with Worktrunk. Usage: /worktrunk list | /worktrunk spawn <branch-name> | /worktrunk spawn <n> \"<prompt>\" | /worktrunk done <feature-name> | /worktrunk <n>"
argument-hint: "list | spawn <branch-name> | spawn <n> \"<prompt>\" | done <feature-name> | <n>"
---

Manage Git worktrees and tmux-backed AI agent sessions via the `wt` CLI (Worktrunk). This workflow needs shell access to `wt`, `git`, and `tmux`. Parse the subcommand from `$ARGUMENTS`.

## Subcommands

### `list`

Show all active worktrees with their branches and tmux session status:

```bash
wt list
```

### `spawn <branch-name>`

Create a single named worktree with the given branch name and launch a tmux session for it:

```bash
wt create <branch-name>
```

Example: `/worktrunk spawn feat/auth` creates a worktree on branch `feat/auth`. Use this for focused feature work.

### `spawn <n> "<prompt>"`

Create n worktrees from main, launch a tmux session for each, and start a Claude agent in each with the given prompt:

```bash
wt spawn <n>
```

Detect which mode to use: if the first argument after `spawn` looks like a branch name (contains letters, `/`, or `-` but is not a plain integer), use `wt create`. If it is a plain integer, use `wt spawn <n>` with the remaining text as the prompt.

Name each agent worktree using the feature slug derived from the prompt, e.g. `agent/auth-1`, `agent/auth-2`, `agent/auth-3`. Report all session names after spawning.

### `done <feature-name>`

Verify tests pass, merge the named worktree to main, and clean up the worktree and tmux session:

```bash
wt done <feature-name>
```

Process:
1. Switch to the worktree
2. Run tests (via the `pre-merge` hook in `.config/wt.toml`)
3. If tests pass, merge to main
4. Clean up worktree and tmux session
5. Switch back to main

Report pass/fail and whether the merge succeeded. If tests fail, report the output and do not merge. If there are conflicts, tell the user to resolve them manually. Use `wt done --force` only if the user explicitly asks to skip tests.

### `<n>` (number)

Attach to worktree number n's tmux session:

```bash
wt attach <n>
```

Remind the user to use `Ctrl-b d` to detach.

## Typical workflow

1. **Start a feature**: `/worktrunk spawn 1 "add user auth"` (or more agents to explore approaches in parallel)
2. **Check progress**: `/worktrunk list`
3. **Switch to a session**: `/worktrunk 1`
4. **Finish and merge**: `/worktrunk done auth-1`

## Configuration

Worktrunk reads `.config/wt.toml` in the project root:

```toml
[post-create]
tmux = "new-session -d -s {name}"

[post-start]
tmux = "attach-session -t {name}"

[post-remove]
tmux = "kill-session -t {name}"

[pre-merge]
run = "npm test"

[list]
format = "{index}  {branch:<30}  {path:<50}  {tmux_status}"
```

## Troubleshooting

**`wt: command not found`**
```bash
brew install worktrunk && wt config shell install
```
Then restart the shell.

**tmux session not starting**
```bash
brew install tmux
```

**Can't merge**
- Tests failing - check pre-merge hook output
- Conflicts with main - resolve manually, then re-run
- `wt done --force` skips tests (only if user explicitly requests it)

---

<!-- forked from Perficient-Corporate/perf-skillset (MIT) -->
