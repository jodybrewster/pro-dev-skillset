# Review

How pull requests are reviewed in this repo, by a person or by an agent (`/review`, the `reviewer` subagent).
Start from the change's brief: the `intent.md`, `spec.md` and `plan.md` under `intent/` that the PR points to.
A review informs a human decision and never approves or rejects by itself.

## Three passes

Go through the diff three times and label every finding with its pass.

1. Bugs: wrong logic, unhandled edge cases, regressions, error paths that go nowhere.
2. Security: injection, missing authentication or authorization checks, secrets or personal data landing in the diff or in logs, unsafe parsing, requests an attacker can steer.
3. Compliance: the diff does what the spec and plan say, follows the agent file and `DESIGN.md` when present, and any departure from the plan is written into plan.md in the same PR.

## Severity

A finding is Important when it breaks behavior, exposes data or violates a policy.
Everything about style, naming or formatting is a nit.
Report five nits at most and give a count for the rest.

## Leave out

- Generated output: <src/gen/, dist/, *.generated.*>.
- Whatever CI already checks: lint, types, formatting.
- Edits to test files in a fix PR are themselves an Important compliance finding, so do not review the tests as if they were expected to change.

## Learning from repeats

When the same kind of mistake is flagged a second time, add a line to the agent file's "Things Claude gets wrong" and say that you did.
If the change makes a line of the agent file stale, flag that too.

## Output format

List findings from most to least severe.
Each entry gives the pass, the severity, the file and line, a one-sentence claim and the concrete way it fails.
Close with a tally in this form:

```
important: <n>  nits: <n>  skipped: <n>
```
