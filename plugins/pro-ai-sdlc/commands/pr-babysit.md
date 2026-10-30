---
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git fetch:*), Bash(git merge:*), Bash(git rev-parse:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr diff:*), Bash(gh run view:*), Bash(gh api graphql:*), Bash(gh repo view:*)
description: "Loop on the current PR - fix failing checks, answer review threads, verify, push and re-check until it is green and waiting only on approval. Never merges."
argument-hint: "[pr-number | url | branch]  (default: the PR for the current branch)"
---

## Context

- Current branch: !`git branch --show-current`
- Working tree: !`git status --short --branch`
- PR: !`gh pr view $ARGUMENTS --json number,title,url,state,isDraft,headRefName,baseRefName,mergeable,mergeStateStatus,reviewDecision 2>&1`
- Checks: !`gh pr checks $ARGUMENTS 2>&1 | head -40`
- Repo: !`gh repo view --json nameWithOwner,defaultBranchRef 2>&1`

This is the loop after `/review` and before a person merges.
It gets a PR to the point where the only thing missing is a human approval, then stops.

## Your task

### 1. Gate

Stop and report if the PR lookup failed or the PR is not `OPEN`.
If the current branch is not the PR's `headRefName`, switch to it when the tree is clean and stop otherwise.
Never touch the base branch.

### 2. Loop, at most three rounds

Every round counts toward the cap, including a round that only fixes failing checks or conflicts.
Keep a handled list of the threads and checks you have addressed.
Never start a round whose only open items repeat an entry on it.

Each round:

1. Fetch the state.
   - Failing checks: `gh pr checks <number> --json name,state,bucket,link`; for each with bucket `fail`, read the log with `gh run view <run-id> --log-failed` (the run id is in the link).
   - Unresolved review threads:

     ```bash
     gh api graphql -f owner=<owner> -f repo=<repo> -F number=<number> -f query='
       query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){
         reviewThreads(first:100){nodes{id isResolved isOutdated path line
           comments(first:30){nodes{author{login} body url createdAt}}}}}}}'
     ```

     A thread needs work when it is unresolved and its last comment is not your reply.
     Skip a thread whose comment is tagged Pre-existing and list it in the report.
   - Conflicts: `mergeStateStatus` `DIRTY` or `BEHIND`.
2. If nothing needs work and every check passed (or there are none), leave the loop.
   Pending checks are not done: wait with `gh pr checks <number> --watch --fail-fast` and fetch again.
3. Address each item.
   Fix every instance of one class of problem in the same round and reply once per thread with the same commit.
   - Failing check: reproduce it locally, fix the cause and never weaken the check, skip a test or relax a lint rule to get green.
   - Review thread: make the change it asks for, or, if you disagree, leave the code as is and reply with the reason.
     Reply on the thread with what changed and the commit hash:

     ```bash
     gh api graphql -f id=<thread id> -f body='<reply>' -f query='
       mutation($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{url}}}'
     ```

     Do not resolve threads a human opened; the reviewer resolves them.
   - Conflict: `git fetch origin` and `git merge origin/<base>`, resolve, never rebase or force-push.
   - Anything that needs a product decision: do not guess; note it for the report.
4. Run the project's verify command (from the repo's CLAUDE.md, else `package.json` scripts `check`, `verify`, `validate`, `test`, else Makefile `verify`, `check`, `test`).
   Do not push until it passes.
5. Commit with a message that says what the round fixed and push with plain `git push`.
   Never pass `--no-verify` and never force-push.
6. Re-check: wait for the new checks to finish, then start the next round.

### 3. Stop

Stop when checks are green, no thread needs work and the PR is waiting only on approval.
Also stop after three rounds: stop, ask Jody to reconsider the approach and list what is still open.
Never merge, never enable auto-merge and never approve.
If a draft PR is otherwise ready, say so; do not mark it ready yourself.

### 4. Report

A few lines: the PR link, the rounds used, each fix with its commit hash, each thread answered without a code change and why, each Pre-existing thread skipped, the verify command result and the current `reviewDecision`.
If you stopped at the cap of three rounds, list what is still failing or open, what you think it needs and ask Jody whether to reconsider the approach.
When everything is green, say it is waiting on approval and that a person merges.
