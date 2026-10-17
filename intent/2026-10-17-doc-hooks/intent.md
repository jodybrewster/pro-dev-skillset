---
source: planning-session
kind: bug
status: accepted
risk: medium
created: 2026-10-17
author: Jody Brewster
---

# Intent: the pro-quality doc hooks judge the right repo and stop blocking legitimate edits

## Problem

Two PreToolUse hooks in `pro-quality` blocked work they were written to allow.
Both ship to every repo that installs the marketplace, so the change stays narrow.

Bug 1: `docs-before-push.py` ran git in the session's cwd and never read the command.
A session rooted in a repo with no remote pushed a branch of another repo, as `cd <wt> && ...` and as `git -C <wt> ...`.
The hook compared the session repo's last commit (a STATUS.md change) because with no upstream it fell back to `HEAD~1`.
It blocked a branch that never touched STATUS.md and named three docs that branch had no reason to change.

Bug 2: `docs-to-project.py` treated everything under `~/.claude/` as a stray doc and any `.md` outside the session repo as misplaced.
It blocked an edit of `~/.claude/CLAUDE.md`, a file the user asked to change, and a write of a temp file in the Claude session scratchpad.

## Proposed outcome

The push gate evaluates the repo being pushed and only the commits being pushed.
The write gate lets agent instruction files and scratch files through and still blocks plan and analysis docs written into `~/.claude/`.

Decisions:

1. Target repo comes from `git -C <path>`, a leading `cd <path>`, wrapper forms (`env`, `command`, `timeout N`, `bash -c`, `sh -c`) and else the payload cwd.
2. Range is `upstream...HEAD`, or the merge-base with the remote default branch for a new branch. With no remote to compare against there is nothing to judge.
3. Only root-level `*.md`, `docs/**` and `intent/**` count as docs. `SKILL.md`, `commands/*.md` and `agents/*.md` are shipped behavior and stay code.
4. Heredoc bodies are data. They are stripped before the command is split, so a `cd` line in a commit message is not a `cd`.
5. Agent files (`CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md`) are allowed directly in `~/.claude/` and inside the session's own repo (`CLAUDE_PROJECT_DIR`, else cwd). They stay blocked in other repos and in `~/.claude/` subfolders such as `plans/`.
6. Scratch space is `/tmp/claude-*`, `/private/tmp/claude-*` and paths under `$TMPDIR` that have a `claude-` segment. Not all of `/tmp`, so the answer is the same on macOS and Linux.
7. The block message names the repo it judged.

Fail-open choices, on purpose:

- A push whose target directory cannot be resolved (a variable such as `cd $WT`, `git -C "$WT"`, `pushd`) is allowed. The hook cannot know the repo, and a wrong block costs more than a missed reminder.
- No remote, no merge-base or a git call that fails or times out: allow.
- A malformed payload or unparsable command: allow.

## Affected users and systems

Every session in every repo with `pro-quality` installed, from the next release and plugin update. Sessions on the cached 0.9.3 keep the old behavior until then.

## Constraints

Nothing is merged, tagged or published by anyone but Jody.
The version-bump law applies: `pro-quality` 0.9.5 and marketplace metadata 1.44.0.
A blocking hook needs a case that shows it blocking and one that shows it allowing (REVIEW.md).

## Check

`node tests/doc-hooks.mjs` passes and its failing cases were committed before the fix.
`node tests/check.mjs && node tests/eval.mjs --dry` pass.
`claude plugin validate . --strict` and `claude plugin validate plugins/pro-quality --strict` pass.
