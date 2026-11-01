# Brainstorm: pro-ship scope

Running notes from the brainstorm on 2026-10-28, after [intent.md](intent.md) was committed.
Nothing here is decided until it moves into an intent or a spec.
Each section says whether it is a recommendation, a proposal or still open.
The ranked list across the whole marketplace, which these features feed, is [docs/roadmap.md](../../docs/roadmap.md).

## Features at a glance

Every feature proposed so far, grouped by the intent it would land in, each linked to its section.

### Intent A: the PR gate (first)

1. `/pro-ship:pr-check`: runs build, lint, typecheck and unit tests, plus any `check:*` scripts that installed skills add, then dispatches the reviewers and writes a stamp for HEAD. [The pre-PR gate](#the-pre-pr-gate-proposal)
2. A hook on `gh pr create` that only checks the stamp and denies once when it is missing; replaces pro-quality's `pr-quality-gate.py`, which never fires. [Shape](#shape)
3. `code-reviewer`, a detailed reviewer agent in pro-quality: correctness, tests, design, performance and compliance, with file and line evidence. [A detailed code reviewer](#a-detailed-code-reviewer)
4. Fresh context for every reviewer through a fixed four-field handoff, held by a check in `tests/check.mjs`. [Fresh context](#fresh-context-is-a-hard-requirement-jody-2026-10-28)
5. Codex as a second reviewer running the same agent; findings both models raise count as stronger. [Codex](#codex-as-a-second-reviewer-jody-2026-10-28)
6. The security review joins the gate: pro-security's push gate accepts the stamp so it runs once per PR. [Shape](#shape)
7. A risk classifier that sorts each diff into low, medium or high and sets the review depth and approval. [Risk gate](#risk-based-approval-gate-with-a-classifier)
8. Approval tiers at one-person scale: low merges on green, medium and high need Jody, an agent's approval never counts and approval covers one commit. [Approval](#approval-at-one-person-scale)
9. Round limits for agent loops: three rounds, then only new commits, no repeated findings, Pre-existing tag. [Convergence](#convergence-the-lesson-that-matters-most-for-agents)
10. REVIEW.md as the only project review policy, with an improved template. [REVIEW.md](#reviewmd-is-the-reviewers-only-project-policy), [template](#reviewmd-template-changes)
11. Installed skills bring runnable checks, not review checklists. [Runnable checks](#installable-skills-carry-build-knowledge-and-runnable-checks)
12. A test set for the reviewer built from this repo's past bugs, rerun when the reviewer changes. [Evals](#improving-the-reviewer-past-bugs-become-evals)
13. Settings in a REVIEW.md block so the same gate scales from solo to a team; the reviewers also run in GitHub Actions. [Scaling](#built-to-scale-up-jody-2026-10-28)

### Intent C: docs and architecture review

14. A required set of documents that depends on the project: README, CLAUDE.md, AGENTS.md, REVIEW.md and ADRs always; ARCHITECTURE, PRODUCT and DESIGN when they apply. [Doc set](#the-doc-set-proposal)
15. New templates for README, ARCHITECTURE and PRODUCT; `/pro-dev install` writes missing documents from the code. [Doc set](#the-doc-set-proposal)
16. pr-check lists missing documents and the reviewer flags lines a diff makes untrue. [Doc set](#the-doc-set-proposal)
17. An architecture review with twelve-factor as its checklist: challenges a spec or plan, reviews high-risk diffs that change the architecture and audits a whole repo on demand; ARCHITECTURE.md records how the app meets each factor. [Architecture review](#twelve-factor-is-part-of-the-architecture-review-jody-2026-10-28)

### Intent B: the rest of pro-ship v0.1

18. `/pro-ship:ship`, the preflight report (Blocking, Should-fix, OK), with no new release hook. [Release gate](#release-gate-no-new-hook)
19. `/pro-ship:pipeline`, which generates or audits GitHub Actions, including the CI version of the gate. See [intent.md](intent.md).
20. `/pro-ship:repo-hygiene`, which writes rulesets, CODEOWNERS and Dependabot from the REVIEW.md settings; recommended over `release` for v0.1. [Scope pushback](#scope-pushback-still-open), [Scaling](#built-to-scale-up-jody-2026-10-28)

### Later

`release`, two-person approval, a merge queue, feature flags, staged releases, rollback and tracking revert rate and review rounds per PR. [Scaling](#built-to-scale-up-jody-2026-10-28), [intent.md](intent.md)

## Jody's asks in this brainstorm

In the order he raised them on 2026-10-28, in his words, with where each is answered below.

1. "I would like to add buildchecks, linting checks, unit testing, typechecking, using ai agents to check code with a fresh context window before a pull request at a minimum maybe at a hook?" See "The pre-PR gate".
2. "maybe a detailed code reviewer? I know we have a security review" See "A detailed code reviewer".
3. "maybe have a risk based approval gate with a classifier?" See "Risk-based approval gate with a classifier".
4. "I need the code reviewer to have fresh context as well" See "Fresh context is a hard requirement".
5. "it needs to look at a REVIEW.md file for project specific reviewing, installable skills should bring in more runnable coding concepts not review work" See "Where review rules live".
6. "maybe use codex for code review as well" See "Codex as a second reviewer".
7. The article https://claude.dev/blog/solving-code-review-at-anthropic/: "I want to make sure that we're applying the phases most importantly to what we're doing here." See "Mapped against Solving code review at Anthropic".
8. "I need my plugin repo to scale up if needed, not anthropic scale but yes, it needs to scale up" See "Built to scale up".
9. "make sure that each project has the required documentation. REVIEW.md, ARCHITECTURE.md, CLAUDE.md, README.md, PRODUCT.md, DESIGN.md, etc" See "Every project has its required documents".
10. "ok so 12 factor apps should be a part of the architecture review" See "Twelve-factor is part of the architecture review".
11. On 2026-10-29: "can we look at the ../agent-skills directory and do a deep dive and tell me what we're missing compared to what we have?" See the ranked list and the agent-skills comparison in [docs/roadmap.md](../../docs/roadmap.md).

12. On 2026-10-31, for `/ship`: "yes, design for multiple scenarios, we'll also use it in mieruka". See [intent/2026-10-31-ship-preflight](../2026-10-31-ship-preflight/intent.md).

Earlier the same day, already in [intent.md](intent.md): GitHub practices and portable twelve-factor apps.

## Answers to the intent's open questions (recommendations)

### Release gate: no new hook

pro-ai-sdlc's `production-gate` already flags `gh release create`, pushes to main and production deploys.
pro-legal's `release-gate` already catches `git tag` when the diff touches legal surface.
A third hook on the same commands is the double prompt the intent wants to avoid.
Instead `/pro-ship:ship` writes `.pro-dev/ship/preflight.md` stamped with the HEAD sha.
`production-gate` then adds one line to its existing warning when that file is missing or older than HEAD.
pro-legal's gate stays as it is because it is a different signal.

### Skills, not commands

pro-ship uses `skills/`, all model-invocable except `release`.
`/ship` has to chain `twelve-factor` and `pipeline`.
The EGM lesson in `CLAUDE.md` shows a `disable-model-invocation` skill cannot be chained.
Skills also load under Codex, so parity comes for free.

### Join pro-dev-starter when v0.1 lands, not now

Today pro-ship holds only the opt-in Vercel bridge, so adding it to every install gives nothing.

### addyosmani forks as sidecars

`shipping-and-launch` becomes reference material under `ship` and `ci-cd-and-automation` under `pipeline`.
Neither becomes a standalone skill, which would make routing ambiguous.

## Scope pushback (still open)

`twelve-factor` needs a "platform-owned" status next to pass, partial and fail.
On Next.js deployed to Vercel, port binding, concurrency, disposability and admin processes mostly belong to the platform.
Pass or fail on them is noise.

`release` may be the wrong fourth v0.1 piece.
Most of Jody's apps deploy on merge, so semver releases matter less.
release-please setup also overlaps `pipeline generate`.
Jody's own ask was GitHub practices (rulesets, CODEOWNERS, Dependabot, branch and PR hygiene), which is `repo-hygiene`, deferred by the research.
Swapping them departs from the research's priority order, so this is Jody's call.

## The pre-PR gate (proposal)

Jody's ask: build, lint, typecheck, unit tests and fresh-context AI review before a pull request, at a minimum, maybe as a hook.

### What exists and why it never runs

pro-quality's `scripts/pr-quality-gate.py` runs npm `lint` and `test` and tells the session to dispatch a code reviewer.
It is wired to `mcp__github__create_pull_request`, which Jody never uses (he uses `gh pr create`), so it has never fired.
It is PostToolUse, so it runs after the PR exists.
It has no build or typecheck step and no Python support.
Replace it rather than add beside it.

### Shape

`/pro-ship:pr-check` (name open) does the work:

1. Finds the commands the way the `verifier` agent does: a verify command named in `CLAUDE.md` or `AGENTS.md`, then `package.json` scripts (`build`, `lint`, `typecheck` or `tsc --noEmit`, `test`), then Python (`ruff`, `mypy` or `pyright`, `pytest`), then Makefile targets.
2. Runs build, lint, typecheck and unit tests.
3. If they pass, dispatches the reviewers (see below) in parallel with fresh context.
4. Writes `.pro-dev/ship/pr-check.json` stamped with the HEAD sha, the results and the risk tier.

A `PreToolUse` hook on `gh pr create` only checks the stamp.
No passing stamp for HEAD means deny once with a reason that says to run `/pro-ship:pr-check`, the same deny-once-per-diff pattern as pro-security's `push-gate.py`.
The hook never runs builds or tests itself, because hook timeouts would hang the session.
It follows `~/.claude/hooks/mode`.

The same checks also run in GitHub Actions as required status checks, generated by `pipeline`.
The local hook is a guardrail and the ruleset is the enforcement.

### A detailed code reviewer

Neither existing reviewer is a detailed one.
`pro-ai-sdlc:reviewer` is a narrow policy gate (bugs, security, compliance against REVIEW.md) and drops anything without a failure scenario.
pro-quality's `requesting-code-review/code-reviewer.md` is closer, but it is a prompt template for a general-purpose agent with no agent file, model or stable output.

Proposal: a new `code-reviewer` agent in pro-quality, Opus at high effort, read-only, fresh context.
It gets the diff range, the brief (intent, spec, plan) and REVIEW.md and nothing from the session.
Security is out of its scope because pro-security covers it.
Lenses in order: correctness, tests (cover the change, right-sized, assert real behavior, edge cases), design (fit with surrounding code, needless abstraction, duplicated helpers, API shape), performance (N+1, unbounded loops, heavy imports) and compliance (matches the plan, follows the agent file and REVIEW.md).
Each finding gives file and line, a severity (Important or nit) and a failure scenario.
Nits are capped.

#### Fresh context is a hard requirement (Jody, 2026-10-28)

Both reviewers start with no knowledge of the session that wrote the code.
A new subagent already starts with an empty context, but the dispatch prompt is where the author's reasoning leaks in ("I changed X because Y", a summary of what was built).
So the handoff is a fixed template with four fields and nothing else:

1. The base and head sha of the diff.
2. Paths to the brief: `intent.md`, `spec.md`, `plan.md`.
3. The path to REVIEW.md and the agent file.
4. The risk tier and the signals that set it.

The reviewer reads the diff and the code itself.
No author-written description, no PR body, no session summary, no earlier review findings on a re-run and never a forked agent, which inherits the whole session.
The brief is allowed because it states what was asked for, not how the author reasoned.
pro-quality's current `code-reviewer.md` template breaks this rule with its `{DESCRIPTION}` field, which is one more reason to replace it.

How it is held: `tests/check.mjs` gets a contract check that the pr-check handoff template has exactly those fields.
The agent's own prompt also says to ignore any narrative in its handoff and review only the diff against the brief.

The strongest form is a separate process: `claude -p` with the reviewer agent and the four fields, sharing nothing with the session at all.
That is also how the same review would run in GitHub Actions, so the local and CI reviews behave alike.
Open: whether v0.1 uses a subagent with the fixed handoff (simpler, shows progress in the session) or `claude -p` from the start.

#### Codex as a second reviewer (Jody, 2026-10-28)

A second review by Codex gives a different model family's read on the same diff, which catches what one model's blind spots miss.
It is fresh context by construction because it runs as a separate process.

- Same reviewer on both sides: Codex parity already requires a `.toml` for every agent, so `code-reviewer` gets a Codex counterpart with the same lenses, the same REVIEW.md and the same four-field handoff.
- How it runs: pr-check calls the Codex CLI non-interactively (`codex exec` with the handoff; check at spec time whether a dedicated review subcommand fits better) in parallel with the Claude reviewers.
- When: high-risk tier by default, configurable in REVIEW.md or `.claude/pro-dev.json`, because it adds time and usage.
- Merging: pr-check lists findings per reviewer, marks a finding both raised as higher confidence and shows disagreements as they are, never settled by one side.
- Optional engine: Codex needs its own install and login, so it is an opt-in row in the engine registry that `/pro-dev install` asks about.
  When the CLI is missing or not logged in, pr-check says the Codex review was skipped and carries on.
- Alternative on GitHub: Codex's own PR review integration, if Jody's plan includes it, reviews in CI without the local CLI; it would read the same REVIEW.md through AGENTS.md.

The Codex CLI was not on `PATH` in the shell that wrote these notes, although `~/.codex/` exists, so the spec has to find out how it is installed.

pr-check dispatches `pro-quality:code-reviewer` and `pro-security:security-architect` (diff mode) in parallel.
The stamp records both.
pro-security's push gate accepts it so one security review runs per PR, scoped to the diff (Jody, 2026-10-25).
`pro-ai-sdlc:reviewer` stays as `/review`'s policy gate for now.

Optional later: a skeptic pass where a second agent tries to refute each Important finding.
It cuts false positives and roughly doubles the cost per PR, so it waits until the reviewer proves noisy.

### Risk-based approval gate with a classifier

Jody's ask, same day: a risk-based approval gate with a classifier.

The classifier sorts the diff into low, medium or high and the tier decides what the gate demands.
It is deterministic first: the hook must be fast and explainable.
pro-security's `security_surface.py` and pro-legal's `legal_surface.py` already classify diffs this way and can be reused as signals.

Signals that raise risk:

- Paths: auth, payments, database migrations and schema, `.github/workflows/`, infrastructure as code, hook scripts, env and config loading.
- Security or legal surface hits from the existing classifiers.
- Dependency changes (manifests, not lockfile churn alone).
- Deleted or weakened tests, or code changed with no test change.
- Size: files and lines touched plus how many top-level areas.
- The declared risk in the intent's front matter (`risk: low | medium | high`); a diff that classifies higher than its intent declared is itself a finding.

What each tier demands:

| Tier | Checks | Reviewers | Approval |
|---|---|---|---|
| low (docs, tests only, small and isolated) | build, lint, typecheck, tests | none, or code-reviewer on Sonnet | none |
| medium | all checks | code-reviewer | none beyond green checks |
| high | all checks | code-reviewer and security-architect | a human: the hook returns `ask` locally; the PR gets a `risk:high` label that a ruleset or CODEOWNERS turns into a required review |

The tiers also control cost: low-risk PRs skip the Opus reviewer.
The classifier prints the signals that set the tier, so a wrong tier can be argued with.
An LLM classifier (Haiku) can break ties inside the skill but never inside the hook.

Open: whether a person can override the tier down and where that override is recorded (PR body or stamp).
Open: whether the tier table lives in REVIEW.md per repo, with the table above as the default.

## Where review rules live (Jody, 2026-10-28)

Jody's rule: the reviewer looks at the project's REVIEW.md for project-specific review.
Installable skills bring in runnable coding concepts, not review work.

### REVIEW.md is the reviewer's only project policy

The code reviewer and the risk tiers read the repo's `REVIEW.md` and nothing else for project rules.
The agent's own prompt holds only the generic lenses (correctness, tests, design, performance, compliance); everything specific to a project, such as its laws, its Important bar, its nit cap and its do-not-report list, comes from REVIEW.md.
REVIEW.md can also carry the tier table and the risky paths for the classifier, with the defaults above used when it does not.
A repo with no REVIEW.md: pr-check says so in its report and points at `/sdlc-init`, which adds one from the pro-ai-sdlc template.
The review still runs with the generic lenses.

### Installable skills carry build knowledge and runnable checks

Stack plugins and bridges (pro-nextjs, pro-astro, pro-design, the Vercel and React bridges) teach how to write the code: patterns, recipes and conventions used while building.
They do not add checklists to the reviewer.
The reviewer does not load installed skills.
Where a skill's rule can be checked mechanically, the skill brings it as something runnable: a lint rule, a script, a test or a codemod.
pr-check's deterministic stage runs those alongside build, lint, typecheck and tests.
The pinned web-design-guidelines lint from PR 68 is the existing example of this shape.

Open: how a plugin declares its runnable checks so pr-check finds them (a field in its registry row, a `checks/` folder or a script name in `package.json` that the skill adds).
Open: whether a stack plugin may offer suggested REVIEW.md rows that `/sdlc-init` copies in, so the project owns them from then on.
Follow-up, not this intent: several installed skills are review work today (`interface-review`, `screen-critique`, `spdd-code-review-lead` and the review parts of the best-practices skills); audit them against this rule.

## Mapped against "Solving code review at Anthropic"

Source: https://claude.dev/blog/solving-code-review-at-anthropic/ (Jody, 2026-10-28).
Its goal: the least human review time that does not raise reverts or incidents.
Jody's scale is one person directing agents across several repos, so each stage below says what we keep, what we shrink and what we skip.

| Article stage | What it does there | For us |
|---|---|---|
| 0. Before the PR | Claude runs tests, build and lint and shows the output; a fresh-context subagent reviews the diff; skills hunt bugs, simplify and check end-to-end behavior | Keep, this is `pr-check`. Reuse pro-ai-sdlc's `simplifier` and `verifier` agents as the simplify and end-to-end steps instead of writing new ones |
| 1. Project rules | Short `CLAUDE.md`; a `REVIEW.md` per area; recurring findings fixed at the source in a skill, a lint rule or these files | Keep. Matches the REVIEW.md and runnable-checks rules above. Improve the REVIEW.md template (below) |
| 2. AI review on every PR | Parallel bug hunters, a separate group votes and only agreed findings post; tags Important, Nit and Pre-existing; depth Quick, Standard or Deep per repo; every finding answered | Keep, shrunk. Claude plus Codex are two independent hunters and agreement stands in for the vote. Risk tier sets depth. Add the Pre-existing tag |
| 3. Security review | Separate pass that can block | Already have it: pro-security's push gate, sharing the pr-check stamp |
| 4. Required CI | Lint, types, tests, build; PR template asks how it was tested and how to undo it | Keep. `pipeline` generates the workflow; pr-check drafts the Testing, Risk and How to revert sections of the PR body for Jody to sign off |
| 5. Risk-scaled human approval | Classifier picks the tier from the change, not the author; sensitive paths and CI workflow files always need a person; an agent's approval never counts; approval covers one commit | Keep the rules, shrink the numbers (below) |
| 6. Merge queue, flags, staged release | Checks rerun against main with the change applied; flags; `latest` before `stable` | Mostly skip. Cheap equivalent: a ruleset that requires branches to be up to date before merge, which also catches the stacked version-bump conflicts this repo hits |
| 7. Detection and rollback | Flags off without a deploy; on-call; incident reviews ask which layer should have caught it | Later (`rollback` in v0.2). Keep the question "which layer should have caught it" for every revert |

### Approval at one-person scale

The article's tiers are none, one person and two people.
Jody is the only person, so two people cannot happen and the tiers become:

- Low: no human approval once checks, review and security are green; `/merge-pr` may merge on its own.
- Medium: Jody approves; the article counts the person directing the agent as that reviewer. Approval means reading the evidence (check output, findings, risk signals), so `/merge-pr` shows it and asks.
- High: Jody approves after the deep review (Claude and Codex both, plus security); the second human becomes a second model plus the evidence. Sensitive paths and any `.github/workflows/` file land here or in medium at least, always with Jody.

Rules taken as they are: the change sets the tier and the author's declared `risk:` can only raise it; an agent's approval never counts as Jody's; an approval covers one HEAD sha and a new commit needs it again.

### Convergence, the lesson that matters most for agents

The article's worst case was an agent author and an agent reviewer going more than fifty rounds overnight.
Noise costs more with agent authors because each nit becomes another commit and another round.
`/pr-babysit` is exactly that loop, so:

- Cap review rounds at three; after that pr-check stops and asks Jody to reconsider the approach.
- After the first full review, later rounds review only the new commits.
- Never repeat a finding already raised. The reviewer stays fresh; pr-check dedupes its output against the earlier stamp afterwards, so the reviewer never sees earlier findings.
- When a finding is a class of bug, say so, so every instance is fixed in one round.
- Tag Pre-existing findings so old bugs do not block a PR that did not cause them (59% of what their reviewer kept flagging was old code).

### REVIEW.md template changes

From the article's description of a good REVIEW.md, add to pro-ai-sdlc's template: what failure looks like in this repo, paths to skip, evidence as file and line rather than a guess from a name, the Pre-existing tag, a summary that starts with the count and says plainly when there is nothing to fix and the optional risk-tier table and sensitive paths.
The template already caps nits and has a do-not-report list.

### Improving the reviewer: past bugs become evals

The article runs its reviewer daily against PRs that caused incidents and rescores whenever the reviewer's prompt, tools or model change.
This repo already has the incident list: "Things Claude gets wrong" in `CLAUDE.md` (hook files that never loaded, the `worktrunk` dependency, the Stop hook without `stop_hook_active`, the EGM skill call).
Turn the commits that introduced those into a small eval set beside `tests/eval.mjs` and rescore whenever `code-reviewer` changes.
Also run it against a few known-clean PRs to measure noise.

### Built to scale up (Jody, 2026-10-28)

Jody's rule: the plugins must scale up when needed, not to Anthropic's size but past one person.
So nothing above is hard-coded to one person.
The gate is one mechanism with dials.
Solo is just the starting setting.

The dials live in the repo's REVIEW.md, in a short machine-readable block that the local hook, pr-check and the CI workflow all read.
One file means the local gate and CI never disagree.
A policy change is then itself a reviewed PR.
A repo with no block gets the solo defaults.

| Dial | Solo (default) | Small team | Team |
|---|---|---|---|
| Human approvals per tier (low, medium, high) | 0, 1, 1 (the director counts) | 0, 1, 1 | 0, 1, 2 |
| Who approves | the person directing the agent | CODEOWNERS for the path | CODEOWNERS; high needs an owner plus one other |
| Lighter path for trusted authors | off (one author) | listed authors or teams | listed authors or teams |
| Review depth per tier | Claude on medium, Claude plus Codex on high | same | same, Codex on medium too if wanted |
| Where approval is enforced | locally (hook asks, `/merge-pr` asks) | GitHub rulesets and required reviews; the hook is a nudge | GitHub only; the hook is a nudge |
| Merge queue | off; require branches up to date | off or on | on |
| Round cap | 3 | 3 | 3 |

Two things change as it scales and the design has to allow for them now:

- Enforcement moves from the local hook to GitHub.
  A local hook binds only the person whose session runs it, so once there is a second person, rulesets, required checks and CODEOWNERS do the enforcing and the hook only saves a round trip.
  `repo-hygiene` (or `pipeline`) writes those rulesets from the same REVIEW.md block, so turning the dial up is one edit plus one command.
- The review has to run without the author's machine.
  The same `code-reviewer` (Claude) and its Codex twin run in GitHub Actions on every PR with the same four-field handoff, so a teammate's PR gets the same review as Jody's.
  This is why the reviewer must never depend on session state or locally installed skills.

Off at solo, ready to turn on later: two-person approval, trusted-author paths, merge queue, feature flags, staged releases, nightly reviews of existing code and tracking revert rate and review rounds per PR (the article's guardrail metrics, with DORA in v0.4).
On-call and human-time dashboards stay out of scope.

Open: the format of the REVIEW.md block (a fenced YAML block under a fixed heading is the simplest that people and scripts can both read).

## Every project has its required documents (Jody, 2026-10-28)

Jody's ask: each project has the documents it needs: REVIEW.md, ARCHITECTURE.md, CLAUDE.md, README.md, PRODUCT.md, DESIGN.md and so on.
They matter more now because the reviewer, the classifier and CI all read them.

### What exists today

- `/pro-dev install` (pro-core) drafts `CLAUDE.md` or `AGENTS.md` with set sections and writes `REVIEW.md` from pro-ai-sdlc's template when missing.
- pro-quality's `docs-before-push.py` blocks a push when code changed but an existing key doc (README, AGENTS, CLAUDE, ARCHITECTURE, PRODUCT, DESIGN) did not; it never asks for a missing one.
- impeccable reads `PRODUCT.md` and `DESIGN.md` and its documenter writes `DESIGN.md` from a finished build.
- pro-ai-sdlc has templates only for intent, spec, plan, ADR and REVIEW.

Nothing says which documents a project must have, there are no templates for README, ARCHITECTURE or PRODUCT and nothing checks that they exist.
This repo itself has no ARCHITECTURE.md or PRODUCT.md (`docs/overview.md` plays part of both).

### The doc set (proposal)

Required depends on what the project is, so the set is conditional:

| Document | Required when | Holds |
|---|---|---|
| README.md | always | what it is, how to install, run and test it |
| CLAUDE.md | always | commands, verification, conventions, how work flows, things Claude gets wrong (kept short, points at the rest) |
| AGENTS.md | always | Codex's copy of CLAUDE.md; the Codex reviewer reads project rules through it |
| REVIEW.md | always | review policy plus the scaling block |
| ARCHITECTURE.md | more than one module, service or deployable | the parts, how data and requests flow, the boundaries and where each lives |
| PRODUCT.md | it has users (apps, sites) | who it is for, the problems, goals and non-goals; in the shape impeccable reads |
| DESIGN.md | it has a UI | the design system as built; in the shape impeccable's documenter writes |
| docs/decisions/ | always (may start empty) | ADRs |
| SECURITY.md, CONTRIBUTING.md, CODEOWNERS | at the small-team setting and up | written by `repo-hygiene` |

How each piece is covered:

- Templates: pro-ai-sdlc gains README, ARCHITECTURE and PRODUCT templates beside REVIEW; PRODUCT and DESIGN follow impeccable's formats so the two never disagree.
- Scaffolding: `/pro-dev install` works out which rows apply from the inspection and creates the missing ones.
  Content comes from the code (pro-quality's `documentation-engineer` reads the repo), never placeholder prose, with an angle-bracket placeholder only where the code cannot say.
- Existence check: pr-check's deterministic stage lists missing required docs.
  At the solo setting a missing doc is Should-fix; teams can make it Blocking through the REVIEW.md block.
- Freshness: `docs-before-push.py` keeps doing it; the reviewer also flags a line in CLAUDE.md or ARCHITECTURE.md that the diff makes untrue (the article's stage 1).
- The required set and any extra documents a repo wants live in the REVIEW.md block, so it scales with the other dials.

Open: whether PRODUCT.md applies to libraries and plugin repos like this one (a short "who uses this and why" may still earn its place).
Open: whether AGENTS.md stays a full copy of CLAUDE.md, as in this repo, or becomes a pointer to it; a copy can drift, so a copy needs a check that the two match.

This touches pro-core (`/pro-dev install`), pro-ai-sdlc (templates) and pro-quality (`documentation-engineer`), so it is its own intent, C; pr-check only consumes it.

## Twelve-factor is part of the architecture review (Jody, 2026-10-28)

Jody's call: twelve-factor belongs in the architecture review, not in a standalone pro-ship audit.
This replaces `/pro-ship:twelve-factor` from the research and intent.md.

### There is no architecture review today

pro-security has `security-architect`, which challenges a plan before code exists and reviews a diff before push.
Nothing does the same for architecture; the code reviewer's design lens covers fit with surrounding code, not the shape of the system.
Jody asked on 2026-10-25 for technical and solution architects in the starter, so this fills a known gap.

### Shape (proposal)

An `architect` agent and an `architecture-review` skill that mirror `security-architect`, with the twelve factors plus API-first, telemetry and authN/Z as the checklist, one row per factor with status (pass, partial, fail, platform-owned), file and line evidence and the fix.
The Node/Next.js and Python checks from the research become a sidecar of the skill.

Three modes, each when the fix is cheapest:

- Plan mode, at `/spec` and `/plan`: challenges the design before code exists (new backing service, new config, new deployable, state kept in a process).
- Diff mode, from pr-check: only when the risk classifier sees an architecture signal (a new deployable, Dockerfile or infrastructure change, a new env var or backing service, a new process type); otherwise it stays out of the PR so it does not add noise.
- Audit mode, on demand: the whole repo against every factor, the old `/pro-ship:twelve-factor`.

It follows the same rules as the other reviewers: fresh context, the four-field handoff, REVIEW.md for project rules and its findings tagged Important, nit or Pre-existing.

### Ties to the rest

- ARCHITECTURE.md gains a twelve-factor section: how this app meets each factor and which ones the platform owns.
  The audit writes it the first time and the reviewer flags a diff that makes it untrue, so the doc and the review share one source.
- Mechanical factors run in pr-check, per Jody's runnable-checks rule: a committed lockfile (dependencies), config read from env with an `.env.example` and no hard-coded URLs or secrets (config), logs to stdout (logs), one build command (build, release, run).
  Judgment factors (backing services, processes, disposability, dev/prod parity) go to the architect.
- The classifier's architecture signals are a new row in its risky-path list.

Open: which plugin owns the architect.
Recommendation: pro-quality, beside `code-reviewer`, since it is a review lens and pro-quality is in the starter; pro-ship only calls it from `/ship`.

## Proposed split

The scope now touches pro-ship, pro-quality (new agent and its Codex `.toml`, removing `pr-quality-gate.py`) and pro-security (push gate accepts the stamp).
Recommendation: three intents.

- A, the PR gate: `pr-check`, its hook, the risk classifier, `code-reviewer` and the shared stamp with the push gate.
  Used on every PR, so it goes first.
- C, docs and architecture review: templates, `/pro-dev install` scaffolding from the code, the existence check pr-check runs and the architect with twelve-factor as its checklist.
- B, the rest of pro-ship v0.1: `ship`, `pipeline` and `repo-hygiene` (`twelve-factor` moved to C, `release` to later).

Shared stamps across gates (`production-gate`, push gate, PR gate) are a rule for every gate hook, so they likely need an ADR.
