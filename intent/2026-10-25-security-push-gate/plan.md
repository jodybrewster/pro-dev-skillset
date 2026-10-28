# Plan: one security gate, on push, scoped to the diff

Branch `security-push-gate`, stacked on `remove-worktrunk` (PR 56) so `metadata.version` goes 1.45.0 to 1.46.0 without a conflict.

## Files touched

- `plugins/pro-security/hooks/hooks.json`
- `plugins/pro-security/scripts/push-gate.py` (new, from `commit-gate.py`)
- `plugins/pro-security/scripts/commit-gate.py`, `ideation-nudge.py`, `plan-doc-gate.py`, `plan-gate.py` (deleted)
- `plugins/pro-security/scripts/security_surface.py` (remove helpers only the deleted scripts used)
- `plugins/pro-security/agents/security-architect.md`
- `plugins/pro-security/.codex-plugin/agents/security-architect.toml`
- `plugins/pro-security/skills/security-architect/diff-review.md`
- `plugins/pro-security/.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `tests/security-hooks.mjs`, `tests/README.md`
- `README.md`, `docs/releases.md`

## Steps

1. Rename `commit-gate.py` to `push-gate.py` with `git mv`.
   Rewrite `classify()` so `git push` returns `{"kind": "push", "dir", "dry_run"}` and `git commit` returns `None`; keep the `gh pr create` branch.
   In `main()`, compute the push diff per S2.4 (`git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` first), keep the PR path, keep the hash-per-session state under the key `gated_diffs`, and rewrite the deny reason per S2.7.
   Satisfies S2.1 to S2.8.
2. Delete the three planning scripts.
   In `security_surface.py`, remove helpers no remaining caller uses (`PLAN_SECTION_RE`, `SELF_REVIEW_NOTE`, `architect_ran`, `text_hits` and the text category table if only the deleted scripts read them); keep `diff_files`, `run_git`, `read_payload`, `deny_pretool`, `session_state`, `save_state`, `AGENT_HINT`.
   Confirm with `grep -n 'ss\.' push-gate.py`.
   Satisfies S1.2, S1.3.
3. Rewrite `hooks/hooks.json` to the single entry.
   Satisfies S1.1.
4. Edit the agent's Diff mode step 1, `diff-review.md` lines 14 to 16 and the `.toml` `developer_instructions` per S3.1 to S3.4.
5. Rewrite `tests/security-hooks.mjs`: drop the plan-gate, plan-doc-gate and ideation-nudge groups and their fixtures; turn the commit-gate group into the push-gate group with the cases in S4.1.
   The throwaway repos need a bare `origin` remote with `main` pushed so `@{upstream}` and `origin/main` resolve; add a `makeRepoWithOrigin()` helper beside `makeRepo()`.
   Update the header comment and the script list on line 95.
   Update `tests/README.md`.
   Satisfies S4.1, S5.5.
6. Bump pro-security to 0.2.0 in both manifests and the marketplace entry, rewrite the three descriptions, set `metadata.version` to 1.46.0.
   Satisfies S5.1, S5.2.
7. README: line 182 "enforced by hooks" becomes "held once at push by a hook"; the pro-security paragraph (lines 220 to 226) loses the plan-mode and ideation sentences and gains one sentence on the push gate and one on the diff-only scope; line 266's comment.
   `docs/releases.md`: pro-security row and the `metadata.version` line.
   Satisfies S5.3, S5.4.
8. Verify: `node tests/security-hooks.mjs`, `node tests/check.mjs`, `node tests/eval.mjs --dry`, `claude plugin validate . --strict`, `claude plugin validate plugins/pro-security --strict`, and the S1.3 grep.
   Satisfies S4.2 to S4.4.

## Risks

- `@{upstream}` on a branch whose upstream was deleted makes `git diff` fail; the script treats a failed `run_git` as "emit nothing", which is the fail-open behaviour we want.
- The test harness needs a real remote for upstream tracking; a bare repo in the temp dir is enough and needs no network.
- Removing `text_hits` from `security_surface.py` breaks nothing in pro-legal, which has its own `legal_surface.py`.

## Rejected

- Keeping `commit-gate` and adding a mode file. The developer asked for a review at push, not a quieter review at commit.
- Gating `git push` only and leaving `gh pr create` out. A PR opened from a branch pushed earlier would skip review of commits added since; the PR path stays.
- Switching the gated review to Sonnet. The agent's model was set to Opus on 2026-10-17 on purpose; narrowing the scope is the cost fix.

## Proof of done

The S1.3 grep, the test and check output and the two validate lines, pasted into the PR body against each spec statement.
