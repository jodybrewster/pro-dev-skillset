# Plan: ADRs in the SDLC loop

Built from `spec.md` and `intent.md` in this folder.
Status: approved.
Approver: the maintainer.
Dated: 2026-10-27.

## Files that change

- `plugins/pro-ai-sdlc/templates/adr.md` (new): S5.
- `plugins/pro-ai-sdlc/commands/adr.md` (new): S4, S6.
- `plugins/pro-ai-sdlc/commands/intent.md` (modified): S1.
- `plugins/pro-ai-sdlc/commands/spec.md` (modified): S3, S4; add `docs/decisions` to the "Policy files present" probe.
- `plugins/pro-ai-sdlc/templates/spec.md` (modified): S2.
- `plugins/pro-ai-sdlc/templates/plan.md` (modified): S7.
- `plugins/pro-ai-sdlc/README.md` (modified): S8.
- Manifests and `.claude-plugin/marketplace.json` (modified): S9.
- Codex files for the new command if `docs/codex-parity.md` requires them: S10.
- The next ADR in `docs/decisions/` and its index row: this repo's own record of the change.

## Order of work

1. Templates: `adr.md`, then the spec and plan template edits.
2. Commands: `intent.md`, `spec.md`, new `adr.md`.
3. README and this repo's ADR.
4. Version bumps and Codex parity.
5. Checks from `CLAUDE.md` "Verifying your work".

## Tests that prove it

- Greps for each statement's phrases in the files named.
- The three check commands in S11.
- After merge, in job-search-2026: `claude plugin marketplace update pro-dev-skillset`, `claude plugin update pro-ai-sdlc@pro-dev-skillset`, then the installed cache shows 0.2.0 with `commands/adr.md`.

## Risks

Most likely to go wrong: the version-bump cascade (S9); a missed manifest leaves installs on the stale cache.
Prose in commands must stay harness-neutral for Codex.

## Options not taken

- ADR written at `/intent`: an intent has no options weighed yet, so there is no decision to record; the intent only flags it.
- Only a standalone `/adr` command: the decision would drift away from the change that caused it.

## Proof of done

The S11 commands pass, the PR is merged and job-search-2026 runs the updated plugin.

## Departures from plan

None in the plan's scope.
Extra edits beyond the plan: `docs/releases.md` (RELEASING.md requires a row per bump) and the pro-ai-sdlc manifest and marketplace descriptions now mention `/adr`.
No Codex files were needed: `.codex-plugin/plugin.json` carries no command list and the existing checks pass.
