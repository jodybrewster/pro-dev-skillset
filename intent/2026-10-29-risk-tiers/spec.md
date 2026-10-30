---
intent: intent/2026-10-29-risk-tiers/intent.md
intent-status: draft
status: accepted
created: 2026-10-29T19:30:00-0400
author: Jody Brewster
---

# Spec: risk classifier and approval tiers

Built from `intent.md` in this folder (not yet committed).
Status: accepted (Jody, 2026-10-30).
Policies and skills consulted: `REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, ADRs 0001 to 0009 in `docs/decisions/` (0001, 0002, 0003 and 0004 bear on this change), `docs/roadmap.md` item 4, the pro-ship brainstorm sections on the risk gate, approval at one-person scale, "Built to scale up" and the twelve-factor signals, `plugins/pro-security/scripts/security_surface.py`, `plugins/pro-legal/scripts/legal_surface.py`, `plugins/pro-ai-sdlc/templates/intent.md` (its `risk:` line), `plugins/pro-ai-sdlc/scripts/guard.py` and `production-gate.py` (mode handling), `plugins/pro-ai-sdlc/commands/intent.md` and `spec.md`, `plugins/pro-ship/` as it stands and the user-level `merge-pr.md` command.
`/merge-pr` lives in the user-level commands folder (`~/.claude/commands/merge-pr.md`), outside this repo.
No `DESIGN.md` or `SECURITY.md` exists; the one project skill (`.claude/skills/skill-creator`) does not touch compliance, security, privacy or design.

## Summary

pro-ship gains a deterministic risk classifier, a `risk-tiers` skill that explains it and a merge gate hook.
The classifier is a Python script that reads the diff from the branch point and sorts it into low, medium or high from path signals, security and legal surface hits, dependency manifest changes, weakened tests, size, area count and the intent's declared risk.
It prints every signal that set the tier and a `demands` block (checks, reviewers, approval, local decision, label) that the PR gate's `pr-check` records in its stamp and hands to the code reviewer.
The merge gate hook on `gh pr merge` lets low through and returns `ask` for medium and high, so only Jody can answer it.
It requires the merge to be pinned to the commit it showed him.
A repo can override the tier table, the risky paths and the size thresholds in an optional `Risk tiers` section of `REVIEW.md`.
Everyone who installs pro-ship gets the classifier on the next update; the hook starts in warn mode.

## Requirements

### Functional

Classifier:

- R1. `plugins/pro-ship/scripts/risk-classify.py` exists and is tracked.
  It runs as `python3 risk-classify.py [--base <ref>] [--head <ref>] [--intent <path>] [--repo <path>] [--json]`.
  (Intent: Proposed outcome, first line.)
- R2. The diff is read from the merge base of the head (default `HEAD`) with the first of `--base`, the branch upstream, `origin/HEAD`, `origin/main` or `main` that resolves, to the head, in the repo named by `--repo` (default the cwd).
- R3. The output lists the tier first (`risk: high`), then one line per signal with its id, the tier floor it sets, the path or count that triggered it and a short reason.
  `--json` prints the same as one JSON object with the fields `tier`, `signals` (id, floor, strength, evidence, reason), `declared`, `findings`, `tie`, `architecture`, `demands`, `base` and `head`.
  (Intent: Proposed outcome, "printed with the signals".)
- R4. Each signal has a floor of low, medium or high and a strength of `strong` or `weak`.
  The tier is the highest floor among the signals and the declared risk (R14).
  A diff with no signal at medium or above is low.
- R5. Path signals, each with a built-in pattern and floor (a repo can change them, R16):
  - `workflows`, high: `.github/workflows/`.
  - `iac`, high: `*.tf`, `Dockerfile*`, `docker-compose*`, `k8s/`, `kubernetes/`, `helm/`, `terraform/`, `pulumi/`, `cdk/`.
  - `hook-scripts`, high: any `hooks/` directory, `hooks.json`, `.husky/`, `.claude/settings*.json`, `.claude/hooks/` and any script a tracked `hooks.json` runs.
  - `auth`, high: path segments named `auth`, `login`, `signin`, `signup`, `oauth`, `session`, `sessions`, `permissions`, `rbac`, `acl`, `policies` or `middleware`.
  - `payments`, high: path segments named `payments`, `payment`, `billing` or `stripe`.
  - `migrations`, high: `migrations/`, `migrate/`, `prisma/schema.prisma`, `schema.sql`, `*.sql` under `db/` or `database/`, `drizzle/`.
  - `env-config`, high: `.env` files other than `.example`, `.sample`, `.template` and `.dist`; files named `config.*`, `settings.*` or `env.*` under a `config/` directory or at the root.
  (Intent: Proposed outcome, the signal list; brainstorm, "Signals that raise risk".)
- R6. Documentation (`.md`, `.mdx`, `.txt`, `.rst`, anything under `docs/`) and lockfiles never raise a tier through path, dependency or size signals; a diff of only those files is low.
  A `.md` file under `.github/workflows/`, `hooks/` or `.claude/` is not excused.
- R7. `dependencies`, medium, strong: a dependency manifest (`package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`) gains a dependency name that was not there before.
  A version bump of an existing name and lockfile churn alone raise nothing.
- R8. Test signals, with test files recognised by `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.py` or a `tests/`, `test/` or `__tests__/` directory:
  - `test-deleted`, medium, strong: a test file deleted in the range.
  - `assertion-removed`, medium, strong: in a test file that still exists, more lines removed that contain `expect`, `assert` or `should` than were added.
  - `no-test-change`, medium, weak: non-documentation source files changed with more added lines than the `no_test_lines` threshold (R16) and no test file changed.
  (Intent: Proposed outcome, weakened tests.)
- R9. Size signals, from thresholds in R16:
  - `size`, floor by files and lines changed: medium past the medium threshold, high past the high threshold, weak.
  - `areas`, medium past the area threshold, weak.
  An area is the first path segment, or the first two when the first is `plugins`, `packages`, `apps` or `services`.
  Documentation and lockfiles do not count toward size or areas.
- R10. Surface signals: when `security_surface.py` or `legal_surface.py` can be found (R11) the classifier calls its `diff_files` on the same diff and maps categories to floors:
  - Security, high, strong: `auth`, `authz`, `payments`, `crypto`, `secrets`, `webhooks`, `uploads`, `ci-infra`.
  - Security, medium, strong: every other category (`api-route`, `dependencies`, `injection`, `xss`, `web-headers`, `ssrf-urls`, `llm`).
  - Legal, medium, strong: every category, including `dependency-license`.
  Each hit names the category and the paths.
- R11. The two surface modules are located by importing them from the first of these that exists: a sibling plugin directory next to this plugin's root, the newest installed copy of the plugin under the plugin cache or the path in `PRO_SHIP_SURFACE_DIR`.
  When a module cannot be found the output carries a `surface-unavailable` note naming it and the tier rests on R5 to R9 alone; it is never printed as "no surface hits".
  The classifier does not copy either module.
  (Intent: Constraints, plugins cannot import each other.)
- R12. `architecture`: a changed Dockerfile or infrastructure file (R5) or a newly added environment variable read (an added `process.env.NAME`, `os.environ["NAME"]` or `os.getenv("NAME")` whose name is not in the repo's `.env.example`, a medium weak signal) sets `architecture: true` in the output, so `pr-check` can run the architect's diff mode.
  (Brainstorm, "Twelve-factor is part of the architecture review", last bullet.)
- R13. `tie`: when the top tier is set only by weak signals the output names the tie as `[<top tier>, <one below>]`.
  The hook and the exit status always use the top tier.
  Only the skill may settle a tie (R24).
- R14. Declared risk is read from the `risk:` line of the front matter of the intent given by `--intent`, else of the one `intent/*/intent.md` the diff adds or changes, else of none.
  When it is `low`, `medium` or `high` the tier is the higher of computed and declared; a `declared-risk` signal records it.
  When the computed tier is higher than the declared one the output lists a `risk-underdeclared` finding naming the declared tier, the computed tier and the strongest signals.
  A missing intent or a missing, empty or unrecognised `risk:` is printed as `declared: none` and is not a finding.
  It can never lower the tier.
  (Intent: Proposed outcome, third and fourth lines.)
- R15. The `demands` block holds, per the default tier table:

  | Tier | Checks | Reviewers | Approval | Local decision | Label |
  |---|---|---|---|---|---|
  | low | build, lint, typecheck, tests | none, or the code reviewer on Sonnet | none | allow | none |
  | medium | all | code-reviewer | Jody | ask | none |
  | high | all | code-reviewer and security-architect | Jody | ask | `risk:high` |

  The brainstorm's table has "none beyond green checks" for medium approval; the one-person section of the same brainstorm and the roadmap require Jody, so this spec follows those (Flagged concerns 1).
  (Intent: Proposed outcome, fifth line.)

Overrides:

- R16. The classifier reads an optional `## Risk tiers` section of the repo's `REVIEW.md` holding one fenced block in a restricted YAML subset (flat keys and lists of strings, parsed by a small reader in the script).
  It may set `paths.high` and `paths.medium` (extra globs), `paths.low` (globs excused from path signals, never below the floors of R5 for `workflows` and `hook-scripts`), `thresholds` (`files_medium`, `files_high`, `lines_medium`, `lines_high`, `areas_medium`, `no_test_lines`) and `tiers.<tier>.checks` and `tiers.<tier>.reviewers` for the demands table.
  The approval and local decision columns are fixed by R15 and cannot be set here.
  (Intent: Proposed outcome, last line; brainstorm, "REVIEW.md can also carry the tier table".)
- R17. With no section, or no `REVIEW.md`, the defaults apply and the output says `policy: defaults`.
  A section that cannot be read (bad syntax, an unknown key, a threshold that is not a whole number) is ignored as a whole, the defaults apply and the output says `policy: unreadable (<reason>)`.
- R18. The default size thresholds are named constants at the top of the script, marked unmeasured; are fixed only after the calibration run of AC9.
  (Intent: Open questions, size thresholds.)

Merge gate:

- R19. `plugins/pro-ship/scripts/merge-gate.py` is registered once in `plugins/pro-ship/hooks/hooks.json` as a `PreToolUse` hook on `Bash` and is tracked.
  It acts only when a segment of the command is `gh pr merge` and passes every other command with no output.
- R20. The gate runs the classifier on the repo the command targets (`git -C <path>`, a leading `cd <path> &&`, else the session cwd) at its current `HEAD`.
  It never reads the tier from a stamp or a PR label.
- R21. Low: the gate allows.
  Medium or high: in enforce mode it returns `permissionDecision: ask` with a reason that shows the tier, the signals, the findings and the HEAD sha; says that approval covers that commit only.
  In warn mode it logs, shows the same text as a `systemMessage` and allows.
  Mode follows `mode.merge-gate`, then `mode`, in `CLAUDE_GUARD_DIR` or `~/.claude/hooks` (default warn), the lookup `guard.py` uses.
- R22. For medium and high the gate denies a `gh pr merge` that lacks `--match-head-commit <sha>` or whose sha is not the local `HEAD`, with a reason that gives the exact flag to add.
  The sha must be the full 40 characters or a prefix of `HEAD` of at least 7.
  An approval therefore covers one commit: GitHub refuses the merge when the pull request has moved on.
  The hook makes no network call to check this.
  (Intent: Proposed outcome, "an approval covers one HEAD commit".)
- R23. No environment variable, flag, file, PR comment or stamp field clears the `ask`.
  The only way past it is the person answering the prompt; an agent's statement of approval does not count.
  (Intent: Constraints, third line.)
- R24. If the session payload carries `permission_mode` `bypassPermissions` (or any mode in which `ask` would not prompt), the gate in enforce mode denies medium and high with a reason that says approval needs a prompt and the session cannot show one.
  This case must be confirmed against a live session before the gate moves to enforce (Flagged concerns 3).
- R25. When the classifier cannot run (no git, no merge base, a timeout, an unreadable payload) the gate logs `could-not-run` and treats the diff as high: in enforce mode it asks, in warn mode it says that the tier is unknown.
  It never reports low for a run that did not happen.
  The classifier script exits 2 in that case.

Skill and template:

- R26. `plugins/pro-ship/skills/risk-tiers/SKILL.md` explains the tiers, each signal, how the declared risk works, the `REVIEW.md` section and how to read the output, in harness-neutral prose with standard frontmatter.
  It tells the session to settle a tie by reading the evidence, to choose between the two tiers the classifier named and never above the top one; to record the choice and its reason next to the tier.
  It is the only place a model judges a tier.
  (Intent: Constraints, second line.)
- R27. The skill says how `/merge-pr` should use the classifier: run it, show the signals and the HEAD sha and ask Jody before `gh pr merge --match-head-commit <sha>`.
  `/merge-pr` itself is not edited by this change (Flagged concerns 5).
- R28. `plugins/pro-ai-sdlc/templates/review.md` (the REVIEW.md template) gains an optional, commented `## Risk tiers` section with the block of R16 and its defaults.
  Whether the template change lands here or in the review-policy intent is settled in Flagged concerns 2.

Hand-off to the siblings:

- R29. The JSON of R3 is the contract: `pr-check` stores `tier`, `signals`, `declared`, `findings` and `tie` under a `risk` field of its stamp and applies the label from `demands.label`; the code reviewer's handoff carries `tier` and `signals`.
  This spec fixes the field names above; the stamp's own shape belongs to the PR gate intent.
- R30. A `risk-underdeclared` finding is surfaced by `pr-check` in the PR body and the reviewer's handoff.
  The classifier does not fail the run for it.

### Non-functional

- N1. The classifier is deterministic: the same diff, intent and `REVIEW.md` always give the same output, with no network call, no model call and no clock.
- N2. It finishes in under 2 seconds for a diff of 1000 changed lines when both surface modules are present; each git call has a 10-second timeout.
- N3. Python 3 standard library only, matching every other hook in the marketplace.
- N4. Neither script edits the repo, runs anything taken from a payload or writes anywhere except `warn.log`.
- N5. The tier table, risky paths and thresholds are data (R16), not code paths, so the scaling dials in the brainstorm can read the same block later without changing the classifier's rules.
- N6. A malformed or empty hook payload never crashes the turn (REVIEW.md pass 2).

### Policy constraints applied

- Version-bump law (ADR-0002): pro-ship goes from 0.2.0 to 0.3.0 and pro-ai-sdlc, if the template change lands here, from 0.6.1 to the next minor, in both manifests and their marketplace entries, with `metadata.version` bumped once, in the same commit.
  The sibling intents bump the same plugins; the PRs stack and rebase onto whichever merges first; the final versions are taken at merge time.
  pro-security and pro-legal are read and not changed, so they are not bumped.
- Hook-loading law (ADR-0003): pro-ship has no `hooks/hooks.json` today; this change creates it with the one entry and the PR gate intent's hook is added to the same file.
- Codex parity (ADR-0004): the skill is harness-neutral with standard frontmatter, `plugins/pro-ship/.codex-plugin/plugin.json` aligns in version and no agent is added so no `.toml` is needed (the `.toml` for the reviewer belongs to the sibling intents).
  Codex sessions get the same tier from `risk-classify.py` run as a shell command.
- Skills first (ADR-0001): a script and hook are justified because the tier and the stop before a merge must be deterministic; the explanation lives in the skill.
- REVIEW.md, pass 1: the gate is a blocking hook, so each decision path has a case that blocks and a case that allows (AC4).
- REVIEW.md, pass 2: a malformed payload never crashes the turn (N6); no network calls and no execution of payload text (N4); evidence lines in the output never print a matched secret value, only paths and categories (R3).
- `CLAUDE.md`: no home-directory paths in the command, skill or docs except documented locations; paths are relative to the repo root.
- Plugins stand alone: a hard dependency on pro-security or pro-legal would break the hook-loading and install rules, so R11 degrades with a printed note instead.

## Design

### User experience

A docs fix:

```
risk: low
  declared: none
  policy: defaults
  signals: none at medium or above
```

A change to a workflow under an intent that declared `low`, on a push to merge:

```
risk: high
  workflows        high   strong  .github/workflows/ci.yml  a workflow file changed
  hook-scripts     high   strong  plugins/pro-ship/hooks/hooks.json  a hook registration changed
  declared-risk    low    -       intent/2026-10-29-x/intent.md
finding: risk-underdeclared  declared low, computed high (workflows, hook-scripts)
demands: all checks; code-reviewer and security-architect; approval Jody; label risk:high
```

In warn mode the merge runs and the session is told the tier.
In enforce mode `gh pr merge 42 --squash --match-head-commit 9f3c2ab` raises Claude Code's permission prompt with the text above and the sha.
A `gh pr merge 42` without the flag is denied with the exact flag to add.
A tie prints one extra line, `tie: [medium, high] (weak signals only: size, areas)`, which the skill resolves and records.

### System

New in pro-ship: `scripts/risk-classify.py`, `scripts/merge-gate.py`, `skills/risk-tiers/SKILL.md`, `hooks/hooks.json`.
Changed in pro-ship: both manifests.
Changed in pro-ai-sdlc (if R28 lands here): the REVIEW.md template and both manifests.
Changed at the root: `.claude-plugin/marketplace.json`, `tests/cases/routing.jsonl` (a case for the skill), `tests/ship-hooks.mjs` (gate cases), `tests/unit/risk-classifier.test.mjs` with fixtures under `tests/fixtures/risk/`, `docs/roadmap.md` (item 4 checked when it ships) and `README.md` where pro-ship is listed.
`merge-gate.py` imports `risk-classify.py` from its own directory; it copies the mode lookup and `warn.log` format from `guard.py`, because plugins install separately and cannot import each other.

Reuse: the command parsing (heredoc stripping, segment splitting, `git -C` and `cd` resolution) follows `plugins/pro-security/scripts/push-gate.py`; the dependency-name logic and doc and lockfile exclusions are the ones in `security_surface.py` and `legal_surface.py`, reached through R11 and re-implemented only for the cases in R7 and R6 that must work when neither module is installed.
The test-file patterns in R8 are written to match the pro-quality floor guard intent so the two agree, but neither plugin reads the other.
The mode handling follows `production-gate.py`, which already returns `ask` in enforce mode; unlike it, this gate has no environment variable that skips the prompt (R23).

### Alternatives considered

- A score with weights: harder to explain and to argue with; a tier equal to the highest floor lets the printed signal be the reason.
- A classifier that calls a model: not deterministic, too slow for a hook and unexplainable; a model only settles ties in the skill (R13, R26).
- Copying `security_surface.py` and `legal_surface.py` into pro-ship: about 970 lines that drift from their owners; R11 reads them when present and degrades with a note when not.
- A required dependency on pro-security and pro-legal: breaks the rule that plugins stand alone and the lesson in `CLAUDE.md` about hard dependencies.
- Approval recorded in the stamp or a PR comment: an agent can write either; the permission prompt cannot be answered by one.
- Approval by an environment variable such as `production-gate.py`'s `RELEASE_APPROVAL=1`: an agent can set it; ruled out by R23.
- Checking the PR's head sha over the network in the hook: breaks the no-network rule and hangs on a slow API; `--match-head-commit` makes GitHub do it.
- Putting the classifier in pro-quality (in the starter): it fits the reviewer, but the PR gate that calls it is in pro-ship; the home is Open question 1.
- Counting a bare path match in a `.md` file under `hooks/` as docs: a hook description is not a hook, but a file under `.github/workflows/` always is, so R6 excuses only plain documentation.

## Flagged concerns

Sources read: the policies listed at the top.

ADR needed: yes, the tier model, the rule that an agent's approval never counts and the home of the tier table are rules every gate and reviewer here will share.
Decided on 2026-10-30 under Jody's approval: it ships in this PR as `docs/decisions/0015-risk-tiers.md` (0012 is the reviewer handoff and 0013 the gate stamp).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | The brainstorm's tier table says medium needs "none beyond green checks" while its one-person section and the roadmap say medium needs Jody. | brainstorm; `docs/roadmap.md`; Jody | Decided on 2026-10-30 under Jody's approval: medium asks, following the one-person section and the roadmap (R15) |
| 2 | The REVIEW.md template change is owned by the review-policy intent; this intent also adds a `## Risk tiers` section to the same file; the PR gate and the scaling block will want the same fenced block format. | review-policy intent; PR gate intent; Jody | Decided on 2026-10-30 under Jody's approval: R28 lands here, because review-policy shipped in #82 without the section; the template is `plugins/pro-ai-sdlc/templates/REVIEW.md` and the one restricted-YAML block format is shared with the PR gate and the later scaling block |
| 3 | `ask` may not prompt when the session runs with permission checks bypassed, in which case the gate would be a no-op. | Claude Code behavior, to verify; Jody | Decided on 2026-10-30 under Jody's approval: the build verifies it against a live session (plan step 15); medium and high are denied in every `permission_mode` the check shows cannot prompt; when the check cannot be run, `bypassPermissions` is denied (R24) |
| 4 | An `ask` hook binds only the session that runs it; once a second person or CI merges, rulesets and CODEOWNERS must enforce; nothing here does. | brainstorm "Built to scale up"; roadmap items 21 and 31 | Decided on 2026-10-30 under Jody's approval: accepted at one-person scale, with the `risk:high` label and `--match-head-commit` as the hooks for rulesets and CODEOWNERS later |
| 5 | `/merge-pr` lives in the user-level commands folder, so the repo cannot version it and the hook is the only repo-side guard. | Jody | Decided on 2026-10-30 under Jody's approval: `/merge-pr` is left alone and the gate does the work; a pro-ship merge command is later work |
| 6 | The `risk:high` label can only be applied after the PR exists, but the `gh pr create` hook runs before it. | PR gate intent | Decided on 2026-10-30 under Jody's approval: the `pr-check` skill applies it right after `gh pr create` succeeds; a PostToolUse step for PRs opened outside the skill is later work |
| 7 | `risk-classify.py` finds `security_surface.py` and `legal_surface.py` by directory conventions (R11) that depend on how Claude Code lays out the plugin cache and may change. | Claude Code plugin layout; Jody | Decided on 2026-10-30 under Jody's approval: R11 ships with the `PRO_SHIP_SURFACE_DIR` escape and the `surface-unavailable` note; no shared home in pro-core |
| 8 | pro-ship is opt-in and not in the starter, so repos without it get no tiers. | brainstorm, "Join pro-dev-starter when v0.1 lands"; Jody | Decided on 2026-10-30 under Jody's approval: ships in pro-ship; pro-ship joins the starter in the PR gate's release, which lands first |
| 9 | Tying the approval to a commit relies on `gh pr merge --match-head-commit`, which blocks the merge when the remote head differs but does nothing for a merge made with the GitHub UI. | `gh` behavior; roadmap item 31 | Decided on 2026-10-30 under Jody's approval: accepted; the UI path is closed by rulesets later |
| 10 | The size thresholds are not in the brainstorm and would be invented here. | Jody | Decided on 2026-10-30 under Jody's approval: placeholder named constants marked unmeasured until the calibration run over merged PRs (AC9); Jody fixes the numbers from that run |
| 11 | The classifier's hook-script signal also treats a script run from `hooks.json` as a hook script, which makes this repo's `plugins/*/scripts/*.py` hook runners high but not its other scripts. | REVIEW.md pass 2; Jody | Decided on 2026-10-30 under Jody's approval: accepted as specced, since a hook runner runs in every consumer's session |
| 12 | Every sibling plugin version in this spec (pro-ship 0.3.0, pro-ai-sdlc next minor) will collide with the other intents drafted today. | ADR-0002; Jody | Decided on 2026-10-30 under Jody's approval: take the next number over main at build time and stack the PRs, per `docs/version-bump-law.md` |

## Open questions

1. Which plugin owns the classifier: answered.
   Decided on 2026-10-30 under Jody's approval: pro-ship, with an optional read of the two existing classifiers (R11, Flagged concerns 7).
2. Whether a person can override the tier down and where it is recorded: answered.
   Decided on 2026-10-30 under Jody's approval: only Jody can override a tier down, recorded in the stamp against one HEAD sha, echoed in the PR body and never by an agent; an override changes reviewer depth and cannot remove the `ask` for a medium or high diff.
   It is later work, allowed by the spec's Out of scope: a later change adds `--accept-tier`.
3. Whether the tier table lives in `REVIEW.md`: answered, yes, as an optional section with the defaults of R15 (R16, R17), with the approval column fixed until the scaling block exists.
4. The size thresholds: answered.
   Decided on 2026-10-30 under Jody's approval: placeholder named constants marked unmeasured until the calibration run over merged PRs (AC9, R18).
5. How medium gets local approval: answered, the gate's `ask` for the step an agent cannot answer (R21) and `/merge-pr` showing the evidence (R27).
6. Whether `ask` prompts under a bypass: answered as a build step.
   Decided on 2026-10-30 under Jody's approval: the build checks it against a live session (plan step 15) and the gate denies medium and high in any mode that cannot prompt; if the check cannot be run, `bypassPermissions` is denied (R24, Flagged concerns 3).
7. Likely needs an ADR: answered, yes (Flagged concerns).

## Acceptance criteria

- AC1. `node tests/check.mjs`, `node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70`, `node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC2. `grep -c merge-gate.py plugins/pro-ship/hooks/hooks.json` prints 1 and `git ls-files plugins/pro-ship/scripts/risk-classify.py plugins/pro-ship/scripts/merge-gate.py` lists both files.
- AC3. `node --test tests/unit/risk-classifier.test.mjs` passes these fixture diffs under `tests/fixtures/risk/`, each landing in its tier with the named signals in the output:
  - Low: a README edit; a test-only change; a lockfile-only change; a three-line change to one source file with its test; a docs change with `risk: low` declared.
  - Medium: a new dependency in `package.json`; source lines above `no_test_lines` with no test change (tie reported); a deleted test file; removed assertions with none added; a change spanning more areas than `areas_medium`; a legal hit such as a new GPL dependency; an API route hit from the security classifier.
  - High: a `.github/workflows/` file; a migration; a path under `auth/`; `hooks.json`; a `Dockerfile`; a file under `payments/`; an `.env` file; `risk: high` declared on a tiny docs diff.
- AC4. `node tests/ship-hooks.mjs` passes gate cases in a throwaway repo: low allows with no output; medium and high ask in enforce mode and allow with a message in warn mode; medium and high with a missing or mismatched `--match-head-commit` deny; the matching flag asks; a bypass `permission_mode` denies in enforce mode; a diff the classifier cannot read asks as high; a malformed payload exits 0; a non-merge command, `gh pr view` included, produces no output.
  Every decision that can block has one case that blocks and one that allows.
- AC5. A fixture whose intent declares `low` and whose diff touches `.github/workflows/` prints a `risk-underdeclared` finding and tier high; a fixture declaring `high` with a docs-only diff prints tier high and no finding; a fixture with no intent prints `declared: none` and no finding.
- AC6. With a `## Risk tiers` block in a fixture `REVIEW.md` that adds a path to `paths.high`, that path lands high; with a malformed block the output says `policy: unreadable` and gives the default tier; a block that tries to set `paths.low` on `.github/workflows/` leaves it high; no block prints `policy: defaults`.
- AC7. With `security_surface.py` and `legal_surface.py` hidden from the lookup the classifier prints `surface-unavailable` for each and still tiers the AC3 path fixtures correctly.
- AC8. Running the classifier twice on the same fixture gives byte-identical output; a run with the network disabled gives the same output (N1).
- AC9. A calibration run over this repo's last merged PRs (the list and their tiers printed in the PR, not committed) shows each PR's tier and signals; Jody reviews it and the size constants are fixed from it.
  It gates fixing the thresholds, not this PR's merge.
- AC10. The PR's own diff, classified by the script, prints tier high with a `hook-scripts` signal (the PR adds `hooks/hooks.json`); the run is pasted in the PR body.
- AC11. A line in the skill and the output tells a session that a tie is the only case where a model may choose; the gate's source contains no model or network call (`grep -c -E "urllib|requests|anthropic|http" plugins/pro-ship/scripts/merge-gate.py` prints 0).
- AC12. After two weeks of normal work in warn mode in at least two of Jody's repos, `grep merge-gate ~/.claude/hooks/warn.log` shows no prompt Jody thinks was wrong (checked after merge; it gates the later switch to enforce, not this PR).

## Out of scope

`pr-check`, its stamp and the `gh pr create` hook; they call the classifier and store its JSON (R29).
The code reviewer and the architect review; they receive the tier and the `architecture` flag.
The `REVIEW.md` scaling block, rulesets, CODEOWNERS, two-person approval and trusted-author paths.
Overriding the tier down (Open question 2).
Editing `/merge-pr`.
A Codex second reviewer on high.
Switching the gate to enforce mode.
