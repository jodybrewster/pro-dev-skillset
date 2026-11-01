---
intent: intent/2026-10-30-required-documents/intent.md
intent-status: draft
status: draft
created: 2026-10-30T11:47:09-0400
author: the maintainer
---

# Spec: required documents per project

Built from `intent.md` in this folder (commit 89040b5).
Status: draft.
Policies and skills consulted: `CLAUDE.md` (`AGENTS.md` is a symlink to it), `REVIEW.md`, ADRs 0002, 0003, 0004, 0006, 0010, 0011, 0012, 0013, 0014 and 0015 in `docs/decisions/`, `docs/pr-check-stamp.md`, `docs/licenses.md`, `plugins/pro-core/commands/pro-dev.md` and the status JSON of `plugins/pro-core/scripts/pro-dev.py`, `plugins/pro-ai-sdlc/templates/` (all five), `plugins/pro-quality/commands/constraints.md`, `plugins/pro-quality/agents/documentation-engineer.md`, `plugins/pro-quality/agents/code-reviewer.md` with its `.toml` twin, `plugins/pro-quality/skills/requesting-code-review/handoff.md`, `plugins/pro-quality/scripts/docs-before-push.py`, `plugins/pro-ship/skills/pr-check/` (`SKILL.md` and `pr-body.md`), `plugins/pro-ship/scripts/pr-check.py` (`find_sibling`), `plugins/pro-ship/scripts/risk-classify.py` (`read_policy`), `plugins/pro-design/skills/impeccable-bridge/SKILL.md`, impeccable's `reference/init.md` (the PRODUCT.md record, product-schema 1) and `reference/document.md` (the DESIGN.md format), the "Every project has its required documents" and "Twelve-factor" sections of `intent/2026-10-28-pro-ship-scope/brainstorm.md`, the `intent/2026-10-30-codex-second-reviewer/intent.md` sibling and `tests/check.mjs` (`sdlc-contract`, `handoff`, `ship-check`).
No `DESIGN.md` or `SECURITY.md` exists in this repo; the one project skill (`.claude/skills/skill-creator`) does not touch compliance, security, privacy or design.

## Summary

A repo with the plugins gets a short, checkable list of the documents it must have.
README.md, CLAUDE.md, AGENTS.md, REVIEW.md and a decisions folder are always on it.
ARCHITECTURE.md joins when the code shows more than one module, service or deployable, PRODUCT.md when it has users and DESIGN.md when it has a UI.
One deterministic script in pro-quality, `required-docs.py`, works the list out from the tracked files and an optional `## Required documents` block in `REVIEW.md` that adds or removes rows.
`/pro-dev install` runs it, asks at most four questions and drafts each missing document from the code through `documentation-engineer`, using new README, ARCHITECTURE and PRODUCT templates in pro-ai-sdlc that it reads in place.
`pr-check` runs the same script in its deterministic stage and lists each missing document with its rule as Should-fix; it never blocks and the stamp does not change.
The code reviewer flags a line in the agent file or `ARCHITECTURE.md` that the diff makes untrue.
This repo gets its own `ARCHITECTURE.md` and `PRODUCT.md` in the same PR, drafted the new way.

## Requirements

### Functional

The required-set script (pro-quality):

- R1. `plugins/pro-quality/scripts/required-docs.py` exists, is tracked, uses the Python 3 standard library only, makes no network call and writes nothing. (Intent: Proposed outcome; Constraints.)
- R2. The built-in default set has eight rows: README.md, CLAUDE.md, AGENTS.md, REVIEW.md and `docs/decisions/` always; ARCHITECTURE.md when the architecture signal holds; PRODUCT.md when the users signal holds; DESIGN.md when the UI signal holds. (Intent: Proposed outcome.)
- R3. A document counts as present only when it is tracked at HEAD (`git ls-files`); a tracked symlink counts.
  `docs/decisions/` counts as present when at least one tracked file sits under `docs/decisions/` or `docs/adr/`. (Intent: Proposed outcome; "the folder may start empty".)
- R4. The UI signal holds when the root `package.json` or the `package.json` of a workspace member that the root `workspaces` key or `pnpm-workspace.yaml` names (matched as globs on directory paths) lists one of `react`, `react-dom`, `vue`, `svelte`, `@sveltejs/kit`, `@angular/core`, `solid-js`, `preact`, `next`, `nuxt`, `astro`, `@remix-run/react`, `react-native`, `expo` or `electron` under `dependencies` or `devDependencies`.
  It also holds when a tracked `pubspec.yaml` names `flutter` or when `DESIGN.md` is tracked.
  The evidence names the file and the match.
  A `package.json` outside the root and its declared workspaces, such as this repo's `demo/app/`, does not count. (Intent: Open question 4.)
- R5. The users signal holds when the UI signal holds.
  Nothing else turns it on by default; a repo with an install base and no UI gets PRODUCT.md through the `REVIEW.md` block that `/pro-dev install` writes from its question. (Intent: Open questions 1 and 4.)
- R6. The architecture signal holds when any of these is tracked: `pnpm-workspace.yaml`, `lerna.json`, `nx.json`, `turbo.json`, `go.work`, a `workspaces` key in the root `package.json`, a `[workspace]` table in the root `Cargo.toml` or a `[tool.uv.workspace]` table in the root `pyproject.toml`.
  It also holds when two or more directories each hold a tracked `package.json`, `pyproject.toml`, `go.mod` or `Cargo.toml`.
  It also holds when two or more `Dockerfile*` files are tracked.
  Paths with a segment `tests`, `test`, `__tests__`, `fixtures`, `__fixtures__`, `examples`, `example`, `node_modules`, `vendor` or `third_party` are ignored for the manifest and Dockerfile counts. (Intent: Open question 3.)
- R7. When `AGENTS.md` and `CLAUDE.md` are both regular files, neither is a pointer (ten lines or fewer that name the other file) and their bytes differ, the output carries the finding `agent-files-differ`.
  A symlink, a pointer or an identical copy raises nothing. (Intent: Open question 2.)
- R8. The script reads one fenced block under a `## Required documents` heading in `REVIEW.md`, after stripping HTML comments, in the same restricted YAML subset as the risk classifier.
  The only keys are `add` and `remove`, each a list of repo-relative paths; a path ending in `/` is a folder that must hold a tracked file.
  `remove` may name only ARCHITECTURE.md, PRODUCT.md or DESIGN.md.
  Any other key, a scalar value, a duplicate key or an always row under `remove` makes the block unreadable: the script uses the built-in default and adds the finding `required-docs-block-unreadable (<reason>)`. (Intent: Open question 5.)
- R9. `--policy-ref <ref>` reads `REVIEW.md` from that commit with `git show`, so a pull request cannot loosen its own set; without it the script reads the working tree.
  Presence is always judged at HEAD. (Intent: Constraints; same rule as ADR-0015's policy read.)
- R10. `--json` prints `{source, signals, rows, missing, findings}`.
  `source` is `defaults`, `REVIEW.md` or `unreadable (<reason>)`.
  Each row is `{doc, rule, applies, present}` and `missing` lists `{doc, rule}` for every row that applies and is absent.
  Without `--json` it prints one line per missing document, `missing  <doc>  (<rule>)`, then one line per finding.
  Exit 0 means nothing is missing, exit 3 means one or more documents are missing and exit 2 means it could not run (not a git repo, git failed or timed out), with `{"could_not_run": true, "reason": ...}` on stdout. (Intent: Constraints, "could not run must never read as nothing missing".)
- R11. The `rule` text is `always`, `more than one module, service or deployable: <evidence>`, `has users: <evidence>`, `has a UI: <evidence>` or `REVIEW.md add`. (Intent: Success looks like, "names it with its rule".)

Templates (pro-ai-sdlc, read in place):

- R12. `plugins/pro-ai-sdlc/templates/` gains `README.md`, `ARCHITECTURE.md` and `PRODUCT.md`, each under 60 lines, with an angle-bracket placeholder in every section and a closing comment that says to fill each section from the code and keep a placeholder only where the code cannot say. (Intent: Proposed outcome; Open questions 7 and 8.)
- R13. The README template has the sections What it is, Install, Run, Test and Documents (links to the other required documents that exist). (Brainstorm doc set table.)
- R14. The ARCHITECTURE template has the sections Overview, Parts (a table of part, path, job and what it talks to), How requests and data flow, Boundaries, Deployables and Twelve-factor.
  The Twelve-factor section is a heading with one comment line saying the architecture review (ranked item 17) fills it. (Intent: Open question 10.)
- R15. The PRODUCT template follows impeccable's PRODUCT.md record: `# Product`, the comment `<!-- impeccable:product-schema 1 -->` copied verbatim, then `## Platform`, `## Users`, `## Product Purpose`, `## Positioning`, `## Operating Context`, `## Capabilities and Constraints`, `## Brand Commitments`, `## Evidence on Hand`, `## Product Principles` and `## Accessibility & Inclusion` in that order.
  Its closing comment says to omit a section the code cannot inform instead of filling it with generic prose, as impeccable's `init` does.
  The comment also credits the section names to impeccable (Apache-2.0). (Intent: Proposed outcome, "PRODUCT.md and DESIGN.md follow the shapes impeccable reads".)
- R16. `plugins/pro-ai-sdlc/templates/REVIEW.md` gains a commented `## Required documents` block, in the style of the Risk tiers block, with `add: []` and `remove: []` and two lines on what each key does.
  With the comment markers removed the block parses as R8 describes.
  The "Learning from repeats" line becomes "If the change makes a line of the agent file or `ARCHITECTURE.md` untrue, flag that too." (Intent: Open question 5; reviewer flag.)

`/pro-dev install` (pro-core):

- R17. Section 4 of `plugins/pro-core/commands/pro-dev.md` gains a "Required documents" subsection after "Create the folders and the review policy".
  When pro-quality covers the repo (from the `plugins` list in the status JSON), it runs `python3 <pro-quality installPath>/scripts/required-docs.py --json`.
  Otherwise it applies the rules of R2 to R6 from its own inspection and says the deterministic check is not installed. (Intent: Proposed outcome; Constraints, "the installer checks for the plugin instead".)
- R18. It asks at most four questions one at a time, each with a default.
  It skips any the code answers:
  whether the project has users or an install base (default yes when the users signal holds, else no), whether it has more than one module, service or deployable (default the architecture signal), whether it has a UI (asked only when no UI signal holds and tracked `.html`, `.css` or template files exist; default no) and, when neither agent file is a symlink or pointer yet, whether `AGENTS.md` is a symlink or a pointer (default symlink).
  In a non-interactive run it takes every default and says so. (Intent: Constraints, the `/constraints` model; Open questions 3 and 4.)
- R19. It never overwrites a document that exists.
  A present document is listed as present and left alone; an `agent-files-differ` finding is reported with both paths. (Intent: Constraints.)
- R20. For each missing README.md, ARCHITECTURE.md or PRODUCT.md it reads `<aiSdlcInstallPath>/templates/<doc>`.
  When the host offers `pro-quality:documentation-engineer` it dispatches it once per document with the template path, the target path and the inspection facts.
  The agent writes the file.
  Without that agent it writes the bare template and lists the sections left to fill.
  A missing template file is reported as "no template for <doc> in the installed pro-ai-sdlc; run /pro-dev update" and the run goes on. (Intent: Open question 6; Constraints, "a missing template degrades to a named gap".)
- R21. A missing AGENTS.md becomes a symlink to CLAUDE.md (`ln -s CLAUDE.md AGENTS.md`) or a pointer file that says to read CLAUDE.md when the person chose a pointer or the symlink fails.
  When the repo's file is AGENTS.md and CLAUDE.md is missing, the same applies the other way round.
  It never writes a copy. (Intent: Open question 2.)
- R22. When neither `docs/decisions/` nor `docs/adr/` exists it creates `docs/decisions/README.md` with a one-line purpose and an empty index table (`| ADR | Decision | Date |`). (Intent: Proposed outcome.)
- R23. DESIGN.md is not drafted by install.
  When the UI signal holds and DESIGN.md is missing, the report names `/impeccable document` (through pro-design's `impeccable-bridge`) as the next step or says the impeccable engine is not installed. (Intent: Proposed outcome; flagged concern 4.)
- R24. When install writes `REVIEW.md` in this run, it fills the `## Required documents` block with an `add` or `remove` entry for every answer that differs from the script's default and uncomments it; with no difference the block stays commented.
  When `REVIEW.md` already exists it prints the block to paste and does not edit the file. (Intent: Constraints; flagged concern 5.)
- R25. The report lists each required document as drafted, bare template, present, left as a gap (with the reason) or not required, plus the placeholder count of each drafted file.
  It never commits, stages or pushes. (Intent: Constraints.)
- R26. `allowed-tools` in `pro-dev.md` gains `Bash(ln -s CLAUDE.md AGENTS.md)` and `Bash(ln -s AGENTS.md CLAUDE.md)`; running `required-docs.py` from another plugin's path is not pre-approved and prompts. (Constraint: the command already pre-approves only read-only and `pro-dev.py` calls.)

`documentation-engineer` (pro-quality):

- R27. `plugins/pro-quality/agents/documentation-engineer.md` gains a short "Drafting a document from a template" section: keep the template's headings and order, fill each section from facts in the code with the file path that shows each one, leave an angle-bracket placeholder only where the code cannot say, omit an optional section the code cannot inform, never invent users, numbers, customers or claims and keep the result under one page.
  Its `.codex-plugin/agents/documentation-engineer.toml` twin carries the same section. (Intent: Open question 6; Constraints, "content comes from the code".)

`code-reviewer` (pro-quality):

- R28. The compliance lens in `plugins/pro-quality/agents/code-reviewer.md` and its `.toml` twin adds: read `ARCHITECTURE.md` at the repo root when it exists and flag a line in it or in the agent file that the diff makes untrue, naming the file and line.
  The four-field handoff and `handoff.md` do not change. (Intent: Proposed outcome, reviewer flag; ADR-0012.)

`pr-check` (pro-ship), deterministic stage only:

- R29. Setup step 3 of `plugins/pro-ship/skills/pr-check/SKILL.md` (today "Look for `REVIEW.md`") becomes a required-documents step.
  It runs `DOCS=$(python3 "$CHECK" find pro-quality required-docs.py)`.
  On `not-installed` it prints `documents   not-installed` and says the required-documents check did not run.
  Otherwise it runs `python3 "$DOCS" --json --policy-ref <base>` and prints `documents   pass`, `documents   missing <n>` with one `Should-fix: <doc> (<rule>)` line each.
  On exit 2 it prints `documents   could-not-run <reason>`.
  When `REVIEW.md` is among the missing it points to `/pro-dev install`. (Intent: Proposed outcome; Open question 9.)
- R30. A missing document never changes `result`, never stops the run and never blocks.
  `plugins/pro-ship/scripts/pr-check.py`, `docs/pr-check-stamp.md` and the stamp fixtures do not change. (Intent: Constraints; Out of scope, "making any missing-document check block".)
- R31. `plugins/pro-ship/skills/pr-check/pr-body.md` gains a "Missing documents" line in the Risk section: each missing document with its rule and "Should-fix", "none" only when the check ran and found none, else "not checked (<why>)".
  The report example in SKILL.md gains a `documents` line. (Intent: Success looks like.)
- R32. The "No script" section of the pr-check skill says to run `required-docs.py` from pro-quality when it can be found and otherwise to report "required documents: not checked". (Codex parity.)

Tests and housekeeping:

- R33. `tests/required-docs.mjs` drives the script in throwaway git repos and exports `runRequiredDocsCases()`; `tests/check.mjs` gains a `required-docs` check that runs those cases and also fails when a template of R12 is missing, when the PRODUCT template lacks the schema comment or a heading of R15, when the ARCHITECTURE template lacks `## Twelve-factor`, when `pro-dev.md` does not name `required-docs.py` and the three templates or when the pr-check skill does not name `required-docs.py` and `Should-fix`. (Intent: Constraints.)
- R34. `tests/unit/risk-classifier.test.mjs` gains a case: a `REVIEW.md` holding both a Risk tiers block and a Required documents block still reads its policy as `REVIEW.md` with the Risk tiers values. (Intent: Affected systems, the classifier.)
- R35. pro-core, pro-ai-sdlc, pro-quality and pro-ship each take a minor bump in both manifests and the marketplace entry.
  `metadata.version` takes one minor bump in the same commit as the content. (ADR-0002.)
- R36. `docs/decisions/0020-required-documents.md` exists with Status `proposed` and a row in `docs/decisions/README.md`. (Intent: Open question 11.)
- R37. `docs/licenses.md` gains a pro-ai-sdlc row for `templates/PRODUCT.md` naming impeccable, Apache-2.0, adapted (section names and schema comment). (Intent: Constraints, adapted text.)
- R38. This repo gains `ARCHITECTURE.md` and `PRODUCT.md` at the root, drafted from the new templates by `documentation-engineer`, each linking `docs/overview.md` where it already says the same thing.
  This repo's `REVIEW.md` gains an uncommented `## Required documents` block with `add: [PRODUCT.md]`, because the repo has an install base and no UI. (Intent: Problem; Out of scope names only the maintainer's other repos.)

### Non-functional

- N1. `required-docs.py` finishes in under two seconds on this repo and bounds every git call with a timeout.
- N2. Each template is short enough that a reviewer reads a drafted document whole: under 60 lines as a template and under one page drafted. (Intent: Success looks like.)
- N3. All new prose follows the repo's writing rules: one sentence per line, no em dash, no Oxford comma, straight quotes and no home-directory path.
- N4. The script and every changed skill or command work in a repo with only some plugins installed; each absent piece is named in the output, never skipped in silence.

### Policy constraints applied

- Version-bump law (ADR-0002): four plugins and `metadata.version` bump in the same commit as their content (R35); numbers are read from `main` at build time because the codex-second-reviewer PR lands first.
- Hook-loading law (ADR-0003): no hook is added or changed; `required-docs.py` is run by a command and a skill, not registered in `hooks.json`.
- Codex parity (ADR-0004): both changed agents keep their `.toml` twins in step (R27, R28); the pr-check skill names a path that works without the script (R32); `.codex-plugin/plugin.json` versions move with the Claude ones.
- ADR-0003, plugins cannot import each other: pr-check reaches the script through `pr-check.py find`; the Required documents block parser is a second copy of the classifier's subset parser, kept to two keys.
- ADR-0006: no bridge skill and no engine row is added, so `plugins/pro-core/registry/engines.json` does not change.
- ADR-0012: the handoff keeps four fields; the reviewer reads `ARCHITECTURE.md` from the repo as it reads code (R28).
- ADR-0013 (proposed): pr-check only consumes the check; the check sits in the domain (pro-quality) and the templates in a method (pro-ai-sdlc), flagged as concern 1.
- ADR-0014: the stamp contract does not change (R30).
- ADR-0015: the block is read from the merge base, as the risk policy is (R9).
- `docs/licenses.md`: the adapted impeccable section names get a row (R37).
- CLAUDE.md "no pro-core dependency on a plugin that owns registry rows": pro-core gains no dependency; install checks the status JSON for pro-quality and pro-ai-sdlc (R17, R20).

## Design

### User experience

`/pro-dev install` in a Next.js app with only a README prints, after the review-policy step:

```
Required documents (required-docs.py, source: defaults)
  README.md        present, left alone
  CLAUDE.md        drafted (2 placeholders)
  AGENTS.md        symlink to CLAUDE.md
  REVIEW.md        written from the template
  docs/decisions/  created with an empty index
  ARCHITECTURE.md  not required (one deployable)
  PRODUCT.md       drafted (has users: next in package.json; 3 placeholders)
  DESIGN.md        missing - run /impeccable document
Nothing is committed.
```

`pr-check` in a repo that lacks two documents prints in its report:

```
  documents   missing 2
    Should-fix: ARCHITECTURE.md (more than one module, service or deployable: pnpm-workspace.yaml)
    Should-fix: docs/decisions/ (always)
```

The result line is the same as it would be with no documents missing.

### System

New: `plugins/pro-quality/scripts/required-docs.py`, three templates in `plugins/pro-ai-sdlc/templates/`, `tests/required-docs.mjs`, ADR-0020, `ARCHITECTURE.md` and `PRODUCT.md` at this repo's root.
Changed: `plugins/pro-core/commands/pro-dev.md`, `plugins/pro-ai-sdlc/templates/REVIEW.md`, `plugins/pro-quality/agents/documentation-engineer.md` and `code-reviewer.md` with their twins, `plugins/pro-ship/skills/pr-check/SKILL.md` and `pr-body.md`, `tests/check.mjs`, `tests/unit/risk-classifier.test.mjs`, `docs/licenses.md`, `docs/decisions/README.md`, `README.md` (the Document row), this repo's `REVIEW.md` and the manifests and marketplace entries of four plugins.
Unchanged on purpose: `pr-check.py`, the stamp contract, `handoff.md`, `risk-classify.py`, `docs-before-push.py` (its KEY_DOCS already covers the set) and `engines.json`.

Reuse: the block parser copies the shape of `parse_block` and `read_policy` in `risk-classify.py`; the test runner copies the `{skipped, results}` shape of `tests/ship-check.mjs`; install's question rules copy `/constraints`; pr-check reaches the script the way it reaches the floor guard and the security classifier.

### Alternatives considered

- Keep the required set in its own file (`.pro-dev/docs.json` or `REQUIRED-DOCS.md`): one more file every gate reads; `REVIEW.md` already holds the dials and a team edits policy in one reviewed place.
- An explicit `required:` list in the block instead of `add` and `remove`: a repo that later gains a UI would never be told about DESIGN.md, because detection stops once the list is written.
- Put the detection in `pr-check.py`: pr-check would own the rule it should only consume (ADR-0013) and `/pro-dev install` could not reuse it.
- Put the detection in pro-core's `pro-dev.py`: pr-check cannot depend on pro-core paths any more cleanly than on pro-quality's; pro-core must stay free of codebase assumptions under ADR-0013.
- Add a `documents` field to the stamp: nothing reads it for a verdict and the contract would change for a list the PR body already carries.
- Add `ARCHITECTURE.md` to the handoff's `policy` field: it would touch pr-check's Handoff section, which the codex-second-reviewer change also edits; the reviewer can read a root file as it reads code.
- Ship a DESIGN.md template: impeccable's `document` owns that format and extracts tokens from the build; a second template would drift from it.
- Copy AGENTS.md from CLAUDE.md: a copy drifts; a symlink or pointer cannot.

## Flagged concerns

Sources read: the policies listed at the top.

ADR needed: yes, the required set and where it lives become a rule that `/pro-dev install`, `pr-check`, the reviewer and later CI all read; moving it later touches every repo's `REVIEW.md`; drafted as [ADR-0020](../../docs/decisions/0020-required-documents.md).

| # | Concern | Policy or owner | Resolution |
|---|---------|-----------------|------------|
| 1 | ADR-0013 says a method holds only its method, but the README, ARCHITECTURE and PRODUCT templates serve every method and sit in pro-ai-sdlc. | ADR-0013 | resolved (the intent's recommendation): templates stay in pro-ai-sdlc and are read in place; revisit when ADR-0013 moves the dev domain together |
| 2 | The codex-second-reviewer change edits the pr-check skill, `pr-body.md`, `code-reviewer.md` and its twin and adds an engines row; the two PRs collide in four files and in every version number. | `intent/2026-10-30-codex-second-reviewer/intent.md`; ADR-0002 | resolved: build after it merges, rebase first, keep the pr-check edit to Setup step 3, the report example and one pr-body line; read versions from `main` at build time |
| 3 | The PRODUCT template adapts impeccable's section names and schema comment, which are Apache-2.0. | `docs/licenses.md` | resolved with a recommendation: credit impeccable in the template's closing comment and a licenses row; the maintainer may judge section names need no row |
| 4 | The intent says install drafts the missing documents, but DESIGN.md is written by impeccable's `document`, which runs its own interview beyond the four-question cap. | intent Proposed outcome | resolved with a recommendation: install names `/impeccable document` as the next step and does not draft DESIGN.md (R23) |
| 5 | Writing the block into an existing `REVIEW.md` would edit a present document, which the intent forbids. | intent Constraints | resolved: install prints the block to paste and edits only a `REVIEW.md` it wrote in the same run (R24) |
| 6 | The brainstorm lets a team make a missing document Blocking through the block, while the intent rules out any blocking check. | brainstorm; intent Out of scope | resolved (the intent's recommendation): no severity key in this change; ranked item 21 adds it with the scaling block |
| 7 | "The folder may start empty" cannot be checked, because git does not track an empty folder. | intent Proposed outcome | resolved: the folder counts when it holds a tracked file and install writes `docs/decisions/README.md` (R3, R22) |
| 8 | The architecture signal fires on this repo (root `package.json`, `demo/app`, `plugins/pro-spdd/bin` and an upstream `go.mod`), so every PR here would show ARCHITECTURE.md as Should-fix until the repo has one. | this repo | resolved: this PR adds `ARCHITECTURE.md` and `PRODUCT.md` (R38) |
| 9 | `demo/app/` is a Next.js app, so a UI signal read from every `package.json` would demand DESIGN.md of a plugin marketplace. | this repo | resolved: the UI signal reads only the root manifest and declared workspace members (R4) |

## Open questions

1. PRODUCT.md for libraries and plugin repos: answered, yes as a short "who uses this and why" when the repo has users or an install base; by default only a UI turns it on and install asks otherwise (R5, R18).
2. AGENTS.md form: answered, a symlink by default, a pointer where a symlink is not wanted, never a copy written by install; an existing differing copy is reported (R7, R21).
3. How install decides ARCHITECTURE.md applies: answered, the signals of R6 with one question to override (R18).
4. How install decides UI and users: answered, a UI framework dependency or a tracked DESIGN.md; the question is skipped when the code answers (R4, R5, R18).
5. Where the required set lives: answered, a `## Required documents` block in `REVIEW.md` with a built-in default when it is absent or unreadable (R8).
6. Who drafts the content: answered, `documentation-engineer`; without it install writes the bare template and lists the sections left (R20, R27).
7. Which plugin owns the templates: answered, pro-ai-sdlc (flagged concern 1).
8. Installed into the repo or read in place: answered, read in place; only the drafted document lands in the repo (R20).
9. Severity in pr-check: answered, Should-fix everywhere and never a block until ranked item 21 (R29, R30).
10. One intent with ranked item 17 or two: answered, split; ARCHITECTURE.md carries an empty Twelve-factor heading for the architecture review to fill (R14).
11. Likely needs an ADR: answered, yes, ADR-0020.

## Acceptance criteria

- AC1. `node tests/check.mjs && node tests/eval.mjs --dry`, `node tests/route-lexical.mjs --min-rank1 70 && node --test tests/unit/*.test.mjs`, `claude plugin validate . --strict` and the per-plugin strict loop all pass.
- AC2. `node tests/check.mjs required-docs` failed before `required-docs.py` existed and passes after, covering every case listed in plan step 1.
- AC3. In this repo after the change, `python3 plugins/pro-quality/scripts/required-docs.py --json` exits 0 with `source` `REVIEW.md` and an empty `missing`; deleting `ARCHITECTURE.md` from the index in a throwaway clone makes it exit 3 naming ARCHITECTURE.md with a rule that starts "more than one module".
- AC4. The shipped `templates/REVIEW.md` block, with its comment markers removed, gives `source` `REVIEW.md`; as shipped it gives `defaults`.
- AC5. The three templates exist; the PRODUCT template holds the schema comment and the ten headings of R15 in order; the ARCHITECTURE template holds `## Twelve-factor`.
- AC6. In a throwaway repo with no `docs/decisions/` and pro-quality reachable, a pr-check run prints `documents   missing 1` with `Should-fix: docs/decisions/ (always)` and the same `result` as a run where the folder exists; run once by hand and pasted into the PR.
- AC7. The pr-check skill says `not-installed` and "did not run" for an absent script and never prints `documents   pass` without running it (grep).
- AC8. A `/pro-dev install` run on a throwaway copy of a small app with only a README ends with the documents of its kind drafted, no existing file changed (`git diff` shows only new files and `.gitignore`) and each placeholder in angle brackets; run once by hand and the report pasted into the PR.
- AC9. `code-reviewer.md` and `code-reviewer.toml` both name `ARCHITECTURE.md` in the compliance lens; `git diff origin/main -- plugins/pro-quality/skills/requesting-code-review/handoff.md` is empty.
- AC10. `git diff origin/main --stat -- plugins/pro-ship/scripts/pr-check.py docs/pr-check-stamp.md tests/fixtures/pr-check-stamp plugins/pro-core/registry/engines.json` is empty.
- AC11. The four plugins agree on their versions across both manifests and the marketplace, with `metadata.version` bumped once (the version-bump check passes).
- AC12. ADR-0020 exists with Status `proposed` and its index row; `docs/licenses.md` has the impeccable row.
- AC13. `ARCHITECTURE.md` and `PRODUCT.md` exist at this repo's root, every claim in them names a path that exists and `REVIEW.md` carries the block with `add: [PRODUCT.md]`.

## Out of scope

`SECURITY.md`, `CONTRIBUTING.md` and `CODEOWNERS` (ranked item 21, `repo-hygiene`).
The architecture review, its agent and the twelve-factor checklist (ranked item 17); only the empty heading lands here.
Keeping documents fresh beyond `docs-before-push.py` and the reviewer flag.
Writing documents into the maintainer's other repos; each gets them by running `/pro-dev install`.
A severity key or any blocking path for a missing document.
A `/pro-dev update` step that refreshes existing documents.
A DESIGN.md template.
