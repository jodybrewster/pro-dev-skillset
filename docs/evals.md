# Evals

How this repo measures whether its skills route and whether they change what the agent does.
There are three tiers.
Only the first runs in CI; the other two spend tokens and run when someone asks for them ([ADR-0009](./decisions/0009-three-eval-tiers.md)).

| Tier | What it checks | Where | Runs | Cost |
|---|---|---|---|---|
| Keyless routing | Each routing case ranks its skill first; no two descriptions near-collide; every skill has a case | `tests/route-lexical.mjs`, the `eval-coverage` check | CI on every PR | free |
| Model routing | A model picks the expected skill and never a `notOneOf` one | `tests/eval.mjs` | on demand (`--dry` in CI) | Haiku tokens |
| Behavioral | An agent following the skill meets the case's expectations, compared with a run without it | `tests/behavioral.mjs`, `evals/` | on demand | Sonnet tokens |
| Plugin | Claude Code's own router fires the skill on a natural prompt, stays quiet on an adjacent one and the reply gains what the skill adds | `plugins/<plugin>/evals/`, `claude plugin eval` | on demand | Sonnet and Haiku tokens |

Model routing is the eval that existed before this page; it sits between the keyless and behavioral tiers.

## Keyless routing

```bash
node tests/route-lexical.mjs                  # report
node tests/route-lexical.mjs --min-rank1 70   # what CI runs
node tests/route-lexical.mjs --verbose        # list every collision warning
node --test tests/unit/*.test.mjs             # unit tests for the eval tooling
```

It ranks every catalog entry, the distractors in `tests/lib/catalog.mjs` included, against each case in `tests/cases/routing.jsonl` by cosine similarity of stemmed TF-IDF vectors over name and description.
It is a lexical stand-in for the router: it catches a description that lacks the words people use and one so broad it outranks the right skill.
It cannot judge meaning.
A `notOneOf` case that ranks a forbidden entry first is a warning here because those cases mark semantic boundaries; `tests/eval.mjs` holds them.

The baseline on 2026-10-29 was rank-1 60 of 79 (75.9%) and top-3 73 of 79 (92.4%), so CI gates at 70.
Raise the floor as routing improves and never lower it to let a regression pass.
When a case misses, fix the description, not the prompt.

Pairs of descriptions at 0.50 similarity or above print a warning; at 0.75 they fail unless the pair is listed with a reason in `tests/cases/collisions-allowed.json`.
On 2026-10-29 no pair reached 0.75 and 16 warned, most of them `spdd-*-lead` skills.

The `eval-coverage` check in `tests/check.mjs` fails on a skill that no case names in `expect`, unless it is listed in `tests/cases/uncovered.json`.
An entry that is now covered or no longer exists also fails, so the list only shrinks.
A new skill ships with at least one routing case.

## Behavioral

```bash
node tests/behavioral.mjs --dry-run                              # validate cases and print the plan, no key
node tests/behavioral.mjs test-driven-development --baseline     # one skill, with and without it
node tests/behavioral.mjs --baseline --model sonnet              # every case
```

It needs `ANTHROPIC_API_KEY`, because it runs `claude --bare`, which skips your plugins, hooks and CLAUDE.md and reads no OAuth login.
For each eval it copies the listed fixtures into a new temp directory, commits them as the baseline and runs headless `claude` with only the skill's plugin loaded and the skill appended to the system prompt.
`--baseline` runs the same eval again with no plugin and no skill.
A run counts only when the stream ends in a successful result with no permission denials and every tool call answered; anything else keeps its raw stream beside the result and scores nothing.
A second `claude --bare` call grades the trace against the expectations and returns JSON.
Results land in `evals/results/<timestamp>/`, which git ignores.

A case file is `evals/cases/<skill>.json`:

```json
{
  "skill": "test-driven-development",
  "plugin": "pro-execution",
  "evals": [
    {
      "id": 1,
      "kind": "execution",
      "pressure": "time",
      "prompt": "...",
      "files": ["test-driven-development"],
      "expectations": ["A failing test that reproduces BUG.md is run before src/ changes", "..."]
    }
  ]
}
```

`kind` is `execution` (the default, needs `files` under `evals/fixtures/`) or `dialogue` (the reply is the deliverable).
`pressure` marks a case whose prompt argues for skipping the skill: `time`, `sunk-cost` or `authority`.
Write expectations as behaviors a grader can see in the trace, not phrasings.
Keep fixtures small, dependency-free and runnable with `node --test`.

## Plugin

```bash
claude plugin eval plugins/pro-execution --no-publish                                   # every case, both arms, 3 runs each
claude plugin eval plugins/pro-quality --case 'requesting-code-review-*' --runs 1 --model sonnet --no-publish
```

A plugin with cases sets `"experimental": {"evals": "evals"}` in `.claude-plugin/plugin.json`.
Each case is a folder under `plugins/<plugin>/evals/` holding `prompt.md` (frontmatter `description`, `expected_outcome`, `max_turns` of 10 or more, `allowed_tools`; the body is the prompt) and one grader per file under `graders/`.
Cases come in pairs:

- `<skill>-fires`: a natural prompt that does not name the skill, a `tool_used` grader on the Skill tool and at least one `regex` or `llm` grader on what the skill adds to the reply;
- `<skill>-stays-quiet`: an adjacent prompt that belongs elsewhere, with a `tool_used` grader set to `min: 0`, `max: 0`, `arm: both`.

`claude plugin eval` scores each case with and without the plugin; the `Δ` column is what the plugin adds.
A `tool_used: Skill` grader only says whether the skill fired and is left out of the two-arm score, so pair it with a grader on the reply.
Firing is stochastic: read the report and `Δ`.
Pin `--model` and note the Claude Code version whenever you quote numbers.
The `evals` check in `tests/check.mjs` fails on a missing case file, a grader with an unknown `type`, a regex that does not compile or an `evals/` folder whose plugin lacks the manifest key.
Adding cases to a plugin is a content change, so it bumps the plugin per the version-bump law.
Reports land in `plugins/<plugin>/evals/results/`, which git ignores.

Covered on 2026-10-29: `test-driven-development` and `systematic-debugging` (pro-execution), `verification-before-completion` and `requesting-code-review` (pro-quality) and `writing-plans` (pro-pdd).

## Measured changes

### 2026-10-29: four discipline skills ([intent](../intent/2026-10-29-skill-firing/))

Sonnet pinned, Claude Code 2.1.312, 3 runs per case and arm.
"Before" is the old description on the sharpened case; "after" is the shipped description.
Reply is the share of runs whose reply graders passed, with the plugin and without it.

| Skill | Fired before | Fired after | Reply after, with | Reply after, without |
|---|---|---|---|---|
| `test-driven-development` | 0 of 3 | 3 of 3 | 3 of 3 | 0 of 3 |
| `verification-before-completion` | 0 of 3 | 3 of 3 | 2 of 3 | 1 of 3 |
| `requesting-code-review` | 1 of 3 | 3 of 3 | 2.5 of 3 | 1.5 of 3 |
| `systematic-debugging` | 0 of 3 | 0 of 3 | 3 of 3 | 3 of 3 |

All 16 stays-quiet cases in pro-execution and pro-quality stayed at 0 fires in both arms.
The behavioral case for `verification-before-completion` went to 4 of 4 expectations with the skill against 1 of 4 without; before the new first rule it was 1 of 4 in both arms.
Keyless routing rank-1 rose from 75.9% to 78.5%.

What the runs taught:

- Naming the requests and saying the skill applies to pasted code made three of the four fire, as agent-skills found.
  For verification the trigger had to come first in the description ("Use when asked to confirm that work is done...").
- `systematic-debugging` did not fire after two rounds of wording; the model treats a pasted failing test with a clear clue as something to fix directly.
- `requesting-code-review` dispatches its reviewer subagent in 3 of 3 runs with the plugin and 0 of 3 without.
  The subagent tool is named `Agent` in run traces even where the tool list says `Task`, so a grader must match `Agent`; the first version matched `Task` and wrongly read 0.
- An `llm` grader reads only the final message unless it sets `focus: trace`; the TDD agent did write and fail the test first, but its final message showed the code first.
  `regex` graders do not take `focus`.
- A case that asks for real work needs the tools for it: the TDD case passes only with Write, Edit and Bash allowed (`--allow-tools Bash Write Edit`).
  The verification case also needs `--scaffold`.

## Credit

The tiers follow Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills) (MIT): its deterministic trigger evals, its behavioral runner with pressure cases and its `claude plugin eval` pairs.
No code or fixture is copied from it; the scripts here are written for this repo's `tests/` conventions.
