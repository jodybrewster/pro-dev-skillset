---
name: wt
description: Manage parallel Git worktrees and AI agents with Worktrunk. Use when the user runs /wt list, /wt done, /wt spawn, or /wt <n> to list, complete, spawn, or attach to worktrees.
---

# Worktrunk Worktree Management

Worktrunk (`wt`) manages Git worktrees with isolated tmux sessions, enabling parallel development with multiple AI agents.

This workflow needs shell access to `wt`, `git`, and `tmux`, plus normal file read/write/edit access in the target repository.

## Commands

### `/wt list`
Show all active worktrees with their branches and tmux session status.

### `/wt done <name>`
Complete work on a worktree, verify tests pass, and merge to main branch.

Process:
1. Switches to the worktree
2. Runs tests
3. If tests pass, merges to main
4. Cleans up worktree and tmux session
5. Switches back to main

### `/wt spawn <n> "<prompt>"`
Spawn n parallel AI agents, each in their own worktree with tmux session.

Example: `/wt spawn 3 "implement user authentication"`

Process:
1. Creates n worktrees from main (e.g., `agent/auth-1`, `agent/auth-2`, `agent/auth-3`)
2. Launches tmux session for each
3. Starts an AI coding agent in each session with the prompt
4. Agents work in parallel on the same task

Use case: Explore multiple implementation approaches simultaneously.

### `/wt <n>`
Attach to worktree number n's tmux session. Use `Ctrl-b d` to detach.

## Configuration

Worktrunk behavior is configured in `.config/wt.toml`:

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

## Typical Workflow

1. **Start new feature**: `wt create feature-name` (or `/wt spawn` for parallel exploration)
2. **Work in isolation**: Each worktree has its own tmux session
3. **Switch between worktrees**: `/wt <n>` or `/wt list`
4. **Complete feature**: `/wt done feature-name` (runs tests, merges, cleans up)

## Troubleshooting

**"wt: command not found"**
```bash
brew install worktrunk && wt config shell install
```
Then restart your shell.

**tmux session not starting**
```bash
brew install tmux
```
Check `.config/wt.toml` for tmux configuration.

**Can't merge worktree**
- Tests may be failing — check pre-merge hook output
- Conflicts with main — resolve manually
- `wt done --force` skips tests (not recommended)

---

<!-- forked from Perficient-Corporate/perf-skillset (MIT) -->
