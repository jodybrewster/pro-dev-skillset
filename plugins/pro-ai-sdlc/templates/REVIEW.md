# Review

How pull requests are reviewed in this repo, by a person or by an agent (`/review`, the `reviewer` subagent).
Start from the change's brief: the `intent.md`, `spec.md` and `plan.md` under `intent/` that the PR points to.
A review informs a human decision and never approves or rejects by itself.

## Three passes

Go through the diff three times and label every finding with its pass.

1. Bugs: wrong logic, unhandled edge cases, regressions, error paths that go nowhere.
2. Security: injection, missing authentication or authorization checks, secrets or personal data landing in the diff or in logs, unsafe parsing, requests an attacker can steer.
3. Compliance: the diff does what the spec and plan say, follows the agent file and `DESIGN.md` when present; any departure from the plan is written into plan.md in the same PR.

## What failure looks like here

Name two to four concrete failures that matter in this repo, for example <a wedged session, a leaked token, a migration that cannot be rolled back>.
The reviewer weighs these first.

## Severity

A finding is Important when it breaks behavior, exposes data or violates a policy.
Everything about style, naming or formatting is a nit.
Report five nits at most and give a count for the rest.

## Leave out

- Generated output: <src/gen/, dist/, *.generated.*>.
- Skip paths: <vendored code, build output, lockfiles>.
- Whatever CI already checks: lint, types, formatting.
- Edits to test files in a fix PR are themselves an Important compliance finding, so do not review the tests as if they were expected to change.

## Evidence

Every finding cites a file and line the reviewer opened and read.
A finding that rests on a guess from a name is dropped or counted under skipped.

## Pre-existing

A finding on a line or behavior the diff did not add or change is tagged Pre-existing.
List these apart from the others.
They never count toward Important and never block.

## Rounds

After the first full review, later rounds cover only the new commits.
A finding is never raised twice.
A class of bug is named once with every instance listed.
Pre-existing findings do not block.

## Learning from repeats

When the same kind of mistake is flagged a second time, add a line to the agent file's "Things Claude gets wrong" and say that you did.
If the change makes a line of the agent file stale, flag that too.

<!-- Design smells: uncomment this block to have the reviewer flag them as findings, not nits.

## Design smells

- A new conditional bolted onto an unrelated flow.
  Push the logic into its own helper, state or policy.
- Repeated conditionals on the same shape.
  They signal a missing model or dispatcher.
- Feature-specific logic leaking into a shared module.
- A near-duplicate of an existing canonical helper.
- Gratuitous `any`, casts or silent fallbacks that hide an unclear invariant.
- A refactor that relocates complexity without reducing the number of concepts a reader holds.
-->

<!-- Presumptive blockers: uncomment this block to have the reviewer propose the simpler design for each.

## Presumptive blockers

Escalate to Important only when the change makes structure worse.

- A refactor that relocates complexity instead of reducing it.
- A change that pushes a file past a healthy size with no decomposition.
- Feature logic added to a shared module.
- A near-duplicate of an existing canonical helper.
- A silent fallback that hides an unclear invariant.
-->

## Output format

Open the report with this summary line:

```
important: <n>  nits: <n>  pre-existing: <n>  skipped: <n>
```

When important and nits are both zero the next line is "Nothing to fix."
Then list findings from most to least severe.
Each entry gives the pass, the severity, the file and line, a one-sentence claim and the concrete way it fails.
List Pre-existing findings last in their own group.

---

_Adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) - MIT License, Copyright (c) 2025 Addy Osmani. See original repository for full license text._
