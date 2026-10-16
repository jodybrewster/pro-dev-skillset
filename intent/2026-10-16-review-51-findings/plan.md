# Plan: land the findings from the review of PR 51

A small fix, so there is no `spec.md`; the intent states its check.
Work happens in the `review-51` worktree off `origin/main` (cc48aad).
The job ends at an open PR.

## Step 1: the meta-plugin rule

1. Keep RELEASING.md's rule as written: any bump of a dependency bumps `pro-starter`, because that bump is what makes a consumer's update re-resolve.
2. Amend ADR-0002's Consequences to match and record that the earlier wording, which named only minor bumps, was corrected on 2026-10-16.
3. Bump `pro-starter` 1.12.1 to 1.12.2 in its manifest and marketplace entry and `metadata.version` 1.42.1 to 1.42.2.
4. Update the `pro-starter` row and the marketplace version in `docs/releases.md`.

Proof: `node tests/check.mjs` and `claude plugin tag plugins/pro-starter --dry-run`.

## Step 2: the verify loop

1. Replace `|| break` in CLAUDE.md's step 3 with `|| exit 1` inside a subshell, so the chain fails and an interactive shell stays open.
2. Keep CLAUDE.md at or under 110 lines.

Proof: `bash -c 'for p in a b; do false || exit 1; done; echo $?'` prints 1, and the new loop run against the repo exits 0.

## Step 3: nits

1. Plain dash for the em dash in `.claude/commands/research.md`.
2. A placeholder for the local plan path in `docs/plans/AGENT-SKILLS-INTEGRATION.md`.
3. Remove the comma before a conjunction in ADR-0004, `docs/licenses.md`, CLAUDE.md and README.md, leaving the pro-nextjs paragraph of `docs/licenses.md` to the `next-bridge` branch.
4. Add a grep for tilde-prefixed home paths to REVIEW.md's security pass.

Proof: `grep` for the em dash and the old path returns nothing.

## Step 4: Apache-2.0 for agent-browser

1. Append the canonical text from https://www.apache.org/licenses/LICENSE-2.0.txt under the agent-browser heading in `plugins/pro-testing/LICENSE`.
2. Add the upstream NOTICE if `vercel-labs/agent-browser` has one, or say in the commit that it has none.
3. Bump `pro-testing` 0.5.6 to 0.5.7 in both manifests and its marketplace entry, add its releases row and note in the `pro-starter` row that 1.12.2 also picks up 0.5.7.

Proof: the appended text matches the canonical file and `claude plugin tag plugins/pro-testing --dry-run` passes.

## Gate

`node tests/check.mjs`, `node tests/eval.mjs --dry`, `claude plugin validate . --strict`, the same for `plugins/pro-starter` and `plugins/pro-testing`, and `claude plugin tag --dry-run` for both.
