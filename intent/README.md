# Intents

Every change to this marketplace starts here, one folder per change, named `<date>-<slug>/`.
The folder holds the artifacts each stage writes and the next stage reads.

- `intent.md`: why the change is wanted, the problem, the proposed outcome and its risk, with a `status` in the front matter (`proposed`, `accepted`, `done` or `dropped`).
- `spec.md`: what must be true when the change merges, as numbered statements a command, a grep or a file can check.
- `plan.md`: how to get there, as ordered steps that cite the statements they satisfy, committed before the first change and kept true afterwards.

`intent.md` and `spec.md` are written in the main checkout, never in a worktree, on a short branch off `main`.
Each goes up as its own pull request that the agent merges as soon as its checks pass, with no approval needed, so it can be read on GitHub right away.
Nothing is pushed straight to `main`.
A worktree starts at the plan stage.
`/execute <plan.md>` builds an approved plan in its own worktree and opens that pull request; it never merges.
The pull request that lands the change links its folder, ticks every spec statement with its proof and is reviewed against [REVIEW.md](../REVIEW.md).
A small fix can skip `spec.md` when the intent states its check.
A decision that outlives the change gets an ADR in [docs/decisions/](../docs/decisions/README.md).
