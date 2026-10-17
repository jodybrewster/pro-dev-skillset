# Review

How a pull request in this repo is reviewed, by a person or by an agent (`/review`, the `reviewer` subagent).
Read the change's brief first: the `intent.md`, `spec.md` and `plan.md` under `intent/` that the PR names.
Findings inform a human; they never approve or block on their own.

## Passes

Run three passes and tag each finding with its pass.

- Bugs: logic errors, broken edge cases, subtle regressions, unhandled failure paths.
- Security: injection, authentication and authorization gaps, personal data in logs or error messages, secrets in the diff, unsafe deserialization, SSRF.
- Compliance: the change matches its spec and plan, follows the repo's agent file (`CLAUDE.md` or `AGENTS.md`) and `DESIGN.md` if present.
  Flag a diff that departs from the plan without plan.md being updated in the same PR.

## What Important means here

Reserve Important for findings that would break behavior, leak data or breach a policy.
Style, naming and formatting are nits.

## Cap the nits

Report at most five nits per review and summarize the rest as a count.

## Do not report

- Generated files under <src/gen/, dist/, *.generated.*>.
- Anything CI already enforces (lint, type-check, formatting).
- Test files in a fix PR are not to be changed; if they are, that is an Important compliance finding.

## Feedback into the agent file

If a finding is the second time this class of mistake has been flagged in this repo, add the correction to the agent file under "Things Claude gets wrong" and say so.
Also flag when a change has made a line of the agent file outdated.

## Output

Rank findings most severe first.
For each: pass, severity (Important or nit), file and line, a one-sentence claim and a concrete failure scenario.
End with a machine-readable tally:

```
important: <n>  nits: <n>  skipped: <n>
```
