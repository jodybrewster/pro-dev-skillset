# Plan: required documents per project

Built from `spec.md` (written in the same commit as this plan) and `intent.md` in this folder.
Status: approved.
Approver: Jody Brewster (approved the batch, 2026-10-30).
Dated: 2026-10-30.

Jody is named as approver because the spec sets a rule every gate and reviewer will read (ADR-0020) and the intent is risk medium.
Two acceptance criteria (AC6 and AC8) need a person to read a real run, so it does not suit auto mode.

This builds after the codex-second-reviewer PR merges.
That PR edits the pr-check skill, `pr-body.md`, `code-reviewer.md`, `code-reviewer.toml` and pro-core's `engines.json` and bumps the same plugins.
Step 0 rebases onto it before anything else.
Every version number below is today's reading (pro-core 0.20.0, pro-ai-sdlc 0.9.0, pro-quality 0.15.0, pro-ship 0.4.0, `metadata.version` 1.64.0); step 12 takes the real numbers from `main` at build time.

## Files that change

New:

- `plugins/pro-quality/scripts/required-docs.py` (new): the one deterministic required-set check (R1 to R11).
- `tests/required-docs.mjs` (new): the case runner for the script, exported as `runRequiredDocsCases()` (R33).
- `plugins/pro-ai-sdlc/templates/README.md` (new): the README template (R12, R13).
- `plugins/pro-ai-sdlc/templates/ARCHITECTURE.md` (new): the ARCHITECTURE template with the empty Twelve-factor heading (R12, R14).
- `plugins/pro-ai-sdlc/templates/PRODUCT.md` (new): the PRODUCT template in impeccable's product-schema 1 shape (R12, R15).
- `ARCHITECTURE.md` and `PRODUCT.md` at the repo root (new): this repo's own documents, drafted the new way (R38).

Modified:

- `tests/check.mjs`: import the runner and add the `required-docs` check with its contract lines (R33).
- `tests/unit/risk-classifier.test.mjs`: one case with both blocks in `REVIEW.md` (R34).
- `plugins/pro-ai-sdlc/templates/REVIEW.md`: the commented Required documents block and the "Learning from repeats" line (R16).
- `plugins/pro-quality/agents/documentation-engineer.md` and `plugins/pro-quality/.codex-plugin/agents/documentation-engineer.toml`: the drafting section (R27).
- `plugins/pro-quality/agents/code-reviewer.md` and `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml`: one compliance-lens sentence (R28).
- `plugins/pro-core/commands/pro-dev.md`: the Required documents subsection of section 4, the report lines and two `allowed-tools` entries (R17 to R26).
- `plugins/pro-ship/skills/pr-check/SKILL.md`: Setup step 3, the report example and the No script section (R29, R31, R32).
- `plugins/pro-ship/skills/pr-check/pr-body.md`: the Missing documents line (R31).
- `REVIEW.md` at the repo root: the uncommented Required documents block with `add: [PRODUCT.md]` (R38).
- `docs/licenses.md`: the impeccable row (R37).
- `README.md` at the repo root: the Document row names `required-docs.py` and the drafting in `/pro-dev install`.
- The manifests of pro-core, pro-ai-sdlc, pro-quality and pro-ship (`.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`) and `.claude-plugin/marketplace.json` (R35).

Already in this commit: `docs/decisions/0020-required-documents.md` and its row in `docs/decisions/README.md` (R36).

Not changed, on purpose: `plugins/pro-ship/scripts/pr-check.py`, `docs/pr-check-stamp.md`, `tests/fixtures/pr-check-stamp/`, `plugins/pro-quality/skills/requesting-code-review/handoff.md`, `plugins/pro-ship/scripts/risk-classify.py`, `plugins/pro-quality/scripts/docs-before-push.py`, every `hooks.json` and `plugins/pro-core/registry/engines.json`.

## Order of work

Run every command from the repo root.
Follow the writing rules in `CLAUDE.md` for every line of prose: one sentence per line in Markdown, no em dash, no Oxford comma, never ", and", straight quotes and no home-directory path.

0. Rebase. (XS)
   - `git fetch origin && git rebase origin/main` once the codex-second-reviewer PR has merged.
   - Read the current versions of pro-core, pro-ai-sdlc, pro-quality and pro-ship and `metadata.version` from `.claude-plugin/marketplace.json` and note them for step 12.
   - Read the rebased `plugins/pro-ship/skills/pr-check/SKILL.md`, `pr-body.md` and `plugins/pro-quality/agents/code-reviewer.md` before editing them in later steps, since that PR changed them.

1. Write the failing tests first. (S; R33)
   - Create `tests/required-docs.mjs` in the shape of `tests/ship-check.mjs`: a sandbox under `tmpdir()`, `GIT_CONFIG_GLOBAL=/dev/null`, a `mkrepo(files)` helper that commits the files, one `spawnSync("python3", [SCRIPT, ...args], { cwd: repo })` per case and an `add(id, expect, ok, reason)` collector.
     Export `runRequiredDocsCases()` returning `{ skipped, results }`; skip with a reason when `python3` or `git` is missing.
     Let it run standalone with `node tests/required-docs.mjs`, printing each failing case.
   - Cases, each asserting the exit code and the JSON:
     1. `bare`: only `README.md` tracked; exit 3, `source` `defaults`, `missing` is CLAUDE.md, AGENTS.md, REVIEW.md and `docs/decisions/` with rule `always`.
     2. `complete`: the five always rows tracked (with `docs/decisions/README.md`); exit 0, `missing` empty.
     3. `adr-folder`: `docs/adr/0001-x.md` tracked in place of `docs/decisions/`; the folder row is present.
     4. `untracked`: `CLAUDE.md` exists on disk but is not committed; it is missing.
     5. `ui-react`: root `package.json` with `react` in `dependencies`; DESIGN.md and PRODUCT.md missing with rules starting `has a UI:` and `has users:`.
     6. `ui-workspace`: root `package.json` with `"workspaces": ["apps/*"]` and `apps/web/package.json` with `next` in `devDependencies`; UI holds.
     7. `ui-stray-app`: root `package.json` with no UI dependency and `demo/app/package.json` with `next`; UI does not hold.
     8. `ui-design-md`: `DESIGN.md` tracked with no framework; PRODUCT.md is required.
     9. `arch-pnpm`: `pnpm-workspace.yaml` tracked; ARCHITECTURE.md missing with a rule starting `more than one module, service or deployable:` that names the file.
     10. `arch-manifests`: `package.json` at the root and `server/go.mod`; architecture holds.
     11. `arch-fixtures-ignored`: root `package.json` plus `tests/fixtures/x/package.json` and `examples/y/package.json`; architecture does not hold.
     12. `arch-dockerfiles`: `Dockerfile` and `worker/Dockerfile.worker`; architecture holds.
     13. `block-add`: complete repo plus a `REVIEW.md` block `add: [SECURITY.md]`; exit 3, `source` `REVIEW.md`, SECURITY.md missing with rule `REVIEW.md add`.
     14. `block-remove`: `ui-react` repo with a block `remove: [PRODUCT.md]`; PRODUCT.md is not required, DESIGN.md still is.
     15. `block-remove-always`: a block `remove: [README.md]`; `source` starts `unreadable (`, the default applies and `findings` holds a string starting `required-docs-block-unreadable`.
     16. `block-unknown-key`: a block with `severity: blocking`; unreadable as in case 15.
     17. `block-commented`: the block inside an HTML comment; `source` `defaults`.
     18. `block-template`: the shipped `plugins/pro-ai-sdlc/templates/REVIEW.md` as `REVIEW.md`; `source` `defaults`.
         With the `<!-- Required documents:` comment markers removed, `source` `REVIEW.md`.
         This case fails until step 6 adds the block, which is expected.
     19. `policy-ref`: base commit has no block, HEAD adds `remove: [PRODUCT.md]` to a UI repo; `--policy-ref <base sha>` still requires PRODUCT.md, while no flag does not.
     20. `agents-symlink`, `agents-pointer`, `agents-copy-same`, `agents-copy-differs`: only the last gives the finding `agent-files-differ`.
         The pointer is a three-line AGENTS.md that names CLAUDE.md.
     21. `not-a-repo`: a plain folder; exit 2 and `could_not_run` true.
     22. `human`: case 1 without `--json` prints one `missing  <doc>  (<rule>)` line per missing document.
   - In `tests/check.mjs`, import `runRequiredDocsCases` beside the other runners and add `checks["required-docs"]` in the shape of `checks["ship-check"]`.
     The same check also fails when:
     - `plugins/pro-ai-sdlc/templates/README.md`, `ARCHITECTURE.md` or `PRODUCT.md` is missing;
     - the PRODUCT template lacks the line `<!-- impeccable:product-schema 1 -->` or any of the ten R15 headings or has them out of order;
     - the ARCHITECTURE template lacks the line `## Twelve-factor`;
     - `plugins/pro-core/commands/pro-dev.md` does not contain `required-docs.py`, `templates/README.md`, `templates/ARCHITECTURE.md` and `templates/PRODUCT.md`;
     - `plugins/pro-ship/skills/pr-check/SKILL.md` does not contain `required-docs.py` and `Should-fix`.
   - Run `node tests/check.mjs required-docs` and see it fail on the missing script and templates.
     Do not commit yet; the plugin content and its bumps land together at checkpoint D (step 12).

2. Write the script's detection and presence. (S; R1 to R6, R10, R11, N1)
   - Create `plugins/pro-quality/scripts/required-docs.py`, executable, with a module docstring that states its flags, its output and its exit codes.
     Standard library only, no network, every `git` call through one helper with `timeout=10` that never raises.
   - Flags: `--repo <path>` (default the cwd), `--json`, `--policy-ref <ref>`.
   - Find the root with `git rev-parse --show-toplevel`; on failure print `{"could_not_run": true, "reason": ...}` and exit 2.
   - Read tracked paths once with `git ls-files -z`.
   - Implement the three signals exactly as R4, R5 and R6 say, each returning `(holds, evidence)`.
     For the workspace globs in R4, read `workspaces` as an array or as `{ "packages": [...] }` and read the `packages:` list items of `pnpm-workspace.yaml` line by line; match directory paths with `fnmatch`.
   - Build the eight default rows of R2 with the rule texts of R11 and mark each present per R3.
   - Print the JSON of R10 or the human lines and exit 0 or 3.
   - Run `node tests/required-docs.mjs` and expect cases 1 to 12, 21 and 22 to pass.

3. Add the block, the policy ref and the agent-file finding. (S; R7 to R9)
   - Copy the shape of `unquote`, `parse_block` and `read_policy` from `plugins/pro-ship/scripts/risk-classify.py` with a comment saying it is a second copy because plugins cannot import each other (ADR-0003).
     Keep only list values: `add` and `remove`.
     Look for `^##[ \t]+Required documents[ \t]*$` after stripping HTML comments.
   - Apply the rules of R8: `add` rows get rule `REVIEW.md add` and always apply; `remove` drops a conditional row; anything else makes the block unreadable, keeps the default and adds the finding.
   - `--policy-ref <ref>`: read `REVIEW.md` with `git show <ref>:REVIEW.md`; a missing file there means `defaults`.
   - The `agent-files-differ` check of R7, using `os.path.islink` and a byte compare.
   - Run `node tests/required-docs.mjs` and expect every case except 18 to pass.

Checkpoint A: `node tests/required-docs.mjs` shows only case 18 failing.
`python3 plugins/pro-quality/scripts/required-docs.py --json` in this repo exits 3 with ARCHITECTURE.md missing (the architecture signal holds through the root `package.json`, `demo/app/package.json` and `plugins/pro-spdd/bin/package.json`) and no UI signal.
`time python3 plugins/pro-quality/scripts/required-docs.py` stays under two seconds (N1).

4. Guard the classifier. (XS; R34)
   - In `tests/unit/risk-classifier.test.mjs`, after the two template tests near the end, add a test that writes a base `REVIEW.md` holding an uncommented `## Risk tiers` block with `paths.high: [ops/deploy/**]` followed by an uncommented `## Required documents` block with `add: [SECURITY.md]`, reuses `templateRepo` and asserts `policy` is `REVIEW.md` and `policy-high` fires.
   - Run `node --test tests/unit/risk-classifier.test.mjs`; it should pass with no code change, which is the point of the guard.

5. Write the three templates. (S; R12 to R15, N2)
   - `plugins/pro-ai-sdlc/templates/README.md`: `# <project name>`, then `## What it is`, `## Install`, `## Run`, `## Test` and `## Documents`, each with one angle-bracket placeholder line; Documents lists CLAUDE.md, REVIEW.md, ARCHITECTURE.md, PRODUCT.md, DESIGN.md and `docs/decisions/` with "link only those that exist".
   - `plugins/pro-ai-sdlc/templates/ARCHITECTURE.md`: `# Architecture`, then `## Overview`, `## Parts` (a table with columns Part, Path, Job and Talks to), `## How requests and data flow`, `## Boundaries`, `## Deployables` and `## Twelve-factor` with only the comment `<!-- Filled by the architecture review (ranked item 17): how this app meets each factor and which the platform owns. -->`.
   - `plugins/pro-ai-sdlc/templates/PRODUCT.md`: the headings and comment of R15 in order, each with one placeholder line; `## Platform` holds `<web, ios, android or adaptive>`.
   - End each template with an HTML comment: fill every section from the code and name the file that shows each fact, keep an angle-bracket placeholder only where the code cannot say and omit an optional section rather than write generic prose.
     The PRODUCT comment adds that the section names and the schema comment follow impeccable's PRODUCT.md record (Apache-2.0, https://github.com/pbakaus/impeccable) so impeccable reads the file as its own.
   - Keep each under 60 lines (`wc -l`).

6. Update the REVIEW.md template. (XS; R16)
   - After the Risk tiers comment block in `plugins/pro-ai-sdlc/templates/REVIEW.md`, add a separate comment block that opens with `<!-- Required documents:` and holds `## Required documents`, two lines on `add` (paths that must exist beyond the default set; a trailing `/` means a folder) and `remove` (only ARCHITECTURE.md, PRODUCT.md or DESIGN.md) and a fenced `yaml` block with `add: []` and `remove: []`.
     Place it after the Risk tiers block so `uncommentRisk` in `tests/unit/risk-classifier.test.mjs`, which matches the first `\n-->\n`, keeps working.
   - Change the last line of "Learning from repeats" to "If the change makes a line of the agent file or `ARCHITECTURE.md` untrue, flag that too."
   - Run `node tests/required-docs.mjs` (case 18 now passes) and `node --test tests/unit/risk-classifier.test.mjs`.

Checkpoint B: `node tests/check.mjs required-docs` fails only on the `pro-dev.md` and pr-check contract lines; `node tests/check.mjs sdlc-contract` passes.

7. Teach `documentation-engineer` to draft. (XS; R27)
   - In `plugins/pro-quality/agents/documentation-engineer.md`, add `## Drafting a document from a template` before "## Hard rules", with the rules of R27 as five or six short lines.
   - Put the same section, word for word, into `developer_instructions` of `plugins/pro-quality/.codex-plugin/agents/documentation-engineer.toml` at the same place.
   - Diff the two bodies to show only the wrapper differs around the new section.

8. Add the reviewer's untrue-line rule. (XS; R28)
   - In the compliance lens of `plugins/pro-quality/agents/code-reviewer.md` (item 5 of "Five lenses"), add one indented line: "Read `ARCHITECTURE.md` at the repo root when it exists. Flag a line in it or in the agent file that the diff makes untrue, with the file and line."
     Split it into two lines, one sentence each.
   - Make the same change in `plugins/pro-quality/.codex-plugin/agents/code-reviewer.toml`.
   - Do not edit `handoff.md`.
   - Run `node tests/check.mjs agents handoff codex-parity`.

9. Add the Required documents step to `/pro-dev install`. (S; R17 to R26)
   - In `plugins/pro-core/commands/pro-dev.md`, add `### Required documents` after `### Create the folders and the review policy` and before `### Report` in section 4.
     Write it as numbered steps in the style of `plugins/pro-quality/commands/constraints.md`:
     1. Find pro-quality in the status JSON `plugins` list (`name` `pro-quality`, `covers` true).
        If found, run `python3 "<its installPath>/scripts/required-docs.py" --json` and say that the call prompts because it is not pre-approved.
        If not, apply the rows and signals from the table in this step yourself and say the deterministic check is not installed.
        Put the rule table (R2, R4 to R6) in the step so the fallback has it.
     2. Ask the questions of R18, at most four, one at a time, each with its default; skip those the code answers; in a non-interactive run take the defaults and say so.
     3. Leave every present document alone and list it; report `agent-files-differ` with both paths.
     4. For each missing README.md, ARCHITECTURE.md and PRODUCT.md, read `<aiSdlcInstallPath>/templates/README.md`, `templates/ARCHITECTURE.md` or `templates/PRODUCT.md`.
        Dispatch `pro-quality:documentation-engineer` once per document with the template path, the target path and the inspection facts when the host offers it; otherwise write the bare template and list the sections left to fill.
        A missing template is the named gap of R20.
     5. AGENTS.md or CLAUDE.md as R21 says.
     6. `docs/decisions/README.md` as R22 says.
     7. DESIGN.md as R23 says.
     8. The `REVIEW.md` block as R24 says.
   - Extend `### Report` with the per-document lines of R25.
   - Add `"Bash(ln -s CLAUDE.md AGENTS.md)"` and `"Bash(ln -s AGENTS.md CLAUDE.md)"` to `allowed-tools`.
   - Keep the section free of home-directory paths.
   - Run `node tests/check.mjs required-docs pro-dev`.

Checkpoint C: `node tests/check.mjs` passes except the pr-check contract line of `required-docs`; `node tests/pro-dev.mjs` passes.

10. Add the documents stage to pr-check. (S; R29 to R32)
    - In `plugins/pro-ship/skills/pr-check/SKILL.md`, replace Setup step 3 ("Look for `REVIEW.md` ...") with the required-documents step of R29, written so `not-installed` and exit 2 are named and never read as none missing.
      Say that a missing document is Should-fix, never changes `result` and never stops the run.
    - Add a `documents` line to the report example under "Stamp and report", after `floor`: `  documents   missing 1  Should-fix: ARCHITECTURE.md`.
    - Add the R32 line to "No script".
    - In `plugins/pro-ship/skills/pr-check/pr-body.md`, add the Missing documents bullet of R31 to the Risk section after "Open findings".
    - Touch nothing in the Handoff, Dispatch or Tally lines sections.
    - Run `node tests/check.mjs required-docs ship-check stamp-contract`.

11. Credits and the README row. (XS; R37)
    - Add a pro-ai-sdlc row to `docs/licenses.md` after the existing pro-ai-sdlc rows: component `templates/PRODUCT.md`, source impeccable (https://github.com/pbakaus/impeccable), license Apache-2.0, copyright as the upstream `LICENSE` or `NOTICE` states it (read it, do not guess), status "adapted (section names and the schema comment only)".
    - In `README.md`, extend the Document row of the phase table to name `required-docs.py` and that `/pro-dev install` drafts missing required documents.

12. Bump versions. (XS; R35)
    - pro-core, pro-ai-sdlc, pro-quality and pro-ship each take the next minor over the numbers read in step 0, in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and the plugin's entry in `.claude-plugin/marketplace.json`.
    - `metadata.version` takes one minor bump.
    - Commit the bumps together with the plugin content they cover, so no commit on the branch carries plugin content without its bump.

Checkpoint D: the full proof of done below passes.

13. Dogfood on this repo. (S; R38, AC3, AC13)
    - Dispatch `pro-quality:documentation-engineer` (Sonnet) twice, once per document, with the template path under `plugins/pro-ai-sdlc/templates/`, the target path (`ARCHITECTURE.md` or `PRODUCT.md` at the root) and these facts: `CLAUDE.md`, `docs/overview.md`, `README.md`, `.claude-plugin/marketplace.json`, `docs/decisions/0013-plugin-layering.md` and the `plugins/` tree.
      ARCHITECTURE.md describes the plugins as parts, the marketplace and the two manifests per plugin, the hooks and the tests; it links `docs/overview.md` and `docs/decisions/` instead of repeating them.
      PRODUCT.md says who installs the marketplace and why, with Platform as the bare value it best fits and every section the code cannot inform left out.
    - Add to the root `REVIEW.md` a `## Required documents` section with an uncommented `yaml` block holding `add: [PRODUCT.md]` and one line saying why (an install base, no UI).
    - Run `python3 plugins/pro-quality/scripts/required-docs.py --json` and expect exit 0, `source` `REVIEW.md` and `missing` empty.
    - Check each path named in the two documents exists (`ls` each one).

14. Manual runs, pasted into the PR. (S; AC3, AC6, AC8)
    - AC3: in a throwaway clone, `git rm --cached ARCHITECTURE.md`, commit, run the script and see exit 3 naming ARCHITECTURE.md.
    - AC6: in a throwaway repo with the five always rows minus `docs/decisions/`, run the pr-check skill with pro-quality reachable and see `documents   missing 1` and the same `result` as after adding the folder.
    - AC8: copy a small app (for example `demo/app/` into a fresh git repo with only a README), run `/pro-dev install` and paste its report and `git status --short`.

## Tests that prove it

- `tests/required-docs.mjs` through `node tests/check.mjs required-docs` covers R1 to R11, R16 and the contract lines of R33 (AC2, AC4, AC5).
- `node --test tests/unit/risk-classifier.test.mjs` covers R34.
- `node tests/check.mjs agents codex-parity handoff` covers the twins of R27 and R28 (AC9).
- `git diff origin/main -- plugins/pro-quality/skills/requesting-code-review/handoff.md` prints nothing (AC9).
- `git diff origin/main --stat -- plugins/pro-ship/scripts/pr-check.py docs/pr-check-stamp.md tests/fixtures/pr-check-stamp plugins/pro-core/registry/engines.json` prints nothing (AC10).
- `grep -n "not-installed\|did not run\|Should-fix" plugins/pro-ship/skills/pr-check/SKILL.md` shows the R29 wording (AC7).
- The version-bump check in `node tests/check.mjs` covers AC11.
- `ls docs/decisions/0020-required-documents.md` and `grep -n impeccable docs/licenses.md` cover AC12.
- Step 13 covers AC3 and AC13; step 14 covers AC6 and AC8.

## Risks

What might this break?
The pr-check skill and the code reviewer change in the same places the codex-second-reviewer PR changed; a careless rebase could drop that PR's lines.
Step 0 reads the rebased files first and step 10 touches only Setup step 3, the report example, No script and one pr-body bullet.
A new commented block in the REVIEW.md template could break the classifier test's `uncommentRisk` regex if placed before the Risk tiers block; step 6 places it after.
`/pro-dev install` gains a step that writes files in a person's repo; R19 forbids overwriting and AC8 checks `git diff` on a real run.

Which step is the most likely to go wrong?
Step 2, the detection heuristics.
A monorepo layout the signals do not know gives a wrong row.
The damage is one Should-fix line in pr-check and one question in install that the person can answer differently; the `REVIEW.md` block corrects it for good.
Within step 2 the weak spot is the workspace glob parsing for the UI signal, which cases 6 and 7 pin.

What was left out on purpose, with the reason?
A stamp field, because nothing reads it for a verdict (R30).
A handoff change, because the reviewer reads `ARCHITECTURE.md` from the repo and the Handoff section belongs to the codex-second-reviewer change.
A DESIGN.md template and DESIGN.md drafting, because impeccable owns that format (flagged concern 4).
A severity key, because blocking is out of scope until ranked item 21.
Any change to `docs-before-push.py`, whose KEY_DOCS already covers the set.
The architecture review itself (ranked item 17).

Which steps touch separate files and could run in parallel worktrees?
After step 3: steps 4, 5, 7, 8 and 11 touch separate files and can run as parallel subagents.
Step 6 follows step 5 only for the checkpoint; it touches its own file.
Steps 9 and 10 can run in parallel after step 5, since each only names the templates and the script.
Step 12 comes after all content steps because it edits the shared marketplace file.
Step 13 needs steps 5, 7 and 12; step 14 is last.

Nothing here is irreversible: no migration, no data and no deploy.
A wrong rule reaches every pr-check report and every install until the next plugin update.
It never blocks.

## Options not taken

- An explicit `required` list in the block: detection would stop once it is written.
- The detection inside `pr-check.py`: pr-check should only consume it (ADR-0013) and install could not reuse it.
- Adding `qualityInstallPath` to pro-core's status JSON: the existing `plugins` list already carries each install path, so pro-core's script does not change.
- A separate test file for the template contract: `tests/check.mjs` already holds the contract checks and CI runs it.
- Installing the templates into each repo's `docs/`: they would go stale beside the plugin's copy.

## Proof of done

Run in this order from the repo root; every command must pass.

```bash
node tests/check.mjs && node tests/eval.mjs --dry
node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs
claude plugin validate . --strict
( for p in plugins/*/; do claude plugin validate "${p%/}" --strict || exit 1; done )
node tests/required-docs.mjs
python3 plugins/pro-quality/scripts/required-docs.py --json
git diff origin/main --stat -- plugins/pro-ship/scripts/pr-check.py docs/pr-check-stamp.md tests/fixtures/pr-check-stamp plugins/pro-core/registry/engines.json plugins/pro-quality/skills/requesting-code-review/handoff.md
```

Expected: `node tests/check.mjs` ends with 0 failures, one more check than before (`required-docs`) and no more warnings than before the change; the dry eval, the lexical gate and the unit tests pass; `✔ Validation passed` prints once for the marketplace and once per plugin directory; `node tests/required-docs.mjs` reports every case passing; the script exits 0 with `source` `REVIEW.md` and an empty `missing`; the last command prints nothing.
Then the manual runs of step 14.

## Done

Filled in when the build is finished, before sign-off.

- Build commit: 3c03a17 (content and bumps) and the dogfood commit after it; the commit holding this section follows.
- Checks run:
  - `node tests/check.mjs`: 36 checks, 0 failures, 12 warnings (35 checks and 12 warnings before the change, so one new check and no new warnings).
    One earlier full run under a machine load average above 300 printed 1 failure that the output tail did not name; a rerun with the load down passed with 0 failures.
  - `node tests/eval.mjs --dry`: 88 cases reference real skills, 98 skills in the catalog and 7 distractors.
  - `node tests/route-lexical.mjs --min-rank1 70`: exit 0.
  - `node --test tests/unit/*.test.mjs`: 166 pass, 0 fail.
  - `claude plugin validate . --strict`: passed; the per-plugin strict loop passed for all 20 plugin directories.
  - `node tests/required-docs.mjs`: 25 of 25 cases pass.
  - `python3 plugins/pro-quality/scripts/required-docs.py --json`: exit 0, `source` `REVIEW.md`, `missing` empty.
  - The AC10 `git diff origin/main --stat` on the unchanged files prints nothing.
  - The `verifier` agent was not dispatched in this run.
- AC1: pass (the commands above).
- AC2: pass; the case runner failed before the script existed (4 of 25 cases passed vacuously) and now passes 25 of 25.
- AC3: pass; in this repo the script exits 0 with `source` `REVIEW.md` and empty `missing`.
  In a throwaway clone with `ARCHITECTURE.md` removed from the index it exited 3 naming ARCHITECTURE.md with a rule starting "more than one module".
- AC4: pass; case `block-template` covers it (defaults as shipped, `REVIEW.md` once uncommented).
- AC5: pass; the three templates exist and the `required-docs` check pins the schema comment, the ten headings in order and `## Twelve-factor`.
- AC6: not run, needs Jody (a hand run of the pr-check skill, which needs a model).
- AC7: pass by grep; the skill says `not-installed` and "did not run" and prints `documents   pass` only after running the script.
- AC8: not run, needs Jody (a hand run of `/pro-dev install` on a copy of a small app, which needs a model).
- AC9: pass; both reviewer files name `ARCHITECTURE.md` in the compliance lens and `handoff.md` is unchanged.
- AC10: pass; the diff is empty.
- AC11: pass; the version-bump check passes with 0.22.0, 0.11.0, 0.16.0 and 0.6.0 in both manifests and the marketplace, and `metadata.version` 1.68.0.
- AC12: pass; ADR-0020 is proposed with its index row and `docs/licenses.md` has the impeccable row.
- AC13: pass; ARCHITECTURE.md and PRODUCT.md exist at the root, each path they name was checked with `ls` (the relative names left over were plugin-relative or slash commands), and REVIEW.md holds `add: [PRODUCT.md]`.
  PRODUCT.md leaves out Positioning, Brand Commitments and Accessibility & Inclusion because the code cannot inform them.
- Definition of done: met except the verifier run and AC6 and AC8, which wait for Jody.
- Sign-off: <the person's words and the date>

The sign-off moves `status` in the intent and the spec to `accepted`.
It also moves ADR-0020 from `proposed` to `accepted`.

## Departures from plan

Added in the same commit as the change that departs.
An empty section tells the reviewer the diff follows the plan.

- Step 0: the rebase was already done onto origin/main at 6c520df, which holds the codex-second-reviewer change (#99) and the sdlc-loop-upgrades change (#98).
  Versions read there: pro-core 0.21.0, pro-ai-sdlc 0.10.0, pro-quality 0.15.1, pro-ship 0.5.0 and `metadata.version` 1.67.0 (the plan's numbers were older).
  Step 12 took the next minor over those: 0.22.0, 0.11.0, 0.16.0, 0.6.0 and 1.68.0.
  A second `git fetch` before the bump showed origin/main had not moved.
- Steps 1 to 12 landed in one content commit instead of one per step, because the plan itself says the content and its bumps land together and no commit may carry plugin content without its bump.
- `tests/check.mjs` takes one check name per call, so the plan's "node tests/check.mjs required-docs ship-check stamp-contract" ran as one call per name.
- Step 10: after #99, the pr-check "No script" list already held a Codex item 5, so the required-documents line is its own item 6 and the stamp line became item 7.
  The old Setup step 3 pointed a missing `REVIEW.md` to `/sdlc-init`; the new step points to `/pro-dev install`, as R29 says.
- Step 11: the licenses row copies its copyright line (Copyright 2025 Paul Bakaus) from the existing impeccable-bridge row, since no upstream `LICENSE` is cached locally and the repo already records it.
- Step 13 (dogfood) and step 14 (manual runs) are recorded under Done.
- Jody's decisions of 2026-10-30, all already in the spec: `/pro-dev install` does not draft DESIGN.md and names `/impeccable document`; pr-check lists DESIGN.md as missing until it exists; the templates stay in pro-ai-sdlc; the impeccable credit is a licenses row.
- Step 13: `pro-quality:documentation-engineer` is not a dispatchable agent type in this run, so two Sonnet general-purpose subagents acted in that role with the template, the target and the fact list.
  The PRODUCT.md draft lowered the case of five section names; they were set back to the template's impeccable names.
- Step 14: AC3 ran as described; AC6 and AC8 are recorded as not run under Done.
- Review round 1 fixes: `required-docs.py` gained `--worktree` (a document counts when the file exists on disk, never through a symlink out of the repo) and `/pro-dev install` uses it; the drafting agent and its Codex twin never overwrite an existing target; a bad or dash-led `--policy-ref` is could-not-run instead of defaults; `removeprefix` replaces `lstrip` for workspace globs; the `plugins/pro-ai-sdlc/LICENSE` carries the impeccable attribution; ARCHITECTURE.md and PRODUCT.md were cut to checkable claims; pr-check lists any other exit as could-not-run; ADR-0020, the README row and the CLAUDE.md sample were corrected.
  No version bumps in this round: the orchestrator re-takes versions at rebase.
