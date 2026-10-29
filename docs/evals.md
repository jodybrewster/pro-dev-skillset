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

## Coverage and the runner

Every plugin eval case declares what it covers in the `prompt.md` frontmatter: `tags: [<kind>:<name>, ...]`, where kind is `skill`, `command`, `agent` or `hook`.
A hook is named by its script stem, so `hook:plan-sync` is `scripts/plan-sync.py`.
A stays-quiet case prefixes the tag with `quiet:`, for example `quiet:command:spec`.
A quiet tag proves the component stays out of the way and does not count as coverage.

The `component-coverage` check in `tests/check.mjs` lists every skill, command, agent and hook in pro-ai-sdlc, pro-egm, pro-spdd, pro-speckit and pro-pdd.
It fails when a component has no case tagged for it, unless `tests/cases/components-uncovered.json` lists it as `<plugin>/<kind>:<name>` with a reason.
A listed entry that is now covered or no longer exists also fails, so the list only shrinks.

```bash
node tests/run-evals.mjs --sdlc                  # every workflow plugin that declares evals
node tests/run-evals.mjs pro-ai-sdlc --runs 1    # one plugin, one run per case
node tests/run-evals.mjs --sdlc --dry-run        # print the plan and uncovered components, spend nothing
node tests/check.mjs component-coverage          # the coverage check alone
```

The runner calls `claude plugin eval` once per plugin with `--no-publish --trust-plugin -j 4`, `--model sonnet` and `--runs 3` unless you pass others.
It adds `--scaffold` and `--allow-tools Bash Write Edit` only when a plugin has a case with a `scaffold_script` or one that allows a gated tool.
It stops before a plugin once the running total reaches `--max-cost-usd` (default 10) and gives each plugin the remaining budget as its own cap.
After each plugin it prints a table of component, case, passes with the plugin, passes without it and the delta.
A firing case shows `fired x/n` and has no without column.
Each run also writes its report under the plugin's `evals/results/`, which git ignores; the runner reads the full JSON from a temp file.
Expect about a dollar or two per plugin on Sonnet at three runs and more for the scaffolded workflow cases; pro-ai-sdlc and pro-egm together cost $6.22 on 2026-10-29.
On macOS the runner skips cases tagged `needs:git`, because the eval sandbox cannot run git there.
`--docker` runs everything in a Linux container built from `tests/docker/Dockerfile`, where those cases run too:

```bash
export ANTHROPIC_API_KEY=...   # the container uses an API key, not a Claude login
node tests/run-evals.mjs --sdlc --docker
```

The container runs with `--privileged` because the eval sandbox uses bubblewrap, which needs to create namespaces, and it points `TMPDIR` at the home folder because the sandbox mounts `/tmp` read-only.
`--include-git` still tries the git cases on macOS without Docker; they fail there.
Pin the model and note the Claude Code version whenever you quote numbers.

## Measured changes

### 2026-10-29: four discipline skills ([intent](../intent/2026-10-29-skill-firing/))

Sonnet pinned, Claude Code 2.1.312, 3 runs per case and arm.
"Before" is the old description on the sharpened case; "after" is the shipped description.
Reply is the share of runs whose reply graders passed, with the plugin and without it; for review it is the mean score of its two graders (the reviewer dispatch and the review content).

| Skill | Fired before | Fired after | Reply after, with | Reply after, without |
|---|---|---|---|---|
| `test-driven-development` | 0 of 3 | 3 of 3 | 3 of 3 | 0 of 3 |
| `verification-before-completion` | 0 of 3 | 3 of 3 | 2 of 3 | 1 of 3 |
| `requesting-code-review` | 1 of 3 | 3 of 3 | 83% | 50% |
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
  `regex` graders do not take `focus`; they read the trace with `target: trace`.
- A case that asks for real work needs the tools for it: the TDD case passes only with Write, Edit and Bash allowed (`--allow-tools Bash Write Edit`).
  The verification case also needs `--scaffold`.

### 2026-10-29: first baseline for pro-ai-sdlc and pro-egm ([intent](../intent/2026-10-29-sdlc-egm-evals/))

`node tests/run-evals.mjs pro-ai-sdlc pro-egm --runs 3`, Sonnet, Claude Code 2.1.312, macOS, $6.22.
"With" and "without" count runs where every scored grader passed; a hook or agent case has no meaningful without arm, since nothing else blocks the push or dispatches the agent.

| Component | Case | With | Without |
|---|---|---|---|
| `hook:production-gate` | `hook-production-gate` | 3 of 3 | 0 of 3 |
| `hook:protect-tests` | `hook-protect-tests` | 3 of 3 | 0 of 3 |
| `hook:plan-sync` | `hook-plan-sync` | 3 of 3 | 0 of 3 |
| `agent:verifier` | `verifier-after-build` | 3 of 3 | 0 of 3 |
| `agent:researcher` | `researcher-for-wide-question` | 0 of 3 | 0 of 3 |
| `command:review`, `agent:reviewer` | `review-finds-planted-bug` | 1 of 3 | 2 of 3 |
| `skill:egm-bridge` | `egm-bridge-fires` | 2 of 3 | 0 of 3 |
| `command:goldfish` | `goldfish-init` | 3 of 3 | 0 of 3 |
| `command:goldfish` | `goldfish-needs-egm` | 3 of 3 | 0 of 3 |
| `agent:goldfish-reviewer` | `goldfish-reviewer-read-only` | 2 of 3 | 0 of 3 |

Every stays-quiet case (`spec`, `review`, `intent`, `egm-bridge`) stayed quiet in 3 of 3 runs in both arms.

Findings:

- All three pro-ai-sdlc hooks load and fire in a real session; the hook tests only prove the scripts behave when called.
  In warn mode they announce and allow, so the cases grade that the hook fired, not that it blocked.
- `/review` with its reviewer agent found both the planted off-by-one and the `console.log` rule breach as blocking in 1 of 3 runs; plain Sonnet did in 2 of 3. The Linux run below shows this was the sandbox breaking its git lines.
- The main session answered the wide "walk me through every file" question inline in 3 of 3 runs and never used `researcher`.
- On macOS the eval sandbox cannot run `/usr/bin/git` (the xcrun shim cannot write its cache), so `spec-from-intent`, `plan-from-spec` and `execute-refuses-draft-plan` are tagged `needs:git` and the runner skips them there.
  They run under `--docker`; see the Linux run below.
- The subagent tool is named `Agent` in traces; a command fires as `Skill` with `{"skill":"<plugin>:<command>"}`.
- A `prompt.md` description containing `: ` must be quoted or the frontmatter fails to parse.

### 2026-10-29: the git cases on Linux

`node tests/run-evals.mjs pro-ai-sdlc --docker --runs 3`, Sonnet, Claude Code 2.1.312, Linux container, $3.89, then the spec case again at $0.55 after its grader fix.

| Component | Case | With | Without |
|---|---|---|---|
| `command:spec` | `spec-from-intent` | 3 of 3 | 0 of 3 |
| `command:plan` | `plan-from-spec` | 3 of 3 | 3 of 3 |
| `command:execute` | `execute-refuses-draft-plan` | 3 of 3 | 1 of 3 |
| `command:review`, `agent:reviewer` | `review-finds-planted-bug` | 3 of 3 | 3 of 3 |

The other pro-ai-sdlc rows matched the macOS baseline.

Findings:

- `/spec` loaded only after its context lines ended in `; true`: an `ls` of policy files the repo lacks exits non-zero and aborts the whole command, so before this fix `/spec` failed to load in any repo without all of `DESIGN.md`, `AGENTS.md`, `SECURITY.md` and the ADR folders. `/plan`, `/review` and `/adr` had the same pattern.
- The fixture repos had no git author, so `git config user.name` aborted the commands the same way; a real repo has one, so the scaffolds now set it.
- Both arms write a good spec; the plugin's difference is the template and the commit, so `spec-from-intent` also grades `git commit`.
- The spec judge (Haiku) failed sound specs that fixed UTC to avoid time zones or cited a `REVIEW.md` rule; the grader now says both are fine.
- The plan judge asked every step to cite R numbers, which `/plan` never asks for; it now checks that every requirement is cited somewhere and tied to a test.
- `/review` found both planted problems in 3 of 3 runs on Linux. The 1 of 3 on macOS came from its git context lines failing in the sandbox, not from the review.

## Credit

The tiers follow Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills) (MIT): its deterministic trigger evals, its behavioral runner with pressure cases and its `claude plugin eval` pairs.
No code or fixture is copied from it; the scripts here are written for this repo's `tests/` conventions.
