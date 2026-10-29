---
intent: intent/2026-10-29-evals-three-tiers/intent.md
intent-status: proposed
status: draft
created: 2026-10-29T10:20:00-0400
author: Jody Brewster
---

# Spec: behavioral, plugin and CI evals

Built from `intent.md` in this folder.
Status: draft.
Prior art read on 2026-10-29 in a local clone of agent-skills (commit eb07f19): `evals/README.md`, `evals/cases/*.json`, `evals/plugin/*`, `scripts/run-evals.js`, `scripts/lib/execution-status.js` and `.github/workflows/test-plugin-install.yml`.
Code read here: `tests/eval.mjs`, `tests/check.mjs`, `tests/README.md`, `tests/cases/routing.jsonl` and `.github/workflows/validate.yml`.
Verified locally: Claude Code 2.1.312 has `claude plugin eval`; a plugin manifest with `"experimental": {"evals": "evals"}` passes `claude plugin validate --strict`; `claude --bare` skips user plugins, hooks and CLAUDE.md and authenticates only with `ANTHROPIC_API_KEY`.
No code is copied from agent-skills; it is credited as prior art in `docs/evals.md`.

## Summary

A keyless lexical router turns the existing routing cases into a CI gate and adds a description collision check and a coverage ratchet.
A behavioral runner builds a throwaway git repo from fixtures, runs headless `claude` with the skill under test and grades the trace against expectations, with and without the skill.
Five skills in three plugins gain plugin eval case pairs that `claude plugin eval` runs with and without the plugin.

## Requirements

### CI tier

- R1. `tests/lib/catalog.mjs` exports the catalog loader and frontmatter parser, and `tests/eval.mjs` imports them instead of its own copies, with unchanged behavior.
- R2. `tests/route-lexical.mjs` ranks every catalog entry, distractors included, against each case in `tests/cases/routing.jsonl` by cosine similarity of stemmed TF-IDF vectors over name and description; it uses no network and no dependency.
- R3. A case passes at rank 1 when the top entry is one of `expect`, and in top-k when one of `expect` is within the first `k` (default 3, or the case's optional `top_k`); a case with `notOneOf` fails when any of those ranks first.
- R4. It prints the rank-1 rate, the top-k rate and each failing case with its top three, and exits 1 when the rank-1 rate is below `--min-rank1 <n>` or any `notOneOf` case fails.
- R5. It computes the pairwise similarity of every two catalog descriptions; at 0.50 or above it warns and at 0.75 or above it fails, unless the pair is listed with a reason in `tests/cases/collisions-allowed.json`.
- R6. A `coverage` check in `tests/check.mjs` fails when a skill has no case naming it in `expect` and is not listed in `tests/cases/uncovered.json`, and fails when a listed skill now has a case, so the list can only shrink.
- R7. `.github/workflows/validate.yml` runs `node tests/route-lexical.mjs --min-rank1 <floor>` and `node --test tests/unit/`, where the floor is the measured baseline rounded down to the nearest 5 and recorded in `docs/evals.md` with the date.
- R8. `tests/unit/` holds `node:test` files for the stemmer, the ranking, the collision check, the coverage list logic and the behavioral runner's trace completeness and case validation.

### Behavioral tier

- R9. A case file `evals/cases/<skill>.json` holds `skill`, `plugin` and `evals[]`; each eval has `id`, `kind` (`execution` or `dialogue`, default `execution`), `prompt`, optional `pressure` (`time`, `sunk-cost` or `authority`), `files[]` (paths under `evals/fixtures/`, required for `execution`) and `expectations[]` (at least one).
- R10. `tests/behavioral.mjs [skill...] [--dry-run] [--baseline] [--model <m>]` copies each eval's fixtures into a new temp directory, runs `git init` and commits them as the baseline.
- R11. It runs `claude --bare -p` in that directory with `--plugin-dir plugins/<plugin>`, `--output-format stream-json --verbose`, `--permission-mode acceptEdits`, a fixed `--allowedTools` list, `--max-turns 30`, `--model` (default `sonnet`) and the skill's `SKILL.md` appended to the system prompt; the prompt goes on stdin.
- R12. With `--baseline` it also runs each eval without the appended skill and without `--plugin-dir`, and reports both.
- R13. A run counts only when the stream ends in a successful `result` with no permission denials and every tool call has a result; otherwise it keeps the raw stream and error beside the result slot, scores nothing and moves to the next eval.
- R14. A grader call (`claude --bare -p`, same model) receives the expectations and the trace fenced as untrusted data on stdin and must return JSON `{ "expectations": [{ "text", "passed", "evidence" }] }`; invalid JSON scores nothing.
- R15. Results go to `evals/results/<timestamp>/<skill>-<id>[-baseline].json`, which `.gitignore` excludes; the run prints a pass count per eval and per arm.
- R16. Without `ANTHROPIC_API_KEY` it exits 1 with a message naming the variable; `--dry-run` prints the plan and validates cases and fixtures with no key.
- R17. The first cases are one execution eval each for `test-driven-development`, `systematic-debugging` and `verification-before-completion`, plus one `time` pressure eval for `test-driven-development`, each with its own small JavaScript fixture written for this repo and run with `node --test`.

### Plugin tier

- R18. `pro-execution`, `pro-quality` and `pro-pdd` each set `"experimental": {"evals": "evals"}` in `.claude-plugin/plugin.json` and hold cases under `plugins/<plugin>/evals/<case>/` as `prompt.md` (frontmatter `description`, `expected_outcome`, `max_turns` of 10 or more, `allowed_tools`) plus `graders/*.md`.
- R19. Each of the five skills in the intent has a `<skill>-fires` case with a `tool_used: Skill` grader and at least one grader on the reply (`regex` or `llm`), and a `<skill>-stays-quiet` case whose `tool_used` grader has `min: 0`, `max: 0`, `arm: both` on an adjacent prompt that belongs to a different skill.
- R20. An `evals` check in `tests/check.mjs` fails when a plugin's `experimental.evals` directory is missing, a case lacks `prompt.md` or a grader, a grader `type` is not `tool_used`, `regex` or `llm`, or a `regex` pattern does not compile.
- R21. `.gitignore` excludes `plugins/*/evals/results/`.
- R22. The three plugins bump per the version-bump law in both manifests and the marketplace entry, with `metadata.version`, in the same commit.

### Docs

- R23. `docs/evals.md` explains the three tiers, how to run each, the cost of the live tiers, the floor and its date, how to add a case and the agent-skills credit; `tests/README.md`, `docs/README.md` and the verifying section of `CLAUDE.md` and `AGENTS.md` point to it.
- R24. `docs/decisions/0009-three-eval-tiers.md` records that CI gates only the keyless tier and the live tiers run on demand.

## Non-functional

- N1. No new dependency: Node 20 standard library only, as the rest of `tests/`.
- N2. The CI tier adds under 10 seconds to `validate.yml`.
- N3. No live tier runs in CI or spends tokens without an explicit command.
- N4. Prose follows the repo's writing rules; Codex parity checks stay green.

## Out of scope

- Eval cases for the other 74 skills: the ratchet makes new skills add one, and existing ones are added as they are touched.
- Multi-host command parity, artifact-path drift and CI on more than ubuntu.
- Changing any skill description; a failing case is a finding for a later change.
