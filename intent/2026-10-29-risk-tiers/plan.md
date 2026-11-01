# Plan: risk classifier and approval tiers

Built from `spec.md` (commit 6926f78, with its open questions and flagged concerns resolved on 2026-10-30) and `intent.md` in this folder.
Status: implemented.
Approver: the maintainer (2026-10-30, all P0 work approved).
It adds a merge gate on `gh pr merge` in every repo that installs pro-ship and sets a tier model every gate and reviewer here will follow, which is why an approver is named.
No second approver is needed because the maintainer owns this marketplace and decided the open questions and ADR-0015 under that approval.
The blast radius is bounded: the hook starts in warn mode, makes no network or model call, edits nothing and treats a run that could not happen as high, never low.
The review pass in step 22 reads both scripts as a second pair of eyes.
Dated: 2026-10-30.

Decided on 2026-10-30 under the maintainer's approval, recorded in the spec:

- The classifier lives in pro-ship (open question 1, flagged concern 7).
- Only the maintainer can override a tier down, recorded in the stamp against one HEAD sha; it is later work and not built here (open question 2).
- The size thresholds are placeholder named constants marked unmeasured until the calibration run over merged PRs (open question 4, AC9).
- Whether a hook's `ask` still prompts when permission checks are bypassed is verified live in step 15; until then and if the check cannot be run, medium and high are denied under `bypassPermissions` (open question 6, R24).
- R28 lands here, because review-policy shipped in #82 without the `## Risk tiers` section (flagged concern 2).
- The tier model ships as ADR-0015 in this PR.

Build order: this builds after pr-gate, which adds `/pro-ship:pr-check`, `scripts/pr-check.py`, `scripts/pr-gate.py`, pro-ship's `hooks/hooks.json`, `tests/ship-hooks.mjs`, the stamp at `.pro-dev/ship/pr-check.json` with `tier: unclassified`, the stamp contract page under `docs/`, ADR-0013 and pro-ship's place in `pro-dev-starter`.
It also needs code-reviewer's `plugins/pro-quality/skills/requesting-code-review/handoff.md` with its `risk` field and ADR-0012.

## Files that change

New in pro-ship:

- `plugins/pro-ship/scripts/risk-classify.py` (new): the classifier, Python 3 standard library, run from a shell and imported by the gate (R1 to R18).
- `plugins/pro-ship/scripts/merge-gate.py` (new): the `PreToolUse` hook on `gh pr merge` (R19 to R25).
- `plugins/pro-ship/skills/risk-tiers/SKILL.md` (new): tiers, signals, declared risk, the `REVIEW.md` section, reading the output, settling a tie and how `/merge-pr` should use it (R26, R27).

Modified in pro-ship (files pr-gate created):

- `plugins/pro-ship/hooks/hooks.json` (modified): one more entry under the `Bash` matcher of `PreToolUse` for `merge-gate.py`, with a 30 second timeout (R19, AC2).
- `plugins/pro-ship/scripts/pr-check.py` (modified): `stamp` takes the classifier's JSON, writes the real `tier` in place of `unclassified` and stores `tier`, `signals`, `declared`, `findings` and `tie` under a new `risk` field; the mutation check reads that tier (R29, pr-gate R12 and R29).
- `plugins/pro-ship/skills/pr-check/SKILL.md` and its PR body sidecar (modified): run the classifier first, pass `tier` and `signals` in the reviewer handoff's `risk` field, print a `risk-underdeclared` finding in the PR body's Risk section and apply the `risk:high` label right after `gh pr create` succeeds (R29, R30, flagged concern 6).
- `plugins/pro-ship/.claude-plugin/plugin.json` and `plugins/pro-ship/.codex-plugin/plugin.json` (modified): the next minor over main and a description that names the classifier and the merge gate (version-bump law, Codex parity).

Modified in pro-ai-sdlc:

- `plugins/pro-ai-sdlc/templates/REVIEW.md` (modified): an optional, commented `## Risk tiers` block in the same style as the template's other optional blocks, holding the restricted-YAML block of R16 with the defaults of R15 (R28).
  The spec calls the file `templates/review.md`; its real name is `REVIEW.md`.
- `plugins/pro-ai-sdlc/.claude-plugin/plugin.json` and `plugins/pro-ai-sdlc/.codex-plugin/plugin.json` (modified): the next minor over main.

New and modified at the root:

- `docs/decisions/0015-risk-tiers.md` (new): the tier model, status proposed.
- `docs/decisions/README.md` (modified): the 0014 row.
- The stamp contract page pr-gate wrote under `docs/` (modified): the `risk` field and the meaning of `tier` once classified.
- `tests/unit/risk-classifier.test.mjs` (new): the classifier cases of AC3 and AC5 to AC8, run by `node --test`.
- `tests/fixtures/risk/*.json` (new): one JSON file per fixture describing a base tree, a head tree, an optional intent and an optional `REVIEW.md`.
  Paths live as strings inside JSON, never as real directories, so this PR's own diff gains no `auth/`, `migrations/` or `.github/workflows/` path and no literal secret.
- `tests/ship-hooks.mjs` (modified): the merge gate cases of AC4 and the stamp `risk` cases of step 16.
- `tests/cases/routing.jsonl` (modified): one case that expects `risk-tiers`.
- `.claude-plugin/marketplace.json` (modified): the pro-ship and pro-ai-sdlc entries and `metadata.version`.
- `README.md` (modified): the pro-ship bullet names the classifier and the merge gate.
- `docs/roadmap.md` (modified): risk-tiers under "Now" moves to built, item 4 in progress until sign-off.

At sign-off only:

- `docs/decisions/0015-risk-tiers.md` (modified): Status to accepted and "Where it is enforced" filled in.
- `intent/2026-10-29-risk-tiers/intent.md` and `spec.md` (modified): `status` to accepted.
- `intent/2026-10-29-risk-tiers/plan.md` (modified): Status to implemented and the Done block filled in.

Not changed on purpose:

- `plugins/pro-security` and `plugins/pro-legal`: their surface modules are read at run time, never copied or edited, so they are not bumped (R11).
- `~/.claude/commands/merge-pr.md`: user level and outside the repo (R27, flagged concern 5).
- `plugins/pro-ai-sdlc/scripts/production-gate.py`: it already asks on `gh pr merge` in enforce mode; the overlap is a risk below, not a change here.
- `tests/check.mjs`: pr-gate wired `tests/ship-hooks.mjs` into it and `node --test tests/unit/*.test.mjs` picks up the new unit file.
- `plugins/pro-dev-starter`: pr-gate already added pro-ship with a `*` constraint.
- `plugins/pro-core/registry/engines.json`: the skill is not a bridge and adds no engine.
- `tests/cases/uncovered.json`: the new skill gets a real routing case.
- `CLAUDE.md` and `AGENTS.md`: the expected counts in "Verifying your work" are dated to one run and a refresh is a separate docs change.

## Order of work

Steps 1 and 2 are serial and set the contract every track builds on.
Steps 3 to 9 (Track A), steps 10 and 11 (Track B), steps 12 and 13 (Track C) and step 14 (Track D) touch disjoint files.
The orchestrator dispatches them to four Sonnet subagents at once in one turn, each with a self-contained prompt that quotes its requirements and the JSON contract from step 2.
Step 15 needs a live interactive session and can run at any time after step 2, in parallel with the tracks.
Steps 16 to 22 need the tracks and run in order.
Take the build off a fresh `origin/main`, because the maintainer merges in parallel.

Serial start.

1. Preflight. Satisfies nothing by itself; it stops a build on the wrong base.
   `git fetch origin` and rebase `intent/risk-tiers` onto `origin/main`.
   Stop unless main holds pr-gate's `plugins/pro-ship/hooks/hooks.json`, `scripts/pr-check.py`, `scripts/pr-gate.py`, `skills/pr-check/SKILL.md`, `tests/ship-hooks.mjs`, its stamp contract page and ADR-0013, plus code-reviewer's `handoff.md` and ADR-0012.
   Read how `pr-check.py` writes `tier`, where it decides to run the mutation check, how it finds sibling plugin scripts and how `tests/ship-hooks.mjs` builds throwaway repos.
   Write down in the prompts for steps 3 to 14 the helper names found, so the tracks reuse them instead of writing new ones.
   Check: every file above is listed by `git ls-files` and `node tests/ship-hooks.mjs` passes before any change.

2. Classifier skeleton and the JSON contract. Satisfies R1, R2, R3, R4 and part of R5 and R7.
   Cases first in `tests/unit/risk-classifier.test.mjs`: a helper that reads a fixture JSON, builds a temp repo with `main` holding the base tree and `feat` holding the head tree and runs the script with `--json`.
   Cases: a README-only diff is low; a `.github/workflows/ci.yml` change is high with a `workflows` signal; a new name in `package.json` is medium with `dependencies`; `--base` overrides the upstream; a repo with no merge base and a non-git directory exit 2; text output starts with `risk: <tier>`.
   Run them and see them fail because the script is missing.
   Then write `plugins/pro-ship/scripts/risk-classify.py` with a `classify(repo, base=None, head="HEAD", intent=None) -> dict` function, a `CouldNotRun` exception and a `main()` that prints text or JSON.
   The JSON has every field of R3: `tier`, `signals` (id, floor, strength, evidence, reason), `declared`, `findings`, `tie`, `architecture`, `demands`, `base`, `head`, plus `policy` and `notes` (for `surface-unavailable`).
   Exit codes, which the spec leaves unnamed: 0 low, 3 medium, 4 high, 2 could not run, 64 usage error.
   An empty range (head equal to the merge base, as when the session sits on `main`) raises `CouldNotRun("empty range")`, because an empty diff is not a pull request and must never read as low (R25).
   Every git call has a 10 second timeout and one `git diff` call feeds every rule (N2).
   Check: the step 2 cases pass.

Track A: the classifier (one subagent, steps in order, test first inside each step; it owns `risk-classify.py`, `tests/unit/risk-classifier.test.mjs` and `tests/fixtures/risk/`).

3. Path signals and the documentation rule. Satisfies R5, R6, AC3 (high path fixtures).
   Fixtures first, one that fires and one that stays quiet per signal: `workflows`; `iac` with a `Dockerfile` and a `*.tf` file against a `docker.md`; `hook-scripts` with `hooks.json`, a file under `hooks/`, `.husky/`, `.claude/settings.json` and a script a tracked `hooks.json` runs, against a script no `hooks.json` names; `auth` on a segment named `auth` against `author.js`; `payments`; `migrations` against a `.sql` file outside `db/`; `env-config` with `.env.local` against `.env.example`.
   R6: a README, a `docs/` file and a lockfile alone are low; a `.md` under `.github/workflows/`, `hooks/` or `.claude/` is not excused.
   For `hook-scripts`, read every tracked `hooks.json` in the head tree and take the script paths from its `command` strings, resolving `${CLAUDE_PLUGIN_ROOT}` to the plugin directory above that `hooks/` folder.
   Check: `node --test tests/unit/risk-classifier.test.mjs` passes.

4. Dependencies and test signals. Satisfies R7, R8, AC3 (medium dependency and test fixtures).
   Fixtures first: a new name in each of the six manifests is medium; a version bump of an existing name and lockfile churn alone are low.
   `test-deleted` against a deleted source file; `assertion-removed` against a test rewritten with the same number of `expect` lines; `no-test-change` past `no_test_lines` with no test file (weak, so the tie of R13 shows) against the same lines with a test change; each test file pattern of R8 and one path that is not a test.
   Write the dependency-name parsing to match the cases in `security_surface.py` and `legal_surface.py`, so the classifier works when neither is installed.
   Check: the unit tests pass.

5. Size and areas. Satisfies R9, R18, AC3 (areas fixture).
   Fixtures first: files and lines past the medium and high thresholds give `size` at that floor; a change across more areas than `areas_medium` gives `areas`; `plugins/a` and `plugins/b` count as two areas; documentation and lockfiles count toward neither.
   The thresholds are module constants at the top of the script under a comment that says they are placeholders, unmeasured, until the AC9 calibration run.
   Check: the unit tests pass.

6. Surface signals and the module lookup. Satisfies R10, R11, AC3 (legal and API route fixtures), AC7.
   Fixtures first: a new GPL dependency gives a legal medium signal; an API route file gives a security medium signal; an `auth` path gives the security `auth` category at high beside the path signal.
   The lookup tries, in R11's order, the sibling plugin directory next to this plugin's root (in a repo checkout `plugins/pro-security/scripts/`, in the plugin cache the newest version folder of the sibling plugin beside this one), the newest cached copy under the plugin cache, then `PRO_SHIP_SURFACE_DIR`.
   Reuse pr-gate's sibling-script locator when step 1 found one that is importable; otherwise write a small one in this script.
   Modules load with `importlib` from their path, never copied.
   AC7: a case copies `plugins/pro-ship/scripts/` alone into a temp folder, sets `HOME` to an empty temp folder and unsets `PRO_SHIP_SURFACE_DIR`, then checks a `surface-unavailable` note for each module and that the AC3 path fixtures still land in their tiers.
   Check: the unit tests pass, with and without the modules.

7. Architecture, tie, declared risk and demands. Satisfies R12, R13, R14, R15, AC3 (declared fixtures), AC5.
   Fixtures first: a `Dockerfile` change sets `architecture: true`; an added `os.getenv("NEW_KEY")` not in `.env.example` gives a weak medium signal and `architecture: true`; size and areas alone print `tie: [medium, high]`; an intent declaring `low` with a workflow change prints `risk-underdeclared` and tier high; `high` declared on a docs-only diff prints tier high and no finding; no intent, an empty `risk:` and `risk: banana` print `declared: none` and no finding.
   Declared risk comes from `--intent`, else the one `intent/*/intent.md` the diff adds or changes, else none; two such intents take the highest and name both.
   `demands` follows the table of R15.
   Check: the unit tests pass.

8. `REVIEW.md` overrides. Satisfies R16, R17, AC6.
   Fixtures first: a path in `paths.high` lands high; a `paths.medium` glob lands medium; changed thresholds move `size`; `tiers.low.reviewers` changes `demands`; `paths.low` on `.github/workflows/` or a `hooks/` path leaves it high; a malformed block, an unknown key and a threshold of `ten` each print `policy: unreadable (<reason>)` with the default tier; no section and no `REVIEW.md` print `policy: defaults`; a block that tries to set approval or local decision is unreadable.
   Then write the reader for the restricted YAML subset: flat keys, dotted keys and lists of strings, nothing else.
   Check: the unit tests pass.

9. Determinism and speed. Satisfies N1, N2, N3, N4, AC8.
   Cases: two runs on one fixture give byte-identical output; a run with `http_proxy` and `https_proxy` pointed at a closed port gives the same output; a 1000-line diff with both surface modules present finishes in under 2 seconds on a warm run, with a looser bound in CI; the temp repo's `git status --porcelain` is the same before and after a run.
   Sort every list in the output by a fixed key.
   Check: the unit tests pass and `grep -c -E "urllib|requests|anthropic|http\.client|socket" plugins/pro-ship/scripts/risk-classify.py` prints 0.

Track B: the merge gate (one subagent; it owns `merge-gate.py` and the gate's cases in `tests/ship-hooks.mjs`; it builds against the step 2 contract while Track A fills in the rules).

10. Gating, mode and decisions. Satisfies R19 (script), R20, R21, R23, N6, AC4 (most cases), AC11 (gate half).
    Cases first, in a throwaway repo built with the helper pr-gate's cases already use, `CLAUDE_GUARD_DIR` and `HOME` set to temp folders.
    Silent: `gh pr view 42`, `git push`, `echo gh pr merge`, a heredoc body that mentions `gh pr merge` and `git commit -m "gh pr merge"`.
    Acting: `gh pr merge 42 --squash`, `cd <path> && gh pr merge`, `git -C` style targets through a leading `cd` and `bash -c "gh pr merge"`.
    Low (a README change): allows with no output in warn and enforce.
    Medium (a new dependency) and high (a workflow change) with a matching `--match-head-commit`: enforce returns `permissionDecision: ask` with a reason holding the tier, the signals, the findings, the full HEAD sha and "this approval covers this commit only"; warn logs to `warn.log`, shows the same text as a `systemMessage` and allows.
    `mode.merge-gate` overrides `mode`; the default is warn.
    No environment variable, flag, file or stamp turns an `ask` into an allow: a case sets `RELEASE_APPROVAL=1`, writes a passing stamp and adds a `risk:low` label in the command and still sees `ask` (R23).
    A malformed or empty payload exits 0 with no output.
    Then write `plugins/pro-ship/scripts/merge-gate.py`.
    Command parsing (heredoc stripping, segment splitting, `cd` and `-C` resolution) follows `plugins/pro-security/scripts/push-gate.py`; the mode lookup and `warn.log` writer are copied from `plugins/pro-ai-sdlc/scripts/guard.py` with a comment naming the source.
    It loads `risk-classify.py` from its own directory with `importlib.util.spec_from_file_location`, because the hyphen rules out a plain import.
    Check: `node tests/ship-hooks.mjs` passes.

11. The commit pin, could-not-run and bypass. Satisfies R22, R24, R25, AC4 (remaining cases).
    Cases first: at medium and high a merge with no `--match-head-commit`, with a sha that is not `HEAD` and with a prefix shorter than 7 is denied with the exact flag to add; a 7-character prefix of `HEAD` and the full sha are accepted; low with no flag allows.
    Could not run: no merge base, a non-git target and an empty range (on `main`) ask as high in enforce and say the tier is unknown in warn; the log line says `could-not-run`.
    Bypass: `permission_mode: bypassPermissions` in enforce denies medium and high with "approval needs a prompt and this session cannot show one"; `default` asks; low still allows.
    The modes that deny live in one constant, `NO_PROMPT_MODES`, set to `{"bypassPermissions"}` until step 15 says otherwise.
    The gate keeps its own deadline of 20 seconds and returns its could-not-run answer before the hook's 30 second timeout, because a hook the harness kills lets the command through.
    Check: `node tests/ship-hooks.mjs` passes and every decision that can block has one case that blocks and one that allows.

Track C: the skill, template and ADR (one subagent; it owns the files below).

12. The skill and its routing case. Satisfies R26, R27, AC11 (skill half).
    Write `plugins/pro-ship/skills/risk-tiers/SKILL.md` with only `name` and `description` in the frontmatter and harness-neutral prose: the three tiers, each signal with its floor, declared risk only raising, the `REVIEW.md` section, how to read text and JSON output and the exit codes.
    It says a tie is the only case where a model chooses: read the evidence, pick one of the two named tiers, never above the top one and write the choice and its reason next to the tier.
    It says the hook and the exit status always use the top tier, so a settled tie changes reviewer depth only.
    It says how `/merge-pr` should use the classifier: run it, show the signals and the HEAD sha, ask the maintainer, then run `gh pr merge --match-head-commit <sha>`.
    It says an override down is the maintainer's alone and not built yet.
    Append one line to `tests/cases/routing.jsonl` whose prompt asks how risky a branch is before merging and expects `risk-tiers`, with a `notOneOf` for the nearest skill if the lexical gate shows confusion.
    Check: `node tests/check.mjs`, `node tests/eval.mjs --dry` and `node tests/route-lexical.mjs --min-rank1 70` pass.

13. Template, ADR and README. Satisfies R28, the ADR and the README row.
    Add the commented `## Risk tiers` block to `plugins/pro-ai-sdlc/templates/REVIEW.md` after "Presumptive blockers" and before "Output format", with the fenced block holding every key of R16 at its default and one line each saying the approval and local decision columns are fixed and `paths.low` cannot lower `workflows` or `hook-scripts`.
    Write `docs/decisions/0015-risk-tiers.md` from `plugins/pro-ai-sdlc/templates/adr.md`, status proposed, deciding: the tier is the highest floor among deterministic signals; declared risk only raises it; could not run is high; only the person answering a permission prompt approves and an agent's approval never counts; an approval covers one HEAD sha through `--match-head-commit`; the tier table lives in an optional `REVIEW.md` section with the approval column fixed until the scaling block exists; a tier is overridden down only by the maintainer, recorded in the stamp (later work).
    "Where it is enforced" names `risk-classify.py`, `merge-gate.py`, the `pr-check` stamp and the template.
    Add the row to `docs/decisions/README.md` and update the pro-ship bullet in `README.md`.
    Check: `node tests/check.mjs` passes and the fenced block in the template, uncommented into a fixture, parses with `policy:` not reading `unreadable` (run in step 17).

Track D: pr-check prose (one subagent; it owns the pr-check skill, its sidecars and the stamp contract page).

14. Hand-off to pr-check and the reviewer. Satisfies R29, R30, flagged concern 6.
    In `plugins/pro-ship/skills/pr-check/SKILL.md`: run `risk-classify.py --json` before the checks, pass its output to `pr-check.py stamp`, fill the reviewer handoff's `risk` field with `tier`, `signals` and the stamp path, dispatch the reviewers `demands.reviewers` names and settle a tie only as the risk-tiers skill says.
    After `gh pr create` succeeds at high tier, run `gh label create risk:high --force` with a description and colour, then `gh pr edit <number> --add-label risk:high`.
    In the PR body sidecar the Risk section shows the tier, its signals and any `risk-underdeclared` finding; the finding never fails the run (R30).
    In the stamp contract page: `tier` holds `low`, `medium`, `high` or `unclassified` (a stamp written before this change), a run that could not classify records `high` with `risk.could_not_run: true` and the `risk` field holds `tier`, `signals`, `declared`, `findings` and `tie`; `schema` stays 1 because the change only adds a field and no gate reads `tier` for validity.
    Check: `node tests/check.mjs` passes.

Serial tail.

15. Live check: does `ask` prompt when permissions are bypassed. Satisfies R24, flagged concern 3, open question 6.
    This needs an interactive Claude Code session, run by the maintainer or by a session driven through a terminal multiplexer, at any time after step 2.
    In a throwaway repo, pass a settings file with one `PreToolUse` hook on `Bash` that logs its payload's `permission_mode` and returns `permissionDecision: ask` for `echo merge-gate-probe`.
    Ask the session to run `echo merge-gate-probe` under `default`, `acceptEdits`, `auto` (when the installed version has it), `bypassPermissions` (`--dangerously-skip-permissions`) and headless `-p`.
    Record for each mode whether a prompt appeared, what happened without one and the logged `permission_mode` value, with the Claude Code version, in a comment above `NO_PROMPT_MODES` and in the Done block.
    Set `NO_PROMPT_MODES` to every mode that ran the command without a prompt and add a case per mode to `tests/ship-hooks.mjs`.
    Fallback: if no live session can be run, keep `{"bypassPermissions"}`, which denies rather than allows, then write "not verified" in the Done block; the switch to enforce mode waits for the check.
    Check: `node tests/ship-hooks.mjs` passes with the recorded set.

16. pr-check stores the tier. Satisfies R29, pr-gate R12 and R29 (now with a real tier).
    Cases first in `tests/ship-hooks.mjs`: `pr-check.py stamp` given classifier JSON writes `tier` and a `risk` field with the five keys; given a could-not-run result writes `tier: high` and `risk.could_not_run: true`; given none writes `unclassified` as before; the mutation check is skipped with reason `low tier` at low and runs at medium; the pr-gate hook still passes a valid stamp, so the new field does not change validity.
    Then change `plugins/pro-ship/scripts/pr-check.py`.
    Check: `node tests/ship-hooks.mjs` passes.

17. Join check: template and classifier agree. Satisfies R16, R28.
    A unit case copies the block out of `plugins/pro-ai-sdlc/templates/REVIEW.md`, uncomments it into a fixture `REVIEW.md` and expects a `policy:` line that reads neither `defaults` nor `unreadable`, with the default tiers on the AC3 fixtures.
    Fix whichever side is wrong; R16 wins.

18. Register the hook. Satisfies R19, AC2.
    `git add plugins/pro-ship/scripts/merge-gate.py plugins/pro-ship/scripts/risk-classify.py` first, since the hook-loading law fails on an untracked script.
    Add the entry to `plugins/pro-ship/hooks/hooks.json` under the existing `Bash` matcher beside `pr-gate.py`, timeout 30.
    Check: `grep -c merge-gate.py plugins/pro-ship/hooks/hooks.json` prints 1, `git ls-files` lists both scripts and `node tests/check.mjs hooks` passes.

19. Versions, read from main at build time. Satisfies the version-bump law (ADR-0002), Codex parity (ADR-0004).
    `git fetch origin` and read pro-ship, pro-ai-sdlc and `metadata.version` from `origin/main`; on 2026-10-30 main holds pro-ship 0.2.0, pro-ai-sdlc 0.8.0 and 1.61.0 while pr-gate and code-reviewer move them first, so expect pro-ship after pr-gate's number and `metadata.version` at 1.64.0 or later.
    Take the next minor over main for pro-ship, pro-ai-sdlc and `metadata.version`, in both manifests of each plugin and the marketplace entries, in the same commit as the content; refresh both plugins' marketplace descriptions.
    Check: `node tests/check.mjs` version and codex-manifests checks pass and `git diff origin/main -- .claude-plugin/marketplace.json` shows two entries and `metadata.version`.

20. Roadmap and checks. Satisfies AC1.
    Update `docs/roadmap.md`: risk-tiers built on #88, ADR-0015 proposed, AC9 calibration and AC12 pending.
    Run every command under "Proof of done" and fix what fails.

21. Dogfood and calibrate. Satisfies AC9, AC10, AC7 by hand.
    AC10: `python3 plugins/pro-ship/scripts/risk-classify.py --base origin/main` on this branch prints tier high with a `hook-scripts` signal; paste it in the PR body.
    AC9: list the last 30 merged PRs with `gh pr list --state merged --limit 30 --json number,title,mergeCommit` and classify each with `--base <sha>^1 --head <sha>`; print one row per PR with its tier and top signals in the PR body, not in a commit.
    Docs-only and test-only PRs should land low and PRs touching `.github/workflows/`, hook scripts or `hooks.json` high; every other result is a row for the maintainer to judge.
    The size constants stay placeholders until the maintainer fixes them from that table in a later commit; AC9 gates that, not this merge.
    AC7: run once by hand from a copy of `plugins/pro-ship/` outside the repo with `HOME` pointed at an empty folder and show the two `surface-unavailable` notes.

22. Review pass and the PR. Satisfies REVIEW.md passes 1 to 3.
    Run `/review` on the finished diff with the `reviewer` subagent at high effort, with the policy paths and nothing else.
    Fix every Important finding test first and record any departure under "Departures from plan" in the same commit.
    Push to the existing draft PR #85 and stop; AC12 starts after merge.

## Tests that prove it

- AC1: the commands in "Proof of done", run in full (step 20).
- AC2: `grep -c merge-gate.py plugins/pro-ship/hooks/hooks.json` prints 1 and `git ls-files` lists both scripts (step 18).
- AC3: `tests/unit/risk-classifier.test.mjs` runs every low, medium and high fixture the spec lists, each asserting the tier and the signal ids (steps 2 to 7).
- AC4: `tests/ship-hooks.mjs` gate cases: low allows silently; medium and high ask in enforce and allow with a message in warn; a missing or mismatched `--match-head-commit` denies and the matching flag asks; bypass denies in enforce; could not run and an empty range ask as high; a malformed payload exits 0; `gh pr view` and other commands stay silent (steps 10, 11 and 15).
  A table at the top of the gate cases pairs each blocking decision with its blocking and allowing case ids.
- AC5: the three declared-risk fixtures (step 7).
- AC6: the `REVIEW.md` override fixtures (step 8) and the template round trip (step 17).
- AC7: the copied-scripts case (step 6) and the hand run (step 21).
- AC8: the double-run and closed-proxy cases (step 9).
- AC9: the calibration table in the PR body (step 21); it gates fixing the thresholds.
- AC10: the classifier run on this branch pasted in the PR (step 21).
- AC11: the skill's tie line (step 12) and `grep -c -E "urllib|requests|anthropic|http" plugins/pro-ship/scripts/merge-gate.py` printing 0.
- AC12: after merge, `grep merge-gate ~/.claude/hooks/warn.log` after two weeks of warn mode in two of the maintainer's repos; it gates the switch to enforce, not this PR.
- R29 and R30: the stamp cases of step 16; the skill prose is checked in the step 22 review.
- N1 to N4: step 9 and a read of both scripts in step 22.

## Risks

The step most likely to go wrong is step 15.
It depends on Claude Code behavior this repo cannot pin and on a live session an agent cannot fully drive by itself.
If `ask` is silently allowed under some mode the check missed, the gate is a no-op there in enforce mode.
The fallback denies under `bypassPermissions`, the enforce switch waits for the check and AC12 runs in warn mode, so a wrong answer costs a missed prompt in a later release, not a bad merge now.
The `permission_mode` values can also change between Claude Code versions; the recorded version in the comment says when to re-check.

The next weakest is the classifier's reach on the gate side.
The gate classifies the local `HEAD`, so `gh pr merge 42` run from a branch that is not PR 42 classifies the wrong diff.
At medium and high `--match-head-commit` makes GitHub refuse the merge when the PR's head is not that commit, so the wrong diff cannot merge there.
At low nothing pins the commit, so a low local branch could wave through a different, riskier PR.
The empty-range rule closes the common case (running the merge from `main`); the remaining case is left out on purpose below.

Path signals are the third.
`auth`, `session` and `middleware` segment matches will over-fire in some repos and under-fire where auth lives under another name.
Warn mode, the printed signals and the `REVIEW.md` override are the tuning path; AC12 is the measure.

What this might break:

- Every consumer's `gh pr merge` gains a hook.
  In warn mode the cost is a message and a log line.
  In enforce mode, medium and high merges run by the user-level `/merge-pr` will be denied until it adds `--match-head-commit <sha>`, since that command is not in this repo.
- In enforce mode `production-gate.py` already asks on `gh pr merge`, so a medium or high merge raises two prompts.
  Both gates start in warn; merging them is later work.
- A hook killed by its timeout lets the command through; the gate's own 20 second deadline answers first, as could not run.
- The surface lookup depends on the plugin cache layout (flagged concern 7); a change to it prints `surface-unavailable` and the tier rests on the path rules, which is visible, not silent.
- pr-gate's stamp gains a field and its `tier` stops being `unclassified`; pr-gate's mutation check starts skipping low-tier diffs, which is what pr-gate R29 asked for.
- The version collision with code-reviewer and pr-gate on pro-ship, pro-ai-sdlc and `metadata.version`; step 19 reads main at build time.

What was left out on purpose:

- Overriding a tier down (`--accept-tier`): decided as later work.
- Pinning the commit for low-tier merges given an explicit PR number: R21 says low allows; raise it with the maintainer if AC12 shows merges from the wrong branch.
- Matching `gh api .../pulls/<n>/merge`, which `production-gate.py` catches and this gate does not: R19 names `gh pr merge` only; a follow-up can add it.
- A PostToolUse step that labels PRs opened outside `pr-check` (flagged concern 6).
- Editing `/merge-pr` and switching to enforce mode (spec Out of scope).
- Rulesets, CODEOWNERS and the scaling dials (flagged concerns 4 and 9).

Which steps can run in parallel: Tracks A (3 to 9), B (10 and 11), C (12 and 13) and D (14) touch disjoint files after step 2 and run as four concurrent Sonnet subagents; step 15 runs beside them.
Inside Tracks A and B the steps stay in order because each extends one script and one test file.
Steps 16 to 22 are serial because each reads the combined result.

Nothing here is irreversible.
There is no migration and the stamp field is additive.
Reverting removes the hook on the consumers' next update, though the plugin cache keeps the old version until then.

Suits auto mode: yes for steps 1 to 14 and 16 to 20 once the plan is approved, since each has a command that passes or fails.
Steps 15, 21 and 22 need the maintainer: a live prompt check, a calibration table to judge and a hook shipped to every consumer.

## Options not taken

- Building before pr-gate lands: risk-tiers edits pr-gate's `hooks.json`, `pr-check.py` and test file, so a parallel build would conflict on every one of them.
- Reading the tier from the stamp or a PR label in the gate: either can be written by an agent; the gate runs the classifier itself (R20).
- A tier override by environment variable or flag: an agent can set either (R23).
- Calling the classifier as a subprocess from the gate: an import keeps one process and one deadline; the hyphenated filename is handled with `importlib`.
- Treating an empty range as low, as R4 reads literally: it would let every merge run from `main` through as low.
- Committing the fixtures as real directory trees: their paths would set `auth`, `migrations` and `workflows` signals on this PR's own diff and some fixture content would trip pro-security's push gate.
- Fixing the size thresholds now: there is no measurement behind any number yet (decided, AC9).
- Copying `security_surface.py` and `legal_surface.py` into pro-ship: about 970 lines that would drift (R11).
- Letting review-policy own the template section: it shipped in #82 without it.
- Bumping the stamp `schema` to 2: the change only adds a field and no reader checks `tier` for validity.

## Proof of done

Run from the repo root on the final branch.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
node tests/ship-hooks.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
grep -c merge-gate.py plugins/pro-ship/hooks/hooks.json
git ls-files plugins/pro-ship/scripts/risk-classify.py plugins/pro-ship/scripts/merge-gate.py
grep -c -E "urllib|requests|anthropic|http" plugins/pro-ship/scripts/merge-gate.py
python3 plugins/pro-ship/scripts/risk-classify.py --base origin/main
```

What counts as finished:

- `node tests/check.mjs` prints 0 failures; `node tests/eval.mjs --dry` lists the new skill in the catalog and every case points at a real skill.
- The routing gate passes at 70 or above and `node --test` reports no failure, the risk-classifier file included.
- `node tests/ship-hooks.mjs` prints all cases passed with no `FAIL` line.
- `claude plugin validate . --strict` prints `Validation passed` once and the loop once per plugin directory.
- The first `grep -c` prints 1, `git ls-files` lists both scripts and the second `grep -c` prints 0.
- The last command exits 4 and prints `risk: high` with a `hook-scripts` signal.
- The step 15 result is in the Done block, verified or "not verified" with the fallback set.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: the head of #88.
- Checks run: `node tests/check.mjs` 33 checks, 0 failures, 12 warnings (the new one is the router not naming `risk-tiers` yet, with `pr-check`, left for a pro-core change); unit tests 124 classifier cases; `tests/ship-hooks.mjs` 182/182; `tests/ship-check.mjs` 124/124; eval dry; route-lexical rank-1 80.5%; strict validate on the marketplace and all 20 plugins.
- Step 15 (`ask` under each `permission_mode`): not verified live. The hooks docs do not say whether a hook `ask` prompts under `bypassPermissions`, so the gate denies medium and high under `bypassPermissions`, `dontAsk` and `auto` and asks under `default`, `plan`, `acceptEdits` or no mode.
- AC10: pass, this branch classifies high with a `hook-scripts` signal.
- AC9: calibration over the last 30 merged PRs (#59 to #89) after the fixes: 11 low, 9 medium, 10 high; every hook and workflow PR is high and no docs-only or test-only PR is above low. The size thresholds stay placeholders until the maintainer sets them from that table.
- AC7: pass, a copy of pro-ship run alone printed both `surface-unavailable` notes.
- AC1 to AC8, AC11: pass, by the cases above; AC12 pending after merge.
- Sign-off: the maintainer, 2026-10-30.

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0015, Status `proposed` from this change, to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- The ADR is ADR-0015: #86 took 0013 (plugin layering) and pr-gate took 0014 (the gate stamp).
- The default base is the merge base with the target branch (`origin/HEAD`, `origin/main`, `origin/master`, `main`, `master`), never the branch's own upstream as R2 first said: on a pushed branch the upstream is the branch's own remote copy, which read every pushed branch as could-not-run and let a pushed workflow change read low behind an unpushed docs commit.
- The step 22 review found more, each fixed with a failing case first: `&`, `|&`, `eval` and `xargs` hid `gh pr merge` (and `gh pr create` from pr-gate); a deleted or renamed hook script read low; the gate's deadline was swallowed into a quiet allow; the first `--match-head-commit` was used where gh uses the last; a stale `risk.json` could be stamped onto a new commit.
- The calibration run found over-firing, fixed: a `risk:` field in a docs-only diff no longer raises the tier; path, surface and env-var signals skip tests, fixtures and Markdown; size counts only code; a `hooks` folder counts only with a `hooks.json`, `.claude/hooks`, `.githooks`, husky or lefthook.
- Known limit, a follow-up before enforce mode: the merge gate classifies the checked-out branch, not the PR number it is given, so `/merge-pr` run from `main` reads could-not-run and is treated as high (a message in warn mode). The gate should resolve the PR's head with `gh pr view` first.
