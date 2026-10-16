# The AI-native SDLC in one page

`/kaizen` reads this summary when the planning repo keeps no copy of the AI-native SDLC playbook under `playbook/`.
It is a paraphrase for judging coverage, not the playbook itself.
Each stage ends by committing an artifact the next stage reads: `intent.md`, `spec.md`, `plan.md`, the diff and its tests, the PR with its review findings and the incident record.
That chain of commits is also the audit trail.

| Stage | Play | What is enforced | Evidence | Measure (leading, then lagging) |
|---|---|---|---|---|
| 1 Plan | Capture intent once, in the asker's words, as `intent.md` | An idea is not planned until its intent is committed | The committed `intent.md` with author, time and history; the accept or close decision as a merge or review | Time from first conversation to committed intent; share of intents accepted into design and intent edits after the spec lands |
| 2 Design | Write `spec.md` in one session with the agent, with policy encoded as skills | Policy is applied while the spec is written; concerns are flagged to their owners | `spec.md`, the prompt and the skill versions in git; the product owner's sign-off | Time from intent commit to spec commit; spec commits dated after the first `plan.md` |
| 3 Build | Plan mode first, `plan.md` committed before code | No edits until the plan is accepted | `plan.md` and its revisions, with who accepted it | Changes merged from the first pass, time from plan to merged PR; rework cycles and how often the diff still matches the plan |
| 3 Build | CLAUDE.md as versioned team knowledge, with a verify block and a mistakes list | Conventions reach every session; changes go through PR review | CLAUDE.md history | Repeated mistakes CLAUDE.md should have caught; time to first merged PR for a newcomer |
| 3 Build | Skills as policy, hooks behind the policies that must always hold | A skill advises; a hook blocks | Skill folder PRs, session traces, hook decisions | Time from policy change to skill merge; review findings citing the policy, falling toward zero |
| 3 Build | Parallel sessions in worktrees, a verifier subagent before done | Repo hooks and permissions apply to every session | Session logs attributed to the engineer | Concurrent sessions while review quality holds; changes merged per week against rework |
| 4 Test | A feedback loop: verify before done, pasted output, no test edits during a fix | Verification before a task is reported done; the test-edit block during a fix, as hooks | The literal toolchain output in the transcript and the PR check run | First-pass CI success for agent changes; review time per PR and change failure rate |
| 4 Test | Evals for agent configuration, run in CI | A pass-rate threshold as a merge check | Logged eval runs, comparable over time | Pass rate over time and time from incident to permanent eval; regressions caught in CI against those found in production |
| 5 Deploy | Agentic review against `REVIEW.md`, humans on critical code | The author agent cannot approve; branch protection requires a human | Findings, fixes and approvals in the PR history | Time to first review, comments resolved without a human edit; defects caught before merge against those that escaped |
| 5 Deploy | Hooks as approval gates, managed settings as the floor | Gates hold on every action, with a required minimum version | Every hook decision logged with a timestamp and verdict | Time waiting at each gate; gate violations reaching production before and after |
| 5 Deploy | Headless Claude in CI/CD, sandboxed, rollback rehearsed | The agent acts up to the production gate and never past it | Pipeline logs under the agent's own identity | Pipeline failures triaged without paging a human; DORA measures |
| 6 Maintain | Control bands on production and process metrics; a breach writes the next `intent.md` | Tier boundaries from versioned config; no production access by default | Breach log with timestamp and tier; the triage queue | Time from breach to intent in the queue; share of findings that become merged fixes and repeat incidents of the same class |

Governance questions to ask of every stage: what is enforced, what the evidence is, where it is logged and who approves.
A stage whose only answer is a sentence in CLAUDE.md, with nothing deterministic behind it, is a gap.
